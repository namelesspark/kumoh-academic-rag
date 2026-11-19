"""질문 수정·다시 답하기와 답변 버전 화면(#140)의 모양 테스트.

브라우저를 띄우지 않고 실제 chat.css를 읽는다. #140 절의 규칙을 작은 선택자 판정기로 가상 요소(버튼·번호·폼·실패 문구)에
걸어 그 요소가 실제로 받는 선언을 모으고, 그 색으로 라이트·다크(속성)·다크(시스템) 대비를 계산한다.
고정된 색 쌍을 계산하지 않으므로 규칙의 색을 바꾸면 결과도 바뀐다.
"""

import re
import unittest
from pathlib import Path

CSS_PATH = Path(__file__).resolve().parents[1] / "app" / "chat_web" / "assets" / "chat.css"
MARKER = "/* 질문 수정·다시 답하기와 답변 버전 (#140)."
NARROW = "@media (max-width: 390px)"

BUTTONS = (".turn-edit", ".turn-regenerate", ".version-prev", ".version-next",
           ".turn-editor-cancel", ".turn-editor-submit")
NAMES = BUTTONS + (".turn-actions", ".version-picker", ".version-count", "form.turn-editor",
                   ".version-error", '.turn[data-version-state="pending"]',
                   '.turn[data-version-state="failed"]')


# --- CSS 읽기 ---------------------------------------------------------------------------------

def strip_comments(text):
    return re.sub(r"/\*.*?\*/", "", text, flags=re.S)


def block_after(text, head):
    """head가 시작하는 자리의 첫 중괄호 블록 안쪽 글. head에 "{"가 들어 있어도 그 중괄호부터 센다."""
    start = text.index("{", text.index(head)) + 1
    depth, pos = 1, start
    while depth:
        depth += {"{": 1, "}": -1}.get(text[pos], 0)
        pos += 1
    return text[start:pos - 1]


def rules(text):
    """(선택자 머리, 선언 사전, 미디어 조건) 목록. @media·@supports 안쪽도 펼친다."""
    found = []

    def walk(chunk, media):
        pos = 0
        while True:
            open_at = chunk.find("{", pos)
            if open_at < 0:
                return
            head = chunk[pos:open_at].strip()
            depth, end = 1, open_at + 1
            while depth:
                depth += {"{": 1, "}": -1}.get(chunk[end], 0)
                end += 1
            body = chunk[open_at + 1:end - 1]
            if head.startswith("@media") or head.startswith("@supports"):
                walk(body, head)
            elif not head.startswith("@"):
                decls = {}
                for part in body.split(";"):
                    if ":" in part:
                        key, value = part.split(":", 1)
                        decls[key.strip()] = value.strip()
                found.append((head, decls, media))
            pos = end

    walk(text, None)
    return found


def split_top(text, separators):
    """괄호 밖의 구분자로만 나눈다. :is(.a, .b) 안의 쉼표·공백은 나누지 않는다."""
    parts, depth, current = [], 0, ""
    for char in text:
        depth += {"(": 1, ")": -1, "[": 1, "]": -1}.get(char, 0)
        if depth == 0 and char in separators:
            parts.append(current)
            current = ""
        else:
            current += char
    parts.append(current)
    return [part.strip() for part in parts if part.strip()]


# --- 가상 요소와 선택자 판정 --------------------------------------------------------------------

def element(tag, classes=(), attrs=(), states=()):
    return {"tag": tag, "classes": set(classes), "attrs": set(attrs), "states": set(states)}


def compound_matches(compound, node):
    for inner in re.findall(r":is\(([^()]*)\)", compound):
        if not any(compound_matches(option, node) for option in split_top(inner, ",")):
            return False
    rest = re.sub(r":is\([^()]*\)", "", compound)
    for inner in re.findall(r":not\(([^()]*)\)", rest):
        if compound_matches(inner, node):
            return False
    rest = re.sub(r":not\([^()]*\)", "", rest)
    tag = re.match(r"[a-z]*", rest).group(0)
    if tag and tag != node["tag"]:
        return False
    for token in re.findall(r"\.[\w-]+|\[[^\]]+\]|::?[\w-]+|\*", rest[len(tag):]):
        if token == "*":
            continue
        if token.startswith("."):
            ok = token[1:] in node["classes"]
        elif token.startswith("["):
            ok = token in node["attrs"]
        else:
            ok = token.lstrip(":") in node["states"]
        if not ok:
            return False
    return True


