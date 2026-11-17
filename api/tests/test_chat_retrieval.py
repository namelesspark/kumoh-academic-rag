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
from app.services.chat_retrieval import AI_CANDIDATE_LIMIT, ChatRetrieval
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

        for question in (MISMATCH_QUERY, "가상의 날씨"):
            with self.subTest(question=question):
                body = self.post_chat(app, question)

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
                self.assertFalse(search["answered"])
                self.assertEqual(search["answer"], UNANSWERABLE_TEXT)
                self.assertEqual(search["citations"], [])

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


class RelaxedRetrievalTests(unittest.TestCase):
    def retrieval(self, texts):
        from types import SimpleNamespace
        from app.services.chat_relevance import keep_supported
        documents = []
        hits = []
        for index, text in enumerate(texts):
            chunk = SimpleNamespace(text=text, start=0, end=len(text), article_path=f"제{index + 1}조")
            document = dict(source=text, document_title=f"가상 문서 {index}", effective_date=date(2099, 1, index + 1), source_url=f"https://example.invalid/{index}")
            documents.append(document)
            chunk.document = document
            hits.append(SimpleNamespace(chunk=chunk))
        search = lambda query: hits
        return ChatRetrieval(search=keep_supported(search), raw_search=search, document_for_chunk=lambda chunk: chunk.document, **documents[0])

    def test_examples_stems_and_article_numbers(self):
        from types import SimpleNamespace
        from app.services.chat_relevance import is_ai_candidate
        for query, text in (("별빛 열람실은 언제 열어?", "별빛 열람실은 자정에 연다"),
                            ("무지개책은 며칠 동안 빌려?", "무지개책은 사흘 동안 빌린다")):
            retrieval = self.retrieval([text])
            self.assertFalse(retrieval.build_result(query, None)["answered"])
            self.assertTrue(retrieval.build_result(query, None, relaxed=True)["answered"])
        for query, text, expected in (("연장해", "연장은 가능하다", True), ("열어", "열람실", False),
                                      ("제1조", "가상", True), ("제2조", "가상", False),
                                      ("없는말\n연장해", "연장 가능", True)):
            self.assertEqual(is_ai_candidate(query, SimpleNamespace(text=text, article_path="제1조")), expected)

    def test_rank_budget_and_document_metadata(self):
        for lengths, count in (((1000, 1000, 1000, 10), 3), ((1000, 1000, 1001, 10), 2),
                               ((3001, 10, 10, 10), 1), ((1600, 1500, 10, 10), 1)):
            texts = ["가상" + "나" * (length - 2) for length in lengths]
            body = self.retrieval(texts).build_result("가상", None, relaxed=True)
            self.assertEqual(len(body["citations"]), count)
            self.assertEqual(body["answer"], texts[0])
            for index, citation in enumerate(body["citations"]):
                self.assertEqual(citation["snippet"], texts[index])
                self.assertEqual(citation["document"], f"가상 문서 {index}")
                self.assertEqual(citation["effective_date"], date(2099, 1, index + 1))
                self.assertEqual(citation["source_url"], f"https://example.invalid/{index}")

    def test_fifth_candidate_is_sent_and_sixth_is_not(self):
        # 가짜 검색 함수가 순위를 정한다. 제목 가산과 무관하게 넘긴 순서 그대로다.
        self.assertEqual(AI_CANDIDATE_LIMIT, 5)
        texts = [f"가상 후보 {rank}위" for rank in range(1, 7)]
        retrieval = self.retrieval(texts)

        relaxed = retrieval.build_result("가상", None, relaxed=True)
        strict = retrieval.build_result("가상", None)

        self.assertEqual([c["snippet"] for c in relaxed["citations"]], texts[:5])
        self.assertEqual([c["article_path"] for c in relaxed["citations"]][-1], "제5조")
        self.assertEqual([c["snippet"] for c in strict["citations"]], texts[:1])

    def test_budget_drops_the_lowest_ranks_among_five(self):
        cases = (
            ((700, 700, 700, 700, 700, 10), 4),
            ((600, 600, 600, 600, 600, 10), 5),
            ((2000, 900, 200, 10, 10, 10), 2),
            ((3500, 10, 10, 10, 10, 10), 1),
        )
        for lengths, count in cases:
            with self.subTest(lengths=lengths):
                texts = ["가상" + "나" * (length - 2) for length in lengths]
                body = self.retrieval(texts).build_result("가상", None, relaxed=True)
                self.assertEqual([c["snippet"] for c in body["citations"]], texts[:count])
                self.assertEqual(body["answer"], texts[0])
