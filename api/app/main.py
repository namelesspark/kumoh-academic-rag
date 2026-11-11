"""FastAPI 앱 진입점.

- `/api/v1` 라우터를 등록한다.
- 요청 검증 오류(RequestValidationError)는 422 대신 400으로 바꾸고,
  pydantic 오류 상세나 내부 예외 문자열을 노출하지 않는 고정 문구만 담는다.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.v1 import router as api_v1_router

VALIDATION_ERROR_MESSAGE = "요청 형식이 올바르지 않습니다."


def create_app() -> FastAPI:
    application = FastAPI(title="kumoh-rag API", version="0.1.0")
    application.include_router(api_v1_router)

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request, _exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content={"detail": VALIDATION_ERROR_MESSAGE},
        )

    return application


app = create_app()