def selector_matches(selector, chain):
    """chain은 바깥 조상부터 대상 요소까지의 목록이다. 자식(>)도 자손처럼 본다."""
    compounds = [part for part in split_top(selector, " >") if part != ">"]
    if not compounds or not compound_matches(compounds[-1], chain[-1]):
        return False
    ancestors = chain[:-1]
    index = len(ancestors)
    for compound in reversed(compounds[:-1]):
        index -= 1
        while index >= 0 and not compound_matches(compound, ancestors[index]):
            index -= 1
        if index < 0:
            return False
    return True


# --- 색 -------------------------------------------------------------------------------------

def tokens(body):
    return {name: value.strip() for name, value in re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", body)}


def rgba(value):
    value = value.strip()
    match = re.fullmatch(r"#([0-9a-fA-F]{6})", value)
    if match:
        hexa = match.group(1)
        return tuple(int(hexa[i:i + 2], 16) for i in (0, 2, 4)) + (1.0,)
    match = re.fullmatch(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)", value)
    if match:
        r, g, b, a = match.groups()
        return int(r), int(g), int(b), float(a) if a else 1.0
    raise AssertionError(f"색으로 읽을 수 없는 값: {value}")


def over(top, bottom):
    alpha = top[3]
    return tuple(top[i] * alpha + bottom[i] * (1 - alpha) for i in range(3)) + (1.0,)


def luminance(rgb):
    def channel(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (channel(c) for c in rgb[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(fg, bg):
    hi, lo = sorted((luminance(fg), luminance(bg)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def border_color(decls):
    if "border-color" in decls:
        return decls["border-color"]
    match = re.search(r"var\(--[\w-]+\)", decls.get("border", ""))
    return match.group(0) if match else None


class ChatVersionsStyleTest(unittest.TestCase):
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

    # 가상 요소. 조작 줄은 답 아래 .turn-actions, 편집 폼은 .turn 안 form.turn-editor, 실패 문구는 조작 줄 다음이다.
    def chain(self, target, state=None):
        attrs = {f'[data-version-state="{state}"]'} if state else set()
        turn = element("div", ["turn"], attrs)
        name = target["classes"] and next(iter(target["classes"]))
        if name in ("version-prev", "version-next", "version-count"):
            return [turn, element("div", ["turn-actions"]), element("div", ["version-picker"], ['[role="group"]']), target]
        if name in ("turn-edit", "turn-regenerate"):
            return [turn, element("div", ["turn-actions"]), target]
        if name in ("turn-editor-cancel", "turn-editor-submit") or target["tag"] == "textarea":
            return [turn, element("form", ["turn-editor"]), target]
        return [turn, target]

    def computed(self, chain, media=None):
        result = {}
        for head, decls, rule_media in self.rules:
            if rule_media not in (None, media):
                continue
            if any(selector_matches(selector, chain) for selector in split_top(head, ",")):
                result.update(decls)
        return result

    def color(self, theme, value):
        table = self.themes[theme]
        seen = set()
        while value and value.startswith("var("):
            name = re.fullmatch(r"var\((--[\w-]+)\)", value).group(1)
            self.assertNotIn(name, seen)
            seen.add(name)
            value = table.get(name)
        self.assertIsNotNone(value)
        return rgba(value)

    def outer_backdrops(self, theme):
        """사진을 받지 못했을 때 조작 줄 바깥 면.

        바닥은 body·.campus-backdrop의 대체 색 --navy다(--bg도 함께 본다). 그 위에 덮개 하나(또는 없음),
        맨 위에 대화 면(--main-surface) 또는 답 말풍선(--main-bubble)을 얹는다.
        """
        self.assertIn("background: var(--navy) url(", self.raw, "사진 대체 색이 바뀌면 이 바닥도 바꾼다")
        found = []
        for floor in ("--navy", "--bg"):
            bottom = self.color(theme, f"var({floor})")
            for veil in (None, "--overlay-top", "--overlay-mid", "--overlay-bottom"):
                base = over(self.color(theme, f"var({veil})"), bottom) if veil else bottom
                for face in ("--main-surface", "--main-bubble"):
                    found.append(over(self.color(theme, f"var({face})"), base))
        return found

    def button_cases(self):
        for name in BUTTONS:
            for states in ((), ("hover",), ("disabled",), ("focus-visible",)):
                for turn_state in (None, "pending", "failed"):
                    target = element("button", [name.lstrip(".")], states=states)
                    yield f"{name}:{'/'.join(states) or 'base'}:{turn_state}", self.chain(target, turn_state)

    def text_cases(self):
        yield from self.button_cases()
        yield ".version-count", self.chain(element("span", ["version-count"], ['[aria-live="polite"]']))
        yield ".version-error", self.chain(element("p", ["version-error"]), "failed")
        yield "form.turn-editor textarea", self.chain(element("textarea"), "failed")

    # --- 이름표와 자리 ---------------------------------------------------------------------------

    def test_section_adds_every_issue_name(self):
        for name in NAMES:
            with self.subTest(name=name):
                self.assertIn(name, self.section)

    def test_section_is_appended_after_existing_rules(self):
        before = strip_comments(self.raw[:self.raw.index(MARKER)])
        for name in (".turn-actions", ".version-picker", ".turn-editor", "data-version-state", ".version-error"):
            with self.subTest(name=name):
                self.assertNotIn(name, before)

    def test_selector_reader_tells_similar_names_apart(self):
        edit = [element("div", ["turn"]), element("div", ["turn-actions"]), element("button", ["turn-edit"])]
        self.assertTrue(selector_matches(":is(.turn-edit, .version-next):not(:disabled):hover",
                                         edit[:-1] + [element("button", ["turn-edit"], states=["hover"])]))
        self.assertFalse(selector_matches(":is(.turn-edit):not(:disabled):hover",
                                          edit[:-1] + [element("button", ["turn-edit"], states=["hover", "disabled"])]))
        self.assertFalse(selector_matches("form.turn-editor textarea", edit))
        self.assertFalse(selector_matches('.turn[data-version-state="pending"] .x', [element("div", ["turn"]), element("i", ["x"])]))

    # --- 크기·초점·줄바꿈 -------------------------------------------------------------------------

    def test_controls_are_at_least_44px(self):
        for name in BUTTONS:
            with self.subTest(name=name):
                decls = self.computed(self.chain(element("button", [name.lstrip(".")])))
                self.assertEqual(decls.get("min-height"), "44px")
                self.assertEqual(decls.get("min-width"), "44px")
        count = self.computed(self.chain(element("span", ["version-count"])))
        self.assertEqual(count.get("min-height"), "44px")

    def test_focus_ring_sits_on_a_surface_band(self):
        for theme in self.themes:
            for label, chain in self.button_cases():
                if "focus-visible" not in chain[-1]["states"]:
                    continue
                with self.subTest(theme=theme, case=label):
                    decls = self.computed(chain)
                    width, style, ring = decls["outline"].split(" ", 2)
                    self.assertEqual((width, style), ("2px", "solid"))
                    spread, band = re.fullmatch(r"0 0 0 (\d+)px (var\(--[\w-]+\))", decls["box-shadow"]).groups()
                    # 고리 바깥 끝(간격+굵기)까지 띠가 깔려야 고리 양옆이 모두 띠 색이다.
                    self.assertGreaterEqual(int(spread), int(decls["outline-offset"].rstrip("px")) + 2)
                    band_color = self.color(theme, band)
                    self.assertEqual(band_color[3], 1.0)
                    self.assertGreaterEqual(contrast(over(self.color(theme, ring), band_color), band_color), 3.0)

    def test_actions_wrap_and_stack_at_390px(self):
        row = [element("div", ["turn"]), element("div", ["turn-actions"])]
        self.assertEqual(self.computed(row).get("flex-wrap"), "wrap")
        for name in (".turn-edit", ".turn-regenerate"):
            with self.subTest(name=name):
                child = self.chain(element("button", [name.lstrip(".")]))
                self.assertEqual(self.computed(child, NARROW).get("flex"), "1 1 100%")
        picker = row + [element("div", ["version-picker"])]
        self.assertEqual(self.computed(picker, NARROW).get("flex"), "1 1 100%")

    # --- 상태 -----------------------------------------------------------------------------------

    def test_disabled_controls_do_not_fade_through_the_photo(self):
        for name in BUTTONS:
            with self.subTest(name=name):
                decls = self.computed(self.chain(element("button", [name.lstrip(".")], states=["disabled"])))
                self.assertEqual(decls.get("opacity"), "1")
                self.assertEqual(decls.get("border-style"), "dashed")

    def pending_row(self, state="pending"):
        attrs = [f'[data-version-state="{state}"]'] if state else []
        return [element("div", ["turn"], attrs), element("div", ["turn-actions"])]

    def test_pending_mark_does_not_need_an_answer(self):
        # 첫 답 전에 정지한 기록은 답 없이 질문만 복원된다. .reply가 없어도 조작 줄에 점선이 보여야 한다.
        decls = self.computed(self.pending_row())
        self.assertRegex(decls.get("outline", ""), r"^1px dashed var\(--[\w-]+\)$")
        self.assertNotIn("outline", self.computed(self.pending_row(None)))
        self.assertFalse(any("pending" in head and ".reply" in head for head, _, _ in self.rules))
        regenerate = self.chain(element("button", ["turn-regenerate"], states=["disabled"]), "pending")
        self.assertEqual(self.computed(regenerate).get("cursor"), "progress")

    def test_outlines_stay_inside_the_turn(self):
        """680px 이하 대화 칸은 좌우 여백 없이 가로 넘침을 숨긴다. 초점 고리·띠와 대기 점선이 차례 밖으로 나가면 잘린다."""
        self.assertIn("overflow-x: hidden", self.raw)
        for media in (None, NARROW):
            row = self.computed(self.pending_row(None), media)
            pad = int(row["padding"].rstrip("px"))
            form = self.computed([element("div", ["turn"]), element("form", ["turn-editor"])], media)
            form_pad = int(form["padding"].rstrip("px"))
            for label, chain in self.button_cases():
                if "focus-visible" not in chain[-1]["states"]:
                    continue
                with self.subTest(media=media, case=label):
                    decls = self.computed(chain, media)
                    reach = max(int(decls["outline-offset"].rstrip("px")) + 2,
                                int(re.match(r"0 0 0 (\d+)px", decls["box-shadow"]).group(1)))
                    room = form_pad if chain[-2]["tag"] == "form" else pad
                    self.assertGreaterEqual(room, reach)
            pending = self.computed(self.pending_row(), media)
            self.assertLessEqual(int(pending["outline-offset"].rstrip("px")), -1, "점선은 조작 줄 상자 안쪽에 긋는다")

    def test_failed_turn_marks_textarea_and_error(self):
        failed = [element("div", ["turn"], ['[data-version-state="failed"]']), element("form", ["turn-editor"])]
        self.assertNotIn("border-color", self.computed(failed), "폼 바깥 선은 바꾸지 않는다")
        textarea = self.computed(failed + [element("textarea")])
        self.assertEqual(textarea.get("border-color"), "var(--danger)")
        error = self.computed(self.chain(element("p", ["version-error"]), "failed"))
        self.assertEqual(error.get("color"), "var(--danger)")
        self.assertEqual(error.get("border"), "0")
        # 위험 색 편집 칸 선은 폼 안쪽 --surface에만 닿는다.
        form_face = self.computed(failed)["background"]
        for theme in self.themes:
            with self.subTest(theme=theme):
                back = self.color(theme, form_face)
                edge = self.color(theme, textarea["border-color"])
                self.assertGreaterEqual(contrast(over(edge, back), back), 3.0)
                self.assertEqual(self.color(theme, textarea["background"]), back)

    # --- 움직임·선·색 -----------------------------------------------------------------------------

    def test_section_adds_no_motion(self):
        self.assertNotIn("@keyframes", self.section)
        for head, decls, _ in self.rules:
            for key in decls:
                with self.subTest(selector=head, key=key):
                    self.assertFalse(key.startswith("transition") or key.startswith("animation"))
                    self.assertNotEqual(key, "view-transition-name")

    def test_lines_are_thin_and_colors_are_tokens(self):
        for head, decls, _ in self.rules:
            for key, value in decls.items():
                with self.subTest(selector=head, key=key):
                    self.assertNotIn("gradient", value)
                    self.assertIsNone(re.search(r"#[0-9a-fA-F]{3,8}\b|rgba?\(", value), "색은 토큰으로만 쓴다")
                    if (key.startswith("border") or key == "outline") and "radius" not in key and "px" in value:
                        self.assertRegex(value, r"^[12]px ")
                        if key != "outline":
                            self.assertRegex(value, r"^1px ", "경계는 1px 선이다")
                    if key == "box-shadow":
                        self.assertIn(":focus-visible", head, "그림자는 초점 띠에만 쓴다")

    def test_text_contrast_uses_declared_colors(self):
        for theme in self.themes:
            for label, chain in self.text_cases():
                with self.subTest(theme=theme, case=label):
                    decls = self.computed(chain)
                    back = self.color(theme, decls["background"])
                    self.assertEqual(back[3], 1.0, "글자 뒤 면은 불투명이어야 사진이 비치지 않는다")
                    front = over(self.color(theme, decls["color"]), back)
                    self.assertGreaterEqual(contrast(front, back), 4.5)

    def test_control_edges_clear_both_sides(self):
        """버튼·편집 폼의 선은 안쪽 면과 바깥 대화 면 양쪽과 3:1을 넘는다."""
        cases = list(self.button_cases())
        cases.append(("form.turn-editor", [element("div", ["turn"]), element("form", ["turn-editor"])]))
        cases.append(("form.turn-editor:failed", [element("div", ["turn"], ['[data-version-state="failed"]']),
                                                  element("form", ["turn-editor"])]))
        for theme in self.themes:
            outer = self.outer_backdrops(theme)
            for label, chain in cases:
                with self.subTest(theme=theme, case=label):
                    decls = self.computed(chain)
                    inner = self.color(theme, decls["background"])
                    edge = self.color(theme, border_color(decls))
                    # 선과 채움이 같은 색이면(저장하고 묻기) 채움 자체가 경계라 바깥 면과만 잰다.
                    sides = outer if edge == inner else [inner] + outer
                    for side in sides:
                        self.assertGreaterEqual(contrast(over(edge, side), side), 3.0)

    def test_pending_outline_clears_the_conversation_face(self):
        decls = self.computed(self.pending_row())
        self.assertNotIn("background", decls, "조작 줄은 투명이라 점선 뒤는 바깥 대화 면이다")
        line = decls["outline"].split(" ")[-1]
        for theme in self.themes:
            for side in self.outer_backdrops(theme):
                with self.subTest(theme=theme):
                    self.assertGreaterEqual(contrast(over(self.color(theme, line), side), side), 3.0)

    def test_dark_blocks_agree_on_used_tokens(self):
        for token in set(re.findall(r"var\((--[\w-]+)\)", self.section)):
            with self.subTest(token=token):
                self.assertEqual(self.color("dark", f"var({token})"), self.color("system-dark", f"var({token})"))


if __name__ == "__main__":
    unittest.main()
