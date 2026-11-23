// 입력 줄 모핑 테스트(#137): 보내기↔정지 버튼, 답 멈추기, 답변 모드 선택 표시.
// chat.js에서 해당 묶음만 떼어 가짜 화면 요소·가짜 화면 갱신(requestAnimationFrame)·가짜 서버 응답으로 돌린다.
// 질문과 답은 모두 가상 문구이고 서버에는 요청하지 않는다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { runInNewContext } from "node:vm";

const read = path => readFileSync(new URL(`../../app/chat_web/${path}`, import.meta.url), "utf8");
const script = read("assets/chat.js");
const styles = read("assets/quick-actions.css");
const chatStyles = read("assets/chat.css");
const langBlock = script.slice(0, script.indexOf("function trimConversations("));
function between(from, until) {
  const start = script.indexOf(from);
  const end = script.indexOf(until, start);
  assert.ok(start >= 0 && end > start, from);
  return script.slice(start, end);
}
const morphBlock = between("// 보내기↔정지 모핑(#137)", "// 보내기↔정지 모핑 끝.");
const arrow = "M12 4 L19 11 L14 11 L14 20 L10 20 L10 11 L5 11 Z";
const square = "M12 7 L17 7 L17 12 L17 17 L7 17 L7 12 L7 7 Z";
const settle = async () => { for (let i = 0; i < 12; i++) await setImmediate(); };

class El {
  constructor(tag, state) {
    Object.assign(this, { tag, state, children: [], attributes: new Map(), listeners: new Map(), styles: new Map(), dataset: {},
      hidden: false, disabled: false, className: "", textContent: "", value: "", parent: null });
    this.style = { setProperty: (name, value) => this.styles.set(name, String(value)) };
  }
  get childNodes() { return this.children; }
  append(...nodes) {
    for (const node of nodes) {
      if (node.parent) node.parent.children = node.parent.children.filter(child => child !== node);
      node.parent = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, listener) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  fire(type, values = {}) {
    const event = { type, target: this, defaultPrevented: false, preventDefault() { event.defaultPrevented = true; }, stopPropagation() {}, ...values };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }
  focus() { this.state.focused = this; }
  click() { if (!this.disabled) this.fire("click"); }
  getBoundingClientRect() { return { left: 600, right: 720, top: 600, bottom: 644, width: 120, height: 44 }; }
  all() { return this.children.filter(child => child instanceof El).flatMap(child => [child, ...child.all()]); }
  get text() { return this.children.length ? this.children.map(child => child instanceof El ? child.text : child.nodeValue ?? "").join("") : this.textContent; }
}

// ── 보내기↔정지 모양 ─────────────────────────────────────────────────────────────
function morphPage({ reduced = false, frames = true } = {}) {
  const state = { focused: null, reduced };
  const queue = new Map(), cancelled = [], motion = [];
  let nextFrame = 0;
  const send = new El("button", state);
  send.append({ nodeType: 3, nodeValue: "보내기" });
  const input = new El("textarea", state);
  const context = {
    document: { createElementNS: (ns, tag) => Object.assign(new El(tag, state), { ns }) },
    window: frames ? {
      requestAnimationFrame: callback => { queue.set(++nextFrame, callback); return nextFrame; },
      cancelAnimationFrame: id => { cancelled.push(id); queue.delete(id); },
    } : {},
    send, input, requestedChatView: true, activeConversation: null,
    reducedMotion: () => state.reduced,
    motionPreference: () => ({ addEventListener: (type, listener) => motion.push(listener) }),
    element(tag, className, text) { const node = new El(tag, state); node.className = className || ""; if (text !== undefined) node.textContent = text; return node; },
  };
  runInNewContext(langBlock + morphBlock, context);
  const [svg, label, stopLabel] = send.children;
  return {
    state, send, input, context, svg, label, stopLabel, cancelled, queue, motion,
    path: () => svg.children[0].getAttribute("d"),
    run: code => runInNewContext(code, context),
    frame(now) { const pending = [...queue.values()]; queue.clear(); for (const callback of pending) callback(now); return pending.length; },
  };
}
const numbers = d => d.match(/-?\d+(?:\.\d+)?/g).map(Number);

test("보내기 버튼 안에 SVG 경로 하나를 두고, 문서의 「보내기」 글자 노드는 읽기 도구용으로 그대로 옮긴다", () => {
  const page = morphPage();
  assert.equal(page.svg.tag, "svg");
  assert.equal(page.svg.ns, "http://www.w3.org/2000/svg");
  assert.equal(page.svg.getAttribute("aria-hidden"), "true");
  assert.equal(page.svg.getAttribute("focusable"), "false");
  assert.equal(page.svg.children.length, 1);
  assert.equal(page.path(), arrow);
  assert.equal(page.label.className, "sr-only send-label");
  assert.equal(page.label.children[0].nodeValue, "보내기", "the same text node stays translatable");
  assert.equal(page.stopLabel.textContent, "답변 멈추기");
  assert.equal(page.stopLabel.hidden, true);
  assert.equal(page.send.getAttribute("data-send-mode"), null, "the first render leaves the button alone");
});

test("화살표와 정지 모양은 명령 순서와 점 개수가 같은 경로 두 개다", () => {
  const page = morphPage();
  page.run("renderSendMode(true)");
  page.frame(0); page.frame(1000);
  assert.equal(page.path(), square);
  const commands = d => d.replace(/-?\d+(?:\.\d+)?/g, "").replace(/\s+/g, "");
  assert.equal(commands(arrow), commands(square));
  assert.equal(commands(arrow), "MLLLLLLZ");
  assert.equal(numbers(arrow).length, 14);
  assert.equal(numbers(square).length, 14);
  // CSS d 속성 애니메이션은 iOS Safari가 지원하지 않는다. 경로는 스크립트가 다시 쓴다.
  for (const css of [styles, chatStyles]) assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), /(?:^|[\s;{])d\s*:/);
  assert.ok(morphBlock.includes("window.requestAnimationFrame(step)"));
});

