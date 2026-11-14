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
} = {}) {
  const nodes = new Map(),
    events = new Map(),
    windowEvents = new Map(),
    timers = new Map(),
    requests = [];
  const photoRequests = [];
  let focus = null, id = 0;
  class Node {
    children = [];
    attributes = new Map();
    listeners = new Map();
    hidden = false;
    textContent = "";
    value = "";
    files = [];
    clicks = 0;
    remove() {}
    append(...children) {
      this.children.push(...children);
    }
    replaceChildren(...children) {
      this.children = children;
    }
    setAttribute(key, value) {
      this.attributes.set(key, String(value));
    }
    removeAttribute(key) {
      this.attributes.delete(key);
    }
    addEventListener(type, callback) {
      this.listeners.set(type, callback);
    }
    focus() {
      focus = this;
    }
    click() {
      this.clicks++;
      this.listeners.get("click")?.({});
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
    addEventListener: (name, callback) => events.set(name, callback),
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
    addEventListener: (name, callback) => windowEvents.set(name, callback),
    confirm: () => true,
  };
  const context = {
    document,
    window,
    Date,
    Array,
    Promise,
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
          resolve,
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
    saveConversations() {
    },
    loadConversations() {
      return JSON.parse(JSON.stringify(storedConversations));
    },
    clearConversations() {
    },
  };
  get("#transcript").append(get("#empty"));
  const controller = script.slice(
    script.indexOf("const sidebar ="),
    script.indexOf("function storedStudentId("),
  );
  const asking = script.slice(
    script.indexOf("async function ask("),
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
    focus: () => focus,
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
