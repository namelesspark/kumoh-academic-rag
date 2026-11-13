// 서버·브라우저 없이 가상 화면과 가상 응답으로 패널 동작을 확인한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../../app/chat_web/assets/chat.js", import.meta.url), "utf8");
const features = ["graduation", "biskit", "photo", "ask", "calendar", "campus"];

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function loadPage({ transition, reduced = false, legacy = false, now = "2027-02-10T03:00:00Z" } = {}) {
  let focused;
  let calm = reduced;
  let motionChange;
  const requests = [];
  const response = deferred();
  const responses = [response];
  const timers = new Map();
  let timerId = 0;
  class Element {
    tagName = "BUTTON";
    children = [];
    listeners = new Map();
    attributes = new Map();
    dataset = {};
    value = "";
    hidden = false;
    disabled = false;
    files = [];
    textContent = "";
    clicks = 0;
    parts = new Map();
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    removeAttribute(key) { this.attributes.delete(key); }
    querySelector(selector) { return this.parts.get(selector) ?? null; }
    querySelectorAll() { return []; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    remove() {}
    focus() { focused = this; }
    click() { this.clicks++; this.listeners.get("click")?.({}); }
    scrollIntoView() {}
  }
  const elements = new Map();
  const cards = [];
  const panels = [];
  const actions = [];
  if (!legacy) {
    for (const feature of features) {
      const card = new Element();
      card.className = "card";
      card.type = "button";
      card.dataset.feature = feature;
      card.setAttribute("aria-controls", `panel-${feature}`);
      card.setAttribute("aria-expanded", "false");
      const panel = new Element();
      panel.tagName = "SECTION";
      panel.className = "feature-panel";
      panel.dataset.panel = feature;
      panel.id = `panel-${feature}`;
      panel.hidden = true;
      panel.parts.set("[data-panel-title]", new Element());
      panel.parts.get("[data-panel-title]").tabIndex = -1;
      panel.parts.set("[data-panel-close]", new Element());
      panel.parts.set("[data-panel-content]", new Element());
      if (!["calendar", "campus"].includes(feature)) {
        const start = new Element();
        start.dataset.action = feature === "biskit" ? "graduation" : feature;
        panel.parts.set("[data-action]", start);
        actions.push(start);
      }
      cards.push(card);
      panels.push(panel);
    }
  }
  const document = {
    querySelector(selector) {
      if (selector === "#feature-cards" && legacy) return null;
      if (!elements.has(selector)) elements.set(selector, new Element());
      return elements.get(selector);
    },
    querySelectorAll(selector) {
      return ({ "[data-feature]": cards, "[data-panel]": panels, "[data-action]": actions })[selector] ?? [];
    },
    createElement: tag => { const node = new Element(); node.tagName = tag.toUpperCase(); return node; },
    createTextNode: value => value,
  };
  if (transition !== undefined) document.startViewTransition = transition;
  const context = {
    document,
    window: { matchMedia: query => ({
      matches: query.includes("reduced-motion") && calm,
      addEventListener(type, listener) {
        if (query.includes("reduced-motion") && type === "change") motionChange = listener;
      },
    }) },
    fetch: (...args) => {
      requests.push(args);
      const pending = responses[requests.length - 1] ?? deferred();
      responses[requests.length - 1] = pending;
      return pending.promise;
    },
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return new Date(now).getTime(); }
    },
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id),
    AbortSignal: { timeout: milliseconds => ({ timeoutMs: milliseconds }) },
    URL,
  };
  runInNewContext(script, context);
  const get = selector => elements.get(selector);
  return {
    cards, panels, actions, requests, response, responses, get,
    evaluate: code => runInNewContext(code, context),
    content: index => panels[index].querySelector("[data-panel-content]"),
    finish: (body, index = requests.length - 1) => responses[index].resolve({ ok: true, json: async () => body }),
    tick: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); },
    focus: () => focused,
    reduce: value => { calm = value; motionChange?.({ matches: value }); },
    close: index => panels[index].querySelector("[data-panel-close]").click(),
    start: index => panels[index].querySelector("[data-action]").click(),
  };
}

function assertState(page, index) {
  assert.equal(page.get("#feature-cards").hidden, index !== null);
  page.panels.forEach((panel, current) => assert.equal(panel.hidden, current !== index));
  page.cards.forEach((card, current) => {
    assert.equal(card.attributes.get("aria-expanded"), String(current === index));
  });
}

