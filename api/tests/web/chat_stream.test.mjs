import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../../app/chat_web/assets/chat.js", import.meta.url), "utf8");
const langBlock = script.slice(0, script.indexOf("function trimConversations("));

function streamReader() {
  const start = script.indexOf("async function readChatStream(");
  const end = script.indexOf("async function requestChatAnswer(", start);
  assert.ok(start >= 0 && end > start, "스트림 읽기 함수를 찾을 수 있어야 한다");
  return runInNewContext(script.slice(start, end) + "\nreadChatStream", { TextDecoder });
}

function responseFor(parts) {
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        for (const part of parts) controller.enqueue(part);
        controller.close();
      },
    }),
  };
}

const bytes = (text) => new TextEncoder().encode(text);
const event = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
const meta = { answered: true, citations: [], session_id: "fictional-session", personalized: false };

test("한글 바이트와 줄 경계가 갈려도 생각과 답 이벤트를 순서대로 읽는다", async () => {
  const source = bytes(event("meta", meta) + event("thinking", { text: "Fictional thought" }) +
    event("answer", { text: "가상 답", replace: false }) + event("done", { latency_ms: {} }));
  const parts = Array.from(source, (byte) => Uint8Array.of(byte));
  const received = [];
  await streamReader()(responseFor(parts), (name, data) => received.push([name, data]));
  assert.deepEqual(JSON.parse(JSON.stringify(received)), [
    ["meta", meta], ["thinking", { text: "Fictional thought" }],
    ["answer", { text: "가상 답", replace: false }], ["done", { latency_ms: {} }],
  ]);
});

test("CRLF 줄바꿈과 여러 이벤트를 읽고 replace 값을 보존한다", async () => {
  const received = [];
  const text = (event("meta", meta) + event("answer", { text: "가상 중간 답", replace: false }) +
    event("answer", { text: "가상 근거 답", replace: true }) + event("notice", { text: "가상 안내" }) +
    event("done", {})).replaceAll("\n", "\r\n");
  await streamReader()(responseFor([bytes(text.slice(0, 9)), bytes(text.slice(9))]),
    (name, data) => received.push([name, data]));
  assert.equal(received.filter(([name]) => name === "answer").length, 2);
  assert.equal(received.find(([, data]) => data.replace === true)[1].text, "가상 근거 답");
  assert.equal(received.at(-1)[0], "done");
});

test("알 수 없는 이벤트는 무시한다", async () => {
  const received = [];
  await streamReader()(responseFor([bytes(event("meta", meta) + event("future", { text: "가상 확장" }) +
    event("done", {}))]), (name) => received.push(name));
  assert.deepEqual(received, ["meta", "done"]);
});

test("done 없이 닫히면 실패한다", async () => {
  await assert.rejects(streamReader()(responseFor([bytes(event("meta", meta) +
    event("answer", { text: "가상 미완성 답", replace: false }))]), () => {}));
});

test("error 이벤트를 받으면 실패한다", async () => {
  await assert.rejects(streamReader()(responseFor([bytes(event("meta", meta) +
    event("error", { code: "stream_failed", message: "답변을 받지 못했어요" }))]), () => {}));
});

test("알려진 이벤트의 JSON이 깨지면 실패한다", async () => {
  await assert.rejects(streamReader()(responseFor([bytes(event("meta", meta) +
    "event: answer\ndata: {broken\n\n" + event("done", {}))]), () => {}));
});

test("응답 본문이나 글자 해독기가 없으면 실패한다", async () => {
  await assert.rejects(streamReader()({ ok: true }, () => {}));
  const start = script.indexOf("async function readChatStream(");
  const end = script.indexOf("async function requestChatAnswer(", start);
  const read = runInNewContext(script.slice(start, end) + "\nreadChatStream", {});
  await assert.rejects(read(responseFor([bytes(event("done", {}))]), () => {}));
});

