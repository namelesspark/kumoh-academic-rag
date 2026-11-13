"""서버를 띄우지 않고 시연 계정 로그인 주소가 약속 표(이슈 #79)대로 답하는지 확인한다.

아래 계정 세 개는 화면이 채워 주는 공개 값이고 실제 학생과 관계가 없다.
"""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.tests.asgi_harness import call_app
from app.main import VALIDATION_ERROR_MESSAGE, create_app
from app.services.demo_login import DEMO_ACCOUNTS, match_demo_account


ENDPOINT = "/api/v1/demo-login"
STUDENTS_ENDPOINT = "/api/v1/demo-students"
LOGIN_FAILED = {"detail": "학번 또는 비밀번호가 맞지 않아요"}
BAD_REQUEST = {"detail": "요청 형식이 올바르지 않습니다."}
# 합의한 (학번, 비밀번호, 학생 id, 상황). 학번은 입학연도가 없는 2099로 시작해 실제 학생과 겹치지 않는다.
ACCOUNTS = (
    ("20990002", "demo-d02-pass", "demo-d02", "졸업 요건에 가까움"),
    ("20990003", "demo-d03-pass", "demo-d03", "학점이 많이 남음"),
    ("20990004", "demo-d04-pass", "demo-d04", "비교과 점수 부족"),
)


class DemoLoginTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app()

    def login(self, student_number, password):
        return call_app(self.app, "POST", ENDPOINT,
                        json_body={"student_number": student_number, "password": password})

    def assert_rejected(self, response):
        self.assertEqual(response.status, 401)
        self.assertEqual(response.json(), LOGIN_FAILED)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertNotIn("set-cookie", response.headers)

    def assert_bad_request(self, response):
        self.assertEqual(response.status, 400)
        self.assertEqual(response.json(), BAD_REQUEST)
        self.assertNotIn("set-cookie", response.headers)
        for leaked in ("pydantic", "loc", "student_number", "password"):
            self.assertNotIn(leaked, response.text())

    def test_fixed_messages_match_the_shared_constants(self):
        self.assertEqual(BAD_REQUEST["detail"], VALIDATION_ERROR_MESSAGE)
        self.assertEqual(DEMO_ACCOUNTS, tuple(account[:3] for account in ACCOUNTS))

    def test_each_account_returns_the_same_student_as_the_list(self):
        listed = {student["id"]: student
                  for student in call_app(self.app, "GET", STUDENTS_ENDPOINT).json()["students"]}
        self.assertEqual(set(listed), {account[2] for account in ACCOUNTS})
        for student_number, password, student_id, scenario in ACCOUNTS:
            with self.subTest(student_number=student_number):
                response = self.login(student_number, password)
                self.assertEqual(response.status, 200)
                body = response.json()
                self.assertEqual(body, {"student": listed[student_id]})
                self.assertEqual(set(body["student"]), {"id", "label", "scenario", "is_fictional"})
                self.assertEqual(body["student"]["scenario"], scenario)
                self.assertIs(body["student"]["is_fictional"], True)
                self.assertEqual(response.headers["cache-control"], "no-store")
                self.assertNotIn("set-cookie", response.headers)
                # 받은 학번과 비밀번호를 응답에 되돌려 적지 않는다.
                self.assertNotIn(password, response.text())
                self.assertNotIn(student_number, response.text())

    def test_wrong_values_get_one_fixed_401(self):
        cases = (
            ("20990002", "wrong"),
            ("20990001", "demo-d02-pass"),
            ("20990005", "demo-d02-pass"),
            # 예전 시연 학번과 학생 id는 학번이 아니다.
            ("DEMO-D02", "demo-d02-pass"),
            # 여덟 자리와 모양만 비슷한 값.
            ("2099002", "demo-d02-pass"),
            ("020990002", "demo-d02-pass"),
            ("2099-0002", "demo-d02-pass"),
            ("20990002.0", "demo-d02-pass"),
            # 다른 계정의 비밀번호.
            ("20990002", "demo-d03-pass"),
            ("20990003", "demo-d02-pass"),
            # 빈 값.
            ("", ""),
            ("20990002", ""),
            ("", "demo-d02-pass"),
            # 서버는 공백을 떼거나 대소문자를 맞추지 않는다.
            ("demo-d02", "demo-d02-pass"),
            ("20990002", "DEMO-D02-PASS"),
            ("20990002", "Demo-d02-pass"),
            (" 20990002", "demo-d02-pass"),
            ("20990002 ", "demo-d02-pass"),
            ("20990002", "demo-d02-pass "),
            ("20990002", "demo-d02-pass\n"),
            # 학생 id와 학번을 섞어 쓴 값, 두 칸을 바꿔 쓴 값.
            ("demo-d02-pass", "20990002"),
            ("20990002\x00demo-d02-pass", ""),
            # 길이 한도인 64자는 형식에 맞으므로 계정과 견준다.
            ("가" * 64, "나" * 64),
        )
        for student_number, password in cases:
            with self.subTest(student_number=student_number, password=password):
                self.assert_rejected(self.login(student_number, password))

    def test_korean_and_other_non_ascii_input_is_401_not_500(self):
        # 문자열을 그대로 견주면 ASCII 밖의 글자에서 TypeError가 난다.
        for student_number, password in (
            ("가상학번", "비밀번호"),
            ("20990002", "데모-d02-pass"),
            # 전각 숫자와 아라비아-인도 숫자는 같은 수처럼 보여도 다른 글자다.
            ("２０９９０００２", "demo-d02-pass"),
            ("٢٠٩٩٠٠٠٢", "demo-d02-pass"),
            ("20990002", "🙂"),
        ):
            with self.subTest(student_number=student_number, password=password):
                self.assert_rejected(self.login(student_number, password))

    def test_unpaired_surrogate_never_reaches_500(self):
        # JSON은 짝이 없는 대리 문자를 `\ud800`으로 적을 수 있다. UTF-8로 바꾸지 못하는 글자다.
        response = call_app(
            self.app, "POST", ENDPOINT,
            raw_body=b'{"student_number": "\\ud800", "password": "\\udfff"}',
            headers={"content-type": "application/json"},
        )
        # 요청 틀 검사가 먼저 막으면 400, 통과시키면 401이다. 어느 쪽이든 약속한 응답 그대로여야 한다.
        if response.status == 400:
            self.assert_bad_request(response)
        else:
            self.assert_rejected(response)
        # 요청 틀 검사를 지나친 값이 와도 견주는 함수는 오류 없이 불일치로 답한다.
        self.assertIsNone(match_demo_account("\ud800", "\udfff"))

    def test_malformed_requests_get_the_fixed_400(self):
        valid = {"student_number": "20990002", "password": "demo-d02-pass"}
        bodies = (
            # 65자 이상.
            {**valid, "student_number": "A" * 65},
            {**valid, "password": "가" * 65},
            # 문자열이 아닌 값.
            # 숫자로 보낸 학번은 맞는 계정이어도 문자열이 아니므로 형식 오류다.
            {**valid, "student_number": 20990002},
            {**valid, "password": None},
            {**valid, "password": ["demo-d02-pass"]},
            {**valid, "student_number": True},
            # 빠진 필드.
            {"student_number": "20990002"},
            {"password": "demo-d02-pass"},
            {},
            # 다른 필드.
            {**valid, "student_id": "demo-d02"},
            {**valid, "remember": True},
            # 객체가 아닌 본문.
            ["20990002", "demo-d02-pass"],
            "20990002",
        )
        for body in bodies:
            with self.subTest(body=body):
                self.assert_bad_request(call_app(self.app, "POST", ENDPOINT, json_body=body))

    def test_broken_bodies_get_the_fixed_400(self):
        for raw in (b"", b'{"student_number": "20990002"', b"\xff", b"student_number=20990002"):
            with self.subTest(raw=raw):
                self.assert_bad_request(call_app(
                    self.app, "POST", ENDPOINT, raw_body=raw,
                    headers={"content-type": "application/json"},
                ))

    def test_values_in_the_address_are_not_read(self):
        # 값은 요청 본문에만 싣는다. 주소 뒤에 붙인 값으로는 로그인하지 못한다.
        async def with_query(scope, receive, send):
            query = b"student_number=20990002&password=demo-d02-pass"
            await self.app({**scope, "query_string": query}, receive, send)

        self.assert_bad_request(call_app(with_query, "POST", ENDPOINT))
        self.assert_rejected(call_app(
            with_query, "POST", ENDPOINT, json_body={"student_number": "", "password": ""},
        ))

    def test_get_is_405_without_cookie(self):
        response = call_app(self.app, "GET", ENDPOINT)
        self.assertEqual(response.status, 405)
        self.assertNotIn("set-cookie", response.headers)

    def test_existing_demo_addresses_still_answer(self):
        self.assertEqual(call_app(self.app, "GET", STUDENTS_ENDPOINT).status, 200)
        self.assertEqual(call_app(self.app, "GET", "/api/v1/graduation-demo").status, 200)

    def test_openapi_lists_200_400_401_and_not_422(self):
        response = call_app(self.app, "GET", "/openapi.json")
        self.assertEqual(response.status, 200)
        paths = response.json()["paths"]
        self.assertEqual(set(paths[ENDPOINT]["post"]["responses"]), {"200", "400", "401"})
        # 채팅 주소의 기존 처리도 그대로다.
        self.assertNotIn("422", paths["/api/v1/chat"]["post"]["responses"])
        # 설명서 본문에 시연 비밀번호를 예시로 싣지 않는다.
        self.assertNotIn("demo-d02-pass", json.dumps(response.json(), ensure_ascii=False))


class MatchDemoAccountTest(unittest.TestCase):
    def test_exact_pairs_only(self):
        for student_number, password, student_id, _ in ACCOUNTS:
            with self.subTest(student_number=student_number):
                self.assertEqual(match_demo_account(student_number, password), student_id)
                self.assertRegex(student_number, r"^2099000[0-9]$")
                self.assertIsNone(match_demo_account(student_number[:-1], password))
                self.assertIsNone(match_demo_account(student_number, password.upper()))
                self.assertIsNone(match_demo_account(student_number + " ", password))
        self.assertIsNone(match_demo_account("20990002", "demo-d04-pass"))
        self.assertIsNone(match_demo_account("", ""))
        self.assertIsNone(match_demo_account("한글", "한글"))


if __name__ == "__main__":
    unittest.main()