function transitions() {
  const pending = [];
  const start = update => {
    const ready = deferred();
    const done = deferred();
    const finished = deferred();
    const entry = {
      update,
      ready: ready.promise,
      updateCallbackDone: done.promise,
      finished: finished.promise,
      skipTransition() { entry.skipped = true; },
      apply() { update(); done.resolve(); ready.resolve(); },
      finish() { finished.resolve(); },
      fail() { ready.reject(new Error("virtual transition failure")); done.reject(new Error("virtual callback failure")); finished.reject(new Error("virtual finish failure")); },
    };
    pending.push(entry);
    return entry;
  };
  return { start, pending };
}

test("기존 화면에는 카드·패널·전환 API가 없어도 실행된다", () => {
  const page = loadPage({ legacy: true });
  page.get("#reset").click();
  assert.equal(page.focus(), page.get("#question"));
});

test("미지원 환경에서 여섯 카드의 열기·닫기와 초점 복귀가 바로 동작한다", () => {
  const page = loadPage();
  page.cards.forEach((card, index) => {
    card.click();
    assertState(page, index);
    assert.equal(page.focus(), page.panels[index].querySelector("[data-panel-title]"));
    page.close(index);
    assertState(page, null);
    assert.equal(page.focus(), card);
  });
});

test("함수가 아닌 전환 속성은 호출하지 않는다", () => {
  const page = loadPage({ transition: {} });
  page.cards[0].click();
  assertState(page, 0);
});

test("지원 환경에서 열고 닫는 동안 원래 카드에만 모핑 표시를 두고 완료하면 지운다", async () => {
  const queue = transitions();
  const page = loadPage({ transition: queue.start });
  page.cards[0].click();
  assert.equal(page.cards[0].attributes.has("data-morph"), true);
  queue.pending[0].apply();
  assertState(page, 0);
  queue.pending[0].finish();
  await setImmediate();
  assert.equal(page.cards[0].attributes.has("data-morph"), false);
  page.close(0);
  assert.equal(page.cards[0].attributes.has("data-morph"), true);
  queue.pending[1].apply();
  assertState(page, null);
  assert.equal(page.focus(), page.cards[0]);
  queue.pending[1].finish();
  await setImmediate();
  assert.equal(page.cards[0].attributes.has("data-morph"), false);
});

test("전환 시작이 예외를 던져도 같은 상태 변경과 초점 이동을 한다", () => {
  const page = loadPage({ transition() { throw new Error("virtual unsupported transition"); } });
  page.cards[2].click();
  assertState(page, 2);
  page.close(2);
  assertState(page, null);
  assert.equal(page.focus(), page.cards[2]);
  assert.equal(page.cards[2].attributes.has("data-morph"), false);
});

test("비동기 전환 실패에서도 패널을 열고 표시를 정리한다", async () => {
  const queue = transitions();
  const page = loadPage({ transition: queue.start });
  page.cards[1].click();
  queue.pending[0].fail();
  await setImmediate();
  assertState(page, 1);
  assert.equal(page.focus(), page.panels[1].querySelector("[data-panel-title]"));
  assert.equal(page.cards[1].attributes.has("data-morph"), false);
});

test("사용 중 움직임 줄이기를 바꾸면 다음 열기와 닫기에서 바로 반영한다", async () => {
  const queue = transitions();
  const page = loadPage({ transition: queue.start, reduced: true });
  page.cards[0].click();
  assertState(page, 0);
  page.close(0);
  assert.equal(queue.pending.length, 0);
  page.reduce(false);
  page.cards[0].click();
  queue.pending[0].apply();
  page.reduce(true);
  page.close(0);
  assertState(page, null);
  assert.equal(queue.pending.length, 1);
  queue.pending[0].finish();
  await setImmediate();
  assertState(page, null);
});

test("연속 조작 뒤 이전 콜백과 완료가 도착해도 마지막 패널과 초점을 유지한다", async () => {
  const queue = transitions();
  const page = loadPage({ transition: queue.start });
  page.cards[0].click();
  page.cards[3].click();
  assert.equal(queue.pending[0].skipped, true);
  queue.pending[1].apply();
  queue.pending[0].apply();
  queue.pending[0].finish();
  await setImmediate();
  assertState(page, 3);
  assert.equal(page.cards[3].attributes.has("data-morph"), true);
  page.close(3);
  queue.pending[2].apply();
  queue.pending[1].finish();
  queue.pending[2].finish();
  await setImmediate();
  assertState(page, null);
  assert.equal(page.focus(), page.cards[3]);
});

