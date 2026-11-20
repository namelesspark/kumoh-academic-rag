"""설계 문서의 손글씨 「넣기」 절이 30초 기한의 범위(#158)를 적었는지 확인한다.

화면(`chat.js`)은 넣기 한 번에 PNG 만들기(`toBlob`)부터 업로드와 응답 본문 받기까지 30초 기한 하나를
쓴다. 문서가 「시간 제한은 30초다」라고만 적으면 PNG 만들기가 기한 밖이라고 읽혀, `toBlob` 콜백이
오지 않을 때 패드가 「글씨를 읽는 중…」에 멈추는 일을 다시 만들 수 있다. 이 테스트는 이슈 #158의 두
문장이 손글씨 패드 절의 「### 넣기」 절에 글자 그대로 한 번씩 있고, 옛 문장이 없고, 「30초」가 이 절에
한 번만 나오는지 본다.

절을 자르는 규칙은 두 가지다. 마크다운 렌더링과 어긋나면 검사가 틀린 쪽으로 통과하지 않고 실패하게 한다.
1. 경계는 넓게 잡는다. 렌더링에서 제목으로 보일 수 있는 줄은 모두 절 경계다(CommonMark 0.31.2의
   `#` 제목, 밑줄형 제목, 인용·목록 안 제목, `<h1>`~`<h6>`). 코드 울타리 안의 줄도 경계로 본다.
2. 제목을 가리는 구조는 해석하지 않는다. 넣기 절 끝까지 HTML 주석이나 HTML 블록이 있거나, 들여쓰거나
   인용·목록 안에 둔 코드 울타리가 있으면 판정하지 않고 실패한다. 패드 절과 넣기 절의 머리는 첫 칸에서
   시작하는 `#` 제목이어야 하고, 열린 코드 울타리 안에 있으면 안 된다.
교차 검토에서 제목을 가리는 구조(인용 안 울타리)를 흉내 내다 구멍이 났다. 그래서 이 구조는 흉내 내지 않고
거부한다. 저장소와 표준 라이브러리에 마크다운 파서가 없고, `UI_NOTES.md`에는 2번에 걸리는 줄이 없다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 하나만 읽는다.

실행(저장소 루트):
    python -B -m unittest api.tests.test_handwriting_timeout_doc
"""

import re
import unittest
from pathlib import Path

UI_NOTES = Path(__file__).resolve().parents[2] / "web" / "docs" / "UI_NOTES.md"
PAD_HEADING = "## 손글씨 입력 필기 패드 (#134)"
PAD_TITLE = (2, "손글씨 입력 필기 패드 (#134)")
SECTION_HEADING = "### 넣기"
SECTION_TITLE = (3, "넣기")

# 이슈 #158의 두 문장. 낱말을 따로 찾으면 뜻을 뒤집은 문장도 통과해 글자 그대로 본다.
SCOPE_SENTENCE = "시간 제한 30초는 PNG 만들기(`toBlob`)부터 업로드와 응답 본문 받기까지 한 번에 잰다."
LATE_SENTENCE = (
    "PNG가 기한 안에 나오지 않아도 시간 초과로 끝내고 획을 남기며, "
    "늦게 온 `toBlob` 결과와 이전 시도의 결과는 버린다."
)
OLD_SENTENCE = "시간 제한은 30초다."

# CommonMark 0.31.2 §4.2 ATX 제목. 여는 `#` 뒤에는 공백·탭이 오거나 줄이 끝나야 한다.
ATX_HEADING = re.compile(r" {0,3}(#{1,6})(?:[ \t]+(.*))?[ \t]*\Z")
# 닫는 `#` 줄: 앞에 공백·탭이 있거나 내용 전체가 `#`일 때만 떼어 낸다(`foo#`은 그대로 둔다).
CLOSING_SEQUENCE = re.compile(r"(?:\A|[ \t]+)#+[ \t]*\Z")
# §4.3 밑줄형(setext) 제목의 밑줄. `=`는 1단계, `-`는 2단계다.
SETEXT_UNDERLINE = re.compile(r" {0,3}(?:=+|-+)[ \t]*")
# §5.1·§5.2 인용(`>`)과 목록(`-`·`+`·`*`·`1.`·`1)`) 표시. 그 뒤 글은 같은 규칙으로 제목이 될 수 있다.
CONTAINER = re.compile(r"(?: {0,3}(?:>[ \t]?|(?:[-+*]|[0-9]{1,9}[.)])(?:[ \t]+|\Z)))*")
# §4.6 HTML 블록 중 제목 태그.
HTML_HEADING = re.compile(r" {0,3}<h([1-6])(?=[\s/>]|\Z)", re.IGNORECASE)
# §4.5 코드 울타리. 첫 칸~셋째 칸에서 시작하고 인용·목록 표시가 없는 것만 해석한다.
PLAIN_FENCE = re.compile(r" {0,3}(`{3,}|~{3,})")
# 위치와 상관없이 울타리처럼 보이는 줄. PLAIN_FENCE가 아니면 판정하지 않는다.
FENCE_LIKE = re.compile(r"[ \t]*(?:`{3,}|~{3,})")


