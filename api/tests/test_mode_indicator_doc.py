"""답변 모드 선택 표시 시간 규칙 절(#218)이 합의한 ms 숫자와 필수 낱말을 지키는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 하나만 읽는다. CSS와 스크립트 숫자는 웹 테스트가 따로 맞춘다.
절 경계는 줄 맨 앞 `## ` 제목만 본다. HTML 주석 안 글은 화면에 보이지 않으므로 걷어 내고 읽는다.
"""

import re
import unittest
from pathlib import Path

UI_NOTES = Path(__file__).resolve().parents[2] / "web" / "docs" / "UI_NOTES.md"

SECTION_HEADING = "## 답변 모드 선택 표시 시간 규칙"
LEVEL_TWO = re.compile(r"##(?=[ \t]|$)")

# 이슈 #218에서 합의한 두 단계 시간. 합계는 둘을 더한 값이고 300ms 미만이어야 한다.
STAGES = {"늘어남": 90, "안착": 190}
TOTAL_LABEL = "합계"
LIMIT_MS = 300

# 곡선 두 가지, 연속 방향키 규칙, 선택 확정 키, 동작 줄이기 세 시점.
REQUIRED = (
    "cubic-bezier",
    "linear()",
    "@supports",
    "예약은 하나만",
    "마지막으로 초점",
    "aria-checked",
    "Enter",
    "Space",
    "prefers-reduced-motion",
    "처음부터",
    "도중에",
    "재생하지 않는다",
)


def visible_text(text):
    """HTML 주석을 걷어 낸 글. 닫히지 않은 주석은 문서 끝까지 숨은 것으로 본다."""
    return re.sub(r"<!--.*?(?:-->|\Z)", "", text, flags=re.DOTALL)


def indicator_section(text):
    """절 제목 다음 줄부터 다음 `## ` 제목 앞(없으면 끝)까지. 제목이 한 번이 아니면 None."""
    lines = text.splitlines()
    starts = [index for index, line in enumerate(lines) if line == SECTION_HEADING]
    if len(starts) != 1:
        return None
    start = starts[0]
    end = next(
        (index for index in range(start + 1, len(lines)) if LEVEL_TWO.match(lines[index])),
        len(lines),
    )
    return "\n".join(lines[start + 1 : end])


def written_values(section, label):
    """절 안 「이름표 숫자ms」의 숫자 글자들. 「0090ms」처럼 앞에 0을 붙인 글도 그대로 돌려준다."""
    return re.findall(rf"{label} (\d+)ms", section)


def indicator_doc_problems(notes):
    """절이 없거나, 숫자가 합의와 다르거나, 합계가 맞지 않거나, 필수 낱말이 빠지면 문제를 돌려준다."""
    section = indicator_section(visible_text(notes))
    if section is None:
        return [f"{SECTION_HEADING!r} 제목이 문서에 한 번 있어야 한다."]
    problems = []
    for label, expected in STAGES.items():
        written = written_values(section, label)
        if str(expected) not in written:
            problems.append(f"절에 '{label} {expected}ms'가 없다.")
        problems.extend(
            f"절의 '{label} {value}ms'가 합의한 {expected}ms와 다르다." for value in written if value != str(expected)
        )
    totals = written_values(section, TOTAL_LABEL)
    expected_total = sum(STAGES.values())
    if totals != [str(expected_total)]:
        problems.append(f"절에 '{TOTAL_LABEL} {expected_total}ms'가 정확히 한 번 있어야 한다. 지금: {totals}")
    if expected_total >= LIMIT_MS:
        problems.append(f"두 단계 합계 {expected_total}ms가 {LIMIT_MS}ms 미만이 아니다.")
    problems.extend(f"절에 {phrase!r}이(가) 없다." for phrase in REQUIRED if phrase not in section)
    return problems


class ModeIndicatorDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")
        cls.section = indicator_section(cls.notes)

    def test_section_follows_agreed_timing(self):
        self.assertEqual(indicator_doc_problems(self.notes), [])

    def test_agreed_total_is_under_limit(self):
        self.assertLess(sum(STAGES.values()), LIMIT_MS)

    def test_changing_a_number_fails(self):
        for label, value in {**STAGES, TOTAL_LABEL: sum(STAGES.values())}.items():
            original = f"{label} {value}ms"
            self.assertEqual(self.section.count(original), 1, original)
            for changed in (f"{label} {value + 1}ms", f"{label} 0{value}ms", f"{label} {value - 1}ms", f"{label} 260ms"):
                with self.subTest(changed=changed):
                    modified = self.notes.replace(original, changed, 1)
                    self.assertTrue(indicator_doc_problems(modified))

    def test_old_settle_time_with_matching_total_fails(self):
        # 예전 안착 260ms로 돌리고 합계까지 맞춰 적어도 합의와 300ms 규칙을 벗어난다.
        modified = self.notes.replace("안착 190ms", "안착 260ms", 1).replace("합계 280ms", "합계 350ms", 1)
        self.assertTrue(indicator_doc_problems(modified))

    def test_extra_wrong_number_fails(self):
        for label, value in STAGES.items():
            original = f"{label} {value}ms"
            with self.subTest(label=label):
                modified = self.notes.replace(original, f"{original}(예전 {label} 999ms)", 1)
                self.assertTrue(indicator_doc_problems(modified))
        modified = self.notes.replace("합계 280ms", "합계 280ms(다시 적은 합계 280ms)", 1)
        self.assertTrue(indicator_doc_problems(modified))

    def test_missing_or_duplicated_heading_fails(self):
        cases = {
            "삭제": self.notes.replace(SECTION_HEADING, "## 다른 제목", 1),
            "중복": self.notes.replace(SECTION_HEADING, f"{SECTION_HEADING}\n\n{SECTION_HEADING}", 1),
            "절 통째 삭제": self.notes.replace(f"{SECTION_HEADING}\n{self.section}", "", 1),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(indicator_doc_problems(modified))

    def test_section_hidden_in_comment_or_moved_out_fails(self):
        hidden = self.notes.replace(self.section, f"<!--{self.section}-->", 1)
        moved = self.notes.replace(self.section, f"\n## 다른 절\n{self.section}", 1)
        for case, modified in {"주석": hidden, "다른 절": moved}.items():
            with self.subTest(case=case):
                self.assertTrue(indicator_doc_problems(modified))

    def test_required_phrases_are_checked(self):
        for phrase in REQUIRED:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.section)
                modified = self.notes.replace(self.section, self.section.replace(phrase, "□"), 1)
                self.assertTrue(indicator_doc_problems(modified))


if __name__ == "__main__":
    unittest.main()
