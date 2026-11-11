"""GET /api/v1/health — 기동 확인 스텁.

인덱스 연동 전이므로 `index_loaded`는 항상 false, `chunk_count`는 0이다.
"""

from fastapi import APIRouter

from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    return HealthResponse(status="ok", index_loaded=False, chunk_count=0)
