"""공개 학사일정 조회 주소를 등록한다."""

from typing import Annotated

from fastapi import APIRouter, Path

from app.schemas.academic_calendar import AcademicCalendarResponse
from app.services.academic_calendar import get_academic_calendar_events


router = APIRouter()


@router.get("/academic-calendar/{year}/{term}", response_model=AcademicCalendarResponse)
async def get_academic_calendar(
    year: Annotated[str, Path(pattern=r"^[0-9]{4}$")],
    term: Annotated[str, Path(pattern=r"^[12]$")],
) -> AcademicCalendarResponse:
    return AcademicCalendarResponse(events=get_academic_calendar_events(int(year), int(term)))
