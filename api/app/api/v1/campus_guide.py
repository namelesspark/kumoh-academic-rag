"""GET /api/v1/campus-guide — 출처가 붙은 캠퍼스 장소 목록 전체를 돌려주는 주소.

GET은 "읽기만 하겠다"는 뜻의 웹 요청 종류다. 첫 버전은 조건 없이 전체 목록만 돌려준다.

이 파일의 라우터(주소와 처리 함수를 이어 주는 부품)는 목록을 직접 만들지 않는다.
목록은 공급 함수 `get_campus_places`가 건네준다. FastAPI의 `Depends`는 "이 함수를
부르기 전에 저 함수를 먼저 불러 결과를 넣어 달라"는 표시다. 전구 소켓과 같아서,
테스트는 실제 목록 대신 가상 장소를 같은 자리에 끼워 넣을 수 있다.
"""

from fastapi import APIRouter, Depends

from app.schemas.campus_guide import CampusGuideResponse, CampusPlace
from app.services.campus_guide import get_campus_places


router = APIRouter()


@router.get("/campus-guide", response_model=CampusGuideResponse)
async def get_campus_guide(
    places: list[CampusPlace] = Depends(get_campus_places),
) -> CampusGuideResponse:
    """장소 목록을 `{"places": [...]}` 모양으로 돌려준다.

    `CampusGuideResponse`를 여기서 직접 만든다. 공급 함수가 출처 없는 항목이나 정해 두지
    않은 필드를 건네면 이 줄에서 바로 오류가 나고, 잘못된 안내가 응답으로 나가지 않는다.

    `async def`로 둔 이유는 health.py와 같다. 테스트 도구(tests/asgi_harness.py)는 앱이
    요청 처리 중 한 번이라도 대기하면 실패한다. 동기 함수로 두면 FastAPI가 별도 작업
    스레드로 보내면서 대기가 생긴다. 공급 함수도 같은 이유로 `async def`다.
    """

    return CampusGuideResponse(places=places)
