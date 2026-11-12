"""규정 원문 한 건을 검색하고 인용하는 앱을 만든다."""

import sys
from datetime import date
from pathlib import Path

from fastapi import FastAPI


API_DIR = Path(__file__).resolve().parent
# 기존 앱과 검색 모듈을 저장소 루트에서 불러올 수 있게 한다.
sys.path[:0] = [str(API_DIR), str(API_DIR.parent / "core" / "src")]

from app.main import create_app
from app.services.chat_retrieval import ChatRetrieval
from kumoh_rag_core.chunking import chunk_articles
from kumoh_rag_core.retrieval import BM25Retriever


def create_regulation_app(
    source: str,
    *,
    document_title: str,
    effective_date: date,
    source_url: str | None,
    max_chars: int = 1000,
) -> FastAPI:
    chunks = chunk_articles(source, max_chars=max_chars)
    if not chunks:
        raise ValueError("검색할 조각을 찾지 못했습니다.")

    retriever = BM25Retriever(chunks)
    chat_retrieval = ChatRetrieval(
        search=retriever.retrieve,
        source=source,
        document_title=document_title,
        effective_date=effective_date,
        source_url=source_url,
    )
    return create_app(chat_retrieval=chat_retrieval, chunk_count=len(chunks))
