"""채팅 기록 40개 한도 절(#170)에 전송 실패 규칙(#173) 네 가지가 적혀 있는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 한 파일만 읽는다. 프로젝트와 표준 라이브러리에는 마크다운 해석기가 없다.
절은 `## 질문 수정·다시 답하기와 답변 버전 (#140)` 아래의 `### 기록 40개 한도와 차례 단위 자르기 (#170)`이다.

마크다운의 뜻을 해석하지 않는다. 쓸 수 있는 문법을 좁혀, 좁힌 문법 안에서는 판정이 CommonMark와 같게 한다.

문서 전체 규칙(시작 제목과 부모 제목이 진짜 제목인지 가리기 위해)
- 줄은 `\\n`으로만 나눈다(CommonMark 줄 끝). U+2028 같은 문자는 줄을 나누지 않는다.
- 코드 블록 울타리(백틱·`~` 세 개 이상)는 들여쓰기·목록·인용 없이 줄 맨 앞에 두고 짝을 맞춘다.
- 코드 블록 밖 코드 조각은 한 줄 안의 백틱 한 개 짝으로만 쓰고, 코드 조각 밖에서는 `[`·`]`·`<`·`\\`를 쓰지 않는다.
  링크·HTML·이스케이프가 없으면 앞에서부터 둘씩 짝지은 백틱이 실제 코드 조각과 같다.
이 규칙 아래에서 줄 맨 앞 `###` 줄이 제목이 아닌 곳은 맨 앞 코드 블록 안뿐이다. 그래서 시작 제목과 부모 제목은
코드 블록 밖에서 문자열이 정확히 같은 줄 하나만 친다. 부모 제목과 시작 제목 사이에 다른 1·2단계 제목이 있을 수
있는지는 넓게 본다(앞 공백·목록·인용 기호를 걷은 `#` 줄과 밑줄 제목을 모두 제목으로 본다).

#170 절 본문 규칙(허용 목록)
- 절은 시작 제목 다음 줄부터 줄 맨 앞 `#`·`##`·`###` 제목 앞까지다.
- 그 사이 줄은 넷 중 하나여야 한다: 빈 줄(공백·탭만), 줄 맨 앞 `#### ` 소제목, 줄 맨 앞 `- ` 목록 항목,
  문단 줄. 문단 줄과 목록 항목의 글은 공백·탭이나 블록 표시 기호(`>`·`#`·`-`·`*`·`+`·`=`·`_`·`|`·`~`·`!`·`:`)로
  시작하지 않고, `1.`·`1)` 같은 번호 목록 표시로도 시작하지 않는다. 코드 블록 안 줄도 둘 수 없다.
- 그러면 본문에는 들여쓴 코드, 인용, 밑줄 제목, 구분선, 표, 코드 블록이 생길 수 없어, 모든 줄이 화면에 보이는 글이다.
규칙 문구는 이 본문에서 찾는다.
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
# 코드 조각 밖에서 금지하는 문자. 링크·이미지·링크 정의, HTML·자동 링크, 이스케이프를 시작할 수 있다.
INLINE_STARTERS = frozenset("[]<\\")

# #170 절 본문 허용 목록.
SECTION_END = re.compile(r"#{1,3}(?=[ \t]|$)")
SUBHEADING = re.compile(r"#### (?=[^ \t])")
LIST_ITEM = re.compile(r"- (?=[^ \t])")
# 백틱은 코드 조각으로 줄을 시작할 수 있어 빼고, 울타리는 코드 블록 판정으로 따로 막는다.
BLOCK_STARTERS = frozenset(" \t>#-*+=_|~!:")
ORDERED_MARKER = re.compile(r"\d{1,9}[.)]")

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


def is_blank(line):
    """CommonMark 빈 줄: 공백(U+0020)과 탭만 있는 줄. str.strip()은 U+00A0 같은 유니코드 공백도 지워 쓰지 않는다."""
    return not line.strip(" \t")


def strip_container(line):
    return line[CONTAINER.match(line).end() :]


def inline_problem(line):
    """코드 블록 밖 한 줄이 코드 조각 규칙을 어기면 이유를, 지키면 None을 돌려준다."""
    if "``" in line:
        return "코드 블록 밖에서는 백틱을 두 개 이상 잇지 않는다."
    ticks = [index for index, char in enumerate(line) if char == "`"]
    if len(ticks) % 2:
        return "코드 조각은 한 줄 안에서 백틱 짝을 맞춘다."
    outside, position = [], 0
    for opening, closing in zip(ticks[::2], ticks[1::2]):
        outside.append(line[position:opening])
        position = closing + 1
    outside.append(line[position:])
    used = sorted({char for part in outside for char in part if char in INLINE_STARTERS})
    if used:
        return f"코드 조각 밖에서 {' '.join(used)}를 쓰지 않는다."
    return None


def code_blocks(lines):
    """(코드 블록 안 줄 번호 집합, 문서 전체 규칙 위반 목록). 울타리 줄도 코드 블록에 넣는다."""
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
            elif found and found.group(1)[0] == char and len(found.group(1)) >= size and is_blank(found.group(2)):
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


def boundaries(lines, fenced=frozenset()):
    """제목이 될 수 있는 줄의 (줄 번호, 수준) 목록. 밑줄 제목은 위 문단 첫 줄을 쓴다(넓게 잡는다)."""
    found = []
    for index, line in enumerate(lines):
        body = strip_container(line)
        heading = HEADING_LIKE.match(body)
        if heading:
            found.append((index, len(heading.group(1))))
            continue
        underline = UNDERLINE_LIKE.match(body)
        if not (underline and index > 0 and not is_blank(lines[index - 1])):
            continue
        first = index - 1
        while first > 0:
            above = lines[first - 1]
            if is_blank(above) or (first - 1) in fenced or HEADING_LIKE.match(strip_container(above)):
                break
            first -= 1
        found.append((first, 1 if underline.group(1)[0] == "=" else 2))
    return sorted(set(found))


def plain_text_start(text):
    return bool(text) and text[0] not in BLOCK_STARTERS and not ORDERED_MARKER.match(text)


def section_line_problem(line):
    """#170 본문 한 줄이 허용 목록에 없으면 이유를, 있으면 None을 돌려준다."""
    if is_blank(line):
        return None
    if SUBHEADING.match(line):
        return None
    if LIST_ITEM.match(line):
        return None if plain_text_start(line[2:]) else "목록 항목 글은 블록 표시 기호로 시작하지 않는다."
    if plain_text_start(line):
        return None
    return "빈 줄, `#### ` 소제목, `- ` 목록, 기호로 시작하지 않는 문단 줄만 쓴다."


