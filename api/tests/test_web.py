"""브라우저 채팅 화면과 화면에 필요한 파일을 서버가 제공하는지 확인함."""

import re
import sys
from hashlib import sha256
from html.parser import HTMLParser
import unittest
from pathlib import Path
from unittest.mock import patch

TESTS_DIR = Path(__file__).resolve().parent
sys.path[:0] = [str(TESTS_DIR.parent), str(TESTS_DIR)]

from app.main import app, CHAT_WEB_DIR, create_app, fingerprint_chat_assets
from asgi_harness import call_app


class Page(HTMLParser):
    """문서의 요소를 순서대로 모으고 부모와 자식을 이어 둔다 (표준 라이브러리 html.parser)."""

    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.elements = []
        self.open = []  # 아직 닫히지 않은 요소

    def _add(self, tag, attrs):
        node = {
            "tag": tag,
            "attrs": dict(attrs),
            "parent": self.open[-1] if self.open else None,
            "children": [],
            "text": "",
        }
        if node["parent"] is not None:
            node["parent"]["children"].append(node)
        self.elements.append(node)
        return node

    def handle_starttag(self, tag, attrs):
        node = self._add(tag, attrs)
        if tag not in self.VOID:
            self.open.append(node)

    def handle_startendtag(self, tag, attrs):
        # <path .../>처럼 스스로 닫는 요소는 열린 목록에 넣지 않는다.
        self._add(tag, attrs)

    def handle_endtag(self, tag):
        for position in range(len(self.open) - 1, -1, -1):
            if self.open[position]["tag"] == tag:
                del self.open[position:]
                return

    def handle_data(self, data):
        if self.open:
            self.open[-1]["text"] += data


def parse_page(html):
    page = Page()
    page.feed(html)
    page.close()
    return page


def topics_facts(html):
    """예시 질문 묶음(#topics)이 어디에 어떤 모양으로 있는지 사전으로 돌려준다."""
    page = parse_page(html)
    found = [node for node in page.elements if node["attrs"].get("id") == "topics"]
    facts = {"count": len(found)}
    if len(found) != 1:
        return facts

    topics = found[0]
    ancestors = []
    node = topics["parent"]
    while node is not None:
        ancestors.append(node)
        node = node["parent"]
    parent = topics["parent"]
    siblings = [child["attrs"].get("id") for child in parent["children"]] if parent else ["topics"]
    at = [child is topics for child in parent["children"]].index(True) if parent else 0
    facts.update(
        tag=topics["tag"],
        attrs=topics["attrs"],
        parent=(parent["tag"], parent["attrs"].get("class")) if parent else None,
        ancestor_tags=[item["tag"] for item in ancestors],
        ancestor_ids=[item["attrs"]["id"] for item in ancestors if "id" in item["attrs"]],
        neighbors=(
            siblings[at - 1] if at else None,
            siblings[at + 1] if at + 1 < len(siblings) else None,
        ),
        children=[
            (child["tag"], child["attrs"].get("id"), child["attrs"].get("class"), child["text"].strip())
            for child in topics["children"]
        ],
        button_types=[
            child["attrs"].get("type")
            for child in topics["children"]
            if "data-question" in child["attrs"]
        ],
        label_id_count=sum(node["attrs"].get("id") == "topics-label" for node in page.elements),
    )
    return facts


