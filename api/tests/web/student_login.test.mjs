// 학생 선택 화면을 가짜 화면 객체와 서버 응답으로 확인한다. 학생과 이수 내역은 모두 가상 값이다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const read = path => readFileSync(new URL(`../../app/chat_web/${path}`, import.meta.url), "utf8");
const script = read("assets/chat.js");
const html = read("index.html");
const css = read("assets/chat.css");
const students = [
  { id: "demo-d02", label: "가상 학생 D02", scenario: "졸업 요건에 가까움", is_fictional: true },
  { id: "demo-d03", label: "가상 학생 D03", scenario: "학점이 많이 남음", is_fictional: true },
  { id: "demo-d04", label: "가상 학생 D04", scenario: "비교과 점수 부족", is_fictional: true },
];
const storageKey = "demo-student-id";
const ok = payload => ({ ok: true, status: 200, json: async () => payload });
const flush = () => setImmediate();

function descendants(node) {
  return node.children.flatMap(child => child instanceof FakeElement ? [child, ...descendants(child)] : []);
}
function text(node) {
  return typeof node === "string" ? node : node.textContent + node.children.map(text).join("");
}

class FakeElement {
  children = [];
  listeners = new Map();
  attributes = new Map();
  textContent = "";
  className = "";
  value = "";
  files = [];
  dataset = {};
  hidden = false;
  disabled = false;
  parent = null;

  constructor(tagName, focus) {
    this.tagName = tagName;
    this.onFocus = focus;
  }
  set innerHTML(_value) { throw new Error("서버 값을 HTML로 해석할 수 없음"); }
  set outerHTML(_value) { throw new Error("서버 값을 HTML로 해석할 수 없음"); }
  insertAdjacentHTML() { throw new Error("서버 값을 HTML로 해석할 수 없음"); }
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
    this.parent.children = this.parent.children.filter(child => child !== this);
    this.parent = null;
  }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelectorAll(selector) {
    return descendants(this).filter(node => selector.startsWith(".")
      ? node.className.split(" ").includes(selector.slice(1))
      : node.tagName === selector);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  contains(node) { return node === this || descendants(this).includes(node); }
  get parentElement() { return this.parent; }
  focus() { this.onFocus?.(this); }
  scrollIntoView() {}
}

function graduation(id = "demo-d02") {
  return {
    profile: { ...students.find(student => student.id === id), department: "가상 전공", admission_year: 2023 },
    items: [{
      id: "credits", label: "가상 학점", status: "met", current: "130학점", required: "130학점",
      shortfall: null, reason: null, basis: { applied_rule: "가상 기준" }, details: [],
    }],
    biskit_recommendations: null,
  };
}

function loadPage({ saved = null, storageFails = false, list = students, listResult = () => ok({ students: list }), result = () => ok(graduation()) } = {}) {
  const elements = new Map();
  const requests = [];
  const documentListeners = new Map();
  const documentCapture = new Map();
  const timers = new Map();
  const storage = new Map(saved === null ? [] : [[storageKey, saved]]);
  let nextTimer = 0;
  let focused = null;
  const create = tag => new FakeElement(tag, node => {
    focused = node;
    documentListeners.get("focusin")?.({ target: node });
  });
  const get = selector => {
    if (!elements.has(selector)) elements.set(selector, create(selector));
    return elements.get(selector);
  };
  const buttons = ["graduation", "graduation", "graduation"].map(action => {
    const button = create("button");
    button.dataset = { action };
    return button;
  });
  for (const id of ["demo-students", "demo-identity"]) get(`#${id}`).hidden = true;
  get(".demo-account").append(get("#demo-login"), get("#demo-identity"), get("#demo-students"));
  get("#demo-students").append(get("#demo-student-list"), get("#demo-notice"));
  const sessionStorage = {
    getItem(key) { if (storageFails) throw new Error("저장소 사용 불가"); return storage.get(key) ?? null; },
    setItem(key, value) { if (storageFails) throw new Error("저장소 사용 불가"); storage.set(key, value); },
    removeItem(key) { if (storageFails) throw new Error("저장소 사용 불가"); storage.delete(key); },
  };
  runInNewContext(script, {
    document: {
      addEventListener(name, listener, capture = false) {
        documentListeners.set(name, listener);
        documentCapture.set(name, capture === true || capture.capture === true);
      },
      querySelector: get,
      querySelectorAll: selector => selector === "[data-action]" ? buttons : [],
      createElement: create,
      createTextNode: value => value,
    },
    window: { matchMedia: () => ({ matches: false }), sessionStorage },
    sessionStorage,
    URL,
    AbortSignal: { timeout: () => undefined },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch: async (path, options = {}) => {
      requests.push({ path, options });
      return path === "/api/v1/demo-students" ? listResult() : result(path, options);
    },
  }, { filename: "chat.js" });
  get("#transcript").append(get("#empty"));
  return {
    get, buttons, requests, storage, timers,
    dispatch(name, target) { documentListeners.get(name)?.({ target }); },
    click(node) {
      const documentClick = () => documentListeners.get("click")?.({ target: node });
      if (documentCapture.get("click")) documentClick();
      click(node);
      if (!documentCapture.get("click")) documentClick();
    },
    get focused() { return focused; },
    choices: () => get("#demo-student-list").querySelectorAll("button"),
    tables: () => get("#transcript").querySelectorAll("table"),
    retries: () => get("#transcript").querySelectorAll(".retry"),
  };
}
function click(node) { node.listeners.get("click")({}); }
async function select(page, index = 0) {
  click(page.get("#demo-login"));
  await flush();
  click(page.choices()[index]);
  await flush();
}

