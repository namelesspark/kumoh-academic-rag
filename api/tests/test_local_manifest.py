"""로컬 시작점이 목록 파일 하나로 규정 여러 건을 읽어 채팅 검색에 잇는지 확인한다.

테스트는 두 묶음이다. 입력 묶음은 가짜 조립 함수를 넣어 목록 읽기와 검사만 본다.
통합 묶음은 추적하는 가상 파일과 실제 조립 함수로 응답까지 본다. 통합 묶음은
`api.regulation_app`에 `create_regulations_app`이 없는 체크아웃에서만 건너뛴다.

맨 앞 표식(BOM, Byte Order Mark), CRLF 줄바꿈, 깨진 바이트, 권한 오류는
`Path.read_bytes`를 가짜로 바꿔 확인하므로 작업 폴더에 임시 파일을 만들지 않는다.
모든 문장은 지어낸 것이고 실제 학칙과 관계가 없다.
"""

import json
import os
import sys
import types
import unittest
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from unittest import mock

from api import local_serve
from api.local_serve import MANIFEST_ENV, create_local_manifest_app
from api.tests.asgi_harness import call_app

API_DIR = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(API_DIR), str(API_DIR.parent / "core" / "src")]

from app.services.chat_stub import UNANSWERABLE_TEXT

try:
    from api import regulation_app
except ImportError:
    regulation_app = None

# 여러 문서를 받는 조립 함수는 다른 PR이 만든다.
HAS_MANIFEST_BUILDER = hasattr(regulation_app, "create_regulations_app")
SKIP_REASON = (
    "api.regulation_app에 create_regulations_app이 이 체크아웃에 아직 없어 건너뜀"
)

HEALTH = "/api/v1/health"
CHAT = "/api/v1/chat"
FIXTURES = Path(__file__).resolve().parent / "fixtures"
MANIFEST = FIXTURES / "fictional_manifest.json"
FIRST_FILE = "fictional_manifest_first.txt"
SECOND_FILE = "fictional_manifest_second.txt"

FIRST_TITLE = "가상 달무리 천문대 규정"
FIRST_DATE = "2099-03-04"
# example.invalid는 실제 사이트에 연결되지 않도록 예약해 둔 주소 이름이다.
FIRST_URL = "https://example.invalid/regulations/observatory"
SECOND_TITLE = "가상 은여울 목공방 규정"
SECOND_DATE = "2098-11-20"
SECOND_URL = "https://example.invalid/regulations/woodshop"

FIRST_ARTICLE_1_PATH = "제1조(망원경 예약)"
FIRST_ARTICLE_1 = "제1조(망원경 예약) 가상의 달무리 망원경은 사흘 전에 예약한다."
FIRST_ARTICLE_2_PATH = "제2조(별지도 대여)"
FIRST_ARTICLE_2 = "제2조(별지도 대여) 가상의 별지도는 이레 동안 빌린다."
SECOND_ARTICLE_1_PATH = "제1조(대패 사용)"
SECOND_ARTICLE_1 = "제1조(대패 사용) 가상의 은여울 대패는 목공지기가 내어 준다."

# 검색기는 두 글자 단위로도 견주므로 '가상'도 넣지 않는다.
MISMATCH_QUESTION = "얼룩말 풍금"

# 가짜 읽기에서 쓰는 목록 위치. 실제로는 없는 폴더다.
FAKE_DIR = Path("가상-목록-폴더")
FAKE_MANIFEST = FAKE_DIR / "목록.json"
FAKE_ENVIRON = {MANIFEST_ENV: str(FAKE_MANIFEST)}
SECRET = "가상-비밀-값"


def entry(**overrides):
    """올바른 항목 하나를 만들고, 받은 값만 바꾼다. None을 주면 그 필드를 뺀다."""

    values = {
        "path": "first.txt",
        "document_title": FIRST_TITLE,
        "effective_date": FIRST_DATE,
        "source_url": FIRST_URL,
    }
    for name, value in overrides.items():
        if value is None:
            del values[name]
        else:
            values[name] = value
    return values


