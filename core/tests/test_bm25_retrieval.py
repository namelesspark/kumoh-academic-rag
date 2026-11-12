import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from kumoh_rag_core.chunking import chunk_articles
from kumoh_rag_core.retrieval import BM25Retriever


class BM25RetrievalTests(unittest.TestCase):
    def assert_first_result(self, source, results, path, citation):
        self.assertTrue(results)
        first = results[0]
        self.assertEqual(first.rank, 1)
        self.assertGreater(first.score, 0)
        self.assertEqual(first.chunk.article_path, path)
        self.assertEqual(source[first.chunk.start:first.chunk.end], citation)

    def test_particles_match_through_character_bigrams(self):
        path = "제1조(종이 달 학교의 휴학)"
        citation = f"{path} 휴학 신청 때 별빛 도장을 받는다."
        source = f"{citation}\r\n\t제2조(구름 종) 모형 종을 울린다.\r\n"

        results = BM25Retriever(chunk_articles(source)).retrieve("휴학을 신청하려면?")

        self.assert_first_result(source, results, path, citation)

    def test_article_number_prioritizes_its_path_over_similar_numbers_and_citations(self):
        path = "제12조(별빛 상자)"
        branched_path = "제12조의2(달빛 상자)"
        other_path = "제112조(구름 상자)"
        citation = f"{path} 종이 별을 넣는다."
        branched_citation = f"{branched_path} 종이 달을 넣는다."
        other_citation = f"{other_path} 제12조의2 제12조를 참고해 종이 구름을 넣는다."
        reference_path = "제8조(밤하늘 지도)"
        cross_reference = f"{reference_path} 제12조 제12조 제12조를 펼친다."
        source = "\n".join((cross_reference, other_citation, branched_citation, citation))
        retriever = BM25Retriever(chunk_articles(source))

        for query, expected_path, expected_citation in (
            ("제12조", path, citation),
            ("제12조의2", branched_path, branched_citation),
            ("제112조", other_path, other_citation),
            ("제１２조의２", branched_path, branched_citation),
        ):
            with self.subTest(query=query):
                results = retriever.retrieve(query)
                self.assert_first_result(source, results, expected_path, expected_citation)

        results = retriever.retrieve("제12조")
        scores_by_path = {result.chunk.article_path: result.score for result in results}
        self.assertGreater(scores_by_path[reference_path], scores_by_path[path])

    def test_split_paragraph_matches_its_body_and_cites_only_the_paragraph(self):
        title = "제4조(종이 달 공방)"
        first = "① 반달은 은빛 상자에 둔다."
        second = "② 보름달은 별빛 서랍에 둔다."
        source = f"{title}\r\n\t{first}\r\n  {second}\r\n"
        chunks = chunk_articles(source, max_chars=len(title) + len(second))

        results = BM25Retriever(chunks).retrieve("보름달을")

        self.assert_first_result(source, results, f"{title} ②", second)
        self.assertIs(results[0].chunk, chunks[1])

    def test_no_overlapping_terms_returns_no_results(self):
        chunks = chunk_articles("제1조(종이 별) 별빛 상자를 연다.")
        retriever = BM25Retriever(chunks)

        self.assertEqual(retriever.retrieve("잠수함"), [])
        self.assertEqual(retriever.retrieve(" \t\n"), [])
        self.assertEqual(BM25Retriever([]).retrieve("종이"), [])

    def test_only_common_words_returns_no_results(self):
        source = "제1조(종이 별) 가상의 별빛 상자를 연다.\n제2조(구름 종) 가상의 모형 종을 울린다."
        retriever = BM25Retriever(chunk_articles(source))

        self.assertEqual(retriever.retrieve("가상의 날씨"), [])

    def test_only_common_character_bigrams_returns_no_results(self):
        source = "제1조(종이 별) 별빛상자를 연다.\n제2조(구름 종) 별빛종을 울린다."
        retriever = BM25Retriever(chunk_articles(source))

        self.assertEqual(retriever.retrieve("별빛깔"), [])

    def test_article_number_matches_even_when_shared_by_all_paragraphs(self):
        title = "제4조(종이 달 공방)"
        first = "① 반달은 은빛 상자에 둔다."
        second = "② 만월은 별빛 서랍에 둔다."
        source = f"{title}\n{first}\n{second}\n"
        chunks = chunk_articles(source, max_chars=len(title) + len(second))

        self.assertEqual(len(chunks), 2)
        results = BM25Retriever(chunks).retrieve("제4조")

        self.assert_first_result(source, results, f"{title} ①", first)

    def test_single_chunk_matches_shared_terms(self):
        path = "제1조(종이 별)"
        source = f"{path} 가상의 별빛 상자를 연다."
        chunks = chunk_articles(source)

        self.assertEqual(len(chunks), 1)
        results = BM25Retriever(chunks).retrieve("가상의 날씨")

        self.assert_first_result(source, results, path, source)

    def test_tied_scores_use_source_order_even_with_reversed_input(self):
        citation = "제1조(별빛 우체국) 종이 별을 봉투에 담는다."
        source = f"{citation}\n{citation}\n제2조(구름 종) 모형 종을 울린다.\n"
        first, second, unrelated = chunk_articles(source)
        retriever = BM25Retriever([second, first, unrelated])

        results = retriever.retrieve("봉투")

        self.assertEqual([result.rank for result in results], [1, 2])
        self.assertIs(results[0].chunk, first)
        self.assertIs(results[1].chunk, second)
        self.assertEqual(results[0].score, results[1].score)
        self.assertEqual(retriever.retrieve("봉투", top_k=1), results[:1])

    def test_nonpositive_top_k_is_rejected_even_without_query_or_chunks(self):
        retriever = BM25Retriever([])
        for top_k in (0, -1):
            with self.subTest(top_k=top_k):
                with self.assertRaises(ValueError):
                    retriever.retrieve("", top_k=top_k)


if __name__ == "__main__":
    unittest.main()
