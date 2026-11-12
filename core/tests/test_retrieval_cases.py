"""가상 규정 사례 표가 검색기 없이도 성립하는지 확인한다.

사례 표는 시험 문제지와 정답지다. 이 파일은 채점 전에 문제지를 검수한다.
정답으로 적은 조문이 원문에 실제로 있는지, 문제가 의도한 함정을 담고 있는지 본다.
검색 문단은 main의 chunk_articles로만 만들고, 모든 입력은 가상의 규정 문장이다.
"""

import re
import sys
import unicodedata
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import retrieval_cases as cases
from kumoh_rag_core.chunking import chunk_articles

_ARTICLE_NUMBER = re.compile(r"제([0-9]+)조(?:의([0-9]+))?")


def words_and_pairs(text):
    """검색용 글을 띄어쓰기 낱말과, 낱말 안의 이어진 두 글자로 나눈다.

    전각 문자와 대소문자를 먼저 통일한다 (유니코드 NFKC 정규화).
    이슈 #16이 정한 검색 단위를 이 파일 안에서 따로 계산해 검색기에 기대지 않는다.
    """
    words = unicodedata.normalize("NFKC", text).casefold().split()
    pairs = {word[i:i + 2] for word in words for i in range(len(word) - 1)}
    return set(words), pairs


def units(text):
    words, pairs = words_and_pairs(text)
    return words | pairs


class RetrievalCaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = cases.SOURCE
        cls.chunks = chunk_articles(cls.source, max_chars=cases.MAX_CHARS)

    def chunks_at(self, article_path):
        return [chunk for chunk in self.chunks if chunk.article_path == article_path]

    def only_chunk(self, article_path):
        (chunk,) = self.chunks_at(article_path)
        return chunk

    def quote(self, chunk):
        return self.source[chunk.start:chunk.end]

    def test_chunks_follow_source_order(self):
        self.assertEqual(
            tuple(chunk.article_path for chunk in self.chunks), cases.CHUNK_PATHS
        )
        starts = [chunk.start for chunk in self.chunks]
        self.assertEqual(starts, sorted(set(starts)))

    def test_expected_path_exists_and_quote_matches_source(self):
        for case in cases.CASES:
            with self.subTest(case=case.name):
                found = self.chunks_at(case.article_path)
                self.assertEqual(len(found), case.chunk_count)
                for chunk in found:
                    self.assertEqual(self.quote(chunk), case.quote)

    def test_every_case_query_shares_a_unit_with_its_chunk(self):
        # 겹치는 검색 단위가 하나도 없으면 검색기가 그 조문을 결과에서 뺀다.
        for case in cases.CASES:
            with self.subTest(case=case.name):
                for chunk in self.chunks_at(case.article_path):
                    self.assertTrue(units(case.query) & units(chunk.text))

    def test_split_quote_starts_at_second_paragraph_without_title(self):
        case = cases.SPLIT_CASE
        chunk = self.only_chunk(case.article_path)
        sibling = self.only_chunk(cases.SPLIT_SIBLING_PATH)
        quote = self.quote(chunk)

        self.assertTrue(quote.startswith("②"))
        self.assertNotIn(cases.SPLIT_TITLE, quote)
        # 검색용 글에만 조 제목이 붙고, 두 항의 제목은 같다.
        self.assertEqual(chunk.text, f"{cases.SPLIT_TITLE}\n{quote}")
        self.assertTrue(sibling.text.startswith(f"{cases.SPLIT_TITLE}\n①"))
        # 제목이 같으므로 본문에서 겹치는 단위가 ②항 쪽에 더 많아야 고를 수 있다.
        query_units = units(case.query)
        self.assertGreater(
            len(query_units & units(chunk.text)),
            len(query_units & units(sibling.text)),
        )

    def test_particle_query_meets_chunk_only_through_character_pairs(self):
        case = cases.PARTICLE_CASE
        query_words, query_pairs = words_and_pairs(case.query)
        chunk = self.only_chunk(case.article_path)
        _, chunk_pairs = words_and_pairs(chunk.text)

        for other in self.chunks:
            with self.subTest(article_path=other.article_path, start=other.start):
                other_words, _ = words_and_pairs(other.text)
                self.assertEqual(query_words & other_words, set())
        self.assertTrue(query_pairs & chunk_pairs)

    def test_article_number_query_names_exactly_one_chunk(self):
        for case in cases.NUMBER_CASES:
            with self.subTest(case=case.name):
                number = _ARTICLE_NUMBER.fullmatch(case.query).groups()
                same_number = [
                    chunk.article_path
                    for chunk in self.chunks
                    if _ARTICLE_NUMBER.match(chunk.article_path).groups() == number
                ]
                self.assertEqual(same_number, [case.article_path])

    def test_article_12_pairs_also_appear_in_lookalike_chunks(self):
        # 두 글자만으로는 번호를 못 가른다는 근거를 사례 표가 실제로 담는지 본다.
        _, query_pairs = words_and_pairs(cases.NUMBER_LOOKALIKE_QUERY)
        self.assertEqual(query_pairs, {"제1", "12", "2조"})

        for article_path in cases.NUMBER_LOOKALIKE_PATHS:
            with self.subTest(article_path=article_path):
                _, chunk_pairs = words_and_pairs(self.only_chunk(article_path).text)
                self.assertLessEqual(query_pairs, chunk_pairs)

    def test_mismatch_query_shares_no_unit_with_any_chunk(self):
        query_units = units(cases.MISMATCH_QUERY)
        self.assertTrue(query_units)

        for chunk in self.chunks:
            with self.subTest(article_path=chunk.article_path, start=chunk.start):
                self.assertEqual(query_units & units(chunk.text), set())

    def test_tie_chunks_share_search_text_and_differ_in_start(self):
        first, second = self.chunks_at(cases.TIE_CASE.article_path)

        self.assertEqual(first.text, second.text)
        self.assertLess(first.start, second.start)
        self.assertEqual(self.quote(first), self.quote(second))


if __name__ == "__main__":
    unittest.main()
