"""가상 규정 여러 건을 함께 검색하고 각 문서의 원문을 인용하는지 확인한다."""

import unittest
from datetime import date
from unittest.mock import patch

from api.regulation_app import create_regulations_app
from api.tests.asgi_harness import call_app

from app.services.chat_stub import UNANSWERABLE_TEXT


FIRST_ARTICLE = "제1조(혜성 관측)\n혜성망원경은  보름날에 빌린다."
SECOND_ARTICLE = "제1조(구름 보관)\n구름표본은\t유리장에 둔다."
FIRST = {
    "source": f"가상 혜성 관측소 규정\n\n{FIRST_ARTICLE}\n제2조(관측일지) 일지를 제출한다.\n",
    "document_title": "가상 혜성 관측소 규정",
    "effective_date": date(2099, 2, 3),
    "source_url": "https://example.invalid/fictional-observatory",
}
SECOND = {
    "source": f"가상 구름 수집소 규정\n\n{SECOND_ARTICLE}\n",
    "document_title": "가상 구름 수집소 규정",
    "effective_date": date(2099, 4, 5),
    "source_url": "https://example.invalid/fictional-cloud-collection",
}


class RegulationsAppTests(unittest.TestCase):
    def assert_citation(self, app, question, document, article_path, snippet):
        response = call_app(app, "POST", "/api/v1/chat", json_body={"message": question})

        self.assertEqual(response.status, 200)
        body = response.json()
        self.assertIs(body["answered"], True)
        self.assertEqual(body["answer"], snippet)
        self.assertEqual(body["citations"], [{
            "article_path": article_path,
            "document": document["document_title"],
            "effective_date": document["effective_date"].isoformat(),
            "snippet": snippet,
            "source_url": document["source_url"],
        }])

    def test_health_sums_chunks_from_both_documents(self):
        app = create_regulations_app([FIRST, SECOND])
        response = call_app(app, "GET", "/api/v1/health")

        self.assertEqual(response.status, 200)
        self.assertEqual(response.json(), {
            "status": "ok",
            "index_loaded": True,
            "chunk_count": 3,
        })

    def test_same_article_number_cites_the_document_matching_the_question(self):
        app = create_regulations_app([FIRST, SECOND])

        self.assert_citation(app, "제1조 혜성망원경", FIRST, "제1조(혜성 관측)", FIRST_ARTICLE)
        self.assert_citation(app, "제1조 구름표본", SECOND, "제1조(구름 보관)", SECOND_ARTICLE)

    def test_identical_chunks_cite_first_document_in_list(self):
        first = {**FIRST, "source": FIRST_ARTICLE}
        second = {**SECOND, "source": FIRST_ARTICLE}

        unrelated = {
            **SECOND,
            "source": "제2조(별사탕 보관) 별사탕은 유리병에 넣는다.",
            "document_title": "가상 별사탕 공방 규정",
            "source_url": "https://example.invalid/fictional-star-candy-workshop",
        }
        for documents in ([first, second, unrelated], [second, first, unrelated]):
            with self.subTest(first_document=documents[0]["document_title"]):
                app = create_regulations_app(documents)
                self.assert_citation(
                    app, "혜성망원경", documents[0], "제1조(혜성 관측)", FIRST_ARTICLE
                )

    def test_split_paragraph_preserves_original_crlf(self):
        paragraph = "① 달빛우산은  전시함에 둔다.\r\n\t 1. 보관함을 잠근다."
        document = {
            **SECOND,
            "source": f"가상 달빛 도서관 규정\r\n제1조(전시)\r\n{paragraph}\r\n② 은하우표는 진열장에 둔다.\r\n",
            "document_title": "가상 달빛 도서관 규정",
            "source_url": None,
        }
        app = create_regulations_app([FIRST, document], max_chars=24)

        self.assert_citation(app, "달빛우산", document, "제1조(전시) ①", paragraph)

    def test_unmatched_question_returns_guidance_without_citations(self):
        app = create_regulations_app([FIRST, SECOND])
        response = call_app(
            app, "POST", "/api/v1/chat", json_body={"message": "얼룩말 풍금"}
        )

        self.assertEqual(response.status, 200)
        body = response.json()
        self.assertIs(body["answered"], False)
        self.assertEqual(body["answer"], UNANSWERABLE_TEXT)
        self.assertEqual(body["citations"], [])

    def test_question_matching_only_terms_shared_by_all_chunks_returns_guidance(self):
        first = {
            **FIRST,
            "source": (
                "제1조(혜성 관측) 가상의 망원경을 빌린다.\n"
                "제2조(관측일지) 가상의 관측일지를 제출한다."
            ),
        }
        second = {**SECOND, "source": "제1조(구름 보관) 가상의 표본을 유리장에 둔다."}
        app = create_regulations_app([first, second])
        response = call_app(
            app, "POST", "/api/v1/chat", json_body={"message": "가상의 날씨"}
        )

        self.assertEqual(response.status, 200)
        body = response.json()
        self.assertIs(body["answered"], False)
        self.assertEqual(body["answer"], UNANSWERABLE_TEXT)
        self.assertEqual(body["citations"], [])

    def test_empty_document_list_prevents_startup(self):
        with patch("api.regulation_app.create_app") as create_app:
            with self.assertRaises(ValueError) as error:
                create_regulations_app([])

        self.assertEqual(str(error.exception), "documents: 문서가 없습니다.")
        create_app.assert_not_called()

    def test_second_document_without_articles_prevents_startup(self):
        document = {**SECOND, "source": "가상 구름표본 문서의 조문 없는 원문"}
        with patch("api.regulation_app.create_app") as create_app:
            with self.assertRaises(ValueError) as error:
                create_regulations_app([FIRST, document])

        self.assertEqual(str(error.exception), "documents[1]: 검색할 조각을 찾지 못했습니다.")
        create_app.assert_not_called()
