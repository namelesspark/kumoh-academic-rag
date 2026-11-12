"""가상 학생의 졸업 체크 결과를 읽는 경로."""

from fastapi import APIRouter, Depends

from app.schemas.graduation_demo import GraduationDemoResponse
from app.services.graduation_rules import get_graduation_demo


router = APIRouter()


@router.get("/graduation-demo", response_model=GraduationDemoResponse)
async def read_graduation_demo(
    result: GraduationDemoResponse = Depends(get_graduation_demo),
) -> GraduationDemoResponse:
    return result
