"""브라우저 채팅 화면과 화면에 필요한 파일을 서버가 제공하는지 확인함."""

import sys
from hashlib import sha256
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
        self.assertIn("가상 학생 데이터", response.text())
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
