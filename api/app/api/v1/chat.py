"""POST /api/v1/chat — 질문을 받아 답을 돌려주는 주소. 지금은 응답 모양만 약속대로 맞춘 임시 구현(스텁)이다.

POST는 "데이터를 보내니 처리해 달라"는 뜻의 웹 요청 종류다. 여기서 약속(계약)은 요청과
응답에 어떤 필드가 어떤 형식으로 들어가는지 미리 정한 것을 가리킨다.

이 파일의 라우터(주소와 처리 함수를 이어 주는 부품)는 요청을 서비스에 넘기고 결과를
그대로 돌려준다. 어떤 질문에 어떤 답을 줄지는 `app.services.chat_stub`이 정한다.
나중에 검색이나 대형 언어 모델(LLM, Large Language Model)이 붙어도 이 파일은 거의
바뀌지 않는다.
"""

from fastapi import APIRouter

from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.error import ErrorResponse
from app.services.chat_stub import build_stub_chat_result


router = APIRouter()


@router.post(
    "/chat",
    response_model=ChatResponse,
    # 자동 생성 설명서(OpenAPI 문서)에 400 응답이 있다고 알리는 선언.
    # 실제로 400을 만드는 일은 main.py의 예외 처리 함수(핸들러)가 한다.
    responses={400: {"model": ErrorResponse, "description": "요청 형식 오류. 고정 문구 하나만 반환한다."}},
)
async def post_chat(request: ChatRequest) -> dict:
    """질문을 받아 고정 응답을 돌려준다.

    요청 본문이 ChatRequest 검증을 통과하지 못하면 여기 들어오지 않고
    main.py의 핸들러가 400을 돌려준다.

    서비스가 돌려준 dict는 `response_model=ChatResponse` 덕분에 FastAPI가
    응답 형식 정의(스키마)에 맞춰 검사한다. 검사를 통과한 값은 FastAPI가 중괄호와
    따옴표로 값을 적는 텍스트 형식(JSON, JavaScript Object Notation)으로 바꿔 내보낸다.
    필드가 빠지면 서버 쪽 오류가 난다.
    """

    return build_stub_chat_result(
        message=request.message,
        session_id=request.session_id,
        use_academic_data=request.use_academic_data,
    )
