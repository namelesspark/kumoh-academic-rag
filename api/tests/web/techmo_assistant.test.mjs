// 테크모 비서 화면 테스트 (#61). 브라우저와 서버를 띄우지 않고 실제 index.html·chat.css·chat.js 파일을 읽어,
// 가짜 화면 객체·가짜 서버 요청 함수(fetch)·가짜 타이머로 chat.js를 그대로 실행한다.
// 자세 그림 파일은 쓰지 않는다. 그림이 없어도 통과해야 하기 때문이다. 질문·응답·사진 바이트는 모두 가상 값이다.
// 1280px·390px 배치와 실제 움직임은 브라우저에서 따로 확인한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const read = path => readFileSync(new URL(`../../app/chat_web/${path}`, import.meta.url), "utf8");
const script = read("assets/chat.js");
const styles = read("assets/chat.css").replace(/\/\*[\s\S]*?\*\//g, "");
const html = read("index.html");

// 이슈 #61의 상태 규칙 표. [자세, 한 줄 말, 대기 점] 순서다.
const idle = ["guide", "궁금한 점을 물어보세요", "점 숨김"];
const searching = ["quiet", "쉿, 찾아보는 중이에요…", "점 보임"];
const found = ["celebrate", "찾았어요! 함께 확인해 봐요", "점 숨김"];
const answer = ["guide", "근거와 함께 안내해 드릴게요", "점 숨김"];
const hold = ["quiet", "확인할 근거가 더 필요해요", "점 숨김"];
const failed = ["guide", "잠시 문제가 생겼어요. 다시 시도해 주세요", "점 숨김"];
const poseNames = ["quiet", "guide", "celebrate"];

// --- index.html과 chat.css 읽기 --------------------------------------------------------------

const landing = /<div id="empty"[\s\S]*?(?=<noscript>)/.exec(html)?.[0] ?? "";
const assistantMarkup = /<aside class="assistant"[\s\S]*?<\/aside>/.exec(html)?.[0] ?? "";

test("예전 안내 상자가 없고, 채팅 영역 제목은 숨김 제목으로 남는다", () => {
  for (const gone of ["chat-header", "graduation-check", "chat-title", "가상 학생 졸업 체크"]) {
    assert.equal(html.includes(gone), false, gone);
  }
  assert.equal(styles.includes("chat-header"), false);
  assert.equal(script.includes("graduation-check"), false);

  assert.match(html, /<section class="chat" aria-labelledby="chat-heading">\s*<h2 id="chat-heading" class="sr-only">학사 규정에 질문하기<\/h2>/);
  // 같은 버튼이 두 번 나오지 않는다. 졸업 체크로 가는 길은 소개 영역과 카드에만 남는다.
  assert.equal(html.split("내 졸업 체크 보기").length, 2);
  assert.match(landing, /<button type="button" class="cta" data-action="graduation">내 졸업 체크 보기<\/button>/);
});

test("비서는 채팅보다 앞, 첫 화면(#empty) 밖에 있고 평소 상태로 시작한다", () => {
  assert.notEqual(assistantMarkup, "");
  assert.equal(html.split('id="assistant"').length, 2);
  // 문서 순서가 채팅보다 앞이라 좁은 화면에서 채팅 위에 온다. #empty 밖이라 첫 질문 뒤에도 남는다.
  assert.ok(html.indexOf('id="assistant"') < html.indexOf('<section class="chat"'));
  assert.equal(landing.includes("assistant"), false);

  assert.match(assistantMarkup, /<aside class="assistant" id="assistant" data-pose="guide" aria-label="테크모 비서">/);
  assert.match(assistantMarkup, new RegExp(`<span id="assistant-line">${idle[1]}</span>`));
  assert.match(
    assistantMarkup,
    /<span class="assistant-dots" id="assistant-dots" aria-hidden="true" hidden><span><\/span><span><\/span><span><\/span><\/span>/,
  );
  // 진행 알림은 #status가 읽어 준다. 비서까지 알림 영역이면 화면 낭독기가 같은 일을 두 번 읽는다.
  assert.doesNotMatch(assistantMarkup, /role="status"|aria-live/);
});

test("자세 그림 세 장을 약속한 주소와 크기로 겹쳐 두고, 보이는 한 장은 data-pose로만 고른다", () => {
  const sizes = { quiet: [140, 183], guide: [140, 181], celebrate: [159, 145] };
  for (const name of poseNames) {
    const [width, height] = sizes[name];
    assert.ok(
      assistantMarkup.includes(
        `<span class="pose pose-${name}" data-brand-slot hidden><img src="/chat-assets/techmo-${name}.png" alt="" width="${width}" height="${height}"></span>`,
      ),
      name,
    );
    assert.ok(styles.includes(`.assistant[data-pose="${name}"] .pose-${name}`), name);
  }
  assert.match(styles, /\.pose\s*\{[^}]*position:\s*absolute;[^}]*visibility:\s*hidden;/);
  // 그림 주소를 바꿔 끼우는 코드는 없다.
  for (const blocked of [".src =", "techmo-quiet", "techmo-guide", "techmo-celebrate"]) {
    assert.equal(script.includes(blocked), false, blocked);
  }
});

