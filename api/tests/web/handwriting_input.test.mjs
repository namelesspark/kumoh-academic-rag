// 손글씨 입력 필기 패드 테스트(#134). 브라우저와 서버를 띄우지 않고, 가짜 화면 객체·가짜 2D 캔버스·가짜 서버 요청 함수(fetch)로
// chat.js를 그대로 실행한다. 그림 바이트와 인식 글자는 모두 가상 값이다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const read = path => readFileSync(new URL(`../../app/chat_web/${path}`, import.meta.url), "utf8");
const script = read("assets/chat.js");
const styles = read("assets/chat.css");
const html = read("index.html");

const handwritingPath = "/api/v1/handwriting";
const messages = {
  reading: "글씨를 읽는 중…",
  unavailable: "지금은 손글씨를 읽을 수 없어요. 잠시 뒤 다시 넣어 주세요.",
  unreadable: "글씨를 읽지 못했어요. 또박또박 다시 쓰거나 고쳐 쓴 뒤 다시 넣어 주세요.",
  tooLarge: "글씨 그림이 너무 커요. 일부를 지우고 다시 넣어 주세요.",
  timeout: "읽는 시간이 너무 오래 걸렸어요. 다시 넣어 주세요.",
  offline: "서버에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 넣어 주세요.",
  failed: "서버가 글씨를 처리하지 못했어요. 다시 넣어 주세요.",
  inserted: "읽은 글자를 입력창에 넣었어요. 확인한 뒤 보내 주세요.",
};
const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// 그리기 호출을 순서대로 적는 가짜 2D 컨텍스트.
function fakeContext(log) {
  const values = {};
  return new Proxy(values, {
    get(target, name) {
      if (Object.hasOwn(target, name)) return target[name];
      return (...args) => { log.push([name, ...args]); };
    },
    set(target, name, value) {
      target[name] = value;
      log.push(["set", name, value]);
      return true;
    },
  });
}

function loadPad({ language, pixelRatio = 2, blobSize = pngBytes.length, innerWidth = 1280, innerHeight = 800 } = {}) {
  const elements = new Map();
  const timers = [];
  const requests = [];
  const exports = [];
  const state = { focused: null, blobSize, submits: 0, ink: "rgb(10, 37, 64)", scrollY: 0, scrolls: [] };
  const mediaListeners = [];
  const windowListeners = [];
  const resizeObservers = [];

  class FakeElement {
    children = [];
    listeners = new Map();
    attributes = new Map();
    textContent = "";
    className = "";
    value = "";
    parent = null;
    hidden = false;
    disabled = false;
    style = { properties: new Map(), setProperty(name, value) { this.properties.set(name, String(value)); }, removeProperty(name) { this.properties.delete(name); } };
    classList = {
      contains: name => this.className.split(/\s+/).includes(name),
      add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(" "); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(" "); },
      toggle: (name, force) => { const on = force ?? !this.classList.contains(name); this.classList[on ? "add" : "remove"](name); return on; },
    };

    constructor(tagName) {
      this.tagName = tagName;
    }

    set innerHTML(_value) {
      throw new Error("innerHTML must not be used");
    }

    append(...nodes) {
      for (const node of nodes) {
        if (node instanceof FakeElement) {
          node.remove();
          node.parent = this;
        }
        this.children.push(node);
      }
    }

    replaceChildren(...nodes) {
      for (const child of this.children) if (child instanceof FakeElement) child.parent = null;
      this.children = [];
      this.append(...nodes);
    }

    remove() {
      if (!this.parent) return;
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
      this.parent = null;
    }

    addEventListener(type, listener) {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
    }

    dispatchEvent(event) {
      for (const listener of this.listeners.get(event.type) ?? []) listener(event);
      return true;
    }

    fire(type, values = {}) {
      const event = { type, target: this, prevented: false, preventDefault() { event.prevented = true; }, stopPropagation() {}, ...values };
      for (const listener of this.listeners.get(type) ?? []) listener(event);
      return event;
    }

    click() {
      if (this.disabled) return;
      this.fire("click");
    }

    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }

    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }

    removeAttribute(name) {
      this.attributes.delete(name);
    }

    querySelectorAll(selector) {
      if (!selector.startsWith(".")) return [];
      const name = selector.slice(1);
      const found = [];
      const walk = node => { for (const child of node.children) if (child instanceof FakeElement) { if (child.className.split(" ").includes(name)) found.push(child); walk(child); } };
      walk(this);
      return found;
    }

    scrollIntoView() {}

    focus() {
      state.focused = this;
    }
  }

  // 화면에 보이는 필기 칸. 기기 화소 비율과 포인터 잡기(capture)를 흉내 낸다.
  class FakeCanvas extends FakeElement {
    width = 300;
    height = 150;
    log = [];
    captured = new Set();
    released = [];
    context = fakeContext(this.log);
    getContext(kind) { return kind === "2d" ? this.context : null; }
    setPointerCapture(id) { this.captured.add(id); }
    hasPointerCapture(id) { return this.captured.has(id); }
    releasePointerCapture(id) { this.captured.delete(id); this.released.push(id); }
    toBlob(callback, type) {
      exports.push({ canvas: this, type });
      const bytes = state.blobSize === pngBytes.length ? pngBytes : new Uint8Array(state.blobSize);
      callback(new Blob([bytes], { type }));
    }
  }

  const make = selector => {
    if (selector === "#handwriting-canvas") return new FakeCanvas("canvas");
    if (selector === "#question") return new FakeElement("textarea");
    return new FakeElement(selector);
  };
  const graduation = new FakeElement("button");
  graduation.dataset = { action: "graduation" };
  const get = selector => {
    if (!elements.has(selector)) elements.set(selector, make(selector));
    return elements.get(selector);
  };

  const canvasRect = { left: 100, top: 400, right: 700, bottom: 600, width: 600, height: 200 };
  get("#handwriting-canvas").getBoundingClientRect = () => ({ ...canvasRect });
  const rowRect = { left: 100, top: 650, right: 700, bottom: 710, width: 600, height: 60 };
  get(".composer-row").getBoundingClientRect = () => ({ ...rowRect });
  const padRect = { left: 100, top: 322, right: 700, bottom: 642, width: 600, height: 320 };
  get("#handwriting-pad").getBoundingClientRect = () => ({ ...padRect });
  get("#handwriting-pad").hidden = true;
  const input = get("#question");
  input.selectionStart = 0;
  input.selectionEnd = 0;
  // 브라우저의 setRangeText와 같은 규칙: start~end를 바꾸고, "end"면 커서를 넣은 글자 뒤로 옮긴다.
  input.setRangeText = function setRangeText(text, start, end, mode) {
    this.value = this.value.slice(0, start) + text + this.value.slice(end);
    if (mode === "end") this.selectionStart = this.selectionEnd = start + text.length;
  };
  get("#composer").requestSubmit = () => { state.submits++; };

  const routes = [];
  function fetch(path, options = {}) {
    const request = { path, options };
    requests.push(request);
    if (path !== handwritingPath) return Promise.reject(new Error(`unexpected request: ${path}`));
    const route = routes.shift();
    if (!route) return Promise.reject(new Error("no prepared response"));
    return route(request);
  }

  const documentListeners = [];
  runInNewContext(script, {
    document: {
      addEventListener(type, listener) { documentListeners.push({ type, listener }); },
      querySelector(selector) {
        if (selector === "#ai-mode-button") return null;
        return get(selector);
      },
      querySelectorAll: selector => (selector === "[data-action]" ? [graduation] : []),
      createElement: tag => (tag === "canvas" ? new FakeCanvas("canvas") : new FakeElement(tag)),
      createTextNode: value => value,
      get activeElement() { return state.focused; },
    },
    window: {
      // 시스템 테마 변화 신호를 테스트에서 직접 보낼 수 있게 처리기를 모아 둔다.
      matchMedia: query => ({ matches: false, addEventListener: (type, listener) => mediaListeners.push({ query, type, listener }) }),
      devicePixelRatio: pixelRatio,
      innerWidth,
      innerHeight,
      navigator: language ? { language } : undefined,
      // 저장소가 없으면 첫 방문 언어 감지가 한국어로 돌아간다. 언어를 줄 때만 빈 저장소를 둔다.
      localStorage: language ? { getItem: () => null, setItem() {}, removeItem() {} } : undefined,
      getComputedStyle: () => ({ color: state.ink }),
      addEventListener: (type, listener) => windowListeners.push({ type, listener }),
      // 문서 스크롤 위치. 굴리면 입력 줄도 화면에서 그만큼 움직인다.
      get scrollY() { return state.scrollY; },
      scrollBy(x, y) {
        state.scrolls.push(y);
        state.scrollY += y;
        rowRect.top -= y; rowRect.bottom -= y;
      },
    },
    URL,
    AbortSignal: { timeout: () => undefined },
    AbortController,
    // 입력 줄 크기 변화 신호를 테스트에서 직접 보낼 수 있게 지켜보는 대상과 처리기를 모아 둔다.
    ResizeObserver: class { constructor(callback) { this.callback = callback; resizeObservers.push(this); } observe(node) { this.node = node; } },
    FormData,
    Blob,
    Event,
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearTimeout: id => { if (timers[id - 1]) timers[id - 1].cleared = true; },
    fetch,
  }, { filename: "chat.js" });

  const page = {
    state, requests, exports, routes, timers, input,
    button: get("#handwriting-button"),
    pad: get("#handwriting-pad"),
    canvas: get("#handwriting-canvas"),
    status: get("#handwriting-status"),
    undo: get("#handwriting-undo"),
    clear: get("#handwriting-clear"),
    cancel: get("#handwriting-cancel"),
    insert: get("#handwriting-insert"),
    send: get("#send"),
    transcript: get("#transcript"),
  };
  // 캔버스 안 좌표(x, y)로 포인터 신호를 보낸다.
  page.pointer = (type, { id = 1, kind = "mouse", x = 0, y = 0, pressure, coalesced, button = 0 } = {}) => page.canvas.fire(type, {
    pointerId: id, pointerType: kind, clientX: canvasRect.left + x, clientY: canvasRect.top + y, button,
    pressure: pressure ?? (kind === "mouse" ? 0.5 : 0.5),
    ...(coalesced ? { getCoalescedEvents: () => coalesced.map(([cx, cy, cp = 0.5]) => ({ clientX: canvasRect.left + cx, clientY: canvasRect.top + cy, pressure: cp })) } : {}),
  });
  page.stroke = (from, to, options = {}) => {
    page.pointer("pointerdown", { ...options, x: from[0], y: from[1] });
    page.pointer("pointermove", { ...options, x: to[0], y: to[1] });
    page.pointer("pointerup", { ...options, x: to[0], y: to[1] });
  };
  // 초점이 패드 밖에 있을 때 문서까지 올라온 키 신호를 흉내 낸다.
  page.documentKey = key => {
    const event = { type: "keydown", key, target: state.focused, defaultPrevented: false, preventDefault() { event.defaultPrevented = true; }, stopPropagation() {} };
    for (const each of documentListeners) if (each.type === "keydown") each.listener(event);
    return event;
  };
  page.get = get;
  page.rowRect = rowRect;
  page.padRect = padRect;
  page.canvasRect = canvasRect;
  page.resize = () => { for (const each of windowListeners) if (each.type === "resize") each.listener({}); };
  page.rowResized = () => {
    for (const observer of resizeObservers) if (observer.node === get(".composer-row")) observer.callback([]);
  };
  // 브라우저는 지켜보기 시작할 때와 요소가 보일 때 크기가 그대로여도 모든 대상에 첫 알림을 한 번 보낸다.
  page.observersNotified = () => { for (const observer of resizeObservers) observer.callback([]); };
  // 질문 칸에 글을 쓴 것처럼 값과 커서를 바꾸고 input 신호를 보낸다(키보드·Scribble 모두 이 신호를 낸다).
  // inputType은 브라우저가 붙이는 입력 종류다(실행 취소는 historyUndo, 다시 실행은 historyRedo).
  page.type = (value, caretAt = value.length, inputType = "insertText") => {
    input.value = value;
    input.selectionStart = input.selectionEnd = caretAt;
    input.dispatchEvent({ type: "input", inputType });
  };
  // 실제 브라우저처럼 입력 직전에 문서 캡처 단계로 beforeinput을 보낸다. 그때 질문 칸의 선택 범위(replaced)가 바뀔 범위다.
  page.typeOver = (value, caretAt, inputType, [start, end]) => {
    input.selectionStart = start; input.selectionEnd = end;
    const event = { type: "beforeinput", inputType, target: input };
    for (const each of documentListeners) if (each.type === "beforeinput") each.listener(event);
    page.type(value, caretAt, inputType);
  };
  // 문서가 스크롤됐다는 신호를 보낸다.
  page.scroll = () => { for (const each of documentListeners) if (each.type === "scroll") each.listener({ type: "scroll" }); };
  page.systemThemeChanged = () => {
    for (const each of mediaListeners) if (each.query.includes("prefers-color-scheme") && each.type === "change") each.listener({});
  };
  page.respond = response => routes.push(() => Promise.resolve(response));
  // 응답을 붙잡아 두었다가 직접 풀어 준다. 요청이 끊기면(abort) 브라우저처럼 거절한다.
  page.hold = () => {
    const held = {};
    routes.push(request => new Promise((resolve, reject) => {
      held.request = request;
      held.resolve = resolve;
      request.options.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    return held;
  };
  return page;
}

// 가짜 응답은 브라우저처럼 본문을 글자(text)로도 JSON으로도 읽을 수 있다. 코드는 글자로 받은 뒤 JSON으로 해석한다.
const ok = text => ({ ok: true, status: 200, text: async () => JSON.stringify({ text }), json: async () => ({ text }) });
const refused = status => ({ ok: false, status, text: async () => JSON.stringify({ detail: "fictional error" }), json: async () => ({ detail: "fictional error" }) });
const settle = async () => { for (let i = 0; i < 4; i++) await setImmediate(); };

test("펜 버튼은 입력 줄의 사진 버튼 뒤에 있고, 패드는 질문 폼 밖의 이름 붙은 대화 상자다", () => {
  const composer = /<form id="composer"[\s\S]*?<\/form>/.exec(html)?.[0] ?? "";
  const row = /<div class="composer-row">([\s\S]*?)<\/div>/.exec(composer)?.[1] ?? "";
  assert.deepEqual([...row.matchAll(/<(?:button|textarea)\b[^>]*\bid="([^"]+)"/g)].map(match => match[1]),
    ["photo-attach", "handwriting-button", "question", "ai-mode-button", "send"]);
  const pen = /<button\b[^>]*id="handwriting-button"[^>]*>/.exec(row)?.[0] ?? "";
  // 사진 버튼과 같은 .attach-button이라 44px 조작 영역 규칙을 그대로 받는다.
  assert.match(pen, /class="attach-button pen-button"/);
  assert.match(pen, /aria-label="손글씨로 입력"/);
  assert.match(pen, /aria-controls="handwriting-pad"/);
  assert.match(pen, /aria-expanded="false"/);
  assert.doesNotMatch(pen, /data-action/);

  assert.equal(composer.includes('id="handwriting-pad"'), false, "the pad lives outside the form");
  assert.equal(composer.includes("handwriting-canvas"), false, "the canvas lives outside the form");
  assert.equal(html.split("<form").length, 3, "the pad is not another form");
  const pad = /<section class="handwriting-pad"[^>]*>[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
  assert.match(pad, /role="dialog"/);
  assert.match(pad, /aria-labelledby="handwriting-title"/);
  assert.match(pad, /\bhidden>/);
  assert.match(pad, /<h2 class="handwriting-title" id="handwriting-title">손글씨로 입력<\/h2>/);
  assert.ok(html.indexOf("</main>") < html.indexOf('id="handwriting-pad"'), "fixed pad stays outside the blurred layout");
  // 초점 순서: 캔버스 → 되돌리기 → 지우기 → 취소 → 넣기. 상태 줄은 알림 영역이다.
  assert.deepEqual([...pad.matchAll(/<(?:canvas|button)\b[^>]*\bid="([^"]+)"/g)].map(match => match[1]),
    ["handwriting-canvas", "handwriting-undo", "handwriting-clear", "handwriting-cancel", "handwriting-insert"]);
  assert.match(pad, /<canvas[^>]*tabindex="0"[^>]*aria-label="필기 영역"/);
  assert.match(pad, /<p class="handwriting-status" id="handwriting-status" role="status" aria-live="polite"><\/p>/);
});

test("질문 칸은 진짜 textarea 그대로이고 덮개·포인터 처리기·touch-action이 없어 Scribble을 막지 않는다", () => {
  const textarea = /<textarea id="question"[^>]*>/.exec(html)?.[0] ?? "";
  assert.equal(textarea, '<textarea id="question" rows="1" enterkeyhint="send" placeholder="아이오에게 물어보세요 · 사진만 보내도 돼요">');
  // 질문 칸에 붙은 처리기는 입력과 Enter 처리뿐이다.
  const listeners = [...script.matchAll(/\binput\.addEventListener\("([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(listeners, ["input", "keydown"]);
  assert.doesNotMatch(script, /input\.(on(pointer|touch|mouse)\w*|style\.touchAction)/);
  // touch-action은 필기 캔버스와 끌어 옮기는 테크모에만 있다. 입력 줄 쪽 규칙에는 없다.
  const rules = [...styles.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [selector.trim(), body]);
  const touch = rules.filter(([, body]) => /touch-action/.test(body)).map(([selector, body]) => [selector, /touch-action:\s*([^;]+)/.exec(body)[1].trim()]);
  assert.deepEqual(touch, [[".pet", "none"], [".handwriting-canvas", "none"]]);
  for (const [selector] of rules) if (/textarea|composer/.test(selector)) assert.equal(/handwriting/.test(selector), false, selector);
  // 패드는 전환 효과 없이 연다.
  for (const [selector, body] of rules) if (/handwriting/.test(selector)) assert.doesNotMatch(body, /transition|animation/, selector);
});

test("펜 버튼을 누르면 패드가 열리고 기기 화소 비율에 맞춘 캔버스로 초점이 간다", () => {
  const page = loadPad();
  page.button.click();
  assert.equal(page.pad.hidden, false);
  assert.equal(page.button.getAttribute("aria-expanded"), "true");
  assert.equal(page.state.focused, page.canvas);
  assert.equal(page.canvas.width, 1200);
  assert.equal(page.canvas.height, 400);
  assert.ok(page.canvas.log.some(call => call[0] === "setTransform" && call.slice(1).join() === "2,0,0,2,0,0"));
  // 넓은 화면에서는 입력 줄 바로 위에 놓는다(800 - 650 + 8).
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "158px");
  assert.equal(page.pad.style.properties.get("--handwriting-width"), "600px");
  // 획이 없으면 되돌리기·지우기·넣기가 잠겨 있다. 상태 줄은 비어 있다.
  assert.deepEqual([page.undo.disabled, page.clear.disabled, page.insert.disabled, page.cancel.disabled], [true, true, true, false]);
  assert.equal(page.status.textContent, "");
});

test("펜을 한 번 보면 진행 중인 손가락 획을 지우고 그 뒤 손가락은 무시한다", () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 7, kind: "touch", x: 20, y: 20 });
  page.pointer("pointermove", { id: 7, kind: "touch", x: 80, y: 90 });
  assert.equal(page.undo.disabled, false, "a finger stroke counts before any pen");
  page.pointer("pointerdown", { id: 9, kind: "pen", x: 200, y: 50, pressure: 0.6 });
  assert.ok(page.canvas.released.includes(7), "the palm stroke loses its capture");
  page.pointer("pointermove", { id: 7, kind: "touch", x: 120, y: 120 });
  page.pointer("pointerup", { id: 9, kind: "pen", x: 200, y: 50 });
  const ignored = page.pointer("pointerdown", { id: 8, kind: "touch", x: 10, y: 10 });
  assert.equal(page.canvas.captured.has(8), false);
  assert.equal(ignored.prevented, false);
  // 남은 획은 펜 획 하나다. 한 번 되돌리면 모두 비워진다.
  page.undo.click();
  assert.equal(page.undo.disabled, true);
  assert.equal(page.insert.disabled, true);
});

test("읽는 동안 닿은 펜도 기록해, 읽기가 실패한 뒤 손가락 획을 받지 않는다", async () => {
  const page = loadPad();
  page.button.click();
  page.stroke([10, 10], [60, 60], { id: 1, kind: "touch" });
  const held = page.hold();
  page.insert.click();
  await settle();
  // 응답을 기다리는 동안 펜을 댄다. 획은 받지 않는다.
  page.pointer("pointerdown", { id: 2, kind: "pen", x: 100, y: 100 });
  assert.equal(page.canvas.captured.has(2), false);
  held.resolve(refused(503));
  await settle();
  assert.equal(page.status.textContent, messages.unavailable);
  // 실패 뒤 손가락은 무시한다. 손가락 획 하나만 남아 있다.
  const ignored = page.pointer("pointerdown", { id: 3, kind: "touch", x: 120, y: 120 });
  assert.equal(page.canvas.captured.has(3), false);
  assert.equal(ignored.prevented, false);
  page.undo.click();
  assert.equal(page.undo.disabled, true, "only the first finger stroke existed");
});

test("펜 압력으로 굵기가 바뀌고, 있을 때는 묶인 포인터 신호(getCoalescedEvents)를 모두 그린다", () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 3, kind: "pen", x: 10, y: 10, pressure: 0.9 });
  const before = page.canvas.log.filter(call => call[0] === "lineTo").length;
  page.pointer("pointermove", { id: 3, kind: "pen", x: 40, y: 10, pressure: 0.1, coalesced: [[20, 10, 0.7], [30, 10, 0.4], [40, 10, 0.1]] });
  assert.equal(page.canvas.log.filter(call => call[0] === "lineTo").length - before, 3);
  const widths = page.canvas.log.filter(call => call[0] === "set" && call[1] === "lineWidth").map(call => call[2]);
  assert.ok(Math.abs(widths[0] - (1.2 + 4 * 0.9 + 1.2 + 4 * 0.7) / 2) < 1e-9, String(widths));
  assert.ok(widths.at(-1) < widths[0], "lighter pressure draws thinner");
  assert.ok(page.canvas.captured.has(3), "the stroke keeps pointer capture");
});

