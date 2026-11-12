"""조문과 항을 기준으로 규정의 검색 문단을 만든다."""

from dataclasses import dataclass

from ..parsing import parse_articles


@dataclass(frozen=True)
class ArticleChunk:
    """검색용 문장, 조문 경로, 원문의 시작과 끝 글자 위치를 담는다."""

    text: str
    article_path: str
    start: int
    end: int


def chunk_articles(source: str, max_chars: int = 1000) -> list[ArticleChunk]:
    """긴 조를 항 경계에서 나눈다. 인용에는 source[start:end]를 쓴다."""
    if max_chars < 1:
        raise ValueError("max_chars must be at least 1")

    chunks: list[ArticleChunk] = []
    for article in parse_articles(source):
        start, end = article.start, article.end
        paragraphs = [node for node in article.children if node.level == "paragraph"]
        if end - start <= max_chars or not paragraphs:
            chunks.append(ArticleChunk(source[start:end], article.article_path, start, end))
            continue

        intro = source[start:paragraphs[0].start].rstrip()
        if len(intro) > len(article.label):
            chunks.append(ArticleChunk(intro, article.article_path, start, start + len(intro)))

        for paragraph in paragraphs:
            paragraph_text = source[paragraph.start:paragraph.end]
            chunks.append(
                ArticleChunk(
                    f"{article.label}\n{paragraph_text}",
                    paragraph.article_path,
                    paragraph.start,
                    paragraph.end,
                )
            )

    return chunks
