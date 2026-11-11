"""질문 주소(POST /api/v1/chat)의 임시 구현(스텁)이 약속한 응답 모양을 지키는지 확인하는 테스트.

POST는 "데이터를 보내니 처리해 달라"는 뜻의 웹 요청 종류다. 스텁은 실제 검색이 붙기
전까지 정해진 답만 돌려주는 자리 채우기 코드다. 약속(계약)은 명세 문서 API_SPEC.md에
적은 응답 형식이다.

검증 항목:
- 성공 응답과 답변 불가 응답이 모두 여섯 필드를 갖춘다.
- 지정 가상 질문 하나만 성공한다. 키워드만 포함한 질문은 성공이 아니다.
- 대화 묶음 식별값(세션 ID)은 생략하면 발급, 제공하면 그대로 반환, 발급받은 값은 재사용 가능.
- use_academic_data 기본값은 False, True여도 personalized는 False.
- 잘못된 요청은 400과 고정 문구만 돌려주고 값 검사 라이브러리(pydantic)의 상세 메시지를
  노출하지 않는다.

실행(저장소 루트, FastAPI가 설치된 가상환경):
    python -m unittest api/tests/test_chat_stub.py -v
    python api/tests/test_chat_stub.py

모든 질문·값은 명백히 가상이며 실제 학칙과 무관하다.
"""

import pathlib
import sys
import unittest
import uuid

# import 경로를 잡는다. 저장소 루트에서 실행해도 아래 import들이 되게 한다.
#   api/        -> `from app.main import ...`
#   api/tests/  -> `from asgi_harness import call_app`
TESTS_DIR = pathlib.Path(__file__).resolve().parent
sys.path[:0] = [str(TESTS_DIR.parent), str(TESTS_DIR)]

from asgi_harness import call_app
from app.main import VALIDATION_ERROR_MESSAGE, app
from app.schemas.chat import ChatRequest
from app.services.chat_stub import FICTIONAL_QUESTION


# ---------------------------------------------------------------------------
# 상수
# ---------------------------------------------------------------------------

CHAT = "/api/v1/chat"

# 응답에 항상 있어야 하는 여섯 필드. 성공·실패 모두 같다.
RESPONSE_FIELDS = {
    "session_id",
    "answer",
    "citations",
    "answered",
    "personalized",
    "latency_ms",
}

# 인용 1건의 필드.
CITATION_FIELDS = {"article_path", "document", "effective_date", "snippet", "source_url"}

# 스텁은 지연을 측정하지 않으므로 전부 0.
ZERO_LATENCY = {"retrieval": 0, "generation": 0, "total": 0}

# 지정 질문과 무관한 가상 질문. 답변 불가 응답을 유도한다.
UNRELATED_QUESTION = "가상 행성 간 텔레포트 수수료는 얼마야?"

# 지정 질문의 키워드를 포함하지만 지정 질문은 아니다. 성공으로 처리되면 안 된다.
# (리뷰에서 잡은 되돌이 버그(회귀) 방지: 과거에 `키워드 in message`로 판정해 이 문장들이 성공했다.)
KEYWORD_ONLY_QUESTIONS = (
    "달 기지 정리는 빼고, 가상 행성 간 텔레포트 수수료만 알려 줘.",
    "달 기지 정리",
    FICTIONAL_QUESTION + " 그리고 가상 행성 간 텔레포트 수수료도.",
)


# ---------------------------------------------------------------------------
# 헬퍼
# ---------------------------------------------------------------------------


def _is_uuid(value: str) -> bool:
    """세계 어디서나 겹치지 않게 만든 128비트 식별자(UUID, Universally Unique Identifier) 형식으로 읽히는지만 본다."""

    try:
        uuid.UUID(value)
    except (ValueError, TypeError):
        return False

    return True


