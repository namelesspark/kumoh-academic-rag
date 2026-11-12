"""운영자 컴퓨터에 있는 규정 텍스트를 읽어 채팅 검색에 연결한다.

공개 데모는 코드에 적어 둔 가상 규정만 검색한다. 이 모듈은 저장소 밖에 둔 파일을
받는 문이다. 문은 두 개다. `create_local_app`은 설정 네 개로 파일 한 건을 받고,
`create_local_manifest_app`은 목록 파일 하나로 여러 건을 받는다. 둘 다 입력을 검사하고
파일을 읽어 앱을 조립하는 함수에 넘긴다. 모듈을 불러오는 것만으로는 설정도 파일도
읽지 않는다.

실행 방법(로컬 전용):
    python -m uvicorn api.local_serve:create_local_app --factory
    python -m uvicorn api.local_serve:create_local_manifest_app --factory
"""

import json
import os
import re
from collections.abc import Callable, Mapping
from datetime import date
from importlib import import_module
from pathlib import Path

from pydantic import AnyHttpUrl, TypeAdapter, ValidationError


PATH_ENV = "KUMOH_REGULATION_PATH"
TITLE_ENV = "KUMOH_REGULATION_TITLE"
EFFECTIVE_DATE_ENV = "KUMOH_REGULATION_EFFECTIVE_DATE"
SOURCE_URL_ENV = "KUMOH_REGULATION_SOURCE_URL"
MANIFEST_ENV = "KUMOH_REGULATION_MANIFEST_PATH"
BUILDER_MODULE = "api.regulation_app"
MANIFEST_BUILDER = "create_regulations_app"

# 목록 파일에서 문서 한 건이 가져야 하는 필드. 모두 문자열이다.
_DOCUMENT_FIELDS = ("path", "document_title", "effective_date", "source_url")
# 윈도우 편집기가 파일 맨 앞에 붙이는 표식(BOM, Byte Order Mark).
_BOM = "﻿"

# Python 3.11부터 date.fromisoformat은 20990203과 주 표기 2099-W05-2도 받는다.
# 그래서 모양을 먼저 확인한다.
_DATE_SHAPE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")

_HTTPS_PREFIX = "https://"
# 주소에서 호스트 부분이 끝나는 글자. 그 앞까지가 호스트와 포트다.
_AFTER_HOST = re.compile(r"[/?#]")
# 호스트 이름과 숫자 주소(IPv4·IPv6)의 모양은 이미 쓰는 값 검사 라이브러리(pydantic)의
# 주소 검사기에 맡긴다. 브라우저와 같은 규칙으로 읽어, 전각 숫자나 범위를 벗어난
# 숫자 주소를 걸러 낸다.
_URL_PARSER = TypeAdapter(AnyHttpUrl)


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


def _parse_effective_date(value: str, name: str = EFFECTIVE_DATE_ENV) -> date:
    """`name`은 오류 문구 앞에 붙는 이름이다. 목록에서는 항목 번호와 필드명을 준다."""

    if _DATE_SHAPE.fullmatch(value) is None:
        raise _fail(name, "YYYY-MM-DD 모양이 아닙니다.")
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise _fail(name, "달력에 없는 날짜입니다.") from None