test("넣기는 되돌린 획을 빼고 잉크 범위에 여백을 둔 흰 바탕 PNG를 화면 언어와 함께 양식으로 보낸다", async () => {
  const page = loadPad();
  page.button.click();
  page.stroke([10, 10], [110, 10]);
  page.stroke([400, 150], [500, 190]);
  page.undo.click();
  assert.equal(page.insert.disabled, false);
  page.respond(ok("가상 글자"));
  page.insert.click();
  await settle();

  assert.equal(page.requests.length, 1);
  const [{ path, options }] = page.requests;
  assert.equal(path, handwritingPath);
  assert.equal(options.method, "POST");
  assert.deepEqual({ ...options.headers }, { Accept: "application/json" }, "the browser sets the multipart boundary");
  assert.ok(options.body instanceof FormData);
  const image = options.body.get("image");
  assert.equal(image.type, "image/png");
  assert.deepEqual(new Uint8Array(await image.arrayBuffer()), pngBytes);
  assert.equal(options.body.get("lang"), "ko");
  assert.deepEqual([...options.body.keys()], ["image", "lang"]);

  // 첫 획만 남았다: 가로 100 + 굵기 3 + 여백 16×2 = 135, 세로 3 + 32 = 35, 배율 2.
  const [{ canvas, type }] = page.exports;
  assert.equal(type, "image/png");
  assert.deepEqual([canvas.width, canvas.height], [270, 70]);
  const fillIndex = canvas.log.findIndex(call => call[0] === "fillRect");
  assert.deepEqual(canvas.log[fillIndex], ["fillRect", 0, 0, 270, 70]);
  assert.ok(canvas.log.slice(0, fillIndex).some(call => call.join() === "set,fillStyle,#ffffff"), "white background first");
  assert.ok(canvas.log.some(call => call[0] === "setTransform" && call.slice(1).join() === "2,0,0,2,15,15"));
  assert.equal(canvas.log.filter(call => call[0] === "lineTo").length, 1);
});

test("그림의 긴 변은 1024px를 넘지 않고, 2,000,000바이트를 넘는 그림은 보내지 않는다", async () => {
  const wide = loadPad();
  wide.button.click();
  wide.stroke([0, 0], [1000, 0]);
  wide.respond(ok("가상"));
  wide.insert.click();
  await settle();
  assert.equal(wide.exports[0].canvas.width, 1024);
  assert.ok(wide.exports[0].canvas.height <= 1024);

  const exact = loadPad({ blobSize: 2_000_000 });
  exact.button.click();
  exact.stroke([10, 10], [60, 60]);
  exact.respond(ok("가상"));
  exact.insert.click();
  await settle();
  assert.equal(exact.requests.length, 1, "exactly 2,000,000 bytes is sent");

  const large = loadPad({ blobSize: 2_000_001 });
  large.button.click();
  large.stroke([10, 10], [60, 60]);
  large.insert.click();
  await settle();
  assert.equal(large.requests.length, 0);
  assert.equal(large.status.textContent, messages.tooLarge);
  assert.equal(large.insert.disabled, false, "strokes stay for another try");
});

test("읽는 동안 상태를 알리고 넣기·되돌리기·지우기와 새 획을 막아 요청이 한 번만 간다", async () => {
  const page = loadPad();
  page.button.click();
  page.stroke([10, 10], [60, 60]);
  const held = page.hold();
  page.insert.click();
  await settle();
  assert.equal(page.status.textContent, messages.reading);
  // 대화 상자 전체를 처리 중으로 묶지 않아 읽기 도구가 상태 줄 안내를 바로 읽는다.
  assert.equal(page.pad.getAttribute("aria-busy"), null);
  assert.deepEqual([page.insert.disabled, page.undo.disabled, page.clear.disabled, page.cancel.disabled], [true, true, true, false]);
  // 잠긴 넣기 버튼에 초점이 남지 않게 취소로 옮겨 Esc·취소가 계속 듣는다.
  assert.equal(page.state.focused, page.cancel);
  page.insert.fire("click");
  page.pointer("pointerdown", { id: 5, x: 100, y: 100 });
  assert.equal(page.canvas.captured.has(5), false);
  await settle();
  assert.equal(page.requests.length, 1);
  held.resolve(ok("가상"));
  await settle();
  assert.equal(page.pad.getAttribute("aria-busy"), null);
  // 패드와 함께 사라지는 상태 줄 대신, 늘 있는 알림 줄이 넣었다고 알린다.
  assert.equal(page.pad.hidden, true);
  assert.equal(page.get("#conversation-announce").textContent, messages.inserted);
});

test("넣기가 실패하면 획을 남긴 채 오류를 알리고, 다시 넣으면 열기 전 커서 자리에 글자만 넣고 보내지 않는다", async () => {
  const page = loadPad();
  // 커서는 두 칸 띄운 사이(4번째 자리)에 있다.
  page.input.value = "휴학은  언제까지?";
  page.input.selectionStart = page.input.selectionEnd = 4;
  page.button.click();
  // 패드에 초점이 간 사이 질문 칸의 선택이 바뀌어도 열기 전 자리를 쓴다.
  page.input.selectionStart = page.input.selectionEnd = 0;
  page.stroke([10, 10], [60, 60]);
  page.respond(refused(503));
  page.insert.click();
  await settle();

  assert.equal(page.status.textContent, messages.unavailable);
  assert.equal(page.status.classList.contains("is-error"), true);
  assert.equal(page.pad.hidden, false);
  assert.equal(page.insert.disabled, false);
  assert.equal(page.undo.disabled, false, "the strokes are kept");
  assert.equal(page.state.focused, page.insert, "focus waits on Insert for a retry");
  assert.equal(page.input.value, "휴학은  언제까지?");

  page.respond(ok("  가상 신청 "));
  page.insert.click();
  await settle();
  assert.equal(page.requests.length, 2);
  assert.equal(page.input.value, "휴학은 가상 신청 언제까지?");
  assert.deepEqual([page.input.selectionStart, page.input.selectionEnd], [9, 9]);
  assert.equal(page.pad.hidden, true);
  assert.equal(page.state.focused, page.input);
  assert.equal(page.send.disabled, false, "the input event re-enables Send");
  assert.equal(page.state.submits, 0, "no automatic send");
  assert.deepEqual(page.requests.map(request => request.path), [handwritingPath, handwritingPath]);
  assert.equal(page.transcript.querySelectorAll(".turn").length, 0);
});

test("선택한 글자는 받은 글자로 바뀌고, 읽을 글씨가 없거나 연결이 끊기면 알맞은 문구를 띄운다", async () => {
  const page = loadPad();
  page.input.value = "가상 XX 질문";
  page.input.selectionStart = 3; page.input.selectionEnd = 5;
  page.button.click();
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("   "));
  page.insert.click();
  await settle();
  assert.equal(page.status.textContent, messages.unreadable);
  page.routes.push(() => Promise.reject(new TypeError("fictional network failure")));
  page.insert.click();
  await settle();
  assert.equal(page.status.textContent, messages.offline);
  page.respond(refused(422));
  page.insert.click();
  await settle();
  assert.equal(page.status.textContent, messages.unreadable);
  page.respond({ ok: true, status: 200, text: async () => "<fictional malformed body>", json: async () => { throw new SyntaxError("fictional malformed body"); } });
  page.insert.click();
  await settle();
  assert.equal(page.status.textContent, messages.failed, "a malformed body is not a network failure");
  // 본문을 받는 도중 연결이 끊기면 형식 오류가 아니라 연결 문구다.
  page.respond({ ok: true, status: 200, text: async () => { throw new TypeError("fictional body network failure"); } });
  page.insert.click();
  await settle();
  assert.equal(page.status.textContent, messages.offline, "a dropped body is a network failure");
  page.respond(ok("휴학"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "가상 휴학 질문");
});

test("패드를 연 사이 질문 칸을 고치고 커서를 옮겨도 열기 전에 고른 범위에 넣는다", async () => {
  const page = loadPad();
  page.input.value = "휴학은 언제까지?";
  // 「언제까지」를 고른 채 패드를 연다.
  page.input.selectionStart = 4; page.input.selectionEnd = 8;
  page.button.click();
  // Scribble이나 키보드로 뒤에 글을 더 쓰고 커서를 문장 끝에 둔다.
  page.input.value = "휴학은 언제까지? 알려 줘";
  page.input.selectionStart = page.input.selectionEnd = page.input.value.length;
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "휴학은 가상? 알려 줘");
});

test("고른 범위 앞쪽 글이 바뀌면 그만큼 밀린 같은 범위에 넣는다", async () => {
  const page = loadPad();
  page.input.value = "휴학은 언제까지?";
  page.input.selectionStart = 4; page.input.selectionEnd = 8;
  page.button.click();
  page.input.value = "가상 휴학은 언제까지?";
  page.input.selectionStart = page.input.selectionEnd = 0;
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("가상 날짜"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "가상 휴학은 가상 날짜?");
});

test("고른 글자의 양끝 바깥을 함께 고쳐도 같은 글자를 새 글에서 찾아 바꾼다", async () => {
  const page = loadPad();
  page.input.value = "A middle Z";
  page.input.selectionStart = 2; page.input.selectionEnd = 8;
  page.button.click();
  page.input.value = "B middle Y";
  page.input.selectionStart = page.input.selectionEnd = page.input.value.length;
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("fake"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "B fake Y");
});

test("고른 글자와 같은 말을 앞에 새로 써도 원래 범위 쪽(앞뒤 글자가 이어지는 곳)을 바꾼다", async () => {
  const page = loadPad();
  page.input.value = "A middle Z";
  page.input.selectionStart = 2; page.input.selectionEnd = 8;
  page.button.click();
  page.input.value = "A middle A middle Z";
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("fake"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "A middle A fake Z");
});

