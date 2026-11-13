"""가상 이수 기록을 졸업 기준과 비교한다."""

from dataclasses import dataclass, field, replace
from datetime import datetime
from typing import Literal, Mapping, TypeVar

from fastapi import HTTPException

from app.schemas.graduation_demo import (
    DemoStudent,
    DemoStudentsResponse,
    GraduationBasis,
    GraduationDemoResponse,
    GraduationDetail,
    GraduationItem,
    GraduationProfile,
)
from app.services.biskit_recommendations import KST, recommend_biskit


GROUPS = (
    ("total_credits", "학점", (
        ("credits_total", "총학점"),
        ("general_required", "교양필수"),
        ("general_elective", "교양선택"),
        ("msc", "수학·기초과학 영역(MSC)"),
        ("major", "전공"),
    )),
    ("major_required", "전공필수", (
        ("required_courses", "전공필수 과목"),
        ("thesis", "졸업논문·과제"),
    )),
    ("extracurricular", "비교과", (
        ("career_education", "취업진로교육"),
        ("counseling", "진로상담"),
        ("mileage", "마일리지"),
    )),
)
Period = TypeVar("Period", str, int)


@dataclass(frozen=True)
class Cohort:
    department: str = "컴퓨터공학전공"
    admission_year: int = 2023
    admission_type: str = "일반 신입학"
    track: str = "주전공 단일"

    @property
    def label(self) -> str:
        return f"{self.department} {self.admission_year}학년도 {self.admission_type}·{self.track} 기준"


@dataclass(frozen=True)
class GraduationRules:
    cohort: Cohort
    credit_minima: Mapping[str, int | None]
    required_courses: Mapping[str, str] | None
    course_aliases: Mapping[str, str]
    thesis_required: bool | None
    education_semesters: frozenset[str] | None
    counseling_years: frozenset[int] | None
    mileage_per_semester: int | None
    basis: Mapping[str, GraduationBasis] = field(default_factory=dict)


@dataclass(frozen=True)
class CourseAttempt:
    code: str
    # 가상 기록은 인정된 성적을 pass로, 낙제를 F로 표시한다.
    grade: Literal["pass", "F"]
    credits: int
    semester: tuple[int, int]  # (연도, 학기)


@dataclass(frozen=True)
class CompletionRecord:
    label: str
    cohort: Cohort
    # 총학점과 전공학점은 major_attempts에 넣은 과목의 학점을 빼고 입력한다.
    credits: Mapping[str, int | None] = field(default_factory=dict)
    major_attempts: tuple[CourseAttempt, ...] | None = None
    thesis_passed: bool | None = None
    education_semesters: tuple[str, ...] | None = None
    counseling_years: tuple[int, ...] | None = None
    mileage: int | None = None  # 이미 승인된 점수
    remaining_semesters_2025_03_01: int | None = None
    enrollment_status: str | None = None
    student_id: str | None = None  # 목록에 올린 가상 학생만 가진다.


def _passing_courses(
    attempts: tuple[CourseAttempt, ...] | None, aliases: Mapping[str, str],
) -> dict[str, int] | None:
    if attempts is None:
        return None

    latest: dict[str, CourseAttempt] = {}
    for attempt in attempts:
        code = aliases.get(attempt.code, attempt.code)
        previous = latest.get(code)
        # 같은 학기에 기록이 여러 개면 뒤에 적힌 기록을 사용한다.
        if previous is None or attempt.semester >= previous.semester:
            latest[code] = attempt
    return {code: attempt.credits for code, attempt in latest.items() if attempt.grade == "pass"}


def _count(current: int | None, required: int | None, unit: str) -> dict:
    return _count_with_shortfall(current, required, unit)[0]


def _count_with_shortfall(
    current: int | None, required: int | None, unit: str,
) -> tuple[dict, int | None]:
    display = {
        "current": None if current is None else f"{current}{unit}",
        "required": None if required is None else f"{required}{unit}",
    }
    if required is None:
        return dict(display, status="needs_check", reason="적용 기준 확인이 필요합니다."), None
    if current is None:
        return dict(display, status="needs_check", reason="이수 기록 확인이 필요합니다."), None
    if current < required:
        shortfall = required - current
        return dict(display, status="short", shortfall=f"{shortfall}{unit} 부족"), shortfall
    return dict(display, status="met"), 0


