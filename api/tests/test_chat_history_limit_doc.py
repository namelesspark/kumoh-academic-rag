"""채팅 기록 40개 한도 절(#170)에 전송 실패 규칙(#173) 네 가지가 적혀 있는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 한 파일만 읽는다.
절은 `## 질문 수정·다시 답하기와 답변 버전 (#140)` 아래의 `### 기록 40개 한도와 차례 단위 자르기 (#170)`이다.
절 범위는 그 제목 다음 줄부터 같은 수준 이상(`#`~`###`)의 다음 제목 앞까지이고, 안쪽 `####` 제목은 절에 포함한다.
코드 블록 안 `#` 줄은 제목으로 보지 않고, HTML 주석 안 글은 화면에 보이지 않으므로 걷어 내고 읽는다.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UI_NOTES = ROOT / "web" / "docs" / "UI_NOTES.md"

PARENT_HEADING = "## 질문 수정·다시 답하기와 답변 버전 (#140)"
SECTION_HEADING = "### 기록 40개 한도와 차례 단위 자르기 (#170)"
RULES_HEADING = "#### 전송 실패와 다시 시도 (#173)"
# 마크다운 제목과 코드 울타리는 앞 공백 세 칸까지 허용한다. 네 칸부터는 들여쓴 코드다.
HEADING = re.compile(r" {0,3}(#{1,6})(?=[ \t]|$)")
FENCE = re.compile(r" {0,3}(```|~~~)")

# 절에 꼭 남아야 하는 규칙 문구. 확정 기록 경계, 새 대화 예외, 실패 뒤 저장, 재시도 한 차례.
REQUIRED = (
    "확정 기록에도 같은 경계를 적용한다",
    "확정 기록이 없는 새 대화는 예외",
    "일반 실패 뒤에도 저장한다",
    "한 차례만 더한다",
    "committedMessages",
)


def visible_text(text):
    """HTML 주석을 걷어 낸 글. 닫히지 않은 주석은 문서 끝까지 숨은 것으로 본다."""
    return re.sub(r"<!--.*?(?:-->|\Z)", "", text, flags=re.DOTALL)


def headings(lines):
    """코드 블록 밖 제목 줄의 (줄 번호, 수준) 목록."""
    found, fenced = [], False
    for index, line in enumerate(lines):
        if FENCE.match(line):
            fenced = not fenced
            continue
        match = None if fenced else HEADING.match(line)
        if match:
            found.append((index, len(match.group(1))))
    return found


def history_section(text):
    """#140 절 아래 #170 절 본문. 제목이 한 번이 아니거나 #140 절 밖에 있으면 None."""
    lines = text.splitlines()
    marks = headings(lines)
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
    section = history_section(visible_text(notes))
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
        }
        passing = {"코드 블록 제목", "들여쓴 코드", "들여쓴 울타리 제목"}
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