test("전환 중 움직임 줄이기를 켜면 진행 중 전환을 건너뛴다", async () => {
  const queue = transitions();
  const page = loadPage({ transition: queue.start });
  page.cards[0].click();
  queue.pending[0].apply();
  page.reduce(true);
  assert.equal(queue.pending[0].skipped, true);
  queue.pending[0].finish();
  await setImmediate();
  assertState(page, 0);
  assert.equal(page.cards[0].attributes.has("data-morph"), false);
});

test("열기 콜백 전에 닫아도 원래 카드로 초점을 돌리고 늦은 열기를 무시한다", async () => {
  const queue = transitions();
  const page = loadPage({ transition: queue.start });
  page.cards[2].click();
  page.close(2);
  queue.pending[1].apply();
  queue.pending[0].apply();
  queue.pending[1].finish();
  queue.pending[0].finish();
  await setImmediate();
  assertState(page, null);
  assert.equal(page.focus(), page.cards[2]);
});

test("전환 중 시작해도 사진 선택은 바로 실행하고 늦은 전환은 초점을 빼앗지 않는다", async () => {
  const queue = transitions();
  const page = loadPage({ transition: queue.start });
  page.cards[2].click();
  queue.pending[0].apply();
  page.start(2);
  assert.equal(page.get("#photo-file").clicks, 1);
  queue.pending[0].finish();
  await setImmediate();
  assertState(page, null);
  assert.equal(page.focus(), page.get("#photo-file"));
});

test("닫기를 연달아 누르거나 Escape를 반복해도 닫기 전환과 원 카드 초점을 유지한다", async () => {
  for (const escape of [false, true]) {
    const queue = transitions();
    const page = loadPage({ transition: queue.start });
    page.cards[1].click();
    queue.pending[0].apply();
    queue.pending[0].finish();
    await setImmediate();
    const close = () => {
      if (escape) page.panels[1].listeners.get("keydown")({ key: "Escape", preventDefault() {} });
      else page.close(1);
    };
    close();
    close();
    assert.equal(queue.pending.length, 2);
    queue.pending[1].apply();
    queue.pending[1].finish();
    await setImmediate();
    assertState(page, null);
    assert.equal(page.focus(), page.cards[1]);
  }
});

test("패널 안 Escape만 닫으며 다른 키와 숨은 패널의 Escape는 무시한다", () => {
  const page = loadPage();
  page.cards[4].click();
  let prevented = 0;
  const key = (index, value) => page.panels[index].listeners.get("keydown")({ key: value, preventDefault() { prevented++; } });
  key(4, "Enter");
  key(0, "Escape");
  assertState(page, 4);
  key(4, "Escape");
  assertState(page, null);
  assert.equal(prevented, 1);
  assert.equal(page.focus(), page.cards[4]);
});

test("질문과 사진 시작은 패널을 닫고 실행 대상으로 초점을 옮기며 사진 선택을 즉시 호출한다", () => {
  const page = loadPage();
  page.cards[3].click();
  page.start(3);
  assertState(page, null);
  assert.equal(page.focus(), page.get("#question"));
  page.cards[2].click();
  page.start(2);
  assertState(page, null);
  assert.equal(page.focus(), page.get("#photo-file"));
  assert.equal(page.get("#photo-file").clicks, 1);
  assert.equal(page.requests.length, 0);
});

test("졸업 체크와 추천 시작은 같은 요청을 한 번 보내고 요청 중 모든 시작 버튼을 잠근다", async () => {
  for (const index of [0, 1]) {
    const page = loadPage();
    page.cards[index].click();
    page.start(index);
    assertState(page, null);
    assert.equal(page.focus(), page.get("#question"));
    assert.equal(page.requests.length, 1);
    assert.equal(page.requests[0][0], "/api/v1/graduation-demo");
    assert.equal(page.actions.every(action => action.disabled), true);
    page.start(index);
    page.start(2);
    assert.equal(page.requests.length, 1);
    assert.equal(page.get("#photo-file").clicks, 0);
    page.response.resolve({ ok: false });
    await setImmediate();
    assert.equal(page.actions.every(action => !action.disabled), true);
  }
});

