"""답변 모드 선택기 절(#167)이 깊이 아이콘을 선 아이콘으로 설명하는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 하나만 읽는다.
절은 「### 답변 모드 선택기」 다음 줄부터 다음 제목 앞까지다. 앞에 공백을 둔 `#` 제목, `####` 이하 제목,
`---`·`===` 밑줄형 제목, HTML `<h1>`~`<h6>` 제목도 경계로 본다.
코드 블록(``` · ~~~ 울타리)과 `<pre>`·`<script>`·`<style>`·`<textarea>` 원문 블록 안의 줄은 화면에 글로만
보이므로 절 제목으로 치지 않는다. 절 제목은 상위 제목 「## 입력 상자 안 답변 모드와 반투명 패널 (#110)」 바로 아래
(빈 줄 하나 사이)에 있을 때만 인정한다. 그래야 절 앞에 무엇을 끼워 넣어 감싸도 실패한다.
경계 모양을 하나씩 막는 것만으로는 빈틈이 남는다. 그래서 절 본문은 목록 줄(`- `), 하위 목록 줄(`  - `),
두 칸 들여쓴 이어지는 줄, 빈 줄만 허용하고 HTML 태그와 코드 울타리(``` · ~~~)를 어디에서든 막는다.
HTML 주석 안 글은 화면에 보이지 않으므로 걷어 낸다. 비교는 화면에 보이는 글자로 한다. HTML 엔티티(`&#10022;` 등)는
풀고, 폭 없는 문자는 지우고, 줄바꿈과 겹친 공백은 한 칸으로 줄인다.
별·반짝이 기호는 ✦ 하나만이 아니라 유니코드 이름에 STAR·SPARKLE이 든 글자 전체를 막는다.
규칙(선 속성, 복제, 금지, 표시와 빛줄기 조건)은 낱말만 찾으면 뜻을 뒤집어도 통과하므로 문장 전체를 찾는다.
복제 규칙은 부정 표현도 따로 막는다.
"""

import html
import re
import unicodedata
import unittest
from pathlib import Path

UI_NOTES = Path(__file__).resolve().parents[2] / "web" / "docs" / "UI_NOTES.md"

PARENT_HEADING = "## 입력 상자 안 답변 모드와 반투명 패널 (#110)"
SECTION_HEADING = "### 답변 모드 선택기"
# 네 칸 이상 들여쓰면 코드로 보이므로 절 제목은 앞 공백 세 칸까지만 인정한다.
SECTION_START = re.compile(r" {0,3}" + re.escape(SECTION_HEADING) + r"[ \t]*$")
PARENT_START = re.compile(r" {0,3}" + re.escape(PARENT_HEADING) + r"[ \t]*$")
FENCE_OPEN = re.compile(r" {0,3}(`{3,}|~{3,})")
# 마크다운이 빈 줄에서도 끝내지 않고 닫는 태그까지 원문으로 두는 HTML 블록(CommonMark 1종).
RAW_BLOCK_OPEN = re.compile(r" {0,3}<(?:pre|script|style|textarea)(?=[\s>]|$)", re.IGNORECASE)
RAW_BLOCK_CLOSE = re.compile(r"</(?:pre|script|style|textarea)>", re.IGNORECASE)
CODE_FENCE_ANYWHERE = re.compile(r"`{3,}|~{3,}")
INVISIBLE = re.compile("[­​-‏⁠﻿]")
STAR_NAME = re.compile(r"\b(?:STARS?|SPARKLES?)\b")
EXTRA_SPARKLES = {"\U0001F4AB"}  # 💫 DIZZY SYMBOL은 이름에 STAR가 없다.
# 절 본문에 허용하는 줄: 목록, 하위 목록, 두 칸 들여쓴 이어지는 줄(제목·인용·울타리·밑줄로 시작하지 않음).
LIST_LINE = re.compile(r"(?:- |  - |  (?![\s#>~=<\-]|```))\S")
RAW_HTML = re.compile(r"<[A-Za-z/!?]")
HEADING = re.compile(r"[ \t]*(?:#{1,6}(?=[ \t]|$)|<h[1-6](?=[\s>]))", re.IGNORECASE)
# 글줄 바로 아래 `---`·`===`만 있는 줄이 오면 그 글줄이 제목이 된다(밑줄형 제목, setext).
SETEXT_UNDERLINE = re.compile(r"[ \t]*(?:=+|-+)[ \t]*$")

