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
  toggleRect = { left: 300, top: 700, width: 44, height: 44 }, visual = null } = {}) {
  const state = { focused: null, reduced };
  let frames = [];
  const timers = new Map(), documentListeners = [], windowListeners = [], observers = [], mediaListeners = [];
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
    // 동작 줄이기 설정은 테스트 도중 바꿀 수 있다(state.reduced). 바뀜 신호 처리기는 모아 두었다가 직접 보낸다.
    matchMedia: query => ({
      get matches() { return state.reduced && query.includes("prefers-reduced-motion"); },
      addEventListener: (type, listener) => { if (query.includes("prefers-reduced-motion") && type === "change") mediaListeners.push(listener); },
    }),
    requestAnimationFrame: callback => { frames.push(callback); return frames.length; },
    addEventListener: (type, listener) => windowListeners.push({ type, listener }),
    // 확대(핀치 줌)했을 때 실제로 보이는 칸. 주면 그 칸의 크기·위치와 신호를 쓴다.
    visualViewport: visual ? { ...visual, addEventListener: (type, listener) => windowListeners.push({ type: `visual-${type}`, listener }) } : undefined,
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
    reduce: () => { state.reduced = true; for (const listener of mediaListeners) listener({ matches: true }); },
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

test("+가 화면 위쪽에 있어 위로 비킬 자리가 없으면 호를 + 옆으로 밀고, 그래도 + 아래로 내려가면 44px 방울 호로 + 위쪽에 둔다", () => {
  // 390×700에서 홈을 굴려 + 가운데가 위에서 120px·90px, 왼쪽에서 30px에 온 경우.
  // 120px: 기본 호를 옆으로 밀면 그대로 + 위쪽에 든다. 90px: 기본·70px 호는 화면 위 여백을 맞추느라 끝 방울이
  // + 가운데보다 내려가므로 쓰지 않고, 반지름 58px·44px 방울 호를 옆으로 민다.
  for (const [centerY, compact] of [[120, false], [90, true]]) {
    const page = ringPage({ width: 390, height: 700, toggleRect: { left: 8, top: centerY - 22, width: 44, height: 44 } });
    page.toggle.click();
    assert.equal(page.ring.getAttribute("data-layout"), "arc", String(centerY));
    assert.equal(page.ring.getAttribute("data-compact") === "", compact, String(centerY));
    const size = compact ? 22 : 26;
    const spots = page.items.map(page.position);
    for (const spot of spots) {
      const x = 30 + spot.x, y = centerY + spot.y;
      assert.ok(x - size >= 7.5 && x + size <= 390 - 7.5, `${centerY}: x ${JSON.stringify(spot)}`);
      assert.ok(y - size >= 7.5 && y + size <= 700 - 7.5, `${centerY}: y ${JSON.stringify(spot)}`);
      // 모든 방울이 + 버튼 오른쪽으로 비켜나 있다.
      assert.ok(spot.x >= size + 22 + 6 - 0.5, `${centerY}: covers +: ${JSON.stringify(spot)}`);
      // 엄지 위쪽 호는 + 가운데보다 내려가지 않는다.
      assert.ok(spot.y <= 0.5, `${centerY}: dropped below +: ${JSON.stringify(spot)}`);
    }
    for (const [i, a] of spots.entries()) for (const b of spots.slice(i + 1)) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= size * 2, "bubbles overlap");
    // 반원 호 모양 그대로다. 가운데 방울이 가장 높다.
    assert.equal(Math.min(...spots.map(spot => spot.y)), spots[2].y, String(centerY));
  }
});

