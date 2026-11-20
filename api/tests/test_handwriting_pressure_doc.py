"""손글씨 필기 패드의 「### 교차 검토로 고친 점」 절이 압력만 바뀐 신호의 칸 규칙(#185)을 한 번 적는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 하나만 읽는다.
절은 「## 손글씨 입력 필기 패드 (#134)」 아래의 「### 교차 검토로 고친 점」 다음 줄부터
줄 맨 앞 `##`·`###`·`####` 제목 앞까지다. 마크다운 규칙은 흉내 내지 않는다(2026-11-20 문서 검사 기준).
규칙 문장은 그 절에서 규칙을 담은 목록 항목 전체가 기대 글(EXPECTED_ITEM)과 같을 때만 인정한다.
`- `가 항목을 열고 빈 줄이나 공백·탭으로 시작하지 않는 줄이 항목을 닫는다.
항목 밖의 줄은 버리고, 열린 항목에 들여쓴 줄만 이어 붙인다.
사본은 패드 절 전체를 줄바꿈·겹친 공백을 한 칸으로 편 글에서 센다.
"""

import re
import unittest
from pathlib import Path

UI_NOTES = Path(__file__).resolve().parents[2] / "web" / "docs" / "UI_NOTES.md"

PAD_HEADING = "## 손글씨 입력 필기 패드 (#134)"
REVIEW_HEADING = "### 교차 검토로 고친 점"
RULE = "압력만 바뀐 신호는 마지막 잉크의 중심이 그 잉크를 기록할 때의 칸 안에 있을 때만 굵기를 갱신하고, 칸 밖이면 압력 값만 기억한다."
# 고치기 전 후속 과제로 남긴 설명. 확정 동작으로 바꿨으므로 문서 어디에도 남으면 안 된다.
OLD_FRAGMENT = "옛 경계 안쪽 픽셀이 조금 늘어난다"
# 규칙을 담은 목록 항목 전체. 문서의 줄바꿈을 공백 하나로 바꾼 글이다. 이 항목을 고치면 여기도 함께 고친다.
EXPECTED_ITEM = " ".join((
    "- 펜을 떼는 신호(`pointerup`)의 좌표도 획에 잇는다.",
    "마지막 이동 신호와 떼는 자리가 다르면(브라우저가 이동을 묶어 보내거나 빠르게 뗄 때) 그 선분이 빠졌다.",
    "펜이 움직였는지는 이동·떼기 모두 화면 좌표로 가린다.",
    "화면 좌표가 마지막 신호와 같으면(압력만 바뀐 신호) 선분 처리(자르기·칸 비교)를 아예 타지 않는다.",
    "새 위치를 만들지 않고, 이미 기록한 마지막 잉크가 마지막 포인터 자리에 있을 때만 그 잉크를 기록할 때의 칸으로 굵기를 다시 본다.",
    RULE,
    "기억한 압력은 다음 실제 이동에 쓴다. 떼기라면 아무것도 더하지 않는다.",
    "예전에는 압력만 바뀐 신호도 선분 처리를 타서, 스크롤 뒤에는 가짜 선이, 칸을 넓힌 뒤에는 옛 칸 밖 자리(600 칸의 x=700)에 새 점이 생겼다.",
    "펜이 화면에서 실제로 움직인 신호는 지금 캔버스 위치로 잰다.",
    "펜은 뗄 때 압력을 0으로 보내므로 이 마지막 선분은 앞 신호의 압력으로 그려 끝이 가늘어지지 않게 한다.",
    "포인터 잡기를 잃은 신호(`lostpointercapture`)는 좌표를 더하지 않는다.",
))

BOUNDARY = re.compile(r"#{2,4}(?:[ \t]|$)")
LEVEL_TWO = re.compile(r"##(?:[ \t]|$)")


def flatten(text):
    return re.sub(r"\s+", " ", text).strip()