function modePage(storage, reduced = false) {
  let focus = null;
  const timers = new Map(), events = new Map(), nodes = new Map();
  let nextTimer = 0;
  class Node {
    children = []; attributes = new Map(); listeners = new Map(); dataset = {}; className = ""; hidden = false;
    style = { setProperty: (key, value) => this.attributes.set(key, value) };
    classList = {
      contains: name => this.className.split(/\s+/).includes(name),
      add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(" "); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(" "); },
      toggle: (name, force) => { const on = force ?? !this.classList.contains(name); this.classList[on ? "add" : "remove"](name); return on; },
    };
    append(...nodes) { for (const node of nodes) node.parentNode = this; this.children.push(...nodes); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this); }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    setAttribute(key, value) { this.attributes.set(key, String(value)); if (key.startsWith("data-")) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    removeAttribute(key) { this.attributes.delete(key); }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    focus() { focus = this; }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    fire(name, values = {}) { const event = { target: this, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...values }; this.listeners.get(name)?.(event); return event; }
    click() { this.fire("click"); }
    querySelector(selector) { return this.children.find(node => node.dataset.icon && selector.includes(node.dataset.icon)) || this.children.find(node => node.className.split(" ").includes(selector.slice(1))) || null; }
    querySelectorAll(selector) { return this.children.filter(node => node.classList.contains(selector.slice(1))); }
    cloneNode() { const node = new Node(); node.className = this.className; node.dataset = { ...this.dataset }; return node; }
    getBoundingClientRect() { return { left: 280, right: 400, top: 500, bottom: 540, width: 120, height: 180 }; }
  }
  const get = selector => { if (!nodes.has(selector)) nodes.set(selector, new Node()); return nodes.get(selector); };
  const button = get("#ai-mode-button"); button.className = "mode-pill"; button.setAttribute("aria-haspopup", "menu"); button.setAttribute("aria-expanded", "false");
  for (const value of ["fast", "deep"]) { const icon = new Node(); icon.className = "mode-icon"; icon.dataset.icon = value; button.append(icon); }
  const label = new Node(); label.className = "mode-pill-label"; button.append(label);
  const row = get(".composer-row"); row.append(button);
  const body = new Node();
  const document = { body, querySelector: get, get activeElement() { return focus; }, addEventListener: (name, callback) => events.set(name, callback) };
  const context = {
    document, window: { innerWidth: 800, innerHeight: 700, addEventListener() {} }, composer: get("#composer"),
    historyStorage: () => storage, reducedMotion: () => reduced, within: (node, target) => node.contains(target),
    element(tag, className, text) { const node = new Node(); node.tag = tag; node.className = className || ""; node.textContent = text || ""; return node; },
    setTimeout(callback, delay) { timers.set(++nextTimer, { callback, delay }); return nextTimer; }, clearTimeout: key => timers.delete(key),
  };
  const start = script.indexOf('const aiModeKey =');
  const end = script.indexOf('async function readChatStream(', start);
  // 답변 모드의 이름은 화면 언어 사전을 거친다. 사전 묶음은 파일 맨 앞에 있고 화면 요소를 건드리지 않는다.
  runInNewContext(langBlock + script.slice(start, end), context);
  return {
    button, row, body, label, events, timers, document, window: context.window,
    mode: () => runInNewContext('aiMode', context), focus: () => focus,
    menu: () => body.children.find(node => node.classList.contains("choice-menu")),
    select(value) { button.click(); this.menu().children.find(node => node.dataset.choiceValue === value).click(); },
    tick(ms) { for (const [key, timer] of timers) if (timer.delay <= ms) { timers.delete(key); timer.callback(); } },
  };
}

function choiceItems(page) { return page.menu().children.filter(node => node.attributes.get("role") === "menuitemradio"); }

test("모드 선택기 내부가 없는 화면은 초기화를 건너뛴다", () => {
  const start = script.indexOf("function setupAiMode()");
  const end = script.indexOf("setupAiMode();", start) + "setupAiMode();".length;
  for (const [placeholder, saved] of [
    [{}, null], [{}, "deep"],
    [{ querySelector: () => null }, null], [{ querySelector: () => null }, "deep"],
  ]) {
    const context = {
      aiMode: "fast", aiModeKey: "kumoh-chat-ai-mode:v1",
      historyStorage: () => ({ getItem: () => saved }),
      document: { querySelector: () => placeholder },
    };
    assert.doesNotThrow(() => runInNewContext(script.slice(start, end), context));
    assert.equal(context.aiMode, saved === "deep" ? "deep" : "fast");
    assert.equal(placeholder.dataset, undefined);
  }
});

test("저장한 깊이 모드를 복원하고 빠르게 선택을 같은 키에 저장한다", () => {
  const writes = [];
  const p = modePage({ getItem: key => { assert.equal(key, "kumoh-chat-ai-mode:v1"); return "deep"; }, setItem: (...args) => writes.push(args) });
  assert.equal(p.mode(), "deep");
  assert.equal(p.button.attributes.get("aria-label"), "답변 모드: 깊이 생각");
  assert.equal(p.row.classList.contains("is-deep"), true);
  assert.equal(p.button.classList.contains("is-bursting"), false);
  assert.equal(p.row.classList.contains("is-deep-enter"), false);
  p.select("fast");
  assert.equal(p.mode(), "fast");
  assert.deepEqual(writes, [["kumoh-chat-ai-mode:v1", "fast"]]);
  assert.equal(p.row.classList.contains("is-deep"), false);
});

test("메뉴는 ARIA 현재 선택과 이름·설명을 보여 주고 버튼으로 닫힌다", () => {
  const p = modePage({ getItem: () => null, setItem() {} });
  assert.equal(p.button.attributes.get("aria-haspopup"), "menu");
  assert.equal(p.button.attributes.get("aria-expanded"), "false");
  p.button.click();
  assert.equal(p.menu().attributes.get("role"), "menu");
  assert.equal(p.button.attributes.get("aria-expanded"), "true");
  assert.equal(p.menu().children[0].textContent, "답변 모드");
  assert.deepEqual(choiceItems(p).map(node => node.attributes.get("aria-checked")), ["true", "false"]);
  assert.ok(choiceItems(p)[0].children.some(node => node.textContent === "바로 답해요 · 보통 1~3초"));
  p.button.click();
  assert.equal(p.menu(), undefined);
  assert.equal(p.button.attributes.get("aria-expanded"), "false");
});

