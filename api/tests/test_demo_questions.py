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


TOPICS_ID = "topics"


class ExampleParser(HTMLParser):
    """화면이 예시로 연결하는 요소를 문서 순서대로 모은다.

    `chat.js`는 `#topics` 안에서 `data-question` 속성이 있는 요소를 태그 종류와
    관계없이 모두 예시로 연결한다. 그래서 여기서도 버튼만 세지 않고 같은 범위를 센다.
    """

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.questions = []
        self.labels = []
        self.tags = []
        self._topics_tag = None  # id="topics"인 요소의 태그 이름
        self._topics_depth = 0  # 그 태그가 겹쳐 열린 횟수
        self._example_tag = None  # 이름을 모으고 있는 예시 요소의 태그 이름

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if self._topics_tag is None:
            if attributes.get("id") == TOPICS_ID:
                self._topics_tag = tag
                self._topics_depth = 1
            return

        if tag == self._topics_tag:
            self._topics_depth += 1
        if "data-question" in attributes:
            self.questions.append(attributes["data-question"])
            self.labels.append("")
            self.tags.append(tag)
            self._example_tag = tag

    def handle_data(self, data):
        if self._example_tag is not None:
            self.labels[-1] += data

    def handle_endtag(self, tag):
        if tag == self._example_tag:
            self._example_tag = None
        if tag == self._topics_tag:
            self._topics_depth -= 1
            if self._topics_depth == 0:
                self._topics_tag = None
                self._example_tag = None


def parse_examples(html):
    parser = ExampleParser()
    parser.feed(html)
    parser.close()
    return parser


def read_example_buttons():
    return parse_examples(INDEX_HTML.read_text(encoding="utf-8"))


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

    def test_non_button_example_inside_topics_is_counted(self):
        # 버튼이 아닌 요소도 화면에서는 예시로 연결되므로 개수에 잡혀야 한다.
        html = INDEX_HTML.read_text(encoding="utf-8")
        marker = "</details>"
        self.assertEqual(html.count(marker), 1)
        extra = '<a href="#" data-question="가상 질문">셋째 예시</a>'

        parsed = parse_examples(html.replace(marker, extra + marker))

        self.assertEqual(
            parsed.questions,
            [PARTICLE_CASE.query, MISMATCH_QUERY, "가상 질문"],
        )
        self.assertEqual(parsed.tags, ["button", "button", "a"])

    def test_example_outside_topics_is_not_counted(self):
        # `#topics` 밖의 요소는 화면이 연결하지 않으므로 세지 않는다.
        html = INDEX_HTML.read_text(encoding="utf-8")
        marker = "</details>"
        extra = '<button type="button" data-question="가상 질문">범위 밖</button>'

        parsed = parse_examples(html.replace(marker, marker + extra))

        self.assertEqual(parsed.questions, [PARTICLE_CASE.query, MISMATCH_QUERY])

    def test_button_names_and_order_are_kept(self):
        self.assertEqual(self.buttons.tags, ["button", "button"])
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
