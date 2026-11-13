"""POST /api/v1/demo-login. 시연 계정이 맞으면 가상 학생 한 명을 돌려준다."""

from fastapi import APIRouter, HTTPException, Response

from app.schemas.demo_login import DemoLoginRequest, DemoLoginResponse
from app.schemas.error import ErrorResponse
from app.services.demo_login import LOGIN_FAILED_MESSAGE, match_demo_account
from app.services.graduation_rules import get_demo_students


router = APIRouter()
# 로그인 응답을 브라우저나 중간 서버가 보관하지 않게 한다.
NO_STORE = {"Cache-Control": "no-store"}


@router.post(
    "/demo-login",
    response_model=DemoLoginResponse,
    # 400을 실제로 만드는 일은 main.py의 예외 처리 함수(핸들러)가 한다.
    responses={
        400: {"model": ErrorResponse, "description": "요청 형식 오류. 고정 문구 하나만 반환한다."},
        401: {"model": ErrorResponse, "description": "시연 계정과 맞지 않음. 고정 문구 하나만 반환한다."},
    },
)
async def post_demo_login(request: DemoLoginRequest, response: Response) -> DemoLoginResponse:
    """학번·비밀번호를 본문으로만 받는다. 쿠키를 만들지 않고 받은 값을 되돌려 적지 않는다."""

    student_id = match_demo_account(request.student_number, request.password)
    students = (await get_demo_students()).students
    student = next((student for student in students if student.id == student_id), None)
    if student is None:
        # 학번이 틀렸는지 비밀번호가 틀렸는지 구분해 알려 주지 않는다.
        raise HTTPException(status_code=401, detail=LOGIN_FAILED_MESSAGE, headers=NO_STORE)
    response.headers["Cache-Control"] = NO_STORE["Cache-Control"]
    return DemoLoginResponse(student=student)
