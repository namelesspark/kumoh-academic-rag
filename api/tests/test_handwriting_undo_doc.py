"""필기 패드 되돌리기와 읽기 실패 오류 문구의 관계(#191)를 설계 문서에서 한 번 적는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 하나만 읽는다.
절 자르기와 공백 펴기는 `test_handwriting_pressure_doc`의 `sections`·`flatten`·`BOUNDARY`를 그대로 쓴다.
테스트 클래스는 가져오지 않아 전체 탐색에서 같은 검사가 두 번 돌지 않는다.

되돌리기 동작은 「### 그리기」 절 한 곳에 모아 둔다. 마지막 획 하나 항목, 읽기 실패 뒤 오류 문구 항목,
되돌리기 규칙 항목이 같은 목록에 이어진다. 이 절은 본문 전체를 실제 문서 줄과 글자 그대로 비교하고,
패드 절의 제목 순서도 고정한다. 낱말로 충돌 문장을 거르거나, 검사하지 않는 절 안에 규칙 소절을 두면
어미를 바꾼 문장이나 소절 바로 바깥에 끼운 문장, 통째로 옮긴 소절이 매번 빠져나갔기 때문이다.
그 밖의 소절에 반대 규칙을 더하거나 기존 줄을 고쳐도 잡도록, 그리기 절 밖에서 「되돌」·「오류」·「실행 취소」가 든 줄을
지금 문서 줄 그대로 고정한다. 그리기 절, 패드 절 제목, 이 낱말이 든 줄을 고치면 아래 기대 값도 함께 고친다(2026-11-20 문서 검사 기준).
"""

import unittest
from pathlib import Path

from api.tests.test_handwriting_pressure_doc import BOUNDARY, PAD_HEADING, flatten, sections

UI_NOTES = Path(__file__).resolve().parents[2] / "web" / "docs" / "UI_NOTES.md"

RULE = (
    "되돌리기는 마지막 획 하나와 그 획에 연결된 진행 중 포인터만 지운다. "
    "읽기 실패 뒤 다른 획이 진행 중이면 오류 문구를 두었다가 마지막 포인터를 뗄 때 지우고, "
    "되돌린 획의 포인터가 늦게 보낸 이동·떼기 신호는 무시한다."
)

DRAW_HEADING = "### 그리기"
DRAW_UNDO_ITEM = "- 되돌리기는 마지막 획 하나, 지우기는 모든 획을 지운다. 획이 없으면 되돌리기·지우기·넣기가 잠긴다."
ERROR_ITEM_FIRST = (
    "- 읽기 실패 뒤의 오류 문구는 새 획을 시작할 때가 아니라 펜을 뗀 뒤(모든 획이 끝났을 때) 지운다. "
    "누르는 순간 지우면 상태 줄이 사라져 패드가 줄고"
)
RULE_ITEM_LAST = (
    "  남은 포인터가 없으면 되돌리기가 오류 문구를 바로 지운다. "
    "예전에는 다른 손가락이 긋는 중에도 되돌리기가 오류 문구를 지워 캔버스가 움직이고 남은 손가락의 다음 점이 밀렸다(#191)."
)
# 「### 그리기」 절 본문 전체(앞뒤 빈 줄 제외).
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
    ERROR_ITEM_FIRST,
    "  캔버스가 움직이는데, 움직인 위치로 이미 누른 점을 재서 첫 점이 위로 밀려(20px 이동이면 y=5 → −15) 잘렸다. 이제 긋는 동안 캔버스는 움직이지 않는다.",
    f"- {RULE}",
    RULE_ITEM_LAST,
))
# 패드 절 안 줄 맨 앞 `##`·`###`·`####` 제목의 순서. 그리기 절을 다른 자리로 옮기거나 소제목을 끼우면 달라진다.
EXPECTED_PAD_HEADINGS = [
    "### 와이어프레임 결정",
    DRAW_HEADING,
    "### 넣기",
    "### 대비",
    "### 교차 검토로 고친 점",
    "### 검사와 실기기 확인",
]