test("패널을 연 채 질문을 보낸 뒤 새 대화로 돌아오면 카드 목록을 복원한다", async () => {
  const page = loadPage();
  page.cards[3].click();
  page.get("#question").value = "가상 규정 질문";
  page.get("#composer").listeners.get("submit")({ preventDefault() {} });
  assert.equal(page.requests.length, 1);
  page.response.resolve({ ok: false });
  await setImmediate();
  page.get("#reset").click();
  assertState(page, null);
  assert.equal(page.focus(), page.get("#question"));
  assert.equal(page.get("#transcript").children[0], page.get("#empty"));
});

function descendants(node) {
  return typeof node === "string" ? [] : [node, ...node.children.flatMap(descendants)];
}

function text(node) {
  if (typeof node === "string") return node;
  return node.textContent + node.children.map(text).join(" ");
}

const guideSource = { title: "가상 안내 출처", url: "https://example.invalid/guide", checked_on: "2027-02-01" };
const calendarEvent = (audience, starts_on, ends_on = starts_on) => ({ audience, starts_on, ends_on, sources: [guideSource] });
const campusPlace = (id = "fictional-hall") => ({
  id, name: `가상 장소 ${id}`, purpose: "가상 학생 안내", location: "가상 건물 1층",
  map_number: null, hours: null, audience: null, cost: null, directions: null, valid_period: null,
  sources: [guideSource],
});
const petState = page => page.get("#pet-dock").attributes.get("data-state");
const retryButton = page => descendants(page.content(4)).find(node => node.textContent === "다시 시도");

test("학사 일정은 열 때 한 번 조회하고 지난 일정을 빼 시작일순으로 날짜만 표시한다", async () => {
  const page = loadPage();
  page.cards[4].click();
  page.cards[4].click();
  assert.equal(page.requests.length, 1);
  assert.equal(page.requests[0][0], "/api/v1/academic-calendar/2027/1");
  assert.equal(petState(page), "searching");
  page.finish({ events: [
    calendarEvent("가상 내일", "2027-02-11"), calendarEvent("가상 어제", "2027-02-09"),
    calendarEvent("가상 오늘", "2027-02-10"), calendarEvent("가상 진행 중", "2027-02-08", "2027-02-12"),
  ] });
  await setImmediate();
  const shown = text(page.content(4));
  assert.doesNotMatch(shown, /가상 어제/);
  assert.ok(shown.indexOf("가상 진행 중") < shown.indexOf("가상 오늘"));
  assert.ok(shown.indexOf("가상 오늘") < shown.indexOf("가상 내일"));
  assert.match(shown, /2027년/);
  assert.doesNotMatch(shown, /\d{1,2}:\d{2}|남은 시간|마감 시각/);
  assert.equal(petState(page), "found");
  page.tick();
  assert.equal(petState(page), "answer");
});

test("한국 표준시 자정 경계로 오늘 종료 일정의 포함 여부를 바꾼다", async () => {
  for (const [now, included] of [["2027-02-10T14:59:59Z", true], ["2027-02-10T15:00:00Z", false]]) {
    const page = loadPage({ now });
    page.cards[4].click();
    page.finish({ events: [calendarEvent("가상 경계 일정", "2027-02-10")] });
    await setImmediate();
    assert.equal(text(page.content(4)).includes("가상 경계 일정"), included);
    assert.equal(petState(page), included ? "found" : "hold");
  }
});

test("빈 일정은 범위와 남은 일정이 없음을 알리고 답변을 보류한다", async () => {
  const page = loadPage();
  page.cards[4].click();
  page.finish({ events: [] });
  await setImmediate();
  assert.match(text(page.content(4)), /2027학년도 1학기/);
  assert.match(text(page.content(4)), /없/);
  assert.equal(petState(page), "hold");
});

test("시작일과 종료일이 같으면 한 번만 적고 범위 일정은 양쪽 날짜를 적는다", async () => {
  const page = loadPage();
  page.cards[4].click();
  page.finish({ events: [calendarEvent("가상 하루", "2027-02-11"), calendarEvent("가상 기간", "2027-02-12", "2027-02-13")] });
  await setImmediate();
  const times = descendants(page.content(4)).filter(node => node.tagName === "TIME");
  assert.equal(times.filter(node => node.dateTime === "2027-02-11").length, 1);
  assert.equal(times.filter(node => node.dateTime === "2027-02-12").length, 1);
  assert.equal(times.filter(node => node.dateTime === "2027-02-13").length, 1);
});

