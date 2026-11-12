"""서버를 띄우지 않고 Render가 불러오는 앱에 직접 요청한다."""

import unittest

from api import serve
from api.demo_regulation import DOCUMENT_TITLE, EFFECTIVE_DATE, SOURCE
from api.tests.asgi_harness import call_app
from core.tests.retrieval_cases import CASES, CHUNK_PATHS, MISMATCH_QUERY, SOURCE as CASE_SOURCE

from app.main import app as default_app
from app.services.chat_stub import UNANSWERABLE_TEXT


class ServeTests(unittest.TestCase):
    def test_demo_source_matches_question_table(self):
        self.assertEqual(SOURCE, CASE_SOURCE)
        chunks = serve.chunk_articles(SOURCE, max_chars=serve.MAX_CHARS)
        self.assertEqual(tuple(chunk.article_path for chunk in chunks), CHUNK_PATHS)

    def test_empty_source_prevents_startup(self):
        with self.assertRaisesRegex(ValueError, "검색할 조각을 찾지 못했습니다"):
            serve.create_demo_app("")

    def test_deployed_app_cites_all_six_questions(self):
        self.assertEqual(len(CASES), 6)
        for case in CASES:
            with self.subTest(case=case.name):
                response = call_app(
                    serve.app, "POST", "/api/v1/chat", json_body={"message": case.query}
                )
                self.assertEqual(response.status, 200)
                body = response.json()
                self.assertIs(body["answered"], True)
                self.assertEqual(body["citations"], [{
                    "article_path": case.article_path,
                    "document": DOCUMENT_TITLE,
                    "effective_date": EFFECTIVE_DATE.isoformat(),
                    "snippet": case.quote,
                    "source_url": None,
                }])

    def test_deployed_app_returns_guidance_for_unmatched_question(self):
        response = call_app(
            serve.app, "POST", "/api/v1/chat", json_body={"message": MISMATCH_QUERY}
        )
        self.assertEqual(response.status, 200)
        body = response.json()
        self.assertIs(body["answered"], False)
        self.assertEqual(body["answer"], UNANSWERABLE_TEXT)
        self.assertEqual(body["citations"], [])

    def test_health_reports_each_apps_chunk_count(self):
        for application, expected_count in ((serve.app, 9), (default_app, 0)):
            with self.subTest(chunk_count=expected_count):
                response = call_app(application, "GET", "/api/v1/health")
                self.assertEqual(response.status, 200)
                self.assertEqual(response.json(), {
                    "status": "ok",
                    "index_loaded": expected_count > 0,
                    "chunk_count": expected_count,
                })
