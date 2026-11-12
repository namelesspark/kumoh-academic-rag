import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from kumoh_rag_core.chunking import chunk_articles
from kumoh_rag_core.parsing import parse_articles


TITLE = "제1조(가상 별자리)"
FIRST_PARAGRAPH = "① 종이 별을 고른다."
ITEM = "1. 가상의 별자리에 종이 별을 붙인다."
LAST_PARAGRAPH = f"② 상상의 밤하늘을 꾸민다.\r\n\t {ITEM}"
ARTICLE = f"{TITLE}\r\n\t{FIRST_PARAGRAPH}\r\n  {LAST_PARAGRAPH}"


class BoundaryLineTests(unittest.TestCase):
    def assert_span(self, source, span, path, expected):
        start = source.index(expected)
        self.assertEqual(span.article_path, path)
        self.assertEqual((span.start, span.end), (start, start + len(expected)))
        self.assertEqual(source[span.start:span.end], expected)

    def assert_article_tree(self, source, article):
        first, last = article.children
        (item,) = last.children
        self.assertEqual(first.children, [])
        for node, level, path, expected in (
            (article, "article", TITLE, ARTICLE),
            (first, "paragraph", f"{TITLE} ①", FIRST_PARAGRAPH),
            (last, "paragraph", f"{TITLE} ②", LAST_PARAGRAPH),
            (item, "item", f"{TITLE} ② 1.", ITEM),
        ):
            with self.subTest(path=path):
                self.assertEqual(node.level, level)
                self.assert_span(source, node, path, expected)

    def test_initial_bom_keeps_first_article_at_original_offset(self):
        source = f"\ufeff{ARTICLE}"
        (article,) = parse_articles(source)
        self.assertEqual(article.start, 1)
        self.assert_article_tree(source, article)
        (chunk,) = chunk_articles(source)
        self.assert_span(source, chunk, TITLE, ARTICLE)

    def test_supplementary_heading_ends_the_last_paragraph_chunk(self):
        for heading in ("부칙", "부 칙", "부칙 <가상 주석>", "부 칙 (가상 주석)"):
            for ending in ("", "\n", "\r\n"):
                with self.subTest(heading=heading, ending=ending):
                    outside = (
                        f"{ending} ③ 조문 밖의 가상 문장\r\n\t2. 조문 밖의 가상 번호"
                        if ending else ""
                    )
                    source = f"{ARTICLE}\t\r\n\t {heading} \t{outside}"
                    (article,) = parse_articles(source)
                    self.assert_article_tree(source, article)
                    first, last = chunk_articles(source, max_chars=len(ARTICLE) - 1)
                    self.assert_span(source, first, f"{TITLE} ①", FIRST_PARAGRAPH)
                    self.assert_span(source, last, f"{TITLE} ②", LAST_PARAGRAPH)

    def test_deleted_article_line_ends_previous_article_and_keeps_next_offset(self):
        next_title = "제3조(가상 달 모형)"
        next_article = f"{next_title} 종이 달을 접는다."
        for deleted in (
            "제2조 삭제",
            "제2조의2 삭제",
            "제2조 삭제 <가상 주석>",
            "제2조의2 삭제 <가상 주석>",
        ):
            with self.subTest(deleted=deleted):
                source = f"{ARTICLE} \r\n\t {deleted}\t\r\n  {next_article}"
                first, second = parse_articles(source)
                self.assert_article_tree(source, first)
                self.assert_span(source, second, next_title, next_article)
                self.assertEqual(second.children, [])
                first_chunk, second_chunk = chunk_articles(source)
                self.assert_span(source, first_chunk, TITLE, ARTICLE)
                self.assert_span(source, second_chunk, next_title, next_article)
