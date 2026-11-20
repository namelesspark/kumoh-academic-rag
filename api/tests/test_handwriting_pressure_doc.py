"""손글씨 필기 패드 절(#134)이 압력만 바뀐 신호의 칸 규칙(#185)을 한 번 적는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 하나만 읽는다.
절은 「## 손글씨 입력 필기 패드 (#134)」 다음 줄부터 다음 `#`·`##` 제목 앞까지다.
코드 울타리(``` · ~~~) 안의 줄과 HTML 주석 안 글은 화면에 규칙으로 보이지 않으므로 세지 않는다.
비교는 줄바꿈과 겹친 공백을 한 칸으로 줄인 글로 한다. 그래야 규칙 문장을 줄을 나눠 적어도 찾는다.
"""

import re
import unittest
from pathlib import Path

UI_NOTES = Path(__file__).resolve().parents[2] / "web" / "docs" / "UI_NOTES.md"

SECTION_HEADING = "## 손글씨 입력 필기 패드 (#134)"
RULE = "압력만 바뀐 신호는 마지막 잉크의 중심이 그 잉크를 기록할 때의 칸 안에 있을 때만 굵기를 갱신하고, 칸 밖이면 압력 값만 기억한다."
# 고치기 전 후속 과제로 남긴 설명. 확정 동작으로 바꿨으므로 문서 어디에도 남으면 안 된다.
OLD_FRAGMENT = "옛 경계 안쪽 픽셀이 조금 늘어난다"

SECTION_START = re.compile(r" {0,3}" + re.escape(SECTION_HEADING) + r"[ \t]*$")
# 절을 끝내는 제목: 같은 단계(`##`) 이상. `###` 하위 절은 절 안에 둔다.
SECTION_END = re.compile(r" {0,3}#{1,2}(?:[ \t]|$)")
FENCE_OPEN = re.compile(r" {0,3}(`{3,}|~{3,})")


def visible_text(text):
    """HTML 주석을 걷어 낸 글. 닫히지 않은 주석은 문서 끝까지 숨은 것으로 본다."""
    return re.sub(r"<!--.*?(?:-->|\Z)", "", text, flags=re.DOTALL)


def prose_lines(lines):
    """코드 울타리 밖의 줄 번호. 닫히지 않은 울타리는 문서 끝까지 이어진다."""
    prose = []
    fence = None
    for index, line in enumerate(lines):
        if fence is None:
            opened = FENCE_OPEN.match(line)
            if opened:
                fence = opened.group(1)
            else:
                prose.append(index)
            continue
        stripped = line.strip()
        if stripped and set(stripped) == {fence[0]} and len(stripped) >= len(fence):
            fence = None
    return prose


def flatten(text):
    return re.sub(r"\s+", " ", text).strip()


def pad_section(text):
    """절 본문을 한 줄로 편 글. 제목이 울타리 밖에 정확히 한 번 있지 않으면 None."""
    lines = visible_text(text).splitlines()
    prose = prose_lines(lines)
    starts = [index for index in prose if SECTION_START.match(lines[index])]
    if len(starts) != 1:
        return None
    start = starts[0]
    end = next((index for index in prose if index > start and SECTION_END.match(lines[index])), len(lines))
    body = [lines[index] for index in prose if start < index < end]
    return flatten("\n".join(body))


def pressure_doc_problems(notes):
    section = pad_section(notes)
    if section is None:
        return [f"{SECTION_HEADING!r} 제목이 문서에 한 번 있어야 한다."]
    problems = []
    count = section.count(RULE)
    if count != 1:
        problems.append(f"절에 압력 규칙 문장이 {count}번 있다. 정확히 한 번이어야 한다.")
    if OLD_FRAGMENT in flatten(notes):
        problems.append(f"문서에 옛 설명 {OLD_FRAGMENT!r}이(가) 남았다.")
    return problems


class HandwritingPressureDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")

    def rule_span(self):
        """문서에 적힌 규칙 문장 그대로(줄바꿈 포함). 바꿔 보는 검사가 실제 글을 건드리게 한다."""
        pattern = r"\s+".join(re.escape(word) for word in RULE.split())
        found = re.search(pattern, self.notes)
        self.assertIsNotNone(found)
        return found.group(0)

    def test_rule_written_once_in_pad_section(self):
        self.assertEqual(pressure_doc_problems(self.notes), [])

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
        span = self.rule_span()
        removed = self.notes.replace(span, "", 1)
        for heading in ("## 질문 수정·다시 답하기와 답변 버전 (#140)", "## 학사일정 월 달력 보기 (#143)"):
            with self.subTest(heading=heading):
                self.assertIn(f"\n{heading}\n", removed)
                moved = removed.replace(f"\n{heading}\n", f"\n{heading}\n\n- {RULE}\n", 1)
                self.assertTrue(pressure_doc_problems(moved))
        # 절 안에 새 `##` 제목을 끼워 규칙을 절 밖으로 밀어내도 실패한다.
        split = self.notes.replace(span, f"\n## 다른 절\n\n{span}", 1)
        self.assertTrue(pressure_doc_problems(split))

    def test_rule_hidden_in_comment_or_code_fails(self):
        span = self.rule_span()
        cases = {
            "주석": f"<!-- {span} -->",
            "백틱 울타리": f"\n```\n{span}\n```\n",
            "물결 울타리": f"\n~~~\n{span}\n~~~\n",
        }
        for case, wrapped in cases.items():
            with self.subTest(case=case):
                self.assertTrue(pressure_doc_problems(self.notes.replace(span, wrapped, 1)))

    def test_old_fragment_fails(self):
        modified = self.notes.replace(self.rule_span(), f"{self.rule_span()} 굵기가 늘어난 만큼 {OLD_FRAGMENT}.", 1)
        self.assertTrue(pressure_doc_problems(modified))
        wrapped = OLD_FRAGMENT.replace(" 픽셀이", "\n  픽셀이")
        elsewhere = self.notes.replace("\n## 학사일정 월 달력 보기 (#143)\n", f"\n## 학사일정 월 달력 보기 (#143)\n\n- {wrapped}.\n", 1)
        self.assertNotEqual(elsewhere, self.notes)
        self.assertTrue(pressure_doc_problems(elsewhere))

    def test_missing_or_duplicated_heading_fails(self):
        cases = {
            "삭제": self.notes.replace(SECTION_HEADING, "## 다른 제목", 1),
            "중복": self.notes.replace(SECTION_HEADING, f"{SECTION_HEADING}\n\n{SECTION_HEADING}", 1),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertTrue(pressure_doc_problems(modified))

    def test_subsection_heading_stays_inside(self):
        # `###` 하위 절은 절을 끝내지 않는다. 규칙은 「### 교차 검토로 고친 점」 아래에 있다.
        self.assertEqual(pressure_doc_problems(self.notes.replace(self.rule_span(), f"### 덧붙인 하위 절\n  {RULE}", 1)), [])


if __name__ == "__main__":
    unittest.main()
