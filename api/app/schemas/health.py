"""GET /health 주소의 응답이 어떤 필드를 갖는지 정한 틀(모델).

GET은 "읽기만 하겠다"는 뜻의 웹 요청 종류다.
"""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """서버가 살아 있는지 알려 주는 응답. 명세 문서(API_SPEC.md)의 예시와 필드가 같다."""

    # 서비스 상태 문자열. 지금은 "ok"만 쓴다.
    status: str

    # 검색용 색인(인덱스)이 메모리에 올라왔는지. 연동 전이라 항상 False.
    index_loaded: bool

    # 색인에 들어 있는 문서 조각(청크)의 수. 연동 전이라 항상 0.
    chunk_count: int
