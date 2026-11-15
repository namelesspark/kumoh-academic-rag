"""질문 주소 두 개(POST /api/v1/chat, POST /api/v1/chat/stream)가 AI 설정에 따라 약속대로 답하는지 본다.

서버를 띄우지 않고 앱을 파이썬 함수처럼 바로 부른다 (ASGI 직접 호출). 위쪽 AI 서버는
`test_ai_chat`의 가짜 전송으로 대신한다. 규정·질문·키는 모두 가상이다.
"""

import asyncio
import json
import time
import unittest
from datetime import date

from api.regulation_app import create_regulation_app
from api.tests.asgi_harness import call_app, parse_events, stream_app
from api.tests.test_ai_chat import (
    ANSWER_STREAM,
    API_KEY,
    SETTINGS,
    FakeTransport,
    assert_no_secret_in_logs,
    captured_logs,
    delta,
    sse,
)

from app.main import VALIDATION_ERROR_MESSAGE, create_app
from app.services.ai_chat import NOTICE_TEXT, AiChat, AiLimits
from app.services.chat_stub import ANSWERED_TEXT, FICTIONAL_QUESTION, UNANSWERABLE_TEXT


CHAT = "/api/v1/chat"
STREAM = "/api/v1/chat/stream"
DOCUMENT_TITLE = "가상 혜성 관측소 규정"
EFFECTIVE_DATE = date(2099, 2, 3)
SOURCE_URL = "https://example.invalid/fictional-observatory"
FIRST_ARTICLE = "제1조(혜성 관측) 혜성망원경은 보름날에 빌린다."
SOURCE = f"{DOCUMENT_TITLE}\n\n{FIRST_ARTICLE}\n제2조(운석 전시) 운석표본은 유리장에 둔다.\n"
QUESTION = "혜성망원경"
HOLD_QUESTION = "얼룩말 풍금"
CITATION = {
    "article_path": "제1조(혜성 관측)",
    "document": DOCUMENT_TITLE,
    "effective_date": EFFECTIVE_DATE.isoformat(),
    "snippet": FIRST_ARTICLE,
    "source_url": SOURCE_URL,
}
SIX_FIELDS = {"session_id", "answer", "citations", "answered", "personalized", "latency_ms"}
SHORT = AiLimits(connect=5.0, first_token=0.05, total=1.0, slots=4, slot_wait=0.05)


def regulation_app(transport=None, limits=AiLimits()):
    application = create_regulation_app(
        SOURCE, document_title=DOCUMENT_TITLE, effective_date=EFFECTIVE_DATE, source_url=SOURCE_URL
    )
    if transport is not None:
        application.state.ai_chat = AiChat(SETTINGS, transport=transport, limits=limits)
    return application


def stream(application, body, **kwargs):
    response = stream_app(application, STREAM, json_body=body, **kwargs)
    return response, parse_events(response.text())


def joined_answer(events) -> str:
    text = ""
    for name, data in events:
        if name == "answer":
            text = data["text"] if data["replace"] else text + data["text"]
    return text


