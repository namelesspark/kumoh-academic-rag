"""GET /health 응답 모델."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    index_loaded: bool
    chunk_count: int
