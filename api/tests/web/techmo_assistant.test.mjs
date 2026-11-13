// 테크모 펫 화면 테스트 (#64, 상태 규칙은 #61). 브라우저와 서버를 띄우지 않고 실제 index.html·chat.css·chat.js 파일을 읽어,
// 가짜 화면 객체·가짜 서버 요청 함수(fetch)·가짜 타이머로 chat.js를 그대로 실행한다.
// 스프라이트 시트(여러 자세를 한 장에 나란히 붙인 그림) 파일은 쓰지 않는다. 그림이 없어도 통과해야 하기 때문이다.
// 질문·응답·사진 바이트는 모두 가상 값이다. 1280px·390px 배치와 실제 움직임·초점·스크롤은 브라우저에서 따로 확인한다.
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
// 스프라이트 시트의 칸 순서와 그 칸을 고르는 가로 위치. 이슈 #64의 「두 작업이 지키는 약속」과 같다.
const frames = [["basic", "0"], ["quiet", "25%"], ["guide", "50%"], ["celebrate", "75%"], ["concert", "100%"]];
const spriteUrl = "/chat-assets/techmo-sprite.png";

// --- index.html과 chat.css 읽기 --------------------------------------------------------------

const landing = /<div id="empty"[\s\S]*?(?=<noscript>)/.exec(html)?.[0] ?? "";
const dockMarkup = /<div class="pet-dock"[\s\S]*?<\/div>/.exec(html)?.[0] ?? "";
const petMarkup = /<button[^>]*\bid="pet"[\s\S]*?<\/button>/.exec(dockMarkup)?.[0] ?? "";

// "머리말 { ... }" 묶음의 안쪽 글자를 돌려준다. 중괄호 짝을 세어 @media와 @keyframes 안의 규칙까지 담는다.
function block(header) {
  const start = styles.indexOf(header);
  assert.notEqual(start, -1, header);
  const open = styles.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < styles.length; index += 1) {
    if (styles[index] === "{") depth += 1;
    else if (styles[index] === "}") depth -= 1;
    if (depth === 0) return styles.slice(open + 1, index).replace(/\s+/g, " ").trim();
  }
  throw new Error(`${header}: 닫는 중괄호가 없다`);
}

// [선택자, 선언 글자] 목록. @media 안의 규칙도 같은 목록에 들어온다.
const rules = [...styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [
  selector.replace(/\s+/g, " ").trim(),
  body.replace(/\s+/g, " ").trim(),
]);
// 선택자가 정확히 같은 규칙 가운데 파일에서 가장 먼저 나오는 것의 선언. 화면 너비 조건 밖의 기본 규칙이 먼저 온다.
const first = selector => rules.find(([name]) => name === selector)?.[1] ?? "";
const wide = block("@media (min-width: 961px)");
const narrow = block("@media (max-width: 680px)");
const calm = block("@media (prefers-reduced-motion: reduce)");

test("예전 안내 상자가 없고, 채팅 영역 제목은 숨김 제목으로 남는다", () => {
  for (const gone of ["chat-header", "graduation-check", "chat-title", "가상 학생 졸업 체크"]) {
    assert.equal(html.includes(gone), false, gone);
  }
  assert.equal(styles.includes("chat-header"), false);
  assert.equal(script.includes("graduation-check"), false);

  assert.match(html, /<section class="chat" aria-labelledby="chat-heading">\s*<h2 id="chat-heading" class="sr-only">학사 규정에 질문하기<\/h2>/);
  // 같은 버튼이 두 번 나오지 않는다. 졸업 체크로 가는 길은 소개 영역과 카드에만 남는다.
  assert.equal(html.includes("내 졸업 체크 보기"), false);
  assert.match(landing, /<button type="button" class="cta" data-action="graduation">졸업 체크 시작<\/button>/);
});

