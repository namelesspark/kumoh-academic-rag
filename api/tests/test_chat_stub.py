"""
POST /api/v1/chat 스텁 테스트.

실행 (저장소 루트에서):
    python -B -m unittest api/tests/test_chat_stub.py -v

모든 입력은 가상 문장이다. 실제 규정·학적 데이터는 쓰지 않는다.
"""

import re
import sys
import unittest
import uuid
from pathlib import Path


# ------------------------------------------------------------
# 경로 설정: 패키지 설치 없이 import 되게 한다.
# ------------------------------------------------------------

TESTS_DIR = Path(__file__).resolve().parent

API_DIR = TESTS_DIR.parent

for folder in (API_DIR, TESTS_DIR):
    if str(folder) not in sys.path:
        sys.path.insert(0, str(folder))


# 의존성 확인을 먼저 한다. 없으면 어떤 패키지가 필요한지 한 줄로 알려 준다.
from asgi_harness import call_app, require_dependencies  # noqa: E402

require_dependencies()

from app.main import BAD_REQUEST_DETAIL, app  # noqa: E402
from app.schemas.chat import ChatRequest  # noqa: E402
from app.services.chat_stub import STUB_QUESTION  # noqa: E402


# 응답에 항상 있어야 하는 필드 목록
ALL_FIELDS = {
    "session_id",
    "answer",
    "citations",
    "answered",
    "personalized",
    "latency_ms",
}

# 전화번호처럼 보이는 패턴 (예: 000-000-0000). 안내 문구에 없어야 한다.
PHONE_PATTERN = re.compile(r"\d{2,4}-\d{3,4}-\d{4}")


def post_chat(body=None, *, raw: bytes | None = None):
    """테스트용 짧은 도우미. /api/v1/chat 에 POST 한다."""

    return call_app(app, "POST", "/api/v1/chat", json_body=body, raw_body=raw)


# ============================================================
# 1. 정상 응답
# ============================================================


class ChatAnsweredTest(unittest.TestCase):
    """가상 질문 전체 일치 → 답변 성공 모양."""

    def test_exact_question_returns_one_citation(self):
        """지정 질문과 정확히 같으면 example.invalid 인용 1건과 answered=true."""

        response = post_chat({"message": STUB_QUESTION})

        self.assertEqual(response.status, 200)

        data = response.json()

        # 모든 필드가 있다
        self.assertEqual(set(data.keys()), ALL_FIELDS)

        self.assertTrue(data["answered"])

        self.assertEqual(len(data["citations"]), 1)

        citation = data["citations"][0]

        self.assertIn("example.invalid", citation["source_url"])

        # 인용 필드도 전부 있다
        self.assertEqual(
            set(citation.keys()),
            {"article_path", "document", "effective_date", "snippet", "source_url"},
        )

    def test_surrounding_whitespace_is_ignored(self):
        """앞뒤 공백·개행만 다르면 같은 질문으로 본다."""

        response = post_chat({"message": "  \n" + STUB_QUESTION + "\t \n"})

        self.assertEqual(response.status, 200)

        self.assertTrue(response.json()["answered"])

    def test_personalized_and_latency_are_fixed(self):
        """personalized 는 false, latency_ms 세 값은 모두 0."""

        response = post_chat({"message": STUB_QUESTION})

        data = response.json()

        self.assertFalse(data["personalized"])

        self.assertEqual(
            data["latency_ms"],
            {"retrieval": 0, "generation": 0, "total": 0},
        )


# ============================================================
# 2. 답변 불가 응답
# ============================================================


class ChatNotAnsweredTest(unittest.TestCase):
    """그 외 질문 → 답변 불가 모양. 그래도 모든 필드가 있다."""

    def test_other_question_returns_full_fields(self):
        """일반 질문도 200 이고 모든 필드를 포함한다."""

        response = post_chat({"message": "가상 질문입니다. 아무 내용이나 물어봅니다."})

        self.assertEqual(response.status, 200)

        data = response.json()

        self.assertEqual(set(data.keys()), ALL_FIELDS)

        self.assertFalse(data["answered"])

        self.assertEqual(data["citations"], [])

        self.assertFalse(data["personalized"])

        self.assertEqual(
            data["latency_ms"],
            {"retrieval": 0, "generation": 0, "total": 0},
        )

    def test_partial_keyword_is_not_success(self):
        """지정 질문의 일부 키워드만 포함해도 성공이 아니다."""

        # 지정 질문 안에 들어 있는 단어를 섞은 다른 문장
        response = post_chat({"message": "가상 규정 예시 조문 알려줘"})

        data = response.json()

        self.assertFalse(data["answered"])

        self.assertEqual(data["citations"], [])

    def test_guidance_has_no_phone_number(self):
        """안내 문구에 전화번호가 없다."""

        response = post_chat({"message": "가상 질문입니다."})

        answer = response.json()["answer"]

        self.assertTrue(len(answer) > 0)

        self.assertIsNone(PHONE_PATTERN.search(answer))