class TestChatWeb(unittest.TestCase):
    def test_root_serves_the_demo(self):
        response = call_app(app, "GET", "/", allow_wait=True)

        self.assertEqual(response.status, 200)
        self.assertTrue(response.headers["content-type"].startswith("text/html"))
        self.assertIn("frame-ancestors 'none'", response.headers["content-security-policy"])
        self.assertIn('lang="ko"', response.text())
        # 예전 안내 상자의 문구 대신, 화면에 남아 있는 하단 표시의 문구를 본다.
        self.assertIn("가상 학생 데이터입니다", response.text())
        self.assertIn('id="demo-login"', response.text())
        self.assertIn('id="demo-logout"', response.text())
        class PasswordFields(HTMLParser):
            def __init__(self):
                super().__init__()
                self.form_id = None
                self.fields = []

            def handle_starttag(self, tag, attrs):
                attributes = dict(attrs)
                if tag == "form":
                    self.form_id = attributes.get("id")
                if tag == "input" and attributes.get("type") == "password":
                    self.fields.append((self.form_id, attributes.get("autocomplete")))

            def handle_endtag(self, tag):
                if tag == "form":
                    self.form_id = None

        password_fields = PasswordFields()
        password_fields.feed(response.text())
        self.assertEqual(password_fields.fields, [("login-form", "off")])
        self.assertEqual(response.headers['cache-control'], 'no-cache')
        for name in ('chat.css', 'chat.js'):
            digest = sha256((CHAT_WEB_DIR / 'assets' / name).read_bytes()).hexdigest()
            self.assertIn(f'/chat-assets/{name}?v={digest}', response.text())

            async def versioned_request(scope, receive, send):
                scope['query_string'] = f'v={digest}'.encode('ascii')
                await app(scope, receive, send)

            asset = call_app(versioned_request, 'GET', f'/chat-assets/{name}', allow_wait=True)
            self.assertEqual(asset.status, 200)
            self.assertEqual(asset.headers['cache-control'], 'no-cache')

    def test_composer_keeps_one_input_row_and_a_hidden_file_input(self):
        # 색과 배치는 화면 테스트가 본다. 여기서는 index.html의 구조만 확인한다.
        class Composer(HTMLParser):
            """질문 입력 폼 안의 요소를 (부모 class, 태그, 속성) 순서대로 모은다."""

            VOID = {"input", "img", "br", "hr", "meta", "link"}

            def __init__(self):
                super().__init__()
                self.stack = []  # 폼 안에서 열려 있는 요소의 (태그, class)
                self.inside = False
                self.found = []

            def handle_starttag(self, tag, attrs):
                attributes = dict(attrs)
                if tag == "form" and attributes.get("id") == "composer":
                    self.inside = True
                    return
                if not self.inside:
                    return
                parent = self.stack[-1][1] if self.stack else "composer"
                self.found.append((parent, tag, attributes))
                if tag not in self.VOID:
                    self.stack.append((tag, attributes.get("class", tag)))

            def handle_endtag(self, tag):
                if not self.inside:
                    return
                if tag == "form":
                    self.inside = False
                elif self.stack and self.stack[-1][0] == tag:
                    self.stack.pop()

        composer = Composer()
        composer.feed((CHAT_WEB_DIR / "index.html").read_text(encoding="utf-8"))
        composer.close()

        def ids(parent):
            return [attributes.get("id") for owner, _, attributes in composer.found if owner == parent]

        by_id = {attributes["id"]: (owner, tag, attributes) for owner, tag, attributes in composer.found if "id" in attributes}

        # 밝은 상자 한 줄: 클립 버튼, 입력창, 보내기.
        self.assertEqual(ids("composer-row"), ["photo-attach", "question", "send"])
        # 상자 아래 묶음: 첨부 제거, 알림, 안내문 한 문단.
        self.assertEqual(ids("composer-meta"), ["photo-clear", "photo-note", "photo-hint"])
        # 폼 바로 아래에는 읽기용 라벨, 입력 줄, 숨긴 파일 입력, 아래 묶음만 있다.
        self.assertEqual(
            [(tag, attributes.get("class") or attributes.get("id")) for owner, tag, attributes in composer.found if owner == "composer"],
            [("label", "sr-only"), ("div", "composer-row"), ("input", "photo-file"), ("div", "composer-meta")],
        )

        _, tag, attach = by_id["photo-attach"]
        self.assertEqual((tag, attach.get("type"), attach.get("class")), ("button", "button", "attach-button"))
        self.assertEqual(attach.get("aria-label"), "사진 첨부")
        self.assertEqual(attach.get("aria-describedby"), "photo-hint")
        self.assertNotIn("data-action", attach)
        # 아이콘은 버튼 안에 직접 그린 선 그림 하나다. 그림 파일은 쓰지 않는다.
        self.assertEqual([tag for owner, tag, _ in composer.found if owner == "attach-button"], ["svg"])
        self.assertNotIn("img", [tag for _, tag, _ in composer.found])

        _, tag, file_input = by_id["photo-file"]
        self.assertEqual((tag, file_input.get("type"), file_input.get("accept")), ("input", "file", "image/jpeg,image/png"))
        self.assertIn("hidden", file_input)
        self.assertEqual(file_input.get("aria-describedby"), "photo-hint")

        self.assertEqual(by_id["photo-hint"][2].get("class"), "composer-hint")
        self.assertEqual([attributes.get("for") for _, tag, attributes in composer.found if tag == "label"], ["question"])
        self.assertEqual([tag for _, tag, _ in composer.found].count("p"), 2)
        for _, _, attributes in composer.found:
            self.assertNotIn("style", attributes)
            self.assertNotIn("attach-row", attributes.get("class", ""))

    def test_example_questions_sit_between_the_composer_and_the_transcript(self):
        # 서버가 내려 주는 첫 화면을 읽는다. 색과 배치는 화면 테스트가 본다.
        html = call_app(app, "GET", "/", allow_wait=True).text()
        facts = topics_facts(html)

        self.assertEqual(facts["count"], 1)
        self.assertEqual(facts["tag"], "div")
        self.assertEqual(
            facts["attrs"],
            {"class": "topics", "id": "topics", "role": "group", "aria-labelledby": "topics-label"},
        )
        # 대화 영역 바로 아래, 폼 다음이자 대화 내용 앞이다.
        self.assertEqual(facts["parent"], ("section", "chat"))
        self.assertIn("main", facts["ancestor_tags"])
        self.assertEqual(facts["neighbors"], ("composer", "transcript"))
        for outside in ("composer", "empty", "transcript"):
            self.assertNotIn(outside, facts["ancestor_ids"])
        # 이름표 하나와 기존 버튼 두 개가 순서대로 있다. 이름표 id가 묶음의 이름으로 연결된다.
        self.assertEqual(
            facts["children"],
            [
                ("span", "topics-label", "topics-label", "예시 질문"),
                ("button", None, None, "답변과 근거 조문"),
                ("button", None, None, "근거를 찾지 못한 경우"),
            ],
        )
        self.assertEqual(facts["button_types"], ["button", "button"])
        self.assertEqual(facts["label_id_count"], 1)

    def test_example_questions_moved_elsewhere_are_noticed(self):
        # 위 검사가 자리를 실제로 구분하는지, 묶음을 옮긴 가상 화면으로 확인한다.
        html = (CHAT_WEB_DIR / "index.html").read_text(encoding="utf-8")
        blocks = re.findall(r'[ \t]*<div class="topics".*?</div>\n', html, flags=re.DOTALL)
        self.assertEqual(len(blocks), 1)
        block = blocks[0]
        without = html.replace(block, "")
        self.assertEqual(len(without), len(html) - len(block))

        empty_open = '<div id="empty" class="empty">'
        self.assertEqual(without.count(empty_open), 1)
        in_empty = topics_facts(without.replace(empty_open, empty_open + block))
        self.assertEqual(in_empty["count"], 1)
        self.assertIn("empty", in_empty["ancestor_ids"])
        self.assertIn("transcript", in_empty["ancestor_ids"])
        self.assertNotEqual(in_empty["neighbors"], ("composer", "transcript"))

        form_close = "</form>\n      <div id=\"transcript\""
        self.assertEqual(without.count(form_close), 1)
        in_form = topics_facts(without.replace(form_close, block + form_close))
        self.assertEqual(in_form["count"], 1)
        self.assertIn("composer", in_form["ancestor_ids"])
        self.assertNotEqual(in_form["parent"], ("section", "chat"))

        doubled = topics_facts(html.replace(block, block + block))
        self.assertEqual(doubled["count"], 2)

    def test_page_has_no_folding_box_hint_line_or_style_attribute(self):
        html = call_app(app, "GET", "/", allow_wait=True).text()
        page = parse_page(html)

        self.assertTrue(page.elements)
        tags = {node["tag"] for node in page.elements}
        for banned in ("details", "summary", "dialog"):
            self.assertNotIn(banned, tags)
        for node in page.elements:
            self.assertNotIn("style", node["attrs"])
            self.assertNotIn("empty-hint", (node["attrs"].get("class") or "").split())
        self.assertNotIn("empty-hint", html)

        # 접는 상자가 없으므로 스크립트도 여닫는 속성을 건드리지 않는다.
        script = call_app(app, "GET", "/chat-assets/chat.js", allow_wait=True)
        self.assertEqual(script.status, 200)
        self.assertNotIn("topics.open", script.text())

    def test_fingerprints_depend_on_each_content(self):
        html = '/chat-assets/chat.css /chat-assets/chat.js'
        first = fingerprint_chat_assets(html, b'fictional css', b'fictional js')
        second = fingerprint_chat_assets(html, b'changed css', b'fictional js')
        self.assertNotEqual(first.split()[0], second.split()[0])
        self.assertEqual(first.split()[1], second.split()[1])
        third = fingerprint_chat_assets(html, b'fictional css', b'changed js')
        self.assertNotEqual(first.split()[1], third.split()[1])

    def test_invalid_asset_references_fail_at_startup(self):
        for html in ('', '/chat-assets/chat.css', '/chat-assets/chat.js',
                     '/chat-assets/chat.css /chat-assets/chat.js /chat-assets/chat.css',
                     '/chat-assets/chat.css /chat-assets/chat.js /chat-assets/chat.js'):
            with self.subTest(html=html), patch.object(Path, 'read_text', return_value=html):
                with self.assertRaises(ValueError):
                    create_app()

    def test_asset_routes_serve_the_chat_styles_and_script(self):
        assets = {
            "/chat-assets/chat.css": {"text/css"},
            "/chat-assets/chat.js": {"text/javascript", "application/javascript"},
        }
        for path, media_types in assets.items():
            with self.subTest(path=path):
                response = call_app(app, "GET", path, allow_wait=True)

                self.assertEqual(response.status, 200)
                self.assertIn(response.headers["content-type"].split(";")[0], media_types)
                self.assertTrue(response.body)
                self.assertEqual(response.headers['cache-control'], 'no-cache')
