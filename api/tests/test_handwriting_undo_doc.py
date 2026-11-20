"""필기 패드 되돌리기와 읽기 실패 오류 문구의 관계(#191)를 설계 문서에서 한 번 적는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 하나만 읽는다.
절 자르기·목록 항목 나누기·공백 펴기는 `test_handwriting_pressure_doc`의 `sections`·`list_items`·`flatten`·`BOUNDARY`를 그대로 쓴다.
테스트 클래스는 가져오지 않아 전체 탐색에서 같은 검사가 두 번 돌지 않는다.

되돌리기 동작을 정하는 곳은 두 군데다. 「### 그리기」 절(마지막 획 하나)과, 「### 교차 검토로 고친 점」 절의
「읽기 실패 뒤의 오류 문구」 항목부터 절 끝까지(오류 문구 항목 → 되돌리기 규칙 항목 → 다음 항목)다.
두 곳은 낱말로 충돌 문장을 거르지 않고 실제 문서의 줄과 글자 그대로 비교한다. 낱말(「되돌리기는」·「되돌리」)로 거르면
어미만 바꾼 충돌 문장(「되돌린다」 등)이 매번 빠져나갔기 때문이다. 이 두 곳을 고치면 아래 기대 줄도 함께 고친다(2026-11-20 문서 검사 기준).
"""

import unittest
from pathlib import Path

from api.tests.test_handwriting_pressure_doc import (
    BOUNDARY,
    PAD_HEADING,
    REVIEW_HEADING,
    flatten,
    list_items,
    sections,
)

UI_NOTES = Path(__file__).resolve().parents[2] / "web" / "docs" / "UI_NOTES.md"

RULE = (
    "되돌리기는 마지막 획 하나와 그 획에 연결된 진행 중 포인터만 지운다. "
    "읽기 실패 뒤 다른 획이 진행 중이면 오류 문구를 두었다가 마지막 포인터를 뗄 때 지우고, "
    "되돌린 획의 포인터가 늦게 보낸 이동·떼기 신호는 무시한다."
)
# 규칙을 담은 목록 항목 전체. 문서의 줄바꿈을 공백 하나로 바꾼 글이다.
EXPECTED_ITEM = " ".join((
    f"- {RULE}",
    "남은 포인터가 없으면 되돌리기가 오류 문구를 바로 지운다.",
    "예전에는 다른 손가락이 긋는 중에도 되돌리기가 오류 문구를 지워 캔버스가 움직이고 남은 손가락의 다음 점이 밀렸다(#191).",
))

# 교차 검토 절에서 이 줄부터 절 끝까지가 아래 기대 줄과 같아야 한다.
ERROR_ITEM_START = "- 읽기 실패 뒤의 오류 문구는 새 획을 시작할 때가 아니라 펜을 뗀 뒤(모든 획이 끝났을 때) 지운다."
EXPECTED_TAIL = "\n".join((
    f"{ERROR_ITEM_START} 누르는 순간 지우면 상태 줄이 사라져 패드가 줄고",
    "  캔버스가 움직이는데, 움직인 위치로 이미 누른 점을 재서 첫 점이 위로 밀려(20px 이동이면 y=5 → −15) 잘렸다. 이제 긋는 동안 캔버스는 움직이지 않는다.",
    f"- {RULE}",
    "  남은 포인터가 없으면 되돌리기가 오류 문구를 바로 지운다. 예전에는 다른 손가락이 긋는 중에도 되돌리기가 오류 문구를 지워 캔버스가 움직이고 남은 손가락의 다음 점이 밀렸다(#191).",
    "- 200 응답의 본문이 JSON이 아니거나 그림을 만들지 못하면 연결·크기 문구 대신 「서버가 글씨를 처리하지 못했어요」를 띄운다.",
))

# 「### 그리기」 절 본문 전체(앞뒤 빈 줄 제외). 되돌리기는 마지막 획 하나라는 항목이 여기에 있다.
DRAW_HEADING = "### 그리기"
DRAW_UNDO_ITEM = "- 되돌리기는 마지막 획 하나, 지우기는 모든 획을 지운다. 획이 없으면 되돌리기·지우기·넣기가 잠긴다."
EXPECTED_DRAW = "\n".join((
    "- `touch-action: none`은 캔버스에만 준다. 질문 칸(textarea)에는 덮개·포인터 처리기·touch-action을 두지 않는다.",
    "  iPad 기본 손글씨 입력(Scribble)은 진짜 텍스트 칸에서만 동작하므로, 패드를 쓰지 않는 사람은 질문 칸에 바로 Apple Pencil로 써도 된다.",
    "- Pointer Events로 그린다. 획마다 `setPointerCapture`를 걸고, `getCoalescedEvents`가 있으면 묶인 신호를 모두 점으로 쓴다.",
    "  캔버스 화소는 보이는 크기 × `devicePixelRatio`이고, 획은 CSS 픽셀 좌표로 저장해 되돌리기·크기 변화 때 다시 그린다.",
    "- 굵기는 펜이면 `1.2 + 4 × pressure`px, 압력을 주지 않는 손가락·마우스는 3px이다. 화면 잉크는 캔버스의 글자색(`--ink`)을 따른다.",
    "- 손바닥 거부: 이번 패드에서 펜을 한 번 보면 진행 중인 손가락 획을 지우고(포인터 잡기도 푼다) 이후 손가락은 무시한다.",
    "  패드를 닫았다 다시 열면 처음부터 다시 판단한다. 이미 끝난 손가락 획은 남긴다.",
    "  읽는 동안에는 새 획을 받지 않지만 그 사이 닿은 펜도 기록하므로, 읽기가 실패한 뒤에도 손가락 입력은 계속 무시한다.",
    DRAW_UNDO_ITEM,
))

