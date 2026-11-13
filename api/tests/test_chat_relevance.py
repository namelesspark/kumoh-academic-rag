"""검색 후보를 답으로 쓸지 가리는 판정을 가상 규정으로 확인한다.

판정은 검색기가 낸 후보를 다시 읽어, 질문의 핵심 낱말이 본문에 모두 있는 조각만
남긴다. 여기서는 낱말 고르기, 조각 판정, 앱 응답을 차례로 본다. 모든 문장은 지어낸
것이고 서버는 띄우지 않는다.
"""

import unittest
from datetime import date
from types import SimpleNamespace

from api.demo_regulation import DOCUMENT_TITLE, EFFECTIVE_DATE, SOURCE
from api.regulation_app import create_regulation_app, create_regulations_app
from api.tests.asgi_harness import call_app
from core.tests.retrieval_cases import (
    MAX_CHARS,
    Q_ARTICLE_12,
    Q_ARTICLE_12_2,
    Q_ARTICLE_112,
    Q_PARTICLE,
    Q_SPLIT_SECOND,
    Q_TIE,
    SPLIT_TITLE,
)

from app.services.chat_relevance import core_words, is_supported, keep_supported
from app.services.chat_stub import UNANSWERABLE_TEXT
from kumoh_rag_core.chunking import chunk_articles
from kumoh_rag_core.retrieval import BM25Retriever


CHAT = "/api/v1/chat"
LEAVE_QUESTION = "휴학은 몇 학기까지 할 수 있나요?"
# 가상 규정에 없는 주제이거나 핵심 낱말이 모자라 보류해야 하는 질문 (이슈 #76)
HELD_QUESTIONS = (
    LEAVE_QUESTION,
    "휴학은 며칠 동안 할 수 있나요",
    "등록금은 언제까지 내나요",
    "졸업 학점은 몇 학점인가요?",
    "별빛 열람실 휴학",
    "누가 내주나요",
)
# 가상 구름 도서관 규정에서 계속 답해야 하는 질문과 인용할 조문
KEPT_DEMO_QUESTIONS = (
    ("달빛열람증을 누가 내주나요", "제3조(달빛 열람)", Q_PARTICLE),
    ("누가 달빛열람증을 내주나요", "제3조(달빛 열람)", Q_PARTICLE),
    ("달빛열람증은 누가 내주나요?", "제3조(달빛 열람)", Q_PARTICLE),
    ("달빛열람증 누가 내주는지 알려 주세요", "제3조(달빛 열람)", Q_PARTICLE),
    ("모래 시계", "제30조(모래 시계)", Q_TIE),
    (
        "보름날에 별빛 열람실은 언제까지 여나요",
        "제12조의2(별빛 열람 연장)",
        Q_ARTICLE_12_2,
    ),
    ("별빛열람실은 보름날에 언제까지 여나요", "제12조의2(별빛 열람 연장)", Q_ARTICLE_12_2),
    ("제12조", "제12조(별빛 열람)", Q_ARTICLE_12),
    ("제12조의2", "제12조의2(별빛 열람 연장)", Q_ARTICLE_12_2),
    ("제112조", "제112조(바람 열람)", Q_ARTICLE_112),
    ("무지개책은 며칠 동안 빌리나요", f"{SPLIT_TITLE} ②", Q_SPLIT_SECOND),
)

OBSERVATORY_BOOKING = "제1조(망원경 예약) 가상의 달무리 망원경은 사흘 전에 예약한다."
OBSERVATORY_MAP = "제2조(별지도 대여) 가상의 별지도는 이레 동안 빌린다."
OBSERVATORY_LATE = "제3조(관측 연장) 가상의 관측실은 그믐날에 새벽까지 연다."
WOODSHOP_PLANE = "제1조(대패 사용) 가상의 은여울 대패는 목공지기가 내어 준다."
OBSERVATORY = {
    "source": (
        "가상 달무리 천문대 규정\n\n"
        f"{OBSERVATORY_BOOKING}\n{OBSERVATORY_MAP}\n{OBSERVATORY_LATE}\n"
    ),
    "document_title": "가상 달무리 천문대 규정",
    "effective_date": date(2099, 3, 4),
    "source_url": "https://example.invalid/regulations/observatory",
}
WOODSHOP = {
    "source": f"가상 은여울 목공방 규정\n\n{WOODSHOP_PLANE}\n",
    "document_title": "가상 은여울 목공방 규정",
    "effective_date": date(2098, 11, 20),
    "source_url": "https://example.invalid/regulations/woodshop",
}
LANTERN_ARTICLE = "제1조(반딧불 등대) 가상의 반딧불등은 등대지기가 켠다."


def chunk(text, article_path):
    return SimpleNamespace(text=text, article_path=article_path)


def demo_chunks():
    return chunk_articles(SOURCE, max_chars=MAX_CHARS)


