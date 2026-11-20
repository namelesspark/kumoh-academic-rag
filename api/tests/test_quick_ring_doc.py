"""빠른 실행 링 예약 규칙 절(#164)의 ms 숫자가 quick-actions.js 상수와 같은지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md`와 `quick-actions.js` 두 파일만 읽는다.
절 경계는 줄 맨 앞 `## ` 제목만 본다. HTML 주석 안 글은 화면에 보이지 않으므로 걷어 내고 읽는다.
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


if __name__ == "__main__":
    unittest.main()
