"""
v1 라우터 묶음.

health, chat 라우터를 하나로 모아 main.py 에서 /api/v1 접두사로 붙인다.
"""

from fastapi import APIRouter

from app.api.v1.chat import router as chat_router
from app.api.v1.health import router as health_router


router = APIRouter()

router.include_router(health_router)

router.include_router(chat_router)
