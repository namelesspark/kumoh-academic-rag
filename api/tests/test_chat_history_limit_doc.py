"""채팅 기록 40개 한도 절(#170)에 전송 실패 규칙(#173) 네 가지가 적혀 있는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 한 파일만 읽는다.
절은 `## 질문 수정·다시 답하기와 답변 버전 (#140)` 아래의 `### 기록 40개 한도와 차례 단위 자르기 (#170)`이다.

마크다운 문법을 끝까지 해석하지 않고, 제목이 될 수 있는 줄은 모두 절 경계로 본다.
코드 블록·HTML 주석·목록·인용 안이든, 들여쓰기가 몇 칸이든 가리지 않는다.
- `#`~`######`와 공백으로 시작하는 줄(앞 공백, 목록 기호, 인용 기호는 걷어 내고 본다)
- 글 줄 바로 아래에 `=`나 `-`만 있는 줄(밑줄 제목). 이때 경계는 밑줄 위 글 줄이다.
그래서 실제 제목을 놓쳐 다른 절의 문구를 이 절로 잘못 세는 일은 없다.
대신 #170 절 안에는 코드 블록이나 주석 속이라도 제목처럼 보이는 줄을 두지 않는다.

시작 제목과 부모 제목은 반대로 좁게 잡는다. 코드 블록이나 숨는 HTML(주석, `<pre>`·`<script>` 등) 안일
여지가 있거나 바로 앞 줄이 빈 줄이 아니면 제목으로 치지 않는다. 규칙 문구는 그런 줄과 HTML 주석을 걷어 낸 글에서 찾는다.
어느 쪽이든 판정이 애매하면 실패 쪽으로 기운다.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UI_NOTES = ROOT / "web" / "docs" / "UI_NOTES.md"

PARENT_HEADING = "## 질문 수정·다시 답하기와 답변 버전 (#140)"
SECTION_HEADING = "### 기록 40개 한도와 차례 단위 자르기 (#170)"
RULES_HEADING = "#### 전송 실패와 다시 시도 (#173)"

# 줄 앞의 공백, 목록 기호(`-`·`*`·`+`·`1.`·`1)`), 인용 기호(`>`)를 몇 겹이든 걷어 낸다.
CONTAINER = re.compile(r"(?:[ \t]+|(?:[-*+]|\d{1,9}[.)])(?=[ \t])|>)*")
HEADING_LIKE = re.compile(r"(#{1,6})(?=[ \t]|$)")
UNDERLINE_LIKE = re.compile(r"(=+|-+)[ \t]*$")
COMMENT = re.compile(r"<!--.*?(?:-->|\Z)", re.DOTALL)
FENCE_LIKE = re.compile(r"(`{3,}|~{3,})")
# 화면에서 글을 숨기거나 제목을 글자로 바꿀 수 있는 HTML 시작과 그 끝 표시(소문자로 비교).
HTML_OPEN = re.compile(
    r"(?P<comment><!--)|(?P<cdata><!\[cdata\[)|(?P<pi><\?)|(?P<decl><![a-z])"
    r"|(?P<raw><(?:pre|script|style|textarea))(?=[\s>]|$)"
)
HTML_END = {"comment": "-->", "cdata": "]]>", "pi": "?>", "decl": ">"}

# 절에 꼭 남아야 하는 규칙 문구. 확정 기록 경계, 새 대화 예외, 실패 뒤 저장, 재시도 한 차례.
REQUIRED = (
    "확정 기록에도 같은 경계를 적용한다",
    "확정 기록이 없는 새 대화는 예외",
    "일반 실패 뒤에도 저장한다",
    "한 차례만 더한다",
    "committedMessages",
)


def boundaries(lines):
    """제목이 될 수 있는 줄의 (줄 번호, 수준) 목록. 밑줄 제목은 밑줄 위 글 줄 번호를 쓴다."""
    found = []
    for index, line in enumerate(lines):
        body = line[CONTAINER.match(line).end() :]
        heading = HEADING_LIKE.match(body)
        if heading:
            found.append((index, len(heading.group(1))))
            continue
        underline = UNDERLINE_LIKE.match(body)
        if underline and index > 0 and lines[index - 1].strip():
            found.append((index - 1, 1 if underline.group(1)[0] == "=" else 2))
    return sorted(set(found))


def hidden_lines(lines):
    """코드 블록이나 숨는 HTML 안일 수 있는 줄 번호 집합. 넓게 잡아, 숨었을 수도 있으면 넣는다.

    - 코드 블록: 줄 앞 공백·목록·인용 기호를 걷어 낸 뒤 백틱이나 `~` 세 개 이상으로 시작하면 연다.
      닫는 줄은 앞 공백 세 칸 이하에 같은 문자, 같거나 긴 길이, 뒤에 공백만 있을 때만 인정한다.
    - HTML: 줄 어디든 `<!--`·`<?`·`<![CDATA[`·`<!`+글자·`<pre`·`<script`·`<style`·`<textarea`가 있으면
      그 줄부터 짝이 되는 끝 표시가 나오는 줄까지 숨은 것으로 본다. 백틱 코드 조각 안이어도 가리지 않는다.
    """
    hidden, fence, html_end = set(), None, None
    for index, line in enumerate(lines):
        if fence:
            hidden.add(index)
            char, size = fence
            if re.fullmatch(rf" {{0,3}}{re.escape(char)}{{{size},}}[ \t]*", line):
                fence = None
            continue
        lowered = line.lower()
        if html_end:
            hidden.add(index)
            closed = lowered.find(html_end)
            if closed < 0:
                continue
            # 끝 표시 뒤에 새 HTML이 또 열리는지 같은 줄에서 이어 본다.
            html_end = pending_html(lowered, closed + len(html_end))
            continue
        body = line[CONTAINER.match(line).end() :]
        opener = FENCE_LIKE.match(body)
        if opener:
            hidden.add(index)
            fence = (opener.group(1)[0], len(opener.group(1)))
            continue
        if HTML_OPEN.search(lowered):
            hidden.add(index)
            html_end = pending_html(lowered, 0)
    return hidden


def pending_html(lowered, position):
    """줄의 position부터 HTML 시작과 끝을 차례로 짝지어, 줄 끝에서 아직 열린 HTML의 끝 표시(없으면 None)."""
    while True:
        match = HTML_OPEN.search(lowered, position)
        if not match:
            return None
        end = HTML_END.get(match.lastgroup) or f"</{match.group('raw')[1:]}>"
        closed = lowered.find(end, match.end())
        if closed < 0:
            return end
        position = closed + len(end)


def real_heading(lines, index, hidden):
    """숨었을 여지가 없는 제목 줄인가. 빈 줄(또는 문서 처음) 바로 뒤여야 HTML 블록에 이어 붙은 줄이 아니다."""
    return index not in hidden and (index == 0 or not lines[index - 1].strip())


def history_section(text):
    """#140 절 아래 #170 절의 보이는 본문. 제목이 한 번이 아니거나 #140 절 밖에 있으면 None.

    경계는 넓게(제목일 수도 있으면 경계), 시작 제목과 부모 제목은 좁게(숨었을 수도 있으면 제목 아님) 잡는다.
    """
    lines = text.splitlines()
    marks = boundaries(lines)
    hidden = hidden_lines(lines)
    starts = [index for index, line in enumerate(lines)
              if line == SECTION_HEADING and real_heading(lines, index, hidden)]
    if len(starts) != 1:
        return None
    start = starts[0]
    parent = next((index for index, level in reversed(marks) if index < start and level <= 2), None)
    if parent is None or lines[parent] != PARENT_HEADING or not real_heading(lines, parent, hidden):
        return None
    end = next((index for index, level in marks if index > start and level <= 3), len(lines))
    shown = [lines[index] for index in range(start + 1, end) if index not in hidden]
    return "\n".join(shown)


def history_doc_problems(notes):
    section = history_section(notes)
    if section is None:
        return [f"{PARENT_HEADING!r} 아래에 {SECTION_HEADING!r} 제목이 한 번 있어야 한다."]
    visible = COMMENT.sub("", section)
    return [f"절에 {phrase!r}이(가) 없다." for phrase in REQUIRED if phrase not in visible]


class ChatHistoryLimitDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")
        cls.section = history_section(cls.notes)

    def before_rules(self, snippet):
        modified = self.notes.replace(RULES_HEADING, f"{snippet}\n\n{RULES_HEADING}", 1)
        self.assertNotEqual(modified, self.notes)
        return modified

    def test_section_has_failure_rules(self):
        self.assertIsNotNone(self.section)
        self.assertEqual(history_doc_problems(self.notes), [])

    def test_each_rule_is_checked(self):
        for phrase in REQUIRED:
            with self.subTest(phrase=phrase):
                modified = self.notes.replace(self.section, self.section.replace(phrase, "□"), 1)
                self.assertTrue(history_doc_problems(modified))

    def test_rules_only_in_another_section_fail(self):
        emptied = self.section
        for phrase in REQUIRED:
            emptied = emptied.replace(phrase, "□")
        rules = "\n".join(REQUIRED)
        cases = {
            "다음 절": self.notes.replace(self.section, emptied, 1).replace("### 검사", f"### 검사\n\n{rules}", 1),
            "새 제목": self.notes.replace(self.section, f"{emptied}\n### 다른 절\n\n{self.section}", 1),
            "다른 장": self.notes.replace(self.section, emptied, 1).replace("## 화면 구성", f"## 화면 구성\n\n{rules}", 1),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertTrue(history_doc_problems(modified))

    def test_any_heading_like_line_ends_the_section(self):
        # 규칙 앞에 끼운 줄이 제목으로 보일 여지가 있으면, 규칙이 다른 절로 넘어간 것으로 보고 실패해야 한다.
        snippets = {
            "앞 공백 세 칸": "   ### 다른 절",
            "앞 공백 네 칸": "    ### 들여쓴 줄",
            "코드 블록": "```\n### 가짜\n```",
            "긴 울타리": "````\n```\n### 가짜\n````",
            "섞인 울타리": "```\n~~~\n```\n\n### 다른 절",
            "코드 블록 안 주석 기호": "~~~text\n<!--\n~~~\n\n### 다른 절\n\n~~~text\n-->\n~~~",
            "주석 안 제목": "<!--\n### 숨은 제목\n-->",
            "코드 조각 안 주석 기호": "Literal `<!--`.\n\n### Other section\n\nLiteral `-->`.",
            "목록 안 코드 블록": "- ~~~text\n  example\n  ~~~\n\n### Other section",
            "목록 안 제목": "- ### 목록 안 제목",
            "번호 목록 안 제목": "1. ### 번호 목록 안 제목",
            "인용 안 제목": "> ### 인용 안 제목",
            "밑줄 2단계": "다른 절\n-----------------",
            "밑줄 1단계": "다른 장\n=======",
            "목록 아래 밑줄": "- 가상 목록\n---",
            "구분선 아래 밑줄": "***\n---",
            "2단계 제목": "## 다른 장",
        }
        for case, snippet in snippets.items():
            with self.subTest(case=case):
                self.assertTrue(history_doc_problems(self.before_rules(snippet)))

    def test_lines_that_cannot_be_headings_keep_the_section(self):
        snippets = {
            "빈 줄 아래 구분선": "---",
            "공백 없는 해시": "#가상해시",
            "4단계 제목": "#### 가상 하위 제목",
        }
        for case, snippet in snippets.items():
            with self.subTest(case=case):
                self.assertEqual(history_doc_problems(self.before_rules(snippet)), [])

    def test_rules_hidden_in_comments_fail(self):
        cases = {
            "절 전체": self.notes.replace(self.section, f"<!--{self.section}-->", 1),
            "같은 줄 주석": self.notes.replace(
                self.section, self.section.replace(REQUIRED[3], f"<!--{REQUIRED[3]}-->"), 1),
            "여러 줄 주석": self.notes.replace(
                self.section, self.section.replace(REQUIRED[2], f"<!--\n{REQUIRED[2]}\n-->"), 1),
            "닫히지 않은 주석": self.notes.replace(self.section, f"<!--{self.section}", 1),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(history_doc_problems(modified))

    def test_hidden_section_heading_does_not_start_the_section(self):
        # 시작 제목이 숨었을 수도 있으면 제목으로 치지 않는다. 그러면 규칙은 앞의 다른 절에 속한다.
        wrappers = {
            "주석": "<!--\n{heading}\n-->",
            "물결 코드 블록": "~~~\n{heading}\n~~~",
            "백틱 코드 블록": "```text\n{heading}\n```",
            "목록 안 코드 블록": "- ~~~\n  {heading}\n  ~~~",
            "닫는 길이가 짧은 울타리": "````\n```\n{heading}\n```",
            "같은 줄에 닫힌 뒤 다시 열린 주석": "<!-- 가상 --> <!--\n{heading}\n-->",
            "pre 블록": "<pre>\n\n{heading}\n\n</pre>",
            "HTML 블록에 이어 붙음": "<div>\n{heading}\n</div>",
        }
        for case, wrapper in wrappers.items():
            with self.subTest(case=case):
                replacement = "### Other section\n\n" + wrapper.format(heading=SECTION_HEADING)
                modified = self.notes.replace(SECTION_HEADING, replacement, 1)
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(history_doc_problems(modified))

    def test_hidden_parent_heading_fails(self):
        modified = self.notes.replace(PARENT_HEADING, f"## 다른 장\n\n<!--\n{PARENT_HEADING}\n-->", 1)
        self.assertTrue(history_doc_problems(modified))

    def test_hidden_copy_does_not_count_twice(self):
        # 숨은 사본은 시작 제목으로 세지 않으므로, 진짜 제목 하나만 있으면 통과한다.
        modified = self.notes.replace("## 화면 구성", f"<!--\n{SECTION_HEADING}\n-->\n\n## 화면 구성", 1)
        self.assertNotEqual(modified, self.notes)
        self.assertEqual(history_doc_problems(modified), [])

    def test_heading_moved_or_duplicated_fails(self):
        cases = {
            "삭제": self.notes.replace(SECTION_HEADING, "### 다른 제목", 1),
            "중복": self.notes.replace(SECTION_HEADING, f"{SECTION_HEADING}\n\n{SECTION_HEADING}", 1),
            "수준 변경": self.notes.replace(SECTION_HEADING, "#" + SECTION_HEADING, 1),
            "부모 밖": self.notes.replace(SECTION_HEADING, f"## 다른 장\n\n{SECTION_HEADING}", 1),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertTrue(history_doc_problems(modified))


if __name__ == "__main__":
    unittest.main()