def manifest_bytes(documents):
    return json.dumps({"documents": documents}, ensure_ascii=False).encode("utf-8")


@contextmanager
def fake_files(files):
    """`Path.read_bytes`가 경로별로 정한 바이트나 오류를 내게 하고, 읽은 경로를 모은다.

    적어 두지 않은 경로를 읽으면 KeyError가 나서 테스트가 바로 실패한다.
    """

    requested = []

    def read(path):
        requested.append(path)
        value = files[path]
        if isinstance(value, BaseException):
            raise value
        return value

    with mock.patch.object(Path, "read_bytes", autospec=True, side_effect=read):
        yield requested


def post_chat(test, app, question):
    # 서버를 띄우지 않고 앱을 파이썬 함수처럼 바로 부른다 (ASGI 직접 호출).
    response = call_app(app, "POST", CHAT, json_body={"message": question})
    test.assertEqual(response.status, 200)
    return response.json()


def citation(article_path, snippet, title, effective_date, source_url):
    return {
        "article_path": article_path,
        "document": title,
        "effective_date": effective_date,
        "snippet": snippet,
        "source_url": source_url,
    }


def first_citation(article_path, snippet):
    return citation(article_path, snippet, FIRST_TITLE, FIRST_DATE, FIRST_URL)


def second_citation(article_path, snippet):
    return citation(article_path, snippet, SECOND_TITLE, SECOND_DATE, SECOND_URL)


class RejectionMixin:
    """목록이 틀리면 조립 함수를 부르지 않고, 문구와 예외 연결에 입력이 남지 않는다."""

    def assert_rejected(self, files, name, reason=None, secrets=()):
        build = mock.Mock()
        with fake_files(files) as requested:
            with self.assertRaises(ValueError) as caught:
                create_local_manifest_app(FAKE_ENVIRON, build)
        error = caught.exception
        message = str(error)
        if reason is None:
            self.assertTrue(message.startswith(name + ": "), message)
        else:
            self.assertEqual(message, f"{name}: {reason}")
        for secret in (SECRET, str(FAKE_DIR), *secrets):
            self.assertNotIn(secret, message)
        # 원래 예외에는 경로·입력값·파일 내용이 실릴 수 있다.
        self.assertIsNone(error.__cause__)
        if error.__context__ is not None:
            self.assertTrue(error.__suppress_context__)
        build.assert_not_called()
        return requested

    def assert_manifest_rejected(self, data, name, reason=None, secrets=()):
        requested = self.assert_rejected({FAKE_MANIFEST: data}, name, reason, secrets)
        # 목록이 틀리면 규정 파일은 읽지 않는다.
        self.assertEqual(requested, [FAKE_MANIFEST])