test("연도 없는 날짜·없는 날짜·역순 날짜는 응답 전체를 오류로 처리한다", async () => {
  for (const invalid of [calendarEvent("가상 잘못된 일정", "02-11"), calendarEvent("가상 잘못된 일정", "2027-02-30"), calendarEvent("가상 잘못된 일정", "2027-02-12", "2027-02-11")]) {
    const page = loadPage();
    page.cards[4].click();
    page.finish({ events: [calendarEvent("가상 정상 일정", "2027-02-11"), invalid] });
    await setImmediate();
    assert.equal(petState(page), "error");
    assert.doesNotMatch(text(page.content(4)), /가상 정상 일정/);
    assert.ok(retryButton(page));
  }
});

test("실패 뒤 다시 시도를 연타해도 한 번 조회하고 성공 후 잠금을 푼다", async () => {
  const page = loadPage();
  page.cards[4].click();
  page.response.resolve({ ok: false, status: 503 });
  await setImmediate();
  assert.equal(petState(page), "error");
  const retry = retryButton(page);
  assert.ok(retry);
  retry.click();
  retry.click();
  assert.equal(page.requests.length, 2);
  page.finish({ events: [] });
  await setImmediate();
  assert.equal(page.evaluate("busy"), false);
  assert.equal(petState(page), "hold");
});

test("연결 실패와 본문 해석 실패는 패널 안에서 다시 시도할 수 있다", async () => {
  for (const failure of ["network", "body"]) {
    const page = loadPage();
    page.cards[4].click();
    if (failure === "network") page.response.reject(new Error("fictional network failure"));
    else page.response.resolve({ ok: true, json: async () => { throw new SyntaxError("fictional body failure"); } });
    await setImmediate();
    assert.equal(petState(page), "error");
    assert.ok(retryButton(page));
    assert.equal(page.evaluate("busy"), false);
  }
});

test("다른 요청 중 연 패널은 새 요청과 펫 변경 없이 다시 시도를 보여 준다", async () => {
  const page = loadPage();
  page.cards[0].click();
  page.start(0);
  page.cards[4].click();
  assert.equal(page.requests.length, 1);
  assert.equal(petState(page), "searching");
  assert.ok(retryButton(page));
  retryButton(page).click();
  assert.equal(page.requests.length, 1);
  page.response.resolve({ ok: false });
  await setImmediate();
  retryButton(page).click();
  assert.equal(page.requests.length, 2);
  page.finish({ events: [] });
  await setImmediate();
  assert.equal(page.evaluate("busy"), false);
});

test("닫거나 다른 패널로 옮긴 뒤 도착한 응답은 내용을 무시하고 펫의 대기를 끝낸다", async () => {
  for (const close of [true, false]) {
    const page = loadPage();
    page.cards[4].click();
    if (close) page.close(4);
    else page.cards[3].click();
    const before = text(page.content(4));
    page.finish({ events: [calendarEvent("가상 늦은 일정", "2027-02-11")] });
    await setImmediate();
    assert.equal(text(page.content(4)), before);
    assert.equal(petState(page), "idle");
    assert.equal(page.get("#pet-dots").hidden, true);
    assert.equal(page.evaluate("busy"), false);
  }
});

test("일정·장소의 축하 중 닫거나 다른 패널로 옮겨도 답변 표시로 넘어간다", async () => {
  for (const index of [4, 5]) {
    for (const close of [true, false]) {
      const page = loadPage();
      page.cards[index].click();
      page.finish(index === 4 ? { events: [calendarEvent("가상 일정", "2027-02-11")] } : { places: [campusPlace()] });
      await setImmediate();
      assert.equal(petState(page), "found");
      if (close) page.close(index);
      else page.cards[3].click();
      page.tick();
      assert.equal(petState(page), "answer");
      assert.equal(page.get("#pet-dots").hidden, true);
    }
  }
});

