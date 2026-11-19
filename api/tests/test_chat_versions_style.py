"""질문 수정·다시 답하기와 답변 버전 화면(#140)의 모양 테스트.

브라우저를 띄우지 않고 실제 chat.css를 읽어 이슈가 정한 이름표 규칙, 44px 조작 영역, 초점 표시,
390px 줄바꿈, 움직임 없음, 라이트·다크 두 테마 토큰의 대비를 계산한다.
"""

import re
import unittest
from pathlib import Path

CSS_PATH = Path(__file__).resolve().parents[1] / "app" / "chat_web" / "assets" / "chat.css"
MARKER = "/* 질문 수정·다시 답하기와 답변 버전 (#140)."

BUTTONS = (".turn-edit", ".turn-regenerate", ".version-prev", ".version-next",
           ".turn-editor-cancel", ".turn-editor-submit")
NAMES = BUTTONS + (".turn-actions", ".version-picker", ".version-count", "form.turn-editor",
                   ".version-error", '.turn[data-version-state="pending"]',
                   '.turn[data-version-state="failed"]')


def strip_comments(text):
    return re.sub(r"/\*.*?\*/", "", text, flags=re.S)


def block_after(text, head):
    """head 바로 뒤 중괄호 블록의 안쪽 글을 돌려준다. 안쪽 중괄호도 짝을 맞춘다."""
    # head에 여는 중괄호가 들어 있어도(":root {") 그 중괄호부터 센다. head 뒤에서 찾으면 다음 블록을 읽는다.
    start = text.index("{", text.index(head)) + 1
    depth, pos = 1, start
    while depth:
        char = text[pos]
        depth += {"{": 1, "}": -1}.get(char, 0)
        pos += 1
    return text[start:pos - 1]


def rules(text):
    """중첩 없는 규칙 목록 (선택자, 선언 사전). @media 안쪽도 펼쳐 담고 미디어 조건을 함께 남긴다."""
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


def names(selector, name):
    """선택자에 이름표가 온전히 들어 있는지 본다. .turn-edit는 .turn-editor와 다른 이름이다."""
    return re.search(re.escape(name) + r"(?![\w-])", selector) is not None