test("+는 제자리인데 창 높이만 줄면 링을 닫지 않고 새 화면 안에 방울을 다시 놓으며, +가 옮겨 가면 닫는다", () => {
  const page = ringPage({ width: 390, height: 700, toggleRect: { left: 8, top: 68, width: 44, height: 44 } });
  page.toggle.click();
  // 키보드가 올라와 보이는 높이가 220px, 132px로 줄어든 경우. 두 높이 모두 44px 방울 호를 + 오른쪽으로 밀어 + 위쪽에 둔다.
  // 방울은 화면 안에 있고 +(가운데 30, 90)도 덮지 않는다.
  for (const height of [220, 132]) {
    page.window.innerHeight = height;
    page.windowEvent("resize");
    assert.equal(page.toggle.getAttribute("aria-expanded"), "true", String(height));
    assert.equal(page.ring.getAttribute("data-layout"), "arc", String(height));
    const size = page.ring.getAttribute("data-compact") === "" ? 22 : 26;
    const spots = page.items.map(page.position);
    for (const spot of spots) {
      const x = 30 + spot.x, y = 90 + spot.y;
      assert.ok(y - size >= 8 - 0.5 && y + size <= height - 8 + 0.5, `${height}: bubble leaves the screen: ${JSON.stringify(spot)}`);
      assert.ok(x - size >= 8 - 0.5 && x + size <= 390 - 8 + 0.5, `${height}: ${JSON.stringify(spot)}`);
      assert.ok(spot.y <= 0.5, `${height}: dropped below +: ${JSON.stringify(spot)}`);
      // + 버튼 칸(8~52, 68~112) 안의 어느 점도 방울 원 안에 들지 않는다.
      const nearestX = Math.min(Math.max(x, 8), 52), nearestY = Math.min(Math.max(y, 68), 112);
      assert.ok(Math.hypot(x - nearestX, y - nearestY) >= size, `${height}: covers +: ${JSON.stringify(spot)}`);
    }
    assert.deepEqual(spots.map(spot => spot.x), [...spots.map(spot => spot.x)].sort((a, b) => a - b), "left-to-right order for the arrow keys");
  }
  // + 자체가 옮겨 가면 고정 좌표가 맞지 않으므로 닫는다.
  page.toggle.rect = { left: 8, top: 150, width: 44, height: 44 };
  page.windowEvent("resize");
  assert.equal(page.toggle.getAttribute("aria-expanded"), "false");
});

test("좁고 낮은 화면에서도 방울이 잘리거나 +를 덮지 않고, 호를 쓸 수 있으면 + 위쪽에 둔다", () => {
  // 320×700에서 + 가운데를 (54, 90)에 두고 연 뒤, 키보드가 올라와 높이가 220px·132px로 줄어든 경우.
  // 두 높이 모두 반지름 58px·44px 방울 호를 + 오른쪽으로 밀어 + 위쪽에 들어간다.
  const page = ringPage({ width: 320, height: 700, toggleRect: { left: 32, top: 68, width: 44, height: 44 } });
  page.toggle.click();
  for (const [height, kind] of [[220, "arc"], [132, "arc"]]) {
    page.window.innerHeight = height;
    page.windowEvent("resize");
    assert.equal(page.toggle.getAttribute("aria-expanded"), "true", String(height));
    assert.equal(page.ring.getAttribute("data-layout"), kind, String(height));
    const size = page.ring.getAttribute("data-compact") === "" ? 22 : 26;
    const centers = page.items.map(page.position).map(spot => ({ x: 54 + spot.x, y: 90 + spot.y }));
    for (const { x, y } of centers) {
      assert.ok(x - size >= 8 - 0.5 && x + size <= 320 - 8 + 0.5 && y - size >= 8 - 0.5 && y + size <= height - 8 + 0.5, `${height}: off screen ${x},${y}`);
      assert.ok(y <= 90 + 0.5, `${height}: dropped below + ${x},${y}`);
      // + 버튼 칸(32~76, 68~112)의 어느 점도 방울 원 안에 들지 않는다. (54, 108)을 누르면 +가 받는다.
      const nearestX = Math.min(Math.max(x, 32), 76), nearestY = Math.min(Math.max(y, 68), 112);
      assert.ok(Math.hypot(x - nearestX, y - nearestY) >= size, `${height}: covers + ${x},${y}`);
      assert.ok(Math.hypot(x - 54, y - 108) >= size, `${height}: (54,108) hits a bubble`);
    }
    // 방울끼리도 겹치지 않는다.
    for (const [i, a] of centers.entries()) for (const b of centers.slice(i + 1)) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= size * 2, `${height}: bubbles overlap`);
    // 화살표 순서는 화면 순서를 따른다. 호는 왼쪽부터, 격자는 위 줄부터·같은 줄은 왼쪽부터다.
    if (kind === "grid") {
      const order = centers.map(({ x, y }) => [y, x]);
      assert.deepEqual(order, [...order].sort((a, b) => a[0] - b[0] || a[1] - b[1]));
    } else assert.deepEqual(centers.map(({ x }) => x), [...centers.map(({ x }) => x)].sort((a, b) => a - b));
  }
});

