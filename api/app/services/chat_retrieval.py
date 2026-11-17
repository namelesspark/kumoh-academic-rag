"""앱에 전달한 검색 함수와 원문으로 채팅 인용을 만든다."""

import uuid
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import date
from typing import Protocol, TypedDict

from app.services.chat_relevance import is_ai_candidate
from app.services.chat_stub import UNANSWERABLE_TEXT, ZERO_LATENCY, refusal_text

# AI에 보낼 후보 수의 상한. 본문 합계 제한(3000자)에 걸리면 낮은 순위부터 더 뺀다.
AI_CANDIDATE_LIMIT = 5


class _SkipSearch:
    """검색을 건너뛰라는 표지. 사용자 글은 문자열이라 이 객체와 같을 수 없다."""

    __slots__ = ()

    def __repr__(self) -> str:
        return "SKIP_SEARCH"


# 외국어 인사·잡담처럼 검색어가 없는 질문에 쓴다. 검색 함수에 질의 대신 넘기면
# `build_result`가 검색기를 부르지 않고 근거 없는 결과(받은 session_id 유지)를 돌려준다.
SKIP_SEARCH = _SkipSearch()


class RegulationDocument(TypedDict):
    source: str
    document_title: str
    effective_date: date
    source_url: str | None


class SearchChunk(Protocol):
    @property
    def text(self) -> str: ...

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

    raw_search: Callable[[str], Sequence[SearchHit]] | None = field(default=None, kw_only=True)

    def build_result(self, message: str, session_id: str | None, *, relaxed: bool = False, lang: str = "ko") -> dict:
        """엄격한 검사는 첫 조각을 인용하고 AI 후보는 순위와 본문 길이로 제한한다."""

        if message is SKIP_SEARCH:
            hits = []  # 검색기를 부르지 않고, 받은 대화 번호만 담은 근거 없는 결과를 만든다.
        elif relaxed:
            search = self.raw_search or self.search
            hits = [hit for hit in search(message) if is_ai_candidate(message, hit.chunk)][:AI_CANDIDATE_LIMIT]
        else:
            hits = self.search(message)[:1]
        answer = refusal_text(lang)
        citations = []
        for hit in hits:
            chunk = hit.chunk
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
            snippet = document["source"][chunk.start:chunk.end]
            if not citations:
                answer = snippet
            citations.append({
                "article_path": chunk.article_path,
                "document": document["document_title"],
                "effective_date": document["effective_date"],
                "snippet": snippet,
                "source_url": document["source_url"],
            })

        while relaxed and len(citations) > 1 and sum(len(c["snippet"]) for c in citations) > 3000:
            citations.pop()

        return {
            "session_id": session_id or str(uuid.uuid4()),
            "answer": answer,
            "citations": citations,
            "answered": bool(citations),
            "personalized": False,
            "latency_ms": ZERO_LATENCY,
        }
