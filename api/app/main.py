"""웹 서버가 맨 처음 불러오는 앱 본체. 주소별 처리 함수를 등록하고 오류 응답의 모양을 정한다.

웹 앱 객체는 FastAPI 라이브러리가 만든다. 이 모듈이 하는 일은 세 가지다.

1. `/api/v1` 아래 라우터(health, chat, chat/stream 등)를 앱에 등록한다. 라우터는 요청 주소를 보고
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

앱용 출처 허용(CORS)은 `install_cors`로 따로 단다. 배포 진입점(api/serve.py)이 환경 변수를
읽어 앱을 만든 뒤 부르고, 모듈 수준 `app`에는 달지 않는다.

실행 방법(수동 기동, 선택):
    uvicorn app.main:app --app-dir api --reload
"""

import json
import re
from collections.abc import Mapping
from hashlib import sha256
from html import escape
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.exceptions import HTTPException
from starlette.middleware.cors import CORSMiddleware

from app.api.v1 import router as api_v1_router
from app.services.chat_retrieval import ChatRetrieval


# 400 응답에 담는 유일한 문구. 테스트도 이 상수를 import해서 비교한다.
VALIDATION_ERROR_MESSAGE = "요청 형식이 올바르지 않습니다."
CHAT_WEB_DIR = Path(__file__).with_name("chat_web")
CHAT_WEB_MEDIA_TYPES = {
    "chat.css": "text/css", "chat.js": "text/javascript",
    "quick-actions.css": "text/css", "quick-actions.js": "text/javascript",
    "kumoh-signature.png": "image/png",
    # 남색 띠 위에 판 없이 올리는 밝은 로고. 같은 공식 로고로 배포 준비 때 만든다.
    "kumoh-signature-light.png": "image/png",
    # 테크모 동작 시트. 저장소의 `art/` 원본을 배포 준비 때 검사해 `assets/`에 복사한 것만 내준다.
    "techmo-sprite.png": "image/png",
    # 로그인 화면의 제목 글자 그림. 글꼴 파일은 이 목록에 넣지 않는다.
    "title-lettering.png": "image/png",
    # 메인 화면의 제목 글씨 그림. 같은 글꼴로 배포 준비 때 그린다.
    "main-lettering.png": "image/png",
    # 영어 화면의 제목 글자 그림. 배포 준비 때 그리며, 없으면 화면이 같은 글귀를 글자로 보인다.
    # 중국어 그림은 글꼴 지문을 고정한 뒤 다음 이슈에서 더한다. 그때까지 중국어 화면은 글자 제목이다.
    "title-lettering-en.png": "image/png", "main-lettering-en.png": "image/png",
    # 캠퍼스 사진 네 장. 배포 준비 때만 받으므로 파일이 없으면 404로 답한다.
    "campus-aerial.jpg": "image/jpeg", "campus-hill.jpg": "image/jpeg",
    "campus-gate.jpg": "image/jpeg", "campus-field.jpg": "image/jpeg",
}
# 요청 형식 오류를 400으로만 내는 주소들. 자동 설명서에서 422를 지운다.
# 사진 주소들은 실제로 422를 내므로 여기에 넣지 않는다.
PATHS_WITHOUT_422 = ("/api/v1/chat", "/api/v1/chat/stream", "/api/v1/demo-login")
# 주소에 내용 지문을 붙이는 그림. 배포 준비 때 생기므로 없을 수 있다.
FINGERPRINTED_IMAGES = (
    "main-lettering.png", "kumoh-signature-light.png",
    # 영어 제목 그림은 `index.html`의 data-lettering-en 속성에 주소가 있다. 다시 그리면 지문이 바뀐다.
    "title-lettering-en.png", "main-lettering-en.png",
)
# 테크모 그림 묶음의 칸 배치를 화면에 넘기는 자리. `index.html`에 정확히 한 번 있어야 한다.
# 배치 파일은 서버가 읽어 화면에 넣을 뿐, `/chat-assets/` 주소로 내주지 않는다.
TECHMO_LAYOUT_SLOT = "__TECHMO_LAYOUT__"
TECHMO_LAYOUT_FILE = "techmo_layout.json"


