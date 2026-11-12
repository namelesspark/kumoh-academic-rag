"""배포 문서와 출처 문서에 적힌 질문·주소가 앱의 실제 응답과 맞는지 확인한다.

사람은 `RENDER_DEPLOY.md`의 표를 보고 배포된 앱에 질문을 보내 결과를 견준다. 표가
앱과 어긋나면 멀쩡한 배포를 고장으로 읽거나 고장을 놓친다. 이 테스트는 표를 정답지로
삼지 않고 거꾸로 표를 채점한다. 표에서 질문을 읽어 앱에 그대로 보내고, 응답이 표에
적힌 대로인지 본다.

서버는 띄우지 않는다. 배포 진입점을 `test_serve`의 `import_serve`로 불러와 앱을 파이썬
함수처럼 바로 부른다 (ASGI 직접 호출). 읽는 파일은 저장소가 추적하는 가상 규정과
문서뿐이고, 링크는 열지 않는다. 주소는 모양만 본다.
"""

import json
import re
import unittest
from datetime import date
from urllib.parse import urlsplit

from api.demo_regulation import DOCUMENT_TITLE, EFFECTIVE_DATE
from api.local_serve import _check_source_url
from api.tests.asgi_harness import call_app
from api.tests.test_render_config import DEPLOY_DOC, REPO_ROOT, manifest_section, read_text
from api.tests.test_serve import MANIFEST, MANIFEST_ENVIRON, import_serve
from core.tests.retrieval_cases import CASES, PARTICLE_CASE

from app.services.chat_stub import UNANSWERABLE_TEXT

SOURCES_DOC = REPO_ROOT / "api" / "docs" / "OFFICIAL_SOURCES.md"
UI_NOTES = REPO_ROOT / "web" / "docs" / "UI_NOTES.md"

CHAT = "/api/v1/chat"
# 모든 조각에 있는 낱말('가상의')만 겹쳐 답변을 보류해야 하는 질문 (이슈 #34).
COMMON_WORD_QUESTION = "가상의 날씨"
LINK_LABEL = "공식 원문 보기"
UNCHECKED = "확인 필요"
EMPTY_CITATIONS = "빈 목록"
OFFICIAL_HOST = "kumoh.ac.kr"

# 데모 확인 표의 한 줄: | `질문` | `true` 또는 `false` | 인용 설명 |
_DEMO_ROW = re.compile(r"^\| `([^`\n]+)` \| `(true|false)` \| ([^|\n]+) \|$", re.MULTILINE)
# 가상 목록 확인 표의 한 줄: | `질문` | 문서명 | 시행일 | `주소` |
_MANIFEST_ROW = re.compile(
    r"^\| `([^`\n]+)` \| ([^|`\n]+) \| ([0-9]{4}-[0-9]{2}-[0-9]{2}) \| `([^`\n]+)` \|$",
    re.MULTILINE,
)
# 문서 어디에든 적힌 주소. 백틱이나 표의 세로줄 앞에서 끝난다.
_ANY_URL = re.compile(r"[A-Za-z][A-Za-z0-9+.-]*://[^\s|`]+")
_DATE_SHAPE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
# 출처 표의 적용 연도. 학기까지 적을 수 있다.
_APPLIED_YEAR = re.compile(r"20[0-9]{2}학년도( [12]학기)?")
_SOURCE_COLUMNS = ("문서명", "적용 연도", "주소", "확인일", "응답 확인", "내용 확인")
# 점뿐인 호스트는 화면이 링크를 숨기고, 대문자로 시작하는 주소는 받는다.
_UI_NOTE_EXAMPLES = ("`https://./`", "`HTTPS://example.invalid/`")


def ask(application, question: str) -> dict:
    response = call_app(application, "POST", CHAT, json_body={"message": question})
    if response.status != 200:
        raise AssertionError(f"채팅 응답 상태가 200이 아닙니다: {response.status}")
    return response.json()


def table_rows(text: str) -> list[dict[str, str]]:
    """문서에 하나뿐인 표를 읽어 줄마다 `{머리글: 칸}`으로 돌려준다."""

    lines = [line for line in text.splitlines() if line.startswith("|")]
    if len(lines) < 3:
        raise AssertionError("머리글·구분선·내용이 있는 표를 찾지 못했습니다.")
    cells = [[cell.strip() for cell in line.strip().strip("|").split("|")] for line in lines]
    header, separator, *body = cells
    if any(set(cell) - set("-: ") for cell in separator):
        raise AssertionError("표의 둘째 줄이 구분선이 아닙니다. 표가 둘 이상일 수 있습니다.")
    for row in body:
        if len(row) != len(header):
            raise AssertionError(f"칸 수가 머리글과 다른 줄이 있습니다: {len(row)}칸")
    return [dict(zip(header, row)) for row in body]


