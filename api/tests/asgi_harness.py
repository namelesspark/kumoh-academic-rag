"""실제 서버를 띄우지 않고 앱을 파이썬 함수처럼 바로 불러 응답을 받아 보는 테스트 전용 도구(하네스).

하네스는 자동차 엔진을 차에 올리기 전에 작업대에 걸어 두고 돌려 보는 거치대와 같다.
여기서는 웹 서버 없이 앱만 작업대에 올려 요청 하나를 흘려 보낸다.

왜 TestClient를 쓰지 않나:
    자동 검증은 격리된 실행 환경(샌드박스, Windows, 읽기 전용) 안에서 돈다. 이 환경은
    같은 컴퓨터 안에서 자기 자신에게 연결하는 네트워크 통로(루프백 소켓)를 막는다.
    그래서 `TestClient`와 `httpx`가 동작하지 않는다.

대신 어떻게 하나:
    파이썬 웹 앱과 서버 사이의 표준 호출 규약(ASGI, Asynchronous Server Gateway
    Interface)에 따르면 앱은 결국 `await app(scope, receive, send)` 한 번이다. 그래서
    요청을 흉내 낸 `scope`를 손으로 만들고, 본문을 바로 돌려주는 `receive`와
    응답을 리스트에 모으는 `send`를 넘겨 앱의 비동기 함수(코루틴)를 한 번 진행시킨다.
    주소 처리 함수(엔드포인트)는 모두 `async def`다. 그 안에 파일이나 네트워크를
    기다리는 일(I/O, Input/Output)이 없으면 코루틴은 중간에 멈추지 않고 끝까지 간다.
    중간에 멈추면 이 도구가 예외를 올려 테스트를 실패시킨다.

사용 예:
    resp = call_app(app, "GET", "/api/v1/health")
    assert resp.status == 200
    assert resp.json()["status"] == "ok"
"""

import asyncio
import json
from dataclasses import dataclass, field


@dataclass
class AsgiResponse:
    """앱이 `send`로 보낸 메시지를 테스트에서 다루기 쉽게 합친 것."""

    status: int
    headers: dict = field(default_factory=dict)
    body: bytes = b""

    def text(self) -> str:
        return self.body.decode("utf-8")

    def json(self):
        return json.loads(self.text())


def call_app(
    app,
    method: str,
    path: str,
    *,
    json_body=None,
    raw_body: bytes | None = None,
    headers: dict | None = None,
    allow_wait: bool = False,
) -> AsgiResponse:
    """ASGI 앱을 한 번 호출해 응답을 돌려준다.

    `json_body`가 있으면 중괄호와 따옴표로 값을 적는 텍스트 형식(JSON, JavaScript
    Object Notation)으로 바꿔 보낸다. 파이썬 dict를 그 문자열로 바꾸는 일을 직렬화라
    한다. `raw_body`가 있으면 그대로 보낸다(깨진 JSON 테스트용). 둘 다 없으면 빈 본문이다.
    파일 응답처럼 대기가 필요한 테스트는 `allow_wait=True`로 앱을 실행할 수 있다.
    """

    # 1. 본문 만들기 --------------------------------------------------------
    if json_body is not None and raw_body is not None:
        raise ValueError("json_body와 raw_body는 동시에 줄 수 없다")

    if json_body is not None:
        # ensure_ascii=False: 한글을 \uXXXX로 바꾸지 않고 글자 그대로 보낸다.
        # 글자를 바이트로 바꾸는 방식은 표준인 UTF-8(Unicode Transformation Format, 8-bit)이다.
        body = json.dumps(json_body, ensure_ascii=False).encode("utf-8")
    else:
        body = raw_body or b""

    # 2. 요청에 딸려 가는 부가 정보(헤더) 만들기 -----------------------------
    #    본문이 있으면 JSON으로 간주해 기본 헤더를 붙이고, 호출자가 준 헤더가 덮어쓴다.
    header_map = {"host": "asgi-harness"}

    if body:
        header_map["content-type"] = "application/json"
        header_map["content-length"] = str(len(body))

    for key, value in (headers or {}).items():
        header_map[key.lower()] = value

    # 3. scope 만들기 -------------------------------------------------------
    #    실제 서버가 채워 주는 값들을 가짜로 넣는다. 헤더는 ASGI 규칙대로
    #    (소문자 이름, 값) 바이트 쌍의 리스트다.
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method.upper(),
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("utf-8"),
        "query_string": b"",
        "root_path": "",
        "headers": [(k.encode("latin-1"), v.encode("latin-1")) for k, v in header_map.items()],
        "client": ("asgi-harness", 0),
        "server": ("asgi-harness", 80),
        "state": {},
    }

    # 4. receive / send 준비 -------------------------------------------------
    #    receive: 첫 호출에 본문 전체를 주고, 그 뒤로는 연결 종료를 알린다.
    #    send:    앱이 보내는 메시지를 순서대로 모은다.
    pending = [{"type": "http.request", "body": body, "more_body": False}]
    sent = []
    response_complete = asyncio.Event() if allow_wait else None

    async def receive():
        if pending:
            return pending.pop(0)
        if response_complete is not None:
            await response_complete.wait()
        return {"type": "http.disconnect"}

    async def send(message):
        sent.append(message)
        if (
            response_complete is not None
            and message["type"] == "http.response.body"
            and not message.get("more_body", False)
        ):
            response_complete.set()

    # 5. 앱 코루틴을 비동기 실행기(이벤트 루프) 없이 한 번 진행 ----------------
    #    대기 없이 끝나면 StopIteration. 무언가를 내놓으면 중간에 멈춘 것이다.
    coro = app(scope, receive, send)

    if allow_wait:
        asyncio.run(coro)
    else:
        try:
            yielded = coro.send(None)
        except StopIteration:
            pass
        else:
            coro.close()
            raise AssertionError(
                "ASGI 코루틴이 한 번에 완료되지 않고 대기했습니다: "
                f"{yielded!r}. 동기 I/O나 이벤트 루프 의존 코드가 있는지 확인하세요."
            )

    # 6. 모은 메시지를 응답 객체로 합치기 ----------------------------------
    #    http.response.start 에 상태·헤더, http.response.body 에 본문 조각이 있다.
    status = None
    response_headers = {}
    chunks = []

    for message in sent:
        if message["type"] == "http.response.start":
            status = int(message["status"])
            for key, value in message.get("headers", []):
                response_headers[key.decode("latin-1").lower()] = value.decode("latin-1")

        elif message["type"] == "http.response.body":
            chunks.append(message.get("body", b""))

    if status is None:
        raise AssertionError(f"http.response.start가 전송되지 않았습니다: {sent!r}")

    return AsgiResponse(status=status, headers=response_headers, body=b"".join(chunks))
