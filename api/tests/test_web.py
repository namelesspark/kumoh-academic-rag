"""브라우저 채팅 화면과 화면에 필요한 파일을 서버가 제공하는지 확인함."""

import sys
from hashlib import sha256
from html.parser import HTMLParser
import unittest
from pathlib import Path
from unittest.mock import patch

TESTS_DIR = Path(__file__).resolve().parent
sys.path[:0] = [str(TESTS_DIR.parent), str(TESTS_DIR)]

from app.main import app, CHAT_WEB_DIR, create_app, fingerprint_chat_assets
from asgi_harness import call_app


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
