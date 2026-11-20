"""채팅 기록 40개 한도 절(#170)에 전송 실패 규칙(#173) 네 가지가 적혀 있는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 한 파일만 읽는다.
절은 `## 질문 수정·다시 답하기와 답변 버전 (#140)` 아래의 `### 기록 40개 한도와 차례 단위 자르기 (#170)`이다.
절 범위는 그 제목 다음 줄부터 같은 수준 이상(`#`~`###`)의 다음 제목 앞까지이고, 안쪽 `####` 제목은 절에 포함한다.
밑줄 제목(`===`는 1단계, `---`는 2단계)도 제목으로 센다. 코드 블록은 여는 울타리와 같은 문자, 같거나 긴 길이로만
닫히고 그 안의 `#` 줄은 제목으로 보지 않는다. `***`·`---` 같은 구분선은 글 줄로 치지 않는다.
제목을 가리는 주석은 줄 맨 앞 `<!--`로 시작하는 주석 블록뿐이다. 문단 안 주석은 글만 숨기고,
코드 블록과 백틱 코드 조각 안의 `<!--`는 글자 그대로 둔다.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UI_NOTES = ROOT / "web" / "docs" / "UI_NOTES.md"

PARENT_HEADING = "## 질문 수정·다시 답하기와 답변 버전 (#140)"
SECTION_HEADING = "### 기록 40개 한도와 차례 단위 자르기 (#170)"
RULES_HEADING = "#### 전송 실패와 다시 시도 (#173)"
# 마크다운 제목과 코드 울타리는 앞 공백 세 칸까지 허용한다. 네 칸부터는 들여쓴 코드다(CommonMark 기준).
HEADING = re.compile(r" {0,3}(#{1,6})(?=[ \t]|$)")
# 여는 울타리는 같은 문자 세 개 이상이다. 백틱 울타리 뒤 설명 글에는 백틱이 올 수 없다.
FENCE_OPEN = re.compile(r" {0,3}(`{3,}(?=[^`]*$)|~{3,})")
# 밑줄 제목(setext): 글 줄 바로 아래의 `=` 줄은 1단계, `-` 줄은 2단계 제목이다.
SETEXT = re.compile(r" {0,3}(=+|-+)[ \t]*$")
# 주석 블록: 줄 맨 앞(공백 세 칸까지)의 `<!--`로 시작한다.
COMMENT_BLOCK = re.compile(r" {0,3}<!--")
# 문단 안에서 읽는 조각: 백틱 코드 조각(같은 길이 백틱으로 닫힘), 닫힌 주석, 닫히지 않은 주석 시작.
INLINE = re.compile(r"(`+).*?(?<!`)\1(?!`)|<!--.*?-->|<!--")
# 구분선: 같은 기호(`*`·`-`·`_`) 세 개 이상과 공백만 있는 줄이다.
THEMATIC = re.compile(r" {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$")
# 목록·인용 줄 아래 밑줄은 제목이 아니다(`-`는 구분선, `=`는 이어 쓴 글).
NOT_PARAGRAPH = re.compile(r" {0,3}([-*+][ \t]|\d{1,9}[.)][ \t]|>)")


def closes_fence(line, opener):
    """여는 울타리와 같은 문자로, 길이가 같거나 길고, 뒤에 공백만 있으면 닫는 울타리다."""
    char, size = opener
    match = re.fullmatch(rf" {{0,3}}({re.escape(char)}{{{size},}})[ \t]*", line)
    return match is not None

# 절에 꼭 남아야 하는 규칙 문구. 확정 기록 경계, 새 대화 예외, 실패 뒤 저장, 재시도 한 차례.
REQUIRED = (
    "확정 기록에도 같은 경계를 적용한다",
    "확정 기록이 없는 새 대화는 예외",
    "일반 실패 뒤에도 저장한다",
    "한 차례만 더한다",
    "committedMessages",
)


def inline_text(line, comment):
    """문단 한 줄에서 보이는 글과, 줄 끝에 문단 안 주석이 열려 있는지.

    백틱 코드 조각 안의 `<!--`·`-->`는 글자 그대로 둔다. 같은 줄에서 닫힌 주석은 지우고,
    닫히지 않은 주석은 줄 끝까지 숨긴 뒤 다음 줄로 넘긴다.
    """
    if comment:
        end = line.find("-->")
        if end < 0:
            return "", True
        line = line[end + 3 :]
    kept, position = "", 0
    for match in INLINE.finditer(line):
        kept += line[position : match.start()]
        position = match.end()
        if match.group(1):
            kept += match.group(0)
            continue
        if not match.group(0).endswith("-->"):
            return kept, True
    return kept + line[position:], False


def scan(text):
    """화면에 보이는 줄 목록과 제목의 (제목 글 줄 번호, 수준) 목록을 한 번에 만든다.

    제목을 가릴 수 있는 주석은 줄 맨 앞(공백 세 칸까지)에서 `<!--`로 시작하는 주석 블록뿐이고,
    `-->`가 있는 줄에서 끝난다. 닫히지 않으면 문서 끝까지 숨는다. 문단 안 주석과 백틱 코드 조각은
    줄 구조를 바꾸지 않으므로 제목 판정에는 원래 줄을 쓰고, 보이는 글에서만 주석을 지운다.
    밑줄 제목은 밑줄 위 글 줄 번호를 쓴다.
    """
    visible, found = [], []
    opener, block, paragraph, comment = None, False, False, False
    for index, line in enumerate(text.splitlines()):
        if opener:
            visible.append(line)
            if closes_fence(line, opener):
                opener = None
            continue
        if block or COMMENT_BLOCK.match(line):
            start = 0 if block else line.find("<!--") + 4
            block = "-->" not in line[start:]
            visible.append("")
            paragraph = comment = False
            continue
        fence = FENCE_OPEN.match(line)
        heading = HEADING.match(line)
        underline = SETEXT.match(line) if paragraph else None
        if fence or heading or underline or THEMATIC.match(line) or not line.strip():
            # 블록이 바뀌면 문단이 끝나므로, 닫히지 않은 문단 안 주석도 여기서 끝난다.
            paragraph = comment = False
            if fence:
                opener = (fence.group(1)[0], len(fence.group(1)))
            if heading:
                found.append((index, len(heading.group(1))))
            if underline:
                found.append((index - 1, 1 if underline.group(1)[0] == "=" else 2))
            visible.append(inline_text(line, False)[0] if heading else line)
            continue
        # 빈 줄 다음의 네 칸 들여쓰기는 들여쓴 코드라 글 줄이 아니다.
        if line.startswith("    ") and not paragraph:
            visible.append(line)
            continue
        text_line, comment = inline_text(line, comment)
        visible.append(text_line)
        paragraph = not NOT_PARAGRAPH.match(line)
    return visible, found


def history_section(text):
    """#140 절 아래 #170 절의 보이는 본문. 제목이 한 번이 아니거나 #140 절 밖에 있으면 None."""
    lines, marks = scan(text)
    starts = [index for index, _ in marks if lines[index] == SECTION_HEADING]
    if len(starts) != 1:
        return None
    start = starts[0]
    parent = next((index for index, level in reversed(marks) if index < start and level <= 2), None)
    if parent is None or lines[parent] != PARENT_HEADING:
        return None
    end = next((index for index, level in marks if index > start and level <= 3), len(lines))
    return "\n".join(lines[start + 1 : end])


