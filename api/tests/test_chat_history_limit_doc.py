"""채팅 기록 40개 한도 절(#170)에 전송 실패 규칙(#173) 네 가지가 적혀 있는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 한 파일만 읽는다. 프로젝트에는 마크다운 해석기가 없다.
절은 `## 질문 수정·다시 답하기와 답변 버전 (#140)` 아래의 `### 기록 40개 한도와 차례 단위 자르기 (#170)`이다.

마크다운의 뜻을 추측하지 않는다. 먼저 문서가 아래의 좁은 문법만 쓰는지 확인하고, 하나라도 벗어나면 실패한다.
좁은 문법 안에서는 줄 맨 앞 `###` 줄이 제목이 아닌 경우가 맨 앞 코드 블록 안뿐이라, 판정이 CommonMark와 같다.

1. 줄은 `\\n`으로만 나눈다(CommonMark 줄 끝 정의). U+2028 같은 문자는 줄을 나누지 않는다.
2. 코드 블록 울타리(백틱·`~` 세 개 이상)는 들여쓰기·목록·인용 없이 줄 맨 앞에 두고 짝을 맞춘다.
   백틱 울타리의 설명 글에는 백틱이 없고, 닫는 울타리도 줄 맨 앞에 둔다.
3. 코드 블록 밖에서 코드 조각은 한 줄 안의 백틱 한 개 짝으로만 쓴다. 줄마다 백틱 수가 짝수이고,
   백틱이 두 개 이상 이어지지 않으며, 여는 백틱 바로 앞에 백슬래시가 없다.
   그러면 줄을 넘는 코드 조각과 이스케이프한 백틱이 없어, 앞에서부터 둘씩 짝지은 것이 실제 코드 조각과 같다.
4. 코드 블록과 코드 조각 밖에서는 HTML을 시작할 수 있는 `<`+글자·`!`·`?`·`/`를 쓰지 않는다.
5. 링크 참조 정의 줄(`[이름]: 주소`)은 화면에 보이지 않으므로 쓰지 않는다.

그 위에서 시작 제목과 부모 제목은 코드 블록 밖에서 문자열이 정확히 같은 줄 하나만 친다.
절 끝은 제목이 될 수 있는 줄을 모두 경계로 넓게 잡는다(앞 공백·목록·인용 기호를 걷은 `#` 줄, 글 아래 밑줄 줄).
규칙 문구는 절 안 코드 블록 밖의 글에서 찾는다.
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
FENCE = re.compile(r"(`{3,}|~{3,})(.*)$")
HEADING_LIKE = re.compile(r"(#{1,6})(?=[ \t]|$)")
UNDERLINE_LIKE = re.compile(r"(=+|-+)[ \t]*$")
HTML_LIKE = re.compile(r"<[A-Za-z!?/]")
REFERENCE = re.compile(r" {0,3}\[[^\]]*\]:")

# 절에 꼭 남아야 하는 규칙 문구. 확정 기록 경계, 새 대화 예외, 실패 뒤 저장, 재시도 한 차례.
REQUIRED = (
    "확정 기록에도 같은 경계를 적용한다",
    "확정 기록이 없는 새 대화는 예외",
    "일반 실패 뒤에도 저장한다",
    "한 차례만 더한다",
    "committedMessages",
)


def split_lines(text):
    """CommonMark 줄 끝(`\\n`, `\\r\\n`, `\\r`)으로만 나눈다. str.splitlines는 U+2028 등에서도 나눠 쓰지 않는다."""
    return text.replace("\r\n", "\n").replace("\r", "\n").split("\n")


def strip_container(line):
    return line[CONTAINER.match(line).end() :]


def inline_problem(line):
    """코드 블록 밖 한 줄이 3·4·5번 규칙을 어기면 이유를, 지키면 None을 돌려준다."""
    if REFERENCE.match(line):
        return "링크 참조 정의 줄은 쓰지 않는다."
    if "``" in line:
        return "코드 블록 밖에서는 백틱을 두 개 이상 잇지 않는다."
    ticks = [index for index, char in enumerate(line) if char == "`"]
    if len(ticks) % 2:
        return "코드 조각은 한 줄 안에서 백틱 짝을 맞춘다."
    outside, position = [], 0
    for opening, closing in zip(ticks[::2], ticks[1::2]):
        if opening and line[opening - 1] == "\\":
            return "여는 백틱 앞에 백슬래시를 두지 않는다."
        outside.append(line[position:opening])
        position = closing + 1
    outside.append(line[position:])
    if any(HTML_LIKE.search(part) for part in outside):
        return "코드 조각 밖에서 HTML을 쓰지 않는다."
    return None


def code_blocks(lines):
    """(코드 블록 안 줄 번호 집합, 좁은 문법 위반 목록). 울타리 줄도 코드 블록에 넣는다."""
    fenced, problems, fence = set(), [], None
    for index, line in enumerate(lines):
        number = index + 1
        body = strip_container(line)
        found = FENCE.match(body)
        if fence:
            fenced.add(index)
            char, size = fence
            if re.fullmatch(rf"{re.escape(char)}{{{size},}}[ \t]*", line):
                fence = None
            elif found and found.group(1)[0] == char and len(found.group(1)) >= size and not found.group(2).strip():
                problems.append(f"{number}번째 줄: 닫는 울타리는 줄 맨 앞에 둔다.")
            continue
        if found:
            if body != line:
                problems.append(f"{number}번째 줄: 코드 블록 울타리는 들여쓰기·목록·인용 없이 줄 맨 앞에 둔다.")
            if found.group(1)[0] == "`" and "`" in found.group(2):
                problems.append(f"{number}번째 줄: 백틱 울타리 뒤 설명 글에 백틱을 쓰지 않는다.")
            fenced.add(index)
            fence = (found.group(1)[0], len(found.group(1)))
            continue
        reason = inline_problem(line)
        if reason:
            problems.append(f"{number}번째 줄: {reason}")
    if fence:
        problems.append("닫히지 않은 코드 블록이 있다.")
    return fenced, problems


def boundaries(lines):
    """제목이 될 수 있는 줄의 (줄 번호, 수준) 목록. 밑줄 제목은 밑줄 위 글 줄 번호를 쓴다."""
    found = []
    for index, line in enumerate(lines):
        body = strip_container(line)
        heading = HEADING_LIKE.match(body)
        if heading:
            found.append((index, len(heading.group(1))))
            continue
        underline = UNDERLINE_LIKE.match(body)
        if underline and index > 0 and lines[index - 1].strip():
            found.append((index - 1, 1 if underline.group(1)[0] == "=" else 2))
    return sorted(set(found))


def history_section(text):
    """#140 절 아래 #170 절에서 코드 블록 밖 글. 좁은 문법을 벗어나거나 제목을 찾지 못하면 None."""
    lines = split_lines(text)
    fenced, problems = code_blocks(lines)
    if problems:
        return None
    marks = boundaries(lines)
    starts = [index for index, line in enumerate(lines) if line == SECTION_HEADING and index not in fenced]
    if len(starts) != 1:
        return None
    start = starts[0]
    parent = next((index for index, level in reversed(marks) if index < start and level <= 2), None)
    if parent is None or parent in fenced or lines[parent] != PARENT_HEADING:
        return None
    end = next((index for index, level in marks if index > start and level <= 3), len(lines))
    return "\n".join(lines[index] for index in range(start + 1, end) if index not in fenced)