test("왼쪽 칸의 비서와 「테크모에게 묻기」 글자 버튼이 없고, 「규정 질문」 카드는 남는다", () => {
  for (const gone of ["assistant", "테크모 비서", 'class="side"', "cta secondary", "techmo-quiet", "techmo-guide", "techmo-celebrate"]) {
    assert.equal(html.includes(gone), false, gone);
  }
  for (const gone of [".assistant", ".side", ".pose", "pose-swap"]) assert.equal(styles.includes(gone), false, gone);
  // 예시 질문은 다시 본문 격자의 첫 칸에 바로 놓인다.
  assert.match(html, /<main class="layout">\s*<details class="topics" id="topics" open>/);

  assert.equal(landing.includes("테크모에게 묻기"), false);
  // 카드는 패널을 여는 버튼이 됐다(#67). 기능은 패널 안의 시작 버튼이 부른다.
  assert.match(
    landing,
    /<button type="button" class="card" data-feature="ask" aria-controls="panel-ask" aria-expanded="false">\s*<span class="card-title">규정 질문<\/span>/,
  );
  assert.match(landing, /<button type="button" class="cta" data-action="ask">질문 입력하기<\/button>/);
});

test("펫 줄은 입력창 바로 앞, 첫 화면(#empty) 밖에 있고 평소 상태로 시작한다", () => {
  assert.notEqual(dockMarkup, "");
  assert.equal(html.split('id="pet-dock"').length, 2);
  // 대화 내용 뒤, 입력창 앞이다. 좁은 화면에서 입력창 위의 낮은 줄이 되고, #empty 밖이라 첫 질문 뒤에도 남는다.
  assert.ok(html.indexOf('id="transcript"') < html.indexOf('id="pet-dock"'));
  assert.ok(html.indexOf('id="composer"') < html.indexOf('id="transcript"'));
  assert.equal(landing.includes("pet"), false);

  assert.match(dockMarkup, /^<div class="pet-dock" id="pet-dock" data-pose="guide" data-state="idle">/);
  assert.match(dockMarkup, new RegExp(`<span id="pet-line">${idle[1]}</span>`));
  assert.match(
    dockMarkup,
    /<span class="pet-dots" id="pet-dots" aria-hidden="true" hidden><span><\/span><span><\/span><span><\/span><\/span>/,
  );
  // 진행 알림은 #status가 읽어 준다. 말풍선까지 알림 영역이면 화면 낭독기가 같은 일을 두 번 읽는다.
  assert.doesNotMatch(dockMarkup, /role="status"|aria-live/);
});

test("펫은 이름이 「테크모에게 묻기」인 버튼이고, 요청 중에 잠기는 표시(data-action)가 없다", () => {
  const [opening] = /^<button[^>]*>/.exec(petMarkup) ?? [""];
  assert.equal(opening, '<button type="button" class="pet" id="pet" aria-label="테크모에게 묻기" data-brand-slot hidden>');
  assert.equal(html.split('id="pet"').length, 2);
  // 스프라이트 시트가 받아졌는지 보는 그림이 버튼 바로 안에 있다. 버튼은 숨긴 채 시작한다.
  assert.ok(petMarkup.slice(opening.length).trimStart().startsWith(`<img src="${spriteUrl}" alt="" width="960" height="192">`));
  // 떠 있기·튀기·그림 칸은 서로 다른 요소다.
  assert.ok(petMarkup.includes('<span class="pet-float"><span class="pet-hop"><span class="pet-frame"></span></span></span>'));
  // 화면 보안 정책이 막는 style 속성과 스크립트의 그림 주소 교체는 쓰지 않는다.
  assert.doesNotMatch(html, /\sstyle=/);
  for (const blocked of [".src =", "techmo-", ".style"]) assert.equal(script.includes(blocked), false, blocked);
});

test("그림 칸은 스프라이트 한 장의 배경 위치로만 고른다: 0·25·50·75·100%", () => {
  assert.equal(styles.split(spriteUrl).length, 2);
  assert.ok(first(".pet-frame").includes(`background: url("${spriteUrl}") 50% 0 / 500% 100% no-repeat;`));
  assert.match(first(".pet-frame"), /width: 100%; aspect-ratio: 1;/);
  for (const [name, x] of frames) {
    assert.equal(first(`.pet-dock[data-pose="${name}"] .pet-frame`), `background-position: ${x} 0;`, name);
  }
  // 로드 확인용 그림은 화면에 그리지 않는다.
  assert.equal(first(".pet img"), "display: none;");
});

