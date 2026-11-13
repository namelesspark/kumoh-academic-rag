"""시연 계정 로그인 주소로 오가는 요청과 응답의 틀(모델)."""

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.graduation_demo import DemoStudent, ResponseModel


# 이 길이를 넘는 값은 계정과 견주지 않고 요청 형식 오류(400)로 돌려보낸다.
MAX_FIELD_LENGTH = 64


class DemoLoginRequest(BaseModel):
    """학번과 비밀번호. 두 문자열만 받고 값을 다듬지 않는다.

    빈 문자열은 형식에는 맞으므로 통과시킨다. 계정과 맞지 않아 401이 된다.
    문자열이 아닌 값, 빠진 필드, 약속에 없는 필드는 여기서 걸려 400이 된다.
    """

    model_config = ConfigDict(extra="forbid", strict=True)

    student_number: str = Field(max_length=MAX_FIELD_LENGTH)
    password: str = Field(max_length=MAX_FIELD_LENGTH)


class DemoLoginResponse(ResponseModel):
    """로그인한 가상 학생 한 명. 학생 목록 주소가 주는 값과 같다."""

    student: DemoStudent
