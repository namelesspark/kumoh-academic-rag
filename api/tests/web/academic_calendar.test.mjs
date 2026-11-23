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
  const focusCalls = [];
  class Element {
    children = [];
    attributes = new Map();
    dataset = {};
    handlers = new Map();
    textContent = "";
    value = "";
    style = { setProperty() {} };
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); }
    addEventListener(type, handler) { this.handlers.set(type, handler); }
    querySelector() { return null; }
    querySelectorAll(tag) { return this.children.flatMap(child => all(child, node => node.tag === tag)); }
    replaceChildren(...nodes) {
      for (const child of [...this.children]) {
        if (typeof child !== "string") child.remove();
      }
      this.children = [];
      this.append(...nodes);
    }
    append(...nodes) {
      for (const node of nodes) {
        if (typeof node !== "string") node.parentNode = this;
        this.children.push(node);
      }
    }
    remove() {
      if (!this.parentNode) return;
      if (all(this, node => node === activeElement).length) activeElement = body;
      const siblings = this.parentNode.children;
      siblings.splice(siblings.indexOf(this), 1);
      this.parentNode = null;
    }
    getBoundingClientRect() { return { top: 20, bottom: 64, right: 140, width: 120, height: 44 }; }
    focus() {
      focusCalls.push(this);
      activeElement = this;
    }
    click() { this.handlers.get("click")?.({}); }
    press(key) {
      let prevented = false;
      this.handlers.get("keydown")?.({ key, preventDefault() { prevented = true; } });
      // 버튼은 기본 키 동작으로 클릭도 일으킨다.
      if (!prevented && ["Enter", " "].includes(key)) this.click();
      return prevented;
    }
  }
  const body = new Element();
  activeElement = body;
  const card = new Element();
  card.dataset.feature = "calendar";
  const panel = new Element();
  panel.dataset.panel = "calendar";
  const content = new Element();
  panel.append(content);
  panel.querySelector = selector => selector === "[data-panel-content]" ? content : null;
  const featureList = new Element();
  const elements = new Map([["#feature-cards", featureList]]);
  const context = {
    document: {
      body,
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
    window: { localStorage: { getItem: () => null, setItem() {} } },
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
    root, day, tabStop, requests, body, focusCalls,
    tabHeader() {
      const controls = byClass(root, "acal-header")[0].children.filter(node =>
        node.tag === "button" && !node.hidden && node.tabIndex !== -1);
      const next = controls[controls.indexOf(activeElement) + 1];
      next?.focus();
      return next;
    },
    active: () => activeElement,
    title: () => byClass(root, "acal-title")[0].textContent,
    list: () => byClass(root, "acal-day-list")[0],
    nav: direction => all(root, node => node.dataset.acalNav === direction)[0],
    toggle: all(root, node => Object.hasOwn(node.dataset, "acalViewToggle"))[0],
    language: lang => runInNewContext(`applyLang(${JSON.stringify(lang)})`, context),
    openLanguageMenu() {
      const button = elements.get("#lang-button");
      body.append(button);
      runInNewContext('openLangMenu(document.querySelector("#lang-button"))', context);
      return { button, menu: byClass(body, "choice-menu")[0] };
    },
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

const officialCalendarSource = {
  title: "가상 학사일정 출처",
  url: "https://www.kumoh.ac.kr/ko/schedule_reg.do",
  checked_on: "2028-02-01",
};

test("공식 출처를 단 가상 일정 네 건은 막대와 점이 모두 수강신청이며 다시 조회하지 않는다", async () => {
  const otherSource = { ...officialCalendarSource, url: "https://example.invalid/calendar" };
  const page = await openCalendar([
    event("가상 수강신청 대상", "2028-02-07", "2028-02-07", [officialCalendarSource]),
    event("가상 A반", "2028-02-08", "2028-02-08", [officialCalendarSource]),
    event("가상 B반", "2028-02-09", "2028-02-09", [officialCalendarSource]),
    event("가상 C반", "2028-02-10", "2028-02-10", [otherSource, officialCalendarSource]),
  ]);
  assert.deepEqual(byClass(page.root, "acal-bar").map(bar => bar.dataset.kind),
    ["enroll", "enroll", "enroll", "enroll"]);
  for (const date of [7, 8, 9, 10]) {
    assert.deepEqual(byClass(page.day(date), "acal-dot").map(dot => dot.dataset.kind), ["enroll"], `2월 ${date}일`);
  }

  page.nav("prev").click();
  assert.equal(page.title(), "2028년 1월");
  page.nav("next").click();
  assert.equal(page.title(), "2028년 2월");
  page.toggle.click();
  assert.equal(page.root.dataset.view, "list");
  assert.deepEqual(page.requests, ["/api/v1/academic-calendar/2027/1"]);
});

test("공식 출처는 주소가 정확히 같을 때만 쓰고 대상 문구의 분류를 우선한다", async () => {
  const officialUrl = officialCalendarSource.url;
  const similarUrls = [
    officialUrl.replace("https:", "http:"),
    `${officialUrl}/`,
    `${officialUrl}?view=month`,
    officialUrl.replace("www.kumoh.ac.kr", "example.invalid"),
  ];
  const page = await openCalendar([
    ...similarUrls.map((url, index) => {
      const date = `2028-02-1${index}`;
      return event("가상 설명회", date, date, [{ ...officialCalendarSource, url }]);
    }),
    event("가상 설명회", "2028-02-14"),
    { audience: "가상 설명회", starts_on: "2028-02-15", ends_on: "2028-02-15" },
    event("가상 설명회", "2028-02-16", "2028-02-16", officialCalendarSource),
    event("가상 시험", "2028-02-17", "2028-02-17", [officialCalendarSource]),
  ]);
  for (const date of [10, 11, 12, 13, 14, 15, 16, 17]) {
    const kinds = [date === 17 ? "exam" : "neutral"];
    const day = page.day(date);
    assert.deepEqual(byClass(day, "acal-dot").map(dot => dot.dataset.kind), kinds, `2월 ${date}일 점`);

    const week = byClass(page.root, "acal-week").find(row => byClass(row, "acal-day").includes(day));
    const column = String(byClass(week, "acal-day").indexOf(day) + 1);
    const bars = byClass(week, "acal-bar").filter(bar => bar.dataset.col === column);
    assert.deepEqual(bars.map(bar => bar.dataset.kind), kinds, `2월 ${date}일 막대`);
  }
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
  page.toggle.press("Enter");
  assert.equal(page.root.dataset.view, "list");
  page.toggle.press(" ");
  assert.equal(page.root.dataset.view, "month");
  assert.equal(page.tabStop(), page.day(31));
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
  const oldDay = page.day(1);
  page.language("en");
  assert.equal(page.title(), "January 2029");
  assert.equal(page.active(), page.day(1));
  assert.notEqual(page.active(), oldDay);
  assert.match(visibleText(page.list()), /Events for January 1.*가상 등록.*December 31.*January 2/);
  page.toggle.focus();
  page.toggle.click();
  assert.equal(page.root.dataset.view, "list");
  assert.equal(page.title(), "January 2029");
  assert.equal(attr(page.toggle, "aria-pressed"), "true");
  page.language("zh");
  assert.equal(page.active(), page.toggle);
  assert.equal(page.toggle.textContent, "月历视图");
  assert.equal(page.title(), "2029年1月");
  page.language("ko");
  assert.equal(page.title(), "2029년 1월");
  assert.equal(page.toggle.textContent, "월 보기");
  page.language("zh");
  page.toggle.click();
  assert.equal(page.root.dataset.view, "month");
  assert.equal(attr(page.toggle, "aria-pressed"), "false");
  assert.equal(page.toggle.textContent, "列表视图");
  assert.equal(page.title(), "2029年1月");
  assert.match(visibleText(page.list()), /1月1日的日程/);
  assert.equal(page.tabStop(), page.day(1));
  assert.deepEqual(page.requests, ["/api/v1/academic-calendar/2027/1"]);
});

for (const [view, label] of [["month", "월 보기의 고른 날 목록"], ["list", "목록 보기"]]) {
  test(`${label}에서 언어를 바꿔도 같은 일정의 같은 출처 링크로 초점이 돌아간다`, async () => {
    const date = "2028-02-27";
    const source = { title: "가상 공통 출처", url: "https://example.invalid/shared", checked_on: "2028-02-01" };
    const undated = { ...source, checked_on: undefined };
    const target = { ...source };
    const page = await openCalendar([
      event("가상 일정 A", date, date, [source, source, source]),
      event("가상 일정 B", date, date, [source, undated, target, source]),
    ]);
    if (view === "list") page.toggle.click();
    assert.equal(page.root.dataset.view, view);
    const rows = () => byClass(view === "list" ? byClass(page.root, "acal-body")[0] : page.list(), "evidence");
    const sourceLines = () => byClass(rows()[1], "sources")[0].children;
    const link = () => sourceLines()[2].children[0];

    assert.deepEqual(rows().map(row => row.children[0].textContent), ["가상 일정 A", "가상 일정 B"]);
    assert.deepEqual(sourceLines().slice(0, 4).map(line => line.children[0].tag), ["a", "span", "a", "a"]);
    assert.deepEqual(all(page.root, node => node.tag === "a").map(node => [node.textContent, attr(node, "href")]),
      Array.from({ length: 6 }, () => [source.title, source.url]));
    assert.equal(page.title(), "2028년 2월");
    link().focus();
    for (const [language, title] of [["en", "February 2028"], ["zh", "2028年2月"], ["ko", "2028년 2월"]]) {
      const previousLink = link();
      page.language(language);
      assert.equal(page.title(), title);
      assert.notEqual(link(), previousLink);
      assert.equal(page.active(), link(), language);
    }

    // 응답을 흉내 낸 객체의 확인일을 지워 다음 렌더링에서 같은 순번의 링크를 없앤다.
    delete target.checked_on;
    const focusCount = page.focusCalls.length;
    page.language("en");
    assert.equal(link().tag, "span");
    assert.equal(sourceLines()[3].children[0].tag, "a");
    assert.equal(page.active(), page.body);
    assert.equal(page.focusCalls.length, focusCount);
    assert.deepEqual(page.requests, ["/api/v1/academic-calendar/2027/1"]);
  });
}

test("언어 메뉴에서 고르면 달력에 초점을 주지 않고 언어 버튼으로 돌아간다", async () => {
  const source = { title: "가상 출처", url: "https://example.invalid/calendar", checked_on: "2028-02-01" };
  const page = await openCalendar([event("가상 일정", "2028-02-27", "2028-02-27", [source])]);
  page.nav("next").click();
  page.nav("prev").click();
  page.toggle.click();
  const link = () => all(page.root, node => node.tag === "a")[0];
  const previousLink = link();
  previousLink.focus();
  const { button, menu } = page.openLanguageMenu();
  assert.equal(attr(button, "aria-expanded"), "true");
  const item = byClass(menu, "choice-menu-item").find(node => node.dataset.choiceValue === "en");
  item.focus();
  assert.equal(page.active(), item);

  const focusCount = page.focusCalls.length;
  item.click();
  assert.equal(page.title(), "February 2028");
  assert.notEqual(link(), previousLink);
  assert.deepEqual(page.focusCalls.slice(focusCount), [button]);
  assert.equal(page.active(), button);
  assert.equal(attr(button, "aria-expanded"), "false");
  assert.deepEqual(byClass(page.body, "choice-menu"), []);
  assert.deepEqual(page.requests, ["/api/v1/academic-calendar/2027/1"]);
});

test("목록에서 연말 일정의 원래 기간과 출처를 두 달에 한 번씩 표시하고 빈 달을 탐색한다", async () => {
  const source = { title: "가상 일정 출처", url: "https://example.invalid/year-end", checked_on: "2028-12-01" };
  const page = await openCalendar([
    event("가상 1월 일정", "2029-01-03"),
    event("가상 연말 일정", "2028-12-31", "2029-01-02", [source]),
    event("가상 지난 12월 일정", "2028-12-01"),
    event("가상 11월 일정", "2028-11-30"),
  ], "2028-12-31");
  const title = byClass(page.root, "acal-title")[0];
  const body = byClass(page.root, "acal-body")[0];
  const rows = () => byClass(body, "evidence");
  const headings = () => rows().map(row => row.children[0].textContent);
  const assertBoundaryRow = index => {
    const row = rows()[index];
    assert.equal(row.tag, "section");
    assert.deepEqual(all(row.children[1], node => node.tag === "time").map(node => node.dateTime),
      ["2028-12-31", "2029-01-02"]);
    assert.deepEqual(all(row, node => node.tag === "a").map(link => [link.textContent, attr(link, "href")]),
      [[source.title, source.url]]);
  };
  const previous = page.nav("prev");
  const next = page.nav("next");
  const activate = (button, key) => {
    button.press(key);
    assert.equal(page.active(), button);
  };

  assert.equal(page.toggle.textContent, "목록 보기");
  assert.equal(page.tabHeader(), previous);
  assert.equal(page.tabHeader(), next);
  assert.equal(page.tabHeader(), page.toggle);
  activate(page.toggle, "Enter");
  assert.equal(page.title(), "2028년 12월");
  assert.equal(attr(title, "aria-live"), "polite");
  assert.ok(!title.hidden);
  assert.ok(!previous.hidden);
  assert.ok(!next.hidden);
  assert.deepEqual(headings(), ["가상 지난 12월 일정", "가상 연말 일정"]);
  assertBoundaryRow(1);

  previous.focus();
  assert.equal(page.tabHeader(), next);
  activate(next, " ");
  assert.equal(page.title(), "2029년 1월");
  assert.deepEqual(headings(), ["가상 연말 일정", "가상 1월 일정"]);
  assertBoundaryRow(0);
  activate(next, "Enter");
  assert.deepEqual(rows(), []);

  for (const [language, expectedTitle, expectedHint] of [
    ["ko", "2029년 2월", "2029년 2월에는 일정이 없어요."],
    ["en", "February 2029", "No events in February 2029."],
    ["zh", "2029年2月", "2029年2月没有日程。"],
  ]) {
    page.language(language);
    assert.equal(page.title(), expectedTitle);
    assert.deepEqual(byClass(body, "hint").map(hint => hint.textContent), [expectedHint]);
    assert.equal(page.active(), next);
  }
  previous.focus();
  activate(previous, "Enter");
  assert.equal(page.title(), "2029年1月");
  assertBoundaryRow(0);
  page.language("ko");
  assert.equal(page.title(), "2029년 1월");
  assert.equal(page.active(), previous);
  assert.deepEqual(page.requests, ["/api/v1/academic-calendar/2027/1"]);
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
