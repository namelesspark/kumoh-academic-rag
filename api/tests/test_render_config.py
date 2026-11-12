"""배포 설정 파일과 배포 문서가 서로 어긋나지 않는지 확인한다.

Render는 저장소의 `render.yaml`을 읽어 서버를 시작한다. 사람은 `RENDER_DEPLOY.md`를
읽고 설정을 넣는다. 둘 중 하나만 바뀌면 문서를 따라 한 사람이 다른 결과를 본다.
이 테스트는 두 파일과 코드가 같은 시작 명령, 같은 설정 이름, 같은 숫자를 말하는지 본다.

확인할 것은 줄 몇 개뿐이라 YAML 읽기 패키지 없이 줄 단위 문자열 검사만 쓴다.
배포 진입점(`api.serve`)은 불러오지 않는다. 진입점은 불러올 때 환경을 읽어 앱을 만들기
때문이다. 문서의 예시는 진입점이 쓰는 목록 로더를 직접 불러 확인한다.
읽는 파일은 저장소가 추적하는 가상 파일뿐이고 실제 학칙과 관계가 없다.
"""

import re
import unittest
from pathlib import Path

from api.local_serve import MANIFEST_ENV, create_local_manifest_app
from api.tests.asgi_harness import call_app

REPO_ROOT = Path(__file__).resolve().parents[2]
RENDER_YAML = REPO_ROOT / "render.yaml"
DEPLOY_DOC = REPO_ROOT / "api" / "docs" / "RENDER_DEPLOY.md"

# uvicorn이 `모듈:속성` 문자열로 받는 배포 진입점.
ENTRY_POINT = "api.serve:app"
SERVICE_COUNT = 2
HEALTH = "/api/v1/health"

_START_COMMAND_KEY = "startCommand:"
_DOC_START_COMMAND = re.compile(r"^\| Start Command \| `([^`]+)` \|$", re.MULTILINE)
# 이 프로젝트의 설정 이름은 모두 KUMOH_로 시작한다. 오타 난 이름도 함께 잡힌다.
_SETTING_NAME = re.compile(r"KUMOH_[A-Z0-9_]+")
# 문서의 표에서 설정 이름 옆 칸에 적힌 값 전체. 배포 담당자가 그대로 복사해 넣는 글자다.
# 경로의 뒷부분만 찾으면 앞에 다른 폴더가 붙은 틀린 값도 통과한다.
_DOC_MANIFEST_VALUE = re.compile(
    r"^\| `" + re.escape(MANIFEST_ENV) + r"` \| `([^`]+)` \|$", re.MULTILINE
)
FIXTURES = REPO_ROOT / "api" / "tests" / "fixtures"
_CHUNK_COUNT = re.compile(r"chunk_count=([0-9]+)")
_SECTION_START = re.compile(r"^## ", re.MULTILINE)
# 문서가 `설정 이름: 사유` 모양으로 적은 오류 문구.
_DOC_ERROR = re.compile(r"`(" + re.escape(MANIFEST_ENV) + r": [^`]+)`")


def read_text(path: Path) -> str:
    # 윈도우에서 내려받으면 줄 끝이 CRLF일 수 있다. 줄 끝을 보는 검사가 내려받은
    # 방식에 좌우되지 않게 LF로 맞춘다.
    return path.read_bytes().decode("utf-8").replace("\r\n", "\n")


def start_commands(render_text: str) -> list[str]:
    """`render.yaml`에서 서비스마다 한 줄씩 있는 시작 명령을 모은다."""

    commands = []
    for line in render_text.splitlines():
        stripped = line.strip()
        if stripped.startswith(_START_COMMAND_KEY):
            commands.append(stripped[len(_START_COMMAND_KEY) :].strip())
    return commands


def manifest_section(doc_text: str) -> str:
    """문서에서 목록 설정을 설명하는 `## ` 구역 하나를 돌려준다.

    문서에는 데모의 조각 수와 목록의 조각 수가 함께 있다. 구역을 나눠야 어느 숫자가
    목록의 것인지 알 수 있다.
    """

    starts = [match.start() for match in _SECTION_START.finditer(doc_text)]
    sections = [
        doc_text[start:end] for start, end in zip(starts, [*starts[1:], len(doc_text)])
    ]
    found = [section for section in sections if MANIFEST_ENV in section]
    if len(found) != 1:
        raise AssertionError(
            f"{MANIFEST_ENV}를 적은 '## ' 구역이 하나여야 하는데 {len(found)}개입니다."
        )
    return found[0]