test("커서 앞 말과 같은 말을 맨 앞에 새로 붙여도 원래 커서 쪽(뒤 글자까지 이어지는 곳)에 넣는다", async () => {
  const page = loadPad();
  page.input.value = "A cat B";
  page.input.selectionStart = page.input.selectionEnd = 5;
  page.button.click();
  page.input.value = "A cat A cat B";
  page.input.selectionStart = page.input.selectionEnd = 0;
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("fake"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "A cat A catfake B");
});

test("앞뒤 글자로 가를 수 없게 같은 글을 통째로 맨 앞에 붙이면, 늘어난 만큼 밀린 원래 커서 자리에 넣는다", async () => {
  const page = loadPad();
  page.input.value = "A cat B";
  page.input.selectionStart = page.input.selectionEnd = 5;
  page.button.click();
  page.input.value = "A cat B A cat B";
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("fake"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "A cat B A catfake B");
});

test("패드를 연 사이 질문 칸에 쓴 위치를 따라가, 같은 글을 뒤에 붙이든 앞에 붙이든 원래 커서에 넣는다", async () => {
  // 문장 끝에 같은 글을 붙인다(커서는 끝). 원래 커서는 그대로 5번째 자리다.
  const tail = loadPad();
  tail.input.value = "A cat B";
  tail.input.selectionStart = tail.input.selectionEnd = 5;
  tail.button.click();
  tail.type("A cat B A cat B");
  tail.stroke([10, 10], [60, 60]);
  tail.respond(ok("fake"));
  tail.insert.click();
  await settle();
  assert.equal(tail.input.value, "A catfake B A cat B");

  // 맨 앞에 같은 글을 붙인다(커서는 붙인 글 뒤 8번째). 원래 커서는 8칸 밀린 13번째 자리다.
  const head = loadPad();
  head.input.value = "A cat B";
  head.input.selectionStart = head.input.selectionEnd = 5;
  head.button.click();
  head.type("A cat B A cat B", 8);
  head.stroke([10, 10], [60, 60]);
  head.respond(ok("fake"));
  head.insert.click();
  await settle();
  assert.equal(head.input.value, "A cat B A catfake B");
});

test("고른 범위 바로 앞이나 바로 뒤에 쓴 글은 범위 밖이라 지우지 않는다", async () => {
  // 「Y」를 고르고 바로 앞에 Z를 쓴다.
  const front = loadPad();
  front.input.value = "XXY";
  front.input.selectionStart = 2; front.input.selectionEnd = 3;
  front.button.click();
  front.type("XXZY", 3);
  front.stroke([10, 10], [60, 60]);
  front.respond(ok("fake"));
  front.insert.click();
  await settle();
  assert.equal(front.input.value, "XXZfake");

  // 「Y」를 고르고 바로 뒤에 Z를 쓴다.
  const back = loadPad();
  back.input.value = "XYW";
  back.input.selectionStart = 1; back.input.selectionEnd = 2;
  back.button.click();
  back.type("XYZW", 3);
  back.stroke([10, 10], [60, 60]);
  back.respond(ok("fake"));
  back.insert.click();
  await settle();
  assert.equal(back.input.value, "XfakeZW");
});

test("고른 글자를 지웠다가 실행 취소로 되살리면 원래 범위로 돌아온다", async () => {
  const page = loadPad();
  page.input.value = "XXY";
  page.input.selectionStart = 2; page.input.selectionEnd = 3;
  page.button.click();
  page.type("XX", 2, "deleteContentBackward");
  // 브라우저가 실행 취소(historyUndo)라고 알려 주면 지우기 전 범위로 돌아간다.
  page.type("XXY", 3, "historyUndo");
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("fake"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "XXfake");
});

test("이어 친 두 번의 삭제를 한 번에 되돌려도 지우기 전 범위로 돌아온다", async () => {
  const page = loadPad();
  page.input.value = "ABCD";
  // 「B」를 고른다.
  page.input.selectionStart = 1; page.input.selectionEnd = 2;
  page.button.click();
  // C 뒤에서 Backspace를 두 번 눌러 C와 B를 지운다.
  page.type("ABD", 2, "deleteContentBackward");
  page.type("AD", 1, "deleteContentBackward");
  // 브라우저가 두 삭제를 한 번에 되돌린다.
  page.type("ABCD", 3, "historyUndo");
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("fake"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "AfakeCD");
});

test("50번 넘게 이어 지운 뒤 한 번에 되돌려도 패드를 열 때 고른 범위로 돌아온다", async () => {
  const page = loadPad();
  const original = `A${"B".repeat(51)}D`;
  page.input.value = original;
  // 첫 B를 고른다.
  page.input.selectionStart = 1; page.input.selectionEnd = 2;
  page.button.click();
  // D 바로 앞에서 B를 51번 지운다(51번째에 고른 B도 지워진다).
  for (let left = 50; left >= 0; left--) page.type(`A${"B".repeat(left)}D`, 1 + left, "deleteContentBackward");
  page.type(original, 52, "historyUndo");
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("fake"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, `Afake${"B".repeat(50)}D`);
});

test("끝에 글을 붙인 뒤 50번 넘게 이어 지우고 한 번에 되돌려도, 붙인 뒤의 범위로 돌아온다", async () => {
  const page = loadPad();
  const original = `A${"B".repeat(51)}D`;
  page.input.value = original;
  page.input.selectionStart = 1; page.input.selectionEnd = 2;
  page.button.click();
  page.type(`${original}Z`, original.length + 1, "insertText");
  // D 앞에서 B를 51번 이어 지운다. 같은 종류의 편집이라 기록은 한 묶음만 늘어난다.
  for (let left = 50; left >= 0; left--) page.type(`A${"B".repeat(left)}DZ`, 1 + left, "deleteContentBackward");
  page.type(`${original}Z`, 52, "historyUndo");
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("fake"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, `Afake${"B".repeat(50)}DZ`);
});

test("획을 긋는 도중 패드가 스크롤로 움직여도 지금 캔버스 위치로 점을 잰다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { x: 10, y: 10 });
  // 휠로 패드가 화면 위로 60px 움직였고, 펜도 화면에서 10px 내려갔다(화면 y 410 → 420). 지금 캔버스 기준으로는 (10, 80)이다.
  // 펜이 화면에서 움직이지 않은 신호는 압력만 바뀐 것으로 보므로(다음 테스트들), 여기서는 실제로 움직인 신호를 쓴다.
  Object.assign(page.canvasRect, { top: 340, bottom: 540 });
  page.pointer("pointermove", { x: 10, y: 80 });
  page.pointer("pointerup", { x: 10, y: 80 });
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  // 가로 굵기 3 + 여백 32 = 35, 세로 70 + 3 + 32 = 105, 배율 2.
  assert.deepEqual([page.exports[0].canvas.width, page.exports[0].canvas.height], [70, 210]);
});

test("커서를 옮겨 따로 지운 두 삭제는 다른 묶음이라, 마지막 삭제만 되돌리면 그 직전 범위로 돌아온다", async () => {
  const page = loadPad();
  page.input.value = "ABCD";
  // 「B」를 고른다.
  page.input.selectionStart = 1; page.input.selectionEnd = 2;
  page.button.click();
  // 커서를 끝으로 옮겨 D를 지운다.
  page.type("ABC", 3, "deleteContentBackward");
  // 커서를 B 뒤로 옮겨 B를 지운다. 직전 삭제가 끝난 자리(3)가 아니므로 새 묶음이다.
  page.type("AC", 1, "deleteContentBackward");
  // 마지막 삭제만 되돌린다.
  page.type("ABC", 2, "historyUndo");
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("fake"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "AfakeC");
});

test("뒤로 지우기는 직전 삭제가 끝난 커서에서 이어 지울 때만 묶어, 오른쪽으로 옮겨 지운 삭제는 따로 되돌린다", async () => {
  const page = loadPad();
  page.input.value = "ABCD";
  // 「D」를 고른다.
  page.input.selectionStart = 3; page.input.selectionEnd = 4;
  page.button.click();
  // C 뒤에서 C를 지운다(커서 2).
  page.type("ABD", 2, "deleteContentBackward");
  // 오른쪽으로 한 칸 옮겨 D를 지운다. 이번 삭제는 직전 커서(2)에서 끝나지 않으므로 새 묶음이다.
  page.type("AB", 2, "deleteContentBackward");
  // 두 번째 삭제만 되돌린다.
  page.type("ABD", 3, "historyUndo");
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("fake"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "ABfake");
});

test("Delete로 지운 뒤 다시 골라 지운 두 삭제 중 두 번째만 되돌리면 그 직전 범위로 돌아온다", async () => {
  const page = loadPad();
  page.input.value = "ABCDE";
  // 「E」를 고른다.
  page.input.selectionStart = 4; page.input.selectionEnd = 5;
  page.button.click();
  // D 앞에서 Delete로 D를 지운다(커서 3).
  page.type("ABCE", 3, "deleteContentForward");
  // E를 다시 골라 지운다.
  page.type("ABC", 3, "deleteContentBackward");
  // 두 번째 삭제만 되돌린다.
  page.type("ABCE", 4, "historyUndo");
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("fake"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "ABCfake");
});

test("패드를 열기 전 글로 실행 취소했다가 다시 실행해도 열 때 고른 범위로 돌아온다", async () => {
  const page = loadPad();
  // ABC에 DE를 붙인 뒤(패드를 열기 전) E를 고른다.
  page.input.value = "ABCDE";
  page.input.selectionStart = 4; page.input.selectionEnd = 5;
  page.button.click();
  // 실행 취소로 패드가 본 적 없는 ABC로 돌아갔다가, 다시 실행으로 ABCDE가 된다.
  page.type("ABC", 3, "historyUndo");
  page.type("ABCDE", 5, "historyRedo");
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("fake"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "ABCDfake");
});

test("높이만 줄인 칸에 쓴 점은 크기를 되돌려도 같은 자리에 같은 크기로 보이고 그대로 보낸다", async () => {
  const page = loadPad();
  Object.assign(page.canvasRect, { height: 240, bottom: 640 });
  page.button.click();
  Object.assign(page.canvasRect, { height: 160, bottom: 560 });
  page.resize();
  page.pointer("pointerdown", { x: 550, y: 50 });
  page.pointer("pointerup", { x: 550, y: 50 });
  Object.assign(page.canvasRect, { height: 240, bottom: 640 });
  page.resize();
  page.resize();
  // 배율을 곱하지 않는다. 기기 화소 비율 2만 반영하고, 점은 x=550 그대로다.
  assert.deepEqual(page.canvas.log.filter(call => call[0] === "setTransform").at(-1).slice(1), [2, 0, 0, 2, 0, 0]);
  assert.deepEqual(page.canvas.log.filter(call => call[0] === "arc").at(-1).slice(1, 3), [550, 50]);
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  assert.equal(page.requests.length, 1, "the dot is still inside the visible area");
  assert.notEqual(page.status.textContent, messages.unreadable);
});

test("600px 칸의 x=110 점은 400px로 줄여도 x=110에 그대로 있다", () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { x: 110, y: 50 });
  page.pointer("pointerup", { x: 110, y: 50 });
  Object.assign(page.canvasRect, { width: 400, right: 500 });
  const before = page.canvas.log.length;
  page.resize();
  const redrawn = page.canvas.log.slice(before);
  assert.deepEqual(redrawn.filter(call => call[0] === "setTransform").at(-1).slice(1), [2, 0, 0, 2, 0, 0]);
  // 예전에는 2/3 배율로 x≈73.3에 밀려 보였다.
  assert.deepEqual(redrawn.filter(call => call[0] === "arc").at(-1).slice(1, 3), [110, 50]);
});

test("포인터를 떼기 전에 칸을 넓혀도 그리던 획의 잘린 잉크는 되살아나지 않는다", async () => {
  const page = loadPad();
  page.button.click();
  // 폭 600px에서 (590,100)부터 오른쪽 바깥 (700,100)까지 긋고, 떼기 전에 750px로 넓힌다.
  page.pointer("pointerdown", { x: 590, y: 100 });
  page.pointer("pointermove", { x: 700, y: 100 });
  Object.assign(page.canvasRect, { width: 750, right: 850 });
  page.resize();
  page.pointer("pointerup", { x: 700, y: 100 });
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  // 이미 저장한 점은 그을 때의 600px 칸으로 잘린다: 588.5~600 = 11.5 + 32 = 43.5, 배율 2 → 87(결함에서는 93).
  assert.equal(page.exports[0].canvas.width, 87);
  assert.ok(page.exports[0].canvas.log.some(call => call.join() === "rect,0,0,600,200"));
});

test("넓힌 뒤 이어 그은 부분은 새 칸에서 보이고, 잇는 선분은 두 칸이 겹치는 곳만 그린다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { x: 500, y: 100 });
  page.pointer("pointermove", { x: 550, y: 100 });
  Object.assign(page.canvasRect, { width: 750, right: 850 });
  page.resize();
  page.pointer("pointermove", { x: 700, y: 100 });
  page.pointer("pointerup", { x: 700, y: 100 });
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  // 넓힌 뒤 그은 550→700 선분은 끝 점의 칸(750)으로 그려 끊기지 않는다. 498.5~701.5 = 203 + 32 = 235, 배율 2 → 470.
  const { log, width } = page.exports[0].canvas;
  assert.equal(width, 470);
  const lines = log.filter(call => call[0] === "lineTo").map(call => call[1]);
  assert.deepEqual(lines, [550, 700]);
  assert.ok(log.some(call => call.join() === "rect,0,0,750,200"), "the part drawn after widening uses the new area");
});

test("줄인 칸 밖에서 그린 굵기가 칸에 닿지 않으면 흰 그림을 보내지 않는다", async () => {
  // 압력 0.1→1로 x=402에 세로로 긋는다. 실제 선 반지름은 평균 굵기 3.4의 절반 1.7이라 400px 칸에 닿지 않는다.
  const line = loadPad();
  line.button.click();
  line.pointer("pointerdown", { id: 7, kind: "pen", x: 402, y: 20, pressure: 0.1 });
  line.pointer("pointermove", { id: 7, kind: "pen", x: 402, y: 100, pressure: 1 });
  line.pointer("pointerup", { id: 7, kind: "pen", x: 402, y: 100 });
  Object.assign(line.canvasRect, { width: 400, right: 500 });
  line.resize();
  line.insert.click();
  await settle();
  assert.equal(line.requests.length, 0, "no blank image");
  assert.equal(line.status.textContent, messages.unreadable);

  // 압력 1의 점(반지름 2.6)을 (402,162)에 찍고 400×160으로 줄이면 모서리까지 거리 2.83이라 보이지 않는다.
  const dot = loadPad();
  dot.button.click();
  dot.pointer("pointerdown", { id: 8, kind: "pen", x: 402, y: 162, pressure: 1 });
  dot.pointer("pointerup", { id: 8, kind: "pen", x: 402, y: 162 });
  Object.assign(dot.canvasRect, { width: 400, right: 500, height: 160, bottom: dot.canvasRect.top + 160 });
  dot.resize();
  dot.insert.click();
  await settle();
  assert.equal(dot.requests.length, 0, "a dot that misses the corner is not sent");
  assert.equal(dot.status.textContent, messages.unreadable);
});

test("세게 누르다 약하게 경계 밖으로 이어 간 선도 칸 안에 보이는 굵기는 남긴다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 9, kind: "pen", x: 590, y: 30, pressure: 1 });
  page.pointer("pointermove", { id: 9, kind: "pen", x: 601, y: 30, pressure: 1 });
  // 새 점 반지름은 0.8이지만 그리는 선 반지름은 (5.2 + 1.6) / 4 = 1.7이라 599.3~600이 칸 안에 보인다.
  page.pointer("pointermove", { id: 9, kind: "pen", x: 601, y: 130, pressure: 0.1 });
  page.pointer("pointerup", { id: 9, kind: "pen", x: 601, y: 130 });
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  const { log, width, height } = page.exports[0].canvas;
  assert.ok(log.some(call => call[0] === "lineTo" && call[1] === 601 && call[2] === 130), "the downward segment is kept");
  // 가로 587.4~600 = 12.6 + 32 = 44.6 → 89, 세로 27.4~131.7 = 104.3 + 32 = 136.3 → 273(배율 2).
  assert.deepEqual([width, height], [89, 273]);
});

