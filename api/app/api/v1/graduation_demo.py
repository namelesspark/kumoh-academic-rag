"""가상 학생 목록과 고른 학생의 졸업 체크 결과를 읽는 경로."""

from fastapi import APIRouter, Depends

from app.schemas.graduation_demo import DemoStudentsResponse, GraduationDemoResponse
from app.services.graduation_rules import get_demo_students, get_graduation_demo


router = APIRouter()


@router.get("/demo-students", response_model=DemoStudentsResponse)
async def read_demo_students() -> DemoStudentsResponse:
    return await get_demo_students()


@router.get("/graduation-demo", response_model=GraduationDemoResponse)
async def read_graduation_demo(
    result: GraduationDemoResponse = Depends(get_graduation_demo),
) -> GraduationDemoResponse:
    return result