def only_value(test: unittest.TestCase, pattern: re.Pattern, text: str, what: str) -> str:
    """구역 안에 적힌 값이 한 가지뿐인지 보고 그 값을 돌려준다."""

    values = set(pattern.findall(text))
    test.assertEqual(len(values), 1, f"{what}이 한 가지여야 합니다: {sorted(values)}")
    return values.pop()


class RenderYamlTests(unittest.TestCase):
    """두 서비스가 같은 진입점으로 시작하고, 선택 설정을 파일에 적지 않는다."""

    @classmethod
    def setUpClass(cls):
        cls.render_text = read_text(RENDER_YAML)
        cls.commands = start_commands(cls.render_text)

    def test_both_services_start_the_deployed_entry_point(self):
        self.assertEqual(len(self.commands), SERVICE_COUNT, self.commands)
        for command in self.commands:
            with self.subTest(command=command):
                words = command.split()
                self.assertEqual(words[:3], ["python", "-m", "uvicorn"])
                # 진입점 문자열이 다른 단어의 일부가 아니라 인자 하나로 있는지 본다.
                self.assertEqual(words[3], ENTRY_POINT)
                # 앱을 만드는 함수를 넘기는 방식(--factory)이면 진입점이 달라진다.
                self.assertNotIn("--factory", words)

    def test_manifest_setting_is_not_declared_in_blueprint(self):
        # 이름만 있고 값이 비면 서버가 뜨지 않는다. 필요한 서비스의 대시보드에만 넣는다.
        self.assertNotIn(MANIFEST_ENV, self.render_text)


class DeployDocTests(unittest.TestCase):
    """배포 문서가 설정 파일·코드와 같은 명령과 이름을 적었다."""

    @classmethod
    def setUpClass(cls):
        cls.doc_text = read_text(DEPLOY_DOC)

    def test_start_command_matches_blueprint(self):
        documented = _DOC_START_COMMAND.findall(self.doc_text)
        self.assertEqual(len(documented), 1, documented)
        self.assertEqual(
            start_commands(read_text(RENDER_YAML)), documented * SERVICE_COUNT
        )

    def test_setting_name_matches_loader(self):
        # 문서에 나오는 설정 이름은 로더가 읽는 이름 하나뿐이다.
        self.assertEqual(set(_SETTING_NAME.findall(self.doc_text)), {MANIFEST_ENV})

    def test_manifest_section_states_what_an_operator_must_know(self):
        section = manifest_section(self.doc_text)
        for phrase in ("저장소 루트", "목록 파일이 있는 폴더", "서버가 뜨지 않는다", "render.yaml"):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, section)


class DocumentedExampleTests(unittest.TestCase):
    """문서에 적힌 가상 목록을 로더에 넘기면 문서에 적힌 결과가 나온다."""

    @classmethod
    def setUpClass(cls):
        cls.section = manifest_section(read_text(DEPLOY_DOC))

    def test_fictional_manifest_gives_documented_chunk_count(self):
        relative = only_value(
            self, _DOC_MANIFEST_VALUE, self.section, "표에 적힌 가상 목록 경로"
        )
        documented = int(only_value(self, _CHUNK_COUNT, self.section, "목록의 조각 수"))

        # 배포 서버는 저장소 루트에서 시작한다. 테스트는 실행한 폴더에 기대지 않도록
        # 표의 값 전체를 같은 기준으로 직접 푼다.
        manifest = REPO_ROOT.joinpath(*relative.split("/"))
        # 문서의 예시는 저장소가 추적하는 가상 파일 폴더 바로 아래를 가리킨다.
        self.assertEqual(manifest.parent, FIXTURES, relative)
        self.assertTrue(manifest.is_file(), relative)
        app = create_local_manifest_app({MANIFEST_ENV: str(manifest)})

        # 서버를 띄우지 않고 앱을 파이썬 함수처럼 바로 부른다 (ASGI 직접 호출).
        response = call_app(app, "GET", HEALTH)
        self.assertEqual(response.status, 200)
        self.assertEqual(
            response.json(),
            {"status": "ok", "index_loaded": True, "chunk_count": documented},
        )

    def test_blank_value_fails_with_documented_message(self):
        documented = set(_DOC_ERROR.findall(self.section))
        for value in ("", " \t"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError) as caught:
                    create_local_manifest_app({MANIFEST_ENV: value})
                self.assertIn(str(caught.exception), documented)


if __name__ == "__main__":
    unittest.main()
