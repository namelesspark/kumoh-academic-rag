import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../../app/chat_web/assets/chat.js", import.meta.url), "utf8");
const historyKey = "kumoh-chat-history:v1:browse";
const message = (role, text, sources = []) => ({ role, text, sources, time: 1 });
const question = "가상 첫 질문";
const answer = "가상 첫 답";
const legacy = [
  message("question", question),
  message("answer", answer),
  message("question", "가상 다음 질문"),
  message("answer", "가상 다음 답"),
];

function section(from, to) {
  const start = from ? source.indexOf(from) : 0;
  const end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, from ?? to);
  return source.slice(start, end);
}

const controller = [
  section(null, "const transcript ="),
  section("const sidebar =", "function storedStudentId("),
  section("function updateSend(", "function setBusy("),
  section("function isSafeSourceUrl(", "function citationCard("),
  section("function applyLang(", "function localizeReplyAuthors("),
  section("async function readChatStream(", 'input.addEventListener("input"'),
  section("function stopActiveAnswer(", "// 보내기 버튼에 초점을 두고"),
  // #173: 입력창 제출 처리기를 그대로 돌려 새 질문을 보낸다. 사진 첨부 분기는 쓰지 않는다.
  section('composer.addEventListener("submit"', "// 클립 버튼은"),
].join("\n");

