"""채팅 기록 40개 한도 절(#170)에 전송 실패 규칙(#173) 네 가지가 적혀 있는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 한 파일만 읽는다. 프로젝트와 표준 라이브러리에는 마크다운 해석기가 없다.
절은 `## 질문 수정·다시 답하기와 답변 버전 (#140)` 아래의 `### 기록 40개 한도와 차례 단위 자르기 (#170)`이다.

판정은 세 층으로 나눈다. 절 밖 문서는 경계 판정에 필요한 것만 본다.

1. 문서 전체: 숨은 줄만 가린다(`hidden_lines`). CommonMark에서 줄 맨 앞 `#` 제목을 숨길 수 있는 것은
   최상위 코드 블록과 HTML 블록뿐이다. 목록·인용은 줄 맨 앞 제목에서 닫히고, 링크 같은 인라인 문법은
   블록을 넘지 못한다. 두 블록의 시작과 끝은 명세가 줄 단위로 정해 두어 그대로 따른다.
   - 코드 블록: 공백 3칸 이하 뒤 백틱·물결 세 개 이상(백틱 울타리의 설명 글에 백틱이 없을 때)으로 열고,
     공백 3칸 이하 뒤 같은 문자·같거나 긴 길이·뒤에 공백만 있는 줄로 닫는다.
   - HTML 블록: 공백 3칸 이하 뒤 `<`로 시작하는 줄. 주석·처리 명령·선언·CDATA와 script·pre·style·textarea는
     짝이 되는 끝 표시가 있는 줄까지, 그 밖의 태그는 빈 줄까지 숨긴다.
   목록·인용 안에서 시작한 블록은 그 목록·인용이 줄 맨 앞 제목에서 닫히므로 제목을 숨기지 못해 따지지 않는다.
   목록 이어 쓰기 안의 울타리(예: 목록 항목 아래 공백 두 칸 뒤 물결 세 개)를 최상위로 볼 수는 있는데,
   그러면 줄을 더 숨기는 쪽이라 판정은 실패로 기운다. 이런 목록 안 코드 블록은 #170 앞에 두지 않는다.
2. 제목: 숨지 않은 줄 가운데 공백 3칸 이하 뒤 `#`~`######`와 공백으로 시작하는 줄. 시작 제목과 부모 제목은
   이 가운데 문자열이 정확히 같은 줄로 찾는다. 시작 제목은 하나여야 하고, 그 앞 가장 가까운 1·2단계 제목이
   부모 제목이어야 한다. 절 끝은 시작 제목 뒤 첫 1~3단계 제목이다.
3. #140 제목부터 #170 절 끝까지(경계 판정 구간): 장·절 경계가 이 구간에서 흔들리지 않게 좁은 문법만 쓴다.
   - HTML 블록을 두지 않는다(`<h2>` 같은 태그는 화면에서 장 제목이 된다). 코드 블록 예시는 #170 본문 밖이면 둔다.
   - 밑줄 제목(글 줄 바로 아래 공백 3칸 이하의 `=`·`-`만 있는 줄)을 쓰지 않는다. 구분선 앞에는 빈 줄을 둔다.
   - 코드 블록 밖 코드 조각은 한 줄 안의 백틱 한 개 짝으로만 쓰고, 코드 조각 밖에서는 대괄호·꺾쇠·백슬래시를
     쓰지 않는다. 그러면 링크·HTML·이스케이프가 없어 앞에서부터 둘씩 짝지은 백틱이 실제 코드 조각과 같다.
   - #170 본문은 허용 목록만 쓴다: 빈 줄, 줄 맨 앞 `#### ` 소제목, 줄 맨 앞 `- ` 목록, 공백·탭·블록 표시 기호나
     번호 목록 표시로 시작하지 않는 문단 줄. 코드 블록과 HTML 블록도 둘 수 없다. 그러면 본문의 모든 줄이
     화면에 보이는 글이고, 규칙 문구는 이 본문에서 찾는다.

줄은 LF·CRLF·CR로만 나눈다(CommonMark 줄 끝). 빈 줄은 공백·탭만 있는 줄이고, 탭은 4칸 단위로 넓힌다.
검사 문자열에 쓰는 보이지 않는 문자는 소스에 그대로 두지 않고 chr()로 만든다.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UI_NOTES = ROOT / "web" / "docs" / "UI_NOTES.md"

PARENT_HEADING = "## 질문 수정·다시 답하기와 답변 버전 (#140)"
SECTION_HEADING = "### 기록 40개 한도와 차례 단위 자르기 (#170)"
RULES_HEADING = "#### 전송 실패와 다시 시도 (#173)"
LATER_HEADING = "## 학사일정 월 달력 보기 (#143)"
EARLY_HEADING = "## 화면 구성"

# 보이지 않는 문자. 소스에 그대로 두면 편집 도구가 줄을 나누거나 바꿀 수 있어 코드 값으로 만든다.
LINE_SEPARATOR = chr(0x2028)
PARAGRAPH_SEPARATOR = chr(0x2029)
NEXT_LINE = chr(0x85)
NO_BREAK_SPACE = chr(0xA0)
IDEOGRAPHIC_SPACE = chr(0x3000)
EM_SPACE = chr(0x2003)
ZERO_WIDTH_SPACE = chr(0x200B)
TAB = chr(9)
BACKSLASH = chr(92)

FENCE = re.compile(r"(`{3,}|~{3,})(.*)$")
HEADING_LIKE = re.compile(r"(#{1,6})(?=[ \t]|$)")
UNDERLINE_LIKE = re.compile(r"(=+|-+)[ \t]*$")
RAW_HTML_START = re.compile(r"<(?:script|pre|style|textarea)(?=[ \t>]|$)")
RAW_HTML_ENDS = ("</script>", "</pre>", "</style>", "</textarea>")
TAG_START = re.compile(r"</?[a-z]")
DECLARATION_START = re.compile(r"<![a-z]")
# 코드 조각 밖에서 금지하는 문자. 링크·이미지·링크 정의, HTML·자동 링크, 이스케이프를 시작할 수 있다.
INLINE_STARTERS = frozenset("[]<" + BACKSLASH)

# #170 절 본문 허용 목록.
SUBHEADING = re.compile(r"#### (?=[^ \t])")
LIST_ITEM = re.compile(r"- (?=[^ \t])")
# 백틱은 코드 조각으로 줄을 시작할 수 있어 빼고, 울타리는 코드 블록 판정으로 따로 막는다.
BLOCK_STARTERS = frozenset(" \t>#-*+=_|~!:<")
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
    """CommonMark 줄 끝(LF, CRLF, CR)으로만 나눈다. str.splitlines는 U+2028 등에서도 나눠 쓰지 않는다."""
    return text.replace("\r\n", "\n").replace("\r", "\n").split("\n")


def is_blank(line):
    """CommonMark 빈 줄: 공백(U+0020)과 탭만 있는 줄. str.strip()은 U+00A0 같은 유니코드 공백도 지워 쓰지 않는다."""
    return not line.strip(" \t")


def indent_columns(line):
    """줄 앞 공백의 칸 수. 탭은 다음 4의 배수 칸까지 넓힌다(CommonMark 탭 규칙)."""
    columns = 0
    for char in line:
        if char == " ":
            columns += 1
        elif char == "\t":
            columns += 4 - columns % 4
        else:
            break
    return columns


def html_block_end(body):
    """줄이 HTML 블록을 열면 끝 표시 묶음을, 아니면 None을 돌려준다. 빈 묶음은 빈 줄에서 끝난다는 뜻이다."""
    lowered = body.lower()
    if RAW_HTML_START.match(lowered):
        return RAW_HTML_ENDS
    for start, end in (("<!--", "-->"), ("<?", "?>"), ("<![cdata[", "]]>")):
        if lowered.startswith(start):
            return (end,)
    if DECLARATION_START.match(lowered):
        return (">",)
    if TAG_START.match(lowered):
        return ()
    return None


def block_lines(lines):
    """(최상위 코드 블록 줄 집합, 최상위 HTML 블록 줄 집합). 여는 줄과 닫는 줄을 포함한다."""
    fenced, html, fence, html_end = set(), set(), None, None
    for index, line in enumerate(lines):
        if fence:
            fenced.add(index)
            char, size = fence
            if re.fullmatch(rf" {{0,3}}{re.escape(char)}{{{size},}}[ \t]*", line):
                fence = None
            continue
        if html_end is not None:
            html.add(index)
            if (not html_end and is_blank(line)) or any(end in line.lower() for end in html_end):
                html_end = None
            continue
        if indent_columns(line) > 3:
            continue
        body = line.lstrip(" ")
        found = FENCE.match(body)
        if found and not (found.group(1)[0] == "`" and "`" in found.group(2)):
            fenced.add(index)
            fence = (found.group(1)[0], len(found.group(1)))
            continue
        ends = html_block_end(body)
        if ends is not None:
            html.add(index)
            closed = bool(ends) and any(end in body.lower()[2:] for end in ends)
            html_end = None if closed else ends
    return fenced, html


def hidden_lines(lines):
    """최상위 코드 블록·HTML 블록 안의 줄 번호 집합(여는 줄과 닫는 줄 포함)."""
    fenced, html = block_lines(lines)
    return fenced | html


def headings(lines, hidden):
    """숨지 않은 줄 가운데 공백 3칸 이하 뒤 `#` 제목의 (줄 번호, 수준) 목록."""
    found = []
    for index, line in enumerate(lines):
        if index in hidden or indent_columns(line) > 3:
            continue
        heading = HEADING_LIKE.match(line.lstrip(" "))
        if heading:
            found.append((index, len(heading.group(1))))
    return found


def inline_problem(line):
    """경계 판정 구간의 한 줄이 코드 조각 규칙을 어기면 이유를, 지키면 None을 돌려준다."""
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


def plain_text_start(text):
    return bool(text) and text[0] not in BLOCK_STARTERS and not ORDERED_MARKER.match(text)


def section_line_problem(line):
    """#170 본문 한 줄이 허용 목록에 없으면 이유를, 있으면 None을 돌려준다."""
    if is_blank(line) or SUBHEADING.match(line):
        return None
    if LIST_ITEM.match(line):
        return None if plain_text_start(line[2:]) else "목록 항목 글은 블록 표시 기호로 시작하지 않는다."
    if plain_text_start(line):
        return None
    return "빈 줄, `#### ` 소제목, `- ` 목록, 기호로 시작하지 않는 문단 줄만 쓴다."