# 예전 반짝임 별 설명과 복제 규칙을 뒤집는 말. 절 안에 남으면 안 된다.
OLD_STAR_WORDING = re.compile(r"네\s*갈래\s*별")
NEGATED_CLONE = re.compile(r"복제(?:하지|해 쓰지|하지는|해서는|해선)\s*(?:않|안 |말)|복제 안 |복제하면 안")

# 규칙은 낱말이 아니라 문장 전체로 찾는다. 낱말만 찾으면 「주지 않고」「쓸 수 있다」처럼 뜻을 뒤집어도 통과한다.
LINE_RULE = (
    '`fill="none"`, `stroke="currentColor"`, `stroke-width`(1.8~2), `stroke-linecap="round"`, '
    '`stroke-linejoin="round"`를 SVG에 주고 경로에는 채움을 주지 않는다.'
)
CLONE_RULE = "메뉴는 알약의 SVG를 `cloneNode(true)`로 복제해 쓰고 복사본의 `hidden`만 뗀다."
SINGLE_SOURCE_RULE = "그래서 아이콘은 `index.html` 한 곳에만 두고, `chat.js`나 `chat.css`에 같은 그림을 따로 두지 않는다."
BAN_RULE = "반짝임 별이나 반짝이 이모지 꼴 아이콘은 쓰지 않는다(2026-11-18 팀 피드백)."
# chat.js render()는 모드 표시를 먼저 바꾸고, 새로 고를 때만 움직임이 허용되면 빛줄기를 붙인다.
DISPLAY_RULE = "깊이 모드는 움직임과 상관없이 「깊이 생각」 이름과 이 선 아이콘으로 표시한다."
# chat.css의 480px 이하 규칙은 `.mode-pill-label`을 숨기고, chat.js render()는 aria-label에 이름을 넣는다.
NARROW_RULE = (
    "480px 이하 좁은 화면에서는 버튼 이름을 숨기고 아이콘과 꺾쇠만 남기며, "
    "읽기 도구에는 `aria-label`로 이름을 전한다."
)
# setupAiMode()는 저장된 값을 읽은 뒤 render()로 같은 표시를 그린다.
RESTORE_RULE = "새로고침 뒤 저장된 깊이 모드도 같은 모습으로 표시한다."
FLOW_RULE = "빛줄기는 깊이 모드를 새로 고르고 움직임 줄이기가 꺼져 있을 때만 한 번 지나간다(아래 표의 `.mode-pill.is-flowing`)."
# 알약에서 두 모드가 어떤 아이콘을 쓰는지 소개하는 문장. index.html의 깊이 SVG는 선 그림이다.
ICON_INTRO = "빠르게는 번개 아이콘과 「빠르게」, 깊이는 선으로 그린 아이콘과 「깊이 생각」을 보이고 끝에 꺾쇠를 둔다."

# 규칙 문장을 인용해 놓고 부정하는 말. 실제 문서의 이 절에는 없다.
CONTRADICTION = re.compile(r"틀렸다|틀린 설명|사실이 아니|사실과 다르|맞지 않|빠르게로 돌아간")

REQUIRED = (
    ICON_INTRO, LINE_RULE, CLONE_RULE, SINGLE_SOURCE_RULE, BAN_RULE,
    DISPLAY_RULE, NARROW_RULE, RESTORE_RULE, FLOW_RULE,
)


def visible_text(text):
    """HTML 주석을 걷어 낸 글. 닫히지 않은 주석은 문서 끝까지 숨은 것으로 본다."""
    return re.sub(r"<!--.*?(?:-->|\Z)", "", text, flags=re.DOTALL)


