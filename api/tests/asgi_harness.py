"""
서버·소켓 없이 FastAPI 앱을 직접 호출하는 테스트 하네스.

원리
- ASGI 앱은 `app(scope, receive, send)` 형태의 코루틴이다.
- 가상 scope(요청 정보)와 receive(본문 공급), send(응답 수집)를 직접 만들어 넘긴다.
- 코루틴을 `.send(None)` 으로 한 번 진행한다.
    * 끝까지 실행되면 StopIteration 이 나온다 → 정상 완료.
    * 중간에 멈추면(이벤트 루프를 기다리면) 값이 돌아온다 → 코루틴을 닫고 실패 처리.

라우터가 전부 async def 이고 실제 I/O 가 없으면 한 번에 끝난다.
TestClient(httpx) 나 asgiref 를 쓰지 않아도 되므로 의존성이 늘지 않는다.
"""

# 어노테이션을 문자열로 미뤄 둔다.
# 그래야 Python 3.10 미만에서도 이 파일은 import 되고, require_dependencies 가 버전 안내를 낼 수 있다.
from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field


# ------------------------------------------------------------
# 의존성 확인
# ------------------------------------------------------------


def require_dependencies() -> None:
    """
    FastAPI 와 Pydantic v2 가 있는지 확인한다.

    없으면 어떤 환경에서 무엇이 빠졌는지 한 줄로 알려 주는 ImportError 를 낸다.
    테스트를 건너뛰지는 않는다. 실패로 남겨야 "0건 통과" 가 생기지 않는다.
    """

    python_version = ".".join(str(part) for part in sys.version_info[:3])

    # 1) Python 3.10 미만이면 str | None 문법 때문에 import 자체가 깨진다.
    if sys.version_info < (3, 10):
        raise ImportError(
            f"Python 3.10 이상이 필요합니다. 현재 {python_version} 입니다."
        )

    # 2) FastAPI
    try:
        import fastapi  # noqa: F401

    except ImportError as error:
        raise ImportError(
            f"fastapi 패키지가 없습니다 (Python {python_version}). "
            "api/requirements.txt 로 설치한 뒤 다시 실행하세요."
        ) from error

    # 3) Pydantic v2
    try:
        import pydantic

    except ImportError as error:
        raise ImportError(
            f"pydantic 패키지가 없습니다 (Python {python_version}). "
            "api/requirements.txt 로 설치한 뒤 다시 실행하세요."
        ) from error

    if not str(pydantic.VERSION).startswith("2."):
        raise ImportError(
            f"Pydantic v2 가 필요합니다. 현재 {pydantic.VERSION} 입니다."
        )


# ------------------------------------------------------------
# 응답 담는 그릇
# ------------------------------------------------------------


@dataclass
class HarnessResponse:
    """
    앱이 보낸 응답을 모아 둔 결과.

    - status  : HTTP 상태 코드
    - headers : (이름, 값) 문자열 튜플 목록. 이름은 소문자.
    - body    : 본문 바이트 전체
    """

    status: int = 0

    headers: list[tuple[str, str]] = field(default_factory=list)

    body: bytes = b""

    def header(self, name: str) -> str | None:
        """헤더 하나를 이름으로 찾는다. 없으면 None."""

        name = name.lower()

        for key, value in self.headers:
            if key == name:
                return value

        return None

    def json(self):
        """본문을 JSON 으로 해석한다."""

        return json.loads(self.body.decode("utf-8"))


# ------------------------------------------------------------
# 호출 함수
# ------------------------------------------------------------


def call_app(
    app,
    method: str,
    path: str,
    *,
    json_body=None,
    raw_body: bytes | None = None,
    content_type: str = "application/json",
) -> HarnessResponse:
    """
    앱을 한 번 호출하고 응답을 돌려준다.

    - json_body : dict 등 JSON 으로 직렬화할 본문. 지정하면 raw_body 보다 우선.
    - raw_body  : 그대로 보낼 바이트 본문. 잘못된 JSON 을 보낼 때 쓴다.
    - 둘 다 없으면 본문 없는 요청이다.
    """

    # 1) 본문 바이트 준비
    if json_body is not None:
        body = json.dumps(json_body, ensure_ascii=False).encode("utf-8")

    elif raw_body is not None:
        body = raw_body

    else:
        body = b""

    # 2) 헤더 준비. ASGI 는 (소문자 이름 바이트, 값 바이트) 튜플 목록을 쓴다.
    headers = [
        (b"host", b"testserver"),
    ]

    if body:
        headers.append((b"content-type", content_type.encode("latin-1")))

        headers.append((b"content-length", str(len(body)).encode("latin-1")))

    # 3) 가상 scope. 실제 네트워크 정보는 없으므로 client 는 None 으로 둔다.
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
        "headers": headers,
        "client": None,
        "server": None,
    }

    # 4) receive: 본문을 한 번에 넘기고 끝낸다.
    async def receive():
        return {
            "type": "http.request",
            "body": body,
            "more_body": False,
        }

    # 5) send: 앱이 보내는 메시지를 모은다.
    result = HarnessResponse()

    async def send(message):
        message_type = message["type"]

        if message_type == "http.response.start":
            result.status = message["status"]

            result.headers = [
                (key.decode("latin-1").lower(), value.decode("latin-1"))
                for key, value in message.get("headers", [])
            ]

        elif message_type == "http.response.body":
            result.body += message.get("body", b"")

    # 6) 코루틴을 한 번 진행해서 끝까지 가는지 본다.
    coroutine = app(scope, receive, send)

    try:
        yielded = coroutine.send(None)

    except StopIteration:
        # 정상 완료. 응답이 다 모였다.
        return result

    # 여기 왔다면 중간에 대기한 것이다. 코루틴을 닫고 실패로 처리한다.
    coroutine.close()

    raise AssertionError(
        "앱이 한 번에 끝나지 않고 중간에 대기함. "
        "동기 라우터(스레드풀)나 실제 I/O 가 섞였는지 확인할 것. "
        f"대기 객체: {yielded!r}"
    )
