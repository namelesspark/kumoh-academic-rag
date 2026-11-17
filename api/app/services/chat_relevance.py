"""검색기가 고른 후보 가운데 질문의 핵심 낱말이 실제로 든 조각만 남긴다.

검색기는 글자 두 개만 겹쳐도 후보를 낸다. 여기서는 그 후보를 순위대로 다시 읽고,
질문의 핵심 낱말이 본문에 모두 있는 조각만 통과시킨다. 통과한 조각이 없으면 빈
목록을 돌려주어 답변 쪽이 기존 보류 문구를 내게 한다. 규칙은 `api/docs/PROMPTING.md`의
「근거 판정」 절에 적혀 있다.
"""

import re
from collections.abc import Callable, Sequence
from typing import Protocol, TypeVar
from unicodedata import normalize


class JudgedChunk(Protocol):
    @property
    def text(self) -> str: ...

    @property
    def article_path(self) -> str: ...


class JudgedHit(Protocol):
    @property
    def chunk(self) -> JudgedChunk: ...


Hit = TypeVar("Hit", bound=JudgedHit)

_ARTICLE_NUMBER = re.compile(r"제[0-9]+조(?:의[0-9]+)?")
_WORD = re.compile(r"\w+")

# 낱말 끝에서 한 번만 뗀다. 긴 조사가 짧은 조사보다 먼저 맞도록 길이순으로 둔다.
_PARTICLES = tuple(sorted(
    (
        "에서는", "에서도", "까지는", "부터는", "으로는", "에게는",
        "에서", "에게", "한테", "까지", "부터", "으로", "보다", "처럼", "마다",
        "에는", "에도", "로는", "이나", "이란",
        "은", "는", "이", "가", "을", "를", "의", "에", "도", "만", "와", "과", "로", "께",
    ),
    key=len,
    reverse=True,
))
# 이 글자로 시작하는 낱말은 묻거나 청하는 말이어서 주제를 담지 않는다.
_ASKING_PREFIXES = (
    "누가", "누구", "언제", "어디", "무엇", "무슨", "뭐", "뭔",
    "어떻", "어떤", "어느", "얼마", "며칠",
    "알려", "가르쳐", "설명해", "궁금",
)
# 이 어미로 끝나는 낱말은 물음이나 요청을 맺는 서술어로 본다.
_ASKING_ENDINGS = (
    "나요", "가요", "까요", "니까", "는지", "을까", "할까", "될까", "일까",
    "어요", "아요", "해요", "돼요", "예요", "에요", "세요", "지요", "죠", "줘요", "줘",
)
_MIN_WORD_LENGTH = 2
# 주제 낱말 뒤에 붙어 조건·의무·물음을 맺는 어미. '졸업하려면'의 '하려면'처럼 떼고 남은
# 앞부분을 주제로 쓴다. 긴 어미가 짧은 어미보다 먼저 맞도록 길이순으로 둔다.
_PREDICATE_ENDINGS = tuple(sorted(
    (
        "하려면", "되려면", "받으려면", "하려고",
        "해야", "돼야", "되어야", "하면", "되면",
        "하나요", "되나요", "있나요", "없나요", "할",
    ),
    key=len,
    reverse=True,
))
# 질문 낱말 -> 규정이 같은 뜻으로 쓰는 낱말. 방향이 있고, 동의어의 동의어로 이어 넓히지 않는다.
# 검색 질의와 AI 후보 판정에만 쓰고, 엄격한 근거 판정(`is_supported`)에는 쓰지 않는다.
SYNONYMS: dict[str, tuple[str, ...]] = {
    "계절학기": ("계절수업",),
}


def _plain(text: str) -> str:
    return normalize("NFKC", text).casefold()


def _without_particle(word: str) -> str:
    # 떼고 나서 한 글자만 남으면 떼지 않는다. '학과', '지도'처럼 조사와 같은 글자로
    # 끝나는 두 글자 낱말을 잃지 않기 위해서다.
    for particle in _PARTICLES:
        if word.endswith(particle) and len(word) - len(particle) >= _MIN_WORD_LENGTH:
            return word[: -len(particle)]
    return word


def _predicate_stem(word: str) -> str | None:
    """어미를 떼고 두 글자 이상 남으면 앞부분을, 어미뿐인 낱말이면 빈 문자열을 돌려준다.

    한 글자만 남는 낱말('역할'의 '역')과 어미가 없는 낱말은 None을 돌려줘 기존 규칙에 맡긴다.
    """

    for ending in _PREDICATE_ENDINGS:
        if word.endswith(ending):
            stem = word[: -len(ending)]
            if len(stem) >= _MIN_WORD_LENGTH:
                return stem
            if not stem:
                return ""
            return None
    return None