test("정지로 바뀌면 화면 갱신마다 좌표를 섞어 180ms 안에 ■에 닿고, 이름은 답변 멈추기로 바뀐다", () => {
  const page = morphPage();
  page.run("renderSendMode(true)");
  assert.equal(page.send.getAttribute("data-send-mode"), "stop");
  assert.equal(page.label.hidden, true);
  assert.equal(page.stopLabel.hidden, false);
  assert.equal(page.path(), arrow, "nothing moves before the first frame");
  page.frame(1000);
  page.frame(1090);
  // 절반 시간에 ease-out(1 - (1 - t)^3)으로 87.5% 섞인다. 오른쪽 날개 끝(19, 11) → (17, 7).
  assert.ok(page.path().includes("L17.25 7.5"), page.path());
  assert.equal(page.frame(1180), 1);
  assert.equal(page.path(), square);
  assert.equal(page.queue.size, 0, "no frame is left running");
  page.run("renderSendMode(true)");
  assert.equal(page.queue.size, 0, "the same mode does not restart");
});

test("도중에 방향을 바꾸면 지금 섞인 자리에서 남은 거리만큼만 되돌아간다", () => {
  const page = morphPage();
  page.run("renderSendMode(true)");
  page.frame(0); page.frame(90);
  const halfway = numbers(page.path());
  page.run("renderSendMode(false)");
  assert.equal(page.cancelled.length, 1, "the running frame is cancelled");
  assert.equal(page.label.hidden, false);
  assert.equal(page.stopLabel.hidden, true);
  page.frame(500);
  assert.deepEqual(numbers(page.path()), halfway, "starts from the current shape, not from the square");
  // 87.5% 지점에서 돌아오므로 180ms × 0.875 = 157.5ms 뒤 화살표다.
  page.frame(500 + 157.5);
  assert.equal(page.path(), arrow);
  assert.equal(page.queue.size, 0);
});

test("동작 줄이기 설정이거나 화면 갱신 함수가 없으면 최종 모양을 바로 그리고, 도중에 켜면 진행 중인 움직임을 끊는다", () => {
  const still = morphPage({ reduced: true });
  still.run("renderSendMode(true)");
  assert.equal(still.path(), square);
  assert.equal(still.queue.size, 0);
  const bare = morphPage({ frames: false });
  bare.run("renderSendMode(true)");
  assert.equal(bare.path(), square);
  const page = morphPage();
  page.run("renderSendMode(true)");
  page.frame(0); page.frame(60);
  assert.notEqual(page.path(), square);
  page.state.reduced = true;
  for (const listener of page.motion) listener({ matches: true });
  assert.equal(page.path(), square);
  assert.equal(page.queue.size, 0);
  assert.equal(page.cancelled.length, 1);
});

test("정지 버튼은 보고 있는 대화의 요청만 끊고 보내기(submit)를 막으며 질문 칸으로 초점을 옮긴다", () => {
  const page = morphPage();
  let aborted = 0;
  page.context.activeConversation = { chatAbort: { abort() { aborted++; } } };
  const idle = page.send.fire("click");
  assert.equal(idle.defaultPrevented, false, "a send click still submits");
  assert.equal(aborted, 0);
  page.run("renderSendMode(true)");
  const stop = page.send.fire("click");
  assert.equal(stop.defaultPrevented, true);
  assert.equal(aborted, 1);
  assert.equal(page.state.focused, page.input);
  page.context.requestedChatView = false;
  page.send.fire("click");
  assert.equal(aborted, 1, "the home screen never stops a hidden conversation");
});

