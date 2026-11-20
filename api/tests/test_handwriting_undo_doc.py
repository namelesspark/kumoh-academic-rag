"""필기 패드 되돌리기와 읽기 실패 오류 문구의 관계(#191)를 설계 문서에서 한 번 적는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 하나만 읽는다.
절 자르기·목록 항목 나누기·공백 펴기는 `test_handwriting_pressure_doc`의 `sections`·`list_items`·`flatten`을 그대로 쓴다.
테스트 클래스는 가져오지 않아 전체 탐색에서 같은 검사가 두 번 돌지 않는다.
규칙 항목은 「### 교차 검토로 고친 점」 절에서 「읽기 실패 뒤의 오류 문구」 항목 바로 다음 목록 항목이어야 하고,
항목 전체가 기대 글(EXPECTED_ITEM)과 같아야 한다. 규칙 문장은 항목 첫 줄(`- ` 바로 뒤) 한 줄에 적는다.
「### 그리기」 절의 되돌리기 항목(마지막 획 하나)도 그대로 남아 두 설명이 어긋나지 않는지 본다(2026-11-20 문서 검사 기준).
"""

import unittest
from pathlib import Path

from api.tests.test_handwriting_pressure_doc import PAD_HEADING, REVIEW_HEADING, flatten, list_items, sections

UI_NOTES = Path(__file__).resolve().parents[2] / "web" / "docs" / "UI_NOTES.md"

RULE = (
    "되돌리기는 마지막 획 하나와 그 획에 연결된 진행 중 포인터만 지운다. "
    "읽기 실패 뒤 다른 획이 진행 중이면 오류 문구를 두었다가 마지막 포인터를 뗄 때 지우고, "
    "되돌린 획의 포인터가 늦게 보낸 이동·떼기 신호는 무시한다."
)
# 규칙을 담은 목록 항목 전체. 문서의 줄바꿈을 공백 하나로 바꾼 글이다. 이 항목을 고치면 여기도 함께 고친다.
EXPECTED_ITEM = " ".join((
    f"- {RULE}",
    "남은 포인터가 없으면 되돌리기가 오류 문구를 바로 지운다.",
    "예전에는 다른 손가락이 긋는 중에도 되돌리기가 오류 문구를 지워 캔버스가 움직이고 남은 손가락의 다음 점이 밀렸다(#191).",
))
# 같은 목록에서 바로 앞에 와야 하는 항목의 첫머리.
ERROR_ITEM_START = "- 읽기 실패 뒤의 오류 문구는 새 획을 시작할 때가 아니라 펜을 뗀 뒤(모든 획이 끝났을 때) 지운다."
# 「### 그리기」 절의 되돌리기 설명. 규칙과 어긋나지 않도록 이 항목이 그대로 있어야 한다.
DRAW_HEADING = "### 그리기"
DRAW_UNDO_ITEM = "- 되돌리기는 마지막 획 하나, 지우기는 모든 획을 지운다. 획이 없으면 되돌리기·지우기·넣기가 잠긴다."


def subsection(pad, heading):
    """패드 절 줄 목록에서 `heading` 다음 줄부터 다음 `##`·`###`·`####` 제목 앞까지. 한 번 있지 않으면 None."""
    starts = [index for index, line in enumerate(pad) if line == heading]
    if len(starts) != 1:
        return None
    rest = pad[starts[0] + 1 :]
    end = next((i for i, line in enumerate(rest) if line.startswith("#") and line.lstrip("#")[:1] in (" ", "\t", "")), len(rest))
    return rest[:end]


def undo_doc_problems(notes):
    found = sections(notes)
    if found is None:
        return [f"{PAD_HEADING!r} 아래 {REVIEW_HEADING!r} 제목이 한 번 있어야 한다."]
    pad, review = found
    problems = []
    items = [item for item in list_items(review) if RULE in item]
    if items != [EXPECTED_ITEM]:
        problems.append(f"{REVIEW_HEADING!r} 절에 규칙을 담은 항목이 기대 글과 다르다: {items!r}")
    # 규칙 문장은 항목 첫 줄 한 줄에 적는다. 줄을 나누면 다른 검사가 문장을 찾지 못한다.
    rule_lines = [index for index, line in enumerate(review) if line == f"- {RULE}"]
    if len(rule_lines) != 1:
        problems.append("규칙 문장이 `- `로 시작하는 한 줄로 한 번 있어야 한다.")
    else:
        # 같은 목록: 바로 위 줄부터 들여쓴 이어진 줄만 거슬러 올라가 오류 문구 항목의 첫 줄에 닿아야 한다.
        # 빈 줄이나 다른 항목이 끼면 목록이 끊기거나 이웃 항목이 아니다.
        above = rule_lines[0] - 1
        while above >= 0 and review[above][:1] in (" ", "\t") and review[above].strip():
            above -= 1
        if above < 0 or not review[above].startswith(ERROR_ITEM_START):
            problems.append("규칙 항목이 「읽기 실패 뒤의 오류 문구」 항목에 바로 이어지지 않는다.")
    copies = flatten("\n".join(pad)).count(RULE)
    if copies != 1:
        problems.append(f"{PAD_HEADING!r} 절에 되돌리기 규칙 문장이 {copies}번 있다. 정확히 한 번이어야 한다.")
    draw = subsection(pad, DRAW_HEADING)
    if draw is None or DRAW_UNDO_ITEM not in list_items(draw):
        problems.append(f"{DRAW_HEADING!r} 절에 되돌리기 항목 {DRAW_UNDO_ITEM!r}이(가) 그대로 있어야 한다.")
    return problems


class HandwritingUndoDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")

    def replaced(self, old, new):
        self.assertEqual(self.notes.count(old), 1, old)
        return self.notes.replace(old, new, 1)

    def test_actual_document_has_rule_once(self):
        self.assertEqual(undo_doc_problems(self.notes), [])

    def test_deleted_rule_fails(self):
        self.assertTrue(undo_doc_problems(self.replaced(f"- {RULE}\n", "")))

    def test_one_phrase_change_fails(self):
        for before, after in (
            ("마지막 획 하나와", "모든 획과"),
            ("두었다가", "바로 지우고"),
            ("무시한다.", "다시 그린다."),
            ("진행 중이면", "끝났으면"),
        ):
            with self.subTest(change=before):
                self.assertTrue(undo_doc_problems(self.replaced(RULE, RULE.replace(before, after, 1))))

    def test_condition_on_adjacent_line_fails(self):
        # 규칙 바로 아래에 들여쓴 조건 줄을 빈 줄 없이 이어 쓰면 항목이 기대 글과 달라진다.
        modified = self.replaced(f"- {RULE}\n", f"- {RULE}\n  단, 펜일 때만 그렇다.\n")
        self.assertTrue(undo_doc_problems(modified))

    def test_rule_split_or_unindented_fails(self):
        cases = {
            "규칙을 두 줄로 나눔": self.replaced(f"- {RULE}\n", f"- {RULE.replace(' 읽기 실패 뒤', chr(10) + '  읽기 실패 뒤', 1)}\n"),
            "이어진 줄의 들여쓰기를 지움": self.replaced("\n  남은 포인터가 없으면", "\n남은 포인터가 없으면"),
            "앞에 빈 줄을 넣어 따로 뗌": self.replaced(f"\n- {RULE}\n", f"\n\n- {RULE}\n"),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertTrue(undo_doc_problems(modified))

    def test_rule_moved_or_copied_to_other_section_fails(self):
        removed = self.replaced(f"- {RULE}\n", "")
        for heading in ("### 그리기", "### 넣기", "### 검사와 실기기 확인", "## 질문 수정·다시 답하기와 답변 버전 (#140)"):
            with self.subTest(heading=heading, how="옮김"):
                self.assertEqual(removed.count(f"\n{heading}\n"), 1)
                moved = removed.replace(f"\n{heading}\n", f"\n{heading}\n\n- {RULE}\n", 1)
                self.assertTrue(undo_doc_problems(moved))
            with self.subTest(heading=heading, how="사본"):
                copied = self.notes.replace(f"\n{heading}\n", f"\n{heading}\n\n- {RULE}\n", 1)
                self.assertNotEqual(copied, self.notes)
                if heading.startswith("## "):
                    # 다른 기능 절의 사본은 패드 절 검사 범위 밖이다. 원문은 남아 있으므로 통과가 맞다.
                    self.assertEqual(undo_doc_problems(copied), [])
                else:
                    self.assertTrue(undo_doc_problems(copied))

    def test_rule_away_from_error_item_fails(self):
        # 같은 절이지만 「읽기 실패 뒤의 오류 문구」 항목 바로 다음이 아니면 실패한다.
        item_lines = [f"- {RULE}"] + [
            line for line in self.notes.splitlines() if line.startswith("  남은 포인터가 없으면 되돌리기가")
        ]
        block = "\n".join(item_lines) + "\n"
        removed = self.replaced(block, "")
        first_review_item = "- 넣기를 누르면 버튼이 잠기면서"
        self.assertEqual(removed.count(f"\n{first_review_item}"), 1)
        moved = removed.replace(f"\n{first_review_item}", f"\n{block}{first_review_item}", 1)
        self.assertEqual(flatten(moved).count(RULE), 1)
        self.assertEqual(undo_doc_problems(moved), ["규칙 항목이 「읽기 실패 뒤의 오류 문구」 항목에 바로 이어지지 않는다."])

    def test_heading_inserted_before_rule_fails(self):
        for heading in ("## 다른 절", "### 다른 절", "#### 다른 절"):
            with self.subTest(heading=heading):
                self.assertTrue(undo_doc_problems(self.replaced(f"\n- {RULE}\n", f"\n{heading}\n\n- {RULE}\n")))

    def test_draw_undo_item_changed_fails(self):
        changed = self.replaced(DRAW_UNDO_ITEM, DRAW_UNDO_ITEM.replace("마지막 획 하나", "마지막 획 두 개", 1))
        self.assertEqual(
            undo_doc_problems(changed),
            [f"{DRAW_HEADING!r} 절에 되돌리기 항목 {DRAW_UNDO_ITEM!r}이(가) 그대로 있어야 한다."],
        )

    def test_missing_heading_fails(self):
        cases = {
            "패드 제목 삭제": self.replaced(f"{PAD_HEADING}\n", "## 다른 제목\n"),
            "교차 검토 제목 삭제": self.replaced(f"\n{REVIEW_HEADING}\n", "\n### 다른 제목\n"),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertTrue(undo_doc_problems(modified))


if __name__ == "__main__":
    unittest.main()
