"""학사일정 월 달력(#143)의 모양 테스트.

브라우저를 띄우지 않고 실제 chat.css를 읽는다. #143 절의 규칙을 작은 선택자 판정기로 가상 요소(날짜 칸·날짜 버튼·
막대·점·머리 버튼·고른 날 목록)에 걸어 그 요소가 실제로 받는 선언을 모으고, 그 색으로 라이트·다크(속성)·다크(시스템)
대비를 계산한다. 사용자 변수(--acal-*)와 color-mix(in srgb, …)도 조상에서 물려받은 값으로 풀어 계산한다.
색 계산과 한 요소 판정(compound_matches)은 test_chat_versions_style.py의 것을 쓴다. 규칙 읽기는 @container까지 펼치고,
선택자 판정은 자식(>)과 자손을 구별하며 :has(…)를 가상 요소의 표시("has:…")로 읽는다.
가상 요소는 chat.js가 실제로 그리는 구조를 따른다. 루트 아래에 머리 줄·본문 상자(.acal-body)·고른 날 목록이 형제로 있고,
월 보기의 본문 상자에는 요일 머리와 격자만 들어간다.
날짜 버튼 안은 숫자 → 「+N개」 → 점 묶음이며, 고른 날 목록의 일정도 section.evidence다.
처음에는 >를 자손처럼 보고 :last-child로 「+N개」를 만들었고, 다음 판은 요일 머리를 루트 직속으로 꾸며 결함을 놓쳤다(교차 검토 지적).
"""

import ast
import re
import unittest
from pathlib import Path

from test_chat_versions_style import (
    block_after, compound_matches, contrast, element, luminance, over, rgba, split_top, strip_comments, tokens,
)

CSS_PATH = Path(__file__).resolve().parents[1] / "app" / "chat_web" / "assets" / "chat.css"
MARKER = "/* 학사일정 월 달력 (#143)."
NARROW = "@container acal (width < 560px)"
REDUCED = "@media (prefers-reduced-motion: reduce)"
KINDS = ("enroll", "exam", "holiday", "register", "neutral")
NAMES = (".acal", ".acal-title", "[data-acal-nav]", "[data-acal-view-toggle]", '[aria-pressed="true"]',
         ".acal-weekdays", ".acal-grid", ".acal-week", ".acal-cell", ".acal-day", "[data-outside]",
         '[aria-current="date"]', '[aria-selected="true"]', "[data-more]", ".acal-bar", ".acal-dot",
         ".acal-day-list", '[data-view="list"]', '[data-view="month"]', "section.evidence")


def rules(text):
    """(선택자 머리, 선언 사전, 조건) 목록. @media·@supports·@container 안쪽도 펼친다."""
    found = []

    def walk(chunk, media):
        pos = 0
        while True:
            open_at = chunk.find("{", pos)
            if open_at < 0:
                return
            head = " ".join(chunk[pos:open_at].split())
            depth, end = 1, open_at + 1
            while depth:
                depth += {"{": 1, "}": -1}.get(chunk[end], 0)
                end += 1
            body = chunk[open_at + 1:end - 1]
            if head.startswith(("@media", "@supports", "@container")):
                walk(body, head)
            elif not head.startswith("@"):
                decls = {}
                for part in body.split(";"):
                    if ":" in part:
                        key, value = part.split(":", 1)
                        decls[key.strip()] = " ".join(value.split())
                found.append((head, decls, media))
            pos = end

    walk(text, None)
    return found


def mix(first, share, second):
    """color-mix(in srgb, first share, second). 알파를 곱한 값으로 섞는다(CSS Color 5)."""
    alpha = first[3] * share + second[3] * (1 - share)
    if alpha == 0:
        return (0, 0, 0, 0.0)
    channels = tuple((first[i] * first[3] * share + second[i] * second[3] * (1 - share)) / alpha for i in range(3))
    return channels + (alpha,)


def length(value, base_font=16):
    """CSS 길이 값을 px로 푼다. px·rem과 calc(… + …)·calc(… - …)만 읽는다. 1rem은 브라우저 기본 글꼴 크기다.

    표준 라이브러리 ast로 덧셈·뺄셈·괄호만 계산한다. 그 밖의 식이 오면 실패해 검사가 조용히 넘어가지 않게 한다.
    """
    text = value.strip()
    if text.startswith("calc(") and text.endswith(")"):
        text = text[4:]
    text = re.sub(r"(-?[\d.]+)(px|rem)\b",
                  lambda m: repr(float(m.group(1)) * (base_font if m.group(2) == "rem" else 1)), text)
    tree = ast.parse(text, mode="eval")

    def walk(node):
        if isinstance(node, ast.Expression):
            return walk(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
            return -walk(node.operand)
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub)):
            left, right = walk(node.left), walk(node.right)
            return left + right if isinstance(node.op, ast.Add) else left - right
        raise AssertionError(f"길이로 읽을 수 없는 값: {value}")

    return walk(tree)


def compound_ok(compound, node):
    """:has(…)는 요소가 그 관계를 가진다는 표시("has:…")가 있을 때만 맞는다. 나머지는 기존 판정에 맡긴다."""
    for inner in re.findall(r":has\(([^()]*)\)", compound):
        if "has:" + " ".join(inner.split()) not in node["states"]:
            return False
    return compound_matches(re.sub(r":has\([^()]*\)", "", compound), node)


def selector_matches(selector, chain):
    """chain은 바깥 조상부터 대상까지다. 자식(>)은 바로 위 요소만, 공백은 어느 조상이든 본다."""
    text = re.sub(r"\s*>\s*", " > ", selector.strip())
    compounds, combinators, pending = [], [], None
    for piece in split_top(text, " "):
        if piece == ">":
            pending = ">"
            continue
        if compounds:
            combinators.append(pending or " ")
        compounds.append(piece)
        pending = None

    def at(i, j):
        if j < 0 or not compound_ok(compounds[i], chain[j]):
            return False
        if i == 0:
            return True
        if combinators[i - 1] == ">":
            return at(i - 1, j - 1)
        return any(at(i - 1, k) for k in range(j - 1, -1, -1))

    return bool(compounds) and at(len(compounds) - 1, len(chain) - 1)


# 가상 문서. 달력 루트 → 격자 → 주 줄 → 칸 → 날짜 버튼 순서다.
def acal(view="month"):
    return element("section", ["acal"], [f'[data-view="{view}"]'])