def _course_result(passing: dict[str, int] | None, required: Mapping[str, str] | None) -> dict:
    if passing is None or required is None:
        return _count(None, None if required is None else len(required), "과목")

    missing = [f"{name}({code})" for code, name in required.items() if code not in passing]
    result = _count(len(required) - len(missing), len(required), "과목")
    if missing:
        result["shortfall"] += f" ({', '.join(missing)})"
    return result


def _thesis_result(passed: bool | None, required: bool | None) -> dict:
    result = _count(
        None if passed is None else int(passed),
        None if required is None else int(required),
        "",
    )
    result["current"] = {True: "합격", False: "미충족", None: None}[passed]
    result["required"] = {True: "합격", False: "요건 없음", None: None}[required]
    if result["status"] == "short":
        result["shortfall"] = "졸업논문 또는 졸업과제 합격 필요"
    return result


def _periods(completed: tuple[Period, ...] | None, required: frozenset[Period] | None) -> dict:
    if completed is None or required is None:
        return _count(None, None if required is None else len(required), "회")
    return _count(len(required.intersection(completed)), len(required), "회")


def _mileage(rules: GraduationRules, record: CompletionRecord) -> tuple[dict, int | None]:
    semesters = record.remaining_semesters_2025_03_01
    rate = rules.mileage_per_semester
    if semesters is None:
        return dict(_count(record.mileage, None, "점"), reason="2025-03-01 기준 잔여 학기 기록 확인이 필요합니다."), None
    if semesters >= 8:
        return dict(_count(record.mileage, None, "점"), reason="잔여 8학기 이상에 적용할 기준 확인이 필요합니다."), None
    required = rate * semesters if rate is not None and semesters >= 0 else None
    return _count_with_shortfall(record.mileage, required, "점")


def _evaluate_details(rules: GraduationRules, record: CompletionRecord) -> dict[str, dict]:
    passing = _passing_courses(record.major_attempts, rules.course_aliases)
    course_credits = None if passing is None else sum(passing.values())
    credits = dict(record.credits)
    for key in ("credits_total", "major"):
        baseline = credits.get(key)
        credits[key] = baseline + course_credits if baseline is not None and course_credits is not None else None

    results = {
        key: _count(credits.get(key), rules.credit_minima.get(key), "학점")
        for key, _ in GROUPS[0][2]
    }
    results.update(
        required_courses=_course_result(passing, rules.required_courses),
        thesis=_thesis_result(record.thesis_passed, rules.thesis_required),
        career_education=_periods(record.education_semesters, rules.education_semesters),
        counseling=_periods(record.counseling_years, rules.counseling_years),
    )
    return results


def _summarize(details: list[GraduationDetail]) -> dict:
    short_count = sum(detail.status == "short" for detail in details)
    if short_count:
        return dict(status="short", shortfall=f"세부 {short_count}건 부족")
    reason = next((detail.reason for detail in details if detail.status == "needs_check"), None)
    if reason is not None:
        return dict(status="needs_check", reason=reason)
    return dict(status="met")


def evaluate_graduation(
    rules: GraduationRules, record: CompletionRecord, *, evaluated_at: datetime | None = None,
) -> GraduationDemoResponse:
    """같은 기준과 기록, 판정 시각에 같은 결과를 돌려준다."""
    basis = GraduationBasis(applied_rule=rules.cohort.label)
    out_of_scope = dict(status="needs_check", reason="적용 대상 전공·입학연도·입학 유형·트랙을 확인해 주세요.")
    results = {}
    recommendations = None
    if record.cohort == rules.cohort:
        results = _evaluate_details(rules, record)
        results["mileage"], shortfall_points = _mileage(rules, record)
        if evaluated_at is not None:
            recommendations = recommend_biskit(shortfall_points, record.enrollment_status, evaluated_at)
    items = []
    for group_id, label, entries in GROUPS:
        details = [
            GraduationDetail(
                id=key, label=detail_label,
                basis=rules.basis.get(key, basis),
                **results.get(key, out_of_scope),
            )
            for key, detail_label in entries
        ]
        items.append(GraduationItem(
            id=group_id, label=label, basis=basis, details=details, **_summarize(details),
        ))
    cohort = record.cohort
    return GraduationDemoResponse(
        profile=GraduationProfile(
            id=record.student_id, label=record.label, department=cohort.department, admission_year=cohort.admission_year,
            admission_type=cohort.admission_type, track=cohort.track, is_fictional=True,
        ),
        items=items,
        biskit_recommendations=recommendations,
    )