class StreamRouteTests(unittest.TestCase):
    def test_headers_and_event_order(self):
        response, events = stream(regulation_app(FakeTransport([ANSWER_STREAM])), {"message": QUESTION, "mode": "deep"})
        self.assertEqual(response.status, 200)
        self.assertTrue(response.headers["content-type"].startswith("text/event-stream"))
        self.assertEqual(response.headers["cache-control"], "no-cache")
        self.assertEqual(response.headers["x-accel-buffering"], "no")
        self.assertNotIn("content-length", response.headers)
        self.assertTrue(response.complete)
        self.assertEqual([n for n, _ in events], ["meta", "thinking", "thinking", "answer", "answer", "done"])
        self.assertGreater(len(response.chunks), 2, "이벤트를 한 덩어리로 모아 보내면 안 됩니다.")
        meta = events[0][1]
        self.assertEqual(set(meta), {"answered", "citations", "session_id", "personalized"})
        self.assertEqual(meta["citations"], [CITATION])
        self.assertEqual(set(events[-1][1]["latency_ms"]), {"retrieval", "generation", "total"})

    def test_model_text_does_not_change_citations(self):
        model_text = "제9조 https://fictional-other.example.invalid 에 따르세요"
        transport = FakeTransport([sse(delta(content=model_text))])
        _, events = stream(regulation_app(transport), {"message": QUESTION})
        self.assertEqual(events[0][1]["citations"], [CITATION])
        self.assertEqual(joined_answer(events), model_text)

    def test_mode_defaults_to_fast(self):
        transport = FakeTransport([ANSWER_STREAM])
        _, events = stream(regulation_app(transport), {"message": QUESTION})
        self.assertEqual(transport.calls[0]["body"]["reasoning_effort"], "none")
        self.assertNotIn("thinking", [n for n, _ in events])

    def test_held_question_never_calls_ai(self):
        transport = FakeTransport([ANSWER_STREAM])
        _, events = stream(regulation_app(transport), {"message": HOLD_QUESTION, "mode": "deep"})
        self.assertEqual(transport.calls, [])
        self.assertEqual([n for n, _ in events], ["meta", "answer", "done"])
        self.assertEqual(events[0][1]["answered"], False)
        self.assertEqual(events[0][1]["citations"], [])
        self.assertEqual(events[1][1], {"text": UNANSWERABLE_TEXT, "replace": False})

    def test_ai_off_sends_article_with_notice(self):
        _, events = stream(regulation_app(), {"message": QUESTION})
        self.assertEqual([n for n, _ in events], ["meta", "answer", "notice", "done"])
        self.assertEqual(events[1][1]["text"], FIRST_ARTICLE)
        self.assertEqual(events[2][1], {"text": NOTICE_TEXT})

    def test_stub_app_keeps_stub_answer_without_ai(self):
        application = create_app()
        transport = FakeTransport([ANSWER_STREAM])
        application.state.ai_chat = AiChat(SETTINGS, transport=transport)
        _, events = stream(application, {"message": FICTIONAL_QUESTION})
        self.assertEqual(transport.calls, [])
        self.assertEqual([n for n, _ in events], ["meta", "answer", "done"])
        self.assertEqual(events[1][1]["text"], ANSWERED_TEXT)

    def test_upstream_failure_falls_back(self):
        _, events = stream(regulation_app(FakeTransport(status=500), SHORT), {"message": QUESTION})
        self.assertEqual([n for n, _ in events], ["meta", "answer", "notice", "done"])
        self.assertEqual(joined_answer(events), FIRST_ARTICLE)

    def test_browser_disconnect_cancels_upstream_and_returns_slot(self):
        transport = FakeTransport([sse(delta(content="가상 첫 조각"), done=False)], hang=True)
        application = regulation_app(transport)
        response, events = stream(application, {"message": QUESTION}, disconnect_after=2)
        self.assertFalse(response.complete)
        self.assertEqual([n for n, _ in events], ["meta", "answer"])
        self.assertEqual(transport.closed, 1)
        self.assertEqual(application.state.ai_chat.available_slots, 4)

    def test_disconnect_before_first_token_returns_slot(self):
        transport = FakeTransport(hang=True)
        application = regulation_app(transport)
        started = time.monotonic()
        response, events = stream(application, {"message": QUESTION}, disconnect_after=1)
        self.assertLess(time.monotonic() - started, 5.0)
        self.assertFalse(response.complete)
        self.assertEqual([n for n, _ in events], ["meta"])
        self.assertEqual(transport.closed, 1)
        self.assertEqual(application.state.ai_chat.available_slots, 4)

    def test_unexpected_error_sends_fixed_error_event(self):
        class BrokenChat(AiChat):
            async def events(self, result, message, mode):
                yield "meta", {"answered": True}
                raise RuntimeError(f"내부 오류 {API_KEY}")

        application = regulation_app()
        application.state.ai_chat = BrokenChat(SETTINGS, transport=FakeTransport())
        response, events = stream(application, {"message": QUESTION})
        self.assertEqual(events[-1], ("error", {"code": "stream_failed", "message": "답변을 받지 못했어요"}))
        self.assertNotIn(API_KEY, response.text())
        self.assertNotIn("내부 오류", response.text())

    def test_bad_mode_is_fixed_400_on_both_routes(self):
        application = regulation_app(FakeTransport([ANSWER_STREAM]))
        for path in (CHAT, STREAM):
            for mode in ("slow", "", None, 1, "FAST"):
                with self.subTest(path=path, mode=mode):
                    response = call_app(application, "POST", path, json_body={"message": QUESTION, "mode": mode})
                    self.assertEqual(response.status, 400)
                    self.assertEqual(response.json(), {"detail": VALIDATION_ERROR_MESSAGE})

    def test_openapi_lists_stream_without_422(self):
        response = call_app(create_app(), "GET", "/openapi.json")
        self.assertEqual(response.status, 200)
        responses = response.json()["paths"][STREAM]["post"]["responses"]
        self.assertIn("200", responses)
        self.assertIn("text/event-stream", responses["200"]["content"])
        self.assertIn("400", responses)
        self.assertNotIn("422", responses)