test("화살표는 끝에서 돌고 Enter·Space는 선택하며 Esc는 버튼으로 돌아간다", () => {
  for (const key of ["Enter", " "]) {
    const p = modePage({ getItem: () => null, setItem() {} });
    p.button.click();
    const items = choiceItems(p);
    assert.equal(p.focus(), items[0]);
    p.menu().fire("keydown", { key: "ArrowUp" });
    assert.equal(p.focus(), items[1]);
    p.menu().fire("keydown", { key: "ArrowDown" });
    assert.equal(p.focus(), items[0]);
    p.menu().fire("keydown", { key: "ArrowDown" });
    p.menu().fire("keydown", { key });
    assert.equal(p.mode(), "deep");
    p.button.click();
    let stopped = false;
    p.menu().fire("keydown", { key: "Escape", stopPropagation() { stopped = true; } });
    assert.equal(stopped, true);
    assert.equal(p.menu(), undefined);
    assert.equal(p.focus(), p.button);
  }
});

test("바깥 누르기와 Tab은 초점을 빼앗지 않고 메뉴를 닫는다", () => {
  const p = modePage({ getItem: () => null, setItem() {} });
  p.button.click();
  const focused = p.focus();
  p.events.get("pointerdown")({ target: p.body });
  assert.equal(p.menu(), undefined);
  assert.equal(p.focus(), focused);
  p.button.click();
  const nextFocus = p.focus();
  p.menu().fire("keydown", { key: "Tab" });
  p.tick(0);
  assert.equal(p.menu(), undefined);
  assert.equal(p.focus(), nextFocus);
});

test("잘못된 저장값·읽기 실패·쓰기 실패는 모든 표시를 빠르게로 되돌린다", () => {
  for (const storage of [{ getItem: () => "invalid", setItem() {} }, { getItem() { throw Error("가상 읽기 실패"); }, setItem() {} }]) assert.equal(modePage(storage).mode(), "fast");
  const p = modePage({ getItem: () => "deep", setItem() { throw Error("가상 저장 실패"); } });
  p.select("deep");
  assert.equal(p.mode(), "fast");
  assert.equal(p.label.textContent, "빠르게");
  assert.equal(p.button.attributes.get("aria-label"), "답변 모드: 빠르게");
  assert.equal(p.button.dataset.mode, "fast");
  assert.equal(p.row.classList.contains("is-deep"), false);
  p.button.click();
  assert.deepEqual(choiceItems(p).map(node => node.attributes.get("aria-checked")), ["true", "false"]);
});

test("깊이 선택 효과는 정해진 시간 뒤 끝나고 움직임 줄이기는 고정 표시만 남긴다", () => {
  const storage = { getItem: () => null, setItem() {} };
  const p = modePage(storage);
  p.select("deep");
  assert.equal(p.button.classList.contains("is-bursting"), true);
  assert.equal(p.button.classList.contains("is-flowing"), true);
  assert.equal(p.row.classList.contains("is-deep-enter"), true);
  assert.ok(p.button.children.filter(node => node.classList.contains("mode-spark")).length >= 6);
  p.tick(700);
  assert.equal(p.button.classList.contains("is-bursting"), false);
  p.tick(900);
  assert.equal(p.row.classList.contains("is-deep-enter"), false);
  const still = modePage(storage, true);
  still.select("deep");
  assert.equal(still.row.classList.contains("is-deep"), true);
  for (const name of ["is-bursting", "is-flowing"]) assert.equal(still.button.classList.contains(name), false);
  assert.equal(still.row.classList.contains("is-deep-enter"), false);
  assert.equal(still.button.children.filter(node => node.classList.contains("mode-spark")).length, 0);
});

test("메뉴 좌표는 버튼 위와 화면 가장자리 16px 안으로 보정한다", () => {
  const p = modePage({ getItem: () => null, setItem() {} });
  p.window.innerWidth = 300;
  p.window.innerHeight = 200;
  p.button.getBoundingClientRect = () => ({ left: 280, right: 300, top: 20, bottom: 50 });
  p.button.click();
  assert.equal(p.menu().attributes.get("--choice-menu-x"), "164px");
  assert.equal(p.menu().attributes.get("--choice-menu-y"), "16px");
});

function requester(fetch, timeouts = []) {
  const start = script.indexOf("async function readChatStream(");
  const end = script.indexOf("async function ask(", start);
  return runInNewContext(script.slice(start, end) + "\nrequestChatAnswer", {
    fetch, TextDecoder, AbortSignal: { timeout: (value) => {
      timeouts.push(value);
      return { timeout: value };
    } },
  });
}

test("스트림 실패 뒤 같은 질문과 방식으로 JSON 주소에 한 번만 다시 묻는다", async () => {
  const requests = [], timeouts = [], events = [];
  const body = { message: "가상 질문", session_id: "fictional-session", mode: "deep", use_academic_data: false, lang: "en" };
  const result = await requester(async (path, options) => {
    requests.push({ path, options });
    if (requests.length === 1) return responseFor([bytes(event("meta", meta))]);
    return { ok: true, json: async () => ({ ...meta, answer: "가상 JSON 답" }) };
  }, timeouts)(body, (name) => events.push(name));
  assert.equal(result.answer, "가상 JSON 답");
  assert.deepEqual(requests.map(({ path }) => path), ["/api/v1/chat/stream", "/api/v1/chat"]);
  assert.deepEqual(JSON.parse(requests[0].options.body), body);
  assert.equal(requests[0].options.body, requests[1].options.body);
  assert.equal(events.at(-1), "reset");
  assert.deepEqual(timeouts, [100_000, 100_000]);
  assert.notEqual(requests[0].options.signal, requests[1].options.signal);
});

