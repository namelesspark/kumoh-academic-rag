"""POST /api/v1/chat — 응답 계약 스텁.

라우터는 요청 스키마를 서비스에 넘기고 결과를 응답 스키마로 바꾸는 일만 한다.
고정 응답의 내용은 `app.services.chat_stub`이 결정한다.
"""

from fastapi import APIRouter

from app.schemas.chat import ChatRequest, ChatResponse, Citation, LatencyMs
from app.services.chat_stub import build_stub_chat_result

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def post_chat(request: ChatRequest) -> ChatResponse:
    result = build_stub_chat_result(
        message=request.message,
        session_id=request.session_id,
        use_academic_data=request.use_academic_data,
    )
    return ChatResponse(
        session_id=result.session_id,
        answer=result.answer,
        citations=[
            Citation(
                article_path=c.article_path,
                document=c.document,
                effective_date=c.effective_date,
                snippet=c.snippet,
                source_url=c.source_url,
            )
            for c in result.citations
        ],
        answered=result.answered,
        personalized=result.personalized,
        latency_ms=LatencyMs(
            retrieval=result.latency_ms.retrieval,
            generation=result.latency_ms.generation,
            total=result.latency_ms.total,
        ),
    )
