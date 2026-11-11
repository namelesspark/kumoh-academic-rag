"""POST /chat 주소로 오가는 요청과 응답이 어떤 필드를 갖는지 정한 틀(모델).

명세 문서(API_SPEC.md)에 있는 예시는 중괄호와 따옴표로 값을 적는 텍스트 형식(JSON,
JavaScript Object Notation)이다. 이 파일은 그 예시를 값 검사 라이브러리(pydantic) v2
모델로 옮긴 것이다. 필드 이름과 타입은 명세와 1:1로 맞춘다. 명세에 글로만 적힌 규칙은
값 검사 함수(validator)로 강제한다. 규칙은 두 가지다. 공백만 있는 메시지는 거부한다.
대화 한 묶음을 가리키는 식별값(세션 ID)은 세계 어디서나 겹치지 않게 만든 128비트
식별자 형식(UUID, Universally Unique Identifier)이어야 한다.
"""

from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# 요청
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    """요청을 보내는 쪽(클라이언트)이 담아 보내는 본문."""

    message: str = Field(
        ...,
        description="사용자 질문. 공백만으로는 받지 않는다.",
    )

    session_id: str | None = Field(
        default=None,
        description="대화 세션 ID(UUID 문자열). 없으면 서버가 발급한다.",
    )

    use_academic_data: bool = Field(
        default=False,
        strict=True,
        description="학적 연동 동의 여부. 요청마다 받는다.",
    )

    @field_validator("message")
    @classmethod
    def _message_not_blank(cls, value: str) -> str:
        """빈 문자열이나 공백·개행만 있는 문자열을 거부한다.

        타입은 str로 이미 맞았으므로 여기서는 내용만 본다. 실패하면 pydantic이
        RequestValidationError를 올리고, main.py의 예외 처리 함수(핸들러)가 그것을
        400 응답으로 바꾼다.
        """

        if not value.strip():
            raise ValueError("message must not be blank")

        return value

    @field_validator("session_id")
    @classmethod
    def _session_id_is_uuid(cls, value: str | None) -> str | None:
        """UUID 형식인지 검사만 하고, 문자열은 받은 그대로 돌려준다.

        타입을 `uuid.UUID`로 두지 않은 이유: 그렇게 두면 pydantic이 값을 소문자·하이픈
        표기로 통일해 버린다(정규화). 그러면 클라이언트가 보낸 표기(예: 대문자)가 응답에서
        바뀐다. 명세의 약속(계약)은 "제공하면 그대로 반환"이므로 str로 받고 검증만 한다.
        """

        if value is None:
            return None

        try:
            uuid.UUID(value)
        except (ValueError, AttributeError, TypeError) as exc:
            raise ValueError("session_id must be a UUID string") from exc

        return value


# ---------------------------------------------------------------------------
# 응답
# ---------------------------------------------------------------------------


class Citation(BaseModel):
    """답변 근거 하나. 명세의 citations 배열 원소."""

    # 조·항·목 경로. 규정 원문을 조문 단위로 쪼개 읽는 코드(core의 파서)가 만드는
    # article_path 형식과 같다. 예: "제30조(전과) ①"
    article_path: str

    # 규정 문서 이름. 예: "학사운영규정"
    document: str

    # 시행일. JSON에서는 "YYYY-MM-DD" 문자열로 나간다.
    effective_date: date

    # 인용한 원문 일부.
    snippet: str

    # 원문 링크. 아직 공개 웹 주소(URL, Uniform Resource Locator)가 없는 문서도 있어 null을 허용한다.
    source_url: str | None = None


class LatencyMs(BaseModel):
    """단계별로 걸린 시간을 1000분의 1초 단위(ms, 밀리초)로 적는다.

    평가 지표 수집용이다. 지금의 임시 구현(스텁)에서는 전부 0이다.
    """

    retrieval: int = 0
    generation: int = 0
    total: int = 0


class ChatResponse(BaseModel):
    """서버가 돌려주는 본문.

    성공이든 답변 불가든 여섯 필드를 항상 모두 포함한다. 기본값을 두지 않아
    주소와 처리 함수를 이어 주는 코드(라우터)가 하나라도 빼먹으면 서버 쪽에서 바로
    오류가 난다.
    """

    session_id: str
    answer: str
    citations: list[Citation]
    answered: bool
    personalized: bool
    latency_ms: LatencyMs
