"""졸업 체크 화면에 건네는 응답 형식."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, PositiveInt


class ResponseModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GraduationProfile(ResponseModel):
    label: str
    department: str
    admission_year: int
    admission_type: str
    track: str
    is_fictional: Literal[True]


class GraduationBasis(ResponseModel):
    applied_rule: str
    source_title: str | None = None
    source_url: str | None = None
    checked_on: date | None = None


class GraduationDetail(ResponseModel):
    id: str
    label: str
    status: Literal["met", "short", "needs_check"]
    current: str | None = None
    required: str | None = None
    shortfall: str | None = None
    reason: str | None = None
    basis: GraduationBasis


class GraduationItem(GraduationDetail):
    details: list[GraduationDetail]


class BiskitProgram(ResponseModel):
    title: str
    audience: str
    eligibility: Literal["eligible", "needs_check"]
    apply_until: date
    deadline_status: Literal["open", "needs_check"]
    event_on: date | None
    mileage_status: Literal["published", "announced", "undisclosed"]
    mileage_points: int | None
    notice_url: str | None
    application_url: str | None
    login_required: bool


class BiskitRecommendations(ResponseModel):
    shortfall_points: PositiveInt
    listed_on: date
    evaluated_at: datetime
    portal_url: str
    programs: list[BiskitProgram]


class GraduationDemoResponse(ResponseModel):
    profile: GraduationProfile
    items: list[GraduationItem]
    biskit_recommendations: BiskitRecommendations | None = None
