"""학사일정 달력 분류 규칙(#176)이 설계 문서와 스타일 주석에 맞게 적혔는지 본다.

화면(`chat.js`)은 대상 문구 단어를 먼저 보고, 단어가 없을 때만 공식 학사일정 출처로 `enroll`을 고른다.
문서가 출처를 먼저 본다고 적거나 주소가 서버 출처와 어긋나면, 고치는 사람이 시험 일정까지 파랑으로 칠할 수 있다.

소절은 빈 줄을 뺀 줄 목록 전체로 비교한다. 낱말만 찾으면 결과를 `enroll`에서 `neutral`로 바꾸거나 설명 절반을
지워도 통과하고, 필요한 줄만 찾으면 반대 규칙 줄을 더해도 통과한다(교차 검토 재현). 소절을 고칠 때는 아래 줄도 함께 고친다.
서버 주소는 `ast`로 `url=` 인자의 값을 읽는다. 이어 붙인 문자열 조각도 파이썬이 합친 값 그대로 비교한다.

app을 가져오지 않고 `web/docs/UI_NOTES.md`, `api/app/services/academic_calendar.py`, `chat.css`를 글자로만 읽는다.
학교 원문이나 학생 데이터는 쓰지 않는다.

실행(저장소 루트):
    python -B -m unittest api.tests.test_calendar_source_kind_doc
"""

import ast
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UI_NOTES = ROOT / "web" / "docs" / "UI_NOTES.md"
SERVICE = ROOT / "api" / "app" / "services" / "academic_calendar.py"
CHAT_CSS = ROOT / "api" / "app" / "chat_web" / "assets" / "chat.css"

CALENDAR_HEADING = "## 학사일정 월 달력 보기 (#143)"
SUBSECTION_HEADING = "### 분류 정하기 (#176)"
# 옛 주석 두 문장(「열쇠말이 없으면 중립」, 「열쇠말이 없으면 data-kind가 neutral」)에 함께 든 글자.
# 새 주석은 「열쇠말이 없어도」·「없으면 공식 학사일정 출처」로 써서 이 글자를 품지 않는다.
OLD_COMMENT = "열쇠말이 없으면"
BACKSLASH = chr(92)
# 코드 조각 밖에서 쓰지 않는 문자: 대괄호, 여닫는 꺾쇠, 백슬래시.
INLINE_STARTERS = frozenset("[]<>" + BACKSLASH)


def rule_lines(url):
    """소절의 빈 줄이 아닌 줄 전체, 차례대로. 공식 주소는 서버 코드에서 읽은 값을 끼운다."""
    return (
        "- 분류 순서: 대상 문구의 단어로 먼저 고르고(`enroll` → `exam` → `holiday` → `register`), "
        "맞는 단어가 없을 때만 출처를 본다. 분류 단어도, 공식 주소와 정확히 같은 출처도 없을 때만 `neutral`이다.",
        f"- 출처 규칙: 대상 문구에 분류 단어가 없고 `sources` 배열에 `url`이 공식 주소 `{url}`와 "
        "글자 하나까지 같은 항목이 있으면 `enroll`이다. 배열 몇 번째에 있는지는 따지지 않는다.",
        "- 출처가 없을 때: 분류 단어가 있으면 `sources`가 빈 배열이거나 없어도 그 단어의 분류다. "
        "분류 단어도 없으면 오류 없이 `neutral`이다.",
        "- 주소 비교: 주소는 정확히 같을 때만 맞는다. 분류 단어가 없는 일정에 `http://`로 시작하거나 "
        "끝에 `/`나 조회 문자열이 붙거나 호스트가 다른 주소만 있으면 `neutral`이다.",
        "- 단어 우선 이유: 이 주소는 수강신청만 담은 페이지가 아니라 학교 학사일정 전체 페이지다. "
        "출처를 먼저 보면 같은 페이지에서 옮긴 시험 일정까지 파랑이 되므로, "
        "대상 문구에 수강신청 낱말 없이 「시험」이 있으면 공식 출처가 있어도 `exam`이다.",
        "- 수강신청 낱말: 「수강신청」과 「수강 신청」처럼 수강과 신청 사이 공백이 있든 없든 같은 낱말로 본다.",
        "- 단어가 여럿일 때: 위 순서에서 앞선 단어가 이긴다. "
        "가상 대상 문구 「수강신청·시험」과 「수강 신청·시험」은 둘 다 `enroll`이다.",
        "- 막대와 점: 막대(`.acal-bar`)와 점(`.acal-dot`)은 같은 분류 결과(`data-kind`)를 쓴다. "
        "분류 한 곳만 고치면 두 표시가 함께 바뀐다.",
        "- 응답 한 번: 달력 패널을 열 때 `/api/v1/academic-calendar/{year}/{term}`을 한 번 요청한다. "
        "이전·다음 달 이동과 목록 보기 전환은 받아 둔 응답으로 다시 그리고, 다시 요청하지 않는다.",
        "- 검사: 서버 응답과 API 계약은 바꾸지 않았다. `api/tests/test_calendar_source_kind_doc.py`가 "
        "이 소절의 줄 전체와 `academic_calendar.py`의 출처 `url`, `chat.css`의 두 분류 주석을 글자 그대로 비교한다. "
        "줄을 더하거나 고치면 검사의 줄 목록도 함께 고친다.",
    )

