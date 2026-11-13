"""웹 서버가 맨 처음 불러오는 앱 본체. 주소별 처리 함수를 등록하고 오류 응답의 모양을 정한다.

웹 앱 객체는 FastAPI 라이브러리가 만든다. 이 모듈이 하는 일은 세 가지다.

1. `/api/v1` 아래 라우터(health, chat)를 앱에 등록한다. 라우터는 요청 주소를 보고
   어느 함수가 처리할지 정하는 부품이다.
2. 요청이 잘못됐을 때 나가는 400 응답을 고정 문구 하나로 통일한다.
   - 필드 누락, 타입 불일치, 값 검사 함수(validator) 실패는 RequestValidationError로 온다.
     FastAPI 기본값은 422인데 명세 문서(API_SPEC.md)가 400으로 정했으니 바꾼다.
   - 본문을 값으로 읽는 단계(JSON 파싱) 전에 깨지는 경우가 있다. 예를 들어 본문 글자가
     표준 저장 방식(UTF-8, Unicode Transformation Format, 8-bit)이 아닐 때다. 이때 FastAPI가
     HTTPException(400, "There was an error parsing the body")을 던진다.
     JSON은 중괄호와 따옴표로 값을 적는 텍스트 형식이다 (JavaScript Object Notation).
     이 문구도 그대로 내보내지 않고 같은 고정 문구로 바꾼다.
   두 경우 모두 값 검사 라이브러리(pydantic)의 상세 메시지나 내부 예외 문자열은 밖으로 내지 않는다.
3. 채팅과 시연 로그인 주소의 자동 생성 설명서(OpenAPI 문서)에서 422를 뺀다. OpenAPI는 서버가 받는
   주소와 형식을 기계가 읽을 수 있게 적는 표준이다. 위 처리 때문에 두 주소는 422를 내지 않는다.

실행 방법(수동 기동, 선택):
    uvicorn app.main:app --app-dir api --reload
"""

from hashlib import sha256
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.exceptions import HTTPException

from app.api.v1 import router as api_v1_router
from app.services.chat_retrieval import ChatRetrieval


# 400 응답에 담는 유일한 문구. 테스트도 이 상수를 import해서 비교한다.
VALIDATION_ERROR_MESSAGE = "요청 형식이 올바르지 않습니다."
CHAT_WEB_DIR = Path(__file__).with_name("chat_web")
CHAT_WEB_MEDIA_TYPES = {
    "chat.css": "text/css", "chat.js": "text/javascript",
    "kumoh-signature.png": "image/png", "techmo-basic.png": "image/png",
    "techmo-quiet.png": "image/png", "techmo-guide.png": "image/png",
    "techmo-celebrate.png": "image/png",
    "techmo-sprite.png": "image/png",
    # 로그인 화면의 붓글씨 제목 그림. 글꼴 파일은 이 목록에 넣지 않는다.
    "calligraphy-title.png": "image/png",
    # 캠퍼스 사진 네 장. 배포 준비 때만 받으므로 파일이 없으면 404로 답한다.
    "campus-aerial.jpg": "image/jpeg", "campus-hill.jpg": "image/jpeg",
    "campus-gate.jpg": "image/jpeg", "campus-field.jpg": "image/jpeg",
}
# 요청 형식 오류를 400으로만 내는 주소들. 자동 설명서에서 422를 지운다.
# 사진 주소들은 실제로 422를 내므로 여기에 넣지 않는다.
PATHS_WITHOUT_422 = ("/api/v1/chat", "/api/v1/demo-login")


def fingerprint_chat_assets(html: str, css: bytes, script: bytes) -> str:
    """화면의 두 파일 주소에 내용 지문을 붙임."""
    for name, content in (("chat.css", css), ("chat.js", script)):
        address = f"/chat-assets/{name}"
        if html.count(address) != 1:
            raise ValueError(f"{name} 주소는 정확히 한 번 있어야 함")
        html = html.replace(address, f"{address}?v={sha256(content).hexdigest()}")
    return html


def create_app(
    chat_retrieval: ChatRetrieval | None = None, *, chunk_count: int = 0
) -> FastAPI:
    """앱 객체를 만들어 돌려준다."""

    chat_html = fingerprint_chat_assets(
        (CHAT_WEB_DIR / "index.html").read_text(encoding="utf-8"),
        (CHAT_WEB_DIR / "assets/chat.css").read_bytes(),
        (CHAT_WEB_DIR / "assets/chat.js").read_bytes(),
    )
    application = FastAPI(title="kumoh-rag API", version="0.1.0")
    application.state.chat_retrieval = chat_retrieval
    application.state.chunk_count = chunk_count

    # /api/v1 접두사는 라우터 쪽(app/api/v1/__init__.py)에서 붙인다.
    application.include_router(api_v1_router)

    @application.get("/", include_in_schema=False)
    async def chat_page() -> Response:
        return Response(
            content=chat_html, media_type="text/html",
            headers={
                "Content-Security-Policy": (
                    "default-src 'self'; object-src 'none'; base-uri 'none'; "
                    "frame-ancestors 'none'; form-action 'self'"
                ),
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "no-cache",
            },
        )

    @application.get("/chat-assets/{name}", include_in_schema=False)
    async def chat_asset(name: str) -> FileResponse:
        media_type = CHAT_WEB_MEDIA_TYPES.get(name)
        if media_type is None:
            raise HTTPException(status_code=404, headers={"Cache-Control": "no-cache"})
        path = CHAT_WEB_DIR / "assets" / name
        if not path.is_file():
            raise HTTPException(status_code=404, headers={"Cache-Control": "no-cache"})
        return FileResponse(path, media_type=media_type, headers={"Cache-Control": "no-cache"})

    # --- 400 통일 ------------------------------------------------------------

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(_request: Request, _exc: RequestValidationError) -> JSONResponse:
        """요청 틀(스키마) 검증 실패 → 400 고정 문구. 어떤 필드가 왜 틀렸는지는 버린다."""

        return JSONResponse(status_code=400, content={"detail": VALIDATION_ERROR_MESSAGE})

    @application.exception_handler(HTTPException)
    async def handle_http_error(request: Request, exc: HTTPException) -> Response:
        """HTTPException 중 400만 고정 문구로 바꾸고, 나머지(404·405 등)는 그대로 둔다.

        HTTPException은 웹 통신 규약(HTTP, HyperText Transfer Protocol)의 상태 코드를
        담은 오류 예외다. Starlette(FastAPI가 바탕으로 쓰는 웹 라이브러리)의
        HTTPException으로 잡는 이유: FastAPI의 HTTPException은 이것의 자식이라 둘 다
        여기로 온다. 라우터가 내는 405도 이 경로를 지나므로 400이 아닐 때는 손대지 않는다.
        """

        if exc.status_code != 400:
            return await http_exception_handler(request, exc)
        return JSONResponse(status_code=400, content={"detail": VALIDATION_ERROR_MESSAGE}, headers=exc.headers)

    # --- OpenAPI에서 422 제거 ------------------------------------------------

    default_openapi = application.openapi

    def openapi_without_422() -> dict:
        """채팅과 시연 로그인 설명서에서 이 앱이 내지 않는 422를 지운다."""
        schema = default_openapi()
        for path in PATHS_WITHOUT_422:
            schema["paths"][path]["post"]["responses"].pop("422", None)
        return schema

    application.openapi = openapi_without_422

    return application


# `from app.main import app`으로 가져가는 모듈 수준 앱 객체.
app = create_app()
