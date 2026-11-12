"""POST /api/v1/chat에서 앱에 설정한 검색 또는 기본 임시 응답을 제공한다."""

from fastapi import APIRouter, Request

from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.error import ErrorResponse
from app.services.chat_stub import build_stub_chat_result


router = APIRouter()


@router.post(
    "/chat",
    response_model=ChatResponse,
    # 자동 생성 설명서(OpenAPI 문서)에 400 응답이 있다고 알리는 선언.
    # 실제로 400을 만드는 일은 main.py의 예외 처리 함수(핸들러)가 한다.
    responses={400: {"model": ErrorResponse, "description": "요청 형식 오류. 고정 문구 하나만 반환한다."}},
)
async def post_chat(request: ChatRequest, http_request: Request) -> dict:
    """질문을 받아 앱별 설정에 맞는 응답을 돌려준다.

    요청 본문이 ChatRequest 검증을 통과하지 못하면 여기 들어오지 않고
    main.py의 핸들러가 400을 돌려준다.

    서비스가 돌려준 dict는 `response_model=ChatResponse` 덕분에 FastAPI가
    응답 형식 정의(스키마)에 맞춰 검사한다. 검사를 통과한 값은 FastAPI가 중괄호와
    따옴표로 값을 적는 텍스트 형식(JSON, JavaScript Object Notation)으로 바꿔 내보낸다.
    필드가 빠지면 서버 쪽 오류가 난다.
    """

    chat_retrieval = http_request.app.state.chat_retrieval
    if chat_retrieval is not None:
        return chat_retrieval.build_result(request.message, request.session_id)

    return build_stub_chat_result(
        message=request.message,
        session_id=request.session_id,
        use_academic_data=request.use_academic_data,
    )
