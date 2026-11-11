"""Parse regulation headings while preserving their input character offsets."""

import re
from dataclasses import dataclass, field
from typing import Literal

Level = Literal["article", "paragraph", "item"]
_LEVELS: tuple[Level, ...] = ("article", "paragraph", "item")
_MARKER = re.compile(
    r"[^\S\r\n]*(?:(?P<article>제[0-9]+조(?:의[0-9]+)?\([^()\r\n]+\))"
    r"|(?P<paragraph>[①-⑳])|(?P<item>[0-9]+\.(?![0-9])))"
)


@dataclass
class ArticleNode:
    level: Level
    label: str
    article_path: str
    start: int
    end: int
    children: list["ArticleNode"] = field(default_factory=list)


def parse_articles(text: str) -> list[ArticleNode]:
    """Return article trees with half-open character spans into text."""
    articles: list[ArticleNode] = []
    open_nodes: list[ArticleNode] = []
    offset = 0

    for line in text.splitlines(keepends=True):
        marker = _MARKER.match(line)
        if marker and marker.lastgroup and (open_nodes or marker.lastgroup == "article"):
            depth = _LEVELS.index(marker.lastgroup)
            level = _LEVELS[depth]
            start = offset + marker.start(level)
            end = start
            while end > 0 and text[end - 1].isspace():
                end -= 1
            while open_nodes and _LEVELS.index(open_nodes[-1].level) >= depth:
                open_nodes.pop().end = end

            label = marker.group(level)
            parent = open_nodes[-1] if open_nodes else None
            path = f"{parent.article_path} {label}" if parent else label
            node = ArticleNode(level, label, path, start, start)
            siblings = parent.children if parent else articles
            siblings.append(node)
            open_nodes.append(node)
        offset += len(line)

    end = len(text.rstrip())
    for node in open_nodes:
        node.end = end
    return articles
