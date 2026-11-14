"""가상 규정 질문표의 두 질문을 검색을 붙인 앱에 직접 보내 응답을 확인한다.

화면의 예시 질문 줄은 이슈 #88에서 없앴다. 그래서 화면 파일은 읽지 않고, 질문표의
질문 글을 그대로 서버에 보낸다. 첫 질문은 조문 하나를 그대로 인용해 답하고, 둘째
질문은 근거를 찾지 못했다는 기존 안내로 답해야 한다. 화면에 예시 줄이 남지 않았는지는
`test_web.py`가 본다.
"""

import sys
import unittest
from datetime import date
from pathlib import Path

from api.tests.asgi_harness import call_app
from core.tests.retrieval_cases import MAX_CHARS, MISMATCH_QUERY, PARTICLE_CASE, SOURCE

API_DIR = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(API_DIR), str(API_DIR.parent / "core" / "src")]

from app.main import create_app
from app.services.chat_retrieval import ChatRetrieval
from app.services.chat_stub import UNANSWERABLE_TEXT
from kumoh_rag_core.chunking import chunk_articles
from kumoh_rag_core.retrieval import BM25Retriever


CHAT = "/api/v1/chat"
DOCUMENT = "가상 구름 도서관 규정"
EFFECTIVE_DATE = date(2099, 2, 3)


class DemoQuestionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        retriever = BM25Retriever(chunk_articles(SOURCE, max_chars=MAX_CHARS))
        cls.app = create_app(
            chat_retrieval=ChatRetrieval(
                search=retriever.retrieve,
                source=SOURCE,
                document_title=DOCUMENT,
                effective_date=EFFECTIVE_DATE,
                source_url=None,
            )
        )

    def post_chat(self, question):
        # 대기 없는 호출만 쓴다. 앱이 중간에 멈추면 하네스가 실패시킨다.
        response = call_app(self.app, "POST", CHAT, json_body={"message": question})
        self.assertEqual(response.status, 200)
        return response.json()

    def test_the_two_questions_are_distinct_fictional_text(self):
        # 두 질문이 같거나 비면 아래 두 검사가 같은 일을 두 번 보게 된다.
        self.assertTrue(PARTICLE_CASE.query.strip())
        self.assertTrue(MISMATCH_QUERY.strip())
        self.assertNotEqual(PARTICLE_CASE.query, MISMATCH_QUERY)

    def test_answerable_question_returns_one_verbatim_citation(self):
        body = self.post_chat(PARTICLE_CASE.query)

        self.assertTrue(body["answered"])
        self.assertEqual(len(body["citations"]), 1)
        citation = body["citations"][0]
        self.assertEqual(citation["article_path"], PARTICLE_CASE.article_path)
        self.assertEqual(citation["snippet"], PARTICLE_CASE.quote)
        self.assertEqual(citation["document"], DOCUMENT)
        self.assertIsNone(citation["source_url"])

    def test_unmatched_question_returns_existing_unanswerable_guidance(self):
        body = self.post_chat(MISMATCH_QUERY)

        self.assertFalse(body["answered"])
        self.assertEqual(body["citations"], [])
        self.assertEqual(body["answer"], UNANSWERABLE_TEXT)


if __name__ == "__main__":
    unittest.main()
