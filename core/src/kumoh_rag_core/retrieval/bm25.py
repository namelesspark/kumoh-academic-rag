"""낱말 빈도와 글 길이를 반영해 규정 조각의 관련도를 매긴다 (BM25)."""

import re
from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from math import log1p
from unicodedata import normalize

from ..chunking import ArticleChunk


_ARTICLE_NUMBER = re.compile(r"제[0-9]+조(?:의[0-9]+)?")


@dataclass(frozen=True)
class RetrievedChunk:
    """입력 조각과 검색 점수, 1부터 시작하는 순위를 담는다."""

    chunk: ArticleChunk
    score: float
    rank: int


def _search_text(text: str) -> str:
    return normalize("NFKC", text).casefold()


def _term_counts(text: str) -> Counter[tuple[int, str]]:
    counts = Counter()
    for word in text.split():
        # 두 글자 낱말과 더 긴 낱말에서 나온 두 글자를 따로 센다.
        counts[1, word] += 1
        for start in range(len(word) - 1):
            counts[2, word[start:start + 2]] += 1
    return counts


class BM25Retriever:
    """원문 한 건에서 나온 조각을 관련도 순으로 찾는다."""

    def __init__(self, chunks: Iterable[ArticleChunk]) -> None:
        self._chunks = tuple(chunks)
        self._article_numbers = []
        self._title_units = []
        self._exact_titles = []
        self._graduate = []
        self._lengths = []
        self._postings = defaultdict(list)
        for index, chunk in enumerate(self._chunks):
            article = _ARTICLE_NUMBER.match(_search_text(chunk.article_path))
            self._article_numbers.append(article.group() if article else None)
            title_match = re.search(r"[（(]([^）)]+)[）)]", _search_text(chunk.article_path))
            title = title_match.group(1) if title_match else ""
            compact_title = "".join(title.split())
            self._exact_titles.append(re.sub(r"(?:등|및.*|에관한.*)$", "", compact_title))
            self._title_units.append({
                compact_title[start:start + 2]
                for start in range(len(compact_title) - 1)
            })
            body = _search_text(chunk.text).lstrip()
            # 항 조각에도 붙는 조 제목을 걷어낸 뒤 첫 문장만 확인한다.
            heading = re.match(r"제[0-9]+조(?:의[0-9]+)?\s*[（(][^）)]+[）)]", body)
            if heading:
                body = body[heading.end():].lstrip()
            first_sentence = re.split(r"[.!?。\n]", body, maxsplit=1)[0]
            self._graduate.append("대학원" in title or "대학원" in first_sentence)
            counts = _term_counts(_search_text(chunk.text))
            self._lengths.append(sum(counts.values()))
            for term, count in counts.items():
                self._postings[term].append((index, count))

        size = len(self._chunks)
        self._average_length = sum(self._lengths) / size if size else 0.0
        self._weights = {
            term: log1p((size - len(postings) + 0.5) / (len(postings) + 0.5))
            for term, postings in self._postings.items()
        }

    def retrieve(self, query: str, top_k: int = 5) -> list[RetrievedChunk]:
        """여러 조각은 일부에만 있는 검색 단위나 일치하는 조 번호로 찾는다.

        조각이 하나면 겹치는 검색 단위만으로 찾는다.
        """
        if top_k < 1:
            raise ValueError("top_k must be at least 1")

        text = _search_text(query)
        article_numbers = set(_ARTICLE_NUMBER.findall(text))
        terms = _term_counts(text)
        size = len(self._chunks)
        if (
            size > 1
            and not any(0 < len(self._postings.get(term, ())) < size for term in terms)
            and article_numbers.isdisjoint(self._article_numbers)
        ):
            return []

        scores = defaultdict(float)
        k1, b = 1.2, 0.75
        for term in terms:
            for index, count in self._postings.get(term, ()):
                length_ratio = self._lengths[index] / self._average_length
                denominator = count + k1 * (1 - b + b * length_ratio)
                scores[index] += self._weights[term] * count * (k1 + 1) / denominator

        query_units = {unit for (length, unit) in terms if length == 2}
        words = text.split()
        exact_queries = set(words)
        exact_queries.update(left + right for left, right in zip(words, words[1:]))
        graduate_query = any(word in text for word in ("대학원", "석사", "박사"))
        # 이미 찾은 후보 안에서만 제목의 주제 일치도를 반영한다.
        score_scale = max(scores.values(), default=0.0)
        for index in scores:
            overlap = query_units & self._title_units[index]
            if overlap:
                coverage = len(overlap) / len(query_units)
                scores[index] += score_scale * coverage
                if query_units <= self._title_units[index]:
                    scores[index] += score_scale
            if self._exact_titles[index] and self._exact_titles[index] in exact_queries:
                scores[index] += score_scale * 2
            if self._graduate[index] and not graduate_query:
                scores[index] *= 0.5

        ranked = sorted(
            scores,
            key=lambda index: (
                self._article_numbers[index] not in article_numbers,
                -scores[index],
                self._chunks[index].start,
            ),
        )
        return [
            RetrievedChunk(self._chunks[index], scores[index], rank)
            for rank, index in enumerate(ranked[:top_k], start=1)
        ]
