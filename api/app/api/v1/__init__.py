"""`/api/v1` 주소로 들어오는 요청을 담당 함수에 연결하는 부품(라우터)을 하나로 묶는다.

요청 주소 하나를 맡아 처리하는 함수를 엔드포인트라 부른다. 엔드포인트 모듈(health.py,
chat.py, campus_guide.py)은 각자 접두사 없는 APIRouter를 만들고, 이 파일이 `/api/v1` 접두사를 붙여
하나로 묶는다. 버전을 올릴 때는 `v2` 패키지를 새로 만들고 main.py에서 함께 등록하면 된다.
"""

from fastapi import APIRouter

from app.api.v1 import campus_guide, chat, health


# 접두사는 여기서만 붙인다. 각 모듈의 경로는 "/health", "/chat"처럼 짧게 둔다.
router = APIRouter(prefix="/api/v1")

# tags는 자동 생성 설명서(OpenAPI 문서)에서 엔드포인트를 묶어 보여 주는 용도다.
# OpenAPI는 서버가 받는 주소와 주고받는 형식을 기계가 읽을 수 있게 적는 표준이다.
router.include_router(health.router, tags=["health"])
router.include_router(chat.router, tags=["chat"])
router.include_router(campus_guide.router, tags=["campus-guide"])


__all__ = ["router"]
