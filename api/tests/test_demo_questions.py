"""채팅 화면의 예시 질문 두 개가 가상 규정 질문표와 맞는지 확인한다.

화면의 버튼은 `data-question` 값을 입력창에 그대로 넣는다. 이 값이 질문표와
어긋나면 첫 버튼이 답변 불가가 되거나 둘째 버튼에 인용이 붙는다. 그래서 파일에서
값을 직접 읽어 질문표와 견주고, 검색을 붙인 앱에 보내 응답까지 본다.
"""

import re
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
        self._template_depth = 0  # 열려 있는 <template> 수

    def handle_starttag(self, tag, attrs):
        # 브라우저는 <template> 내용을 문서 트리에 넣지 않아 querySelectorAll이
        # 찾지 못한다. 그래서 닫는 태그까지 안쪽을 통째로 건너뛴다.
        if tag == "template":
            self._template_depth += 1
        if self._template_depth:
            return

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
        if self._template_depth:
            return
        if self._example_tag is not None:
            self.labels[-1] += data

    def handle_endtag(self, tag):
        if self._template_depth:
            if tag == "template":
                self._template_depth -= 1
            return

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


def split_at_topics_end(html):
    """`#topics`의 닫는 태그를 기준으로 (안쪽 끝까지, 닫는 태그, 그 뒤)로 나눈다.

    태그 이름을 글자로 박아 두지 않고 `id="topics"`인 요소에서 읽는다. 같은 이름의
    태그가 안에 겹쳐 있어도 짝이 맞는 닫는 태그를 고른다.
    """
    openings = list(re.finditer(r'<([a-z][a-z0-9]*)\b[^>]*\bid="topics"[^>]*>', html))
    if len(openings) != 1:
        raise AssertionError(f'id="topics"인 요소가 {len(openings)}개입니다')
    tag = openings[0].group(1)
    depth = 1
    for found in re.finditer(rf"<(/?){tag}\b[^>]*>", html[openings[0].end():]):
        depth += -1 if found.group(1) else 1
        if depth == 0:
            start = openings[0].end() + found.start()
            end = openings[0].end() + found.end()
            return html[:start], html[start:end], html[end:]
    raise AssertionError("#topics의 닫는 태그를 찾지 못했습니다")


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
        inside, closing, after = split_at_topics_end(html)
        extra = '<a href="#" data-question="가상 질문">셋째 예시</a>'
        changed = inside + extra + closing + after

        self.assertEqual(changed.count(extra + closing), 1)
        parsed = parse_examples(changed)

        self.assertEqual(
            parsed.questions,
            [PARTICLE_CASE.query, MISMATCH_QUERY, "가상 질문"],
        )
        self.assertEqual(parsed.tags, ["button", "button", "a"])

    def test_example_outside_topics_is_not_counted(self):
        # `#topics` 밖의 요소는 화면이 연결하지 않으므로 세지 않는다.
        html = INDEX_HTML.read_text(encoding="utf-8")
        inside, closing, after = split_at_topics_end(html)
        extra = '<button type="button" data-question="가상 질문">범위 밖</button>'
        changed = inside + closing + extra + after

        # 끼워 넣기가 실제로 일어났고, 그 자리가 닫는 태그 바로 뒤인지 먼저 확인한다.
        # 이 확인이 없으면 아무것도 넣지 못한 채로도 아래 단언이 통과한다.
        self.assertEqual(changed.count(closing + extra), 1)
        self.assertEqual(changed.count('data-question="가상 질문"'), 1)
        self.assertEqual(len(changed), len(html) + len(extra))
        # 같은 요소를 닫는 태그 앞에 두면 세어진다. 세지 않는 이유가 자리뿐임을 보인다.
        self.assertEqual(
            parse_examples(inside + extra + closing + after).questions,
            [PARTICLE_CASE.query, MISMATCH_QUERY, "가상 질문"],
        )

        parsed = parse_examples(changed)

        self.assertEqual(parsed.questions, [PARTICLE_CASE.query, MISMATCH_QUERY])

    def test_examples_wrapped_in_template_are_not_counted(self):
        # <template> 안의 버튼은 화면에 없으므로 예시가 0개로 잡혀야 한다.
        html = INDEX_HTML.read_text(encoding="utf-8")
        first = '<button type="button" data-question='
        inside, closing, after = split_at_topics_end(html)
        self.assertEqual(html.count(first), 2)
        self.assertEqual(inside.count(first), 2)

        wrapped = inside.replace(first, "<template>" + first, 1) + "</template>" + closing + after
        parsed = parse_examples(wrapped)

        self.assertEqual(wrapped.count("<template>"), 1)
        self.assertEqual(wrapped.count("</template>" + closing), 1)
        self.assertEqual(parsed.questions, [])
        self.assertEqual(parsed.labels, [])

    def test_example_after_template_is_still_counted(self):
        # 건너뛰기는 닫는 태그에서 끝나고, 그 뒤 예시는 다시 센다.
        html = INDEX_HTML.read_text(encoding="utf-8")
        inside, closing, after = split_at_topics_end(html)
        hidden = '<template><a href="#" data-question="가상 숨은 질문">숨은 예시</a></template>'
        shown = '<a href="#" data-question="가상 질문">셋째 예시</a>'
        changed = inside + hidden + shown + closing + after

        self.assertEqual(changed.count(hidden + shown + closing), 1)
        parsed = parse_examples(changed)

        self.assertEqual(
            parsed.questions,
            [PARTICLE_CASE.query, MISMATCH_QUERY, "가상 질문"],
        )

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
