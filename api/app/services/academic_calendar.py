"""학년도와 학기에 해당하는 학부 수강신청 일정을 찾는다."""

from datetime import date
from operator import attrgetter

from app.schemas.academic_calendar import AcademicCalendarEvent
from app.schemas.campus_guide import GuideSource


_SOURCE = GuideSource(
    title="학사일정",
    url="https://www.kumoh.ac.kr/ko/schedule_reg.do",
    checked_on=date(2026, 11, 13),
)

ACADEMIC_CALENDAR: dict[tuple[int, int], tuple[AcademicCalendarEvent, ...]] = {
    (2027, 1): (
        AcademicCalendarEvent(
            audience="1·4학년",
            starts_on=date(2027, 2, 11),
            ends_on=date(2027, 2, 12),
            sources=[_SOURCE],
        ),
        AcademicCalendarEvent(
            audience="2·3학년",
            starts_on=date(2027, 2, 15),
            ends_on=date(2027, 2, 16),
            sources=[_SOURCE],
        ),
        AcademicCalendarEvent(
            audience="신입생·편입생",
            starts_on=date(2027, 2, 17),
            ends_on=date(2027, 2, 17),
            sources=[_SOURCE],
        ),
        AcademicCalendarEvent(
            audience="전체 학년 (타학부·타학년 수강신청)",
            starts_on=date(2027, 2, 18),
            ends_on=date(2027, 2, 18),
            sources=[_SOURCE],
        ),
    ),
}


def get_academic_calendar_events(year: int, term: int) -> list[AcademicCalendarEvent]:
    return sorted(ACADEMIC_CALENDAR.get((year, term), ()), key=attrgetter("starts_on"))
