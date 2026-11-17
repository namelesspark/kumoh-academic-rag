"""질문 주소 두 개. POST /api/v1/chat은 완성된 답 하나를, POST /api/v1/chat/stream은 조각 전송을 돌려준다.

두 주소 모두 검색과 관련성 검사를 먼저 한다. 근거가 있고 AI가 설정돼 있을 때만 AI를 부른다.
AI가 꺼져 있거나 보류인 질문은 기존 주소가 기다림 없이 지금 답을 그대로 돌려준다.
"""

import asyncio
from collections.abc import AsyncIterator, Awaitable
from contextlib import aclosing

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.responses import StreamingResponse

from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.error import ErrorResponse
from app.services.ai_chat import ERROR_EVENT, NOTICE_TEXT, Event, chat_events, format_event, is_foreign_question
from app.services.chat_stub import build_stub_chat_result


router = APIRouter()

# 자동 생성 설명서(OpenAPI 문서)에 400 응답이 있다고 알리는 선언.
# 실제로 400을 만드는 일은 main.py의 예외 처리 함수(핸들러)가 한다.
BAD_REQUEST = {400: {"model": ErrorResponse, "description": "요청 형식 오류. 고정 문구 하나만 반환한다."}}
STREAM_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
# 스트림 하나가 열려 있을 수 있는 최대 초. AI 전체 제한(90초)보다 조금 길게 잡는다.
STREAM_TIMEOUT = 95.0


async def _wait_for_disconnect(receive) -> None:
    while (await receive())["type"] != "http.disconnect":
        pass


async def run_until_disconnect(receive, work: Awaitable, *, timeout: float | None = None) -> tuple[bool, object]:
    """일을 돌리다가 브라우저가 연결을 끊거나 `timeout`초가 지나면 그 일을 취소한다.

    두 주소가 함께 쓴다. 일을 취소하면 그 안의 AI 호출 생성기가 위쪽 응답을 닫고 동시 호출
    자리를 돌려준다. 끝까지 돌았으면 (True, 결과)를, 취소했으면 (False, None)을 돌려준다.
    일이 낸 예외는 그대로 올린다.
    """

    job = asyncio.ensure_future(work)
    watcher = asyncio.ensure_future(_wait_for_disconnect(receive))
    try:
        await asyncio.wait((job, watcher), timeout=timeout, return_when=asyncio.FIRST_COMPLETED)
    finally:
        job.cancel()
        watcher.cancel()
        await asyncio.gather(job, watcher, return_exceptions=True)
    if job.cancelled():
        return False, None
    return True, job.result()


class EventStreamResponse(StreamingResponse):
    """조각 전송 응답. 브라우저가 연결을 끊으면 이벤트 생성기를 닫아 위쪽 요청도 취소한다.

    Starlette의 StreamingResponse는 끊김을 알아도 생성기를 닫지 않는다. 생성기가 위쪽
    응답과 동시 호출 자리를 쥐고 있으므로 여기서 직접 닫는다.
    """

    media_type = "text/event-stream"

    def __init__(self, content: AsyncIterator[bytes]) -> None:
        super().__init__(content, media_type=self.media_type, headers=STREAM_HEADERS)

    async def _stream(self, send) -> None:
        try:
            async for chunk in self.body_iterator:
                await send({"type": "http.response.body", "body": chunk, "more_body": True})
            await send({"type": "http.response.body", "body": b"", "more_body": False})
        except OSError:
            return  # 끊긴 연결에 보내려 한 경우

    async def __call__(self, scope, receive, send) -> None:
        await send({"type": "http.response.start", "status": self.status_code, "headers": self.raw_headers})
        try:
            # 천천히 받는 연결이 보내기 대기에서 자리를 오래 붙잡지 않게 전체 시간을 둔다.
            await run_until_disconnect(receive, self._stream(send), timeout=STREAM_TIMEOUT)
        finally:
            await self.body_iterator.aclose()
        if self.background is not None:
            await self.background()


async def encode_events(events: AsyncIterator[Event], *, lang: str = "ko") -> AsyncIterator[bytes]:
    async with aclosing(events):
        try:
            async for name, data in events:
                yield format_event(name, data)
        except Exception:
            error = {"en": "Could not receive the answer.", "zh": "未能收到回答。"}.get(lang)
            yield format_event("error", {**ERROR_EVENT, "message": error} if error else ERROR_EVENT)