test("대체 안내와 done을 받은 스트림은 다시 묻지 않는다", async () => {
  let calls = 0;
  const result = await requester(async () => {
    calls++;
    return responseFor([bytes(event("meta", meta) + event("answer", { text: "가상 근거 답", replace: true }) +
      event("notice", { text: "가상 대체 안내" }) + event("done", {}))]);
  })({ message: "가상 질문", mode: "fast" }, () => {});
  assert.equal(calls, 1);
  assert.equal(result.answer, "가상 근거 답");
  assert.equal(result.notice, "가상 대체 안내");
});

test("done.answered가 boolean이면 meta보다 앞서고 안내 여부는 done.guided로 정한다", async () => {
  const run = async (done, metaValue = meta) => {
    let calls = 0;
    const result = await requester(async () => {
      calls++;
      return responseFor([bytes(event("meta", metaValue) +
        event("answer", { text: "가상 교체 답", replace: true }) + event("done", done))]);
    })({ message: "가상 질문", mode: "fast" }, () => {});
    assert.equal(calls, 1);
    return result;
  };
  const held = await run({ latency_ms: {}, answered: false });
  assert.equal(held.answered, false);
  assert.equal(held.guided, false);
  const guided = await run({ latency_ms: {}, answered: false, guided: true }, { ...meta, answered: false });
  assert.equal(guided.answered, false);
  assert.equal(guided.guided, true);
  assert.equal(guided.answer, "가상 교체 답");
  const plain = await run({ latency_ms: {} });
  assert.equal(plain.answered, true);
  assert.equal(plain.guided, false);
  const ignored = await run({ answered: "false", guided: "true" });
  assert.equal(ignored.answered, true);
  assert.equal(ignored.guided, false);
  const metaOnly = await run({}, { ...meta, answered: false, guided: true });
  assert.equal(metaOnly.guided, false);
});

test("JSON 재질문도 실패하면 추가 요청 없이 실패한다", async () => {
  let calls = 0;
  await assert.rejects(requester(async () => {
    calls++;
    return { ok: false };
  })({ message: "가상 질문", mode: "fast" }, () => {}));
  assert.equal(calls, 2);
});

// ── 화면 언어(#116) ──────────────────────────────────────────────────────────
// 가상 화면 요소·저장소로 언어 선택기를 확인한다. 실제 학생 데이터나 서버는 쓰지 않는다.
const html = readFileSync(new URL("../../app/chat_web/index.html", import.meta.url), "utf8");
const langKey = "kumoh-chat-lang:v1";

function codeBetween(from, until) {
  const start = script.indexOf(from);
  const end = script.indexOf(until, start);
  assert.ok(start >= 0 && end > start, from);
  return script.slice(start, end);
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: key => values.get(key) ?? null, setItem(key, value) { values.set(key, String(value)); } };
}