def atx_heading(line):
    """제목 줄이면 (단계, 제목 글), 아니면 None. 줄 끝 개행은 떼고 넘긴다."""
    match = ATX_HEADING.fullmatch(line)
    if match is None:
        return None
    content = CLOSING_SEQUENCE.sub("", (match.group(2) or "").rstrip(" \t"))
    return len(match.group(1)), content.strip(" \t")


def html_heading(line):
    """`<h1>`~`<h6>`로 여는 HTML 줄이면 (단계, ""), 아니면 None. 렌더링하면 제목으로 보인다."""
    match = HTML_HEADING.match(line)
    return None if match is None else (int(match.group(1)), "")


def lines_with_offsets(text):
    """(시작 위치, 개행을 뗀 줄)을 차례대로 돌려준다."""
    offset = 0
    for raw in text.splitlines(keepends=True):
        yield offset, raw.rstrip("\r\n")
        offset += len(raw)


def headings(text):
    """제목으로 보일 수 있는 줄을 (시작 위치, 단계, 제목 글)로 차례대로 돌려준다.

    - `#` 제목과 `<h1>`~`<h6>`. 인용(`>`)·목록(`-`·`1.`) 표시 뒤에 와도 제목이다.
    - 밑줄형 제목: 빈 줄이 아닌 글 줄 바로 아래의 `===`·`---` 줄. 시작 위치는 밑줄 위 글 덩어리의 첫 줄이다.
    - 코드 울타리 안도 가리지 않는다. 경계를 넓게 잡으면 검사가 엄격해질 뿐이다.
    빈 줄·제목 바로 뒤의 `---`는 가로줄(thematic break)이라 경계가 아니다.
    """
    found = []
    paragraph = None  # 열린 글 덩어리의 (시작 위치, [줄])
    for start, line in lines_with_offsets(text):
        inner = line[CONTAINER.match(line).end():]
        # 밑줄을 빈 줄보다 먼저 본다. `-` 한 글자 줄은 목록 표시로 걷히면 빈 줄이 된다.
        underline = SETEXT_UNDERLINE.fullmatch(line) or SETEXT_UNDERLINE.fullmatch(inner)
        if underline is not None and paragraph is not None:
            level = 1 if underline.group(0).strip(" \t")[0] == "=" else 2
            found.append((paragraph[0], level, " ".join(paragraph[1])))
            paragraph = None
            continue
        if not inner.strip(" \t"):
            paragraph = None
            continue
        heading = atx_heading(inner) or html_heading(inner)
        if heading is not None:
            found.append((start, *heading))
            paragraph = None
            continue
        if underline is not None:
            continue  # 글 줄이 없는 `---`는 가로줄이다.
        if paragraph is None:
            paragraph = (start, [])
        paragraph[1].append(inner.strip(" \t"))
    return found


def check_unhidden(text, end, anchors):
    """`text[:end]`에 제목을 가릴 수 있는 구조가 없고, `anchors` 위치가 코드 울타리 밖인지 본다.

    가릴 수 있는 구조는 해석하지 않고 `ValueError`로 거부한다. HTML 주석·HTML 블록, 들여쓰거나
    인용·목록 안에 둔 코드 울타리가 그렇다. 첫 칸 쪽 울타리는 여닫는 글자와 길이를 맞춰 따라간다.
    """
    fence = None  # 열린 울타리의 (글자, 길이)
    for start, line in lines_with_offsets(text[:end]):
        if start in anchors and fence is not None:
            raise ValueError("절 머리가 코드 울타리 안에 있다")
        if "<!--" in line or "-->" in line:
            raise ValueError("HTML 주석은 판정하지 않는다")
        inner = line[CONTAINER.match(line).end():]
        if fence is None and inner.lstrip(" \t").startswith("<"):
            raise ValueError("HTML 블록은 판정하지 않는다")
        if FENCE_LIKE.match(inner) is None:
            continue
        plain = PLAIN_FENCE.match(line)
        if plain is None:
            raise ValueError("들여쓰거나 인용·목록 안에 둔 코드 울타리는 판정하지 않는다")
        marks, rest = plain.group(1), line[plain.end():]
        if fence is None:
            if marks[0] == "`" and "`" in rest:
                raise ValueError("백틱이 든 울타리 정보 문자열은 판정하지 않는다")
            fence = (marks[0], len(marks))
        elif marks[0] == fence[0] and len(marks) >= fence[1] and not rest.strip(" \t"):
            fence = None


