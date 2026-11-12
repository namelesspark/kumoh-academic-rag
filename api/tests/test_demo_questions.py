"""채팅 화면의 예시 질문 두 개가 가상 규정 질문표와 맞는지 확인한다.

화면의 버튼은 `data-question` 값을 입력창에 그대로 넣는다. 이 값이 질문표와
어긋나면 첫 버튼이 답변 불가가 되거나 둘째 버튼에 인용이 붙는다. 그래서 파일에서
값을 직접 읽어 질문표와 견주고, 검색을 붙인 앱에 보내 응답까지 본다.
"""

import sys
import unittest
from datetime import date
from html.parser import HTMLParser
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
INDEX_HTML = API_DIR / "app" / "chat_web" / "index.html"
DOCUMENT = "가상 구름 도서관 규정"
EFFECTIVE_DATE = date(2099, 2, 3)


class ExampleButtonParser(HTMLParser):
    """`data-question` 속성이 있는 버튼의 질문 값과 버튼 이름을 문서 순서대로 모은다."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.questions = []
        self.labels = []
        self._in_example = False

    def handle_starttag(self, tag, attrs):
        question = dict(attrs).get("data-question")
        if tag == "button" and question is not None:
            self.questions.append(question)
            self.labels.append("")
            self._in_example = True

    def handle_data(self, data):
        if self._in_example:
            self.labels[-1] += data

    def handle_endtag(self, tag):
        if tag == "button":
            self._in_example = False


def read_example_buttons():
    parser = ExampleButtonParser()
    parser.feed(INDEX_HTML.read_text(encoding="utf-8"))
    parser.close()
    return parser


class DemoQuestionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.buttons = read_example_buttons()
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

    def test_page_has_exactly_two_questions_from_the_case_table(self):
        self.assertEqual(
            self.buttons.questions,
            [PARTICLE_CASE.query, MISMATCH_QUERY],
        )

    def test_button_names_and_order_are_kept(self):
        self.assertEqual(
            [label.strip() for label in self.buttons.labels],
            ["답변과 근거 조문", "근거를 찾지 못한 경우"],
        )

    def test_first_button_returns_one_verbatim_citation(self):
        self.assertEqual(len(self.buttons.questions), 2)

        body = self.post_chat(self.buttons.questions[0])

        self.assertTrue(body["answered"])
        self.assertEqual(len(body["citations"]), 1)
        citation = body["citations"][0]
        self.assertEqual(citation["article_path"], PARTICLE_CASE.article_path)
        self.assertEqual(citation["snippet"], PARTICLE_CASE.quote)
        self.assertEqual(citation["document"], DOCUMENT)
        self.assertIsNone(citation["source_url"])

    def test_second_button_returns_existing_unanswerable_guidance(self):
        self.assertEqual(len(self.buttons.questions), 2)

        body = self.post_chat(self.buttons.questions[1])

        self.assertFalse(body["answered"])
        self.assertEqual(body["citations"], [])
        self.assertEqual(body["answer"], UNANSWERABLE_TEXT)


if __name__ == "__main__":
    unittest.main()
