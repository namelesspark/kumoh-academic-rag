"""로컬 시작점이 설정 네 개와 규정 파일 한 건을 읽어 채팅 검색에 잇는지 확인한다.

추적하는 가상 파일은 실제로 읽는다. 맨 앞 표식(BOM, Byte Order Mark), CRLF 줄바꿈,
깨진 바이트, 권한 오류는 `Path.read_bytes`를 가짜로 바꿔 확인하므로 작업 폴더에
임시 파일을 만들지 않는다. 모든 문장은 지어낸 것이고 실제 학칙과 관계가 없다.
"""

import os
import sys
import types
import unittest
from datetime import date
from importlib.util import find_spec
from pathlib import Path
from unittest import mock

from api import local_serve
from api.local_serve import create_local_app
from api.tests.asgi_harness import call_app

API_DIR = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(API_DIR), str(API_DIR.parent / "core" / "src")]

from app.main import create_app
from app.services.chat_retrieval import ChatRetrieval
from app.services.chat_stub import UNANSWERABLE_TEXT
from kumoh_rag_core.chunking import chunk_articles
from kumoh_rag_core.retrieval import BM25Retriever


HEALTH = "/api/v1/health"
CHAT = "/api/v1/chat"
FIXTURE = Path(__file__).resolve().parent / "fixtures" / "fictional_regulation.txt"

TITLE = "가상 솔바람 온실 규정"
EFFECTIVE_DATE = "2099-03-04"
# example.invalid는 실제 사이트에 연결되지 않도록 예약해 둔 주소 이름이다.
SOURCE_URL = "https://example.invalid/regulations/greenhouse"

ARTICLE_1_PATH = "제1조(씨앗 나눔)"
ARTICLE_1 = "제1조(씨앗 나눔) 가상의 솔바람 씨앗은 온실지기가 나눠 준다."
ARTICLE_2_PATH = "제2조(물뿌리개 대여)"
ARTICLE_2 = "제2조(물뿌리개 대여) 가상의 물뿌리개는 나흘 동안 빌린다."
ARTICLE_1_QUESTION = "씨앗은 누가 나눠 주나요"
ARTICLE_2_QUESTION = "물뿌리개는 며칠 동안 빌리나요"
# 검색기는 두 글자 단위로도 견주므로 '가상'도 넣지 않는다.
MISMATCH_QUESTION = "얼룩말 풍금"

NO_CHUNKS_MESSAGE = "검색할 조각을 찾지 못했습니다"

# 앱 조립 모듈은 다른 PR이 만든다. 그 모듈이 있는 체크아웃에서만 실제 기본 경로를 확인한다.
HAS_BUILDER_MODULE = find_spec("api.regulation_app") is not None


def settings(**overrides):
    """올바른 설정 네 개를 만들고, 받은 값만 바꾼다. None을 주면 그 설정을 뺀다."""

    values = {
        local_serve.PATH_ENV: str(FIXTURE),
        local_serve.TITLE_ENV: TITLE,
        local_serve.EFFECTIVE_DATE_ENV: EFFECTIVE_DATE,
        local_serve.SOURCE_URL_ENV: SOURCE_URL,
    }
    for name, value in overrides.items():
        if value is None:
            del values[name]
        else:
            values[name] = value
    return values


def build_from_main(source, *, document_title, effective_date, source_url, max_chars=1000):
    """main에 이미 있는 분할기·검색기·인용·앱 생성을 이은 조립 함수."""

    chunks = chunk_articles(source, max_chars=max_chars)
    if not chunks:
        raise ValueError(f"{NO_CHUNKS_MESSAGE}.")
    retriever = BM25Retriever(chunks)
    return create_app(
        chat_retrieval=ChatRetrieval(
            search=retriever.retrieve,
            source=source,
            document_title=document_title,
            effective_date=effective_date,
            source_url=source_url,
        ),
        chunk_count=len(chunks),
    )


def fake_read(data=None, error=None):
    """`Path.read_bytes`가 파일 대신 정한 바이트나 오류를 내게 한다."""

    return mock.patch.object(Path, "read_bytes", return_value=data, side_effect=error)


def post_chat(test, app, question):
    # 서버를 띄우지 않고 앱을 파이썬 함수처럼 바로 부른다 (ASGI 직접 호출).
    response = call_app(app, "POST", CHAT, json_body={"message": question})
    test.assertEqual(response.status, 200)
    return response.json()


def citation(article_path, snippet):
    return {
        "article_path": article_path,
        "document": TITLE,
        "effective_date": EFFECTIVE_DATE,
        "snippet": snippet,
        "source_url": SOURCE_URL,
    }


