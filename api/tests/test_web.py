"""브라우저 채팅 화면과 화면에 필요한 파일을 서버가 제공하는지 확인함."""

import json
import re
import sys
from hashlib import sha256
from html import escape, unescape
from html.parser import HTMLParser
import unittest
from pathlib import Path
from unittest.mock import patch

TESTS_DIR = Path(__file__).resolve().parent
sys.path[:0] = [str(TESTS_DIR.parent), str(TESTS_DIR)]

from app import main as web_main
from app.main import app, CHAT_WEB_DIR, create_app, fingerprint_chat_assets
from asgi_harness import call_app


class Page(HTMLParser):
    """문서의 요소를 순서대로 모으고 부모와 자식을 이어 둔다 (표준 라이브러리 html.parser)."""

    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.elements = []
        self.open = []  # 아직 닫히지 않은 요소

    def _add(self, tag, attrs):
        node = {
            "tag": tag,
            "attrs": dict(attrs),
            "parent": self.open[-1] if self.open else None,
            "children": [],
            "text": "",
        }
        if node["parent"] is not None:
            node["parent"]["children"].append(node)
        self.elements.append(node)
        return node

    def handle_starttag(self, tag, attrs):
        node = self._add(tag, attrs)
        if tag not in self.VOID:
            self.open.append(node)

    def handle_startendtag(self, tag, attrs):
        # <path .../>처럼 스스로 닫는 요소는 열린 목록에 넣지 않는다.
        self._add(tag, attrs)

    def handle_endtag(self, tag):
        for position in range(len(self.open) - 1, -1, -1):
            if self.open[position]["tag"] == tag:
                del self.open[position:]
                return

    def handle_data(self, data):
        if self.open:
            self.open[-1]["text"] += data


def parse_page(html):
    page = Page()
    page.feed(html)
    page.close()
    return page


def read_index():
    return (CHAT_WEB_DIR / "index.html").read_text(encoding="utf-8")


def by_id(page, name):
    """id가 `name`인 요소 하나를 돌려준다. 없거나 둘 이상이면 실패한다."""
    found = [node for node in page.elements if node["attrs"].get("id") == name]
    if len(found) != 1:
        raise AssertionError(f'id="{name}"인 요소가 {len(found)}개입니다')
    return found[0]


def by_class(page, name):
    """class에 `name`이 든 요소 하나를 돌려준다. 없거나 둘 이상이면 실패한다."""
    found = [node for node in page.elements if name in (node["attrs"].get("class") or "").split()]
    if len(found) != 1:
        raise AssertionError(f'class="{name}"인 요소가 {len(found)}개입니다')
    return found[0]


def child_ids(node):
    return [child["attrs"].get("id") for child in node["children"]]


def next_sibling(node):
    siblings = node["parent"]["children"]
    at = [child is node for child in siblings].index(True)
    return siblings[at + 1] if at + 1 < len(siblings) else None


def image_addresses(page):
    return [node["attrs"].get("src") for node in page.elements if node["tag"] == "img"]


# 이슈 #88의 이름 표에 적힌 새 요소. 화면(`index.html`)과 스크립트(`chat.js`)가 함께 지킨다.
NEW_IDS = (
    "conversation-toggle", "home-button", "conversation-sidebar", "new-conversation",
    "conversation-close", "conversation-list", "clear-conversations", "conversation-backdrop",
    "main-title", "main-greeting", "conversation-toast", "conversation-toast-open",
    "conversation-toast-close", "conversation-announce",
)
NEW_BUTTON_IDS = (
    "conversation-toggle", "home-button", "new-conversation", "conversation-close",
    "clear-conversations", "conversation-toast-open", "conversation-toast-close",
)
MAIN_LETTERING = "/chat-assets/main-lettering.png"
LIGHT_LOGO = "/chat-assets/kumoh-signature-light.png"
TITLE_LETTERING = "/chat-assets/title-lettering.png"
# 이슈 #122: 제목 글자 그림의 언어별 주소. (그림 기본 주소, 속성 이름, 언어별 주소) 순서다.
LANGUAGE_LETTERINGS = (
    (TITLE_LETTERING, "data-lettering-en", "/chat-assets/title-lettering-en.png"),
    (TITLE_LETTERING, "data-lettering-zh", "/chat-assets/title-lettering-zh.png"),
    (MAIN_LETTERING, "data-lettering-en", "/chat-assets/main-lettering-en.png"),
    (MAIN_LETTERING, "data-lettering-zh", "/chat-assets/main-lettering-zh.png"),
)
LANGUAGE_LETTERING_NAMES = tuple(address.rsplit("/", 1)[1] for _, _, address in LANGUAGE_LETTERINGS)
# 이슈 #107의 교내 주요 사이트. (보이는 이름, 주소) 순서다.
CAMPUS_SITES = (
    ("학교 홈페이지", "https://www.kumoh.ac.kr/ko/index.do"),
    ("포털(Onekit)", "https://onekit.kumoh.ac.kr/"),
    ("BISKIT", "https://biskit.kumoh.ac.kr/"),
)
FOOTER_NOTE = "교내 대회 출품작 · 가상 학생 데이터로 동작하는 시연입니다"
# 이슈 #91의 테크모 칸 배치. 화면 담당과 함께 쓰는 값이라 글자 하나까지 같아야 한다.
TECHMO_LAYOUT_TEXT = ('{"version":1,"cell":192,"columns":8,"motions":[{"name":"idle","frames":8},'
                      '{"name":"guide","frames":6},{"name":"celebrate","frames":8},'
                      '{"name":"quiet","frames":4},{"name":"drag","frames":6}]}')


