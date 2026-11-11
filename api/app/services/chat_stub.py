"""
/chat 고정 응답 서비스 (스텁).

아직 검색·LLM 이 없으므로 응답 모양만 고정한다.
프런트는 이 모양을 보고 병렬로 개발한다.

규칙
- 미리 정한 가상 질문 한 문장과 정확히 같을 때만 "답변 성공" 모양을 돌려준다.
- 그 외 모든 질문은 "답변 불가" 모양을 돌려준다.
- 어느 쪽이든 모든 필드를 채운다.
"""

import uuid

from app.schemas.chat import ChatRequest, ChatResponse, Citation, LatencyMs


# ------------------------------------------------------------
# 고정 값
# ------------------------------------------------------------

# 이 문장과 (앞뒤 공백 제외) 전체 일치할 때만 답변 성공으로 본다.
# 키워드 일부만 들어 있는 질문은 성공이 아니다.
STUB_QUESTION = "테스트용 가상 규정에서 예시 조문은 무엇인가요?"

# 답변 성공 시 돌려줄 가상 인용 1건.
# 실제 규정이 아니다. 도메인도 예약된 가상 도메인(example.invalid)을 쓴다.
STUB_CITATION = Citation(
    article_path="제1조(가상 예시) ①",
    document="테스트용 가상 규정",
    effective_date="2000-01-01",
    snippet="이 조문은 응답 계약을 확인하기 위한 가상 문장이다.",
    source_url="https://example.invalid/fake-rule",
)

# 답변 성공 시 답변 문구.
STUB_ANSWER = "테스트용 가상 규정 제1조(가상 예시) ①에 따르면, 이 조문은 응답 계약 확인용 가상 문장입니다."

# 답변 불가 시 안내 문구. 전화번호는 넣지 않는다 (연락처 설정 분리는 후속 범위).
NO_ANSWER_TEXT = "해당 내용은 보유한 규정 문서에서 확인할 수 없습니다. 학사지원팀에 문의해 주세요."

# 스텁은 실제 작업을 하지 않으므로 지연 시간은 모두 0.
ZERO_LATENCY = LatencyMs(retrieval=0, generation=0, total=0)


# ------------------------------------------------------------
# 공개 함수
# ------------------------------------------------------------


def build_chat_response(request: ChatRequest) -> ChatResponse:
    """
    요청을 받아 고정 응답을 만든다.

    use_academic_data 가 true 여도 학적 조회는 하지 않는다.
    그래서 personalized 는 항상 false 다.
    """

    # 1) 세션 ID: 받은 값은 표기 그대로 돌려주고, 없으면 새로 발급한다.
    session_id = request.session_id

    if session_id is None:
        session_id = str(uuid.uuid4())

    # 2) 가상 질문과 전체 일치하는지 확인한다. 앞뒤 공백만 무시한다.
    is_stub_question = request.message.strip() == STUB_QUESTION

    # 3) 일치하면 인용 1건 + answered=true, 아니면 빈 인용 + answered=false.
    if is_stub_question:
        answer = STUB_ANSWER
        citations = [STUB_CITATION]
        answered = True

    else:
        answer = NO_ANSWER_TEXT
        citations = []
        answered = False

    # 4) 어느 경우든 모든 필드를 채워 돌려준다.
    return ChatResponse(
        session_id=session_id,
        answer=answer,
        citations=citations,
        answered=answered,
        personalized=False,
        latency_ms=ZERO_LATENCY,
    )