test("패널 조회의 제한 시간 실패는 잠금을 풀고 다시 시도할 수 있다", async () => {
  for (const index of [4, 5]) {
    const page = loadPage();
    page.cards[index].click();
    assert.equal(page.requests[0][1].signal.timeoutMs, 30_000);
    const error = new Error("fictional request timeout");
    error.name = "TimeoutError";
    page.response.reject(error);
    await setImmediate();
    assert.equal(page.evaluate("busy"), false);
    assert.equal(petState(page), "error");
    assert.equal(page.get("#pet-dots").hidden, true);
    descendants(page.content(index)).find(node => node.textContent === "다시 시도").click();
    assert.equal(page.requests.length, 2);
    page.finish(index === 4 ? { events: [] } : { places: [] });
    await setImmediate();
    assert.equal(page.evaluate("busy"), false);
    assert.equal(petState(page), "hold");
  }
});

test("장소 목록은 응답 순서를 지키고 새 요청 없이 상세와 목록의 초점을 옮긴다", async () => {
  const page = loadPage();
  page.cards[5].click();
  assert.equal(page.requests[0][0], "/api/v1/campus-guide");
  page.finish({ places: [campusPlace("second"), { ...campusPlace("first"), hours: "가상 운영 시간", directions: "https://example.invalid/plain-text" }] });
  await setImmediate();
  const buttons = descendants(page.content(5)).filter(node => node.tagName === "button" || node.tagName === "BUTTON").filter(node => node.listeners.has("click"));
  assert.match(text(buttons[0]), /second/);
  assert.match(text(buttons[1]), /first/);
  buttons[1].click();
  assert.equal(page.requests.length, 1);
  assert.match(text(page.focus()), /first/);
  assert.match(text(page.content(5)), /가상 건물 1층/);
  assert.match(text(page.content(5)), /가상 운영 시간/);
  assert.doesNotMatch(text(page.content(5)), /확인 필요/);
  assert.equal(descendants(page.content(5)).filter(node => node.attributes.has("href")).length, 1);
  const back = descendants(page.content(5)).find(node => node.textContent === "목록으로");
  assert.ok(back);
  back.click();
  assert.match(text(page.focus()), /first/);
  assert.equal(page.requests.length, 1);
});

test("장소 목록과 필수 글자 필드의 잘못된 응답은 오류로 처리한다", async () => {
  for (const result of [{ places: {} }, { places: [{ ...campusPlace(), id: 3 }] }, { places: [{ ...campusPlace(), name: null }] }, { places: [{ ...campusPlace(), purpose: undefined }] }, { places: [{ ...campusPlace(), location: 3 }] }]) {
    const page = loadPage();
    page.cards[5].click();
    page.finish(result);
    await setImmediate();
    assert.equal(petState(page), "error");
    assert.match(text(page.content(5)), /다시 시도/);
  }
});

test("빈 장소 목록은 항목을 만들지 않고 답변을 보류한다", async () => {
  const page = loadPage();
  page.cards[5].click();
  page.finish({ places: [] });
  await setImmediate();
  assert.equal(petState(page), "hold");
  assert.match(text(page.content(5)), /없/);
  assert.equal(descendants(page.content(5)).filter(node => node.listeners.has("click")).length, 0);
});

test("출처는 안전한 주소와 날짜 확인일을 함께 갖출 때만 링크로 만든다", async () => {
  const page = loadPage();
  page.cards[4].click();
  const sources = [guideSource, { ...guideSource, title: "가상 위험 주소", url: "javascript:alert(1)" }, { ...guideSource, title: "가상 확인일 없음", checked_on: null }];
  page.finish({ events: [{ ...calendarEvent("가상 링크 일정", "2027-02-11"), sources }] });
  await setImmediate();
  const content = page.content(4);
  assert.equal(descendants(content).filter(node => node.attributes.has("href")).length, 1);
  assert.match(text(content), /가상 위험 주소/);
  assert.match(text(content), /가상 확인일 없음/);
  assert.match(text(content), /공식 페이지에서 다시 확인/);
});

test("전환 콜백 전에 새 대화를 눌러도 늦은 전환이 패널을 다시 열지 않는다", async () => {
  const queue = transitions();
  const page = loadPage({ transition: queue.start });
  page.cards[0].click();
  page.get("#reset").click();
  queue.pending[0].apply();
  queue.pending[0].finish();
  await setImmediate();
  assertState(page, null);
  assert.equal(page.focus(), page.get("#question"));
});
