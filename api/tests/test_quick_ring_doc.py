"""빠른 실행 링 예약 규칙 절(#164)의 ms 숫자가 quick-actions.js 상수와 같은지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md`와 `quick-actions.js` 두 파일만 읽는다.
절 경계는 줄 맨 앞 `## ` 제목만 본다. HTML 주석과 코드 블록 안 글은 규칙이 아니므로 걷어 내고 읽는다.
코드 블록 안의 `<!--`는 예문이므로 주석을 열지 않는다(#230).

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
# 여는 펜스 앞은 공백 0~3칸만 받는다. 탭은 4칸 탭 정지까지 펼쳐지므로 탭으로 들여쓴 줄은 펜스가 아니다(#230).
# 백틱 펜스 뒤 정보 문자열에 백틱이 있으면(「```example```」) 인라인 코드이므로 블록을 열지 않는다. 물결 펜스는 연다.
FENCE = re.compile(r" {0,3}(`{3,}(?=[^`]*$)|~{3,})")
REDUCED_RULES = {
    "등록 순서": "- 바뀜 처리기는 `addEventListener`가 함수일 때 그것으로 한 번 등록하고, 아니면 `addListener`가 함수일 때 그것으로 한 번 등록하며, 둘 다 없으면 등록하지 않고 열 때 `matches`를 따른다. 처리기는 받은 값의 `matches`만 읽는다(옛 Safari는 이벤트 대신 미디어 쿼리를 넘긴다).",
    "단계별 예약 정리": "- 열기 콜백을 기다리는 중이나 펼침 중에 `prefers-reduced-motion`을 켜면 열기 콜백과 누름 허용 타이머를 지우고 그 자리에서 `data-open`과 `data-settled`를 붙이며, 닫히는 중에 켜면 숨김 타이머를 지우고 곧바로 `hidden`을 붙인다.",
    "숨길 때 초점": "- 펼친 채 정리할 때는 초점과 `aria-expanded=\"true\"`를 그대로 두고, 닫히는 중에 곧바로 숨길 때는 초점이 링 안에 있으면 + 버튼으로 옮기고 링 밖에 있으면 그대로 둔다.",
    # quick-actions.js의 재배치 콜백은 moved()로 + 버튼이 1px 넘게 옮겨 갔는지 먼저 보고, 옮겨 갔으면 closeRing()이 설정을 읽는다.
    # 아니면 place()가 자리를 찾고, 자리가 없으면 layoutKey 전에 false를 돌려줘 역시 closeRing()이 닫는다.
    # 자리가 있으면 layoutKey(+ 가운데 좌표, 반올림한 방울 좌표, 좁은 배치)가 바뀔 때만 resettle()이 설정을 읽는다.
    "재배치 콜백": "- 본문이 바뀌어 걸어 둔 재배치 콜백은 설정이 바뀌어도 지우지 않는다. 도착하면 먼저 + 버튼의 왼쪽·위쪽 좌표가 열었을 때보다 1px 넘게 움직였는지 보고, 움직였거나 방울을 놓을 자리가 없으면 배치 기준을 비교하지 않고 링을 닫는다. 닫을 때 그때의 설정이 켜져 있으면 숨김 타이머 없이 바로 숨기고, 꺼져 있으면 숨김 300ms 뒤에 숨긴다. 링을 계속 열어 두면 배치 기준(+ 버튼 가운데 좌표, 1px 단위로 반올림한 방울 좌표, 좁은 배치 여부)이 바뀐 경우에만 그때의 설정을 읽어, 켜져 있으면 바로 `data-settled`를 붙이고 꺼져 있으면 누름 허용 290ms 동안 누름을 막는다. 방울이 1px 미만으로만 움직이는 등 기준이 그대로면 `data-settled`와 걸어 둔 누름 허용 타이머를 건드리지 않는다.",
}
# 실제 동작과 어긋나 바꾼 옛 줄. 링 절 어디에도 보이는 줄로 남으면 안 된다.
STALE_RULES = (
    "- 열기 콜백을 기다리는 중이나 펼침 중에 `prefers-reduced-motion`을 켜면 곧바로 `data-open`과 `data-settled`가 붙는다.",
    "- 닫히는 중에 켜면 숨김 타이머를 기다리지 않고 곧바로 `hidden`이 된다.",
    "- 본문이 바뀌어 걸어 둔 재배치 콜백은 설정이 바뀌어도 지우지 않고 도착한 때의 설정을 따른다. 켜져 있으면 바로 `data-settled`를 붙이고, 꺼져 있으면 자리가 바뀐 경우에만 누름 허용 290ms 동안 누름을 막는다.",
    "- 본문이 바뀌어 걸어 둔 재배치 콜백은 설정이 바뀌어도 지우지 않는다. 도착했을 때 방울 자리가 바뀐 경우에만 그때의 설정을 읽어, 켜져 있으면 바로 `data-settled`를 붙이고 꺼져 있으면 누름 허용 290ms 동안 누름을 막는다. 자리가 그대로면 `data-settled`와 걸어 둔 누름 허용 타이머를 건드리지 않는다.",
    "- 본문이 바뀌어 걸어 둔 재배치 콜백은 설정이 바뀌어도 지우지 않는다. 도착했을 때 배치 기준(+ 버튼 가운데 좌표, 1px 단위로 반올림한 방울 좌표, 좁은 배치 여부)이 바뀐 경우에만 그때의 설정을 읽어, 켜져 있으면 바로 `data-settled`를 붙이고 꺼져 있으면 누름 허용 290ms 동안 누름을 막는다. 방울이 1px 미만으로만 움직이는 등 기준이 그대로면 `data-settled`와 걸어 둔 누름 허용 타이머를 건드리지 않는다.",
    "- 본문이 바뀌어 걸어 둔 재배치 콜백은 설정이 바뀌어도 지우지 않는다. 도착했을 때 방울을 놓을 자리가 있으면 배치 기준(+ 버튼 가운데 좌표, 1px 단위로 반올림한 방울 좌표, 좁은 배치 여부)이 바뀐 경우에만 그때의 설정을 읽어, 켜져 있으면 바로 `data-settled`를 붙이고 꺼져 있으면 누름 허용 290ms 동안 누름을 막는다. 방울이 1px 미만으로만 움직이는 등 기준이 그대로면 `data-settled`와 걸어 둔 누름 허용 타이머를 건드리지 않는다. 놓을 자리가 없으면 배치 기준을 비교하지 않고 링을 닫으며, 그때의 설정이 켜져 있으면 숨김 타이머 없이 바로 숨기고 꺼져 있으면 숨김 300ms 뒤에 숨긴다.",
)
CLOSING_FENCE = re.compile(r" {0,3}(`{3,}|~{3,})[ \t]*")


def visible_lines(text):
    """HTML 주석과 코드 블록을 걷어 낸 줄 목록. 닫히지 않은 주석·코드 블록은 문서 끝까지 숨은 것으로 본다.

    한 줄씩 읽으며 펜스 상태와 주석 상태를 함께 따진다(#230). 코드 블록 안의 `<!--`는 예문이라 주석을 열지 않고,
    주석 안의 펜스 모양 줄은 블록을 열지 않는다. 펜스는 주석 밖에서 시작하는 줄에서만 연다.
    공백 세 칸 이하로 시작하고 여는 펜스와 같은 글자로만 된 줄(길이는 같거나 길게)이 블록을 닫는다.
    블록 안의 「```text」 줄이나 네 칸 이상 들여쓴 펜스 줄은 글로 본다.
    여러 줄 주석은 여는 표식 앞 글과 닫는 표식 뒤 글을 한 줄로 잇는다.
    """
    lines = []
    fence = None
    in_comment = False
    pending = ""
    for raw in text.splitlines():
        if fence is not None:
            closing = CLOSING_FENCE.fullmatch(raw)
            if closing and closing.group(1)[0] == fence[0] and len(closing.group(1)) >= len(fence):
                fence = None
            continue
        if not in_comment:
            opened = FENCE.match(raw)
            if opened:
                fence = opened.group(1)
                continue
        out = pending if in_comment else ""
        rest = raw
        while True:
            if in_comment:
                end = rest.find("-->")
                if end < 0:
                    break
                rest = rest[end + 3 :]
                in_comment = False
            start = rest.find("<!--")
            if start < 0:
                out += rest
                break
            out += rest[:start]
            rest = rest[start + 4 :]
            in_comment = True
        if in_comment:
            pending = out
            continue
        pending = ""
        # 줄 끝 공백은 화면에 보이지 않으므로 걷어 내고 비교한다.
        lines.append(out.rstrip(" \t"))
    if in_comment and pending:
        lines.append(pending.rstrip(" \t"))
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
    problems = [
        f"{REDUCED_HEADING!r}에 {name} 규칙 줄이 한 번 있어야 한다."
        for name, rule in REDUCED_RULES.items()
        if block.count(rule) != 1
    ]
    problems.extend(f"링 절에 옛 줄 {stale!r}이(가) 남아 있다." for stale in STALE_RULES if stale in section)
    return problems


def visible_text(text):
    """HTML 주석과 코드 블록을 걷어 낸 글(`visible_lines()`와 같은 줄).

    코드 블록 안 `## ` 예문이 링 절을 끊거나 블록에만 적은 숫자·글자가 검사를 통과하지 않게 블록도 걷어 낸다.
    """
    return "\n".join(visible_lines(text))


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
            "재배치 콜백": ("1px 단위로 반올림한 방울 좌표", "소수 둘째 자리까지 잰 방울 좌표"),
        }
        for name, rule in REDUCED_RULES.items():
            old, new = flips[name]
            self.assertIn(old, rule)
            cases = {
                "삭제": self.without(rule),
                "중복": self.replaced(self.notes, f"{rule}\n", f"{rule}\n{rule}\n"),
                # 교차 검토 재현: 줄 끝 공백은 보이지 않으므로 같은 줄을 한 번 더 쓴 것으로 본다.
                "끝 공백 붙인 중복": self.replaced(self.notes, f"{rule}\n", f"{rule}\n{rule} \n"),
                "뜻 바꿈": self.replaced(self.notes, f"{rule}\n", f"{rule.replace(old, new)}\n"),
            }
            for case, modified in cases.items():
                with self.subTest(rule=name, case=case):
                    self.assertTrue(reduced_rule_problems(modified))

    def test_reflow_without_room_rule_is_checked(self):
        # 교차 검토 재현: + 버튼이 1px 넘게 옮겨 갔거나(moved) 자리가 없으면 배치 기준 전에 링을 닫고,
        # 닫을 때 현재 설정을 읽는다(closeRing).
        rule = REDUCED_RULES["재배치 콜백"]
        close = " 닫을 때 그때의 설정이 켜져 있으면 숨김 타이머 없이 바로 숨기고, 꺼져 있으면 숨김 300ms 뒤에 숨긴다."
        flips = {
            "+ 버튼 이동 삭제": rule.replace("먼저 + 버튼의 왼쪽·위쪽 좌표가 열었을 때보다 1px 넘게 움직였는지 보고, 움직였거나 ", ""),
            "+ 버튼 이동 기준 바꿈": rule.replace("1px 넘게 움직였는지", "조금이라도 움직였는지"),
            "자리 없음 삭제": rule.replace("움직였거나 방울을 놓을 자리가 없으면", "움직였으면"),
            "닫을 때 설정 문장 삭제": rule.replace(close, ""),
            "설정 무시": rule.replace("그때의 설정이 켜져 있으면 숨김 타이머 없이 바로 숨기고, 꺼져 있으면", "언제나"),
        }
        self.assertIn(close, rule)
        for case, changed in flips.items():
            with self.subTest(case=case):
                self.assertNotEqual(changed, rule)
                self.assertTrue(reduced_rule_problems(self.replaced(self.notes, f"{rule}\n", f"{changed}\n")))

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
                # 교차 검토 재현: 블록 안 「```text」 줄은 블록을 닫지 않으므로 규칙도 블록 안에 있다.
                "블록 안 여는 펜스 모양 줄": f"```text\n```text\n{rule}\n```\n",
                # 교차 검토 재현: 네 칸 들여쓴 펜스 줄은 블록 안의 글이므로 블록을 닫지 않는다.
                "블록 안 들여쓴 펜스 줄": f"```text\n    ```\n{rule}\n```\n",
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

    def test_stale_rule_left_in_ring_section_fails(self):
        # 실제 동작과 어긋난 옛 줄을 새 줄 옆이나 같은 절의 다른 하위 절에 되살린다.
        heading = self.ring_reduced_heading(self.notes)
        start = self.notes.index(f"{SECTION_HEADING}\n")
        for stale in STALE_RULES:
            self.assertNotIn(stale, self.notes)
            cases = {
                "새 줄 옆": self.insert_after(self.notes, heading, True, stale),
                "`### 초점`": self.insert_after(self.notes, self.notes.index("### 초점\n", start), True, stale),
                "끝 공백 붙임": self.insert_after(self.notes, heading, True, f"{stale} "),
            }
            for case, modified in cases.items():
                with self.subTest(stale=stale[:20], case=case):
                    self.assertTrue(reduced_rule_problems(modified))

    def test_heading_inside_code_block_does_not_close_subsection(self):
        # 코드 블록 안 `### ` 예문은 제목이 아니므로 하위 절을 닫지 않는다.
        heading = self.ring_reduced_heading(self.notes)
        modified = self.insert_after(self.notes, heading, True, "```text\n### 예문 제목\n```")
        self.assertEqual(reduced_rule_problems(modified), [])


class QuickRingCommentInCodeBlockTest(unittest.TestCase):
    """코드 블록 안 `<!--` 예문과 주석 안 펜스 모양 줄(#230). 사례 문서는 실제 문서를 메모리에서 고쳐 만든다."""

    EXAMPLES = {
        "백틱": "```html\n<!-- 여는 표식만 있는 예문\n```\n",
        "물결": "~~~html\n<!-- 여는 표식만 있는 예문\n~~~\n",
    }

    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")
        cls.script = SCRIPT.read_text(encoding="utf-8")

    def replaced(self, old, new):
        self.assertEqual(self.notes.count(old), 1, old)
        return self.notes.replace(old, new, 1)

    def problems(self, notes):
        return ring_doc_problems(notes, self.script) + reduced_rule_problems(notes)

    def test_comment_marker_inside_code_block_is_example(self):
        # 교차 검토 재현: 예전에는 블록 안 `<!--`부터 문서 끝까지 숨어 링 절 제목과 규칙 줄을 못 찾았다.
        heading = f"{SECTION_HEADING}\n"
        reduced = self.notes.index(f"\n{REDUCED_HEADING}\n", self.notes.index(heading)) + 1
        for fence, example in self.EXAMPLES.items():
            cases = {
                "링 절 앞": self.replaced(heading, f"{example}\n{heading}"),
                "링 절 머리말": self.replaced(heading, f"{heading}\n{example}"),
                "`### 동작 줄이기` 안": f"{self.notes[:reduced]}{REDUCED_HEADING}\n\n{example}{self.notes[reduced + len(REDUCED_HEADING) + 1:]}",
            }
            for case, modified in cases.items():
                with self.subTest(fence=fence, case=case):
                    self.assertNotEqual(modified, self.notes)
                    self.assertEqual(self.problems(modified), [])

    def test_heading_example_in_code_block_does_not_cut_ring_section(self):
        # 교차 검토 재현: 블록 안 `## Example` 예문을 링 절 제목으로 읽으면 절이 끊겨 맞는 문서도 실패한다.
        heading = f"{SECTION_HEADING}\n"
        for fence in ("```", "~~~"):
            example = f"{fence}html\n<!--\n## Example\n-->\n{fence}\n"
            with self.subTest(fence=fence):
                self.assertEqual(self.problems(self.replaced(heading, f"{heading}\n{example}")), [])

    def test_tab_indented_fence_line_does_not_open_block(self):
        # 교차 검토 재현: 탭은 4칸 탭 정지까지 펼쳐지므로 탭으로 들여쓴 펜스 모양 줄은 블록을 열지 않는다.
        heading = f"{SECTION_HEADING}\n"
        for prefix in ("\t", " \t", "   \t"):
            for fence in ("```", "~~~"):
                modified = self.replaced(heading, f"{prefix}{fence}html\n\n{heading}")
                with self.subTest(prefix=repr(prefix), fence=fence):
                    self.assertEqual(self.problems(modified), [])

    def test_inline_code_with_backticks_does_not_open_block(self):
        # 교차 검토 재현: 백틱 펜스 정보 문자열에는 백틱이 올 수 없으므로 「```example```」은 인라인 코드다.
        heading = f"{SECTION_HEADING}\n"
        for line in ("```example```", "````example````", "   ```a`b", "```js `x`"):
            for case, modified in {
                "문서 맨 앞": f"{line}\n\n{self.notes}",
                "링 절 앞": self.replaced(heading, f"{line}\n\n{heading}"),
            }.items():
                with self.subTest(line=line, case=case):
                    self.assertEqual(self.problems(modified), [])

    def test_tilde_fence_with_backticks_in_info_still_opens_block(self):
        # 물결 펜스의 정보 문자열에는 백틱·물결이 와도 되므로 블록을 연다.
        for name, rule in REDUCED_RULES.items():
            for opener in ("~~~a~~~", "~~~js `x`"):
                with self.subTest(rule=name, opener=opener):
                    self.assertTrue(reduced_rule_problems(self.replaced(f"{rule}\n", f"{opener}\n{rule}\n~~~\n")))

    def test_tab_indented_fence_line_does_not_close_block(self):
        # 블록 안 탭 들여쓴 펜스 줄은 블록을 닫지 않으므로 그 뒤의 규칙은 계속 블록 안에 있다.
        for name, rule in REDUCED_RULES.items():
            for fence in ("```", "~~~"):
                wrapped = f"{fence}text\n\t{fence}\n{rule}\n{fence}\n"
                with self.subTest(rule=name, fence=fence):
                    self.assertTrue(reduced_rule_problems(self.replaced(f"{rule}\n", wrapped)))

    def test_ring_numbers_only_in_code_block_fail(self):
        # 교차 검토 재현: 실제 절 본문을 블록 안으로 옮기면 숫자·필수 글자가 예문에만 남으므로 실패해야 한다.
        section = ring_section(self.notes)
        for fence in ("```", "~~~"):
            for case, wrapped in {
                "본문만": f"\n{fence}text\n{section}\n{fence}\n",
                "주석 표식과 함께": f"\n{fence}text\n<!--\n{section}\n-->\n{fence}\n",
            }.items():
                with self.subTest(fence=fence, case=case):
                    self.assertTrue(ring_doc_problems(self.replaced(section, wrapped), self.script))

    def test_fence_like_line_inside_comment_does_not_open_block(self):
        # 주석 안 펜스 모양 줄이 블록을 열면 주석이 끝난 뒤의 실제 규칙까지 숨는다.
        heading = f"{SECTION_HEADING}\n"
        for fence in ("```", "~~~"):
            cases = {
                "펜스 줄만": f"<!--\n{fence}\n-->\n",
                "펜스 줄과 메모": f"<!-- 메모\n{fence}text\n예문\n-->\n",
            }
            for case, comment in cases.items():
                modified = self.replaced(heading, f"{comment}\n{heading}")
                with self.subTest(fence=fence, case=case):
                    self.assertEqual(self.problems(modified), [])

    def test_rule_still_hidden_around_code_block_example(self):
        # 블록 안 예문을 보이게 고쳐도 블록 밖 주석과 주석 안 펜스 뒤 규칙은 계속 숨는다.
        for name, rule in REDUCED_RULES.items():
            cases = {
                "예문 블록 뒤 한 줄 주석": f"```html\n<!--\n```\n<!-- {rule} -->\n",
                "예문 블록 뒤 닫히지 않은 주석": f"~~~\n<!--\n~~~\n<!--\n{rule}\n",
                "주석 안 펜스 뒤 규칙": f"<!--\n```\n{rule}\n-->\n",
                "주석 뒤 닫히지 않은 코드 블록": f"<!--\n~~~\n-->\n```\n{rule}\n",
            }
            for case, wrapped in cases.items():
                with self.subTest(rule=name, case=case):
                    self.assertTrue(reduced_rule_problems(self.replaced(f"{rule}\n", wrapped)))


if __name__ == "__main__":
    unittest.main()
