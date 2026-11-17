"""실제 규정 목록으로 검색기를 만들어 질문별 AI 후보(상위 `TOP_K`개) 적중률을 잰다.

`KUMOH_REGULATION_MANIFEST_PATH`가 가리키는 목록 파일을 서버와 같은 함수
(`create_local_manifest_app`)로 검사하고 읽는다. 검색기도 서버와 같은 조립 함수
(`build_regulations_retrieval`)로 만들고, AI가 받는 후보와 같은 경로
(`build_result(..., relaxed=True)`의 최종 인용)로 후보를 고른다. `TOP_K`는 AI 후보 상한
(`AI_CANDIDATE_LIMIT`, 5개)과 같다. AI는 부르지 않는다.

질문과 기대 조문은 `api/docs/retrieval_questions.json`에 있다. 기대값은 문서명과 조 번호
목록이고, 그중 하나라도 상위 `TOP_K`개에 있으면 적중이다. 항 표시(①)는 무시하지만 제3조와
제33조, 제12조와 제12조의2는 다른 조로 본다.

출력에는 질문, 기대 문서·조, 상위 `TOP_K`개 문서·조, 적중 여부, 적중률만 싣는다. 규정 원문,
파일 경로, 예외 내용, 오류 추적 정보(traceback)는 싣지 않는다.

실행:
    python -B api/scripts/eval_retrieval.py
"""

import json
import os
import re
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import TextIO
from unicodedata import normalize


REPO_ROOT = Path(__file__).resolve().parents[2]
# `python api/scripts/eval_retrieval.py`로 실행해도 `api` 패키지를 찾게 한다.
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
# `api/app`의 모듈은 서로 `app.`으로 부른다. `api.regulation_app`과 같은 모듈을 쓰도록
# `api` 폴더도 경로에 둔다(`api.app.`으로 부르면 같은 모듈이 두 번 실린다).
if str(REPO_ROOT / "api") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "api"))

from api.local_serve import MANIFEST_ENV, create_local_manifest_app
from app.services.chat_retrieval import AI_CANDIDATE_LIMIT


QUESTIONS_PATH = REPO_ROOT / "api" / "docs" / "retrieval_questions.json"
TOP_K = AI_CANDIDATE_LIMIT

MISSING_TEXT = (
    f"{MANIFEST_ENV} 설정이 없어 평가를 건너뜁니다. "
    "규정 목록 파일을 가리키게 설정한 뒤 다시 실행하세요."
)
QUESTIONS_FAILED_TEXT = "질문 목록을 읽지 못해 평가를 멈춥니다. 질문 파일의 모양을 확인하세요."
BUILD_FAILED_TEXT = "규정 목록으로 검색기를 만들지 못해 평가를 멈춥니다. 목록 설정과 파일을 확인하세요."
SEARCH_FAILED_TEXT = "검색 중 오류가 나 평가를 멈춥니다."

# 조문 경로 맨 앞의 조 번호. '제38조(휴학) ②'에서 '제38조'만 꺼낸다.
_ARTICLE_NUMBER = re.compile(r"제[0-9]+조(?:의[0-9]+)?")
# 공백을 지운 문서명 끝의 차수 표시. '학칙제117차', '학칙(제117차)'에서 차수를 뗀다.
_REVISION_SUFFIX = re.compile(r"\(?제[0-9]+차\)?$")
# 문서명 맨 앞의 학교 이름. 긴 이름이 먼저 맞도록 길이순으로 두고 한 번만 뗀다.
_SCHOOL_PREFIXES = ("국립금오공과대학교", "금오공과대학교")


@dataclass(frozen=True)
class Expected:
    document: str
    article: str


@dataclass(frozen=True)
class Question:
    question: str
    expected: tuple[Expected, ...]


class _QuestionsError(Exception):
    """질문 목록 모양이 틀렸다는 신호. 이유 글은 출력하지 않는다."""


def _compact(text: str) -> str:
    return "".join(normalize("NFKC", text).casefold().split())


def article_number(article_path: str) -> str | None:
    """조문 경로 맨 앞의 조 번호를 돌려준다. 항 표시와 제목은 버린다."""

    match = _ARTICLE_NUMBER.match(normalize("NFKC", article_path).strip())
    return match.group() if match else None


def _document_key(title: str) -> str:
    compact = _compact(title)
    for prefix in _SCHOOL_PREFIXES:
        if compact.startswith(prefix):
            compact = compact[len(prefix):]
            break
    return _REVISION_SUFFIX.sub("", compact)


