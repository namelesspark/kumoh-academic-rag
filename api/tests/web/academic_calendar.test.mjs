import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../../app/chat_web/assets/chat.js", import.meta.url), "utf8");
const event = (audience, starts_on, ends_on = starts_on, sources = []) => ({ audience, starts_on, ends_on, sources });
const all = (node, match) => typeof node === "string" ? [] :
  [...(match(node) ? [node] : []), ...node.children.flatMap(child => all(child, match))];
const byClass = (node, name) => all(node, child => child.className === name);
const attr = (node, key) => node.attributes.get(key);
const visibleText = node => typeof node === "string" ? node :
  [node.textContent, ...node.children.map(visibleText)].join(" ");

async function openCalendar(events, today = "2028-02-27") {
  let activeElement;
  const requests = [];
  class Element {
    children = [];
    attributes = new Map();
    dataset = {};
    handlers = new Map();
    textContent = "";
    value = "";
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); }
    addEventListener(type, handler) { this.handlers.set(type, handler); }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    replaceChildren(...nodes) { this.children = nodes; }
    append(...nodes) { this.children.push(...nodes); }
    focus() { activeElement = this; }
    click() { this.handlers.get("click")?.({}); }
    press(key) {
      let prevented = false;
      this.handlers.get("keydown")?.({ key, preventDefault() { prevented = true; } });
      // 버튼은 기본 키 동작으로 클릭도 일으킨다.
      if (!prevented && ["Enter", " "].includes(key)) this.click();
      return prevented;
    }
  }
  const card = new Element();
  card.dataset.feature = "calendar";
  const panel = new Element();
  panel.dataset.panel = "calendar";
  const content = new Element();
  panel.querySelector = selector => selector === "[data-panel-content]" ? content : null;
  const featureList = new Element();
  const elements = new Map([["#feature-cards", featureList]]);
  const context = {
    document: {
      body: new Element(),
      get activeElement() { return activeElement; },
      addEventListener() {},
      querySelector(selector) {
        if (selector === "#ai-mode-button") return null;
        if (!elements.has(selector)) elements.set(selector, new Element());
        return elements.get(selector);
      },
      querySelectorAll: selector => ({ "[data-feature]": [card], "[data-panel]": [panel] })[selector] ?? [],
      createElement: tag => Object.assign(new Element(), { tag }),
      createTextNode: text => text,
    },
    window: {},
    Date: class extends Date {
      static now() { return Date.parse(today + "T00:00:00Z"); }
    },
    fetch: async path => {
      requests.push(path);
      assert.equal(path, "/api/v1/academic-calendar/2027/1");
      return { ok: true, json: async () => ({ events }) };
    },
    setTimeout() {},
    clearTimeout() {},
    AbortSignal,
    URL,
  };
  runInNewContext(script, context);
  card.click();
  await setImmediate();
  const root = content.children[0];
  assert.equal(root.className, "acal");
  const day = number => byClass(root, "acal-day").find(button =>
    byClass(button, "acal-day-number")[0].textContent === String(number));
  const tabStop = () => {
    const stops = byClass(root, "acal-day").filter(button => button.tabIndex === 0);
    assert.equal(stops.length, 1);
    return stops[0];
  };
  return {
    root, day, tabStop, requests,
    active: () => activeElement,
    title: () => byClass(root, "acal-title")[0].textContent,
    list: () => byClass(root, "acal-day-list")[0],
    nav: direction => all(root, node => node.dataset.acalNav === direction)[0],
    toggle: all(root, node => Object.hasOwn(node.dataset, "acalViewToggle"))[0],
    language: lang => runInNewContext(`applyLang(${JSON.stringify(lang)})`, context),
  };
}

