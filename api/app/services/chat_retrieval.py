"""앱에 전달한 검색 함수와 원문으로 채팅 인용을 만든다."""

import uuid
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import date
from typing import Protocol, TypedDict

from app.services.chat_stub import UNANSWERABLE_TEXT, ZERO_LATENCY


class RegulationDocument(TypedDict):
    source: str
    document_title: str
    effective_date: date
    source_url: str | None


class SearchChunk(Protocol):
    @property
    def article_path(self) -> str: ...

    @property
    def start(self) -> int: ...

    @property
    def end(self) -> int: ...


class SearchHit(Protocol):
    @property
    def chunk(self) -> SearchChunk: ...


@dataclass(frozen=True)
class ChatRetrieval:
    """검색 함수와 인용에 쓸 원문, 출처 정보를 보관한다."""

    search: Callable[[str], Sequence[SearchHit]]
    source: str
    document_title: str
    effective_date: date
    source_url: str | None
    document_for_chunk: Callable[[SearchChunk], RegulationDocument] | None = field(
        default=None, kw_only=True
    )

    def build_result(self, message: str, session_id: str | None) -> dict:
        """관련도 순으로 받은 결과 중 첫 조각을 인용한다."""

        hits = self.search(message)
        answer = UNANSWERABLE_TEXT
        citations = []
        if hits:
            chunk = hits[0].chunk
            document = (
                self.document_for_chunk(chunk)
                if self.document_for_chunk is not None
                else RegulationDocument(
                    source=self.source,
                    document_title=self.document_title,
                    effective_date=self.effective_date,
                    source_url=self.source_url,
                )
            )
            answer = document["source"][chunk.start:chunk.end]
            citations.append({
                "article_path": chunk.article_path,
                "document": document["document_title"],
                "effective_date": document["effective_date"],
                "snippet": answer,
                "source_url": document["source_url"],
            })

        return {
            "session_id": session_id or str(uuid.uuid4()),
            "answer": answer,
            "citations": citations,
            "answered": bool(citations),
            "personalized": False,
            "latency_ms": ZERO_LATENCY,
        }