# #143 장 도입부의 빈 줄이 아닌 줄 전체. 반대 문장을 덧붙여도 실패하도록 목록째 비교한다.
# 학년도·학기가 빠진 옛 주소는 문서 어디에도 없어야 한다.
INTRO_LINE = (
    "팀 피드백(2026-11-18) 6단계다. 학사일정 패널은 월 달력을 기본 보기로 두고, "
    "기존 `/api/v1/academic-calendar/{year}/{term}` 응답 한 번으로 달 이동과 목록 전환을 처리한다."
)
INTRO_LINES = (
    INTRO_LINE,
    "동작은 `chat.js`가, 모양은 `chat.css` 끝의 #143 절이 맡는다. 일정 이름은 아래 그림에서 모두 가상이다.",
)
OLD_REQUEST = "`/api/v1/academic-calendar` 응답"


# chat.css 분류 주석 두 곳. 여는 글자로 찾고, 공백을 하나로 줄여 주석 전체를 비교한다.
CSS_COMMENTS = {
    "/* 학사일정 달력(#143).": (
        "/* 학사일정 달력(#143). 주말 열 틴트, 오늘 원 채움, 분류 칩(옅은 채움 -bg, 진한 글자 -ink)과 좁은 패널 점(-dot). "
        "수강신청 파랑, 시험 코랄, 휴일 빨강, 등록 노랑이다. "
        "열쇠말이 없어도 공식 학사일정 출처가 있으면 수강신청 파랑, 둘 다 없을 때만 중립이다. "
        "글자는 채움과 4.5:1, 점은 둘레 면과 3:1을 넘는다. */"
    ),
    "/* 분류 색.": (
        "/* 분류 색. 옅은 채움(-bg)에 진한 글자(-ink)다. "
        "대상 글자의 열쇠말을 먼저 보고, 없으면 공식 학사일정 출처가 있을 때 enroll이다. "
        "둘 다 아니면 data-kind가 neutral이거나 비어 있어 중립색이다. "
        "배경은 맨 위 색 블록의 이름표로만 쓴다(다크 밝은 면 검사가 배경 변수를 그 블록에서 푼다). */"
    ),
}


def subsection(text):
    """#143 장 안 「분류 정하기」 소절 본문 줄. 다음 `#` 제목(수준 무관) 앞에서 끝난다. 없거나 둘이면 None."""
    lines = text.replace("\r\n", "\n").split("\n")
    starts = [i for i, line in enumerate(lines) if line == SUBSECTION_HEADING]
    if len(starts) != 1:
        return None
    start = starts[0]
    parent = next((line for line in reversed(lines[:start]) if re.match(r"#{1,2} ", line)), None)
    if parent != CALENDAR_HEADING:
        return None
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("#")), len(lines))
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


