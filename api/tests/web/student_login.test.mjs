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

function loadPage({ startViewTransition, saved = null, storageFails = false, list = students, listResult = () => ok({ students: list }), loginResult = (_path, options) => ok({ student: students.find(student => `2099000${student.id.slice(-1)}` === JSON.parse(options.body).student_number) }), result = () => ok(graduation()) } = {}) {
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
  const accounts = students.map(student => {
    const button = create("button");
    button.dataset.demoAccount = `2099000${student.id.slice(-1)}`;
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
      startViewTransition,
      addEventListener(name, listener, capture = false) {
        documentListeners.set(name, listener);
        documentCapture.set(name, capture === true || capture.capture === true);
      },
      querySelector: get,
      querySelectorAll: selector => selector === "[data-action]" ? buttons : selector === "[data-demo-account]" ? accounts : [],
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
      return path === "/api/v1/demo-students" ? listResult() : path === "/api/v1/demo-login" ? loginResult(path, options) : result(path, options);
    },
  }, { filename: "chat.js" });
  get("#transcript").append(get("#empty"));
  return {
    get, buttons, accounts, requests, storage, timers,
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
  const student = students[index];
  page.get("#student-number").value = `2099000${student.id.slice(-1)}`;
  page.get("#student-password").value = `${student.id}-pass`;
  page.get("#login-form").listeners.get("submit")({ preventDefault() {} });
  await flush();
  for (const [id, timer] of page.timers) {
    if (timer.delay === 650) { page.timers.delete(id); timer.callback(); }
  }
  await flush();
}
function ask(page) {
  page.get("#question").value = "가상 질문";
  page.get("#composer").listeners.get("submit")({ preventDefault() {} });
}

test("시연 계정 버튼은 두 칸만 채우고 로그인 요청이나 저장을 하지 않는다", () => {
  const page = loadPage();
  for (const [index, account] of page.accounts.entries()) {
    click(account);
    assert.equal(page.get("#student-number").value, `2099000${students[index].id.slice(-1)}`);
    assert.equal(page.get("#student-password").value, `${students[index].id}-pass`);
    assert.equal(page.requests.length, 0);
    assert.equal(page.storage.size, 0);
    assert.equal(text(page.get("#login-pet-line")), "좋아요, 로그인을 눌러 보세요");
  }
});

test("로그아웃해도 일반 질문 대화는 남긴다", async () => {
  const page = loadPage({ result: path => path === "/api/v1/chat" ? ok({ session_id: "fictional-session", answered: false }) : ok(graduation()) });
  await select(page);
  ask(page);
  await flush();
  const questionTurn = page.get("#transcript").children[0];
  click(page.buttons[0]);
  await flush();
  click(page.get("#demo-logout"));
  assert.deepEqual(page.get("#transcript").children, [questionTurn]);
  assert.match(text(questionTurn), /가상 질문/);
});

test("서버가 성공하기 전에는 학생과 탭 저장값을 정하지 않는다", async () => {
  let finish;
  const page = loadPage({ loginResult: () => new Promise(resolve => { finish = resolve; }) });
  page.get("#student-number").value = "20990002";
  page.get("#student-password").value = "demo-d02-pass";
  page.get("#login-form").listeners.get("submit")({ preventDefault() {} });
  assert.equal(page.storage.size, 0);
  assert.equal(page.requests[0].path, "/api/v1/demo-login");
  assert.equal(page.requests[0].options.method, "POST");
  assert.deepEqual(JSON.parse(page.requests[0].options.body), { student_number: "20990002", password: "demo-d02-pass" });
  finish(ok({ student: students[0] }));
  await flush();
  assert.deepEqual([...page.storage], [[storageKey, "demo-d02"]]);
  assert.equal(page.get("#login-screen").hidden, false);
  const timer = [...page.timers.values()][0];
  assert.equal(timer.delay, 650);
  timer.callback();
  await flush();
  assert.equal(page.get("#login-screen").hidden, true);
  assert.equal(page.get("#main-screen").hidden, false);
  assert.equal(text(page.get("#demo-label")), students[0].label);
});