def _post_chat(json_body):
    """/chat 주소에 본문을 POST로 보낸다. 테스트마다 반복되는 인자를 줄인다.

    본문은 중괄호와 따옴표로 값을 적는 텍스트 형식(JSON, JavaScript Object Notation)이다.
    """

    return call_app(app, "POST", CHAT, json_body=json_body)


# ---------------------------------------------------------------------------
# 성공 / 답변 불가 응답
# ---------------------------------------------------------------------------


class ChatSuccessResponseTest(unittest.TestCase):
    def test_fictional_question_returns_answered_with_one_citation(self):
        """지정 질문 → 200, 여섯 필드, answered=True, 가상 인용 1건."""

        resp = _post_chat({"message": FICTIONAL_QUESTION})

        self.assertEqual(resp.status, 200)

        body = resp.json()
        self.assertEqual(set(body), RESPONSE_FIELDS)
        self.assertTrue(body["answered"])
        self.assertFalse(body["personalized"])
        self.assertEqual(body["latency_ms"], ZERO_LATENCY)
        self.assertTrue(body["answer"])

        # 인용은 정확히 1건이고, 내용이 모두 가상임을 형식으로 확인한다.
        self.assertEqual(len(body["citations"]), 1)

        citation = body["citations"][0]
        self.assertEqual(set(citation), CITATION_FIELDS)
        self.assertTrue(citation["source_url"].startswith("https://example.invalid/"))
        self.assertIn("가상", citation["document"])
        self.assertRegex(citation["article_path"], r"^제\d+조(의\d+)?\(.+\)")
        self.assertRegex(citation["effective_date"], r"^\d{4}-\d{2}-\d{2}$")

    def test_surrounding_whitespace_does_not_change_match(self):
        """앞뒤 공백·개행이 붙어도 지정 질문으로 인정한다."""

        body = _post_chat({"message": f"  {FICTIONAL_QUESTION}\n"}).json()

        self.assertTrue(body["answered"])
        self.assertEqual(len(body["citations"]), 1)

    def test_unrelated_question_returns_unanswerable_with_all_fields(self):
        """무관한 질문 → 200, 여섯 필드, answered=False, 빈 인용, 안내 문구."""

        resp = _post_chat({"message": UNRELATED_QUESTION})

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

    def test_keyword_only_questions_are_not_answered(self):
        """키워드 부분 포함만으로 성공 응답을 돌려주면 안 된다."""

        for question in KEYWORD_ONLY_QUESTIONS:
            with self.subTest(question=question):
                resp = _post_chat({"message": question})

                self.assertEqual(resp.status, 200)

                body = resp.json()
                self.assertEqual(set(body), RESPONSE_FIELDS)
                self.assertFalse(body["answered"])
                self.assertEqual(body["citations"], [])

    def test_citations_empty_implies_not_answered(self):
        """명세 규칙: citations가 비어 있으면 answered는 반드시 False."""

        questions = (FICTIONAL_QUESTION, UNRELATED_QUESTION, *KEYWORD_ONLY_QUESTIONS)

        for question in questions:
            with self.subTest(question=question):
                body = _post_chat({"message": question}).json()

                if not body["citations"]:
                    self.assertFalse(body["answered"])


# ---------------------------------------------------------------------------
# 세션 ID
# ---------------------------------------------------------------------------