def section(text, title, within=(0, None)):
    """`title`(단계, 글) 제목부터 같거나 높은 단계의 다음 제목 앞까지를 (시작, 끝)으로 돌려준다.

    `within` 범위 안의 제목만 본다. 범위 끝을 넘지 않는다. 머리는 첫 칸에서 시작하는 `#` 제목이어야 한다.
    """
    lo, hi = within
    hi = len(text) if hi is None else hi
    marks = [h for h in headings(text) if lo <= h[0] < hi]
    for index, (start, level, content) in enumerate(marks):
        if (level, content) != title:
            continue
        line = text[start:].split("\n", 1)[0].rstrip("\r")
        if not line.startswith("#") or atx_heading(line) != title:
            raise ValueError(f"{'#' * title[0]} {title[1]} 머리가 첫 칸의 # 제목이 아니다")
        end = next((s for s, lv, _ in marks[index + 1:] if lv <= level), hi)
        return start, end
    raise ValueError(f"{'#' * title[0]} {title[1]} 절이 없다")


def insert_section(text):
    """손글씨 패드 절 안의 `### 넣기` 머리부터 다음 제목(단계 무관) 앞까지를 돌려준다.

    패드 절은 다음 `#`·`##` 제목에서 끝난다. 넣기 절은 그 안에서만 찾고, 바로 아래 `####` 같은
    더 낮은 제목에서도 끝낸다. 문서 처음부터 넣기 절 끝까지 `check_unhidden`을 통과해야 한다.
    """
    pad = section(text, PAD_TITLE)
    start, _ = section(text, SECTION_TITLE, within=pad)
    following = next((s for s, _, _ in headings(text) if start < s < pad[1]), pad[1])
    check_unhidden(text, following, {pad[0], start})
    return text[start:following]


class HeadingRuleTest(unittest.TestCase):
    """제목 판정 규칙을 CommonMark 0.31.2 예시와 같은 모양의 가상 줄로 확인한다."""

    def test_atx_headings(self):
        self.assertEqual(atx_heading("## 다른 절"), (2, "다른 절"))
        self.assertEqual(atx_heading("##\t다른 절"), (2, "다른 절"))
        self.assertEqual(atx_heading("  #### 다음 절"), (4, "다음 절"))
        self.assertEqual(atx_heading("   ### 넣기 ###  "), (3, "넣기"))
        self.assertEqual(atx_heading("###### 여섯"), (6, "여섯"))
        self.assertEqual(atx_heading("##"), (2, ""))
        self.assertEqual(atx_heading("### ###"), (3, ""))

    def test_not_atx_headings(self):
        self.assertIsNone(atx_heading("#5 bolt"))
        self.assertIsNone(atx_heading("####### 일곱"))
        self.assertIsNone(atx_heading("    ## 코드 들여쓰기"))

    def test_closing_sequence_needs_space_before_it(self):
        self.assertEqual(atx_heading("## 제목#"), (2, "제목#"))
        self.assertEqual(atx_heading("## 제목 \\#"), (2, "제목 \\#"))

    def test_setext_quoted_listed_and_html_headings(self):
        doc = (
            "가\n===\n\n나\n다\n---\n\n---\n"
            "> ## 인용\n- ### 목록\n1. #### 번호\n<H2 class=x>html</H2>\n\n라\n-\n"
        )
        self.assertEqual(
            [(lv, t) for _, lv, t in headings(doc)],
            [(1, "가"), (2, "나 다"), (2, "인용"), (3, "목록"), (4, "번호"), (2, ""), (2, "라")],
        )

    def test_setext_heading_starts_at_its_first_text_line(self):
        doc = "### 위\n나\n다\n-----\n"
        self.assertEqual(headings(doc), [(0, 3, "위"), (len("### 위\n"), 2, "나 다")])

    def test_thematic_breaks_are_not_headings(self):
        # 빈 줄·제목 바로 뒤의 `---`와 `- - -`는 가로줄이다.
        self.assertEqual([(lv, t) for _, lv, t in headings("### 위\n---\n\n---\n- - -\n***\n")], [(3, "위")])

    def test_fenced_heading_like_lines_still_count(self):
        # 울타리 안 줄도 경계로 본다(엄격한 쪽).
        doc = "## 가\n```text\n## 울타리 안\n```\n"
        self.assertEqual([(lv, t) for _, lv, t in headings(doc)], [(2, "가"), (2, "울타리 안")])


