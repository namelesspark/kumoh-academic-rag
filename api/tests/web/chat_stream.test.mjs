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

function modePage(storage) {
  const composer = { children: [], append(node) { this.children.push(node); } };
  const context = {
    composer,
    historyStorage: () => storage,
    element(tag, className, text) {
      return { tag, className, textContent: text, children: [], listeners: {},
        append(...nodes) { this.children.push(...nodes); },
        addEventListener(name, callback) { this.listeners[name] = callback; } };
    },
  };
  const start = script.indexOf('const aiModeKey =');
  const end = script.indexOf('async function readChatStream(', start);
  runInNewContext(script.slice(start, end), context);
  return { group: composer.children[0], mode: () => runInNewContext('aiMode', context) };
}

test("답변 방식 라디오는 저장된 deep을 복구하고 선택을 같은 키에 저장한다", () => {
  const writes = [];
  const page = modePage({ getItem: (key) => {
    assert.equal(key, "kumoh-chat-ai-mode:v1");
    return "deep";
  }, setItem: (...args) => writes.push(args) });
  const [legend, fastLabel, deepLabel] = page.group.children;
  const fast = fastLabel.children[0], deep = deepLabel.children[0];
  assert.equal(page.group.id, "ai-mode");
  assert.equal(legend.textContent, "답변 방식");
  assert.equal(fast.id, "ai-mode-fast");
  assert.equal(deep.id, "ai-mode-deep");
  assert.equal(fast.type, "radio");
  assert.equal(fast.name, deep.name);
  assert.equal(deep.checked, true);
  fast.checked = true;
  fast.listeners.change();
  assert.equal(page.mode(), "fast");
  assert.deepEqual(writes, [["kumoh-chat-ai-mode:v1", "fast"]]);
});

test("잘못된 저장값과 저장소 실패는 fast로 복구한다", () => {
  for (const storage of [
    { getItem: () => "invalid", setItem() {} },
    { getItem() { throw Error("가상 읽기 실패"); }, setItem() { throw Error("가상 저장 실패"); } },
  ]) {
    const page = modePage(storage);
    assert.equal(page.mode(), "fast");
  }
  const page = modePage({ getItem: () => "deep", setItem() { throw Error("가상 저장 실패"); } });
  const deep = page.group.children[2].children[0];
  deep.checked = true;
  deep.listeners.change();
  assert.equal(page.mode(), "fast");
  assert.equal(page.group.children[1].children[0].checked, true);
  assert.equal(deep.checked, false);
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