def tokens(body):
    return {name: value.strip() for name, value in re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", body)}


def resolve(name, table, base):
    value = table.get(name, base.get(name))
    seen = set()
    while value and value.startswith("var("):
        inner = re.match(r"var\((--[\w-]+)\)", value).group(1)
        if inner in seen:
            raise AssertionError(f"순환 변수 {inner}")
        seen.add(inner)
        value = table.get(inner, base.get(inner))
    return value


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
    return tuple(top[i] * alpha + bottom[i] * (1 - alpha) for i in range(3))


def luminance(rgb):
    def channel(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (channel(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(fg, bg):
    hi, lo = sorted((luminance(fg), luminance(bg)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


class ChatVersionsStyleTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        raw = CSS_PATH.read_text(encoding="utf-8")
        cls.raw = raw
        cls.section = strip_comments(raw[raw.index(MARKER):])
        cls.rules = rules(cls.section)
        plain = strip_comments(raw)
        light = tokens(block_after(plain, ":root {"))
        dark_attr = tokens(block_after(plain, ':root[data-theme="dark"]'))
        dark_system = tokens(block_after(plain, ":root:not([data-theme])"))
        cls.light = light
        cls.themes = {"light": ({}, light), "dark": (dark_attr, light), "system-dark": (dark_system, light)}

    def decls_for(self, name, media=None):
        merged = {}
        for selector, decls, rule_media in self.rules:
            if rule_media == media and names(selector, name):
                merged.update(decls)
        return merged

    def color(self, theme, token):
        table, base = self.themes[theme]
        return rgba(resolve(token, table, base))

    def test_section_adds_every_issue_name(self):
        for name in NAMES:
            with self.subTest(name=name):
                self.assertIn(name, self.section)

    def test_section_is_appended_after_existing_rules(self):
        # 기존 규칙을 고치지 않고 끝에 더한다. 이 절 앞에는 이름표가 나오지 않는다.
        before = strip_comments(self.raw[:self.raw.index(MARKER)])
        for name in (".turn-actions", ".version-picker", ".turn-editor", "data-version-state", ".version-error"):
            with self.subTest(name=name):
                self.assertNotIn(name, before)

    def test_controls_are_at_least_44px(self):
        for name in BUTTONS + (".version-count",):
            with self.subTest(name=name):
                decls = self.decls_for(name)
                self.assertEqual(decls.get("min-height"), "44px")
        for name in BUTTONS:
            with self.subTest(name=name):
                self.assertEqual(self.decls_for(name).get("min-width"), "44px")

    def test_controls_use_thin_token_lines_without_gradients(self):
        decls = self.decls_for(".turn-edit")
        self.assertEqual(decls["border"], "1px solid var(--control-line)")
        self.assertEqual(decls["background"], "var(--surface)")
        for selector, body, _ in self.rules:
            for key, value in body.items():
                with self.subTest(selector=selector, key=key):
                    self.assertNotIn("gradient", value)
                    self.assertIsNone(re.search(r"#[0-9a-fA-F]{3,8}\b|rgba?\(", value), "색은 토큰으로만 쓴다")
                    if key.startswith("border") and "radius" not in key and "px" in value:
                        self.assertRegex(value, r"^1px ", "경계는 1px 선이다")
                    if key == "box-shadow":
                        self.assertIn(":focus-visible", selector, "그림자는 초점 띠에만 쓴다")

    def test_focus_ring_is_visible_on_every_control(self):
        focus = [(s, d) for s, d, _ in self.rules if ":focus-visible" in s]
        self.assertTrue(focus)
        for name in BUTTONS:
            with self.subTest(name=name):
                match = [d for s, d in focus if names(s, name)]
                self.assertTrue(match)
                self.assertEqual(match[0]["outline"], "2px solid var(--focus-ring)")
                self.assertEqual(match[0]["box-shadow"], "0 0 0 6px var(--surface)")

    def test_disabled_controls_do_not_fade_through_the_photo(self):
        disabled = [d for s, d, _ in self.rules if s.endswith(":disabled") and names(s, ".version-next") and "pending" not in s]
        self.assertTrue(disabled)
        self.assertEqual(disabled[0]["opacity"], "1")
        self.assertEqual(disabled[0]["color"], "var(--text-muted)")
        self.assertEqual(disabled[0]["border-style"], "dashed")

    def test_states_have_distinct_static_marks(self):
        pending = self.decls_for('.turn[data-version-state="pending"] .reply')
        self.assertEqual(pending.get("outline"), "1px dashed var(--control-line)")
        failed = self.decls_for('.turn[data-version-state="failed"] form.turn-editor')
        self.assertEqual(failed.get("border-color"), "var(--danger)")
        error = self.decls_for(".version-error")
        self.assertEqual(error.get("color"), "var(--danger)")
        self.assertEqual(error.get("background"), "var(--surface)")

    def test_actions_wrap_and_stack_at_390px(self):
        self.assertEqual(self.decls_for(".turn-actions").get("flex-wrap"), "wrap")
        narrow = "@media (max-width: 390px)"
        stacked = [d for s, d, m in self.rules if m == narrow and s.strip() == ".turn-actions > *"]
        self.assertTrue(stacked)
        self.assertEqual(stacked[0]["flex"], "1 1 100%")

    def test_section_adds_no_motion(self):
        self.assertNotIn("@keyframes", self.section)
        for selector, decls, _ in self.rules:
            for key in decls:
                with self.subTest(selector=selector, key=key):
                    self.assertFalse(key.startswith("transition") or key.startswith("animation"))
                    self.assertNotEqual(key, "view-transition-name")

    def test_dark_blocks_agree_on_used_tokens(self):
        used = set(re.findall(r"var\((--[\w-]+)\)", self.section))
        for token in used:
            with self.subTest(token=token):
                self.assertEqual(resolve(token, *self.themes["dark"]), resolve(token, *self.themes["system-dark"]))

    def test_contrast_in_both_themes(self):
        # (앞 색, 뒤 색, 기준) — 모두 불투명 --surface 위에서 잰다. 반투명 토큰은 그 위에 섞어 잰다.
        pairs = [
            ("--text", "--surface", 4.5),           # 버튼 글자·버전 번호·편집 칸 글자
            ("--text-muted", "--surface", 4.5),     # 잠긴 버튼 글자
            ("--text", "--tint", 4.5),              # 버튼 hover
            ("--danger", "--surface", 4.5),         # 실패 문구와 경계
            ("--surface", "--accent", 4.5),         # 저장하고 묻기 글자
            ("--control-line", "--surface", 3.0),   # 버튼·편집 폼 경계
            ("--focus-ink", "--surface", 3.0),      # hover 경계
            ("--accent", "--surface", 3.0),         # 저장하고 묻기 경계
            ("--focus-ring", "--surface", 3.0),     # 초점 고리
        ]
        for theme in self.themes:
            for fg, bg, minimum in pairs:
                with self.subTest(theme=theme, fg=fg, bg=bg):
                    back = self.color(theme, bg)
                    self.assertEqual(back[3], 1.0, f"{bg}는 불투명해야 한다")
                    front = over(self.color(theme, fg), back[:3])
                    self.assertGreaterEqual(contrast(front, back[:3]), minimum)


if __name__ == "__main__":
    unittest.main()