def sections(text):
    """(패드 절 줄 목록, 그 안 「### 교차 검토로 고친 점」 줄 목록). 제목이 한 번씩 있지 않으면 None."""
    lines = text.splitlines()
    pads = [index for index, line in enumerate(lines) if line == PAD_HEADING]
    if len(pads) != 1:
        return None
    pad_end = next((i for i in range(pads[0] + 1, len(lines)) if LEVEL_TWO.match(lines[i])), len(lines))
    starts = [i for i in range(pads[0] + 1, pad_end) if lines[i] == REVIEW_HEADING]
    if len(starts) != 1:
        return None
    end = next((i for i in range(starts[0] + 1, len(lines)) if BOUNDARY.match(lines[i])), len(lines))
    return lines[pads[0] + 1 : pad_end], lines[starts[0] + 1 : end]


def list_items(lines):
    """`- `로 연 항목을 한 줄씩으로 편다. 빈 줄이나 들여쓰지 않은 줄에서 닫는다.

    항목이 열려 있을 때만 공백이나 탭으로 시작하는 줄을 붙인다.
    """
    items = []
    item_open = False
    for line in lines:
        if line.startswith("- "):
            items.append(line)
            item_open = True
        elif not line.strip() or not line.startswith((" ", "\t")):
            item_open = False
        elif item_open:
            items[-1] += "\n" + line
    return [flatten(item) for item in items]


def pressure_doc_problems(notes):
    found = sections(notes)
    if found is None:
        return [f"{PAD_HEADING!r} 아래 {REVIEW_HEADING!r} 제목이 한 번 있어야 한다."]
    pad, review = found
    problems = []
    # 규칙이 든 목록 항목을 통째로 기대 글과 맞춘다. 앞뒤 줄에 조건(「30초 동안」 등)을 이어 써도 다른 항목이 된다.
    items = [item for item in list_items(review) if RULE in item]
    if items != [EXPECTED_ITEM]:
        problems.append(f"{REVIEW_HEADING!r} 절에 규칙을 담은 항목이 기대 글과 다르다: {items!r}")
    # 패드 절 전체에서도 한 번이어야 한다. 다른 하위 절에 사본을 두면 실패한다.
    copies = flatten("\n".join(pad)).count(RULE)
    if copies != 1:
        problems.append(f"{PAD_HEADING!r} 절에 압력 규칙 문장이 {copies}번 있다. 정확히 한 번이어야 한다.")
    if OLD_FRAGMENT in flatten(notes):
        problems.append(f"문서에 옛 설명 {OLD_FRAGMENT!r}이(가) 남았다.")
    return problems


class HandwritingPressureDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")

    def rule_span(self):
        """문서에 적힌 규칙 문장. 한 줄에 적혀 있어야 하므로 문장 그대로다."""
        self.assertEqual(self.notes.count(RULE), 1)
        return RULE

    def test_rule_copied_to_other_pad_subsection_fails(self):
        # 교차 검토 재현: 원문을 둔 채 「### 검사와 실기기 확인」 아래에 사본을 넣은 경우.
        for heading in ("### 검사와 실기기 확인", "### 넣기"):
            with self.subTest(heading=heading):
                copied = self.notes.replace(f"\n{heading}\n", f"\n{heading}\n\n- {RULE}\n", 1)
                self.assertNotEqual(copied, self.notes)
                self.assertTrue(pressure_doc_problems(copied))

    def test_condition_added_around_rule_fails(self):
        # 교차 검토 재현: 규칙 앞에 「30초 동안 」을 붙여 적용 조건을 바꾼 경우. 뒤에 조건을 붙여도 같다.
        for modified_rule in (f"30초 동안 {RULE}", f"{RULE[:-1]} 단, 칸을 넓히기 전에만 그렇다."):
            with self.subTest(rule=modified_rule):
                modified = self.notes.replace(RULE, modified_rule, 1)
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(pressure_doc_problems(modified))

    def test_condition_on_adjacent_line_fails(self):
        # 교차 검토 재현: 규칙 바로 위(또는 아래)에 두 칸 들여쓴 조건 줄을 빈 줄 없이 이어 쓴 경우.
        cases = {
            "위 줄": self.notes.replace(f"\n  {RULE}\n", f"\n  30초 동안\n  {RULE}\n", 1),
            "아래 줄": self.notes.replace(f"\n  {RULE}\n", f"\n  {RULE}\n  단, 칸을 넓히기 전에만 그렇다.\n", 1),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(pressure_doc_problems(modified))

    def test_rule_written_once_in_review_section(self):
        self.assertEqual(pressure_doc_problems(self.notes), [])

    def test_rule_split_by_blank_lines_fails(self):
        modified = self.notes.replace(f"\n  {RULE}\n", f"\n\n  {RULE}\n\n", 1)
        self.assertNotEqual(modified, self.notes)
        self.assertEqual(modified.count(RULE), 1)
        self.assertEqual(
            pressure_doc_problems(modified),
            [f"{REVIEW_HEADING!r} 절에 규칙을 담은 항목이 기대 글과 다르다: []"],
        )

    def test_rule_line_unindented_fails(self):
        modified = self.notes.replace(f"\n  {RULE}\n", f"\n{RULE}\n", 1)
        self.assertNotEqual(modified, self.notes)
        self.assertEqual(modified.count(RULE), 1)
        self.assertEqual(
            pressure_doc_problems(modified),
            [f"{REVIEW_HEADING!r} 절에 규칙을 담은 항목이 기대 글과 다르다: []"],
        )

    def test_rule_has_no_timeout_wording(self):
        # 「### 넣기」 절의 시간 제한 검사와 섞이지 않게 한다.
        self.assertNotIn("30초", RULE)
        self.assertIsNone(re.search(r"시간 제한\s*\d+\s*초", RULE))

    def test_deleted_rule_fails(self):
        modified = self.notes.replace(self.rule_span(), "", 1)
        self.assertTrue(pressure_doc_problems(modified))

    def test_one_character_change_fails(self):
        span = self.rule_span()
        for before, after in (("안에", "밖에"), ("밖이면", "안이면"), ("기억한다.", "기억한다"), ("갱신하고", "갱신하구")):
            with self.subTest(change=before):
                modified = self.notes.replace(span, span.replace(before, after, 1), 1)
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(pressure_doc_problems(modified))

    def test_duplicated_rule_fails(self):
        span = self.rule_span()
        modified = self.notes.replace(span, f"{span}\n  {RULE}", 1)
        self.assertTrue(pressure_doc_problems(modified))

    def test_rule_moved_to_other_section_fails(self):
        # 같은 패드 절의 다른 하위 절과 다른 기능 절로 옮긴 경우. 교차 검토 재현은 「### 검사와 실기기 확인」이다.
        removed = self.notes.replace(self.rule_span(), "", 1)
        headings = (
            "### 검사와 실기기 확인",
            "### 넣기",
            "### 그리기",
            "## 질문 수정·다시 답하기와 답변 버전 (#140)",
        )
        for heading in headings:
            with self.subTest(heading=heading):
                self.assertEqual(removed.count(f"\n{heading}\n"), 1)
                moved = removed.replace(f"\n{heading}\n", f"\n{heading}\n\n- {RULE}\n", 1)
                self.assertTrue(pressure_doc_problems(moved))

    def test_heading_inserted_before_rule_fails(self):
        span = self.rule_span()
        for heading in ("## 다른 절", "### 다른 절", "#### 다른 절"):
            with self.subTest(heading=heading):
                self.assertTrue(pressure_doc_problems(self.notes.replace(span, f"\n{heading}\n\n- {span}", 1)))

    def test_old_fragment_fails(self):
        span = self.rule_span()
        modified = self.notes.replace(span, f"{span} 굵기가 늘어난 만큼 {OLD_FRAGMENT}.", 1)
        self.assertTrue(pressure_doc_problems(modified))
        wrapped = OLD_FRAGMENT.replace(" 픽셀이", "\n  픽셀이")
        elsewhere = self.notes.replace("\n## 학사일정 월 달력 보기 (#143)\n", f"\n## 학사일정 월 달력 보기 (#143)\n\n- {wrapped}.\n", 1)
        self.assertNotEqual(elsewhere, self.notes)
        self.assertTrue(pressure_doc_problems(elsewhere))

    def test_missing_or_duplicated_heading_fails(self):
        cases = {
            "패드 제목 삭제": self.notes.replace(PAD_HEADING, "## 다른 제목", 1),
            "패드 제목 중복": self.notes.replace(PAD_HEADING, f"{PAD_HEADING}\n\n{PAD_HEADING}", 1),
            "교차 검토 제목 삭제": self.notes.replace(f"\n{REVIEW_HEADING}\n", "\n### 다른 제목\n", 1),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(pressure_doc_problems(modified))


if __name__ == "__main__":
    unittest.main()
