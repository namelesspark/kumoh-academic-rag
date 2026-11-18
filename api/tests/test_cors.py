"""앱용 출처 허용(CORS) 설정을 서버 없이 확인한다 (이슈 #125).

배포 진입점(api/serve.py)이 만든 앱에 `Origin` 헤더를 실은 가상 요청을 바로 흘려 보낸다.
출처 주소는 모두 가상이며(`.invalid`), 네트워크와 소켓을 쓰지 않는다.
"""

import asyncio
import json
import unittest

from fastapi import FastAPI

from api.tests.asgi_harness import call_app, parse_events, run_without_sockets
from api.tests.test_serve import import_serve

from app.main import (
    CORS_ENV,
    DEFAULT_CORS_ORIGINS,
    app as default_app,
    cors_origins_from_environ,
    install_cors,
)


HEALTH = "/api/v1/health"
STREAM = "/api/v1/chat/stream"
CHAT = "/api/v1/chat"
ALLOWED = "https://aio-app.example.invalid"
OTHER = "https://stranger.example.invalid"
ALLOW_ORIGIN = "access-control-allow-origin"
ALLOW_CREDENTIALS = "access-control-allow-credentials"


def stream_with_origin(app, origin: str, json_body: dict) -> tuple[int, dict, str]:
    """`Origin` 헤더를 실은 조각 전송 POST 하나를 보내 (상태, 응답 헤더, 본문 글)을 돌려준다.

    공용 도구 `stream_app`은 요청 헤더를 받지 않으므로 같은 모양의 호출을 여기서 만든다.
    응답이 끝나면 연결 종료를 알린다.
    """

    body = json.dumps(json_body, ensure_ascii=False).encode("utf-8")
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": STREAM,
        "raw_path": STREAM.encode("utf-8"),
        "query_string": b"",
        "root_path": "",
        "headers": [
            (b"host", b"asgi-harness"),
            (b"origin", origin.encode("latin-1")),
            (b"content-type", b"application/json"),
            (b"content-length", str(len(body)).encode("latin-1")),
        ],
        "client": ("asgi-harness", 0),
        "server": ("asgi-harness", 80),
        "state": {},
    }
    sent = []

    async def run():
        finished = asyncio.Event()
        pending = [{"type": "http.request", "body": body, "more_body": False}]

        async def receive():
            if pending:
                return pending.pop(0)
            await finished.wait()
            return {"type": "http.disconnect"}

        async def send(message):
            sent.append(message)
            if message["type"] == "http.response.body" and not message.get("more_body", False):
                finished.set()

        await app(scope, receive, send)

    run_without_sockets(run())
    start = next(message for message in sent if message["type"] == "http.response.start")
    headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in start.get("headers", [])}
    text = b"".join(m.get("body", b"") for m in sent if m["type"] == "http.response.body").decode("utf-8")
    return int(start["status"]), headers, text


class OriginSettingTests(unittest.TestCase):
    def test_missing_or_blank_setting_uses_defaults(self):
        self.assertEqual(DEFAULT_CORS_ORIGINS, ("https://localhost", "http://127.0.0.1:5173"))
        for environ in ({}, {CORS_ENV: ""}, {CORS_ENV: "  "}, {CORS_ENV: " , ,"}):
            with self.subTest(environ=environ):
                self.assertEqual(cors_origins_from_environ(environ), DEFAULT_CORS_ORIGINS)

    def test_comma_list_is_trimmed_and_deduplicated_in_order(self):
        value = f" {ALLOWED} ,https://localhost,, {ALLOWED},http://127.0.0.1:5173 "
        self.assertEqual(
            cors_origins_from_environ({CORS_ENV: value}),
            (ALLOWED, "https://localhost", "http://127.0.0.1:5173"),
        )
        self.assertEqual(
            cors_origins_from_environ({CORS_ENV: "http://[::1]:8080"}), ("http://[::1]:8080",)
        )

    def test_bad_origins_stop_with_setting_name_and_reason_only(self):
        bad = (
            "*",
            f"{ALLOWED},*",
            "ftp://files.example.invalid",
            "aio-app.example.invalid",
            "https://",
            f"{ALLOWED}/",
            f"{ALLOWED}/app",
            f"{ALLOWED}?from=pwa",
            f"{ALLOWED}?",
            f"{ALLOWED}#top",
            "https://someone@aio-app.example.invalid",
            "https://AIO-App.example.invalid",
            "HTTPS://aio-app.example.invalid",
            "https://aio-app.example.invalid:port",
            "https://aio-app.example.invalid:",
        )
        for value in bad:
            with self.subTest(value=value):
                with self.assertRaises(ValueError) as caught:
                    cors_origins_from_environ({CORS_ENV: value})
                message = str(caught.exception)
                self.assertTrue(message.startswith(f"{CORS_ENV}: "), message)
                self.assertNotIn("example.invalid", message)

    def test_install_rejects_bad_origin_given_directly(self):
        for origins in (("*",), ("https://localhost/",)):
            with self.subTest(origins=origins), self.assertRaises(ValueError):
                install_cors(FastAPI(), origins)

    def test_bad_setting_stops_startup(self):
        with self.assertRaises(ValueError) as caught:
            import_serve({CORS_ENV: f"{ALLOWED}/"})
        self.assertTrue(str(caught.exception).startswith(f"{CORS_ENV}: "))


class CorsResponseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        serve = import_serve({})
        cls.default_serve_app = serve.app
        cls.configured_app = serve.create_app({CORS_ENV: ALLOWED})

    def preflight(self, application, origin, method, headers="content-type"):
        request = {"Origin": origin, "Access-Control-Request-Method": method}
        if headers:
            request["Access-Control-Request-Headers"] = headers
        return call_app(application, "OPTIONS", CHAT, headers=request)

    def test_allowed_origin_gets_header_on_plain_response(self):
        cases = (
            (self.configured_app, ALLOWED),
            (self.default_serve_app, "https://localhost"),
            (self.default_serve_app, "http://127.0.0.1:5173"),
        )
        for application, origin in cases:
            with self.subTest(origin=origin):
                response = call_app(application, "GET", HEALTH, headers={"Origin": origin})
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers.get(ALLOW_ORIGIN), origin)
                self.assertIn("origin", response.headers.get("vary", "").lower())
                self.assertNotIn(ALLOW_CREDENTIALS, response.headers)

    def test_other_origin_gets_no_header(self):
        cases = (
            (self.configured_app, OTHER),
            # 설정 값을 넣으면 기본 출처 대신 적은 출처만 허용한다.
            (self.configured_app, "https://localhost"),
            (self.default_serve_app, OTHER),
            (self.default_serve_app, "https://localhost/"),
        )
        for application, origin in cases:
            with self.subTest(origin=origin):
                response = call_app(application, "GET", HEALTH, headers={"Origin": origin})
                self.assertEqual(response.status, 200)
                self.assertNotIn(ALLOW_ORIGIN, response.headers)
                self.assertNotIn(ALLOW_CREDENTIALS, response.headers)

    def test_stream_response_carries_header_only_for_allowed_origin(self):
        body = {"message": "얼룩말 풍금"}
        for origin, expected in ((ALLOWED, ALLOWED), (OTHER, None)):
            with self.subTest(origin=origin):
                status, headers, text = stream_with_origin(self.configured_app, origin, body)
                self.assertEqual(status, 200)
                self.assertTrue(headers["content-type"].startswith("text/event-stream"))
                self.assertEqual(parse_events(text)[-1][0], "done")
                self.assertEqual(headers.get(ALLOW_ORIGIN), expected)
                self.assertNotIn(ALLOW_CREDENTIALS, headers)

    def test_preflight_allows_only_get_post_and_content_type(self):
        for method in ("GET", "POST"):
            with self.subTest(method=method):
                response = self.preflight(self.configured_app, ALLOWED, method)
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers.get(ALLOW_ORIGIN), ALLOWED)
                methods = {m.strip() for m in response.headers["access-control-allow-methods"].split(",")}
                self.assertEqual(methods, {"GET", "POST"})
                # Starlette가 기본 안전 헤더를 함께 적으므로 Content-Type이 들어 있는지만 본다.
                allowed = {h.strip().lower() for h in response.headers["access-control-allow-headers"].split(",")}
                self.assertIn("content-type", allowed)
                self.assertNotIn("authorization", allowed)
                self.assertNotIn(ALLOW_CREDENTIALS, response.headers)

    def test_preflight_rejects_put_authorization_and_other_origin(self):
        cases = (
            ("PUT", ALLOWED, "content-type"),
            ("DELETE", ALLOWED, "content-type"),
            ("POST", ALLOWED, "content-type, authorization"),
            ("POST", OTHER, "content-type"),
        )
        for method, origin, headers in cases:
            with self.subTest(method=method, origin=origin, headers=headers):
                response = self.preflight(self.configured_app, origin, method, headers)
                self.assertEqual(response.status, 400)
                self.assertNotIn(ALLOW_CREDENTIALS, response.headers)
                if origin == OTHER:
                    self.assertNotIn(ALLOW_ORIGIN, response.headers)

    def test_module_app_of_main_does_not_install_cors(self):
        # app.main은 환경 변수를 읽지 않는다. 출처 허용은 배포 진입점만 단다.
        response = call_app(default_app, "GET", HEALTH, headers={"Origin": "https://localhost"})
        self.assertEqual(response.status, 200)
        self.assertNotIn(ALLOW_ORIGIN, response.headers)


if __name__ == "__main__":
    unittest.main()
