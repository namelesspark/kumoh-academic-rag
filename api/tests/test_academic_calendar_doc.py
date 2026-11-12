"""명세 문서와 출처 문서에 적은 2027학년도 1학기 수강신청 일정이 합의한 표와 같은지 확인한다.

조회 주소를 만드는 쪽과 문서를 쓰는 쪽은 같은 표(이슈 #49)를 보고 따로 일한다. 문서의
날짜가 한 글자라도 어긋나면 화면을 만드는 사람이 틀린 날짜를 믿게 된다. 이 테스트는
합의한 표를 아래 `EXPECTED_EVENTS`에 옮겨 두고, 문서에서 읽은 값과 글자 그대로 견준다.

앱 코드를 불러오지 않고 문서 두 개만 읽는다. 표준 라이브러리만 쓰므로 조회 주소가 아직
없는 브랜치에서도 돈다. 링크는 열지 않고 글자의 모양만 본다.

실행(저장소 루트):
    python -B -m unittest api.tests.test_academic_calendar_doc -v
"""

import json
import re
import unittest
from datetime import date
from pathlib import Path

DOCS = Path(__file__).resolve().parents[1] / "docs"
SPEC_DOC = DOCS / "API_SPEC.md"
SOURCES_DOC = DOCS / "OFFICIAL_SOURCES.md"

SECTION_HEADING = "## GET /academic-calendar/{year}/{term}"
SOURCE_TITLE = "학사일정"
SOURCE_URL = "https://www.kumoh.ac.kr/ko/schedule_reg.do"
CHECKED_ON = "2026-11-13"

# 이슈 #49의 공식 일정 표. (대상, 시작일, 종료일) 순서다.
AGREED_TABLE = (
    ("1·4학년", "2027-02-11", "2027-02-12"),
    ("2·3학년", "2027-02-15", "2027-02-16"),
    ("신입생·편입생", "2027-02-17", "2027-02-17"),
    ("전체 학년 (타학부·타학년 수강신청)", "2027-02-18", "2027-02-18"),
)
EXPECTED_EVENTS = [
    {
        "audience": audience,
        "starts_on": starts_on,
        "ends_on": ends_on,
        "sources": [{"title": SOURCE_TITLE, "url": SOURCE_URL, "checked_on": CHECKED_ON}],
    }
    for audience, starts_on, ends_on in AGREED_TABLE
]

# 일정이 없어 빈 목록을 돌려주는 학기와, 400을 돌려주는 잘못된 주소의 예.
EMPTY_TERMS = ("2027/2", "2026/1")
BAD_PATHS = ("abcd/1", "20270/1", "2027/0", "2027/3")
BAD_REQUEST_TEXT = "요청 형식이 올바르지 않습니다."

SOURCE_COLUMNS = ("문서명", "발행·적용 학년도", "입학연도별 판정 범위", "주소", "확인일", "응답 확인", "내용 확인")

_JSON_BLOCK = re.compile(r"^```json\n(.*?)\n```$", re.MULTILINE | re.DOTALL)


def read_text(path: Path) -> str:
    # 윈도우에서 내려받으면 줄 끝이 CRLF일 수 있어 LF로 맞춘다.
    return path.read_bytes().decode("utf-8").replace("\r\n", "\n")


def calendar_section(spec: str) -> str:
    """명세에서 학사 일정 구역만 잘라 낸다. 다음 구분선(`---`) 앞에서 끝난다."""

    if spec.count(SECTION_HEADING + "\n") != 1:
        raise AssertionError(f"명세에 '{SECTION_HEADING}' 구역이 한 번만 있어야 합니다.")
    body = spec.split(SECTION_HEADING + "\n", 1)[1]
    return body.split("\n---\n", 1)[0]


def source_rows(text: str) -> list[dict[str, str]]:
    """출처 문서의 표를 읽어 줄마다 `{머리글: 칸}`으로 돌려준다."""

    lines = [line for line in text.splitlines() if line.startswith("|")]
    if len(lines) < 3:
        raise AssertionError("머리글·구분선·내용이 있는 표를 찾지 못했습니다.")
    header, _separator, *body = [
        [cell.strip() for cell in line.strip().strip("|").split("|")] for line in lines
    ]
    if tuple(header) != SOURCE_COLUMNS:
        raise AssertionError(f"출처 표의 머리글이 다릅니다: {header}")
    for row in body:
        if len(row) != len(header):
            raise AssertionError(f"칸 수가 머리글과 다른 줄이 있습니다: {row[0]}")
    return [dict(zip(header, row)) for row in body]