test("필기 칸은 테두리·둥근 모서리 없는 사각형 캔버스라 보이는 칸이 잰 사각형과 같다", () => {
  const block = selector => new RegExp(`(?:^|\\})\\s*${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`).exec(styles.replace(/\/\*[\s\S]*?\*\//g, ""))?.[1] ?? "";
  const canvas = block(".handwriting-canvas"), well = block(".handwriting-well");
  // 캔버스에 둥근 모서리가 있으면 브라우저가 모서리 잉크를 가리고, 테두리가 있으면 잰 사각형보다 그리는 칸이 1px씩 작다.
  assert.match(canvas, /border:\s*0;/);
  assert.match(canvas, /border-radius:\s*0;/);
  assert.match(well, /border-radius:\s*10px;/);
  // 판 안쪽 곡선(반지름 10 − 테두리 1 = 9px)이 캔버스 모서리에 닿지 않을 만큼 안쪽 여백을 둔다.
  const padding = Number(/padding:\s*([\d.]+)px;/.exec(well)?.[1]);
  assert.ok(padding >= 9 * (1 - Math.SQRT1_2), String(padding));
  assert.match(html, /<div class="handwriting-well"><canvas class="handwriting-canvas" id="handwriting-canvas"/);
});

test("400×160 칸의 오른쪽 아래 끝 점은 화면에 보이므로 그대로 보낸다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 10, kind: "pen", x: 399.5, y: 159.5, pressure: 0.1 });
  page.pointer("pointerup", { id: 10, kind: "pen", x: 399.5, y: 159.5 });
  Object.assign(page.canvasRect, { width: 400, right: 500, height: 160, bottom: page.canvasRect.top + 160 });
  const before = page.canvas.log.length;
  page.resize();
  // 캔버스가 사각형이라 이 점(반지름 0.8)은 칸 모서리 안에 그대로 그려진다.
  assert.ok(page.canvas.log.slice(before).some(call => call[0] === "arc" && call[1] === 399.5 && call[2] === 159.5));
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  assert.equal(page.requests.length, 1);
  // 가로·세로 399.5 − 0.8 ~ 칸 끝 = 1.3 + 32 = 33.3, 배율 2 → 67.
  assert.deepEqual([page.exports[0].canvas.width, page.exports[0].canvas.height], [67, 67]);
});

test("경계 밖으로 나갔다 약하게 돌아오는 선은 자르기 전 선분 굵기 그대로 그려 칸 안 잉크를 남긴다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 11, kind: "pen", x: 590, y: 30, pressure: 1 });
  page.pointer("pointermove", { id: 11, kind: "pen", x: 603, y: 30, pressure: 1 });
  // (603,30)→(600.9,130) 선분은 굵기 (5.2 + 1.6) / 2 = 3.4px다. 칸 경계에서 잘라도 조각은 3.4px로 그려 599.2~600이 보인다.
  page.pointer("pointermove", { id: 11, kind: "pen", x: 600.9, y: 130, pressure: 0.1 });
  page.pointer("pointerup", { id: 11, kind: "pen", x: 600.9, y: 130 });
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  const { log, width, height } = page.exports[0].canvas;
  const last = log.findLastIndex(call => call[0] === "lineTo");
  assert.deepEqual(log[last].slice(1), [600.9, 130]);
  const widthSet = log.slice(0, last).findLast(call => call[0] === "set" && call[1] === "lineWidth");
  assert.ok(Math.abs(widthSet[2] - 3.4) < 1e-9, String(widthSet[2]));
  // 가로 587.4~600 = 12.6 + 32 = 44.6 → 89, 세로 27.4~131.7 = 104.3 + 32 = 136.3 → 273(배율 2).
  assert.deepEqual([width, height], [89, 273]);
});

test("칸 밖까지 그은 뒤 떼지 않고 칸을 넓혀 안으로 돌아와도 옛 칸 밖 자리에서 시작하는 선은 생기지 않는다", async () => {
  const page = loadPad();
  page.button.click();
  // 폭 600px에서 (590,30)부터 경계 밖 (700,30)까지 긋고, 떼지 않은 채 750px로 넓힌 뒤 (590,130)으로 옮긴다.
  page.pointer("pointerdown", { id: 13, kind: "pen", x: 590, y: 30, pressure: 0.5 });
  page.pointer("pointermove", { id: 13, kind: "pen", x: 700, y: 30, pressure: 0.5 });
  Object.assign(page.canvasRect, { width: 750, right: 850 });
  page.resize();
  const before = page.canvas.log.length;
  page.pointer("pointermove", { id: 13, kind: "pen", x: 590, y: 130, pressure: 0.5 });
  page.pointer("pointerup", { id: 13, kind: "pen", x: 590, y: 130 });
  // (700,30)→(590,130) 선분은 옛 600 칸과 새 750 칸이 겹치는 600 칸 안에서만 그린다. (700,30)에서 출발하는 선은 없고,
  // 옛 경계(x 601.6)에서 시작해 (590,130)으로 돌아온 부분과 끝 점은 남는다.
  checkBridge(page, before);
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  checkBridge(page, 0, page.exports[0].canvas.log);
  // 압력 0.5의 굵기 3.2: 가로 588.4~600 = 11.6 + 32 = 43.6 → 87, 세로 28.4~131.6 = 103.2 + 32 = 135.2 → 270(배율 2).
  assert.deepEqual([page.exports[0].canvas.width, page.exports[0].canvas.height], [87, 270]);
});

test("두 폭 모두에서 바깥인 (800,30)에서 칸을 넓힌 뒤 돌아와도 새로 드러난 영역에는 선이 생기지 않는다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 17, kind: "pen", x: 590, y: 30, pressure: 0.5 });
  page.pointer("pointermove", { id: 17, kind: "pen", x: 800, y: 30, pressure: 0.5 });
  Object.assign(page.canvasRect, { width: 750, right: 850 });
  page.resize();
  const before = page.canvas.log.length;
  page.pointer("pointermove", { id: 17, kind: "pen", x: 590, y: 130, pressure: 0.5 });
  page.pointer("pointerup", { id: 17, kind: "pen", x: 590, y: 130 });
  checkBridge(page, before);
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  checkBridge(page, 0, page.exports[0].canvas.log);
  assert.deepEqual([page.exports[0].canvas.width, page.exports[0].canvas.height], [87, 270]);
});

test("위쪽에 쓴 뒤 넣기 버튼까지 패드를 스크롤해 그 획이 가려져도 그대로 보낸다", async () => {
  const page = loadPad();
  page.button.click();
  page.stroke([100, 20], [150, 20]);
  // 패드 안쪽을 스크롤해 캔버스가 100px 올라갔다. 캔버스 위 78px(y 0~78)는 패드 위쪽(322)에 가려진다.
  Object.assign(page.canvasRect, { top: 300, bottom: 500 });
  page.scroll();
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  assert.equal(page.requests.length, 1);
  assert.notEqual(page.status.textContent, messages.unreadable);
  // 쓸 때 보이던 획이 그대로 간다: 가로 98.5~151.5 = 53 + 32 = 85 → 170, 세로 18.5~21.5 = 3 + 32 = 35 → 70.
  assert.deepEqual([page.exports[0].canvas.width, page.exports[0].canvas.height], [170, 70]);
});

test("보이는 띠가 겹치지 않게 바뀐 뒤 그은 선분은 두 띠 사이 틈에 그리지 않는다", async () => {
  const page = loadPad();
  page.button.click();
  // 처음에는 캔버스 y 0~50만 보인다(패드 안쪽 아래 끝 450, 캔버스 위 400).
  Object.assign(page.padRect, { bottom: 450, height: 128 });
  page.scroll();
  page.pointer("pointerdown", { id: 18, kind: "pen", x: 100, y: 45, pressure: 1 });
  page.pointer("pointermove", { id: 18, kind: "pen", x: 100, y: 55, pressure: 1 });
  // 펜을 댄 채 스크롤해 보이는 띠가 y 52~100으로 바뀐다(캔버스 위 270, 패드 안쪽 322~370).
  Object.assign(page.padRect, { bottom: 370, height: 48 });
  Object.assign(page.canvasRect, { top: 270, bottom: 470 });
  page.scroll();
  const before = page.canvas.log.length;
  page.pointer("pointermove", { id: 18, kind: "pen", x: 100, y: 52.4, pressure: 1 });
  page.pointer("pointerup", { id: 18, kind: "pen", x: 100, y: 52.4 });
  const negative = log => log.some(call => call[0] === "rect" && (call[3] < 0 || call[4] < 0));
  // 좌표는 화면 좌표(270 + 52.4)에서 캔버스 위치(270)를 빼서 얻으므로 부동소수점 오차가 있다(52.39999…). 오차를 허용해 비교한다.
  const near = (value, expected) => Math.abs(value - expected) < 1e-6;
  const bridged = log => log.some(call => call[0] === "lineTo" && near(call[2], 52.4));
  // 새 띠 안의 끝 점 (100,52.4)은 압력 1의 점(반지름 2.6)으로 남는다.
  const tip = log => log.some(call => call[0] === "arc" && near(call[1], 100) && near(call[2], 52.4) && near(call[3], 2.6));
  const after = page.canvas.log.slice(before);
  assert.equal(bridged(after), false, "no ink in the gap on screen");
  assert.ok(tip(after), "the new point stays on screen");
  // 그 점은 새 띠(y 52~100)로 clip()한다.
  const clipBefore = after.slice(0, after.findIndex(call => call[0] === "arc")).findLast(call => call[0] === "rect");
  assert.deepEqual(clipBefore, ["rect", 0, 52, 600, 48]);
  assert.equal(negative(page.canvas.log), false);
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  const image = page.exports[0].canvas.log;
  assert.equal(bridged(image), false, "no ink in the gap in the image");
  assert.ok(tip(image), "the new point is in the image");
  assert.equal(negative(image), false);
});

test("마지막 이동 뒤 다른 자리에서 펜을 떼도 떼는 자리까지 그리고, 뗄 때 압력 0은 끝 굵기를 바꾸지 않는다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 22, kind: "pen", x: 20, y: 30, pressure: 1 });
  page.pointer("pointermove", { id: 22, kind: "pen", x: 40, y: 30, pressure: 1 });
  const before = page.canvas.log.length;
  // 떼기 신호만 (120,30)에서 온다. 펜은 뗄 때 압력을 0으로 보낸다.
  page.pointer("pointerup", { id: 22, kind: "pen", x: 120, y: 30, pressure: 0 });
  const lastLine = log => {
    const at = log.findLastIndex(call => call[0] === "lineTo");
    return { to: log[at]?.slice(1), width: log.slice(0, at).findLast(call => call[0] === "set" && call[1] === "lineWidth")?.[2] };
  };
  const screen = lastLine(page.canvas.log.slice(before));
  assert.deepEqual(screen.to, [120, 30], "the stroke reaches the release point on screen");
  // 압력 1의 굵기 5.2가 그대로다(압력 0을 쓰면 더 가늘어진다).
  assert.ok(Math.abs(screen.width - 5.2) < 1e-9, String(screen.width));
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  const image = lastLine(page.exports[0].canvas.log);
  assert.deepEqual(image.to, [120, 30], "the stroke reaches the release point in the image");
  // 가로 17.4~122.6 = 105.2 + 32 = 137.2 → 274, 세로 27.4~32.6 = 5.2 + 32 = 37.2 → 74(배율 2).
  assert.deepEqual([page.exports[0].canvas.width, page.exports[0].canvas.height], [274, 74]);
});

test("펜을 누른 채 패드가 스크롤된 뒤 같은 화면 자리에서 떼면 선을 더하지 않는다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 23, kind: "pen", x: 100, y: 30, pressure: 0.5 });
  page.pointer("pointermove", { id: 23, kind: "pen", x: 110, y: 30, pressure: 0.5 });
  // 펜은 화면 (210, 430)에 그대로 있고 캔버스만 20px 위로 스크롤됐다. 캔버스 기준으로는 (110,50)이다.
  Object.assign(page.canvasRect, { top: 380, bottom: 580 });
  page.scroll();
  const before = page.canvas.log.length;
  page.pointer("pointerup", { id: 23, kind: "pen", x: 110, y: 50, pressure: 0 });
  const fake = log => log.some(call => call[0] === "lineTo" && call[2] === 50);
  assert.equal(fake(page.canvas.log.slice(before)), false, "no fake line on screen");
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  const image = page.exports[0].canvas.log;
  assert.equal(fake(image), false, "no fake line in the image");
  assert.deepEqual(image.filter(call => call[0] === "lineTo").at(-1).slice(1), [110, 30]);
});

test("펜을 누른 채 패드가 스크롤된 뒤 같은 화면 자리에서 압력만 바꾸면 마지막 획 자리에서 굵기만 바뀐다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 24, kind: "pen", x: 100, y: 30, pressure: 0.5 });
  page.pointer("pointermove", { id: 24, kind: "pen", x: 110, y: 30, pressure: 0.5 });
  // 캔버스만 20px 위로 스크롤됐다. 펜은 화면 (210, 430)에 그대로 있고 압력만 0.5 → 0.7로 바뀐다.
  Object.assign(page.canvasRect, { top: 380, bottom: 580 });
  page.scroll();
  const before = page.canvas.log.length;
  page.pointer("pointermove", { id: 24, kind: "pen", x: 110, y: 50, pressure: 0.7 });
  page.pointer("pointerup", { id: 24, kind: "pen", x: 110, y: 50, pressure: 0 });
  const after = page.canvas.log.slice(before);
  const fake = log => log.some(call => call[0] === "lineTo" && call[2] === 50);
  assert.equal(fake(after), false, "no fake line on screen");
  // 마지막 획 자리 (110,30)에 압력 0.7 굵기(1.2 + 2.8 = 4.0, 반지름 2.0)로 점을 찍는다.
  assert.ok(after.some(call => call[0] === "arc" && call[1] === 110 && call[2] === 30 && Math.abs(call[3] - 2) < 1e-9), "thickness updated in place");
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  const image = page.exports[0].canvas.log;
  assert.equal(fake(image), false, "no fake line in the image");
  assert.deepEqual(image.filter(call => call[0] === "lineTo").at(-1).slice(1), [110, 30]);
});

test("칸 밖까지 그은 뒤 칸을 넓히고 같은 화면 자리에서 압력만 바꿔도 옛 칸 밖 자리에 점이 생기지 않는다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 25, kind: "pen", x: 590, y: 30, pressure: 0.5 });
  page.pointer("pointermove", { id: 25, kind: "pen", x: 700, y: 30, pressure: 0.5 });
  // 왼쪽 기준점은 그대로 두고 폭만 750px로 넓힌다. 펜은 화면 (800, 430)에 그대로 있고 압력만 0.5 → 0.7로 바뀐다.
  Object.assign(page.canvasRect, { width: 750, right: 850 });
  page.resize();
  const before = page.canvas.log.length;
  page.pointer("pointermove", { id: 25, kind: "pen", x: 700, y: 30, pressure: 0.7 });
  page.pointer("pointerup", { id: 25, kind: "pen", x: 700, y: 30, pressure: 0 });
  const at700 = log => log.some(call => (call[0] === "arc" || call[0] === "lineTo") && call[1] > 601.6 + 1e-9);
  // 마지막 포인터 자리 (700,30)은 그때 칸 밖이라 잉크가 없다. 압력 변화는 새 잉크를 만들지 않는다.
  assert.equal(page.canvas.log.slice(before).some(call => call[0] === "arc" || call[0] === "lineTo"), false, "nothing new on screen");
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  const image = page.exports[0].canvas.log;
  assert.equal(at700(image), false, "no ink past the old edge in the image");
  // 처음 그은 획 그대로다: 가로 588.4~600 = 11.6 + 32 = 43.6 → 87, 세로 28.4~31.6 = 3.2 + 32 = 35.2 → 70(배율 2).
  assert.deepEqual([page.exports[0].canvas.width, page.exports[0].canvas.height], [87, 70]);
});

