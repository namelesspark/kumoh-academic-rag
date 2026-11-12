"""캠퍼스 가이드 주소(GET /api/v1/campus-guide)가 출처를 지키며 답하는지 확인하는 테스트.

GET은 "읽기만 하겠다"는 뜻의 웹 요청 종류다. 테스트는 서버를 띄우지 않고 앱을 파이썬
함수처럼 바로 부른다(tests/asgi_harness.py). 실제 장소 목록 대신 가상 장소를 끼워 넣어
네 가지를 본다.

- 출처(제목·링크·확인일)가 응답에 그대로 남는다.
- 출처가 빠진 항목은 응답으로 나가지 않고 오류가 된다.
- 비워 둔 선택값(시간·대상·비용·찾아가는 길)을 서버가 채우지 않는다.
- 데이터를 보내는 요청 종류(POST)는 거부한다(405).

실행(저장소 루트, api/requirements.txt를 설치한 Python 3.12 환경):
    python -B -m unittest api/tests/test_campus_guide.py -v

모든 장소와 주소는 명백히 가상이다. example.invalid는 실제 사이트에 연결되지 않도록
예약해 둔 인터넷 주소 이름(도메인)이다.
"""

import pathlib
import sys
import unittest
from datetime import date

# import 경로를 잡는다. 저장소 루트에서 실행해도 아래 import들이 되게 한다.
#   api/        -> `from app.main import app`
#   api/tests/  -> `from asgi_harness import call_app`
TESTS_DIR = pathlib.Path(__file__).resolve().parent
sys.path[:0] = [str(TESTS_DIR.parent), str(TESTS_DIR)]

from pydantic import ValidationError

from asgi_harness import call_app
from app.main import app
from app.schemas.campus_guide import CampusPlace, GuideSource
from app.services.campus_guide import CAMPUS_PLACES, get_campus_places


CAMPUS_GUIDE = "/api/v1/campus-guide"

# 응답의 장소 하나가 항상 갖는 필드.
PLACE_FIELDS = {
    "id",
    "name",
    "category",
    "purpose",
    "location",
    "map_number",
    "hours",
    "audience",
    "cost",
    "directions",
    "valid_period",
    "sources",
}

# 확인하지 못하면 비워 두는 필드.
OPTIONAL_FIELDS = ("map_number", "hours", "audience", "cost", "directions", "valid_period")

FICTIONAL_SOURCE = {
    "title": "가상 달 기지 캠퍼스 안내",
    "url": "https://example.invalid/moon-base/campus-map?building=7&mode=view",
    "checked_on": "2099-01-01",
}

# 필수 항목만 채운 가상 건물. 선택값은 일부러 하나도 주지 않는다.
FICTIONAL_BUILDING = {
    "id": "fictional-crater-hall",
    "name": "가상 분화구관",
    "category": "building",
    "purpose": "가상 우주 항법 강의동",
    "location": "가상 달 기지 북쪽 구역",
    "sources": [FICTIONAL_SOURCE],
}

# 선택값을 모두 채운 가상 편의시설. 출처가 둘이다.
FICTIONAL_FACILITY = {
    "id": "fictional-oxygen-desk",
    "name": "가상 산소 충전소",
    "category": "facility",
    "purpose": "가상 산소통 충전",
    "location": "가상 분화구관 1층",
    "map_number": "7",
    "hours": "가상 평일 09:00~18:00",
    "audience": "가상 기지 재학생",
    "cost": "가상 무료",
    "directions": "가상 정문에서 북쪽으로 직진",
    "valid_period": "2099-03-01 ~ 2099-06-30",
    "sources": [
        FICTIONAL_SOURCE,
        {
            "title": "가상 산소 충전소 공지",
            "url": "https://example.invalid/moon-base/notice/42",
            "checked_on": "2099-02-15",
        },
    ],
}


def _with_nulls(place: dict) -> dict:
    """응답에서 기대하는 모양으로 바꾼다. 주지 않은 선택값은 `None`(JSON의 null)이다."""

    return {**dict.fromkeys(OPTIONAL_FIELDS), **place}


