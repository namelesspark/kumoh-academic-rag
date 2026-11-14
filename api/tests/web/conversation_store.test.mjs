import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
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
      "\n({loadConversations, saveConversations, trimConversations, deleteConversation, clearConversations})",
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