class TrackedFileTests(unittest.TestCase):
    """추적하는 가상 파일을 실제로 읽어 응답까지 본다."""

    @classmethod
    def setUpClass(cls):
        cls.app = create_local_app(settings(), build_from_main)

    def test_fixture_keeps_one_article_per_line(self):
        # 조문이 한 줄씩이면 내려받을 때 줄바꿈이 바뀌어도 인용이 같다.
        lines = FIXTURE.read_bytes().decode("utf-8").splitlines()
        self.assertEqual(lines, [TITLE, "", ARTICLE_1, ARTICLE_2])

    def test_health_reports_two_chunks(self):
        response = call_app(self.app, "GET", HEALTH)
        self.assertEqual(response.status, 200)
        self.assertEqual(
            response.json(), {"status": "ok", "index_loaded": True, "chunk_count": 2}
        )

    def test_question_returns_one_verbatim_citation(self):
        body = post_chat(self, self.app, ARTICLE_2_QUESTION)
        self.assertIs(body["answered"], True)
        self.assertEqual(body["answer"], ARTICLE_2)
        self.assertEqual(body["citations"], [citation(ARTICLE_2_PATH, ARTICLE_2)])

    def test_unmatched_question_returns_existing_guidance(self):
        body = post_chat(self, self.app, MISMATCH_QUESTION)
        self.assertIs(body["answered"], False)
        self.assertEqual(body["answer"], UNANSWERABLE_TEXT)
        self.assertEqual(body["citations"], [])

    def test_settings_come_from_process_environment_by_default(self):
        with mock.patch.dict(os.environ, settings()):
            app = create_local_app(build_app=build_from_main)
        self.assertEqual(call_app(app, "GET", HEALTH).json()["chunk_count"], 2)


class SourceBytesTests(unittest.TestCase):
    """파일 바이트를 가짜로 넣어 읽기 단계를 확인한다."""

    def test_bom_and_crlf_keep_first_article_and_verbatim_quotes(self):
        text = f"﻿{ARTICLE_1}\r\n{ARTICLE_2}\r\n"
        received = []

        def build(source, **kwargs):
            received.append(source)
            return build_from_main(source, **kwargs)

        with fake_read(text.encode("utf-8")):
            app = create_local_app(settings(), build)

        # 맨 앞 표식과 줄바꿈을 바꾸지 않고 넘겨야 글자 위치가 맞는다.
        self.assertEqual(received, [text])
        self.assertEqual(call_app(app, "GET", HEALTH).json()["chunk_count"], 2)
        for question, path, quote in (
            (ARTICLE_1_QUESTION, ARTICLE_1_PATH, ARTICLE_1),
            (ARTICLE_2_QUESTION, ARTICLE_2_PATH, ARTICLE_2),
        ):
            with self.subTest(article=path):
                body = post_chat(self, app, question)
                self.assertEqual(body["answer"], quote)
                self.assertEqual(body["citations"], [citation(path, quote)])

    def test_unreadable_path_fails_without_leaking_details(self):
        error = PermissionError(13, "Permission denied", "가상-비밀-경로")
        with fake_read(error=error):
            with self.assertRaises(ValueError) as caught:
                create_local_app(settings(), build_from_main)
        message = str(caught.exception)
        self.assertTrue(message.startswith(local_serve.PATH_ENV + ":"), message)
        self.assertNotIn("가상-비밀-경로", message)
        self.assertIsNone(caught.exception.__cause__)
        self.assertTrue(caught.exception.__suppress_context__)

    def test_missing_file_fails(self):
        missing = FIXTURE.with_name("fictional_missing.txt")
        with self.assertRaisesRegex(ValueError, "^" + local_serve.PATH_ENV):
            create_local_app(settings(**{local_serve.PATH_ENV: str(missing)}), build_from_main)

    def test_path_with_null_character_fails_with_setting_name(self):
        # 널 문자(코드 0)가 든 경로는 파일을 열기 전에 ValueError가 난다. 가짜 없이 확인한다.
        path = "fictional" + chr(0) + ".txt"
        with self.assertRaises(ValueError) as caught:
            create_local_app(settings(**{local_serve.PATH_ENV: path}), build_from_main)
        message = str(caught.exception)
        self.assertTrue(message.startswith(local_serve.PATH_ENV + ":"), message)
        self.assertNotIn(chr(0), message)
        self.assertNotIn("fictional", message)
        self.assertIsNone(caught.exception.__cause__)
        self.assertTrue(caught.exception.__suppress_context__)

    def test_broken_utf8_fails_without_leaking_content(self):
        data = "제1조(비밀 씨앗) 가상의 비밀 문장.".encode("utf-8") + b"\xff"
        with fake_read(data):
            with self.assertRaises(ValueError) as caught:
                create_local_app(settings(), build_from_main)
        message = str(caught.exception)
        self.assertTrue(message.startswith(local_serve.PATH_ENV + ":"), message)
        self.assertNotIn("비밀", message)
        self.assertIsNone(caught.exception.__cause__)
        self.assertTrue(caught.exception.__suppress_context__)

    def test_source_without_articles_raises_builder_error(self):
        with fake_read("가상의 조문 없는 글\n".encode("utf-8")):
            with self.assertRaisesRegex(ValueError, NO_CHUNKS_MESSAGE):
                create_local_app(settings(), build_from_main)

    def test_builder_exception_passes_through_unchanged(self):
        failure = RuntimeError("가상 조립 실패")

        def build(source, **kwargs):
            raise failure

        with fake_read(ARTICLE_1.encode("utf-8")):
            with self.assertRaises(RuntimeError) as caught:
                create_local_app(settings(), build)
        self.assertIs(caught.exception, failure)