def _check_source_url(value: str, name: str = SOURCE_URL_ENV) -> str:
    """주소의 모양만 본다. 기동 중에 링크를 열지 않으며, 공식 여부는 입력한 사람이 책임진다."""

    # 주소 검사기는 앞뒤 공백과 제어 문자를 말없이 지우거나, 빈 호스트 자리를 뒤의
    # 글자로 채워 읽기도 한다. 검사한 값과 넘기는 값이 달라지지 않게, 고쳐 읽을 여지가
    # 있는 입력은 검사기에 넘기기 전에 원래 글자 그대로 보고 거부한다.
    if any(character.isspace() or not character.isprintable() for character in value):
        raise _fail(name, "공백이나 제어 문자가 들어 있습니다.")
    if value[: len(_HTTPS_PREFIX)].lower() != _HTTPS_PREFIX:
        raise _fail(name, "https:// 로 시작하는 주소가 아닙니다.")
    host_and_port = _AFTER_HOST.split(value[len(_HTTPS_PREFIX) :], maxsplit=1)[0]
    if not host_and_port:
        raise _fail(name, "호스트가 없습니다.")
    if "@" in host_and_port:
        raise _fail(name, "아이디나 비밀번호가 들어 있습니다.")
    if "\\" in host_and_port:
        raise _fail(name, "호스트에 역슬래시가 들어 있습니다.")

    try:
        url = _URL_PARSER.validate_python(value)
    except ValidationError:
        # 검사기의 오류 문구에는 입력값이 실리므로 이어 붙이지 않는다.
        raise _fail(name, "주소로 읽을 수 없습니다.") from None
    if url.scheme != "https":
        raise _fail(name, "https 주소가 아닙니다.")
    if url.username is not None or url.password is not None:
        raise _fail(name, "아이디나 비밀번호가 들어 있습니다.")
    # 검사기는 점 하나뿐인 호스트도 받는다.
    if not url.host or not url.host.strip("."):
        raise _fail(name, "호스트가 없습니다.")
    # 검사기가 다듬은 값이 아니라 입력한 글자 그대로 돌려준다.
    return value


def _read_source(path: str | Path, name: str = PATH_ENV) -> str:
    """줄바꿈과 맨 앞 표식(BOM, Byte Order Mark)을 바꾸지 않고 읽는다.

    분할과 인용에 같은 문자열을 넘겨야 글자 위치가 맞는다. 원래 예외에는 경로나
    파일 바이트가 실릴 수 있어 이어 붙이지 않는다.
    """

    try:
        data = Path(path).read_bytes()
    except (OSError, ValueError) as error:
        # 경로에 널 문자(코드 0)가 있으면 OSError가 아니라 ValueError가 난다.
        reason = f"파일을 읽을 수 없습니다 ({type(error).__name__})."
        raise _fail(name, reason) from None
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        raise _fail(name, "UTF-8로 읽을 수 없는 파일입니다.") from None


def _load_builder_module():
    """앱 조립 모듈을 필요할 때만 불러온다.

    이 모듈을 불러오는 것만으로 앱 모듈이 따라오지 않게 하려는 것이다. 조립 모듈이
    아직 없는 체크아웃에서는 무엇이 빠졌는지 알려 주고 멈춘다.
    """

    try:
        return import_module(BUILDER_MODULE)
    except ModuleNotFoundError as error:
        # 조립 모듈 안에서 다른 모듈을 못 찾은 경우는 원래 오류를 그대로 보여 준다.
        if error.name != BUILDER_MODULE:
            raise
        raise ValueError(
            f"{BUILDER_MODULE}: 앱 조립 모듈이 없습니다. "
            "이 모듈이 들어 있는 main을 받아 온 뒤 다시 실행하세요."
        ) from None


def _load_default_builder() -> Callable:
    return _load_builder_module().create_regulation_app


def _load_manifest_builder() -> Callable:
    """여러 문서를 받는 조립 함수를 찾는다. 다른 PR이 만들므로 없는 체크아웃이 있다."""

    builder = getattr(_load_builder_module(), MANIFEST_BUILDER, None)
    if builder is None:
        raise ValueError(
            f"{BUILDER_MODULE}: {MANIFEST_BUILDER} 함수가 없습니다. "
            "이 함수가 들어 있는 main을 받아 온 뒤 다시 실행하세요."
        )
    return builder


class _DuplicateField(ValueError):
    pass


def _unique_fields(pairs: list[tuple[str, object]]) -> dict:
    # json.loads는 같은 이름이 두 번 나오면 말없이 뒤의 값만 남긴다. 어느 값이 쓰였는지
    # 헷갈리지 않게 거부한다.
    fields = dict(pairs)
    if len(fields) != len(pairs):
        raise _DuplicateField
    return fields