class CampusGuideTestCase(unittest.TestCase):
    """장소 목록을 가상 장소로 바꿔 끼우는 공통 준비."""

    def use_places(self, places: list) -> None:
        """공급 함수 자리에 `places`를 돌려주는 함수를 끼우고, 테스트가 끝나면 되돌린다.

        `app.dependency_overrides`는 FastAPI가 테스트용으로 열어 둔 바꿔 끼우기 자리다.
        """

        async def provide_fictional_places() -> list:
            return places

        app.dependency_overrides[get_campus_places] = provide_fictional_places
        self.addCleanup(app.dependency_overrides.pop, get_campus_places, None)


# ---------------------------------------------------------------------------
# 출처 보존
# ---------------------------------------------------------------------------


class CampusGuideSourceTest(CampusGuideTestCase):
    def test_sources_survive_unchanged_in_response(self):
        """제목·링크·확인일이 한 글자도 바뀌지 않고 응답에 남는다. 장소 순서도 그대로다."""

        self.use_places([FICTIONAL_BUILDING, FICTIONAL_FACILITY])

        resp = call_app(app, "GET", CAMPUS_GUIDE)

        self.assertEqual(resp.status, 200)
        self.assertTrue(resp.headers.get("content-type", "").startswith("application/json"))

        body = resp.json()
        self.assertEqual(set(body), {"places"})
        self.assertEqual(
            body["places"],
            [_with_nulls(FICTIONAL_BUILDING), _with_nulls(FICTIONAL_FACILITY)],
        )

        # 주소 뒤 조건(`?building=7&mode=view`)까지 그대로인지 따로 한 번 더 본다.
        self.assertEqual(body["places"][0]["sources"][0]["url"], FICTIONAL_SOURCE["url"])
        self.assertEqual(len(body["places"][1]["sources"]), 2)

    def test_model_instances_from_provider_are_served(self):
        """공급 함수가 실제 목록처럼 `CampusPlace` 객체를 건네도 같은 응답이 나온다."""

        self.use_places([CampusPlace(**FICTIONAL_BUILDING)])

        resp = call_app(app, "GET", CAMPUS_GUIDE)

        self.assertEqual(resp.status, 200)
        self.assertEqual(resp.json(), {"places": [_with_nulls(FICTIONAL_BUILDING)]})

    def test_empty_list_is_served_as_empty_places(self):
        """장소가 없으면 빈 목록을 돌려준다. 없는 장소를 지어내지 않는다."""

        self.use_places([])

        resp = call_app(app, "GET", CAMPUS_GUIDE)

        self.assertEqual(resp.status, 200)
        self.assertEqual(resp.json(), {"places": []})


# ---------------------------------------------------------------------------
# 출처 누락·형식 위반 거부
# ---------------------------------------------------------------------------


class CampusGuideRejectionTest(CampusGuideTestCase):
    def test_place_without_sources_is_not_served(self):
        """출처가 빈 항목이 섞이면 응답을 만들지 못하고 오류가 난다.

        앱은 오류를 테스트 도구 밖으로 그대로 올린다. 실제 서버에서는 500 응답이 된다.
        """

        for sources in ([], None):
            with self.subTest(sources=sources):
                self.use_places([FICTIONAL_FACILITY, {**FICTIONAL_BUILDING, "sources": sources}])

                with self.assertRaises(ValidationError):
                    call_app(app, "GET", CAMPUS_GUIDE)

    def test_place_model_requires_at_least_one_source(self):
        """틀(모델) 단계에서도 같은 규칙이 걸린다. 그래서 실제 목록은 불러오는 시점에 실패한다."""

        without_key = {k: v for k, v in FICTIONAL_BUILDING.items() if k != "sources"}

        for place in (without_key, {**FICTIONAL_BUILDING, "sources": []}):
            with self.subTest(place=place):
                with self.assertRaises(ValidationError):
                    CampusPlace(**place)

    def test_source_requires_title_https_url_and_date(self):
        """출처는 제목·https 주소·확인일을 모두 갖춰야 한다."""

        bad_sources = (
            {**FICTIONAL_SOURCE, "title": "  "},
            {**FICTIONAL_SOURCE, "url": "http://example.invalid/plain"},
            {**FICTIONAL_SOURCE, "url": "example.invalid/no-scheme"},
            {**FICTIONAL_SOURCE, "url": "https://example.invalid/has space"},
            {**FICTIONAL_SOURCE, "checked_on": "어제"},
            {k: v for k, v in FICTIONAL_SOURCE.items() if k != "checked_on"},
        )

        for source in bad_sources:
            with self.subTest(source=source):
                with self.assertRaises(ValidationError):
                    GuideSource(**source)

    def test_unknown_fields_are_rejected(self):
        """정해 두지 않은 필드는 받지 않는다. 이미지 주소 같은 값이 슬쩍 들어오지 못한다."""

        with self.assertRaises(ValidationError):
            CampusPlace(**FICTIONAL_BUILDING, photo_url="https://example.invalid/photo.png")

        with self.assertRaises(ValidationError):
            GuideSource(**FICTIONAL_SOURCE, license="가상 조건")

        self.use_places([{**FICTIONAL_BUILDING, "photo_url": "https://example.invalid/photo.png"}])

        with self.assertRaises(ValidationError):
            call_app(app, "GET", CAMPUS_GUIDE)


