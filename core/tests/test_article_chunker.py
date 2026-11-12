import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from kumoh_rag_core.chunking import chunk_articles


class ArticleChunkerTests(unittest.TestCase):
    def assert_chunks(self, source, chunks, expected):
        self.assertEqual(len(chunks), len(expected))
        previous_end = 0
        for chunk, (path, original, search_text) in zip(chunks, expected):
            with self.subTest(path=path):
                start = source.index(original)
                self.assertGreaterEqual(chunk.start, previous_end)
                self.assertEqual((chunk.start, chunk.end), (start, start + len(original)))
                self.assertEqual(source[chunk.start:chunk.end], original)
                self.assertEqual(chunk.article_path, path)
                self.assertEqual(chunk.text, search_text)
                previous_end = chunk.end

    def test_length_boundary_keeps_article_or_splits_at_paragraphs(self):
        title = "제1조(종이 달)"
        intro = f"{title} 종이 달의 모양을 정한다."
        first = "① 반달을 접는다.\r\n\t 1. 접은 자리를 그린다."
        second = "② 보름달은 따로 그린다."
        article = f"{intro}  \r\n\t{first}\r\n  {second}"
        source = f"\t {article}  \r\n"

        self.assert_chunks(
            source, chunk_articles(source, max_chars=len(article)),
            [(title, article, article)],
        )
        self.assert_chunks(
            source, chunk_articles(source, max_chars=len(article) - 1),
            [(title, intro, intro), (f"{title} ①", first, f"{title}\n{first}"),
             (f"{title} ②", second, f"{title}\n{second}")],
        )

    def test_branched_article_and_chapter_and_section_boundaries(self):
        branched_title = "제7조의2(별빛 상자)"
        paragraph = "① 별빛 모형을 접어서 상자에 둔다."
        before = "제7조(구름) 종이 구름을 그린다."
        after = "제8조(달빛) 가상의 달빛을 모은다."
        source = (
            f"{before}\r\n\t제2장 가상의 밤하늘\r\n"
            f" {branched_title}\r\n\t{paragraph}\r\n"
            f"\t제3절 가상의 달빛\r\n  {after}\r\n"
        )

        self.assert_chunks(
            source, chunk_articles(source, max_chars=1),
            [("제7조(구름)", before, before),
             (f"{branched_title} ①", paragraph, f"{branched_title}\n{paragraph}"),
             ("제8조(달빛)", after, after)],
        )

    def test_long_article_with_direct_items_and_no_paragraph_stays_whole(self):
        title = "제1조(은하 지도)"
        source = f"{title}\n\t1. 가상의 지도를 펼친다.\n  2. 종이 별을 표시한다."

        self.assert_chunks(
            source, chunk_articles(source, max_chars=1), [(title, source, source)],
        )

    def test_nonpositive_length_is_rejected_even_without_an_article(self):
        for max_chars in (0, -1):
            with self.subTest(max_chars=max_chars):
                with self.assertRaises(ValueError):
                    chunk_articles("", max_chars=max_chars)


if __name__ == "__main__":
    unittest.main()
