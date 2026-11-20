"""필기 패드 압력 규칙(#185)이 실제 문서에서 「- 펜을 떼는 신호(`pointerup`)」 항목의 이어진 줄로 남는지 줄 모양만 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 하나만 읽는다.
절 자르기와 규칙 문장은 `test_handwriting_pressure_doc`의 `sections`·`RULE`을 그대로 쓰고,
목록 항목 나누기(`list_items`)에는 기대지 않는다. 테스트 클래스는 가져오지 않아 전체 탐색에서 같은 검사가 두 번 돌지 않는다.
항목 첫 줄부터 규칙 줄까지 빈 줄과 들여쓰지 않은 줄(공백·탭으로 시작하지 않는 줄)이 없어야 하고,
규칙 줄은 두 칸 들여쓰기 뒤 바로 규칙 문장으로 시작해야 한다(2026-11-20 문서 검사 기준).
"""

import unittest
from pathlib import Path

from api.tests.test_handwriting_pressure_doc import RULE, sections

UI_NOTES = Path(__file__).resolve().parents[2] / "web" / "docs" / "UI_NOTES.md"
ITEM_START = "- 펜을 떼는 신호(`pointerup`)"


def rule_line_problems(notes):
    found = sections(notes)
    if found is None:
        return ["패드 절 아래 「### 교차 검토로 고친 점」 제목이 한 번 있어야 한다."]
    _, review = found
    starts = [index for index, line in enumerate(review) if line.startswith(ITEM_START)]
    if len(starts) != 1:
        return [f"{ITEM_START!r}로 시작하는 줄이 {len(starts)}번 있다. 정확히 한 번이어야 한다."]
    start = starts[0]
    rule_at = next((i for i in range(start, len(review)) if RULE in review[i]), None)
    if rule_at is None or rule_at == start:
        return ["규칙 문장이 항목 첫 줄 아래의 이어진 줄에 없다."]
    problems = []
    for index in range(start + 1, rule_at + 1):
        line = review[index]
        if not line.strip():
            problems.append(f"항목 첫 줄과 규칙 줄 사이에 빈 줄이 있다(항목 첫 줄에서 {index - start}줄 아래).")
        elif not line[:1].isspace():
            problems.append(f"항목 첫 줄과 규칙 줄 사이에 들여쓰지 않은 줄이 있다: {line!r}")
    rule_line = review[rule_at]
    if not rule_line.startswith(f"  {RULE}"):
        problems.append(f"규칙 줄이 두 칸 들여쓰기 뒤 규칙 문장으로 시작하지 않는다: {rule_line!r}")
    return problems


class HandwritingPressureDocLinesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")

    def test_actual_document_keeps_rule_inside_item(self):
        self.assertEqual(rule_line_problems(self.notes), [])

    def test_blank_lines_around_rule_fail(self):
        # 변이 ①: 두 칸 들여쓰기는 두고 앞뒤에 빈 줄을 넣어 문단으로 분리한 경우.
        modified = self.notes.replace(f"\n  {RULE}\n", f"\n\n  {RULE}\n\n", 1)
        self.assertNotEqual(modified, self.notes)
        problems = rule_line_problems(modified)
        self.assertEqual(len(problems), 1, problems)
        self.assertIn("빈 줄", problems[0])

    def test_unindented_rule_fails(self):
        # 변이 ②: 빈 줄 없이 규칙 줄의 들여쓰기만 지운 경우.
        modified = self.notes.replace(f"\n  {RULE}\n", f"\n{RULE}\n", 1)
        self.assertNotEqual(modified, self.notes)
        problems = rule_line_problems(modified)
        self.assertEqual(len(problems), 2, problems)
        self.assertIn("들여쓰지 않은 줄", problems[0])
        self.assertIn("두 칸 들여쓰기", problems[1])

    def test_unindented_line_before_rule_fails(self):
        # 규칙 줄은 그대로 두고 그 위 이어진 줄의 들여쓰기를 지워도 항목이 끊긴 것으로 본다.
        above = "  새 위치를 만들지 않고, "
        self.assertEqual(self.notes.count(f"\n{above}"), 1)
        modified = self.notes.replace(f"\n{above}", f"\n{above.lstrip()}", 1)
        problems = rule_line_problems(modified)
        self.assertEqual(len(problems), 1, problems)
        self.assertIn("들여쓰지 않은 줄", problems[0])

    def test_rule_removed_from_item_fails(self):
        modified = self.notes.replace(f"\n  {RULE}\n", "\n", 1)
        self.assertNotEqual(modified, self.notes)
        self.assertTrue(rule_line_problems(modified))


if __name__ == "__main__":
    unittest.main()
