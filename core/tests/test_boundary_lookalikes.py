"""경계 줄처럼 보이지만 본문으로 남아야 하는 줄을 확인한다.

부칙 제목과 삭제 줄은 서류철의 색인 칸막이다. 이 파일은 칸막이와 닮았을 뿐인
보통 종이가 앞 문서에서 떨어져 나가지 않는지 본다. 모든 입력은 가상의 규정 문장이다.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from kumoh_rag_core.chunking import chunk_articles
from kumoh_rag_core.parsing import parse_articles

BOM = "﻿"  # 문서 맨 앞에 붙는 보이지 않는 표식 (바이트 순서 표식)

# 직전 조문의 마지막 호 안에 그대로 남아야 하는 줄
BODY_LINES = (
    # 부칙 제목과 닮은 줄
    "부칙에 따라 가상의 등대를 다시 칠한다.",
    "부칙 제2조를 준용한다.",
    "부칙 <가상 주석>에 따라 종이 불빛을 고친다.",
    "부칙(가상 주석)에 따라 종이 불빛을 고친다.",
    # 삭제 줄과 닮은 줄
    "제2조 삭제 절차를 가상의 장부에 적는다.",
    "제2조의2 삭제에 관한 사항은 가상의 장부에 적는다.",
    "제2조 삭제 <가상 주석>에 따라 장부를 고친다.",
    "제2조부터 제4조까지 삭제",
    # 문장 중간이나 줄 끝에 나오는 표기
    "이 경우 부칙 및 제2조 삭제 여부는 가상의 장부에 적는다.",
    "가상의 경과 조치는 부칙",
    "가상의 장부에서 제2조 삭제",
    # 문서 중간 줄 맨 앞의 BOM과 그 뒤 조문 표기
    f"{BOM}제3조(종이 닻) 가상의 닻을 내린다.",
)
NEWLINES = ("\n", "\r\n")
INDENTS = ("", "\t  ")


class BoundaryLookalikeTests(unittest.TestCase):
    def assert_span(self, source, node, expected):
        start = source.index(expected)
        self.assertEqual((node.start, node.end), (start, start + len(expected)))
        self.assertEqual(source[node.start:node.end], expected)

    def assert_chunks(self, source, chunks, expected):
        self.assertEqual(
            [(chunk.article_path, chunk.text) for chunk in chunks],
            [(path, search_text) for path, _, search_text in expected],
        )
        for chunk, (_, original, _) in zip(chunks, expected):
            self.assert_span(source, chunk, original)

    def variants(self):
        for newline in NEWLINES:
            for indent in INDENTS:
                yield newline, indent

    def test_lookalike_line_stays_in_previous_article_item_and_chunks(self):
        title = "제1조(종이 등대)"
        first = "① 가상의 등대를 세운다."
        after = "제9조(종이 배) 가상의 배를 띄운다."

        for line in BODY_LINES:
            for newline, indent in self.variants():
                with self.subTest(line=line, newline=newline, indent=indent):
                    item = f"1. 종이 불빛을 켠다.{newline}{indent}{line}"
                    last = f"② 가상의 불빛을 정한다.{newline}\t{item}"
                    article = f"{title}{newline}{first}{newline}  {last}"
                    source = (
                        f"가상의 전문이다.{newline} \t{article}  {newline}"
                        f"{after}{newline}"
                    )

                    previous, following = parse_articles(source)
                    opening, closing = previous.children
                    (numbered,) = closing.children

                    self.assert_span(source, previous, article)
                    self.assert_span(source, opening, first)
                    self.assert_span(source, closing, last)
                    self.assert_span(source, numbered, item)
                    self.assertEqual(opening.children, [])
                    self.assertEqual(
                        [previous.article_path, closing.article_path, numbered.article_path],
                        [title, f"{title} ②", f"{title} ② 1."],
                    )
                    for node in (previous, closing, numbered):
                        self.assertTrue(source[node.start:node.end].endswith(line))
                    self.assert_span(source, following, after)
                    self.assertEqual(following.children, [])

                    # 조문 전체가 검색 문단 하나일 때
                    self.assert_chunks(
                        source, chunk_articles(source),
                        [(title, article, article),
                         ("제9조(종이 배)", after, after)],
                    )
                    # 긴 조문을 항으로 나눌 때 마지막 항이 그 줄까지 품는다
                    self.assert_chunks(
                        source, chunk_articles(source, max_chars=1),
                        [(f"{title} ①", first, f"{title}\n{first}"),
                         (f"{title} ②", last, f"{title}\n{last}"),
                         ("제9조(종이 배)", after, after)],
                    )

    def test_article_titled_deleted_stays_an_article(self):
        before = "제1조(종이 등대) 가상의 등대를 세운다."
        deleted = "제2조(삭제)"
        after = "제3조(종이 배) 가상의 배를 띄운다."

        for newline, indent in self.variants():
            with self.subTest(newline=newline, indent=indent):
                source = f"{before}{newline}{indent}{deleted}{newline}{after}{newline}"

                first, second, third = parse_articles(source)

                self.assert_span(source, first, before)
                self.assert_span(source, second, deleted)
                self.assert_span(source, third, after)
                self.assertEqual(
                    [(node.level, node.label, node.article_path) for node in (first, second, third)],
                    [("article", "제1조(종이 등대)", "제1조(종이 등대)"),
                     ("article", deleted, deleted),
                     ("article", "제3조(종이 배)", "제3조(종이 배)")],
                )
                self.assertEqual(second.children, [])
                self.assert_chunks(
                    source, chunk_articles(source, max_chars=1),
                    [("제1조(종이 등대)", before, before),
                     (deleted, deleted, deleted),
                     ("제3조(종이 배)", after, after)],
                )

    def test_deleted_paragraph_stays_a_paragraph(self):
        title = "제1조(종이 등대)"
        first = "① 가상의 등대를 세운다."
        deleted = "② 삭제"
        third = "③ 가상의 불빛을 끈다."
        after = "제2조(종이 배) 가상의 배를 띄운다."

        for newline, indent in self.variants():
            with self.subTest(newline=newline, indent=indent):
                article = (
                    f"{title}{newline}{first}{newline}"
                    f"{indent}{deleted}{newline}{third}"
                )
                source = f"{article}{newline}{after}"

                previous, following = parse_articles(source)
                p1, p2, p3 = previous.children

                self.assert_span(source, previous, article)
                self.assert_span(source, p1, first)
                self.assert_span(source, p2, deleted)
                self.assert_span(source, p3, third)
                self.assertEqual(
                    [(node.level, node.label, node.article_path) for node in (p1, p2, p3)],
                    [("paragraph", "①", f"{title} ①"),
                     ("paragraph", "②", f"{title} ②"),
                     ("paragraph", "③", f"{title} ③")],
                )
                self.assert_span(source, following, after)
                self.assert_chunks(
                    source, chunk_articles(source, max_chars=1),
                    [(f"{title} ①", first, f"{title}\n{first}"),
                     (f"{title} ②", deleted, f"{title}\n{deleted}"),
                     (f"{title} ③", third, f"{title}\n{third}"),
                     ("제2조(종이 배)", after, after)],
                )


if __name__ == "__main__":
    unittest.main()