test("보내기 버튼에서 Enter·Space를 길게 누르면 첫 입력만 버튼을 누르고, 반복 키는 막아 방금 시작한 답을 멈추지 않는다", () => {
  const page = morphPage();
  let aborted = 0;
  page.context.activeConversation = { chatAbort: { abort() { aborted++; } } };
  for (const key of ["Enter", " "]) {
    // 첫 입력은 막지 않는다. 버튼이 click을 내 질문을 보낸다.
    assert.equal(page.send.fire("keydown", { key }).defaultPrevented, false, key);
  }
  // 질문을 보내 버튼이 정지 버튼으로 바뀐 뒤 같은 키가 되풀이해 들어온다. 기본 동작(click)을 막는다.
  page.run("renderSendMode(true)");
  for (const key of ["Enter", " "]) assert.equal(page.send.fire("keydown", { key, repeat: true }).defaultPrevented, true, key);
  assert.equal(aborted, 0, "the repeat never reaches the stop click");
  // 손을 뗐다가 새로 누르면 정지 버튼이 동작한다.
  assert.equal(page.send.fire("keydown", { key: "Enter" }).defaultPrevented, false);
  page.send.fire("click");
  assert.equal(aborted, 1);
});

test("답변 멈추기 이름은 세 언어 사전에 있고 언어를 바꾸면 다시 쓴다", () => {
  const page = morphPage();
  for (const [lang, name] of [["en", "Stop answer"], ["zh", "停止回答"], ["ko", "답변 멈추기"]]) {
    page.run(`uiLang = ${JSON.stringify(lang)}; for (const listener of langListeners) listener();`);
    assert.equal(page.stopLabel.textContent, name);
  }
  const { en, zh } = runInNewContext(langBlock + "\nuiText", {});
  for (const key of ["보내기", "답변 멈추기"]) assert.ok(en[key] && zh[key], key);
});

// ── 답 멈추기 ────────────────────────────────────────────────────────────────────
const meta = { answered: true, citations: [], session_id: "fictional-session", personalized: false };
const event = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

function askPage(route, { timeoutSignal = null } = {}) {
  const state = { focused: null };
  const requests = [], states = [], counts = { persisted: 0, notified: 0, celebrated: 0, submits: 0 };
  const node = tag => new El(tag, state);
  const send = node("button"), input = node("textarea");
  const context = {
    document: { hidden: false }, window: {}, Date, TextDecoder, TextEncoder, ReadableStream, DOMException, AbortController,
    // 시간 제한 신호는 가짜다. 묶는 함수(any)가 없고, 기본 가짜는 처리기를 받지 않아 정지 신호가 그대로 요청에 실린다.
    // timeoutSignal을 주면 그 신호를 시간 제한으로 써서, 테스트가 직접 만료시킬 수 있다.
    AbortSignal: { timeout: () => timeoutSignal ?? { fictionalTimeout: true } },
    fetch(path, options) { requests.push(path); return route(path, options); },
    send, input, photoFile: { files: [] }, photoClear: node("button"), photoAttach: node("button"), reset: node("button"),
    composer: { requestSubmit() { counts.submits++; } },
    busy: false, requestedChatView: true, activeConversation: null, conversations: [], historyAccount: "browse",
    sessionId: null, aiMode: "fast", chatRequestNumber: 0,
    reducedMotion: () => false, motionPreference: () => null,
    showAssistant: name => states.push(name), renderConversations() {}, scrollToLatest() {}, setBusy() {},
    persistConversations() { counts.persisted++; }, notifyConversation() { counts.notified++; }, celebrate() { counts.celebrated++; },
    citationCard: () => node("div"),
    // 사진 질문의 후속 답(읽은 글자로 묻기)에 필요한 화면 조각. 사진 처리 자체는 이 테스트 밖이다.
    statusLine: node("p"), photoNote: node("p"),
    photoMessages: { asking: "가상 묻는 중", disconnected: "가상 연결 실패", textFailed: "가상 처리 실패", textRejected: "가상 거절" },
    failureBox: message => { const box = node("div"); box.className = "error"; box.textContent = message; return box; },
    runPhotoRequest() {}, textAnswer: () => [node("section"), "가상 요약"],
    element(tag, className, text) { const made = node(tag); made.className = className || ""; if (text !== undefined) made.textContent = text; return made; },
  };
  runInNewContext(langBlock + between("function updateSend(", "function setBusy(") + morphBlock +
    between("async function readChatStream(", 'input.addEventListener("input"') +
    between('input.addEventListener("keydown"', 'composer.addEventListener("submit"') +
    between("async function requestJson(", "function textProblem(") +
    between("async function answerFromText(", "function readingPanel(") +
    between("async function runPhotoRequest(", "function scrollToLatest("), context);
  const record = { id: "fictional-1", time: 1, title: "가상 질문", messages: [{ role: "question", text: "가상 질문", time: 1, sources: [] }], turns: [] };
  context.conversations = [record];
  context.activeConversation = record;
  const reply = node("div");
  return {
    context, send, input, record, reply, requests, states, counts, state,
    ask: () => context.ask("가상 질문", reply, record),
    run: code => runInNewContext(code, context),
    mode: () => send.getAttribute("data-send-mode"),
  };
}
// 응답 본문을 붙잡아 두고 조각을 직접 보낸다. 요청이 끊기면 브라우저처럼 읽기가 AbortError로 실패한다.
function heldStream() {
  const held = {};
  held.route = (path, options) => {
    if (path !== "/api/v1/chat/stream") return Promise.reject(new Error(`unexpected request: ${path}`));
    held.signal = options.signal;
    const body = new ReadableStream({ start(controller) {
      held.push = text => controller.enqueue(new TextEncoder().encode(text));
      options.signal.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
    } });
    return Promise.resolve({ ok: true, body });
  };
  return held;
}