test("그림 자리 크기를 고정하고, 좁은 화면에서는 그림과 말을 한 줄로 낮게 놓는다", () => {
  const [wide, narrow] = styles.split("@media (max-width: 680px)");
  assert.notEqual(narrow, undefined);
  assert.match(wide, /\.assistant-stage\s*\{[^}]*width:\s*160px;\s*height:\s*184px;/);
  assert.match(wide, /\.assistant\s*\{[^}]*flex-direction:\s*column;/);
  assert.match(narrow, /\.assistant-stage\s*\{\s*width:\s*48px;\s*height:\s*56px;/);
  assert.match(narrow, /\.assistant\s*\{[^}]*flex-direction:\s*row;/);
});

test("움직임은 자세 전환과 대기 점 두 곳뿐이고, 움직임 줄이기 설정에서는 둘 다 끈다", () => {
  const animations = [...styles.matchAll(/animation:\s*([^;]+);/g)].map(match => match[1].trim());
  assert.equal(animations.length, 3);
  assert.match(animations[0], /^pose-swap /);
  assert.match(animations[1], /^dot-hop .* infinite$/);
  assert.equal(animations[2], "none !important");

  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.pose, \.assistant-dots span\s*\{\s*animation:\s*none\s*!important;\s*\}\s*\}/,
  );
  // 줄었다 커지는 전환: 원래 크기에서 줄었다가 원래 크기로 돌아온다.
  assert.match(styles, /@keyframes pose-swap\s*\{\s*0%\s*\{\s*transform:\s*scale\(1\);\s*\}\s*40%\s*\{\s*transform:\s*scale\(\.\d+\);\s*\}\s*100%\s*\{\s*transform:\s*scale\(1\);\s*\}\s*\}/);
});

// --- chat.js 실행 ----------------------------------------------------------------------------

class FakeElement {
  children = [];
  listeners = new Map();
  attributes = new Map();
  dataset = {};
  textContent = "";
  className = "";
  value = "";
  parent = null;
  hidden = false;
  image = null;

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

  addEventListener(event, listener) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
  }

  fire(event) {
    for (const listener of this.listeners.get(event) ?? []) listener({ preventDefault() {} });
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  querySelectorAll(selector) {
    if (!selector.startsWith(".")) return [];
    const name = selector.slice(1);
    return descendants(this).filter(node => node.className.split(" ").includes(name));
  }

  // 그림 자리가 자기 안의 그림을 찾을 때만 쓴다.
  querySelector(selector) {
    return selector === "img" ? this.image : null;
  }

  scrollIntoView() {}

  focus() {}

  click() {}
}

function descendants(node) {
  const found = [];
  for (const child of node.children) {
    if (child instanceof FakeElement) found.push(child, ...descendants(child));
  }
  return found;
}

const chatPath = "/api/v1/chat";
const graduationPath = "/api/v1/graduation-demo";
const photoPath = "/api/v1/photo-input";
const textPath = "/api/v1/photo-question";