def core_words(line: str) -> tuple[str, ...]:
    """질문 한 줄에서 조 번호, 묻는 말, 서술 어미, 조사를 덜어 낸 두 글자 이상 낱말을 고른다."""

    words = []
    for word in _WORD.findall(_ARTICLE_NUMBER.sub(" ", _plain(line))):
        if len(word) < _MIN_WORD_LENGTH or word.startswith(_ASKING_PREFIXES):
            continue
        stem = _predicate_stem(word)
        if stem == "":
            continue
        if stem is not None:
            words.append(stem)
            continue
        if word.endswith(_ASKING_ENDINGS):
            continue
        words.append(_without_particle(word))
    return tuple(dict.fromkeys(words))


def _with_synonyms(words: tuple[str, ...]) -> tuple[str, ...]:
    """원래 낱말 뒤에 `SYNONYMS`의 동의어를 한 번씩 덧붙인다. 덧붙인 낱말은 다시 넓히지 않는다."""

    synonyms = (synonym for word in words for synonym in SYNONYMS.get(word, ()))
    return tuple(dict.fromkeys((*words, *synonyms)))


def search_query(query: str) -> str:
    """검색기에 넘길 질의를 만든다. 줄마다 조 번호와 핵심 낱말, 그 동의어만 남긴다.

    검색기는 질의를 두 글자씩 잘라 점수를 매긴다. '하려면', '나요' 같은 서술 어미가 남으면
    그 두 글자가 엉뚱한 조문의 점수를 올리므로 미리 덜어 낸다. 조 번호는 '조 번호 일치
    우선' 규칙에 쓰이므로 남긴다. 근거 판정에는 이 질의가 아니라 원래 질문을 쓴다.
    """

    lines = []
    for line in query.splitlines():
        terms = (*_ARTICLE_NUMBER.findall(_plain(line)), *_with_synonyms(core_words(line)))
        if terms:
            lines.append(" ".join(dict.fromkeys(terms)))
    return "\n".join(lines)


def cleaned_search(
    search: Callable[[str], Sequence[Hit]],
) -> Callable[[str], Sequence[Hit]]:
    """검색 함수를 감싸, 원래 질문 대신 `search_query`로 정리한 질의를 넘기게 한다."""

    def search_cleaned(query: str) -> Sequence[Hit]:
        return search(search_query(query))

    return search_cleaned


def _line_is_supported(line: str, chunk_text: str, chunk_number: str | None) -> bool:
    words = core_words(line)
    if words:
        return all(word in chunk_text for word in words)
    # 핵심 낱말 없이 조 번호만 적은 줄은 번호가 같은 조각만 받는다.
    return chunk_number is not None and chunk_number in _ARTICLE_NUMBER.findall(_plain(line))


def is_supported(query: str, chunk: JudgedChunk) -> bool:
    """질문의 어느 한 줄이라도 핵심 낱말이 조각 본문에 모두 있으면 참이다.

    사진 질문은 질문과 판독문을 줄바꿈으로 이어 보내므로 줄마다 따로 본다.
    """

    # 띄어쓰기만 다른 낱말을 찾을 수 있게 본문의 공백을 지운다.
    chunk_text = "".join(_plain(chunk.text).split())
    number = _ARTICLE_NUMBER.match(_plain(chunk.article_path))
    chunk_number = number.group() if number else None
    return any(
        _line_is_supported(line, chunk_text, chunk_number) for line in query.splitlines()
    )


def keep_supported(
    search: Callable[[str], Sequence[Hit]],
) -> Callable[[str], list[Hit]]:
    """검색 함수를 감싸, 판정을 통과한 후보만 원래 순위대로 돌려주게 한다."""

    def supported_search(query: str) -> list[Hit]:
        return [hit for hit in search(query) if is_supported(query, hit.chunk)]

    return supported_search


def is_ai_candidate(query: str, chunk: JudgedChunk) -> bool:
    """AI에 보낼 후보는 핵심 낱말이나 그 동의어 하나 이상으로 판정한다."""
    text = "".join(_plain(chunk.text).split())
    number = _ARTICLE_NUMBER.match(_plain(chunk.article_path))
    for line in query.splitlines():
        words = _with_synonyms(core_words(line))
        if words:
            if any(word in text or (len(word) > 2 and word[:-1] in text) for word in words):
                return True
        elif number and number.group() in _ARTICLE_NUMBER.findall(_plain(line)):
            return True
    return False
