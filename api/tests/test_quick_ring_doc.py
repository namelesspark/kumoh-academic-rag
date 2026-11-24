"""빠른 실행 링 예약 규칙 절(#164)의 ms 숫자가 quick-actions.js 상수와 같은지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md`와 `quick-actions.js` 두 파일만 읽는다.
절 경계는 줄 맨 앞 `## ` 제목만 본다. HTML 주석 안 글은 화면에 보이지 않으므로 걷어 내고 읽는다.

`### 동작 줄이기` 규칙 줄 네 개(#227)는 줄 전체로 비교한다. 이 검사는 HTML 주석과 코드 블록을 걷어 낸 줄만 보고,
링 절은 줄 맨 앞 `#`·`##` 제목에서, 하위 절은 `#`~`####` 제목에서 끝난다. `####` 아래로 옮긴 줄은 다른 절로 친다.
`discover -s api/tests`에서 모듈 경로가 달라지므로 보조 함수는 다른 테스트 모듈에서 가져오지 않고 이 파일에 둔다.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UI_NOTES = ROOT / "web" / "docs" / "UI_NOTES.md"
SCRIPT = ROOT / "api" / "app" / "chat_web" / "assets" / "quick-actions.js"

SECTION_HEADING = "## 빠른 실행 링 예약 규칙 (#137)"
LEVEL_TWO = re.compile(r"##(?=[ \t]|$)")

# 문서 이름표와 코드 상수 이름의 짝.
LABELS = {"누름 허용": "settleMs", "숨김": "closeMs"}

# 절에 꼭 남아야 하는 글자. 회차 규칙, 대체 타이머, 동작 줄이기 세 시점, Esc 뒤 초점.
REQUIRED = (
    "회차",
    "16ms",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "prefers-reduced-motion",
    "기다리는 중",
    "펼침 중",
    "닫히는 중",
    "Esc",
    "aria-expanded",
)

# `### 동작 줄이기` 규칙 줄(#227). 낱말만 보면 뜻을 뒤집어도 통과하므로 줄 전체를 비교한다.
REDUCED_HEADING = "### 동작 줄이기"
SECTION_BOUNDARY = re.compile(r"#{1,2}(?=[ \t]|$)")
SUBSECTION_BOUNDARY = re.compile(r"#{1,4}(?=[ \t]|$)")
FENCE = re.compile(r"[ \t]{0,3}(```|~~~)")
REDUCED_RULES = {
    "등록 순서": "- 바뀜 처리기는 `addEventListener`가 함수일 때 그것으로 한 번 등록하고, 아니면 `addListener`가 함수일 때 그것으로 한 번 등록하며, 둘 다 없으면 등록하지 않고 열 때 `matches`를 따른다. 처리기는 받은 값의 `matches`만 읽는다(옛 Safari는 이벤트 대신 미디어 쿼리를 넘긴다).",
    "단계별 예약 정리": "- 열기 콜백을 기다리는 중이나 펼침 중에 `prefers-reduced-motion`을 켜면 열기 콜백과 누름 허용 타이머를 지우고 그 자리에서 `data-open`과 `data-settled`를 붙이며, 닫히는 중에 켜면 숨김 타이머를 지우고 곧바로 `hidden`을 붙인다.",
    "숨길 때 초점": "- 펼친 채 정리할 때는 초점과 `aria-expanded=\"true\"`를 그대로 두고, 닫히는 중에 곧바로 숨길 때는 초점이 링 안에 있으면 + 버튼으로 옮기고 링 밖에 있으면 그대로 둔다.",
    "재배치 콜백": "- 본문이 바뀌어 걸어 둔 재배치 콜백은 설정이 바뀌어도 지우지 않고 도착한 때의 설정을 따른다. 켜져 있으면 바로 `data-settled`를 붙이고, 꺼져 있으면 자리가 바뀐 경우에만 누름 허용 290ms 동안 누름을 막는다.",
}


def visible_lines(text):
    """HTML 주석과 코드 블록을 걷어 낸 줄 목록. 닫히지 않은 주석·코드 블록은 문서 끝까지 숨은 것으로 본다."""
    lines = []
    fence = None
    for line in visible_text(text).splitlines():
        opened = FENCE.match(line)
        if fence is None and opened:
            fence = opened.group(1)
        elif fence is not None:
            if line.lstrip(" \t").startswith(fence):
                fence = None
        else:
            lines.append(line)
    return lines


def block_after(lines, heading, boundary):
    """`heading` 줄 다음부터 `boundary` 제목 앞(없으면 끝)까지의 줄 목록. 제목이 한 번이 아니면 None."""
    starts = [index for index, line in enumerate(lines) if line == heading]
    if len(starts) != 1:
        return None
    start = starts[0]
    end = next((index for index in range(start + 1, len(lines)) if boundary.match(lines[index])), len(lines))
    return lines[start + 1 : end]


def reduced_rule_problems(notes):
    """링 절이나 그 안의 `### 동작 줄이기`가 한 번이 아니거나, 규칙 줄이 빠지거나 겹치면 문제를 돌려준다."""
    section = block_after(visible_lines(notes), SECTION_HEADING, SECTION_BOUNDARY)
    if section is None:
        return [f"{SECTION_HEADING!r} 제목이 보이는 줄에 한 번 있어야 한다."]
    block = block_after(section, REDUCED_HEADING, SUBSECTION_BOUNDARY)
    if block is None:
        return [f"{SECTION_HEADING!r} 안에 {REDUCED_HEADING!r} 제목이 한 번 있어야 한다."]
    return [
        f"{REDUCED_HEADING!r}에 {name} 규칙 줄이 한 번 있어야 한다."
        for name, rule in REDUCED_RULES.items()
        if block.count(rule) != 1
    ]


def visible_text(text):
    """HTML 주석을 걷어 낸 글. 닫히지 않은 주석은 문서 끝까지 숨은 것으로 본다."""
    return re.sub(r"<!--.*?(?:-->|\Z)", "", text, flags=re.DOTALL)


def script_constants(script):
    """`const` 선언 안의 settleMs·closeMs 값. 선언이 정확히 하나가 아니면 None."""
    values = {}
    for name in LABELS.values():
        found = re.findall(rf"(?<![\w.$]){name}\s*=\s*(\d+)(?=\s*[,;])", script)
        values[name] = int(found[0]) if len(found) == 1 else None
    return values


def ring_section(text):
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


def ring_doc_problems(notes, script):
    """절이 없거나, 이름표 ms가 상수와 다르거나, 꼭 있어야 할 글자가 빠지면 문제를 돌려준다."""
    section = ring_section(visible_text(notes))
    if section is None:
        return [f"{SECTION_HEADING!r} 제목이 문서에 한 번 있어야 한다."]
    constants = script_constants(script)
    problems = []
    for label, name in LABELS.items():
        expected = constants[name]
        if expected is None:
            problems.append(f"quick-actions.js에 {name} 선언이 한 번 있어야 한다.")
            continue
        # 숫자로 바꾸지 않고 글자 그대로 비교한다. 「0290ms」도 다른 문구로 본다.
        written = re.findall(rf"{label} (\d+)ms", section)
        if str(expected) not in written:
            problems.append(f"절에 '{label} {expected}ms'가 없다.")
        problems.extend(
            f"절의 '{label} {value}ms'가 {name} {expected}와 다르다."
            for value in written
            if value != str(expected)
        )
    problems.extend(f"절에 {phrase!r}이(가) 없다." for phrase in REQUIRED if phrase not in section)
    return problems


class QuickRingDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")
        cls.script = SCRIPT.read_text(encoding="utf-8")
        cls.constants = script_constants(cls.script)

    def test_section_matches_script_constants(self):
        self.assertEqual(ring_doc_problems(self.notes, self.script), [])

    def test_constants_are_found_once(self):
        for name, value in self.constants.items():
            with self.subTest(name=name):
                self.assertIsInstance(value, int)

    def test_changing_a_doc_number_fails(self):
        for label, name in LABELS.items():
            value = self.constants[name]
            original = f"{label} {value}ms"
            for changed in (f"{label} {value + 1}ms", f"{label} 0{value}ms", f"{label} {value - 1}ms"):
                with self.subTest(changed=changed):
                    modified = self.notes.replace(original, changed)
                    self.assertTrue(ring_doc_problems(modified, self.script))

    def test_extra_wrong_number_fails(self):
        for label, name in LABELS.items():
            value = self.constants[name]
            original = f"{label} {value}ms"
            with self.subTest(label=label):
                modified = self.notes.replace(original, f"{original}(예전 {label} 999ms)", 1)
                self.assertTrue(ring_doc_problems(modified, self.script))

    def test_changing_a_script_constant_fails(self):
        for name, value in self.constants.items():
            with self.subTest(name=name):
                modified = re.sub(rf"(?<![\w.$]){name}\s*=\s*{value}", f"{name} = {value + 10}", self.script)
                self.assertNotEqual(modified, self.script)
                self.assertTrue(ring_doc_problems(self.notes, modified))

    def test_missing_or_duplicated_heading_fails(self):
        cases = {
            "삭제": self.notes.replace(SECTION_HEADING, "## 다른 제목", 1),
            "중복": self.notes.replace(SECTION_HEADING, f"{SECTION_HEADING}\n\n{SECTION_HEADING}", 1),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertTrue(ring_doc_problems(modified, self.script))

    def test_numbers_hidden_in_comment_or_moved_out_fail(self):
        section = ring_section(self.notes)
        hidden = self.notes.replace(section, f"<!--{section}-->", 1)
        moved = self.notes.replace(section, f"\n## 다른 절\n{section}", 1)
        for case, modified in {"주석": hidden, "다른 절": moved}.items():
            with self.subTest(case=case):
                self.assertTrue(ring_doc_problems(modified, self.script))

    def test_required_phrases_are_checked(self):
        section = ring_section(self.notes)
        for phrase in REQUIRED:
            with self.subTest(phrase=phrase):
                modified = self.notes.replace(section, section.replace(phrase, "□"), 1)
                self.assertTrue(ring_doc_problems(modified, self.script))


class QuickRingReducedRuleDocTest(unittest.TestCase):
    """`### 동작 줄이기` 규칙 줄(#227). 사례 문서는 실제 문서를 메모리에서 고쳐 만든다."""

    ANSWER_HEADING = "## 답변 모드 선택 표시 시간 규칙\n"

    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")

    def replaced(self, notes, old, new):
        """`old`가 `notes`에 정확히 한 번 있는지 확인하고 바꾼 문서를 돌려준다."""
        self.assertEqual(notes.count(old), 1, old)
        return notes.replace(old, new, 1)

    def without(self, rule):
        return self.replaced(self.notes, f"{rule}\n", "")

    def ring_reduced_heading(self, notes):
        """링 절 안 `### 동작 줄이기` 제목 줄의 위치. 답변 모드 절의 같은 제목과 섞지 않는다."""
        start = notes.index(f"{SECTION_HEADING}\n")
        return notes.index(f"\n{REDUCED_HEADING}\n", start) + 1

    def insert_after(self, notes, index, line, text):
        """`line`이 참이면 `index`가 든 줄 다음에 빈 줄과 `text` 줄을, 거짓이면 `index` 자리에 `text`를 그대로 끼운다."""
        end = notes.index("\n", index) + 1
        return f"{notes[:end]}\n{text}\n{notes[end:]}" if line else f"{notes[:index]}{text}{notes[index:]}"

    def test_rules_are_in_ring_reduced_motion(self):
        self.assertEqual(reduced_rule_problems(self.notes), [])

    def test_missing_duplicated_or_flipped_rule_fails(self):
        flips = {
            "등록 순서": ("아니면 `addListener`가", "그리고 `addListener`도"),
            "단계별 예약 정리": ("숨김 타이머를 지우고", "숨김 타이머를 기다리고"),
            "숨길 때 초점": ("링 밖에 있으면 그대로 둔다", "링 밖에 있어도 + 버튼으로 옮긴다"),
            "재배치 콜백": ("설정이 바뀌어도 지우지 않고", "설정이 바뀌면 지우고"),
        }
        for name, rule in REDUCED_RULES.items():
            old, new = flips[name]
            self.assertIn(old, rule)
            cases = {
                "삭제": self.without(rule),
                "중복": self.replaced(self.notes, f"{rule}\n", f"{rule}\n{rule}\n"),
                "뜻 바꿈": self.replaced(self.notes, f"{rule}\n", f"{rule.replace(old, new)}\n"),
            }
            for case, modified in cases.items():
                with self.subTest(rule=name, case=case):
                    self.assertTrue(reduced_rule_problems(modified))

    def test_rule_moved_elsewhere_fails(self):
        for name, rule in REDUCED_RULES.items():
            removed = self.without(rule)
            ring_start = removed.index(f"{SECTION_HEADING}\n")
            answer_start = removed.index(self.ANSWER_HEADING)
            answer_reduced = removed.index(f"\n{REDUCED_HEADING}\n", answer_start) + 1
            cases = {
                "같은 절 `### 초점`": self.insert_after(removed, removed.index("### 초점\n", ring_start), True, rule),
                "같은 절 새 `####`": self.insert_after(
                    removed, removed.index("### 초점\n", ring_start), False, f"#### 덧붙임\n\n{rule}\n\n"
                ),
                "링 절 머리말": self.insert_after(removed, ring_start, True, rule),
                "답변 모드 `### 동작 줄이기`": self.insert_after(removed, answer_reduced, True, rule),
                "다른 `##` 절": self.insert_after(removed, answer_start, True, rule),
            }
            for case, modified in cases.items():
                with self.subTest(rule=name, case=case):
                    self.assertNotEqual(modified, removed)
                    self.assertTrue(reduced_rule_problems(modified))

    def test_rule_hidden_in_comment_or_code_block_fails(self):
        for name, rule in REDUCED_RULES.items():
            cases = {
                "한 줄 주석": f"<!-- {rule} -->\n",
                "여러 줄 주석": f"<!--\n{rule}\n-->\n",
                "닫히지 않은 주석": f"<!--\n{rule}\n",
                "백틱 코드 블록": f"```text\n{rule}\n```\n",
                "물결 코드 블록": f"~~~\n{rule}\n~~~\n",
                "닫히지 않은 코드 블록": f"```\n{rule}\n",
            }
            for case, wrapped in cases.items():
                with self.subTest(rule=name, case=case):
                    self.assertTrue(reduced_rule_problems(self.replaced(self.notes, f"{rule}\n", wrapped)))

    def test_missing_or_duplicated_heading_fails(self):
        heading = self.ring_reduced_heading(self.notes)
        line = f"{REDUCED_HEADING}\n"
        cases = {
            "하위 절 제목 바꿈": f"{self.notes[:heading]}### 동작 줄임{self.notes[heading + len(REDUCED_HEADING):]}",
            "하위 절 제목 중복": f"{self.notes[:heading]}{line}\n{self.notes[heading:]}",
            "하위 절 제목 주석": f"{self.notes[:heading]}<!-- {REDUCED_HEADING} -->{self.notes[heading + len(REDUCED_HEADING):]}",
            "링 절 제목 삭제": self.replaced(self.notes, f"{SECTION_HEADING}\n", "## 다른 제목\n"),
            "링 절 제목 중복": self.replaced(self.notes, f"{SECTION_HEADING}\n", f"{SECTION_HEADING}\n\n{SECTION_HEADING}\n"),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(reduced_rule_problems(modified))

    def test_heading_inside_code_block_does_not_close_subsection(self):
        # 코드 블록 안 `### ` 예문은 제목이 아니므로 하위 절을 닫지 않는다.
        heading = self.ring_reduced_heading(self.notes)
        modified = self.insert_after(self.notes, heading, True, "```text\n### 예문 제목\n```")
        self.assertEqual(reduced_rule_problems(modified), [])


if __name__ == "__main__":
    unittest.main()