function ask(page) {
  page.get("#question").value = "가상 질문";
  page.get("#composer").listeners.get("submit")({ preventDefault() {} });
}

test("로그인 목록에 가상 표기와 상황이 보이고 개인정보 입력란을 만들지 않는다", async () => {
  assert.doesNotMatch(html + script, /type\s*=\s*["']password["']/i);
  assert.doesNotMatch(html, /<input[^>]*(?:학번|계정|password|student[-_]?number)/i);
  assert.match(html, /<button(?=[^>]*id="demo-login")(?=[^>]*aria-controls="demo-students")(?=[^>]*aria-expanded="false")[^>]*>/);
  assert.match(html, /id="demo-notice"[^>]*(?:role="status"|aria-live="polite")/);
  const page = loadPage();
  assert.equal(page.requests.length, 0);
  click(page.get("#demo-login"));
  await flush();
  assert.equal(page.get("#demo-students").hidden, false);
  assert.equal(page.get("#demo-login").getAttribute("aria-expanded"), "true");
  assert.equal(page.choices().length, 3);
  for (const [index, student] of students.entries()) {
    assert.match(text(page.choices()[index]), new RegExp(student.label));
    assert.match(text(page.choices()[index]), new RegExp(student.scenario));
    assert.equal(page.choices()[index].type, "button");
  }
  assert.match(html, /가상 학생 데이터입니다/);
  assert.match(html, /id="demo-identity"[\s\S]*?가상 학생 데이터입니다[\s\S]*?<\/div>/);
  assert.match(html, /id="demo-students"[\s\S]*?가상 학생 데이터입니다[\s\S]*?<\/section>/);
});

test("펼친 목록에서 Escape를 누르면 목록을 닫고 로그인 버튼으로 초점을 돌린다", async () => {
  const page = loadPage();
  click(page.get("#demo-login"));
  await flush();
  let prevented = false;
  page.get("#demo-students").listeners.get("keydown")({ key: "Escape", preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(page.get("#demo-students").hidden, true);
  assert.equal(page.get("#demo-login").getAttribute("aria-expanded"), "false");
  assert.equal(page.focused, page.get("#demo-login"));
});

test("목록 응답 전에 닫았다 다시 열어도 학생 버튼을 중복해서 만들지 않는다", async () => {
  let finish;
  const page = loadPage({ listResult: () => new Promise(resolve => { finish = resolve; }) });
  click(page.get("#demo-login"));
  click(page.get("#demo-login"));
  click(page.get("#demo-login"));
  finish(ok({ students }));
  await flush();
  assert.equal(page.choices().length, 3);
  assert.equal(page.requests.length, 1);
});

test("목록 조회 실패는 재시도를 제공하고 가상 표시가 없는 목록은 선택하지 못하게 한다", async () => {
  let attempts = 0;
  const page = loadPage({ listResult: () => ++attempts === 1 ? { ok: false, status: 503 } : ok({ students }) });
  click(page.get("#demo-login"));
  await flush();
  assert.match(text(page.get("#demo-notice")), /불러오지 못했어요/);
  assert.equal(page.choices().length, 1);
  assert.equal(text(page.choices()[0]), "다시 시도");
  click(page.choices()[0]);
  await flush();
  assert.equal(page.choices().length, 3);

  const malformed = loadPage({ list: [{ ...students[0], is_fictional: false }] });
  click(malformed.get("#demo-login"));
  await flush();
  assert.equal(malformed.choices().length, 1);
  assert.equal(text(malformed.choices()[0]), "다시 시도");
  assert.equal(malformed.get("#demo-identity").hidden, true);
  assert.equal(malformed.storage.size, 0);
});

test("세 졸업·비교과 시작 버튼은 선택 전에 목록으로 안내하고 졸업 결과를 요청하지 않는다", async () => {
  for (const index of [0, 1, 2]) {
    const page = loadPage();
    click(page.buttons[index]);
    await flush();
    assert.deepEqual(page.requests.map(request => request.path), ["/api/v1/demo-students"]);
    assert.match(text(page.get("#demo-notice")), /먼저 가상 학생을 골라 주세요/);
    assert.equal(page.get("#demo-students").hidden, false);
    assert.ok(page.focused === page.choices()[0] || page.focused === page.get("#demo-students"));
    click(page.choices()[0]);
    await flush();
    assert.equal(page.requests.length, 1, "선택만으로 졸업 체크를 시작하지 않음");
  }
});

test("선택한 ID 하나만 탭에 저장하고 이름·나가기를 표시하며 펫 축하 뒤 idle로 돌아간다", async () => {
  const page = loadPage();
  await select(page);
  assert.deepEqual([...page.storage], [[storageKey, "demo-d02"]]);
  assert.equal(page.get("#demo-identity").hidden, false);
  assert.equal(page.get("#demo-login").hidden, true);
  assert.equal(page.get("#demo-students").hidden, true);
  assert.equal(text(page.get("#demo-label")), "가상 학생 D02");
  assert.equal(page.focused, page.get("#demo-logout"));
  assert.equal(page.get("#pet-dock").getAttribute("data-pose"), "celebrate");
  assert.match(text(page.get("#pet-line")), /가상 학생 D02.*들어왔어요/);
  assert.equal(page.timers.size, 1);
  const timer = [...page.timers.values()][0];
  assert.equal(timer.delay, 1200);
  timer.callback();
  assert.equal(page.get("#pet-dock").getAttribute("data-state"), "idle");
  click(page.get("#demo-logout"));
  assert.equal(page.storage.size, 0);
  assert.equal(page.get("#demo-identity").hidden, true);
  assert.equal(page.get("#demo-login").hidden, false);
  assert.equal(page.focused, page.get("#demo-login"));
});

test("학생별 요청은 한 번만 보내고 로그아웃하면 결과를 지운다", async () => {
  const page = loadPage({ result: path => ok(graduation(path.endsWith("demo-d03") ? "demo-d03" : "demo-d02")) });
  await select(page, 1);
  click(page.buttons[0]);
  click(page.buttons[0]);
  await flush();
  assert.deepEqual(page.requests.map(request => request.path), [
    "/api/v1/demo-students", "/api/v1/graduation-demo?student_id=demo-d03",
  ]);
  assert.equal(page.tables().length, 1);
  assert.match(text(page.tables()[0]), /가상 학생 D03/);
  click(page.get("#demo-logout"));
  assert.equal(page.tables().length, 0);
  assert.deepEqual(page.get("#transcript").children, [page.get("#empty")]);
});

test("응답 학생이 다르면 결과를 숨기고 재시도하며 404면 선택과 저장 ID를 지운다", async () => {
  const mismatch = loadPage({ result: () => ok(graduation("demo-d03")) });
  await select(mismatch);
  click(mismatch.buttons[0]);
  await flush();
  assert.equal(mismatch.tables().length, 0);
  assert.equal(mismatch.retries().length, 1);
  assert.match(text(mismatch.get("#transcript")), /다시 시도/);

  const missing = loadPage({ result: () => ({ ok: false, status: 404 }) });
  await select(missing);
  click(missing.buttons[0]);
  await flush();
  assert.equal(missing.tables().length, 0);
  assert.equal(missing.storage.size, 0);
  assert.equal(missing.get("#demo-identity").hidden, true);
  assert.equal(missing.get("#demo-students").hidden, false);
  assert.match(text(missing.get("#demo-notice")), /골라 주세요/);
  assert.deepEqual(missing.get("#transcript").children, [missing.get("#empty")]);
});

test("학생 결과를 지워도 다른 질문은 남기고 첫 화면을 덧붙이지 않는다", async () => {
  for (const missing of [false, true]) {
    const page = loadPage({ result: path => path === "/api/v1/chat"
      ? ok({ session_id: "fictional-session", answered: false })
      : missing ? { ok: false, status: 404 } : ok(graduation()) });
    await select(page);
    ask(page);
    await flush();
    const questionTurn = page.get("#transcript").children[0];
    click(page.buttons[0]);
    await flush();
    if (!missing) click(page.get("#demo-logout"));
    assert.deepEqual(page.get("#transcript").children, [questionTurn]);
    assert.match(text(questionTurn), /가상 질문/);
    assert.equal(page.get("#empty").parent, null);
  }
});

test("일반 질문을 기다리는 중 학생을 고르거나 나가도 펫의 대기 상태를 유지한다", async () => {
  for (const leaving of [false, true]) {
    let finish;
    const page = loadPage({ result: () => new Promise(resolve => { finish = resolve; }) });
    if (leaving) await select(page);
    ask(page);
    const dock = page.get("#pet-dock");
    const waitingLine = text(page.get("#pet-line"));
    assert.equal(dock.getAttribute("data-state"), "searching");
    if (leaving) click(page.get("#demo-logout"));
    else await select(page);
    assert.equal(dock.getAttribute("data-state"), "searching");
    assert.equal(text(page.get("#pet-line")), waitingLine);
    assert.equal(page.timers.size, 0);
    finish(ok({ session_id: "fictional-session", answered: false }));
    await flush();
    assert.equal(dock.getAttribute("data-state"), "hold");
  }
});

test("나간 뒤 늦게 온 응답과 예전 재시도는 이전 학생 결과를 만들지 않는다", async () => {
  let finish;
  const page = loadPage({ result: () => new Promise(resolve => { finish = resolve; }) });
  await select(page);
  click(page.buttons[0]);
  click(page.get("#demo-logout"));
  await select(page, 1);
  finish(ok(graduation()));
  await flush();
  assert.equal(page.tables().length, 0);
  assert.equal(text(page.get("#demo-label")), "가상 학생 D03");

  const failed = loadPage({ result: () => { throw new Error("가상 요청 실패"); } });
  await select(failed);
  click(failed.buttons[0]);
  await flush();
  const oldRetry = failed.retries()[0];
  click(failed.get("#demo-logout"));
  await select(failed, 1);
  const before = failed.requests.length;
  click(oldRetry);
  await flush();
  assert.equal(failed.requests.length, before);
  assert.equal(failed.tables().length, 0);
});

test("저장 ID는 새 목록으로 확인해 복원하고 사라진 ID는 지운다", async () => {
  const page = loadPage({ saved: "demo-d04" });
  await flush();
  assert.deepEqual(page.requests.map(request => request.path), ["/api/v1/demo-students"]);
  assert.equal(text(page.get("#demo-label")), "가상 학생 D04");
  assert.equal(page.get("#demo-identity").hidden, false);
  assert.equal(page.timers.size, 0, "새로고침 복원에서는 축하를 되풀이하지 않음");
  const removed = loadPage({ saved: "demo-retired" });
  await flush();
  assert.equal(removed.storage.size, 0);
  assert.equal(removed.get("#demo-identity").hidden, true);
});

test("탭 저장소가 막혀도 선택한 학생으로 조회하고 나갈 수 있다", async () => {
  const page = loadPage({ storageFails: true });
  await select(page);
  click(page.buttons[0]);
  await flush();
  assert.equal(page.tables().length, 1);
  assert.equal(page.requests.at(-1).path, "/api/v1/graduation-demo?student_id=demo-d02");
  click(page.get("#demo-logout"));
  assert.equal(page.get("#demo-identity").hidden, true);
  assert.equal(page.tables().length, 0);
});

test("복원할 목록을 일시적으로 받지 못해도 저장 ID를 유지해 다음 새로고침에서 복원한다", async () => {
  for (const failure of ["network", "server"]) {
    const page = loadPage({ saved: "demo-d04", listResult: () => {
      if (failure === "network") throw new Error("가상 연결 실패");
      return { ok: false, status: 503 };
    } });
    await flush();
    assert.deepEqual([...page.storage], [[storageKey, "demo-d04"]]);
    assert.equal(page.get("#demo-identity").hidden, true);
    const refreshed = loadPage({ saved: page.storage.get(storageKey) });
    await flush();
    assert.equal(text(refreshed.get("#demo-label")), "가상 학생 D04");
    assert.equal(refreshed.get("#demo-identity").hidden, false);
  }
});

test("바깥 클릭은 목록을 닫고 클릭한 곳의 초점을 유지한다", async () => {
  const page = loadPage();
  click(page.get("#demo-login"));
  await flush();
  const outside = page.get("#question");
  const previousFocus = page.focused;
  page.dispatch("click", outside);
  assert.equal(page.focused, previousFocus);
  outside.focus();
  assert.equal(page.get("#demo-students").hidden, true);
  assert.equal(page.focused, outside);
  assert.equal(page.get("#demo-login").getAttribute("aria-expanded"), "false");
});

test("로그인 버튼에서 Escape를 누르면 목록을 닫고 버튼에 초점을 둔다", async () => {
  const page = loadPage();
  click(page.get("#demo-login"));
  await flush();
  page.get("#demo-login").focus();
  let prevented = false;
  page.get("#demo-login").listeners.get("keydown")({ key: "Escape", preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(page.get("#demo-students").hidden, true);
  assert.equal(page.focused, page.get("#demo-login"));
});

test("Tab으로 메뉴 밖에 초점이 가면 닫고 메뉴 안 이동은 유지한다", async () => {
  const page = loadPage();
  click(page.get("#demo-login"));
  await flush();
  page.choices()[1].focus();
  assert.equal(page.get("#demo-students").hidden, false);
  page.get("#reset").focus();
  assert.equal(page.get("#demo-students").hidden, true);
  assert.equal(page.focused, page.get("#reset"));
});

test("졸업 체크 클릭이 문서에 전달되어도 방금 연 목록을 유지한다", async () => {
  const page = loadPage();
  page.click(page.buttons[0]);
  await flush();
  assert.equal(page.get("#demo-students").hidden, false);
  assert.match(text(page.get("#demo-notice")), /먼저 가상 학생을 골라 주세요/);
  assert.equal(page.focused, page.choices()[0]);
});

test("닫은 목록에 늦게 도착한 성공과 실패 응답은 초점을 가져가지 않는다", async () => {
  for (const succeeds of [true, false]) {
    let finish;
    const page = loadPage({ listResult: () => new Promise(resolve => { finish = resolve; }) });
    click(page.get("#demo-login"));
    const outside = page.get("#question");
    page.dispatch("click", outside);
    outside.focus();
    finish(succeeds ? ok({ students }) : { ok: false, status: 503 });
    await flush();
    assert.equal(page.get("#demo-students").hidden, true);
    assert.equal(page.choices().length, 0);
    assert.equal(page.focused, outside);
    assert.equal(page.get("#demo-login").getAttribute("aria-expanded"), "false");
  }
});

test("학생 메뉴는 상단 띠의 높이를 늘리지 않는 위치에 둔다", () => {
  assert.match(css, /\.demo-account\s*\{[^}]*position:\s*relative/s);
  assert.match(css, /#demo-students\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /#demo-students\s*\{[^}]*overflow-y:\s*auto/s);
  assert.doesNotMatch(css, /#demo-identity[^}]*flex-basis:\s*100%/s);
  assert.doesNotMatch(css, /\.demo-account\s*\{[^}]*(?:\{|;)\s*width:\s*100%/s);
});

test("로딩·오류·미선택 안내는 메뉴 안에 있고 닫은 뒤 안내는 계정 영역에 둔다", async () => {
  let finish;
  const page = loadPage({ listResult: () => new Promise(resolve => { finish = resolve; }) });
  page.click(page.get("#demo-login"));
  const notice = page.get("#demo-notice");
  assert.equal(notice.parentElement, page.get("#demo-students"));
  assert.match(text(notice), /불러오는 중/);
  finish({ ok: false, status: 503 });
  await flush();
  assert.equal(notice.parentElement, page.get("#demo-students"));
  assert.match(text(notice), /불러오지 못했어요/);
  page.click(page.get("#demo-login"));
  assert.equal(notice.parentElement, page.get(".demo-account"));
  assert.equal(text(notice), "");

  const unselected = loadPage();
  unselected.click(unselected.buttons[0]);
  await flush();
  assert.equal(unselected.get("#demo-notice").parentElement, unselected.get("#demo-students"));
  assert.match(text(unselected.get("#demo-notice")), /먼저 가상 학생을 골라 주세요/);
  click(unselected.choices()[1]);
  click(unselected.get("#demo-logout"));
  assert.equal(unselected.get("#demo-notice").parentElement, unselected.get(".demo-account"));
  assert.match(text(unselected.get("#demo-notice")), /가상 학생에서 나왔어요/);
});