class JsonRouteTests(unittest.TestCase):
    def ask(self, application, question, *, wait=True, mode="deep"):
        response = call_app(
            application, "POST", CHAT, json_body={"message": question, "mode": mode}, allow_wait=wait
        )
        self.assertEqual(response.status, 200)
        return response.json()

    def test_ai_answer_is_joined_with_six_fields(self):
        body = self.ask(regulation_app(FakeTransport([ANSWER_STREAM])), QUESTION)
        self.assertEqual(set(body), SIX_FIELDS)
        self.assertEqual(body["answer"], "제3조에 따르면 별지기가 내줍니다.")
        self.assertEqual(body["citations"], [CITATION])
        self.assertIs(body["answered"], True)

    def test_fallback_adds_notice_field_only(self):
        body = self.ask(regulation_app(FakeTransport(error=OSError()), SHORT), QUESTION)
        self.assertEqual(set(body), SIX_FIELDS | {"notice"})
        self.assertEqual(body["notice"], NOTICE_TEXT)
        self.assertEqual(body["answer"], FIRST_ARTICLE)
        self.assertEqual(body["citations"], [CITATION])

    def assert_disconnect_cancels(self, transport, delay):
        """요청 중 브라우저가 끊으면 위쪽 요청을 닫고 자리 4개를 돌려준다.

        제한값은 기본(첫 글자 25초, 전체 90초)이다. 취소가 빠지면 제한까지 기다린 뒤에야
        자리가 돌아오므로, 걸린 시간도 함께 본다.
        """

        opened = asyncio.Event()
        transport.on_open = opened.set
        application = regulation_app(transport)

        async def browser_leaves():
            await opened.wait()
            await asyncio.sleep(delay)

        started = time.monotonic()
        response = call_app(
            application, "POST", CHAT, json_body={"message": QUESTION}, allow_wait=True,
            disconnect_when=browser_leaves,
        )
        self.assertLess(time.monotonic() - started, 5.0)
        self.assertEqual(len(transport.calls), 1)
        self.assertEqual(transport.closed, 1)
        self.assertEqual(application.state.ai_chat.available_slots, 4)
        body = response.json()
        self.assertEqual(body["citations"], [CITATION])
        self.assertEqual(body["answer"], FIRST_ARTICLE)
        self.assertEqual(body["notice"], NOTICE_TEXT)

    def test_disconnect_before_first_token_cancels_upstream(self):
        self.assert_disconnect_cancels(FakeTransport(hang=True), delay=0.0)

    def test_disconnect_after_first_answer_chunk_cancels_upstream(self):
        # Codex 재현: 첫 글자 이후에 끊으면 전체 90초까지 자리가 남았다.
        chunk = sse(delta(content="가상 첫 조각"), done=False)
        self.assert_disconnect_cancels(FakeTransport([chunk], hang=True), delay=0.05)

    def test_ai_off_and_held_questions_finish_without_waiting(self):
        transport = FakeTransport([ANSWER_STREAM])
        cases = ((regulation_app(), QUESTION, FIRST_ARTICLE), (regulation_app(transport), HOLD_QUESTION, UNANSWERABLE_TEXT))
        for application, question, answer in cases:
            with self.subTest(question=question):
                body = self.ask(application, question, wait=False)
                self.assertEqual(set(body), SIX_FIELDS)
                self.assertEqual(body["answer"], answer)
        self.assertEqual(transport.calls, [])

    def test_question_answer_and_key_stay_out_of_logs(self):
        with captured_logs() as records:
            self.ask(regulation_app(FakeTransport([ANSWER_STREAM])), QUESTION)
            body = self.ask(regulation_app(FakeTransport(error=OSError(API_KEY)), SHORT), QUESTION)
            stream(regulation_app(FakeTransport(error=OSError(API_KEY)), SHORT), {"message": QUESTION})
        assert_no_secret_in_logs(self, records, API_KEY, QUESTION, "별지기가 내줍니다", FIRST_ARTICLE)
        self.assertNotIn(API_KEY, json.dumps(body, ensure_ascii=False))


if __name__ == "__main__":
    unittest.main()