test("칸 안 마지막 잉크에서 압력만 바꾸면 그 잉크를 기록할 때의 칸으로 굵기만 갱신한다", () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 26, kind: "pen", x: 590, y: 30, pressure: 0.5 });
  page.pointer("pointermove", { id: 26, kind: "pen", x: 598, y: 30, pressure: 0.5 });
  Object.assign(page.canvasRect, { width: 750, right: 850 });
  page.resize();
  const before = page.canvas.log.length;
  page.pointer("pointermove", { id: 26, kind: "pen", x: 598, y: 30, pressure: 1 });
  const after = page.canvas.log.slice(before);
  const dot = after.findIndex(call => call[0] === "arc" && call[1] === 598 && call[2] === 30 && Math.abs(call[3] - 2.6) < 1e-9);
  assert.ok(dot >= 0, "thicker dot at the last ink");
  // 그 잉크를 그은 600 칸으로 자른다(넓힌 750 칸이 아니다). 반지름 2.6이 경계 밖 600.6으로 넘지 않는다.
  assert.deepEqual(after.slice(0, dot).findLast(call => call[0] === "rect"), ["rect", 0, 0, 600, 200]);
});

test("오류 문구가 보이는 채 캔버스 위쪽을 찍어도 첫 점은 누른 자리에 찍히고, 문구는 펜을 뗀 뒤 지운다", async () => {
  const page = loadPad();
  page.button.click();
  page.stroke([100, 100], [160, 100]);
  page.respond(refused(503));
  page.insert.click();
  await settle();
  assert.equal(page.status.textContent, messages.unavailable);
  // 실제 화면처럼 오류 줄이 사라지면 패드 높이가 줄어 캔버스가 20px 아래로 내려가게 한다.
  let text = page.status.textContent;
  Object.defineProperty(page.status, "textContent", {
    get: () => text,
    set: value => {
      if (text && !value) Object.assign(page.canvasRect, { top: page.canvasRect.top + 20, bottom: page.canvasRect.bottom + 20 });
      text = value;
    },
  });
  const before = page.canvas.log.length;
  // 캔버스 위쪽 5px(화면 y 405)을 펜으로 찍는다.
  page.pointer("pointerdown", { id: 21, kind: "pen", x: 100, y: 5, pressure: 0.5 });
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const dotAt = (log, y) => log.some(call => call[0] === "arc" && near(call[1], 100) && near(call[2], y));
  assert.ok(dotAt(page.canvas.log.slice(before), 5), "the first point is where the pen touched");
  assert.equal(dotAt(page.canvas.log, -15), false);
  // 긋는 동안에는 오류 문구가 남아 캔버스가 움직이지 않고, 펜을 떼면 지운다.
  assert.equal(page.status.textContent, messages.unavailable);
  page.pointer("pointerup", { id: 21, kind: "pen", x: 100, y: 5 });
  assert.equal(page.status.textContent, "");
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  // 첫 그림(exports[0])은 503으로 실패한 앞선 시도의 것이다. 다시 넣어 만든 마지막 그림을 본다.
  assert.equal(page.exports.length, 2);
  assert.ok(dotAt(page.exports.at(-1).canvas.log, 5), "the first point is in the image");
});

// 새 칸의 첫 점이 지금 칸으로 clip()한 채 제 굵기로 찍혔는지 본다. 좌표는 부동소수점 오차를 허용한다.
function newAreaTip(log, x, y, radius, rect) {
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const at = log.findLastIndex(call => call[0] === "arc" && near(call[1], x) && near(call[2], y) && near(call[3], radius));
  if (at < 0) return false;
  return log.slice(0, at).findLast(call => call[0] === "rect").join() === ["rect", ...rect].join();
}

test("넓힌 직후 옛 폭 밖 새 칸에 약하게 옮긴 첫 점은 새 칸에서 보인다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 19, kind: "pen", x: 590, y: 30, pressure: 1 });
  page.pointer("pointermove", { id: 19, kind: "pen", x: 700, y: 30, pressure: 1 });
  Object.assign(page.canvasRect, { width: 750, right: 850 });
  page.resize();
  const before = page.canvas.log.length;
  // 압력 0.1로 (601.5,130)에 옮긴다. 잇는 선은 겹치는 600 칸에서 잘리지만, 이 점(반지름 0.8)은 새 750 칸에서 보여야 한다.
  page.pointer("pointermove", { id: 19, kind: "pen", x: 601.5, y: 130, pressure: 0.1 });
  page.pointer("pointerup", { id: 19, kind: "pen", x: 601.5, y: 130 });
  assert.ok(newAreaTip(page.canvas.log.slice(before), 601.5, 130, 0.8, [0, 0, 750, 200]), "on screen");
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  assert.ok(newAreaTip(page.exports[0].canvas.log, 601.5, 130, 0.8, [0, 0, 750, 200]), "in the image");
});

test("스크롤 직후 옛 끝 점과 같은 자리에 다시 놓아도 새 띠의 첫 점은 보인다", async () => {
  const page = loadPad();
  page.button.click();
  Object.assign(page.padRect, { bottom: 450, height: 128 });
  page.scroll();
  // y 0~50이 보일 때 (100,45)→(100,52.4). 끝 점은 띠 밖이라 잉크가 50에서 잘린다.
  page.pointer("pointerdown", { id: 20, kind: "pen", x: 100, y: 45, pressure: 1 });
  page.pointer("pointermove", { id: 20, kind: "pen", x: 100, y: 52.4, pressure: 1 });
  // 펜을 댄 채 y 52~100이 보이도록 스크롤하고 캔버스 기준 같은 자리 (100,52.4)에 다시 놓는다.
  Object.assign(page.padRect, { bottom: 370, height: 48 });
  Object.assign(page.canvasRect, { top: 270, bottom: 470 });
  page.scroll();
  const before = page.canvas.log.length;
  page.pointer("pointermove", { id: 20, kind: "pen", x: 100, y: 52.4, pressure: 1 });
  page.pointer("pointerup", { id: 20, kind: "pen", x: 100, y: 52.4 });
  assert.ok(newAreaTip(page.canvas.log.slice(before), 100, 52.4, 2.6, [0, 52, 600, 48]), "on screen");
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  assert.ok(newAreaTip(page.exports[0].canvas.log, 100, 52.4, 2.6, [0, 52, 600, 48]), "in the image");
});

// 크기가 바뀐 뒤 첫 선분: 옛 경계(x ≤ 601.6)에서 시작하고 600×200 칸으로 clip()한 채 (590,130)에서 끝난다.
function checkBridge(page, from, log = page.canvas.log) {
  const part = log.slice(from);
  const last = part.findLastIndex(call => call[0] === "lineTo");
  assert.deepEqual(part[last].slice(1), [590, 130]);
  const start = part.slice(0, last).findLast(call => call[0] === "moveTo");
  assert.ok(start[1] <= 601.6 + 1e-9, String(start));
  assert.deepEqual(part.slice(0, last).findLast(call => call[0] === "rect"), ["rect", 0, 0, 600, 200]);
}

test("패드 스크롤 상자가 가린 캔버스 아래쪽에는 잉크를 기록하지 않아, 스크롤해도 나타나지 않고 보내지도 않는다", async () => {
  const page = loadPad();
  page.button.click();
  // 패드 안쪽이 y 322~450까지만 보이고 캔버스(400~600)의 아래 150px는 스크롤 상자에 가려져 있다.
  Object.assign(page.padRect, { bottom: 450, height: 128 });
  page.scroll();
  // 보이는 띠(캔버스 y 0~50)에서 펜을 대고, 댄 채 가려진 아래쪽(캔버스 y 120)까지 끈다.
  page.pointer("pointerdown", { x: 100, y: 20 });
  page.pointer("pointermove", { x: 100, y: 120 });
  page.pointer("pointerup", { x: 100, y: 120 });
  const ys = log => log.filter(call => call[0] === "lineTo").map(call => call[2]);
  assert.ok(ys(page.canvas.log).every(y => y <= 51.5 + 1e-9), String(ys(page.canvas.log)));
  // 패드를 스크롤해 캔버스가 60px 올라와도(가려졌던 곳이 보여도) 새 잉크는 나타나지 않는다.
  Object.assign(page.canvasRect, { top: 340, bottom: 540 });
  const before = page.canvas.log.length;
  page.scroll();
  assert.ok(ys(page.canvas.log.slice(before)).every(y => y <= 51.5 + 1e-9));
  // 패드는 그대로 입력 줄 위다(입력 줄 자리가 바뀌지 않았다).
  assert.equal(page.pad.style.properties.get("--handwriting-top"), "auto");
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  assert.ok(ys(page.exports[0].canvas.log).every(y => y <= 51.5 + 1e-9));
});

test("칸 밖까지 그은 뒤 칸을 줄였다가 같은 폭으로 되돌리고 안으로 돌아오면 복귀 선분을 그대로 그린다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 14, kind: "pen", x: 590, y: 30, pressure: 0.5 });
  page.pointer("pointermove", { id: 14, kind: "pen", x: 700, y: 30, pressure: 0.5 });
  // 펜을 댄 채 600 → 400 → 600. 크기를 담은 객체는 바뀌어도 칸 크기는 처음과 같다.
  Object.assign(page.canvasRect, { width: 400, right: 500 });
  page.resize();
  Object.assign(page.canvasRect, { width: 600, right: 700 });
  page.resize();
  const before = page.canvas.log.length;
  page.pointer("pointermove", { id: 14, kind: "pen", x: 500, y: 130, pressure: 0.5 });
  page.pointer("pointerup", { id: 14, kind: "pen", x: 500, y: 130 });
  const hasReturn = log => log.some(call => call[0] === "lineTo" && call[1] === 500 && call[2] === 130);
  assert.ok(hasReturn(page.canvas.log.slice(before)), "the return segment is on screen");
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  assert.ok(hasReturn(page.exports[0].canvas.log), "the return segment is in the image");
  // 가로 498.4~600 = 101.6 + 32 = 133.6 → 267, 세로 28.4~131.6 = 103.2 + 32 = 135.2 → 270(배율 2).
  assert.deepEqual([page.exports[0].canvas.width, page.exports[0].canvas.height], [267, 270]);
});

test("왼쪽 경계 밖까지 그은 뒤 칸을 줄이고 돌아오면 칸 안에 들어온 복귀선은 그린다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 15, kind: "pen", x: 10, y: 30, pressure: 0.5 });
  page.pointer("pointermove", { id: 15, kind: "pen", x: -100, y: 30, pressure: 0.5 });
  // 펜을 댄 채 오른쪽 경계만 줄여 폭 400. (-100,30)은 두 폭 모두에서 칸 밖이다.
  Object.assign(page.canvasRect, { width: 400, right: 500 });
  page.resize();
  const before = page.canvas.log.length;
  page.pointer("pointermove", { id: 15, kind: "pen", x: 100, y: 130, pressure: 0.5 });
  page.pointer("pointerup", { id: 15, kind: "pen", x: 100, y: 130 });
  const hasReturn = log => log.some(call => call[0] === "lineTo" && call[1] === 100 && call[2] === 130);
  assert.ok(hasReturn(page.canvas.log.slice(before)), "the return segment is on screen");
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  assert.ok(hasReturn(page.exports[0].canvas.log), "the return segment is in the image");
  // 가로 0~101.6 = 101.6 + 32 = 133.6 → 267, 세로 28.4~131.6 = 103.2 + 32 = 135.2 → 270(배율 2).
  assert.deepEqual([page.exports[0].canvas.width, page.exports[0].canvas.height], [267, 270]);
});

test("위쪽이 좁은 화면에서 입력 줄 자리가 그대로면 질문 칸에 글자를 쳐도 패드는 줄 위에 남는다", () => {
  const page = loadPad({ innerWidth: 850, innerHeight: 360 });
  Object.assign(page.rowRect, { top: 100, bottom: 160 });
  page.button.click();
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "268px");
  page.type("가");
  page.type("가상");
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "268px");
  assert.equal(page.pad.style.properties.get("--handwriting-top"), "auto");
});

test("칸을 넓혀 다시 시작한 점 뒤로 이어 그으면 그 점부터 선이 이어진다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 16, kind: "pen", x: 590, y: 30, pressure: 0.5 });
  page.pointer("pointermove", { id: 16, kind: "pen", x: 700, y: 30, pressure: 0.5 });
  Object.assign(page.canvasRect, { width: 750, right: 850 });
  page.resize();
  page.pointer("pointermove", { id: 16, kind: "pen", x: 590, y: 130, pressure: 0.5 });
  page.pointer("pointermove", { id: 16, kind: "pen", x: 650, y: 130, pressure: 0.5 });
  page.pointer("pointerup", { id: 16, kind: "pen", x: 650, y: 130 });
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  const lines = page.exports[0].canvas.log.filter(call => call[0] === "lineTo").map(call => call.slice(1, 3));
  assert.deepEqual(lines.at(-1), [650, 130]);
  assert.ok(lines.every(([, y]) => y === 30 || y === 130), String(lines));
});

test("위쪽이 좁은 화면에서 패드 안쪽만 스크롤하면 패드는 입력 줄 위에 남는다", () => {
  const page = loadPad({ innerWidth: 850, innerHeight: 360 });
  Object.assign(page.rowRect, { top: 100, bottom: 160 });
  page.button.click();
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "268px");
  // 패드 안쪽 스크롤도 문서의 캡처 단계 scroll 신호로 온다. 입력 줄과 창 좌표는 그대로다.
  page.scroll();
  page.scroll();
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "268px");
  assert.equal(page.pad.style.properties.get("--handwriting-top"), "auto");
  // 문서가 스크롤돼 입력 줄이 실제로 움직이면 그때는 다시 놓는다. 위쪽 74px < 아래쪽 194px라 줄 아래(150 + 8)로 옮긴다.
  Object.assign(page.rowRect, { top: 90, bottom: 150 });
  page.scroll();
  assert.equal(page.pad.style.properties.get("--handwriting-top"), "158px");
});

test("패드를 열 때 들어오는 크기 감시 첫 알림만으로는 패드를 입력 줄 아래로 옮기지 않는다", () => {
  const page = loadPad({ innerWidth: 850, innerHeight: 360 });
  Object.assign(page.rowRect, { top: 100, bottom: 160 });
  page.button.click();
  // 위쪽이 84px로 좁아도 열 때는 입력 줄 위다: 아래 끝 = 360 − 100 + 8 = 268.
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "268px");
  // 스크롤·크기 변화 없이 첫 알림만 온다.
  page.observersNotified();
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "268px");
  assert.equal(page.pad.style.properties.get("--handwriting-top"), "auto");
});

test("경계 바로 안에 펜을 대고 떼기 전에 칸을 넓혀 그은 선은 새 칸에서 굵기 전체가 보이고 그대로 보낸다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 12, kind: "pen", x: 599.9, y: 30, pressure: 1 });
  Object.assign(page.canvasRect, { width: 750, right: 850 });
  page.resize();
  page.pointer("pointermove", { id: 12, kind: "pen", x: 599.9, y: 130, pressure: 1 });
  page.pointer("pointerup", { id: 12, kind: "pen", x: 599.9, y: 130 });
  // 넓힌 뒤 그은 선분은 750 칸으로 자른다(옛 600 칸으로 자르면 오른쪽 약 2.5px가 빠진다).
  const screen = page.canvas.log;
  const line = screen.findLastIndex(call => call[0] === "lineTo");
  const clipRect = screen.slice(0, line).findLast(call => call[0] === "rect");
  assert.deepEqual(clipRect, ["rect", 0, 0, 750, 200]);
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  // 가로 597.3~602.5 = 5.2 + 32 = 37.2 → 74, 세로 27.4~132.6 = 105.2 + 32 = 137.2 → 274(배율 2).
  assert.deepEqual([page.exports[0].canvas.width, page.exports[0].canvas.height], [74, 274]);
});

