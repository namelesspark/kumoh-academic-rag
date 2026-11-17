import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../../app/chat_web/assets/chat.js", import.meta.url), "utf8");

class FakeElement {
  children = [];
  listeners = new Map();
  attributes = new Map();
  textContent = "";
  value = "";

  constructor(tagName) {
    this.tagName = tagName;
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren() {
    this.children.length = 0;
  }

  addEventListener(event, listener) {
    this.listeners.set(event, listener);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  querySelectorAll() {
    return [];
  }

  remove() {}
}

const citation = {
  document: "가상 별빛 도서관 규정",
  article_path: "제3조 제1항",
  effective_date: "2025-03-01",
  snippet: "가상 별빛열람증은 도서관장이 발급한다.",
};

async function submitQuestion(citations, { lang = null, bodies = [] } = {}) {
  const elements = new Map();
  const requests = [];
  // lang을 주면 그 언어를 저장해 둔 브라우저처럼 시작한다. 주지 않으면 저장소가 없는 지금까지의 가짜 화면이다.
  const window = { matchMedia: () => ({ matches: false }) };
  if (lang) window.localStorage = { getItem: key => key === "kumoh-chat-lang:v1" ? lang : null, setItem() {}, removeItem() {} };
  runInNewContext(script, {
    document: {
      addEventListener() {},
      querySelector(selector) {
        if (selector === "#ai-mode-button") return null;
        const node = new FakeElement(selector);
        elements.set(selector, node);
        return node;
      },
      createElement: tag => new FakeElement(tag),
      createTextNode: text => text,
    },
    window,
    URL,
    AbortSignal: { timeout: () => undefined },
    async fetch(path, options) {
      requests.push([path, JSON.parse(options.body).message]);
      bodies.push(JSON.parse(options.body));
      return {
        ok: true,
        json: async () => ({
          session_id: "fictional-session",
          answered: true,
          answer: "도서관장이 발급합니다.",
          citations,
        }),
      };
    },
  }, { filename: "chat.js" });

  const question = "가상 별빛열람증을 누가 발급하나요?";
  elements.get("#question").value = question;
  elements.get("#composer").listeners.get("submit")({ preventDefault() {} });
  await setImmediate();
  assert.deepEqual(requests, [["/api/v1/chat/stream", question], ["/api/v1/chat", question]]);
  const [turn] = elements.get("#transcript").children;
  const [, reply] = turn.children;
  const [answer, ...cards] = reply.children;
  assert.equal(answer.textContent, "도서관장이 발급합니다.");
  assert.equal(cards.length, citations.length);
  return cards;
}

function assertCitationContent(card, expected) {
  assert.equal(card.tagName, "section");
  assert.equal(card.className, "evidence");
  const [heading, reference, dateLine, snippet] = card.children;
  assert.equal(heading.textContent, "가상 답변 근거");
  assert.equal(reference.textContent, `${expected.document} · ${expected.article_path}`);
  assert.equal(dateLine.textContent, "시행일 ");
  const [date] = dateLine.children;
  assert.equal(date.tagName, "time");
  assert.equal(date.textContent, expected.effective_date);
  assert.equal(date.dateTime, expected.effective_date);
  assert.equal(snippet.tagName, "blockquote");
  assert.equal(snippet.textContent, expected.snippet);
}

test("only the citation with a valid HTTPS address links to the original source", async () => {
  const sourceUrl = "HTTPS://Example.invalid:443/규정?ref=%2f#제3조";
  const otherCitation = {
    document: "가상 달빛 도서관 규정",
    article_path: "제5조",
    effective_date: "2025-04-01",
    snippet: "가상 달빛열람증은 한 학기 동안 쓸 수 있다.",
    source_url: null,
  };
  const [linked, unlinked] = await submitQuestion([
    { ...citation, source_url: sourceUrl },
    otherCitation,
  ]);
  assertCitationContent(linked, citation);
  assertCitationContent(unlinked, otherCitation);
  assert.equal(linked.children.length, 5, "expected a link after the quotation");
  assert.equal(unlinked.children.length, 4);

  const link = linked.children[4];
  assert.equal(link.tagName, "a");
  assert.equal(link.textContent, "공식 원문 보기");
  assert.equal(link.attributes.get("href"), sourceUrl);
  assert.equal(link.target, "_blank");
  assert.equal(link.rel, "noopener noreferrer");
  assert.equal(link.children.length, 1);
  const [context] = link.children;
  assert.equal(context.tagName, "span");
  assert.equal(context.className, "sr-only");
  assert.equal(context.textContent, " (가상 별빛 도서관 규정 · 제3조 제1항, 새 탭에서 열림)");
});

const unlinkedCases = [
  ["missing field", {}],
  ...[
    ["null", null],
    ["empty string", ""],
    ["JavaScript scheme", "javascript:alert(1)"],
    ["data scheme", "data:text/html,fictional"],
    ["HTTP", "http://example.invalid"],
    ["relative path", "/fictional"],
    ["scheme-relative address", "//example.invalid"],
    ["missing HTTPS slashes", "https:example.invalid"],
    ["empty authority", "https:///example.invalid"],
    ["credentials", "https://user:pass@example.invalid"],
    ["empty credentials", "https://@example.invalid"],
    ["backslash in authority", "https://example.invalid\\fictional"],
    ["leading space", " https://example.invalid"],
    ["trailing space", "https://example.invalid "],
    ["embedded tab", "https://exam\tple.invalid"],
    ["control character", "https://example.invalid/\u0000"],
    ["Unicode space", "https://example.invalid/\u0085"],
    ["unparseable address", "https://[::1"],
    ["number", 123],
    ["object", { href: "https://example.invalid" }],
  ].map(([label, source_url]) => [label, { source_url }]),
];

test("한국어 화면은 요청에 lang ko를 싣고 인용 카드에 원문 표시를 더하지 않는다", async () => {
  const bodies = [];
  const [card] = await submitQuestion([{ ...citation, source_url: null }], { bodies });
  assert.deepEqual(bodies.map(body => body.lang), ["ko", "ko"]);
  assert.equal(card.children.some(node => node.className === "original-lang"), false);
});

for (const [lang, labels] of [
  ["en", { heading: "Answer basis (fictional)", date: "Effective ", original: "Original (Korean)", link: "View the official original", tab: "opens in a new tab" }],
  ["zh", { heading: "回答依据（虚拟）", date: "施行日期 ", original: "原文（韩语）", link: "查看官方原文", tab: "在新标签页打开" }],
]) {
  test(`${lang} 화면의 인용 카드는 문서명·조문 원문을 그대로 두고 원문이 한국어라는 표시만 번역한다`, async () => {
    const bodies = [];
    const sourceUrl = "https://example.invalid/fictional";
    const [card] = await submitQuestion([{ ...citation, source_url: sourceUrl }], { lang, bodies });
    assert.deepEqual(bodies.map(body => body.lang), [lang, lang]);
    const [heading, reference, dateLine, original, snippet, link] = card.children;
    assert.equal(heading.textContent, labels.heading);
    assert.equal(reference.textContent, `${citation.document} · ${citation.article_path}`);
    assert.equal(dateLine.textContent, labels.date);
    assert.equal(original.className, "original-lang");
    assert.equal(original.textContent, labels.original);
    assert.equal(snippet.tagName, "blockquote");
    assert.equal(snippet.textContent, citation.snippet);
    assert.equal(snippet.attributes.get("lang"), "ko");
    assert.equal(link.textContent, labels.link);
    assert.ok(link.children[0].textContent.includes(`${citation.document} · ${citation.article_path}`));
    assert.ok(link.children[0].textContent.includes(labels.tab));
  });
}

for (const [label, fields] of unlinkedCases) {
  test(`keeps the citation intact without a source link for ${label}`, async () => {
    const [card] = await submitQuestion([{ ...citation, ...fields }]);
    assertCitationContent(card, citation);
    assert.equal(card.children.length, 4);
  });
}
