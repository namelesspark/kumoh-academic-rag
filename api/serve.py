"""배포 앱을 시작할 때 설정한 규정 목록이나 가상 데모를 검색에 연결한다.

AI 답변 설정(`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`)도 여기서만 읽는다. 셋 중 하나라도
없거나 비어 있으면 AI를 켜지 않고 지금의 조문 인용 답을 그대로 낸다.

앱용 출처 허용 설정(`CORS_ALLOW_ORIGINS`)도 여기서 읽는다. 없거나 비면 기본 출처를 쓰고,
모양이 틀린 출처가 있으면 시작을 멈춘다.
"""

import os
from collections.abc import Mapping

from fastapi import FastAPI

from api.demo_regulation import DOCUMENT_TITLE, EFFECTIVE_DATE, SOURCE
from api.local_serve import MANIFEST_ENV, create_local_manifest_app
from api.regulation_app import chunk_articles as chunk_articles, create_regulation_app

# api.regulation_app이 `app` 패키지를 불러올 경로를 잡은 뒤에 불러온다.
from app.main import cors_origins_from_environ, install_cors
from app.services.ai_chat import AiChat, settings_from_environ


MAX_CHARS = 20


def create_demo_app(source: str) -> FastAPI:
    return create_regulation_app(
        source,
        document_title=DOCUMENT_TITLE,
        effective_date=EFFECTIVE_DATE,
        source_url=None,
        max_chars=MAX_CHARS,
    )


def create_app(environ: Mapping[str, str]) -> FastAPI:
    # 출처 모양을 먼저 검사해, 틀린 설정이면 규정을 읽기 전에 멈춘다.
    origins = cors_origins_from_environ(environ)
    if MANIFEST_ENV in environ:
        application = create_local_manifest_app(environ)
    else:
        application = create_demo_app(SOURCE)
    settings = settings_from_environ(environ)
    application.state.ai_chat = AiChat(settings) if settings is not None else None
    install_cors(application, origins)
    return application


app = create_app(os.environ)