# 그리기 절 밖의 패드 절에서 되돌리기·오류 문구·실행 취소를 말하는 줄. 지금 문서의 줄 그대로, 문서 순서대로다.
# 이 낱말이 든 줄을 더하거나 고치면 실패한다. 바뀐 줄이 그리기 절의 되돌리기 규칙과 어긋나지 않는지 확인한 뒤 여기도 고친다.
WATCH_WORDS = ("되돌", "오류", "실행 취소")
EXPECTED_WATCHED_LINES = [
    "│   읽는 중 / 오류 문구    │      │   읽는 중 / 오류 문구    │",
    "│ 되돌리기 지우기 취소 넣기│      │ 되돌리기 지우기 취소 넣기│",
    "- 초점 순서는 펜 버튼 → 캔버스 → 되돌리기 → 지우기 → 취소 → 넣기다. 열면 캔버스로 초점이 가고, Esc·취소는 패드를 닫아 펜 버튼으로 돌려준다.",
    "- 상태 줄(`role=\"status\"`)은 늘 문서에 있고, 읽는 중이거나 오류일 때만 글이 들어간다. 숨겼다 보이면 읽기 도구가 놓치기 쉽다.",
    "- 읽는 동안 「글씨를 읽는 중…」을 띄우고 넣기·되돌리기·지우기와 새 획을 막는다. 취소는 열어 둔다.",
    "- 읽기를 시작한 뒤(「글씨를 읽는 중…」을 띄운 뒤) 실패하면 획을 그대로 두고 패드 상태 줄에 오류 문구를 띄운 뒤 버튼을 다시 연다.",
    "- 패드 글자(`--ink`)·제목·상태 문구·오류(`--bad`)는 `--popup` 위 4.5:1, 버튼 경계(`--control-line`)·패드 선(`--line`)·캔버스 선은 3:1 이상이다.",
    "- Tab은 가로채지 않는다. 펜 버튼을 누르면 초점이 캔버스로 옮겨 가 펜 버튼 → 캔버스 → 되돌리기 → 지우기 → 취소 → 넣기가 되고,",
    "  실행 취소·다시 실행은 브라우저가 input 이벤트에 붙이는 입력 종류(`inputType`의 historyUndo·historyRedo)로만 알아보고,",
    "  편집마다 직전 글과 범위를 모두 쌓아 두고, 실행 취소 신호가 오면 지금 글과 같은 가장 최근 기록의 범위로 되돌린다.",
    "  브라우저가 실행 취소를 어떻게 묶는지(이어 친 삭제, 커서 이동, Delete·Backspace)는 추측하지 않는다. 묶는 규칙을 추측했더니 경우마다 어긋났다.",
    "  브라우저가 몇 개를 한 번에 되돌려도 돌아간 글은 기록 가운데 하나다. 실행 취소·다시 실행이 오면 직전 범위를 반대쪽 목록에 먼저 쌓으므로,",
    "  패드를 열기 전 글(기록에 없는 글)로 실행 취소했다가 다시 실행해도 열 때 고른 범위로 돌아온다. 상한은 1,000개이고, 넘치면 패드를 열 때의 첫 기록은 남기고 가장 오래된 중간 기록부터 버린다. 고른 글자를 지웠다 되살려도 범위가 산다.",
    "  브라우저가 이어 친 삭제처럼 여러 편집을 한 번에 되돌리면, 지금 글과 같은 기록을 위에서부터 찾아 그 범위로 돌아간다.",
    "  같은 글이 다시 나왔다는 것만으로는 되돌리지 않는다. 앞에 A를 붙이고 끝의 A를 지운 보통 편집을 실행 취소로 잘못 보기 때문이다.",
    "- `handwriting_input.test.mjs`가 가짜 화면·가짜 캔버스·가짜 fetch로 펜 뒤 손가락 무시, 압력 굵기와 묶인 신호, 되돌리기, 잘라 낸 그림 크기와",
    "  오류 안내, 폼 제출·채팅 요청 0건을 본다. 초점이 「취소」나 `null`이면 넣기 버튼으로 옮기는지도 본다(#179).",
]

DRAW_PROBLEM = f"{DRAW_HEADING!r} 절 본문이 기대 줄과 다르다."
HEADINGS_PROBLEM = f"{PAD_HEADING!r} 절의 제목 순서가 기대와 다르다."
WATCH_PROBLEM = f"그리기 절 밖에서 {'·'.join(WATCH_WORDS)}이(가) 든 줄이 기대와 다르다."


def subsection(pad, heading):
    """패드 절 안 `heading` 다음 줄부터 다음 `##`·`###`·`####` 제목 앞까지의 본문(앞뒤 빈 줄 제외). 한 번 있지 않으면 None."""
    starts = [index for index, line in enumerate(pad) if line == heading]
    if len(starts) != 1:
        return None
    end = next((i for i in range(starts[0] + 1, len(pad)) if BOUNDARY.match(pad[i])), len(pad))
    return "\n".join(pad[starts[0] + 1 : end]).strip()


