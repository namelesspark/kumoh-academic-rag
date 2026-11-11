"""서버·소켓 없이 ASGI 앱을 직접 호출하는 테스트 전용 헬퍼.

자동 검증 환경은 루프백 소켓을 허용하지 않아 `TestClient`/`httpx`를 쓸 수 없다.
대신 가상 HTTP `scope`와 즉시 반환하는 `receive`/`send` 코루틴을 만들어
앱의 ASGI 코루틴을 `.send(None)`으로 한 번 진행시킨다.
엔드포인트가 모두 `async def`이고 I/O 대기가 없으면 코루틴은 한 번에 끝나며
`StopIteration`을 던진다. 중간에 대기하면 테스트가 실패하도록 예외를 올린다.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Mapping


@dataclass
class AsgiResponse:
    status: int
    headers: dict[str, str] = field(default_factory=dict)
    body: bytes = b""

    def text(self) -> str:
        return self.body.decode("utf-8")

    def json(self) -> Any:
        return json.loads(self.text())


def call_app(
    app: Any,
    method: str,
    path: str,
    *,
    json_body: Any = None,
    raw_body: bytes | None = None,
    headers: Mapping[str, str] | None = None,
    query_string: bytes = b"",
) -> AsgiResponse:
    """ASGI 앱을 한 번 호출해 응답을 돌려준다.

    `json_body`가 있으면 JSON으로 직렬화해 보내고, `raw_body`가 있으면 그대로 보낸다.
    둘 다 없으면 빈 본문이다. Content-Type 기본값은 application/json이다.
    """
    if json_body is not None and raw_body is not None:
        raise ValueError("json_body와 raw_body는 동시에 줄 수 없다")

    if json_body is not None:
        body = json.dumps(json_body, ensure_ascii=False).encode("utf-8")
    elif raw_body is not None:
        body = raw_body
    else:
        body = b""

    header_map: dict[str, str] = {"host": "asgi-harness"}
    if body:
        header_map["content-type"] = "application/json"
        header_map["content-length"] = str(len(body))
    if headers:
        for key, value in headers.items():
            header_map[key.lower()] = value

    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method.upper(),
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("utf-8"),
        "query_string": query_string,
        "root_path": "",
        "headers": [
            (k.encode("latin-1"), v.encode("latin-1")) for k, v in header_map.items()
        ],
        "client": ("asgi-harness", 0),
        "server": ("asgi-harness", 80),
        "state": {},
    }

    pending = [{"type": "http.request", "body": body, "more_body": False}]
    sent: list[dict[str, Any]] = []

    async def receive() -> dict[str, Any]:
        if pending:
            return pending.pop(0)
        return {"type": "http.disconnect"}

    async def send(message: dict[str, Any]) -> None:
        sent.append(message)

    coro = app(scope, receive, send)
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

    status: int | None = None
    response_headers: dict[str, str] = {}
    chunks: list[bytes] = []
    for message in sent:
        kind = message.get("type")
        if kind == "http.response.start":
            status = int(message["status"])
            for key, value in message.get("headers", []):
                response_headers[key.decode("latin-1").lower()] = value.decode("latin-1")
        elif kind == "http.response.body":
            chunks.append(message.get("body", b""))

    if status is None:
        raise AssertionError(f"http.response.start가 전송되지 않았습니다: {sent!r}")

    return AsgiResponse(status=status, headers=response_headers, body=b"".join(chunks))
