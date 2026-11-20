"""답변 모드 선택기 절(#167)이 깊이 아이콘을 선 아이콘으로 설명하는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 하나만 읽는다.
절은 「### 답변 모드 선택기」 다음 줄부터 다음 제목 앞까지다. 앞에 공백을 둔 `#` 제목, `####` 이하 제목,
`---`·`===` 밑줄형 제목, HTML `<h1>`~`<h6>` 제목도 경계로 본다. 규칙이 하위 제목 아래로 밀려나면 실패로 다루기 위해서다.
HTML 주석 안 글은 화면에 보이지 않으므로 걷어 내고, 줄바꿈과 겹친 공백은 한 칸으로 줄여 읽는다.
복제 규칙은 이름만 찾으면 「복제하지 않는다」로 뒤집어도 통과하므로 문장 전체를 찾고 부정 표현을 막는다.
"""

import re
import unittest
from pathlib import Path

UI_NOTES = Path(__file__).resolve().parents[2] / "web" / "docs" / "UI_NOTES.md"

SECTION_HEADING = "### 답변 모드 선택기"
HEADING = re.compile(r"[ \t]*(?:#{1,6}(?=[ \t]|$)|<h[1-6](?=[\s>]))", re.IGNORECASE)
# 글줄 바로 아래 `---`·`===`만 있는 줄이 오면 그 글줄이 제목이 된다(밑줄형 제목, setext).
SETEXT_UNDERLINE = re.compile(r"[ \t]*(?:=+|-+)[ \t]*$")

# 예전 반짝임 별 설명과 복제 규칙을 뒤집는 말. 절 안에 남으면 안 된다.
FORBIDDEN = ("네 갈래 별", "✦")
NEGATED_CLONE = re.compile(r"복제(?:하지|해 쓰지|하지는|해서는|해선)\s*(?:않|안 |말)|복제 안 |복제하면 안")

CLONE_RULE = "메뉴는 알약의 SVG를 `cloneNode(true)`로 복제해 쓰고 복사본의 `hidden`만 뗀다."
SINGLE_SOURCE_RULE = "그래서 아이콘은 `index.html` 한 곳에만 두고, `chat.js`나 `chat.css`에 같은 그림을 따로 두지 않는다."

# 선 속성 다섯 가지, 복제 규칙 두 문장, 금지 규칙과 그 근거.
REQUIRED = (
    'fill="none"',
    'stroke="currentColor"',
    "stroke-width",
    'stroke-linecap="round"',
    'stroke-linejoin="round"',
    CLONE_RULE,
    SINGLE_SOURCE_RULE,
    "반짝임 별",
    "2026-11-18",
)


def visible_text(text):
    """HTML 주석을 걷어 낸 글. 닫히지 않은 주석은 문서 끝까지 숨은 것으로 본다."""
    return re.sub(r"<!--.*?(?:-->|\Z)", "", text, flags=re.DOTALL)


def mode_section(text):
    """절 본문. 제목이 정확히 한 번이 아니면 None."""
    lines = text.splitlines()
    starts = [index for index, line in enumerate(lines) if line.strip() == SECTION_HEADING]
    if len(starts) != 1:
        return None
    start = starts[0]
    end = next(
        (index for index in range(start + 1, len(lines)) if is_heading(lines, index)),
        len(lines),
    )
    return "\n".join(lines[start + 1 : end])


def is_heading(lines, index):
    """`#` 제목, HTML 제목, 또는 다음 줄이 밑줄인 글줄이면 참. 규칙을 절 밖으로 밀어내는 길을 막는다."""
    line = lines[index]
    if HEADING.match(line):
        return True
    following = lines[index + 1] if index + 1 < len(lines) else None
    return bool(line.strip()) and following is not None and bool(SETEXT_UNDERLINE.match(following))


def icon_doc_problems(notes):
    section = mode_section(visible_text(notes))
    if section is None:
        return [f"{SECTION_HEADING!r} 제목이 문서에 한 번 있어야 한다."]
    flat = re.sub(r"\s+", " ", section)
    problems = [f"절에 예전 별 표현 {phrase!r}이(가) 남았다." for phrase in FORBIDDEN if phrase in flat]
    problems.extend(f"절에 복제 규칙을 뒤집는 {found!r}이(가) 있다." for found in NEGATED_CLONE.findall(flat))
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

    def test_negated_clone_rule_fails(self):
        # 교차 검토 재현: 복제하지 않는다고 바꾸고 index.html 문장은 남긴 경우.
        rewritten = self.notes.replace(CLONE_RULE, "메뉴는 알약의 SVG를 `cloneNode(true)`로 복제하지 않는다.", 1)
        self.assertNotEqual(rewritten, self.notes)
        appended = self.notes.replace(self.section, f"{self.section}- 메뉴는 알약 아이콘을 복제하지 않는다.\n", 1)
        for case, modified in {"문장 교체": rewritten, "뒤집는 문장 추가": appended}.items():
            with self.subTest(case=case):
                self.assertTrue(icon_doc_problems(modified))

    def test_indented_heading_splits_section(self):
        # 교차 검토 재현: 복제 규칙 바로 위에 들여쓴 제목을 넣어 규칙을 절 밖으로 밀어낸 경우.
        marker = "- 메뉴는 알약의 SVG를"
        self.assertIn(marker, self.notes)
        for heading in (" ### 다른 절", "   ## 다른 절", "  #### 다른 절", "\t### 다른 절"):
            with self.subTest(heading=heading):
                modified = self.notes.replace(marker, f"{heading}\n\n{marker}", 1)
                self.assertTrue(icon_doc_problems(modified))

    def test_setext_and_html_heading_split_section(self):
        # 교차 검토 재현: 복제 규칙 바로 앞에 밑줄형 제목을 빈 줄로 구분해 넣은 경우.
        marker = "- 메뉴는 알약의 SVG를"
        headings = (
            "Other section\n-------------",
            "Other section\n=============",
            "다른 절\n   ---",
            "다른 절\n\t==",
            "<h3>다른 절</h3>",
            '<H2 id="x">다른 절</H2>',
        )
        for heading in headings:
            with self.subTest(heading=heading):
                modified = self.notes.replace(marker, f"\n{heading}\n\n{marker}", 1)
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(icon_doc_problems(modified))

    def test_indented_section_heading_is_found(self):
        modified = self.notes.replace(f"\n{SECTION_HEADING}\n", f"\n  {SECTION_HEADING}\n", 1)
        self.assertNotEqual(modified, self.notes)
        self.assertEqual(icon_doc_problems(modified), [])

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