test("겹친 기간은 주마다 빈 줄을 채우고 날짜별로 넘친 일정과 점을 그린다", async () => {
  const page = await openCalendar([
    event("가상 수강 신청·시험", "2028-02-24", "2028-02-29"),
    event("가상 시험", "2028-02-25", "2028-02-28"),
    event("가상 휴일", "2028-02-26", "2028-02-27"),
    event("가상 등록", "2028-02-27"),
    event("가상 설명회", "2028-02-29", "2028-02-29",
      [{ title: "가상 시험 출처", url: "https://example.invalid/calendar", checked_on: "2028-02-01" }]),
  ]);
  const weeks = byClass(page.root, "acal-week");
  assert.equal(attr(byClass(page.root, "acal-grid")[0], "role"), "grid");
  assert.equal(byClass(page.root, "acal-weekdays")[0].children.length, 7);
  for (const week of weeks) {
    assert.equal(attr(week, "role"), "row");
    assert.equal(byClass(week, "acal-cell").length, 7);
  }
  const bars = byClass(page.root, "acal-bar");
  assert.deepEqual(bars.filter(bar => bar.dataset.kind === "enroll").map(bar => ({ ...bar.dataset })),
    [{ col: "5", span: "3", lane: "0", kind: "enroll" }, { col: "1", span: "3", lane: "0", kind: "enroll" }]);
  assert.ok(bars.every(bar => attr(bar, "aria-hidden") === "true"));
  assert.equal(bars.find(bar => bar.dataset.kind === "neutral").dataset.lane, "1");
  assert.equal(page.day(26).dataset.more, "1");
  assert.equal(page.day(27).dataset.more, "2");
  assert.match(visibleText(page.day(27)), /\+2개/);
  assert.equal(page.day(28).dataset.more, undefined);
  assert.equal(attr(page.day(27), "aria-current"), "date");
  assert.deepEqual(byClass(page.day(27), "acal-dot").map(dot => dot.dataset.kind), ["enroll", "exam", "holiday"]);
  assert.equal(byClass(page.day(29), "acal-dot")[1].dataset.kind, "neutral");
  assert.ok(all(page.root, node => Object.hasOwn(node.dataset, "outside")).every(cell => !cell.children.length));
  page.day(29).click();
  assert.match(visibleText(page.list()), /가상 수강 신청·시험.*가상 설명회.*가상 시험 출처/);
  assert.doesNotMatch(visibleText(page.list()), /가상 휴일/);
  assert.equal(all(page.list(), node => attr(node, "href") === "https://example.invalid/calendar").length, 1);
});

test("2월 27일에 겹친 가상 일정 세 건의 점·막대·초과 표시와 출처, 세 언어의 날짜 버튼 이름을 확인한다", async () => {
  const entries = [
    { title: "가상 수강신청", start: "2028-02-25", end: "2028-02-27", kind: "enroll" },
    { title: "가상 시험", start: "2028-02-26", end: "2028-02-28", kind: "exam" },
    { title: "가상 등록", start: "2028-02-27", end: "2028-02-27", kind: "register" },
  ].map(entry => ({
    ...entry,
    source: {
      title: `${entry.title} 출처`,
      url: `https://example.invalid/calendar/${entry.kind}`,
      checked_on: "2028-02-01",
    },
  }));
  const page = await openCalendar(entries.map(({ title, start, end, source }) =>
    event(title, start, end, [source])), "2028-02-26");
  const day = page.day(27);
  assert.deepEqual(byClass(day, "acal-dot").map(dot => dot.dataset.kind), ["enroll", "exam", "register"]);

  const week = byClass(page.root, "acal-week").find(row => byClass(row, "acal-day").includes(day));
  assert.deepEqual(byClass(week, "acal-bar").map(bar => ({ ...bar.dataset })), [
    { col: "1", span: "1", lane: "0", kind: "enroll" },
    { col: "1", span: "2", lane: "1", kind: "exam" },
  ]);
  assert.equal(day.dataset.more, "1");
  const badges = byClass(day, "acal-more");
  assert.deepEqual(badges.map(badge => [badge.tag, attr(badge, "aria-hidden"), badge.textContent]),
    [["span", "true", "+1개"]]);

  day.click();
  const rows = byClass(page.list(), "evidence");
  assert.deepEqual(rows.map(row => all(row, node => node.tag === "h5").map(heading => heading.textContent)),
    entries.map(({ title }) => [title]));
  const linksByRow = rows.map(row => all(row, node => node.tag === "a")
    .map(link => [link.textContent, attr(link, "href")]));
  assert.deepEqual(linksByRow, entries.map(({ source }) => [[source.title, source.url]]));

  const labelsByLanguage = {
    ko: ["2028년 2월 27일 · 일정 3건", "2028년 2월 28일 · 일정 1건", "2028년 2월 29일 · 일정 0건"],
    en: ["February 27 2028 · 3 events", "February 28 2028 · 1 event", "February 29 2028 · 0 events"],
    zh: ["2028年2月27日 · 3项日程", "2028年2月28日 · 1项日程", "2028年2月29日 · 0项日程"],
  };
  for (const [language, expected] of Object.entries(labelsByLanguage)) {
    page.language(language);
    const labels = [27, 28, 29].map(date => attr(page.day(date), "aria-label"));
    assert.deepEqual(labels, expected, language);
    for (const label of labels) assert.doesNotMatch(label, /\+1/);
  }
});

