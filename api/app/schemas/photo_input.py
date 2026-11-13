"""사진 판독과 판독문 재질의에 쓰는 요청 및 응답."""

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.poster_lookup import PosterEvent, PosterLookupResponse


class PhotoInputResponse(PosterLookupResponse):
    recognized_text: str


class PhotoQuestionRequest(BaseModel):
    question: str
    recognized_text: str = Field(max_length=2000)
    session_id: str | None = None


class PhotoQuestionSource(BaseModel):
    title: str
    url: str


class PhotoQuestionResponse(BaseModel):
    kind: Literal["event", "regulation", "campus", "hold"]
    answer: str | None = None
    sources: list[PhotoQuestionSource] = Field(default_factory=list)
    event: PosterEvent | None = None
    hold_reason: str | None = None