def cell(col, *, outside=False, selected=False):
    attrs = {f'[data-col="{col}"]', '[role="gridcell"]', f'[aria-selected="{"true" if selected else "false"}"]'}
    if outside:
        attrs.add("[data-outside]")
    return element("div", ["acal-cell"], attrs)


def body():
    """chat.js는 루트 아래에 머리 줄, 본문 상자(.acal-body), 고른 날 목록(.acal-day-list)을 형제로 둔다.

    월 보기의 본문 상자에는 요일 머리와 격자만 들어간다. 목록 보기에서는 격자 없이 목록 줄이 들어간다.
    """
    return element("div", ["acal-body"], states=["has:> .acal-grid"])


def list_body():
    """목록 보기의 본문 상자. 격자를 품지 않는다."""
    return element("div", ["acal-body"])


def inside(view="month"):
    return [acal(view), body() if view == "month" else list_body()]


def day_list(view="month"):
    """고른 날 목록. 본문 상자의 형제, 곧 루트 직속이다(#144가 스크롤 상자 밖으로 옮겼다)."""
    return [acal(view), element("div", ["acal-day-list"])]


def week():
    return inside() + [element("div", ["acal-grid"], ['[role="grid"]']), element("div", ["acal-week"], ['[role="row"]'])]


def day_chain(col=3, *, selected=False, today=False, more=False, states=()):
    attrs = {'[aria-current="date"]'} if today else set()
    if more:
        attrs.add("[data-more]")
    return week() + [cell(col, selected=selected), element("button", ["acal-day"], attrs, states)]


def bar_chain(col=1, span=1, lane=0, kind="neutral"):
    attrs = [f'[data-col="{col}"]', f'[data-span="{span}"]', f'[data-lane="{lane}"]', f'[data-kind="{kind}"]',
             '[aria-hidden="true"]']
    return week() + [element("div", ["acal-bar"], attrs)]


def dot_chain(kind):
    """점은 날짜 버튼 안 마지막 자식인 점 묶음 안에 있다."""
    return day_chain(more=True) + [DOT_GROUP, element("span", ["acal-dot"], [f'[data-kind="{kind}"]'])]


# 날짜 버튼 안 자식. 「+N개」는 바로 뒤 형제(점 묶음)가 점을 품고, 점 묶음은 마지막 자식이다.
MORE_LABEL = element("span", states=["has:+ * .acal-dot"])
DOT_GROUP = element("span", states=["last-child", "has:.acal-dot", "has:> .acal-dot"])
NUMBER = element("span", states=["first-child"])


def head_button(kind, states=(), pressed=None):
    attrs = {"[data-acal-nav]", '[data-acal-nav="prev"]'} if kind == "nav" else {"[data-acal-view-toggle]"}
    if pressed is not None:
        attrs.add(f'[aria-pressed="{pressed}"]')
    return [acal(), HEAD_ROW, element("button", [], attrs, states)]


HEAD_ROW = element("div", states=["has:> .acal-title"])


class AcademicCalendarStyleTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        raw = CSS_PATH.read_text(encoding="utf-8")
        cls.raw = raw
        cls.section = strip_comments(raw[raw.index(MARKER):])
        cls.rules = rules(cls.section)
        plain = strip_comments(raw)
        light = tokens(block_after(plain, ":root {"))
        cls.themes = {
            "light": light,
            "dark": {**light, **tokens(block_after(plain, ':root[data-theme="dark"]'))},
            "system-dark": {**light, **tokens(block_after(plain, ":root:not([data-theme])"))},
        }

    def computed(self, chain, media=None):
        result = {}
        for head, decls, rule_media in self.rules:
            if rule_media not in (None, media):
                continue
            if any(selector_matches(selector, chain) for selector in split_top(head, ",")):
                result.update(decls)
        return result

    def scope(self, chain, media=None):
        """사용자 변수는 물려받는다. 바깥 조상부터 대상까지 --이름 선언을 차례로 덮어쓴다."""
        found = {}
        for depth in range(1, len(chain) + 1):
            found.update({k: v for k, v in self.computed(chain[:depth], media).items() if k.startswith("--")})
        return found

    def color(self, theme, value, scope=None):
        value = value.strip()
        if value == "transparent":
            return (0, 0, 0, 0.0)
        match = re.fullmatch(r"var\((--[\w-]+)\)", value)
        if match:
            name = match.group(1)
            found = (scope or {}).get(name, self.themes[theme].get(name))
            self.assertIsNotNone(found, f"정의되지 않은 변수 {name}")
            inner = dict(scope or {})
            inner.pop(name, None)
            return self.color(theme, found, inner)
        match = re.fullmatch(r"color-mix\(in srgb,\s*(.+?)\s+(\d+)%,\s*(.+)\)", value)
        if match:
            first, share, second = match.groups()
            return mix(self.color(theme, first, scope), int(share) / 100, self.color(theme, second, scope))
        return rgba(value)

    def face(self, chain, theme, media=None):
        """대상 요소 뒤에 보이는 첫 불투명 면. 반투명 면은 그 아래 면에 겹쳐 계산한다.

        달력 루트(.acal)에 닿기 전에 불투명 면이 없으면 사진이 비친다는 뜻이라 실패한다.
        """
        layers = []
        for depth in range(len(chain), 0, -1):
            sub = chain[:depth]
            decls = self.computed(sub, media)
            if "background" in decls:
                paint = self.color(theme, decls["background"], self.scope(sub, media))
                if paint[3] == 1.0:
                    for layer in reversed(layers):
                        paint = over(layer, paint)
                    return paint
                if paint[3] > 0:
                    layers.append(paint)
            if "acal" in chain[depth - 1]["classes"]:
                break
        self.fail("달력 요소 뒤에 불투명 면이 없어 사진이 비친다")

    def ink(self, chain, theme, media=None):
        decls = self.computed(chain, media)
        back = self.face(chain, theme, media)
        return over(self.color(theme, decls["color"], self.scope(chain, media)), back), back

    # --- 이름표와 자리 ---------------------------------------------------------------------------

    def test_section_adds_every_contract_name(self):
        for name in NAMES:
            with self.subTest(name=name):
                self.assertIn(name, self.section)
        for kind in KINDS:
            with self.subTest(kind=kind):
                self.assertIn(f'[data-kind="{kind}"]', self.section)

    def test_section_is_appended_after_existing_rules(self):
        before = strip_comments(self.raw[:self.raw.index(MARKER)])
        self.assertIsNone(re.search(r"\.acal\b|data-acal", before))
        self.assertIsNone(re.search(r"@container", before), "컨테이너 쿼리는 이 절에만 있다")

    # --- 격자 -----------------------------------------------------------------------------------

    def test_weekdays_and_weeks_have_seven_columns_of_44px(self):
        for chain in (inside() + [element("div", ["acal-weekdays"])], week()):
            for media in (None, NARROW):
                with self.subTest(target=chain[-1]["classes"], media=media):
                    self.assertEqual(self.computed(chain, media)["grid-template-columns"], "repeat(7, minmax(44px, 1fr))")

    def test_cell_columns_cover_one_to_seven(self):
        for col in range(1, 8):
            with self.subTest(col=col):
                self.assertEqual(self.computed(week() + [cell(col)]).get("grid-column"), str(col))
        self.assertNotRegex(self.section, r'data-col="(?:0|[89])"')

    def test_bar_selectors_place_every_column_span_and_lane(self):
        for col in range(1, 8):
            for span in range(1, 9 - col):
                for lane in (0, 1):
                    with self.subTest(col=col, span=span, lane=lane):
                        decls = self.computed(bar_chain(col, span, lane))
                        self.assertEqual(decls.get("grid-column-start"), str(col))
                        self.assertEqual(decls.get("grid-column-end"), f"span {span}")
                        self.assertEqual(decls.get("grid-row"), str(lane + 2), "막대는 숫자 줄 아래 2·3행에 놓인다")
        self.assertNotRegex(self.section, r'data-span="(?:0|[89])"|data-lane="[2-9]"')
        decls = self.computed(bar_chain())
        self.assertEqual(decls.get("pointer-events"), "none", "막대 위를 눌러도 날짜가 골라진다")
        self.assertNotIn("style=", self.section)

    def test_week_rows_leave_room_for_two_lanes_and_more_label(self):
        rows = split_top(self.computed(week())["grid-template-rows"], " ")
        self.assertEqual(len(rows), 4)
        self.assertEqual(self.computed(week(), NARROW)["grid-template-rows"], "auto", "좁은 패널은 막대 줄이 없다")
        self.assertEqual(self.computed(week() + [cell(2)]).get("grid-row"), "1 / 5", "칸은 네 줄을 모두 덮는다")
        more = self.computed(day_chain(more=True) + [MORE_LABEL])
        self.assertIn("font-size", more)
        self.assertNotIn("font-size", self.computed(day_chain() + [MORE_LABEL]), "+N개 글자 규칙은 data-more 버튼에만 걸린다")

    def test_more_label_sits_below_the_bars_not_on_the_dot_group(self):
        """chat.js는 버튼 안에 숫자 → 「+N개」 → 점 묶음 순서로 붙인다. 점 묶음이 마지막 자식이다.

        :last-child로 찾으면 점 묶음에 글자 규칙이 걸리고, 가운데 정렬(space-between) 때문에 「+N개」가 막대 줄에 가렸다.
        """
        more = self.computed(day_chain(more=True) + [MORE_LABEL])
        self.assertEqual(more.get("grid-row"), "4", "「+N개」는 버튼 안 4행, 막대 두 줄 아래에 못 박힌다")
        self.assertEqual(self.computed(day_chain(more=True) + [DOT_GROUP]).get("grid-row"), "5")
        for label, child in (("점 묶음", DOT_GROUP), ("숫자", NUMBER)):
            with self.subTest(child=label):
                decls = self.computed(day_chain(more=True) + [child])
                self.assertNotEqual(decls.get("grid-row"), "4")
                self.assertNotIn("font-size", decls)
        self.assertNotIn("grid-row", self.computed(day_chain(more=True) + [NUMBER]), "숫자는 자동 배치로 1행에 든다")
        self.assertNotRegex(self.section, r"\.acal-day[^{]*:last-child", "마지막 자식은 점 묶음이라 「+N개」 찾기에 쓰지 않는다")
        self.assertNotIn("margin-top", more, "끝으로 미는 방식은 칸 내용이 짧으면 막대 줄로 올라간다")

    def test_more_label_never_overlaps_the_second_bar_at_any_text_size(self):
        """글꼴을 키운 영어 화면에서 두 줄 「+10 more」가 두 번째 막대 밑으로 올라가던 결함(교차 검토 지적)을 세로 위치로 잰다.

        브라우저 기본 글꼴 16px·24px·32px에서 실제 선언의 길이(px·rem·calc)를 풀어 다음을 계산한다.
        - 주 줄: 두 번째 막대(3행)의 아래 끝
        - 날짜 버튼: 위 테두리 + 버튼 1~3행 높이 = 「+N개」가 놓이는 4행의 위 끝
        그리고 숫자·오늘 원·막대 글 줄이 각자 행 안에 드는지도 본다. 리뷰 재현값(32px에서 「+N개」 64px, 막대 59~79px)도 함께 막는다.
        """
        week_rows = split_top(self.computed(week())["grid-template-rows"], " ")
        button = self.computed(day_chain(more=True))
        button_rows = split_top(button["grid-template-rows"], " ")
        more = self.computed(day_chain(more=True) + [MORE_LABEL])
        bar = self.computed(bar_chain(2, 5, 1, "exam"))
        self.assertEqual(len(button_rows), 3, "버튼은 숫자 행과 막대 두 행을 정하고 4행부터는 내용 높이다")
        self.assertTrue(week_rows[3].startswith("minmax(") and week_rows[3].endswith("auto)"), "4행은 「+N개」 높이만큼 는다")
        for base in (16, 24, 32):
            with self.subTest(base_font=base):
                rows = [length(value, base) for value in week_rows[:3]]
                border = length(button["border"].split(" ")[0], base)
                bar_margin = length(split_top(bar["margin"], " ")[0], base)
                second_bar_bottom = rows[0] + rows[1] + rows[2] - bar_margin
                label_top = border + sum(length(value, base) for value in button_rows)
                self.assertGreaterEqual(label_top, second_bar_bottom, "「+N개」 첫 줄이 두 번째 막대 위에 그려지면 안 된다")
                self.assertAlmostEqual(label_top, sum(rows), msg="버튼 4행과 주 줄 4행이 같은 높이에서 시작한다")
                # 각 줄이 자기 행 안에 든다. 글꼴과 함께 커지는 rem이라 어느 크기에서도 맞는다.
                self.assertLessEqual(length(button["line-height"], base), length(button_rows[0], base))
                self.assertLessEqual(length(bar["line-height"], base) + 2 * bar_margin, rows[2] + 0.001)
                if base == 32:
                    self.assertGreaterEqual(label_top, 79, "리뷰 재현: 두 번째 막대는 59~79px 구간이었다")
        self.assertIn("rem", more["line-height"])
        self.assertTrue(all("rem" in value for value in week_rows[:3]), "행 높이는 글꼴을 따라 커진다")

    def test_more_label_wraps_inside_a_44px_cell_in_every_language(self):
        """영어 「+10 more」가 44px 칸 밖으로 넘쳐 이웃 칸 글과 겹치던 결함(교차 검토 지적)을 폭으로 잰다.

        글자 폭은 글꼴마다 다르므로 넉넉하게 어림한다. 라틴·숫자·기호는 0.62em, 한자·한글은 1em이다(굵은 글자 기준 위쪽 어림).
        칸 안 글 폭은 실제 선언에서 계산한다: 최소 폭 44px - 좌우 안쪽 여백 - 좌우 테두리.
        """
        button = self.computed(day_chain(more=True))
        more = self.computed(day_chain(more=True) + [MORE_LABEL])
        pad = split_top(button["padding"], " ")
        horizontal_pad = int((pad[1] if len(pad) > 1 else pad[0]).rstrip("px"))
        border = int(button["border"].split("px")[0])
        room = int(button["min-width"].rstrip("px")) - 2 * (horizontal_pad + border)
        self.assertEqual(room, 36)
        font_px = float(more["font-size"].rstrip("rem")) * 16

        def width(text):
            return sum(font_px * (1.0 if ord(ch) > 0x2E80 else 0.62) for ch in text)

        labels = {"ko": "+10개", "en": "+10 more", "zh": "+10个"}
        wraps = more.get("white-space", "normal") not in ("nowrap", "pre")
        breaks_anywhere = more.get("overflow-wrap") == "anywhere" or more.get("word-break") == "break-all"
        for lang, text in labels.items():
            with self.subTest(lang=lang, text=text):
                if width(text) <= room:
                    continue
                self.assertTrue(wraps, f"{text}는 {width(text):.0f}px로 칸 글 폭 {room}px보다 넓어 줄을 나눠야 한다")
                longest = max(width(word) for word in text.split(" "))
                self.assertTrue(longest <= room or breaks_anywhere, "한 덩어리도 칸보다 넓으면 글자 단위로 끊는다")
        self.assertGreater(width(labels["en"]), room, "영어 예시는 실제로 칸보다 넓다(검사가 헛돌지 않는다)")
        self.assertEqual(more.get("max-width"), "100%")
        self.assertEqual(more.get("min-width"), "0")
        self.assertNotIn("overflow", more, "잘라 숨기지 않고 줄을 나눈다")
        # 두 줄이 되어도 4행이 늘어나 막대 줄(2·3행)과 겹치지 않는다.
        last_row = split_top(self.computed(week())["grid-template-rows"], " ")[3]
        self.assertTrue(last_row.endswith("auto)"), last_row)

    def test_hairlines_are_nine_percent_text(self):
        scope = self.scope([acal()])
        self.assertEqual(scope["--acal-line"], "color-mix(in srgb, var(--text) 9%, transparent)")
        self.assertEqual(self.computed(week())["border-top"], "1px solid var(--acal-line)")
        self.assertEqual(self.computed(week() + [cell(2)])["border-inline-start"], "1px solid var(--acal-line)")
        self.assertEqual(self.computed(week() + [cell(1)])["border-inline-start"], "0")
        for theme in self.themes:
            with self.subTest(theme=theme):
                line = self.color(theme, "var(--acal-line)", scope)
                self.assertAlmostEqual(line[3], 0.09)

    def test_weekend_columns_have_a_light_opaque_tint(self):
        for theme in self.themes:
            weekday = self.face(week() + [cell(3)], theme)
            for col in (1, 7):
                with self.subTest(theme=theme, col=col):
                    tint = self.face(week() + [cell(col)], theme)
                    self.assertNotEqual(tint[:3], weekday[:3])
                    self.assertLess(contrast(tint, weekday), 1.2, "틴트는 옅다")
            for col in range(2, 7):
                self.assertEqual(self.face(week() + [cell(col)], theme), weekday)

    def test_outside_days_are_muted_but_readable(self):
        for theme in self.themes:
            for col in (1, 4, 7):
                with self.subTest(theme=theme, col=col):
                    chain = week() + [cell(col, outside=True)]
                    front, back = self.ink(chain, theme)
                    self.assertGreaterEqual(contrast(front, back), 4.5)
                    day_front, _ = self.ink(week() + [cell(col), element("button", ["acal-day"])], theme)
                    self.assertGreater(contrast(day_front, back), contrast(front, back), "이웃 달 숫자는 더 흐리다")

    def today_ring(self, col=4):
        """오늘 원(::before)이 받는 선언. 가상 요소에는 ::before 규칙만 걸린다.

        판정기는 .acal-day 규칙도 가상 요소에 맞춰 버리므로(width: 100% 등), 선택자 끝이 ::before인 규칙만 모은다.
        """
        chain = day_chain(col, today=True)[:-1] + [element("button", ["acal-day"], ['[aria-current="date"]'], ["before"])]
        result = {}
        for head, decls, media in self.rules:
            if media is None and any(sel.endswith("::before") and selector_matches(sel, chain) for sel in split_top(head, ",")):
                result.update(decls)
        return result

    def ring_box(self, base, column):
        """기본 글꼴 base px, 칸 폭 column px에서 오늘 원의 (왼쪽, 위, 지름)을 날짜 버튼 바깥 기준 px로 계산한다.

        원은 절대 위치라 버튼 안쪽(테두리 안) 상자가 기준이다. 좌우 inset과 max-width, 정사각형 비율, translate -50%를 그대로 푼다.
        """
        ring = self.ring_decls
        border = length(self.computed(day_chain(today=True))["border"].split(" ")[0], base)
        inset = length(ring["inset-inline"], base)
        inner = column - 2 * border
        diameter = min(length(ring["max-width"], base), inner - 2 * inset)
        left = border + inset + (inner - 2 * inset - diameter) / 2
        top = border + length(ring["top"], base) - diameter / 2
        return left, top, diameter

    def test_today_circle_fits_the_cell_at_any_text_size(self):
        """기본 글꼴 32px, 칸 44px에서 지름 56px(테두리 포함 60px) 오늘 원이 칸 밖으로 나가던 결함(교차 검토 지적)을 잰다."""
        self.ring_decls = self.today_ring()
        ring = self.ring_decls
        self.assertEqual(ring.get("aspect-ratio"), "1", "높이는 폭을 따라 정사각형이다")
        self.assertEqual(ring.get("margin-inline"), "auto")
        self.assertEqual(ring.get("translate"), "0 -50%")
        self.assertNotIn("width", ring, "지름은 inset과 max-width로만 정한다")
        self.assertNotIn("height", ring)
        button = self.computed(day_chain(today=True))
        number_row = split_top(button["grid-template-rows"], " ")[0]
        min_column = length(button["min-width"])
        for base in (16, 24, 32):
            for column in (min_column, 60, 80, 120):
                with self.subTest(base_font=base, column=column):
                    left, top, diameter = self.ring_box(base, column)
                    border = length(button["border"].split(" ")[0], base)
                    self.assertGreater(diameter, 0)
                    self.assertGreaterEqual(left, border, "원이 버튼 테두리 왼쪽 밖으로 나가지 않는다")
                    self.assertLessEqual(left + diameter, column - border, "원이 칸 오른쪽 끝을 넘지 않는다")
                    row = length(number_row, base)
                    self.assertGreaterEqual(top, border - 0.001, "원이 숫자 행 위로 나가지 않는다")
                    self.assertLessEqual(top + diameter, border + row + 0.001, "원이 막대 줄로 내려가지 않는다")
                    self.assertAlmostEqual(top + diameter / 2, border + row / 2, msg="원 중심이 숫자 행 중심이다")
                    self.assertAlmostEqual(left + diameter / 2, column / 2, msg="원 중심이 칸 가운데다")
        # 리뷰 재현: 32px·44px 칸. 예전 지름 56px는 칸 44px보다 컸다.
        _, _, diameter = self.ring_box(32, min_column)
        self.assertLessEqual(diameter, min_column - 8)
        # 넓은 칸과 기본 글꼴에서는 1.75rem(28px) 그대로라 숫자를 넉넉히 감싼다.
        self.assertAlmostEqual(self.ring_box(16, 80)[2], 28)

    def test_today_is_an_accent_circle(self):
        for col in (1, 4):
            chain = day_chain(col, today=True)
            ring = self.today_ring(col)
            self.assertEqual(ring.get("border-radius"), "50%")
            self.assertEqual(ring.get("border"), "2px solid var(--accent)")
            self.ring_decls = ring
            self.assertGreaterEqual(self.ring_box(16, 44)[2], 24, "기본 글꼴의 가장 좁은 칸에서도 숫자를 감싸는 크기다")
            for theme in self.themes:
                with self.subTest(theme=theme, col=col):
                    cell_face = self.face(chain, theme)
                    fill = over(self.color(theme, ring["background"], self.scope(chain)), cell_face)
                    accent = self.color(theme, "var(--accent)")
                    self.assertGreaterEqual(contrast(accent, fill), 3.0)
                    self.assertGreaterEqual(contrast(accent, cell_face), 3.0)
                    text = over(self.color(theme, self.computed(chain)["color"]), fill)
                    self.assertGreaterEqual(contrast(text, fill), 4.5)

    # --- 크기·초점·선택 -----------------------------------------------------------------------------

    def test_targets_are_at_least_44px(self):
        for media in (None, NARROW):
            for chain in (day_chain(), week() + [cell(2)], head_button("nav"), head_button("toggle")):
                with self.subTest(media=media, target=chain[-1]["classes"] or chain[-1]["attrs"]):
                    decls = self.computed(chain, media)
                    self.assertEqual(decls.get("min-height"), "44px")
                    self.assertEqual(decls.get("min-width"), "44px")

    def test_weekdays_and_grid_scroll_together_below_308px(self):
        """월 보기의 본문 상자(.acal-body)에는 요일 머리와 격자만 있다. 머리 줄과 고른 날 목록은 그 형제다.

        스크롤 상자는 요일 머리와 격자를 직접 품은 본문 상자다. 두 줄은 같은 최소 폭(7 × 44px)으로 넘쳐 함께 밀린다.
        루트·머리 줄·고른 날 목록은 스크롤하지 않고 고정(sticky)도 필요 없다.
        """
        self.assertEqual(7 * 44, 308)
        root = self.computed([acal()])
        self.assertNotIn("overflow-x", root, "루트가 스크롤하면 머리 줄까지 밀린다")
        self.assertEqual(root.get("min-width"), "0")
        self.assertEqual(root.get("grid-template-columns"), "minmax(0, 1fr)")
        self.assertNotIn("position", self.computed([acal(), HEAD_ROW]))
        box = self.computed(inside())
        self.assertEqual(box.get("overflow-x"), "auto")
        self.assertEqual(box.get("min-width"), "0")
        self.assertEqual(box.get("grid-template-columns"), "minmax(0, 1fr)")
        self.assertNotIn("position", box, "본문 상자 자체는 sticky가 아니다")
        # 스크롤 상자는 넘친 선을 자른다. 공통 초점 고리(간격 2px + 굵기 2px)가 안쪽 여백에 들어가고, 바깥 여백으로 폭을 되돌린다.
        self.assertEqual((box.get("padding"), box.get("margin")), ("4px", "-4px"))
        weekdays = inside() + [element("div", ["acal-weekdays"])]
        grid = inside() + [element("div", ["acal-grid"], ['[role="grid"]'])]
        for chain in (weekdays, grid):
            with self.subTest(target=chain[-1]["classes"]):
                decls = self.computed(chain)
                self.assertEqual(decls.get("min-width"), "308px")
                self.assertNotIn("overflow-x", decls, "한 줄만 따로 스크롤하면 둘이 어긋난다")
                self.assertNotIn("position", decls)
        self.assertEqual(self.computed(weekdays)["grid-template-columns"], self.computed(week())["grid-template-columns"])
        # 고른 날 목록과 목록 보기의 본문 상자는 스크롤 상자가 아니고 고정 위치도 받지 않는다.
        for label, chain in (("고른 날 목록", day_list()), ("목록 보기 본문", inside("list"))):
            with self.subTest(target=label):
                decls = self.computed(chain)
                self.assertNotIn("overflow-x", decls)
                self.assertNotIn("position", decls)
        self.assertFalse(any("sticky" in decls.get("position", "") for _, decls, _ in self.rules),
                         "스크롤 상자 밖으로 옮긴 목록에는 sticky 우회가 필요 없다")

    def scroll_box_above(self, chain):
        """chain[-1]이나 그 조상 가운데 가장 가까운 가로 스크롤 상자의 이름. 없으면 None.

        가로 스크롤은 터치·트랙패드·휠 모두 포인터 아래 요소에서 위로 올라가며 처음 만나는 스크롤 상자를 움직인다.
        그래서 목록이 움직이지 않으려면 목록과 그 안 모든 요소의 조상에 가로 스크롤 상자가 없어야 한다.
        이전 판은 같은 상자 안에 둔 목록에 touch-action: pan-y를 걸어 터치만 막았고, 트랙패드 가로 스크롤은 막지 못했다.
        """
        for depth in range(len(chain), 0, -1):
            if self.computed(chain[:depth]).get("overflow-x") in ("auto", "scroll"):
                return " ".join(sorted(chain[depth - 1]["classes"]))
        return None

    def test_horizontal_scroll_starts_only_on_weekdays_and_grid(self):
        """고른 날 목록 위에서 좌우로 밀거나 트랙패드로 굴리면 요일 머리·격자가 움직이던 결함(교차 검토 세 번째·네 번째 지적)을 잰다."""
        evidence = element("section", ["evidence"])
        moves = {
            "요일 칸": inside() + [element("div", ["acal-weekdays"]), element("span")],
            "날짜 버튼": day_chain(4),
            "주말 날짜 버튼": day_chain(7, today=True, more=True),
            "이웃 달 칸": week() + [cell(1, outside=True)],
            "기간 막대": bar_chain(2, 3, 1, "exam"),
            "+N개": day_chain(4, more=True) + [MORE_LABEL],
            "점": dot_chain("holiday"),
        }
        stays = {
            "고른 날 목록": day_list(),
            "목록 안 일정 글": day_list() + [evidence, element("p")],
            "목록 안 출처 링크": day_list() + [evidence, element("a")],
            "목록 보기 줄": inside("list") + [evidence, element("p")],
            "목록 보기 출처 링크": inside("list") + [evidence, element("a")],
            "머리 줄 버튼": head_button("nav"),
            "제목": [acal(), HEAD_ROW, element("h4", ["acal-title"])],
        }
        for label, chain in moves.items():
            with self.subTest(target=label):
                self.assertEqual(self.scroll_box_above(chain), "acal-body")
        for label, chain in stays.items():
            with self.subTest(target=label):
                self.assertIsNone(self.scroll_box_above(chain), "조상에 가로 스크롤 상자가 있으면 트랙패드로 굴려도 움직인다")
        # touch-action 우회는 남기지 않는다. 날짜 칸·버튼에 걸면 격자 스크롤과 탭 확대가 막히고, 목록에는 필요 없다.
        self.assertFalse([head for head, decls, _ in self.rules if "touch-action" in decls])
        self.assertNotIn("touch-action", self.section)

    def test_earlier_cross_review_repros_stay_fixed(self):
        """앞선 지적을 한곳에서 다시 잰다. 구조는 chat.js가 그리는 그대로다."""
        evidence = element("section", ["evidence"])
        # 1. 달 보기에서 고른 날 일정(section.evidence)이 접히지 않는다.
        self.assertNotEqual(self.computed(day_list("month") + [evidence]).get("display"), "none")
        # 2. 「+N개」 규칙은 마지막 자식인 점 묶음이 아니라 그 앞 요소에 걸린다.
        self.assertEqual(self.computed(day_chain(more=True) + [MORE_LABEL]).get("grid-row"), "4")
        self.assertEqual(self.computed(day_chain(more=True) + [DOT_GROUP]).get("grid-row"), "5")
        self.assertNotIn("font-size", self.computed(day_chain(more=True) + [DOT_GROUP]))
        # 3. 요일 머리와 격자는 같은 스크롤 상자 안에서 같은 최소 폭으로 넘친다.
        for name in ("acal-weekdays", "acal-grid"):
            chain = inside() + [element("div", [name])]
            self.assertEqual(self.computed(chain).get("min-width"), "308px")
            self.assertEqual(self.scroll_box_above(chain), "acal-body")
        # 4. 루트는 스크롤 상자가 아니라 머리 줄이 밀리지 않고, 본문 상자 전체에 sticky가 걸리지 않는다.
        self.assertNotIn("position", self.computed(inside()))
        self.assertNotIn("overflow-x", self.computed([acal()]))
        # 5. 고른 날 목록 안 출처 링크 위의 트랙패드 가로 스크롤이 격자를 움직이지 않는다.
        self.assertIsNone(self.scroll_box_above(day_list() + [evidence, element("a")]))

    def test_focus_and_selection_stay_inside_and_clear_three_to_one(self):
        for theme in self.themes:
            for col in (1, 4):
                for states in (("focus-visible",), ("focus-visible", "hover")):
                    chain = day_chain(col, selected=True, states=states)
                    with self.subTest(theme=theme, col=col, states=states):
                        decls = self.computed(chain)
                        width, style, ring = decls["outline"].split(" ", 2)
                        self.assertEqual((width, style), ("2px", "solid"))
                        border = int(decls["border"].split("px")[0])
                        offset = int(decls["outline-offset"].rstrip("px"))
                        self.assertLessEqual(offset, -(border + int(width.rstrip("px"))), "고리는 선택 테두리 안쪽에 그린다")
                        face = self.face(chain, theme)
                        self.assertGreaterEqual(contrast(over(self.color(theme, ring), face), face), 3.0)
                        edge = self.color(theme, decls["border-color"])
                        self.assertGreaterEqual(contrast(over(edge, face), face), 3.0)
                        outer = self.face(chain[:-1], theme)
                        self.assertGreaterEqual(contrast(over(edge, outer), outer), 3.0)
        plain = self.computed(day_chain())
        self.assertEqual(plain["border"], "2px solid transparent", "고르지 않은 날은 선이 없고 자리만 같다")

    def test_head_buttons_have_three_to_one_edges_and_ring(self):
        cases = []
        for kind in ("nav", "toggle"):
            for states in ((), ("hover",), ("focus-visible",)):
                cases.append(head_button(kind, states))
        cases.append(head_button("toggle", pressed="true"))
        cases.append(head_button("toggle", pressed="false"))
        for theme in self.themes:
            for chain in cases:
                with self.subTest(theme=theme, attrs=sorted(chain[-1]["attrs"]), states=sorted(chain[-1]["states"])):
                    decls = self.computed(chain)
                    inner = self.face(chain, theme)
                    outer = self.face(chain[:-1], theme)
                    edge = self.color(theme, decls.get("border-color") or re.search(r"var\(--[\w-]+\)", decls["border"]).group(0))
                    for side in (inner, outer):
                        self.assertGreaterEqual(contrast(over(edge, side), side), 3.0)
                    front = over(self.color(theme, decls["color"]), inner)
                    self.assertGreaterEqual(contrast(front, inner), 4.5)
                    if "focus-visible" in chain[-1]["states"]:
                        ring = decls["outline"].split(" ", 2)[2]
                        self.assertGreaterEqual(contrast(over(self.color(theme, ring), outer), outer), 3.0)
        pressed = self.computed(head_button("toggle", pressed="true"))
        released = self.computed(head_button("toggle", pressed="false"))
        self.assertNotEqual(pressed.get("border-color"), released.get("border-color"), "눌림은 aria-pressed만으로 알리지 않는다")

    # --- 글자 대비 --------------------------------------------------------------------------------

    def text_cases(self):
        for col in (1, 4, 7):
            yield f"day:{col}", day_chain(col)
            yield f"day:{col}:hover", day_chain(col, states=("hover",))
            yield f"day:{col}:selected", day_chain(col, selected=True)
            yield f"day:{col}:more", day_chain(col, more=True) + [MORE_LABEL]
            yield f"day:{col}:more:hover", day_chain(col, more=True, states=("hover",)) + [MORE_LABEL]
            yield f"day:{col}:today:more", day_chain(col, today=True, more=True) + [MORE_LABEL]
        yield "title", [acal(), element("div", ["acal-head"]), element("h4", ["acal-title"], ['[aria-live="polite"]'])]
        yield "weekday", inside() + [element("div", ["acal-weekdays"]), element("span")]
        yield "day-list", day_list() + [element("p")]
        yield "day-list-link", day_list() + [element("a")]
        yield "day-list-evidence", day_list() + [element("section", ["evidence"]), element("p")]
        for kind in KINDS:
            yield f"bar:{kind}", bar_chain(2, 3, 1, kind)

    def test_text_contrast_uses_declared_colors(self):
        for media in (None, NARROW):
            for theme in self.themes:
                for label, chain in self.text_cases():
                    if media and label.startswith("bar"):
                        continue
                    with self.subTest(media=media, theme=theme, case=label):
                        front, back = self.ink(chain, theme, media)
                        self.assertGreaterEqual(contrast(front, back), 4.5)

    def test_kind_tokens_exist_in_every_theme_and_chips_are_light_fill_dark_ink(self):
        for kind in KINDS:
            for theme in self.themes:
                with self.subTest(kind=kind, theme=theme):
                    fill = self.color(theme, f"var(--acal-{kind}-bg)")
                    text = self.color(theme, f"var(--acal-{kind}-ink)")
                    surface = self.color(theme, "var(--surface)")
                    self.assertEqual(fill[3], 1.0)
                    self.assertLess(contrast(fill, surface), 1.6, "채움은 옅다")
                    self.assertGreaterEqual(contrast(text, fill), 4.5)
        for kind in KINDS:
            with self.subTest(kind=kind):
                bar = self.computed(bar_chain(kind=kind))
                self.assertEqual((bar["background"], bar["color"]), (f"var(--acal-{kind}-bg)", f"var(--acal-{kind}-ink)"))
                self.assertEqual(self.computed(dot_chain(kind))["background"], f"var(--acal-{kind}-dot)")
        no_kind = week() + [element("div", ["acal-bar"], ['[data-col="1"]', '[data-span="1"]', '[data-lane="0"]'])]
        bar = self.computed(no_kind)
        self.assertEqual((bar["background"], bar["color"]), ("var(--acal-neutral-bg)", "var(--acal-neutral-ink)"),
                         "분류가 없으면 중립색이다")
        dot = self.computed(week() + [cell(3), element("span", ["acal-dot"])])
        self.assertEqual(dot["background"], "var(--acal-neutral-dot)")

    def test_backgrounds_use_theme_tokens_and_stay_dark_in_dark(self):
        """landing_design.test.mjs는 배경 변수를 맨 위 색 블록에서만 풀고, 다크에서 휘도 .5를 넘는 면을 목록으로 막는다."""
        for head, decls, _ in self.rules:
            for key in ("background", "background-color"):
                if key not in decls or decls[key] == "transparent":
                    continue
                with self.subTest(selector=head, key=key):
                    names = re.findall(r"var\((--[\w-]+)\)", decls[key])
                    self.assertEqual(len(names), 1)
                    self.assertRegex(decls[key], r"^var\(--[\w-]+\)$")
                    for theme in ("dark", "system-dark"):
                        self.assertIn(names[0], self.themes[theme])
                        paint = self.color(theme, decls[key])
                        self.assertTrue(paint[3] < .8 or luminance(paint) <= .5, "다크에 밝은 면을 새로 만들지 않는다")

    def test_new_tokens_live_in_all_three_theme_blocks(self):
        plain = strip_comments(self.raw)
        light = tokens(block_after(plain, ":root {"))
        attr = tokens(block_after(plain, ':root[data-theme="dark"]'))
        system = tokens(block_after(plain, ":root:not([data-theme])"))
        names = [name for name in light if name.startswith("--acal-")]
        self.assertEqual(len(names), 2 + 3 * len(KINDS))
        self.assertEqual([n for n in attr if n.startswith("--acal-")], names, "두 다크 블록은 같은 순서다")
        self.assertEqual([n for n in system if n.startswith("--acal-")], names)
        for name in names:
            with self.subTest(name=name):
                self.assertRegex(light[name], r"^#[0-9A-F]{6}$")
                self.assertEqual(attr[name], system[name])
                self.assertNotEqual(attr[name], light[name], "다크 값은 라이트 값과 다르다")

    def test_kinds_have_distinct_hues(self):
        for theme in self.themes:
            fills = {self.color(theme, f"var(--acal-{kind}-bg)") for kind in KINDS}
            inks = {self.color(theme, f"var(--acal-{kind}-ink)") for kind in KINDS}
            with self.subTest(theme=theme):
                self.assertEqual(len(fills), len(KINDS))
                self.assertEqual(len(inks), len(KINDS))
                enroll, exam, holiday, register = (self.color(theme, f"var(--acal-{k}-ink)") for k in KINDS[:4])
                self.assertGreater(enroll[2], enroll[0], "수강신청은 파랑")
                self.assertGreater(exam[0], exam[2], "시험은 코랄")
                self.assertGreater(holiday[0], holiday[1] + 40, "휴일은 빨강")
                self.assertGreater(register[1], register[2] + 40, "등록은 노랑")

    # --- 좁은 패널과 보기 전환 ------------------------------------------------------------------------

    def test_narrow_panel_swaps_bars_for_dots(self):
        root = self.computed([acal()])
        self.assertEqual(root.get("container-type"), "inline-size")
        self.assertEqual(root.get("container-name"), "acal")
        self.assertIn(NARROW, {media for _, _, media in self.rules})
        self.assertNotIn("@media (max-width", self.section.split(REDUCED)[0], "전환은 화면 폭이 아니라 패널 폭으로 한다")
        for kind in KINDS:
            with self.subTest(kind=kind):
                self.assertNotEqual(self.computed(bar_chain(kind=kind)).get("display"), "none")
                self.assertEqual(self.computed(bar_chain(kind=kind), NARROW).get("display"), "none")
                self.assertEqual(self.computed(dot_chain(kind)).get("display"), "none")
                self.assertEqual(self.computed(dot_chain(kind), NARROW).get("display"), "inline-block")
        for theme in self.themes:
            for kind in KINDS:
                with self.subTest(theme=theme, kind=kind):
                    chain = dot_chain(kind)
                    dot = self.color(theme, self.computed(chain, NARROW)["background"], self.scope(chain, NARROW))
                    face = self.face(chain[:-1], theme, NARROW)
                    self.assertGreaterEqual(contrast(dot, face), 3.0)
        narrow_cell = self.computed(week() + [cell(3)], NARROW)
        self.assertEqual(narrow_cell.get("flex-wrap"), "wrap")
        self.assertEqual(self.computed(day_chain(), NARROW).get("flex"), "1 1 100%", "날짜 버튼은 좁은 칸 폭을 채운다")

    def test_day_list_stays_in_both_widths(self):
        chain = day_list()
        for media in (None, NARROW):
            self.assertNotEqual(self.computed(chain, media).get("display"), "none")
        link = self.computed(chain + [element("a")])
        self.assertEqual(link.get("min-height"), "44px")

    def test_view_toggle_hides_the_other_view(self):
        for name in ("acal-weekdays", "acal-grid"):
            with self.subTest(name=name):
                self.assertEqual(self.computed(inside("list") + [element("div", [name])]).get("display"), "none")
                self.assertNotEqual(self.computed(inside("month") + [element("div", [name])]).get("display"), "none")
        # 고른 날 목록은 본문 상자 밖, 루트 직속이다. 자손 선택자라 위치가 바뀌어도 목록 보기에서 접힌다.
        self.assertEqual(self.computed(day_list("list")).get("display"), "none")
        self.assertNotEqual(self.computed(day_list("month")).get("display"), "none")
        evidence = element("section", ["evidence"])
        # 목록 보기 줄은 루트 직속이거나 본문 상자 직속이다. 어느 쪽이든 달 보기에서만 접힌다.
        for parents in (lambda view: [acal(view)], inside):
            with self.subTest(parents=len(parents("month"))):
                self.assertEqual(self.computed(parents("month") + [evidence]).get("display"), "none")
                self.assertNotEqual(self.computed(parents("list") + [evidence]).get("display"), "none")
        # 고른 날 목록의 일정도 section.evidence다. 달 보기에서 이것까지 접으면 일정 이름·기간·출처가 사라진다.
        picked = day_list("month") + [evidence]
        self.assertNotEqual(self.computed(picked).get("display"), "none")
        self.assertNotEqual(self.computed(picked + [element("p")]).get("display"), "none")
        for media in (None, NARROW):
            self.assertNotEqual(self.computed(picked, media).get("display"), "none")

    def test_selector_reader_tells_child_from_descendant_and_reads_has(self):
        root, picked, evidence = acal("month"), element("div", ["acal-day-list"]), element("section", ["evidence"])
        self.assertTrue(selector_matches('.acal[data-view="month"] > section.evidence', [root, evidence]))
        self.assertFalse(selector_matches('.acal[data-view="month"] > section.evidence', [root, picked, evidence]))
        self.assertTrue(selector_matches('.acal[data-view="month"] section.evidence', [root, picked, evidence]))
        button = element("button", ["acal-day"], ["[data-more]"])
        self.assertTrue(selector_matches(".acal-day[data-more] > :has(+ * .acal-dot)", [button, MORE_LABEL]))
        self.assertFalse(selector_matches(".acal-day[data-more] > :has(+ * .acal-dot)", [button, DOT_GROUP]))
        scroller = ":is(.acal, .acal-body):has(> .acal-grid)"
        self.assertTrue(selector_matches(scroller, [root, body()]), "격자를 품은 본문 상자가 스크롤 상자다")
        self.assertFalse(selector_matches(scroller, [root, list_body()]), "격자 없는 목록 보기 본문은 스크롤하지 않는다")
        self.assertFalse(selector_matches(scroller, [root]), "루트는 격자를 직접 품지 않는다")

    # --- 움직임·선·색 -----------------------------------------------------------------------------

    def test_section_adds_no_motion(self):
        """달력은 움직임 없이 바로 다시 그린다. 움직임 줄이기 설정에서 끌 것이 없고 reduced-motion 블록(전체 3개 고정)도 늘리지 않는다."""
        self.assertNotIn("@keyframes", self.section)
        self.assertNotIn("prefers-reduced-motion", self.section)
        for head, decls, _ in self.rules:
            for key in decls:
                with self.subTest(selector=head, key=key):
                    self.assertFalse(key.startswith(("transition", "animation", "scroll-behavior")))
                    self.assertNotIn(key, ("view-transition-name", "transform"))

    def test_lines_are_thin_and_colors_are_tokens(self):
        for head, decls, _ in self.rules:
            for key, value in decls.items():
                with self.subTest(selector=head, key=key):
                    self.assertNotIn("gradient", value)
                    self.assertIsNone(re.search(r"#[0-9a-fA-F]{3,8}\b|rgba?\(", value), "색은 토큰으로만 쓴다")
                    self.assertNotIn("shadow", key, "경계는 그림자보다 얇은 선이다")
                    self.assertNotIn("backdrop-filter", key)
                    if key.startswith("border") and "radius" not in key and "px" in value:
                        self.assertRegex(value, r"^[12]px ")

    def test_dark_blocks_agree_on_used_tokens(self):
        names = set(re.findall(r"var\((--[\w-]+)\)", self.section))
        local = set(re.findall(r"(--acal-line)\s*:", self.section))
        self.assertEqual(local, {"--acal-line"}, "절 안에서 정하는 변수는 선 색 하나뿐이다")
        for token in names - local:
            with self.subTest(token=token):
                self.assertEqual(self.color("dark", f"var({token})"), self.color("system-dark", f"var({token})"))


if __name__ == "__main__":
    unittest.main()