test("허용된 시연 학번의 비밀번호를 그대로 보내고 불일치는 로그인 화면에 남긴다", async () => {
  const page = loadPage({ loginResult: () => ({ ok: false, status: 401, json: async () => ({ detail: "학번 또는 비밀번호가 맞지 않아요" }) }) });
  page.get("#student-number").value = "20990002";
  page.get("#student-password").value = " 다른 비밀번호 ";
  page.get("#login-form").listeners.get("submit")({ preventDefault() {} });
  await flush();
  assert.deepEqual(JSON.parse(page.requests[0].options.body), { student_number: "20990002", password: " 다른 비밀번호 " });
  assert.equal(page.storage.size, 0);
  assert.match(text(page.get("#login-error")), /학번 또는 비밀번호가 맞지 않아요/);
  assert.match(text(page.get("#login-pet-line")), /쉿, 시연 계정으로만 들어올 수 있어요/);
});

test("세 시연 학번 밖의 값은 서버로 보내지 않고 같은 불일치 문구를 표시한다", async () => {
  for (const number of ["", "20990001", "20990005", "20990099", "2099000", "209900020", " 20990002", "20990002 ", "DEMO-D02", "2099가002"]) {
    const page = loadPage();
    page.get("#student-number").value = number;
    page.get("#student-password").value = "가상 비밀번호";
    page.get("#login-form").listeners.get("submit")({ preventDefault() {} });
    await flush();
    assert.equal(page.requests.length, 0, number);
    assert.equal(page.storage.size, 0);
    assert.equal(page.get("#login-screen").hidden, false);
    assert.equal(text(page.get("#login-error")), "학번 또는 비밀번호가 맞지 않아요");
  }
});

test("둘러보기는 저장하지 않고 메인으로 가며 개인 기능은 로그인을 안내한다", async () => {
  const page = loadPage();
  click(page.get("#browse-main"));
  assert.equal(page.get("#login-screen").hidden, true);
  assert.equal(page.get("#main-screen").hidden, false);
  assert.equal(page.get("#demo-login").hidden, false);
  assert.equal(page.storage.size, 0);
  click(page.buttons[0]);
  await flush();
  assert.equal(page.get("#login-screen").hidden, false);
  assert.equal(page.requests.length, 0);
});

test("세 학생은 제출 뒤 ID 하나만 저장하고 로그아웃하면 개인 결과를 지운다", async () => {
  for (let index = 0; index < students.length; index++) {
    const student = students[index];
    const page = loadPage({ result: () => ok(graduation(student.id)) });
    await select(page, index);
    assert.deepEqual([...page.storage], [[storageKey, student.id]]);
    assert.equal(page.get("#demo-identity").hidden, false);
    click(page.buttons[0]);
    await flush();
    assert.equal(page.tables().length, 1);
    assert.equal(page.requests.at(-1).path, `/api/v1/graduation-demo?student_id=${student.id}`);
    click(page.get("#demo-logout"));
    assert.equal(page.storage.size, 0);
    assert.equal(page.tables().length, 0);
    assert.equal(page.get("#login-screen").hidden, false);
    assert.equal(page.get("#student-password").value, "");
  }
});

test("둘러보기와 로그아웃 뒤 늦은 로그인 응답은 이전 화면을 되살리지 않는다", async () => {
  for (const destination of ["#browse-main", "#demo-logout"]) {
    let finish;
    const page = loadPage({ loginResult: () => new Promise(resolve => { finish = resolve; }) });
    page.get("#student-number").value = "20990002";
    page.get("#student-password").value = "demo-d02-pass";
    page.get("#login-form").listeners.get("submit")({ preventDefault() {} });
    click(page.get(destination));
    finish(ok({ student: students[0] }));
    await flush();
    assert.equal(page.storage.size, 0);
    assert.equal(page.get("#demo-identity").hidden, true);
    assert.equal(page.timers.size, 0);
  }
});

