"""Parse regulation markers without changing source offsets."""

import re
from dataclasses import dataclass, field


@dataclass
class ArticleNode:
    level: str
    label: str
    article_path: str
    start: int
    end: int
    children: list["ArticleNode"] = field(default_factory=list)


_MARKER = re.compile(
    r"^[^\S\r\n]*(?:"
    r"(?P<heading>제[0-9]+[장절](?=\s|\(|$))"
    r"|(?P<article>제[0-9]+조(?:의[0-9]+)?\([^()\r\n]+\))(?=\s|$)"
    r"|(?P<paragraph>[①-⑳])"
    r"|(?P<item>[1-9][0-9]{0,2}\.)(?![0-9])"
    r")",
    re.MULTILINE,
)
_DEPTH = {"heading": 0, "article": 1, "paragraph": 2, "item": 3}


def parse_articles(text: str) -> list[ArticleNode]:
    """Return article trees whose spans are half-open character offsets."""
    articles: list[ArticleNode] = []
    opened: list[ArticleNode] = []

    def close_nodes(depth: int, boundary: int) -> None:
        if not opened or _DEPTH[opened[-1].level] < depth:
            return
        # All nodes closed here share the same last non-whitespace character.
        while boundary > opened[-1].start and text[boundary - 1].isspace():
            boundary -= 1
        while opened and _DEPTH[opened[-1].level] >= depth:
            opened.pop().end = boundary

    for marker in _MARKER.finditer(text):
        level = marker.lastgroup
        start = marker.start(level)
        close_nodes(_DEPTH[level], start)
        if level == "heading" or (level != "article" and not opened):
            continue

        label = marker.group(level)
        parent = opened[-1] if opened else None
        path = f"{parent.article_path} {label}" if parent else label
        node = ArticleNode(level, label, path, start, start + len(label))
        (parent.children if parent else articles).append(node)
        opened.append(node)

    close_nodes(0, len(text))
    return articles