function page(values = new Map([[historyKey, JSON.stringify([{ id: "fictional-chat", time: 1, messages: legacy }])]])) {
  let focus;
  class Node {
    children = [];
    attributes = new Map();
    className = "";
    dataset = {};
    listeners = new Map();
    text = "";
    value = "";
    #disabled = false;
    classList = { contains: name => this.className.split(" ").includes(name) };
    get disabled() { return this.#disabled; }
    set disabled(value) {
      this.#disabled = Boolean(value);
      if (this.#disabled && focus === this) focus = null;
    }
    get isConnected() { return get("body").contains(this); }
    get textContent() { return this.text + this.children.map(item => item.textContent ?? item).join(""); }
    set textContent(value) { this.text = value ?? ""; this.replaceChildren(); }
    append(...children) {
      for (const child of children) {
        if (child instanceof Node) {
          child.remove();
          child.parentNode = this;
        }
        this.children.push(child);
      }
    }
    insertBefore(child, before) {
      child.remove();
      const position = this.children.indexOf(before);
      assert.notEqual(position, -1);
      this.children.splice(position, 0, child);
      child.parentNode = this;
    }
    replaceChildren(...children) {
      for (const child of this.children) if (child instanceof Node) child.remove();
      this.children = [];
      this.append(...children);
    }
    remove() {
      if (this.contains(focus)) focus = null;
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
      this.parentNode = null;
    }
    matches(selector) {
      const [tag, name] = selector.split(".");
      return (!tag || this.tagName === tag.toUpperCase()) && (!name || this.classList.contains(name));
    }
    querySelectorAll(selector) {
      return this.children.filter(child => child instanceof Node).flatMap(child =>
        [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    contains(node) {
      for (let current = node; current; current = current.parentNode) if (current === this) return true;
      return false;
    }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
    }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) {
      this.attributes.delete(name);
      if (name === "data-version-state") delete this.dataset.versionState;
    }
    focus() { if (!this.disabled && this.isConnected) focus = this; }
    select() {}
    setSelectionRange() {}
    addEventListener(name, callback) {
      const listeners = this.listeners.get(name) ?? [];
      listeners.push(callback);
      this.listeners.set(name, listeners);
    }
    fire(name, fields = {}) {
      const event = { target: this, preventDefault() {}, stopPropagation() { this.stopped = true; }, ...fields };
      for (let node = this; node && !event.stopped; node = node.parentNode) {
        for (const callback of node.listeners.get(name) ?? []) callback(event);
      }
    }
    click() { if (!this.disabled) this.fire("click"); }
  }
  const nodes = new Map();
  function get(selector) {
    if (!nodes.has(selector)) nodes.set(selector, new Node());
    return nodes.get(selector);
  }
  const transcript = get("#transcript");
  const theme = get("#theme-button");
  const conversationList = get("#conversation-list");
  get("body").append(transcript, get("#question"), theme, conversationList);
  const requests = [], timeouts = [];
  const context = {
    window: {
      innerWidth: 800,
      location: { pathname: "/chat", search: "", hash: "" },
      localStorage: {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key),
      },
    },
    document: {
      body: get("body"), title: "가상 채팅", querySelector: get,
      querySelectorAll: selector => get("body").querySelectorAll(selector),
      createTextNode: text => text,
      get activeElement() { return focus ?? this.body; },
    },
    URL, TextDecoder, AbortController,
    AbortSignal: {
      any: AbortSignal.any,
      timeout() {
        const timeout = new AbortController();
        timeouts.push(() => timeout.abort(new DOMException("가상 시간 초과", "TimeoutError")));
        return timeout.signal;
      },
    },
    transcript, empty: get("#empty"), composer: get("#composer"),
    input: get("#question"), reset: get("#reset"), assistant: get("#pet-dock"),
    photoFile: get("#photo-file"), photoNote: get("#photo-note"), photoClear: get("#photo-clear"), photoAttach: get("#photo-attach"), send: get("#send"),
    aiMode: "fast", busy: false, sessionId: null, chatRequestNumber: 0,
    setTimeout() {}, clearTimeout() {}, reducedMotion: () => true,
    techmoBubble() {}, scrollToLatest() {}, showAssistant() {}, celebrate() {}, localizeReplyAuthors() {},
    showTitle() {}, resay() {}, translateStatic() {}, renderTitles() {}, renderLangButtons() {},
    sourceLink: (url, title) => context.element("a", "test-source", title),
    citationCard: () => new Node(),
    element(tag, className = "", text) {
      const node = new Node();
      node.tagName = tag.toUpperCase();
      node.className = className ?? "";
      node.textContent = text;
      return node;
    },
    fetch(path, options) {
      return new Promise((resolve, reject) => requests.push({ path, options, resolve, reject }));
    },
  };
  const run = code => runInNewContext(code, context);
  run(controller + '\nswitchHistoryAccount("browse"); openConversation(conversations[0]);');
  return {
    run, transcript, conversationList, requests, timeouts, values,
    body: context.document.body, input: context.input, theme,
    raw: () => values.get(historyKey), focus: () => context.document.activeElement,
  };
}

function turn(p, index = 0) {
  const node = p.transcript.querySelectorAll(".turn")[index];
  assert.ok(node, `가상 대화의 ${index + 1}번째 차례`);
  return node;
}

function find(p, selector, index = 0) {
  const node = turn(p, index).querySelector(selector);
  assert.ok(node, selector);
  return node;
}

function edit(p, text, index = 0) {
  find(p, ".turn-edit", index).click();
  const form = find(p, "form.turn-editor", index);
  const field = form.querySelector("textarea");
  field.value = text;
  form.querySelector(".turn-editor-submit").focus();
  form.fire("submit");
  return field;
}

function stream(request, { honorAbort = true } = {}) {
  const encoder = new TextEncoder();
  let output;
  const body = new ReadableStream({ start(controller) { output = controller; } });
  if (honorAbort) request.options.signal.addEventListener("abort",
    () => output.error(request.options.signal.reason), { once: true });
  request.resolve({ ok: true, body });
  const emit = (name, data) => output.enqueue(encoder.encode(
    `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`,
  ));
  return {
    emit,
    done(flags = {}) { emit("done", flags); output.close(); },
    close() { output.close(); },
  };
}

async function finish(request, text, flags = {}, citations = []) {
  assert.equal(request.path, "/api/v1/chat/stream");
  const out = stream(request);
  out.emit("meta", { answered: true, citations, session_id: "fictional-session" });
  out.emit("answer", { text });
  out.done(flags);
  await setImmediate();
}

const savedMessages = p => JSON.parse(p.raw())[0].messages;
const sentQuestion = request => JSON.parse(request.options.body).message;

test("두 번째 질문을 수정하면 같은 수정 버튼에 한 번 초점이 돌아오고 두 버전을 복원한다", async () => {
  const p = page();
  assert.equal(turn(p).querySelector(".version-picker"), null);
  const original = p.raw();
  const revised = "가상 슬쩍 고친 질문";
  const revisedAnswer = "가상 안내 답";
  const button = find(p, ".turn-edit", 1);
  const focusButton = button.focus.bind(button);
  let focusCalls = 0;
  button.focus = () => {
    focusCalls++;
    assert.equal(button.disabled, false);
    focusButton();
  };
  const field = edit(p, revised, 1);
  assert.equal(p.focus(), field);
  assert.equal(field.readOnly, true);
  assert.equal(p.requests.length, 1);
  assert.equal(sentQuestion(p.requests[0]), revised);
  assert.equal(turn(p, 1).dataset.versionState, "pending");
  for (const index of [0, 1]) {
    for (const selector of [".turn-edit", ".turn-regenerate"]) {
      assert.equal(turn(p, index).querySelector(selector).disabled, true);
    }
  }
  assert.match(find(p, ".question").textContent, /가상 첫 질문/);
  assert.equal(find(p, ".reply").textContent, answer);
  assert.equal(p.raw(), original);
  await finish(p.requests[0], revisedAnswer, { answered: false, guided: true });
  assert.equal(p.requests.length, 1);
  assert.equal(p.focus(), button);
  p.body.focus();
  p.run("updateSend()");
  assert.equal(p.focus(), p.body);
  assert.equal(focusCalls, 1);
  assert.equal(find(p, ".version-count", 1).textContent, "2/2");
  assert.equal(find(p, ".version-count", 1).getAttribute("aria-live"), "polite");
  assert.equal(find(p, ".version-next", 1).disabled, true);
  assert.deepEqual(savedMessages(p).map(entry => entry.text), [question, answer, revised, revisedAnswer]);
  assert.equal(savedMessages(p)[3].guided, true);
  assert.equal(Object.hasOwn(savedMessages(p)[3], "versions"), false);
  const saved = savedMessages(p)[2];
  assert.equal(saved.selected, 1);
  assert.deepEqual(saved.versions.map(version => [version.question.text, version.answer.text]),
    [["가상 다음 질문", "가상 다음 답"], [revised, revisedAnswer]]);

  const reopened = page(p.values);
  assert.equal(find(reopened, ".version-count", 1).textContent, "2/2");
  assert.equal(find(reopened, ".question", 1).textContent, revised);
  assert.equal(find(reopened, ".reply", 1).textContent, revisedAnswer);
  find(reopened, ".version-prev", 1).click();
  const older = page(p.values);
  assert.equal(find(older, ".version-count", 1).textContent, "1/2");
  assert.equal(find(older, ".question", 1).textContent, "가상 다음 질문");
  assert.equal(find(older, ".reply", 1).textContent, "가상 다음 답");
  assert.equal(find(older, ".version-prev", 1).disabled, true);
  find(older, ".version-next", 1).click();
  assert.equal(find(older, ".question", 1).textContent, revised);
  assert.equal(find(older, ".reply", 1).textContent, revisedAnswer);
  find(older, ".turn-regenerate", 1).click();
  assert.equal(sentQuestion(older.requests[0]), revised);
  assert.equal(find(older, ".version-next", 1).disabled, true);
  assert.equal(find(older, ".version-prev", 1).disabled, true);
  assert.equal(find(older, ".turn-regenerate").disabled, true);
  await finish(older.requests[0], "가상 보류 답", { answered: false });
  assert.equal(find(older, ".version-count", 1).textContent, "3/3");
  assert.equal(savedMessages(older)[3].answered, false);
  assert.equal(savedMessages(older)[2].text, revised);
});

for (const [label, target] of [["질문 입력창", "input"], ["테마 버튼", "theme"]]) {
  test(`수정 답을 기다리며 ${label}으로 옮긴 초점을 유지한다`, async () => {
    const p = page();
    edit(p, "가상 고친 질문");
    p[target].focus();
    assert.equal(p.focus(), p[target]);
    await finish(p.requests[0], "가상 고친 답");
    assert.equal(find(p, ".version-count").textContent, "2/2");
    assert.equal(p.focus(), p[target]);
  });
}

test("다른 대화에서 수정 답을 받아도 초점을 가져가지 않고 돌아와도 그대로 둔다", async () => {
  const p = page(new Map([[historyKey, JSON.stringify([
    { id: "fictional-chat", messages: legacy },
    { id: "fictional-other", messages: [message("question", "가상 다른 대화 질문")] },
  ])]]));
  edit(p, "가상 고친 질문");
  p.run('openConversation(conversations.find(record => record.id === "fictional-other"))');
  assert.equal(p.focus(), p.body);
  await finish(p.requests[0], "가상 다른 화면에서 받은 답");
  assert.equal(p.focus(), p.body);
  p.run('openConversation(conversations.find(record => record.id === "fictional-chat"))');
  assert.equal(find(p, ".version-count").textContent, "2/2");
  assert.equal(p.focus(), p.body);
});

test("옛 기록에서 답만 남은 말풍선과 답 없는 질문을 그리고 Esc는 편집 초점을 돌려준다", () => {
  const p = page(new Map([[historyKey, JSON.stringify([{ id: "fictional-chat", messages: [
    message("answer", "가상 남은 답"),
    message("question", "가상 답 없는 질문"),
  ] }])]]));
  assert.equal(turn(p, 0).querySelector(".reply").textContent, "가상 남은 답");
  assert.equal(turn(p, 0).querySelector(".turn-edit"), null);
  turn(p, 1).querySelector(".turn-edit").click();
  const form = turn(p, 1).querySelector("form.turn-editor");
  const field = form.querySelector("textarea");
  assert.equal(field.value, "가상 답 없는 질문");
  assert.equal(p.focus(), field);
  field.value = "가상 취소한 초안";
  field.fire("keydown", { key: "Escape" });
  assert.equal(turn(p, 1).querySelector(".turn-editor"), null);
  assert.equal(p.focus(), turn(p, 1).querySelector(".turn-edit"));
  assert.match(turn(p, 1).querySelector(".question").textContent, /가상 답 없는 질문/);
  assert.equal(p.requests.length, 0);
});

test("부분 답 뒤 실패하면 초안을 보존하고 다시 시도하며, 정지하면 버전을 추가하지 않는다", async () => {
  const p = page();
  edit(p, "가상 수정할 초안");
  const original = p.raw();
  const out = stream(p.requests[0]);
  out.emit("meta", { answered: true });
  out.emit("answer", { text: "가상 미완성 답" });
  await setImmediate();
  assert.equal(p.raw(), original);
  out.close();
  await setImmediate();
  assert.equal(p.requests[1].path, "/api/v1/chat");
  assert.equal(sentQuestion(p.requests[1]), "가상 수정할 초안");
  p.requests[1].resolve({ ok: false });
  await setImmediate();
  assert.equal(p.raw(), original);
  assert.equal(turn(p).dataset.versionState, "failed");
  assert.ok(find(p, ".version-error").textContent);
  const form = find(p, "form.turn-editor");
  assert.equal(p.focus(), form.querySelector("textarea"));
  assert.equal(form.querySelector("textarea").value, "가상 수정할 초안");
  assert.equal(form.querySelector(".turn-editor-submit").textContent, "다시 시도");
  form.fire("submit");
  const second = stream(p.requests[2]);
  second.emit("meta", { answered: true });
  second.emit("answer", { text: "가상 정지된 부분 답" });
  await setImmediate();
  assert.equal(p.run("stopActiveAnswer()"), true);
  await setImmediate();
  assert.equal(p.requests.length, 3);
  assert.equal(p.focus(), p.input);
  assert.equal(p.raw(), original);
  assert.equal(find(p, ".reply").textContent, answer);
  assert.equal(turn(p).querySelector(".version-picker"), null);
});

test("시간 초과가 나면 선택과 저장 기록을 유지한다", async () => {
  const p = page();
  find(p, ".turn-regenerate").click();
  const original = p.raw();
  const out = stream(p.requests[0]);
  out.emit("meta", { answered: true });
  out.emit("answer", { text: "가상 시간 초과 전 답" });
  await setImmediate();
  p.timeouts[0]();
  await setImmediate();
  const fallback = p.requests[1];
  if (fallback) {
    assert.equal(fallback.path, "/api/v1/chat");
    fallback.reject(new DOMException("가상 시간 초과", "TimeoutError"));
    await setImmediate();
  }
  assert.equal(turn(p).dataset.versionState, "failed");
  assert.equal(p.raw(), original);
  assert.equal(find(p, ".reply").textContent, answer);
});

function startRegenerate(p) {
  const button = find(p, ".turn-regenerate", 1);
  button.focus();
  assert.equal(p.focus(), button);
  button.click();
  assert.equal(button.disabled, true);
  assert.equal(p.focus(), p.body);
  assert.equal(sentQuestion(p.requests.at(-1)), legacy[2].text);
  return button;
}

function assertSecondAnswer(p, text, previousAnswers = [legacy[3].text]) {
  const messages = savedMessages(p);
  const total = previousAnswers.length + 1;
  assert.equal(find(p, ".version-count", 1).textContent, `${total}/${total}`);
  assert.equal(find(p, ".question", 1).textContent, legacy[2].text);
  assert.equal(find(p, ".reply", 1).textContent, text);
  assert.deepEqual(messages.slice(0, 2), legacy.slice(0, 2));
  assert.deepEqual(messages.slice(2).map(entry => entry.text), [legacy[2].text, text]);
  assert.equal(messages[2].selected, total - 1);
  assert.deepEqual(messages[2].versions.map(version => [version.question.text, version.answer.text]),
    [...previousAnswers, text].map(reply => [legacy[2].text, reply]));
}

test("스트림 답을 받으면 두 번째 문답의 버튼으로 한 번 돌아오고 언어를 바꿔도 초점을 다시 옮기지 않는다", async () => {
  const p = page();
  const button = startRegenerate(p);
  const focusButton = button.focus.bind(button);
  let focusCalls = 0;
  button.focus = () => {
    focusCalls++;
    assert.equal(button.disabled, false);
    focusButton();
  };
  await finish(p.requests[0], "가상 스트림 답");
  assert.equal(p.focus(), button);
  assert.equal(button.textContent, "다시 답하기");
  assertSecondAnswer(p, "가상 스트림 답");
  p.body.focus();
  p.run('applyLang("en")');
  assert.equal(button.textContent, "Answer again");
  assert.equal(p.focus(), p.body);
  assert.equal(focusCalls, 1);
});

test("JSON 대체 답 성공 뒤에도 두 번째 문답의 다시 답하기 버튼으로 초점을 돌려준다", async () => {
  const p = page();
  const button = startRegenerate(p);
  p.requests[0].resolve({ ok: false });
  await setImmediate();
  assert.equal(p.requests[1].path, "/api/v1/chat");
  p.requests[1].resolve({ ok: true, json: async () => ({
    answered: true, answer: "가상 JSON 답", citations: [], session_id: "fictional-session",
  }) });
  await setImmediate();
  assertSecondAnswer(p, "가상 JSON 답");
  assert.equal(p.focus(), button);
});

test("마지막 요청이 실패하면 같은 버튼이 다시 시도로 바뀌고 재시도 성공 뒤 같은 버튼으로 돌아온다", async () => {
  const p = page();
  startRegenerate(p);
  await finish(p.requests[0], "가상 저장된 답");
  find(p, ".version-prev", 1).click();
  const original = p.raw();
  const button = startRegenerate(p);
  p.requests[1].resolve({ ok: false });
  await setImmediate();
  assert.equal(p.focus(), p.body);
  assert.equal(p.requests[2].path, "/api/v1/chat");
  p.requests[2].resolve({ ok: false });
  await setImmediate();
  assert.equal(p.raw(), original);
  assert.equal(find(p, ".version-count", 1).textContent, "1/2");
  assert.equal(find(p, ".question", 1).textContent, legacy[2].text);
  assert.equal(find(p, ".reply", 1).textContent, legacy[3].text);
  assert.equal(turn(p, 1).dataset.versionState, "failed");
  assert.equal(p.focus(), button);
  assert.equal(button.textContent, "다시 시도");
  startRegenerate(p);
  await finish(p.requests[3], "가상 재시도 답");
  assertSecondAnswer(p, "가상 재시도 답", [legacy[3].text, "가상 저장된 답"]);
  assert.equal(p.focus(), button);
  assert.equal(button.textContent, "다시 답하기");
});

test("정지와 늦은 완료 답은 두 번째 문답의 저장 기록과 선택을 유지하고 버튼에 초점을 돌려주지 않는다", async () => {
  const p = page();
  startRegenerate(p);
  await finish(p.requests[0], "가상 저장된 답");
  find(p, ".version-prev", 1).click();
  const original = p.raw();
  startRegenerate(p);
  const out = stream(p.requests[1], { honorAbort: false });
  out.emit("meta", { answered: true });
  out.emit("answer", { text: "가상 정지할 답" });
  await setImmediate();
  assert.equal(p.run("stopActiveAnswer()"), true);
  assert.equal(p.focus(), p.input);
  p.body.focus();
  out.done();
  await setImmediate();
  assert.equal(p.raw(), original);
  assert.equal(find(p, ".version-count", 1).textContent, "1/2");
  assert.equal(find(p, ".question", 1).textContent, legacy[2].text);
  assert.equal(find(p, ".reply", 1).textContent, legacy[3].text);
  assert.equal(p.focus(), p.body);
});

test("다시 답하기 전에 버튼에 초점이 없으면 답을 받아도 초점을 옮기지 않는다", async () => {
  const p = page();
  find(p, ".turn-regenerate", 1).click();
  await finish(p.requests[0], "가상 새 답");
  assertSecondAnswer(p, "가상 새 답");
  assert.equal(p.focus(), p.body);
});

test("다시 답하기를 기다리며 질문 입력창으로 옮긴 초점을 유지한다", async () => {
  const p = page();
  startRegenerate(p);
  p.input.focus();
  await finish(p.requests[0], "가상 새 답");
  assertSecondAnswer(p, "가상 새 답");
  assert.equal(p.focus(), p.input);
});

for (const [label, getTarget] of [
  ["대화 목록 버튼", p => p.conversationList.querySelector(".conversation-open")],
  ["이전 답의 출처 링크", p => find(p, ".test-source", 1)],
]) {
  test(`다시 답하기가 끝날 때 ${label}에서 초점이 사라져도 다시 답하기 버튼으로 옮기지 않는다`, async () => {
    const messages = [...legacy.slice(0, 3), message("answer", legacy[3].text, [
      { url: "https://example.invalid/fictional", title: "가상 출처" },
    ])];
    const p = page(new Map([[historyKey, JSON.stringify([{ id: "fictional-chat", time: 1, messages }])]]));
    startRegenerate(p);
    const target = getTarget(p);
    target.focus();
    assert.equal(p.focus(), target);
    await finish(p.requests[0], "가상 새 답");
    assertSecondAnswer(p, "가상 새 답");
    assert.equal(target.isConnected, false);
    assert.equal(p.focus(), p.body);
  });
}

for (const [when, reopenBeforeAnswer] of [["답을 받기 전에", true], ["답을 받은 뒤에", false]]) {
  test(`다른 대화로 이동했다가 ${when} 돌아와도 초점을 가져가지 않는다`, async () => {
    const p = page(new Map([[historyKey, JSON.stringify([
      { id: "fictional-chat", time: 1, messages: legacy },
      { id: "fictional-other", time: 1, messages: [message("question", "가상 다른 대화 질문")] },
    ])]]));
    const reopen = () => p.run('openConversation(conversations.find(record => record.id === "fictional-chat"))');
    const button = startRegenerate(p);
    p.run('openConversation(conversations.find(record => record.id === "fictional-other"))');
    assert.equal(button.isConnected, false);
    if (reopenBeforeAnswer) reopen();
    await finish(p.requests[0], "가상 다른 화면에서 받은 답");
    assert.equal(p.focus(), p.body);
    if (!reopenBeforeAnswer) reopen();
    assertSecondAnswer(p, "가상 다른 화면에서 받은 답");
    assert.equal(p.focus(), p.body);
  });
}

for (const [name, action] of [
  ["삭제", "removeConversation(activeConversation)"],
  ["계정 전환", 'switchHistoryAccount("demo-d02")'],
]) {
  test(`${name} 뒤에 도착한 완료 답은 기록에 반영하지 않는다`, async () => {
    const p = page();
    find(p, ".turn-regenerate").click();
    const out = stream(p.requests[0], { honorAbort: false });
    out.emit("meta", { answered: true });
    await setImmediate();
    p.run(action);
    const original = p.raw();
    out.emit("answer", { text: "가상 늦은 답" });
    out.done();
    await setImmediate();
    assert.equal(p.raw(), original);
    assert.equal(p.values.has("kumoh-chat-history:v1:demo-d02"), false);
  });
}

test("계속 다시 물어도 최근 다섯 쌍만 남기고 버전마다 안전한 출처만 복원한다", async () => {
  const p = page();
  const citations = [
    { document: "가상 안전 출처", article_path: "가상 조항", source_url: "https://example.invalid/rules" },
    { document: "가상 금지 출처", article_path: "가상 조항", source_url: "javascript:alert(1)" },
  ];
  for (let index = 1; index <= 6; index++) {
    find(p, ".turn-regenerate").click();
    await finish(p.requests.at(-1), `가상 새 답 ${index}`, {}, citations);
  }
  assert.equal(find(p, ".version-count").textContent, "5/5");
  assert.equal(savedMessages(p)[0].versions.length, 5);
  assert.equal(p.raw().includes("가상 첫 답"), false);
  assert.equal(p.raw().includes("가상 새 답 1"), false);
  assert.equal(p.raw().includes("javascript:"), false);
  find(p, ".version-prev").click();
  assert.equal(savedMessages(p)[1].text, "가상 새 답 5");
  assert.equal(savedMessages(p)[1].sources[0].url, "https://example.invalid/rules");
});

test("숫자가 포함된 버전만 기록에서 빼고 남은 버전으로 선택 번호를 보정한다", async () => {
  const p = page();
  find(p, ".turn-regenerate").click();
  await finish(p.requests[0], "가상 안전한 새 답");
  edit(p, "가상 일련번호 99999999");
  await finish(p.requests[1], "가상 번호를 포함한 답");
  assert.equal(p.raw().includes("99999999"), false);
  const records = JSON.parse(p.raw());
  const [question, answer] = records[0].messages;
  const rejectedQuestion = { role: "question", text: "가상 일련번호 99999999" };
  const rejectedAnswer = { ...answer, text: "가상 번호를 포함한 답" };
  records[0].messages.splice(0, 2, {
    ...question, ...rejectedQuestion, selected: 2,
    versions: [...question.versions, { question: rejectedQuestion, answer: rejectedAnswer }],
  }, rejectedAnswer);
  const restored = page(new Map([[historyKey, JSON.stringify(records)]]));
  assert.equal(find(restored, ".version-count").textContent, "2/2");
  assert.equal(savedMessages(restored)[0].versions.length, 2);
  assert.equal(restored.transcript.textContent.includes("가상 번호를 포함한 답"), false);
  assert.equal(savedMessages(p).at(-1).text, "가상 다음 답");
});

// #170: 답 없는 첫 질문, 문답 19쌍, 답 없는 마지막 질문으로 말풍선 40개를 채운 가상 기록이다.
const fullFirst = "가상 한도 첫 질문";
const fullLast = "가상 한도 마지막 질문";
const fullHistory = [
  message("question", fullFirst),
  ...Array.from({ length: 19 }, (_, index) => [
    message("question", `가상 한도 질문 ${index + 1}`),
    message("answer", `가상 한도 답 ${index + 1}`),
  ]).flat(),
  message("question", fullLast),
];
const fullPage = (values = new Map([[historyKey, JSON.stringify([{ id: "fictional-full-chat", time: 1, messages: fullHistory }])]])) =>
  page(values);
const replyText = (p, index = 0) => turn(p, index).querySelector(".reply")?.textContent ?? null;

// 저장 기록을 문답 차례로 읽어, 맨 앞이 질문이고 답마다 바로 앞에 질문이 있는지 본다.
function assertTurnAligned(messages) {
  assert.ok(messages.length <= 40, `저장한 말풍선 ${messages.length}개`);
  assert.equal(messages[0]?.role, "question", "맨 앞에 질문 없는 답이 남았다");
  for (const [index, entry] of messages.entries()) {
    if (entry.role === "answer") assert.equal(messages[index - 1]?.role, "question", `${index}번째 답 앞에 질문이 없다`);
  }
}

// 작업한 차례를 뺀 나머지는 원래 기록의 문답 경계에서 시작하는 뒷부분이어야 한다.
function assertOldestTurnsDropped(rest) {
  const tail = fullHistory.slice(1).map(entry => entry.text);
  const kept = rest.map(entry => entry.text);
  assert.deepEqual(kept, tail.slice(tail.length - kept.length));
  assert.equal(kept.at(-1), fullLast);
}

for (const [name, work, workedQuestion] of [
  ["수정", p => edit(p, "가상 한도 고친 질문"), "가상 한도 고친 질문"],
  ["다시 답하기", p => find(p, ".turn-regenerate").click(), fullFirst],
]) {
  test(`40개 기록에서 첫 질문을 ${name}해도 그 차례를 보존하고 새로고침 뒤 고른 버전을 오간다`, async () => {
    const p = fullPage();
    assert.equal(savedMessages(p).length, 40);
    const newAnswer = `가상 한도 ${name} 답`;
    work(p);
    assert.equal(p.requests.length, 1);
    assert.equal(sentQuestion(p.requests[0]), workedQuestion);
    await finish(p.requests[0], newAnswer);
    assert.equal(find(p, ".version-count").textContent, "2/2");

    const saved = savedMessages(p);
    assertTurnAligned(saved);
    const worked = saved.find(entry => Array.isArray(entry.versions));
    assert.ok(worked, "작업한 질문의 버전 기록이 잘렸다");
    assert.equal(worked.text, workedQuestion);
    assert.equal(worked.versions.length, 2);
    assert.equal(worked.selected, 1);
    const position = saved.indexOf(worked);
    assert.equal(saved[position + 1]?.text, newAnswer);
    assertOldestTurnsDropped(saved.slice(position + 2));
    // 이번 화면에서 이미 그린 말풍선은 그대로 둔다.
    assert.match(turn(p, 1).querySelector(".question").textContent, /가상 한도 질문 1(?!\d)/);
    const requested = p.requests.length;

    const reopened = fullPage(p.values);
    assert.equal(find(reopened, ".version-count").textContent, "2/2");
    assert.match(find(reopened, ".question").textContent, new RegExp(workedQuestion));
    assert.equal(replyText(reopened), newAnswer);
    assert.equal(find(reopened, ".version-next").disabled, true);
    find(reopened, ".version-prev").click();
    assert.equal(find(reopened, ".version-count").textContent, "1/2");
    assertTurnAligned(savedMessages(reopened));

    const older = fullPage(reopened.values);
    assert.equal(find(older, ".version-count").textContent, "1/2");
    assert.equal(find(older, ".version-prev").disabled, true);
    assert.match(find(older, ".question").textContent, new RegExp(fullFirst));
    assert.equal(replyText(older), null);
    assert.equal(savedMessages(older).find(entry => Array.isArray(entry.versions))?.selected, 0);
    find(older, ".version-next").click();
    assert.equal(find(older, ".version-count").textContent, "2/2");
    assert.match(find(older, ".question").textContent, new RegExp(workedQuestion));
    assert.equal(replyText(older), newAnswer);
    const back = savedMessages(older);
    assertTurnAligned(back);
    const restored = back.find(entry => Array.isArray(entry.versions));
    assert.equal(restored.selected, 1);
    assert.equal(back[back.indexOf(restored) + 1]?.text, newAnswer);

    const latest = fullPage(older.values);
    assert.equal(find(latest, ".version-count").textContent, "2/2");
    assert.equal(replyText(latest), newAnswer);
    for (const view of [p, reopened, older, latest]) assert.equal(view.requests.length, view === p ? requested : 0);
  });
}

// #173: #170의 fullHistory를 그대로 쓰되, 답 없는 첫 질문에 답을 붙이고 답 없는 마지막 질문을 빼 문답 20쌍(말풍선 40개)으로 만든다.
// 두 번째 질문(fullHistory의 「가상 한도 질문 1」)은 버전 두 개 가운데 첫 버전(1/2)을 고른 상태다.
const pairTitle = "가상 한도 대화 제목";
const pairFirstAnswer = message("answer", "가상 한도 첫 답");
const pairVersions = [
  { question: fullHistory[1], answer: fullHistory[2] },
  { question: message("question", "가상 한도 고친 질문 1"), answer: message("answer", "가상 한도 고친 답 1") },
];
const pairHistory = [
  fullHistory[0], pairFirstAnswer,
  { ...fullHistory[1], versions: pairVersions, selected: 0 }, fullHistory[2],
  ...fullHistory.slice(3, -1),
];
const pairPage = (values = new Map([[historyKey, JSON.stringify([
  { id: "fictional-pair-chat", time: 1, title: pairTitle, messages: pairHistory },
])]])) => page(values);

test("40개 기록에서 새 질문 전송이 실패해도 저장 기록을 화면과 같은 차례에서 자르고 다시 시도는 한 차례만 더한다", async () => {
  assert.equal(pairHistory.length, 40);
  assert.equal(pairHistory[0], fullHistory[0]);
  assert.equal(pairHistory.at(-1), fullHistory.at(-2));
  const p = pairPage();
  assert.equal(savedMessages(p).length, 40);
  const newQuestion = "가상 한도 새 질문";
  p.run(`input.value = ${JSON.stringify(newQuestion)}; composer.fire("submit");`);
  assert.equal(p.requests.length, 1);
  assert.equal(sentQuestion(p.requests[0]), newQuestion);
  assert.equal(p.run("activeConversation.messages.length"), 39);
  // 스트림과 JSON 응답이 모두 실패한 일반 실패다.
  p.requests[0].resolve({ ok: false });
  await setImmediate();
  assert.equal(p.requests[1].path, "/api/v1/chat");
  p.requests[1].resolve({ ok: false });
  await setImmediate();
  const retry = p.transcript.querySelector("button.retry");
  assert.ok(retry, "실패한 질문에 다시 시도 버튼이 없다");

  // 가장 오래된 한 쌍만 빠지고 나머지 순서·제목·버전 선택은 그대로 저장한다. 실패한 질문은 저장하지 않는다.
  const expected = pairHistory.slice(2).map(entry => entry.text);
  const saved = savedMessages(p);
  assertTurnAligned(saved);
  assert.deepEqual(saved.map(entry => entry.text), expected);
  assert.equal(JSON.parse(p.raw())[0].title, pairTitle);
  assert.deepEqual(saved[0].versions, pairVersions);
  assert.equal(saved[0].selected, 0);

  // 저장소 복사본으로 연 새 화면은 남은 19쌍만 그리고 고른 첫 버전을 보여 준다.
  const reopened = pairPage(new Map(p.values));
  assert.equal(reopened.transcript.querySelectorAll(".turn").length, 19);
  assert.equal(reopened.transcript.textContent.includes(fullFirst), false);
  assert.equal(reopened.transcript.textContent.includes(pairFirstAnswer.text), false);
  assert.equal(reopened.transcript.textContent.includes(newQuestion), false);
  assert.equal(find(reopened, ".version-count").textContent, "1/2");
  assert.match(find(reopened, ".question").textContent, /가상 한도 질문 1(?!\d)/);
  assert.equal(replyText(reopened), "가상 한도 답 1");
  assert.deepEqual(savedMessages(reopened).map(entry => entry.text), expected);
  assert.equal(reopened.requests.length, 0);

  // 원래 화면에서 다시 시도가 성공하면 새 질문과 답이 한 번만 붙는다.
  retry.click();
  assert.equal(p.requests.length, 3);
  assert.equal(sentQuestion(p.requests[2]), newQuestion);
  await finish(p.requests[2], "가상 한도 새 답");
  const after = savedMessages(p);
  assert.equal(after.length, 40);
  assertTurnAligned(after);
  assert.deepEqual(after.map(entry => entry.text), [...expected, newQuestion, "가상 한도 새 답"]);
  assert.equal(after.filter(entry => entry.text === newQuestion).length, 1);
  assert.equal(after[0].selected, 0);
  assert.equal(p.run("activeConversation.messages.length"), 40);
});

test("저장할 수 없는 여섯 번째 후보 때문에 기존 다섯 버전을 버리지 않는다", async () => {
  const p = page();
  for (let index = 1; index <= 4; index++) {
    find(p, ".turn-regenerate").click();
    await finish(p.requests.at(-1), `가상 유효 답 ${index}`);
  }
  const originalVersions = savedMessages(p)[0].versions;
  assert.equal(originalVersions.length, 5);
  edit(p, "가상 번호 99999999");
  await finish(p.requests.at(-1), "가상 정리 대상 답");
  assert.deepEqual(savedMessages(p)[0].versions, originalVersions);
  const restored = page(p.values);
  assert.equal(find(restored, ".version-count").textContent, "5/5");
  assert.equal(find(restored, ".reply").textContent, "가상 유효 답 4");
  assert.equal(turn(restored, 1).querySelector(".reply").textContent, "가상 다음 답");
});