class ManifestInputTests(unittest.TestCase):
    """올바른 목록은 약속한 모양으로 조립 함수에 한 번 전달된다."""

    def test_documents_reach_builder_once_in_order_with_bytes_preserved(self):
        # 규정 파일의 맨 앞 표식과 줄바꿈은 글자 위치를 맞추려고 그대로 둔다.
        first_text = f"﻿{FIRST_ARTICLE_1}\r\n{FIRST_ARTICLE_2}\r\n"
        second_text = f"{SECOND_ARTICLE_1}\n"
        title = " 가상 은여울 목공방 규정 (개정) "
        url = "https://Example.invalid:8443/regulations/woodshop?version=2#article-1"
        documents = [
            entry(),
            entry(
                path="아래/second.txt",
                document_title=title,
                effective_date=SECOND_DATE,
                source_url=url,
            ),
        ]
        files = {
            # 목록 파일의 맨 앞 표식은 떼고 읽는다.
            FAKE_MANIFEST: b"\xef\xbb\xbf" + manifest_bytes(documents),
            FAKE_DIR / "first.txt": first_text.encode("utf-8"),
            FAKE_DIR / "아래" / "second.txt": second_text.encode("utf-8"),
        }
        build = mock.Mock(return_value="가상 앱")

        with fake_files(files) as requested:
            result = create_local_manifest_app(FAKE_ENVIRON, build)

        self.assertEqual(result, "가상 앱")
        # 상대 경로는 목록 파일이 있는 폴더를 기준으로 푼다.
        self.assertEqual(requested, list(files))
        build.assert_called_once_with(
            [
                {
                    "source": first_text,
                    "document_title": FIRST_TITLE,
                    "effective_date": date(2099, 3, 4),
                    "source_url": FIRST_URL,
                },
                {
                    "source": second_text,
                    "document_title": title,
                    "effective_date": date(2098, 11, 20),
                    "source_url": url,
                },
            ]
        )

    def test_absolute_path_is_read_as_written(self):
        absolute = FIXTURES / "fictional_absolute.txt"
        files = {
            FAKE_MANIFEST: manifest_bytes([entry(path=str(absolute))]),
            absolute: FIRST_ARTICLE_1.encode("utf-8"),
        }
        build = mock.Mock()
        with fake_files(files) as requested:
            create_local_manifest_app(FAKE_ENVIRON, build)
        self.assertEqual(requested, [FAKE_MANIFEST, absolute])
        build.assert_called_once()

    def test_setting_comes_from_process_environment_by_default(self):
        files = {
            FAKE_MANIFEST: manifest_bytes([entry()]),
            FAKE_DIR / "first.txt": FIRST_ARTICLE_1.encode("utf-8"),
        }
        build = mock.Mock(return_value="가상 앱")
        with mock.patch.dict(os.environ, FAKE_ENVIRON), fake_files(files):
            result = create_local_manifest_app(build_app=build)
        self.assertEqual(result, "가상 앱")
        build.assert_called_once()

    def test_missing_or_blank_setting_fails_before_reading(self):
        for value in (None, "", " \t　"):
            with self.subTest(value=value):
                environ = {} if value is None else {MANIFEST_ENV: value}
                build = mock.Mock()
                with fake_files({}) as requested:
                    with self.assertRaisesRegex(ValueError, "^" + MANIFEST_ENV + ": "):
                        create_local_manifest_app(environ, build)
                self.assertEqual(requested, [])
                build.assert_not_called()

    def test_builder_exception_passes_through_unchanged(self):
        failure = RuntimeError("가상 조립 실패")
        files = {
            FAKE_MANIFEST: manifest_bytes([entry()]),
            FAKE_DIR / "first.txt": FIRST_ARTICLE_1.encode("utf-8"),
        }
        with fake_files(files):
            with self.assertRaises(RuntimeError) as caught:
                create_local_manifest_app(FAKE_ENVIRON, mock.Mock(side_effect=failure))
        self.assertIs(caught.exception, failure)