const ok = payload => ({ ok: true, status: 200, json: async () => payload });
const refused = status => ({ ok: false, status, json: async () => ({ detail: "fictional error" }) });

// 테스트가 원하는 때에 응답을 풀어 주는 약속. 기다리는 동안의 화면을 확인할 때 쓴다.
function deferred() {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
}

const answeredChat = { session_id: "fictional-session", answered: true, answer: "가상 답변입니다.", citations: [] };
const unansweredChat = { session_id: "fictional-session", answered: false, answer: null, citations: [] };
const graduationResult = {
  profile: { label: "가상 학생" },
  items: [{ id: "total_credits", label: "학점", status: "met", current: "40학점", required: "40학점", basis: null }],
};
const fictionalEvent = { title: "가상 설명회", login_required: false };
const confirmedPhoto = recognized => ({
  event_match: "confirmed", identified_by: ["text"], reasons: [], event: fictionalEvent, recognized_text: recognized,
});
const unmatchedPhoto = recognized => ({
  event_match: "needs_check", identified_by: [], reasons: [], event: null, recognized_text: recognized,
});
const campusAnswer = { kind: "campus", answer: "가상관은 정문 옆 건물입니다.", sources: [], event: null, hold_reason: null };
const holdAnswer = { kind: "hold", answer: null, sources: [], event: null, hold_reason: "가상 보류 사유" };

// routes는 주소별 응답이다. 값이 배열이면 부를 때마다 앞에서부터 하나씩 꺼내 쓴다.
// timers를 false로 주면 타이머 함수가 없는 환경을 흉내 낸다. 기존 화면 테스트들의 가짜 화면이 그렇다.
function loadAssistant({ routes = {}, timers = true, poses = null } = {}) {
  const requests = [];
  const elements = new Map();
  const pending = new Map();
  let nextTimer = 1;

  const graduation = new FakeElement("button");
  graduation.dataset = { action: "graduation" };
  const slots = (poses ?? []).map(state => {
    const slot = new FakeElement("slot");
    slot.hidden = true;
    slot.image = Object.assign(new FakeElement("img"), state);
    slot.append(slot.image);
    return slot;
  });
  const lists = { "[data-action]": [graduation], "[data-brand-slot]": slots };

  const context = {
    document: {
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, new FakeElement(selector));
        return elements.get(selector);
      },
      querySelectorAll: selector => lists[selector] ?? [],
      createElement: tag => new FakeElement(tag),
      createTextNode: value => value,
    },
    window: { matchMedia: () => ({ matches: false }) },
    URL,
    AbortSignal: { timeout: () => undefined },
    async fetch(path) {
      requests.push(path);
      const route = routes[path];
      if (route === undefined) throw new Error(`unexpected request: ${path}`);
      return Array.isArray(route) ? route.shift() : route;
    },
  };
  if (timers) {
    context.setTimeout = (callback, delay) => {
      const id = nextTimer;
      nextTimer += 1;
      pending.set(id, { callback, delay });
      return id;
    };
    context.clearTimeout = id => {
      pending.delete(id);
    };
  }
  runInNewContext(script, context, { filename: "chat.js" });

  const page = {
    requests,
    graduation,
    slots,
    assistant: elements.get("#assistant"),
    line: elements.get("#assistant-line"),
    dots: elements.get("#assistant-dots"),
    transcript: elements.get("#transcript"),
    empty: elements.get("#empty"),
    reset: elements.get("#reset"),
    composer: elements.get("#composer"),
    input: elements.get("#question"),
    file: elements.get("#photo-file"),
    status: elements.get("#status"),
    // 예약된 전환의 대기 시간 목록.
    delays: () => [...pending.values()].map(timer => timer.delay),
    // 예약된 전환을 모두 실행한다. 시간이 다 지난 것과 같다.
    runTimers() {
      for (const [id, timer] of [...pending]) {
        pending.delete(id);
        timer.callback();
      }
    },
  };
  // index.html의 처음 모습을 가짜 화면에 옮긴다.
  page.assistant.setAttribute("data-pose", idle[0]);
  page.line.textContent = idle[1];
  page.dots.hidden = true;
  page.transcript.append(page.empty);
  return page;
}

