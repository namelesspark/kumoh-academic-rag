import sys; from pathlib import Path; sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import unittest

from kumoh_rag_core.parsing.article_parser import parse_articles


class ArticleParserTests(unittest.TestCase):
    def test_parent_switches_at_each_level(self):
        text = (
            "제1조(달 기지 정리)\n"
            "① 정리 순서\n"
            "1. 달 먼지를 모은다.\n"
            "2. 별빛 상자를 닫는다.\n"
            "② 점검 순서\n"
            "3. 별빛 상자를 센다.\n"
            "제2조(화성 기지 정리)\n"
            "⑳ 화성 모래를 모은다."
        )
        moon, mars = parse_articles(text)
        cleanup, inspection = moon.children
        first, second = cleanup.children
        (third,) = inspection.children
        (mars_paragraph,) = mars.children

        self.assertEqual((moon.level, cleanup.level, first.level), ("article", "paragraph", "item"))
        self.assertEqual((moon.label, cleanup.label, first.label), ("제1조(달 기지 정리)", "①", "1."))
        self.assertEqual(third.article_path, "제1조(달 기지 정리) ② 3.")
        self.assertEqual(mars_paragraph.article_path, "제2조(화성 기지 정리) ⑳")
        self.assertEqual(text[first.start:first.end], "1. 달 먼지를 모은다.")
        self.assertEqual(text[second.start:second.end], "2. 별빛 상자를 닫는다.")
        self.assertEqual(moon.end, inspection.end)
        self.assertEqual(inspection.end, third.end)
        self.assertEqual(mars.end, len(text))

    def test_multiline_korean_spans_preserve_input(self):
        text = (
            "  제12조(별빛 보관)\r\n"
            "\t② 별빛을 모은다.\r\n"
            "  다음 날 다시 센다.\r\n"
            "    3. 상자에 넣는다.  \r\n\t"
        )
        (article,) = parse_articles(text)
        (paragraph,) = article.children
        (item,) = paragraph.children

        self.assertEqual(article.start, 2)
        self.assertEqual(paragraph.start, text.index("②"))
        self.assertEqual(item.start, text.index("3."))
        self.assertEqual(item.article_path, "제12조(별빛 보관) ② 3.")
        self.assertEqual(text[item.start:item.end], "3. 상자에 넣는다.")
        self.assertEqual(text[paragraph.start:paragraph.end], text[text.index("②"):].rstrip())
        self.assertEqual(text[article.start:article.end], text[2:].rstrip())

    def test_article_suffix_after_preamble(self):
        preamble = "가상 우주정거장 운영규정\n제1장 별빛 관리\n"
        heading = "제12조의3(별빛 반납)"
        text = preamble + heading + "\n별빛은 해 뜨기 전에 반납한다."
        (article,) = parse_articles(text)

        self.assertEqual(article.start, len(preamble))
        self.assertEqual(article.label, heading)
        self.assertEqual(article.article_path, heading)
        self.assertEqual(text[article.start:article.end], text[len(preamble):])

    def test_inline_markers_remain_in_body(self):
        text = "제1조(달 토끼 안내)\n상자 ①에 쪽지 1.을 넣는다."
        (article,) = parse_articles(text)

        self.assertEqual(article.children, [])
        self.assertEqual(text[article.start:article.end], text)

    def test_empty_input(self):
        self.assertEqual(parse_articles(""), [])
