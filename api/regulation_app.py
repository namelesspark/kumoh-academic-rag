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
from app.services.chat_relevance import cleaned_search, keep_supported
from app.services.chat_retrieval import ChatRetrieval, RegulationDocument, SearchChunk
from kumoh_rag_core.chunking import ArticleChunk, chunk_articles
from kumoh_rag_core.retrieval import BM25Retriever


@dataclass(frozen=True)
class _DocumentChunk(ArticleChunk):
    document: RegulationDocument


@dataclass(frozen=True)
class RegulationsRetrieval:
    """여러 문서 검색기와 검색 목록의 조각 수. 앱과 평가 도구가 함께 쓴다."""

    chat_retrieval: ChatRetrieval
    chunk_count: int


def _owning_document(chunk: SearchChunk) -> RegulationDocument:
    assert isinstance(chunk, _DocumentChunk)
    return chunk.document


def _searches(retriever: BM25Retriever) -> dict:
    # 검색기에는 서술 어미를 덜어 낸 질의를 넘기고, 근거 판정은 원래 질문으로 한다.
    search = cleaned_search(retriever.retrieve)
    # 글자 몇 개만 겹친 후보는 답으로 쓰지 않는다.
    return {"search": keep_supported(search), "raw_search": search}


def build_regulations_retrieval(
    documents: Sequence[RegulationDocument], *, max_chars: int = 1000
) -> RegulationsRetrieval:
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

    chat_retrieval = ChatRetrieval(
        **_searches(BM25Retriever(indexed_chunks)),
        document_for_chunk=_owning_document,
        **documents[0],
    )
    return RegulationsRetrieval(chat_retrieval, len(indexed_chunks))


def create_regulations_app(
    documents: Sequence[RegulationDocument], *, max_chars: int = 1000
) -> FastAPI:
    built = build_regulations_retrieval(documents, max_chars=max_chars)
    return create_app(chat_retrieval=built.chat_retrieval, chunk_count=built.chunk_count)


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

    chat_retrieval = ChatRetrieval(
        **_searches(BM25Retriever(chunks)),
        source=source,
        document_title=document_title,
        effective_date=effective_date,
        source_url=source_url,
    )
    return create_app(chat_retrieval=chat_retrieval, chunk_count=len(chunks))
