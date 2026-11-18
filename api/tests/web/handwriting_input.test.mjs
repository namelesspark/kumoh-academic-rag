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

function loadPad({ language, pixelRatio = 2, blobSize = pngBytes.length } = {}) {
  const elements = new Map();
  const timers = [];
  const requests = [];
  const exports = [];
  const state = { focused: null, blobSize, submits: 0, ink: "rgb(10, 37, 64)" };
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
      innerWidth: 1280,
      innerHeight: 800,
      navigator: language ? { language } : undefined,
      // 저장소가 없으면 첫 방문 언어 감지가 한국어로 돌아간다. 언어를 줄 때만 빈 저장소를 둔다.
      localStorage: language ? { getItem: () => null, setItem() {}, removeItem() {} } : undefined,
      getComputedStyle: () => ({ color: state.ink }),
      addEventListener: (type, listener) => windowListeners.push({ type, listener }),
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
  // 질문 칸에 글을 쓴 것처럼 값과 커서를 바꾸고 input 신호를 보낸다(키보드·Scribble 모두 이 신호를 낸다).
  // inputType은 브라우저가 붙이는 입력 종류다(실행 취소는 historyUndo, 다시 실행은 historyRedo).
  page.type = (value, caretAt = value.length, inputType = "insertText") => {
    input.value = value;
    input.selectionStart = input.selectionEnd = caretAt;
    input.dispatchEvent({ type: "input", inputType });
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

const ok = text => ({ ok: true, status: 200, json: async () => ({ text }) });
const refused = status => ({ ok: false, status, json: async () => ({ detail: "fictional error" }) });
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
  page.respond({ ok: true, status: 200, json: async () => { throw new SyntaxError("fictional malformed body"); } });
  page.insert.click();
  await settle();
  assert.equal(page.status.textContent, messages.failed, "a malformed body is not a network failure");
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

test("400→600으로 넓힌 칸의 오른쪽 끝에 쓴 점은 다시 400으로 좁혀도 함께 줄어 보이고 그대로 보낸다", async () => {
  const page = loadPad();
  Object.assign(page.canvasRect, { width: 400, right: 500 });
  page.button.click();
  Object.assign(page.canvasRect, { width: 600, right: 700 });
  page.resize();
  page.pointer("pointerdown", { x: 550, y: 100 });
  page.pointer("pointerup", { x: 550, y: 100 });
  Object.assign(page.canvasRect, { width: 400, right: 500 });
  page.resize();
  // 기준 칸이 600px로 넓어졌으므로 400px 칸에는 2/3로 그린다.
  const transform = page.canvas.log.filter(call => call[0] === "setTransform").at(-1);
  assert.ok(Math.abs(transform[1] - 4 / 3) < 1e-9, String(transform));
  page.respond(ok("가상"));
  page.insert.click();
  await settle();
  assert.equal(page.requests.length, 1, "the dot is still inside the visible area");
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
  // 입력 줄이 화면 위로 사라지면 패드도 입력 줄 위에 머물러 화면 위쪽으로 물러난다(줄 아래로 내리지 않는다).
  Object.assign(page.rowRect, { top: -200, bottom: -140 });
  page.scroll();
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "792px");
  assert.equal(page.pad.style.properties.get("--handwriting-top"), "auto");
  assert.equal(page.pad.style.properties.get("--handwriting-max-height"), "0px");
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

test("입력 줄이 화면 위쪽에 붙어 있어도 줄 아래로 열지 않고, 커져도 입력 줄 위 남은 높이 안에 머문다", async () => {
  const page = loadPad();
  // 1280×800 화면, 입력 줄 100~160px. 위쪽은 84px뿐이지만 와이어프레임대로 입력 줄 위에 연다.
  Object.assign(page.rowRect, { top: 100, bottom: 160 });
  page.button.click();
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "708px");
  assert.equal(page.pad.style.properties.get("--handwriting-top"), "auto");
  assert.equal(page.pad.style.properties.get("--handwriting-max-height"), "84px");
  page.stroke([10, 10], [60, 60]);
  page.padRect.height = 333;
  page.respond(refused(503));
  page.insert.click();
  await settle();
  assert.equal(page.status.textContent, messages.unavailable);
  assert.equal(page.pad.style.properties.get("--handwriting-bottom"), "708px");
  assert.equal(page.pad.style.properties.get("--handwriting-max-height"), "84px");
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
    // 좁아진 칸에서는 2/3 배율로 그린다(기기 화소 비율 2 × 2/3).
    const shrunk = page.canvas.log.filter(call => call[0] === "setTransform").at(-1);
    assert.ok(Math.abs(shrunk[1] - 4 / 3) < 1e-9, String(shrunk));
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
