"""공개 비교과 공지를 재학 상태와 한국 날짜에 맞춰 고른다."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Literal
from urllib.parse import urlsplit

from app.schemas.graduation_demo import BiskitProgram, BiskitRecommendations


KST = timezone(timedelta(hours=9))
LISTED_ON = date(2026, 11, 13)
PORTAL_URL = "https://biskit.kumoh.ac.kr/"


@dataclass(frozen=True)
class Program:
    title: str
    audience: str
    eligible_statuses: frozenset[str]
    apply_from: date
    apply_until: date
    event_on: date | None
    mileage_status: Literal["published", "announced", "undisclosed"]
    mileage_points: int | None
    notice_url: str | None
    application_url: str | None = None
    login_required: bool = True
    poster_keywords: tuple[str, ...] = ()
    poster_notice_aliases: tuple[str, ...] = ()


PROGRAMS = (
    Program(
        title="KIT-RC 소통성장 UP! 프로그램 모집 안내",
        audience="학부 재학생",
        eligible_statuses=frozenset({"undergraduate"}),
        apply_from=date(2026, 10, 13),
        apply_until=date(2026, 11, 5),
        event_on=None,
        mileage_status="published",
        mileage_points=40,
        notice_url="https://polymer.kumoh.ac.kr/md/sub0201.do?article.offset=0&articleLimit=10&articleNo=579630&mode=view",
    ),
    Program(
        title="병역진로설계센터 설명회 참가자 모집",
        audience="재학생",
        eligible_statuses=frozenset({"undergraduate", "graduate_student"}),
        apply_from=date(2026, 11, 2),
        apply_until=date(2026, 11, 20),
        event_on=date(2026, 11, 23),
        mileage_status="undisclosed",
        mileage_points=None,
        notice_url="https://www.kumoh.ac.kr/ko/sub06_01_01_02.do?articleNo=581126&mode=view",
        application_url="https://biskit.kumoh.ac.kr/common/user/login.do?rtnUrl=%2Fptfol%2Fimng%2FicmpNsbjtPgm%2FfindIcmpNsbjtPgmInfo.do%3FencSddpbSeq%3D31303034313830",
        poster_keywords=("병역진로설계", "설명회"),
    ),
    Program(
        title="SJA세진아메리카 2027년 미국 인턴 채용설명회",
        audience="재학생·졸업생",
        eligible_statuses=frozenset({"undergraduate", "graduate_student", "alumni"}),
        apply_from=date(2026, 10, 29),
        apply_until=date(2026, 11, 22),
        event_on=date(2026, 11, 23),
        mileage_status="undisclosed",
        mileage_points=None,
        notice_url="https://www.kumoh.ac.kr/ko/sub06_01_01_02.do?articleNo=582099&mode=view",
        application_url="https://biskit.kumoh.ac.kr/common/user/login.do?rtnUrl=%2Fptfol%2Fimng%2FicmpNsbjtPgm%2FfindIcmpNsbjtPgmInfo.do%3FencSddpbSeq%3D31303034313732",
        poster_keywords=("세진아메리카", "인턴", "설명회"),
        poster_notice_aliases=("https://mx.kumoh.ac.kr/md/sub0201.do?articleNo=582275&mode=view",),
    ),
    Program(
        title="2026학년도 제2차 공학교육 맞춤형 학습법 특강(온라인 특강)",
        audience="학부 재학생",
        eligible_statuses=frozenset({"undergraduate"}),
        apply_from=date(2026, 11, 2),
        apply_until=date(2026, 11, 26),
        event_on=None,
        mileage_status="announced",
        mileage_points=None,
        notice_url="https://sls.kumoh.ac.kr/ko/sub06_01_01_02.do?articleNo=581106&mode=view",
    ),
)


def official_url(url: str | None) -> str | None:
    if not url or any(char.isspace() or ord(char) < 32 or char == "\\" for char in url):
        return None
    try:
        parts = urlsplit(url)
        host = parts.hostname
        port = parts.port
    except ValueError:
        return None
    if parts.scheme != "https" or parts.username is not None or parts.password is not None:
        return None
    if port not in (None, 443) or not host:
        return None
    if host == "kumoh.ac.kr" or host.endswith(".kumoh.ac.kr"):
        return url
    return None


def recommend_biskit(
    shortfall_points: int | None,
    enrollment_status: str | None,
    evaluated_at: datetime,
    *,
    programs: tuple[Program, ...] = PROGRAMS,
) -> BiskitRecommendations | None:
    if shortfall_points is None or shortfall_points <= 0:
        return None

    evaluated_at = evaluated_at.astimezone(KST)
    today = evaluated_at.date()
    matches = []
    for program in sorted(programs, key=lambda program: program.apply_until):
        if not program.apply_from <= today <= program.apply_until:
            continue
        if enrollment_status is not None and enrollment_status not in program.eligible_statuses:
            continue
        matches.append(BiskitProgram(
            title=program.title,
            audience=program.audience,
            eligibility="needs_check" if enrollment_status is None else "eligible",
            apply_until=program.apply_until,
            deadline_status="needs_check" if today == program.apply_until else "open",
            event_on=program.event_on,
            mileage_status=program.mileage_status,
            mileage_points=program.mileage_points if program.mileage_status == "published" else None,
            notice_url=official_url(program.notice_url),
            application_url=official_url(program.application_url),
            login_required=program.login_required,
        ))
    return BiskitRecommendations(
        shortfall_points=shortfall_points,
        listed_on=LISTED_ON,
        evaluated_at=evaluated_at,
        portal_url=PORTAL_URL,
        programs=matches,
    )
