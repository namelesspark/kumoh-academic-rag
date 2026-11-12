"""서버를 띄우지 않고 Render가 불러오는 앱에 직접 요청한다."""

import importlib
import json
import os
import sys
import unittest
from pathlib import Path
from unittest import mock

import api
from api.demo_regulation import DOCUMENT_TITLE, EFFECTIVE_DATE, SOURCE
from api.local_serve import MANIFEST_ENV
from api.regulation_app import chunk_articles
from api.tests.asgi_harness import call_app
from core.tests.retrieval_cases import CASES, CHUNK_PATHS, MISMATCH_QUERY, SOURCE as CASE_SOURCE

from app.main import app as default_app
from app.services.chat_stub import UNANSWERABLE_TEXT


MANIFEST = Path(__file__).parent / "fixtures" / "fictional_manifest.json"
MANIFEST_ENVIRON = {MANIFEST_ENV: str(MANIFEST)}
SERVE_MODULE = "api.serve"


def import_serve(environ):
    # 모듈과 패키지 양쪽의 캐시를 비워 모듈 수준 app을 매번 다시 만든다.
    package_attributes = vars(api)
    missing = object()
    previous_serve = package_attributes.pop("serve", missing)
    try:
        with mock.patch.dict(os.environ, environ, clear=True):
            with mock.patch.dict(sys.modules):
                sys.modules.pop(SERVE_MODULE, None)
                return importlib.import_module(SERVE_MODULE)
    finally:
        if previous_serve is missing:
            package_attributes.pop("serve", None)
        else:
            package_attributes["serve"] = previous_serve


class ServeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.serve = import_serve({})

    def test_demo_source_matches_question_table(self):
        self.assertEqual(SOURCE, CASE_SOURCE)
        chunks = chunk_articles(SOURCE, max_chars=self.serve.MAX_CHARS)
        self.assertEqual(tuple(chunk.article_path for chunk in chunks), CHUNK_PATHS)

    def test_empty_source_prevents_startup(self):
        with self.assertRaisesRegex(ValueError, "검색할 조각을 찾지 못했습니다"):
            self.serve.create_demo_app("")

    def test_deployed_app_cites_all_six_questions(self):
        application = self.serve.create_app({})
        self.assertEqual(len(CASES), 6)
        for case in CASES:
            with self.subTest(case=case.name):
                response = call_app(
                    application, "POST", "/api/v1/chat", json_body={"message": case.query}
                )
                self.assertEqual(response.status, 200)
                body = response.json()
                self.assertIs(body["answered"], True)
                self.assertEqual(body["citations"], [{
                    "article_path": case.article_path,
                    "document": DOCUMENT_TITLE,
                    "effective_date": EFFECTIVE_DATE.isoformat(),
                    "snippet": case.quote,
                    "source_url": None,
                }])

    def test_deployed_app_returns_guidance_for_unmatched_question(self):
        response = call_app(
            self.serve.app, "POST", "/api/v1/chat", json_body={"message": MISMATCH_QUERY}
        )
        self.assertEqual(response.status, 200)
        body = response.json()
        self.assertIs(body["answered"], False)
        self.assertEqual(body["answer"], UNANSWERABLE_TEXT)
        self.assertEqual(body["citations"], [])

    def test_health_reports_each_apps_chunk_count(self):
        for application, expected_count in ((self.serve.create_app({}), 9), (default_app, 0)):
            with self.subTest(chunk_count=expected_count):
                self.assert_health(application, expected_count)

    def assert_health(self, application, expected_count):
        response = call_app(application, "GET", "/api/v1/health")
        self.assertEqual(response.status, 200)
        self.assertEqual(response.json(), {
            "status": "ok",
            "index_loaded": expected_count > 0,
            "chunk_count": expected_count,
        })

    def test_configured_manifest_reports_total_and_cites_each_document(self):
        application = self.serve.create_app(MANIFEST_ENVIRON)
        self.assert_health(application, 3)
        cases = (
            ("제1조 망원경", {
                "article_path": "제1조(망원경 예약)",
                "document": "가상 달무리 천문대 규정",
                "effective_date": "2099-03-04",
                "snippet": "제1조(망원경 예약) 가상의 달무리 망원경은 사흘 전에 예약한다.",
                "source_url": "https://example.invalid/regulations/observatory",
            }),
            ("제1조 대패", {
                "article_path": "제1조(대패 사용)",
                "document": "가상 은여울 목공방 규정",
                "effective_date": "2098-11-20",
                "snippet": "제1조(대패 사용) 가상의 은여울 대패는 목공지기가 내어 준다.",
                "source_url": "https://example.invalid/regulations/woodshop",
            }),
        )
        for question, citation in cases:
            with self.subTest(question=question):
                response = call_app(
                    application, "POST", "/api/v1/chat", json_body={"message": question}
                )
                self.assertEqual(response.status, 200)
                body = response.json()
                self.assertIs(body["answered"], True)
                self.assertEqual(body["answer"], citation["snippet"])
                self.assertEqual(body["citations"], [citation])

    def test_empty_and_whitespace_manifest_settings_fail(self):
        with mock.patch.object(Path, "read_bytes", autospec=True) as read_bytes:
            for value in ("", " \t "):
                with self.subTest(value=value):
                    with self.assertRaises(ValueError) as caught:
                        self.serve.create_app({MANIFEST_ENV: value})
                    self.assertEqual(str(caught.exception), f"{MANIFEST_ENV}: 값이 비어 있습니다.")
            read_bytes.assert_not_called()

    def test_invalid_manifest_or_document_stops_startup(self):
        manifest_path = Path("가상-배포-입력") / "목록.json"
        first_path = manifest_path.parent / "천문대.txt"
        second_path = manifest_path.parent / "목공방.txt"
        document_fields = {
            "document_title": "가상 규정",
            "effective_date": "2099-01-01",
            "source_url": "https://example.invalid/fictional",
        }
        manifest = json.dumps({
            "documents": [
                {"path": first_path.name, **document_fields},
                {"path": second_path.name, **document_fields},
            ],
        }).encode("utf-8")
        first_source = "제1조(가상 망원경) 구름 너머를 살핀다."
        second_source = "조문 없이 적은 가상 목공방 메모"
        invalid_json = '{"documents": [ 가상 목록 원문'
        cases = (
            ("깨진 JSON", {manifest_path: invalid_json.encode("utf-8")},
             f"{MANIFEST_ENV}: JSON으로 읽을 수 없습니다."),
            ("읽기 실패", {
                manifest_path: manifest,
                first_path: first_source.encode("utf-8"),
                second_path: PermissionError(13, "Permission denied", str(second_path)),
            }, "documents[1].path: 파일을 읽을 수 없습니다 (PermissionError)."),
            ("조문 없음", {
                manifest_path: manifest,
                first_path: first_source.encode("utf-8"),
                second_path: second_source.encode("utf-8"),
            }, "documents[1]: 검색할 조각을 찾지 못했습니다."),
        )
        for case, files, expected_message in cases:
            def read_bytes(path):
                value = files[path]
                if isinstance(value, OSError):
                    raise value
                return value

            with self.subTest(case=case):
                with mock.patch.object(Path, "read_bytes", autospec=True, side_effect=read_bytes):
                    with self.assertRaises(ValueError) as caught:
                        self.serve.create_app({MANIFEST_ENV: str(manifest_path)})
                # 전체 문구를 비교해 경로나 원문이 덧붙으면 실패하게 한다.
                self.assertEqual(str(caught.exception), expected_message)

    def test_import_without_manifest_exports_demo_app(self):
        self.assert_health(import_serve({}).app, 9)

    def test_import_with_manifest_exports_configured_app(self):
        self.assert_health(import_serve(MANIFEST_ENVIRON).app, 3)

    def test_import_with_empty_manifest_setting_fails(self):
        with self.assertRaises(ValueError) as caught:
            import_serve({MANIFEST_ENV: ""})
        self.assertEqual(str(caught.exception), f"{MANIFEST_ENV}: 값이 비어 있습니다.")
