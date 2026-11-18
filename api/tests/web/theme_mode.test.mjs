import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../../app/chat_web/assets/chat.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../../app/chat_web/index.html", import.meta.url), "utf8");
const key = "kumoh-chat-theme:v1";

function page({ dark = false, storage = new Map(), readFails = false, writeFails = false, storageMissing = false, getterFails = false, media = "modern" } = {}) {
  const events = new Map(), mediaEvents = [], timers = [];
  let active;
  class Node {
    children = []; dataset = {}; attrs = new Map(); listeners = new Map();
    style = { setProperty() {} };
    setAttribute(name, value) { this.attrs.set(name, String(value)); }
    getAttribute(name) { return this.attrs.get(name) ?? (name.startsWith("data-") ? this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] ?? null : null); }
    removeAttribute(name) { this.attrs.delete(name); }
    append(...nodes) { for (const node of nodes) node.parent = this; this.children.push(...nodes); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
    contains(node) { return this === node || this.children.some(child => child.contains(node)); }
    querySelector(selector) { return this.children.find(node => `.${node.className}` === selector) ?? null; }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    focus() { active = this; }
    click() { this.fire("click"); }
    fire(type, extra = {}) { const event = { target: this, preventDefault() {}, stopPropagation() {}, ...extra }; this.listeners.get(type)?.(event); }
    getBoundingClientRect() { return { top: 20, bottom: 64, right: 330, width: 200, height: 180 }; }
  }
  const root = new Node(), body = new Node();
  const buttons = [new Node(), new Node()];
  for (const button of buttons) { const label = new Node(); label.className = "lang-pill-label"; button.append(label); }
  const nodes = new Map([["#login-theme-button", buttons[0]], ["#theme-button", buttons[1]]]);
  const document = { documentElement: root, body, get activeElement() { return active; },
    querySelector: selector => nodes.get(selector) ?? null,
    addEventListener: (type, fn) => events.set(type, fn) };
  const query = { get matches() { return dark; } };
  if (media === "modern") query.addEventListener = (_type, fn) => mediaEvents.push(fn);
  if (media === "legacy") query.addListener = fn => mediaEvents.push(fn);
  const window = { innerWidth: 390, innerHeight: 800 };
  if (media !== "missing") window.matchMedia = queryText => { assert.equal(queryText, "(prefers-color-scheme: dark)"); return query; };
  const localStorage = { getItem(name) { if (readFails) throw Error("fictional read failure"); return storage.get(name) ?? null; },
    setItem(name, value) { if (writeFails) throw Error("fictional write failure"); storage.set(name, value); } };
  Object.defineProperty(window, "localStorage", { get() { if (getterFails) throw Error("fictional getter failure"); return storageMissing ? null : localStorage; } });
  const context = { document, window, setTimeout: fn => timers.push(fn),
    within: (parent, child) => parent.contains(child),
    element(tag, className, text) { const node = new Node(); node.tagName = tag; node.className = className; node.textContent = text; return node; } };
  const language = script.slice(0, script.indexOf("// 교내 주요 사이트 퀵링크"));
  const menu = script.slice(script.indexOf("let activeChoiceMenu = null;"), script.indexOf("function setupAiMode()"));
  const storageSource = script.slice(script.indexOf("function historyStorage()"), script.indexOf("function persistConversations()"));
  const start = script.indexOf("// 테마 선택기(#131).");
  assert.ok(start >= 0, "테마 구현 시작 표식");
  const end = script.indexOf("// 테마 선택기 끝.", start);
  assert.ok(end > start, "테마 구현 끝 표식");
  runInNewContext(`${language}\n${storageSource}\n${menu}\n${script.slice(start, end)}\nsetupTheme();\nglobalThis.changeLanguage = value => { uiLang = value; for (const listener of langListeners) listener(); };`, context);
  const menuNode = () => body.children.find(node => node.className === "choice-menu");
  const items = () => menuNode().children.filter(node => node.getAttribute("role") === "menuitemradio");
  return { root, buttons, storage, menu: menuNode, items, get active() { return active; },
    choose(value, index = 0) { buttons[index].click(); items().find(item => item.dataset.choiceValue === value).click(); },
    system(value) { dark = value; for (const callback of mediaEvents) callback({ matches: value }); },
    language: context.changeLanguage,
    outside() { events.get("pointerdown")({ target: new Node() }); }, timers };
}

test("두 화면의 테마 버튼은 기존 알약과 currentColor SVG를 쓴다", () => {
  for (const id of ["login-theme-button", "theme-button"]) {
    const button = html.match(new RegExp(`<button\\b[^>]*id="${id}"[\\s\\S]*?</button>`))?.[0];
    assert.ok(button, id); assert.match(button, /class="[^"]*lang-pill/);
    assert.match(button, /stroke="currentColor"/); assert.match(button, /aria-haspopup="menu"/);
  }
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/);
});