class ManifestFileTests(RejectionMixin, unittest.TestCase):
    """목록 파일 자체를 읽지 못하거나 뼈대가 틀린 경우."""

    def test_unreadable_manifest_fails(self):
        self.assert_manifest_rejected(
            PermissionError(13, "Permission denied", SECRET),
            MANIFEST_ENV,
            "파일을 읽을 수 없습니다 (PermissionError).",
        )

    def test_broken_utf8_manifest_fails(self):
        data = manifest_bytes([entry(document_title=SECRET)]) + b"\xff"
        self.assert_manifest_rejected(
            data, MANIFEST_ENV, "UTF-8로 읽을 수 없는 파일입니다."
        )

    def test_utf16_manifest_fails(self):
        # 바이트를 json.loads에 그대로 넘기면 UTF-16도 받아들인다. 그 길을 막았는지 본다.
        text = json.dumps({"documents": [entry()]}, ensure_ascii=True)
        self.assert_manifest_rejected(
            text.encode("utf-16"), MANIFEST_ENV, "UTF-8로 읽을 수 없는 파일입니다."
        )
        self.assert_manifest_rejected(
            text.encode("utf-16-le"), MANIFEST_ENV, "JSON으로 읽을 수 없습니다."
        )

    def test_broken_json_fails(self):
        whole = manifest_bytes([entry(document_title=SECRET)])
        for data in (
            b"",
            whole[:-2],
            whole + b"]",
            # 맨 앞 표식은 하나만 뗀다.
            b"\xef\xbb\xbf\xef\xbb\xbf" + whole,
            b"[" * 100_000,
        ):
            with self.subTest(size=len(data)):
                self.assert_manifest_rejected(
                    data, MANIFEST_ENV, "JSON으로 읽을 수 없습니다."
                )

    def test_field_written_twice_fails(self):
        item = json.dumps(entry(), ensure_ascii=False)
        twice = item[:-1] + f', "document_title": "{SECRET}"}}'
        for text in (
            f'{{"documents": [], "documents": [{item}]}}',
            f'{{"documents": [{twice}]}}',
        ):
            with self.subTest(text=text):
                self.assert_manifest_rejected(
                    text.encode("utf-8"), MANIFEST_ENV, "같은 필드를 두 번 적었습니다."
                )

    def test_top_level_must_be_object(self):
        for text in ("[]", f'"{SECRET}"', "null", "3"):
            with self.subTest(text=text):
                self.assert_manifest_rejected(
                    text.encode("utf-8"), MANIFEST_ENV, "최상위가 객체가 아닙니다."
                )

    def test_documents_field_is_required(self):
        for text in ("{}", f'{{"{SECRET}": []}}'):
            with self.subTest(text=text):
                self.assert_manifest_rejected(
                    text.encode("utf-8"), "documents", "필드가 없습니다."
                )

    def test_unknown_top_level_field_fails(self):
        data = json.dumps({"documents": [entry()], SECRET: 1}).encode("utf-8")
        self.assert_manifest_rejected(data, MANIFEST_ENV, "모르는 필드가 있습니다.")

    def test_documents_must_be_array(self):
        for value in ({}, SECRET, None, 3):
            with self.subTest(value=value):
                self.assert_manifest_rejected(
                    manifest_bytes(value), "documents", "배열이 아닙니다."
                )

    def test_empty_documents_fails(self):
        self.assert_manifest_rejected(
            manifest_bytes([]), "documents", "문서가 없습니다."
        )