def history_doc_problems(notes):
    problems = code_blocks(split_lines(notes))[1]
    if problems:
        return problems
    section = history_section(notes)
    if section is None:
        return [f"{PARENT_HEADING!r} 아래 코드 블록 밖에 {SECTION_HEADING!r} 제목이 한 번 있어야 한다."]
    return [f"절에 {phrase!r}이(가) 없다." for phrase in REQUIRED if phrase not in section]


class ChatHistoryLimitDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")
        cls.section = history_section(cls.notes)

    def before_rules(self, snippet):
        modified = self.notes.replace(RULES_HEADING, f"{snippet}\n\n{RULES_HEADING}", 1)
        self.assertNotEqual(modified, self.notes)
        return modified

    def replace_heading(self, replacement):
        modified = self.notes.replace(SECTION_HEADING, replacement, 1)
        self.assertNotEqual(modified, self.notes)
        return modified

    def test_document_follows_the_narrow_syntax(self):
        self.assertEqual(code_blocks(split_lines(self.notes))[1], [])

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
            "코드 블록 안 규칙": self.notes.replace(self.section, f"\n```text\n{self.section}\n```\n", 1),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(history_doc_problems(modified))

    def test_syntax_outside_the_narrow_rules_fails(self):
        # 해석이 갈릴 수 있는 문법은 넣기만 해도 실패한다. 지난 교차 검토의 재현을 모두 담는다.
        snippets = {
            "인용 안 울타리": "> ~~~\n\n~~~\n\n가상 글\n\n> ~~~\n~~~",
            "목록 안 울타리": "- ~~~text\n  example\n  ~~~",
            "들여쓴 울타리": "   ```\n### 가짜\n   ```",
            "들여쓴 닫는 울타리": "```\n### 가짜\n  ```\n```",
            "닫히지 않은 울타리": "````\n```\n### 가짜\n```",
            "백틱 섞인 설명 글": "```a`b\n### 가짜\n```",
            "HTML 제목": "<h3>Other section</h3>",
            "HTML 주석": "<!--\n### 숨은 제목\n-->",
            "같은 줄 주석": "가상 <!-- 숨김 --> 글",
            "pre 블록": "<pre>\n\n### 가짜\n\n</pre>",
            "닫는 태그": "</div>",
            "처리 명령": "<?가상?>",
            "이스케이프한 백틱 사이 HTML": "\\`<h3>Other section</h3>\\`",
            "이스케이프한 백틱 하나": "가상 \\` 글 `코드`",
            "줄을 넘는 코드 조각": "가상 `글\n<h3>Other section</h3>\n코드` 끝",
            "두 개 이은 백틱": "가상 `` <h3> `` 글",
            "링크 참조 정의": "[가상]: /가상 '숨은 글'",
        }
        for case, snippet in snippets.items():
            with self.subTest(case=case):
                self.assertTrue(history_doc_problems(self.before_rules(snippet)))

    def test_html_inside_code_is_allowed(self):
        snippets = {
            "코드 조각": "가상 `<h3>`와 `<!--` 표기",
            "코드 조각 안 백슬래시": "가상 `a\\|b` 표기",
            "코드 블록": "```html\n<h3>가상</h3>\n<!-- 가상 -->\n```",
        }
        for case, snippet in snippets.items():
            with self.subTest(case=case):
                self.assertEqual(history_doc_problems(self.before_rules(snippet)), [])

    def test_any_heading_like_line_ends_the_section(self):
        snippets = {
            "앞 공백 세 칸": "   ### 다른 절",
            "앞 공백 네 칸": "    ### 들여쓴 줄",
            "코드 블록 안 제목": "```\n### 가짜\n```",
            "긴 울타리 안 제목": "````\n```\n### 가짜\n````",
            "섞인 울타리 뒤 제목": "```\n~~~\n```\n\n### 다른 절",
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
            "줄 구분이 아닌 U+2028 뒤 제목 글자": "가상 글 ### 가짜",
        }
        for case, snippet in snippets.items():
            with self.subTest(case=case):
                self.assertEqual(history_doc_problems(self.before_rules(snippet)), [])

    def test_section_heading_not_on_its_own_line_does_not_start_the_section(self):
        # U+2028·U+2029·U+0085 같은 문자는 CommonMark 줄 끝이 아니라, 그 뒤 글은 같은 줄의 문단 글이다.
        for separator in (" ", " ", "\u0085", "\x0b", "\x0c"):
            with self.subTest(separator=repr(separator)):
                modified = self.replace_heading(f"### Other section\n\nExample text{separator}{SECTION_HEADING}")
                self.assertTrue(history_doc_problems(modified))

    def test_section_heading_in_code_block_does_not_start_the_section(self):
        for fence, closer in (("~~~", "~~~"), ("```text", "```"), ("````", "````")):
            with self.subTest(fence=fence):
                modified = self.replace_heading(f"### Other section\n\n{fence}\n{SECTION_HEADING}\n{closer}")
                self.assertTrue(history_doc_problems(modified))

    def test_parent_heading_in_code_block_fails(self):
        modified = self.notes.replace(PARENT_HEADING, f"## 다른 장\n\n```\n{PARENT_HEADING}\n```", 1)
        self.assertTrue(history_doc_problems(modified))

    def test_copy_in_code_block_does_not_count_twice(self):
        modified = self.notes.replace("## 화면 구성", f"```text\n{SECTION_HEADING}\n```\n\n## 화면 구성", 1)
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