function shown(page) {
  return [page.assistant.attributes.get("data-pose"), page.line.textContent, page.dots.hidden ? "점 숨김" : "점 보임"];
}

function ask(page, question) {
  page.input.value = question;
  page.composer.fire("submit");
}

function sendPhoto(page, question = "") {
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  page.file.files = [new File([bytes], "가상-사진.jpg", { type: "image/jpeg" })];
  page.input.value = question;
  page.composer.fire("submit");
  // 브라우저는 전송 뒤 고른 파일을 비운다. 가짜 입력 칸도 같게 맞춘다.
  page.file.files = [];
}

test("일반 질문: 기다리는 동안 정숙과 대기 점, 답이 오면 축하를 1.2초 보여 준 뒤 안내로 넘어간다", async () => {
  const reply = deferred();
  const page = loadAssistant({ routes: { [chatPath]: reply.promise } });
  assert.deepEqual(shown(page), idle);

  ask(page, "가상 질문");
  assert.deepEqual(shown(page), searching);
  assert.deepEqual(page.delays(), []);
  // 첫 질문을 보내 첫 화면이 사라져도 비서는 그대로 있다.
  assert.equal(page.transcript.children.includes(page.empty), false);

  reply.resolve(ok(answeredChat));
  await setImmediate();
  // 잠금이 풀린 뒤에도 축하가 남아 있다.
  assert.equal(page.reset.disabled, false);
  assert.equal(page.status.textContent, "");
  assert.deepEqual(shown(page), found);
  assert.deepEqual(page.delays(), [1200]);

  page.runTimers();
  assert.deepEqual(shown(page), answer);
  assert.deepEqual(page.delays(), []);
});

test("근거를 찾지 못한 답은 보류로 남고, 잠금을 풀어도 평소로 돌아가지 않는다", async () => {
  const page = loadAssistant({ routes: { [chatPath]: ok(unansweredChat) } });
  ask(page, "가상 질문");
  assert.deepEqual(shown(page), searching);
  await setImmediate();

  assert.equal(page.reset.disabled, false);
  assert.deepEqual(shown(page), hold);
  assert.deepEqual(page.delays(), []);
});

test("요청이 실패하면 오류 말과 함께 점이 사라지고, 다시 시도하면 다시 찾는 중이 된다", async () => {
  const second = deferred();
  const page = loadAssistant({ routes: { [chatPath]: [refused(500), second.promise] } });
  ask(page, "가상 질문");
  await setImmediate();
  assert.deepEqual(shown(page), failed);

  const [retry] = page.transcript.querySelectorAll(".retry");
  retry.fire("click");
  assert.deepEqual(shown(page), searching);

  second.resolve(ok(answeredChat));
  await setImmediate();
  assert.deepEqual(shown(page), found);
  assert.deepEqual(page.requests, [chatPath, chatPath]);
});

test("축하 뒤 전환을 기다리는 동안 새 질문을 보내면 예약한 전환을 취소한다", async () => {
  const second = deferred();
  const page = loadAssistant({ routes: { [chatPath]: [ok(answeredChat), second.promise] } });
  ask(page, "가상 질문 하나");
  await setImmediate();
  assert.deepEqual(shown(page), found);
  assert.deepEqual(page.delays(), [1200]);

  ask(page, "가상 질문 둘");
  assert.deepEqual(page.delays(), []);
  assert.deepEqual(shown(page), searching);
  // 시간이 지나도 앞 질문의 전환이 찾는 중을 덮어쓰지 않는다.
  page.runTimers();
  assert.deepEqual(shown(page), searching);

  second.resolve(ok(unansweredChat));
  await setImmediate();
  assert.deepEqual(shown(page), hold);
  page.runTimers();
  assert.deepEqual(shown(page), hold);
});