def mode_section(text):
    """절 본문. 제목이 정확히 한 번이 아니거나 상위 제목 바로 아래가 아니면 None."""
    lines = text.splitlines()
    raw = raw_lines(lines)
    starts = [index for index, line in enumerate(lines) if index not in raw and SECTION_START.match(line)]
    if len(starts) != 1:
        return None
    start = starts[0]
    if start < 2 or lines[start - 1].strip() or not PARENT_START.match(lines[start - 2]) or start - 2 in raw:
        return None
    end = next(
        (index for index in range(start + 1, len(lines)) if is_heading(lines, index)),
        len(lines),
    )
    return "\n".join(lines[start + 1 : end])


def raw_lines(lines):
    """코드 울타리와 원문 HTML 블록에 든 줄 번호. 닫히지 않은 블록은 문서 끝까지 이어진다."""
    raw = set()
    fence = None
    in_html = False
    for index, line in enumerate(lines):
        if fence is None and not in_html:
            opened = FENCE_OPEN.match(line)
            if opened:
                fence = opened.group(1)
                raw.add(index)
            elif RAW_BLOCK_OPEN.match(line):
                raw.add(index)
                in_html = not RAW_BLOCK_CLOSE.search(line)
            continue
        raw.add(index)
        if in_html:
            in_html = not RAW_BLOCK_CLOSE.search(line)
            continue
        stripped = line.strip()
        indent = len(line) - len(line.lstrip(" "))
        if indent <= 3 and stripped and set(stripped) == {fence[0]} and len(stripped) >= len(fence):
            fence = None
    return raw


def shape_problems(section):
    """목록 꼴이 아닌 줄, HTML 태그, 코드 울타리가 있으면 그 줄을 알린다."""
    problems = []
    for line in section.splitlines():
        if line.strip() and not LIST_LINE.match(line):
            problems.append(f"절에 목록 꼴이 아닌 줄 {line!r}이(가) 있다.")
        elif RAW_HTML.search(line):
            problems.append(f"절에 HTML 태그가 든 줄 {line!r}이(가) 있다.")
        elif CODE_FENCE_ANYWHERE.search(line):
            problems.append(f"절에 코드 울타리가 든 줄 {line!r}이(가) 있다.")
    return problems


def rendered(section):
    """화면에 보이는 글자에 가깝게 바꾼 한 줄. 엔티티를 풀고 폭 없는 문자를 지운 뒤 공백을 줄인다."""
    return re.sub(r"\s+", " ", INVISIBLE.sub("", html.unescape(section)))


def star_glyphs(text):
    return sorted({char for char in text if char in EXTRA_SPARKLES or STAR_NAME.search(unicodedata.name(char, ""))})


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
    flat = rendered(section)
    problems = shape_problems(section)
    if OLD_STAR_WORDING.search(flat):
        problems.append("절에 예전 별 표현 '네 갈래 별'이 남았다.")
    problems.extend(f"절에 별·반짝이 기호 {glyph!r}이(가) 보인다." for glyph in star_glyphs(flat))
    problems.extend(f"절에 복제 규칙을 뒤집는 {found!r}이(가) 있다." for found in NEGATED_CLONE.findall(flat))
    problems.extend(f"절에 규칙을 부정하는 {found!r}이(가) 있다." for found in CONTRADICTION.findall(flat))
    problems.extend(f"절에 {phrase!r}이(가) 한 문장으로 없다." for phrase in REQUIRED if not standalone(phrase, flat))
    return problems