function langPage({ storage = memoryStorage(), language } = {}) {
  let focused = null, nextTimer = 0;
  const timers = new Map(), calls = [];
  class Text {
    constructor(value) { this.nodeType = 3; this.nodeValue = value; this.parentElement = null; }
  }
  class El {
    constructor(tag) {
      this.tag = tag; this.nodeType = 1; this.children = []; this.attributes = new Map(); this.listeners = new Map();
      this.dataset = {}; this.className = ""; this.id = ""; this.hidden = false; this.textContent = ""; this.parentElement = null;
      this.style = { setProperty: (key, value) => this.attributes.set(key, String(value)) };
      this.rect = { left: 0, right: 200, top: 0, bottom: 120, width: 200, height: 120 };
    }
    append(...values) {
      for (const value of values) {
        const node = typeof value === "string" ? new Text(value) : value;
        if (node.parentElement) node.parentElement.children = node.parentElement.children.filter(child => child !== node);
        node.parentElement = this;
        this.children.push(node);
      }
    }
    replaceChildren(...values) { for (const child of this.children) child.parentElement = null; this.children = []; this.append(...values); }
    remove() { if (!this.parentElement) return; this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
    setAttribute(key, value) {
      this.attributes.set(key, String(value));
      if (key.startsWith("data-")) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
    }
    getAttribute(key) { return this.attributes.has(key) ? this.attributes.get(key) : null; }
    removeAttribute(key) { this.attributes.delete(key); }
    addEventListener(type, callback) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]); }
    fire(type, values = {}) {
      const event = { target: this, prevented: false, preventDefault() { event.prevented = true; }, stopPropagation() {}, ...values };
      for (const callback of this.listeners.get(type) ?? []) callback(event);
      return event;
    }
    click() { this.fire("click"); }
    focus() { focused = this; }
    matches(selector) {
      return selector.split(",").map(part => part.trim()).some(part =>
        part.startsWith("#") ? this.id === part.slice(1)
          : part.startsWith(".") ? this.className.split(/\s+/).includes(part.slice(1))
            : part.startsWith("[") ? this.attributes.has(part.slice(1, -1)) : this.tag === part);
    }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
    elements() { return this.children.filter(child => child.nodeType === 1).flatMap(child => [child, ...child.elements()]); }
    querySelectorAll(selector) { return this.elements().filter(node => node.matches(selector)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    contains(node) { for (let current = node; current; current = current.parentElement) if (current === this) return true; return false; }
    getBoundingClientRect() { return this.rect; }
    get text() { return this.children.length ? this.children.map(child => child.nodeType === 3 ? child.nodeValue : child.text).join("") : this.textContent; }
  }
  const make = (tag, attributes = {}, ...children) => {
    const node = new El(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (key === "id") node.id = value; else if (key === "class") node.className = value; else node.setAttribute(key, value);
    }
    node.append(...children);
    return node;
  };
  const pill = (id, rect) => {
    const label = make("span", { class: "lang-pill-label" });
    label.textContent = "한국어";
    const button = make("button", { id, class: "lang-pill", "aria-haspopup": "menu", "aria-expanded": "false", "aria-label": "언어 / Language: 한국어" }, label);
    button.rect = rect;
    return button;
  };
  const loginButton = pill("login-lang-button", { left: 1060, right: 1180, top: 16, bottom: 56, width: 120, height: 40 });
  const headerButton = pill("lang-button", { left: 980, right: 1100, top: 10, bottom: 50, width: 120, height: 40 });
  const body = make("body", {},
    loginButton,
    make("p", { class: "intro-badge" }, "국립금오공과대학교 학사 안내"),
    make("h1", { class: "title-fallback" }, "졸업까지, ", make("span", {}, make("em", {}, "아이오"), "와 함께")),
    make("input", { id: "student-number", placeholder: "예: 20990002" }),
    make("button", { id: "login-submit" }, "로그인"),
    headerButton,
    make("button", { id: "send" }, "보내기"),
    make("textarea", { id: "brand-prompt", placeholder: "아이오에게 물어보세요 · 사진만 보내도 돼요" }),
    make("button", { id: "brand-pet", "aria-label": "아이오와 새 대화" }, make("img", { id: "brand-pet-image", alt: "테크모" })),
    make("span", { class: "main-title-fallback" }, "물어봐요, ", make("em", {}, "아이오")),
    make("a", { class: "campus-site-link" }, "학교 홈페이지", make("span", { class: "sr-only" }, " (새 창)")),
    make("ul", { id: "conversation-list" }, make("li", {}, "새 대화")),
    make("div", { class: "turn" }, make("p", { class: "fictional-message" }, "보내기"), make("small", { class: "reply-author" })),
    make("p", { id: "pet-line" }),
    make("p", { id: "photo-note" }),
  );
  const root = make("html", { lang: "ko" });
  const document = {
    body, documentElement: root, title: "금오공대 학사 행정 AI 아이오",
    get activeElement() { return focused; },
    querySelector: selector => body.querySelector(selector),
    querySelectorAll: selector => body.querySelectorAll(selector),
    addEventListener() {},
    createTreeWalker(start) {
      const texts = [];
      const walk = node => { for (const child of node.children) if (child.nodeType === 3) texts.push(child); else walk(child); };
      walk(start);
      let index = 0;
      return { nextNode: () => texts[index++] ?? null };
    },
  };
  const context = {
    document,
    window: { innerWidth: 1280, innerHeight: 800, navigator: { language }, addEventListener() {} },
    historyStorage: () => storage, reducedMotion: () => false, within: (node, target) => Boolean(node?.contains(target)),
    element(tag, className, text) { const node = new El(tag); node.className = className || ""; if (text !== undefined) node.textContent = text; return node; },
    setTimeout(callback, delay) { timers.set(++nextTimer, { callback, delay }); return nextTimer; }, clearTimeout: key => timers.delete(key),
    empty: null, originalTitle: document.title, hiddenAnswers: 0, toastRecord: null,
    labelConversationMenu() { calls.push("menu"); }, labelConfirm() { calls.push("confirm"); }, renderConversations() { calls.push("list"); },
  };
  // 실제 초기화 순서와 같다. 첫 문구를 그리기 전에 언어를 정하고, 끝에서 선택기를 붙인다.
  runInNewContext(langBlock + codeBetween("function toastLine(", "function dismissConversationToast(") +
    codeBetween("const aiModeKey =", "async function readChatStream(") +
    "\nuiLang = detectLang(historyStorage(), window.navigator?.language);\nsetupLang();\n", context);
  const page = {
    document, root, body, storage, calls, loginButton, headerButton,
    focus: () => focused,
    run: code => runInNewContext(code, context),
    get: selector => body.querySelector(selector),
    menu: () => body.children.find(node => node.className === "choice-menu"),
    items: () => page.menu().children.filter(node => node.getAttribute?.("role") === "menuitemradio"),
    choose(button, value) { button.click(); page.items().find(node => node.dataset.choiceValue === value).click(); },
    tick() { for (const [key, timer] of timers) { timers.delete(key); timer.callback(); } },
  };
  return page;
}

