"""/chat 고정 응답 스텁.

검색·LLM·학적 연동이 붙기 전까지 응답 계약을 확인하기 위한 서비스다.
- 명백히 가상인 주제(달 기지 정리) 질문에만 가상 인용 1건과 `answered=True`를 돌려준다.
- 그 외 질문은 `citations=[]`, `answered=False`, 안내 문구를 돌려준다.
- `use_academic_data`가 무엇이든 학적 호출은 없고 `personalized`는 항상 False다.
- 모든 데이터는 허구다. 실제 규정 원문·URL·전화번호를 쓰지 않는다.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date

FICTIONAL_TOPIC_KEYWORD = "달 기지 정리"

FICTIONAL_DOCUMENT = "가상 우주정거장 운영규정"
FICTIONAL_ARTICLE_PATH = "제1조(달 기지 정리) ①"
FICTIONAL_EFFECTIVE_DATE = date(2099, 1, 1)
FICTIONAL_SNIPPET = "달 기지 정리는 가상 담당자가 가상 주기마다 수행한다."
FICTIONAL_SOURCE_URL = "https://example.invalid/regulations/space-station#article-1"

ANSWERED_TEXT = (
    "가상 우주정거장 운영규정 제1조(달 기지 정리) ①에 따르면 "
    "달 기지 정리는 가상 담당자가 가상 주기마다 수행합니다."
)
UNANSWERABLE_TEXT = (
    "해당 내용은 보유한 규정 문서에서 확인할 수 없습니다. 담당 부서에 문의해 주세요."
)


@dataclass(frozen=True)
class StubCitation:
    article_path: str
    document: str
    effective_date: date
    snippet: str
    source_url: str | None


@dataclass(frozen=True)
class StubLatency:
    retrieval: int = 0
    generation: int = 0
    total: int = 0


@dataclass(frozen=True)
class StubChatResult:
    session_id: str
    answer: str
    citations: list[StubCitation]
    answered: bool
    personalized: bool = False
    latency_ms: StubLatency = field(default_factory=StubLatency)


def resolve_session_id(session_id: str | None) -> str:
    """제공된 세션 ID는 그대로, 없으면 새 UUID를 발급한다."""
    if session_id:
        return session_id
    return str(uuid.uuid4())


def build_stub_chat_result(
    *,
    message: str,
    session_id: str | None,
    use_academic_data: bool,
) -> StubChatResult:
    # use_academic_data는 받기만 한다. 학적 연동 전이므로 어떤 호출도 하지 않는다.
    del use_academic_data

    resolved_session = resolve_session_id(session_id)

    if FICTIONAL_TOPIC_KEYWORD in message:
        return StubChatResult(
            session_id=resolved_session,
            answer=ANSWERED_TEXT,
            citations=[
                StubCitation(
                    article_path=FICTIONAL_ARTICLE_PATH,
                    document=FICTIONAL_DOCUMENT,
                    effective_date=FICTIONAL_EFFECTIVE_DATE,
                    snippet=FICTIONAL_SNIPPET,
                    source_url=FICTIONAL_SOURCE_URL,
                )
            ],
            answered=True,
        )

    return StubChatResult(
        session_id=resolved_session,
        answer=UNANSWERABLE_TEXT,
        citations=[],
        answered=False,
    )