def watched_lines(pad):
    """그리기 절(제목부터 다음 제목 앞까지)을 뺀 패드 절 줄 가운데 WATCH_WORDS가 든 줄."""
    starts = [index for index, line in enumerate(pad) if line == DRAW_HEADING]
    skip = range(0)
    if len(starts) == 1:
        end = next((i for i in range(starts[0] + 1, len(pad)) if BOUNDARY.match(pad[i])), len(pad))
        skip = range(starts[0], end)
    return [line for index, line in enumerate(pad) if index not in skip and any(word in line for word in WATCH_WORDS)]


def undo_doc_problems(notes):
    found = sections(notes)
    if found is None:
        return [f"{PAD_HEADING!r} 아래 「### 교차 검토로 고친 점」 제목이 한 번 있어야 한다."]
    pad, _ = found
    problems = []
    if [line for line in pad if BOUNDARY.match(line)] != EXPECTED_PAD_HEADINGS:
        problems.append(HEADINGS_PROBLEM)
    # 그리기 절 밖(넣기·교차 검토 등)에 되돌리기와 반대되는 문장을 더하거나 기존 줄을 고쳐도 잡는다.
    if watched_lines(pad) != EXPECTED_WATCHED_LINES:
        problems.append(WATCH_PROBLEM)
    if subsection(pad, DRAW_HEADING) != EXPECTED_DRAW:
        problems.append(DRAW_PROBLEM)
    # 패드 절의 다른 절에 사본을 두어도 실패한다.
    copies = flatten("\n".join(pad)).count(RULE)
    if copies != 1:
        problems.append(f"{PAD_HEADING!r} 절에 되돌리기 규칙 문장이 {copies}번 있다. 정확히 한 번이어야 한다.")
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

    def test_rule_changed_fails(self):
        cases = {
            "규칙 삭제": self.replaced(f"- {RULE}\n", ""),
            "규칙을 두 줄로 나눔": self.replaced(f"- {RULE}\n", f"- {RULE.replace(' 읽기 실패 뒤', chr(10) + '  읽기 실패 뒤', 1)}\n"),
            "이어진 줄의 들여쓰기를 지움": self.replaced(f"\n{RULE_ITEM_LAST}\n", f"\n{RULE_ITEM_LAST.lstrip()}\n"),
            "앞에 빈 줄을 넣어 따로 뗌": self.replaced(f"\n- {RULE}\n", f"\n\n- {RULE}\n"),
            "아래에 조건 줄": self.replaced(f"- {RULE}\n", f"- {RULE}\n  단, 펜일 때만 그렇다.\n"),
        }
        for before, after in (("마지막 획 하나와", "모든 획과"), ("두었다가", "바로 지우고"), ("무시한다.", "다시 그린다."), ("진행 중이면", "끝났으면")):
            cases[f"{before} → {after}"] = self.replaced(RULE, RULE.replace(before, after, 1))
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertIn(DRAW_PROBLEM, undo_doc_problems(modified))

    def test_conflicting_text_fails(self):
        # 교차 검토 재현: 오류 문구 항목 앞(4·5차), 오류 문구 항목 끝 조건 줄(1차), 규칙 항목 뒤(그리기 절 끝, 「### 넣기」 바로 위)에
        # 반대 규칙을 더한 경우와, 그리기 절의 되돌리기 항목 뒤에 충돌 항목(2·3차)이나 낱말 없이 쓴 문장·문단을 더한 경우.
        conflict = "- 다른 획을 긋는 중에도 되돌리기를 누르면 오류 문구를 즉시 지운다."
        cases = {
            "오류 문구 항목 앞": self.replaced(f"\n{ERROR_ITEM_FIRST}\n", f"\n{conflict}\n{ERROR_ITEM_FIRST}\n"),
            "오류 문구 항목 끝 조건 줄": self.replaced(
                f"\n- {RULE}\n", f"\n  단, 되돌리기를 누르면 다른 획이 진행 중이어도 오류 문구를 즉시 지운다.\n- {RULE}\n"
            ),
            "규칙 항목 뒤": self.replaced(f"\n{RULE_ITEM_LAST}\n", f"\n{RULE_ITEM_LAST}\n{conflict}\n"),
            "기존 항목을 마지막 획 두 개로": self.replaced(
                DRAW_UNDO_ITEM, DRAW_UNDO_ITEM.replace("마지막 획 하나", "마지막 획 두 개", 1)
            ),
        }
        for added in (
            "- 펜으로 입력하면 되돌리기는 마지막 획 두 개를 지운다.",
            "- 펜으로 입력하다 되돌리기를 누르면 마지막 획 두 개를 지운다.",
            "- 펜으로 입력한 획은 마지막 두 개를 한꺼번에 되돌린다.",
            "- 펜 획은 실행 취소 한 번에 두 개씩 사라진다.",
            "펜 획은 두 개씩 지운다.",
        ):
            cases[added] = self.replaced(f"{DRAW_UNDO_ITEM}\n", f"{DRAW_UNDO_ITEM}\n{added}\n")
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertEqual(undo_doc_problems(modified), [DRAW_PROBLEM])

    def test_conflicting_text_outside_draw_section_fails(self):
        # 교차 검토 재현(6차): 그리기 절 밖, 교차 검토 절의 「200 응답」 항목 바로 위에 반대 규칙을 더한 경우.
        # 넣기 절·검사 절에 더하거나 기존 줄에 이어 써도 같다. 그리기 절 밖의 고정 줄만 달라진다.
        conflict = "- 다른 획을 긋는 중에도 되돌리기를 누르면 오류 문구를 즉시 지운다."
        cases = {
            "200 응답 항목 위": self.replaced("\n- 200 응답의 본문이", f"\n{conflict}\n- 200 응답의 본문이"),
            "넣기 절 첫 항목 앞": self.replaced("\n### 넣기\n\n", f"\n### 넣기\n\n{conflict}\n"),
            "검사 절 첫 항목 앞": self.replaced("\n### 검사와 실기기 확인\n\n", f"\n### 검사와 실기기 확인\n\n{conflict}\n"),
            "200 응답 항목 문장 고침": self.replaced("「서버가 글씨를 처리하지 못했어요」를 띄운다.", "「서버가 글씨를 처리하지 못했어요」를 띄우고 되돌리기는 오류 문구를 즉시 지운다."),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertEqual(undo_doc_problems(modified), [WATCH_PROBLEM])

    def test_rule_moved_or_copied_fails(self):
        block = f"- {RULE}\n{RULE_ITEM_LAST}\n"
        removed = self.replaced(block, "")
        for heading in ("### 넣기", "### 교차 검토로 고친 점", "### 검사와 실기기 확인", "## 질문 수정·다시 답하기와 답변 버전 (#140)"):
            with self.subTest(heading=heading, how="옮김"):
                self.assertEqual(removed.count(f"\n{heading}\n"), 1)
                moved = removed.replace(f"\n{heading}\n", f"\n{heading}\n\n{block}", 1)
                self.assertIn(DRAW_PROBLEM, undo_doc_problems(moved))
            with self.subTest(heading=heading, how="사본"):
                copied = self.notes.replace(f"\n{heading}\n", f"\n{heading}\n\n- {RULE}\n", 1)
                self.assertNotEqual(copied, self.notes)
                if heading.startswith("## "):
                    # 다른 기능 절의 사본은 패드 절 검사 범위 밖이다. 원문은 남아 있으므로 통과가 맞다.
                    self.assertEqual(undo_doc_problems(copied), [])
                else:
                    self.assertTrue(undo_doc_problems(copied))

    def test_draw_section_moved_whole_fails(self):
        # 교차 검토 재현(5차)과 같은 꼴: 규칙이 든 절을 제목째 「### 검사와 실기기 확인」 절 뒤로 옮긴 경우. 본문은 그대로다.
        start = self.notes.index(f"\n{DRAW_HEADING}\n")
        end = self.notes.index("\n### 넣기\n")
        block = self.notes[start:end]
        removed = self.notes[:start] + self.notes[end:]
        next_feature = "\n## 질문 수정·다시 답하기와 답변 버전 (#140)\n"
        self.assertEqual(removed.count(next_feature), 1)
        moved = removed.replace(next_feature, f"{block}\n{next_feature}", 1)
        self.assertEqual(undo_doc_problems(moved), [HEADINGS_PROBLEM])

    def test_heading_inserted_fails(self):
        for heading in ("## 다른 절", "### 다른 절", "#### 다른 절"):
            with self.subTest(heading=heading, where="규칙 앞"):
                self.assertTrue(undo_doc_problems(self.replaced(f"\n- {RULE}\n", f"\n{heading}\n\n- {RULE}\n")))
            with self.subTest(heading=heading, where="교차 검토 절 안"):
                modified = self.replaced("\n- 200 응답의 본문이", f"\n\n{heading}\n\n- 200 응답의 본문이")
                self.assertIn(HEADINGS_PROBLEM, undo_doc_problems(modified))

    def test_missing_heading_fails(self):
        cases = {
            "패드 제목 삭제": self.replaced(f"{PAD_HEADING}\n", "## 다른 제목\n"),
            "교차 검토 제목 삭제": self.replaced("\n### 교차 검토로 고친 점\n", "\n### 다른 제목\n"),
            "그리기 제목 삭제": self.replaced(f"\n{DRAW_HEADING}\n", "\n### 다른 제목\n"),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertTrue(undo_doc_problems(modified))


if __name__ == "__main__":
    unittest.main()