DEMO_COHORT = Cohort()
DEMO_STUDY_YEARS = 4
GUIDE_BASIS = GraduationBasis(
    applied_rule=f"{DEMO_COHORT.label} (Type B)",
    source_title="컴퓨터공학전공 2026학년도 2학기 수강지도 안내 6–10쪽",
    source_url="https://cs.kumoh.ac.kr/ce/sub0501.do?articleNo=571213&attachNo=166666&mode=download#page=6",
)
MILEAGE_BASIS = GraduationBasis(
    applied_rule=f"{DEMO_COHORT.label} (2025-03-01 잔여 학기 경과조치)",
    source_title="BISKIT 경과조치 공지",
    source_url="https://www.kumoh.ac.kr/ko/sub06_01_01_01.do?articleNo=507677&mode=view",
)
DEMO_RULES = GraduationRules(
    cohort=DEMO_COHORT,
    credit_minima={
        "credits_total": 130, "general_required": 4, "general_elective": 16,
        "msc": 16, "major": 75,
    },
    required_courses=None,
    course_aliases={"CD0062": "GA3006"},
    thesis_required=True,
    education_semesters=frozenset(
        f"{DEMO_COHORT.admission_year + year_offset}-{semester}"
        for year_offset in range(DEMO_STUDY_YEARS)
        for semester in (1, 2)
    ),
    counseling_years=frozenset(range(1, DEMO_STUDY_YEARS + 1)),
    mileage_per_semester=125,
    basis={
        **dict.fromkeys((
            "credits_total", "general_required", "general_elective", "msc", "major",
            "thesis", "career_education", "counseling",
        ), GUIDE_BASIS),
        "mileage": MILEAGE_BASIS,
    },
)
DEMO_RECORD = CompletionRecord(
    label="가상 학생 D02",
    cohort=DEMO_COHORT,
    credits={"credits_total": 130, "general_required": 4, "general_elective": 16, "msc": 16, "major": 75},
    major_attempts=(),
    thesis_passed=True,
    education_semesters=tuple(sorted(DEMO_RULES.education_semesters)),
    counseling_years=(1, 2, 3),
    mileage=480,
    remaining_semesters_2025_03_01=4,
    enrollment_status="undergraduate",
    student_id="demo-d02",
)
# 아래 두 명은 같은 기준에 이수 내역만 다르다. 기준표 문서의 회귀 사례 D03·D04와는 다른 기록이다.
DEMO_D03_RECORD = replace(
    DEMO_RECORD,
    student_id="demo-d03",
    label="가상 학생 D03",
    credits={"credits_total": 84, "general_required": 4, "general_elective": 16, "msc": 16, "major": 45},
    thesis_passed=False,
    counseling_years=(1, 2, 3, 4),
    mileage=500,
)
DEMO_D04_RECORD = replace(
    DEMO_RECORD,
    student_id="demo-d04",
    label="가상 학생 D04",
    counseling_years=(1, 2, 3, 4),
    mileage=380,
)
DEMO_SCENARIOS = {
    "demo-d02": "졸업 요건에 가까움",
    "demo-d03": "학점이 많이 남음",
    "demo-d04": "비교과 점수 부족",
}
DEFAULT_DEMO_STUDENT_ID = "demo-d02"
UNKNOWN_STUDENT_MESSAGE = "가상 학생을 찾을 수 없습니다."


def _demo_records() -> tuple[CompletionRecord, ...]:
    # 부를 때마다 모듈 값을 읽는다. 테스트가 DEMO_RECORD를 바꿔 끼우면 그 기록을 쓴다.
    return (DEMO_RECORD, DEMO_D03_RECORD, DEMO_D04_RECORD)


async def get_demo_students() -> DemoStudentsResponse:
    return DemoStudentsResponse(students=[
        DemoStudent(
            id=record.student_id, label=record.label,
            scenario=DEMO_SCENARIOS[record.student_id], is_fictional=True,
        )
        for record in _demo_records()
    ])


async def get_graduation_demo(student_id: str = DEFAULT_DEMO_STUDENT_ID) -> GraduationDemoResponse:
    """고른 가상 학생을 판정한다. 서버는 누가 무엇을 골랐는지 저장하지 않는다."""
    record = next((record for record in _demo_records() if record.student_id == student_id), None)
    if record is None:
        # 받은 값을 문구에 넣지 않는다. 다른 학생으로 바꿔 답하지도 않는다.
        raise HTTPException(status_code=404, detail=UNKNOWN_STUDENT_MESSAGE)
    return evaluate_graduation(DEMO_RULES, record, evaluated_at=datetime.now(KST))