test("첫 방문은 브라우저 언어의 en·zh 접두사를 따르고 저장값·읽기 실패·없는 저장소는 그 규칙을 지킨다", () => {
  const detect = runInNewContext(langBlock + "\ndetectLang", {});
  const empty = memoryStorage();
  assert.equal(detect(empty, "en-US"), "en");
  assert.equal(detect(empty, "EN"), "en");
  assert.equal(detect(empty, "zh-TW"), "zh");
  assert.equal(detect(empty, "zh-Hans-CN"), "zh");
  for (const other of ["ko-KR", "fr-FR", "", undefined, 42]) assert.equal(detect(empty, other), "ko");
  assert.equal(detect(memoryStorage({ [langKey]: "zh" }), "en-US"), "zh");
  assert.equal(detect(memoryStorage({ [langKey]: "ko" }), "en-US"), "ko");
  assert.equal(detect(memoryStorage({ [langKey]: "fictional" }), "en-US"), "ko");
  assert.equal(detect({ getItem() { throw Error("가상 읽기 실패"); } }, "en-US"), "ko");
  assert.equal(detect(null, "en-US"), "ko");
  assert.equal(detect(undefined, "zh-CN"), "ko");
});

test("세 언어 사전은 같은 열쇠를 갖고, 자리 이름을 지키며, 채운 값은 다시 해석하지 않는다", () => {
  const { en, zh } = runInNewContext(langBlock + "\nuiText", {});
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  const holes = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const table of [en, zh]) {
    for (const [source, text] of Object.entries(table)) {
      assert.ok(text.trim() && text !== source, source);
      assert.deepEqual(holes(text), holes(source), source);
    }
  }
  const context = {};
  runInNewContext(langBlock, context);
  const t = (code) => runInNewContext(code, context);
  assert.equal(t('t("‘{title}’ 대화에 아이오의 답변이 왔어요", { title: "{count}" })'), "‘{count}’ 대화에 아이오의 답변이 왔어요");
  assert.equal(t('t("사전에 없는 가상 문구")'), "사전에 없는 가상 문구");
  t('uiLang = "en"');
  assert.equal(t('t("보관함 ({count})", { count: 3 })'), "Archive (3)");
  assert.equal(t('t("모델이 쓴 원문, 영어일 수 있음")'), "The model's own words, may be in English");
  assert.equal(t('t("사전에 없는 가상 문구")'), "사전에 없는 가상 문구");
  t('uiLang = "zh"');
  assert.equal(t('t("보내기")'), "发送");
  assert.equal(t('tr(["안녕하세요, {label} 님", { label: "가상 학생" }])'), "你好，가상 학생");
});

test("세 언어에서 화자는 아이오, 떠 있는 그림은 테크모로 표시한다", () => {
  const p = langPage();
  const aiPhrases = [
    "아이오", "아이오에게 물어보세요 · 사진만 보내도 돼요", "아이오와 새 대화",
    "아이오가 생각하는 중", "아이오가 {seconds}초 동안 생각함",
    "아이오의 답변 기다리는 중", "아이오의 읽지 않은 답변", "아이오의 읽지 않은 답변 있음",
    "‘{title}’ 대화에 아이오의 답변이 왔어요",
  ];
  for (const [language, ai, character] of [["en", "AIO", "Techmo"], ["zh", "AIO", "Techmo"], ["ko", "아이오", "테크모"]]) {
    p.choose(p.headerButton, language);
    assert.equal(p.run('t("아이오")'), ai);
    assert.equal(p.get(".reply-author").textContent, ai);
    for (const phrase of aiPhrases) {
      const translated = p.run(`t(${JSON.stringify(phrase)}, {seconds: 4, title: "가상 대화"})`);
      assert.ok(translated.includes(ai) && !translated.includes(character), translated);
    }
    assert.ok(p.get("#brand-prompt").getAttribute("placeholder").includes(ai));
    assert.ok(p.get("#brand-pet").getAttribute("aria-label").includes(ai));
    assert.equal(p.get("#brand-pet-image").getAttribute("alt"), character);
  }
  assert.doesNotMatch(html + script, /금오AI/);
});

test("index.html의 한국어 고정 문구와 aria-label·placeholder·alt는 모두 사전에 있다", () => {
  const { en } = runInNewContext(langBlock + "\nuiText", {});
  // 스크립트를 끈 안내, 스크립트가 직접 그리는 제목·답변 모드·언어 버튼 글은 사전 열쇠가 아니다.
  const markup = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<noscript>[\s\S]*?<\/noscript>/g, "")
    .replace(/<h1 class="title-fallback">[\s\S]*?<\/h1>/, "").replace(/<span class="main-title-fallback">[\s\S]*?<\/span><\/h2>/, "")
    .replace(/<span class="lang-pill-label">[^<]*<\/span>/g, "");
  const korean = text => /[가-힣]/.test(text);
  const texts = [...markup.matchAll(/>([^<]+)</g)].map(match => match[1].trim()).filter(korean);
  const attributes = [...markup.matchAll(/\s(?:aria-label|placeholder|alt)="([^"]*)"/g)].map(match => match[1])
    .filter(korean).filter(value => !value.startsWith("언어 / Language") && !value.startsWith("답변 모드:"));
  assert.ok(texts.length > 40 && attributes.length > 10);
  assert.deepEqual([...texts, ...attributes].filter(text => !Object.hasOwn(en, text)), []);
});