class TestChatWeb(unittest.TestCase):
    def test_root_serves_the_demo(self):
        response = call_app(app, "GET", "/", allow_wait=True)

        self.assertEqual(response.status, 200)
        self.assertTrue(response.headers["content-type"].startswith("text/html"))
        self.assertIn("frame-ancestors 'none'", response.headers["content-security-policy"])
        self.assertIn('lang="ko"', response.text())
        # 예전 안내 상자의 문구 대신, 화면에 남아 있는 하단 표시의 문구를 본다.
        self.assertIn("가상 학생 데이터입니다", response.text())
        self.assertIn('id="demo-login"', response.text())
        self.assertIn('id="demo-logout"', response.text())
        class PasswordFields(HTMLParser):
            def __init__(self):
                super().__init__()
                self.form_id = None
                self.fields = []

            def handle_starttag(self, tag, attrs):
                attributes = dict(attrs)
                if tag == "form":
                    self.form_id = attributes.get("id")
                if tag == "input" and attributes.get("type") == "password":
                    self.fields.append((self.form_id, attributes.get("autocomplete")))

            def handle_endtag(self, tag):
                if tag == "form":
                    self.form_id = None

        password_fields = PasswordFields()
        password_fields.feed(response.text())
        self.assertEqual(password_fields.fields, [("login-form", "off")])
        self.assertEqual(response.headers['cache-control'], 'no-cache')
        for name in ('chat.css', 'chat.js'):
            digest = sha256((CHAT_WEB_DIR / 'assets' / name).read_bytes()).hexdigest()
            self.assertIn(f'/chat-assets/{name}?v={digest}', response.text())

            async def versioned_request(scope, receive, send):
                scope['query_string'] = f'v={digest}'.encode('ascii')
                await app(scope, receive, send)

            asset = call_app(versioned_request, 'GET', f'/chat-assets/{name}', allow_wait=True)
            self.assertEqual(asset.status, 200)
            self.assertEqual(asset.headers['cache-control'], 'no-cache')

    def test_composer_keeps_one_input_row_and_a_hidden_file_input(self):
        # 색과 배치는 화면 테스트가 본다. 여기서는 index.html의 구조만 확인한다.
        class Composer(HTMLParser):
            """질문 입력 폼 안의 요소를 (부모 class, 태그, 속성) 순서대로 모은다."""

            VOID = {"input", "img", "br", "hr", "meta", "link"}

            def __init__(self):
                super().__init__()
                self.stack = []  # 폼 안에서 열려 있는 요소의 (태그, class)
                self.inside = False
                self.found = []

            def handle_starttag(self, tag, attrs):
                attributes = dict(attrs)
                if tag == "form" and attributes.get("id") == "composer":
                    self.inside = True
                    return
                if not self.inside:
                    return
                parent = self.stack[-1][1] if self.stack else "composer"
                self.found.append((parent, tag, attributes))
                if tag not in self.VOID:
                    self.stack.append((tag, attributes.get("class", tag)))

            def handle_endtag(self, tag):
                if not self.inside:
                    return
                if tag == "form":
                    self.inside = False
                elif self.stack and self.stack[-1][0] == tag:
                    self.stack.pop()

        composer = Composer()
        composer.feed((CHAT_WEB_DIR / "index.html").read_text(encoding="utf-8"))
        composer.close()

        def ids(parent):
            return [attributes.get("id") for owner, _, attributes in composer.found if owner == parent]

        by_id = {attributes["id"]: (owner, tag, attributes) for owner, tag, attributes in composer.found if "id" in attributes}

        # 밝은 상자 한 줄: 클립 버튼, 입력창, 답변 모드, 보내기.
        self.assertEqual(ids("composer-row"), ["photo-attach", "question", "ai-mode-button", "send"])
        # 상자 아래 묶음: 첨부 제거, 알림, 안내문 한 문단.
        self.assertEqual(ids("composer-meta"), ["photo-clear", "photo-note", "photo-hint"])
        # 폼 바로 아래에는 읽기용 라벨, 입력 줄, 숨긴 파일 입력, 아래 묶음만 있다.
        self.assertEqual(
            [(tag, attributes.get("class") or attributes.get("id")) for owner, tag, attributes in composer.found if owner == "composer"],
            [("label", "sr-only"), ("div", "composer-row"), ("input", "photo-file"), ("div", "composer-meta")],
        )

        _, tag, attach = by_id["photo-attach"]
        self.assertEqual((tag, attach.get("type"), attach.get("class")), ("button", "button", "attach-button"))
        self.assertEqual(attach.get("aria-label"), "사진 첨부")
        self.assertEqual(attach.get("aria-describedby"), "photo-hint")
        self.assertNotIn("data-action", attach)
        # 아이콘은 버튼 안에 직접 그린 선 그림 하나다. 그림 파일은 쓰지 않는다.
        self.assertEqual([tag for owner, tag, _ in composer.found if owner == "attach-button"], ["svg"])
        self.assertNotIn("img", [tag for _, tag, _ in composer.found])

        _, tag, mode = by_id["ai-mode-button"]
        self.assertEqual((tag, mode.get("type")), ("button", "button"))
        self.assertIn("mode-pill", mode.get("class", "").split())
        self.assertEqual(mode.get("data-mode"), "fast")
        self.assertEqual(mode.get("aria-haspopup"), "menu")
        self.assertEqual(mode.get("aria-expanded"), "false")
        self.assertEqual(mode.get("aria-label"), "답변 모드: 빠르게")
        mode_node = next(node for node in parse_page(read_index()).elements if node["attrs"].get("id") == "ai-mode-button")
        icons = [node for node in mode_node["children"] if node["tag"] == "svg"]
        self.assertEqual(len(icons), 3)
        self.assertEqual(
            {node["attrs"].get("data-icon") for node in icons if node["attrs"].get("data-icon")},
            {"fast", "deep"},
        )
        self.assertTrue(all(node["attrs"].get("aria-hidden") == "true" for node in icons))

        _, tag, file_input = by_id["photo-file"]
        self.assertEqual((tag, file_input.get("type"), file_input.get("accept")), ("input", "file", "image/jpeg,image/png"))
        self.assertIn("hidden", file_input)
        self.assertEqual(file_input.get("aria-describedby"), "photo-hint")

        self.assertEqual(by_id["photo-hint"][2].get("class"), "composer-hint")
        self.assertEqual([attributes.get("for") for _, tag, attributes in composer.found if tag == "label"], ["question"])
        self.assertEqual([tag for _, tag, _ in composer.found].count("p"), 2)
        for _, _, attributes in composer.found:
            self.assertNotIn("style", attributes)
            self.assertNotIn("attach-row", attributes.get("class", ""))

    def test_example_question_row_is_gone(self):
        # 서버가 내려 주는 첫 화면을 읽는다. 예시 질문 줄(#topics)은 이슈 #88에서 없앴다.
        html = call_app(app, "GET", "/", allow_wait=True).text()
        page = parse_page(html)

        for node in page.elements:
            self.assertNotIn(node["attrs"].get("id"), ("topics", "topics-label"))
            self.assertNotIn("topics", (node["attrs"].get("class") or "").split())
            self.assertNotIn("data-question", node["attrs"])
            self.assertNotEqual(node["attrs"].get("aria-labelledby"), "topics-label")
        for gone in ("예시 질문", "답변과 근거 조문", "근거를 찾지 못한 경우", "topics"):
            self.assertNotIn(gone, html)
        # 가상 규정의 질문 글도 화면에 남지 않는다. 서버의 가상 규정 검색은 따로 검사한다.
        for gone in ("달빛열람증", "얼룩말 풍금"):
            self.assertNotIn(gone, html)

    def test_masthead_starts_with_the_hidden_drawer_and_home_buttons(self):
        page = parse_page(read_index())
        inner = by_class(page, "masthead-inner")
        self.assertEqual([(child["tag"], child["attrs"].get("id") or child["attrs"].get("class"))
                          for child in inner["children"]],
                         [("button", "conversation-toggle"), ("h1", "brand"),
                          ("button", "home-button"), ("div", "masthead-actions")])

        toggle = by_id(page, "conversation-toggle")
        self.assertEqual(toggle["attrs"].get("aria-label"), "대화 목록")
        self.assertEqual(toggle["attrs"].get("aria-controls"), "conversation-sidebar")
        self.assertEqual(toggle["attrs"].get("aria-expanded"), "false")
        self.assertIn("hidden", toggle["attrs"])
        # 아이콘은 버튼 안에 직접 그린 선 그림 하나다. 이름은 aria-label이 준다.
        self.assertEqual([child["tag"] for child in toggle["children"]], ["svg"])
        self.assertEqual(toggle["children"][0]["attrs"].get("aria-hidden"), "true")
        self.assertEqual(toggle["text"].strip(), "")

        home = by_id(page, "home-button")
        self.assertEqual(home["text"].strip(), "홈")
        self.assertIn("hidden", home["attrs"])
        # 기존 「새 대화」 버튼은 자리와 이름을 지킨다. 채팅 화면에서 숨기는 일은 스크립트가 한다.
        reset = by_id(page, "reset")
        self.assertEqual(reset["text"].strip(), "새 대화")
        self.assertNotIn("hidden", reset["attrs"])

    def test_conversation_sidebar_and_backdrop_lead_the_layout(self):
        page = parse_page(read_index())
        layout = by_class(page, "layout")
        self.assertEqual(layout["tag"], "main")
        self.assertEqual([(child["tag"], child["attrs"].get("id") or child["attrs"].get("class"))
                          for child in layout["children"]],
                         [("aside", "conversation-sidebar"), ("div", "conversation-backdrop"),
                          ("section", "chat"), ("footer", "main-site-footer")])

        sidebar = by_id(page, "conversation-sidebar")
        self.assertEqual(sidebar["attrs"].get("aria-label"), "지난 대화")
        self.assertIn("hidden", sidebar["attrs"])
        self.assertEqual(
            [(child["tag"], child["attrs"].get("id") or child["attrs"].get("class"), child["text"].strip())
             for child in sidebar["children"]],
            [("button", "new-conversation", "새 대화"),
             ("button", "conversation-close", "닫기"),
             ("ul", "conversation-list", ""),
             ("button", "clear-conversations", "기록 모두 지우기"),
             ("p", "conversation-note", "대화 기록은 이 브라우저에만 저장돼요"),
             ("nav", "sidebar-campus-site-links", "")])
        # 목록 항목은 스크립트가 만든다. 처음 화면에는 지난 대화가 한 줄도 없다.
        self.assertEqual(by_id(page, "conversation-list")["children"], [])

        backdrop = by_id(page, "conversation-backdrop")
        self.assertIn("hidden", backdrop["attrs"])
        self.assertEqual((backdrop["children"], backdrop["text"].strip()), ([], ""))

        # 대화 영역의 뼈대는 그대로다. 입력 폼 바로 뒤가 대화 내용이다.
        self.assertEqual(child_ids(by_class(page, "chat")),
                         ["chat-heading", "composer", "transcript", None, "status"])
        self.assertEqual(child_ids(by_id(page, "transcript")), ["empty"])

    def test_main_title_is_one_lettering_slot_with_a_text_fallback(self):
        html = read_index()
        page = parse_page(html)
        welcome = by_class(page, "main-welcome")
        self.assertEqual([(child["tag"], child["attrs"].get("id")) for child in welcome["children"]],
                         [("h2", "main-title"), ("p", "main-greeting")])

        title = by_id(page, "main-title")
        slot, fallback = title["children"]
        self.assertEqual((slot["tag"], slot["attrs"].get("class")), ("span", "main-lettering"))
        self.assertIn("data-brand-slot", slot["attrs"])
        self.assertIn("hidden", slot["attrs"])
        (image,) = slot["children"]
        # 그림 크기는 배포 준비 때 정해지므로 가로·세로 값을 적지 않는다.
        # 영어·중국어 그림 주소는 data-lettering-*에 둔다. 바꿔 끼우는 일은 chat.js가 한다.
        self.assertEqual(image["attrs"], {"src": MAIN_LETTERING, "alt": "물어봐요, 테크모",
                                          "data-lettering-en": "/chat-assets/main-lettering-en.png",
                                          "data-lettering-zh": "/chat-assets/main-lettering-zh.png"})

        self.assertEqual((fallback["tag"], fallback["attrs"].get("class")),
                         ("span", "main-title-fallback"))
        self.assertEqual(fallback["text"], "물어봐요, ")
        self.assertEqual([(child["tag"], child["text"]) for child in fallback["children"]],
                         [("em", "테크모")])
        self.assertEqual(title["text"].strip(), "")

        # 인사 줄은 비운 채 시작한다. 로그인했을 때만 스크립트가 채운다.
        greeting = by_id(page, "main-greeting")
        self.assertEqual((greeting["children"], greeting["text"]), ([], ""))

        # 화면마다 h1은 하나씩이다. 글씨 그림 제목은 h2라 수가 늘지 않는다.
        self.assertEqual([node["attrs"].get("class") for node in page.elements if node["tag"] == "h1"],
                         ["title-fallback", "brand"])
        for gone in ("학사 안내를 둘러보세요", "궁금한 학사 정보를 테크모와 함께 찾아보세요",
                     "궁금한 학사 규정부터 캠퍼스 생활까지"):
            self.assertNotIn(gone, html)

    def test_both_logo_slots_use_the_light_logo_and_keep_a_text_fallback(self):
        page = parse_page(read_index())
        for slot_class, fallback_class in (("brand-logo", "brand-name"),
                                           ("login-brand", "login-brand-name")):
            with self.subTest(slot=slot_class):
                slot = by_class(page, slot_class)
                self.assertEqual(slot["tag"], "span")
                self.assertIn("data-brand-slot", slot["attrs"])
                self.assertIn("hidden", slot["attrs"])
                (image,) = slot["children"]
                self.assertEqual(image["attrs"], {"src": LIGHT_LOGO, "alt": "국립금오공과대학교",
                                                  "width": "782", "height": "113"})
                # 그림이 없을 때 보이는 글자가 바로 뒤에 있다.
                fallback = next_sibling(slot)
                self.assertEqual((fallback["tag"], fallback["attrs"].get("class")),
                                 ("span", fallback_class))
                self.assertEqual(fallback["text"].strip(), "금오공대 학사 안내")

    def assert_campus_links(self, nav):
        self.assertEqual(nav["tag"], "nav")
        self.assertEqual(nav["attrs"].get("aria-label"), "교내 주요 사이트")
        links = nav["children"]
        self.assertEqual([(link["text"], link["attrs"].get("href")) for link in links],
                         list(CAMPUS_SITES))
        for link in links:
            with self.subTest(href=link["attrs"].get("href")):
                self.assertEqual(link["tag"], "a")
                self.assertEqual(link["attrs"].get("class"), "campus-site-link")
                self.assertEqual(link["attrs"].get("target"), "_blank")
                self.assertEqual(link["attrs"].get("rel"), "noopener noreferrer")
                self.assertTrue(link["attrs"]["href"].startswith("https://"))
                hint, icon = link["children"]
                # 읽기 이름은 「학교 홈페이지 (새 창)」처럼 끝난다. 아이콘은 읽지 않는다.
                self.assertEqual((hint["tag"], hint["attrs"].get("class"), hint["text"]),
                                 ("span", "sr-only", " (새 창)"))
                self.assertEqual(icon["tag"], "svg")
                self.assertEqual(icon["attrs"].get("class"), "external-link-icon")
                self.assertEqual(icon["attrs"].get("aria-hidden"), "true")
                self.assertEqual(icon["attrs"].get("focusable"), "false")
                # 선으로만 그린다. 그림 파일이나 채운 도형은 쓰지 않는다.
                self.assertEqual(icon["attrs"].get("fill"), "none")
                self.assertEqual(icon["attrs"].get("stroke"), "currentColor")
                self.assertTrue(icon["children"])
                self.assertEqual({child["tag"] for child in icon["children"]}, {"path"})
                for child in icon["children"]:
                    self.assertNotIn("fill", child["attrs"])

    def assert_quicklink_carousel(self, nav, nav_id):
        # 이슈 #122: 로그인·메인 바닥의 링크 줄은 넘겨 보는 묶음이 됐다. 카드는 chat.js가 그린다.
        self.assertEqual(nav["tag"], "nav")
        self.assertEqual(nav["attrs"].get("class"), "quicklink-carousel")
        self.assertEqual(nav["attrs"].get("id"), nav_id)
        self.assertEqual(nav["attrs"].get("aria-label"), "교내 주요 사이트")
        self.assertIn("data-quicklink-carousel", nav["attrs"])
        self.assertEqual([(child["tag"], child["attrs"].get("class")) for child in nav["children"]],
                         [("button", "quicklink-nav quicklink-prev"), ("div", "quicklink-viewport"),
                          ("button", "quicklink-nav quicklink-next")])
        previous, viewport, following = nav["children"]
        for button, label in ((previous, "이전 사이트 보기"), (following, "다음 사이트 보기")):
            with self.subTest(button=label):
                self.assertEqual(button["attrs"].get("type"), "button")
                self.assertEqual(button["attrs"].get("aria-label"), label)
                # 넘길 카드가 생기기 전에는 숨기고, 눌러도 아무 일이 없다고 알린다.
                self.assertEqual(button["attrs"].get("aria-disabled"), "true")
                self.assertIn("hidden", button["attrs"])
                self.assertEqual([child["tag"] for child in button["children"]], ["svg"])
                self.assertEqual(button["children"][0]["attrs"].get("aria-hidden"), "true")
                self.assertEqual(button["text"].strip(), "")
        (track,) = viewport["children"]
        self.assertEqual((track["tag"], track["attrs"].get("class")), ("ul", "quicklink-track"))
        self.assertEqual((track["children"], track["text"].strip()), ([], ""))

    def descendants(self, node):
        for child in node["children"]:
            yield child
            yield from self.descendants(child)

    def test_login_and_main_footers_carry_the_campus_links_and_the_demo_note(self):
        page = parse_page(read_index())
        for screen_id, footer_id, nav_id in (
            ("login-screen", "login-site-footer", "login-campus-site-links"),
            ("main-screen", "main-site-footer", "main-campus-site-links"),
        ):
            with self.subTest(footer=footer_id):
                footer = by_id(page, footer_id)
                self.assertEqual((footer["tag"], footer["attrs"].get("class")), ("footer", "site-footer"))
                # 로그인 바닥은 로그인 화면의, 메인 바닥은 큰 판의 마지막 자식이다.
                parent = by_id(page, screen_id) if screen_id == "login-screen" else by_class(page, "layout")
                self.assertIs(parent["children"][-1], footer)
                self.assertEqual([(child["tag"], child["attrs"].get("id") or child["attrs"].get("class"))
                                  for child in footer["children"]],
                                 [("p", "campus-site-label"), ("nav", nav_id), ("p", "site-footer-note")])
                label, nav, note = footer["children"]
                self.assertEqual(label["text"], "교내 주요 사이트")
                self.assertEqual(note["text"], FOOTER_NOTE)
                self.assert_quicklink_carousel(nav, nav_id)
                # 처음 화면의 바닥에는 링크가 없다. 사이트 카드는 스크립트가 채운다.
                self.assertFalse([node for node in self.descendants(footer) if node["tag"] == "a"])
        # 바닥은 두 곳뿐이다. 메인 화면 끝에 따로 떠 있던 바닥은 지웠다.
        footers = [node for node in page.elements if node["tag"] == "footer"]
        self.assertEqual([node["attrs"].get("id") for node in footers],
                         ["login-site-footer", "main-site-footer"])
        main_screen = by_id(page, "main-screen")
        self.assertFalse([node for node in footers if node["parent"] is main_screen])

    def test_sidebar_ends_with_one_compact_line_of_campus_links(self):
        page = parse_page(read_index())
        nav = by_id(page, "sidebar-campus-site-links")
        self.assertIs(by_id(page, "conversation-sidebar")["children"][-1], nav)
        self.assertIs(next_sibling(by_class(page, "conversation-note")), nav)
        self.assertEqual(nav["attrs"].get("class"), "campus-site-links campus-site-links--compact")
        self.assert_campus_links(nav)
        # 세 묶음은 같은 이름으로 불린다. 처음 화면의 링크는 사이드바의 세 개뿐이다.
        navs = [node for node in page.elements if node["tag"] == "nav"]
        self.assertEqual([node["attrs"].get("id") for node in navs],
                         ["login-campus-site-links", "sidebar-campus-site-links", "main-campus-site-links"])
        self.assertEqual({node["attrs"].get("aria-label") for node in navs}, {"교내 주요 사이트"})
        links = [node for node in page.elements if node["tag"] == "a"]
        self.assertEqual(len(links), 3)
        self.assertTrue(all(link["parent"] is nav for link in links))

    def test_reply_toast_follows_the_pet_and_the_announcer_is_always_present(self):
        page = parse_page(read_index())
        toast = next_sibling(by_id(page, "pet-dock"))
        self.assertEqual((toast["tag"], toast["attrs"].get("id")), ("div", "conversation-toast"))
        self.assertIn("hidden", toast["attrs"])
        self.assertEqual(child_ids(toast), ["conversation-toast-open", "conversation-toast-close"])
        # 글귀는 스크립트가 채운다.
        opener = by_id(page, "conversation-toast-open")
        self.assertEqual((opener["children"], opener["text"].strip()), ([], ""))
        close = by_id(page, "conversation-toast-close")
        self.assertEqual(close["attrs"].get("aria-label"), "알림 닫기")
        self.assertEqual([child["tag"] for child in close["children"]], ["svg"])
        # 숨겼다 보이는 알림은 읽기 도구가 놓치기 쉽다. 읽어 주는 자리는 숨기지 않고 따로 둔다.
        self.assertNotIn("role", toast["attrs"])
        self.assertNotIn("aria-live", toast["attrs"])

        announce = next_sibling(toast)
        self.assertEqual((announce["tag"], announce["attrs"]),
                         ("p", {"class": "sr-only", "id": "conversation-announce", "role": "status"}))
        self.assertEqual((announce["children"], announce["text"]), ([], ""))
        # 예전 바닥은 큰 판 안으로 옮겼다. 알림 자리가 메인 화면의 마지막 요소다.
        self.assertIsNone(next_sibling(announce))
        self.assertIs(announce["parent"], by_id(page, "main-screen"))
        # 브라우저 알림 권한은 쓰지 않는다.
        self.assertNotIn("Notification", read_index())

    def test_new_elements_have_unique_ids_and_plain_buttons(self):
        page = parse_page(read_index())
        ids = [node["attrs"]["id"] for node in page.elements if "id" in node["attrs"]]
        self.assertEqual(sorted(set(ids)), sorted(ids))
        for name in NEW_IDS:
            self.assertEqual(ids.count(name), 1, name)
        for name in NEW_BUTTON_IDS:
            with self.subTest(name=name):
                button = by_id(page, name)
                self.assertEqual((button["tag"], button["attrs"].get("type")), ("button", "button"))
                # 요청 중에 함께 잠기는 표시를 주지 않는다. 다른 대화의 답을 기다리는 동안에도 눌려야 한다.
                self.assertNotIn("data-action", button["attrs"])
                self.assertNotIn("disabled", button["attrs"])
        # 서랍 버튼이 가리키는 요소가 실제로 있다.
        for node in page.elements:
            target = node["attrs"].get("aria-controls")
            if target is not None:
                self.assertIn(target, ids)

    def test_helpers_notice_a_moved_or_doubled_element(self):
        # 위 검사가 자리를 실제로 구분하는지, 요소를 옮긴 가상 화면으로 확인한다.
        html = read_index()
        toast = re.findall(r'[ \t]*<div class="conversation-toast".*?</div>\n', html, flags=re.DOTALL)
        self.assertEqual(len(toast), 1)
        without = html.replace(toast[0], "")
        self.assertEqual(len(without), len(html) - len(toast[0]))
        moved = parse_page(without)
        self.assertNotEqual(next_sibling(by_id(moved, "pet-dock"))["attrs"].get("id"), "conversation-toast")
        with self.assertRaises(AssertionError):
            by_id(moved, "conversation-toast")
        with self.assertRaises(AssertionError):
            by_id(parse_page(html.replace(toast[0], toast[0] + toast[0])), "conversation-toast")

    def test_screen_requests_exactly_these_images_in_order(self):
        page = parse_page(read_index())
        self.assertEqual(image_addresses(page), [
            "/chat-assets/title-lettering.png", "/chat-assets/techmo-sprite.png",
            LIGHT_LOGO, LIGHT_LOGO, MAIN_LETTERING, "/chat-assets/techmo-sprite.png",
        ])
        # 판에 담던 원래 로고는 화면이 더 요청하지 않는다. 서버는 그대로 내준다.
        self.assertNotIn("/chat-assets/kumoh-signature.png", image_addresses(page))
        # 그림은 모두 숨긴 그림 자리 바로 안에 있다. 로드에 성공해야 스크립트가 자리를 보인다.
        for node in page.elements:
            if node["tag"] == "img":
                self.assertIn("data-brand-slot", node["parent"]["attrs"])
                self.assertIn("hidden", node["parent"]["attrs"])
                self.assertIs(node["parent"]["children"][0], node)
                self.assertIn(node["attrs"]["src"].rsplit("/", 1)[1], web_main.CHAT_WEB_MEDIA_TYPES)

    def test_main_lettering_address_is_fingerprinted_only_when_prepared(self):
        png = b"fictional png bytes"
        digest = sha256(png).hexdigest()
        with patch.object(web_main, "read_prepared_images", return_value={"main-lettering.png": png}):
            html = call_app(create_app(), "GET", "/", allow_wait=True).text()
        self.assertEqual(image_addresses(parse_page(html)).count(f"{MAIN_LETTERING}?v={digest}"), 1)
        self.assertNotIn(f'"{MAIN_LETTERING}"', html)
        # 다른 그림 주소에는 지문을 붙이지 않는다.
        self.assertEqual(html.count("?v="), 3)

        with patch.object(web_main, "read_prepared_images", return_value={}):
            html = call_app(create_app(), "GET", "/", allow_wait=True).text()
        self.assertEqual(image_addresses(parse_page(html)).count(MAIN_LETTERING), 1)
        self.assertEqual(html.count("?v="), 2)

    def test_light_logo_addresses_are_fingerprinted_only_when_prepared(self):
        png = b"fictional light logo bytes"
        digest = sha256(png).hexdigest()
        with patch.object(web_main, "read_prepared_images",
                          return_value={"kumoh-signature-light.png": png}):
            html = call_app(create_app(), "GET", "/", allow_wait=True).text()
        # 상단 띠와 로그인 카드, 두 자리 모두 같은 지문이 붙는다.
        self.assertEqual(image_addresses(parse_page(html)).count(f"{LIGHT_LOGO}?v={digest}"), 2)
        self.assertNotIn(f'"{LIGHT_LOGO}"', html)
        self.assertEqual(html.count("?v="), 4)

        with patch.object(web_main, "read_prepared_images", return_value={}):
            html = call_app(create_app(), "GET", "/", allow_wait=True).text()
        self.assertEqual(image_addresses(parse_page(html)).count(LIGHT_LOGO), 2)
        self.assertEqual(html.count("?v="), 2)

    def test_image_fingerprint_depends_on_content_and_leaves_other_addresses(self):
        html = ('<img src="/chat-assets/main-lettering.png" alt="">'
                '<img src="/chat-assets/main-lettering.png.bak" alt="">'
                '<img src="/chat-assets/title-lettering.png" alt="">')
        first = web_main.fingerprint_prepared_images(html, {"main-lettering.png": b"fictional one"})
        second = web_main.fingerprint_prepared_images(html, {"main-lettering.png": b"fictional two"})
        self.assertNotEqual(first, second)
        for result, content in ((first, b"fictional one"), (second, b"fictional two")):
            self.assertIn(f'"{MAIN_LETTERING}?v={sha256(content).hexdigest()}"', result)
            self.assertEqual(result.count("?v="), 1)
            self.assertIn('"/chat-assets/main-lettering.png.bak"', result)
            self.assertIn('"/chat-assets/title-lettering.png"', result)
        # 준비된 그림이 없거나 화면에 주소가 없으면 그대로 돌려주고 멈추지 않는다.
        self.assertEqual(web_main.fingerprint_prepared_images(html, {}), html)
        self.assertEqual(web_main.fingerprint_prepared_images("", {"main-lettering.png": b"fictional"}), "")

    def test_missing_or_unreadable_lettering_does_not_stop_startup(self):
        self.assertEqual(web_main.FINGERPRINTED_IMAGES,
                         ("main-lettering.png", "kumoh-signature-light.png",
                          "title-lettering-en.png", "main-lettering-en.png",
                          "title-lettering-zh.png", "main-lettering-zh.png"))
        real_read = Path.read_bytes
        target = CHAT_WEB_DIR / "assets" / "main-lettering.png"
        for failure in (FileNotFoundError(2, "fictional missing"), PermissionError(13, "fictional denied")):
            with self.subTest(failure=type(failure).__name__):
                asked = []

                def read(path):
                    if path.name == "main-lettering.png":
                        asked.append(path)
                        raise failure
                    return real_read(path)

                with patch.object(Path, "read_bytes", autospec=True, side_effect=read):
                    self.assertEqual(web_main.read_prepared_images(), {})
                    application = create_app()
                self.assertEqual(asked, [target, target])
                page = call_app(application, "GET", "/", allow_wait=True)
                self.assertEqual(page.status, 200)
                self.assertIn(f'src="{MAIN_LETTERING}"', page.text())
                with patch.object(Path, "is_file", return_value=False):
                    image = call_app(application, "GET", MAIN_LETTERING, allow_wait=True)
                self.assertEqual(image.status, 404)
                self.assertEqual(image.headers["cache-control"], "no-cache")

    def test_prepared_lettering_bytes_are_read_from_the_assets_folder(self):
        real_read = Path.read_bytes

        asked = []

        def read(path):
            if path.name in web_main.FINGERPRINTED_IMAGES:
                asked.append(path)
                return f"fictional {path.name}".encode()
            return real_read(path)

        with patch.object(Path, "read_bytes", autospec=True, side_effect=read):
            self.assertEqual(web_main.read_prepared_images(),
                             {"main-lettering.png": b"fictional main-lettering.png",
                              "kumoh-signature-light.png": b"fictional kumoh-signature-light.png",
                              "title-lettering-en.png": b"fictional title-lettering-en.png",
                              "main-lettering-en.png": b"fictional main-lettering-en.png",
                              "title-lettering-zh.png": b"fictional title-lettering-zh.png",
                              "main-lettering-zh.png": b"fictional main-lettering-zh.png"})
        self.assertEqual(asked, [CHAT_WEB_DIR / "assets" / name for name in web_main.FINGERPRINTED_IMAGES])

    def test_language_letterings_are_served_as_png_and_missing_file_is_404(self):
        served = []

        def memory_response(path, *, media_type, headers):
            served.append(path.name)
            return web_main.Response(content=f"fictional {path.name}".encode(),
                                     media_type=media_type, headers=headers)

        for name in LANGUAGE_LETTERING_NAMES:
            with self.subTest(name=name):
                with patch.object(Path, "is_file", return_value=False):
                    response = call_app(web_main.app, "GET", f"/chat-assets/{name}", allow_wait=True)
                self.assertEqual(response.status, 404)
                self.assertEqual(response.headers["cache-control"], "no-cache")
                with (
                    patch.object(Path, "is_file", return_value=True),
                    patch.object(web_main, "FileResponse", side_effect=memory_response),
                ):
                    response = call_app(web_main.app, "GET", f"/chat-assets/{name}", allow_wait=True)
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers["content-type"], "image/png")
                self.assertEqual(response.body, f"fictional {name}".encode())
                self.assertEqual(response.headers["cache-control"], "no-cache")
        self.assertEqual(served, list(LANGUAGE_LETTERING_NAMES))

    def test_language_lettering_addresses_are_fingerprinted_only_when_prepared(self):
        prepared = {name: f"fictional {name} bytes".encode() for name in LANGUAGE_LETTERING_NAMES}

        def lettering_attrs(html):
            images = {node["attrs"].get("src"): node["attrs"]
                      for node in parse_page(html).elements if node["tag"] == "img"}
            return [images[src].get(attribute) for src, attribute, _ in LANGUAGE_LETTERINGS]

        with patch.object(web_main, "read_prepared_images", return_value=prepared):
            html = call_app(create_app(), "GET", "/", allow_wait=True).text()
        # 그림마다 제 내용의 지문이 붙는다. 기본 그림 주소는 준비되지 않았으니 그대로다.
        self.assertEqual(lettering_attrs(html),
                         [f"{address}?v={sha256(prepared[address.rsplit('/', 1)[1]]).hexdigest()}"
                          for _, _, address in LANGUAGE_LETTERINGS])
        for _, _, address in LANGUAGE_LETTERINGS:
            self.assertNotIn(f'"{address}"', html)
        self.assertEqual(image_addresses(parse_page(html)).count(TITLE_LETTERING), 1)
        self.assertEqual(image_addresses(parse_page(html)).count(MAIN_LETTERING), 1)
        # 스타일·스크립트 두 개에 언어별 그림 네 개가 더해진다.
        self.assertEqual(html.count("?v="), 6)

        with patch.object(web_main, "read_prepared_images", return_value={}):
            html = call_app(create_app(), "GET", "/", allow_wait=True).text()
        self.assertEqual(lettering_attrs(html), [address for _, _, address in LANGUAGE_LETTERINGS])
        self.assertEqual(html.count("?v="), 2)

    def test_language_lettering_names_are_served_and_fingerprinted(self):
        page = parse_page(read_index())
        found = [(node["attrs"].get("src"), name, value)
                 for node in page.elements if node["tag"] == "img"
                 for name, value in node["attrs"].items() if name.startswith("data-lettering-")]
        self.assertEqual(sorted(found), sorted(LANGUAGE_LETTERINGS))
        for _, _, address in found:
            with self.subTest(address=address):
                self.assertTrue(address.startswith("/chat-assets/"))
                name = address.rsplit("/", 1)[1]
                self.assertEqual(web_main.CHAT_WEB_MEDIA_TYPES.get(name), "image/png")
                self.assertIn(name, web_main.FINGERPRINTED_IMAGES)

    def test_language_pills_sit_in_the_masthead_and_on_the_login_screen(self):
        # 이슈 #116: 기본 드롭다운(select) 없이 지구본·현재 언어·꺾쇠 알약 두 개가 같은 메뉴를 연다.
        page = parse_page(read_index())
        self.assertFalse([node for node in page.elements if node["tag"] == "select"])
        login = by_id(page, "login-lang-button")
        header = by_id(page, "lang-button")
        self.assertIs(by_id(page, "login-screen")["children"][0], login)
        self.assertIs(by_class(page, "masthead-actions")["children"][0], header)
        for button in (login, header):
            with self.subTest(button=button["attrs"]["id"]):
                attrs = button["attrs"]
                self.assertEqual((button["tag"], attrs.get("type")), ("button", "button"))
                self.assertIn("lang-pill", attrs.get("class", "").split())
                self.assertEqual(attrs.get("aria-haspopup"), "menu")
                self.assertEqual(attrs.get("aria-expanded"), "false")
                self.assertEqual(attrs.get("aria-label"), "언어 / Language: 한국어")
                self.assertNotIn("aria-controls", attrs)
                self.assertNotIn("data-action", attrs)
                globe, label, chevron = button["children"]
                self.assertEqual((globe["tag"], globe["attrs"].get("class"), globe["attrs"].get("aria-hidden")),
                                 ("svg", "lang-pill-globe", "true"))
                self.assertEqual((label["tag"], label["attrs"].get("class"), label["text"]),
                                 ("span", "lang-pill-label", "한국어"))
                self.assertEqual((chevron["tag"], chevron["attrs"].get("class"), chevron["attrs"].get("aria-hidden")),
                                 ("svg", "lang-pill-chevron", "true"))
        # 첫 화면은 한국어 문서다. 다른 언어는 chat.js가 html lang과 함께 바꾼다.
        self.assertIn('<html lang="ko">', read_index())

    def test_page_has_no_folding_box_hint_line_or_style_attribute(self):
        html = call_app(app, "GET", "/", allow_wait=True).text()
        page = parse_page(html)

        self.assertTrue(page.elements)
        tags = {node["tag"] for node in page.elements}
        for banned in ("details", "summary", "dialog"):
            self.assertNotIn(banned, tags)
        for node in page.elements:
            self.assertNotIn("style", node["attrs"])
            self.assertNotIn("empty-hint", (node["attrs"].get("class") or "").split())
        self.assertNotIn("empty-hint", html)

        # 접는 상자가 없으므로 스크립트도 여닫는 속성을 건드리지 않는다.
        script = call_app(app, "GET", "/chat-assets/chat.js", allow_wait=True)
        self.assertEqual(script.status, 200)
        self.assertNotIn("topics.open", script.text())

    def test_fingerprints_depend_on_each_content(self):
        html = '/chat-assets/chat.css /chat-assets/chat.js'
        first = fingerprint_chat_assets(html, b'fictional css', b'fictional js')
        second = fingerprint_chat_assets(html, b'changed css', b'fictional js')
        self.assertNotEqual(first.split()[0], second.split()[0])
        self.assertEqual(first.split()[1], second.split()[1])
        third = fingerprint_chat_assets(html, b'fictional css', b'changed js')
        self.assertNotEqual(first.split()[1], third.split()[1])

    def test_invalid_asset_references_fail_at_startup(self):
        for html in ('', '/chat-assets/chat.css', '/chat-assets/chat.js',
                     '/chat-assets/chat.css /chat-assets/chat.js /chat-assets/chat.css',
                     '/chat-assets/chat.css /chat-assets/chat.js /chat-assets/chat.js'):
            with self.subTest(html=html), patch.object(Path, 'read_text', return_value=html):
                with self.assertRaises(ValueError):
                    create_app()

    def test_techmo_layout_is_injected_once_into_the_pet_dock(self):
        raw = read_index()
        # 자리는 #pet-dock 여는 태그의 맨 끝에 한 번만 있다.
        self.assertEqual(raw.count(web_main.TECHMO_LAYOUT_SLOT), 1)
        self.assertIn('<div class="pet-dock" id="pet-dock" data-pose="guide" data-state="idle" '
                      'data-techmo-layout="__TECHMO_LAYOUT__">', raw)

        layout_text = (CHAT_WEB_DIR / web_main.TECHMO_LAYOUT_FILE).read_text(encoding="utf-8").strip()
        self.assertEqual(layout_text, TECHMO_LAYOUT_TEXT)
        html = call_app(app, "GET", "/", allow_wait=True).text()
        self.assertNotIn(web_main.TECHMO_LAYOUT_SLOT, html)
        # 따옴표를 바꿔 넣었으므로 속성 값이 중간에 끊기지 않는다.
        self.assertEqual(html.count(f'data-techmo-layout="{escape(layout_text, quote=True)}">'), 1)
        self.assertEqual(html.count("data-techmo-layout"), 1)
        dock = by_id(parse_page(html), "pet-dock")
        # 브라우저가 읽는 값은 파일의 글과 같다.
        self.assertEqual(dock["attrs"]["data-techmo-layout"], layout_text)
        self.assertEqual(json.loads(dock["attrs"]["data-techmo-layout"]), {
            "version": 1, "cell": 192, "columns": 8,
            "motions": [{"name": "idle", "frames": 8}, {"name": "guide", "frames": 6},
                        {"name": "celebrate", "frames": 8}, {"name": "quiet", "frames": 4},
                        {"name": "drag", "frames": 6}],
        })
        # 기존 속성과 중첩 구조는 그대로다.
        self.assertEqual((dock["attrs"]["class"], dock["attrs"]["data-pose"], dock["attrs"]["data-state"]),
                         ("pet-dock", "guide", "idle"))
        self.assertEqual([(child["tag"], child["attrs"].get("class")) for child in dock["children"]],
                         [("p", "pet-says"), ("button", "pet")])

    def test_pet_button_is_named_for_starting_a_new_conversation(self):
        html = call_app(app, "GET", "/", allow_wait=True).text()
        pet = by_id(parse_page(html), "pet")
        self.assertEqual((pet["tag"], pet["attrs"].get("type")), ("button", "button"))
        self.assertEqual(pet["attrs"].get("aria-label"), "테크모 · 새 대화 시작")
        self.assertEqual(html.count('aria-label="테크모 · 새 대화 시작"'), 1)
        self.assertNotIn("테크모에게 묻기", html)
        # 그림과 안쪽 요소는 손대지 않았다.
        image, floater = pet["children"]
        self.assertEqual(image["attrs"], {"src": "/chat-assets/techmo-sprite.png", "alt": "",
                                          "width": "960", "height": "192"})
        self.assertEqual(floater["attrs"].get("class"), "pet-float")
        self.assertNotIn("data-action", pet["attrs"])

    def test_layout_text_is_escaped_as_an_attribute_value(self):
        layout = TECHMO_LAYOUT_TEXT
        result = web_main.inject_techmo_layout('<i data-x="__TECHMO_LAYOUT__">', layout + "\n")
        self.assertEqual(result, '<i data-x="' + layout.replace('"', "&quot;") + '">')
        self.assertNotIn('"version"', result)
        self.assertEqual(unescape(result), f'<i data-x="{layout}">')

    def test_missing_or_doubled_layout_slot_stops_startup(self):
        layout = TECHMO_LAYOUT_TEXT
        for html in ("", "<p></p>", "__TECHMO_LAYOUT__ __TECHMO_LAYOUT__"):
            with self.subTest(html=html), self.assertRaises(ValueError):
                web_main.inject_techmo_layout(html, layout)
        # 실제 시작 경로에서도 멈춘다. 화면 파일만 가상 내용으로 바꾼다.
        real_read = Path.read_text
        raw = read_index()

        def without_slot(path, *args, **kwargs):
            text = real_read(path, *args, **kwargs)
            return text.replace(' data-techmo-layout="__TECHMO_LAYOUT__"', "") if path.name == "index.html" else text

        def with_two_slots(path, *args, **kwargs):
            text = real_read(path, *args, **kwargs)
            return text + "<!-- __TECHMO_LAYOUT__ -->" if path.name == "index.html" else text

        for reader in (without_slot, with_two_slots):
            with self.subTest(reader=reader.__name__):
                with patch.object(Path, "read_text", autospec=True, side_effect=reader):
                    with self.assertRaises(ValueError):
                        create_app()
        self.assertEqual(read_index(), raw)

    def test_broken_layout_file_stops_startup(self):
        good = TECHMO_LAYOUT_TEXT
        self.assertEqual(web_main.parse_techmo_layout(good)["columns"], 8)
        broken = (
            "", "not json", "[]", "null",
            good.replace('"version":1', '"version":2'),
            good.replace('"version":1', '"version":true'),
            good.replace('"cell":192', '"cell":0'),
            good.replace('"cell":192', '"cell":-192'),
            good.replace('"cell":192', '"cell":192.5'),
            good.replace('"columns":8', '"columns":"8"'),
            # 프레임 수가 한 줄의 칸 수를 넘는다.
            good.replace('"columns":8', '"columns":7'),
            good.replace('"frames":4', '"frames":0'),
            good.replace('"frames":4', '"frames":9'),
            good.replace('"frames":4', '"frames":"4"'),
            # 이름이 겹치거나 비었다.
            good.replace('"name":"guide"', '"name":"idle"'),
            good.replace('"name":"guide"', '"name":""'),
            good.replace('"name":"guide"', '"name":7'),
            good.replace('"motions":[', '"other":['),
            good.replace('"version":1,', '"version":1,"extra":1,'),
            good.replace('{"name":"idle","frames":8}', '{"name":"idle","frames":8,"extra":1}'),
            good.replace('{"name":"idle","frames":8}', '"idle"'),
            '{"version":1,"cell":192,"columns":8,"motions":[]}',
            '{"version":1,"cell":192,"columns":8,"motions":{}}',
        )
        for text in broken:
            with self.subTest(text=text[:48]):
                self.assertNotEqual(text, good)
                with self.assertRaises(ValueError):
                    web_main.parse_techmo_layout(text)
                with self.assertRaises(ValueError):
                    web_main.inject_techmo_layout("__TECHMO_LAYOUT__", text)
        real_read = Path.read_text

        def read(path, *args, **kwargs):
            if path.name == web_main.TECHMO_LAYOUT_FILE:
                return broken[4]
            return real_read(path, *args, **kwargs)

        with patch.object(Path, "read_text", autospec=True, side_effect=read):
            with self.assertRaises(ValueError):
                create_app()

    def test_layout_file_is_not_served_and_page_headers_are_unchanged(self):
        self.assertNotIn(web_main.TECHMO_LAYOUT_FILE, web_main.CHAT_WEB_MEDIA_TYPES)
        self.assertFalse([name for name in web_main.CHAT_WEB_MEDIA_TYPES if name.endswith(".json")])
        # 허용 목록에 없는 이름은 디스크를 보지 않고 404로 답한다.
        with patch.object(Path, "is_file", side_effect=AssertionError("읽으면 안 됨")):
            for name in (web_main.TECHMO_LAYOUT_FILE, "techmo-layout.json", "TECHMO_LAYOUT.JSON"):
                with self.subTest(name=name):
                    response = call_app(app, "GET", f"/chat-assets/{name}", allow_wait=True)
                    self.assertEqual(response.status, 404)
                    self.assertEqual(response.headers["cache-control"], "no-cache")
        page = call_app(app, "GET", "/", allow_wait=True)
        self.assertEqual(page.headers["content-security-policy"],
                         "default-src 'self'; object-src 'none'; base-uri 'none'; "
                         "frame-ancestors 'none'; form-action 'self'")
        self.assertEqual(page.headers["x-content-type-options"], "nosniff")
        self.assertEqual(page.headers["cache-control"], "no-cache")
        # 문서 안 style 속성과 <style>, 문서 안 스크립트는 여전히 없다.
        parsed = parse_page(page.text())
        for node in parsed.elements:
            self.assertNotIn("style", node["attrs"])
            self.assertNotEqual(node["tag"], "style")
            if node["tag"] == "script":
                self.assertIn("src", node["attrs"])
                self.assertEqual(node["text"].strip(), "")

    def test_asset_routes_serve_the_chat_styles_and_script(self):
        assets = {
            "/chat-assets/chat.css": {"text/css"},
            "/chat-assets/chat.js": {"text/javascript", "application/javascript"},
        }
        for path, media_types in assets.items():
            with self.subTest(path=path):
                response = call_app(app, "GET", path, allow_wait=True)

                self.assertEqual(response.status, 200)
                self.assertIn(response.headers["content-type"].split(";")[0], media_types)
                self.assertTrue(response.body)
                self.assertEqual(response.headers['cache-control'], 'no-cache')
