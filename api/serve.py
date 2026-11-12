"""배포 앱을 시작할 때 설정한 규정 목록이나 가상 데모를 검색에 연결한다."""

import os
from collections.abc import Mapping

from fastapi import FastAPI

from api.demo_regulation import DOCUMENT_TITLE, EFFECTIVE_DATE, SOURCE
from api.local_serve import MANIFEST_ENV, create_local_manifest_app
from api.regulation_app import chunk_articles as chunk_articles, create_regulation_app


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
    if MANIFEST_ENV in environ:
        return create_local_manifest_app(environ)
    return create_demo_app(SOURCE)


app = create_app(os.environ)
