"""공개 공지 목록과 가상 프로그램으로 추천 조건을 확인한다."""

from dataclasses import replace
from datetime import date, datetime, timezone
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.biskit_recommendations import PROGRAMS, Program, recommend_biskit


CHECKED_AT = datetime.fromisoformat("2026-11-13T09:00:00+09:00")
UNDERGRADUATE = "undergraduate"
FICTIONAL_PROGRAM = Program(
    title="가상 BISKIT 프로그램",
    audience="학부 재학생",
    eligible_statuses=frozenset({UNDERGRADUATE}),
    apply_from=date(2026, 11, 13),
    apply_until=date(2026, 11, 20),
    event_on=None,
    mileage_status="published",
    mileage_points=40,
    notice_url="https://kumoh.ac.kr/fictional-notice",
    application_url="https://biskit.kumoh.ac.kr/fictional-application",
    login_required=True,
)


class BiskitRecommendationsTest(unittest.TestCase):
    def test_public_programs_are_sorted_by_deadline(self):
        recommendations = recommend_biskit(
            20, UNDERGRADUATE, CHECKED_AT, programs=PROGRAMS[::-1],
        )
        programs = recommendations.programs

        self.assertEqual(len(programs), 3)
        for program, title_part, deadline, application_url in zip(
            programs,
            ("병역진로설계", "SJA", "학습법 특강"),
            (date(2026, 11, 20), date(2026, 11, 22), date(2026, 11, 26)),
            (
                "https://biskit.kumoh.ac.kr/common/user/login.do?rtnUrl=%2Fptfol%2Fimng%2FicmpNsbjtPgm%2FfindIcmpNsbjtPgmInfo.do%3FencSddpbSeq%3D31303034313830",
                "https://biskit.kumoh.ac.kr/common/user/login.do?rtnUrl=%2Fptfol%2Fimng%2FicmpNsbjtPgm%2FfindIcmpNsbjtPgmInfo.do%3FencSddpbSeq%3D31303034313732",
                None,
            ),
        ):
            with self.subTest(title=program.title):
                self.assertIn(title_part, program.title)
                self.assertEqual(program.apply_until, deadline)
                self.assertEqual(program.eligibility, "eligible")
                self.assertEqual(program.deadline_status, "open")
                self.assertIsNotNone(program.notice_url)
                self.assertEqual(program.application_url, application_url)
                self.assertTrue(program.login_required)
                self.assertIsNone(program.mileage_points)
        self.assertEqual(programs[1].event_on, date(2026, 11, 23))
        self.assertEqual(
            [program.mileage_status for program in programs],
            ["undisclosed", "undisclosed", "announced"],
        )

    def test_last_day_without_a_time_needs_check_in_kst(self):
        # UTC 11월 19일 15시는 한국 표준시 11월 20일 자정이다.
        evaluated_at = datetime(2026, 11, 19, 15, tzinfo=timezone.utc)
        recommendations = recommend_biskit(20, UNDERGRADUATE, evaluated_at)
        self.assertEqual(recommendations.evaluated_at.isoformat(), "2026-11-20T00:00:00+09:00")
        self.assertIn("병역진로설계", recommendations.programs[0].title)
        self.assertEqual(recommendations.programs[0].deadline_status, "needs_check")
        self.assertEqual(recommendations.programs[1].deadline_status, "open")

    def test_programs_are_empty_after_all_deadlines(self):
        evaluated_at = CHECKED_AT.replace(day=27)
        recommendations = recommend_biskit(20, UNDERGRADUATE, evaluated_at)
        self.assertEqual(len(recommendations.programs), 0)

    def test_eligibility_and_application_start_are_checked(self):
        for enrollment_status, evaluated_at, expected in (
            (UNDERGRADUATE, CHECKED_AT.replace(day=12), []),
            ("graduate_student", CHECKED_AT, []),
            (None, CHECKED_AT, ["needs_check"]),
            (UNDERGRADUATE, CHECKED_AT, ["eligible"]),
        ):
            with self.subTest(status=enrollment_status, evaluated_at=evaluated_at):
                recommendations = recommend_biskit(
                    20, enrollment_status, evaluated_at, programs=(FICTIONAL_PROGRAM,),
                )
                self.assertEqual([program.eligibility for program in recommendations.programs], expected)

    def test_published_points_and_official_addresses_are_preserved(self):
        recommendations = recommend_biskit(
            20, UNDERGRADUATE, CHECKED_AT, programs=(FICTIONAL_PROGRAM,),
        )
        program = recommendations.programs[0]
        self.assertEqual(program.mileage_status, "published")
        self.assertEqual(program.mileage_points, 40)
        self.assertIs(type(program.mileage_points), int)
        self.assertEqual(program.notice_url, FICTIONAL_PROGRAM.notice_url)
        self.assertEqual(program.application_url, FICTIONAL_PROGRAM.application_url)

    def test_unsafe_addresses_are_removed_without_removing_program(self):
        for url in (
            None,
            "",
            "http://www.kumoh.ac.kr/",
            "javascript:alert(1)",
            "https://account:password@www.kumoh.ac.kr/",
            "https://kumoh.ac.kr.example.invalid/",
            "https://fakekumoh.ac.kr/",
        ):
            with self.subTest(url=url):
                fixture = replace(FICTIONAL_PROGRAM, notice_url=url, application_url=url)
                recommendations = recommend_biskit(20, UNDERGRADUATE, CHECKED_AT, programs=(fixture,))
                self.assertEqual(len(recommendations.programs), 1)
                program = recommendations.programs[0]
                self.assertIsNone(program.notice_url)
                self.assertIsNone(program.application_url)
                self.assertEqual(program.title, fixture.title)
                self.assertEqual(program.mileage_points, fixture.mileage_points)
