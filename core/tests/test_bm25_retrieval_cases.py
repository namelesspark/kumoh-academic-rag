"""가상 규정 사례 표의 질문을 실제 검색기에 넣어 채점한다.

사례 표(retrieval_cases)는 시험 문제지와 정답지고, 이 파일은 채점이다.
채점받는 쪽은 낱말 겹침으로 점수를 매기는 검색기(BM25Retriever)다.
질문마다 1위 조문의 경로와, 원문을 source[start:end]로 자른 인용을 정답과 견준다.
검색용 글(chunk.text)은 항으로 나눌 때 조 제목이 앞에 붙으므로 인용으로 보지 않는다.
모든 입력은 지어낸 규정 문장이고 실제 학칙과 관계가 없다.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import retrieval_cases as cases
from kumoh_rag_core.chunking import chunk_articles
from kumoh_rag_core.retrieval import BM25Retriever


class BM25RetrievalCaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = cases.SOURCE
        cls.chunks = chunk_articles(cls.source, max_chars=cases.MAX_CHARS)
        # 검색 문단을 넣는 순서가 결과를 바꾸지 않는지 보려고 두 가지로 만든다.
        cls.retrievers = {
            "원문 순서": BM25Retriever(cls.chunks),
            "역순": BM25Retriever(reversed(cls.chunks)),
        }

    def quote(self, chunk):
        return self.source[chunk.start:chunk.end]

    def test_first_result_matches_expected_path_and_source_quote(self):
        for order, retriever in self.retrievers.items():
            for case in cases.CASES:
                with self.subTest(order=order, case=case.name):
                    results = retriever.retrieve(case.query)

                    self.assertTrue(results)
                    first = results[0]
                    self.assertEqual(first.rank, 1)
                    self.assertGreater(first.score, 0)
                    self.assertEqual(first.chunk.article_path, case.article_path)
                    self.assertEqual(self.quote(first.chunk), case.quote)

    def test_split_first_result_quotes_second_paragraph_without_title(self):
        case = cases.SPLIT_CASE
        first = self.retrievers["원문 순서"].retrieve(case.query)[0]
        quote = self.quote(first.chunk)

        self.assertTrue(quote.startswith("②"))
        self.assertNotIn(cases.SPLIT_TITLE, quote)
        # 검색용 글에는 조 제목이 붙어 있어 인용과 다르다.
        self.assertNotEqual(first.chunk.text, quote)

    def test_mismatch_query_returns_empty_list(self):
        for order, retriever in self.retrievers.items():
            with self.subTest(order=order):
                self.assertEqual(retriever.retrieve(cases.MISMATCH_QUERY), [])

    def test_tied_chunks_come_out_in_source_position_order(self):
        # 두 문단은 경로와 인용이 같아서 원문 위치(start)로만 순서를 가릴 수 있다.
        case = cases.TIE_CASE
        for order, retriever in self.retrievers.items():
            with self.subTest(order=order):
                results = retriever.retrieve(case.query)
                tied = [
                    result
                    for result in results
                    if result.chunk.article_path == case.article_path
                ]

                self.assertEqual(len(tied), case.chunk_count)
                self.assertEqual(results[:2], tied)
                first, second = tied
                self.assertEqual((first.rank, second.rank), (1, 2))
                self.assertEqual(first.score, second.score)
                self.assertLess(first.chunk.start, second.chunk.start)
                self.assertEqual(self.quote(first.chunk), self.quote(second.chunk))
                # 한 건만 요청해도 원문에서 앞선 쪽이 남는다.
                self.assertEqual(retriever.retrieve(case.query, top_k=1), [first])


if __name__ == "__main__":
    unittest.main()
