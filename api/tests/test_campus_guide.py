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
from urllib.parse import urlsplit

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

# 기본 목록에 반드시 있어야 하는 장소: 고정 이름(id) -> (분류, 이슈에서 부른 이름).
# 공식 표기가 이슈의 이름과 다를 수 있어 `name`은 비교하지 않고 고정 이름으로 찾는다.
REQUIRED_PLACES = {
    "global-hall": ("building", "글로벌관"),
    "techno-hall": ("building", "테크노관"),
    "digital-hall": ("building", "디지털관"),
    "industry-academic-hall": ("building", "산학협력관"),
    "main-hall": ("building", "본관"),
    "student-union": ("building", "학생회관"),
    # 학생식당은 독립 건물이 아니라 학생회관 지하에 있어 시설로 분류한다.
    "student-cafeteria": ("facility", "학생식당"),
    "medical-support-room": ("facility", "의료지원실"),
    "print-copy": ("facility", "인쇄·복사"),
}

# 이슈가 가이드에서 먼저 다루기로 한 일곱 장소의 이름.
SEVEN_GUIDE_PLACE_NAMES = (
    "글로벌관",
    "테크노관",
    "디지털관",
    "산학협력관",
    "본관",
    "학생회관",
    "학생식당",
)

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
        여기서는 형식만 본다: 목록이 비어 있지 않고, 고정 이름(id)이 겹치지 않고, 출처가
        모두 학교 공식 사이트다.
        """

        self.assertTrue(CAMPUS_PLACES, "기본 장소 목록이 비어 있습니다")

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
                    # 학교 공식 사이트와 그 아래 사이트(예: 생활협동조합)만 출처로 받는다.
                    host = urlsplit(source["url"]).hostname or ""
                    self.assertTrue(host == "kumoh.ac.kr" or host.endswith(".kumoh.ac.kr"), source["url"])

                # 건물은 공식 지도 번호가 있고, 건물 안 시설은 번호 대신 위치에 건물·호실을 적는다.
                if place["category"] == "building":
                    self.assertRegex(place["map_number"] or "", r"^\d+$")
                else:
                    self.assertIsNone(place["map_number"])

    def test_shipped_list_names_the_seven_guide_places(self):
        """이슈가 먼저 다루기로 한 일곱 장소가 기본 응답에 그 이름으로 하나씩 있어야 한다.

        고정 이름(id)만 맞고 `name`이 다른 장소로 바뀌는 일을 막는다. 공식 표기가
        "본관(대학본부 및 강당)"처럼 괄호 설명을 달고 있으면 괄호 앞까지를 이름으로 본다.
        """

        places = call_app(app, "GET", CAMPUS_GUIDE).json()["places"]
        names = [place["name"].split("(")[0].strip() for place in places]

        for label in SEVEN_GUIDE_PLACE_NAMES:
            with self.subTest(place=label):
                self.assertEqual(names.count(label), 1, f"기본 응답에 {label} 항목이 정확히 하나 있어야 합니다")

        # 고정 이름과 이름이 서로 어긋나지 않는지도 본다.
        by_id = {place["id"]: place["name"].split("(")[0].strip() for place in places}

        for place_id, (_category, label) in REQUIRED_PLACES.items():
            with self.subTest(place_id=place_id):
                self.assertEqual(by_id.get(place_id), label)

    def test_shipped_list_classifies_by_official_map_number(self):
        """분류 기준을 고정한다: 공식 지도에 자기 번호가 있으면 건물, 건물 안에 있으면 시설.

        이슈가 "건물 7곳"으로 부른 장소 가운데 학생식당은 학생회관 지하에 있어 시설이다.
        그래서 기본 목록의 건물은 6곳이고, 일곱 장소는 모두 응답에 있다.
        """

        by_id = {place.id: place for place in CAMPUS_PLACES}

        buildings = {place.id for place in CAMPUS_PLACES if place.category == "building"}
        self.assertEqual(
            buildings,
            {"techno-hall", "digital-hall", "global-hall", "student-union", "main-hall", "industry-academic-hall"},
        )

        cafeteria = by_id["student-cafeteria"]
        self.assertEqual(cafeteria.category, "facility")
        self.assertIn(by_id["student-union"].name, cafeteria.location)

        # 지도 번호는 건물마다 다르다.
        numbers = [by_id[place_id].map_number for place_id in buildings]
        self.assertEqual(len(numbers), len(set(numbers)))

    def test_shipped_list_leaves_unverified_values_empty(self):
        """실제 목록에서 대조하지 못한 시간·대상·비용·찾아가는 길은 비어 있어야 한다.

        이 값을 공식 페이지와 대조해 채우는 변경은 이 테스트도 함께 고쳐야 한다. 그래서
        누가 언제 무엇을 확인했는지 리뷰에 드러난다.
        """

        for place in CAMPUS_PLACES:
            with self.subTest(place=place.id):
                self.assertIsNone(place.hours)
                self.assertIsNone(place.audience)
                self.assertIsNone(place.cost)
                self.assertIsNone(place.directions)

    def test_shipped_list_contains_required_places(self):
        """기본 응답에 이슈가 정한 장소 아홉 곳(건물 6, 건물 안 시설 3)이 모두 있어야 한다.

        목록이 비어 있거나 한 곳이라도 빠지면 실패한다. 빈 목록이 "형식은 맞다"는 이유로
        통과하는 일을 막는다. 사실이 맞는지는 여전히 리뷰어가 공식 페이지와 대조한다.
        """

        places = {place["id"]: place for place in call_app(app, "GET", CAMPUS_GUIDE).json()["places"]}

        for place_id, (category, label) in REQUIRED_PLACES.items():
            with self.subTest(place=label):
                self.assertIn(place_id, places, f"기본 목록에 {label} 항목이 없습니다")

                place = places[place_id]
                self.assertEqual(place["category"], category)
                self.assertTrue(place["sources"])


# `python api/tests/test_campus_guide.py`로 직접 실행할 때의 진입점.
if __name__ == "__main__":
    unittest.main()
