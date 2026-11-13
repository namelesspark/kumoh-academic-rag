"""브라우저 채팅 화면과 화면에 필요한 파일을 서버가 제공하는지 확인함."""

import sys
import unittest
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
sys.path[:0] = [str(TESTS_DIR.parent), str(TESTS_DIR)]

from app.main import app
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
        self.assertIn('href="/chat-assets/chat.css"', response.text())
        self.assertIn('src="/chat-assets/chat.js"', response.text())

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
