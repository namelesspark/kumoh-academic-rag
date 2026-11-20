"""학사일정 달력 분류 규칙(#176)이 설계 문서와 스타일 주석에 맞게 적혔는지 본다.

화면(`chat.js`)은 대상 문구 단어를 먼저 보고, 단어가 없을 때만 공식 학사일정 출처로 `enroll`을 고른다.
문서가 출처를 먼저 본다고 적거나 주소가 서버 출처와 어긋나면, 고치는 사람이 시험 일정까지 파랑으로 칠할 수 있다.

app을 가져오지 않고 `web/docs/UI_NOTES.md`, `api/app/services/academic_calendar.py`, `chat.css`를 글자로만 읽는다.
학교 원문이나 학생 데이터는 쓰지 않는다.

실행(저장소 루트):
    python -B -m unittest api.tests.test_calendar_source_kind_doc
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UI_NOTES = ROOT / "web" / "docs" / "UI_NOTES.md"
SERVICE = ROOT / "api" / "app" / "services" / "academic_calendar.py"
CHAT_CSS = ROOT / "api" / "app" / "chat_web" / "assets" / "chat.css"

CALENDAR_HEADING = "## 학사일정 월 달력 보기 (#143)"
SUBSECTION_HEADING = "### 분류 정하기 (#176)"
ORDER = "`enroll` → `exam` → `holiday` → `register`"
OLD_COMMENT = "열쇠말이 없으면 중립"
NEW_COMMENT = "공식 학사일정 출처"
CSS_COMMENT_STARTS = ("/* 학사일정 달력(#143).", "/* 분류 색.")
BACKSLASH = chr(92)
INLINE_STARTERS = frozenset("[]<" + BACKSLASH)


def visible_text(text):
    """HTML 주석을 걷어 낸 글. 닫히지 않은 주석은 끝까지 숨은 것으로 본다."""
    return re.sub(r"<!--.*?(?:-->|\Z)", "", text, flags=re.DOTALL)


def fenced_line_numbers(lines):
    """울타리 코드 블록 안 줄 번호(여는 줄·닫는 줄 포함)."""
    hidden, fence = set(), None
    for index, line in enumerate(lines):
        body = line.lstrip(" ")
        if fence:
            hidden.add(index)
            if re.fullmatch(rf"{re.escape(fence[0])}{{{fence[1]},}}[ \t]*", body):
                fence = None
            continue
        found = re.match(r"(`{3,}|~{3,})", body)
        if found and len(line) - len(body) <= 3:
            hidden.add(index)
            fence = (found.group(1)[0], len(found.group(1)))
    return hidden


def subsection(text):
    """#143 장 안의 「분류 정하기」 소절 본문 줄. 코드 블록 안 제목은 세지 않는다. 없거나 둘이면 None."""
    lines = visible_text(text).replace("\r\n", "\n").split("\n")
    hidden = fenced_line_numbers(lines)
    visible = [(i, line) for i, line in enumerate(lines) if i not in hidden]
    starts = [i for i, line in visible if line == SUBSECTION_HEADING]
    if len(starts) != 1:
        return None
    start = starts[0]
    parent = next((line for i, line in reversed(visible) if i < start and re.match(r"#{1,2} ", line)), None)
    if parent != CALENDAR_HEADING:
        return None
    end = next((i for i, line in visible if i > start and re.match(r"#{1,3} ", line)), len(lines))
    return lines[start + 1 : end]


def inline_problem(line):
    """코드 조각(백틱 한 개 짝) 밖에서 대괄호·꺾쇠·백슬래시를 쓰면 이유를 돌려준다."""
    if "``" in line:
        return "백틱을 두 개 이상 잇지 않는다."
    parts = line.split("`")
    if len(parts) % 2 == 0:
        return "백틱 짝을 맞춘다."
    used = sorted({char for part in parts[::2] for char in part if char in INLINE_STARTERS})
    return f"코드 조각 밖에서 {' '.join(used)}를 쓰지 않는다." if used else None


def service_url(source):
    found = re.findall(r'url="([^"]+)"', source)
    return found[0] if len(found) == 1 else None


def css_comment(css, start):
    """`start`로 여는 주석 하나의 글. 없거나 둘이면 None."""
    if css.count(start) != 1:
        return None
    begin = css.index(start)
    end = css.find("*/", begin)
    return None if end < 0 else css[begin : end + 2]