def standalone(sentence, flat):
    """목록 기호나 앞 문장 바로 뒤에서 시작하고 공백·끝에서 끝나는 독립 문장이면 참. 「…」 인용은 인정하지 않는다."""
    return re.search(r"(?:^|(?<=- )|(?<=\. ))" + re.escape(sentence) + r"(?=\s|$)", flat) is not None


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
                # 줄바꿈을 건너 적힌 문구도 찾되, 목록 모양은 그대로 둔 채 그 문구만 지운다.
                pattern = r"\s+".join(re.escape(word) for word in phrase.split())
                removed, count = re.subn(pattern, "□", self.section, count=1)
                self.assertEqual(count, 1)
                modified = self.notes.replace(self.section, removed, 1)
                self.assertEqual(shape_problems(mode_section(modified)), [])
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

    def test_reversed_rule_sentences_fail(self):
        # 교차 검토 재현: 금지 문장과 선 속성 문장의 뜻을 뒤집은 경우. 빛줄기만으로 알린다는 옛 설명도 본다.
        cases = {
            "금지 뒤집기": ("꼴 아이콘은 쓰지 않는다", "꼴 아이콘도 쓸 수 있다"),
            "선 속성 뒤집기": ("SVG에 주고 경로에는 채움을 주지 않는다", "SVG에 주지 않고 경로에는 채움을 준다"),
            "표시 조건 지우기": ("움직임과 상관없이", "빛줄기로만"),
            "빛줄기 조건 지우기": ("새로 고르고", "고를 때마다"),
            # 교차 검토 재현: 깊이 아이콘을 번개로 잘못 소개한 경우와 빛줄기 문장 끝을 뒤집은 경우.
            "깊이 아이콘 바꾸기": ("깊이는 선으로 그린 아이콘과", "깊이는 번개 아이콘과"),
            "빛줄기 문장 끝 뒤집기": ("한 번 지나간다(아래 표", "한 번 지나간다는 설명은 틀렸다(아래 표"),
            # 교차 검토 재현: 저장 복원 문장을 뒤집은 경우와 좁은 화면 예외를 지운 경우.
            "저장 복원 뒤집기": (RESTORE_RULE, "새로고침 뒤 저장된 깊이 모드는 표시하지 않는다."),
            "좁은 화면 예외 지우기": ("버튼 이름을 숨기고", "버튼 이름도 보이고"),
            "읽기 도구 이름 지우기": ("`aria-label`로 이름을 전한다", "이름을 전하지 않는다"),
        }
        for case, (before, after) in cases.items():
            with self.subTest(case=case):
                modified = self.notes.replace(before, after, 1)
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(icon_doc_problems(modified))

    def test_quoted_and_denied_rule_fails(self):
        # 교차 검토 재현: 복원 문장을 「」로 감싸 틀렸다고 하고 빠르게로 돌아간다고 적은 경우.
        denied = self.notes.replace(
            RESTORE_RULE,
            f"「{RESTORE_RULE}」라는 설명은 틀렸다. 새로고침하면 빠르게로 돌아간다.",
            1,
        )
        self.assertNotEqual(denied, self.notes)
        self.assertTrue(icon_doc_problems(denied))
        # 부정하는 말 없이 인용만 해도, 모든 규칙 문장에서 실패한다.
        for phrase in REQUIRED:
            with self.subTest(phrase=phrase):
                pattern = r"\s+".join(re.escape(word) for word in phrase.split())
                quoted, count = re.subn(pattern, lambda found: f"「{found.group(0)}」라는 설명", self.section, count=1)
                self.assertEqual(count, 1)
                self.assertTrue(icon_doc_problems(self.notes.replace(self.section, quoted, 1)))

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

    def test_section_heading_inside_code_block_is_not_found(self):
        # 교차 검토 재현: 절 제목 위와 다음 절 제목 위에 울타리를 넣어 실제 절을 코드 블록으로 만든 경우.
        next_heading = "\n### 스크립트와 스타일이 함께 지키는 이름\n"
        for opening, closing in (("~~~markdown", "~~~"), ("```", "```"), ("  ~~~~", "~~~~~")):
            with self.subTest(fence=opening):
                opened = self.notes.replace(f"\n{SECTION_HEADING}\n", f"\n{opening}\n{SECTION_HEADING}\n", 1)
                before_next = opened.replace(next_heading, f"\n{closing}{next_heading}", 1)
                after_next = opened.replace(next_heading, f"{next_heading}{closing}\n", 1)
                for case, modified in {"다음 제목 위": before_next, "다음 제목 아래": after_next}.items():
                    with self.subTest(case=case):
                        self.assertNotEqual(modified, opened)
                        self.assertTrue(icon_doc_problems(modified))

    def test_code_indented_section_heading_is_not_found(self):
        modified = self.notes.replace(f"\n{SECTION_HEADING}\n", f"\n    {SECTION_HEADING}\n", 1)
        self.assertNotEqual(modified, self.notes)
        self.assertTrue(icon_doc_problems(modified))

    def test_inserted_non_list_lines_fail(self):
        # 교차 검토 재현: 여는 태그가 줄을 넘는 HTML 제목. 그 밖의 글 덩어리도 목록 꼴이 아니면 실패한다.
        marker = "- 메뉴는 알약의 SVG를"
        inserts = (
            '<h3\nid="other">다른 절</h3>',
            "그냥 문단 한 줄",
            "> 인용 안 제목",
            "  <section>",
            "- 목록 안 <h4>태그</h4>",
            "~~~\n코드\n~~~",
        )
        for insert in inserts:
            with self.subTest(insert=insert):
                modified = self.notes.replace(marker, f"\n{insert}\n\n{marker}", 1)
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(icon_doc_problems(modified))

    def test_section_inside_raw_html_block_is_not_found(self):
        # 교차 검토 재현: 절 제목 앞에 <pre>와 빈 줄, 다음 절 제목 뒤에 빈 줄과 </pre>를 넣은 경우.
        next_heading = "\n### 스크립트와 스타일이 함께 지키는 이름\n"
        for tag in ("pre", "PRE", "script", "style", "textarea"):
            with self.subTest(tag=tag):
                opened = self.notes.replace(f"\n{SECTION_HEADING}\n", f"\n<{tag}>\n\n{SECTION_HEADING}\n", 1)
                modified = opened.replace(next_heading, f"{next_heading}\n</{tag}>\n", 1)
                self.assertNotEqual(modified, opened)
                self.assertTrue(icon_doc_problems(modified))
        # 상위 제목 앞에서 열어 상위 제목까지 감싸도 실패한다.
        wrapped = self.notes.replace(f"\n{PARENT_HEADING}\n", f"\n<pre>\n\n{PARENT_HEADING}\n", 1)
        wrapped = wrapped.replace(next_heading, f"{next_heading}\n</pre>\n", 1)
        self.assertTrue(icon_doc_problems(wrapped))

    def test_section_heading_away_from_parent_fails(self):
        for between in ("\n그냥 문단\n", "\n<div>\n", "\n\n"):
            with self.subTest(between=between):
                modified = self.notes.replace(f"\n\n{SECTION_HEADING}\n", f"\n{between}\n{SECTION_HEADING}\n", 1)
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(icon_doc_problems(modified))

    def test_code_fence_inside_list_item_fails(self):
        # 교차 검토 재현: 목록 기호 바로 뒤에 백틱 세 개를 두고, 복제 문장을 다음 줄에 두 칸 들여쓴 경우.
        for fence in ("```", "~~~", "````text"):
            with self.subTest(fence=fence):
                modified = self.notes.replace(f"- {CLONE_RULE}", f"- {fence}\n  {CLONE_RULE}", 1)
                self.assertNotEqual(modified, self.notes)
                self.assertTrue(icon_doc_problems(modified))

    def test_star_glyph_written_as_entity_or_other_star_fails(self):
        # 교차 검토 재현: 다음 절 제목 앞에 엔티티로 쓴 ✦를 넣은 경우. 다른 별·반짝이 기호와 폭 없는 문자도 본다.
        for glyph in ("&#10022;", "&#x2726;", "&starf;", "✨", "⭐", "\U0001F31F", "\U0001F4AB", "❇", "✧", "★"):
            with self.subTest(glyph=glyph):
                modified = self.notes.replace(self.section, f"{self.section}- 깊이는 {glyph} 아이콘을 쓴다.\n", 1)
                self.assertTrue(icon_doc_problems(modified))
        hidden = self.notes.replace(self.section, f"{self.section}- 깊이는 네​ 갈래­ 별을 쓴다.\n", 1)
        self.assertTrue(icon_doc_problems(hidden))

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
