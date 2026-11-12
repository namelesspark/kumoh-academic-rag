"""졸업 체크 화면에 건네는 응답 형식."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict


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


class GraduationDemoResponse(ResponseModel):
    profile: GraduationProfile
    items: list[GraduationItem]