class InsertSectionTest(unittest.TestCase):
    """절 자르기를 가상 문서로 확인한다. 교차 검토 재현 여섯 가지를 함께 둔다."""

    def test_section_stops_at_next_heading(self):
        doc = f"{PAD_HEADING}\n\n{SECTION_HEADING}\n\n- 가\n\n### 대비\n\n- 30초\n"
        part = insert_section(doc)
        self.assertIn("- 가", part)
        self.assertNotIn("대비", part)

    def test_insert_heading_before_pad_section_is_ignored(self):
        doc = f"{SECTION_HEADING}\n\n- 다른 절\n\n{PAD_HEADING}\n\n{SECTION_HEADING}\n\n- 패드\n"
        part = insert_section(doc)
        self.assertIn("- 패드", part)
        self.assertNotIn("다른 절", part)

    def assert_sentences_not_in_insert_section(self, doc):
        try:
            part = insert_section(doc)
        except ValueError:
            return
        self.assertNotIn(SCOPE_SENTENCE, part)
        self.assertNotIn(LATE_SENTENCE, part)

    def test_insert_heading_moved_after_pad_section_is_not_found(self):
        # 교차 검토 재현 1·3: 패드의 넣기 절을 다른 `##` 아래로 옮긴 문서. 3은 `##` 뒤가 탭이다.
        body = f"{SECTION_HEADING}\n\n- {SCOPE_SENTENCE} {LATE_SENTENCE}\n"
        others = (
            "## 다른 절", "##\t다른 절", " ## 다른 절", "## 다른 절 ##",
            "다른 절\n-----", "다른 절\n=====", "> ## 다른 절", "- ## 다른 절", "<h2>다른 절</h2>",
        )
        for other in others:
            with self.subTest(other=other):
                doc = f"{PAD_HEADING}\n\n### 그리기\n\n- 획\n\n{other}\n\n{body}"
                with self.assertRaises(ValueError):
                    insert_section(doc)

    def test_section_stops_at_deeper_heading(self):
        # 교차 검토 재현 2·4: 넣기 바로 아래 `####` 절로 두 문장을 옮긴 문서. 4는 공백 두 칸 들여쓰기다.
        deepers = (
            "#### 다음 절", "  #### 다음 절", "####\t다음 절", "   ##### 다음 절",
            "다른 절\n-----", "다른 절\n===", "다른\n절\n---", "> #### 다음 절", "1. #### 다음 절", "<h4>다음 절</h4>",
        )
        for deeper in deepers:
            for gap in ("\n\n", "\n"):
                with self.subTest(deeper=deeper, gap=gap):
                    doc = (
                        f"{PAD_HEADING}\n\n{SECTION_HEADING}{gap}{deeper}\n\n"
                        f"- {SCOPE_SENTENCE} {LATE_SENTENCE}\n"
                    )
                    self.assert_sentences_not_in_insert_section(doc)

    def test_setext_reproduction_from_review(self):
        # 교차 검토 재현 5: `### 넣기` 바로 아래 `다른 절`과 `-----`, 빈 줄 뒤 두 문장.
        doc = f"{PAD_HEADING}\n\n{SECTION_HEADING}\n다른 절\n-----\n\n- {SCOPE_SENTENCE} {LATE_SENTENCE}\n"
        self.assert_sentences_not_in_insert_section(doc)
        self.assertEqual(
            [(lv, t) for _, lv, t in headings(doc)],
            [(2, PAD_TITLE[1]), (3, "넣기"), (2, "다른 절")],
        )

    def test_quoted_fence_reproduction_from_review(self):
        # 교차 검토 재현 6: 넣기 아래 인용 안 울타리(`> ~~~`)를 닫지 않고, 빈 줄 뒤 `####` 절로 두 문장을 옮긴 문서.
        doc = (
            f"{PAD_HEADING}\n\n{SECTION_HEADING}\n> ~~~\n> 예시\n\n#### 다른 절\n\n"
            f"- {SCOPE_SENTENCE} {LATE_SENTENCE}\n"
        )
        self.assert_sentences_not_in_insert_section(doc)

    def test_fenced_heading_like_line_ends_section(self):
        doc = f"{PAD_HEADING}\n\n{SECTION_HEADING}\n\n```text\n#### 코드\n```\n\n- {SCOPE_SENTENCE}\n"
        self.assertNotIn(SCOPE_SENTENCE, insert_section(doc))

    def test_thematic_break_does_not_end_section(self):
        for doc in (
            f"{PAD_HEADING}\n\n{SECTION_HEADING}\n\n---\n\n- 끝 문장\n",
            f"{PAD_HEADING}\n\n{SECTION_HEADING}\n---\n- 끝 문장\n",
        ):
            with self.subTest(doc=doc):
                self.assertIn("- 끝 문장", insert_section(doc))

    def test_plain_fences_before_the_section_are_followed(self):
        doc = f"```text\n## 코드\n````\n~~~\n```\n~~~~\n\n{PAD_HEADING}\n\n{SECTION_HEADING}\n\n- 끝 문장\n"
        self.assertIn("- 끝 문장", insert_section(doc))