test("축하 뒤 전환을 기다리는 동안 새 대화를 누르면 예약을 취소하고 평소로 돌아간다", async () => {
  const page = loadAssistant({ routes: { [chatPath]: ok(answeredChat) } });
  ask(page, "가상 질문");
  await setImmediate();
  assert.deepEqual(page.delays(), [1200]);

  page.reset.fire("click");
  assert.deepEqual(page.delays(), []);
  assert.deepEqual(shown(page), idle);
  page.runTimers();
  assert.deepEqual(shown(page), idle);
  assert.equal(page.transcript.children.length, 1);
  assert.equal(page.transcript.children[0], page.empty);
});

test("답변 표시에서 새 대화로 가면 자세는 안내 그대로이고 말만 바뀐다", async () => {
  const page = loadAssistant({ routes: { [chatPath]: ok(answeredChat) } });
  ask(page, "가상 질문");
  await setImmediate();
  page.runTimers();
  assert.deepEqual(shown(page), answer);

  // 전환 움직임은 data-pose 값이 달라질 때만 chat.css가 붙인다. 값이 그대로면 다시 돌지 않는다.
  page.reset.fire("click");
  assert.deepEqual(shown(page), idle);
  assert.equal(answer[0], idle[0]);
});

test("졸업 체크: 남은 버튼으로 불러도 같은 규칙을 따르고, 요청 중에는 버튼이 잠겨 요청이 하나만 나간다", async () => {
  const result = deferred();
  const page = loadAssistant({ routes: { [graduationPath]: [result.promise, refused(500)] } });

  page.graduation.fire("click");
  assert.deepEqual(shown(page), searching);
  assert.equal(page.graduation.disabled, true);
  page.graduation.fire("click");
  ask(page, "가상 질문");
  assert.deepEqual(page.requests, [graduationPath]);

  result.resolve(ok(graduationResult));
  await setImmediate();
  assert.equal(page.graduation.disabled, false);
  assert.deepEqual(shown(page), found);
  page.runTimers();
  assert.deepEqual(shown(page), answer);

  // 두 번째 요청은 실패한다. 결과 대신 오류 상태가 된다.
  page.graduation.fire("click");
  assert.deepEqual(shown(page), searching);
  await setImmediate();
  assert.deepEqual(shown(page), failed);
  assert.deepEqual(page.requests, [graduationPath, graduationPath]);
});

test("사진 질문: 행사가 확정되면 축하, 읽은 글자로 이어 물어 보류되면 정숙이다", async () => {
  const confirmed = loadAssistant({ routes: { [photoPath]: ok(confirmedPhoto("가상 설명회 11.23")) } });
  sendPhoto(confirmed);
  assert.deepEqual(shown(confirmed), searching);
  await setImmediate();
  assert.deepEqual(shown(confirmed), found);
  assert.deepEqual(confirmed.requests, [photoPath]);
  confirmed.runTimers();
  assert.deepEqual(shown(confirmed), answer);

  // 사진 주소와 글자 주소가 이어지는 동안 계속 찾는 중이다.
  const text = deferred();
  const held = loadAssistant({ routes: { [photoPath]: ok(unmatchedPhoto("가상 안내문 글자")), [textPath]: text.promise } });
  sendPhoto(held, "여기 어디야?");
  await setImmediate();
  assert.deepEqual(held.requests, [photoPath, textPath]);
  assert.deepEqual(shown(held), searching);
  text.resolve(ok(holdAnswer));
  await setImmediate();
  assert.deepEqual(shown(held), hold);
  assert.equal(held.reset.disabled, false);
});

test("사진 질문: 글자 주소가 답을 찾으면 축하, 읽은 글자가 없으면 보류, 서버가 실패하면 오류다", async () => {
  const answered = loadAssistant({ routes: { [photoPath]: ok(unmatchedPhoto("가상관 안내")), [textPath]: ok(campusAnswer) } });
  sendPhoto(answered, "여기 어디야?");
  await setImmediate();
  assert.deepEqual(shown(answered), found);
  answered.runTimers();
  assert.deepEqual(shown(answered), answer);

  const nothing = loadAssistant({ routes: { [photoPath]: ok(unmatchedPhoto("")) } });
  sendPhoto(nothing);
  await setImmediate();
  assert.deepEqual(nothing.requests, [photoPath]);
  assert.deepEqual(shown(nothing), hold);

  const broken = loadAssistant({ routes: { [photoPath]: refused(500) } });
  sendPhoto(broken);
  await setImmediate();
  assert.deepEqual(shown(broken), failed);

  const textBroken = loadAssistant({ routes: { [photoPath]: ok(unmatchedPhoto("가상 글자")), [textPath]: refused(500) } });
  sendPhoto(textBroken);
  await setImmediate();
  assert.deepEqual(shown(textBroken), failed);
});

