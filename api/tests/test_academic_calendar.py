"""서버를 띄우지 않고 학년도·학기별 수강신청 일정 응답을 확인한다."""

from datetime import date
import pathlib
import sys
import unittest
from unittest.mock import patch

from pydantic import ValidationError

TESTS_DIR = pathlib.Path(__file__).resolve().parent
sys.path[:0] = [str(TESTS_DIR.parent), str(TESTS_DIR)]

from asgi_harness import call_app
from app.main import VALIDATION_ERROR_MESSAGE, app
from app.schemas.academic_calendar import AcademicCalendarEvent
from app.services.academic_calendar import ACADEMIC_CALENDAR


CALENDAR = "/api/v1/academic-calendar"
OFFICIAL_SOURCE = {
    "title": "학사일정",
    "url": "https://www.kumoh.ac.kr/ko/schedule_reg.do",
    "checked_on": "2026-11-13",
}
EXPECTED_EVENTS = [
    {
        "audience": audience,
        "starts_on": starts_on,
        "ends_on": ends_on,
        "sources": [OFFICIAL_SOURCE],
    }
    for audience, starts_on, ends_on in (
        ("1·4학년", "2027-02-11", "2027-02-12"),
        ("2·3학년", "2027-02-15", "2027-02-16"),
        ("신입생·편입생", "2027-02-17", "2027-02-17"),
        ("전체 학년 (타학부·타학년 수강신청)", "2027-02-18", "2027-02-18"),
    )
]


class AcademicCalendarEndpointTest(unittest.TestCase):
    def test_returns_official_registration_events_in_order(self):
        response = call_app(app, "GET", f"{CALENDAR}/2027/1")

        self.assertEqual(response.status, 200)
        self.assertEqual(response.json(), {"events": EXPECTED_EVENTS})

        for event in response.json()["events"]:
            with self.subTest(audience=event["audience"]):
                starts_on = date.fromisoformat(event["starts_on"])
                ends_on = date.fromisoformat(event["ends_on"])
                self.assertLessEqual(starts_on, ends_on)
                for ordinal in range(starts_on.toordinal(), ends_on.toordinal() + 1):
                    self.assertLess(date.fromordinal(ordinal).weekday(), 5)

    def test_returns_empty_events_for_other_year_or_term(self):
        for year_and_term in ("2027/2", "2026/1"):
            with self.subTest(year_and_term=year_and_term):
                response = call_app(app, "GET", f"{CALENDAR}/{year_and_term}")
                self.assertEqual(response.status, 200)
                self.assertEqual(response.json(), {"events": []})

    def test_rejects_invalid_year_or_term_with_fixed_message(self):
        for year_and_term in ("abcd/1", "20270/1", "2027/0", "2027/3", "2027/01"):
            with self.subTest(year_and_term=year_and_term):
                response = call_app(app, "GET", f"{CALENDAR}/{year_and_term}")
                self.assertEqual(response.status, 400)
                self.assertEqual(response.json(), {"detail": VALIDATION_ERROR_MESSAGE})

    def test_rejects_post(self):
        response = call_app(app, "POST", f"{CALENDAR}/2027/1", json_body={"events": []})
        self.assertEqual(response.status, 405)

    def test_sorts_fictional_events_and_preserves_their_sources(self):
        early = {
            "audience": "가상 우주항법과 1학년",
            "starts_on": "2099-03-02",
            "ends_on": "2099-03-03",
            "sources": [
                {
                    "title": "가상 달 기지 학사일정",
                    "url": "https://example.invalid/lunar-campus/calendar?year=2099&term=1",
                    "checked_on": "2099-02-01",
                }
            ],
        }
        late = {
            "audience": "가상 우주항법과 2학년",
            "starts_on": "2099-03-04",
            "ends_on": "2099-03-04",
            "sources": [
                {
                    "title": "가상 달 기지 추가 일정",
                    "url": "https://example.invalid/lunar-campus/notice/2",
                    "checked_on": "2099-02-02",
                }
            ],
        }
        events = (AcademicCalendarEvent(**late), AcademicCalendarEvent(**early))

        with patch.dict(ACADEMIC_CALENDAR, {(2099, 1): events}):
            response = call_app(app, "GET", f"{CALENDAR}/2099/1")

        self.assertEqual(response.status, 200)
        self.assertEqual(response.json(), {"events": [early, late]})

    def test_event_model_rejects_end_before_start(self):
        with self.assertRaises(ValidationError):
            AcademicCalendarEvent(
                audience="가상 우주항법과 1학년",
                starts_on=date(2099, 3, 4),
                ends_on=date(2099, 3, 3),
                sources=[
                    {
                        "title": "가상 달 기지 학사일정",
                        "url": "https://example.invalid/lunar-campus/calendar",
                        "checked_on": date(2099, 2, 1),
                    }
                ],
            )