test("52px 방울 칸이 모자라면 44px 방울로 줄이고, 그래도 모자라면 잘리거나 +를 덮는 링을 열지 않는다", () => {
  // 320×700에서 + 가운데를 (54, 60)에 두고 연 뒤 높이가 120px로 줄어든 경우.
  const page = ringPage({ width: 320, height: 700, toggleRect: { left: 32, top: 38, width: 44, height: 44 } });
  page.toggle.click();
  page.window.innerHeight = 120;
  page.windowEvent("resize");
  assert.equal(page.toggle.getAttribute("aria-expanded"), "true");
  assert.equal(page.ring.getAttribute("data-layout"), "grid");
  assert.equal(page.ring.getAttribute("data-compact"), "");
  assert.ok(page.blobs().every(blob => blob.getAttribute("r") === "22"));
  const centers = page.items.map(page.position).map(spot => ({ x: 54 + spot.x, y: 60 + spot.y }));
  for (const { x, y } of centers) {
    assert.ok(x - 22 >= 8 - 0.5 && x + 22 <= 320 - 8 + 0.5 && y - 22 >= 8 - 0.5 && y + 22 <= 120 - 8 + 0.5, `off screen ${x},${y}`);
    const nearestX = Math.min(Math.max(x, 32), 76), nearestY = Math.min(Math.max(y, 38), 82);
    assert.ok(Math.hypot(x - nearestX, y - nearestY) >= 22, `covers + ${x},${y}`);
    assert.ok(Math.hypot(x - 54, y - 60) >= 22, `(54,60) hits a bubble`);
  }
  for (const [i, a] of centers.entries()) for (const b of centers.slice(i + 1)) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 44, "bubbles overlap");
  // CSS: 작은 방울도 조작 영역 44px를 지킨다.
  assert.match(css, /\.quick-ring\[data-compact\] \.quick-item \{ width: 44px; height: 44px; margin: -22px 0 0 -22px; \}/);
  // 높이가 다시 넉넉해지면 원래 크기로 돌아간다.
  page.window.innerHeight = 700;
  page.windowEvent("resize");
  assert.equal(page.ring.getAttribute("data-compact"), null);
  assert.ok(page.blobs().every(blob => blob.getAttribute("r") === "26"));

  // 200×120처럼 44px 방울로도 다섯 칸이 없으면 열지 않는다. 연 채로 그만큼 줄면 닫는다.
  const tiny = ringPage({ width: 200, height: 120, toggleRect: { left: 32, top: 38, width: 44, height: 44 } });
  tiny.toggle.click();
  assert.equal(tiny.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(tiny.ring.hidden, true);
  assert.notEqual(tiny.state.focused?.dataset?.quickAction, "calendar");
  page.window.innerWidth = 200;
  page.window.innerHeight = 120;
  page.windowEvent("resize");
  assert.equal(page.toggle.getAttribute("aria-expanded"), "false");

  // 390×700에서 + 가운데를 (30, 25)에 두고 연 뒤 높이가 50px로 줄면 방울 하나도 위아래 8px 안에 들지 않는다.
  // 한 줄로 늘어놓아 위쪽이 잘리는 대신 링을 닫는다.
  const flat = ringPage({ width: 390, height: 700, toggleRect: { left: 8, top: 3, width: 44, height: 44 } });
  flat.toggle.click();
  assert.equal(flat.toggle.getAttribute("aria-expanded"), "true");
  flat.window.innerHeight = 50;
  flat.windowEvent("resize");
  assert.equal(flat.toggle.getAttribute("aria-expanded"), "false");
  assert.notEqual(flat.ring.getAttribute("data-layout"), "row");
});

