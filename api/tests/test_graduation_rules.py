"""가상 졸업 기준으로 규칙의 경계와 중복 기록을 확인한다."""

from dataclasses import replace
from pathlib import Path
import sys
import unittest

API_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_DIR))

from app.schemas.graduation_demo import GraduationBasis
from app.services.graduation_rules import (
    Cohort,
    CompletionRecord,
    CourseAttempt,
    DEMO_RULES,
    GraduationRules,
    evaluate_graduation,
)


COHORT = Cohort()
RULES = GraduationRules(
    cohort=COHORT,
    credit_minima={"credits_total": 10, "general_required": 2, "general_elective": 1, "msc": 1, "major": 6},
    required_courses={"GA3006": "가상 자료구조", "TEST-02": "가상 필수 과목"},
    course_aliases={"CD0062": "GA3006"},
    thesis_required=True,
    education_semesters=frozenset({"가상 1학기", "가상 2학기"}),
    counseling_years=frozenset({1, 2}),
    mileage_per_semester=125,
    basis={
        "credits_total": GraduationBasis(applied_rule="가상 기준", source_url="https://example.invalid/rules"),
    },
)
RECORD = CompletionRecord(
    label="가상 테스트 학생",
    cohort=COHORT,
    credits={"credits_total": 4, "general_required": 2, "general_elective": 1, "msc": 1, "major": 0},
    major_attempts=(
        CourseAttempt("GA3006", "pass", 3, (2023, 1)),
        CourseAttempt("TEST-02", "pass", 3, (2023, 1)),
    ),
    thesis_passed=True,
    education_semesters=("가상 1학기", "가상 2학기"),
    counseling_years=(1, 2),
    mileage=500,
    remaining_semesters_2025_03_01=4,
)

CASE_RECORD = CompletionRecord(
    label="가상 사례 학생",
    cohort=COHORT,
    credits={"credits_total": 132, "general_required": 4, "general_elective": 16, "msc": 16, "major": 76},
    major_attempts=(),
    thesis_passed=True,
    education_semesters=(
        "2023-1", "2023-2", "2024-1", "2024-2", "2025-1", "2025-2", "2026-1", "2026-2",
    ),
    counseling_years=(1, 2, 3, 4),
    mileage=510,
    remaining_semesters_2025_03_01=4,
)
CASE_COURSE_RULES = replace(DEMO_RULES, required_courses={"GA3006": "자료구조", "GA3020": "운영체제"})


def rows(record=RECORD, rules=RULES):
    return {
        row.id: row
        for item in evaluate_graduation(rules, record).items
        for row in (item, *item.details)
    }


