"""가상 이수 기록을 졸업 기준과 비교한다."""

from dataclasses import dataclass, field
from typing import Literal, Mapping, TypeVar

from app.schemas.graduation_demo import (
    GraduationBasis,
    GraduationDemoResponse,
    GraduationDetail,
    GraduationItem,
    GraduationProfile,
)


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
    display = {
        "current": None if current is None else f"{current}{unit}",
        "required": None if required is None else f"{required}{unit}",
    }
    if required is None:
        return dict(display, status="needs_check", reason="적용 기준 확인이 필요합니다.")
    if current is None:
        return dict(display, status="needs_check", reason="이수 기록 확인이 필요합니다.")
    if current < required:
        return dict(display, status="short", shortfall=f"{required - current}{unit} 부족")
    return dict(display, status="met")


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


def _mileage(rules: GraduationRules, record: CompletionRecord) -> dict:
    semesters = record.remaining_semesters_2025_03_01
    rate = rules.mileage_per_semester
    if semesters is None:
        return dict(_count(record.mileage, None, "점"), reason="2025-03-01 기준 잔여 학기 기록 확인이 필요합니다.")
    if semesters >= 8:
        return dict(_count(record.mileage, None, "점"), reason="잔여 8학기 이상에 적용할 기준 확인이 필요합니다.")
    required = rate * semesters if rate is not None and semesters >= 0 else None
    return _count(record.mileage, required, "점")


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
        mileage=_mileage(rules, record),
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


def evaluate_graduation(rules: GraduationRules, record: CompletionRecord) -> GraduationDemoResponse:
    """같은 기준과 기록에 같은 판정을 돌려준다."""
    basis = GraduationBasis(applied_rule=rules.cohort.label)
    out_of_scope = dict(status="needs_check", reason="적용 대상 전공·입학연도·입학 유형·트랙을 확인해 주세요.")
    results = _evaluate_details(rules, record) if record.cohort == rules.cohort else {}
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
            label=record.label, department=cohort.department, admission_year=cohort.admission_year,
            admission_type=cohort.admission_type, track=cohort.track, is_fictional=True,
        ),
        items=items,
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
    label="가상 학생 홍길동",
    cohort=DEMO_COHORT,
    credits={"credits_total": 122, "general_required": 4, "general_elective": 14, "msc": 16, "major": 70},
    major_attempts=(),
    thesis_passed=False,
    mileage=375,
    remaining_semesters_2025_03_01=4,
)


async def get_graduation_demo() -> GraduationDemoResponse:
    return evaluate_graduation(DEMO_RULES, DEMO_RECORD)