def find_section(text):
    """(#170 본문 줄 목록, 문제 목록). 문제가 있으면 본문은 None."""
    lines = split_lines(text)
    fenced, problems = code_blocks(lines)
    if problems:
        return None, problems
    starts = [index for index, line in enumerate(lines) if line == SECTION_HEADING and index not in fenced]
    marks = boundaries(lines, fenced)
    parent = None
    if len(starts) == 1:
        parent = next((index for index, level in reversed(marks) if index < starts[0] and level <= 2), None)
    if parent is None or parent in fenced or lines[parent] != PARENT_HEADING:
        return None, [f"{PARENT_HEADING!r} 아래 코드 블록 밖에 {SECTION_HEADING!r} 제목이 한 번 있어야 한다."]
    body, index = [], starts[0] + 1
    while index < len(lines) and not SECTION_END.match(lines[index]):
        reason = "코드 블록을 두지 않는다." if index in fenced else section_line_problem(lines[index])
        if reason:
            problems.append(f"{index + 1}번째 줄(#170 절): {reason}")
        body.append(lines[index])
        index += 1
    return (None, problems) if problems else (body, [])


def history_section(text):
    body = find_section(text)[0]
    return None if body is None else "\n".join(body)


def history_doc_problems(notes):
    body, problems = find_section(notes)
    if problems:
        return problems
    section = "\n".join(body)
    return [f"절에 {phrase!r}이(가) 없다." for phrase in REQUIRED if phrase not in section]


class ChatHistoryLimitDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")
        cls.section = history_section(cls.notes)

    def before_rules(self, snippet):
        """#170 본문 안, #173 소제목 바로 앞에 끼운다."""
        modified = self.notes.replace(RULES_HEADING, f"{snippet}\n\n{RULES_HEADING}", 1)
        self.assertNotEqual(modified, self.notes)
        return modified

    def elsewhere(self, snippet):
        """#170 절 밖, 문서 앞쪽 「## 화면 구성」 바로 앞에 끼운다."""
        modified = self.notes.replace("## 화면 구성", f"{snippet}\n\n## 화면 구성", 1)
        self.assertNotEqual(modified, self.notes)
        return modified

    def replace_body(self, body):
        modified = self.notes.replace(self.section, body, 1)
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

    def test_section_is_read_from_the_real_lines(self):
        self.assertIn(f"{SECTION_HEADING}\n{self.section}\n### ", self.notes)

    def test_each_rule_is_checked(self):
        for phrase in REQUIRED:
            with self.subTest(phrase=phrase):
                self.assertTrue(history_doc_problems(self.replace_body(self.section.replace(phrase, "□"))))

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

    def test_section_body_allows_only_plain_lines(self):
        # 지난 교차 검토의 재현과 그 변형. #170 본문에 넣기만 해도 실패한다.
        snippets = {
            "앞 공백 세 칸 제목": "   ### 다른 절",
            "앞 공백 네 칸 줄": "    ### Literal",
            "탭 들여쓰기": "\t가상 글",
            "인용": "> 가상 글",
            "인용 안 들여쓴 코드": ">     가상 글",
            "목록 안 들여쓴 코드": "-     가상 글",
            "목록 안 인용": "- > 가상 글",
            "목록 안 제목": "- ### 목록 안 제목",
            "번호 목록": "1. 가상 글",
            "번호 목록 괄호": "1) 가상 글",
            "별표 목록": "* 가상 글",
            "더하기 목록": "+ 가상 글",
            "구분선": "---",
            "별표 구분선": "***",
            "밑줄 구분선": "___",
            "밑줄 1단계": "다른 장\n=======",
            "밑줄 2단계": "다른 절\n-----------------",
            "목록 아래 밑줄": "- 가상 목록\n---",
            "표": "| 가상 | 표 |",
            "코드 블록": "```\n가상\n```",
            "물결 코드 블록": "~~~\n가상\n~~~",
            "공백 없는 해시": "#가상해시",
            "5단계 제목": "##### 가상",
            "앞 공백 한 칸": " 가상 글",
        }
        for case, snippet in snippets.items():
            with self.subTest(case=case):
                self.assertTrue(history_doc_problems(self.before_rules(snippet)))

    def test_plain_lines_keep_the_section(self):
        snippets = {
            "문단": "가상 글",
            "목록": "- 가상 목록",
            "소제목": "#### 가상 하위 제목",
            "코드 조각": "가상 `<h3>`와 `[data-x]`, `a\\|b` 표기",
            "코드 조각으로 시작": "`가상` 글",
            "U+2028 뒤 글자": "가상 글 ### 가짜",
            "U+00A0로 시작": " 가상 글",
            "숫자로 시작": "40개 한도",
        }
        for case, snippet in snippets.items():
            with self.subTest(case=case):
                self.assertEqual(history_doc_problems(self.before_rules(snippet)), [])

    def test_whole_section_replaced_by_hidden_text_fails(self):
        joined = " ".join(REQUIRED)
        cases = {
            "여러 줄 밑줄 제목": f"\n{joined}\nOther section\n---\n",
            "여러 줄 밑줄 1단계 제목": f"\n{joined}\n가상 글\nOther section\n===\n",
            "링크 정의 제목 글": f"\n[example\\]label]: /example '{joined}'\n",
            "U+00A0 줄 뒤 밑줄 제목": f"\n{joined}\n \nOther section\n---\n",
            "U+3000 줄 뒤 밑줄 제목": f"\n{joined}\n　\nOther section\n---\n",
            "공백 네 칸 들여쓴 코드": f"\n\n    {joined}\n",
            "탭 들여쓴 코드": f"\n\n\t{joined}\n",
            "공백 두 칸과 탭": f"\n\n  \t{joined}\n",
            # 이번 교차 검토 재현.
            "들여쓴 제목 같은 줄과 밑줄 제목": f"\n{joined}\n    ### Literal\nOther section\n---\n",
            "인용 안 들여쓴 코드": f"\n\n>     {joined}\n",
        }
        for case, body in cases.items():
            with self.subTest(case=case):
                self.assertTrue(history_doc_problems(self.replace_body(body)))

    def test_syntax_outside_the_narrow_rules_fails(self):
        # 문서 어디에 두든 실패하는 문법. 시작 제목과 부모 제목을 숨길 수 있기 때문이다.
        snippets = {
            "인용 안 울타리": "> ~~~\n\n~~~\n\n가상 글\n\n> ~~~\n~~~",
            "목록 안 울타리": "- ~~~text\n  example\n  ~~~",
            "들여쓴 울타리": "   ```\n### 가짜\n   ```",
            "들여쓴 닫는 울타리": "```\n### 가짜\n  ```\n```",
            "닫히지 않은 울타리": "````\n```\n### 가짜\n```",
            "백틱 섞인 설명 글": "```a`b\n### 가짜\n```",
            "HTML 제목": "<h3>Other section</h3>",
            "HTML 주석": "<!--\n### 숨은 제목\n-->",
            "pre 블록": "<pre>\n\n### 가짜\n\n</pre>",
            "이스케이프한 백틱 사이 HTML": "\\`<h3>Other section</h3>\\`",
            "줄을 넘는 코드 조각": "가상 `글\n<h3>Other section</h3>\n코드` 끝",
            "두 개 이은 백틱": "가상 `` <h3> `` 글",
            "링크 주소 안 백틱": "[a](/a`) <h3>Other section</h3> [b](/b`)",
            "링크 정의": "[example\\]label]: /example '숨은 글'",
            "자동 링크": "<https://example.invalid>",
        }
        for case, snippet in snippets.items():
            with self.subTest(case=case):
                self.assertTrue(history_doc_problems(self.elsewhere(snippet)))

    def test_code_outside_the_section_is_allowed(self):
        snippets = {
            "코드 블록 안 HTML": "```html\n<h3>가상</h3>\n<!-- 가상 -->\n```",
            "코드 블록 안 시작 제목 사본": f"```text\n{SECTION_HEADING}\n```",
            "밑줄 제목": "가상 장\n===",
        }
        for case, snippet in snippets.items():
            with self.subTest(case=case):
                self.assertEqual(history_doc_problems(self.elsewhere(snippet)), [])

    def test_section_heading_not_on_its_own_line_does_not_start_the_section(self):
        for separator in (" ", " ", "\u0085", "\x0b", "\x0c"):
            with self.subTest(separator=repr(separator)):
                modified = self.replace_heading(f"### Other section\n\nExample text{separator}{SECTION_HEADING}")
                self.assertTrue(history_doc_problems(modified))

    def test_section_heading_in_code_block_does_not_start_the_section(self):
        for fence, closer in (("~~~", "~~~"), ("```text", "```"), ("````", "````")):
            with self.subTest(fence=fence):
                modified = self.replace_heading(f"### Other section\n\n{fence}\n{SECTION_HEADING}\n{closer}")
                self.assertTrue(history_doc_problems(modified))

    def test_parent_heading_hidden_or_shadowed_fails(self):
        cases = {
            "코드 블록 안 부모": self.notes.replace(PARENT_HEADING, f"## 다른 장\n\n```\n{PARENT_HEADING}\n```", 1),
            "사이에 낀 2단계 제목": self.notes.replace(SECTION_HEADING, f"## 다른 장\n\n{SECTION_HEADING}", 1),
            "사이에 낀 밑줄 제목": self.notes.replace(SECTION_HEADING, f"다른 장\n---\n\n{SECTION_HEADING}", 1),
            "사이에 낀 목록 안 제목": self.notes.replace(SECTION_HEADING, f"- ## 다른 장\n\n{SECTION_HEADING}", 1),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(history_doc_problems(modified))

    def test_heading_moved_or_duplicated_fails(self):
        cases = {
            "삭제": self.notes.replace(SECTION_HEADING, "### 다른 제목", 1),
            "중복": self.notes.replace(SECTION_HEADING, f"{SECTION_HEADING}\n\n{SECTION_HEADING}", 1),
            "수준 변경": self.notes.replace(SECTION_HEADING, "#" + SECTION_HEADING, 1),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertTrue(history_doc_problems(modified))

    def test_line_helpers_follow_commonmark(self):
        self.assertEqual(split_lines("가 나\r\n다\r라"), ["가 나", "다", "라"])
        self.assertTrue(is_blank(" \t "))
        for line in (" ", "　", " ", "​"):
            with self.subTest(line=repr(line)):
                self.assertFalse(is_blank(line))
        self.assertEqual(boundaries(["### 가상", "첫 줄", "둘째 줄", "---", "", "셋째", "==="]),
                         [(0, 3), (1, 2), (5, 1)])
        self.assertEqual(boundaries(["앞 글", " ", "뒤 글", "---"]), [(0, 2)])


if __name__ == "__main__":
    unittest.main()