test("고른 날 목록은 요일과 날짜가 가로로 밀리는 상자 밖에 있다", async () => {
  const page = await openCalendar([event("가상 일정", "2028-02-27")]);
  const body = byClass(page.root, "acal-body")[0];
  const dayList = page.list();
  assert.ok(page.root.children.includes(dayList));
  assert.deepEqual(body.children.map(node => node.className), ["acal-weekdays", "acal-grid"]);
  assert.match(visibleText(dayList), /가상 일정/);

  page.toggle.click();
  assert.equal(dayList.hidden, true);
  page.toggle.click();
  assert.equal(dayList.hidden, false);
  assert.deepEqual(body.children.map(node => node.className), ["acal-weekdays", "acal-grid"]);
  assert.equal(page.list(), dayList);
});

test("키로 날짜를 넘기고 윤년 말일을 맞추며 Enter와 Space로 고른다", async () => {
  const page = await openCalendar([event("가상 일정", "2028-03-31")]);
  assert.equal(page.title(), "2028년 3월");
  const key = (name, target) => {
    assert.equal(page.tabStop().press(name), true);
    assert.equal(page.tabStop(), page.day(target));
    assert.equal(page.active(), page.day(target));
  };
  key("PageUp", 29);
  assert.equal(page.title(), "2028년 2월");
  key("ArrowRight", 1);
  assert.equal(page.title(), "2028년 3월");
  key("Home", 27);
  assert.equal(page.title(), "2028년 2월");
  key("End", 4);
  key("ArrowDown", 11);
  key("ArrowUp", 4);
  key("ArrowLeft", 3);
  assert.match(visibleText(page.list()), /3월 31일 일정/);
  page.tabStop().press("Enter");
  assert.match(visibleText(page.list()), /3월 3일 일정/);
  key("PageDown", 3);
  page.tabStop().press(" ");
  assert.match(visibleText(page.list()), /4월 3일 일정/);
  assert.equal(all(page.root, node => attr(node, "aria-selected") === "true")[0].children[0], page.day(3));
});

test("연도를 넘겨도 목록과 언어 전환은 달, 선택과 초점을 유지하며 다시 조회하지 않는다", async () => {
  const page = await openCalendar([event("가상 등록", "2028-12-31", "2029-01-02")], "2028-12-31");
  page.nav("next").click();
  assert.equal(page.title(), "2029년 1월");
  assert.equal(byClass(page.root, "acal-bar")[0].dataset.kind, "register");
  page.nav("prev").click();
  assert.equal(page.title(), "2028년 12월");
  page.day(31).press("ArrowRight");
  page.day(1).press("Enter");
  page.language("en");
  assert.equal(page.title(), "January 2029");
  assert.equal(page.active(), page.day(1));
  assert.match(visibleText(page.list()), /Events for January 1.*가상 등록.*December 31.*January 2/);
  page.toggle.focus();
  page.toggle.click();
  assert.equal(page.root.dataset.view, "list");
  assert.equal(attr(page.toggle, "aria-pressed"), "true");
  page.language("zh");
  assert.equal(page.active(), page.toggle);
  assert.equal(page.toggle.textContent, "月历视图");
  page.toggle.click();
  assert.equal(page.root.dataset.view, "month");
  assert.equal(page.title(), "2029年1月");
  assert.match(visibleText(page.list()), /1月1日的日程/);
  assert.equal(page.tabStop(), page.day(1));
  assert.equal(page.requests.length, 1);
});

test("첫 달은 오늘과 겹치는 달, 첫 남은 일정, 마지막 종료일, 빈 응답 순으로 정한다", async () => {
  for (const [events, title] of [
    [[event("가상 지난 일정", "2028-01-30", "2028-02-02"), event("가상 다음 일정", "2028-03-10")], "2028년 2월"],
    [[event("가상 다음 일정", "2028-04-10"), event("가상 먼저 오는 일정", "2028-03-10")], "2028년 3월"],
    [[event("가상 긴 과거 일정", "2027-12-30", "2028-01-03"), event("가상 짧은 과거 일정", "2027-12-31")], "2028년 1월"],
    [[], "2028년 2월"],
  ]) {
    const page = await openCalendar(events);
    assert.equal(page.title(), title);
  }
});