class SettingTests(unittest.TestCase):
    """설정이 틀리면 파일을 읽기 전에 실패한다."""

    def assert_rejected(self, name, value):
        build = mock.Mock()
        with fake_read(ARTICLE_1.encode("utf-8")) as read_bytes:
            with self.assertRaises(ValueError) as caught:
                create_local_app(settings(**{name: value}), build)
        message = str(caught.exception)
        self.assertTrue(message.startswith(name + ":"), message)
        if value and value.strip():
            # 문구에는 설정 이름과 이유만 담고 입력값은 담지 않는다.
            self.assertNotIn(value, message)
        read_bytes.assert_not_called()
        build.assert_not_called()

    def test_each_missing_or_blank_setting_fails(self):
        names = (
            local_serve.PATH_ENV,
            local_serve.TITLE_ENV,
            local_serve.EFFECTIVE_DATE_ENV,
            local_serve.SOURCE_URL_ENV,
        )
        for name in names:
            for value in (None, "", " \t　"):
                with self.subTest(name=name, value=value):
                    self.assert_rejected(name, value)

    def test_missing_settings_in_process_environment_fail(self):
        with mock.patch.dict(os.environ, clear=True):
            with self.assertRaisesRegex(ValueError, "^" + local_serve.PATH_ENV):
                create_local_app(build_app=mock.Mock())

    def test_invalid_effective_dates_fail(self):
        # 20990203과 2099-W05-2는 Python 3.11부터 date.fromisoformat이 받는 표기다.
        values = (
            "2099-02-30",
            "20990203",
            "2099-W05-2",
            "2099-2-3",
            "2099-02-03\n",
            " 2099-02-03",
            "2099-02-03T00:00",
            "0000-01-01",
        )
        for value in values:
            with self.subTest(value=value):
                self.assert_rejected(local_serve.EFFECTIVE_DATE_ENV, value)

    def test_invalid_source_urls_fail(self):
        values = (
            "http://example.invalid/regulations",
            "example.invalid/regulations",
            "https:///regulations",
            "https://",
            "https://reader:secret@example.invalid/regulations",
            "https://reader@example.invalid/regulations",
            "https://@example.invalid/regulations",
            "https://example.invalid/가상 규정",
            "https://example.invalid/regulations\n",
            "https://example.invalid:port/regulations",
            # urlsplit은 맨 앞의 제어 문자를 지우고 나누므로 따로 막아야 한다.
            "\x01https://example.invalid/regulations",
            "https://example.invalid/regulations\x00",
            "https://example.invalid/\x7fregulations",
            # urlsplit은 역슬래시 같은 글자도 호스트로 돌려주므로 이름 모양을 따로 막아야 한다.
            "https://" + chr(92),
            "https://" + chr(92) + "/regulations",
            "https://example.invalid" + chr(92) + "regulations",
            "https://%65xample.invalid/regulations",
            "https://./regulations",
            # 대괄호 안에는 IPv6 주소만 받는다.
            "https://[v1.a]/regulations",
            "https://[2001:db8::zz]/regulations",
            "https://[fe80::1%25eth0]/regulations",
            # 마지막 마디가 숫자면 숫자 주소(IPv4)로 읽으므로 범위와 모양이 맞아야 한다.
            "https://256.256.256.256/regulations",
            "https://192.0.2/regulations",
            "https://example.123/regulations",
            "​https://example.invalid/regulations",
        )
        for value in values:
            with self.subTest(value=value):
                self.assert_rejected(local_serve.SOURCE_URL_ENV, value)

    def test_valid_source_urls_reach_builder_unchanged(self):
        values = (
            "https://[2001:db8::1]/regulations",
            "https://[2001:DB8::1]:8443/regulations",
            "https://example.invalid./regulations",
            "https://example.invalid.:8443/regulations",
            "https://192.0.2.7/regulations",
            "https://192.0.2.7./regulations",
            "https://sub-domain.example.invalid/regulations",
            "https://가상.invalid/regulations",
        )
        for value in values:
            with self.subTest(value=value):
                build = mock.Mock(return_value="가상 앱")
                environ = settings(**{local_serve.SOURCE_URL_ENV: value})
                with fake_read(ARTICLE_1.encode("utf-8")):
                    create_local_app(environ, build)
                build.assert_called_once_with(
                    ARTICLE_1,
                    document_title=TITLE,
                    effective_date=date(2099, 3, 4),
                    source_url=value,
                )

    def test_valid_settings_reach_builder_unchanged(self):
        build = mock.Mock(return_value="가상 앱")
        title = " 가상 솔바람 온실 규정 (개정) "
        # 대문자가 섞인 호스트도 받고, 넘길 때는 입력한 글자 그대로 둔다.
        url = "https://Example.invalid:8443/regulations/greenhouse?version=2#article-1"
        environ = settings(
            **{local_serve.TITLE_ENV: title, local_serve.SOURCE_URL_ENV: url}
        )
        with fake_read(ARTICLE_1.encode("utf-8")) as read_bytes:
            result = create_local_app(environ, build)
        self.assertEqual(result, "가상 앱")
        read_bytes.assert_called_once_with()
        build.assert_called_once_with(
            ARTICLE_1,
            document_title=title,
            effective_date=date(2099, 3, 4),
            source_url=url,
        )