# 다른 주소에서 띄운 앱(kumoh-aio/aio-app)이 이 API를 부르도록 허용할 출처 목록(CORS, 이슈 #125).
# 환경 변수는 배포 진입점(api/serve.py)이 읽어 아래 함수에 건넨다. 이 모듈은 환경 변수를 읽지 않는다.
CORS_ENV = "CORS_ALLOW_ORIGINS"
# 안드로이드 앱 껍데기(Capacitor)의 출처와 로컬 미리보기 주소.
DEFAULT_CORS_ORIGINS = ("https://localhost", "http://127.0.0.1:5173")
CORS_METHODS = ("GET", "POST")
CORS_HEADERS = ("Content-Type",)


def _check_origin(origin: str) -> None:
    """출처 하나가 브라우저가 보내는 `Origin` 헤더 모양과 글자까지 같은지 본다.

    끝 슬래시나 대문자가 붙으면 브라우저 값과 달라 조용히 막히므로 시작할 때 멈춘다.
    오류 문구에는 설정 이름과 이유만 담고 입력값은 넣지 않는다.
    """

    if origin == "*":
        raise ValueError(f"{CORS_ENV}: *는 쓸 수 없고 출처를 하나씩 적어야 합니다.")
    parts = urlsplit(origin)
    if parts.scheme not in ("http", "https"):
        raise ValueError(f"{CORS_ENV}: http:// 또는 https:// 로 시작하는 출처가 아닙니다.")
    if not parts.hostname:
        raise ValueError(f"{CORS_ENV}: 출처에 호스트가 없습니다.")
    if "@" in parts.netloc:
        raise ValueError(f"{CORS_ENV}: 출처에 사용자 정보를 넣을 수 없습니다.")
    try:
        parts.port
    except ValueError:
        raise ValueError(f"{CORS_ENV}: 출처의 포트가 올바르지 않습니다.") from None
    if parts.netloc.endswith(":"):
        raise ValueError(f"{CORS_ENV}: 출처의 포트가 올바르지 않습니다.")
    if origin != f"{parts.scheme}://{parts.netloc}":
        raise ValueError(f"{CORS_ENV}: 출처에 경로·끝 슬래시·질의·조각을 붙일 수 없습니다.")
    if origin != origin.lower():
        raise ValueError(f"{CORS_ENV}: 출처는 소문자로 적어야 합니다.")


def cors_origins_from_environ(environ: Mapping[str, str]) -> tuple[str, ...]:
    """쉼표로 나눈 출처를 공백·빈 칸·중복 없이 돌려준다. 값이 없거나 비면 기본 출처를 쓴다."""

    origins = []
    for piece in (environ.get(CORS_ENV) or "").split(","):
        origin = piece.strip()
        if not origin or origin in origins:
            continue
        _check_origin(origin)
        origins.append(origin)
    return tuple(origins) or DEFAULT_CORS_ORIGINS


def install_cors(application: FastAPI, origins: tuple[str, ...]) -> None:
    """허용 출처에만 응답 헤더를 붙이는 Starlette 부품을 단다. 조각 전송(SSE) 응답에도 붙는다.

    메서드는 GET·POST, 요청 헤더는 Content-Type만 허용하고 자격 증명(쿠키)은 허용하지 않는다.
    """

    for origin in origins:
        _check_origin(origin)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(origins),
        allow_methods=list(CORS_METHODS),
        allow_headers=list(CORS_HEADERS),
        allow_credentials=False,
    )


def parse_techmo_layout(text: str) -> dict:
    """칸 배치 글을 읽어 검사한 값으로 돌려줌. 어긋나면 ValueError로 시작을 멈춤.

    버전 1, 칸 크기와 한 줄의 칸 수는 양의 정수, 동작 이름은 겹치지 않고,
    동작마다 프레임 수는 1 이상이고 한 줄의 칸 수를 넘지 않는다.
    """

    def positive(value) -> bool:
        # JSON의 true도 파이썬에서는 정수 1로 읽히므로 형까지 본다.
        return type(value) is int and value > 0

    layout = json.loads(text)
    if not isinstance(layout, dict) or set(layout) != {"version", "cell", "columns", "motions"}:
        raise ValueError("테크모 칸 배치의 항목이 맞지 않음")
    if type(layout["version"]) is not int or layout["version"] != 1:
        raise ValueError("테크모 칸 배치의 버전이 1이 아님")
    if not positive(layout["cell"]) or not positive(layout["columns"]):
        raise ValueError("테크모 칸 크기와 칸 수는 양의 정수여야 함")
    motions = layout["motions"]
    if not isinstance(motions, list) or not motions:
        raise ValueError("테크모 동작 목록이 비어 있음")
    names = set()
    for motion in motions:
        if not isinstance(motion, dict) or set(motion) != {"name", "frames"}:
            raise ValueError("테크모 동작의 항목이 맞지 않음")
        name, frames = motion["name"], motion["frames"]
        if not isinstance(name, str) or not name or name in names:
            raise ValueError("테크모 동작 이름이 비었거나 겹침")
        if not positive(frames) or frames > layout["columns"]:
            raise ValueError("테크모 프레임 수는 1 이상이고 한 줄의 칸 수 이하여야 함")
        names.add(name)
    return layout