test("기본 반지름으로 + 위·옆에 자리가 없으면 반지름을 70px로 줄여 + 위쪽에 두고, 방울끼리도 겹치지 않는다", () => {
  // 320×700에서 + 가운데가 (80, 120)인 경우. 84px 호는 위로 들면 화면 위를, 옆으로 밀면 오른쪽을 넘는다.
  const page = ringPage({ width: 320, height: 700, toggleRect: { left: 58, top: 98, width: 44, height: 44 } });
  page.toggle.click();
  assert.equal(page.ring.getAttribute("data-layout"), "arc");
  const centers = page.items.map(page.position).map(spot => ({ x: 80 + spot.x, y: 120 + spot.y }));
  for (const { x, y } of centers) {
    assert.ok(x - 26 >= 8 - 0.5 && x + 26 <= 320 - 8 + 0.5 && y - 26 >= 8 - 0.5, `off screen ${x},${y}`);
    assert.ok(y <= 120 + 0.5, `dropped below + ${x},${y}`);
    const nearestX = Math.min(Math.max(x, 58), 102), nearestY = Math.min(Math.max(y, 98), 142);
    assert.ok(Math.hypot(x - nearestX, y - nearestY) >= 26, `covers + ${x},${y}`);
  }
  for (const [i, a] of centers.entries()) for (const b of centers.slice(i + 1)) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 52, "bubbles overlap");
  // 반지름 70px 호: 가운데 방울이 + 가운데보다 70px 높다.
  assert.ok(Math.abs(Math.min(...centers.map(({ y }) => y)) - 50) < 0.5);
});

test("열려 있는 사이 대상이 숨거나 카드가 화면에서 떨어져 나가면, 변경 감시가 오기 전에 골라도 누르지 않는다", () => {
  const page = ringPage();
  page.toggle.click();
  // 변경 감시(MutationObserver) 알림을 보내지 않은 채 바꾼다. 방울은 아직 누를 수 있게 보인다.
  page.pen.hidden = true;
  page.item("handwriting").click();
  assert.equal(page.pen.clicks, 0);
  page.toggle.click();
  page.photo.setAttribute("aria-disabled", "true");
  page.item("photo").click();
  assert.equal(page.photo.clicks, 0);
  page.toggle.click();
  page.cards.calendar.isConnected = false;
  page.item("calendar").click();
  assert.equal(page.cards.calendar.clicks, 0, "a detached card is not pressed");
});

test("홈에 닿은 뒤 다음 화면 갱신 전에 새 대화(채팅 화면)를 요청하면 기다리던 카드를 누르지 않는다", () => {
  for (const [name, request] of [
    ["전환 방향 기록", page => page.body.setAttribute("data-chat-direction", "forward")],
    ["#chat 주소", page => { page.window.location = { hash: "#chat" }; }],
  ]) {
    const page = ringPage({ view: "chat" });
    page.toggle.click();
    page.item("calendar").click();
    assert.equal(page.home.clicks, 1, name);
    // 홈 화면이 적용된 직후, 링의 다음 화면 갱신 전에 학생이 새 대화를 연다. 채팅 화면은 아직 그려지지 않았다.
    page.body.setAttribute("data-view", "home");
    request(page);
    page.frames(); page.frames();
    assert.equal(page.cards.calendar.clicks, 0, name);
  }
});

test("화면을 확대해 보이는 칸이 창보다 작으면 그 칸 안에 방울을 놓고, 확대한 채 화면을 끌면 다시 놓는다", () => {
  // 390×700 창을 두 배로 확대해 보이는 칸이 195×350, 위에서 150px 내려가 있다. + 가운데는 (30, 300)이다.
  const visual = { width: 195, height: 350, offsetLeft: 0, offsetTop: 150 };
  const page = ringPage({ width: 390, height: 700, toggleRect: { left: 8, top: 278, width: 44, height: 44 }, visual });
  page.toggle.click();
  assert.equal(page.toggle.getAttribute("aria-expanded"), "true");
  const inView = ({ left, top, width, height }) => {
    // 좁은 보이는 칸에서는 44px 방울(data-compact)을 쓸 수 있다. 반지름은 그에 맞춰 본다.
    const size = page.ring.getAttribute("data-compact") === "" ? 22 : 26;
    for (const spot of page.items.map(page.position)) {
      const x = 30 + spot.x, y = 300 + spot.y;
      assert.ok(x - size >= left + 8 - 0.5 && x + size <= left + width - 8 + 0.5, `x ${x} outside the visible ${left}..${left + width}`);
      assert.ok(y - size >= top + 8 - 0.5 && y + size <= top + height - 8 + 0.5, `y ${y} outside the visible ${top}..${top + height}`);
      const nearestX = Math.min(Math.max(x, 8), 52), nearestY = Math.min(Math.max(y, 278), 322);
      assert.ok(Math.hypot(x - nearestX, y - nearestY) >= size, `covers + ${x},${y}`);
    }
  };
  inView({ left: 0, top: 150, width: 195, height: 350 });
  // 확대한 채 보이는 칸을 위로 30px 끌면(+는 창에서 제자리) 보이는 칸의 신호로 다시 놓는다.
  page.window.visualViewport.offsetTop = 120;
  page.windowEvent("visual-scroll");
  assert.equal(page.toggle.getAttribute("aria-expanded"), "true");
  inView({ left: 0, top: 120, width: 195, height: 350 });
});

