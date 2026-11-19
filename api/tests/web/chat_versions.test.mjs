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
  section("async function readChatStream(", 'input.addEventListener("input"'),
  section("function stopActiveAnswer(", "// 보내기 버튼에 초점을 두고"),
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
    classList = { contains: name => this.className.split(" ").includes(name) };
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
      for (const child of this.children) if (child instanceof Node) child.parentNode = null;
      this.children = [];
      this.append(...children);
    }
    remove() {
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
    focus() { if (!this.disabled) focus = this; }
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
      createTextNode: text => text,
      get activeElement() { return focus; },
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
    photoFile: get("#photo-file"), photoClear: get("#photo-clear"), photoAttach: get("#photo-attach"), send: get("#send"),
    aiMode: "fast", busy: false, sessionId: null, chatRequestNumber: 0,
    setTimeout() {}, clearTimeout() {}, reducedMotion: () => true,
    techmoBubble() {}, scrollToLatest() {}, showAssistant() {}, celebrate() {}, localizeReplyAuthors() {},
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
  return { run, transcript, requests, timeouts, values, raw: () => values.get(historyKey), focus: () => focus };
}

function turn(p, index = 0) {
  const node = p.transcript.querySelectorAll(".turn")[index];
  assert.ok(node, `가상 대화의 ${index + 1}번째 차례`);
  return node;
}

function find(p, selector) {
  const node = turn(p).querySelector(selector);
  assert.ok(node, selector);
  return node;
}

function edit(p, text) {
  find(p, ".turn-edit").click();
  const form = find(p, "form.turn-editor");
  form.querySelector("textarea").value = text;
  form.fire("submit");
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

test("질문을 수정하고 끝까지 받은 뒤 버전을 고르며 새로고침해도 고른 질문과 답을 복원한다", async () => {
  const p = page();
  assert.equal(turn(p).querySelector(".version-picker"), null);
  const original = p.raw();
  const revised = "가상 슬쩍 고친 질문";
  const revisedAnswer = "가상 안내 답";
  edit(p, revised);
  assert.equal(p.requests.length, 1);
  assert.equal(sentQuestion(p.requests[0]), revised);
  assert.equal(turn(p).dataset.versionState, "pending");
  for (const index of [0, 1]) {
    for (const selector of [".turn-edit", ".turn-regenerate"]) {
      assert.equal(turn(p, index).querySelector(selector).disabled, true);
    }
  }
  assert.match(turn(p, 1).querySelector(".question").textContent, /가상 다음 질문/);
  assert.equal(turn(p, 1).querySelector(".reply").textContent, "가상 다음 답");
  assert.equal(p.raw(), original);
  await finish(p.requests[0], revisedAnswer, { answered: false, guided: true });
  assert.equal(find(p, ".version-count").textContent, "2/2");
  assert.equal(find(p, ".version-count").getAttribute("aria-live"), "polite");
  assert.equal(find(p, ".version-next").disabled, true);
  assert.deepEqual(savedMessages(p).map(entry => entry.text), [revised, revisedAnswer, ...legacy.slice(2).map(entry => entry.text)]);
  assert.equal(savedMessages(p)[1].guided, true);
  assert.equal(savedMessages(p)[0].versions.length, 2);
  assert.equal(Object.hasOwn(savedMessages(p)[1], "versions"), false);

  find(p, ".version-prev").click();
  const reopened = page(p.values);
  assert.equal(find(reopened, ".version-count").textContent, "1/2");
  assert.equal(find(reopened, ".version-prev").disabled, true);
  assert.match(find(reopened, ".question").textContent, /가상 첫 질문/);
  assert.equal(find(reopened, ".reply").textContent, answer);
  find(reopened, ".turn-regenerate").click();
  assert.equal(sentQuestion(reopened.requests[0]), question);
  assert.equal(find(reopened, ".version-next").disabled, true);
  assert.equal(find(reopened, ".version-prev").disabled, true);
  assert.equal(turn(reopened, 1).querySelector(".turn-regenerate").disabled, true);
  await finish(reopened.requests[0], "가상 보류 답", { answered: false });
  assert.equal(find(reopened, ".version-count").textContent, "3/3");
  assert.equal(savedMessages(reopened)[1].answered, false);
  assert.equal(savedMessages(reopened)[0].text, question);
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

test("JSON으로 받은 완료 답을 저장하고 정지 뒤 늦은 완료 답은 선택을 바꾸지 않는다", async () => {
  const p = page();
  find(p, ".turn-regenerate").click();
  p.requests[0].resolve({ ok: false });
  await setImmediate();
  assert.equal(p.requests[1].path, "/api/v1/chat");
  p.requests[1].resolve({ ok: true, json: async () => ({
    answered: true, answer: "가상 JSON 답", citations: [], session_id: "fictional-session",
  }) });
  await setImmediate();
  assert.equal(find(p, ".version-count").textContent, "2/2");
  assert.equal(savedMessages(p)[1].text, "가상 JSON 답");

  find(p, ".version-prev").click();
  const original = p.raw();
  find(p, ".turn-regenerate").click();
  const out = stream(p.requests[2], { honorAbort: false });
  out.emit("meta", { answered: true });
  out.emit("answer", { text: "가상 정지할 답" });
  await setImmediate();
  assert.equal(p.run("stopActiveAnswer()"), true);
  out.done();
  await setImmediate();
  assert.equal(p.raw(), original);
  assert.equal(find(p, ".version-count").textContent, "1/2");
  assert.equal(find(p, ".reply").textContent, answer);
});

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
