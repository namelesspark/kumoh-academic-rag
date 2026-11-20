import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { runInNewContext } from "node:vm";
const script = readFileSync(
  new URL("../../app/chat_web/assets/chat.js", import.meta.url),
  "utf8",
);
const storageCode = script.slice(0, script.indexOf("const transcript ="));
const safetyCode = script.slice(
  script.indexOf("function isSafeSourceUrl("),
  script.indexOf("function citationCard("),
);

function store() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function functions() {
  return runInNewContext(
    storageCode + safetyCode +
      "\n({loadConversations, saveConversations, trimConversations, deleteConversation, clearConversations, limitCommittedChatMessages})",
    {
      URL,
    },
  );
}

test("오래된 말풍선을 잘라도 첫 질문의 목록 제목은 유지한다", () => {
  const api = functions();
  const storage = store();
  const conversation = {
    id: "fictional-title",
    time: 1,
    title: "가상 첫 질문의 제목",
    messages: Array.from({ length: 44 }, (_, index) => ({
      role: index % 2 ? "answer" : "question",
      text: `가상 다음 문장 ${index}`,
      time: index,
      sources: [],
    })),
  };
  api.saveConversations(storage, "browse", [conversation]);
  const [loaded] = api.loadConversations(storage, "browse");
  assert.equal(loaded.title, "가상 첫 질문의 제목");
  assert.equal(loaded.messages.length, 40);
});
const record = (id, count = 2) => ({
  id,
  time: Number(id),
  unread: true,
  messages: Array.from({
    length: count,
  }, (_, index) => ({
    role: index % 2 ? "answer" : "question",
    text: `가상 문장 ${index}`,
    time: index,
    sources: [],
  })),
});

function submission(storage) {
  const section = (from, to) => script.slice(script.indexOf(from), script.indexOf(to));
  const idle = () => {};
  const element = () => ({
    children: [], listeners: {},
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(name, listener) { this.listeners[name] = listener; },
  });
  const composer = element();
  const transcript = element();
  const context = {
    URL, window: { localStorage: storage },
    composer, transcript, input: { focus: idle }, empty: { remove: idle },
    photoFile: {}, photoNote: {},
    document: { createTextNode: text => text },
    busy: false, aiMode: "fast", chatRequestNumber: 0, conversationSequence: 0,
    historyAccount: "browse", chatView: true, requestedChatView: true,
    renderConversations: idle, renderActiveConversation: idle, scrollToLatest: idle,
    showAssistant: idle, updateSend: idle, setupTurnActions: idle, celebrate: idle,
    element,
    setChatView(value) { context.chatView = context.requestedChatView = value; },
    async requestChatAnswer() {
      if (!context.answer) throw new Error("가상 전송 실패");
      return { answered: true, answer: context.answer };
    },
  };
  runInNewContext(storageCode + safetyCode +
    section("function historyStorage()", "function switchHistoryAccount(") +
    section("async function ask(", 'input.addEventListener("input"') +
    section('composer.addEventListener("submit"', '// 클립 버튼') + `
    conversations = loadConversations(historyStorage(), historyAccount)
      .map(record => ({ ...record, saved: true, turns: [], committedMessages: record.messages.slice() }));
    activeConversation = conversations[0] ?? null;
  `, context);
  return {
    context,
    submit(text) {
      context.input.value = text;
      composer.listeners.submit({ preventDefault: idle });
    },
    retry() {
      const reply = transcript.children.at(-1).children[1];
      reply.children[0].children[1].listeners.click();
    },
  };
}

test("가득 찬 채팅의 전송이 실패하면 화면과 저장 기록에서 같은 문답을 덜어 낸다", async () => {
  const api = functions();
  const storage = store();
  const conversation = { ...record("1", 40), title: "가상 기록 제목", unread: false };
  const [original, answer] = conversation.messages.slice(2, 4);
  const revised = { ...original, text: "가상 수정 질문" };
  conversation.messages[2] = {
    ...revised,
    versions: [{ question: original, answer: null }, { question: revised, answer }],
    selected: 1,
  };
  api.saveConversations(storage, "browse", [conversation]);
  const [before] = api.loadConversations(storage, "browse");
  const expected = Array.from(before.messages.slice(2));
  const page = submission(storage);
  const pending = "가상 새 질문";

  page.submit(pending);
  await setImmediate();
  const active = page.context.activeConversation;
  assert.equal(active.messages.length, 39);
  assert.equal(active.messages.at(-1).text, pending);
  assert.equal(active.unread, false);
  const normalize = value => JSON.parse(JSON.stringify(value));
  assert.deepEqual(normalize(active.messages.slice(0, -1)), normalize(expected));
  const [saved] = JSON.parse(storage.getItem("kumoh-chat-history:v1:browse"));
  assert.equal(saved.messages.length, 38);
  assert.deepEqual(saved.messages, normalize(expected));

  const reopened = submission(storage).context.activeConversation;
  assert.equal(reopened.title, conversation.title);
  assert.equal(reopened.unread, false);
  assert.deepEqual(normalize(reopened.messages), normalize(expected));

  page.context.answer = "가상 재시도 답";
  page.retry();
  await setImmediate();
  const [retried] = api.loadConversations(storage, "browse");
  assert.equal(retried.messages.length, 40);
  assert.deepEqual(normalize(retried.messages.slice(0, -2)), normalize(expected));
  assert.deepEqual(Array.from(retried.messages.slice(-2), ({ role, text }) => [role, text]), [
    ["question", pending], ["answer", page.context.answer],
  ]);
});