def same_document(expected: str, title: str) -> bool:
    """두 문서명이 맨 앞 학교 이름과 끝의 차수 표시('제117차', '(제117차)')만 빼고 같으면
    같은 문서로 본다.

    부분 일치로 보면 '학칙'이 '학칙 시행세칙'과도 맞아 다른 문서를 적중으로 센다.
    공백과 전각 글자는 무시한다.
    """

    wanted = _document_key(expected)
    return bool(wanted) and wanted == _document_key(title)


def is_hit(expected: Sequence[Expected], top: Sequence[tuple[str, str | None]]) -> bool:
    return any(
        number == item.article and same_document(item.document, title)
        for item in expected
        for title, number in top
    )


def parse_questions(data: object) -> list[Question]:
    if type(data) is not list or not data:
        raise _QuestionsError
    questions = []
    for entry in data:
        if type(entry) is not dict or set(entry) != {"question", "expected"}:
            raise _QuestionsError
        question, expected = entry["question"], entry["expected"]
        if type(question) is not str or not question.strip():
            raise _QuestionsError
        if type(expected) is not list or not expected:
            raise _QuestionsError
        items = []
        for item in expected:
            if type(item) is not dict or set(item) != {"document", "article"}:
                raise _QuestionsError
            document, article = item["document"], item["article"]
            if type(document) is not str or not document.strip():
                raise _QuestionsError
            if type(article) is not str or _ARTICLE_NUMBER.fullmatch(article) is None:
                raise _QuestionsError
            items.append(Expected(document, article))
        questions.append(Question(question, tuple(items)))
    return questions


def load_questions(path: Path = QUESTIONS_PATH) -> list[Question]:
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError, RecursionError):
        raise _QuestionsError from None
    return parse_questions(data)


def top_articles(retrieval, question: str) -> list[tuple[str, str | None]]:
    """AI가 받는 최종 인용과 같은 후보에서 (문서명, 조 번호)를 순위대로 꺼낸다."""

    result = retrieval.build_result(question, None, relaxed=True)
    return [
        (citation["document"], article_number(citation["article_path"]))
        for citation in result["citations"][:TOP_K]
    ]


def _label(document: str, number: str | None) -> str:
    return f"{document} {number or '(조 번호 없음)'}"


def evaluate(retrieval, questions: Sequence[Question]) -> tuple[list[str], int]:
    """질문마다 한 줄씩 결과를 만들고 적중 수를 센다."""

    lines = []
    hits = 0
    for item in questions:
        top = top_articles(retrieval, item.question)
        hit = is_hit(item.expected, top)
        hits += hit
        expected = " 또는 ".join(_label(e.document, e.article) for e in item.expected)
        found = ", ".join(_label(title, number) for title, number in top) or "없음"
        lines.append(
            f"[{'적중' if hit else '놓침'}] {item.question} | 기대: {expected} | 상위 {TOP_K}개: {found}"
        )
    return lines, hits


def summary(hits: int, total: int) -> str:
    return f"적중률: {hits}/{total} ({hits / total:.1%})"


def main(
    environ: Mapping[str, str] | None = None,
    *,
    questions: Sequence[Question] | None = None,
    questions_path: Path = QUESTIONS_PATH,
    out: TextIO | None = None,
) -> int:
    """실패해도 고정 문구 한 줄만 출력한다. 설정이 없으면 0, 실패하면 1을 돌려준다."""

    environ = os.environ if environ is None else environ
    out = sys.stdout if out is None else out

    if not (environ.get(MANIFEST_ENV) or "").strip():
        print(MISSING_TEXT, file=out)
        return 0

    if questions is None:
        try:
            questions = load_questions(questions_path)
        except _QuestionsError:
            print(QUESTIONS_FAILED_TEXT, file=out)
            return 1
    if not questions:
        print(QUESTIONS_FAILED_TEXT, file=out)
        return 1

    # 목록이나 원문이 틀리면 예외 글에 입력값이 실릴 수 있어 고정 문구만 낸다.
    try:
        from api.regulation_app import build_regulations_retrieval

        built = create_local_manifest_app(environ, build_app=build_regulations_retrieval)
        retrieval = built.chat_retrieval
    except Exception:
        print(BUILD_FAILED_TEXT, file=out)
        return 1

    try:
        lines, hits = evaluate(retrieval, questions)
    except Exception:
        print(SEARCH_FAILED_TEXT, file=out)
        return 1

    for line in lines:
        print(line, file=out)
    print(summary(hits, len(questions)), file=out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
