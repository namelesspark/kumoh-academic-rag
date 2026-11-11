"""POST /chat 요청·응답 모델."""

from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, Field, field_validator


class ChatRequest(BaseModel):
    message: str = Field(..., description="사용자 질문. 공백만으로는 받지 않는다.")
    session_id: str | None = Field(
        default=None,
        description="대화 세션 ID(UUID 문자열). 없으면 서버가 발급한다.",
    )
    use_academic_data: bool = Field(
        default=False,
        description="학적 연동 동의 여부. 요청마다 받는다.",
    )

    @field_validator("message")
    @classmethod
    def _message_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("message must not be blank")
        return value

    @field_validator("session_id")
    @classmethod
    def _session_id_is_uuid(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            uuid.UUID(value)
        except (ValueError, AttributeError, TypeError) as exc:
            raise ValueError("session_id must be a UUID string") from exc
        # 정규화하지 않고 받은 문자열을 그대로 돌려준다.
        return value


class Citation(BaseModel):
    article_path: str
    document: str
    effective_date: date
    snippet: str
    source_url: str | None = None


class LatencyMs(BaseModel):
    retrieval: int = 0
    generation: int = 0
    total: int = 0


class ChatResponse(BaseModel):
    session_id: str
    answer: str
    citations: list[Citation]
    answered: bool
    personalized: bool
    latency_ms: LatencyMs
