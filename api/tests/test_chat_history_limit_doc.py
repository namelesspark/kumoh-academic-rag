"""채팅 기록 40개 한도 절(#170)에 전송 실패 규칙(#173) 네 가지가 적혀 있는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 한 파일만 읽는다.
절은 `## 질문 수정·다시 답하기와 답변 버전 (#140)` 아래의 `### 기록 40개 한도와 차례 단위 자르기 (#170)`이다.

마크다운 문법을 다 해석하지 않는다. 대신 문서가 쓰는 문법을 좁혀, 좁힌 범위 안에서는 판정이 정확하게 한다.
1. 문서 규칙: 코드 블록 울타리(백틱·`~` 세 개 이상)는 들여쓰기·목록·인용 없이 줄 맨 앞에만 두고 짝을 맞춘다.
   코드 블록 밖에서는 백틱 코드 조각 안이 아니면 HTML(`<글자`, `<!`, `<?`, `</`)을 쓰지 않는다.
   이 규칙을 어기면 검사가 실패한다. 그러면 줄 맨 앞 `###` 줄이 숨는 곳은 맨 앞 코드 블록 안뿐이다.
2. 시작 제목과 부모 제목: 코드 블록 밖에 있는, 문자열이 정확히 같은 줄 하나만 제목으로 친다.
3. 절 끝: 제목이 될 수 있는 줄은 코드 블록·목록·인용 안이어도 모두 경계로 본다(넓게 잡아 실패 쪽으로 기운다).
   - 앞 공백·목록 기호·인용 기호를 걷어 낸 뒤 `#`~`######`와 공백으로 시작하는 줄
   - 글 줄 바로 아래 `=`나 `-`만 있는 줄(밑줄 제목). 경계는 밑줄 위 글 줄이다.
4. 규칙 문구는 절 안 코드 블록 밖의 글에서 찾는다.
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
CODE_SPAN = re.compile(r"(`+)(?!`).*?(?<!`)\1(?!`)")
HTML_LIKE = re.compile(r"<[A-Za-z!?/]")

# 절에 꼭 남아야 하는 규칙 문구. 확정 기록 경계, 새 대화 예외, 실패 뒤 저장, 재시도 한 차례.
REQUIRED = (
    "확정 기록에도 같은 경계를 적용한다",
    "확정 기록이 없는 새 대화는 예외",
    "일반 실패 뒤에도 저장한다",
    "한 차례만 더한다",
    "committedMessages",
)


def strip_container(line):
    return line[CONTAINER.match(line).end() :]


def code_blocks(lines):
    """(코드 블록 안 줄 번호 집합, 문서 규칙 위반 목록). 울타리 줄도 코드 블록에 넣는다."""
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
                # 들여쓴 닫는 울타리는 마크다운에 따라 닫힐 수도 있어 판정이 갈린다.
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
        if HTML_LIKE.search(CODE_SPAN.sub("", line)):
            problems.append(f"{number}번째 줄: 코드 조각 밖에서 HTML을 쓰지 않는다.")
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
    """#140 절 아래 #170 절에서 코드 블록 밖 글. 문서 규칙을 어기거나 제목을 찾지 못하면 None."""
    lines = text.splitlines()
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
    lines = notes.splitlines()
    problems = code_blocks(lines)[1]
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
        self.assertEqual(code_blocks(self.notes.splitlines())[1], [])

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
        # 해석이 갈릴 수 있는 문법은 넣기만 해도 실패한다.
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
        }
        for case, snippet in snippets.items():
            with self.subTest(case=case):
                self.assertTrue(history_doc_problems(self.before_rules(snippet)))

    def test_html_inside_code_is_allowed(self):
        snippets = {
            "코드 조각": "가상 `<h3>`와 `` <!-- `` 표기",
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
        }
        for case, snippet in snippets.items():
            with self.subTest(case=case):
                self.assertEqual(history_doc_problems(self.before_rules(snippet)), [])

    def test_section_heading_in_code_block_does_not_start_the_section(self):
        for fence in ("~~~", "```text", "````"):
            with self.subTest(fence=fence):
                closer = fence.rstrip("text")
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