test("기본 배치는 입력창 앞에 붙는 낮은 줄이고, 넓은 화면에서만 오른쪽 아래에 고정하며 그만큼 본문 칸을 비운다", () => {
  // 기본: 줄이 자리를 차지하므로 입력창을 덮지 않고, 입력창이 화면 밖이면 화면 아래에 붙는다.
  assert.match(first(".pet-dock"), /^position: sticky; bottom: 0;/);
  assert.match(first(".pet"), /^flex: none; width: 56px;/);
  assert.match(first(".pet-says"), /flex: 1; min-width: 0;/);

  // 넓은 화면: 본문 격자의 셋째 칸(168px)을 비우고, 같은 너비의 펫을 본문 오른쪽 끝에 맞춰 고정한다.
  assert.ok(wide.includes(".layout { grid-template-columns: 212px minmax(0, 1fr) 168px; }"));
  assert.match(
    wide,
    /\.pet-dock \{ position: fixed; right: max\(24px, calc\(\(100% - 1120px\) \/ 2\)\); bottom: 24px;[^}]*\bwidth: 168px;/,
  );
  assert.ok(wide.includes(".pet { width: 128px; }"));

  // 좁은 화면: 배치 방식은 기본 그대로 두고 크기만 줄인다. 대화 영역 높이는 펫 줄을 뺀 예전 값으로 돌아온다.
  assert.doesNotMatch(narrow, /\.pet-dock \{[^}]*position/);
  assert.ok(narrow.includes(".pet { width: 48px; }"));
  assert.ok(narrow.includes(".chat { height: calc(100dvh - 180px); min-height: 350px; }"));
});

test("펫의 움직임 네 가지는 서로 다른 요소·속성에 걸고, 움직임 줄이기 설정에서는 화면의 움직임을 모두 끈다", () => {
  const animated = rules
    .map(([selector, body]) => [selector, /(?:^|; )animation: ([^;]+);/.exec(body)?.[1]])
    .filter(([, value]) => value !== undefined);
  // 화면 전체에서 움직임을 거는 규칙의 목록이다. 마지막 줄은 첫 화면 도형의 모양 변화(#67)이고,
  // 그 내용은 motion_layout.test.mjs가 따로 확인한다.
  const allOff = ".pet-float, .pet-hop, .pet-frame, .pet-dots span, .hero-art::before, .login-card, .login-techmo, button.card:hover";
  const transitionOff = "::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*)";
  assert.deepEqual(animated, [
    [".pet-dots span", "dot-hop 1s ease-in-out infinite"],
    [".pet-float", "pet-float 1.8s ease-in-out infinite alternate"],
    ['.pet-dock[data-pose="quiet"] .pet-hop', "pet-hop-quiet .4s ease-out"],
    ['.pet-dock[data-pose="guide"] .pet-hop', "pet-hop-guide .4s ease-out"],
    ['.pet-dock[data-pose="celebrate"] .pet-hop', "pet-hop-celebrate .4s ease-out"],
    ['.pet-dock[data-state="idle"] .pet-frame, .pet-dock[data-state="answer"] .pet-frame', "pet-rest 24s step-end infinite"],
    [allOff, "none !important"],
    [transitionOff, "none !important"],
    [".hero-art::before", "shape-morph 12s ease-in-out infinite"],
    [".login-card", "login-rise .8s ease-out"],
    [".login-techmo", "login-float 3.6s ease-in-out infinite"],
    ["button.card:hover", "card-lift .18s ease-out forwards"],
  ]);
  // 움직임 줄이기 묶음은 하나뿐이고, 펫·대기 점·도형과 카드 전환을 함께 끈다.
  assert.equal(styles.split("prefers-reduced-motion").length, 2);
  assert.equal(calm, `${allOff} { animation: none !important; } ${transitionOff} { animation: none !important; }`);

  // 떠 있기: 제자리에서 조금 올라갔다 내려온다.
  assert.equal(block("@keyframes pet-float"), "from { transform: translateY(0); } to { transform: translateY(-5%); }");
  // 눌렸다 튀기: 자세마다 이름만 다르고 내용은 같다. 이름이 같으면 자세가 바뀌어도 다시 돌지 않는다.
  const hop = block("@keyframes pet-hop-quiet");
  assert.match(hop, /^0% \{ transform: scale\(1, 1\); \} 30% \{ transform: scale\(1\.\d+, \.\d+\); \} .*100% \{ transform: scale\(1, 1\); \}$/);
  assert.equal(block("@keyframes pet-hop-guide"), hop);
  assert.equal(block("@keyframes pet-hop-celebrate"), hop);

  // 쉬는 자세: 안내 칸에서 시작해 음악회 칸과 기본형 칸을 잠깐 보이고 안내 칸으로 끝난다. 배경 위치만 바꾼다.
  const rest = block("@keyframes pet-rest");
  assert.deepEqual(
    [...rest.matchAll(/background-position: ([^;]+);/g)].map(match => match[1]),
    ["50% 0", "100% 0", "50% 0", "0 0", "50% 0"],
  );
  assert.equal(rest.includes("transform"), false);
  assert.ok(rest.startsWith("0%, 44% {"));
});