test("재제출 뒤 먼저 도착한 이전 계정 응답은 버린다", async () => {
  const pending = [];
  const page = loadPage({ loginResult: () => new Promise(resolve => pending.push(resolve)) });
  for (const student of students.slice(0, 2)) {
    page.get("#student-number").value = `2099000${student.id.slice(-1)}`;
    page.get("#student-password").value = `${student.id}-pass`;
    page.get("#login-form").listeners.get("submit")({ preventDefault() {} });
  }
  pending[0](ok({ student: students[0] }));
  await flush();
  assert.equal(page.storage.size, 0);
  pending[1](ok({ student: students[1] }));
  await flush();
  assert.deepEqual([...page.storage], [[storageKey, students[1].id]]);
});

test("취소한 축하 타이머를 직접 불러도 화면이 돌아가지 않는다", async () => {
  const page = loadPage();
  page.get("#student-number").value = "20990002";
  page.get("#student-password").value = "demo-d02-pass";
  page.get("#login-form").listeners.get("submit")({ preventDefault() {} });
  await flush();
  const oldTimer = [...page.timers.values()][0];
  click(page.get("#demo-logout"));
  oldTimer.callback();
  await flush();
  assert.equal(page.get("#login-screen").hidden, false);
  assert.equal(page.storage.size, 0);
});

test("저장 ID는 목록으로 확인해 복원하고 사라진 ID는 지운다", async () => {
  const page = loadPage({ saved: "demo-d04" });
  await flush();
  assert.deepEqual(page.requests.map(request => request.path), ["/api/v1/demo-students"]);
  assert.equal(text(page.get("#demo-label")), "가상 학생 D04");
  assert.equal(page.get("#demo-identity").hidden, false);
  assert.equal(page.timers.size, 0);
  const removed = loadPage({ saved: "demo-retired" });
  await flush();
  assert.equal(removed.storage.size, 0);
  assert.equal(removed.get("#demo-identity").hidden, true);
});

test("목록 조회가 일시 실패하면 ID를 남기고 탭 저장소가 막혀도 로그인한다", async () => {
  const failed = loadPage({ saved: "demo-d04", listResult: () => { throw new Error("가상 실패"); } });
  await flush();
  assert.deepEqual([...failed.storage], [[storageKey, "demo-d04"]]);
  assert.equal(failed.get("#demo-identity").hidden, true);
  assert.match(text(failed.get("#login-error")), /복원하지 못했어요/);
  const page = loadPage({ storageFails: true });
  await select(page);
  click(page.buttons[0]);
  await flush();
  assert.equal(page.tables().length, 1);
  click(page.get("#demo-logout"));
  assert.equal(page.tables().length, 0);
});

test("로그아웃 뒤 늦은 졸업 결과와 예전 재시도는 이전 학생 결과를 만들지 않는다", async () => {
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
  const failed = loadPage({ result: () => { throw new Error("가상 실패"); } });
  await select(failed);
  click(failed.buttons[0]);
  await flush();
  const retry = failed.retries()[0];
  click(failed.get("#demo-logout"));
  await select(failed, 1);
  const before = failed.requests.length;
  click(retry);
  await flush();
  assert.equal(failed.requests.length, before);
});


test("로그인 화면 전환의 동기·비동기 실패에도 메인으로 이동한다", async () => {
  for (const kind of ["throw", "ready", "updateCallbackDone", "finished"]) {
    const page = loadPage({ startViewTransition() {
      if (kind === "throw") throw new Error("가상 전환 실패");
      return Object.fromEntries(["ready", "updateCallbackDone", "finished"].map(name =>
        [name, name === kind ? Promise.reject(new Error("가상 전환 실패")) : new Promise(() => {})]));
    } });
    await select(page);
    await flush();
    assert.equal(page.get("#login-screen").hidden, true, kind);
    assert.equal(page.get("#main-screen").hidden, false, kind);
  }
});
