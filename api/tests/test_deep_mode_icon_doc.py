"""답변 모드 선택기 절(#167)이 깊이 아이콘을 선 아이콘으로 설명하는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 하나만 읽는다.
절은 「### 답변 모드 선택기」 다음 줄부터 다음 `#`~`###` 제목 앞까지다.
HTML 주석 안 글은 화면에 보이지 않으므로 걷어 내고, 줄바꿈과 겹친 공백은 한 칸으로 줄여 읽는다.
"""

import re
import unittest
from pathlib import Path

UI_NOTES = Path(__file__).resolve().parents[2] / "web" / "docs" / "UI_NOTES.md"

SECTION_HEADING = "### 답변 모드 선택기"
SECTION_END = re.compile(r"#{1,3}(?=[ \t]|$)")

# 예전 반짝임 별 설명. 절 안에 남으면 안 된다.
FORBIDDEN = ("네 갈래 별", "✦")

# 선 속성 다섯 가지, 복제 규칙, 금지 규칙과 그 근거.
REQUIRED = (
    'fill="none"',
    'stroke="currentColor"',
    "stroke-width",
    'stroke-linecap="round"',
    'stroke-linejoin="round"',
    "cloneNode",
    "`index.html` 한 곳",
    "반짝임 별",
    "2026-11-18",
)


def visible_text(text):
    """HTML 주석을 걷어 낸 글. 닫히지 않은 주석은 문서 끝까지 숨은 것으로 본다."""
    return re.sub(r"<!--.*?(?:-->|\Z)", "", text, flags=re.DOTALL)


def mode_section(text):
    """절 본문. 제목이 정확히 한 번이 아니면 None."""
    lines = text.splitlines()
    starts = [index for index, line in enumerate(lines) if line.rstrip() == SECTION_HEADING]
    if len(starts) != 1:
        return None
    start = starts[0]
    end = next(
        (index for index in range(start + 1, len(lines)) if SECTION_END.match(lines[index])),
        len(lines),
    )
    return "\n".join(lines[start + 1 : end])


def icon_doc_problems(notes):
    section = mode_section(visible_text(notes))
    if section is None:
        return [f"{SECTION_HEADING!r} 제목이 문서에 한 번 있어야 한다."]
    flat = re.sub(r"\s+", " ", section)
    problems = [f"절에 예전 별 표현 {phrase!r}이(가) 남았다." for phrase in FORBIDDEN if phrase in flat]
    problems.extend(f"절에 {phrase!r}이(가) 없다." for phrase in REQUIRED if phrase not in flat)
    return problems


class DeepModeIconDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")
        cls.section = mode_section(cls.notes)

    def test_section_describes_line_icon(self):
        self.assertEqual(icon_doc_problems(self.notes), [])

    def test_star_wording_fails(self):
        for phrase in ("네 갈래 별(✦)", "✦", "네 갈래 별"):
            with self.subTest(phrase=phrase):
                modified = self.notes.replace(self.section, f"{self.section}\n- 깊이는 {phrase}을 쓴다.", 1)
                self.assertTrue(icon_doc_problems(modified))

    def test_required_phrases_are_checked(self):
        for phrase in REQUIRED:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, re.sub(r"\s+", " ", self.section))
                modified = self.notes.replace(self.section, re.sub(r"\s+", " ", self.section).replace(phrase, "□"), 1)
                self.assertTrue(icon_doc_problems(modified))

    def test_rules_hidden_in_comment_or_moved_out_fail(self):
        hidden = self.notes.replace(self.section, f"<!--{self.section}-->", 1)
        moved = self.notes.replace(self.section, f"\n### 다른 절\n{self.section}", 1)
        for case, modified in {"주석": hidden, "다른 절": moved}.items():
            with self.subTest(case=case):
                self.assertTrue(icon_doc_problems(modified))

    def test_star_outside_section_is_not_counted(self):
        modified = self.notes.replace("### 스크립트와 스타일이 함께 지키는 이름", "### 스크립트와 스타일이 함께 지키는 이름\n\n✦", 1)
        self.assertNotEqual(modified, self.notes)
        self.assertEqual(icon_doc_problems(modified), [])

    def test_missing_or_duplicated_heading_fails(self):
        cases = {
            "삭제": self.notes.replace(SECTION_HEADING, "### 다른 제목", 1),
            "중복": self.notes.replace(SECTION_HEADING, f"{SECTION_HEADING}\n\n{SECTION_HEADING}", 1),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertTrue(icon_doc_problems(modified))


if __name__ == "__main__":
    unittest.main()
