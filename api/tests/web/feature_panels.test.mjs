// 서버·브라우저 없이 가상 화면과 가상 응답으로 패널 동작을 확인한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../../app/chat_web/assets/chat.js", import.meta.url), "utf8");
const features = ["graduation", "biskit", "photo", "ask", "calendar", "campus"];

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function loadPage({ transition, reduced = false, legacy = false } = {}) {
  let focused;
  let calm = reduced;
  let motionChange;
  const requests = [];
  const response = deferred();
  class Element {
    tagName = "BUTTON";
    children = [];
    listeners = new Map();
    attributes = new Map();
    dataset = {};
    value = "";
    hidden = false;
    disabled = false;
    files = [];
    textContent = "";
    clicks = 0;
    parts = new Map();
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    removeAttribute(key) { this.attributes.delete(key); }
    querySelector(selector) { return this.parts.get(selector) ?? null; }
    querySelectorAll() { return []; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    remove() {}
    focus() { focused = this; }
    click() { this.clicks++; this.listeners.get("click")?.({}); }
    scrollIntoView() {}
  }
  const elements = new Map();
  const cards = [];
  const panels = [];
  const actions = [];
  if (!legacy) {
    for (const feature of features) {
      const card = new Element();
      card.className = "card";
      card.type = "button";
      card.dataset.feature = feature;
      card.setAttribute("aria-controls", `panel-${feature}`);
      card.setAttribute("aria-expanded", "false");
      const panel = new Element();
      panel.tagName = "SECTION";
      panel.className = "feature-panel";
      panel.dataset.panel = feature;
      panel.id = `panel-${feature}`;
      panel.hidden = true;
      panel.parts.set("[data-panel-title]", new Element());
      panel.parts.get("[data-panel-title]").tabIndex = -1;
      panel.parts.set("[data-panel-close]", new Element());
      if (!["calendar", "campus"].includes(feature)) {
        const start = new Element();
        start.dataset.action = feature === "biskit" ? "graduation" : feature;
        panel.parts.set("[data-action]", start);
        actions.push(start);
      }
      cards.push(card);
      panels.push(panel);
    }
  }
  const document = {
    querySelector(selector) {
      if (selector === "#feature-cards" && legacy) return null;
      if (!elements.has(selector)) elements.set(selector, new Element());
      return elements.get(selector);
    },
    querySelectorAll(selector) {
      return ({ "[data-feature]": cards, "[data-panel]": panels, "[data-action]": actions })[selector] ?? [];
    },
    createElement: () => new Element(),
    createTextNode: value => value,
  };
  if (transition !== undefined) document.startViewTransition = transition;
  runInNewContext(script, {
    document,
    window: { matchMedia: query => ({
      matches: query.includes("reduced-motion") && calm,
      addEventListener(type, listener) {
        if (query.includes("reduced-motion") && type === "change") motionChange = listener;
      },
    }) },
    fetch: (...args) => { requests.push(args); return response.promise; },
    AbortSignal: { timeout() {} },
    URL,
  });
  const get = selector => elements.get(selector);
  return {
    cards, panels, actions, requests, response, get,
    focus: () => focused,
    reduce: value => { calm = value; motionChange?.({ matches: value }); },
    close: index => panels[index].querySelector("[data-panel-close]").click(),
    start: index => panels[index].querySelector("[data-action]").click(),
  };
}

function assertState(page, index) {
  assert.equal(page.get("#feature-cards").hidden, index !== null);
  page.panels.forEach((panel, current) => assert.equal(panel.hidden, current !== index));
  page.cards.forEach((card, current) => {
    assert.equal(card.attributes.get("aria-expanded"), String(current === index));
  });
}

function transitions() {
  const pending = [];
  const start = update => {
    const ready = deferred();
    const done = deferred();
    const finished = deferred();
    const entry = {
      update,
      ready: ready.promise,
      updateCallbackDone: done.promise,
      finished: finished.promise,
      skipTransition() { entry.skipped = true; },
      apply() { update(); done.resolve(); ready.resolve(); },
      finish() { finished.resolve(); },
      fail() { ready.reject(new Error("virtual transition failure")); done.reject(new Error("virtual callback failure")); finished.reject(new Error("virtual finish failure")); },
    };
    pending.push(entry);
    return entry;
  };
  return { start, pending };
}

test("기존 화면에는 카드·패널·전환 API가 없어도 실행된다", () => {
  const page = loadPage({ legacy: true });
  page.get("#reset").click();
  assert.equal(page.focus(), page.get("#question"));
});

test("미지원 환경에서 여섯 카드의 열기·닫기와 초점 복귀가 바로 동작한다", () => {
  const page = loadPage();
  page.cards.forEach((card, index) => {
    card.click();
    assertState(page, index);
    assert.equal(page.focus(), page.panels[index].querySelector("[data-panel-title]"));
    page.close(index);
    assertState(page, null);
    assert.equal(page.focus(), card);
  });
});

test("함수가 아닌 전환 속성은 호출하지 않는다", () => {
  const page = loadPage({ transition: {} });
  page.cards[0].click();
  assertState(page, 0);
});

test("지원 환경에서 열고 닫는 동안 원래 카드에만 모핑 표시를 두고 완료하면 지운다", async () => {
  const queue = transitions();
  const page = loadPage({ transition: queue.start });
  page.cards[0].click();
  assert.equal(page.cards[0].attributes.has("data-morph"), true);
  queue.pending[0].apply();
  assertState(page, 0);
  queue.pending[0].finish();
  await setImmediate();
  assert.equal(page.cards[0].attributes.has("data-morph"), false);
  page.close(0);
  assert.equal(page.cards[0].attributes.has("data-morph"), true);
  queue.pending[1].apply();
  assertState(page, null);
  assert.equal(page.focus(), page.cards[0]);
  queue.pending[1].finish();
  await setImmediate();
  assert.equal(page.cards[0].attributes.has("data-morph"), false);
});

test("전환 시작이 예외를 던져도 같은 상태 변경과 초점 이동을 한다", () => {
  const page = loadPage({ transition() { throw new Error("virtual unsupported transition"); } });
  page.cards[2].click();
  assertState(page, 2);
  page.close(2);
  assertState(page, null);
  assert.equal(page.focus(), page.cards[2]);
  assert.equal(page.cards[2].attributes.has("data-morph"), false);
});

test("비동기 전환 실패에서도 패널을 열고 표시를 정리한다", async () => {
  const queue = transitions();
  const page = loadPage({ transition: queue.start });
  page.cards[1].click();
  queue.pending[0].fail();
  await setImmediate();
  assertState(page, 1);
  assert.equal(page.focus(), page.panels[1].querySelector("[data-panel-title]"));
  assert.equal(page.cards[1].attributes.has("data-morph"), false);
});

test("사용 중 움직임 줄이기를 바꾸면 다음 열기와 닫기에서 바로 반영한다", async () => {
  const queue = transitions();
  const page = loadPage({ transition: queue.start, reduced: true });
  page.cards[0].click();
  assertState(page, 0);
  page.close(0);
  assert.equal(queue.pending.length, 0);
  page.reduce(false);
  page.cards[0].click();
  queue.pending[0].apply();
  page.reduce(true);
  page.close(0);
  assertState(page, null);
  assert.equal(queue.pending.length, 1);
  queue.pending[0].finish();
  await setImmediate();
  assertState(page, null);
});

test("연속 조작 뒤 이전 콜백과 완료가 도착해도 마지막 패널과 초점을 유지한다", async () => {
  const queue = transitions();
  const page = loadPage({ transition: queue.start });
  page.cards[0].click();
  page.cards[3].click();
  assert.equal(queue.pending[0].skipped, true);
  queue.pending[1].apply();
  queue.pending[0].apply();
  queue.pending[0].finish();
  await setImmediate();
  assertState(page, 3);
  assert.equal(page.cards[3].attributes.has("data-morph"), true);
  page.close(3);
  queue.pending[2].apply();
  queue.pending[1].finish();
  queue.pending[2].finish();
  await setImmediate();
  assertState(page, null);
  assert.equal(page.focus(), page.cards[3]);
});

test("전환 중 움직임 줄이기를 켜면 진행 중 전환을 건너뛴다", async () => {
  const queue = transitions();
  const page = loadPage({ transition: queue.start });
  page.cards[0].click();
  queue.pending[0].apply();
  page.reduce(true);
  assert.equal(queue.pending[0].skipped, true);
  queue.pending[0].finish();
  await setImmediate();
  assertState(page, 0);
  assert.equal(page.cards[0].attributes.has("data-morph"), false);
});

test("열기 콜백 전에 닫아도 원래 카드로 초점을 돌리고 늦은 열기를 무시한다", async () => {
  const queue = transitions();
  const page = loadPage({ transition: queue.start });
  page.cards[2].click();
  page.close(2);
  queue.pending[1].apply();
  queue.pending[0].apply();
  queue.pending[1].finish();
  queue.pending[0].finish();
  await setImmediate();
  assertState(page, null);
  assert.equal(page.focus(), page.cards[2]);
});

test("전환 중 시작해도 사진 선택은 바로 실행하고 늦은 전환은 초점을 빼앗지 않는다", async () => {
  const queue = transitions();
  const page = loadPage({ transition: queue.start });
  page.cards[2].click();
  queue.pending[0].apply();
  page.start(2);
  assert.equal(page.get("#photo-file").clicks, 1);
  queue.pending[0].finish();
  await setImmediate();
  assertState(page, null);
  assert.equal(page.focus(), page.get("#photo-file"));
});

test("닫기를 연달아 누르거나 Escape를 반복해도 닫기 전환과 원 카드 초점을 유지한다", async () => {
  for (const escape of [false, true]) {
    const queue = transitions();
    const page = loadPage({ transition: queue.start });
    page.cards[1].click();
    queue.pending[0].apply();
    queue.pending[0].finish();
    await setImmediate();
    const close = () => {
      if (escape) page.panels[1].listeners.get("keydown")({ key: "Escape", preventDefault() {} });
      else page.close(1);
    };
    close();
    close();
    assert.equal(queue.pending.length, 2);
    queue.pending[1].apply();
    queue.pending[1].finish();
    await setImmediate();
    assertState(page, null);
    assert.equal(page.focus(), page.cards[1]);
  }
});

test("패널 안 Escape만 닫으며 다른 키와 숨은 패널의 Escape는 무시한다", () => {
  const page = loadPage();
  page.cards[4].click();
  let prevented = 0;
  const key = (index, value) => page.panels[index].listeners.get("keydown")({ key: value, preventDefault() { prevented++; } });
  key(4, "Enter");
  key(0, "Escape");
  assertState(page, 4);
  key(4, "Escape");
  assertState(page, null);
  assert.equal(prevented, 1);
  assert.equal(page.focus(), page.cards[4]);
});

test("질문과 사진 시작은 패널을 닫고 실행 대상으로 초점을 옮기며 사진 선택을 즉시 호출한다", () => {
  const page = loadPage();
  page.cards[3].click();
  page.start(3);
  assertState(page, null);
  assert.equal(page.focus(), page.get("#question"));
  page.cards[2].click();
  page.start(2);
  assertState(page, null);
  assert.equal(page.focus(), page.get("#photo-file"));
  assert.equal(page.get("#photo-file").clicks, 1);
  assert.equal(page.requests.length, 0);
});

test("졸업 체크와 추천 시작은 같은 요청을 한 번 보내고 요청 중 모든 시작 버튼을 잠근다", async () => {
  for (const index of [0, 1]) {
    const page = loadPage();
    page.cards[index].click();
    page.start(index);
    assertState(page, null);
    assert.equal(page.focus(), page.get("#question"));
    assert.equal(page.requests.length, 1);
    assert.equal(page.requests[0][0], "/api/v1/graduation-demo");
    assert.equal(page.actions.every(action => action.disabled), true);
    page.start(index);
    page.start(2);
    assert.equal(page.requests.length, 1);
    assert.equal(page.get("#photo-file").clicks, 0);
    page.response.resolve({ ok: false });
    await setImmediate();
    assert.equal(page.actions.every(action => !action.disabled), true);
  }
});

test("패널을 연 채 질문을 보낸 뒤 새 대화로 돌아오면 카드 목록을 복원한다", async () => {
  const page = loadPage();
  page.cards[5].click();
  page.get("#question").value = "가상 규정 질문";
  page.get("#composer").listeners.get("submit")({ preventDefault() {} });
  assert.equal(page.requests.length, 1);
  page.response.resolve({ ok: false });
  await setImmediate();
  page.get("#reset").click();
  assertState(page, null);
  assert.equal(page.focus(), page.get("#question"));
  assert.equal(page.get("#transcript").children[0], page.get("#empty"));
});

test("전환 콜백 전에 새 대화를 눌러도 늦은 전환이 패널을 다시 열지 않는다", async () => {
  const queue = transitions();
  const page = loadPage({ transition: queue.start });
  page.cards[0].click();
  page.get("#reset").click();
  queue.pending[0].apply();
  queue.pending[0].finish();
  await setImmediate();
  assertState(page, null);
  assert.equal(page.focus(), page.get("#question"));
});