test("새 채팅의 첫 질문이 화면을 떠난 뒤 실패하면 질문과 읽지 않음 표시를 저장한다", async () => {
  const storage = store();
  const page = submission(storage);
  const pending = "가상 첫 질문";
  page.submit(pending);
  page.context.requestedChatView = false;
  await setImmediate();

  const [saved] = functions().loadConversations(storage, "browse");
  assert.ok(saved);
  assert.equal(saved.unread, true);
  assert.deepEqual(Array.from(saved.messages, ({ role, text }) => [role, text]), [["question", pending]]);
});

test("최근 대화 20개와 말풍선 40개만 보관한다", () => {
  const api = functions();
  const storage = store();
  assert.equal(
    api.saveConversations(
      storage,
      "browse",
      Array.from({
        length: 25,
      }, (_, index) => record(String(index), 44)),
    ),
    true,
  );
  const records = api.loadConversations(storage, "browse");
  assert.equal(records.length, 20);
  assert.equal(records[0].id, "24");
  assert.equal(records[19].id, "5");
  assert.equal(records[0].messages.length, 40);
  assert.equal(records[0].messages[0].text, "가상 문장 4");
});

test("41개에서 작업한 문답을 남기고 다음으로 오래된 문답을 함께 덜어 낸다", () => {
  const api = functions();
  const storage = store();
  const conversation = record("1", 41);
  const [original, answer] = conversation.messages;
  const revised = { ...original, text: "가상 수정 질문" };
  const chosen = {
    ...revised,
    versions: [{ question: original, answer: null }, { question: revised, answer }],
    selected: 1,
  };
  conversation.title = "가상 대화 제목";
  conversation.messages[0] = chosen;
  const committed = conversation.messages.slice();
  const expected = [chosen, answer, ...committed.slice(4)];
  api.limitCommittedChatMessages(conversation, committed, chosen);
  assert.deepEqual(Array.from(conversation.messages), expected);
  assert.deepEqual(Array.from(conversation.committedMessages), expected);

  api.saveConversations(storage, "browse", [{ ...conversation, messages: conversation.committedMessages }]);
  const [loaded] = api.loadConversations(storage, "browse");
  assert.equal(loaded.title, conversation.title);
  assert.equal(loaded.messages.length, 39);
  assert.deepEqual(Array.from(loaded.messages, message => [message.role, message.text]),
    expected.map(message => [message.role, message.text]));
  assert.equal(loaded.messages[0].selected, 1);
  assert.equal(loaded.messages[0].versions.length, 2);
});

test("오래된 문답을 자른 뒤 드러난 단독 답은 덜고 한도 안의 옛 기록은 읽는다", () => {
  const api = functions();
  const storage = store();
  const key = "kumoh-chat-history:v1:browse";
  const conversation = record("1", 42);
  const legacy = [
    { role: "answer", text: "가상 단독 답" },
    { role: "question", text: "가상 답 없는 질문" },
  ];
  storage.setItem(key, JSON.stringify([{ ...conversation, messages: legacy }]));
  const [old] = api.loadConversations(storage, "browse");
  assert.deepEqual(Array.from(old.messages, message => message.text), legacy.map(message => message.text));

  conversation.messages.splice(2, 0, legacy[0]);
  conversation.messages.pop();
  storage.setItem(key, JSON.stringify([conversation]));
  const [loaded] = api.loadConversations(storage, "browse");
  assert.equal(loaded.messages.length, 39);
  assert.equal(loaded.messages[0].role, "question");
  assert.equal(loaded.messages[0].text, "가상 문장 2");
  assert.equal(loaded.messages.at(-1).role, "question");
});