test("읽은 글자 재질문: 축하를 기다리는 중에 다시 물으면 예약을 취소하고 결과에 따라 상태를 바꾼다", async () => {
  const page = loadAssistant({ routes: { [photoPath]: ok(confirmedPhoto("가상 설명회 11.23")), [textPath]: ok(holdAnswer) } });
  sendPhoto(page);
  await setImmediate();
  assert.deepEqual(shown(page), found);
  assert.deepEqual(page.delays(), [1200]);

  const [reask] = page.transcript.querySelectorAll(".reask");
  reask.fire("click");
  assert.deepEqual(page.delays(), []);
  assert.deepEqual(shown(page), searching);
  await setImmediate();

  assert.deepEqual(page.requests, [photoPath, textPath]);
  assert.deepEqual(shown(page), hold);
  page.runTimers();
  assert.deepEqual(shown(page), hold);
});

test("자세 그림이 없거나 깨져도 그림 자리만 숨고 말·질문·재시도·새 대화는 동작한다", async () => {
  const missing = () => ({ complete: true, naturalWidth: 0 });
  const page = loadAssistant({
    poses: [missing(), missing(), missing()],
    routes: { [chatPath]: [refused(500), ok(answeredChat)] },
  });
  for (const slot of page.slots) slot.image.fire("error");
  assert.deepEqual(page.slots.map(slot => slot.hidden), [true, true, true]);

  ask(page, "가상 질문");
  assert.deepEqual(shown(page), searching);
  await setImmediate();
  assert.deepEqual(shown(page), failed);

  page.transcript.querySelectorAll(".retry")[0].fire("click");
  await setImmediate();
  assert.deepEqual(shown(page), found);
  page.runTimers();
  assert.deepEqual(shown(page), answer);

  page.reset.fire("click");
  assert.deepEqual(shown(page), idle);
  assert.deepEqual(page.slots.map(slot => slot.hidden), [true, true, true]);
  // 그림을 다른 것으로 바꿔 끼우지 않는다.
  for (const slot of page.slots) {
    assert.equal(slot.image.src, undefined);
    assert.equal(slot.image.attributes.size, 0);
  }
});

test("늦게 도착한 그림 로드 신호는 그 그림 자리만 보이게 하고, 지금 자세는 바꾸지 못한다", async () => {
  const waiting = () => ({ complete: false, naturalWidth: 0 });
  const page = loadAssistant({ poses: [waiting(), waiting(), waiting()], routes: { [chatPath]: ok(answeredChat) } });
  ask(page, "가상 질문");
  await setImmediate();
  assert.deepEqual(shown(page), found);

  // 정숙 그림이 축하 상태에서야 도착한다.
  const [quiet] = page.slots;
  Object.assign(quiet.image, { complete: true, naturalWidth: 140 });
  quiet.image.fire("load");
  assert.deepEqual(page.slots.map(slot => slot.hidden), [false, true, true]);
  assert.deepEqual(shown(page), found);
  assert.deepEqual(page.delays(), [1200]);
});

test("타이머가 없는 환경에서도 오류 없이 답변 표시까지 간다", async () => {
  const page = loadAssistant({ timers: false, routes: { [chatPath]: ok(answeredChat) } });
  ask(page, "가상 질문");
  assert.deepEqual(shown(page), searching);
  await setImmediate();

  assert.equal(page.transcript.querySelectorAll(".error").length, 0);
  assert.deepEqual(shown(page), answer);
});