def _search(request: ChatRequest, state, *, query: str | None = None) -> tuple[dict, bool]:
    """(지금의 응답, 검색을 거쳤는지). 검색이 없으면 임시 응답(스텁)이다."""

    chat_retrieval = state.chat_retrieval
    if chat_retrieval is not None:
        options = {"lang": request.lang} if request.lang != "ko" else {}
        result = chat_retrieval.build_result(
            request.message if query is None else query, request.session_id,
            relaxed=getattr(state, "ai_chat", None) is not None, **options
        )
    else:
        result = build_stub_chat_result(
            message=request.message,
            session_id=request.session_id,
            use_academic_data=request.use_academic_data,
            lang=request.lang,
        )
    if request.lang != "ko" and getattr(state, "ai_chat", None) is None and is_foreign_question(request.message):
        result["answer"] += {
            "en": " Asking in Korean helps find regulations more accurately.",
            "zh": " 使用韩语提问能更准确地查找规章。",
        }[request.lang]
    return result, chat_retrieval is not None


def _localized_events(request: ChatRequest, state) -> AsyncIterator[Event]:
    return state.ai_chat.localized_events(
        request.message, request.mode,
        lambda query: _search(request, state, query=query)[0], lang=request.lang,
    )


async def _localized_complete(request: ChatRequest, state) -> dict:
    body = {"answer": "", "answered": False, "personalized": False}
    async with aclosing(_localized_events(request, state)) as events:
        async for name, data in events:
            if name == "meta":
                body.update(data)
            elif name == "answer":
                body["answer"] = data["text"] if data["replace"] else body["answer"] + data["text"]
            elif name == "notice":
                body["notice"] = data["text"]
            elif name == "done":
                body.update(data)
    if not body["answered"]:
        body["citations"] = []
    return body


def _json_response(body: dict):
    notice = body.pop("notice", None)
    guided = body.pop("guided", None)
    content = ChatResponse.model_validate(body).model_dump(mode="json")
    if notice is not None:
        content["notice"] = notice
    if guided is True:
        content["guided"] = True
    return JSONResponse(content)


@router.post("/chat", response_model=ChatResponse, responses=BAD_REQUEST)
async def post_chat(request: ChatRequest, http_request: Request):
    """질문을 받아 완성된 답 하나를 돌려준다.

    요청 본문이 ChatRequest 검증을 통과하지 못하면 여기 들어오지 않고 main.py의 핸들러가
    400을 돌려준다. 응답은 여섯 필드이고, AI 답을 만들지 못해 조문 원문으로 대체했을 때만
    `notice` 필드를 더한다.
    """

    state = http_request.app.state
    if request.lang != "ko" and getattr(state, "ai_chat", None) is not None and state.chat_retrieval is not None:
        finished, body = await run_until_disconnect(http_request.receive, _localized_complete(request, state))
        if not finished:
            body = _search(request, state)[0]
        return _json_response(body)
    result, searched = _search(request, state)
    ai = getattr(state, "ai_chat", None)
    if ai is None or not searched:
        return result

    # 브라우저가 끊으면 AI 호출을 취소해 자리를 돌려준다. 끊김을 알 수 없는 연결은 AI의
    # 전체 90초 제한이 상한이다. 끊긴 연결에 보낼 응답은 아무도 읽지 않지만, 서버가 응답
    # 하나를 끝내야 하므로 조문 원문과 안내를 담는다.
    finished, body = await run_until_disconnect(
        http_request.receive, ai.complete(result, request.message, request.mode)
    )
    if not finished:
        body = dict(result)
        if result["answered"]:
            body["notice"] = NOTICE_TEXT
    notice = body.pop("notice", None)
    guided = body.pop("guided", None)
    if notice is None and guided is not True:
        return body
    content = ChatResponse.model_validate(body).model_dump(mode="json")
    if notice is not None:
        content["notice"] = notice
    if guided is True:
        content["guided"] = True
    return JSONResponse(content)


@router.post(
    "/chat/stream",
    # 응답 클래스는 처리 함수가 직접 만들어 돌려준다. 장식자에 스트림 응답 클래스를 지정하면
    # 일부 FastAPI 버전의 설명서(OpenAPI) 생성이 깨지므로, 미디어 형식은 responses로만 알린다.
    response_model=None,
    responses={
        200: {
            "description": "meta·thinking·answer·notice·done·error 이벤트의 조각 전송",
            "content": {"text/event-stream": {"schema": {"type": "string"}}},
        },
        **BAD_REQUEST,
    },
)
async def post_chat_stream(request: ChatRequest, http_request: Request):
    """질문을 받아 답을 조각 전송(SSE, Server-Sent Events)으로 흘려보낸다."""

    state = http_request.app.state
    if request.lang != "ko" and getattr(state, "ai_chat", None) is not None and state.chat_retrieval is not None:
        return EventStreamResponse(encode_events(_localized_events(request, state), lang=request.lang))
    result, searched = _search(request, state)
    events = chat_events(
        result, request.message, request.mode, getattr(state, "ai_chat", None), searched=searched, lang=request.lang
    )
    return EventStreamResponse(encode_events(events, lang=request.lang))