# ---------------------------------------------------------------------------
# 선택값 미추정
# ---------------------------------------------------------------------------


class CampusGuideOptionalValueTest(CampusGuideTestCase):
    def test_unverified_optional_values_stay_null(self):
        """주지 않은 선택값은 응답에 `null`로 남는다. 필드가 사라지지도, 채워지지도 않는다."""

        self.use_places([FICTIONAL_BUILDING])

        place = call_app(app, "GET", CAMPUS_GUIDE).json()["places"][0]

        self.assertEqual(set(place), PLACE_FIELDS)

        for name in OPTIONAL_FIELDS:
            with self.subTest(field=name):
                self.assertIsNone(place[name])

    def test_blank_optional_value_is_rejected(self):
        """빈 문자열로 "채운 척"할 수 없다. 모르면 `null`이어야 한다."""

        for name in OPTIONAL_FIELDS:
            with self.subTest(field=name):
                with self.assertRaises(ValidationError):
                    CampusPlace(**{**FICTIONAL_BUILDING, name: "   "})


# ---------------------------------------------------------------------------
# 요청 종류와 실제 목록의 형식
# ---------------------------------------------------------------------------


class CampusGuideEndpointTest(CampusGuideTestCase):
    def test_campus_guide_rejects_post(self):
        """GET만 열어 두었으니 POST는 "허용되지 않는 방식" 코드 405를 받아야 한다."""

        self.use_places([FICTIONAL_BUILDING])

        resp = call_app(app, "POST", CAMPUS_GUIDE, json_body={"name": "가상 장소"})

        self.assertEqual(resp.status, 405)

    def test_shipped_list_is_served_and_points_to_official_site(self):
        """바꿔 끼우지 않은 실제 목록도 대기 없이 나가고, 형식 규칙을 지킨다.

        장소의 사실이 맞는지는 여기서 보지 않는다. 그것은 리뷰어가 공식 페이지와 대조한다.
        여기서는 형식만 본다: 고정 이름(id)이 겹치지 않고, 출처가 모두 학교 공식 사이트다.
        """

        resp = call_app(app, "GET", CAMPUS_GUIDE)

        self.assertEqual(resp.status, 200)

        places = resp.json()["places"]
        self.assertEqual(len(places), len(CAMPUS_PLACES))

        ids = [place["id"] for place in places]
        self.assertEqual(len(ids), len(set(ids)))

        for place in places:
            with self.subTest(place=place["id"]):
                self.assertEqual(set(place), PLACE_FIELDS)
                self.assertTrue(place["sources"])

                for source in place["sources"]:
                    self.assertTrue(source["url"].startswith("https://www.kumoh.ac.kr/"))


# `python api/tests/test_campus_guide.py`로 직접 실행할 때의 진입점.
if __name__ == "__main__":
    unittest.main()
