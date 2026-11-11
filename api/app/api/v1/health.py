"""
GET /health 라우터.
"""

from fastapi import APIRouter

from app.schemas.health import HealthResponse


router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    """
    서버 기동 확인.

    아직 인덱스를 올리지 않으므로 index_loaded=false, chunk_count=0 으로 고정한다.
    인덱스 미로드 시 503 을 줄지는 후속 범위에서 정한다.
    """

    return HealthResponse(
        status="ok",
        index_loaded=False,
        chunk_count=0,
    )
