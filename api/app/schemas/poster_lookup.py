"""현수막 사진과 공식 행사 정보를 대조한 결과."""

from datetime import date
from typing import Literal

from pydantic import BaseModel


Clue = Literal["text", "qr_notice", "qr_program"]
Reason = Literal[
    "no_readable_clue", "ambiguous_event", "deadline_mismatch", "deadline_day",
    "text_reader_unavailable",
]


class PosterEvent(BaseModel):
    title: str
    event_date: date | None
    official_deadline: date
    poster_deadline: str | None
    application_state: Literal["open", "closed", "needs_check"]
    mileage: int | None
    notice_url: str | None
    application_url: str | None
    login_required: bool
    checked_on: date


class PosterLookupResponse(BaseModel):
    event_match: Literal["confirmed", "needs_check"]
    identified_by: list[Clue]
    reasons: list[Reason]
    event: PosterEvent | None
