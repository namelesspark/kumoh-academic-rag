"""규정 원문을 검색하고 인용하는 앱을 만든다."""

import sys
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from fastapi import FastAPI


API_DIR = Path(__file__).resolve().parent
# 기존 앱과 검색 모듈을 저장소 루트에서 불러올 수 있게 한다.
sys.path[:0] = [str(API_DIR), str(API_DIR.parent / "core" / "src")]

from app.main import create_app
from app.services.chat_relevance import keep_supported
from app.services.chat_retrieval import ChatRetrieval, RegulationDocument, SearchChunk
from kumoh_rag_core.chunking import ArticleChunk, chunk_articles
from kumoh_rag_core.retrieval import BM25Retriever


@dataclass(frozen=True)
class _DocumentChunk(ArticleChunk):
    document: RegulationDocument


def _owning_document(chunk: SearchChunk) -> RegulationDocument:
    assert isinstance(chunk, _DocumentChunk)
    return chunk.document


def create_regulations_app(
    documents: Sequence[RegulationDocument], *, max_chars: int = 1000
) -> FastAPI:
    """문서마다 조문을 나누고 검색 목록 하나에 모은다."""
    if not documents:
        raise ValueError("documents: 문서가 없습니다.")

    indexed_chunks = []
    for index, entry in enumerate(documents):
        document = entry.copy()
        chunks = chunk_articles(document["source"], max_chars=max_chars)
        if not chunks:
            raise ValueError(f"documents[{index}]: 검색할 조각을 찾지 못했습니다.")
        indexed_chunks.extend(
            _DocumentChunk(chunk.text, chunk.article_path, chunk.start, chunk.end, document)
            for chunk in chunks
        )

    retriever = BM25Retriever(indexed_chunks)
    chat_retrieval = ChatRetrieval(
        # 글자 몇 개만 겹친 후보는 답으로 쓰지 않는다.
        search=keep_supported(retriever.retrieve),
        document_for_chunk=_owning_document,
        **documents[0],
    )
    return create_app(chat_retrieval=chat_retrieval, chunk_count=len(indexed_chunks))


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
        search=keep_supported(retriever.retrieve),
        source=source,
        document_title=document_title,
        effective_date=effective_date,
        source_url=source_url,
    )
    return create_app(chat_retrieval=chat_retrieval, chunk_count=len(chunks))
