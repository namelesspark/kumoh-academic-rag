"""GET /api/v1/health — 서버가 살아 있는지 묻는 주소. 지금은 정해진 답만 돌려주는 임시 구현(스텁)이다.

GET은 "읽기만 하겠다"는 뜻의 웹 요청 종류다. 스텁은 벽에 콘센트를 먼저 박아 두는 것과
같다. 꽂을 가전제품은 아직 없지만 규격을 정해 두면 나중에 무엇을 사 와도 꽂힌다.

요청·응답 형식을 적은 명세 문서(API_SPEC.md)는 이 응답에 두 값을 넣도록 정했다.
하나는 검색용 색인(인덱스)이 메모리에 올라왔는지(`index_loaded`), 다른 하나는 색인에
들어 있는 문서 조각의 수(`chunk_count`)다. 아직 색인 연동이 없으므로 두 값을 각각
false, 0으로 고정한다. 색인이 붙으면 이 함수만 실제 상태를 읽도록 바꾸면 된다.
"""

from fastapi import APIRouter

from app.schemas.health import HealthResponse


router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    """항상 성공 코드 200과 정해진 본문을 돌려준다.

    본문은 중괄호와 따옴표로 값을 적는 텍스트 형식(JSON, JavaScript Object Notation)이다.

    `async def`로 둔 이유: 테스트에서는 실제 서버 대신 앱을 직접 부르는 도구(하네스,
    tests/asgi_harness.py)를 쓴다. 하네스는 비동기 작업을 순서대로 돌려 주는 실행기(이벤트
    루프)를 쓰지 않는다. 대신 앱의 비동기 함수를 한 번에 끝까지 진행시킨다. 동기 함수로
    두면 FastAPI가 그 함수를 별도 작업 스레드로 보내고, 그 사이에 대기가 생겨 한 번에
    끝나지 않는다.
    """

    return HealthResponse(status="ok", index_loaded=False, chunk_count=0)
