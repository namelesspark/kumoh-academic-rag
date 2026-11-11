"""
POST /chat 라우터.

라우터는 요청을 받아 서비스에 넘기고 결과를 돌려주는 일만 한다.
응답 내용을 만드는 로직은 services/chat_stub.py 에 있다.
"""

from fastapi import APIRouter

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_stub import build_chat_response


router = APIRouter()


# async def 로 둔다.
# 동기 함수로 두면 FastAPI 가 스레드풀로 보내서, 이벤트 루프 없이 직접 호출하는 테스트가 깨진다.
@router.post("/chat", response_model=ChatResponse)
async def post_chat(request: ChatRequest) -> ChatResponse:
    """
    질문을 받아 답변을 돌려준다.

    요청 본문 검증은 ChatRequest 가 맡고,
    검증 실패는 main.py 의 핸들러가 400 으로 바꾼다.
    """

    return build_chat_response(request)
