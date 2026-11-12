"""사진에서 읽은 글자와 학생의 질문을 받는다."""

from datetime import datetime

from fastapi import APIRouter, Request

from app.schemas.error import ErrorResponse
from app.schemas.photo_input import PhotoQuestionRequest, PhotoQuestionResponse
from app.services.biskit_recommendations import KST
from app.services.photo_input import answer_photo_question


router = APIRouter()


@router.post("/photo-question", response_model=PhotoQuestionResponse, responses={400: {"model": ErrorResponse}})
async def post_photo_question(body: PhotoQuestionRequest, request: Request) -> PhotoQuestionResponse:
    return await answer_photo_question(body, request.app.state.chat_retrieval, datetime.now(KST).date())
