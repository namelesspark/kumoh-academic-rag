"""운영자 컴퓨터에 있는 규정 텍스트 한 건을 읽어 채팅 검색에 연결한다.

공개 데모는 코드에 적어 둔 가상 규정만 검색한다. 이 모듈은 저장소 밖에 둔 파일을
받는 문이다. 설정 네 개를 읽어 검사하고, 파일을 읽어 앱을 조립하는 함수에 넘긴다.
모듈을 불러오는 것만으로는 설정도 파일도 읽지 않는다.

실행 방법(로컬 전용):
    python -m uvicorn api.local_serve:create_local_app --factory
"""

import os
import re
from collections.abc import Callable, Mapping
from datetime import date
from importlib import import_module
from ipaddress import IPv4Address, IPv6Address
from pathlib import Path
from urllib.parse import urlsplit


PATH_ENV = "KUMOH_REGULATION_PATH"
TITLE_ENV = "KUMOH_REGULATION_TITLE"
EFFECTIVE_DATE_ENV = "KUMOH_REGULATION_EFFECTIVE_DATE"
SOURCE_URL_ENV = "KUMOH_REGULATION_SOURCE_URL"
BUILDER_MODULE = "api.regulation_app"

# Python 3.11부터 date.fromisoformat은 20990203과 주 표기 2099-W05-2도 받는다.
# 그래서 모양을 먼저 확인한다.
_DATE_SHAPE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")

# 브라우저가 주소를 읽는 규칙(WHATWG URL 표준)이 호스트 이름에서 금지하는 글자.
# urlsplit은 역슬래시 같은 글자도 호스트로 돌려주므로 따로 막는다. 퍼센트 표기(%65 등)
# 호스트는 브라우저가 풀어서 읽지만, 여기서는 풀지 않고 거부한다.
_FORBIDDEN_HOST_CHARACTER = re.compile(r"[\x00-\x20#/:<>?@\[\\\]^|%\x7f]")
# 마지막 마디가 숫자면 브라우저는 호스트 전체를 숫자 주소(IPv4)로 읽는다.
_NUMERIC_LABEL = re.compile(r"[0-9]+|0x[0-9a-f]*")


def _is_usable_host(netloc: str, host: str | None) -> bool:
    """브라우저가 열 수 있는 호스트인지 모양으로 판단한다. 이름을 조회하지는 않는다."""

    if not host:
        return False

    if netloc.startswith("["):
        # 대괄호 안에는 IPv6 주소만 온다. urlsplit은 [v1.a] 같은 표기도 통과시킨다.
        # 구역 표시(%eth0 등)는 브라우저가 받지 않는다.
        if "%" in host:
            return False
        try:
            IPv6Address(host)
        except ValueError:
            return False
        return True

    # 끝에 붙은 점 하나는 '여기가 이름의 끝'이라는 표시로, 올바른 표기다.
    name = host.removesuffix(".")
    if not name or _FORBIDDEN_HOST_CHARACTER.search(name):
        return False
    if _NUMERIC_LABEL.fullmatch(name.rsplit(".", 1)[-1]):
        # 256.256.256.256처럼 범위를 벗어난 값을 막는다. 점 넷으로 나눈 십진 표기만 받는다.
        try:
            IPv4Address(name)
        except ValueError:
            return False
    return True


def _fail(name: str, reason: str) -> ValueError:
    # 문구에는 설정 이름과 이유만 담는다. 입력값과 파일 내용은 넣지 않는다.
    return ValueError(f"{name}: {reason}")


def _read_setting(environ: Mapping[str, str], name: str) -> str:
    value = environ.get(name)
    if value is None:
        raise _fail(name, "설정이 없습니다.")
    if not value.strip():
        raise _fail(name, "값이 비어 있습니다.")
    return value


def _parse_effective_date(value: str) -> date:
    if _DATE_SHAPE.fullmatch(value) is None:
        raise _fail(EFFECTIVE_DATE_ENV, "YYYY-MM-DD 모양이 아닙니다.")
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise _fail(EFFECTIVE_DATE_ENV, "달력에 없는 날짜입니다.") from None


