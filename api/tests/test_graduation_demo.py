"""서버를 띄우지 않고 졸업 체크 주소의 읽기 전용 응답을 확인한다."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.tests.asgi_harness import call_app
from app.main import create_app
from app.schemas.graduation_demo import GraduationDemoResponse
from app.services.graduation_rules import get_graduation_demo


ENDPOINT = "/api/v1/graduation-demo"
DETAIL_IDS = {
    "total_credits": ("credits_total", "general_required", "general_elective", "msc", "major"),
    "major_required": ("required_courses", "thesis"),
    "extracurricular": ("career_education", "counseling", "mileage"),
}
RESULT_FIELDS = {"id", "label", "status", "current", "required", "shortfall", "reason", "basis"}
PROFILE = {
    "label": "가상 학생 홍길동",
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


class GraduationDemoTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app()

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
        }

        async def provide_fictional_demo():
            return GraduationDemoResponse(**payload)

        self.app.dependency_overrides[get_graduation_demo] = provide_fictional_demo
        response = call_app(self.app, "GET", ENDPOINT)

        self.assertEqual(response.status, 200)
        body = response.json()
        self.assertEqual(set(body), {"profile", "items"})
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
        response = call_app(self.app, "GET", ENDPOINT)

        self.assertEqual(response.status, 200)
        body = response.json()
        self.assertIs(body["profile"]["is_fictional"], True)
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

    def test_rejects_post(self):
        response = call_app(self.app, "POST", ENDPOINT)

        self.assertEqual(response.status, 405)
