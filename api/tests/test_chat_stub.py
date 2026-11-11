import sys, pathlib; _T = pathlib.Path(__file__).resolve().parent; sys.path[:0] = [str(_T.parent), str(_T)]  # noqa: E401,E702  api/, api/tests

import unittest
import uuid

from asgi_harness import call_app
from app.main import VALIDATION_ERROR_MESSAGE, app
from app.schemas.chat import ChatRequest

CHAT = "/api/v1/chat"
RESPONSE_FIELDS = {
    "session_id",
    "answer",
    "citations",
    "answered",
    "personalized",
    "latency_ms",
}
CITATION_FIELDS = {"article_path", "document", "effective_date", "snippet", "source_url"}
ZERO_LATENCY = {"retrieval": 0, "generation": 0, "total": 0}

# 명백히 가상인 주제. 실제 학칙과 무관하다.
FICTIONAL_QUESTION = "가상 우주정거장의 달 기지 정리는 누가 언제 해?"
UNRELATED_QUESTION = "가상 행성 간 텔레포트 수수료는 얼마야?"


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
    except (ValueError, TypeError):
        return False
    return True


class ChatSuccessResponseTest(unittest.TestCase):
    def test_fictional_question_returns_answered_with_one_citation(self):
        resp = call_app(app, "POST", CHAT, json_body={"message": FICTIONAL_QUESTION})

        self.assertEqual(resp.status, 200)
        body = resp.json()
        self.assertEqual(set(body), RESPONSE_FIELDS)
        self.assertTrue(body["answered"])
        self.assertFalse(body["personalized"])
        self.assertEqual(body["latency_ms"], ZERO_LATENCY)
        self.assertTrue(body["answer"])

        self.assertEqual(len(body["citations"]), 1)
        citation = body["citations"][0]
        self.assertEqual(set(citation), CITATION_FIELDS)
        self.assertTrue(citation["source_url"].startswith("https://example.invalid/"))
        self.assertIn("가상", citation["document"])
        self.assertRegex(citation["article_path"], r"^제\d+조(의\d+)?\(.+\)")
        self.assertRegex(citation["effective_date"], r"^\d{4}-\d{2}-\d{2}$")

    def test_unrelated_question_returns_unanswerable_with_all_fields(self):
        resp = call_app(app, "POST", CHAT, json_body={"message": UNRELATED_QUESTION})

        self.assertEqual(resp.status, 200)
        body = resp.json()
        self.assertEqual(set(body), RESPONSE_FIELDS)
        self.assertFalse(body["answered"])
        self.assertEqual(body["citations"], [])
        self.assertFalse(body["personalized"])
        self.assertEqual(body["latency_ms"], ZERO_LATENCY)
        self.assertIn("확인할 수 없습니다", body["answer"])
        # 전화번호는 설정 분리 단계로 미뤘다. 안내 문구에 번호 패턴이 없어야 한다.
        self.assertNotRegex(body["answer"], r"\d{2,4}-\d{3,4}")

    def test_citations_empty_implies_not_answered(self):
        for question in (FICTIONAL_QUESTION, UNRELATED_QUESTION):
            with self.subTest(question=question):
                body = call_app(app, "POST", CHAT, json_body={"message": question}).json()
                if not body["citations"]:
                    self.assertFalse(body["answered"])


class ChatSessionTest(unittest.TestCase):
    def test_session_id_is_issued_when_omitted(self):
        body = call_app(app, "POST", CHAT, json_body={"message": UNRELATED_QUESTION}).json()
        self.assertTrue(_is_uuid(body["session_id"]))

    def test_issued_session_ids_differ_between_requests(self):
        first = call_app(app, "POST", CHAT, json_body={"message": UNRELATED_QUESTION}).json()
        second = call_app(app, "POST", CHAT, json_body={"message": UNRELATED_QUESTION}).json()
        self.assertNotEqual(first["session_id"], second["session_id"])

    def test_provided_session_id_is_returned_unchanged(self):
        given = str(uuid.uuid4())
        body = call_app(
            app, "POST", CHAT, json_body={"message": FICTIONAL_QUESTION, "session_id": given}
        ).json()
        self.assertEqual(body["session_id"], given)

    def test_provided_session_id_keeps_original_casing(self):
        given = str(uuid.uuid4()).upper()
        body = call_app(
            app, "POST", CHAT, json_body={"message": UNRELATED_QUESTION, "session_id": given}
        ).json()
        self.assertEqual(body["session_id"], given)


class ChatAcademicDataFlagTest(unittest.TestCase):
    def test_use_academic_data_defaults_to_false(self):
        self.assertFalse(ChatRequest(message="가상 질문").use_academic_data)

    def test_omitted_flag_behaves_like_false(self):
        omitted = call_app(app, "POST", CHAT, json_body={"message": FICTIONAL_QUESTION}).json()
        explicit = call_app(
            app, "POST", CHAT, json_body={"message": FICTIONAL_QUESTION, "use_academic_data": False}
        ).json()
        for key in RESPONSE_FIELDS - {"session_id"}:
            self.assertEqual(omitted[key], explicit[key], key)

    def test_true_flag_never_personalizes(self):
        resp = call_app(
            app, "POST", CHAT, json_body={"message": FICTIONAL_QUESTION, "use_academic_data": True}
        )
        self.assertEqual(resp.status, 200)
        self.assertFalse(resp.json()["personalized"])


class ChatValidationErrorTest(unittest.TestCase):
    def assert_fixed_400(self, resp):
        self.assertEqual(resp.status, 400)
        body = resp.json()
        self.assertEqual(body, {"detail": VALIDATION_ERROR_MESSAGE})
        text = resp.text()
        for leaked in ("pydantic", "loc", "ValueError", "Traceback"):
            self.assertNotIn(leaked, text)

    def test_blank_message_is_400(self):
        for blank in ("", "   ", "\n\t "):
            with self.subTest(message=repr(blank)):
                self.assert_fixed_400(call_app(app, "POST", CHAT, json_body={"message": blank}))

    def test_missing_message_is_400(self):
        self.assert_fixed_400(call_app(app, "POST", CHAT, json_body={"use_academic_data": True}))

    def test_non_string_message_is_400(self):
        self.assert_fixed_400(call_app(app, "POST", CHAT, json_body={"message": 123}))

    def test_invalid_session_id_is_400(self):
        for bad in ("not-a-uuid", "12345", "", 42):
            with self.subTest(session_id=bad):
                self.assert_fixed_400(
                    call_app(
                        app, "POST", CHAT, json_body={"message": FICTIONAL_QUESTION, "session_id": bad}
                    )
                )

    def test_malformed_json_body_is_400(self):
        self.assert_fixed_400(
            call_app(
                app,
                "POST",
                CHAT,
                raw_body=b'{"message": "unterminated',
                headers={"content-type": "application/json"},
            )
        )

    def test_non_object_json_body_is_400(self):
        self.assert_fixed_400(call_app(app, "POST", CHAT, json_body=["message"]))


if __name__ == "__main__":
    unittest.main()