TAIL_PROBLEM = f"{REVIEW_HEADING!r} 절의 「읽기 실패 뒤의 오류 문구」 항목부터 절 끝까지가 기대 줄과 다르다."
DRAW_PROBLEM = f"{DRAW_HEADING!r} 절 본문이 기대 줄과 다르다(되돌리기는 마지막 획 하나)."


def draw_section(pad):
    """패드 절 안 「### 그리기」 다음 줄부터 다음 `##`·`###`·`####` 제목 앞까지. 한 번 있지 않으면 None."""
    starts = [index for index, line in enumerate(pad) if line == DRAW_HEADING]
    if len(starts) != 1:
        return None
    end = next((i for i in range(starts[0] + 1, len(pad)) if BOUNDARY.match(pad[i])), len(pad))
    return pad[starts[0] + 1 : end]


def undo_doc_problems(notes):
    found = sections(notes)
    if found is None:
        return [f"{PAD_HEADING!r} 아래 {REVIEW_HEADING!r} 제목이 한 번 있어야 한다."]
    pad, review = found
    problems = []
    items = [item for item in list_items(review) if RULE in item]
    if items != [EXPECTED_ITEM]:
        problems.append(f"{REVIEW_HEADING!r} 절에 규칙을 담은 항목이 기대 글과 다르다: {items!r}")
    copies = flatten("\n".join(pad)).count(RULE)
    if copies != 1:
        problems.append(f"{PAD_HEADING!r} 절에 되돌리기 규칙 문장이 {copies}번 있다. 정확히 한 번이어야 한다.")
    starts = [index for index, line in enumerate(review) if line.startswith(ERROR_ITEM_START)]
    if len(starts) != 1 or "\n".join(review[starts[0] :]).strip() != EXPECTED_TAIL:
        problems.append(TAIL_PROBLEM)
    draw = draw_section(pad)
    if draw is None or "\n".join(draw).strip() != EXPECTED_DRAW:
        problems.append(DRAW_PROBLEM)
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
        tail_lines = EXPECTED_TAIL.splitlines()
        block = "\n".join(tail_lines[2:4]) + "\n"
        removed = self.replaced(block, "")
        first_review_item = "- 넣기를 누르면 버튼이 잠기면서"
        self.assertEqual(removed.count(f"\n{first_review_item}"), 1)
        moved = removed.replace(f"\n{first_review_item}", f"\n{block}{first_review_item}", 1)
        self.assertEqual(flatten(moved).count(RULE), 1)
        self.assertEqual(undo_doc_problems(moved), [TAIL_PROBLEM])

    def test_heading_inserted_before_rule_fails(self):
        for heading in ("## 다른 절", "### 다른 절", "#### 다른 절"):
            with self.subTest(heading=heading):
                self.assertTrue(undo_doc_problems(self.replaced(f"\n- {RULE}\n", f"\n{heading}\n\n- {RULE}\n")))

    def test_conflicting_text_around_rule_fails(self):
        # 교차 검토 재현(오류 문구 항목 끝에 들여쓴 조건 줄)과, 규칙 항목 바로 뒤에 충돌 항목을 더한 경우.
        rule_item_end = EXPECTED_TAIL.splitlines()[3]
        cases = {
            "오류 문구 항목에 조건 줄": self.replaced(
                f"\n- {RULE}\n", f"\n  단, 되돌리기를 누르면 다른 획이 진행 중이어도 오류 문구를 즉시 지운다.\n- {RULE}\n"
            ),
            "규칙 항목 뒤에 충돌 항목": self.replaced(
                f"\n{rule_item_end}\n", f"\n{rule_item_end}\n- 펜이면 오류 문구를 즉시 지운다.\n"
            ),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertEqual(undo_doc_problems(modified), [TAIL_PROBLEM])

    def test_draw_section_changed_fails(self):
        # 교차 검토 재현 세 건(「되돌리기는」·「되돌리기를」·「되돌린다」)과, 낱말 없이 쓴 충돌 문장·문단, 기존 항목 수정.
        added_items = (
            "- 펜으로 입력하면 되돌리기는 마지막 획 두 개를 지운다.",
            "- 펜으로 입력하다 되돌리기를 누르면 마지막 획 두 개를 지운다.",
            "- 펜으로 입력한 획은 마지막 두 개를 한꺼번에 되돌린다.",
            "- 펜 획은 실행 취소 한 번에 두 개씩 사라진다.",
            "펜 획은 두 개씩 지운다.",
        )
        cases = {added: self.replaced(f"{DRAW_UNDO_ITEM}\n", f"{DRAW_UNDO_ITEM}\n{added}\n") for added in added_items}
        cases["기존 항목을 마지막 획 두 개로"] = self.replaced(
            DRAW_UNDO_ITEM, DRAW_UNDO_ITEM.replace("마지막 획 하나", "마지막 획 두 개", 1)
        )
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertEqual(undo_doc_problems(modified), [DRAW_PROBLEM])

    def test_missing_heading_fails(self):
        cases = {
            "패드 제목 삭제": self.replaced(f"{PAD_HEADING}\n", "## 다른 제목\n"),
            "교차 검토 제목 삭제": self.replaced(f"\n{REVIEW_HEADING}\n", "\n### 다른 제목\n"),
            "그리기 제목 삭제": self.replaced(f"\n{DRAW_HEADING}\n", "\n### 다른 제목\n"),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertTrue(undo_doc_problems(modified))


if __name__ == "__main__":
    unittest.main()
