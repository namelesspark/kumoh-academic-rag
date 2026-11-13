"""배포 앱이 근거가 약한 질문에 답변을 보류하고, 규정에 있는 주제는 계속 답하는지 확인한다."""

import unittest

from api.demo_regulation import DOCUMENT_TITLE, EFFECTIVE_DATE
from api.tests.asgi_harness import call_app
from api.tests.test_serve import MANIFEST_ENVIRON, import_serve
from core.tests.retrieval_cases import (
    Q_ARTICLE_12,
    Q_ARTICLE_12_2,
    Q_ARTICLE_112,
    Q_PARTICLE,
    Q_SPLIT_SECOND,
    Q_TIE,
    SPLIT_TITLE,
)

from app.services.chat_stub import UNANSWERABLE_TEXT


CHAT = "/api/v1/chat"
APPS = (("demo", {}), ("manifest", MANIFEST_ENVIRON))
# 공개 화면에서 관계없는 제12조의2가 답으로 나왔던 질문 (이슈 #76)
LEAVE_QUESTION = "휴학은 몇 학기까지 할 수 있나요?"
OFF_TOPIC_QUESTIONS = (
    LEAVE_QUESTION,
    "휴학은 며칠 동안 할 수 있나요",
    "등록금은 언제까지 내나요",
    "졸업 학점은 몇 학점인가요?",
    # 핵심 낱말 가운데 일부만 규정에 있다.
    "별빛 열람실 휴학",
    # 묻는 말뿐이고 핵심 낱말이 없다.
    "누가 내주나요",
)
REWORDED_DEMO_QUESTIONS = (
    ("누가 달빛열람증을 내주나요", "제3조(달빛 열람)", Q_PARTICLE),
    ("달빛열람증은 누가 내주나요?", "제3조(달빛 열람)", Q_PARTICLE),
    ("모래 시계", "제30조(모래 시계)", Q_TIE),
    (
        "보름날에 별빛 열람실은 언제까지 여나요",
        "제12조의2(별빛 열람 연장)",
        Q_ARTICLE_12_2,
    ),
    ("제12조", "제12조(별빛 열람)", Q_ARTICLE_12),
    ("제12조의2", "제12조의2(별빛 열람 연장)", Q_ARTICLE_12_2),
    ("제112조", "제112조(바람 열람)", Q_ARTICLE_112),
    ("무지개책은 며칠 동안 빌리나요", f"{SPLIT_TITLE} ②", Q_SPLIT_SECOND),
)


class ServeRejectionTests(unittest.TestCase):
    def assert_held(self, application, question):
        response = call_app(application, "POST", CHAT, json_body={"message": question})

        self.assertEqual(response.status, 200)
        body = response.json()
        self.assertIs(body["answered"], False)
        self.assertEqual(body["answer"], UNANSWERABLE_TEXT)
        self.assertEqual(body["citations"], [])

    def test_common_terms_return_guidance_without_citations(self):
        for case, environ in APPS:
            with self.subTest(case=case):
                self.assert_held(import_serve(environ).app, "가상의 날씨")

    def test_leave_question_is_held_instead_of_citing_an_unrelated_article(self):
        # 고치기 전에는 조사 '까지'만 겹친 제12조의2(별빛 열람 연장)를 답으로 냈다.
        self.assert_held(import_serve({}).app, LEAVE_QUESTION)

    def test_questions_outside_the_regulation_are_held(self):
        for case, environ in APPS:
            application = import_serve(environ).app
            for question in OFF_TOPIC_QUESTIONS:
                with self.subTest(case=case, question=question):
                    self.assert_held(application, question)

    def test_reworded_demo_questions_keep_their_citations(self):
        application = import_serve({}).app
        for question, article_path, snippet in REWORDED_DEMO_QUESTIONS:
            with self.subTest(question=question):
                response = call_app(
                    application, "POST", CHAT, json_body={"message": question}
                )

                self.assertEqual(response.status, 200)
                body = response.json()
                self.assertIs(body["answered"], True)
                self.assertEqual(body["answer"], snippet)
                self.assertEqual(body["citations"], [{
                    "article_path": article_path,
                    "document": DOCUMENT_TITLE,
                    "effective_date": EFFECTIVE_DATE.isoformat(),
                    "snippet": snippet,
                    "source_url": None,
                }])