test("세게 눌러 시작한 펜 획의 첫 점은 보내는 그림과 테마를 바꿔 다시 그린 화면에도 남는다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 5, kind: "pen", x: 50, y: 50, pressure: 1 });
  page.pointer("pointermove", { id: 5, kind: "pen", x: 100, y: 50, pressure: 0.1 });
  page.pointer("pointerup", { id: 5, kind: "pen", x: 100, y: 50 });
  // 압력 1의 굵기는 1.2 + 4 = 5.2px, 반지름 2.6px다.
  const firstDot = log => log.some(call => call[0] === "arc" && call[1] === 50 && call[2] === 50 && Math.abs(call[3] - 2.6) < 1e-9);
  const before = page.canvas.log.length;
  page.state.ink = "rgb(232, 238, 246)";
  page.systemThemeChanged();
  assert.ok(firstDot(page.canvas.log.slice(before)), "redrawn screen keeps the first dot");
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  assert.ok(firstDot(page.exports[0].canvas.log), "the image keeps the first dot");
});

test("칸 밖으로 그어 잘린 부분은 실패 뒤 칸을 넓혀 다시 넣어도 되살아나지 않는다", async () => {
  const page = loadPad();
  page.button.click();
  // 폭 600px 칸에서 (590, 100)부터 오른쪽 경계 밖 (700, 100)까지 긋는다.
  page.stroke([590, 100], [700, 100]);
  page.respond(refused(503));
  page.insert.click();
  await settle();
  assert.equal(page.status.textContent, messages.unavailable);
  // 칸을 750px로 넓힌 뒤 다시 넣는다.
  Object.assign(page.canvasRect, { width: 750, right: 850 });
  const beforeResize = page.canvas.log.length;
  page.resize();
  // 넓힌 칸에 다시 그릴 때도 그 획은 그을 때의 칸(600×200)으로 clip()한다.
  const redrawn = page.canvas.log.slice(beforeResize);
  assert.ok(redrawn.some(call => call.join() === "rect,0,0,600,200"), "stroke clip on screen");
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  // 획은 그을 때 보이던 칸(600×200)으로 잘린다. 칸을 넓혀도 둥근 끝·굵기 절반까지 포함해 한 픽셀도 늘지 않는다.
  // 가로 588.5~600 = 11.5 + 32 = 43.5, 배율 2 → 처음과 같은 87px(예전 결함에서는 290px, 직전 수정에서는 93px).
  const [first, second] = page.exports;
  assert.equal(first.canvas.width, 87);
  assert.equal(second.canvas.width, 87, "the clipped part does not come back");
  // 보내는 그림도 화면도 그 획을 그을 때의 칸으로 clip()한 뒤 그린다.
  assert.ok(second.canvas.log.some(call => call.join() === "rect,0,0,600,200"), "stroke clip in the image");
  const xs = second.canvas.log.filter(call => call[0] === "lineTo").map(call => call[1]);
  assert.ok(xs.every(x => x <= 601.5 + 1e-9), String(xs));
});

test("획마다 그을 때의 칸으로 잘라, 경계에 걸친 굵기 절반이 칸을 넓혀도 배율이 줄지 않는다", async () => {
  const page = loadPad();
  page.button.click();
  // 오른쪽 경계 바로 안쪽(599)에 세로로 긋는다. 굵기 절반 1.5px가 경계 밖 600.5까지 걸친다.
  page.stroke([599, 20], [599, 180]);
  // 크기 신호가 와도 기준 칸은 600 그대로라 배율은 1이다(기기 화소 비율 2).
  page.resize();
  assert.deepEqual(page.canvas.log.filter(call => call[0] === "setTransform").at(-1).slice(1), [2, 0, 0, 2, 0, 0]);
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  // 가로 597.5~600 = 2.5 + 32 = 34.5 → 69, 세로 18.5~181.5 = 163 + 32 = 195 → 390.
  assert.deepEqual([page.exports[0].canvas.width, page.exports[0].canvas.height], [69, 390]);
});

test("창 크기 신호 없이 입력 줄과 필기 칸 폭만 바뀌어도 그리기 버퍼를 새 폭에 맞춘다", () => {
  const page = loadPad();
  page.button.click();
  assert.equal(page.canvas.width, 1200);
  // 600px에서 400px로 줄었다. 창 크기 이벤트는 오지 않고 입력 줄 크기 변화 신호만 온다.
  Object.assign(page.rowRect, { width: 400, right: 500 });
  Object.assign(page.canvasRect, { width: 400, right: 500 });
  page.rowResized();
  // 기기 화소 비율 2 × 400px.
  assert.equal(page.canvas.width, 800);
});

test("보통 편집으로 전에 본 글이 다시 나와도 실행 취소로 보지 않고 편집을 따라간다", async () => {
  const page = loadPad();
  page.input.value = "AA";
  // 첫 번째 A를 고른다.
  page.input.selectionStart = 0; page.input.selectionEnd = 1;
  page.button.click();
  // 맨 앞에 A를 붙이고(고른 A는 두 번째 자리로 밀린다) 맨 끝 A를 지운다. 글은 다시 "AA"지만 실행 취소가 아니다.
  page.type("AAA", 1, "insertText");
  page.type("AA", 2, "deleteContentBackward");
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("fake"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "Afake");
});

test("손가락으로 그리는 중 칸이 좁아진 뒤 포인터가 취소돼도 그 획을 버린다", () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 2, kind: "touch", x: 20, y: 20 });
  page.pointer("pointermove", { id: 2, kind: "touch", x: 80, y: 80 });
  // 그리는 도중 칸이 600px에서 400px로 좁아진다(회전·창 크기 변화).
  Object.assign(page.canvasRect, { width: 400, right: 500 });
  page.resize();
  page.pointer("pointercancel", { id: 2, kind: "touch", x: 80, y: 80 });
  assert.equal(page.insert.disabled, true, "the cancelled finger stroke is gone");
  page.stroke([100, 100], [160, 100], { id: 3, kind: "pen" });
  page.undo.click();
  assert.equal(page.insert.disabled, true);
  assert.equal(page.undo.disabled, true);
});

test("브라우저가 취소한 포인터의 획은 버려, 되돌리기 한 번에 펜 획만 지워진다", () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 2, kind: "touch", x: 20, y: 20 });
  page.pointer("pointermove", { id: 2, kind: "touch", x: 80, y: 80 });
  page.pointer("pointercancel", { id: 2, kind: "touch", x: 80, y: 80 });
  // 취소된 획만 있었으므로 넣기는 다시 잠긴다.
  assert.equal(page.insert.disabled, true);
  page.stroke([100, 100], [160, 100], { id: 3, kind: "pen" });
  page.undo.click();
  assert.equal(page.insert.disabled, true, "no cancelled finger stroke remains");
  assert.equal(page.undo.disabled, true);
});

test("400→600으로 넓힌 칸의 오른쪽 끝에 쓴 점은 400으로 좁히면 칸 밖이라 보내지 않고, 다시 넓히면 보낸다", async () => {
  const page = loadPad();
  Object.assign(page.canvasRect, { width: 400, right: 500 });
  page.button.click();
  Object.assign(page.canvasRect, { width: 600, right: 700 });
  page.resize();
  page.pointer("pointerdown", { x: 550, y: 100 });
  page.pointer("pointerup", { x: 550, y: 100 });
  Object.assign(page.canvasRect, { width: 400, right: 500 });
  page.resize();
  // 배율을 곱하지 않아 점은 x=550 그대로이고, 400px 칸 밖이라 보이지 않는다.
  assert.deepEqual(page.canvas.log.filter(call => call[0] === "setTransform").at(-1).slice(1), [2, 0, 0, 2, 0, 0]);
  page.insert.click();
  await settle();
  assert.equal(page.requests.length, 0, "ink outside the current area is not sent");
  assert.equal(page.status.textContent, messages.unreadable);
  // 다시 넓히면 그을 때 보이던 점이 돌아와 보낼 수 있다.
  Object.assign(page.canvasRect, { width: 600, right: 700 });
  page.resize();
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  assert.equal(page.requests.length, 1);
  assert.notEqual(page.status.textContent, messages.unreadable);
});

test("여러 번 나눠 고쳐도 고칠 때마다 고른 범위를 따라간다", async () => {
  const page = loadPad();
  page.input.value = "휴학 신청은 언제까지?";
  // 「신청」을 고른다.
  page.input.selectionStart = 3; page.input.selectionEnd = 5;
  page.button.click();
  page.type("가상 휴학 신청은 언제까지?", 3);
  page.type("가상 휴학 신청은 언제까지? 알려 줘");
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("복학"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "가상 휴학 복학은 언제까지? 알려 줘");
});

test("같은 대화에 질문을 보내면 패드를 닫아, 늦은 인식 글자가 비운 질문 칸에 들어가지 않는다", async () => {
  const page = loadPad();
  page.input.value = "가상 첫 질문";
  page.get("#composer").fire("submit");
  await settle();
  page.button.click();
  page.stroke([10, 10], [60, 60]);
  const held = page.hold();
  page.insert.click();
  await settle();
  page.input.value = "가상 두 번째 질문";
  page.get("#composer").fire("submit");
  assert.equal(page.pad.hidden, true);
  assert.equal(held.request.options.signal.aborted, true);
  assert.equal(page.input.value, "");
  held.resolve(ok("fake"));
  await settle();
  assert.equal(page.input.value, "");
});

test("넓은 화면에서 문서가 스크롤되면 패드를 입력 줄 바로 위로 다시 옮기고, 화면 밖으로 내보내지 않는다", () => {
  const page = loadPad();
  page.button.click();
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "158px");
  // 80px 아래로 스크롤하면 입력 줄이 위로 올라간다(800 - 570 + 8).
  Object.assign(page.rowRect, { top: 570, bottom: 630 });
  page.scroll();
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "238px");
  assert.equal(page.pad.style.properties.get("--handwriting-top"), "auto");
  // 연 뒤 학생이 스크롤해 입력 줄이 화면 위로 사라지면 위쪽 자리가 없으므로 줄 아래(화면 안 위쪽 8px)로 옮겨 접히지 않게 한다.
  // 스크롤 중에는 문서를 대신 굴리지 않는다.
  Object.assign(page.rowRect, { top: -200, bottom: -140 });
  page.scroll();
  assert.equal(page.pad.style.properties.get("--handwriting-top"), "8px");
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "auto");
  assert.equal(page.pad.style.properties.get("--handwriting-max-height"), "784px");
  assert.deepEqual(page.state.scrolls, []);
  // 다시 스크롤해 입력 줄 위에 자리가 나면 위로 돌아온다.
  Object.assign(page.rowRect, { top: 650, bottom: 710 });
  page.scroll();
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "158px");
  assert.equal(page.pad.style.properties.get("--handwriting-top"), "auto");
});

test("연 뒤 스크롤해 입력 줄 상단이 화면 위 15px에 오면 패드가 0px로 접히지 않고 줄 아래로 옮겨 간다", () => {
  const page = loadPad();
  page.button.click();
  assert.equal(page.pad.style.properties.get("--handwriting-top"), "auto");
  Object.assign(page.rowRect, { top: 15, bottom: 75 });
  page.scroll();
  assert.equal(page.pad.style.properties.get("--handwriting-top"), "83px");
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "auto");
  assert.equal(page.pad.style.properties.get("--handwriting-max-height"), "709px");
  // 줄 아래에 있는 동안 상태 줄이 바뀌어도 그 자리를 지킨다.
  page.stroke([10, 10], [60, 60]);
  page.respond(refused(503));
  page.insert.click();
  return settle().then(() => {
    assert.equal(page.pad.style.properties.get("--handwriting-top"), "83px");
  });
});

test("넓은 화면에서는 위쪽이 패드보다 낮아도 입력 줄 위에 열고, 위쪽 남은 높이 안에서 스크롤한다", () => {
  const page = loadPad();
  // 화면 높이 800px, 입력 줄 190~250px, 패드 320px. 위쪽은 174px만 남지만 줄 아래로 내리지 않는다.
  Object.assign(page.rowRect, { top: 190, bottom: 250 });
  page.button.click();
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "618px");
  assert.equal(page.pad.style.properties.get("--handwriting-top"), "auto");
  assert.equal(page.pad.style.properties.get("--handwriting-max-height"), "174px");
});

test("입력 줄 위쪽이 최소 높이보다 좁으면 열 때 문서를 위로 굴려 입력 줄 위에 자리를 만든다", () => {
  const page = loadPad();
  // 1280×800 화면을 300px 내려 입력 줄 상단이 15px다. 위쪽은 -1px이라 그대로 두면 최대 높이가 0이 된다.
  page.state.scrollY = 300;
  Object.assign(page.rowRect, { top: 15, bottom: 75 });
  page.button.click();
  // 160 - (15 - 16) = 161px만큼 위로 굴려 입력 줄 상단이 176px가 된다.
  assert.deepEqual(page.state.scrolls, [-161]);
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "632px");
  assert.equal(page.pad.style.properties.get("--handwriting-top"), "auto");
  assert.equal(page.pad.style.properties.get("--handwriting-max-height"), "160px");
});

test("넓은 화면에서는 문서 맨 위라 굴릴 수 없어도 줄 아래로 열지 않는다", () => {
  const page = loadPad();
  // 가상 좌표: 입력 줄 상단 15px, 문서 맨 위. 실제 화면에서는 머리글 때문에 생기지 않는 배치다.
  Object.assign(page.rowRect, { top: 15, bottom: 75 });
  page.button.click();
  assert.deepEqual(page.state.scrolls, []);
  assert.equal(page.pad.style.properties.get("--handwriting-top"), "auto");
  // 아래 끝은 화면 안(800 - 8)에 가두고, 위쪽이 없으니 입력 줄을 덮지 않도록 높이를 주지 않는다.
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "792px");
  assert.equal(page.pad.style.properties.get("--handwriting-max-height"), "0px");
});

test("위로 스크롤해 입력 줄이 화면 아래로 내려가도 패드는 화면 아래 끝에 머물러 버튼이 화면 밖으로 나가지 않는다", () => {
  const page = loadPad();
  page.button.click();
  // 화면 높이 800px, 패드 320px, 입력 줄 상단 1200px(화면 아래).
  Object.assign(page.rowRect, { top: 1200, bottom: 1260 });
  page.scroll();
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "8px");
  assert.equal(page.pad.style.properties.get("--handwriting-top"), "auto");
  // 화면 안 남은 높이(800 - 8 - 8)가 최대 높이라 패드 위 끝은 472px, 아래 끝은 792px다.
  assert.equal(page.pad.style.properties.get("--handwriting-max-height"), "784px");
});

test("입력 줄 위아래 어느 쪽에도 패드가 다 들어가지 않으면 와이어프레임대로 위에 두고, 커져도 그 높이 안에서 스크롤한다", async () => {
  const page = loadPad();
  // 입력 줄 250~310px. 위쪽 234px, 아래쪽 474px이 남고 패드는 480px다.
  Object.assign(page.rowRect, { top: 250, bottom: 310 });
  page.padRect.height = 480;
  page.button.click();
  // 아래 끝은 입력 줄 위 8px(800 - 250 + 8), 최대 높이는 위쪽 남은 234px다.
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "558px");
  assert.equal(page.pad.style.properties.get("--handwriting-top"), "auto");
  assert.equal(page.pad.style.properties.get("--handwriting-max-height"), "234px");
  page.stroke([10, 10], [60, 60]);
  page.padRect.height = 500;
  page.respond(refused(503));
  page.insert.click();
  await settle();
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "558px");
  assert.equal(page.pad.style.properties.get("--handwriting-max-height"), "234px");
});