test("답을 만드는 동안 보내기 버튼이 정지 버튼이 되고, 멈추면 받은 부분만 남기며 다시 묻거나 오류·알림을 내지 않는다", async () => {
  const held = heldStream();
  const page = askPage(held.route);
  const done = page.ask();
  await settle();
  assert.ok(page.record.chatAbort, "each request gets its own abort signal");
  assert.equal(held.signal, page.record.chatAbort.signal);
  assert.equal(page.mode(), "stop");
  assert.equal(page.send.disabled, false, "the stop button stays pressable while waiting");
  held.push(event("meta", meta) + event("answer", { text: "가상 부분 답", replace: false }));
  await settle();
  assert.equal(page.reply.text, "가상 부분 답");
  // 생성 중 Enter는 막기만 하고 보내지도 멈추지도 않는다.
  const enter = page.input.fire("keydown", { key: "Enter" });
  assert.equal(enter.defaultPrevented, true);
  assert.equal(page.counts.submits, 0);
  assert.equal(page.record.chatAbort.signal.aborted, false);

  const click = page.send.fire("click");
  assert.equal(click.defaultPrevented, true);
  await done;
  assert.deepEqual(page.requests, ["/api/v1/chat/stream"], "no JSON retry after a stop");
  assert.equal(page.reply.text, "가상 부분 답");
  assert.equal(page.reply.all().some(child => child.className === "error" || child.className === "retry"), false);
  assert.equal(page.counts.notified, 0);
  assert.equal(page.counts.celebrated, 0);
  assert.equal(page.states.at(-1), "idle");
  assert.equal(page.record.pending, false);
  assert.equal(Object.hasOwn(page.record, "chatAbort"), false);
  assert.equal(page.mode(), "send");
  assert.equal(page.send.disabled, true, "an empty question box locks Send again");
  // vm 안에서 만든 배열은 프로토타입이 달라 deepEqual이 어긋난다. 이 테스트 쪽 배열로 옮겨 비교한다.
  assert.deepEqual(Array.from(page.record.committedMessages, ({ role, text }) => [role, text]),
    [["question", "가상 질문"], ["answer", "가상 부분 답"]]);
  assert.equal(page.counts.persisted, 1);
  assert.equal(page.state.focused, page.input);
});

test("스트림이 실패해 JSON으로 다시 묻는 중에 멈춰도 세 번째 요청이나 오류 문구가 없다", async () => {
  let jsonSignal = null;
  const page = askPage((path, options) => {
    if (path === "/api/v1/chat/stream") return Promise.resolve({ ok: false, status: 503 });
    jsonSignal = options.signal;
    return new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  });
  const done = page.ask();
  await settle();
  assert.deepEqual(page.requests, ["/api/v1/chat/stream", "/api/v1/chat"]);
  assert.equal(jsonSignal, page.record.chatAbort.signal, "the JSON retry carries the same stop signal");
  assert.equal(page.mode(), "stop");
  page.send.fire("click");
  await done;
  assert.equal(page.requests.length, 2);
  assert.equal(page.reply.all().some(child => child.className === "error"), false);
  assert.deepEqual(Array.from(page.record.committedMessages, ({ role }) => role), ["question"], "nothing was received, so no answer is stored");
  assert.equal(page.counts.notified, 0);
  assert.equal(page.mode(), "send");
});

test("스트림이 답 한 조각만 주고 끝맺지 못해 JSON으로 다시 묻는 중에 멈추면 받은 조각을 되살려 남긴다", async () => {
  const page = askPage((path, options) => {
    if (path === "/api/v1/chat/stream") {
      // 답 한 조각 뒤 완료(done) 신호 없이 연결이 닫힌다.
      const body = new ReadableStream({ start(controller) {
        controller.enqueue(new TextEncoder().encode(event("meta", meta) + event("answer", { text: "가상 부분 답", replace: false })));
        controller.close();
      } });
      return Promise.resolve({ ok: true, body });
    }
    return new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  });
  const done = page.ask();
  await settle();
  assert.deepEqual(page.requests, ["/api/v1/chat/stream", "/api/v1/chat"]);
  assert.equal(page.reply.text, "", "the JSON retry clears the unfinished stream first");
  page.send.fire("click");
  await done;
  assert.equal(page.requests.length, 2);
  assert.equal(page.reply.text, "가상 부분 답");
  assert.deepEqual(Array.from(page.record.committedMessages, ({ role, text }) => [role, text]),
    [["question", "가상 질문"], ["answer", "가상 부분 답"]]);
  assert.equal(page.reply.all().some(child => child.className === "error"), false);
  assert.equal(page.counts.notified, 0);
});

