import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from kumoh_rag_core.chunking import chunk_articles
from kumoh_rag_core.retrieval import BM25Retriever


class BM25RetrievalTests(unittest.TestCase):
    def test_four_topic_queries_find_expected_articles_in_top_five(self):
        titles = (
            "졸업학점", "이수학점 등", "휴학", "복학",
            "수강신청 변경절차", "계절수업", "수강학점",
        )
        source = "\n".join(
            f"제{number}조({title}) 가상 종이학교의 별빛 활동을 정한다."
            for number, title in enumerate(titles, start=1)
        )
        retriever = BM25Retriever(chunk_articles(source))
        # API에서 동의어를 덧붙인 검색어도 코어에는 리터럴로 전달한다.
        for query, expected in (
            ("졸업 학점 몇 점 필요한가요", "제1조(졸업학점)"),
            ("한 학기 수강학점 최대 몇 점", "제7조(수강학점)"),
            ("수강신청 변경절차 알려 주세요", "제5조(수강신청 변경절차)"),
            ("계절학기 신청 계절수업", "제6조(계절수업)"),
        ):
            with self.subTest(query=query):
                paths = [result.chunk.article_path for result in retriever.retrieve(query)]
                self.assertIn(expected, paths)
                self.assertLessEqual(len(paths), 5)

    def test_exact_title_bonus_removes_spaces_and_three_suffixes(self):
        for title in ("이 수 학 점", "이수학점 등", "이수학점 및 신청", "이수학점에 관한 절차"):
            with self.subTest(title=title):
                source = f"제1조({title}) 가상 별빛 학점을 정한다.\n제2조(구름 놀이) 종을 접는다."
                retriever = BM25Retriever(chunk_articles(source))
                for query in ("이수학점", "이수 학점"):
                    with self.subTest(query=query):
                        boosted = retriever.retrieve(query)
                        baseline = BM25Retriever(chunk_articles(source))
                        baseline._exact_titles = [""] * len(baseline._chunks)
                        original = baseline.retrieve(query)
                        self.assertEqual(boosted[0].chunk, original[0].chunk)
                        # 후보가 하나라 가산 전 최고점은 기존 제목 가산을 빼서 구한다.
                        raw = BM25Retriever(chunk_articles(source))
                        raw._exact_titles = [""] * len(raw._chunks)
                        raw._title_units = [set()] * len(raw._chunks)
                        raw_score = raw.retrieve(query)[0].score
                        self.assertAlmostEqual(boosted[0].score - original[0].score, 2 * raw_score)

    def test_separated_words_and_partial_titles_receive_no_exact_bonus(self):
        source = "제1조(졸업학점) 가상 졸업 학점을 정한다.\n제2조(구름 놀이) 종을 접는다."
        retriever = BM25Retriever(chunk_articles(source))
        baseline = BM25Retriever(chunk_articles(source))
        baseline._exact_titles = [""] * len(baseline._chunks)
        for query in ("졸업 필요 학점", "졸업학점표", "졸업 학점표"):
            with self.subTest(query=query):
                self.assertEqual(retriever.retrieve(query), baseline.retrieve(query))

    def test_exact_title_bonus_promotes_candidate_beyond_first_forty(self):
        source = "\n".join([
            *(f"제{number}조(가상 기록) 졸업 학점 안내를 정한다." for number in range(1, 46)),
            "제46조(졸업학점) " + "별빛 종이 구름 모형을 접는다. " * 50,
            "제47조(구름 놀이) 모형 종을 울린다.",
        ])
        chunks = chunk_articles(source)
        baseline = BM25Retriever(chunks)
        baseline._exact_titles = [""] * len(chunks)
        original = baseline.retrieve("졸업 학점 안내", top_k=len(chunks))
        target = "제46조(졸업학점)"
        original_rank = next(result.rank for result in original if result.chunk.article_path == target)
        self.assertGreater(len(original), 40)
        self.assertGreater(original_rank, 40)
        results = BM25Retriever(chunks).retrieve("졸업 학점 안내")
        self.assertIn(target, [result.chunk.article_path for result in results])

    def test_title_coverage_beats_long_articles_with_frequent_topic_words(self):
        source = "\n".join((
            "제1조(가상 절차) " + "졸업 학점 이수 신청 확인 " * 30,
            "제2조(졸업학점) 가상 종이학교는 별빛 활동을 마친다.",
            "제3조(가상 기록) " + "졸업 학점 기록 보관 " * 25,
        ))
        results = BM25Retriever(chunk_articles(source)).retrieve("졸업 학점")
        self.assertEqual(results[0].chunk.article_path, "제2조(졸업학점)")
        self.assertEqual(len(results), 3)

    def test_graduate_penalty_is_disabled_by_explicit_course_query(self):
        source = "\n".join((
            "제1조(이수학점) 대학원 종이학교는 별빛 학점을 정한다.",
            "제2조(이수학점) 학사과정 종이학교는 별빛 학점을 정한다.",
            "제3조(구름 놀이) 구름 모형을 접는다.",
        ))
        retriever = BM25Retriever(chunk_articles(source))
        ordinary = retriever.retrieve("학점")
        self.assertEqual(ordinary[0].chunk.article_path, "제2조(이수학점)")
        unpenalized = BM25Retriever(chunk_articles(source))
        unpenalized._graduate = [False] * len(unpenalized._chunks)
        for qualifier in ("대학원", "대학원생", "석사", "박사"):
            with self.subTest(qualifier=qualifier):
                explicit = retriever.retrieve("학점 " + qualifier)
                baseline = unpenalized.retrieve("학점 " + qualifier)
                self.assertEqual(explicit, baseline)
        self.assertEqual(retriever.retrieve("제1조 학점")[0].chunk.start, 0)

    def test_split_graduate_body_ignores_prepended_heading(self):
        source = "\n".join((
            "제1조(이수학점)",
            "① 대학원 종이학교는 별빛 학점을 정한다.",
            "② 학사과정 종이학교는 별빛 학점을 정한다.",
            "제2조(구름 놀이) 구름 모형을 접는다.",
        ))
        chunks = chunk_articles(source, max_chars=40)
        retriever = BM25Retriever(chunks)
        results = retriever.retrieve("학점")
        self.assertTrue(results[0].chunk.article_path.endswith("②"))
        graduate = next(result for result in results if result.chunk.article_path.endswith("①"))
        self.assertGreater(results[0].score, graduate.score)

    def test_later_graduate_mention_does_not_change_first_sentence_scope(self):
        source = "\n".join((
            "제1조(별빛 활동) 학사과정 종이학교의 학점이다. 대학원은 따로 정한다.",
            "제2조(구름 놀이) 구름 모형을 접는다.",
        ))
        retriever = BM25Retriever(chunk_articles(source))
        self.assertFalse(retriever._graduate[0])

    def test_graduate_title_is_detected_without_graduate_word_in_body(self):
        source = "제1조(대학원 이수학점) 종이학교는 별빛 학점을 정한다."
        retriever = BM25Retriever(chunk_articles(source))
        self.assertTrue(retriever._graduate[0])

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
