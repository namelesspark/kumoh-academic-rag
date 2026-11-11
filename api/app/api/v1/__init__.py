"""`/api/v1` 라우터. 각 엔드포인트 모듈을 하나의 APIRouter로 묶는다."""

from fastapi import APIRouter

from app.api.v1 import chat, health

router = APIRouter(prefix="/api/v1")
router.include_router(health.router, tags=["health"])
router.include_router(chat.router, tags=["chat"])

__all__ = ["router"]