class ManifestEntryTests(RejectionMixin, unittest.TestCase):
    """두 번째 항목이 틀리면 0부터 센 항목 번호 1과 필드명으로 알려 준다."""

    def assert_second_rejected(self, second, name, reason=None, secrets=()):
        data = manifest_bytes([entry(), second])
        self.assert_manifest_rejected(data, name, reason, secrets)

    def test_entry_must_be_object(self):
        for value in (SECRET, [], None, 3):
            with self.subTest(value=value):
                self.assert_second_rejected(value, "documents[1]", "객체가 아닙니다.")

    def test_each_missing_field_fails(self):
        for field in entry():
            with self.subTest(field=field):
                self.assert_second_rejected(
                    entry(**{field: None}), f"documents[1].{field}", "필드가 없습니다."
                )

    def test_each_non_string_field_fails(self):
        for field in entry():
            for value in (3, True, [SECRET], {"값": SECRET}):
                with self.subTest(field=field, value=value):
                    self.assert_second_rejected(
                        entry(**{field: value}),
                        f"documents[1].{field}",
                        "문자열이 아닙니다.",
                    )

    def test_null_field_fails(self):
        # entry()에서 None은 필드를 빼라는 뜻이라 따로 만든다.
        for field in entry():
            with self.subTest(field=field):
                second = entry()
                second[field] = None
                self.assert_second_rejected(
                    second, f"documents[1].{field}", "문자열이 아닙니다."
                )

    def test_each_blank_field_fails(self):
        for field in entry():
            for value in ("", " \t　"):
                with self.subTest(field=field, value=value):
                    self.assert_second_rejected(
                        entry(**{field: value}),
                        f"documents[1].{field}",
                        "값이 비어 있습니다.",
                    )

    def test_unknown_field_fails(self):
        # 필드 이름을 잘못 적으면 빠진 필드보다 먼저 알려 준다.
        typo = entry(document_title=None)
        typo["document_titel"] = SECRET
        for second in (typo, {**entry(), SECRET: SECRET}):
            with self.subTest(fields=sorted(second)):
                self.assert_second_rejected(
                    second,
                    "documents[1]",
                    "모르는 필드가 있습니다.",
                    secrets=("document_titel",),
                )

    def test_invalid_effective_dates_fail(self):
        cases = (
            ("2099-02-30", "달력에 없는 날짜입니다."),
            ("0000-01-01", "달력에 없는 날짜입니다."),
            ("20990203", "YYYY-MM-DD 모양이 아닙니다."),
            ("2099-W05-2", "YYYY-MM-DD 모양이 아닙니다."),
            ("2099-2-3", "YYYY-MM-DD 모양이 아닙니다."),
            ("2099-02-03\n", "YYYY-MM-DD 모양이 아닙니다."),
            ("2099-02-03T00:00", "YYYY-MM-DD 모양이 아닙니다."),
        )
        for value, reason in cases:
            with self.subTest(value=value):
                self.assert_second_rejected(
                    entry(effective_date=value),
                    "documents[1].effective_date",
                    reason,
                    secrets=(value,),
                )

    def test_invalid_source_urls_fail(self):
        values = (
            "http://example.invalid/regulations",
            "example.invalid/regulations",
            "https:///regulations",
            "https://reader:secret@example.invalid/regulations",
            "https://example.invalid/가상 규정",
            "https://example.invalid:port/regulations",
            "https://example.invalid/regulations\x00",
            "https://./regulations",
            "https://256.256.256.256/regulations",
        )
        for value in values:
            with self.subTest(value=value):
                self.assert_second_rejected(
                    entry(source_url=value),
                    "documents[1].source_url",
                    secrets=(value,),
                )

    def test_first_entry_is_numbered_zero(self):
        data = manifest_bytes([entry(effective_date="2099-02-30"), entry()])
        self.assert_manifest_rejected(
            data, "documents[0].effective_date", "달력에 없는 날짜입니다."
        )


class RegulationFileTests(RejectionMixin, unittest.TestCase):
    """두 번째 규정 파일을 읽지 못하면 조립 함수를 부르지 않는다."""

    def assert_second_file_rejected(self, value, reason, path="second.txt"):
        files = {
            FAKE_MANIFEST: manifest_bytes([entry(), entry(path=path)]),
            FAKE_DIR / "first.txt": FIRST_ARTICLE_1.encode("utf-8"),
            FAKE_DIR / path: value,
        }
        requested = self.assert_rejected(
            files, "documents[1].path", reason, secrets=("second", "비밀 대패")
        )
        self.assertEqual(requested, list(files))

    def test_unreadable_file_fails(self):
        self.assert_second_file_rejected(
            PermissionError(13, "Permission denied", SECRET),
            "파일을 읽을 수 없습니다 (PermissionError).",
        )

    def test_missing_file_fails(self):
        self.assert_second_file_rejected(
            FileNotFoundError(2, "No such file or directory", SECRET),
            "파일을 읽을 수 없습니다 (FileNotFoundError).",
        )

    def test_path_with_null_character_fails(self):
        # 널 문자(코드 0)가 든 경로는 파일을 열 때 OSError가 아니라 ValueError가 난다.
        self.assert_second_file_rejected(
            ValueError("embedded null character"),
            "파일을 읽을 수 없습니다 (ValueError).",
            path="second" + chr(0) + ".txt",
        )

    def test_broken_utf8_fails(self):
        data = "제1조(비밀 대패) 가상의 비밀 대패 문장.".encode("utf-8") + b"\xff"
        self.assert_second_file_rejected(data, "UTF-8로 읽을 수 없는 파일입니다.")