test("열린 링은 뒤로 가기·주소 조각 변화·홈↔채팅 전환 때 닫고, 화면이 그대로면 남겨 둔다", () => {
  for (const type of ["popstate", "hashchange"]) {
    const page = ringPage({ view: "chat" });
    page.toggle.click();
    page.windowEvent(type);
    assert.equal(page.toggle.getAttribute("aria-expanded"), "false", type);
  }
  // 알림을 눌러 대화를 여는 것처럼 뒤로 가기 없이 화면만 바뀐 경우. 속성 변화 감시가 알린다.
  const page = ringPage({ view: "chat" });
  page.toggle.click();
  for (const observer of page.observers) observer([]);
  assert.equal(page.toggle.getAttribute("aria-expanded"), "true", "an unrelated change keeps the ring");
  page.body.setAttribute("data-view", "home");
  for (const observer of page.observers) observer([]);
  assert.equal(page.toggle.getAttribute("aria-expanded"), "false");
});

test("펼쳐지는 도중 동작 줄이기를 켜면 바로 펼친 상태로 두고 방울이 곧바로 누름을 받는다", () => {
  const page = ringPage();
  page.toggle.click();
  page.frames();
  assert.equal(page.ring.getAttribute("data-settled"), null);
  assert.deepEqual([...page.timers.values()].map(timer => timer.delay), [290]);
  page.reduce();
  assert.equal(page.ring.getAttribute("data-open"), "true");
  assert.equal(page.ring.getAttribute("data-settled"), "");
  assert.equal(page.timers.size, 0, "the pending settle is cancelled");
  // 첫 그리기를 기다리던 중에 켜도 같다.
  const early = ringPage();
  early.toggle.click();
  early.reduce();
  assert.equal(early.ring.getAttribute("data-open"), "true");
  assert.equal(early.ring.getAttribute("data-settled"), "");
  early.frames();
  assert.equal(early.timers.size, 0, "the late first frame does not schedule another wait");
});

test("채팅에서 Enter로 방울을 고른 뒤 키를 누르고 있어도, +로 돌아온 반복 Enter가 링을 다시 열어 실행을 취소하지 않는다", () => {
  const page = ringPage({ view: "chat" });
  page.toggle.click();
  page.item("calendar").click();
  assert.equal(page.home.clicks, 1);
  assert.equal(page.state.focused, page.toggle);
  // 같은 Enter·Space가 되풀이되어 +에 들어온다. 기본 동작(click)을 막아 링이 다시 열리지 않는다.
  for (const key of ["Enter", " "]) assert.equal(page.toggle.fire("keydown", { key, repeat: true }).defaultPrevented, true, key);
  assert.equal(page.toggle.getAttribute("aria-expanded"), "false");
  page.body.setAttribute("data-view", "home");
  page.frames(); page.frames();
  assert.equal(page.cards.calendar.clicks, 1, "the delayed card click still runs");
  // 새로 누른 Enter는 막지 않는다(버튼이 click을 내 링을 연다).
  assert.equal(page.toggle.fire("keydown", { key: "Enter" }).defaultPrevented, false);
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
  // 홈으로 오는 사이 대상이 잠기거나(disabled·aria-disabled) 숨으면(hidden) 누르지 않는다.
  // 열 때 방울을 숨기거나 잠그는 규칙과 같은 세 가지를 실행 직전에도 본다.
  for (const [name, change] of [
    ["disabled", node => { node.disabled = true; }],
    ["hidden", node => { node.hidden = true; }],
    ["aria-disabled", node => node.setAttribute("aria-disabled", "true")],
  ]) {
    const locked = ringPage({ view: "chat" });
    locked.toggle.click();
    locked.item("handwriting").click();
    assert.equal(locked.home.clicks, 1, name);
    change(locked.pen);
    locked.body.setAttribute("data-view", "home");
    locked.frames(); locked.frames();
    assert.equal(locked.pen.clicks, 0, name);
  }
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
