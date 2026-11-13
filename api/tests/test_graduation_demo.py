"""서버를 띄우지 않고 졸업 체크 주소의 읽기 전용 응답을 확인한다."""

import sys
import unittest
from dataclasses import replace
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.tests.asgi_harness import call_app
from app.main import create_app
from app.schemas.graduation_demo import GraduationDemoResponse
from app.services import graduation_rules
from app.services.graduation_rules import get_graduation_demo


ENDPOINT = "/api/v1/graduation-demo"
STUDENTS_ENDPOINT = "/api/v1/demo-students"
STUDENTS = [
    {"id": "demo-d02", "label": "가상 학생 D02", "scenario": "졸업 요건에 가까움", "is_fictional": True},
    {"id": "demo-d03", "label": "가상 학생 D03", "scenario": "학점이 많이 남음", "is_fictional": True},
    {"id": "demo-d04", "label": "가상 학생 D04", "scenario": "비교과 점수 부족", "is_fictional": True},
]
CREDIT_IDS = ("credits_total", "general_required", "general_elective", "msc", "major")
EVALUATED_AT = datetime.fromisoformat("2026-11-13T09:00:00+09:00")
DETAIL_IDS = {
    "total_credits": ("credits_total", "general_required", "general_elective", "msc", "major"),
    "major_required": ("required_courses", "thesis"),
    "extracurricular": ("career_education", "counseling", "mileage"),
}
RESULT_FIELDS = {"id", "label", "status", "current", "required", "shortfall", "reason", "basis"}
PROFILE = {
    "id": "demo-t01",
    "label": "가상 학생 T01",
    "department": "컴퓨터공학전공",
    "admission_year": 2023,
    "admission_type": "일반 신입학",
    "track": "주전공 단일",
    "is_fictional": True,
}
FICTIONAL_BASIS = {
    "applied_rule": "가상 판정 기준",
    "source_title": "가상 기준 문서",
    "source_url": "https://example.invalid/rules#page=1",
    "checked_on": "2026-01-01",
}


def fictional_result(result_id):
    return {
        "id": result_id,
        "label": "가상 기준 미확정 항목",
        "status": "needs_check",
        "current": None,
        "required": None,
        "shortfall": None,
        "reason": "가상 기준을 확인해야 합니다.",
        "basis": FICTIONAL_BASIS,
    }


def get(app, target):
    """`?` 뒤의 조회 조건을 앱에 건넨다. 공용 테스트 도구는 조회 조건을 비워서 보내기 때문이다."""
    path, _, query = target.partition("?")

    async def with_query(scope, receive, send):
        await app({**scope, "query_string": query.encode("ascii")}, receive, send)

    return call_app(with_query, "GET", path)


def details_of(body):
    return {detail["id"]: detail for item in body["items"] for detail in item["details"]}


class GraduationDemoTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app()

    def get_at_fixed_time(self, target):
        with patch.object(graduation_rules, "datetime", wraps=datetime) as clock:
            clock.now.return_value = EVALUATED_AT
            return get(self.app, target)

    def test_student_list_has_three_fictional_students_in_agreed_order(self):
        response = call_app(self.app, "GET", STUDENTS_ENDPOINT)

        self.assertEqual(response.status, 200)
        self.assertEqual(response.json(), {"students": STUDENTS})
        for student in STUDENTS:
            # 사람 이름이나 학번처럼 보이지 않는 고정 표기만 쓴다.
            self.assertRegex(student["id"], r"^demo-d0[0-9]$")
            self.assertRegex(student["label"], r"^가상 학생 D0[0-9]$")

    def test_each_student_id_returns_that_student(self):
        for student in STUDENTS:
            with self.subTest(student_id=student["id"]):
                response = self.get_at_fixed_time(f"{ENDPOINT}?student_id={student['id']}")
                self.assertEqual(response.status, 200)
                body = response.json()
                self.assertEqual(set(body), {"profile", "items", "biskit_recommendations"})
                self.assertEqual(body["profile"]["id"], student["id"])
                self.assertEqual(body["profile"]["label"], student["label"])
                self.assertIs(body["profile"]["is_fictional"], True)
                # 기준이 확인되지 않은 전공필수 과목은 누구에게도 충족으로 적지 않는다.
                self.assertEqual(details_of(body)["required_courses"]["status"], "needs_check")

    def test_omitted_and_explicit_d02_give_the_same_result(self):
        omitted = self.get_at_fixed_time(ENDPOINT)
        explicit = self.get_at_fixed_time(f"{ENDPOINT}?student_id=demo-d02")

        self.assertEqual(omitted.status, 200)
        self.assertEqual(omitted.json()["profile"]["id"], "demo-d02")
        self.assertEqual(omitted.json(), explicit.json())

    def test_d03_has_many_credits_left_and_no_recommendations(self):
        body = self.get_at_fixed_time(f"{ENDPOINT}?student_id=demo-d03").json()
        details = details_of(body)

        self.assertEqual(details["credits_total"]["shortfall"], "46학점 부족")
        self.assertEqual(details["major"]["shortfall"], "30학점 부족")
        self.assertEqual(details["thesis"]["status"], "short")
        for key in ("general_required", "general_elective", "msc", "career_education", "counseling", "mileage"):
            with self.subTest(key=key):
                self.assertEqual(details[key]["status"], "met")
        self.assertIsNone(body["biskit_recommendations"])

    def test_d04_meets_credits_but_lacks_over_a_hundred_mileage_points(self):
        body = self.get_at_fixed_time(f"{ENDPOINT}?student_id=demo-d04").json()
        details = details_of(body)

        for key in (*CREDIT_IDS, "thesis", "career_education", "counseling"):
            with self.subTest(key=key):
                self.assertEqual(details[key]["status"], "met")
        self.assertEqual(details["mileage"]["status"], "short")
        shortfall_points = body["biskit_recommendations"]["shortfall_points"]
        self.assertGreaterEqual(shortfall_points, 100)
        self.assertEqual(details["mileage"]["shortfall"], f"{shortfall_points}점 부족")
        self.assertTrue(body["biskit_recommendations"]["programs"])

    def test_unknown_student_id_is_404_without_echo_or_fallback(self):
        for value in ("demo-x99", "DEMO-D02", "demo-d02%20", ""):
            with self.subTest(student_id=value):
                response = get(self.app, f"{ENDPOINT}?student_id={value}")
                self.assertEqual(response.status, 404)
                self.assertEqual(response.json(), {"detail": "가상 학생을 찾을 수 없습니다."})
                self.assertNotIn("profile", response.text())
        self.assertNotIn("demo-x99", get(self.app, f"{ENDPOINT}?student_id=demo-x99").text())

    def test_responses_set_no_cookie(self):
        for target in (
            STUDENTS_ENDPOINT, ENDPOINT, f"{ENDPOINT}?student_id=demo-d04", f"{ENDPOINT}?student_id=demo-x99",
        ):
            with self.subTest(target=target):
                self.assertNotIn("set-cookie", get(self.app, target).headers)

    def test_student_list_rejects_post(self):
        self.assertEqual(call_app(self.app, "POST", STUDENTS_ENDPOINT).status, 405)

    def test_response_fields_and_order(self):
        payload = {
            "profile": PROFILE,
            "items": [
                {
                    **fictional_result(item_id),
                    "details": [fictional_result(detail_id) for detail_id in detail_ids],
                }
                for item_id, detail_ids in DETAIL_IDS.items()
            ],
            "biskit_recommendations": None,
        }

        async def provide_fictional_demo():
            return GraduationDemoResponse(**payload)

        self.app.dependency_overrides[get_graduation_demo] = provide_fictional_demo
        response = call_app(self.app, "GET", ENDPOINT)

        self.assertEqual(response.status, 200)
        body = response.json()
        self.assertEqual(set(body), {"profile", "items", "biskit_recommendations"})
        self.assertEqual(body["profile"], PROFILE)
        self.assertEqual([item["id"] for item in body["items"]], list(DETAIL_IDS))
        for item in body["items"]:
            with self.subTest(item_id=item["id"]):
                self.assertEqual(set(item), RESULT_FIELDS | {"details"})
                self.assertEqual(set(item["basis"]), set(FICTIONAL_BASIS))
                self.assertEqual(
                    tuple(detail["id"] for detail in item["details"]),
                    DETAIL_IDS[item["id"]],
                )
                for detail in item["details"]:
                    self.assertEqual(set(detail), RESULT_FIELDS)
                    self.assertEqual(set(detail["basis"]), set(FICTIONAL_BASIS))
        self.assertEqual(body, payload)

    def test_default_fictional_student_has_a_shortfall(self):
        with patch.object(graduation_rules, "datetime", wraps=datetime) as clock:
            clock.now.return_value = EVALUATED_AT
            response = call_app(self.app, "GET", ENDPOINT)

        self.assertEqual(response.status, 200)
        body = response.json()
        self.assertIs(body["profile"]["is_fictional"], True)
        self.assertEqual(body["profile"]["label"], "가상 학생 D02")
        self.assertEqual(body["profile"]["id"], "demo-d02")
        self.assertEqual(
            {item["id"]: tuple(detail["id"] for detail in item["details"]) for item in body["items"]},
            DETAIL_IDS,
        )
        self.assertTrue(
            any(
                item["status"] == "short"
                and any(detail["status"] == "short" for detail in item["details"])
                for item in body["items"]
            )
        )
        details = {detail["id"]: detail for item in body["items"] for detail in item["details"]}
        for key, required in (("msc", "16학점"), ("career_education", "8회"), ("counseling", "4회")):
            with self.subTest(key=key):
                self.assertEqual(details[key]["required"], required)
                self.assertTrue(details[key]["basis"]["source_url"].endswith("#page=6"))
        self.assertEqual(details["required_courses"]["status"], "needs_check")
        self.assertTrue(details["required_courses"]["reason"])
        self.assertEqual(details["credits_total"]["current"], "130학점")
        self.assertEqual(details["mileage"]["current"], "480점")
        self.assertEqual(details["mileage"]["required"], "500점")
        self.assertEqual(details["mileage"]["shortfall"], "20점 부족")
        self.assertEqual(details["counseling"]["shortfall"], "1회 부족")

        recommendations = body["biskit_recommendations"]
        self.assertEqual(set(recommendations), {
            "shortfall_points", "listed_on", "evaluated_at", "portal_url", "programs",
        })
        self.assertEqual(recommendations["shortfall_points"], 20)
        self.assertEqual(recommendations["evaluated_at"], EVALUATED_AT.isoformat())
        self.assertEqual(recommendations["listed_on"], "2026-11-13")
        self.assertEqual(recommendations["portal_url"], "https://biskit.kumoh.ac.kr/")
        self.assertEqual(len(recommendations["programs"]), 3)
        self.assertEqual(set(recommendations["programs"][0]), {
            "title", "audience", "eligibility", "apply_until", "deadline_status", "event_on",
            "mileage_status", "mileage_points", "notice_url", "application_url", "login_required",
        })

    def test_recommendations_are_null_when_mileage_is_met_or_unknown(self):
        for mileage, remaining_semesters, expected_status in (
            (500, 4, "met"),
            (None, 4, "needs_check"),
            (480, None, "needs_check"),
        ):
            with self.subTest(mileage=mileage, remaining_semesters=remaining_semesters):
                record = replace(
                    graduation_rules.DEMO_RECORD,
                    mileage=mileage,
                    remaining_semesters_2025_03_01=remaining_semesters,
                )
                with patch.object(graduation_rules, "DEMO_RECORD", record):
                    response = call_app(self.app, "GET", ENDPOINT)
                self.assertEqual(response.status, 200)
                body = response.json()
                details = {detail["id"]: detail for item in body["items"] for detail in item["details"]}
                self.assertEqual(details["mileage"]["status"], expected_status)
                self.assertIsNone(body["biskit_recommendations"])

    def test_rejects_post(self):
        response = call_app(self.app, "POST", ENDPOINT)

        self.assertEqual(response.status, 405)
