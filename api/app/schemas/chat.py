"""
POST /api/v1/chat 요청·응답 스키마.

API_SPEC.md 의 필드 이름과 1:1 로 맞춘다.
여기서 검증에 실패하면 FastAPI 가 RequestValidationError 를 올리고,
main.py 의 핸들러가 400 + 고정 문구로 바꿔 준다.
"""

import uuid

from pydantic import BaseModel, field_validator


# ------------------------------------------------------------
# 요청
# ------------------------------------------------------------


class ChatRequest(BaseModel):
    """
    사용자 질문 요청.

    - session_id        : 대화 세션 ID 문자열. 없으면 서버가 발급한다.
    - message           : 사용자 질문. 공백만 있으면 거절한다.
    - use_academic_data : 학적 연동 동의 여부. 기본 false.
    """

    # 문자열로 받는다. UUID 타입으로 받으면 표기(대소문자 등)가 바뀌어 버리기 때문.
    session_id: str | None = None

    message: str

    use_academic_data: bool = False

    # --- 검증 규칙 ---
    # 검증기에서 ValueError 를 올리면 pydantic 이 검증 실패로 바꾸고,
    # FastAPI 가 RequestValidationError 로 감싸 main.py 핸들러로 보낸다.

    @field_validator("session_id")
    @classmethod
    def check_session_id_format(cls, value: str | None) -> str | None:
        """
        session_id 가 UUID 형식인지만 확인한다.

        형식 검사만 하고 값은 그대로 돌려준다.
        그래야 응답에서 입력 표기를 바꾸지 않고 되돌려 줄 수 있다.
        """

        # 안 보낸 경우는 통과. 서비스가 새로 발급한다.
        if value is None:
            return None

        # 형식이 틀리면 uuid.UUID 가 ValueError 를 낸다.
        # pydantic 은 ValueError 를 검증 실패로 처리한다.
        uuid.UUID(value)

        return value

    @field_validator("message")
    @classmethod
    def reject_blank_message(cls, value: str) -> str:
        """
        공백만 있는 질문은 거절한다.

        원문은 자르지 않고 그대로 둔다. 비교가 필요하면 서비스에서 strip 한다.
        """

        if value.strip() == "":
            raise ValueError("message 가 비어 있음")

        return value


# ------------------------------------------------------------
# 응답
# ------------------------------------------------------------


class Citation(BaseModel):
    """
    답변의 근거가 된 조문 1건.

    - article_path   : "제30조(전과) ①" 같은 조문 경로
    - document       : 규정 문서 이름
    - effective_date : 시행일 (YYYY-MM-DD 문자열)
    - snippet        : 근거 원문 일부
    - source_url     : 원문 링크. 없으면 null
    """

    article_path: str

    document: str

    effective_date: str

    snippet: str

    source_url: str | None = None


class LatencyMs(BaseModel):
    """
    단계별 지연 시간(밀리초). 평가 지표 수집용.
    """

    retrieval: int

    generation: int

    total: int


class ChatResponse(BaseModel):
    """
    답변 응답.

    답변 가능 여부와 관계없이 모든 필드를 항상 채운다.
    프런트가 분기 없이 같은 모양으로 받을 수 있게 하기 위함.
    """

    session_id: str

    answer: str

    # 비어 있으면 answered 는 반드시 false 여야 한다.
    citations: list[Citation]

    answered: bool

    # 학적 데이터를 실제로 썼는지. 스텁은 항상 false.
    personalized: bool

    latency_ms: LatencyMs
