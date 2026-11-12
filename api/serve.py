"""배포 앱을 시작할 때 가상 규정의 검색 목록(색인)을 만든다."""

from fastapi import FastAPI

from api.demo_regulation import DOCUMENT_TITLE, EFFECTIVE_DATE, SOURCE
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


app = create_demo_app(SOURCE)