test("쉬는 자세와 부드러운 이동에 스크립트 타이머나 문서 전체 스크롤 설정을 쓰지 않는다", () => {
  // 타이머는 축하 뒤 전환 하나뿐이다. 쉬는 자세는 chat.css의 움직임 규칙이 맡는다.
  assert.equal(script.split("setTimeout(").length, 2);
  assert.equal(script.includes("setInterval"), false);
  // 부드러운 이동은 펫을 누를 때만 고르고, 움직임 줄이기 설정을 그때 읽는다.
  // 대화 칸의 overscroll-behavior는 다른 속성이라 세지 않는다.
  assert.doesNotMatch(styles, /(?<!over)scroll-behavior/);
  assert.equal(script.split('"(prefers-reduced-motion: reduce)"').length, 2);
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
  // 초점과 화면 이동을 부를 때 받은 선택 값을 차례로 적어 둔다.
  focuses = [];
  scrolls = [];

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

  scrollIntoView(options) {
    this.scrolls.push(options);
  }

  focus(options) {
    this.focuses.push(options);
  }

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
const graduationPath = "/api/v1/graduation-demo?student_id=demo-d02";
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
  profile: { id: "demo-d02", label: "가상 학생 D02" },
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
// sprite는 스프라이트 시트 그림의 가상 로드 상태다. 주면 펫 버튼이 index.html처럼 숨긴 그림 자리로 시작한다.
// motion은 움직임 줄이기 설정을 묻는 matchMedia가 돌려줄 값이다.
function loadAssistant({ routes = {}, timers = true, sprite = null, motion = { matches: false } } = {}) {
  const requests = [];
  const elements = new Map();
  const pending = new Map();
  let nextTimer = 1;

  const graduation = new FakeElement("button");
  graduation.dataset = { action: "graduation" };
  // 펫 버튼은 data-action이 없어 [data-action] 목록에 들지 않는다. 그림 자리 목록에는 든다.
  const pet = new FakeElement("button");
  elements.set("#pet", pet);
  if (sprite) {
    pet.hidden = true;
    pet.image = Object.assign(new FakeElement("img"), sprite);
    pet.append(pet.image);
  }
  const lists = { "[data-action]": [graduation], "[data-brand-slot]": sprite ? [pet] : [] };

  const context = {
    document: {
      addEventListener() {},
      querySelector(selector) {
        if (!elements.has(selector)) {
          elements.set(selector, new FakeElement(selector));
          if (selector === "#demo-students") elements.get(selector).hidden = true;
        }
        return elements.get(selector);
      },
      querySelectorAll: selector => lists[selector] ?? [],
      createElement: tag => new FakeElement(tag),
      createTextNode: value => value,
    },
    window: { matchMedia: query => (query.includes("prefers-reduced-motion") ? motion : { matches: false }) },
    URL,
    AbortSignal: { timeout: () => undefined },
    async fetch(path) {
      if (path === "/api/v1/demo-students") return ok({ students: [
        { id: "demo-d02", label: "가상 학생 D02", scenario: "졸업 요건에 가까움", is_fictional: true },
      ] });
      if (path === "/api/v1/demo-login") return { status: 200, json: async () => ({ student: { id: "demo-d02", label: "가상 학생 D02", scenario: "졸업 요건에 가까움", is_fictional: true } }) };
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
    async selectStudent() {
      elements.get("#demo-login").fire("click");
      await setImmediate();
      elements.get("#student-number").value = "DEMO-D02";
      elements.get("#student-password").value = "demo-d02-pass";
      elements.get("#login-form").fire("submit");
      await setImmediate();
      page.runTimers();
    },
    requests,
    graduation,
    pet,
    assistant: elements.get("#pet-dock"),
    line: elements.get("#pet-line"),
    dots: elements.get("#pet-dots"),
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
  page.assistant.setAttribute("data-state", "idle");
  page.line.textContent = idle[1];
  page.dots.hidden = true;
  page.transcript.append(page.empty);
  return page;
}

function shown(page) {
  return [page.assistant.attributes.get("data-pose"), page.line.textContent, page.dots.hidden ? "점 숨김" : "점 보임"];
}

// 쉬는 자세를 평소와 답변 표시에서만 돌리려고 chat.css가 읽는 상태 이름.
const stateOf = page => page.assistant.attributes.get("data-state");

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
  await page.selectStudent();

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

test("상태 이름도 함께 바뀌어, 쉬는 자세가 평소와 답변 표시에서만 돈다", async () => {
  const reply = deferred();
  const page = loadAssistant({ routes: { [chatPath]: [reply.promise, ok(unansweredChat), refused(500)] } });
  assert.equal(stateOf(page), "idle");

  ask(page, "가상 질문 하나");
  assert.equal(stateOf(page), "searching");
  reply.resolve(ok(answeredChat));
  await setImmediate();
  assert.equal(stateOf(page), "found");
  page.runTimers();
  assert.equal(stateOf(page), "answer");

  ask(page, "가상 질문 둘");
  await setImmediate();
  assert.equal(stateOf(page), "hold");
  ask(page, "가상 질문 셋");
  await setImmediate();
  assert.equal(stateOf(page), "error");

  page.reset.fire("click");
  assert.equal(stateOf(page), "idle");
  // chat.css는 이 두 상태에만 쉬는 자세를 건다. 오류는 자세가 안내로 같아도 쉬지 않는다.
  const resting = rules.filter(([, body]) => body.includes("pet-rest")).map(([selector]) => selector);
  assert.deepEqual(resting, ['.pet-dock[data-state="idle"] .pet-frame, .pet-dock[data-state="answer"] .pet-frame']);
});

test("펫을 누르면 입력창에 초점을 주고 입력창까지 부드럽게 옮기며, 요청은 보내지 않는다", () => {
  const page = loadAssistant();
  page.pet.fire("click");

  assert.equal(page.input.focuses.length, 1);
  // 초점이 화면을 바로 옮기지 않게 하고, 옮기는 일은 scrollIntoView 한 번에 맡긴다.
  assert.equal(page.input.focuses[0].preventScroll, true);
  assert.equal(page.input.scrolls.length, 1);
  assert.equal(page.input.scrolls[0].block, "center");
  assert.equal(page.input.scrolls[0].behavior, "smooth");
  assert.deepEqual(page.requests, []);
  assert.deepEqual(shown(page), idle);
  assert.equal(page.transcript.children[0], page.empty);
});

test("답변을 기다리는 중에도 펫은 잠기지 않고 입력창으로 초점을 옮긴다", async () => {
  const reply = deferred();
  const page = loadAssistant({ routes: { [chatPath]: reply.promise } });
  ask(page, "가상 질문");
  assert.equal(page.graduation.disabled, true);
  assert.notEqual(page.pet.disabled, true);

  page.pet.fire("click");
  assert.equal(page.input.focuses.length, 1);
  assert.equal(page.input.scrolls.length, 1);
  // 찾는 중 상태와 나가 있는 요청은 그대로다.
  assert.deepEqual(shown(page), searching);
  assert.deepEqual(page.requests, [chatPath]);

  reply.resolve(ok(answeredChat));
  await setImmediate();
  assert.deepEqual(shown(page), found);
});

test("움직임 줄이기 설정이 켜져 있으면 펫을 눌러도 부드럽게 옮기지 않고, 설정은 누를 때마다 다시 읽는다", () => {
  const motion = { matches: true };
  const page = loadAssistant({ motion });
  page.pet.fire("click");
  assert.equal(page.input.scrolls[0].behavior, "auto");

  // 사용 중에 설정을 끄면 다음에 누를 때 반영된다.
  motion.matches = false;
  page.pet.fire("click");
  assert.equal(page.input.scrolls[1].behavior, "smooth");
  assert.equal(page.input.focuses.length, 2);

  // 설정 값을 돌려주지 않는 환경에서는 평소처럼 옮긴다.
  const bare = loadAssistant({ motion: null });
  bare.pet.fire("click");
  assert.equal(bare.input.scrolls[0].behavior, "smooth");
});

test("스프라이트 시트가 없거나 깨져도 펫 버튼만 숨고 말풍선·질문·재시도·새 대화는 동작한다", async () => {
  const page = loadAssistant({
    sprite: { complete: true, naturalWidth: 0 },
    routes: { [chatPath]: [refused(500), ok(answeredChat)] },
  });
  page.pet.image.fire("error");
  // 보이지 않는 버튼에 초점이 가지 않게 버튼째 숨긴다.
  assert.equal(page.pet.hidden, true);

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
  assert.equal(page.pet.hidden, true);
  // 그림을 다른 것으로 바꿔 끼우지 않는다.
  assert.equal(page.pet.image.src, undefined);
  assert.equal(page.pet.image.attributes.size, 0);
});

test("늦게 도착한 스프라이트 로드 신호는 펫 버튼만 보이게 하고, 지금 자세는 바꾸지 못한다", async () => {
  const page = loadAssistant({ sprite: { complete: false, naturalWidth: 0 }, routes: { [chatPath]: ok(answeredChat) } });
  assert.equal(page.pet.hidden, true);
  ask(page, "가상 질문");
  await setImmediate();
  assert.deepEqual(shown(page), found);
  assert.equal(page.pet.hidden, true);

  // 스프라이트 시트가 축하 상태에서야 도착한다.
  Object.assign(page.pet.image, { complete: true, naturalWidth: 960 });
  page.pet.image.fire("load");
  assert.equal(page.pet.hidden, false);
  assert.deepEqual(shown(page), found);
  assert.deepEqual(page.delays(), [1200]);
});

test("스크립트가 늦게 실행돼도 이미 받아 둔 스프라이트 시트면 펫 버튼이 바로 보인다", () => {
  const page = loadAssistant({ sprite: { complete: true, naturalWidth: 960 } });
  assert.equal(page.pet.hidden, false);
  assert.deepEqual(shown(page), idle);
});

test("타이머가 없는 환경에서도 오류 없이 답변 표시까지 간다", async () => {
  const page = loadAssistant({ timers: false, routes: { [chatPath]: ok(answeredChat) } });
  ask(page, "가상 질문");
  assert.deepEqual(shown(page), searching);
  await setImmediate();

  assert.equal(page.transcript.querySelectorAll(".error").length, 0);
  assert.deepEqual(shown(page), answer);
});