def calendar_intro(text):
    """#143 장 제목 다음 줄부터 첫 `#` 제목 앞까지(도입부). 장 제목이 하나가 아니면 빈 목록."""
    lines = text.replace("\r\n", "\n").split("\n")
    if lines.count(CALENDAR_HEADING) != 1:
        return []
    start = lines.index(CALENDAR_HEADING) + 1
    end = next((i for i in range(start, len(lines)) if lines[i].startswith("#")), len(lines))
    return lines[start:end]


def filled_lines(lines):
    return [line for line in lines if line.strip()]


def service_url(source):
    """`url=` 키워드 인자가 하나이고 그 값이 문자열 상수면 파이썬이 합친 값을, 아니면 None을 돌려준다."""
    values = [node.value for node in ast.walk(ast.parse(source)) if isinstance(node, ast.keyword) and node.arg == "url"]
    if len(values) != 1 or not isinstance(values[0], ast.Constant) or not isinstance(values[0].value, str):
        return None
    return values[0].value


def css_comment(css, start):
    """`start`로 여는 주석 하나의 글(공백을 하나로 줄임). 없거나 둘이면 None."""
    if css.count(start) != 1:
        return None
    begin = css.index(start)
    end = css.find("*/", begin)
    return None if end < 0 else " ".join(css[begin : end + 2].split())


class CalendarSourceKindDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")
        cls.lines = subsection(cls.notes) or []
        cls.url = service_url(SERVICE.read_text(encoding="utf-8"))
        cls.css = CHAT_CSS.read_text(encoding="utf-8")

    def test_subsection_exists_once_in_the_calendar_section(self):
        self.assertIsNotNone(subsection(self.notes))
        self.assertTrue(self.lines)

    def test_subsection_is_exactly_the_rule_lines(self):
        self.assertIsNotNone(self.url)
        self.assertEqual(filled_lines(self.lines), list(rule_lines(self.url)))

    def test_intro_names_the_year_and_term_path(self):
        self.assertEqual(filled_lines(calendar_intro(self.notes)), list(INTRO_LINES))
        self.assertNotIn(OLD_REQUEST, self.notes)

    def test_only_the_service_url_is_named(self):
        urls = set(re.findall(r"https://[^\s`]+", "\n".join(self.lines)))
        self.assertEqual(urls, {self.url})

    def test_subsection_keeps_the_inline_rule(self):
        for number, line in enumerate(self.lines, 1):
            with self.subTest(line=number):
                self.assertIsNone(inline_problem(line), line)

    def test_css_comments_follow_the_new_rule(self):
        self.assertNotIn(OLD_COMMENT, self.css)
        for start, expected in CSS_COMMENTS.items():
            with self.subTest(start=start):
                self.assertEqual(css_comment(self.css, start), expected)