test("사진에서 읽은 글자로 답을 받는 동안에도 정지 버튼이 켜지고, 멈추면 오류·다시 시도 없이 끝낸다", async () => {
  let signal = null;
  const page = askPage((path, options) => {
    signal = options.signal;
    return new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  });
  // 사진 요청 묶음(runPhotoRequest)이 대화에 거는 대기 표시다.
  page.record.pending = true;
  const answer = new El("div", page.state);
  const done = page.context.answerFromText("가상 질문", "가상 판독문", answer, page.record);
  await settle();
  assert.deepEqual(page.requests, ["/api/v1/photo-question"]);
  assert.equal(signal, page.record.chatAbort.signal);
  assert.equal(page.mode(), "stop");
  assert.equal(page.send.disabled, false);
  page.send.fire("click");
  assert.equal(await done, null, "null tells runPhotoRequest the student stopped it");
  assert.equal(answer.children.length, 0, "no error box or retry button");
  assert.equal(page.states.at(-1), "idle");
  assert.equal(Object.hasOwn(page.record, "chatAbort"), false);
  // 사진 요청 묶음이 끝나기 전까지는 잠긴 보내기 버튼이다.
  assert.equal(page.mode(), "send");
  assert.equal(page.send.disabled, true);
  assert.equal(page.counts.celebrated, 0);
});

test("신호를 묶는 AbortSignal.any가 없어도 사진 후속 답의 시간 제한이 요청을 끊고, 멈춤이 아니라 실패로 알린다", async () => {
  const clock = new AbortController();
  let signal = null;
  const page = askPage((path, options) => {
    signal = options.signal;
    return new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError"))));
  }, { timeoutSignal: clock.signal });
  page.record.pending = true;
  const answer = new El("div", page.state);
  const done = page.context.answerFromText("가상 질문", "가상 판독문", answer, page.record);
  await settle();
  assert.equal(page.mode(), "stop");
  assert.notEqual(signal, page.record.chatAbort.signal, "the request carries a signal joined from stop and timeout");
  assert.equal(signal.aborted, false);
  // 가상 시간 제한이 만료된다.
  clock.abort();
  assert.equal(signal.aborted, true);
  assert.equal(await done, undefined, "a timeout is a failure, not a stop");
  assert.equal(answer.children[0].className, "error");
  assert.equal(page.states.at(-1), "error");
  assert.equal(page.mode(), "send");
  // 정지 버튼도 같은 묶은 신호를 끊는다.
  const other = askPage((path, options) => {
    signal = options.signal;
    return new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  }, { timeoutSignal: new AbortController().signal });
  other.record.pending = true;
  const stopped = other.context.answerFromText("가상 질문", "가상 판독문", new El("div", other.state), other.record);
  await settle();
  other.send.fire("click");
  assert.equal(signal.aborted, true);
  assert.equal(await stopped, null);
});

test("「고쳐서 다시 묻기」 중에 멈추면 앞서 받은 답을 되돌리고, 그사이 탭을 숨겨도 읽지 않음·알림을 남기지 않는다", async () => {
  const page = askPage((path, options) =>
    new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))));
  // 같은 답 자리에 이미 받은 가상 답 하나가 있다.
  const answer = new El("div", page.state);
  const earlier = new El("section", page.state);
  earlier.textContent = "가상 앞선 답";
  answer.append(earlier);
  const done = page.context.runPhotoRequest(page.record, "가상 묻는 중",
    () => page.context.answerFromText("가상 고친 질문", "가상 고친 판독문", answer, page.record));
  await settle();
  assert.equal(page.mode(), "stop");
  assert.equal(answer.children.length, 0, "the old answer is cleared while the new one is pending");
  page.send.fire("click");
  // 취소 처리가 끝나기 전에 탭을 숨긴다.
  page.context.document.hidden = true;
  await done;
  assert.deepEqual(Array.from(answer.children), [earlier]);
  assert.equal(page.record.unread === true, false);
  assert.equal(page.counts.notified, 0);
  assert.equal(page.record.pending, false);
  assert.equal(page.mode(), "send");
});

test("사진 후속 답이 실패한 뒤 「다시 시도」 중에 멈추면 앞의 오류 문구와 다시 시도 버튼을 되살리지 않는다", async () => {
  const page = askPage((path, options) =>
    new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))));
  // 첫 요청이 503으로 실패해 답 자리에 오류 상자가 남아 있다.
  const answer = new El("div", page.state);
  const failure = new El("div", page.state);
  failure.className = "error";
  failure.textContent = "가상 처리 실패";
  answer.append(failure);
  const done = page.context.runPhotoRequest(page.record, "가상 묻는 중",
    () => page.context.answerFromText("가상 질문", "가상 판독문", answer, page.record));
  await settle();
  assert.equal(page.mode(), "stop");
  page.send.fire("click");
  await done;
  assert.equal(answer.children.length, 0, "the finished failure stays gone");
  assert.equal(page.record.unread === true, false);
  assert.equal(page.counts.notified, 0);
});

