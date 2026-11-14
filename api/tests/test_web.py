"""브라우저 채팅 화면과 화면에 필요한 파일을 서버가 제공하는지 확인함."""

import re
import sys
from hashlib import sha256
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

        # 밝은 상자 한 줄: 클립 버튼, 입력창, 보내기.
        self.assertEqual(ids("composer-row"), ["photo-attach", "question", "send"])
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
                          ("section", "chat")])

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
             ("p", "conversation-note", "대화 기록은 이 브라우저에만 저장돼요")])
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
        self.assertEqual(image["attrs"], {"src": MAIN_LETTERING, "alt": "물어봐요, 테크모"})

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
        self.assertEqual(next_sibling(announce)["tag"], "footer")
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
            "/chat-assets/kumoh-signature.png", "/chat-assets/kumoh-signature.png",
            MAIN_LETTERING, "/chat-assets/techmo-sprite.png",
        ])
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
        self.assertEqual(web_main.FINGERPRINTED_IMAGES, ("main-lettering.png",))
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

        def read(path):
            return b"fictional png bytes" if path.name == "main-lettering.png" else real_read(path)

        with patch.object(Path, "read_bytes", autospec=True, side_effect=read):
            self.assertEqual(web_main.read_prepared_images(),
                             {"main-lettering.png": b"fictional png bytes"})

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