# ============================================================
# 3. session_id
# ============================================================


class ChatSessionIdTest(unittest.TestCase):
    """session_id 발급·재사용."""

    def test_missing_session_id_is_issued(self):
        """안 보내면 서버가 UUID 형식 문자열을 발급한다."""

        response = post_chat({"message": "가상 질문입니다."})

        session_id = response.json()["session_id"]

        self.assertIsInstance(session_id, str)

        # UUID 로 해석 가능해야 한다. 아니면 ValueError.
        uuid.UUID(session_id)

    def test_given_session_id_is_echoed_verbatim(self):
        """보낸 session_id 는 표기 그대로 돌아온다. 대문자도 바꾸지 않는다."""

        given = "0F1E2D3C-4B5A-6978-8796-A5B4C3D2E1F0"

        response = post_chat({"session_id": given, "message": "가상 질문입니다."})

        self.assertEqual(response.status, 200)

        self.assertEqual(response.json()["session_id"], given)

    def test_two_requests_without_session_id_get_different_ids(self):
        """발급은 요청마다 새로 한다."""

        first = post_chat({"message": "가상 질문 1"}).json()["session_id"]

        second = post_chat({"message": "가상 질문 2"}).json()["session_id"]

        self.assertNotEqual(first, second)


# ============================================================
# 4. use_academic_data
# ============================================================


class ChatAcademicFlagTest(unittest.TestCase):
    """use_academic_data 기본값과 무시 동작."""

    def test_default_is_false(self):
        """스키마 기본값은 false."""

        request = ChatRequest(message="가상 질문")

        self.assertFalse(request.use_academic_data)

    def test_true_does_not_personalize(self):
        """true 를 보내도 학적 조회를 하지 않으므로 personalized 는 false."""

        response = post_chat({"message": STUB_QUESTION, "use_academic_data": True})

        self.assertEqual(response.status, 200)

        self.assertFalse(response.json()["personalized"])


# ============================================================
# 5. 400 오류
# ============================================================


class ChatBadRequestTest(unittest.TestCase):
    """검증 오류는 모두 400 과 고정 문구."""

    def assert_bad_request(self, response):
        """400 이고 본문이 {"detail": 고정 문구} 와 정확히 같은지 확인한다."""

        self.assertEqual(response.status, 400)

        self.assertEqual(response.json(), {"detail": BAD_REQUEST_DETAIL})

    def test_missing_message(self):
        """message 누락."""

        self.assert_bad_request(post_chat({"use_academic_data": False}))

    def test_blank_message(self):
        """공백만 있는 message."""

        self.assert_bad_request(post_chat({"message": "   \n\t"}))

    def test_non_string_message(self):
        """문자열이 아닌 message."""

        self.assert_bad_request(post_chat({"message": 12345}))

    def test_invalid_session_id(self):
        """UUID 형식이 아닌 session_id."""

        self.assert_bad_request(
            post_chat({"session_id": "not-a-uuid", "message": "가상 질문"})
        )

    def test_invalid_json(self):
        """JSON 문법 오류."""

        # 닫는 중괄호가 빠진 JSON.
        # 바이트 리터럴(b'...')에는 한글을 넣을 수 없으므로 문자열을 만든 뒤 인코딩한다.
        broken_json = '{"message": "가상 질문"'.encode("utf-8")

        self.assert_bad_request(post_chat(raw=broken_json))

    def test_non_object_json(self):
        """객체가 아닌 JSON (배열, 문자열)."""

        self.assert_bad_request(post_chat(["가상", "질문"]))

        self.assert_bad_request(post_chat("가상 질문"))

    def test_empty_body(self):
        """본문이 없는 요청."""

        self.assert_bad_request(post_chat())

    def test_detail_does_not_leak_pydantic_errors(self):
        """pydantic 상세(loc, msg, type)가 본문에 섞이지 않는다."""

        response = post_chat({"message": 12345})

        body_text = response.body.decode("utf-8")

        for leaked in ("loc", "msg", "string_type", "input"):
            self.assertNotIn(f'"{leaked}"', body_text)


if __name__ == "__main__":
    unittest.main()
