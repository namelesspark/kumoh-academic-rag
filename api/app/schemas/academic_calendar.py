"""학사일정 조회 응답에 담는 항목을 정의한다."""

from datetime import date
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.campus_guide import GuideSource


class AcademicCalendarEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    audience: str
    starts_on: date
    ends_on: date
    sources: list[GuideSource] = Field(min_length=1)

    @model_validator(mode="after")
    def check_date_order(self) -> Self:
        if self.ends_on < self.starts_on:
            raise ValueError("ends_on must be on or after starts_on")
        return self


class AcademicCalendarResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    events: list[AcademicCalendarEvent]