test("정지 버튼은 보고 있는 대화가 답을 만들 때만 켜지고 사진·졸업 요청이나 홈 화면에서는 잠긴 보내기 버튼이다", async () => {
  const held = heldStream();
  const page = askPage(held.route);
  const done = page.ask();
  await settle();
  assert.equal(page.mode(), "stop");
  // 다른 대화로 옮기면 보내기 화살표로 돌아가고, 돌아오면 다시 정지다.
  page.context.activeConversation = { id: "fictional-2", messages: [], turns: [] };
  page.run("updateSend()");
  assert.equal(page.mode(), "send");
  assert.equal(page.send.disabled, true);
  page.context.activeConversation = page.record;
  page.run("updateSend()");
  assert.equal(page.mode(), "stop");
  // 사진 요청은 취소 신호 없이 pending만 둔다. 그동안은 잠긴 보내기 버튼이다.
  page.context.activeConversation = { id: "fictional-photo", pending: true, messages: [], turns: [] };
  page.input.value = "가상 다음 질문";
  page.run("updateSend()");
  assert.equal(page.mode(), "send");
  assert.equal(page.send.disabled, true);
  // 졸업 체크처럼 화면 전체를 잠그는 요청(busy)도 정지 버튼을 켜지 않는다.
  page.context.activeConversation = { id: "fictional-3", messages: [], turns: [] };
  page.context.busy = true;
  page.run("updateSend()");
  assert.equal(page.mode(), "send");
  assert.equal(page.send.disabled, true);
  page.context.busy = false;
  // 홈 화면에서는 대화를 보고 있지 않으므로 정지 버튼이 없다.
  page.context.activeConversation = page.record;
  page.context.requestedChatView = false;
  page.run("updateSend()");
  assert.equal(page.mode(), "send");
  page.context.requestedChatView = true;
  page.run("updateSend()");
  assert.equal(page.mode(), "stop");
  held.push(event("meta", meta) + event("answer", { text: "가상 끝 답", replace: false }) + event("done", {}));
  await done;
  assert.equal(page.mode(), "send");
  assert.equal(page.counts.celebrated, 1, "a finished answer still celebrates");
  assert.equal(page.send.disabled, false, "the typed question can be sent again");
  assert.equal(page.input.fire("keydown", { key: "Enter" }).defaultPrevented, true);
  assert.equal(page.counts.submits, 1);
});

test("정지 버튼에서 Enter를 길게 누르면 멈춘 뒤 질문 칸으로 옮겨 온 반복 키가 적어 둔 초안을 보내지 않는다", async () => {
  const held = heldStream();
  const page = askPage(held.route);
  const done = page.ask();
  await settle();
  page.input.value = "가상 다음 질문 초안";
  // 정지 버튼 위 첫 Enter는 버튼의 click이다. 답이 멈추고 초점이 질문 칸으로 온다.
  page.send.fire("click");
  await done;
  assert.equal(page.state.focused, page.input);
  assert.equal(page.mode(), "send");
  assert.equal(page.send.disabled, false, "the draft could be sent by a fresh Enter");
  // 같은 키를 누르고 있어 브라우저가 되풀이해 보내는 Enter(repeat)는 막기만 한다.
  for (let i = 0; i < 3; i++) assert.equal(page.input.fire("keydown", { key: "Enter", repeat: true }).defaultPrevented, true);
  assert.equal(page.counts.submits, 0);
  assert.equal(page.input.value, "가상 다음 질문 초안");
  // 손을 뗐다가 새로 누른 Enter는 그대로 보낸다.
  page.input.fire("keydown", { key: "Enter" });
  assert.equal(page.counts.submits, 1);
});

