"""「공용 선택 메뉴 Tab 닫기 규칙」 절(#224)에 합의한 규칙 줄이 그대로 있는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 한 파일만 읽는다. 구현(`chat.js`)은 읽지 않으므로 구현 브랜치 없이도 돈다.
숨은 줄(최상위 코드 블록·HTML 블록)과 제목 판정은 `test_chat_history_limit_doc.py`의 CommonMark 줄 규칙을 그대로 쓴다.

- 절은 숨지 않은 줄 가운데 `## 공용 선택 메뉴 Tab 닫기 규칙` 제목이 정확히 한 번 있는 2단계 절이다.
  끝은 시작 제목 뒤 첫 제목이며 단계와 상관없이 끊는다. 하위 절로 옮긴 규칙 줄은 이 절 것으로 세지 않는다.
- 절 본문의 숨지 않은 빈 줄 아닌 줄은 머리 문단(INTRO)과 규칙 줄(RULE_LINES)과 차례까지 똑같아야 한다.
  줄 일부만 찾으면 조건을 뒤집거나 단서를 붙여도 통과하고, 줄을 더 받으면 반대 설명을 덧붙여도 통과하기 때문이다.
- 다른 문서 검사의 절 끝 판정은 바꾸지 않는다. 이 절은 문서 맨 끝 「답변 모드 선택 표시 시간 규칙」 장 뒤에 둔다.
규칙을 고칠 때는 아래 줄도 함께 고친다.
"""

import unittest
from pathlib import Path

from test_chat_history_limit_doc import block_lines, headings, split_lines

ROOT = Path(__file__).resolve().parents[2]
UI_NOTES = ROOT / "web" / "docs" / "UI_NOTES.md"

SECTION_HEADING = "## 공용 선택 메뉴 Tab 닫기 규칙"
NEIGHBOR_HEADING = "## 답변 모드 선택 표시 시간 규칙"

INTRO = (
    "버튼으로 여는 선택 메뉴는 모두 `chat.js`의 `openChoiceMenu` 하나로 연다(#224). "
    "keydown에서 메뉴를 바로 지우면 초점을 가진 항목이 먼저 사라져 브라우저의 Tab 이동이 문서 처음으로 간다. "
    "그래서 닫기는 Tab 기본 동작 뒤로 미루고, 그 예약의 효력만 정리한다."
)

RULE_LINES = {
    "적용 대상": "- 적용 대상: 답변 모드, 테마, 머리글 언어, 로그인 언어 메뉴가 모두 이 규칙을 따른다.",
    # 메뉴는 문서 끝에 붙고 항목은 Tab 순서에서 빠지므로 Tab 뒤 초점의 목적지는 적지 않는다.
    "Tab·Shift+Tab": "- Tab·Shift+Tab: 기본 동작을 막지 않으므로 초점은 브라우저의 기본 Tab 이동을 따르고, "
                     "메뉴는 예약한 닫기로 닫힌다. 닫을 때 초점을 버튼으로 돌리지 않고 버튼의 `aria-expanded`만 `false`로 바꾼다.",
    "Esc": "- Esc: 메뉴를 바로 닫고 초점을 메뉴를 연 버튼으로 돌린다. Enter·Space·방향키 동작은 이 규칙과 상관없이 그대로다.",
    "예약 한 건": "- 예약 한 건: Tab 닫기 예약은 메뉴마다 많아야 한 건이고 Tab을 거듭 눌러도 쌓이지 않는다. "
             "메뉴를 닫거나 다른 메뉴로 바꾸면 `clearTimeout`으로 지우므로 이전 예약은 효력을 잃는다.",
    "한 번만 닫기": "- 한 번만 닫기: `close()`는 처음 한 번만 효과를 낸다. "
              "이미 닫힌 메뉴에 다시 불러도 펼침 속성·초점·선택 표시를 건드리지 않는다.",
    "새 메뉴 유지": "- 새 메뉴 유지: 같은 버튼으로 다시 열거나 다른 메뉴를 열면 "
              "새 메뉴의 펼침 상태(`aria-expanded=\"true\"`)와 새 메뉴 항목의 초점이 그대로 남는다.",
    "검사": "- 검사: `api/tests/web/chat_stream.test.mjs`가 가상 DOM과 가상 타이머로 위 동작을 확인하고, "
          "`api/tests/test_choice_menu_tab_doc.py`가 이 절의 목록 줄을 글자 그대로 본다. "
          "실제 브라우저의 Tab 순서는 가상 DOM으로 확인할 수 없다.",
}

