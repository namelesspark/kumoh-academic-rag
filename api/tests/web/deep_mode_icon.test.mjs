import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const root = new URL("../../app/chat_web/", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const buttonMarkup = read("index.html").match(/<button\b[^>]*\bid="ai-mode-button"[^>]*>([\s\S]*?)<\/button>/)?.[1];
assert.ok(buttonMarkup, "답변 모드 버튼이 있어야 함");

function attributes(markup) {
  return new Map(Array.from(
    markup.matchAll(/([^\s=]+)(?:="([^"]*)")?/g),
    ([, name, value = ""]) => [name, value],
  ));
}

class Element {
  children = [];
  dataset = {};
  listeners = new Map();
  classList = { remove() {}, toggle() {} };
  style = { setProperty() {} };

  constructor(attrs = new Map()) { this.attrs = attrs; }
  setAttribute(name, value) { this.attrs.set(name, value); }
  removeAttribute(name) { this.attrs.delete(name); }
  append(...nodes) { this.children.push(...nodes); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  focus() {}
  getBoundingClientRect() { return { top: 400, bottom: 444, right: 240, width: 160, height: 100 }; }
  cloneNode(deep) {
    const copy = new Element(new Map(this.attrs));
    if (deep) copy.append(...this.children.map(child => child.cloneNode(true)));
    return copy;
  }
}

function iconFromMarkup(mode) {
  for (const [, attrs, content] of buttonMarkup.matchAll(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/g)) {
    const icon = new Element(attributes(attrs));
    if (icon.attrs.get("data-icon") !== mode) continue;
    for (const [, path] of content.matchAll(/<path\b([^>]*?)\s*\/?>/g)) {
      icon.append(new Element(attributes(path)));
    }
    return icon;
  }
  assert.fail(`답변 모드 버튼에 ${mode} 아이콘이 있어야 함`);
}

test("깊이 생각 아이콘은 둥근 선으로 그린다", () => {
  const { attrs, children } = iconFromMarkup("deep");
  for (const [name, value] of Object.entries({
    fill: "none", stroke: "currentColor", "stroke-linecap": "round", "stroke-linejoin": "round",
    viewBox: "0 0 24 24", width: "18", height: "18", "aria-hidden": "true", focusable: "false",
  })) assert.equal(attrs.get(name), value, name);
  const width = Number(attrs.get("stroke-width"));
  assert.ok(width >= 1.8 && width <= 2, "선 굵기는 1.8~2여야 함");
  assert.ok(attrs.has("hidden"));
  assert.ok(children.length >= 1 && children.length <= 3);
  for (const path of children) {
    assert.ok(path.attrs.get("d"), "각 경로에 그릴 좌표가 있어야 함");
    assert.equal(path.attrs.get("fill") ?? "none", "none");
  }
});

test("채팅 화면의 텍스트 파일에서 기존 별 경로가 사라진다", () => {
  function checkFiles(directory) {
    for (const entry of readdirSync(new URL(directory, root), { withFileTypes: true })) {
      const path = directory + entry.name;
      if (entry.isDirectory()) checkFiles(path + "/");
      else if (/\.(?:html|css|js|json)$/i.test(path)) {
        assert.ok(!read(path).includes("M12 1 15 9 23 12"), `${path}에 기존 별 경로가 남아 있음`);
      }
    }
  }
  checkFiles("");
});

test("빠르게 모드에서 메뉴를 열면 깊이 생각 아이콘 복사본만 보인다", () => {
  const script = read("assets/chat.js");
  const start = script.indexOf("const aiModeKey =");
  const end = script.indexOf("setupAiMode();", start);
  assert.ok(start >= 0 && end > start, "답변 모드 설정 코드를 찾을 수 있어야 함");

  const button = new Element();
  const row = new Element();
  const body = new Element();
  const fastIcon = iconFromMarkup("fast");
  const deepIcon = iconFromMarkup("deep");
  const buttonChildren = new Map([
    [".mode-pill-label", new Element()],
    [".mode-icon[data-icon=fast]", fastIcon],
    [".mode-icon[data-icon=deep]", deepIcon],
  ]);
  button.querySelector = selector => buttonChildren.get(selector);
  const pageElements = new Map([["#ai-mode-button", button], [".composer-row", row]]);
  runInNewContext(script.slice(start, end) + "\nsetupAiMode();", {
    document: { body, querySelector: selector => pageElements.get(selector) },
    window: {},
    element: () => new Element(),
    historyStorage: () => null,
    onLangChange() {},
    clearTimeout() {},
    t: text => text,
  });

  assert.equal(button.dataset.mode, "fast");
  assert.ok(deepIcon.attrs.has("hidden"));
  button.listeners.get("click")();

  const [menu] = body.children;
  const deepChoice = menu.children.find(item => item.dataset.choiceValue === "deep");
  const copy = deepChoice?.children[0]?.children[0];
  assert.ok(copy, "깊이 생각 메뉴 항목에 아이콘이 있어야 함");
  assert.notEqual(copy, deepIcon);
  assert.ok(deepIcon.attrs.has("hidden"));
  assert.ok(!copy.attrs.has("hidden"));
  const visibleAttrs = new Map(deepIcon.attrs);
  visibleAttrs.delete("hidden");
  assert.deepEqual(copy.attrs, visibleAttrs);
  assert.deepEqual(copy.children.map(path => path.attrs), deepIcon.children.map(path => path.attrs));
});