class HiddenStructureTest(unittest.TestCase):
    """제목을 가릴 수 있는 구조는 해석하지 않고 거부하는지 가상 문서로 확인한다."""

    def assert_rejected(self, before="", inside=""):
        doc = f"{before}{PAD_HEADING}\n\n{SECTION_HEADING}\n\n{inside}- {SCOPE_SENTENCE} {LATE_SENTENCE}\n"
        with self.assertRaises(ValueError):
            insert_section(doc)

    def test_unclosed_fence_hides_the_anchor(self):
        self.assert_rejected(before="```text\n")
        self.assert_rejected(before="~~~~\n~~~\n")
        self.assert_rejected(before="````\n```\n")  # 더 긴 울타리 안의 짧은 줄은 닫지 않는다.
        self.assert_rejected(before="~~~\n```\n")  # 다른 글자 줄도 닫지 않는다.

    def test_indented_quoted_or_listed_fences(self):
        for fence in ("> ~~~\n> 예시\n\n", "- ```\n  예시\n\n", "    ```\n", "  ```\n  ```\n  > ```\n"):
            with self.subTest(fence=fence):
                self.assert_rejected(inside=fence)
                self.assert_rejected(before=fence)

    def test_html_comments_and_blocks(self):
        for html in ("<!--\n", "<!-- 숨김 -->\n", "-->\n", "<div>\n", "> <details>\n"):
            with self.subTest(html=html):
                self.assert_rejected(before=html)
                self.assert_rejected(inside=html)

    def test_anchor_must_be_a_first_column_atx_heading(self):
        for pad in ("> " + PAD_HEADING, "- " + PAD_HEADING, " " + PAD_HEADING, PAD_TITLE[1] + "\n---"):
            with self.subTest(pad=pad):
                doc = f"{pad}\n\n{SECTION_HEADING}\n\n- 끝 문장\n"
                with self.assertRaises(ValueError):
                    insert_section(doc)

    def test_structures_after_the_section_are_not_checked(self):
        doc = f"{PAD_HEADING}\n\n{SECTION_HEADING}\n\n- 끝 문장\n\n### 대비\n\n<!-- 뒤 -->\n> ```\n"
        self.assertIn("- 끝 문장", insert_section(doc))


class HandwritingTimeoutDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.section = insert_section(UI_NOTES.read_text(encoding="utf-8"))

    def test_section_is_the_pad_insert_section(self):
        self.assertTrue(self.section.startswith(SECTION_HEADING))

    def test_scope_sentence_appears_once(self):
        self.assertEqual(self.section.count(SCOPE_SENTENCE), 1)

    def test_late_result_sentence_appears_once(self):
        self.assertEqual(self.section.count(LATE_SENTENCE), 1)

    def test_old_sentence_is_gone(self):
        self.assertNotIn(OLD_SENTENCE, self.section)

    def test_thirty_seconds_is_written_once(self):
        # 기한을 두 곳에 적으면 한쪽만 고쳐 서로 다른 값이 남는다.
        self.assertEqual(self.section.count("30초"), 1)


if __name__ == "__main__":
    unittest.main()
