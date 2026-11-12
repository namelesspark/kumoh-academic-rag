"""배포 앱을 시작할 때 가상 규정의 검색 목록(색인)을 만든다."""

import sys
from pathlib import Path

from fastapi import FastAPI

from api.demo_regulation import DOCUMENT_TITLE, EFFECTIVE_DATE, SOURCE


API_DIR = Path(__file__).resolve().parent
# 기존 앱과 검색 모듈을 저장소 루트에서 불러올 수 있게 한다.
sys.path[:0] = [str(API_DIR), str(API_DIR.parent / "core" / "src")]

from app.main import create_app
from app.services.chat_retrieval import ChatRetrieval
from kumoh_rag_core.chunking import chunk_articles
from kumoh_rag_core.retrieval import BM25Retriever


MAX_CHARS = 20


def create_demo_app(source: str) -> FastAPI:
    chunks = chunk_articles(source, max_chars=MAX_CHARS)
    if not chunks:
        raise ValueError("가상 규정에서 검색할 조각을 찾지 못했습니다.")

    retriever = BM25Retriever(chunks)
    chat_retrieval = ChatRetrieval(
        search=retriever.retrieve,
        source=source,
        document_title=DOCUMENT_TITLE,
        effective_date=EFFECTIVE_DATE,
        source_url=None,
    )
    return create_app(chat_retrieval=chat_retrieval, chunk_count=len(chunks))


app = create_demo_app(SOURCE)