test("질문 칸을 늘려 입력 줄 크기만 바뀌어도 패드를 다시 놓아 입력 줄을 덮지 않는다", () => {
  const page = loadPad();
  Object.assign(page.rowRect, { top: 250, bottom: 310 });
  page.button.click();
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "558px");
  // 질문 칸이 위로 늘어나 입력 줄 위 끝이 200px가 됐다. scroll·resize 신호 없이 크기 변화 신호만 온다.
  page.rowRect.top = 200;
  page.rowResized();
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "608px");
  assert.equal(page.pad.style.properties.get("--handwriting-max-height"), "184px");
});

test("패드를 연 채 사진을 붙여 입력 줄이 크기 변화 없이 위로 올라가도 패드를 다시 놓아 입력 줄을 덮지 않는다", () => {
  const page = loadPad();
  page.button.click();
  // 화면 높이 800 − 입력 줄 위 끝 650 + 8 = 158.
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "158px");
  // 첨부 제거 버튼이 나타나 입력 줄이 44px 올라간다. 입력 줄·캔버스 크기는 그대로라 크기 변화 신호는 오지 않는다.
  Object.assign(page.rowRect, { top: 606, bottom: 666 });
  page.get("#photo-file").files = [{ name: "fictional.png", type: "image/png", size: 8 }];
  page.get("#photo-file").fire("change");
  assert.equal(page.get("#photo-clear").hidden, false);
  // 800 − 606 + 8 = 202. 패드 아래 끝이 새 입력 줄 위 8px에 다시 붙는다.
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "202px");
});

test("다른 손가락으로 넣기를 누를 때 펜이 닿아 있어도 그 획을 끝내, 화면과 보내는 그림이 같다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 6, kind: "pen", x: 10, y: 10, pressure: 0.5 });
  page.pointer("pointermove", { id: 6, kind: "pen", x: 60, y: 10, pressure: 0.5 });
  const held = page.hold();
  page.insert.click();
  await settle();
  assert.ok(page.canvas.released.includes(6), "the pen stroke loses its capture");
  const drawn = page.canvas.log.filter(call => call[0] === "lineTo").length;
  // 응답을 기다리는 동안 펜을 더 움직여도 획이 이어지지 않는다.
  page.pointer("pointermove", { id: 6, kind: "pen", x: 200, y: 150, pressure: 0.5 });
  assert.equal(page.canvas.log.filter(call => call[0] === "lineTo").length, drawn);
  held.resolve(ok("가상"));
  await settle();
  assert.equal(page.exports[0].canvas.log.filter(call => call[0] === "lineTo").length, 1);
});

test("칸 크기가 600→400→600으로 오가도 획은 처음 크기로 돌아오고 왕복할수록 작아지지 않는다", async () => {
  const page = loadPad();
  page.button.click();
  page.stroke([10, 10], [110, 10]);
  for (let round = 0; round < 2; round++) {
    Object.assign(page.canvasRect, { width: 400, right: 500 });
    page.resize();
    // 좁아진 칸에서도 배율은 곱하지 않는다(기기 화소 비율 2만).
    assert.deepEqual(page.canvas.log.filter(call => call[0] === "setTransform").at(-1).slice(1), [2, 0, 0, 2, 0, 0]);
    Object.assign(page.canvasRect, { width: 600, right: 700 });
    page.resize();
    assert.deepEqual(page.canvas.log.filter(call => call[0] === "setTransform").at(-1).slice(1), [2, 0, 0, 2, 0, 0]);
  }
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  // 처음 크기 그대로의 획이다: 가로 100 + 굵기 3 + 여백 32 = 135, 배율 2.
  assert.deepEqual([page.exports[0].canvas.width, page.exports[0].canvas.height], [270, 70]);
});

test("좌표는 그대로 두고 압력만 바꾼 펜 신호도 보내는 그림에 점으로 남는다", async () => {
  const page = loadPad();
  page.button.click();
  page.pointer("pointerdown", { id: 4, kind: "pen", x: 100, y: 100, pressure: 0.3 });
  page.pointer("pointermove", { id: 4, kind: "pen", x: 100, y: 100, pressure: 0.8 });
  page.pointer("pointerup", { id: 4, kind: "pen", x: 100, y: 100 });
  assert.ok(page.canvas.log.filter(call => call[0] === "arc").length >= 2, "the screen shows the dot");
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  const exported = page.exports[0].canvas.log;
  assert.equal(exported.filter(call => call[0] === "lineTo").length, 0, "no zero-length line");
  // 굵기는 더 센 압력(0.8) 기준 1.2 + 3.2 = 4.4px, 반지름 2.2px다.
  const dot = exported.filter(call => call[0] === "arc").at(-1);
  assert.deepEqual(dot.slice(1, 3), [100, 100]);
  assert.ok(Math.abs(dot[3] - 2.2) < 1e-9, String(dot[3]));
  assert.ok(exported.some(call => call[0] === "fill"));
});

test("패드를 연 채 사진을 붙여 보내 새 대화로 바뀌면 패드를 닫아, 이전 대화의 획이 새 질문 칸에 들어가지 않는다", async () => {
  const page = loadPad();
  page.routes.length = 0;
  // 먼저 글 질문 하나로 채팅 화면과 대화를 만든다. 채팅 요청은 가짜 서버가 거절한다.
  page.input.value = "가상 첫 질문";
  page.get("#composer").fire("submit");
  await settle();
  page.button.click();
  page.stroke([10, 10], [60, 60]);
  assert.equal(page.pad.hidden, false);
  // 같은 채팅 화면에서 사진을 붙여 보내면 새 사진 대화가 된다.
  page.get("#photo-file").files = [new File([pngBytes], "가상.png", { type: "image/png" })];
  page.input.value = "가상 사진 질문";
  page.get("#composer").fire("submit");
  assert.equal(page.pad.hidden, true);
  await settle();
  page.button.click();
  assert.equal(page.insert.disabled, true, "the reopened pad starts empty");
  assert.equal(page.requests.filter(request => request.path === handwritingPath).length, 0);
});

test("커서만 두고 연 뒤 앞뒤를 고치면 커서 바로 앞 글자 묶음 뒤에 넣는다", async () => {
  const page = loadPad();
  page.input.value = "왼쪽 가운데 오른쪽";
  page.input.selectionStart = page.input.selectionEnd = 6;
  page.button.click();
  page.input.value = "새 왼쪽 가운데 오른쪽!";
  page.input.selectionStart = page.input.selectionEnd = 0;
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("X"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "새 왼쪽 가운데X 오른쪽!");
});

test("읽는 중 사이드바에서 새 대화를 열면 패드를 닫고, 늦은 응답은 새 대화의 질문 칸에 넣지 않는다", async () => {
  const page = loadPad();
  page.button.click();
  page.stroke([10, 10], [60, 60]);
  const held = page.hold();
  page.insert.click();
  await settle();
  page.get("#new-conversation").click();
  assert.equal(page.pad.hidden, true);
  assert.equal(held.request.options.signal.aborted, true);
  held.resolve(ok("이전 대화의 가상 글자"));
  await settle();
  assert.equal(page.input.value, "");
});

test("읽는 중 첫 화면의 새 대화를 누르면 패드를 닫고, 늦은 응답은 비운 질문 칸을 다시 채우지 않는다", async () => {
  const page = loadPad();
  page.input.value = "가상 질문";
  page.button.click();
  page.stroke([10, 10], [60, 60]);
  const held = page.hold();
  page.insert.click();
  await settle();
  page.get("#reset").click();
  assert.equal(page.pad.hidden, true);
  assert.equal(held.request.options.signal.aborted, true);
  assert.equal(page.input.value, "");
  held.resolve(ok("이전 대화의 가상 글자"));
  await settle();
  assert.equal(page.input.value, "");
});

test("기록을 모두 지우면 열린 패드와 획을 버려, 다시 넣어도 이전 획이 새 질문 칸에 가지 않는다", async () => {
  const page = loadPad();
  page.button.click();
  page.stroke([10, 10], [60, 60]);
  page.get("#clear-conversations").click();
  // 확인 창은 취소 버튼에 초점을 두고, 같은 줄의 첫 버튼이 삭제다.
  page.state.focused.parent.children[0].click();
  assert.equal(page.pad.hidden, true);
  page.button.click();
  assert.equal(page.insert.disabled, true, "the reopened pad starts empty");
  assert.equal(page.requests.length, 0);
});

test("패드를 연 채 테마가 바뀌면 이미 쓴 획을 새 글자색으로 바로 다시 그린다", () => {
  const page = loadPad();
  page.button.click();
  page.stroke([10, 10], [60, 60]);
  const before = page.canvas.log.length;
  page.state.ink = "rgb(232, 238, 246)";
  page.systemThemeChanged();
  const after = page.canvas.log.slice(before);
  assert.ok(after.some(call => call[0] === "clearRect"), "the canvas is cleared");
  assert.ok(after.some(call => call.join() === "set,strokeStyle,rgb(232, 238, 246)"), "existing ink uses the new color");
  assert.ok(after.some(call => call[0] === "lineTo"), "existing strokes are redrawn");
});

test("읽는 중 초점이 질문 칸으로 나가도 Esc는 패드를 닫고 요청을 끊어 늦은 응답을 넣지 않는다", async () => {
  const page = loadPad();
  page.input.value = "가상 질문";
  page.button.click();
  page.stroke([10, 10], [60, 60]);
  const held = page.hold();
  page.insert.click();
  await settle();
  // 질문 칸을 눌러 초점이 패드 밖으로 나간다.
  page.input.focus();
  const escape = page.documentKey("Escape");
  assert.equal(escape.defaultPrevented, true);
  assert.equal(page.pad.hidden, true);
  assert.equal(page.state.focused, page.button);
  assert.equal(held.request.options.signal.aborted, true);
  held.resolve(ok("늦은 가상 글자"));
  await settle();
  assert.equal(page.input.value, "가상 질문");
  // 패드가 닫힌 뒤의 Esc는 건드리지 않는다.
  assert.equal(page.documentKey("Escape").defaultPrevented, false);
});

test("읽는 중 로그아웃하면 패드를 닫고, 늦은 응답은 둘러보기 화면의 질문 칸에 들어가지 않는다", async () => {
  const page = loadPad();
  page.button.click();
  page.stroke([10, 10], [60, 60]);
  const held = page.hold();
  page.insert.click();
  await settle();
  page.get("#demo-logout").click();
  assert.equal(page.pad.hidden, true);
  assert.equal(held.request.options.signal.aborted, true);
  held.resolve(ok("이전 계정의 가상 글자"));
  await settle();
  page.get("#browse-main").click();
  await settle();
  assert.equal(page.input.value, "");
  assert.equal(page.requests.filter(request => request.path === handwritingPath).length, 1);
});

test("캔버스 밖으로 나갔다 돌아온 획은 보이는 칸 안만 잘라 보낸다", async () => {
  const page = loadPad();
  page.button.click();
  // 캔버스 폭은 600px다. 오른쪽으로 900px까지 나갔다가 안으로 돌아온다.
  page.pointer("pointerdown", { x: 500, y: 100 });
  page.pointer("pointermove", { x: 900, y: 100 });
  page.pointer("pointermove", { x: 520, y: 100 });
  page.pointer("pointerup", { x: 520, y: 100 });
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  const [{ canvas }] = page.exports;
  // 왼쪽 끝 498.5px부터 칸 끝 600px까지 101.5 + 여백 32 = 133.5, 배율 2.
  assert.equal(canvas.width, 267);
  const clip = canvas.log.findIndex(call => call[0] === "clip");
  assert.ok(clip > 0, "drawing is clipped to the visible area");
  assert.deepEqual(canvas.log.find(call => call[0] === "rect"), ["rect", 0, 0, 600, 200]);
  assert.ok(clip < canvas.log.findIndex(call => call[0] === "lineTo"), "clip comes before the ink");

  // 칸 오른쪽 끝(590,20)에서 바깥(900,180)으로 비스듬히 그으면 보이는 잉크는 중심선이 x 601.5(칸 600 + 굵기 절반)에 닿는 곳까지다.
  // 바깥 점(y 180)은 범위를 늘리지 않는다: 가로 11.5 + 32 = 43.5, 세로 약 8.94 + 32 = 40.94, 배율 2.
  const slant = loadPad();
  slant.button.click();
  slant.stroke([590, 20], [900, 180]);
  slant.respond(ok("가상"));
  slant.insert.click();
  await settle();
  assert.deepEqual([slant.exports[0].canvas.width, slant.exports[0].canvas.height], [87, 82]);

  // 중심선이 칸 바로 밖(x 600.5)이어도 칸 안에 보이는 세로 잉크는 범위에 남는다.
  // 가로 593.5~600 = 6.5 + 32 = 38.5, 세로 18.5~181.5 = 163 + 32 = 195, 배율 2.
  const edge = loadPad();
  edge.button.click();
  edge.pointer("pointerdown", { x: 595, y: 20 });
  edge.pointer("pointermove", { x: 600.5, y: 20 });
  edge.pointer("pointermove", { x: 600.5, y: 180 });
  edge.pointer("pointerup", { x: 600.5, y: 180 });
  edge.respond(ok("가상"));
  edge.insert.click();
  await settle();
  assert.deepEqual([edge.exports[0].canvas.width, edge.exports[0].canvas.height], [77, 390]);

  // 모든 잉크가 칸 밖이면 보내지 않고 읽을 글씨가 없다고 알린다.
  const outside = loadPad();
  outside.button.click();
  outside.pointer("pointerdown", { x: 50, y: 50 });
  outside.pointer("pointermove", { x: 900, y: 50 });
  outside.pointer("pointerup", { x: 900, y: 50 });
  outside.undo.click();
  outside.pointer("pointerdown", { x: 800, y: 300 });
  outside.pointer("pointermove", { x: 900, y: 400 });
  outside.pointer("pointerup", { x: 900, y: 400 });
  outside.insert.click();
  await settle();
  assert.equal(outside.requests.length, 0);
  assert.equal(outside.status.textContent, messages.unreadable);
});

test("Tab은 가로채지 않아, 펜 버튼에서는 질문 칸으로 가고 패드 마지막 버튼 뒤는 테크모로 나간다", () => {
  const page = loadPad();
  page.button.click();
  // 펜 버튼을 누르면 캔버스로 초점이 간다. 그 뒤는 문서 순서(캔버스 → 되돌리기 → 지우기 → 취소 → 넣기)다.
  assert.equal(page.state.focused, page.canvas);
  // 펜 버튼으로 돌아와 누른 Tab은 질문 칸·답변 모드·보내기를 건너뛰지 않는다.
  page.button.focus();
  assert.equal(page.button.fire("keydown", { key: "Tab" }).prevented, false);
  page.canvas.focus();
  assert.equal(page.pad.fire("keydown", { key: "Tab", shiftKey: true }).prevented, false);
  page.stroke([10, 10], [60, 60]);
  page.insert.focus();
  assert.equal(page.pad.fire("keydown", { key: "Tab" }).prevented, false);
  // 문서 순서상 패드 버튼 묶음은 테크모 바로 앞이다.
  assert.ok(html.indexOf('id="handwriting-insert"') < html.indexOf('id="pet"'));
  assert.doesNotMatch(script, /event\.key === "Tab"[^\n]*(?:canvas|handwriting)/);
});

test("시간 제한이 지나면 요청을 끊고 시간 초과를 알린 뒤 다시 넣을 수 있다", async () => {
  const page = loadPad();
  page.button.click();
  page.stroke([10, 10], [60, 60]);
  const held = page.hold();
  page.insert.click();
  await settle();
  const timer = page.timers.find(each => each.delay === 30_000 && !each.cleared);
  assert.ok(timer, "a 30 s limit is set");
  timer.callback();
  await settle();
  assert.equal(held.request.options.signal.aborted, true);
  assert.equal(page.status.textContent, messages.timeout);
  assert.equal(page.insert.disabled, false);
});