EXPECTED = [INTRO, *RULE_LINES.values()]


def section_body(notes):
    """(절 본문의 숨지 않은 빈 줄 아닌 줄 목록, 문제). 제목이 한 번이 아니면 본문은 None."""
    lines = split_lines(notes)
    fenced, html = block_lines(lines)
    hidden = fenced | html
    marks = headings(lines, hidden)
    starts = [index for index, _ in marks if lines[index] == SECTION_HEADING]
    if len(starts) != 1:
        return None, f"코드 블록·HTML 밖에 {SECTION_HEADING!r} 제목이 한 번 있어야 한다."
    start = starts[0]
    end = next((index for index, _ in marks if index > start), len(lines))
    body = [lines[index] for index in range(start + 1, end)
            if index not in hidden and lines[index].strip(" \t")]
    return body, None


def choice_menu_doc_problems(notes):
    body, problem = section_body(notes)
    if body is None:
        return [problem]
    problems = [f"절에 {case} 규칙 줄이 그대로 없다." for case, line in RULE_LINES.items() if line not in body]
    if INTRO not in body:
        problems.append("절에 머리 문단이 그대로 없다.")
    if body != EXPECTED:
        extra = [line for line in body if line not in EXPECTED]
        problems.append(f"절 본문이 합의한 줄과 차례가 다르다. 더 있는 줄: {extra}")
    return problems


class ChoiceMenuTabDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")
        start = cls.notes.index(SECTION_HEADING + "\n")
        cls.section = cls.notes[start:]
        cls.emptied = cls.section
        for line in RULE_LINES.values():
            cls.emptied = cls.emptied.replace(line + "\n", "")
        cls.rules_text = "\n".join(RULE_LINES.values())

    def replace(self, old, new, text=None):
        source = self.notes if text is None else text
        self.assertEqual(source.count(old), 1, old)
        return source.replace(old, new, 1)

    def without(self, line):
        return self.replace(line + "\n", "")

    def test_section_has_rules(self):
        self.assertEqual(choice_menu_doc_problems(self.notes), [])

    def test_section_follows_neighbor_at_document_end(self):
        # 마지막 장 뒤에 두어야 「다음 `## ` 제목」이나 파일 끝으로 절 끝을 정하는 기존 검사의 판정이 그대로다.
        self.assertLess(self.notes.index(NEIGHBOR_HEADING + "\n"), self.notes.index(SECTION_HEADING + "\n"))
        self.assertNotIn("\n#", self.section[len(SECTION_HEADING):])

    def test_each_rule_removed_fails(self):
        for case, line in RULE_LINES.items():
            with self.subTest(case=case):
                self.assertIn(f"절에 {case} 규칙 줄이 그대로 없다.", choice_menu_doc_problems(self.without(line)))

    def test_rule_moved_elsewhere_fails(self):
        for case, line in RULE_LINES.items():
            removed = self.without(line)
            places = {
                "이웃 장": self.replace(SECTION_HEADING + "\n", f"{line}\n\n{SECTION_HEADING}\n", removed),
                "절 안 코드 블록": removed + f"\n```text\n{line}\n```\n",
                "절 안 주석": removed + f"\n<!--\n{line}\n-->\n",
                "절 안 하위 절": removed + f"\n### 가상 하위 절\n\n{line}\n",
                "들여쓴 줄": self.replace(SECTION_HEADING + "\n", f"{SECTION_HEADING}\n\n    {line}\n", removed),
            }
            for place, modified in places.items():
                with self.subTest(case=case, place=place):
                    self.assertIn(f"절에 {case} 규칙 줄이 그대로 없다.", choice_menu_doc_problems(modified))

    def test_all_rules_only_outside_section_fail(self):
        emptied = self.replace(self.section, self.emptied)
        cases = {
            "이웃 장": self.replace(SECTION_HEADING + "\n", f"{self.rules_text}\n\n{SECTION_HEADING}\n", emptied),
            "코드 블록": emptied + f"\n```text\n{self.rules_text}\n```\n",
            "주석": emptied + f"\n<!--\n{self.rules_text}\n-->\n",
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                problems = choice_menu_doc_problems(modified)
                for rule in RULE_LINES:
                    self.assertIn(f"절에 {rule} 규칙 줄이 그대로 없다.", problems)

    def test_opposite_statement_added_fails(self):
        last = RULE_LINES["검사"]
        cases = {
            # 줄 끝에 단서를 붙이거나, 반대 목록 줄·문단을 따로 덧붙인다.
            "Tab 초점 단서": (RULE_LINES["Tab·Shift+Tab"],
                           RULE_LINES["Tab·Shift+Tab"] + " 단, 로그인 언어 메뉴는 버튼으로 초점을 돌린다."),
            "반대 목록 줄": (last, last + "\n- Tab으로 닫을 때도 초점을 버튼으로 돌린다."),
            "반대 문단": (last, last + "\n\n예약은 메뉴마다 여러 건 남을 수 있다."),
            "기본 동작 막음": ("기본 동작을 막지 않으므로", "기본 동작을 막으므로"),
            "초점 빼앗음": ("초점을 버튼으로 돌리지 않고", "초점을 버튼으로 돌리고"),
            "목적지 단정": ("브라우저의 기본 Tab 이동을 따르고", "메뉴 밖 다음·이전 요소로 옮겨 가고"),
            "예약 쌓임": ("쌓이지 않는다.", "쌓인다."),
            "이전 예약 효력": ("이전 예약은 효력을 잃는다.", "이전 예약도 그대로 실행된다."),
            "여러 번 닫기": ("처음 한 번만 효과를 낸다.", "부를 때마다 효과를 낸다."),
            "새 메뉴 닫힘": ("초점이 그대로 남는다.", "초점이 사라진다."),
            "대상 빠짐": ("테마, 머리글 언어, 로그인 언어", "테마, 머리글 언어"),
            "Esc 초점": ("초점을 메뉴를 연 버튼으로 돌린다.", "초점을 그 자리에 둔다."),
            "검사 파일 바뀜": ("`api/tests/web/chat_stream.test.mjs`", "`api/tests/web/chat_screen.test.mjs`"),
        }
        for case, (old, new) in cases.items():
            with self.subTest(case=case):
                self.assertIn(old, self.section)
                self.assertTrue(choice_menu_doc_problems(self.replace(self.section, self.section.replace(old, new, 1))))

    def test_heading_missing_hidden_or_duplicated_fails(self):
        cases = {
            "삭제": self.replace(SECTION_HEADING + "\n", "## 다른 제목\n"),
            "중복": self.replace(SECTION_HEADING + "\n", f"{SECTION_HEADING}\n\n{SECTION_HEADING}\n"),
            "3단계로 내림": self.replace(SECTION_HEADING + "\n", "#" + SECTION_HEADING + "\n"),
            "코드 블록 안 제목": self.replace(SECTION_HEADING + "\n", f"```\n{SECTION_HEADING}\n```\n"),
            "주석 안 제목": self.replace(SECTION_HEADING + "\n", f"<!--\n{SECTION_HEADING}\n-->\n"),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertTrue(choice_menu_doc_problems(modified))


if __name__ == "__main__":
    unittest.main()
