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

async function submitQuestion(citations) {
  const elements = new Map();
  const requests = [];
  runInNewContext(script, {
    document: {
      querySelector(selector) {
        const node = new FakeElement(selector);
        elements.set(selector, node);
        return node;
      },
      createElement: tag => new FakeElement(tag),
      createTextNode: text => text,
    },
    window: { matchMedia: () => ({ matches: false }) },
    URL,
    AbortSignal: { timeout: () => undefined },
    async fetch(path, options) {
      requests.push([path, JSON.parse(options.body).message]);
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
  assert.deepEqual(requests, [["/api/v1/chat", question]]);
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

for (const [label, fields] of unlinkedCases) {
  test(`keeps the citation intact without a source link for ${label}`, async () => {
    const [card] = await submitQuestion([{ ...citation, ...fields }]);
    assertCitationContent(card, citation);
    assert.equal(card.children.length, 4);
  });
}
