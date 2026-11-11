"""/chat 주소에 들어온 질문에 정해진 답만 돌려주는 임시 구현(스텁).

스텁은 벽에 콘센트를 먼저 박아 두는 것과 같다. 꽂을 가전제품은 아직 없지만 규격을
정해 두면 나중에 무엇을 사 와도 꽂힌다. 여기서는 검색, 대형 언어 모델(LLM, Large
Language Model), 학적 연동이 붙기 전까지 응답 모양의 약속(계약)을 확인하는 데 쓴다.

규칙:
- 지정한 가상 질문 하나(`FICTIONAL_QUESTION`)와 전체가 일치할 때만
  가상 인용 1건과 `answered=True`를 돌려준다. 앞뒤 공백은 무시한다.
- 그 외 질문은 `citations=[]`, `answered=False`, 안내 문구를 돌려준다.
- `use_academic_data`가 무엇이든 학적 호출은 없고 `personalized`는 항상 False다.
- 모든 데이터는 허구다. 실제 규정 원문, 웹 주소(URL, Uniform Resource Locator),
  전화번호를 쓰지 않는다.

반환값은 응답 본문과 같은 모양의 dict다. 응답 본문은 중괄호와 따옴표로 값을 적는
텍스트 형식(JSON, JavaScript Object Notation)이다. 라우터(주소와 처리 함수를 이어 주는
코드)가 이 dict를 그대로 돌려준다. 그러면 FastAPI가 `ChatResponse`에 정한 틀(스키마)에
맞는지 검사한다. 검사를 통과하면 FastAPI가 dict를 JSON 문자열로 바꾼다(직렬화).
"""

import uuid
from datetime import date


# ---------------------------------------------------------------------------
# 고정 데이터 (전부 가상)
# ---------------------------------------------------------------------------

# 성공 응답을 돌려주는 유일한 질문. 테스트도 이 상수를 import해서 쓴다.
FICTIONAL_QUESTION = "가상 우주정거장의 달 기지 정리는 누가 언제 해?"

# 성공 응답에 실리는 인용 1건. example.invalid는 실제 사이트에 연결되지 않도록
# 예약해 둔 인터넷 주소 이름(도메인)이다.
FICTIONAL_CITATION = {
    "article_path": "제1조(달 기지 정리) ①",
    "document": "가상 우주정거장 운영규정",
    "effective_date": date(2099, 1, 1),
    "snippet": "달 기지 정리는 가상 담당자가 가상 주기마다 수행한다.",
    "source_url": "https://example.invalid/regulations/space-station#article-1",
}

# 성공 시 답변 문장.
ANSWERED_TEXT = (
    "가상 우주정거장 운영규정 제1조(달 기지 정리) ①에 따르면 "
    "달 기지 정리는 가상 담당자가 가상 주기마다 수행합니다."
)

# 답변 불가 시 안내 문장. 전화번호는 설정 분리 단계로 미뤄 넣지 않았다.
UNANSWERABLE_TEXT = (
    "해당 내용은 보유한 규정 문서에서 확인할 수 없습니다. 담당 부서에 문의해 주세요."
)

# 스텁은 지연을 측정하지 않으므로 전부 0.
ZERO_LATENCY = {"retrieval": 0, "generation": 0, "total": 0}


# ---------------------------------------------------------------------------
# 진입점
# ---------------------------------------------------------------------------


def build_stub_chat_result(
    *,
    message: str,
    session_id: str | None,
    use_academic_data: bool,
) -> dict:
    """질문 하나에 대한 고정 응답 dict를 만든다."""

    # 학적 연동 전이므로 참/거짓 표시값(플래그)은 받기만 하고 아무 호출도 하지 않는다.
    del use_academic_data

    # 대화 묶음 식별값(세션 ID): 받았으면 그대로, 없으면 새로 발급. 형식 검증은 스키마가 이미 했다.
    resolved_session = session_id or str(uuid.uuid4())

    # 지정 질문과 전체가 일치할 때만 성공.
    # `in`으로 부분 포함을 보면 "달 기지 정리는 빼고 …" 같은 문장도 성공으로
    # 처리되어 "지정 질문 하나만 성공" 계약을 어긴다.
    if message.strip() == FICTIONAL_QUESTION:
        return {
            "session_id": resolved_session,
            "answer": ANSWERED_TEXT,
            "citations": [FICTIONAL_CITATION],
            "answered": True,
            "personalized": False,
            "latency_ms": ZERO_LATENCY,
        }

    # 답변 불가. 인용이 없으면 answered도 False여야 한다(명세 규칙).
    return {
        "session_id": resolved_session,
        "answer": UNANSWERABLE_TEXT,
        "citations": [],
        "answered": False,
        "personalized": False,
        "latency_ms": ZERO_LATENCY,
    }