def history_doc_problems(notes):
    section = history_section(notes)
    if section is None:
        return [f"{PARENT_HEADING!r} 아래에 {SECTION_HEADING!r} 제목이 한 번 있어야 한다."]
    return [f"절에 {phrase!r}이(가) 없다." for phrase in REQUIRED if phrase not in section]


class ChatHistoryLimitDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")
        cls.section = history_section(cls.notes)

    def test_section_has_failure_rules(self):
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
            # 같은 수준의 다음 절(### 검사)로 옮긴 경우.
            "다음 절": self.notes.replace(self.section, emptied, 1).replace("### 검사", f"### 검사\n\n{rules}", 1),
            # 절 안에 새 ### 제목을 끼워 문구를 그 뒤로 밀어낸 경우.
            "새 제목": self.notes.replace(self.section, f"{emptied}\n### 다른 절\n\n{self.section}", 1),
            # 문서 맨 위 다른 ## 절에만 있는 경우.
            "다른 장": self.notes.replace(self.section, emptied, 1).replace("## 화면 구성", f"## 화면 구성\n\n{rules}", 1),
            "주석": self.notes.replace(self.section, f"<!--{self.section}-->", 1),
            "코드 블록 제목": self.notes.replace(self.section, f"\n```\n### 가짜\n```\n{self.section}", 1),
            # 앞 공백 세 칸까지는 마크다운 제목이다. 규칙 앞에 끼우면 규칙이 그 절로 넘어간다.
            "들여쓴 제목": self.notes.replace(RULES_HEADING, f"   ### 다른 절\n\n{RULES_HEADING}", 1),
            # 네 칸부터는 들여쓴 코드라 절을 끊지 않는다.
            "들여쓴 코드": self.notes.replace(RULES_HEADING, f"    ### 들여쓴 코드\n\n{RULES_HEADING}", 1),
            "들여쓴 울타리 제목": self.notes.replace(RULES_HEADING, f"   ```\n### 가짜\n   ```\n\n{RULES_HEADING}", 1),
            # `~~~`는 백틱 울타리를 닫지 못한다. 세 번째 줄이 울타리를 닫고 그 뒤 제목이 절을 끊는다.
            "섞인 울타리": self.notes.replace(RULES_HEADING, f"```\n~~~\n```\n\n### 다른 절\n\n{RULES_HEADING}", 1),
            # 짧은 울타리는 긴 울타리를 닫지 못하므로 그 안의 제목은 글이다.
            "긴 울타리": self.notes.replace(RULES_HEADING, f"````\n```\n### 가짜\n````\n\n{RULES_HEADING}", 1),
            "밑줄 2단계 제목": self.notes.replace(RULES_HEADING, f"다른 절\n-----------------\n\n{RULES_HEADING}", 1),
            "밑줄 1단계 제목": self.notes.replace(RULES_HEADING, f"다른 장\n=======\n\n{RULES_HEADING}", 1),
            # 빈 줄이나 목록 아래의 `---`는 구분선이라 절을 끊지 않는다.
            "구분선": self.notes.replace(RULES_HEADING, f"---\n\n{RULES_HEADING}", 1),
            "목록 아래 구분선": self.notes.replace(RULES_HEADING, f"- 가상 목록\n---\n\n{RULES_HEADING}", 1),
            # 구분선 아래 `---`도 구분선이다. 앞 구분선을 글 줄로 보면 밑줄 제목으로 오인한다.
            "연이은 구분선": self.notes.replace(RULES_HEADING, f"***\n---\n\n{RULES_HEADING}", 1),
            # 코드 블록 안 `<!--`·`-->`는 글자일 뿐이라, 두 블록 사이의 제목이 절을 끊는다.
            "코드 블록 안 주석 기호": self.notes.replace(
                RULES_HEADING, f"~~~text\n<!--\n~~~\n\n### 다른 절\n\n~~~text\n-->\n~~~\n\n{RULES_HEADING}", 1),
            # 주석 안 울타리는 코드 블록을 열지 못하므로 그 뒤 제목이 절을 끊는다.
            "주석 안 울타리": self.notes.replace(RULES_HEADING, f"<!--\n```\n-->\n\n### 다른 절\n\n{RULES_HEADING}", 1),
            # 주석 안 제목은 보이지 않으므로 절을 끊지 않는다.
            "주석 안 제목": self.notes.replace(RULES_HEADING, f"<!--\n### 숨은 제목\n-->\n\n{RULES_HEADING}", 1),
            # 백틱 코드 조각 안 `<!--`·`-->`는 글자라서 그 사이 제목이 절을 끊는다.
            "코드 조각 안 주석 기호": self.notes.replace(
                RULES_HEADING, f"Literal `<!--`.\n\n### Other section\n\nLiteral `-->`.\n\n{RULES_HEADING}", 1),
            # 문단 안 주석은 빈 줄을 넘지 못한다. 닫히지 않은 채 빈 줄을 만나면 다음 제목은 그대로 보인다.
            "문단 안 닫히지 않은 주석": self.notes.replace(
                RULES_HEADING, f"가상 글 <!--\n\n### 다른 절\n\n-->\n\n{RULES_HEADING}", 1),
            # 같은 줄에서 닫힌 문단 안 주석은 그 글만 숨긴다.
            "문단 안 주석으로 숨긴 규칙": self.notes.replace(
                self.section, self.section.replace(REQUIRED[3], f"<!--{REQUIRED[3]}-->"), 1),
            # 여러 줄에 걸친 문단 안 주석도 닫힐 때까지 글을 숨긴다.
            "문단 안 여러 줄 주석으로 숨긴 규칙": self.notes.replace(
                self.section, self.section.replace(REQUIRED[2], f"<!--\n{REQUIRED[2]}\n-->"), 1),
        }
        passing = {
            "코드 블록 제목", "들여쓴 코드", "들여쓴 울타리 제목", "긴 울타리",
            "구분선", "목록 아래 구분선", "연이은 구분선", "주석 안 제목",
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertNotEqual(modified, self.notes)
                expected_fail = case not in passing
                self.assertEqual(bool(history_doc_problems(modified)), expected_fail)

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
