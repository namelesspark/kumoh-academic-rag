"""
FastAPI 진입점.

실행 예 (api/ 폴더에서):
    uvicorn app.main:app --reload

core 패키지는 import 하지 않는다. 지금 단계는 응답 계약 스텁이다.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.v1 import router as v1_router


# ------------------------------------------------------------
# 고정 문구
# ------------------------------------------------------------

# 400 응답 본문에 들어가는 문구. 어떤 검증 오류든 이 한 문장만 보여 준다.
# pydantic 의 상세 오류나 예외 문자열은 노출하지 않는다 (API_SPEC "에러" 절).
BAD_REQUEST_DETAIL = "요청 형식이 올바르지 않습니다."


# ------------------------------------------------------------
# 앱 생성
# ------------------------------------------------------------

app = FastAPI(title="kumoh-rag-api")

# /api/v1/health, /api/v1/chat
app.include_router(v1_router, prefix="/api/v1")


# ------------------------------------------------------------
# 검증 오류 → 400 변환 (한 곳에서만)
# ------------------------------------------------------------


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """
    요청 검증 실패를 400 + 고정 문구로 바꾼다.

    다음 경우가 전부 여기로 들어온다.
    - 필드 누락 / 타입 불일치 (pydantic 검증 실패)
    - 스키마의 field_validator 가 ValueError 를 낸 경우
    - JSON 문법 오류 (FastAPI 가 json_invalid 로 올려 줌)
    - 객체가 아닌 JSON (배열, 문자열 등)
    """

    # request, exc 는 내용을 쓰지 않는다. 내부 정보를 노출하지 않기 위함.
    return JSONResponse(
        status_code=400,
        content={"detail": BAD_REQUEST_DETAIL},
    )