test("언어 메뉴는 머리글을 고정하고 각 언어 이름·보조 이름·현재 체크를 보여 주며 머리글 버튼에서는 아래로 열린다", () => {
  const p = langPage();
  assert.equal(p.headerButton.getAttribute("aria-expanded"), "false");
  p.headerButton.click();
  const menu = p.menu();
  assert.equal(menu.getAttribute("role"), "menu");
  assert.equal(menu.getAttribute("aria-label"), "언어 / Language");
  assert.equal(menu.children[0].textContent, "언어 / Language");
  assert.equal(p.headerButton.getAttribute("aria-expanded"), "true");
  const items = p.items();
  assert.deepEqual(items.map(item => item.children[1].textContent), ["한국어", "English", "中文(简体)"]);
  assert.deepEqual(items.map(item => item.children[1].getAttribute("lang")), ["ko", "en", "zh-Hans"]);
  assert.deepEqual(items.map(item => item.children[2].textContent), ["Korean", "영어", "Chinese (Simplified)"]);
  assert.deepEqual(items.map(item => item.getAttribute("aria-checked")), ["true", "false", "false"]);
  assert.equal(p.focus(), items[0]);
  // 버튼 아래(50px) + 8px. 위쪽에는 메뉴가 들어갈 자리가 없다.
  assert.equal(menu.getAttribute("--choice-menu-y"), "58px");
  assert.equal(menu.getAttribute("--choice-menu-x"), "900px");
  p.headerButton.click();
  assert.equal(p.menu(), undefined);
  assert.equal(p.headerButton.getAttribute("aria-expanded"), "false");
});

test("방향키는 끝에서 돌고 Enter·Space로 고르며 Esc는 버튼으로, Tab은 초점을 두고 닫는다", () => {
  const p = langPage();
  p.headerButton.click();
  p.menu().fire("keydown", { key: "ArrowDown" });
  assert.equal(p.focus(), p.items()[1]);
  p.menu().fire("keydown", { key: "Enter" });
  assert.equal(p.run("uiLang"), "en");
  assert.equal(p.storage.values.get(langKey), "en");
  assert.equal(p.menu(), undefined);
  assert.equal(p.focus(), p.headerButton);

  const opened = p.loginButton.fire("keydown", { key: "ArrowDown" });
  assert.equal(opened.prevented, true);
  assert.equal(p.focus(), p.items()[1]);
  assert.deepEqual(p.items().map(item => item.getAttribute("aria-checked")), ["false", "true", "false"]);
  p.menu().fire("keydown", { key: "ArrowUp" });
  p.menu().fire("keydown", { key: "ArrowUp" });
  assert.equal(p.focus(), p.items()[2]);
  p.menu().fire("keydown", { key: " " });
  assert.equal(p.run("uiLang"), "zh");
  assert.equal(p.focus(), p.loginButton);

  p.loginButton.click();
  let stopped = false;
  p.menu().fire("keydown", { key: "Escape", stopPropagation() { stopped = true; } });
  assert.equal(stopped, true);
  assert.equal(p.menu(), undefined);
  assert.equal(p.focus(), p.loginButton);
  p.loginButton.click();
  const inside = p.focus();
  p.menu().fire("keydown", { key: "Tab" });
  p.tick();
  assert.equal(p.menu(), undefined);
  assert.equal(p.focus(), inside);
  assert.equal(p.run("uiLang"), "zh");
});

test("고르면 새로고침 없이 html lang·탭 제목·두 버튼·고정 문구가 바뀌고 대화·사용자 글은 그대로다", () => {
  const p = langPage();
  const text = selector => p.get(selector).text;
  p.run('say(document.querySelector("#pet-line"), "궁금한 점을 물어보세요")');
  p.choose(p.headerButton, "en");
  assert.equal(p.root.getAttribute("lang"), "en");
  assert.equal(p.document.title, "Kumoh Tech Academic AI · AIO");
  for (const button of [p.loginButton, p.headerButton]) {
    assert.equal(button.querySelector(".lang-pill-label").textContent, "English");
    assert.equal(button.getAttribute("aria-label"), "Language: English");
  }
  assert.equal(text(".intro-badge"), "Kumoh National Institute of Technology · Academic Guide");
  assert.equal(p.get("#student-number").getAttribute("placeholder"), "e.g. 20990002");
  assert.equal(text("#send"), "Send");
  assert.equal(text("#login-submit"), "Log in");
  assert.equal(text(".campus-site-link"), "University website (new window)");
  assert.equal(text(".title-fallback"), "To graduation, with AIO");
  assert.equal(text(".main-title-fallback"), "Ask AIO");
  assert.equal(p.get("#pet-line").textContent, "Ask me anything");
  // 대화 목록과 말풍선 안의 글은 사전과 같은 글자여도 바꾸지 않는다.
  assert.equal(text("#conversation-list"), "새 대화");
  assert.equal(text(".fictional-message"), "보내기");
  // 열린 메뉴·확인 창·대화 목록도 다시 그리게 부른다.
  for (const name of ["menu", "confirm", "list"]) assert.ok(p.calls.includes(name), name);

  p.run("hiddenAnswers = 2; showTitle()");
  assert.equal(p.document.title, "(2) Kumoh Tech Academic AI · AIO");
  p.choose(p.loginButton, "zh");
  assert.equal(p.root.getAttribute("lang"), "zh-Hans");
  assert.equal(p.document.title, "(2) 金乌工大学务 AI · AIO");
  assert.equal(text(".title-fallback"), "直到毕业，与 AIO 同行");
  assert.equal(text(".main-title-fallback"), "问问 AIO");
  assert.equal(text("#send"), "发送");
  assert.equal(p.headerButton.getAttribute("aria-label"), "语言 / Language：中文");
  assert.equal(p.headerButton.querySelector(".lang-pill-label").textContent, "中文");
  assert.equal(p.get("#pet-line").textContent, "有什么问题尽管问吧");

  p.choose(p.headerButton, "ko");
  assert.equal(p.root.getAttribute("lang"), "ko");
  assert.equal(p.document.title, "(2) 금오공대 학사 행정 AI 아이오");
  assert.equal(text(".intro-badge"), "국립금오공과대학교 학사 안내");
  assert.equal(p.get("#student-number").getAttribute("placeholder"), "예: 20990002");
  assert.equal(text("#send"), "보내기");
  assert.equal(text(".campus-site-link"), "학교 홈페이지 (새 창)");
  assert.equal(text(".title-fallback"), "졸업까지, 아이오와 함께");
  assert.equal(text(".main-title-fallback"), "물어봐요, 아이오");
  assert.equal(p.headerButton.getAttribute("aria-label"), "언어 / Language: 한국어");
  assert.equal(p.get("#pet-line").textContent, "궁금한 점을 물어보세요");
});

