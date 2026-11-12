"""서버가 응답하는지와 검색할 조각이 몇 개 준비됐는지 알려준다."""

from fastapi import APIRouter, Request

from app.schemas.health import HealthResponse


router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def get_health(request: Request) -> HealthResponse:
    chunk_count = request.app.state.chunk_count
    return HealthResponse(status="ok", index_loaded=chunk_count > 0, chunk_count=chunk_count)