test("390×844 좁은 화면의 시트는 입력 줄 바로 위에 붙어 질문 칸과 입력 줄 버튼을 덮지 않는다", () => {
  // CSS: 좁은 화면 시트의 아래 끝과 최대 높이는 chat.js가 입력 줄에서 잰 값을 쓴다(화면 맨 아래 bottom: 0이 아니다).
  const narrow = /@media \(max-width: 680px\) \{\s*\.handwriting-pad \{([^}]*)\}/.exec(styles.replace(/\/\*[\s\S]*?\*\//g, ""))?.[1] ?? "";
  assert.match(narrow, /bottom:\s*var\(--handwriting-bottom, 0\);/);
  assert.match(narrow, /max-height:\s*var\(--handwriting-max-height,/);
  assert.match(narrow, /width:\s*100%;/);
  // 채팅 화면처럼 입력 줄이 화면 아래(y 700~760)에 있다.
  const page = loadPad({ innerWidth: 390, innerHeight: 844 });
  Object.assign(page.rowRect, { left: 12, right: 378, width: 366, top: 700, bottom: 760 });
  page.button.click();
  const props = page.pad.style.properties;
  assert.equal(props.get("--handwriting-top"), "auto");
  const bottom = parseFloat(props.get("--handwriting-bottom"));
  const maxHeight = parseFloat(props.get("--handwriting-max-height"));
  // 시트 아래 끝(화면 위에서 844 − bottom)이 입력 줄 위 끝보다 위이고, 위 끝도 화면 안이다.
  assert.ok(844 - bottom <= page.rowRect.top, `sheet bottom ${844 - bottom} vs row top ${page.rowRect.top}`);
  assert.ok(844 - bottom - maxHeight >= 0, "the sheet stays on screen");
  assert.equal(props.get("--handwriting-sheet-padding"), "14px");
  // 스크롤해 위쪽이 최소 높이(160px)보다 좁아지면(84px) 아래쪽(668px)에 붙인다. 시트 위 끝이 입력 줄 아래 끝보다 아래라 덮지 않는다.
  Object.assign(page.rowRect, { top: 100, bottom: 160 });
  page.scroll();
  assert.equal(props.get("--handwriting-bottom"), "auto");
  assert.equal(props.get("--handwriting-top"), "168px");
  assert.ok(parseFloat(props.get("--handwriting-top")) >= page.rowRect.bottom);
});

test("390×500 좁은 화면에서 입력 줄이 화면 위쪽에 있으면 문서를 굴려 줄 위에 자리를 만들어 시트가 접히지 않는다", () => {
  const page = loadPad({ innerWidth: 390, innerHeight: 500 });
  // 둘러보기에서 아래로 300px 굴려 입력 줄 위 끝이 화면 위 20px에 있다. 그대로 두면 위쪽 남은 높이는 4px다.
  page.state.scrollY = 300;
  Object.assign(page.rowRect, { left: 12, right: 378, width: 366, top: 20, bottom: 80 });
  page.button.click();
  // 모자란 156px만큼 위로 굴린다. 입력 줄 위 끝은 176px, 위쪽 남은 높이는 160px다.
  assert.deepEqual(page.state.scrolls, [-156]);
  const props = page.pad.style.properties;
  assert.equal(props.get("--handwriting-top"), "auto");
  assert.equal(props.get("--handwriting-bottom"), "332px");
  assert.equal(props.get("--handwriting-max-height"), "160px");
});

test("390×500 좁은 화면에서 굴릴 수 없으면 입력 줄 아래에, 아래도 모자라면 화면 아래 시트로 연다", () => {
  // 문서 맨 위라 굴릴 수 없고 입력 줄이 화면 위 20px에 있다. 아래쪽(404px)에 붙인다.
  const below = loadPad({ innerWidth: 390, innerHeight: 500 });
  Object.assign(below.rowRect, { left: 12, right: 378, width: 366, top: 20, bottom: 80 });
  below.button.click();
  const props = below.pad.style.properties;
  assert.deepEqual(below.state.scrolls, []);
  assert.equal(props.get("--handwriting-bottom"), "auto");
  assert.equal(props.get("--handwriting-top"), "88px");
  assert.equal(props.get("--handwriting-max-height"), "404px");

  // 입력 줄이 거의 화면을 채워 위(4px)·아래(84px) 모두 최소 높이보다 좁다. 화면 아래 시트로 열고 아래 안전 영역만큼 띄운다.
  const sheet = loadPad({ innerWidth: 390, innerHeight: 500 });
  Object.assign(sheet.rowRect, { left: 12, right: 378, width: 366, top: 20, bottom: 400 });
  sheet.button.click();
  const sheetProps = sheet.pad.style.properties;
  assert.equal(sheetProps.get("--handwriting-top"), "auto");
  assert.equal(sheetProps.get("--handwriting-bottom"), "0px");
  assert.equal(sheetProps.get("--handwriting-max-height"), "484px");
  assert.equal(sheetProps.has("--handwriting-sheet-padding"), false, "the safe-area fallback padding applies");
});

test("패드를 연 채 고른 글자와 겹치게 고치면 범위를 넓히지 않고 새로 쓴 글 뒤에 넣는다", async () => {
  const page = loadPad();
  page.input.value = "ABCD";
  // 「B」만 고른다.
  page.input.selectionStart = 1; page.input.selectionEnd = 2;
  page.button.click();
  // 질문 칸에서 「BC」를 「XY」로 바꾼다(커서는 XY 뒤).
  page.type("AXYD", 3, "insertText");
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("OCR"));
  page.insert.click();
  await settle();
  // 새로 쓴 XY는 지우지 않는다(예전에는 「AOCRD」).
  assert.equal(page.input.value, "AXYOCRD");
});

test("패드를 연 채 고른 범위 안쪽에 글을 끼워 넣으면 범위를 넓히지 않고 새로 쓴 글 뒤에 넣는다", async () => {
  const page = loadPad();
  page.input.value = "ABCD";
  // 「BC」를 고른다.
  page.input.selectionStart = 1; page.input.selectionEnd = 3;
  page.button.click();
  // 질문 칸의 B와 C 사이에 X를 쓴다(커서는 X 뒤).
  page.type("ABXCD", 3, "insertText");
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  // 새로 쓴 X를 지우지 않는다(예전에는 범위가 BXC로 늘어 「A가상D」).
  assert.equal(page.input.value, "ABX가상CD");
});

test("고른 글자를 다시 골라 같은 글자로 시작하는 글을 붙여넣어도 브라우저가 알려 준 범위로 새 글을 지키고 그 뒤에 넣는다", async () => {
  // 「B」를 고른 채 패드를 연 뒤 질문 칸에서 B를 다시 골라 「BXY」를 붙여넣는다. 글자 비교로는 「B 뒤에 XY 쓰기」와 같아 보인다.
  const paste = loadPad();
  paste.input.value = "ABCD";
  paste.input.selectionStart = 1; paste.input.selectionEnd = 2;
  paste.button.click();
  paste.typeOver("ABXYCD", 4, "insertFromPaste", [1, 2]);
  paste.stroke([10, 10], [60, 60]);
  paste.respond(ok("가상"));
  paste.insert.click();
  await settle();
  // 새로 붙인 B를 지우지 않는다(예전에는 「A가상XYCD」).
  assert.equal(paste.input.value, "ABXY가상CD");

  // 앞서 고친 두 사례도 브라우저가 범위를 알려 주는 길에서 같은 결과다.
  const replace = loadPad();
  replace.input.value = "ABCD";
  replace.input.selectionStart = 1; replace.input.selectionEnd = 2;
  replace.button.click();
  replace.typeOver("AXYD", 3, "insertText", [1, 3]);
  replace.stroke([10, 10], [60, 60]);
  replace.respond(ok("OCR"));
  replace.insert.click();
  await settle();
  assert.equal(replace.input.value, "AXYOCRD");

  const inside = loadPad();
  inside.input.value = "ABCD";
  inside.input.selectionStart = 1; inside.input.selectionEnd = 3;
  inside.button.click();
  inside.typeOver("ABXCD", 3, "insertText", [2, 2]);
  inside.stroke([10, 10], [60, 60]);
  inside.respond(ok("가상"));
  inside.insert.click();
  await settle();
  assert.equal(inside.input.value, "ABX가상CD");
});

test("고른 글자를 다시 골라 같은 글자를 붙여넣어 글이 그대로여도 새로 붙인 글자를 지우지 않는다", async () => {
  const page = loadPad();
  page.input.value = "ABCD";
  // 「B」를 고른 채 패드를 연다.
  page.input.selectionStart = 1; page.input.selectionEnd = 2;
  page.button.click();
  // 질문 칸에서 B를 다시 골라 같은 「B」를 붙여넣는다. 편집 전후 글은 「ABCD」로 같다.
  page.typeOver("ABCD", 2, "insertFromPaste", [1, 2]);
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  // 새로 붙인 B 뒤에 넣는다(예전에는 「A가상CD」).
  assert.equal(page.input.value, "AB가상CD");
});

test("브라우저 범위 신호 없이 같은 글로 input 신호만 오면 고른 범위를 그대로 둔다", async () => {
  const page = loadPad();
  page.input.value = "ABCD";
  page.input.selectionStart = 1; page.input.selectionEnd = 2;
  page.button.click();
  // 글도 그대로이고 바꿀 범위도 알려 주지 않은 신호는 편집이 아니다.
  page.type("ABCD", 4, "insertText");
  page.stroke([10, 10], [60, 60]);
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "A가상CD");
});

test("390×500에서 질문 칸을 늘리고 사진을 붙인 채 위·아래 모두 160px에 못 미치면 더 넓은 쪽에 두고 입력 줄을 덮지 않는다", () => {
  const page = loadPad({ innerWidth: 390, innerHeight: 500 });
  // 질문 칸을 100px까지 늘려 입력 줄 높이가 116px이다. 「첨부 제거」 버튼은 입력 줄 아래 8px에 44px 높이로 있다.
  Object.assign(page.rowRect, { left: 12, right: 378, width: 366, top: 300, bottom: 416, height: 116 });
  const clear = page.get("#photo-clear");
  clear.getBoundingClientRect = () => ({ left: 12, right: 112, width: 100, top: page.rowRect.bottom + 8, bottom: page.rowRect.bottom + 52, height: 44 });
  page.get("#photo-file").files = [{ name: "fictional.png", type: "image/png", size: 8 }];
  page.get("#photo-file").fire("change");
  page.button.click();
  // 스크롤해 입력 줄 위 끝이 170px에 온다. 위쪽 154px, 아래쪽(버튼 아래 338부터) 146px로 둘 다 160px에 못 미친다.
  Object.assign(page.rowRect, { top: 170, bottom: 286 });
  page.scroll();
  const props = page.pad.style.properties;
  // 더 넓은 위쪽에 둔다(예전에는 화면 아래 시트로 질문 칸과 첨부 제거 버튼을 덮었다).
  assert.equal(props.get("--handwriting-top"), "auto");
  assert.equal(props.get("--handwriting-bottom"), "338px");
  assert.equal(props.get("--handwriting-max-height"), "154px");
  assert.ok(500 - parseFloat(props.get("--handwriting-bottom")) <= page.rowRect.top, "the sheet ends above the input row");
});

test("390×500에서 사진을 붙인 채 줄 아래로 옮기면 입력 줄 아래 「첨부 제거」 버튼까지 비운다", () => {
  const page = loadPad({ innerWidth: 390, innerHeight: 500 });
  Object.assign(page.rowRect, { left: 12, right: 378, width: 366, top: 300, bottom: 360 });
  // 「첨부 제거」 버튼은 입력 줄 바로 아래(y 368~412)에 나타난다. 입력 줄이 움직이면 함께 움직인다.
  const clear = page.get("#photo-clear");
  clear.getBoundingClientRect = () => ({ left: 12, right: 112, width: 100, top: page.rowRect.bottom + 8, bottom: page.rowRect.bottom + 52, height: 44 });
  page.get("#photo-file").files = [{ name: "fictional.png", type: "image/png", size: 8 }];
  page.get("#photo-file").fire("change");
  assert.equal(clear.hidden, false);
  page.button.click();
  // 스크롤해 입력 줄 위 끝이 화면 위 100px에 온다. 위쪽 84px로는 모자라 줄 아래에 둔다.
  Object.assign(page.rowRect, { top: 100, bottom: 160 });
  page.scroll();
  const props = page.pad.style.properties;
  assert.equal(props.get("--handwriting-bottom"), "auto");
  // 시트 위 끝은 첨부 제거 버튼 아래 끝(212) + 8 = 220이다(예전에는 입력 줄 아래 168에 붙어 버튼을 덮었다).
  assert.equal(props.get("--handwriting-top"), "220px");
  assert.ok(parseFloat(props.get("--handwriting-top")) >= clear.getBoundingClientRect().bottom);
  assert.equal(props.get("--handwriting-max-height"), "272px");
});

test("상태 200을 받은 뒤 본문을 기다리다 시간 제한이 지나도 시간 초과를 알리고 획을 남겨 다시 넣을 수 있다", async () => {
  const page = loadPad();
  page.button.click();
  page.stroke([10, 10], [60, 60]);
  // 가상 서버가 상태 200을 먼저 보내고 본문은 보내지 않는다. 요청이 끊기면 브라우저처럼 본문 읽기가 거절된다.
  let request = null;
  page.routes.push(each => {
    request = each;
    return Promise.resolve({
      ok: true, status: 200,
      text: () => new Promise((_resolve, reject) => each.options.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
    });
  });
  page.insert.click();
  await settle();
  const timer = page.timers.find(each => each.delay === 30_000 && !each.cleared);
  assert.ok(timer, "a 30 s limit is set");
  timer.callback();
  await settle();
  assert.equal(request.options.signal.aborted, true);
  assert.equal(page.status.textContent, messages.timeout, "not the server-failure message");
  assert.equal(page.insert.disabled, false);
  // 획은 남아 있어 그대로 다시 넣을 수 있다.
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  assert.equal(page.input.value, "가상");
});

test("Esc와 취소는 패드를 닫아 펜 버튼으로 초점을 돌리고, 읽던 요청을 끊어 늦은 응답을 버린다", async () => {
  const page = loadPad();
  page.input.value = "가상 질문";
  page.button.click();
  page.stroke([10, 10], [60, 60]);
  const held = page.hold();
  page.insert.click();
  await settle();
  const escape = page.pad.fire("keydown", { key: "Escape" });
  assert.equal(escape.prevented, true);
  assert.equal(page.pad.hidden, true);
  assert.equal(page.button.getAttribute("aria-expanded"), "false");
  assert.equal(page.state.focused, page.button);
  assert.equal(held.request.options.signal.aborted, true);
  held.resolve(ok("늦은 가상 글자"));
  await settle();
  assert.equal(page.input.value, "가상 질문");
  assert.equal(page.status.textContent, "");

  // 다시 열면 빈 패드다. 취소 버튼도 같은 길로 닫는다.
  page.button.click();
  assert.equal(page.insert.disabled, true);
  page.cancel.click();
  assert.equal(page.pad.hidden, true);
  assert.equal(page.state.focused, page.button);
  assert.equal(page.requests.length, 1);
});

test("중국어 화면은 lang=zh로 보내고 상태 문구도 중국어로 띄운다", async () => {
  const page = loadPad({ language: "zh-CN" });
  page.button.click();
  page.stroke([10, 10], [60, 60]);
  page.respond(refused(503));
  page.insert.click();
  await settle();
  assert.equal(page.requests[0].options.body.get("lang"), "zh");
  assert.equal(page.status.textContent, "目前无法识别手写内容。请稍后再次点击「插入」。");
});

test("영어·중국어 사전에 패드 문구가 모두 있다", () => {
  const keys = ["손글씨로 입력", "필기 영역", "되돌리기", "지우기", "취소", "넣기", ...Object.values(messages),
    "펜이나 손가락으로 쓰고 넣기를 누르면 읽은 글자가 입력창 커서 자리에 들어가요. 바로 보내지는 않아요.",
    "서버가 글씨를 처리하지 못했어요. 다시 넣어 주세요."];
  const dictionary = script.slice(0, script.indexOf("let uiLang"));
  for (const key of keys) assert.equal(dictionary.split(`"${key}":`).length - 1, 2, key);
});
