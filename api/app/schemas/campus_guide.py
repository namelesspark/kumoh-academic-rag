"""GET /campus-guide 응답에 어떤 필드가 들어가는지 정한 틀(모델).

안내 데스크의 안내판과 같다. 장소마다 이름·용도·위치를 적고, 그 내용을 어느 공식
페이지에서 확인했는지를 반드시 함께 적는다. 출처가 없는 안내판은 걸지 않는다.

규칙은 세 가지다.

1. 출처는 하나 이상이어야 한다. 값 검사 라이브러리(pydantic)가 빈 목록을 거부한다.
2. 시간·대상·비용·찾아가는 길처럼 확인하지 못할 수 있는 값은 선택 항목이다. 확인하지
   못하면 비워 둔다(`null`). 빈 문자열로 "채운 척"하는 것도 거부한다.
3. 정해 두지 않은 필드는 받지 않는다(`extra="forbid"`). 오타 난 필드 이름이 조용히
   사라지는 일을 막는다.
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _reject_blank(value: str | None) -> str | None:
    """공백만 있는 문자열을 거부한다. `None`은 "확인하지 못함"이라는 뜻이므로 통과시킨다."""

    if value is not None and not value.strip():
        raise ValueError("must not be blank; use null when unverified")

    return value


class GuideSource(BaseModel):
    """안내 내용을 확인한 공식 페이지 하나."""

    model_config = ConfigDict(extra="forbid")

    # 그 페이지를 가리키는 짧은 이름. 예: "캠퍼스 맵"
    title: str

    # 공식 페이지 주소(URL, Uniform Resource Locator). 암호화 연결(https) 주소만 받는다.
    url: str

    # 사람이 이 페이지 본문과 안내 내용을 대조한 날짜. 응답에서는 "YYYY-MM-DD" 문자열로 나간다.
    checked_on: date

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, value: str) -> str:
        return _reject_blank(value)

    @field_validator("url")
    @classmethod
    def _url_is_https(cls, value: str) -> str:
        """주소는 받은 그대로 돌려주고 형식만 본다.

        타입을 pydantic의 주소 전용 타입으로 두면 표기가 바뀔 수 있다(예: 끝에 `/` 추가).
        출처 주소는 한 글자도 바뀌면 안 되므로 str로 받고 검사만 한다.
        """

        if not value.startswith("https://") or any(ch.isspace() for ch in value):
            raise ValueError("url must be an https address without whitespace")

        return value


class CampusPlace(BaseModel):
    """캠퍼스 장소 하나. 건물이거나, 건물 안의 학생 편의시설·서비스다."""

    model_config = ConfigDict(extra="forbid")

    # 코드와 화면이 장소를 가리킬 때 쓰는 고정 이름. 예: "global-hall"
    id: str = Field(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")

    # 공식 자료에 적힌 이름.
    name: str

    # 건물인지 편의시설인지.
    category: Literal["building", "facility"]

    # 무엇을 하는 곳인지.
    purpose: str

    # 어디에 있는지. 층·호실은 공식 자료에 나올 때만 적는다.
    location: str

    # 공식 캠퍼스 지도에 붙은 건물 번호. 지도에 번호가 없으면 비워 둔다.
    map_number: str | None = None

    # --- 선택 항목: 공식 자료에서 확인하지 못하면 비워 둔다 --------------------

    # 운영 시간.
    hours: str | None = None

    # 이용 대상.
    audience: str | None = None

    # 이용 비용.
    cost: str | None = None

    # 찾아가는 길.
    directions: str | None = None

    # 기간이 정해진 공지에서 온 정보일 때 그 적용 기간.
    valid_period: str | None = None

    # 이 장소의 내용을 확인한 공식 페이지. 하나 이상 있어야 한다.
    sources: list[GuideSource] = Field(min_length=1)

    @field_validator("name", "purpose", "location")
    @classmethod
    def _required_text_not_blank(cls, value: str) -> str:
        return _reject_blank(value)

    @field_validator("map_number", "hours", "audience", "cost", "directions", "valid_period")
    @classmethod
    def _optional_text_not_blank(cls, value: str | None) -> str | None:
        return _reject_blank(value)


class CampusGuideResponse(BaseModel):
    """서버가 돌려주는 본문. 장소 목록 전체를 담는다."""

    model_config = ConfigDict(extra="forbid")

    places: list[CampusPlace]
