"""메모리에 둔 가상 규정으로 앱의 검색과 출처 응답을 확인한다."""

import unittest
from datetime import date
from inspect import Parameter, signature

from api.regulation_app import create_regulation_app
from api.tests.asgi_harness import call_app

from app.services.chat_stub import UNANSWERABLE_TEXT


DOCUMENT_TITLE = "가상 혜성 관측소 규정"
EFFECTIVE_DATE = date(2099, 2, 3)
SOURCE_URL = "https://example.org/fictional-observatory"
FIRST_ARTICLE = "제1조(혜성 관측)\n혜성망원경은  보름날에 빌린다."
SECOND_ARTICLE = "제2조(운석 전시) 운석표본은 유리장에 둔다."
SOURCE = f"{DOCUMENT_TITLE}\n\n{FIRST_ARTICLE}\n{SECOND_ARTICLE}\n"


class RegulationAppTests(unittest.TestCase):
    def setUp(self):
        self.app = create_regulation_app(
            SOURCE,
            document_title=DOCUMENT_TITLE,
            effective_date=EFFECTIVE_DATE,
            source_url=SOURCE_URL,
        )

    def test_health_reports_two_indexed_chunks(self):
        response = call_app(self.app, "GET", "/api/v1/health")

        self.assertEqual(response.status, 200)
        self.assertEqual(response.json(), {
            "status": "ok",
            "index_loaded": True,
            "chunk_count": 2,
        })

    def test_chat_cites_the_exact_article_and_its_source(self):
        response = call_app(
            self.app, "POST", "/api/v1/chat", json_body={"message": "혜성망원경"}
        )

        self.assertEqual(response.status, 200)
        body = response.json()
        self.assertIs(body["answered"], True)
        self.assertEqual(body["answer"], FIRST_ARTICLE)
        self.assertEqual(body["citations"], [{
            "article_path": "제1조(혜성 관측)",
            "document": DOCUMENT_TITLE,
            "effective_date": EFFECTIVE_DATE.isoformat(),
            "snippet": FIRST_ARTICLE,
            "source_url": SOURCE_URL,
        }])

    def test_chat_returns_guidance_for_unmatched_question(self):
        response = call_app(
            self.app, "POST", "/api/v1/chat", json_body={"message": "얼룩말 풍금"}
        )

        self.assertEqual(response.status, 200)
        body = response.json()
        self.assertIs(body["answered"], False)
        self.assertEqual(body["answer"], UNANSWERABLE_TEXT)
        self.assertEqual(body["citations"], [])

    def test_source_without_articles_prevents_startup(self):
        with self.assertRaisesRegex(ValueError, "검색할 조각을 찾지 못했습니다"):
            create_regulation_app(
                DOCUMENT_TITLE,
                document_title=DOCUMENT_TITLE,
                effective_date=EFFECTIVE_DATE,
                source_url=SOURCE_URL,
            )

    def test_factory_argument_names_and_default(self):
        parameters = signature(create_regulation_app).parameters

        self.assertEqual(
            tuple(parameters),
            ("source", "document_title", "effective_date", "source_url", "max_chars"),
        )
        self.assertIs(parameters["source"].kind, Parameter.POSITIONAL_OR_KEYWORD)
        for name in ("document_title", "effective_date", "source_url", "max_chars"):
            with self.subTest(argument=name):
                self.assertIs(parameters[name].kind, Parameter.KEYWORD_ONLY)
        self.assertEqual(parameters["max_chars"].default, 1000)