class DefaultBuilderTests(unittest.TestCase):
    """`build_app`을 주지 않으면 약속한 조립 함수를 문서 목록 하나로 한 번 부른다."""

    environ = {MANIFEST_ENV: str(MANIFEST)}

    def test_default_builder_is_called_once_with_agreed_documents(self):
        fake_module = types.ModuleType("api.regulation_app")
        fake_module.create_regulations_app = mock.Mock(return_value="가상 앱")

        with mock.patch.dict(sys.modules, {"api.regulation_app": fake_module}):
            result = create_local_manifest_app(self.environ)

        self.assertEqual(result, "가상 앱")
        fake_module.create_regulations_app.assert_called_once_with(
            [
                {
                    "source": (FIXTURES / FIRST_FILE).read_bytes().decode("utf-8"),
                    "document_title": FIRST_TITLE,
                    "effective_date": date(2099, 3, 4),
                    "source_url": FIRST_URL,
                },
                {
                    "source": (FIXTURES / SECOND_FILE).read_bytes().decode("utf-8"),
                    "document_title": SECOND_TITLE,
                    "effective_date": date(2098, 11, 20),
                    "source_url": SECOND_URL,
                },
            ]
        )

    def test_missing_builder_module_fails_with_module_name(self):
        # sys.modules에 None을 넣으면 그 이름을 불러올 때 ModuleNotFoundError가 난다.
        with mock.patch.dict(sys.modules, {"api.regulation_app": None}):
            with self.assertRaises(ValueError) as caught:
                create_local_manifest_app(self.environ)
        message = str(caught.exception)
        self.assertTrue(message.startswith("api.regulation_app:"), message)
        self.assertNotIn(FIRST_ARTICLE_1, message)

    def test_missing_builder_function_fails_with_function_name(self):
        # 한 건짜리 조립 함수만 있는 체크아웃에서는 무엇이 빠졌는지 알려 주고 멈춘다.
        fake_module = types.ModuleType("api.regulation_app")
        fake_module.create_regulation_app = mock.Mock()

        with mock.patch.dict(sys.modules, {"api.regulation_app": fake_module}):
            with self.assertRaises(ValueError) as caught:
                create_local_manifest_app(self.environ)
        message = str(caught.exception)
        self.assertTrue(
            message.startswith("api.regulation_app: create_regulations_app"), message
        )
        self.assertNotIn(FIRST_ARTICLE_1, message)
        fake_module.create_regulation_app.assert_not_called()

    def test_missing_dependency_inside_builder_module_is_not_hidden(self):
        failure = ModuleNotFoundError("가상 모듈 없음", name="fictional_dependency")
        with mock.patch.object(local_serve, "import_module", side_effect=failure):
            with self.assertRaises(ModuleNotFoundError) as caught:
                create_local_manifest_app(self.environ)
        self.assertIs(caught.exception, failure)


class TrackedFixtureTests(unittest.TestCase):
    """추적하는 가상 파일이 테스트가 기대하는 내용인지 본다."""

    def test_manifest_lists_two_fictional_documents_by_relative_path(self):
        manifest = json.loads(MANIFEST.read_bytes().decode("utf-8"))
        self.assertEqual(
            manifest,
            {
                "documents": [
                    {
                        "path": FIRST_FILE,
                        "document_title": FIRST_TITLE,
                        "effective_date": FIRST_DATE,
                        "source_url": FIRST_URL,
                    },
                    {
                        "path": SECOND_FILE,
                        "document_title": SECOND_TITLE,
                        "effective_date": SECOND_DATE,
                        "source_url": SECOND_URL,
                    },
                ]
            },
        )

    def test_regulation_files_keep_one_article_per_line(self):
        # 조문이 한 줄씩이면 내려받을 때 줄바꿈이 바뀌어도 인용이 같다.
        expected = {
            FIRST_FILE: [FIRST_TITLE, "", FIRST_ARTICLE_1, FIRST_ARTICLE_2],
            SECOND_FILE: [SECOND_TITLE, "", SECOND_ARTICLE_1],
        }
        for name, lines in expected.items():
            with self.subTest(name=name):
                text = (FIXTURES / name).read_bytes().decode("utf-8")
                self.assertEqual(text.splitlines(), lines)