class DemoQuestionTests(unittest.TestCase):
    """문서의 데모 확인 표에 적힌 질문을 데모 앱에 보내면 표대로 답한다."""

    @classmethod
    def setUpClass(cls):
        doc_text = read_text(DEPLOY_DOC)
        # 목록 설정 구역 앞까지가 데모 확인 절차다.
        cls.demo_part = doc_text[: doc_text.index(manifest_section(doc_text))]
        cls.rows = _DEMO_ROW.findall(cls.demo_part)
        cls.application = import_serve({}).app

    def test_table_lists_the_two_agreed_questions_once_each(self):
        questions = [question for question, _, _ in self.rows]
        self.assertEqual(len(questions), len(set(questions)), questions)
        answered = {question: flag for question, flag, _ in self.rows}
        self.assertEqual(answered.get(PARTICLE_CASE.query), "true")
        self.assertEqual(answered.get(COMMON_WORD_QUESTION), "false")

    def test_each_documented_question_answers_as_documented(self):
        self.assertTrue(self.rows)
        cases = {case.query: case for case in CASES}
        for question, flag, described in self.rows:
            with self.subTest(question=question):
                body = ask(self.application, question)
                if flag == "false":
                    self.assertEqual(described.strip(), EMPTY_CITATIONS)
                    self.assertIs(body["answered"], False)
                    self.assertEqual(body["answer"], UNANSWERABLE_TEXT)
                    self.assertEqual(body["citations"], [])
                    continue
                # 답하는 질문은 질문표에 있는 것만 문서에 적는다.
                self.assertIn(question, cases)
                case = cases[question]
                # 문서가 말한 조문이 실제로 인용되는 조문이다.
                self.assertIn(case.article_path, described)
                self.assertIs(body["answered"], True)
                self.assertEqual(body["answer"], case.quote)
                # 가상 데모에는 공식 주소가 없어 화면이 링크를 만들지 않는다.
                self.assertEqual(body["citations"], [{
                    "article_path": case.article_path,
                    "document": DOCUMENT_TITLE,
                    "effective_date": EFFECTIVE_DATE.isoformat(),
                    "snippet": case.quote,
                    "source_url": None,
                }])

    def test_doc_says_demo_cards_have_no_link(self):
        self.assertIn("`source_url`", self.demo_part)
        self.assertIn("`null`", self.demo_part)
        self.assertIn(LINK_LABEL, self.demo_part)


class ManifestQuestionTests(unittest.TestCase):
    """문서의 가상 목록 표대로, 인용이 목록에 적은 주소·문서명·시행일을 그대로 돌려준다."""

    @classmethod
    def setUpClass(cls):
        cls.section = manifest_section(read_text(DEPLOY_DOC))
        cls.rows = [
            (question, title.strip(), effective_date, source_url)
            for question, title, effective_date, source_url in _MANIFEST_ROW.findall(cls.section)
        ]
        cls.entries = {
            entry["document_title"]: entry
            for entry in json.loads(read_text(MANIFEST))["documents"]
        }
        cls.application = import_serve(MANIFEST_ENVIRON).app

    def test_table_has_one_question_for_every_manifest_document(self):
        titles = [title for _, title, _, _ in self.rows]
        self.assertEqual(sorted(titles), sorted(self.entries))

    def test_citation_repeats_manifest_fields_and_source_text(self):
        self.assertTrue(self.rows)
        for question, title, effective_date, source_url in self.rows:
            with self.subTest(question=question):
                entry = self.entries[title]
                # 문서의 표가 목록 파일과 글자까지 같다.
                self.assertEqual(effective_date, entry["effective_date"])
                self.assertEqual(source_url, entry["source_url"])
                self.assertTrue(source_url.startswith("https://example.invalid/"))

                body = ask(self.application, question)
                self.assertIs(body["answered"], True)
                self.assertEqual(len(body["citations"]), 1, body["citations"])
                citation = body["citations"][0]
                self.assertEqual(
                    set(citation),
                    {"article_path", "document", "effective_date", "snippet", "source_url"},
                )
                self.assertEqual(citation["document"], title)
                self.assertEqual(citation["effective_date"], effective_date)
                # 서버가 주소를 다듬지 않는다. 화면도 이 글자를 그대로 href에 넣는다.
                self.assertEqual(citation["source_url"], source_url)

                # 인용문은 그 문서의 가상 원문에 있는 한 줄 그대로다.
                source_lines = read_text(MANIFEST.parent / entry["path"]).splitlines()
                self.assertIn(citation["snippet"], source_lines)
                self.assertTrue(citation["snippet"].startswith(citation["article_path"]))
                self.assertEqual(body["answer"], citation["snippet"])

    def test_common_word_question_is_withheld_as_documented(self):
        self.assertIn(f"`{COMMON_WORD_QUESTION}`", self.section)
        body = ask(self.application, COMMON_WORD_QUESTION)
        self.assertIs(body["answered"], False)
        self.assertEqual(body["citations"], [])

    def test_browser_check_names_what_to_look_at(self):
        for phrase in (LINK_LABEL, "Tab", "Enter", "새 탭", "127.0.0.1"):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.section)

    def test_ui_notes_use_the_same_link_label(self):
        self.assertIn(LINK_LABEL, read_text(UI_NOTES))