test("저장값이 없으면 OS 색을 따르고 잘못된 값과 읽기 실패도 시스템으로 돌아간다", () => {
  for (const dark of [false, true]) for (const options of [{}, { storage: new Map([[key, "invalid"]]) }, { readFails: true }, { storageMissing: true }, { getterFails: true }]) {
    const app = page({ dark, ...options });
    assert.equal(app.root.getAttribute("data-theme-mode"), "system");
    assert.equal(app.root.getAttribute("data-theme"), dark ? "dark" : "light");
  }
});

test("세 선택은 같은 저장소를 쓴 새 실행에서도 복원된다", () => {
  for (const mode of ["system", "light", "dark"]) {
    const storage = new Map(); const first = page({ storage, dark: true }); first.choose(mode);
    assert.equal(storage.get(key), mode);
    const next = page({ storage, dark: true });
    assert.equal(next.root.getAttribute("data-theme-mode"), mode);
    assert.equal(next.root.getAttribute("data-theme"), mode === "light" ? "light" : "dark");
  }
});

test("시스템 변경은 시스템 모드에서만 적용하고 쓰기 실패 때도 현재 선택은 유지한다", () => {
  const app = page({ writeFails: true }); app.system(true);
  assert.equal(app.root.getAttribute("data-theme"), "dark");
  app.choose("light"); app.system(true);
  assert.equal(app.root.getAttribute("data-theme-mode"), "light");
  assert.equal(app.root.getAttribute("data-theme"), "light");
  app.choose("dark"); app.system(false);
  assert.equal(app.root.getAttribute("data-theme"), "dark");
  app.choose("system"); assert.equal(app.root.getAttribute("data-theme"), "light");
  const missing = page({ storageMissing: true }); missing.choose("dark");
  assert.equal(missing.root.getAttribute("data-theme"), "dark");
});

test("matchMedia가 없거나 옛 Safari 방식이어도 시작과 선택이 동작한다", () => {
  for (const media of ["missing", "legacy", "static"]) {
    const app = page({ media }); app.choose("dark");
    assert.equal(app.root.getAttribute("data-theme"), "dark");
    if (media === "legacy") { app.choose("system"); app.system(true); assert.equal(app.root.getAttribute("data-theme"), "dark"); }
  }
});

test("두 버튼의 표시와 메뉴 선택 상태가 같고 언어를 바꿔도 선택은 유지한다", () => {
  const app = page(); app.choose("dark");
  const koreanName = app.buttons[0].getAttribute("aria-label");
  for (const lang of ["en", "zh", "ko"]) {
    app.language(lang);
    assert.equal(app.root.getAttribute("data-theme-mode"), "dark");
    assert.equal(app.buttons[0].getAttribute("aria-label"), app.buttons[1].getAttribute("aria-label"));
    assert.equal(app.buttons[0].children[0].textContent, app.buttons[1].children[0].textContent);
    if (lang !== "ko") assert.notEqual(app.buttons[0].getAttribute("aria-label"), koreanName);
    for (const button of app.buttons) {
      button.click();
      assert.deepEqual(app.items().filter(item => item.getAttribute("aria-checked") === "true").map(item => item.dataset.choiceValue), ["dark"]);
      app.menu().fire("keydown", { key: "Escape" });
    }
  }
});

test("화살표·Enter·Space·Esc·바깥 클릭과 포커스 복귀를 공유 메뉴로 처리한다", () => {
  const app = page(), button = app.buttons[0];
  for (const key of ["ArrowDown", "ArrowUp", "Enter", " "]) {
    button.fire("keydown", { key }); assert.ok(app.menu());
    app.menu().fire("keydown", { key: "Escape" }); assert.equal(app.active, button);
  }
  button.click(); const items = app.items();
  assert.equal(app.active, items[0]);
  app.menu().fire("keydown", { key: "ArrowDown" }); assert.equal(app.active, items[1]);
  app.menu().fire("keydown", { key: "ArrowUp" }); assert.equal(app.active, items[0]);
  app.menu().fire("keydown", { key: "ArrowUp" }); assert.equal(app.active, items[2]);
  app.menu().fire("keydown", { key: " " }); assert.equal(app.active, button);
  assert.equal(app.root.getAttribute("data-theme-mode"), "dark");
  button.click(); app.menu().fire("keydown", { key: "ArrowUp" });
  app.menu().fire("keydown", { key: "Enter" }); assert.equal(app.active, button);
  assert.equal(app.root.getAttribute("data-theme-mode"), "light");
  button.click(); app.outside(); assert.equal(app.menu(), undefined);
  assert.equal(button.getAttribute("aria-expanded"), "false");
  button.click(); button.click(); assert.equal(app.menu(), undefined);
  button.click(); app.menu().fire("keydown", { key: "Tab" });
  app.timers.splice(0).forEach(callback => callback());
  assert.equal(app.menu(), undefined);
});
