"""배포 앱이 색인의 공통어만 겹치는 질문에 답변을 보류하는지 확인한다."""

import unittest

from api.tests.asgi_harness import call_app
from api.tests.test_serve import MANIFEST_ENVIRON, import_serve

from app.services.chat_stub import UNANSWERABLE_TEXT


class ServeRejectionTests(unittest.TestCase):
    def test_common_terms_return_guidance_without_citations(self):
        cases = (("demo", {}), ("manifest", MANIFEST_ENVIRON))
        for case, environ in cases:
            with self.subTest(case=case):
                application = import_serve(environ).app
                response = call_app(
                    application, "POST", "/api/v1/chat", json_body={"message": "가상의 날씨"}
                )

                self.assertEqual(response.status, 200)
                body = response.json()
                self.assertIs(body["answered"], False)
                self.assertEqual(body["answer"], UNANSWERABLE_TEXT)
                self.assertEqual(body["citations"], [])
