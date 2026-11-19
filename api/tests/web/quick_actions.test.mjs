// 빠른 실행 링 테스트(#137). 브라우저와 서버를 띄우지 않고 가짜 화면 요소·가짜 화면 갱신으로 quick-actions.js를 그대로 실행한다.
// 링이 대신 누르는 버튼과 카드도 모두 가짜다. 360·390px와 넓은 화면의 실제 모습은 브라우저에서 따로 확인한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const read = path => readFileSync(new URL(`../../app/chat_web/${path}`, import.meta.url), "utf8");
const source = read("assets/quick-actions.js");
const styles = read("assets/quick-actions.css");
const html = read("index.html");
const chat = read("assets/chat.js");
const code = source.replace(/^\s*\/\/.*$/gm, "");
const css = styles.replace(/\/\*[\s\S]*?\*\//g, "");

function ringPage({ width = 1280, height = 800, view = "home", reduced = false, lang = "ko", missing = [], locked = [],
  toggleRect = { left: 300, top: 700, width: 44, height: 44 } } = {}) {
  const state = { focused: null };
  let frames = [];
  const timers = new Map(), documentListeners = [], windowListeners = [], observers = [];
  let nextTimer = 0;
  class El {
    constructor(tag, ns = null) {
      Object.assign(this, { tag, ns, children: [], attributes: new Map(), listeners: new Map(), dataset: {}, hidden: false,
        disabled: false, className: "", id: "", textContent: "", parent: null, clicks: 0, isConnected: true, rect: null });
      const props = new Map();
      this.style = { props, setProperty: (name, value) => props.set(name, String(value)) };
    }
    get firstChild() { return this.children[0] ?? null; }
    detach(node) { if (node.parent) node.parent.children = node.parent.children.filter(child => child !== node); node.parent = this; }
    append(...nodes) { for (const node of nodes) { this.detach(node); this.children.push(node); } }
    insertBefore(node, reference) {
      this.detach(node);
      const index = this.children.indexOf(reference);
      if (index < 0) this.children.push(node); else this.children.splice(index, 0, node);
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
    removeAttribute(name) { this.attributes.delete(name); }
    addEventListener(type, listener) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
    fire(type, values = {}) {
      const event = { type, target: this, defaultPrevented: false, stopped: false, repeat: false,
        preventDefault() { event.defaultPrevented = true; }, stopPropagation() { event.stopped = true; }, ...values };
      for (const listener of this.listeners.get(type) ?? []) listener(event);
      return event;
    }
    contains(node) { for (let current = node; current; current = current.parent) if (current === this) return true; return false; }
    focus() { state.focused = this; this.fire("focus"); }
    click() { if (this.disabled) return; this.clicks++; this.fire("click"); }
    getBoundingClientRect() {
      const rect = this.rect ?? { left: 0, top: 0, width: 0, height: 0 };
      return { ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height };
    }
    all() { return this.children.flatMap(child => [child, ...child.all()]); }
  }
  const button = id => Object.assign(new El("button"), { id });
  const row = Object.assign(new El("div"), { className: "composer-row" });
  const photo = button("photo-attach"), pen = button("handwriting-button");
  row.append(photo, pen, new El("textarea"), button("ai-mode-button"), button("send"));
  for (const id of locked) ({ "#photo-attach": photo, "#handwriting-button": pen })[id].disabled = true;
  const cards = Object.fromEntries(["graduation", "biskit", "calendar"].map(feature => [feature, button(`card-${feature}`)]));
  const home = button("home-button");
  const screen = Object.assign(new El("div"), { id: "main-screen" });
  const body = new El("body");
  body.setAttribute("data-view", view);
  const root = new El("html");
  root.setAttribute("lang", lang);
  const nodes = {
    ".composer-row": row, "#photo-attach": photo, "#handwriting-button": pen, "#home-button": home, "#main-screen": screen,
    '[data-feature="graduation"]': cards.graduation, '[data-feature="biskit"]': cards.biskit, '[data-feature="calendar"]': cards.calendar,
  };
  const document = {
    body, documentElement: root,
    get activeElement() { return state.focused; },
    querySelector: selector => (missing.includes(selector) ? null : nodes[selector] ?? null),
    createElement: tag => new El(tag),
    createElementNS: (ns, tag) => new El(tag, ns),
    addEventListener: (type, listener, capture) => documentListeners.push({ type, listener, capture }),
  };
  const window = {
    innerWidth: width, innerHeight: height,
    matchMedia: query => ({ matches: reduced && query.includes("prefers-reduced-motion"), addEventListener() {} }),
    requestAnimationFrame: callback => { frames.push(callback); return frames.length; },
    addEventListener: (type, listener) => windowListeners.push({ type, listener }),
  };
  runInNewContext(source, {
    document, window, Date,
    MutationObserver: class { constructor(callback) { observers.push(callback); } observe() {} },
    setTimeout: (callback, delay) => { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
    clearTimeout: id => timers.delete(id),
  }, { filename: "quick-actions.js" });
  const toggle = row.children[0];
  toggle.rect = toggleRect;
  const ring = body.children.find(node => node.className === "quick-ring");
  const menu = ring?.children.find(node => node.className === "quick-ring-menu");
  const items = menu?.children ?? [];
  return {
    state, row, photo, pen, cards, home, body, root, toggle, ring, menu, items, timers, observers,
    item: id => items.find(item => item.dataset.quickAction === id),
    screen, window,
    blobs: () => ring.all().filter(node => (node.getAttribute("class") ?? "").split(/\s+/).includes("quick-ring-blob")),
    frames: () => { const pending = frames; frames = []; for (const callback of pending) callback(16); return pending.length; },
    tick: () => { for (const [id, timer] of [...timers]) { timers.delete(id); timer.callback(); } },
    key: (key, values = {}) => menu.fire("keydown", { key, ...values }),
    outside: target => { const event = { type: "pointerdown", target, defaultPrevented: false, preventDefault() { event.defaultPrevented = true; } };
      for (const each of documentListeners) if (each.type === "pointerdown") each.listener(event); return event; },
    windowEvent: type => { for (const each of windowListeners) if (each.type === type) each.listener({}); },
    position: item => ({ x: Number.parseFloat(item.style.props.get("--qa-x")), y: Number.parseFloat(item.style.props.get("--qa-y")) }),
  };
}

test("index.html은 chat.js 뒤에 링 파일 두 개를 부르는 태그만 넣고 문구는 넣지 않는다", () => {
  const head = /<head>[\s\S]*?<\/head>/.exec(html)?.[0] ?? "";
  const order = ["/chat-assets/chat.css", "/chat-assets/chat.js", "/chat-assets/quick-actions.css", "/chat-assets/quick-actions.js"].map(name => head.indexOf(name));
  assert.ok(order.every(index => index > 0) && order.every((index, i) => i === 0 || index > order[i - 1]), String(order));
  assert.match(head, /<link rel="stylesheet" href="\/chat-assets\/quick-actions.css">/);
  assert.match(head, /<script src="\/chat-assets\/quick-actions.js" defer><\/script>/);
  assert.equal(html.includes("quick-toggle") || html.includes("quick-ring"), false);
  // 「학사 일정」은 원래 있던 카드 제목이라 세지 않는다.
  for (const name of ["빠른 실행", "사진 질문", "손글씨 입력"]) assert.equal(html.includes(`>${name}<`), false, name);
  assert.equal(html.includes("quick-item-name"), false);
});

test("+ 버튼은 입력 줄 맨 앞의 44px 버튼이고 링은 닫힌 채 body 아래에 만든다", () => {
  const page = ringPage();
  assert.equal(page.toggle.className, "attach-button quick-toggle");
  assert.deepEqual(page.row.children.slice(1, 3), [page.photo, page.pen]);
  assert.equal(page.toggle.type, "button");
  assert.equal(page.toggle.getAttribute("aria-haspopup"), "menu");
  assert.equal(page.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(page.toggle.getAttribute("aria-controls"), "quick-ring-menu");
  assert.equal(page.toggle.getAttribute("aria-label"), "빠른 실행");
  assert.equal(page.row.getAttribute("data-quick-actions"), "");
  assert.equal(page.ring.hidden, true);
  assert.equal(page.menu.id, "quick-ring-menu");
  assert.equal(page.menu.getAttribute("role"), "menu");
  assert.deepEqual(page.items.map(item => item.dataset.quickAction), ["calendar", "graduation", "biskit", "photo", "handwriting"]);
  for (const item of page.items) {
    assert.equal(item.getAttribute("role"), "menuitem");
    assert.equal(item.tabIndex, -1);
  }
  assert.deepEqual(page.items.map(item => item.children.find(child => child.className.includes("quick-item-name")).textContent),
    ["학사 일정", "졸업 체크", "BISKIT", "사진 질문", "손글씨 입력"]);
});

test("방울 배경 층에만 goo 필터(stdDeviation 10, 알파 0 0 0 19 -9)를 걸고 아이콘·이름은 필터 밖 버튼 층에 둔다", () => {
  const page = ringPage();
  const all = page.ring.all();
  const blur = all.find(node => node.tag === "feGaussianBlur");
  assert.equal(blur.getAttribute("stdDeviation"), "10");
  const matrix = all.find(node => node.tag === "feColorMatrix");
  assert.match(matrix.getAttribute("values"), /0 0 0 19 -9$/);
  const goo = all.find(node => node.getAttribute("filter") === "url(#quick-ring-goo)");
  assert.equal(all.find(node => node.tag === "filter").getAttribute("id"), "quick-ring-goo");
  assert.ok(goo.children.every(node => node.tag === "circle"));
  assert.equal(page.blobs().length, 5);
  // 필터가 걸린 묶음 안에는 버튼·글자가 없다. 버튼은 링 아래 다른 층(menu)에 있다.
  assert.equal(goo.all().some(node => node.tag === "button" || node.tag === "span"), false);
  assert.equal(page.items.every(item => !goo.contains(item)), true);
  const blobs = all.find(node => node.getAttribute("class") === "quick-ring-blobs");
  assert.equal(blobs.getAttribute("aria-hidden"), "true");
});

test("열면 aria-expanded와 첫 방울 초점을 주고, 한 번 그린 뒤 열린 자리로 옮긴다", () => {
  const page = ringPage();
  page.toggle.click();
  assert.equal(page.toggle.getAttribute("aria-expanded"), "true");
  assert.equal(page.ring.hidden, false);
  assert.equal(page.state.focused, page.item("calendar"));
  assert.equal(page.ring.getAttribute("data-open"), null);
  page.frames();
  assert.equal(page.ring.getAttribute("data-open"), "true");
  assert.equal(page.ring.getAttribute("data-layout"), "radial");
  page.toggle.click();
  assert.equal(page.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(page.state.focused, page.toggle);
  assert.equal(page.ring.hidden, false, "closing runs the reverse transition first");
  page.tick();
  assert.equal(page.ring.hidden, true);
});

test("넓은 화면은 + 둘레에 방사형으로, 좁은 화면은 엄지 위쪽 반원 호로 놓고 화면 가장자리 8px 안에 둔다", () => {
  const wide = ringPage({ width: 1280, height: 800, toggleRect: { left: 300, top: 740, width: 44, height: 44 } });
  wide.toggle.click();
  const anchor = { x: 322, y: 762 };
  // 방울 가운데가 화면 가장자리 8px + 반지름 26px 안쪽에 있다. 좌표는 0.01px로 반올림하므로 0.5px 여유를 둔다.
  const inside = (value, size) => value >= 34 - 0.5 && value <= size - 34 + 0.5;
  const wideSpots = wide.items.map(wide.position);
  assert.equal(new Set(wideSpots.map(spot => Math.round(Math.atan2(spot.y, spot.x) * 100))).size, 5);
  for (const spot of wideSpots) {
    assert.ok(inside(anchor.x + spot.x, 1280), JSON.stringify(spot));
    assert.ok(inside(anchor.y + spot.y, 800), JSON.stringify(spot));
  }
  for (const [width, left] of [[390, 8], [360, 8], [360, 300]]) {
    const narrow = ringPage({ width, height: 700, toggleRect: { left, top: 600, width: 44, height: 44 } });
    narrow.toggle.click();
    assert.equal(narrow.ring.getAttribute("data-layout"), "arc");
    const origin = { x: left + 22, y: 622 };
    const spots = narrow.items.map(narrow.position);
    for (const spot of spots) {
      assert.ok(spot.y <= 0, `arc stays above the thumb: ${JSON.stringify(spot)}`);
      assert.ok(inside(origin.x + spot.x, width), `${width}/${left}: ${JSON.stringify(spot)}`);
    }
    // 묶음을 화면 안으로 밀어도 방울이 + 버튼(44px) 위에 얹히지 않는다. +를 다시 눌러 닫는 손가락이 방울을 누르지 않는다.
    for (const spot of spots) {
      if (Math.abs(spot.x) < 26 + 22 + 6) assert.ok(spot.y <= -(26 + 22 + 6) + 0.5, `${width}/${left} covers +: ${JSON.stringify(spot)}`);
    }
    // 반원 호: 왼쪽 끝에서 오른쪽 끝으로 차례로 놓이고, 가운데 방울이 가장 높다.
    assert.deepEqual(spots.map(spot => spot.x), [...spots.map(spot => spot.x)].sort((a, b) => a - b));
    assert.equal(Math.min(...spots.map(spot => spot.y)), spots[2].y);
    // 방울 층 원과 버튼 층 자리가 같다.
    assert.deepEqual(narrow.blobs().map(blob => blob.style.props.get("--qa-x")), narrow.items.map(item => item.style.props.get("--qa-x")));
  }
});

test("+가 화면 위쪽에 있어 위로 비킬 자리가 없으면 방울을 + 아래로 내려 화면 안에 두고 +도 덮지 않는다", () => {
  // 390×700에서 홈을 굴려 + 가운데가 위에서 90px, 왼쪽에서 30px에 온 경우.
  const page = ringPage({ width: 390, height: 700, toggleRect: { left: 8, top: 68, width: 44, height: 44 } });
  page.toggle.click();
  const origin = { x: 30, y: 90 };
  const spots = page.items.map(page.position);
  for (const spot of spots) {
    const x = origin.x + spot.x, y = origin.y + spot.y;
    assert.ok(x >= 33.5 && x <= 390 - 33.5, `x ${JSON.stringify(spot)}`);
    assert.ok(y >= 33.5 && y <= 700 - 33.5, `y ${JSON.stringify(spot)}`);
    if (Math.abs(spot.x) < 26 + 22 + 6) assert.ok(spot.y >= 26 + 22 + 6 - 0.5, `covers +: ${JSON.stringify(spot)}`);
  }
});

test("+는 제자리인데 창 높이만 줄면 링을 닫지 않고 새 화면 안에 방울을 다시 놓으며, +가 옮겨 가면 닫는다", () => {
  const page = ringPage({ width: 390, height: 700, toggleRect: { left: 8, top: 68, width: 44, height: 44 } });
  page.toggle.click();
  // 키보드가 올라와 보이는 높이가 220px, 132px로 줄어든 경우. + 위·아래 어느 쪽에도 호가 들어가지 않으면
  // + 옆에 한 줄로 늘어놓아, 방울이 화면 안에 있고 + 버튼(가운데 30, 90)도 덮지 않는다.
  for (const height of [220, 132]) {
    page.window.innerHeight = height;
    page.windowEvent("resize");
    assert.equal(page.toggle.getAttribute("aria-expanded"), "true", String(height));
    assert.equal(page.ring.getAttribute("data-layout"), "row", String(height));
    const spots = page.items.map(page.position);
    for (const spot of spots) {
      const x = 30 + spot.x, y = 90 + spot.y;
      assert.ok(y - 26 >= 8 - 0.5 && y + 26 <= height - 8 + 0.5, `${height}: bubble leaves the screen: ${JSON.stringify(spot)}`);
      assert.ok(x - 26 >= 8 - 0.5 && x + 26 <= 390 - 8 + 0.5, `${height}: ${JSON.stringify(spot)}`);
      // + 버튼 칸(8~52, 68~112) 안의 어느 점도 방울 원 안에 들지 않는다.
      const nearestX = Math.min(Math.max(x, 8), 52), nearestY = Math.min(Math.max(y, 68), 112);
      assert.ok(Math.hypot(x - nearestX, y - nearestY) >= 26, `${height}: covers +: ${JSON.stringify(spot)}`);
    }
    assert.deepEqual(spots.map(spot => spot.x), [...spots.map(spot => spot.x)].sort((a, b) => a - b), "left-to-right order for the arrow keys");
  }
  // + 자체가 옮겨 가면 고정 좌표가 맞지 않으므로 닫는다.
  page.toggle.rect = { left: 8, top: 150, width: 44, height: 44 };
  page.windowEvent("resize");
  assert.equal(page.toggle.getAttribute("aria-expanded"), "false");
});

test("열린 링의 가운데 원 위에 × 표시를 다시 그려 +의 닫기 표시가 가려지지 않고, 누름은 아래 + 버튼이 받는다", () => {
  const page = ringPage();
  const close = page.ring.children.find(node => node.className === "quick-ring-close");
  assert.ok(close, "the close mark lives in the ring");
  assert.equal(close.getAttribute("aria-hidden"), "true");
  assert.equal(close.children[0].tag, "svg");
  const goo = page.ring.all().find(node => node.getAttribute("filter") === "url(#quick-ring-goo)");
  assert.equal(goo.contains(close), false, "drawn outside the goo filter");
  // 가운데 원보다 뒤에(위에) 그린다. 방울 층(SVG) 다음 순서다.
  const order = page.ring.children.map(node => node.className || node.getAttribute("class"));
  assert.ok(order.indexOf("quick-ring-close") > order.indexOf("quick-ring-blobs"), order.join(","));
  const rule = /\n\.quick-ring-close \{([^}]*)\}/.exec(css)[1];
  assert.match(rule, /pointer-events: none;/);
  assert.match(rule, /color: var\(--surface\);/);
  assert.match(rule, /left: var\(--qa-anchor-x, 0px\);/);
  assert.match(css, /\.quick-ring-close svg \{[^}]*transform: rotate\(45deg\);/);
  assert.match(css, /\.quick-ring\[data-open\] \.quick-ring-close \{ opacity: 1; \}/);
});

test("화살표·Home·End로 방울 사이를 돌고, + 버튼의 위·아래 화살표는 끝 방울을 연다", () => {
  const page = ringPage();
  page.toggle.click();
  assert.equal(page.key("ArrowRight").defaultPrevented, true);
  assert.equal(page.state.focused, page.item("graduation"));
  page.key("ArrowDown");
  assert.equal(page.state.focused, page.item("biskit"));
  page.key("End");
  assert.equal(page.state.focused, page.item("handwriting"));
  page.key("ArrowRight");
  assert.equal(page.state.focused, page.item("calendar"), "wraps at the end");
  page.key("ArrowLeft");
  assert.equal(page.state.focused, page.item("handwriting"));
  page.key("Home");
  assert.equal(page.state.focused, page.item("calendar"));
  page.key("ArrowUp");
  assert.equal(page.state.focused, page.item("handwriting"));

  const other = ringPage();
  const opened = other.toggle.fire("keydown", { key: "ArrowUp" });
  assert.equal(opened.defaultPrevented, true);
  assert.equal(other.state.focused, other.item("handwriting"));
  assert.equal(other.toggle.getAttribute("aria-expanded"), "true");
});

test("Esc는 문서의 Esc 처리기(필기 패드·서랍)로 올리지 않고 링만 닫은 뒤 + 버튼에 초점을 돌린다", () => {
  const page = ringPage();
  page.toggle.click();
  page.key("ArrowRight");
  const escape = page.key("Escape");
  assert.equal(escape.stopped, true);
  assert.equal(escape.defaultPrevented, true);
  assert.equal(page.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(page.state.focused, page.toggle);
  // 필기 패드의 문서 Esc 처리기는 이미 막힌 신호를 건너뛴다. 링이 막은 Esc가 패드를 함께 닫지 않는다.
  assert.ok(chat.includes('if (!opened || event.key !== "Escape" || event.defaultPrevented) return;'));
  // 닫힌 링에서는 + 버튼의 Esc를 막지 않아 패드·서랍 같은 다른 처리기가 그대로 받는다.
  const passed = page.toggle.fire("keydown", { key: "Escape" });
  assert.equal(passed.stopped, false);
  assert.equal(passed.defaultPrevented, false);
});

test("바깥을 누르면 링만 닫고 그 자리의 기본 동작은 막지 않는다. 링 안을 누르면 닫지 않는다", () => {
  const page = ringPage();
  page.toggle.click();
  const inside = page.outside(page.item("biskit"));
  assert.equal(page.toggle.getAttribute("aria-expanded"), "true");
  assert.equal(inside.defaultPrevented, false);
  const elsewhere = page.outside(page.body);
  assert.equal(page.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(elsewhere.defaultPrevented, false);
  assert.notEqual(page.state.focused, page.toggle, "focus is left to the clicked place");
  // Tab으로 나가도 링을 닫는다. 초점은 + 버튼에 두고 Tab 자체는 막지 않아, 브라우저가 + 다음 칸으로 옮긴다.
  page.toggle.click();
  const tab = page.key("Tab");
  assert.equal(page.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(tab.defaultPrevented, false);
  assert.equal(page.state.focused, page.toggle);
});

test("방울은 기존 사진·펜 버튼을 한 번만 대신 누르고, 되풀이되는 Enter·Space는 막는다", () => {
  const page = ringPage();
  page.toggle.click();
  page.item("photo").click();
  assert.equal(page.photo.clicks, 1);
  assert.equal(page.toggle.getAttribute("aria-expanded"), "false");
  page.item("photo").click();
  assert.equal(page.photo.clicks, 1, "a closed ring does not run twice");
  page.toggle.click();
  for (const key of ["Enter", " "]) assert.equal(page.key(key, { repeat: true }).defaultPrevented, true, key);
  assert.equal(page.key("Enter").defaultPrevented, false, "the first Enter is the button's own click");
  page.item("handwriting").click();
  assert.equal(page.pen.clicks, 1);
  assert.equal(page.photo.clicks, 1);
});

test("첫 화면에서는 학사 카드를 바로 누르고, 채팅 화면이면 홈으로 돌아가 카드가 보일 때 누른다", () => {
  const home = ringPage({ view: "home" });
  home.toggle.click();
  home.item("calendar").click();
  assert.equal(home.cards.calendar.clicks, 1);
  assert.equal(home.home.clicks, 0);

  const chatView = ringPage({ view: "chat" });
  chatView.toggle.click();
  chatView.frames();
  chatView.item("graduation").click();
  assert.equal(chatView.home.clicks, 1);
  assert.equal(chatView.cards.graduation.clicks, 0);
  chatView.frames();
  assert.equal(chatView.cards.graduation.clicks, 0, "waits while the chat screen is still shown");
  chatView.body.setAttribute("data-view", "home");
  chatView.frames();
  assert.equal(chatView.cards.graduation.clicks, 1);
  chatView.frames();
  assert.equal(chatView.cards.graduation.clicks, 1);
});

test("홈으로 가는 사이 뒤로 가기·다른 곳 누르기·로그인 화면 전환이 있으면 카드를 누르지 않는다", () => {
  for (const [name, interrupt] of [
    ["뒤로 가기", page => page.windowEvent("popstate")],
    ["주소 조각 바뀜", page => page.windowEvent("hashchange")],
    ["다른 곳 누르기", page => page.outside(page.body)],
    ["로그인 화면으로 바뀜", page => { page.screen.hidden = true; }],
    ["링 다시 열기", page => { page.toggle.click(); page.toggle.click(); }],
  ]) {
    const page = ringPage({ view: "chat" });
    page.toggle.click();
    page.item("biskit").click();
    assert.equal(page.home.clicks, 1, name);
    interrupt(page);
    page.body.setAttribute("data-view", "home");
    page.frames(); page.frames();
    assert.equal(page.cards.biskit.clicks, 0, name);
  }
});

test("대상 버튼이 없으면 방울을 숨기고, 잠겨 있으면 방울도 잠가 화살표가 건너뛴다", () => {
  const page = ringPage({ missing: ["#handwriting-button"], locked: ["#photo-attach"] });
  page.toggle.click();
  assert.equal(page.item("handwriting").hidden, true);
  assert.equal(page.item("photo").disabled, true);
  assert.equal(page.item("photo").getAttribute("aria-disabled"), "true");
  const blobs = page.blobs();
  assert.equal(blobs[4].getAttribute("display"), "none");
  assert.match(blobs[3].getAttribute("class"), /is-disabled/);
  page.key("End");
  assert.equal(page.state.focused, page.item("biskit"));
  page.key("ArrowRight");
  assert.equal(page.state.focused, page.item("calendar"));
  page.item("photo").click();
  assert.equal(page.photo.clicks, 0);
  // 보이는 방울은 넷이고 자리도 넷만 나눈다.
  assert.equal(page.items.filter(item => !item.hidden).length, 4);
});

test("링을 연 채 대상 버튼의 잠금이 풀리면 방울도 바로 풀린다", () => {
  const page = ringPage({ locked: ["#photo-attach"] });
  page.toggle.click();
  assert.equal(page.item("photo").disabled, true);
  // 답이 끝나 chat.js가 사진 버튼 잠금을 푼 상황이다. 속성 변화 감시(MutationObserver)가 알린다.
  page.photo.disabled = false;
  for (const observer of page.observers) observer([]);
  assert.equal(page.item("photo").disabled, false);
  assert.equal(page.item("photo").getAttribute("aria-disabled"), null);
  assert.doesNotMatch(page.blobs()[3].getAttribute("class"), /is-disabled/);
  page.item("photo").click();
  assert.equal(page.photo.clicks, 1);
});

test("채팅 화면의 사진·손글씨 방울도 홈으로 돌아간 뒤 홈 화면이 적용되면 입력 줄 버튼을 누른다", () => {
  for (const [id, button] of [["photo", "photo"], ["handwriting", "pen"]]) {
    const page = ringPage({ view: "chat" });
    page.toggle.click();
    page.item(id).click();
    assert.equal(page.home.clicks, 1, id);
    assert.equal(page[button].clicks, 0, `${id} waits for the home screen`);
    page.frames();
    assert.equal(page[button].clicks, 0, id);
    page.body.setAttribute("data-view", "home");
    page.frames();
    assert.equal(page[button].clicks, 1, id);
  }
  // 홈으로 오는 사이 대상이 잠기면(요청 중) 누르지 않는다.
  const locked = ringPage({ view: "chat" });
  locked.toggle.click();
  locked.item("photo").click();
  locked.photo.disabled = true;
  locked.body.setAttribute("data-view", "home");
  locked.frames(); locked.frames();
  assert.equal(locked.photo.clicks, 0);
});

test("방울은 다 펼쳐진 뒤에만 누름을 받아, +를 빠르게 두 번 누르면 두 번째 누름이 출발 중인 방울에 가지 않는다", () => {
  const page = ringPage({ width: 390, height: 700, toggleRect: { left: 8, top: 600, width: 44, height: 44 } });
  page.toggle.click();
  page.frames();
  assert.equal(page.ring.getAttribute("data-open"), "true");
  assert.equal(page.ring.getAttribute("data-settled"), null, "bubbles are still leaving the + button");
  assert.deepEqual([...page.timers.values()].map(timer => timer.delay), [290]);
  page.tick();
  assert.equal(page.ring.getAttribute("data-settled"), "");
  // 닫으면 누름 받기를 먼저 끈다. 열자마자 닫으면 예약도 버린다.
  page.toggle.click();
  assert.equal(page.ring.getAttribute("data-settled"), null);
  const quick = ringPage();
  quick.toggle.click();
  quick.frames();
  quick.toggle.click();
  assert.deepEqual([...quick.timers.values()].map(timer => timer.delay), [300], "only the hide timer is left");
  // CSS: 방울 버튼은 기본으로 누름을 받지 않고 data-settled에서만 받는다.
  assert.match(css, /\n\.quick-item \{ pointer-events: none; \}/);
  assert.match(css, /\.quick-ring\[data-settled\] \.quick-item \{ pointer-events: auto; \}/);
  assert.doesNotMatch(/\.quick-ring\[data-open\] \.quick-item \{([^}]*)\}/.exec(css)[1], /pointer-events/);
  // 동작 줄이기에서는 움직임이 없으므로 열자마자 누름을 받는다.
  const still = ringPage({ reduced: true });
  still.toggle.click();
  assert.equal(still.ring.getAttribute("data-settled"), "");
});

test("문구는 세 언어 사전에서 고르고 <html lang>이 바뀌면 다시 쓴다", () => {
  const page = ringPage({ lang: "en" });
  assert.equal(page.toggle.getAttribute("aria-label"), "Quick actions");
  assert.equal(page.menu.getAttribute("aria-label"), "Quick actions");
  page.root.setAttribute("lang", "zh-Hans");
  for (const observer of page.observers) observer([]);
  assert.equal(page.toggle.getAttribute("aria-label"), "快捷操作");
  const names = page.items.map(item => item.children.find(child => child.className.includes("quick-item-name")).textContent);
  assert.deepEqual(names, ["学事日程", "毕业检查", "BISKIT", "拍照提问", "手写输入"]);
  page.root.setAttribute("lang", "ko");
  for (const observer of page.observers) observer([]);
  assert.equal(page.toggle.getAttribute("aria-label"), "빠른 실행");
  // 세 사전은 같은 열쇠를 갖는다.
  const tables = runInNewContext(`(${/const text = (\{[\s\S]*?\n {2}\});/.exec(source)[1]})`, {});
  assert.deepEqual(Object.keys(tables.en), Object.keys(tables.ko));
  assert.deepEqual(Object.keys(tables.zh), Object.keys(tables.ko));
});

test("동작 줄이기 설정에서는 그리기를 기다리지 않고 바로 열고, 닫을 때도 바로 숨긴다", () => {
  const page = ringPage({ reduced: true });
  page.toggle.click();
  assert.equal(page.ring.getAttribute("data-open"), "true");
  assert.equal(page.frames(), 0);
  page.key("Escape");
  assert.equal(page.ring.hidden, true);
  assert.equal(page.timers.size, 0);
});

test("링 CSS는 #131 색 이름표와 transition만 쓰고 300ms 안에 끝나며 동작 줄이기에서 모두 끈다", () => {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [selector.trim(), body]);
  const calm = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const stopped = [...calm.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, selector, body]) => {
    assert.match(body, /transition: none !important;/);
    return selector.split(",").map(part => part.trim());
  });
  for (const [selector, body] of rules) {
    if (!/transition:/.test(body) || /transition: none/.test(body)) continue;
    for (const part of selector.split(",").map(each => each.trim())) {
      const base = part.replace(/^\.quick-ring(?:\[data-open\]|:not\(\[data-open\]\))\s+/, "");
      assert.ok(stopped.includes(part) || stopped.includes(base), `${part}의 움직임을 끄는 규칙이 없다`);
    }
  }
  for (const [, duration] of css.matchAll(/(\d+)ms/g)) assert.ok(Number(duration) <= 300, duration);
  assert.doesNotMatch(css, /\banimation\b|@keyframes|infinite|url\(|touch-action|textarea|backdrop-filter|violet|indigo|purple|#6A4BD8/i);
  // 색은 이름표만 쓴다. 16진수·rgb 색을 새로 적지 않는다.
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  // 스프링 곡선 linear()는 @supports 안에서만 쓰고, 기본 곡선은 cubic-bezier다.
  const supports = /@supports \(transition-timing-function: linear\(0, 1\)\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  assert.match(supports, /linear\(0, /);
  assert.equal(css.replace(supports, "").replace("linear(0, 1)", "").includes("linear("), false);
  assert.match(/\.choice-menu-indicator\[data-phase="settle"\] \{([^}]*)\}/.exec(css)[1], /cubic-bezier\(/);
  // 경로 모양 변화는 CSS d 속성으로 하지 않는다(iOS Safari 미지원).
  assert.doesNotMatch(css, /(?:^|[\s;{])d\s*:/);
});

test("링 코드는 질문 칸과 외부 자원을 건드리지 않고 이모지·✨를 쓰지 않는다", () => {
  assert.doesNotMatch(code, /textarea|#question|innerHTML|insertAdjacentHTML|\.src\s*=|fetch\(|setInterval|touchAction/);
  assert.deepEqual([...code.matchAll(/https?:\/\/[^\s"'`]+/g)].map(match => match[0]), ["http://www.w3.org/2000/svg"]);
  assert.doesNotMatch(source + styles, /✨|[\u{1F300}-\u{1FAFF}]/u);
  // 질문 칸 위에 덮개를 두지 않는다. 링은 body 아래 고정 층이고 질문 칸을 감싸지 않는다.
  const page = ringPage();
  assert.equal(page.row.children[3].tag, "textarea");
  assert.equal(page.ring.parent, page.body);
});