@unittest.skipUnless(HAS_MANIFEST_BUILDER, SKIP_REASON)
class IntegrationTests(unittest.TestCase):
    """README의 실행 방법 그대로, 추적하는 가상 목록과 실제 조립 함수로 응답까지 본다."""

    @classmethod
    def setUpClass(cls):
        cls.app = create_local_manifest_app({MANIFEST_ENV: str(MANIFEST)})

    def assert_cited(self, question, expected):
        body = post_chat(self, self.app, question)
        self.assertIs(body["answered"], True)
        self.assertEqual(body["answer"], expected["snippet"])
        self.assertEqual(body["citations"], [expected])

    def test_health_reports_sum_of_chunks(self):
        response = call_app(self.app, "GET", HEALTH)
        self.assertEqual(response.status, 200)
        # 첫 문서 두 조각과 둘째 문서 한 조각.
        self.assertEqual(
            response.json(), {"status": "ok", "index_loaded": True, "chunk_count": 3}
        )

    def test_each_document_is_cited_with_its_own_title_date_and_link(self):
        cases = (
            (
                "망원경은 며칠 전에 예약하나요",
                first_citation(FIRST_ARTICLE_1_PATH, FIRST_ARTICLE_1),
            ),
            (
                "별지도는 며칠 동안 빌리나요",
                first_citation(FIRST_ARTICLE_2_PATH, FIRST_ARTICLE_2),
            ),
            (
                "대패는 누가 내어 주나요",
                second_citation(SECOND_ARTICLE_1_PATH, SECOND_ARTICLE_1),
            ),
        )
        for question, expected in cases:
            with self.subTest(question=question):
                self.assert_cited(question, expected)

    def test_same_article_number_is_told_apart_by_document(self):
        # 두 문서 모두 제1조가 있다. 조 번호를 적은 질문도 주제가 맞는 문서를 인용한다.
        cases = (
            ("제1조 망원경", first_citation(FIRST_ARTICLE_1_PATH, FIRST_ARTICLE_1)),
            ("제1조 대패", second_citation(SECOND_ARTICLE_1_PATH, SECOND_ARTICLE_1)),
        )
        for question, expected in cases:
            with self.subTest(question=question):
                self.assert_cited(question, expected)

    def test_unmatched_question_returns_existing_guidance(self):
        body = post_chat(self, self.app, MISMATCH_QUESTION)
        self.assertIs(body["answered"], False)
        self.assertEqual(body["answer"], UNANSWERABLE_TEXT)
        self.assertEqual(body["citations"], [])

    def test_document_without_articles_stops_startup(self):
        text = "가상의 조문 없는 비밀 글\n"
        files = {
            FAKE_MANIFEST: manifest_bytes(
                [entry(), entry(path="second.txt", document_title=SECOND_TITLE)]
            ),
            FAKE_DIR / "first.txt": f"{FIRST_ARTICLE_1}\n".encode("utf-8"),
            FAKE_DIR / "second.txt": text.encode("utf-8"),
        }
        with fake_files(files):
            with self.assertRaises(ValueError) as caught:
                create_local_manifest_app(FAKE_ENVIRON)
        # 조립 함수가 낸 문구가 그대로 나온다. 문서명과 원문은 들어 있지 않다.
        self.assertEqual(
            str(caught.exception), "documents[1]: 검색할 조각을 찾지 못했습니다."
        )


if __name__ == "__main__":
    unittest.main()