def _check_source_url(value: str) -> str:
    """주소의 모양만 본다. 기동 중에 링크를 열지 않으며, 공식 여부는 입력한 사람이 책임진다."""

    # urlsplit은 탭·줄바꿈과 맨 앞의 제어 문자를 말없이 지우고 나눈다. 그대로 두면
    # 검사한 값과 넘기는 값이 달라지므로 나누기 전에 본다.
    if any(character.isspace() or not character.isprintable() for character in value):
        raise _fail(SOURCE_URL_ENV, "공백이나 제어 문자가 들어 있습니다.")
    try:
        parts = urlsplit(value)
        parts.port  # 숫자가 아닌 포트는 여기서 ValueError가 난다.
    except ValueError:
        raise _fail(SOURCE_URL_ENV, "주소로 읽을 수 없습니다.") from None
    if parts.scheme != "https":
        raise _fail(SOURCE_URL_ENV, "https 주소가 아닙니다.")
    if "@" in parts.netloc:
        raise _fail(SOURCE_URL_ENV, "아이디나 비밀번호가 들어 있습니다.")
    if not _is_usable_host(parts.netloc, parts.hostname):
        raise _fail(SOURCE_URL_ENV, "호스트가 없거나 브라우저가 열 수 없는 호스트입니다.")
    return value


def _read_source(path: str) -> str:
    """줄바꿈과 맨 앞 표식(BOM, Byte Order Mark)을 바꾸지 않고 읽는다.

    분할과 인용에 같은 문자열을 넘겨야 글자 위치가 맞는다. 원래 예외에는 경로나
    파일 바이트가 실릴 수 있어 이어 붙이지 않는다.
    """

    try:
        data = Path(path).read_bytes()
    except (OSError, ValueError) as error:
        # 경로에 널 문자(코드 0)가 있으면 OSError가 아니라 ValueError가 난다.
        reason = f"파일을 읽을 수 없습니다 ({type(error).__name__})."
        raise _fail(PATH_ENV, reason) from None
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        raise _fail(PATH_ENV, "UTF-8로 읽을 수 없는 파일입니다.") from None


def _load_default_builder() -> Callable:
    """앱 조립 함수를 필요할 때만 불러온다.

    이 모듈을 불러오는 것만으로 앱 모듈이 따라오지 않게 하려는 것이다. 조립 모듈이
    아직 없는 체크아웃에서는 무엇이 빠졌는지 알려 주고 멈춘다.
    """

    try:
        module = import_module(BUILDER_MODULE)
    except ModuleNotFoundError as error:
        # 조립 모듈 안에서 다른 모듈을 못 찾은 경우는 원래 오류를 그대로 보여 준다.
        if error.name != BUILDER_MODULE:
            raise
        raise ValueError(
            f"{BUILDER_MODULE}: 앱 조립 모듈이 없습니다. "
            "이 모듈이 들어 있는 main을 받아 온 뒤 다시 실행하세요."
        ) from None
    return module.create_regulation_app


def create_local_app(
    environ: Mapping[str, str] | None = None,
    build_app: Callable | None = None,
):
    """설정 읽기 → 검사 → 파일 읽기 → 앱 생성을 순서대로 한다.

    실패는 모두 ValueError다. `build_app`이 낸 예외는 그대로 밖으로 나간다.
    """

    if environ is None:
        environ = os.environ

    path = _read_setting(environ, PATH_ENV)
    document_title = _read_setting(environ, TITLE_ENV)
    effective_date = _parse_effective_date(_read_setting(environ, EFFECTIVE_DATE_ENV))
    source_url = _check_source_url(_read_setting(environ, SOURCE_URL_ENV))

    source = _read_source(path)

    if build_app is None:
        build_app = _load_default_builder()

    return build_app(
        source,
        document_title=document_title,
        effective_date=effective_date,
        source_url=source_url,
    )