test("깨진 값과 저장소 오류는 빈 기록으로 처리한다", () => {
  const api = functions();
  const storage = store();
  for (const value of ["{", "null", "{}", "[null,4,{}]"]) {
    storage.setItem("kumoh-chat-history:v1:browse", value);
    assert.equal(api.loadConversations(storage, "browse").length, 0);
  }
  const broken = {
    getItem() {
      throw Error("가상 읽기 실패");
    },
    setItem() {
      throw Error("가상 용량 초과");
    },
    removeItem() {
      throw Error("가상 삭제 실패");
    },
  };
  assert.equal(api.loadConversations(broken, "browse").length, 0);
  assert.equal(api.saveConversations(broken, "browse", [record("1")]), false);
  assert.equal(api.clearConversations(broken, "browse").length, 0);
});

test("계정과 둘러보기 기록을 분리하고 선택한 계정만 지운다", () => {
  const api = functions();
  const storage = store();
  for (
    const [account, id] of [["browse", "1"], ["demo-d02", "2"], [
      "demo-d03",
      "3",
    ]]
  ) api.saveConversations(storage, account, [record(id)]);
  assert.equal(api.loadConversations(storage, "demo-d02")[0].id, "2");
  api.deleteConversation(storage, "demo-d02", "2");
  assert.equal(api.loadConversations(storage, "demo-d02").length, 0);
  assert.equal(api.loadConversations(storage, "demo-d03")[0].id, "3");
  api.clearConversations(storage, "browse");
  assert.equal(api.loadConversations(storage, "browse").length, 0);
});

test("사진·학번·비밀번호·서버 세션과 허용하지 않은 근거 필드를 복사하지 않는다", () => {
  const api = functions();
  const storage = store();
  const source = record("1");
  Object.assign(source, {
    student_number: "20990002",
    password: "fictional-password",
    session_id: "fictional-session",
  });
  source.messages[0].student_number = "20990002";
  source.messages[0].sources = [{
    title: "가상 규정",
    url: "https://example.invalid/rules",
    snippet: "가상 판독 원본",
  }, {
    title: "가상 위험 주소",
    url: "javascript:alert(1)",
  }];
  source.messages.push({
    role: "answer",
    text: "가상 사진 판독",
    photo: true,
    recognized_text: "가상 판독 원본",
  });
  api.saveConversations(storage, "demo-d02", [source, {
    ...record("2"),
    photo: "fictional-image",
  }]);
  const raw = storage.getItem("kumoh-chat-history:v1:demo-d02");
  for (
    const secret of [
      "20990002",
      "fictional-password",
      "fictional-session",
      "fictional-image",
      "recognized_text",
      "가상 판독 원본",
      "가상 사진 판독",
      "javascript:",
    ]
  ) assert.equal(raw.includes(secret), false, secret);
  const loaded = api.loadConversations(storage, "demo-d02")[0];
  assert.equal(loaded.unread, true);
  assert.equal(loaded.messages[0].sources.length, 1);
  assert.equal(
    Object.keys(loaded.messages[0].sources[0]).sort().join(","),
    "title,url",
  );
});

test("보관은 archived === true만 인정하고 20개 한도와 최근 순은 보관 여부와 상관없다", () => {
  const api = functions();
  const storage = store();
  const values = [true, "true", 1, null, undefined, false];
  api.saveConversations(storage, "browse", Array.from({ length: 25 }, (_, index) => ({
    ...record(String(index)), archived: values[index % values.length],
  })));
  const records = api.loadConversations(storage, "browse");
  assert.equal(records.length, 20);
  assert.deepEqual(Array.from(records, value => value.id), Array.from({ length: 20 }, (_, index) => String(24 - index)));
  for (const loaded of records) {
    assert.equal(loaded.archived, values[Number(loaded.id) % values.length] === true, loaded.id);
  }
});

test("보류와 안내 답 표시는 boolean으로만 남기고 옛 기록은 그대로 둔다", () => {
  const api = functions();
  const storage = store();
  const answer = (text, extra) => ({ role: "answer", text, time: 1, sources: [], ...extra });
  api.saveConversations(storage, "browse", [{
    id: "fictional-flags", time: 1,
    messages: [
      { role: "question", text: "가상 질문", answered: false, guided: true, sources: [] },
      answer("가상 보류 답", { answered: false }),
      answer("가상 안내 답", { answered: false, guided: true }),
      answer("가상 옛 답"),
      answer("가상 문자열 값", { answered: "false", guided: "true" }),
      answer("가상 안내만 있는 값", { guided: true }),
      answer("가상 일반 답", { answered: true, guided: true }),
    ],
  }]);
  const messages = api.loadConversations(storage, "browse")[0].messages;
  assert.equal(messages[1].answered, false);
  assert.equal(messages[2].answered, false);
  for (const index of [0, 3, 4, 5, 6]) {
    assert.equal(Object.hasOwn(messages[index], "answered"), false, String(index));
    assert.equal(Object.hasOwn(messages[index], "guided"), false, String(index));
  }
  assert.equal(Object.hasOwn(messages[1], "guided"), false);
  assert.equal(messages[2].guided, true);
});
