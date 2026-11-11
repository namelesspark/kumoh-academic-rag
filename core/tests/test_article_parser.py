import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from kumoh_rag_core.parsing import parse_articles


class ArticleParserTests(unittest.TestCase):
    def assert_span(self, text, node, expected):
        start = text.index(expected)
        self.assertEqual((node.start, node.end), (start, start + len(expected)))
        self.assertEqual(text[node.start:node.end], expected)

    def test_nested_ranges_and_parent_transitions(self):
        first_item = "3. 달 토끼에게 종이 별을 준다.\r\n\t다음 줄에는 가상의 별을 그린다."
        last_item = "999. 상상 속 별을 접는다."
        first_paragraph = f"② 가상의 분류다.\r\n\t{first_item}  \r\n  {last_item}"
        second_paragraph = "⑳ 문장 중간의 ① 및 1. 표기는 본문이다.\r\n2026. 가상의 달력이다."
        first_article = f"제12조(종이 별) 가상의 조문이다.\r\n\t{first_paragraph}\r\n  {second_paragraph}"
        direct_item = "1. 가상의 은하 지도를 펼친다."
        second_article = f"제12조의2(은하 지도)\r\n\t{direct_item}"
        text = (
            f"가상의 전문이다.\r\n제1장 상상 세계\r\n① 전문에 딸린 표기\r\n"
            f"1. 전문에 딸린 번호\r\n \t{first_article}\t\r\n"
            f" \t{second_article}\r\n  "
        )

        first, second = parse_articles(text)
        p1, p2 = first.children
        i1, i2 = p1.children
        (direct,) = second.children
        for node, expected in (
            (first, first_article),
            (p1, first_paragraph),
            (i1, first_item),
            (i2, last_item),
            (p2, second_paragraph),
            (second, second_article),
            (direct, direct_item),
        ):
            with self.subTest(path=node.article_path):
                self.assert_span(text, node, expected)
        self.assertEqual((first.level, first.label, first.article_path),
                         ("article", "제12조(종이 별)", "제12조(종이 별)"))
        self.assertEqual((p1.level, p1.label, p1.article_path),
                         ("paragraph", "②", "제12조(종이 별) ②"))
        self.assertEqual((i1.level, i1.label, i1.article_path),
                         ("item", "3.", "제12조(종이 별) ② 3."))
        self.assertEqual(direct.article_path, "제12조의2(은하 지도) 1.")
        self.assertEqual(p2.children, [])

    def test_chapter_and_section_close_all_open_nodes(self):
        for heading in ("제2장 가상의 무대", "제2절 가상의 무대"):
            with self.subTest(heading=heading):
                item = "1. 구름 모형을 둔다."
                paragraph = f"① 빈 무대를 상상한다.\n{item}"
                article = f"제1조(종이 구름)\n{paragraph}"
                next_article = "제2조(종이 달) 달 모형을 둔다."
                text = (
                    f"{article}  \n\t{heading}\n② 조문 밖의 가상 표기\n"
                    f"2. 조문 밖의 가상 번호\n{next_article}"
                )
                first, second = parse_articles(text)
                (child,) = first.children
                (grandchild,) = child.children
                self.assert_span(text, first, article)
                self.assert_span(text, child, paragraph)
                self.assert_span(text, grandchild, item)
                self.assert_span(text, second, next_article)
                self.assertEqual(second.children, [])

    def test_empty_input(self):
        self.assertEqual(parse_articles(""), [])