def find_section(text):
    """(#170 본문 줄 목록, 문제 목록). 문제가 있으면 본문은 None."""
    lines = split_lines(text)
    fenced, html = block_lines(lines)
    hidden = fenced | html
    marks = headings(lines, hidden)
    starts = [index for index, _ in marks if lines[index] == SECTION_HEADING]
    parent = None
    if len(starts) == 1:
        parent = next((index for index, level in reversed(marks) if index < starts[0] and level <= 2), None)
    if parent is None or lines[parent] != PARENT_HEADING:
        return None, [f"{PARENT_HEADING!r} 아래 코드 블록·HTML 밖에 {SECTION_HEADING!r} 제목이 한 번 있어야 한다."]
    start = starts[0]
    end = next((index for index, level in marks if index > start and level <= 3), len(lines))
    problems = []
    for index in range(parent + 1, end):
        line = lines[index]
        if index in html:
            # HTML 블록은 `<h2>`처럼 화면에서 장 제목이 될 수 있어 경계 판정 구간에 두지 않는다.
            problems.append(f"{index + 1}번째 줄: #140 제목부터 #170 절 끝까지는 HTML을 쓰지 않는다.")
            continue
        if index in fenced:
            # 코드 블록 예시는 #140 장에 둘 수 있지만 #170 본문에는 두지 않는다.
            if index > start:
                problems.append(f"{index + 1}번째 줄(#170 절): 코드 블록을 두지 않는다.")
            continue
        if (indent_columns(line) <= 3 and UNDERLINE_LIKE.match(line.lstrip(" "))
                and (index - 1) not in hidden and not is_blank(lines[index - 1])):
            problems.append(f"{index + 1}번째 줄: 밑줄 제목은 쓰지 않고, 구분선 앞에는 빈 줄을 둔다.")
        reason = inline_problem(line)
        if reason:
            problems.append(f"{index + 1}번째 줄: {reason}")
        if index > start:
            reason = section_line_problem(line)
            if reason:
                problems.append(f"{index + 1}번째 줄(#170 절): {reason}")
    return (None, problems) if problems else (lines[start + 1 : end], [])


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

    def insert(self, anchor, text, after=False):
        replacement = f"{anchor}\n\n{text}" if after else f"{text}\n\n{anchor}"
        modified = self.notes.replace(anchor, replacement, 1)
        self.assertNotEqual(modified, self.notes)
        return modified

    def before_rules(self, snippet):
        """#170 본문 안, #173 소제목 바로 앞."""
        return self.insert(RULES_HEADING, snippet)

    def between_parent_and_section(self, snippet):
        """#140 장 안, #170 제목 바로 앞(그 앞 줄은 빈 줄)."""
        return self.insert(SECTION_HEADING, snippet)

    def before_parent(self, snippet):
        """경계 판정 구간 앞, 문서 앞쪽 「## 화면 구성」 제목 아래."""
        return self.insert(EARLY_HEADING, snippet, after=True)

    def after_section(self, snippet):
        """#170 절이 끝난 뒤, 「## 학사일정 월 달력 보기 (#143)」 제목 아래."""
        modified = self.insert(LATER_HEADING, snippet, after=True)
        self.assertGreater(modified.index(snippet), modified.index(SECTION_HEADING))
        return modified

    def replace_body(self, body):
        modified = self.notes.replace(self.section, body, 1)
        self.assertNotEqual(modified, self.notes)
        return modified

    def assert_all(self, make, snippets, passes):
        for case, snippet in snippets.items():
            with self.subTest(case=case):
                problems = history_doc_problems(make(snippet))
                if passes:
                    self.assertEqual(problems, [])
                else:
                    self.assertTrue(problems)

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
            "다른 장": self.notes.replace(self.section, emptied, 1).replace(EARLY_HEADING, f"{EARLY_HEADING}\n\n{rules}", 1),
            "코드 블록 안 규칙": self.notes.replace(self.section, f"\n```text\n{self.section}\n```\n", 1),
            "주석 안 규칙": self.notes.replace(self.section, f"\n<!--\n{self.section}\n-->\n", 1),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(history_doc_problems(modified))

    def test_section_body_allows_only_plain_lines(self):
        self.assert_all(self.before_rules, {
            "앞 공백 세 칸 제목": "   ### 다른 절",
            "앞 공백 네 칸 줄": "    ### Literal",
            "탭 들여쓰기": TAB + "가상 글",
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
            "HTML 제목": "<h3>Other section</h3>",
            "HTML 주석": "<!--\n가상\n-->",
            "같은 줄 주석": "가상 <!-- 숨김 --> 글",
            "pre 블록": "<pre>\n\n가상\n\n</pre>",
            "이스케이프한 백틱 사이 HTML": f"{BACKSLASH}`<h3>Other section</h3>{BACKSLASH}`",
            "줄을 넘는 코드 조각": "가상 `글\n<h3>Other section</h3>\n코드` 끝",
            "두 개 이은 백틱": "가상 `` <h3> `` 글",
            "링크 주소 안 백틱": "[a](/a`) <h3>Other section</h3> [b](/b`)",
            "링크 정의": f"[example{BACKSLASH}]label]: /example '숨은 글'",
            "자동 링크": "<https://example.invalid>",
        }, passes=False)

    def test_plain_lines_keep_the_section(self):
        self.assert_all(self.before_rules, {
            "문단": "가상 글",
            "목록": "- 가상 목록",
            "소제목": "#### 가상 하위 제목",
            "코드 조각": "가상 `<h3>`와 `[data-x]`, `a" + BACKSLASH + "|b` 표기",
            "코드 조각으로 시작": "`가상` 글",
            "U+2028 뒤 글자": "가상 글" + LINE_SEPARATOR + "### 가짜",
            "U+00A0로 시작": NO_BREAK_SPACE + "가상 글",
            "숫자로 시작": "40개 한도",
        }, passes=True)

    def test_whole_section_replaced_by_hidden_text_fails(self):
        joined = " ".join(REQUIRED)
        cases = {
            "여러 줄 밑줄 제목": f"\n{joined}\nOther section\n---\n",
            "여러 줄 밑줄 1단계 제목": f"\n{joined}\n가상 글\nOther section\n===\n",
            "링크 정의 제목 글": f"\n[example{BACKSLASH}]label]: /example '{joined}'\n",
            "U+00A0 줄 뒤 밑줄 제목": f"\n{joined}\n{NO_BREAK_SPACE}\nOther section\n---\n",
            "U+3000 줄 뒤 밑줄 제목": f"\n{joined}\n{IDEOGRAPHIC_SPACE}\nOther section\n---\n",
            "공백 네 칸 들여쓴 코드": f"\n\n    {joined}\n",
            "탭 들여쓴 코드": f"\n\n{TAB}{joined}\n",
            "공백 두 칸과 탭": f"\n\n  {TAB}{joined}\n",
            "들여쓴 제목 같은 줄과 밑줄 제목": f"\n{joined}\n    ### Literal\nOther section\n---\n",
            "인용 안 들여쓴 코드": f"\n\n>     {joined}\n",
        }
        for case, body in cases.items():
            with self.subTest(case=case):
                self.assertTrue(history_doc_problems(self.replace_body(body)))

    def test_syntax_before_the_parent_is_free(self):
        # 경계 판정 구간 앞의 글은 숨은 줄 추적만 받는다(교차 검토 재현: 「## 화면 구성」 아래 링크).
        self.assert_all(self.before_parent, {
            "일반 링크": "[Example](https://example.invalid)",
            "이미지": "![가상](/가상.png)",
            "이스케이프": "가상 " + BACKSLASH + "* 글",
            "닫힌 HTML 주석 안 제목": "<!--\n## 숨은 장\n-->",
            "닫힌 pre 블록 안 제목": "<pre>\n\n## 숨은 장\n\n</pre>",
            "닫힌 코드 블록 안 시작 제목 사본": f"```text\n{SECTION_HEADING}\n```",
            "닫힌 주석 안 시작 제목 사본": f"<!--\n{SECTION_HEADING}\n-->",
            "밑줄 제목": "가상 장\n===",
            "인용 안 울타리": "> ```\n> 가상\n> ```",
            "들여쓴 울타리": "   ```\n### 가짜\n   ```",
        }, passes=True)

    def test_unclosed_blocks_before_the_parent_hide_it(self):
        # 닫히지 않은 최상위 블록은 뒤의 #140·#170 제목까지 숨기므로 실패한다.
        self.assert_all(self.before_parent, {
            "닫히지 않은 주석": "<!--\n가상",
            "닫히지 않은 pre 블록": "<pre>\n가상",
            "닫히지 않은 긴 울타리": "````\n```\n가상\n```",
            "닫히지 않은 처리 명령": "<?가상",
        }, passes=False)

    def test_syntax_after_the_section_is_free(self):
        # #170 절이 끝난 뒤의 글은 시작·부모 제목과 #170 본문에 영향을 주지 않는다(교차 검토 재현 포함).
        self.assert_all(self.after_section, {
            "일반 링크": "[Example](https://example.invalid)",
            "링크 정의": "[가상]: https://example.invalid",
            "HTML 제목": "<h3>가상</h3>",
            "여러 줄 주석 안 시작 제목 사본": f"<!--\n{SECTION_HEADING}\n-->",
            "코드 블록 안 시작 제목 사본": f"```text\n{SECTION_HEADING}\n```",
            "이스케이프": "가상 " + BACKSLASH + "* 글",
            "밑줄 제목": "가상 장\n===",
            "앞 공백 제목": "  ## 가상 장",
            "닫히지 않은 울타리": "````\n가상",
            "닫히지 않은 주석": "<!--\n가상",
        }, passes=True)

    def test_block_level_examples_between_parent_and_section_are_ignored(self):
        # 코드 블록·들여쓴 코드·인용·목록 안의 제목 같은 줄은 #140 장을 나누지 않는다.
        self.assert_all(self.between_parent_and_section, {
            "백틱 코드 블록 안 2단계": "```\n## 가상 제목\n```",
            "물결 코드 블록 안 1단계": "~~~text\n# 가상 제목\n~~~",
            "긴 울타리 안 밑줄 제목": "````\n가상 제목\n---\n```\n````",
            "울타리 뒤 구분선": "```\n가상\n```\n---",
            "공백 네 칸 들여쓴 코드": "    ## 가상 제목",
            "탭 들여쓴 코드": TAB + "## 가상 제목",
            "인용 안 제목": "> ## 가상 제목",
            "목록 안 제목": "- ## 가상 제목",
            "번호 목록 안 제목": "1. ## 가상 제목",
            "인용 안 1단계 제목": "> # 가상 제목",
            "들여쓴 코드 안 밑줄 제목": "    Example title\n    ---",
            "인용 안 밑줄 제목": "> Example title\n> ---",
            "인용 안 밑줄 1단계 제목": "> Example title\n> ===",
            "빈 줄 뒤 구분선": "가상 글\n\n---",
        }, passes=True)

    def test_parent_heading_hidden_or_shadowed_fails(self):
        cases = {
            "코드 블록 안 부모": self.notes.replace(PARENT_HEADING, f"## 다른 장\n\n```\n{PARENT_HEADING}\n```", 1),
            "주석 안 부모": self.notes.replace(PARENT_HEADING, f"## 다른 장\n\n<!--\n{PARENT_HEADING}\n-->", 1),
            "사이에 낀 2단계 제목": self.between_parent_and_section("## 다른 장"),
            "사이에 낀 1단계 제목": self.between_parent_and_section("# 다른 문서"),
            "사이에 낀 밑줄 제목": self.between_parent_and_section("다른 장\n---"),
            "사이에 낀 앞 공백 세 칸 제목": self.between_parent_and_section("   ## 다른 장"),
            "사이에 낀 앞 공백 한 칸 제목": self.between_parent_and_section(" ## 다른 장"),
            "사이에 낀 HTML 제목": self.between_parent_and_section("<h2>다른 장</h2>"),
            "사이에 낀 링크": self.between_parent_and_section("[가상](/가상)"),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(history_doc_problems(modified))

    def test_hidden_section_heading_does_not_start_the_section(self):
        wrappers = {
            "물결 코드 블록": "~~~\n{}\n~~~",
            "백틱 코드 블록": "```text\n{}\n```",
            "긴 울타리": "````\n{}\n````",
            "주석": "<!--\n{}\n-->",
            "pre 블록": "<pre>\n\n{}\n\n</pre>",
            "HTML 블록에 바로 붙음": "<div>\n{}\n</div>",
        }
        for case, wrapper in wrappers.items():
            with self.subTest(case=case):
                modified = self.notes.replace(
                    SECTION_HEADING, "### Other section\n\n" + wrapper.format(SECTION_HEADING), 1)
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(history_doc_problems(modified))

    def test_section_heading_not_on_its_own_line_does_not_start_the_section(self):
        for separator in (LINE_SEPARATOR, PARAGRAPH_SEPARATOR, NEXT_LINE, chr(0x0B), chr(0x0C)):
            with self.subTest(separator=hex(ord(separator))):
                modified = self.notes.replace(
                    SECTION_HEADING, f"### Other section\n\nExample text{separator}{SECTION_HEADING}", 1)
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
        self.assertEqual(split_lines("가" + LINE_SEPARATOR + "나\r\n다\r라"), ["가" + LINE_SEPARATOR + "나", "다", "라"])
        self.assertTrue(is_blank(" " + TAB + " "))
        for char in (NO_BREAK_SPACE, IDEOGRAPHIC_SPACE, EM_SPACE, ZERO_WIDTH_SPACE):
            with self.subTest(char=hex(ord(char))):
                self.assertFalse(is_blank(char))
        self.assertEqual(indent_columns("  " + TAB + "가"), 4)
        lines = ["## 부모", "", "    ## 코드", "> ## 인용", "- ## 목록", "```", "## 예시", "```",
                 "<!--", "## 주석", "-->", "<div>", "## 붙은 줄", "", "### 절"]
        hidden = hidden_lines(lines)
        self.assertEqual(hidden, {5, 6, 7, 8, 9, 10, 11, 12, 13})
        self.assertEqual(headings(lines, hidden), [(0, 2), (14, 3)])
        self.assertEqual(hidden_lines(["<!-- 한 줄 -->", "## 보임"]), {0})
        self.assertEqual(hidden_lines(["   ```", "가", "  ```", "## 보임"]), {0, 1, 2})


if __name__ == "__main__":
    unittest.main()