test("사진 결과 안내는 원문과 채울 값을 기억해 언어를 바꾸면 새 언어로 다시 쓴다", () => {
  const p = langPage({ language: "en-US" });
  p.run('say(document.querySelector("#photo-note"), ["행사를 찾았어요. {title}", { title: "가상 설명회" }])');
  assert.equal(p.get("#photo-note").textContent, "Found the event: 가상 설명회");
  p.choose(p.headerButton, "zh");
  assert.equal(p.get("#photo-note").textContent, "找到了活动：가상 설명회");
  // 채울 값까지 번역해야 하는 안내는 함수로 넘겨 두 문구를 함께 바꾼다.
  p.run('say(document.querySelector("#photo-note"), () => t("{kind}에서 답을 찾았어요.", { kind: t("캠퍼스 안내") }))');
  assert.equal(p.get("#photo-note").textContent, "已在校园指南中找到答案。");
  p.choose(p.headerButton, "en");
  assert.equal(p.get("#photo-note").textContent, "Found an answer in Campus guide.");
  p.choose(p.headerButton, "ko");
  assert.equal(p.get("#photo-note").textContent, "캠퍼스 안내에서 답을 찾았어요.");
});

test("사진 결과 함수는 번역한 글 대신 원문을 돌려줘 안내 줄이 기억하게 한다", () => {
  for (const marker of ['return [card, ["행사를 찾았어요. {title}"', 'summary: ["행사를 찾았어요. {title}"',
    'return [section, () => t("{kind}에서 답을 찾았어요."', "say(photoNote, summary)", "say(photoNote, shown.summary)"]) {
    assert.ok(script.includes(marker), marker);
  }
  assert.doesNotMatch(script, /photoNote\.textContent = (?!"")/);
});

test("다른 코드가 바꾼 알림 줄은 언어를 바꿔도 덮어쓰지 않는다", () => {
  const p = langPage();
  p.run('say(document.querySelector("#pet-line"), "답변이 도착했어요")');
  p.get("#pet-line").textContent = "가상 다른 글";
  p.choose(p.headerButton, "en");
  assert.equal(p.get("#pet-line").textContent, "가상 다른 글");
});

test("저장에 실패하면 고른 언어 대신 한국어로 돌아가고 읽기 실패도 한국어로 시작한다", () => {
  const failing = { getItem: () => null, setItem() { throw Error("가상 저장 실패"); } };
  const p = langPage({ storage: failing, language: "en-US" });
  assert.equal(p.run("uiLang"), "en");
  p.choose(p.headerButton, "zh");
  assert.equal(p.run("uiLang"), "ko");
  assert.equal(p.root.getAttribute("lang"), "ko");
  assert.equal(p.get("#send").text, "보내기");
  assert.equal(p.headerButton.querySelector(".lang-pill-label").textContent, "한국어");
  const unreadable = langPage({ storage: { getItem() { throw Error("가상 읽기 실패"); }, setItem() {} }, language: "zh-CN" });
  assert.equal(unreadable.run("uiLang"), "ko");
  assert.equal(unreadable.get("#send").text, "보내기");
});

test("처음부터 영어·중국어면 첫 화면을 그 언어로 그리고 한국어면 문서를 건드리지 않는다", () => {
  const english = langPage({ language: "en-GB" });
  assert.equal(english.root.getAttribute("lang"), "en");
  assert.equal(english.get("#send").text, "Send");
  assert.equal(english.loginButton.querySelector(".lang-pill-label").textContent, "English");
  assert.equal(english.storage.values.has(langKey), false);
  const chinese = langPage({ language: "zh-TW" });
  assert.equal(chinese.root.getAttribute("lang"), "zh-Hans");
  assert.equal(chinese.get("#login-submit").text, "登录");
  const korean = langPage({ language: "ko-KR" });
  assert.equal(korean.root.getAttribute("lang"), "ko");
  assert.equal(korean.get(".title-fallback").text, "졸업까지, 아이오와 함께");
  assert.deepEqual(korean.calls, []);
});