// ── 답변 모드 선택 표시 ──────────────────────────────────────────────────────────
function indicatorPage({ reduced = false, legacyMotion = false } = {}) {
  const state = { focused: null, reduced };
  const timers = new Map(), motion = [];
  let nextTimer = 0, row = 0;
  const node = tag => new El(tag, state);
  const body = node("body");
  const button = node("button");
  const context = {
    document: { body, get activeElement() { return state.focused; }, addEventListener() {} },
    window: { innerWidth: 1280, innerHeight: 800 },
    reducedMotion: () => state.reduced, within: () => false,
    // 동작 줄이기 설정 변화 신호를 테스트에서 직접 보낼 수 있게 처리기를 모아 둔다.
    motionPreference: () => legacyMotion
      ? { addListener: listener => motion.push(listener) }
      : { addEventListener: (type, listener) => motion.push(listener) },
    setTimeout: (callback, delay) => { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
    clearTimeout: id => timers.delete(id),
    element(tag, className, text) {
      const made = node(tag);
      made.className = className || "";
      if (text !== undefined) made.textContent = text;
      // 항목은 제목(38px) 아래에 52px 높이로 쌓이고 2px씩 떨어진다.
      if (className === "choice-menu-item") Object.assign(made, { offsetTop: 38 + 54 * row++, offsetHeight: 52 });
      return made;
    },
  };
  runInNewContext(between("let activeChoiceMenu = null;", "function setupAiMode()"), context);
  const choices = [
    { value: "fast", name: "가상 빠르게", description: "", checked: true },
    { value: "deep", name: "가상 깊이", description: "", checked: false },
  ];
  return {
    state, timers, button, motion,
    open: indicator => runInNewContext("openChoiceMenu", context)(button, "가상 답변 모드", choices, () => {}, indicator ? { indicator: true } : undefined),
    menu: () => body.children.find(child => child.className === "choice-menu"),
    indicator() { return this.menu().children.find(child => child.className === "choice-menu-indicator"); },
    items() { return this.menu().children.filter(child => child.getAttribute("role") === "menuitemradio"); },
    tick: () => { for (const [id, timer] of [...timers]) { timers.delete(id); timer.callback(); } },
  };
}
const spot = indicator => [indicator.getAttribute("data-phase"), indicator.styles.get("--choice-menu-indicator-y"), indicator.styles.get("--choice-menu-indicator-h")];
const arrowMoves = [["ArrowDown", 1], ["ArrowUp", 0], ["ArrowDown", 1]];

test("방향키를 아래·위·아래로 누르면 마지막 초점에만 안착하고 선택은 유지한다", () => {
  const page = indicatorPage();
  page.open(true);
  const items = page.items();
  for (const [key, index] of arrowMoves) {
    page.menu().fire("keydown", { key });
    assert.equal(page.state.focused, items[index]);
    assert.deepEqual(spot(page.indicator()), ["stretch", "38px", "106px"]);
    assert.deepEqual([...page.timers.values()].map(timer => timer.delay), [90]);
    assert.deepEqual(items.map(item => item.getAttribute("aria-checked")), ["true", "false"]);
  }
  page.tick();
  assert.deepEqual(spot(page.indicator()), ["settle", "92px", "52px"]);
  assert.equal(page.timers.size, 0);
  assert.equal(page.state.focused, items[1]);
  assert.deepEqual(items.map(item => item.getAttribute("aria-checked")), ["true", "false"]);
});

test("답변 모드 메뉴의 선택 표시는 목표 쪽으로 늘어났다가 90ms 뒤 목표 자리에 안착한다", () => {
  const page = indicatorPage();
  page.open(true);
  const indicator = page.indicator();
  assert.equal(indicator.getAttribute("aria-hidden"), "true");
  assert.equal(page.menu().getAttribute("data-indicator"), "");
  assert.deepEqual(spot(indicator), ["rest", "38px", "52px"], "opens on the checked item without moving");
  page.menu().fire("keydown", { key: "ArrowDown" });
  assert.equal(page.state.focused, page.items()[1]);
  // 지금 자리(38~90)와 목표(92~144)를 함께 덮는다.
  assert.deepEqual(spot(indicator), ["stretch", "38px", "106px"]);
  assert.deepEqual([...page.timers.values()].map(timer => timer.delay), [90]);
  page.tick();
  assert.deepEqual(spot(indicator), ["settle", "92px", "52px"]);
  // 마우스가 가리키는 항목으로도 같은 길로 옮긴다. 늘어나는 도중에 방향을 바꾸면 앞 예약은 버린다.
  page.items()[0].fire("pointerenter");
  assert.deepEqual(spot(indicator), ["stretch", "38px", "106px"]);
  page.items()[1].fire("pointerenter");
  assert.equal(page.timers.size, 1, "only the latest settle is scheduled");
  page.tick();
  assert.deepEqual(spot(indicator), ["settle", "92px", "52px"]);
});

function assertReducedMotionDuringMove(page) {
  page.open(true);
  for (const [key] of arrowMoves) page.menu().fire("keydown", { key });
  assert.deepEqual(spot(page.indicator()), ["stretch", "38px", "106px"]);
  assert.equal(page.timers.size, 1);
  // 90ms가 지나기 전에 운영체제 설정을 바꾼다.
  page.state.reduced = true;
  for (const listener of page.motion) listener({ matches: true });
  assert.equal(page.timers.size, 0, "the pending settle is cancelled");
  assert.deepEqual(spot(page.indicator()), ["rest", "92px", "52px"]);
  assert.equal(page.state.focused, page.items()[1]);
  // 설정을 끄는 신호는 아무것도 옮기지 않는다.
  page.state.reduced = false;
  for (const listener of page.motion) listener({ matches: false });
  assert.equal(page.timers.size, 0);
  assert.deepEqual(spot(page.indicator()), ["rest", "92px", "52px"]);
}

test("늘어난 선택 표시가 안착을 기다리는 사이 동작 줄이기를 켜면 예약을 버리고 목표 자리에 바로 놓는다", () => {
  const page = indicatorPage();
  assert.equal(page.motion.length, 1, "one settings listener for every menu");
  assertReducedMotionDuringMove(page);
});

test("addListener만 있는 환경에서도 동작 줄이기를 켜면 즉시 안착한다", {
  todo: "chat.js의 설정 변경 처리에 addListener 지원이 필요함",
}, () => {
  assertReducedMotionDuringMove(indicatorPage({ legacyMotion: true }));
});

test("동작 줄이기 설정에서는 선택 표시가 늘어나지 않고 바로 목표 자리에 놓이며, 다른 메뉴에는 선택 표시가 없다", () => {
  const still = indicatorPage({ reduced: true });
  still.open(true);
  for (const [key, index] of arrowMoves) {
    still.menu().fire("keydown", { key });
    const item = still.items()[index];
    assert.equal(still.state.focused, item);
    assert.deepEqual(spot(still.indicator()), ["rest", `${item.offsetTop}px`, "52px"]);
    assert.equal(still.timers.size, 0);
  }
  const plain = indicatorPage();
  plain.open(false);
  assert.equal(plain.indicator(), undefined);
  assert.equal(plain.menu().getAttribute("data-indicator"), null);
  // 답변 모드 선택기만 선택 표시를 켠다.
  assert.ok(between("function setupAiMode()", "setupAiMode();").includes("{ indicator: true }"));
  assert.equal(between("// 테마 선택기(#131).", "// 테마 선택기 끝.").includes("indicator"), false);
});

test("선택 표시 곡선은 기본이 cubic-bezier이고 스프링 linear()는 @supports 안에서만 쓰며 300ms 안에 끝난다", () => {
  const css = styles.replace(/\/\*[\s\S]*?\*\//g, "");
  const base = /\n\.choice-menu-indicator \{([^}]*)\}/.exec(css)[1];
  const stretchMatch = /transition: transform (\d+)ms ease-out, height (\d+)ms ease-out;/.exec(base);
  assert.ok(stretchMatch, "both stretch transitions use ease-out");
  const [, stretchTransform, stretchHeight] = stretchMatch.map(Number);
  assert.equal(stretchTransform, 90);
  assert.equal(stretchTransform, stretchHeight);
  assert.match(base, /pointer-events: none;/);
  const settled = /\n\.choice-menu-indicator\[data-phase="settle"\] \{([^}]*)\}/.exec(css)[1];
  const settleMatch = /transition: transform (\d+)ms cubic-bezier\(\.34, 1\.4, \.64, 1\), height (\d+)ms cubic-bezier\(\.34, 1\.4, \.64, 1\);/.exec(settled);
  assert.ok(settleMatch, "both settle transitions use the fallback curve");
  const [, settleTransform, settleHeight] = settleMatch.map(Number);
  assert.equal(settleTransform, 190);
  assert.equal(settleTransform, settleHeight);
  assert.ok(stretchTransform + settleTransform < 300);
  const indicatorCode = between("function choiceIndicator(", "let settleChoiceIndicator");
  const delayedSettle = /timer = setTimeout\(\(\) => \{[^}]*place\(to, "settle"\);\s*\},\s*(\d+)\);/.exec(indicatorCode);
  assert.ok(delayedSettle, "choiceIndicator schedules the settle");
  assert.equal(Number(delayedSettle[1]), stretchTransform);
  assert.doesNotMatch(settled, /linear\(/);
  const supported = /@supports \(transition-timing-function: linear\(0, 1\)\) \{\s*\.choice-menu-indicator\[data-phase="settle"\] \{([^}]*)\}/.exec(css)[1];
  assert.match(supported, /transition-timing-function: linear\(0, [^)]*\b1\);/);
  const reducedMotion = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css)[1];
  assert.match(reducedMotion, /\.choice-menu-indicator,\s*\.choice-menu-indicator\[data-phase="settle"\]\s*\{\s*transition: none !important;/);
  // 선택 표시 바탕(--tint) 위 글자는 메뉴의 기존 글자색 그대로다. 경계는 컨트롤 선(--control-line)이다.
  assert.match(base, /background: var\(--tint\);/);
  assert.match(base, /border: 1px solid var\(--control-line\);/);
  assert.ok(script.includes('"--choice-menu-indicator-y"') && script.includes('"--choice-menu-indicator-h"'));
});

test("깊이 생각 반짝임은 하늘색 빛줄기 하나가 240ms에 한 번만 지나가고 별 조각·회전·감싸는 빛은 없다", () => {
  // CSS만 본다. 효과 클래스를 붙이고 떼는 시점은 chat_stream.test.mjs가 맡는다(#152).
  const css = chatStyles.replace(/\/\*[\s\S]*?\*\//g, "");
  const sweep = /\n\.mode-pill\.is-flowing::before \{([^}]*)\}/.exec(css)[1];
  assert.match(sweep, /animation: mode-sweep \.24s ease-out 1 both;/);
  assert.match(sweep, /var\(--deep-shine\)/);
  assert.match(sweep, /pointer-events: none;/);
  assert.doesNotMatch(sweep, /deep-gold|infinite/);
  assert.doesNotMatch(css, /\.mode-spark|\.is-bursting|\.is-deep-enter|\.is-flowing::after|mode-star-spin|composer-deep-enter|mode-border-flow/);
  assert.doesNotMatch(css, /✦|✨/);
});