def create_demo_app():
    return create_regulation_app(
        SOURCE,
        document_title=DOCUMENT_TITLE,
        effective_date=EFFECTIVE_DATE,
        source_url=None,
        max_chars=MAX_CHARS,
    )


class CoreWordTests(unittest.TestCase):
    def test_particles_asking_words_and_article_numbers_are_left_out(self):
        cases = (
            (LEAVE_QUESTION, ("휴학", "학기")),
            ("달빛열람증을 누가 내주나요", ("달빛열람증",)),
            ("졸업 학점은 몇 학점인가요?", ("졸업", "학점")),
            ("등록금은 언제까지 내나요", ("등록금",)),
            ("가상의 달빛열람증", ("가상", "달빛열람증")),
            ("제1조 망원경", ("망원경",)),
            ("달빛열람증 누가 내주는지 알려 주세요", ("달빛열람증",)),
            ("어떤 서류가 필요해요?", ("서류",)),
            # 전각 글자와 대문자는 같은 글자로 본다.
            ("ＡＢ열람증", ("ab열람증",)),
        )
        for line, expected in cases:
            with self.subTest(line=line):
                self.assertEqual(core_words(line), expected)

    def test_question_without_topic_word_has_no_core_words(self):
        for line in ("누가 내주나요", "제12조의2", "제12조는 무엇인가요", "몇 수 할", ""):
            with self.subTest(line=line):
                self.assertEqual(core_words(line), ())

    def test_particle_is_kept_when_only_one_letter_would_remain(self):
        # '학과'의 '과', '지도'의 '도'를 조사로 떼면 낱말이 사라진다.
        self.assertEqual(core_words("학과 지도"), ("학과", "지도"))
        self.assertEqual(
            core_words("망원경은 며칠 전에 예약하나요"), ("망원경", "전에")
        )

    def test_repeated_word_is_listed_once(self):
        self.assertEqual(core_words("휴학은 휴학이 휴학"), ("휴학",))


class SupportTests(unittest.TestCase):
    def test_every_core_word_must_be_in_the_chunk(self):
        late = chunk(Q_ARTICLE_12_2, "제12조의2(별빛 열람 연장)")
        self.assertTrue(is_supported("보름날에 별빛 열람실은 언제까지 여나요", late))
        self.assertFalse(is_supported("별빛 열람실 휴학", late))
        self.assertFalse(is_supported(LEAVE_QUESTION, late))

    def test_spacing_in_the_chunk_does_not_matter(self):
        tie = chunk(Q_TIE, "제30조(모래 시계)")
        for query in ("모래시계", "모래 시계", "시계 모래"):
            with self.subTest(query=query):
                self.assertTrue(is_supported(query, tie))

    def test_paragraph_chunk_counts_its_article_title(self):
        second = chunk(f"{SPLIT_TITLE}\n{Q_SPLIT_SECOND}", f"{SPLIT_TITLE} ②")
        self.assertTrue(is_supported("구름 대출 무지개책", second))

    def test_number_only_question_needs_the_same_article_number(self):
        twelve = chunk(Q_ARTICLE_12, "제12조(별빛 열람)")
        twelve_two = chunk(Q_ARTICLE_12_2, "제12조의2(별빛 열람 연장)")
        self.assertTrue(is_supported("제12조", twelve))
        self.assertFalse(is_supported("제12조", twelve_two))
        self.assertTrue(is_supported("제12조의2", twelve_two))
        self.assertFalse(is_supported("제12조의2", twelve))
        self.assertTrue(is_supported("제12조는 무엇인가요", twelve))

    def test_number_beside_missing_topic_is_not_supported(self):
        twelve = chunk(Q_ARTICLE_12, "제12조(별빛 열람)")
        self.assertFalse(is_supported("제12조 휴학", twelve))
        self.assertTrue(is_supported("제12조 별빛", twelve))

    def test_question_without_core_word_or_number_is_not_supported(self):
        first = chunk(Q_PARTICLE, "제3조(달빛 열람)")
        for query in ("누가 내주나요", "", "\n"):
            with self.subTest(query=query):
                self.assertFalse(is_supported(query, first))

    def test_each_line_of_a_photo_query_is_judged_alone(self):
        # 사진 질문은 질문과 판독문을 줄바꿈으로 잇는다. 한 줄만 통과해도 받는다.
        first = chunk(Q_PARTICLE, "제3조(달빛 열람)")
        self.assertTrue(is_supported("어떤 서류가 필요해요?\n달빛열람증", first))
        self.assertFalse(is_supported("어떤 서류가 필요해요? 달빛열람증", first))
        self.assertFalse(is_supported("어떤 서류가 필요해요?\n얼룩말 풍금", first))


