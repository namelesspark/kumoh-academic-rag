import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../../app/chat_web/assets/chat.js", import.meta.url), "utf8");

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
  runInNewContext(script.slice(start, end), context);
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
  const body = { message: "가상 질문", session_id: "fictional-session", mode: "deep", use_academic_data: false };
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
