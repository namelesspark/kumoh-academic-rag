"""답변 모드 선택 표시 시간 규칙 절(#218)이 합의한 ms 숫자와 규칙 줄을 지키는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 하나만 읽는다. CSS와 스크립트 숫자는 웹 테스트가 따로 맞춘다.
절은 줄 맨 앞 `## ` 제목에서 끝나고, 하위 절은 줄 맨 앞 `##`·`###`·`####` 제목에서 끝난다.
HTML 주석 안 글은 화면에 보이지 않으므로 걷어 내고 읽는다.
"""

import re
import unittest
from pathlib import Path

UI_NOTES = Path(__file__).resolve().parents[2] / "web" / "docs" / "UI_NOTES.md"

SECTION_HEADING = "## 답변 모드 선택 표시 시간 규칙"
LEVEL_TWO = re.compile(r"##(?=[ \t]|$)")
SUB_BOUNDARY = re.compile(r"#{2,4}(?=[ \t]|$)")

# 이슈 #218에서 합의한 두 단계 시간. 합계는 둘을 더한 값이고 300ms 미만이어야 한다.
STAGES = {"늘어남": 90, "안착": 190}
TOTAL_LABEL = "합계"
LIMIT_MS = 300

# 하위 절마다 글자 그대로 있어야 하는 규칙 줄. 낱말만 보면 「바꾸지 않는다」를 「바꾼다」로 뒤집어도 통과하므로 줄 전체를 비교한다.
RULE_LINES = {
    "### 시간": (
        "- 늘어남 90ms: 표시가 지금 자리와 목표 항목을 함께 덮도록 길어진다. CSS 기본 전환과 안착 예약 타이머가 같은 값을 쓴다.",
        "- 안착 190ms: 늘어난 표시가 목표 항목 크기로 줄어들며 자리를 잡는다. transform과 height가 같은 시간을 쓴다.",
        "- 합계 280ms: 늘어남과 안착을 이어 붙인 시간이며 300ms 미만이다.",
    ),
    "### 곡선": (
        "- 기본 곡선은 `cubic-bezier(.34, 1.4, .64, 1)`이다. 끝에서 살짝 넘쳤다가 돌아온다.",
        "- 스프링 곡선 `linear()`는 `@supports` 안에서만 쓴다. 지원하지 않는 브라우저는 기본 곡선으로 같은 시간 안에 끝난다.",
    ),
    "### 연속 방향키 이동": (
        "- 방향키를 아래→위→아래처럼 연달아 누르면 새 이동이 앞 예약을 지우므로 안착 예약은 하나만 남는다.",
        "- 예약을 실행하면 표시는 마지막으로 초점을 받은 항목에 안착한다.",
        "- 방향키 이동은 초점만 옮기고 `aria-checked`를 바꾸지 않는다. 선택 확정은 Enter·Space만 한다.",
    ),
    "### 동작 줄이기": (
        "- `prefers-reduced-motion`을 처음부터 켜 두면 연속 이동 내내 표시가 바로 제자리에 놓이고 예약을 걸지 않는다.",
        "- 이동 도중에 켜면 걸어 둔 예약을 버리고 마지막 항목에 바로 놓는다.",
        "- 설정을 다시 꺼도 건너뛴 움직임을 재생하지 않는다.",
    ),
}


def visible_text(text):
    """HTML 주석을 걷어 낸 글. 닫히지 않은 주석은 문서 끝까지 숨은 것으로 본다."""
    return re.sub(r"<!--.*?(?:-->|\Z)", "", text, flags=re.DOTALL)


def block_after(lines, heading, boundary):
    """`heading` 줄 다음부터 `boundary` 제목 앞(없으면 끝)까지의 줄 목록. 제목이 한 번이 아니면 None."""
    starts = [index for index, line in enumerate(lines) if line == heading]
    if len(starts) != 1:
        return None
    start = starts[0]
    end = next((index for index in range(start + 1, len(lines)) if boundary.match(lines[index])), len(lines))
    return lines[start + 1 : end]


def indicator_section(text):
    """절 본문(제목 다음 줄부터 다음 `## ` 제목 앞까지). 제목이 한 번이 아니면 None."""
    body = block_after(text.splitlines(), SECTION_HEADING, LEVEL_TWO)
    return None if body is None else "\n".join(body)


def written_values(section, label):
    """절 안 「이름표 숫자ms」의 숫자 글자들. 「0090ms」처럼 앞에 0을 붙인 글도 그대로 돌려준다."""
    return re.findall(rf"{label} (\d+)ms", section)


def indicator_doc_problems(notes):
    """절이 없거나, 숫자가 합의와 다르거나, 규칙 줄이 빠지거나 바뀌거나 다른 하위 절로 가면 문제를 돌려준다."""
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
    section_lines = section.splitlines()
    for heading, rules in RULE_LINES.items():
        body = block_after(section_lines, heading, SUB_BOUNDARY)
        if body is None:
            problems.append(f"절 안에 {heading!r} 하위 절이 한 번 있어야 한다.")
            continue
        problems.extend(f"{heading!r}에 규칙 줄 {rule!r}이(가) 한 번 있어야 한다." for rule in rules if body.count(rule) != 1)
    return problems


def in_section(notes, old, new):
    """이 절 제목 뒤에서만 `old`를 한 번 바꾼 문서. 제목 뒤에 `old`가 정확히 한 번 있어야 한다."""
    marker = f"{SECTION_HEADING}\n"
    head, tail = notes.split(marker, 1)
    if tail.count(old) != 1:
        raise AssertionError(f"절 뒤에 {old!r}이(가) 한 번 있어야 한다.")
    return head + marker + tail.replace(old, new, 1)


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
        # `### 시간`·`### 동작 줄이기`는 빠른 실행 링 절에도 있으므로 이 절 안에서만 지운다.
        for heading in RULE_LINES:
            cases[f"{heading} 삭제"] = in_section(self.notes, f"\n{heading}\n", "\n")
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

    def test_removing_or_flipping_a_rule_line_fails(self):
        flips = {
            "`aria-checked`를 바꾸지 않는다": "`aria-checked`를 바꾼다",
            "Enter·Space만": "Enter·Space·방향키가",
            "하나만 남는다": "여러 개 남는다",
            "재생하지 않는다": "다시 재생한다",
            "`@supports` 안에서만": "`@supports` 밖에서도",
        }
        # 「재생하지 않는다」 같은 글은 앞 절(#152)에도 있으므로 이 절 안에서만 바꾼다.
        for old, new in flips.items():
            with self.subTest(flip=old):
                self.assertEqual(self.section.count(old), 1, old)
                self.assertTrue(indicator_doc_problems(in_section(self.notes, old, new)))
        for rules in RULE_LINES.values():
            for rule in rules:
                with self.subTest(removed=rule):
                    self.assertEqual(self.notes.count(f"{rule}\n"), 1, rule)
                    self.assertTrue(indicator_doc_problems(self.notes.replace(f"{rule}\n", "", 1)))

    def test_rule_line_moved_to_other_subsection_fails(self):
        # 교차 검토 재현: 선택 확정 줄을 같은 절의 `### 검사` 아래로 옮긴다.
        for heading, rules in RULE_LINES.items():
            for rule in rules:
                removed = self.notes.replace(f"{rule}\n", "", 1)
                for target in [*RULE_LINES, "### 검사"]:
                    if target == heading:
                        continue
                    moved = in_section(removed, f"\n{target}\n", f"\n{target}\n\n{rule}\n")
                    with self.subTest(rule=rule, target=target):
                        self.assertTrue(indicator_doc_problems(moved))


if __name__ == "__main__":
    unittest.main()