class SupportedSearchTests(unittest.TestCase):
    def test_leave_question_reaches_an_unrelated_article_without_the_check(self):
        # 원인 확인: 검색기만 쓰면 조사 '까지'가 겹친 제12조의2가 1위로 나온다.
        retriever = BM25Retriever(demo_chunks())

        hits = retriever.retrieve(LEAVE_QUESTION)

        self.assertTrue(hits)
        self.assertEqual(hits[0].chunk.article_path, "제12조의2(별빛 열람 연장)")
        self.assertEqual(keep_supported(retriever.retrieve)(LEAVE_QUESTION), [])

    def test_first_supported_candidate_is_kept_in_rank_order(self):
        unrelated = SimpleNamespace(chunk=chunk(Q_ARTICLE_12_2, "제12조의2(별빛 열람 연장)"))
        first = SimpleNamespace(chunk=chunk(Q_TIE, "제30조(모래 시계)"))
        second = SimpleNamespace(chunk=chunk(Q_TIE, "제30조(모래 시계)"))
        queries = []

        def search(query):
            queries.append(query)
            return [unrelated, first, second]

        kept = keep_supported(search)("모래시계를 언제까지 뒤집나요")

        self.assertEqual(queries, ["모래시계를 언제까지 뒤집나요"])
        self.assertEqual(len(kept), 2)
        self.assertIs(kept[0], first)
        self.assertIs(kept[1], second)

    def test_photo_query_keeps_the_article_matching_the_recognized_line(self):
        search = keep_supported(BM25Retriever(demo_chunks()).retrieve)

        hits = search("어떤 서류가 필요해요?\n달빛열람증")

        self.assertTrue(hits)
        self.assertEqual(hits[0].chunk.article_path, "제3조(달빛 열람)")


class AppAnswerTests(unittest.TestCase):
    def ask(self, app, question):
        response = call_app(app, "POST", CHAT, json_body={"message": question})
        self.assertEqual(response.status, 200)
        return response.json()

    def assert_held(self, app, question):
        body = self.ask(app, question)
        self.assertIs(body["answered"], False)
        self.assertEqual(body["answer"], UNANSWERABLE_TEXT)
        self.assertEqual(body["citations"], [])

    def assert_cited(self, app, question, document, article_path, snippet):
        body = self.ask(app, question)
        self.assertIs(body["answered"], True)
        self.assertEqual(body["answer"], snippet)
        self.assertEqual(body["citations"], [{
            "article_path": article_path,
            "document": document["document_title"],
            "effective_date": document["effective_date"].isoformat(),
            "snippet": snippet,
            "source_url": document["source_url"],
        }])

    def test_demo_app_holds_questions_outside_the_regulation(self):
        app = create_demo_app()
        for question in HELD_QUESTIONS:
            with self.subTest(question=question):
                self.assert_held(app, question)

    def test_demo_app_keeps_answering_reworded_questions(self):
        app = create_demo_app()
        document = {
            "document_title": DOCUMENT_TITLE,
            "effective_date": EFFECTIVE_DATE,
            "source_url": None,
        }
        for question, article_path, snippet in KEPT_DEMO_QUESTIONS:
            with self.subTest(question=question):
                self.assert_cited(app, question, document, article_path, snippet)

    def test_multi_document_app_holds_questions_outside_the_regulations(self):
        app = create_regulations_app([OBSERVATORY, WOODSHOP])
        for question in (*HELD_QUESTIONS, "달무리 망원경 휴학"):
            with self.subTest(question=question):
                self.assert_held(app, question)

    def test_multi_document_app_keeps_answering_from_each_document(self):
        app = create_regulations_app([OBSERVATORY, WOODSHOP])
        cases = (
            ("망원경은 며칠 전에 예약하나요", OBSERVATORY, "제1조(망원경 예약)", OBSERVATORY_BOOKING),
            ("별지도를 며칠 동안 빌리나요", OBSERVATORY, "제2조(별지도 대여)", OBSERVATORY_MAP),
            (
                "그믐날에 관측실은 언제까지 여나요",
                OBSERVATORY,
                "제3조(관측 연장)",
                OBSERVATORY_LATE,
            ),
            ("대패는 누가 내어 주나요", WOODSHOP, "제1조(대패 사용)", WOODSHOP_PLANE),
            ("제1조 대패", WOODSHOP, "제1조(대패 사용)", WOODSHOP_PLANE),
        )
        for question, document, article_path, snippet in cases:
            with self.subTest(question=question):
                self.assert_cited(app, question, document, article_path, snippet)

    def test_single_chunk_app_answers_its_topic_and_holds_the_rest(self):
        document = {
            "document_title": "가상 반딧불 등대 규정",
            "effective_date": date(2099, 5, 6),
            "source_url": None,
        }
        app = create_regulation_app(LANTERN_ARTICLE, **document)

        self.assert_cited(app, "반딧불등", document, "제1조(반딧불 등대)", LANTERN_ARTICLE)
        self.assert_cited(
            app, "반딧불등은 누가 켜나요", document, "제1조(반딧불 등대)", LANTERN_ARTICLE
        )
        # 조각이 하나면 검색기는 한 낱말만 겹쳐도 후보를 낸다.
        self.assert_held(app, "등대지기는 휴학을 하나요")


if __name__ == "__main__":
    unittest.main()
