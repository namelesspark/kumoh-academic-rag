"""규정에서 원문을 다시 꺼낼 수 있는 검색 문단을 만든다."""

from .article_chunker import ArticleChunk, chunk_articles

__all__ = ["ArticleChunk", "chunk_articles"]