def _read_manifest(path: Path) -> list[dict]:
    """목록 파일을 읽어 모양만 확인한 항목들을 돌려준다. 규정 파일은 아직 읽지 않는다."""

    # 바이트를 json.loads에 그대로 넘기면 UTF-16도 받아들인다. UTF-8로 먼저 풀어
    # 문자열을 넘긴다. 맨 앞 표식은 목록 파일에서만 뗀다.
    text = _read_source(path, MANIFEST_ENV).removeprefix(_BOM)
    try:
        manifest = json.loads(text, object_pairs_hook=_unique_fields)
    except _DuplicateField:
        raise _fail(MANIFEST_ENV, "같은 필드를 두 번 적었습니다.") from None
    except (ValueError, RecursionError):
        # 원래 오류에는 목록 내용이 실리므로 이어 붙이지 않는다.
        raise _fail(MANIFEST_ENV, "JSON으로 읽을 수 없습니다.") from None

    if type(manifest) is not dict:
        raise _fail(MANIFEST_ENV, "최상위가 객체가 아닙니다.")
    if "documents" not in manifest:
        raise _fail("documents", "필드가 없습니다.")
    if len(manifest) != 1:
        raise _fail(MANIFEST_ENV, "모르는 필드가 있습니다.")
    entries = manifest["documents"]
    if type(entries) is not list:
        raise _fail("documents", "배열이 아닙니다.")
    if not entries:
        raise _fail("documents", "문서가 없습니다.")

    for index, entry in enumerate(entries):
        name = f"documents[{index}]"
        if type(entry) is not dict:
            raise _fail(name, "객체가 아닙니다.")
        # 모르는 필드는 오타일 수 있어 거부한다. 필드 이름도 입력값이라 문구에 넣지 않는다.
        if not set(entry) <= set(_DOCUMENT_FIELDS):
            raise _fail(name, "모르는 필드가 있습니다.")
        for field in _DOCUMENT_FIELDS:
            if field not in entry:
                raise _fail(f"{name}.{field}", "필드가 없습니다.")
            if type(entry[field]) is not str:
                raise _fail(f"{name}.{field}", "문자열이 아닙니다.")
            if not entry[field].strip():
                raise _fail(f"{name}.{field}", "값이 비어 있습니다.")
    return entries


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


def create_local_manifest_app(
    environ: Mapping[str, str] | None = None,
    build_app: Callable | None = None,
):
    """목록 읽기 → 모든 항목 검사 → 모든 파일 읽기 → 앱 생성을 순서대로 한다.

    `KUMOH_REGULATION_MANIFEST_PATH`가 가리키는 목록 파일 하나로 규정 여러 건을 받는다.
    상대 경로는 목록 파일이 있는 폴더를 기준으로 푼다. 항목 하나라도 틀리거나 파일
    하나라도 읽지 못하면 조립 함수를 부르지 않는다. 실패는 모두 ValueError이고,
    `build_app`이 낸 예외는 그대로 밖으로 나간다.
    """

    if environ is None:
        environ = os.environ

    manifest_path = Path(_read_setting(environ, MANIFEST_ENV))
    entries = _read_manifest(manifest_path)

    # 날짜와 주소를 모든 항목에서 먼저 확인한다. 뒤 항목이 틀렸을 때 앞 항목의
    # 규정 파일을 괜히 읽지 않는다.
    checked = [
        {
            "document_title": entry["document_title"],
            "effective_date": _parse_effective_date(
                entry["effective_date"], f"documents[{index}].effective_date"
            ),
            "source_url": _check_source_url(
                entry["source_url"], f"documents[{index}].source_url"
            ),
        }
        for index, entry in enumerate(entries)
    ]
    documents = [
        {
            # 경로가 절대 경로면 `/`가 목록 폴더를 버리고 그 경로를 그대로 쓴다.
            "source": _read_source(
                manifest_path.parent / entry["path"], f"documents[{index}].path"
            ),
            **fields,
        }
        for index, (entry, fields) in enumerate(zip(entries, checked))
    ]

    if build_app is None:
        build_app = _load_manifest_builder()

    return build_app(documents)