class DefaultBuilderTests(unittest.TestCase):
    """`build_app`을 주지 않으면 약속한 조립 함수를 약속한 인자 이름으로 한 번 부른다."""

    def test_default_builder_is_called_once_with_agreed_argument_names(self):
        fake_module = types.ModuleType("api.regulation_app")
        fake_module.create_regulation_app = mock.Mock(return_value="가상 앱")

        with mock.patch.dict(sys.modules, {"api.regulation_app": fake_module}):
            result = create_local_app(settings())

        self.assertEqual(result, "가상 앱")
        fake_module.create_regulation_app.assert_called_once_with(
            FIXTURE.read_bytes().decode("utf-8"),
            document_title=TITLE,
            effective_date=date(2099, 3, 4),
            source_url=SOURCE_URL,
        )

    def test_missing_builder_module_fails_with_module_name(self):
        # sys.modules에 None을 넣으면 그 이름을 불러올 때 ModuleNotFoundError가 난다.
        with mock.patch.dict(sys.modules, {"api.regulation_app": None}):
            with self.assertRaises(ValueError) as caught:
                create_local_app(settings())
        message = str(caught.exception)
        self.assertTrue(message.startswith("api.regulation_app:"), message)
        self.assertNotIn(ARTICLE_1, message)

    def test_missing_dependency_inside_builder_module_is_not_hidden(self):
        failure = ModuleNotFoundError("가상 모듈 없음", name="fictional_dependency")
        with mock.patch.object(local_serve, "import_module", side_effect=failure):
            with self.assertRaises(ModuleNotFoundError) as caught:
                create_local_app(settings())
        self.assertIs(caught.exception, failure)

    @unittest.skipUnless(
        HAS_BUILDER_MODULE, "api.regulation_app이 이 체크아웃에 아직 없어 건너뜀"
    )
    def test_documented_startup_answers_from_tracked_file(self):
        # README의 실행 방법 그대로, 조립 함수를 주지 않고 실제 모듈로 앱을 만든다.
        app = create_local_app(settings())

        self.assertEqual(
            call_app(app, "GET", HEALTH).json(),
            {"status": "ok", "index_loaded": True, "chunk_count": 2},
        )
        body = post_chat(self, app, ARTICLE_2_QUESTION)
        self.assertEqual(body["answer"], ARTICLE_2)
        self.assertEqual(body["citations"], [citation(ARTICLE_2_PATH, ARTICLE_2)])


if __name__ == "__main__":
    unittest.main()
