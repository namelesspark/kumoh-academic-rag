"""`## 접근성` 안 「동작 줄이기 설정 변경」 절(#221)이 합의한 규칙 줄 세 개를 지키는지 본다.
빠른 실행 링을 넣은 적용 대상 문장(#227)도 줄 전체로 비교해, 대상 하나만 빠져도 실패하게 한다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 하나만 읽는다. 스크립트의 실제 등록 모양은 웹 테스트가 따로 본다.
`## 접근성` 절은 줄 맨 앞 `#`·`##` 제목에서 끝나고, 하위 절은 줄 맨 앞 `#`~`####` 제목에서 끝난다.
규칙 줄을 `####` 아래로 옮기면 다른 절로 옮긴 것으로 보고 누락으로 친다.
HTML 주석과 코드 블록 안 글은 규칙이 아니라 예문이므로 걷어 내고 읽는다. 코드 블록 안의 `<!--`는 주석을 열지 않는다(#230).
빠른 실행 링·답변 모드 절의 `### 동작 줄이기`는 제목 줄 전체를 비교하므로 이 절로 잘못 잡지 않는다.
"""

import re
import unittest
from pathlib import Path

UI_NOTES = Path(__file__).resolve().parents[2] / "web" / "docs" / "UI_NOTES.md"

PARENT_HEADING = "## 접근성"
SECTION_HEADING = "### 동작 줄이기 설정 변경"
PARENT_BOUNDARY = re.compile(r"#{1,2}(?=[ \t]|$)")
SECTION_BOUNDARY = re.compile(r"#{1,4}(?=[ \t]|$)")
FENCE = re.compile(r"[ \t]{0,3}(`{3,}|~{3,})")
CLOSING_FENCE = re.compile(r" {0,3}(`{3,}|~{3,})[ \t]*")

# 낱말만 보면 「한 번만」을 「여러 번」으로 바꿔도 통과하므로 줄 전체를 비교한다.
RULE_LINES = (
    "- 첫 표시에는 미디어 쿼리(화면 조건 객체)의 현재 `matches` 값을 그대로 적용한다.",
    "- 화면을 연 뒤 설정을 켜면 진행 중인 전환과 걸어 둔 예약을 즉시 정리하고 최종 모양을 보여 준다.",
    "- 바뀜 처리기는 `addEventListener`가 함수면 그것으로, 아니면 옛 방식 `addListener`로 한 번만 등록하고, 둘 다 없으면 등록을 건너뛴다.",
)

# 적용 대상 문장(#227). 대상 하나를 빼도 걸리도록 줄 전체를 비교한다.
TARGET_LINE = (
    "화면을 연 채로 운영체제의 동작 줄이기(`prefers-reduced-motion`)를 켜는 경우를 다룬다. "
    "기능 패널, 깊이 생각 반짝임, 전송 아이콘, 캠퍼스 배경, 답변 모드 선택 표시, 빠른 실행 링이 같은 규칙을 따른다. "
    "빠른 실행 링의 단계별 정리는 「빠른 실행 링 예약 규칙」 절의 `### 동작 줄이기`에 적는다."
)


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


def reduced_motion_doc_problems(notes):
    """상위 절·하위 절이 없거나 두 번이거나, 규칙 줄이 빠지거나 겹치거나 다른 절로 가면 문제를 돌려준다."""
    lines = visible_lines(notes)
    parent = block_after(lines, PARENT_HEADING, PARENT_BOUNDARY)
    if parent is None:
        return [f"{PARENT_HEADING!r} 제목이 문서에 한 번 있어야 한다."]
    if lines.count(SECTION_HEADING) != 1:
        return [f"{SECTION_HEADING!r} 제목이 문서에 한 번 있어야 한다."]
    section = block_after(parent, SECTION_HEADING, SECTION_BOUNDARY)
    if section is None:
        return [f"{SECTION_HEADING!r} 절이 {PARENT_HEADING!r} 안에 있어야 한다."]
    problems = [f"{SECTION_HEADING!r}에 규칙 줄 {rule!r}이(가) 한 번 있어야 한다." for rule in RULE_LINES if section.count(rule) != 1]
    if section.count(TARGET_LINE) != 1:
        problems.append(f"{SECTION_HEADING!r}에 적용 대상 문장이 한 번 있어야 한다.")
    return problems


class ReducedMotionDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")

    def replaced(self, old, new):
        """`old`가 문서에 정확히 한 번 있는지 확인하고 바꾼 문서를 돌려준다."""
        self.assertEqual(self.notes.count(old), 1, old)
        return self.notes.replace(old, new, 1)

    def section_text(self):
        """하위 절 제목 줄부터 다음 `##` 제목 앞까지의 원문."""
        start = self.notes.index(f"{SECTION_HEADING}\n")
        end = self.notes.index("\n## ", start)
        return self.notes[start : end + 1]

    def test_section_follows_agreed_rules(self):
        self.assertEqual(reduced_motion_doc_problems(self.notes), [])

    def test_rule_moved_under_level_four_heading_fails(self):
        # 교차 검토 재현: 규칙 한 줄을 잘라 같은 절 끝에 새로 단 `#### 별도 규칙` 아래에 붙인다.
        for rule in RULE_LINES:
            removed = self.replaced(f"{rule}\n", "")
            moved = removed.replace(
                "\n## 시연 화면 검증 기록", f"\n#### 별도 규칙\n\n{rule}\n\n## 시연 화면 검증 기록", 1
            )
            with self.subTest(rule=rule):
                self.assertNotEqual(moved, removed)
                self.assertTrue(reduced_motion_doc_problems(moved))

    def test_missing_or_duplicated_rule_fails(self):
        for rule in RULE_LINES:
            with self.subTest(removed=rule):
                self.assertTrue(reduced_motion_doc_problems(self.replaced(f"{rule}\n", "")))
            with self.subTest(duplicated=rule):
                self.assertTrue(reduced_motion_doc_problems(self.replaced(f"{rule}\n", f"{rule}\n{rule}\n")))
            with self.subTest(duplicated_with_trailing_space=rule):
                self.assertTrue(reduced_motion_doc_problems(self.replaced(f"{rule}\n", f"{rule}\n{rule} \n")))

    def test_flipped_rule_fails(self):
        flips = {
            "현재 `matches` 값을 그대로": "처음 `matches` 값을 무시하고",
            "즉시 정리하고": "끝날 때까지 기다리고",
            "한 번만 등록하고": "바뀔 때마다 다시 등록하고",
            "아니면 옛 방식 `addListener`로": "아니면 등록하지 않고",
        }
        for old, new in flips.items():
            with self.subTest(flip=old):
                self.assertTrue(reduced_motion_doc_problems(self.replaced(old, new)))

    def test_missing_renamed_or_duplicated_heading_fails(self):
        cases = {
            "하위 절 제목 삭제": self.replaced(f"{SECTION_HEADING}\n", ""),
            # 다른 절에 이미 있는 `### 동작 줄이기`로 줄여도 이 절로 치지 않는다.
            "다른 절 제목과 같은 이름": self.replaced(f"{SECTION_HEADING}\n", "### 동작 줄이기\n"),
            "하위 절 제목 중복": self.replaced(f"{SECTION_HEADING}\n", f"{SECTION_HEADING}\n\n{SECTION_HEADING}\n"),
            "상위 절 제목 삭제": self.replaced(f"{PARENT_HEADING}\n", "## 접근 방식\n"),
            "상위 절 제목 중복": self.replaced(f"{PARENT_HEADING}\n", f"{PARENT_HEADING}\n\n{PARENT_HEADING}\n"),
            "절 통째 삭제": self.replaced(self.section_text(), ""),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertTrue(reduced_motion_doc_problems(modified))

    def test_section_moved_out_of_accessibility_fails(self):
        section = self.section_text()
        removed = self.replaced(section, "")
        cases = {
            "다른 상위 절 끼움": self.replaced(f"{SECTION_HEADING}\n", f"## 다른 절\n\n{SECTION_HEADING}\n"),
            "문서 끝으로 이동": f"{removed.rstrip()}\n\n{section}",
            "빠른 실행 링 절로 이동": removed.replace(
                "## 빠른 실행 링 예약 규칙 (#137)\n", f"## 빠른 실행 링 예약 규칙 (#137)\n\n{section}\n", 1
            ),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(reduced_motion_doc_problems(modified))

    def test_rule_moved_to_other_section_fails(self):
        # 규칙 줄을 같은 단계 다른 절이나 다른 절의 `### 동작 줄이기` 아래로 옮긴다.
        targets = ("## 시연 화면 검증 기록 (2026-11-14)\n", "## 빠른 실행 링 예약 규칙 (#137)\n", "## 답변 모드 선택 표시 시간 규칙\n")
        for rule in RULE_LINES:
            removed = self.replaced(f"{rule}\n", "")
            for target in targets:
                self.assertEqual(removed.count(target), 1, target)
                moved = removed.replace(target, f"{target}\n{rule}\n", 1)
                with self.subTest(rule=rule, target=target):
                    self.assertTrue(reduced_motion_doc_problems(moved))
            # `## 접근성` 안이지만 같은 단계의 다른 `###` 절로 옮긴다.
            with self.subTest(rule=rule, target="같은 단계 새 절"):
                moved = removed.replace("\n## 시연 화면 검증 기록", f"\n### 덧붙임\n\n{rule}\n\n## 시연 화면 검증 기록", 1)
                self.assertNotEqual(moved, removed)
                self.assertTrue(reduced_motion_doc_problems(moved))

    def test_rules_only_in_comment_or_code_block_fail(self):
        section = self.section_text()
        body = section[len(f"{SECTION_HEADING}\n") :]
        cases = {
            "절 전체 주석": self.replaced(section, f"<!--\n{section}-->\n"),
            "본문 주석": self.replaced(body, f"<!--\n{body}-->\n"),
            "닫히지 않은 주석": self.replaced(body, f"<!--\n{body}"),
            "본문 코드 블록": self.replaced(body, f"```text\n{body}```\n"),
            "물결 코드 블록": self.replaced(body, f"~~~\n{body}~~~\n"),
            "닫히지 않은 코드 블록": self.replaced(body, f"```\n{body}"),
        }
        for rule in RULE_LINES:
            cases[f"한 줄 주석 {rule[:12]}"] = self.replaced(f"{rule}\n", f"<!-- {rule} -->\n")
            cases[f"한 줄 코드 블록 {rule[:12]}"] = self.replaced(f"{rule}\n", f"```\n{rule}\n```\n")
            # 교차 검토 재현(#227): 블록 안 「```text」 줄은 블록을 닫지 않는다.
            cases[f"블록 안 여는 펜스 모양 줄 {rule[:12]}"] = self.replaced(f"{rule}\n", f"```text\n```text\n{rule}\n```\n")
            # 교차 검토 재현(#227): 네 칸 들여쓴 펜스 줄은 블록을 닫지 않는다.
            cases[f"블록 안 들여쓴 펜스 줄 {rule[:12]}"] = self.replaced(f"{rule}\n", f"```text\n    ```\n{rule}\n```\n")
        cases["적용 대상 문장 블록 안 여는 펜스 모양 줄"] = self.replaced(
            f"{TARGET_LINE}\n", f"```text\n```text\n{TARGET_LINE}\n```\n"
        )
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertTrue(reduced_motion_doc_problems(modified))

    def test_target_line_without_quick_ring_fails(self):
        # 교차 검토 재현(#227): 적용 대상에서 빠른 실행 링을 빼고, 링 안내 문장까지 지운다.
        reverted = TARGET_LINE.replace(", 빠른 실행 링이 같은", "가 같은").split(" 빠른 실행 링의 단계별")[0]
        self.assertNotIn("빠른 실행 링", reverted)
        cases = {
            "링만 뺌": self.replaced(", 빠른 실행 링이 같은 규칙을", "가 같은 규칙을"),
            "#221 문장으로 되돌림": self.replaced(f"{TARGET_LINE}\n", f"{reverted}\n"),
            "문장 삭제": self.replaced(f"{TARGET_LINE}\n", ""),
            "문장 중복": self.replaced(f"{TARGET_LINE}\n", f"{TARGET_LINE}\n{TARGET_LINE}\n"),
            "주석": self.replaced(f"{TARGET_LINE}\n", f"<!-- {TARGET_LINE} -->\n"),
            "링 절로 이동": self.replaced(f"{TARGET_LINE}\n", "").replace(
                "## 빠른 실행 링 예약 규칙 (#137)\n", f"## 빠른 실행 링 예약 규칙 (#137)\n\n{TARGET_LINE}\n", 1
            ),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(reduced_motion_doc_problems(modified))

    def test_heading_inside_code_block_does_not_close_section(self):
        # 코드 블록 안 `## ` 예문은 제목이 아니므로 절을 닫지 않는다.
        example = "```text\n## 예문 제목\n```\n"
        modified = self.replaced(f"{SECTION_HEADING}\n", f"{SECTION_HEADING}\n\n{example}")
        self.assertEqual(reduced_motion_doc_problems(modified), [])

    def test_comment_marker_inside_code_block_is_example(self):
        # 교차 검토 재현(#230): 예전에는 블록 안 `<!--`부터 문서 끝까지 숨어 맞는 문서도 실패했다.
        examples = {
            "백틱": "```html\n<!-- 여는 표식만 있는 예문\n```\n",
            "물결": "~~~html\n<!-- 여는 표식만 있는 예문\n~~~\n",
        }
        for fence, example in examples.items():
            cases = {
                "상위 절 앞": self.replaced(f"{PARENT_HEADING}\n", f"{example}\n{PARENT_HEADING}\n"),
                "하위 절 안": self.replaced(f"{SECTION_HEADING}\n", f"{SECTION_HEADING}\n\n{example}"),
            }
            for case, modified in cases.items():
                with self.subTest(fence=fence, case=case):
                    self.assertEqual(reduced_motion_doc_problems(modified), [])

    def test_fence_like_line_inside_comment_does_not_open_block(self):
        # 주석 안 펜스 모양 줄이 블록을 열면 주석이 끝난 뒤의 실제 규칙까지 숨는다.
        for fence in ("```", "~~~"):
            cases = {
                "펜스 줄만": f"<!--\n{fence}\n-->\n",
                "펜스 줄과 메모": f"<!-- 메모\n{fence}text\n예문\n-->\n",
            }
            for case, comment in cases.items():
                modified = self.replaced(f"{SECTION_HEADING}\n", f"{comment}\n{SECTION_HEADING}\n")
                with self.subTest(fence=fence, case=case):
                    self.assertEqual(reduced_motion_doc_problems(modified), [])

    def test_rule_still_hidden_around_code_block_example(self):
        # 블록 안 예문을 보이게 고쳐도 블록 밖 주석과 주석 안 펜스 뒤 규칙은 계속 숨는다.
        for rule in RULE_LINES:
            cases = {
                "예문 블록 뒤 한 줄 주석": f"```html\n<!--\n```\n<!-- {rule} -->\n",
                "예문 블록 뒤 닫히지 않은 주석": f"~~~\n<!--\n~~~\n<!--\n{rule}\n",
                "주석 안 펜스 뒤 규칙": f"<!--\n```\n{rule}\n-->\n",
                "주석 뒤 닫히지 않은 코드 블록": f"<!--\n~~~\n-->\n```\n{rule}\n",
            }
            for case, wrapped in cases.items():
                with self.subTest(rule=rule[:12], case=case):
                    self.assertTrue(reduced_motion_doc_problems(self.replaced(f"{rule}\n", wrapped)))


if __name__ == "__main__":
    unittest.main()
