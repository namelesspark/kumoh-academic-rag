import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { setImmediate } from "node:timers/promises";
const script = readFileSync(
  new URL("../../app/chat_web/assets/chat.js", import.meta.url),
  "utf8",
);

function page({
  reduced = false,
  transition,
  storedConversations = [],
  storage = { getItem: () => null, setItem() {} },
} = {}) {
  const nodes = new Map(),
    events = new Map(),
    windowEvents = new Map(),
    timers = new Map(),
    requests = [];
  const photoRequests = [], states = [], saved = [];
  let focus = null, id = 0, now = 1_000;
  // 같은 종류의 처리기를 여러 개 붙여도 덮어쓰지 않는다. get(type)은 붙인 순서대로 모두 부르는 함수를 돌려준다.
  const listen = (map, type, callback) => {
    const callbacks = [...(map.get(type)?.callbacks ?? []), callback];
    const dispatch = (event = {}) => { for (const each of callbacks) each(event); };
    dispatch.callbacks = callbacks;
    map.set(type, dispatch);
  };
  class Node {
    children = [];
    attributes = new Map();
    listeners = new Map();
    properties = new Map();
    style = { setProperty: (name, value) => this.properties.set(name, String(value)) };
    hidden = false;
    textContent = "";
    value = "";
    files = [];
    clicks = 0;
    dataset = {};
    classList = {
      contains: name => (this.className || "").split(/\s+/).includes(name),
      add: (...names) => { this.className = [...new Set([...(this.className || "").split(/\s+/).filter(Boolean), ...names])].join(" "); },
      remove: (...names) => { this.className = (this.className || "").split(/\s+/).filter(name => !names.includes(name)).join(" "); },
      toggle: (name, force) => { const on = force ?? !this.classList.contains(name); this.classList[on ? "add" : "remove"](name); return on; },
    };
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    querySelector(selector) { return this.children.find(node => node.dataset?.icon && selector.includes(node.dataset.icon)) || this.children.find(node => (node.className || "").split(" ").includes(selector.slice(1))) || null; }
    querySelectorAll(selector) { return this.children.filter(node => node.classList?.contains(selector.slice(1))); }
    cloneNode() { const copy = new Node(); copy.className = this.className; copy.dataset = { ...this.dataset }; return copy; }
    getBoundingClientRect() { return { left: 240, right: 360, top: 500, bottom: 540, width: 120, height: 180 }; }
    append(...children) {
      for (const child of children) if (child instanceof Node) child.parentNode = this;
      this.children.push(...children);
    }
    replaceChildren(...children) {
      this.children = [];
      this.append(...children);
    }
    contains(node) {
      return node === this || this.children.some(child => child instanceof Node && child.contains(node));
    }
    setAttribute(key, value) {
      this.attributes.set(key, String(value));
      if (key.startsWith("data-")) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
    }
    removeAttribute(key) {
      this.attributes.delete(key);
    }
    addEventListener(type, callback) {
      listen(this.listeners, type, callback);
    }
    fire(type, values = {}) {
      const event = { target: this, stopPropagation() {}, stopImmediatePropagation() {}, prevented: false, preventDefault() { event.prevented = true; }, ...values };
      this.listeners.get(type)?.(event);
      return event;
    }
    // 브라우저처럼 자신이나 조상이 inert면 초점을 옮기지 않는다.
    focus(options) {
      for (let node = this; node; node = node.parentNode) if (node.inert) return;
      focus = this;
      this.focusOptions = options;
    }
    click() {
      this.clicks++;
      this.listeners.get("click")?.({ target: this });
      this.onclick?.();
    }
  }
  const get = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, new Node());
    return nodes.get(selector);
  };
  const document = {
    title: "가상 테크모",
    hidden: false,
    body: get("body"),
    querySelector: get,
    createTextNode: (text) => text,
    addEventListener: (name, callback) => listen(events, name, callback),
    get activeElement() {
      return focus;
    },
  };
  if (transition) {
    document.startViewTransition = (callback) => transition(callback);
  }
  const location = {
    pathname: "/chat",
    search: "",
    hash: "",
  };
  const pushes = [];
  const window = {
    location,
    history: {
      pushState(state, title, url) {
        pushes.push(url);
        location.hash = "#chat";
      },
      replaceState(state, title, url) {
        location.hash = "";
      },
    },
    addEventListener: (name, callback) => listen(windowEvents, name, callback),
    // 삭제 확인은 화면 안 확인 창이 맡는다. 브라우저 기본 확인 창을 부르면 테스트가 실패한다.
    confirm: () => { throw Error("window.confirm을 부르면 안 된다"); },
    localStorage: storage,
    innerWidth: 800,
    innerHeight: 700,
  };
  const context = {
    document,
    window,
    Date: class extends Date { static now() { return now; } },
    Array,
    Promise,
    TextDecoder,
    ReadableStream,
    AbortSignal: {
      timeout() {
      },
    },
    busy: false,
    sessionId: null,
    fetch(path, options) {
      return new Promise((resolve, reject) =>
        requests.push({
          path,
          options,
          async resolve(response) {
            if (path !== "/api/v1/chat/stream" || !response.ok || response.body) {
              resolve(response);
              return;
            }
            const result = await response.json();
            const events = [
              ["meta", { answered: result.answered, citations: result.citations,
                session_id: result.session_id, personalized: false }],
              ["answer", { text: result.answer, replace: false }],
              ["done", { latency_ms: { retrieval: 0, generation: 0, total: 0 } }],
            ];
            resolve({ ok: true, body: new ReadableStream({ start(controller) {
              for (const [name, data] of events) {
                controller.enqueue(new TextEncoder().encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`));
              }
              controller.close();
            } }) });
          },
          reject,
        })
      );
    },
    celebrate() {
    },
    citationCard() {
      return new Node();
    },
    setBusy() {
    },
    setTimeout: (callback, delay) => {
      timers.set(++id, {
        callback,
        delay,
      });
      return id;
    },
    clearTimeout: (key) => timers.delete(key),
    transcript: get("#transcript"),
    empty: get("#empty"),
    composer: get("#composer"),
    reset: get("#reset"),
    assistant: get("#pet-dock"),
    input: get("#question"),
    photoFile: get("#photo-file"),
    photoNote: get("#photo-note"),
    photoAttach: get("#photo-attach"),
    photoClear: get("#photo-clear"),
    send: get("#send"),
    statusLine: get("#status"),
    graduationTurn: null,
    changeFeature() {},
    techmoBubble() {},
    photoTypes: ["image/jpeg", "image/png"],
    photoMaxBytes: 5_000_000,
    photoRejections: {},
    photoMessages: { reading: "가상 사진 읽는 중" },
    runPhotoRequest(record, message, work) { return work(); },
    readPhoto(photo, type, question, reply, record) {
      photoRequests.push({ photo, type, question, reply, record });
    },
    reducedMotion: () => reduced,
    updateSend() {
    },
    scrollToLatest() {
    },
    showAssistant(state, line) {
      states.push(state);
      get("#pet-line").textContent = line;
    },
    element(tag, className, text) {
      const node = new Node();
      node.tagName = tag;
      node.className = className;
      node.textContent = text ?? "";
      return node;
    },
    sourceLink() {
      return null;
    },
    saveConversations(storage, account, records) {
      saved.push(records.map(({ id, time, title, messages, archived, unread }) =>
        JSON.parse(JSON.stringify({ id, time, title, messages, archived, unread }))));
    },
    loadConversations() {
      return JSON.parse(JSON.stringify(storedConversations));
    },
    clearConversations() {
    },
  };
  const modeButton = get("#ai-mode-button");
  modeButton.className = "mode-pill";
  for (const value of ["fast", "deep"]) {
    const icon = new Node(); icon.className = "mode-icon"; icon.dataset.icon = value; modeButton.append(icon);
  }
  const label = new Node(); label.className = "mode-pill-label"; modeButton.append(label);
  get(".composer-row").append(get("#question"), modeButton, get("#send"));
  get("#composer").append(get(".composer-row"));
  get("#transcript").append(get("#empty"));
  const controller = script.slice(
    script.indexOf("const sidebar ="),
    script.indexOf("function storedStudentId("),
  );
  const asking = script.slice(
    script.indexOf("const aiModeKey ="),
    script.indexOf('input.addEventListener("input"'),
  );
  const submitting = script.slice(
    script.indexOf('composer.addEventListener("submit"'),
    script.indexOf("const landingActions ="),
  );
  const updateSendCode = script.slice(
    script.indexOf("function updateSend("),
    script.indexOf("function setBusy("),
  );
  const titleCode = script.slice(
    script.indexOf("function conversationTitle("),
    script.indexOf("function conversationKey("),
  );
  runInNewContext(titleCode + updateSendCode + controller + asking + submitting, context);
  return {
    get,
    document,
    window,
    pushes,
    timers,
    events,
    windowEvents,
    requests,
    photoRequests,
    states,
    saved,
    focus: () => focus,
    advanceTime: ms => { now += ms; },
    run: (code) => runInNewContext(code, context),
    tick(ms) {
      for (const [key, timer] of timers) {
        if (timer.delay <= ms) {
          timers.delete(key);
          timer.callback();
        }
      }
    },
  };
}

test("미지원 환경은 같은 문서에서 #chat과 홈 상태를 바로 바꾼다", () => {
  const p = page();
  p.run("setChatView(true)");
  assert.equal(p.document.body.attributes.get("data-view"), "chat");
  assert.deepEqual(p.pushes, ["#chat"]);
  assert.equal(p.get(".main-welcome").hidden, true);
  assert.equal(p.get("#reset").hidden, true);
  assert.equal(p.get("#transcript").children.length, 0);
  p.window.location.hash = "";
  p.windowEvents.get("popstate")();
  assert.equal(p.document.body.attributes.get("data-view"), "home");
  assert.equal(p.get(".main-welcome").hidden, false);
  assert.equal(p.get("#transcript").children[0], p.get("#empty"));
});

test("움직임 줄이기는 전환 API를 호출하지 않는다", () => {
  let calls = 0;
  const p = page({
    reduced: true,
    transition() {
      calls++;
    },
  });
  p.run("setChatView(true)");
  assert.equal(calls, 0);
  assert.equal(p.document.body.attributes.get("data-view"), "chat");
});

test("전환 API는 화면 변경을 한 번 적용하고 실패하면 즉시 복구한다", async () => {
  let callback;
  const p = page({
    transition: (apply) => {
      callback = apply;
      return {
        updateCallbackDone: Promise.resolve(),
        finished: Promise.resolve(),
      };
    },
  });
  p.run("setChatView(true)");
  callback();
  await Promise.resolve();
  assert.equal(p.document.body.attributes.get("data-view"), "chat");
  assert.equal(p.get("#transcript").children.length, 0);
  const failed = page({
    transition() {
      throw Error("가상 전환 실패");
    },
  });
  failed.run("setChatView(true)");
  assert.equal(failed.document.body.attributes.get("data-view"), "chat");
});

test("서랍은 초점을 받아 바깥 클릭과 Esc로 닫고 버튼에 초점을 돌린다", () => {
  const p = page();
  p.run("setChatView(true)");
  p.get("#conversation-toggle").click();
  assert.equal(
    p.document.body.attributes.get("data-conversation-drawer"),
    "open",
  );
  assert.equal(p.focus(), p.get("#new-conversation"));
  assert.equal(p.get("#composer").inert, true);
  p.get("#conversation-backdrop").click();
  assert.equal(p.focus(), p.get("#conversation-toggle"));
  p.get("#conversation-toggle").click();
  p.events.get("keydown")({
    key: "Escape",
  });
  assert.equal(
    p.document.body.attributes.has("data-conversation-drawer"),
    false,
  );
});

test("다른 대화의 도착 알림은 읽지 않음과 숨은 탭 제목을 바꾸고 6초 뒤 닫힌다", () => {
  const p = page();
  p.document.hidden = true;
  p.run(
    'var record={id:"fictional-1",time:1,messages:[{role:"question",text:"가상 질문입니다"}],turns:[]}; conversations=[record];notifyConversation(record);renderConversations();',
  );
  assert.equal(p.get("#conversation-toast").hidden, false);
  assert.match(
    p.get("#conversation-toast-open").textContent,
    /가상 질문입니다/,
  );
  assert.equal(p.run("record.unread"), true);
  assert.equal(p.document.title, "(1) 가상 테크모");
  assert.equal(p.get("#pet-line").textContent, "답변이 도착했어요");
  assert.equal(
    p.get("#conversation-list").children[0].children[0].children.at(-1)
      .className,
    "conversation-unread",
  );
  p.tick(5999);
  assert.equal(p.get("#conversation-toast").hidden, false);
  p.tick(6000);
  assert.equal(p.get("#conversation-toast").hidden, true);
  p.document.hidden = false;
  p.events.get("visibilitychange")();
  assert.equal(p.document.title, "가상 테크모");
});

test("도착 알림을 누르면 대화를 열고 읽지 않음을 지운다", () => {
  const p = page();
  p.run(
    'var record={id:"fictional-1",time:1,messages:[{role:"question",text:"가상 질문"}],turns:[]};conversations=[record];notifyConversation(record);',
  );
  p.get("#conversation-toast-open").click();
  assert.equal(p.document.body.attributes.get("data-view"), "chat");
  assert.equal(p.run("activeConversation===record"), true);
  assert.equal(p.run("record.unread"), false);
});

function choiceMenu(p) { return p.document.body.children.find(node => node.classList.contains("choice-menu")); }
function selectMode(p, value) {
  p.get("#ai-mode-button").click();
  choiceMenu(p).children.find(node => node.dataset.choiceValue === value).click();
}

function begin(p) {
  return p.run(
    'var record={id:"fictional-1",time:1,messages:[{role:"question",text:"가상 질문"}],turns:[]};conversations=[record];activeConversation=record;setChatView(true);var reply=document.querySelector(".test-reply");ask("가상 질문",reply,record);',
  );
}
const answer = {
  ok: true,
  json: async () => ({
    session_id: "fictional-session",
    answered: true,
    answer: "가상 답변",
    citations: [],
  }),
};

const trimConversations = runInNewContext(
  script.slice(0, script.indexOf("const transcript =")) +
    script.slice(script.indexOf("function isSafeSourceUrl("), script.indexOf("function citationCard(")) +
    "\ntrimConversations",
  { URL },
);
const heldText = "이 질문은 가상 규정에서 근거를 찾지 못했어요.";

function reopen(saved) {
  const p = page({ storedConversations: trimConversations(saved) });
  p.run('switchHistoryAccount("browse"); var restored = conversations[0]; openConversation(restored)');
  return p.get("#transcript").children[0].children;
}

function openStream(p) {
  let controller;
  const body = new ReadableStream({ start(value) { controller = value; } });
  p.requests[0].resolve({ ok: true, body });
  return (name, data) => controller.enqueue(new TextEncoder().encode(
    `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`,
  ));
}

test("깊이 생각을 펼치고 답을 이어 그린 뒤 근거와 답만 기록한다", async () => {
  const p = page();
  selectMode(p, "deep");
  const done = begin(p);
  assert.equal(JSON.parse(p.requests[0].options.body).mode, "deep");
  const waiting = p.get(".test-reply").children[0];
  assert.equal(waiting.classList.contains("is-waiting"), true);
  assert.equal(waiting.children[0].children[0].textContent, "생각하는 중");
  assert.equal(waiting.children[0].children[1].textContent, "모델이 쓴 원문, 영어일 수 있음");
  selectMode(p, "fast");
  assert.equal(p.get(".composer-row").classList.contains("is-deep"), false);
  const emit = openStream(p);
  emit("meta", { answered: true, citations: [{ document: "가상 규정", article_path: "제1조", source_url: "https://example.com/fictional" }], session_id: "fictional-session" });
  emit("thinking", { text: "Fictional thought <script>" });
  await setImmediate();
  const reply = p.get(".test-reply");
  const thinking = reply.children[0];
  assert.equal(thinking.id, "thinking-1");
  assert.equal(thinking.children[0].id, "thinking-1-summary");
  assert.equal(thinking.open, true);
  assert.equal(thinking.children[1].textContent, "Fictional thought <script>");
  p.advanceTime(3_000);
  emit("answer", { text: "가상 <b>", replace: false });
  await setImmediate();
  assert.equal(thinking.open, false);
  assert.equal(thinking.classList.contains("is-waiting"), false);
  assert.equal(thinking.children[0].children[0].textContent, "3초 동안 생각함");
  assert.equal(reply.children[1].textContent, "가상 <b>");
  assert.equal(reply.children.length, 2);
  assert.equal(p.run("record.messages.length"), 1);
  emit("answer", { text: "답", replace: false });
  await setImmediate();
  assert.equal(reply.children[1].textContent, "가상 <b>답");
  emit("answer", { text: "가상 근거 답", replace: true });
  emit("notice", { text: "가상 대체 안내" });
  emit("done", { latency_ms: {} });
  await done;
  assert.equal(reply.children[1].textContent, "가상 근거 답");
  assert.equal(reply.children[2].className, "ai-notice");
  assert.equal(reply.children.length, 4);
  assert.equal(p.run("record.messages.at(-1).text"), "가상 근거 답");
  assert.equal(p.run("record.messages.at(-1).sources[0].title"), "가상 규정 · 제1조");
  assert.equal(p.run('JSON.stringify(record.committedMessages).includes("Fictional thought")'), false);
  assert.equal(p.requests.length, 1);
  const next = p.run('ask("가상 다음 질문", document.querySelector(".next-reply"), record)');
  assert.equal(JSON.parse(p.requests[1].options.body).mode, "fast");
  p.requests[1].resolve(answer);
  await next;
});

test("빠른 답은 생각을 버리고 다른 대화 조각은 현재 테크모를 바꾸지 않는다", async () => {
  const p = page();
  const done = begin(p);
  const emit = openStream(p);
  emit("meta", { answered: true, citations: [], session_id: "fictional-session" });
  emit("thinking", { text: "Fictional hidden thought" });
  await setImmediate();
  assert.equal(p.get(".test-reply").children.length, 0);
  p.run('activeConversation=null;setChatView(false)');
  p.get("#pet-line").textContent = "가상 현재 상태";
  emit("answer", { text: "가상 늦은 답", replace: false });
  await setImmediate();
  assert.equal(p.get("#pet-line").textContent, "가상 현재 상태");
  emit("done", {});
  await done;
  assert.equal(p.run("record.messages.at(-1).text"), "가상 늦은 답");
  assert.equal(p.get("#conversation-toast").hidden, false);
});

test("삭제와 계정 변경 뒤의 생각과 답 조각을 폐기한다", async () => {
  for (const action of ["conversations=[]", 'switchHistoryAccount("demo-d02")']) {
    const p = page();
    selectMode(p, "deep");
    const done = begin(p);
    const waiting = p.get(".test-reply").children[0];
    const emit = openStream(p);
    emit("meta", { answered: true, citations: [], session_id: "fictional-session" });
    await setImmediate();
    p.run(action);
    emit("thinking", { text: "Fictional discarded thought" });
    emit("answer", { text: "가상 폐기 답", replace: false });
    emit("done", {});
    await done;
    assert.equal(waiting.classList.contains("is-waiting"), false);
    assert.equal(p.get(".test-reply").children.length, 0);
    assert.equal(p.run("record.messages.length"), 1);
  }
});

test("중간 스트림 실패는 생각과 부분 답을 지우고 같은 방식으로 한 번 다시 묻는다", async () => {
  const p = page();
  selectMode(p, "deep");
  const done = begin(p);
  const waiting = p.get(".test-reply").children[0];
  const emit = openStream(p);
  emit("meta", { answered: true, citations: [], session_id: "fictional-session" });
  emit("thinking", { text: "Fictional discarded thought" });
  emit("answer", { text: "가상 부분 답", replace: false });
  await setImmediate();
  assert.equal(p.get(".test-reply").children.length, 2);
  emit("error", { code: "stream_failed", message: "답변을 받지 못했어요" });
  await setImmediate();
  assert.equal(p.get(".test-reply").children.length, 0);
  assert.equal(waiting.classList.contains("is-waiting"), false);
  assert.equal(p.requests.length, 2);
  assert.equal(p.requests[1].path, "/api/v1/chat");
  assert.equal(p.requests[1].options.body, p.requests[0].options.body);
  p.requests[1].resolve(answer);
  await done;
  assert.equal(p.run("record.messages.at(-1).text"), "가상 답변");
  assert.equal(p.get(".test-reply").children.length, 1);
});

test("깊이 요청이 스트림과 JSON 모두 실패하면 대기 표시를 지우고 다시 시도를 보인다", async () => {
  const p = page();
  selectMode(p, "deep");
  const done = begin(p);
  const waiting = p.get(".test-reply").children[0];
  p.requests[0].reject(Error("가상 스트림 실패"));
  await setImmediate();
  assert.equal(waiting.classList.contains("is-waiting"), false);
  assert.equal(p.get(".test-reply").children.length, 0);
  p.requests[1].reject(Error("가상 JSON 실패"));
  await done;
  const reply = p.get(".test-reply");
  assert.equal(reply.children[0].className, "error");
  assert.equal(reply.children[0].children[1].textContent, "다시 시도");
  assert.equal(reply.children.some(node => node.classList.contains("is-waiting")), false);
});

test("meta가 답함이어도 done.answered가 false면 근거·안내 없이 보류로 끝나고 다시 묻지 않는다", async () => {
  const p = page();
  const finished = begin(p);
  const emit = openStream(p);
  emit("meta", { answered: true, citations: [{ document: "가상 규정", article_path: "제1조", source_url: "https://example.com/fictional" }], session_id: "fictional-session" });
  emit("answer", { text: "가상 교체 보류", replace: true });
  emit("notice", { text: "가상 남은 안내" });
  emit("done", { latency_ms: {}, answered: false });
  await finished;
  const reply = p.get(".test-reply");
  assert.equal(reply.children.length, 1);
  assert.equal(reply.children[0].className, "fallback");
  assert.equal(reply.children[0].textContent, heldText);
  assert.equal(p.requests.length, 1);
  assert.equal(p.states.at(-1), "hold");
  const message = p.run("record.messages.at(-1)");
  assert.equal(message.answered, false);
  assert.equal(Object.hasOwn(message, "guided"), false);
  assert.equal(message.sources.length, 0);
  const [question, restored] = reopen(p.saved.at(-1));
  assert.equal(question.className, "question");
  assert.equal(restored.className, "reply fallback");
  assert.equal(restored.textContent, heldText);
});

test("안내 답은 받은 글 그대로 일반 말풍선에 그리고 저장·재개 뒤에도 보류와 구별한다", async () => {
  const p = page();
  const finished = begin(p);
  const emit = openStream(p);
  emit("meta", { answered: false, citations: [], session_id: "fictional-session" });
  emit("answer", { text: "가상 안내 ", replace: false });
  emit("answer", { text: "답 <b>", replace: false });
  emit("done", { latency_ms: {}, answered: false, guided: true });
  await finished;
  const reply = p.get(".test-reply");
  assert.equal(reply.children.length, 1);
  assert.equal(reply.children[0].className, "");
  assert.equal(reply.children[0].textContent, "가상 안내 답 <b>");
  assert.equal(p.requests.length, 1);
  assert.equal(p.states.at(-1), "hold");
  const message = p.run("record.messages.at(-1)");
  assert.equal(message.answered, false);
  assert.equal(message.guided, true);
  const restored = reopen(p.saved.at(-1))[1];
  assert.equal(restored.className, "reply");
  assert.equal(restored.textContent, "가상 안내 답 <b>");
});

test("JSON 주소의 guided 답도 말풍선으로 그리고 빈 안내 답은 보류 문구로 바꾼다", async () => {
  for (const [answer, className, text] of [["가상 JSON 안내", "", "가상 JSON 안내"], ["  ", "fallback", heldText]]) {
    const p = page();
    const finished = begin(p);
    p.requests[0].reject(Error("가상 스트림 실패"));
    await setImmediate();
    p.requests[1].resolve({ ok: true, json: async () => ({ session_id: "fictional-session",
      answered: false, guided: true, answer, citations: [] }) });
    await finished;
    const reply = p.get(".test-reply");
    assert.equal(reply.children[0].className, className);
    assert.equal(reply.children[0].textContent, text);
    assert.equal(p.run("record.messages.at(-1).guided === true"), className === "");
  }
});

test("보류 표시가 없는 옛 기록은 근거 없는 답도 일반 말풍선으로 연다", () => {
  const [, restored] = reopen([{ id: "fictional-old", time: 1, messages: [
    { role: "question", text: "가상 옛 질문", sources: [] },
    { role: "answer", text: heldText, sources: [] },
  ] }]);
  assert.equal(restored.className, "reply");
});

test("보고 있는 대화에는 알림을 띄우지 않고 답을 저장한다", async () => {
  const p = page();
  p.get("#conversation-toast").hidden = true;
  const done = begin(p);
  p.requests[0].resolve(answer);
  await done;
  assert.equal(p.get("#conversation-toast").hidden, true);
  assert.equal(p.run("record.messages.at(-1).text"), "가상 답변");
  assert.equal(p.run("record.pending"), false);
});

test("대화를 떠나도 요청은 살아 있고 답이 원래 대화에 도착한다", async () => {
  const p = page();
  const done = begin(p);
  p.run("activeConversation=null;setChatView(false)");
  p.requests[0].resolve(answer);
  await done;
  assert.equal(p.document.body.attributes.get("data-view"), "home");
  assert.equal(p.run("record.messages.at(-1).text"), "가상 답변");
  assert.equal(p.get("#conversation-toast").hidden, false);
});

test("대화마다 요청 하나를 받고 다른 대화는 기다리지 않는다", async () => {
  const p = page();
  const first = begin(p);
  await p.run('ask("중복 가상 질문",reply,record)');
  assert.equal(p.requests.length, 1);
  const second = p.run(
    'var other={id:"fictional-2",messages:[],time:2};conversations.push(other);ask("다른 가상 질문",reply,other)',
  );
  assert.equal(p.requests.length, 2);
  p.requests[0].resolve(answer);
  p.requests[1].resolve(answer);
  await Promise.all([first, second]);
});

test("삭제한 대화와 이전 계정의 늦은 답은 기록과 알림에 나타나지 않는다", async () => {
  for (
    const action of ["conversations=[]", 'switchHistoryAccount("demo-d02")']
  ) {
    const p = page();
    p.get("#conversation-toast").hidden = true;
    const done = begin(p);
    p.run(action);
    p.requests[0].resolve(answer);
    await done;
    assert.equal(p.run("record.messages.length"), 1);
    assert.equal(p.get("#conversation-toast").hidden, true);
  }
});

test("실패는 해당 대화에 오류와 재시도를 남기고 도착 알림을 띄우지 않는다", async () => {
  const p = page();
  p.get("#conversation-toast").hidden = true;
  const done = begin(p);
  p.run("activeConversation=null;setChatView(false)");
  p.requests[0].reject(Error("가상 연결 실패"));
  await setImmediate();
  assert.equal(p.requests[1].path, "/api/v1/chat");
  p.requests[1].reject(Error("가상 재시도 연결 실패"));
  await done;
  assert.equal(p.get(".test-reply").children[0].className, "error");
  assert.equal(p.get(".test-reply").children[0].children[1].className, "retry");
  assert.equal(p.run("record.unread"), true);
  assert.equal(p.get("#conversation-toast").hidden, true);
});

test("가려진 탭에서 현재 대화의 답이 와도 읽지 않음 수를 제목에 붙인다", async () => {
  const p = page();
  const done = begin(p);
  p.document.hidden = true;
  p.requests[0].resolve(answer);
  await done;
  assert.equal(p.document.title, "(1) 가상 테크모");
  assert.equal(p.run("record.unread"), true);
  p.document.hidden = false;
  p.events.get("visibilitychange")();
  assert.equal(p.document.title, "가상 테크모");
});

test("답을 기다리는 동안 홈에서 보낸 질문은 새 대화로 시작한다", async () => {
  const p = page();
  const first = begin(p);
  p.run("setChatView(false)");
  p.get("#question").value = "다른 가상 질문";
  p.get("#composer").listeners.get("submit")({ preventDefault() {} });
  assert.equal(p.requests.length, 2);
  assert.equal(p.run("conversations.length"), 2);
  assert.equal(p.run("activeConversation === record"), false);
  p.requests[0].resolve(answer);
  p.requests[1].resolve(answer);
  await first;
  await setImmediate();
  assert.equal(p.run("conversations.every(record => !record.pending)"), true);
});

test("전환 콜백을 기다리는 동안 같은 질문을 다시 보내도 요청은 하나다", async () => {
  let apply;
  const p = page({
    transition(callback) {
      apply = callback;
      return {
        updateCallbackDone: new Promise(() => {}),
        finished: new Promise(() => {}),
      };
    },
  });
  const submit = () =>
    p.get("#composer").listeners.get("submit")({ preventDefault() {} });
  p.get("#question").value = "가상 질문";
  submit();
  p.get("#question").value = "중복 가상 질문";
  submit();
  assert.equal(p.requests.length, 1);
  apply();
  p.requests[0].resolve(answer);
  await setImmediate();
  assert.equal(p.run("activeConversation.messages.length"), 2);
});

test("데스크톱에서는 서랍을 열어 본문을 잠그지 않는다", () => {
  const p = page();
  p.window.matchMedia = () => ({ matches: false });
  p.run("setChatView(true); openDrawer()");
  assert.equal(p.document.body.attributes.has("data-conversation-drawer"), false);
  assert.notEqual(p.get("#composer").inert, true);
});

test("새 대화 한도를 적용할 때 최근 답변을 받은 예전 대화를 남긴다", async () => {
  const p = page();
  p.run(`conversations = Array.from({ length: 20 }, (_, index) => ({
    id: "fictional-" + index, time: 20 - index,
    messages: [{ role: "question", text: "가상 예전 질문" }], turns: [],
  })); conversations[19].time = Date.now() - 1;`);
  p.get("#question").value = "가상 새 질문";
  p.get("#composer").listeners.get("submit")({ preventDefault() {} });
  assert.equal(p.run("conversations.length"), 20);
  assert.equal(p.run('conversations.some(record => record.id === "fictional-19")'), true);
  assert.equal(p.run('conversations.some(record => record.id === "fictional-18")'), false);
  p.requests[0].resolve(answer);
  await setImmediate();
});

test("홈 전환 콜백 전에 새 질문을 보내면 늦은 홈 전환을 무시한다", async () => {
  const callbacks = [];
  const p = page({ transition(callback) {
    callbacks.push(callback);
    return { finished: new Promise(() => {}), updateCallbackDone: new Promise(() => {}) };
  } });
  p.run("setChatView(true)");
  callbacks.shift()();
  p.run("setChatView(false)");
  const back = callbacks.shift();
  p.get("#question").value = "가상 새 질문";
  p.get("#composer").listeners.get("submit")({ preventDefault() {} });
  back();
  assert.equal(p.document.body.attributes.get("data-view"), "chat");
  p.requests[0].resolve(answer);
  await setImmediate();
});

test("첫 전송의 전환 콜백 전에는 홈 DOM을 보존하고 뒤로 가기를 처리한다", async () => {
  let apply;
  const p = page({ transition(callback) {
    apply = callback;
    return { finished: new Promise(() => {}), updateCallbackDone: new Promise(() => {}) };
  } });
  p.get("#question").value = "가상 첫 질문";
  p.get("#composer").listeners.get("submit")({ preventDefault() {} });
  assert.equal(p.get("#transcript").children[0], p.get("#empty"));
  assert.equal(p.get("#transcript").children.length, 1);
  p.window.location.hash = "";
  p.windowEvents.get("popstate")();
  apply();
  assert.equal(p.document.body.attributes.get("data-view"), "home");
  assert.equal(p.get("#transcript").children[0], p.get("#empty"));
  p.requests[0].resolve(answer);
  await setImmediate();
});

test("저장된 글 대화를 다시 열어 이어 물으면 같은 대화에 질문과 답을 붙인다", async () => {
  const p = page({ storedConversations: [{
    id: "fictional-restored", time: 1,
    messages: [
      { role: "question", text: "가상 처음 질문", sources: [] },
      { role: "answer", text: "가상 처음 답변", sources: [] },
    ],
  }] });
  p.run('switchHistoryAccount("browse"); var restored = conversations[0]; openConversation(restored)');
  assert.equal(p.run('Object.hasOwn(restored, "photo")'), false);
  p.get("#question").value = "가상 후속 질문";
  p.get("#composer").listeners.get("submit")({ preventDefault() {} });
  assert.equal(p.run("conversations.length"), 1);
  assert.equal(p.run("activeConversation === restored"), true);
  assert.equal(p.get("#transcript").children.length, 2);
  assert.equal(JSON.parse(p.requests[0].options.body).session_id, null);
  p.requests[0].resolve(answer);
  await setImmediate();
  assert.equal(p.run("restored.messages.length"), 4);
  assert.equal(p.run("restored.messages.at(-1).text"), "가상 답변");
});

test("글·사진 대화 종류를 바꾸면 새 대화의 말풍선만 그린다", async () => {
  for (const startingPhoto of [false, true]) {
    const p = page();
    p.run(`var previous = { id: "fictional-previous", time: 1, photo: ${startingPhoto},
      messages: [{ role: "question", text: "가상 예전 질문", sources: [] }] };
      conversations = [previous]; openConversation(previous);`);
    const previousTurn = p.get("#transcript").children[0];
    p.get("#question").value = "가상 다른 종류 질문";
    if (!startingPhoto) {
      p.get("#photo-file").files = [{ type: "image/png", size: 10, slice: () => "fictional-photo" }];
    }
    p.get("#composer").listeners.get("submit")({ preventDefault() {} });
    assert.equal(p.run("conversations.length"), 2);
    assert.equal(p.run("activeConversation === previous"), false);
    assert.equal(p.get("#transcript").children.length, 1);
    assert.notEqual(p.get("#transcript").children[0], previousTurn);
    if (startingPhoto) {
      p.requests[0].resolve(answer);
      await setImmediate();
    } else {
      assert.equal(p.photoRequests.length, 1);
    }
  }
});

test("홈에서는 배경 대화가 답을 기다려도 첨부·제거·초기화 버튼이 동작한다", async () => {
  const p = page();
  const done = begin(p);
  p.run("setChatView(false)");
  assert.equal(p.get("#photo-attach").disabled, false);
  p.get("#photo-attach").click();
  assert.equal(p.get("#photo-file").clicks, 1);
  p.get("#photo-file").value = "fictional-selection";
  p.get("#photo-clear").click();
  assert.equal(p.get("#photo-file").value, "");
  p.get("#question").value = "가상 미전송 질문";
  p.get("#reset").click();
  assert.equal(p.get("#question").value, "");
  assert.equal(p.run("record.pending"), true);
  p.requests[0].resolve(answer);
  await done;
  assert.equal(p.run("record.messages.at(-1).text"), "가상 답변");
});

// --- 대화 메뉴·보관함·삭제 확인 창 (#104) -------------------------------------------------------

function history(p, records) {
  p.run(`conversations = ${JSON.stringify(records)}.map(record => ({ turns: [], saved: true, ...record }));
    var byId = id => conversations.find(record => record.id === id); renderConversations();`);
}
const fictional = (id, time, extra = {}) => ({
  id, time, messages: [{ role: "question", text: `가상 질문 ${id}`, sources: [] }], ...extra,
});
const listItems = p => p.get("#conversation-list").children.filter(node => node.className === "conversation-item");
const archiveGroup = p => p.get("#conversation-list").children.find(node => node.className === "conversation-archive");
const ids = nodes => nodes.map(node => node.attributes.get("data-conversation-id"));
const menuNode = p => p.document.body.children.find(node => node.attributes.get("role") === "menu");
const scrimNode = p => p.document.body.children.find(node => node.className === "confirm-scrim");
const escape = p => p.events.get("keydown")({ key: "Escape" });

test("점 세 개 버튼·우클릭·메뉴 키·Shift+F10이 같은 메뉴를 열고 화살표로 옮기며 Esc는 연 자리로 초점을 돌린다", () => {
  const p = page();
  history(p, [fictional("a", 2)]);
  const item = listItems(p)[0];
  const [open, more] = item.children;
  assert.equal(more.attributes.get("aria-label"), "대화 메뉴");
  assert.equal(more.attributes.get("aria-haspopup"), "menu");
  more.click();
  const menu = menuNode(p);
  assert.equal(menu.hidden, false);
  assert.equal(menu.id, "conversation-menu");
  assert.deepEqual(menu.children.map(node => node.textContent), ["보관하기", "삭제"]);
  assert.deepEqual(menu.children.map(node => node.attributes.get("role")), ["menuitem", "menuitem"]);
  assert.equal(more.attributes.get("aria-expanded"), "true");
  assert.equal(p.focus(), menu.children[0]);
  menu.fire("keydown", { key: "ArrowDown" });
  assert.equal(p.focus(), menu.children[1]);
  menu.fire("keydown", { key: "ArrowDown" });
  assert.equal(p.focus(), menu.children[0]);
  menu.fire("keydown", { key: "ArrowUp" });
  assert.equal(p.focus(), menu.children[1]);
  escape(p);
  assert.equal(menu.hidden, true);
  assert.equal(more.attributes.get("aria-expanded"), "false");
  assert.equal(p.focus(), more);

  const context = item.fire("contextmenu", { target: open, clientX: 50, clientY: 60 });
  assert.equal(context.prevented, true);
  assert.equal(menu.hidden, false);
  assert.equal(menu.properties.get("--conversation-menu-x"), "50px");
  assert.equal(menu.properties.get("--conversation-menu-y"), "60px");
  escape(p);
  assert.equal(p.focus(), open);
  for (const keys of [{ key: "ContextMenu" }, { key: "F10", shiftKey: true }]) {
    const pressed = item.fire("keydown", { target: open, ...keys });
    assert.equal(pressed.prevented, true, keys.key);
    assert.equal(menu.hidden, false, keys.key);
    escape(p);
    assert.equal(p.focus(), open, keys.key);
  }
  item.fire("keydown", { target: open, key: "F10" });
  assert.equal(menu.hidden, true);
  // 메뉴는 하나만 만들어 다시 쓰고, 문서 전체의 우클릭 메뉴는 막지 않는다.
  assert.equal(p.document.body.children.filter(node => node.attributes.get("role") === "menu").length, 1);
  assert.equal(p.events.has("contextmenu"), false);
  assert.equal(p.document.body.children.some(node => node.attributes.has("style")), false);
});

test("메뉴가 화면 밖으로 나가면 가장자리 8px 안으로 민다", () => {
  const p = page();
  history(p, [fictional("a", 2)]);
  const item = listItems(p)[0];
  item.children[1].click();
  const menu = menuNode(p);
  escape(p);
  Object.assign(p.window, { innerWidth: 300, innerHeight: 200 });
  menu.getBoundingClientRect = () => ({ width: 160, height: 100 });
  item.fire("contextmenu", { target: item.children[0], clientX: 290, clientY: 190 });
  assert.equal(menu.properties.get("--conversation-menu-x"), "132px");
  assert.equal(menu.properties.get("--conversation-menu-y"), "92px");
  escape(p);
  item.children[1].getBoundingClientRect = () => ({ left: 4, bottom: 3 });
  item.children[1].click();
  assert.equal(menu.properties.get("--conversation-menu-x"), "8px");
  assert.equal(menu.properties.get("--conversation-menu-y"), "8px");
});

test("바깥 누르기·스크롤·같은 버튼 다시 누르기로 메뉴를 닫는다", () => {
  const p = page();
  history(p, [fictional("a", 2)]);
  const more = listItems(p)[0].children[1];
  more.click();
  const menu = menuNode(p);
  p.events.get("pointerdown")({ target: menu.children[0] });
  assert.equal(menu.hidden, false);
  p.events.get("pointerdown")({ target: p.get("#question") });
  assert.equal(menu.hidden, true);
  assert.equal(p.focus(), more);
  more.click();
  p.events.get("scroll")({});
  assert.equal(menu.hidden, true);
  assert.equal(p.focus(), more);
  assert.equal(more.focusOptions?.preventScroll, true);
  more.click();
  p.events.get("pointerdown")({ target: more });
  assert.equal(menu.hidden, false);
  more.click();
  assert.equal(menu.hidden, true);
});

test("길게 누르기는 500ms 뒤 누른 자리에 메뉴를 열고 따라오는 클릭 한 번은 대화를 열지 않는다", () => {
  const p = page();
  history(p, [fictional("a", 2)]);
  const open = listItems(p)[0].children[0];
  const touch = { pointerType: "touch", isPrimary: true, clientX: 20, clientY: 30 };
  open.fire("pointerdown", touch);
  p.tick(499);
  assert.equal(menuNode(p), undefined);
  p.tick(500);
  const menu = menuNode(p);
  assert.equal(menu.hidden, false);
  assert.equal(menu.properties.get("--conversation-menu-x"), "20px");
  open.fire("pointerup", touch);
  open.click();
  assert.equal(p.run("activeConversation"), null);
  assert.equal(menu.hidden, false);
  escape(p);
  open.click();
  assert.equal(p.run("activeConversation === byId('a')"), true);
});

test("길게 누르기는 손 떼기·이동·스크롤·pointercancel에서 취소하고 마우스는 세지 않는다", () => {
  const cancels = [
    ["손 떼기", open => open.fire("pointerup")],
    ["벗어남", open => open.fire("pointerleave")],
    ["pointercancel", open => open.fire("pointercancel")],
    ["이동", open => open.fire("pointermove", { clientX: 31, clientY: 30 })],
    ["스크롤", (open, p) => p.events.get("scroll")({})],
  ];
  for (const [name, cancel] of cancels) {
    const p = page();
    history(p, [fictional("a", 2)]);
    const open = listItems(p)[0].children[0];
    open.fire("pointerdown", { pointerType: "touch", isPrimary: true, clientX: 20, clientY: 30 });
    cancel(open, p);
    p.tick(500);
    assert.equal(menuNode(p), undefined, name);
    open.click();
    assert.equal(p.run("activeConversation === byId('a')"), true, name);
  }
  const p = page();
  history(p, [fictional("a", 2)]);
  const open = listItems(p)[0].children[0];
  open.fire("pointerdown", { pointerType: "touch", isPrimary: true, clientX: 20, clientY: 30 });
  open.fire("pointermove", { clientX: 25, clientY: 34 });
  p.tick(500);
  assert.equal(menuNode(p).hidden, false, "10px 안의 떨림은 취소하지 않는다");
  escape(p);
  open.fire("pointerdown", { pointerType: "mouse", isPrimary: true, clientX: 20, clientY: 30 });
  p.tick(500);
  assert.equal(menuNode(p).hidden, true);
});

test("보관함은 접힌 채 시작하고 보관·해제는 같은 객체의 archived만 바꿔 원래 최근 순 자리로 돌아온다", () => {
  const p = page();
  history(p, [fictional("c", 3), fictional("a", 2, { archived: true }), fictional("b", 1)]);
  assert.deepEqual(ids(listItems(p)), ["c", "b"]);
  let group = archiveGroup(p);
  const [toggle, archived] = group.children;
  assert.equal(toggle.textContent, "보관함 (1)");
  assert.equal(toggle.attributes.get("aria-expanded"), "false");
  assert.equal(archived.hidden, true);
  toggle.click();
  group = archiveGroup(p);
  assert.equal(group.children[0].attributes.get("aria-expanded"), "true");
  assert.equal(group.children[1].hidden, false);
  assert.equal(p.focus(), group.children[0]);
  const record = p.run("byId('a')");
  group.children[1].children[0].children[1].click();
  const menu = menuNode(p);
  assert.deepEqual(menu.children.map(node => node.textContent), ["보관 해제", "삭제"]);
  menu.fire("keydown", { key: "Enter" });
  assert.deepEqual(ids(listItems(p)), ["c", "a", "b"]);
  assert.equal(archiveGroup(p), undefined);
  assert.equal(p.run("byId('a')"), record);
  assert.equal(record.archived, false);
  assert.equal(record.time, 2);
  assert.equal(p.focus(), listItems(p)[1].children[1]);
  assert.equal(p.saved.at(-1).find(saved => saved.id === "a").archived, false);

  // 보관하면 접힌 보관함으로 옮기고, 초점은 목록의 다음 항목으로 간다.
  p.run("archiveOpen = false; renderConversations()");
  listItems(p)[1].children[1].click();
  menuNode(p).fire("keydown", { key: "Enter" });
  assert.equal(record.archived, true);
  assert.equal(p.run("conversations.length"), 3);
  assert.deepEqual(ids(listItems(p)), ["c", "b"]);
  assert.equal(archiveGroup(p).children[0].textContent, "보관함 (1)");
  assert.equal(p.focus(), listItems(p)[1].children[0]);
  assert.equal(p.saved.at(-1).find(saved => saved.id === "a").archived, true);
});

test("보던 대화를 보관하면 새 대화 화면을 열고, 전송을 받아들일 때만 보관을 푼다", async () => {
  const p = page();
  history(p, [fictional("a", 2)]);
  p.run("openConversation(byId('a'))");
  listItems(p)[0].children[1].click();
  menuNode(p).fire("keydown", { key: "Enter" });
  assert.equal(p.run("byId('a').archived"), true);
  assert.equal(p.run("activeConversation"), null);
  assert.equal(p.document.body.attributes.get("data-view"), "chat");
  assert.equal(p.focus(), p.get("#question"));
  p.run("openConversation(byId('a'))");
  assert.equal(p.run("byId('a').archived"), true, "열기만 해서는 보관이 풀리지 않는다");
  const submit = () => p.get("#composer").listeners.get("submit")({ preventDefault() {} });
  p.get("#question").value = "   ";
  submit();
  p.run("byId('a').pending = true");
  p.get("#question").value = "가상 거부될 질문";
  submit();
  assert.equal(p.run("byId('a').archived"), true, "거부된 전송은 보관을 유지한다");
  assert.equal(p.requests.length, 0);
  p.run("byId('a').pending = false");
  p.get("#question").value = "가상 이어 묻기";
  submit();
  assert.equal(p.run("byId('a').archived"), false);
  assert.equal(p.run("activeConversation === byId('a')"), true);
  assert.equal(p.saved.at(-1)[0].archived, false);
  assert.deepEqual(ids(listItems(p)), ["a"]);
  p.requests[0].resolve(answer);
  await setImmediate();
});

test("보관된 대화에도 늦은 답·도착 알림·읽지 않음 점이 붙는다", async () => {
  const p = page();
  const done = begin(p);
  p.run("record.archived = true; activeConversation = null; setChatView(false)");
  p.requests[0].resolve(answer);
  await done;
  assert.equal(p.run("record.messages.at(-1).text"), "가상 답변");
  assert.equal(p.run("record.unread"), true);
  assert.equal(p.get("#conversation-toast").hidden, false);
  const [toggle, archived] = archiveGroup(p).children;
  assert.equal(toggle.children.at(-1).className, "conversation-unread");
  assert.equal(archived.children[0].children[0].children.at(-1).className, "conversation-unread");
});

test("하나 삭제는 화면 안 alertdialog로 묻고 취소는 기록을 바꾸지 않으며 삭제 뒤 초점은 다음 항목으로 간다", () => {
  const p = page();
  history(p, [fictional("a", 3), { ...fictional("b", 2), title: "가상 스물다섯 글자를 넘기는 아주 긴 대화 제목" }, fictional("c", 1)]);
  const openDelete = index => {
    listItems(p)[index].children[1].click();
    const menu = menuNode(p);
    menu.fire("keydown", { key: "ArrowDown" });
    menu.fire("keydown", { key: "Enter" });
  };
  openDelete(1);
  const scrim = scrimNode(p);
  const box = scrim.children[0];
  const [title, text, actions] = box.children;
  const [remove, cancel] = actions.children;
  assert.equal(scrim.hidden, false);
  assert.equal(menuNode(p).hidden, true);
  assert.equal(box.attributes.get("role"), "alertdialog");
  assert.equal(box.attributes.get("aria-modal"), "true");
  assert.equal(box.attributes.get("aria-labelledby"), title.id);
  assert.equal(box.attributes.get("aria-describedby"), text.id);
  assert.equal(title.textContent, "정말로 삭제하시겠습니까?");
  assert.equal(text.textContent, "‘가상 스물다섯 글자를 넘기는 아주 긴’ 대화를 지우면 되돌릴 수 없어요.");
  assert.deepEqual([remove.textContent, cancel.textContent], ["삭제", "취소"]);
  assert.equal(remove.className, "confirm-delete");
  assert.equal(p.focus(), cancel);
  assert.equal(menuNode(p).inert, true, "뒤쪽은 inert로 막는다");
  box.fire("keydown", { key: "Tab" });
  assert.equal(p.focus(), remove);
  box.fire("keydown", { key: "Tab" });
  assert.equal(p.focus(), cancel);
  const back = box.fire("keydown", { key: "Tab", shiftKey: true });
  assert.equal(back.prevented, true);
  assert.equal(p.focus(), remove);

  const more = listItems(p)[1].children[1];
  escape(p);
  assert.equal(scrim.hidden, true);
  assert.notEqual(menuNode(p).inert, true);
  assert.equal(p.run("conversations.length"), 3);
  assert.equal(p.focus(), more);
  openDelete(1);
  scrim.fire("click", { target: box });
  assert.equal(scrim.hidden, false, "상자 안 클릭은 닫지 않는다");
  scrim.click();
  assert.equal(scrim.hidden, true);
  assert.equal(p.run("conversations.length"), 3);
  openDelete(1);
  remove.click();
  assert.equal(p.run("conversations.some(record => record.id === 'b')"), false);
  assert.deepEqual(Array.from(p.saved.at(-1), record => record.id), ["a", "c"]);
  assert.equal(p.focus(), listItems(p)[1].children[0]);
  openDelete(1);
  remove.click();
  assert.equal(p.focus(), p.get("#new-conversation"));
  assert.equal(p.document.body.children.filter(node => node.className === "confirm-scrim").length, 1);
});

test("제목이 없는 대화의 삭제 확인은 새 대화라고 부른다", () => {
  const p = page();
  history(p, [{ id: "a", time: 1, messages: [{ role: "question", text: "", sources: [] }] }]);
  listItems(p)[0].children[1].click();
  menuNode(p).fire("keydown", { key: "End" });
  menuNode(p).fire("keydown", { key: "Enter" });
  assert.equal(scrimNode(p).children[0].children[1].textContent, "‘새 대화’ 대화를 지우면 되돌릴 수 없어요.");
});

test("답을 기다리는 대화를 지우면 늦은 답을 버리고 취소하면 요청을 그대로 둔다", async () => {
  const p = page();
  const done = begin(p);
  p.run("renderConversations()");
  const openDelete = () => {
    listItems(p)[0].children[1].click();
    menuNode(p).fire("keydown", { key: "End" });
    menuNode(p).fire("keydown", { key: "Enter" });
  };
  openDelete();
  escape(p);
  assert.equal(p.run("record.pending"), true);
  openDelete();
  scrimNode(p).children[0].children[2].children[0].click();
  assert.equal(p.run("conversations.length"), 0);
  assert.equal(p.run("activeConversation"), null);
  p.get("#conversation-toast").hidden = true;
  p.requests[0].resolve(answer);
  await done;
  assert.equal(p.run("record.messages.length"), 1);
  assert.equal(p.get("#conversation-toast").hidden, true);
});

test("기록 모두 지우기는 보관함을 포함한 개수를 묻고 확인 창 → 메뉴 → 서랍 순으로 Esc가 하나씩 닫는다", () => {
  const p = page();
  p.window.matchMedia = () => ({ matches: true });
  history(p, [fictional("a", 2), fictional("b", 1, { archived: true })]);
  p.run("setChatView(true)");
  const shell = p.get(".fictional-shell"), kept = p.get(".fictional-kept");
  shell.inert = false;
  kept.inert = true;
  p.document.body.append(shell, kept);
  p.get("#conversation-toggle").click();
  assert.equal(p.get("#composer").inert, true);
  const clear = p.get("#clear-conversations");
  clear.click();
  const scrim = scrimNode(p);
  const [title, text] = scrim.children[0].children;
  assert.equal(title.textContent, "대화 기록을 모두 삭제하시겠습니까?");
  assert.equal(text.textContent, "보관함을 포함한 대화 2개가 지워지고 되돌릴 수 없어요.");
  assert.equal(shell.inert, true);
  escape(p);
  assert.equal(scrim.hidden, true);
  assert.equal(p.document.body.attributes.get("data-conversation-drawer"), "open", "확인 창만 닫는다");
  assert.equal(shell.inert, false);
  assert.equal(kept.inert, true, "원래 inert 값을 되돌린다");
  assert.equal(p.get("#composer").inert, true, "서랍의 inert는 그대로다");
  assert.equal(p.focus(), clear);
  assert.equal(p.run("conversations.length"), 2);

  listItems(p)[0].children[1].click();
  escape(p);
  assert.equal(menuNode(p).hidden, true);
  assert.equal(p.document.body.attributes.get("data-conversation-drawer"), "open", "메뉴만 닫는다");
  escape(p);
  assert.equal(p.document.body.attributes.has("data-conversation-drawer"), false);

  p.get("#conversation-toggle").click();
  clear.click();
  scrim.children[0].children[2].children[0].click();
  assert.equal(p.run("conversations.length"), 0);
  assert.equal(p.focus(), clear);
});

test("확인 창이나 메뉴가 열린 채 뒤로 가기로 홈에 가면 취소로 닫고 보이는 입력창에 초점을 둔다", () => {
  const p = page();
  p.run("setChatView(true)");
  history(p, [fictional("a", 2), fictional("b", 1)]);
  listItems(p)[0].children[1].click();
  menuNode(p).fire("keydown", { key: "End" });
  menuNode(p).fire("keydown", { key: "Enter" });
  const scrim = scrimNode(p);
  assert.equal(scrim.hidden, false);
  p.window.location.hash = "";
  p.windowEvents.get("popstate")();
  assert.equal(p.document.body.attributes.get("data-view"), "home");
  assert.equal(p.get("#conversation-sidebar").hidden, true);
  assert.equal(scrim.hidden, true);
  assert.notEqual(menuNode(p).inert, true);
  assert.equal(p.run("conversations.length"), 2, "화면 이동은 취소다");
  assert.equal(p.focus(), p.get("#question"));
  escape(p);
  assert.equal(p.focus(), p.get("#question"));

  p.run("setChatView(true)");
  listItems(p)[0].children[1].click();
  assert.equal(menuNode(p).hidden, false);
  p.windowEvents.get("popstate")();
  assert.equal(menuNode(p).hidden, true);
  assert.equal(p.focus(), p.get("#question"));
});

test("좁은 화면의 서랍에서 확인 창·메뉴를 연 채 뒤로 가면 서랍 inert가 풀린 뒤 입력창에 초점을 둔다", () => {
  for (const overlay of ["confirm", "menu"]) {
    const p = page();
    p.window.matchMedia = () => ({ matches: true });
    // 실제 화면처럼 입력창을 composer 안에 둔다. 서랍이 composer에 건 inert가 입력창 초점을 막는다.
    p.get("#composer").append(p.get("#question"));
    p.run("setChatView(true)");
    history(p, [fictional("a", 2), fictional("b", 1)]);
    const sidebar = p.get("#conversation-sidebar");
    sidebar.append(p.get("#conversation-list"));
    p.get("#conversation-toggle").click();
    assert.equal(p.get("#composer").inert, true, overlay);
    listItems(p)[0].children[1].click();
    if (overlay === "confirm") {
      menuNode(p).fire("keydown", { key: "End" });
      menuNode(p).fire("keydown", { key: "Enter" });
      assert.equal(scrimNode(p).hidden, false, overlay);
    }
    p.window.location.hash = "";
    p.windowEvents.get("popstate")();
    assert.equal(p.document.body.attributes.has("data-conversation-drawer"), false, overlay);
    assert.equal(p.get("#composer").inert, false, overlay);
    assert.equal(menuNode(p).hidden, true, overlay);
    if (scrimNode(p)) assert.equal(scrimNode(p).hidden, true, overlay);
    assert.equal(p.run("conversations.length"), 2, overlay);
    assert.equal(p.focus(), p.get("#question"), overlay);
  }
});

test("서랍 목록에 초점이 있는 채 뒤로 가 목록이 숨으면 입력창으로 초점을 옮긴다", () => {
  const p = page();
  p.window.matchMedia = () => ({ matches: true });
  p.get("#composer").append(p.get("#question"));
  p.run("setChatView(true)");
  history(p, [fictional("a", 2)]);
  p.get("#conversation-sidebar").append(p.get("#conversation-list"));
  p.get("#conversation-toggle").click();
  listItems(p)[0].children[0].focus();
  p.window.location.hash = "";
  p.windowEvents.get("popstate")();
  assert.equal(p.focus(), p.get("#question"));
});

test("목록이 숨은 뒤 확인 창을 취소하면 숨은 목록 대신 입력창으로 초점을 보낸다", () => {
  const p = page();
  history(p, [fictional("a", 2)]);
  listItems(p)[0].children[1].click();
  menuNode(p).fire("keydown", { key: "End" });
  menuNode(p).fire("keydown", { key: "Enter" });
  p.get("#conversation-sidebar").hidden = true;
  escape(p);
  assert.equal(scrimNode(p).hidden, true);
  assert.equal(p.focus(), p.get("#question"));
});