class SpecExampleTests(unittest.TestCase):
    """명세의 응답 예시가 합의한 네 건과 글자 그대로 같다."""

    @classmethod
    def setUpClass(cls):
        cls.section = calendar_section(read_text(SPEC_DOC))
        cls.examples = [json.loads(block) for block in _JSON_BLOCK.findall(cls.section)]

    def test_section_has_the_full_example_and_the_empty_example(self):
        self.assertEqual(len(self.examples), 2, "응답 예시는 네 건짜리와 빈 목록 두 개입니다.")
        for example in self.examples:
            self.assertEqual(list(example), ["events"])

    def test_full_example_matches_the_agreed_table(self):
        # 대상·날짜·출처·확인일과 순서, 필드 이름까지 한 번에 견준다.
        self.assertEqual(self.examples[0]["events"], EXPECTED_EVENTS)

    def test_full_example_dates_are_ordered_weekdays_in_february_2027(self):
        # 연도나 달을 잘못 옮기면 요일이 어긋나 여기서 걸린다.
        events = self.examples[0]["events"]
        starts = [date.fromisoformat(event["starts_on"]) for event in events]
        self.assertEqual(starts, sorted(starts))
        for event, start in zip(events, starts):
            end = date.fromisoformat(event["ends_on"])
            with self.subTest(audience=event["audience"]):
                self.assertLessEqual(start, end)
                for day in (start, end):
                    self.assertEqual((day.year, day.month), (2027, 2))
                    self.assertLess(day.weekday(), 5, f"{day}는 주말입니다.")

    def test_example_sources_are_https_with_a_real_checked_date(self):
        for event in self.examples[0]["events"]:
            with self.subTest(audience=event["audience"]):
                self.assertEqual(len(event["sources"]), 1)
                source = event["sources"][0]
                self.assertTrue(source["url"].startswith("https://"))
                self.assertEqual(date.fromisoformat(source["checked_on"]).isoformat(), CHECKED_ON)

    def test_empty_list_is_documented_for_terms_without_events(self):
        self.assertEqual(self.examples[1], {"events": []})
        for term in EMPTY_TERMS:
            with self.subTest(term=term):
                self.assertIn(f"`{term}`", self.section)
        self.assertIn("빈 목록", self.section)

    def test_bad_year_or_term_is_documented_as_400(self):
        self.assertIn("`400`", self.section)
        for path in BAD_PATHS:
            with self.subTest(path=path):
                self.assertIn(f"`{path}`", self.section)
        # 구역은 고정 문구를 다시 적지 않고 에러 구역을 가리킨다. 그 문구가 명세에 있어야 한다.
        self.assertIn("(#에러)", self.section)
        self.assertIn(BAD_REQUEST_TEXT, read_text(SPEC_DOC))

    def test_post_is_documented_as_405(self):
        self.assertIn("`405`", self.section)

    def test_section_states_the_path_and_that_times_are_left_out(self):
        self.assertIn("`/api/v1/academic-calendar/2027/1`", self.section)
        self.assertIn("시각", self.section)
        # 예시에 시각이 섞여 들어가지 않았다.
        self.assertIsNone(re.search(r"[0-9]{2}:[0-9]{2}", self.section))


class SourceTableTests(unittest.TestCase):
    """출처 표에 학사일정 주소 줄이 한 번만 있고 칸 값이 합의와 같다."""

    @classmethod
    def setUpClass(cls):
        cls.text = read_text(SOURCES_DOC)
        cls.matches = [row for row in source_rows(cls.text) if row["주소"] == SOURCE_URL]

    def test_calendar_address_has_exactly_one_row(self):
        self.assertEqual(len(self.matches), 1)

    def test_address_is_written_only_in_the_address_column(self):
        # 문서 전체에서 한 번이면 주소 칸의 그 한 번뿐이다.
        self.assertEqual(self.text.count(SOURCE_URL), 1)

    def test_row_cells_match_the_agreement(self):
        row = self.matches[0]
        self.assertEqual(row["문서명"], SOURCE_TITLE)
        self.assertEqual(row["발행·적용 학년도"], "2027학년도 1학기")
        self.assertTrue(row["입학연도별 판정 범위"].startswith("확정하지 않음"), row["입학연도별 판정 범위"])
        self.assertEqual(row["확인일"], CHECKED_ON)
        for column in ("응답 확인", "내용 확인"):
            self.assertTrue(row[column], column)

    def test_row_title_matches_the_source_title_in_the_spec_example(self):
        # 응답의 출처 이름과 출처 표의 문서명이 같아야 사람이 표에서 그 줄을 찾는다.
        section = calendar_section(read_text(SPEC_DOC))
        example = json.loads(_JSON_BLOCK.findall(section)[0])
        titles = {source["title"] for event in example["events"] for source in event["sources"]}
        self.assertEqual(titles, {self.matches[0]["문서명"]})


if __name__ == "__main__":
    unittest.main()