class ReviewReproTest(unittest.TestCase):
    """교차 검토 재현: 실제 문서·주석을 메모리에서 바꾸면 검사가 실패해야 한다."""

    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")
        cls.url = service_url(SERVICE.read_text(encoding="utf-8"))
        cls.css = CHAT_CSS.read_text(encoding="utf-8")

    def rules_hold(self, notes, url=None):
        return filled_lines(subsection(notes) or []) == list(rule_lines(self.url if url is None else url))

    def changed(self, old, new, text=None):
        text = self.notes if text is None else text
        self.assertIn(old, text)
        return text.replace(old, new, 1)

    def test_real_document_passes(self):
        self.assertTrue(self.rules_hold(self.notes))

    def test_changed_or_moved_rules_fail(self):
        cases = {
            "공식 출처 결과 뒤집기": ("같은 항목이 있으면 `enroll`이다.", "같은 항목이 있으면 `neutral`이다."),
            "달 이동 설명 삭제": ("이전·다음 달 이동과 목록 보기 전환은 받아 둔 응답으로 다시 그리고, ", ""),
            "별도 소절로 옮김": ("- 출처 규칙:", "#### 가상 별도 절\n\n- 출처 규칙:"),
            "중립 조건 넓힘": ("분류 단어도, 공식 주소와 정확히 같은 출처도 없을 때만", "출처가 비었으면"),
            "요청 주소에서 학기 빠짐": ("열 때 `/api/v1/academic-calendar/{year}/{term}`을", "열 때 `/api/v1/academic-calendar`을"),
            "반대 규칙 줄 추가": ("다시 요청하지 않는다.\n", "다시 요청하지 않는다.\n- 달을 이동할 때마다 다시 요청한다.\n"),
            "섞인 단어 예시 뒤집기": ("둘 다 `enroll`이다.", "둘 다 `exam`이다."),
        }
        for case, (old, new) in cases.items():
            with self.subTest(case=case):
                self.assertFalse(self.rules_hold(self.changed(old, new)))

    def test_old_intro_path_fails(self):
        old_intro = self.changed("기존 `/api/v1/academic-calendar/{year}/{term}` 응답", OLD_REQUEST)
        self.assertNotIn(INTRO_LINE, calendar_intro(old_intro))

    def test_intro_moved_to_another_section_fails(self):
        # 교차 검토 재현: 도입부 문장을 「### 배치」 절로 옮긴다.
        removed = self.changed(INTRO_LINE + "\n", "")
        moved = self.changed("### 배치\n", f"### 배치\n\n{INTRO_LINE}\n", removed)
        self.assertIn(INTRO_LINE, moved)
        self.assertNotIn(INTRO_LINE, calendar_intro(moved))

    def test_contradicting_intro_sentence_fails(self):
        # 교차 검토 재현: 도입부 문장 바로 뒤에 반대 규칙을 덧붙인다.
        added = self.changed(INTRO_LINE + "\n", f"{INTRO_LINE}\n달을 이동할 때마다 서버에 일정을 다시 요청한다.\n")
        self.assertNotEqual(filled_lines(calendar_intro(added)), list(INTRO_LINES))

    def test_leftover_old_css_sentence_fails(self):
        # 교차 검토 재현: 새 분류 색 주석 바로 뒤에 두 번째 옛 문장을 남긴다.
        start = self.css.index("/* 분류 색.")
        end = self.css.index("*/", start) + 2
        old = "/* 응답 글자에 열쇠말이 없으면 data-kind가 neutral이거나 비어 있어 중립색이다. */"
        leftover = self.css[:end] + "\n" + old + self.css[end:]
        self.assertEqual(css_comment(leftover, "/* 분류 색."), CSS_COMMENTS["/* 분류 색."])
        self.assertIn(OLD_COMMENT, leftover)

    def test_spaced_enroll_example_is_required(self):
        changed = self.changed("「수강신청·시험」과 「수강 신청·시험」은 둘 다", "「수강신청·시험」은")
        self.assertFalse(self.rules_hold(changed))

    def test_other_service_url_fails(self):
        self.assertNotIn(self.url.replace("https://", "http://"), "\n".join(rule_lines(self.url)))
        moved = self.changed(f"`{self.url}`", "`https://example.invalid/ko/schedule_reg.do`")
        self.assertFalse(self.rules_hold(moved))

    def test_concatenated_service_url_is_read_whole(self):
        source = SERVICE.read_text(encoding="utf-8")
        old = f'url="{self.url}"'
        self.assertIn(old, source)
        joined = service_url(source.replace(old, f'url="{self.url}" "/v2"', 1))
        self.assertEqual(joined, self.url + "/v2")
        self.assertFalse(self.rules_hold(self.notes, joined))

    def test_bare_angle_bracket_fails(self):
        self.assertIsNotNone(inline_problem("- 가상 > 인용 표시"))
        self.assertIsNotNone(inline_problem("- 가상 <b>글</b>"))
        self.assertIsNone(inline_problem("- 가상 `a > b`와 `[data-kind]` 표기"))

    def test_changed_css_comment_fails(self):
        changed = self.changed("출처가 있을 때 enroll이다.", "출처가 있을 때 neutral이다.", self.css)
        self.assertNotEqual(css_comment(changed, "/* 분류 색."), CSS_COMMENTS["/* 분류 색."])


if __name__ == "__main__":
    unittest.main()