class OfficialSourceTests(unittest.TestCase):
    """출처 문서의 표에 적힌 주소는 서버의 주소 검사를 통과하는 학교 주소뿐이다."""

    @classmethod
    def setUpClass(cls):
        cls.text = read_text(SOURCES_DOC)
        cls.rows = table_rows(cls.text)

    def checked_rows(self):
        return [row for row in self.rows if row["주소"] != UNCHECKED]

    def test_table_has_the_agreed_columns(self):
        for row in self.rows:
            with self.subTest(document=row.get("문서명")):
                self.assertEqual(tuple(row), _SOURCE_COLUMNS)
                for column in _SOURCE_COLUMNS:
                    self.assertTrue(row[column], column)

    def test_listed_urls_pass_startup_check_and_belong_to_the_school(self):
        checked = self.checked_rows()
        self.assertTrue(checked, "직접 확인한 주소가 한 건은 있어야 합니다.")
        for row in checked:
            url = row["주소"]
            with self.subTest(document=row["문서명"]):
                # 서버가 목록 파일의 source_url에 쓰는 검사와 같은 함수다.
                self.assertEqual(_check_source_url(url, "주소"), url)
                host = (urlsplit(url).hostname or "").lower()
                self.assertTrue(
                    host == OFFICIAL_HOST or host.endswith("." + OFFICIAL_HOST), host
                )
                # 주소가 있는 줄은 사람이 요청을 보낸 날짜가 있어야 한다.
                self.assertIsNotNone(_DATE_SHAPE.fullmatch(row["확인일"]), row["확인일"])
                date.fromisoformat(row["확인일"])

    def test_listed_urls_state_the_year_they_apply_to(self):
        # 적용 연도를 모르는 주소는 링크로 내보내지 않는다. '확인 필요'도 여기서 걸린다.
        for row in self.checked_rows():
            with self.subTest(document=row["문서명"]):
                self.assertIsNotNone(
                    _APPLIED_YEAR.fullmatch(row["적용 연도"]), row["적용 연도"]
                )

    def test_unchecked_rows_carry_no_address(self):
        # 적용 연도·주소·확인일 가운데 하나라도 '확인 필요'면 셋 다 '확인 필요'다.
        for row in self.rows:
            marks = [row[column] == UNCHECKED for column in ("적용 연도", "주소", "확인일")]
            if not any(marks):
                continue
            with self.subTest(document=row["문서명"]):
                self.assertTrue(all(marks), marks)
                self.assertEqual(_ANY_URL.findall(" ".join(row.values())), [])

    def test_ui_notes_state_the_two_host_and_scheme_edge_cases(self):
        notes = read_text(UI_NOTES)
        for example in _UI_NOTE_EXAMPLES:
            with self.subTest(example=example):
                self.assertIn(example, notes)

    def test_no_address_is_written_outside_the_address_column(self):
        # 표 밖이나 다른 칸에 적은 주소는 확인을 거쳤는지 알 수 없다.
        listed = sorted(row["주소"] for row in self.checked_rows())
        self.assertEqual(sorted(_ANY_URL.findall(self.text)), listed)


if __name__ == "__main__":
    unittest.main()
