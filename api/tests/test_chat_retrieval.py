"""가상 규정 검색 결과가 채팅 인용으로 전달되는지 확인한다."""

import ast
import sys
import unittest
from datetime import date
from pathlib import Path

from api.tests.asgi_harness import call_app
from core.tests.retrieval_cases import CASES, MAX_CHARS, MISMATCH_QUERY, SOURCE

API_DIR = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(API_DIR), str(API_DIR.parent / "core" / "src")]

from app.main import create_app
from app.services.chat_retrieval import ChatRetrieval
from app.services.chat_stub import (
    ANSWERED_TEXT,
    FICTIONAL_CITATION,
    FICTIONAL_QUESTION,
    UNANSWERABLE_TEXT,
)
from kumoh_rag_core.chunking import chunk_articles
from kumoh_rag_core.retrieval import BM25Retriever


CHAT = "/api/v1/chat"
DOCUMENT = "가상 구름 도서관 규정"
EFFECTIVE_DATE = date(2099, 2, 3)
SOURCE_URL = "https://example.invalid/regulations/cloud-library"


class ChatRetrievalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        retriever = BM25Retriever(chunk_articles(SOURCE, max_chars=MAX_CHARS))
        cls.retrieval = ChatRetrieval(
            search=retriever.retrieve,
            source=SOURCE,
            document_title=DOCUMENT,
            effective_date=EFFECTIVE_DATE,
            source_url=SOURCE_URL,
        )

    def post_chat(self, app, question):
        response = call_app(app, "POST", CHAT, json_body={"message": question})
        self.assertEqual(response.status, 200)
        return response.json()

    def test_top_ranked_article_cites_verbatim_source_and_metadata(self):
        app = create_app(chat_retrieval=self.retrieval)

        for case in CASES:
            with self.subTest(case=case.name):
                body = self.post_chat(app, case.query)

                self.assertTrue(body["answered"])
                self.assertFalse(body["personalized"])
                expected_citation = {
                    "article_path": case.article_path,
                    "document": DOCUMENT,
                    "effective_date": EFFECTIVE_DATE.isoformat(),
                    "snippet": case.quote,
                    "source_url": SOURCE_URL,
                }
                self.assertEqual(body["citations"], [expected_citation])

    def test_no_match_returns_existing_department_guidance(self):
        app = create_app(chat_retrieval=self.retrieval)

        body = self.post_chat(app, MISMATCH_QUERY)

        self.assertFalse(body["answered"])
        self.assertEqual(body["citations"], [])
        self.assertEqual(body["answer"], UNANSWERABLE_TEXT)

    def test_retrieval_and_default_apps_keep_separate_configuration(self):
        search_app = create_app(chat_retrieval=self.retrieval)
        default_app = create_app()
        stub_citation = {
            **FICTIONAL_CITATION,
            "effective_date": FICTIONAL_CITATION["effective_date"].isoformat(),
        }

        for request_number in range(2):
            with self.subTest(request_number=request_number):
                default = self.post_chat(default_app, FICTIONAL_QUESTION)
                search = self.post_chat(search_app, FICTIONAL_QUESTION)

                self.assertTrue(default["answered"])
                self.assertEqual(default["answer"], ANSWERED_TEXT)
                self.assertEqual(default["citations"], [stub_citation])
                self.assertTrue(search["answered"])
                self.assertEqual([citation["document"] for citation in search["citations"]], [DOCUMENT])

    def test_api_source_does_not_import_core(self):
        app_dir = API_DIR / "app"
        for path in sorted(app_dir.rglob("*.py")):
            with self.subTest(path=path.relative_to(app_dir)):
                tree = ast.parse(path.read_text(encoding="utf-8"))
                modules = []
                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        modules.extend(alias.name for alias in node.names)
                    elif isinstance(node, ast.ImportFrom) and node.module:
                        modules.append(node.module)

                for module in modules:
                    self.assertNotEqual(module.split(".", 1)[0], "kumoh_rag_core")