def inject_techmo_layout(html: str, layout_text: str) -> str:
    """검사한 칸 배치를 HTML 속성 값으로 안전하게 바꿔(이스케이프) 화면의 자리에 넣음."""
    parse_techmo_layout(layout_text)
    if html.count(TECHMO_LAYOUT_SLOT) != 1:
        raise ValueError("테크모 칸 배치 자리는 정확히 한 번 있어야 함")
    return html.replace(TECHMO_LAYOUT_SLOT, escape(layout_text.strip(), quote=True))


def fingerprint_chat_assets(html: str, css: bytes, script: bytes) -> str:
    """화면의 두 파일 주소에 내용 지문을 붙임."""
    for name, content in (("chat.css", css), ("chat.js", script)):
        address = f"/chat-assets/{name}"
        if html.count(address) != 1:
            raise ValueError(f"{name} 주소는 정확히 한 번 있어야 함")
        html = html.replace(address, f"{address}?v={sha256(content).hexdigest()}")
    return html


def fingerprint_quick_actions(html: str) -> str:
    """빠른 실행 링 파일이 준비되면 주소에 내용 지문을 붙임."""
    for name in ("quick-actions.css", "quick-actions.js"):
        address = f"/chat-assets/{name}"
        if html.count(address) > 1:
            raise ValueError(f"{name} 주소는 정확히 한 번 있어야 함")
        pattern = re.compile(rf"""(?<![^\s"'=]){re.escape(address)}(?=$|[\s"'>])""")
        if not pattern.search(html):
            continue
        try:
            content = (CHAT_WEB_DIR / "assets" / name).read_bytes()
        except FileNotFoundError:
            continue
        html = pattern.sub(f"{address}?v={sha256(content).hexdigest()}", html)
    return html


def read_prepared_images() -> dict[str, bytes]:
    """지문을 붙일 그림 가운데 준비된 것만 읽음. 없거나 읽지 못한 그림은 뺌."""
    images = {}
    for name in FINGERPRINTED_IMAGES:
        try:
            images[name] = (CHAT_WEB_DIR / "assets" / name).read_bytes()
        except OSError:
            continue
    return images


def fingerprint_prepared_images(html: str, images: dict[str, bytes]) -> str:
    """준비된 그림의 주소에만 내용 지문을 붙임. 준비되지 않은 그림의 주소는 그대로 둠.

    스타일·스크립트와 달리 그림은 없어도 화면이 동작하므로, 주소가 화면에 없어도 앱을 멈추지 않는다.
    따옴표까지 맞춰 바꾸므로 이름이 이어지는 다른 주소는 건드리지 않는다.
    """
    for name, content in images.items():
        address = f"/chat-assets/{name}"
        html = html.replace(f'"{address}"', f'"{address}?v={sha256(content).hexdigest()}"')
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
    chat_html = fingerprint_quick_actions(chat_html)
    chat_html = fingerprint_prepared_images(chat_html, read_prepared_images())
    chat_html = inject_techmo_layout(
        chat_html, (CHAT_WEB_DIR / TECHMO_LAYOUT_FILE).read_text(encoding="utf-8"))
    application = FastAPI(title="kumoh-rag API", version="0.1.0")
    application.state.chat_retrieval = chat_retrieval
    application.state.chunk_count = chunk_count
    # AI 답변은 기본으로 꺼 둔다. 배포 진입점(api/serve.py)이 설정 세 개를 확인한 뒤에만 켠다.
    application.state.ai_chat = None
    application.state.handwriting = None

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