class HelperTest(unittest.TestCase):
    """판정 함수를 가상 문서로 확인한다."""

    def doc(self, body):
        return f"{CALENDAR_HEADING}\n\n{SUBSECTION_HEADING}\n\n{body}\n\n### 배치\n"

    def test_subsection_is_found_only_under_the_calendar(self):
        self.assertEqual(subsection(self.doc("- 가상 글")), ["", "- 가상 글", ""])
        self.assertIsNone(subsection(f"## 다른 장\n\n{SUBSECTION_HEADING}\n"))
        self.assertIsNone(subsection(self.doc("가상") + f"\n{SUBSECTION_HEADING}\n"))

    def test_hidden_subsection_does_not_count(self):
        self.assertIsNone(subsection(f"{CALENDAR_HEADING}\n\n```text\n{SUBSECTION_HEADING}\n```\n"))
        self.assertIsNone(subsection(f"{CALENDAR_HEADING}\n\n<!--\n{SUBSECTION_HEADING}\n-->\n"))

    def test_inline_rule(self):
        self.assertIsNone(inline_problem("가상 `[data-kind]`와 `<b>` 표기"))
        for line in ("[가상](https://example.invalid)", "<b>가상</b>", "가상 " + BACKSLASH + "* 글", "`홀수", "`` a ``"):
            with self.subTest(line=line):
                self.assertIsNotNone(inline_problem(line))

    def test_css_comment_is_read_to_its_end(self):
        css = "a{}\n/* 분류 색. 가상\n   둘째 줄 */\nb{}"
        self.assertEqual(css_comment(css, "/* 분류 색."), "/* 분류 색. 가상\n   둘째 줄 */")
        self.assertIsNone(css_comment(css + css, "/* 분류 색."))


class CalendarSourceKindDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")
        cls.lines = subsection(cls.notes)
        cls.text = "" if cls.lines is None else "\n".join(cls.lines)
        cls.url = service_url(SERVICE.read_text(encoding="utf-8"))
        cls.css = CHAT_CSS.read_text(encoding="utf-8")

    def test_subsection_exists_once_in_the_calendar_section(self):
        self.assertIsNotNone(self.lines)
        self.assertTrue(self.text.strip())

    def test_official_url_matches_the_service_source(self):
        self.assertIsNotNone(self.url)
        self.assertIn(f"`{self.url}`", self.text)
        # 소절에 적은 https 주소는 모두 서버 출처와 같아야 한다.
        self.assertEqual(set(re.findall(r"https://[^\s`]+", self.text)), {self.url})

    def test_words_come_before_the_source(self):
        order_line = next((line for line in self.lines or () if line.startswith("- 분류 순서:")), "")
        self.assertIn(ORDER, order_line)
        word, source, neutral = (order_line.find(x) for x in (ORDER, "출처", "`neutral`"))
        self.assertTrue(0 <= word < source < neutral, order_line)
        self.assertIn("맞는 단어가 없을 때만", order_line)

    def test_exact_match_and_exam_priority_are_stated(self):
        for phrase in ("글자 하나까지 같은", "정확히 같을 때만", "학사일정 전체 페이지", "공식 출처가 있어도 `exam`이다"):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.text)

    def test_one_response_serves_month_moves_and_list_view(self):
        line = next((line for line in self.lines or () if line.startswith("- 응답 한 번:")), "")
        self.assertIn("`/api/v1/academic-calendar`", line)
        self.assertIn("다시 요청하지 않는다", line)

    def test_subsection_keeps_the_inline_rule(self):
        for number, line in enumerate(self.lines or (), 1):
            with self.subTest(line=number):
                self.assertIsNone(inline_problem(line), line)

    def test_css_comments_follow_the_new_rule(self):
        self.assertNotIn(OLD_COMMENT, self.css)
        for start in CSS_COMMENT_STARTS:
            with self.subTest(start=start):
                comment = css_comment(self.css, start)
                self.assertIsNotNone(comment)
                self.assertIn(NEW_COMMENT, comment)
                self.assertNotIn(OLD_COMMENT, comment)


if __name__ == "__main__":
    unittest.main()