class ChatSessionTest(unittest.TestCase):
    def test_session_id_is_issued_when_omitted(self):
        """생략하면 서버가 UUID를 발급한다."""

        body = _post_chat({"message": UNRELATED_QUESTION}).json()

        self.assertTrue(_is_uuid(body["session_id"]))

    def test_issued_session_ids_differ_between_requests(self):
        """발급은 요청마다 새로 한다."""

        first = _post_chat({"message": UNRELATED_QUESTION}).json()
        second = _post_chat({"message": UNRELATED_QUESTION}).json()

        self.assertNotEqual(first["session_id"], second["session_id"])

    def test_issued_session_id_can_be_reused_on_next_request(self):
        """첫 요청에서 받은 ID를 다음 요청에 넣으면 같은 값이 돌아온다.

        요청을 보내는 쪽(클라이언트)의 실제 흐름 그대로다: 발급 → 재사용 → 재사용.
        """

        issued = _post_chat({"message": UNRELATED_QUESTION}).json()["session_id"]
        self.assertTrue(_is_uuid(issued))

        reused = _post_chat({"message": FICTIONAL_QUESTION, "session_id": issued}).json()
        self.assertEqual(reused["session_id"], issued)

        reused_again = _post_chat({"message": UNRELATED_QUESTION, "session_id": issued}).json()
        self.assertEqual(reused_again["session_id"], issued)

    def test_explicit_null_session_id_is_treated_as_omitted(self):
        """`"session_id": null`은 생략과 같다. 서버가 새 UUID를 발급한다.

        명세는 "없으면 서버가 발급"이라고만 하므로 null도 '없음'으로 본다.
        """

        body = _post_chat({"message": UNRELATED_QUESTION, "session_id": None}).json()

        self.assertTrue(_is_uuid(body["session_id"]))

    def test_provided_session_id_is_returned_unchanged(self):
        """클라이언트가 만든 UUID도 그대로 돌려준다."""

        given = str(uuid.uuid4())

        body = _post_chat({"message": FICTIONAL_QUESTION, "session_id": given}).json()

        self.assertEqual(body["session_id"], given)

    def test_provided_session_id_keeps_original_casing(self):
        """대문자 UUID를 보내면 소문자로 통일(정규화)하지 않고 그대로 돌려준다."""

        given = str(uuid.uuid4()).upper()

        body = _post_chat({"message": UNRELATED_QUESTION, "session_id": given}).json()

        self.assertEqual(body["session_id"], given)


# ---------------------------------------------------------------------------
# use_academic_data 플래그(참/거짓 표시값)
# ---------------------------------------------------------------------------


class ChatAcademicDataFlagTest(unittest.TestCase):
    def test_use_academic_data_defaults_to_false(self):
        """요청 틀(스키마)에 정한 기본값을 본다.

        웹 통신 규약(HTTP, HyperText Transfer Protocol) 요청을 거치지 않고 모델 객체만 만든다.
        """

        self.assertFalse(ChatRequest(message="가상 질문").use_academic_data)

    def test_omitted_flag_behaves_like_false(self):
        """플래그 생략과 명시적 False는 같은 응답을 낸다(session_id는 발급값이라 제외)."""

        omitted = _post_chat({"message": FICTIONAL_QUESTION}).json()
        explicit = _post_chat({"message": FICTIONAL_QUESTION, "use_academic_data": False}).json()

        for key in RESPONSE_FIELDS - {"session_id"}:
            self.assertEqual(omitted[key], explicit[key], key)

    def test_true_flag_never_personalizes(self):
        """True를 보내도 학적 연동 전이라 personalized는 False다."""

        resp = _post_chat({"message": FICTIONAL_QUESTION, "use_academic_data": True})

        self.assertEqual(resp.status, 200)
        self.assertFalse(resp.json()["personalized"])


# ---------------------------------------------------------------------------
# 요청 검증 오류 → 400 고정 문구
# ---------------------------------------------------------------------------


