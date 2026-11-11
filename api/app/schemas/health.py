"""
GET /api/v1/health 응답 스키마.
"""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """
    서버 기동 확인 응답.

    - status       : 서버가 살아 있으면 "ok"
    - index_loaded : 검색 인덱스를 메모리에 올렸는지
    - chunk_count  : 올린 청크 개수. 인덱스가 없으면 0
    """

    status: str

    index_loaded: bool

    chunk_count: int
