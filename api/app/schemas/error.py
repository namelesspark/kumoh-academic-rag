"""오류가 났을 때 돌려주는 응답의 틀(모델).

서버가 자동으로 만드는 설명서(OpenAPI 문서)에 400 응답이 어떤 모양인지 보여 주는 용도다.
OpenAPI는 서버가 받는 주소와 주고받는 형식을 기계가 읽을 수 있게 적는 표준이다.
"""

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    """요청 쪽 잘못을 뜻하는 400번대(4xx) 응답의 본문. 고정 문구 하나만 담는다."""

    detail: str