class ChatValidationErrorTest(unittest.TestCase):
    def assert_fixed_400(self, resp):
        """400이고, 본문은 고정 문구 하나뿐이며, pydantic 내부 정보가 새지 않는다."""

        self.assertEqual(resp.status, 400)

        body = resp.json()
        self.assertEqual(body, {"detail": VALIDATION_ERROR_MESSAGE})

        # FastAPI 기본 422 응답에 들어가는 키워드들. 하나라도 보이면 main.py의 예외 처리
        # 함수(핸들러)가 요청을 가로채지 못한 것이다.
        text = resp.text()
        for leaked in ("pydantic", "loc", "ValueError", "Traceback"):
            self.assertNotIn(leaked, text)

    def test_blank_message_is_400(self):
        """빈 문자열, 공백만, 공백+개행+탭 모두 거부."""

        for blank in ("", "   ", "\n\t "):
            with self.subTest(message=repr(blank)):
                self.assert_fixed_400(_post_chat({"message": blank}))

    def test_missing_message_is_400(self):
        """message 필드 자체가 없는 경우."""

        self.assert_fixed_400(_post_chat({"use_academic_data": True}))

    def test_non_string_message_is_400(self):
        """message가 문자열이 아닌 경우."""

        self.assert_fixed_400(_post_chat({"message": 123}))

    def test_invalid_session_id_is_400(self):
        """UUID가 아닌 문자열, 빈 문자열, 숫자 모두 거부."""

        for bad in ("not-a-uuid", "12345", "", 42):
            with self.subTest(session_id=bad):
                self.assert_fixed_400(_post_chat({"message": FICTIONAL_QUESTION, "session_id": bad}))

    def test_malformed_json_body_is_400(self):
        """JSON 글자를 읽어 값으로 바꾸는 단계(파싱)부터 실패하는 본문.

        코드에 직접 적는 바이트 값(바이트 리터럴, b'...')에는 ASCII 글자만 넣는다.
        ASCII는 영문·숫자·기호만 담은 기본 문자 집합이다 (American Standard Code for
        Information Interchange). 한글이 들어가면 파이썬이 SyntaxError를 내서 모듈을
        import조차 못 한다.
        """

        resp = call_app(
            app,
            "POST",
            CHAT,
            raw_body=b'{"message": "unterminated',
            headers={"content-type": "application/json"},
        )

        self.assert_fixed_400(resp)

    def test_non_object_json_body_is_400(self):
        """JSON은 맞지만 객체가 아닌 배열."""

        self.assert_fixed_400(_post_chat(["message"]))

    def test_non_utf8_body_is_400_with_fixed_message(self):
        """글자를 바이트로 적는 표준 방식(UTF-8, Unicode Transformation Format, 8-bit)이 아닌 바이트 본문.

        바이트를 글자로 되돌리는 단계(디코딩)가 JSON 파싱 전에 깨지면 FastAPI는
        RequestValidationError가 아니라 HTTPException(400, "There was an error parsing
        the body")을 던진다. 그 문구가 그대로 나가면 고정 문구 계약 위반이다. 코드 반영
        요청 6번(PR #6, Pull Request)의 리뷰에서 잡았다.
        """

        resp = call_app(
            app,
            "POST",
            CHAT,
            raw_body=b"\xff",
            headers={"content-type": "application/json"},
        )

        self.assert_fixed_400(resp)
        self.assertNotIn("parsing the body", resp.text())


# ---------------------------------------------------------------------------
# OpenAPI 문서(서버가 자동으로 만드는 기계 판독용 설명서)
# ---------------------------------------------------------------------------


class ChatOpenApiTest(unittest.TestCase):
    def test_openapi_lists_400_and_not_422_for_chat(self):
        """자동 생성 설명서(OpenAPI 문서)에 실제로 내는 응답(400)만 있고, 내지 않는 422는 없어야 한다.

        OpenAPI는 서버가 받는 주소와 주고받는 형식을 기계가 읽을 수 있게 적는 표준이다.
        화면 쪽(프런트엔드) 개발자가 이 문서를 보고 요청 코드를 짜므로 틀리면 헷갈린다.
        """

        resp = call_app(app, "GET", "/openapi.json")

        self.assertEqual(resp.status, 200)

        responses = resp.json()["paths"][CHAT]["post"]["responses"]

        self.assertIn("200", responses)
        self.assertIn("400", responses)
        self.assertNotIn("422", responses)


# `python api/tests/test_chat_stub.py`로 직접 실행할 때의 진입점.
if __name__ == "__main__":
    unittest.main()