class GraduationRulesTest(unittest.TestCase):
    def test_equal_values_meet_all_requirements(self):
        results = rows()
        self.assertTrue(all(row.status == "met" for row in results.values()))
        self.assertEqual(results["credits_total"].current, "10학점")
        self.assertEqual(results["credits_total"].basis.source_url, "https://example.invalid/rules")

    def test_null_records_need_check(self):
        incomplete = CompletionRecord(
            RECORD.label, COHORT, credits={**RECORD.credits, "general_required": None},
        )
        results = rows(incomplete)
        for key in (
            "credits_total", "general_required", "major", "required_courses",
            "thesis", "career_education", "counseling", "mileage",
        ):
            with self.subTest(key=key):
                self.assertEqual(results[key].status, "needs_check")
                self.assertTrue(results[key].reason)

    def test_explicit_zero_and_empty_records_are_short(self):
        empty = replace(
            RECORD, credits=dict.fromkeys(RECORD.credits, 0), major_attempts=(), thesis_passed=False,
            education_semesters=(), counseling_years=(), mileage=0,
        )
        results = rows(empty)
        self.assertTrue(all(row.status == "short" and row.shortfall for row in results.values()))
        self.assertEqual(results["credits_total"].current, "0학점")
        self.assertEqual(results["required_courses"].current, "0과목")
        self.assertEqual(results["thesis"].shortfall, "졸업논문 또는 졸업과제 합격 필요")

    def test_each_scope_field_must_match(self):
        for field, value in (
            ("department", "가상 전공"), ("admission_year", 2024),
            ("admission_type", "편입학"), ("track", "복수전공"),
        ):
            with self.subTest(field=field):
                record = replace(RECORD, cohort=replace(COHORT, **{field: value}))
                self.assertTrue(all(row.status == "needs_check" and row.reason for row in rows(record).values()))

    def test_unconfirmed_minimum_survives_short_group(self):
        rules = replace(RULES, credit_minima={**RULES.credit_minima, "msc": None})
        results = rows(replace(RECORD, credits={**RECORD.credits, "general_required": 0}), rules)
        self.assertEqual(results["total_credits"].status, "short")
        self.assertEqual(results["msc"].status, "needs_check")
        self.assertTrue(results["msc"].reason)
        self.assertIsNone(results["msc"].required)
        self.assertEqual(rows(rules=rules)["total_credits"].status, "needs_check")

    def test_credit_shortfalls_stay_separate(self):
        record = replace(RECORD, credits={**RECORD.credits, "credits_total": 0, "general_required": 0})
        results = rows(record)
        self.assertEqual(results["credits_total"].shortfall, "4학점 부족")
        self.assertEqual(results["general_required"].shortfall, "2학점 부족")
        self.assertEqual(results["total_credits"].shortfall, "세부 2건 부족")

    def test_d01_meets_confirmed_requirements(self):
        results = rows(CASE_RECORD, DEMO_RULES)
        for key, current in {
            "credits_total": "132학점", "general_required": "4학점", "general_elective": "16학점", "msc": "16학점",
            "major": "76학점", "thesis": "합격", "career_education": "8회", "counseling": "4회", "mileage": "510점",
        }.items():
            with self.subTest(key=key):
                self.assertEqual((results[key].status, results[key].current), ("met", current))
        self.assertEqual(results["required_courses"].status, "needs_check")
        self.assertTrue(results["required_courses"].reason)

    def test_d02_lacks_one_counseling_session_and_twenty_approved_points(self):
        # 가상 토익 805점·정보처리기사 자격은 승인 마일리지에 합산하지 않는다.
        record = replace(
            CASE_RECORD, credits={**CASE_RECORD.credits, "credits_total": 130, "major": 75},
            counseling_years=(1, 2, 3), mileage=480,
        )
        results = rows(record, DEMO_RULES)
        self.assertEqual(results["credits_total"].status, "met")
        self.assertEqual(results["major"].status, "met")
        self.assertEqual(results["extracurricular"].shortfall, "세부 2건 부족")
        self.assertEqual(results["counseling"].shortfall, "1회 부족")
        self.assertEqual(results["mileage"].shortfall, "20점 부족")
        self.assertEqual(results["mileage"].current, "480점")

    def test_d03_retake_counts_once_for_course_and_credits(self):
        attempts = (
            CourseAttempt("CD0062", "F", 3, (2024, 1)),
            CourseAttempt("GA3006", "pass", 3, (2026, 1)),  # 가상 사례의 원래 성적 B+
            CourseAttempt("GA3023", "F", 3, (2026, 1)),
        )
        record = replace(
            CASE_RECORD, credits={**CASE_RECORD.credits, "credits_total": 129, "major": 72},
            major_attempts=attempts,
        )
        self.assertEqual(sum(attempt.grade == "F" for attempt in attempts), 2)
        results = rows(record, DEMO_RULES)
        self.assertEqual(results["credits_total"].current, "132학점")
        self.assertEqual(results["major"].current, "75학점")
        self.assertEqual(results["required_courses"].status, "needs_check")

        # 나머지 전공필수 과목은 이수했다는 가정을 가상 목록에 반영한다.
        rules = replace(CASE_COURSE_RULES, required_courses={"GA3006": "자료구조"})
        courses = rows(record, rules)["required_courses"]
        self.assertEqual((courses.status, courses.current, courses.required), ("met", "1과목", "1과목"))
        self.assertIsNone(courses.shortfall)

    def test_passing_both_equivalent_codes_counts_once(self):
        record = replace(RECORD, major_attempts=(
            CourseAttempt("CD0062", "pass", 3, (2023, 1)),
            CourseAttempt("GA3006", "pass", 3, (2024, 1)),
        ))
        results = rows(record)
        self.assertEqual(results["required_courses"].current, "1과목")
        self.assertEqual(results["credits_total"].current, "7학점")
        self.assertEqual(results["major"].current, "3학점")

    def test_latest_failed_retake_replaces_earlier_pass(self):
        attempts = (
            CourseAttempt("CD0062", "pass", 3, (2023, 1)),
            CourseAttempt("GA3006", "F", 3, (2024, 1)),
            CourseAttempt("TEST-02", "pass", 3, (2023, 1)),
        )
        for attempts_in_order in (attempts, tuple(reversed(attempts))):
            with self.subTest(attempts=attempts_in_order):
                results = rows(replace(RECORD, major_attempts=attempts_in_order))
                self.assertEqual(results["required_courses"].current, "1과목")
                self.assertEqual(results["required_courses"].shortfall, "1과목 부족 (가상 자료구조(GA3006))")
                self.assertEqual(results["credits_total"].current, "7학점")
                self.assertEqual(results["major"].current, "3학점")

    def test_d04_three_failures_leave_two_distinct_required_courses(self):
        attempts = (
            CourseAttempt("CD0062", "F", 3, (2024, 1)),
            CourseAttempt("GA3020", "F", 3, (2025, 1)),
            CourseAttempt("GA3006", "F", 3, (2026, 1)),
        )
        record = replace(
            CASE_RECORD, credits={**CASE_RECORD.credits, "credits_total": 130, "major": 75},
            major_attempts=attempts, mileage=620,
        )
        self.assertEqual(sum(attempt.grade == "F" for attempt in attempts), 3)
        results = rows(record, DEMO_RULES)
        self.assertEqual(results["credits_total"].current, "130학점")
        self.assertEqual(results["major"].current, "75학점")
        self.assertEqual(results["required_courses"].status, "needs_check")

        courses = rows(record, CASE_COURSE_RULES)["required_courses"]
        self.assertEqual((courses.status, courses.current), ("short", "0과목"))
        self.assertEqual(
            courses.shortfall, "2과목 부족 (자료구조(GA3006), 운영체제(GA3020))",
        )

    def test_mileage_depends_on_remaining_semesters(self):
        for semesters, expected, status in (
            (4, "500점", "short"), (3, "375점", "met"),
            (None, None, "needs_check"), (8, None, "needs_check"),
        ):
            with self.subTest(semesters=semesters):
                record = replace(RECORD, mileage=375, remaining_semesters_2025_03_01=semesters)
                result = rows(record)["mileage"]
                self.assertEqual((result.required, result.status), (expected, status))
                if status == "needs_check":
                    self.assertTrue(result.reason)
                if status == "short":
                    self.assertEqual(result.shortfall, "125점 부족")

    def test_duplicate_education_and_counseling_do_not_fill_missing_periods(self):
        record = replace(RECORD, education_semesters=("가상 1학기", "가상 1학기"), counseling_years=(1, 1))
        results = rows(record)
        self.assertEqual(results["career_education"].shortfall, "1회 부족")
        self.assertEqual(results["counseling"].shortfall, "1회 부족")

    def test_documented_criteria_match_shipped_rules(self):
        document = (API_DIR / "docs" / "GRADUATION_RULES.md").read_text(encoding="utf-8")
        values = {
            **DEMO_RULES.credit_minima,
            "required_courses": DEMO_RULES.required_courses,
            "thesis": {True: "합격", False: "요건 없음", None: None}[DEMO_RULES.thesis_required],
            "career_education": len(DEMO_RULES.education_semesters),
            "counseling": len(DEMO_RULES.counseling_years),
            "mileage": DEMO_RULES.mileage_per_semester,
        }
        table = {}
        for line in document.splitlines():
            if line.startswith("| "):
                key, value, *_ = (cell.strip() for cell in line.split("|")[1:])
                if key != "세부 항목 ID":
                    table[key] = value
        self.assertEqual(table, {key: "—" if value is None else str(value) for key, value in values.items()})
