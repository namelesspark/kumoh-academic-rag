// 첫 화면 개편 테스트 (#58). 브라우저와 서버를 띄우지 않고 실제 chat.css·index.html·chat.js 파일을 읽어
// 색 대비를 계산하고, 가짜 화면 객체와 가짜 서버 요청 함수(fetch)로 그림 자리와 카드 동작을 확인한다.
// 그림 크기·질문·응답은 모두 가상 값이다. 320px·390px 배치는 브라우저에서 따로 확인한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const read = path => readFileSync(new URL(`../../app/chat_web/${path}`, import.meta.url), "utf8");
const script = read("assets/chat.js");
const styles = read("assets/chat.css");
const html = read("index.html");

// --- chat.css 읽기 ---------------------------------------------------------------------------

// 주석을 지운 뒤 "선택자 { 선언 }" 묶음으로 나눈다. @media 안의 규칙도 같은 목록에 들어온다.
const rules = [...styles.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, body]) => ({
  selectors: selectors.split(",").map(part => part.trim().replace(/\s+/g, " ")),
  declarations: body.split(";").map(line => line.trim()).filter(Boolean).map(line => {
    const colon = line.indexOf(":");
    return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
  }),
}));
const rootRule = rules.find(rule => rule.selectors.includes(":root"));
const variables = new Map((rootRule?.declarations ?? []).filter(([name]) => name.startsWith("--")));

// 색을 읽는 자리. 뒤에 적힌 선언이 이기므로 묶음 속성(border)과 낱개 속성(border-color)을 함께 본다.
const properties = {
  text: ["color"],
  fill: ["background", "background-color"],
  edge: ["border", "border-color"],
  ring: ["outline", "outline-color"],
};

// 선택자에 마지막으로 적힌 선언 값을 돌려준다. 찾지 못하면 테스트가 실패한다.
function declared(selector, names) {
  let found;
  for (const rule of rules) {
    if (!rule.selectors.includes(selector)) continue;
    for (const [name, value] of rule.declarations) if (names.includes(name)) found = value;
  }
  assert.notEqual(found, undefined, `${selector}에 ${names.join("/")} 선언이 없다`);
  return found;
}

// 선언 값에서 변수를 따라가 실제 색 값(#rrggbb)을 얻는다. 변수 없이 적은 색은 받지 않는다.
function colorOf([selector, kind]) {
  let value = declared(selector, properties[kind]);
  for (let hops = 0; hops < 5; hops += 1) {
    const name = /var\((--[\w-]+)\)/.exec(value)?.[1];
    if (!name) break;
    assert.ok(variables.has(name), `${selector}: ${name} 변수가 :root에 없다`);
    value = variables.get(name);
  }
  assert.match(value, /^#[0-9a-f]{6}$/i, `${selector}의 ${kind} 색을 변수에서 읽지 못했다: ${value}`);
  return value.toLowerCase();
}

// 대비 공식(WCAG 2.x). 두 색의 밝기(상대 휘도)를 구해 (밝은 쪽 + 0.05) / (어두운 쪽 + 0.05)로 나눈다.
function luminance(hex) {
  const [red, green, blue] = [1, 3, 5]
    .map(start => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map(channel => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first, second) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

// 기준에 못 미치는 조합을 한꺼번에 모아 보여 준다.
function shortfalls(pairs, minimum) {
  return pairs
    .map(([label, front, back]) => [label, contrast(colorOf(front), colorOf(back))])
    .filter(([, ratio]) => ratio < minimum)
    .map(([label, ratio]) => `${label} ${ratio.toFixed(2)}:1`);
}

const chat = [".chat", "fill"];
const page = [":root", "fill"];
const masthead = [".masthead", "fill"];
const self = (selector, kind = "text") => [[selector, kind], [selector, "fill"]];

test("대비 공식이 알려진 값과 맞고, 고치기 전 입력창 테두리는 기준 미달로 계산된다", () => {
  assert.equal(Math.round(contrast("#000000", "#ffffff")), 21);
  assert.equal(contrast("#ffffff", "#ffffff"), 1);
  assert.ok(contrast("#a7b4c7", "#ffffff") < 3, "the old textarea border must fail 3:1");
  assert.equal(styles.toLowerCase().includes("#a7b4c7"), false);
});

test("확정한 색 값이 변수 한 곳에만 있고, 다른 규칙은 변수로만 색을 쓴다", () => {
  const confirmed = {
    "--sky": "#00a3d9",
    "--blue": "#005b96",
    "--navy": "#0a2540",
    "--yellow": "#ffd100",
    "--edge": "#8a8d8f",
    "--paper": "#f5f9fc",
  };
  for (const [name, value] of Object.entries(confirmed)) {
    assert.equal(variables.get(name)?.toLowerCase(), value, name);
  }

  const outside = rules.filter(rule => rule !== rootRule).flatMap(rule => rule.declarations);
  // 변수 이름(--white 등)은 색 이름으로 세지 않도록 var(...) 참조를 먼저 지우고 본다.
  const literal = outside.filter(([, value]) => (
    /#[0-9a-f]{3,8}\b|\b(?:white|black|rgba?|hsla?)\b/i.test(value.replace(/var\(--[\w-]+\)/g, ""))
  ));
  assert.deepEqual(literal, [], "colors must be declared once in :root");
});

test("밝은 청색은 도형 바탕에만, 강조 노랑은 남색 위 글자에만 쓴다", () => {
  const uses = name => rules.flatMap(rule => rule.declarations
    .filter(([, value]) => value.includes(`var(${name})`))
    .map(([property]) => [rule, property]));

  const sky = uses("--sky");
  assert.ok(sky.length > 0, "the hero shape must use the bright blue");
  assert.deepEqual(sky.filter(([, property]) => property !== "background").map(([, property]) => property), []);

  const yellow = uses("--yellow").filter(([rule]) => rule !== rootRule);
  assert.ok(yellow.length > 0);
  for (const [rule, property] of yellow) {
    assert.equal(property, "color");
    const background = rule.declarations.find(([name]) => name === "background")?.[1];
    assert.equal(background, "var(--navy)", rule.selectors.join(", "));
  }
});

test("글자·링크·입력 안내·준비 중 문구가 기본·마우스 올림 상태에서 배경과 4.5:1 이상이다", () => {
  const pairs = [
    ["본문", ...self(":root")],
    ["상단 띠", ...self(".masthead")],
    ["새 대화", ...self(".reset")],
    ["새 대화(올림)", ...self(".reset:not(:disabled):hover")],
    ["로그인 자리", ...self(".login")],
    ["준비 중 문구", ...self(".soon-label")],
    ["예시 질문", [".topics button", "text"], page],
    ["예시 질문(올림)", ...self(".topics button:hover")],
    ["테크모 펫의 말풍선", ...self(".pet-says")],
    ["다시 묻기 버튼", ...self(".check")],
    ["다시 묻기 버튼(올림)", ...self(".check:not(:disabled):hover")],
    ["소개 제목", [".hero h2", "text"], chat],
    ["소개 설명", [".hero-copy p", "text"], chat],
    ["소개 버튼", ...self(".cta")],
    ["소개 버튼(올림)", ...self(".cta:hover")],
    ["카드 제목", [".card-title", "text"], [".card", "fill"]],
    ["카드 설명", [".card-text", "text"], [".card", "fill"]],
    ["카드 제목(올림)", [".card-title", "text"], ["button.card:hover", "fill"]],
    ["카드 설명(올림)", [".card-text", "text"], ["button.card:hover", "fill"]],
    ["준비 중 카드 제목", [".card-title", "text"], [".card.soon", "fill"]],
    ["준비 중 카드 설명", [".card-text", "text"], [".card.soon", "fill"]],
    ["첫 화면 안내", [".empty-hint", "text"], chat],
    ["입력 글자", ...self("textarea")],
    ["입력 안내 글자", ["textarea::placeholder", "text"], ["textarea", "fill"]],
    ["보내기", ...self(".primary")],
    ["보내기(올림)", ...self(".primary:not(:disabled):hover")],
    ["입력창 아래 안내", [".composer p", "text"], chat],
    ["진행 알림", [".status", "text"], chat],
    ["첨부 제거", [".attach-clear", "text"], chat],
    ["다시 시도", [".retry", "text"], chat],
    ["다시 시도(오류 상자 안)", [".retry", "text"], [".error", "fill"]],
    ["근거 링크", [".evidence .source-link", "text"], [".evidence", "fill"]],
    ["내 질문 말풍선", ...self(".question")],
    ["하단 표시", [".site-footer p", "text"], page],
  ];
  assert.deepEqual(shortfalls(pairs, 4.5), []);

  // 흐리게 만드는 선언이 대비를 깎지 않게 한다.
  assert.equal(declared(".login:disabled", ["opacity"]), "1");
  assert.equal(declared("textarea::placeholder", ["opacity"]), "1");
});

test("버튼·입력창·카드의 테두리와 키보드 초점 표시가 맞닿은 배경과 3:1 이상이다", () => {
  const ring = [":focus-visible", "ring"];
  const pairs = [
    ["입력창 테두리", ["textarea", "edge"], chat],
    ["입력창 테두리(안쪽)", ...self("textarea", "edge")],
    ["입력창 테두리(올림)", ["textarea:hover", "edge"], chat],
    ["새 대화 테두리", [".reset", "edge"], masthead],
    ["새 대화 테두리(올림)", ...self(".reset:not(:disabled):hover", "edge")],
    ["로그인 자리 테두리", [".login", "edge"], masthead],
    ["다시 묻기 테두리", [".check", "edge"], chat],
    ["소개 버튼 바탕", [".cta", "fill"], chat],
    ["소개 버튼 바탕(올림)", [".cta:hover", "fill"], chat],
    ["말풍선 테두리", [".pet-says", "edge"], chat],
    ["말풍선 테두리(안쪽)", ...self(".pet-says", "edge")],
    ["보내기 바탕", [".primary", "fill"], chat],
    ["보내기 바탕(올림)", [".primary:not(:disabled):hover", "fill"], chat],
    ["카드 테두리", [".card", "edge"], chat],
    ["카드 테두리(올림)", ...self("button.card:hover", "edge")],
    ["준비 중 카드 테두리", [".card", "edge"], [".card.soon", "fill"]],
    ["초점 표시 · 화면 바탕", ring, page],
    ["초점 표시 · 대화 영역", ring, chat],
    ["초점 표시 · 상단 띠", ring, masthead],
    ["초점 표시 · 올린 카드", ring, ["button.card:hover", "fill"]],
    ["초점 표시 · 올린 버튼", ring, [".check:not(:disabled):hover", "fill"]],
  ];
  assert.deepEqual(shortfalls(pairs, 3), []);
});

test("마우스 올림과 초점은 색 말고도 밑줄·윤곽선으로 드러난다", () => {
  for (const selector of [
    ".reset:not(:disabled):hover",
    ".primary:not(:disabled):hover",
    ".check:not(:disabled):hover",
    ".cta:hover",
    ".topics button:hover",
    "button.card:hover .card-title",
  ]) {
    assert.match(declared(selector, ["text-decoration"]), /underline/, selector);
  }
  assert.match(declared(":focus-visible", ["outline"]), /^3px solid /);
  // 준비 중 카드는 색이 아니라 점선 테두리와 문구로 구분한다.
  assert.equal(declared(".card.soon", ["border-style"]), "dashed");
  // 그림 자리를 숨기는 hidden 속성이 display 선언에 지지 않아야 한다.
  assert.match(declared("[hidden]", ["display"]), /^none\s*!important$/);
});

// --- index.html 읽기 -------------------------------------------------------------------------

const landing = /<div id="empty"[\s\S]*?(?=<noscript>)/.exec(html)?.[0] ?? "";

test("소개 영역과 카드 6개는 #empty 안에, 상단 띠와 하단 표시는 대화 영역 밖에 있다", () => {
  assert.equal(html.split('id="empty"').length, 2);
  assert.match(html, /<div id="transcript"[^>]*>\s*<div id="empty" class="empty">/);

  assert.match(landing, /<h2 id="hero-title">졸업까지 남은 조건, 테크모가 같이 확인해요<\/h2>/);
  assert.deepEqual(
    [...landing.matchAll(/<span class="card-title">([^<]+)<\/span>/g)].map(match => match[1]),
    ["졸업 체크", "비교과 추천", "사진으로 묻기", "규정 질문", "학사 일정", "캠퍼스 안내"],
  );
  // 준비 중인 두 카드는 버튼이 아니고, 문구로 상태를 알린다.
  const soon = [...landing.matchAll(/<div class="card soon">[\s\S]*?<\/div>/g)].map(match => match[0]);
  assert.equal(soon.length, 2);
  for (const card of soon) assert.match(card, /<span class="soon-label">준비 중<\/span>/);
  assert.match(soon[0], /학사 일정/);
  assert.match(soon[1], /캠퍼스 안내/);
  assert.equal(landing.split('<button type="button" class="card"').length, 5);

  const [top, rest] = html.split("<main");
  assert.match(top, /<button type="button" class="login" disabled>가상 학생 로그인 <span class="soon-label">준비 중<\/span><\/button>/);
  assert.match(top, /id="reset">새 대화</);
  assert.match(rest.split("</main>")[1], /<footer[^>]*>\s*<p>교내 대회 출품작 · 가상 학생 데이터로 동작하는 시연입니다<\/p>/);

  // test_web.py가 보는 문구와 주소. 예전 안내 상자를 없앤 뒤로는 하단 표시의 문구를 본다(#61).
  assert.ok(html.includes("가상 학생 데이터"));
  assert.ok(html.includes('href="/chat-assets/chat.css"'));
  assert.ok(html.includes('src="/chat-assets/chat.js"'));
});

test("모든 그림은 숨긴 자리에서 시작하고, 보안 정책이 막는 방식은 쓰지 않는다", () => {
  const images = [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
  const logo = '<img src="/chat-assets/kumoh-signature.png" alt="국립금오공과대학교" width="782" height="113">';
  const basic = '<img src="/chat-assets/techmo-basic.png" alt="" width="468" height="414">';
  // 마지막 한 장은 테크모 펫의 스프라이트 시트다(#64). 192×192 칸 다섯 개를 가로로 이은 960×192 한 장이다.
  const sprite = '<img src="/chat-assets/techmo-sprite.png" alt="" width="960" height="192">';
  assert.deepEqual(images, [logo, basic, sprite]);

  const slots = [...html.matchAll(/<\w+[^>]*\bdata-brand-slot\b[^>]*>\s*(<img\b[^>]*>)/g)];
  assert.deepEqual(slots.map(match => match[1]), images, "each image must sit directly in its slot");
  for (const [slot] of slots) assert.match(slot, /\bdata-brand-slot hidden>/);
  // 로고는 상단 띠에, 테크모는 #empty 안에 있어 새 대화가 #empty를 되돌릴 때 함께 돌아온다.
  assert.equal(html.split("<main")[0].includes(logo), true);
  assert.equal(landing.includes(basic), true);
  // 스프라이트 시트는 #empty 밖에 있어 첫 질문을 보낸 뒤에도 펫이 남는다.
  assert.equal(landing.includes(sprite), false);
  // 예전 자세 그림 세 장은 화면이 더는 부르지 않는다.
  for (const gone of ["techmo-quiet", "techmo-guide", "techmo-celebrate"]) assert.equal(html.includes(gone), false, gone);

  // 숨긴 그림에 loading="lazy"를 붙이면 브라우저가 받지 않는다. 속성 onerror, data: 주소, 문서 안 스타일은 보안 정책이 막는다.
  for (const blocked of [/\bloading=/, /\son\w+=/, /data:/, /\sstyle=/, /<style\b/, /https?:\/\//]) {
    assert.doesNotMatch(html, blocked);
  }
  for (const blocked of ["data:image", "onerror", ".src ="]) assert.equal(script.includes(blocked), false, blocked);
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
  focused = 0;
  clicked = 0;

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

  scrollIntoView() {}

  focus() {
    this.focused += 1;
  }

  click() {
    this.clicked += 1;
  }
}

function descendants(node) {
  const found = [];
  for (const child of node.children) {
    if (child instanceof FakeElement) found.push(child, ...descendants(child));
  }
  return found;
}

// 가상 그림 상태. 브라우저는 로드가 끝나면 complete를 참으로 두고, 그릴 수 있을 때만 naturalWidth를 0보다 크게 둔다.
const waiting = () => ({ complete: false, naturalWidth: 0 });
const drawn = width => ({ complete: true, naturalWidth: width });
const broken = () => ({ complete: true, naturalWidth: 0 });

// 실제 index.html에 적힌 버튼과 카드를 그대로 가짜 요소로 옮긴다. [이름, 동작] 순서쌍이다.
const controlsInPage = [...landing.matchAll(
  /<button type="button" class="[^"]*" data-action="([^"]+)">\s*(?:<span class="card-title">)?([^<]+)/g,
)].map(match => [match[2].trim(), match[1]]);

const chatPath = "/api/v1/chat";
const graduationPath = "/api/v1/graduation-demo";

// 가짜 서버. 받은 주소를 적어 두고, 질문에는 근거 없음으로, 졸업 체크에는 실패로 답한다.
function serving(requests) {
  return async path => {
    requests.push(path);
    if (path === chatPath) {
      return { ok: true, json: async () => ({ session_id: "fictional-session", answered: false, answer: null, citations: [] }) };
    }
    return { ok: false, status: 500, json: async () => ({ detail: "fictional error" }) };
  };
}

function loadLanding({ logo = waiting(), techmo = waiting(), fetch } = {}) {
  const requests = [];
  const elements = new Map();
  const slots = [logo, techmo].map(state => {
    const slot = new FakeElement("slot");
    // index.html에서 그림 자리는 hidden으로 시작한다.
    slot.hidden = true;
    if (state) {
      slot.image = Object.assign(new FakeElement("img"), state);
      slot.append(slot.image);
    }
    return slot;
  });
  const controls = controlsInPage.map(([label, action]) => {
    const control = new FakeElement("button");
    control.textContent = label;
    control.dataset.action = action;
    return control;
  });
  const lists = { "[data-brand-slot]": slots, "[data-action]": controls };

  runInNewContext(script, {
    document: {
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, new FakeElement(selector));
        return elements.get(selector);
      },
      querySelectorAll: selector => lists[selector] ?? [],
      createElement: tag => new FakeElement(tag),
      createTextNode: value => value,
    },
    window: { matchMedia: () => ({ matches: false }) },
    URL,
    AbortSignal: { timeout: () => undefined },
    fetch: fetch ?? serving(requests),
  }, { filename: "chat.js" });

  const shown = {
    requests,
    logo: slots[0],
    techmo: slots[1],
    controls,
    control: label => controls.find(control => control.textContent === label),
    transcript: elements.get("#transcript"),
    empty: elements.get("#empty"),
    reset: elements.get("#reset"),
    composer: elements.get("#composer"),
    input: elements.get("#question"),
    file: elements.get("#photo-file"),
  };
  shown.transcript.append(shown.empty);
  return shown;
}

function finish(slot, state, signal) {
  Object.assign(slot.image, state);
  slot.image.fire(signal);
}

test("그림 로드에 성공하면 그 자리만 보이고, 아직 받는 중인 자리는 숨긴 채 남는다", () => {
  const shown = loadLanding();
  assert.equal(shown.logo.hidden, true);
  assert.equal(shown.techmo.hidden, true);

  finish(shown.logo, drawn(782), "load");
  assert.equal(shown.logo.hidden, false);
  assert.equal(shown.techmo.hidden, true);

  finish(shown.techmo, drawn(468), "load");
  assert.equal(shown.techmo.hidden, false);
});

test("그림 로드에 실패하면 자리를 숨긴 채 두고 다른 그림으로 바꾸지 않는다", () => {
  const shown = loadLanding();
  finish(shown.logo, broken(), "error");
  finish(shown.techmo, broken(), "error");

  for (const slot of [shown.logo, shown.techmo]) {
    assert.equal(slot.hidden, true);
    assert.deepEqual(slot.children, [slot.image]);
    assert.equal(slot.image.src, undefined);
    assert.equal(slot.image.attributes.size, 0);
  }
});

test("스크립트가 늦게 실행돼 신호를 놓쳐도, 이미 끝난 성공은 보이고 이미 끝난 실패는 숨는다", () => {
  const shown = loadLanding({ logo: drawn(782), techmo: broken() });
  assert.equal(shown.logo.hidden, false);
  assert.equal(shown.techmo.hidden, true);

  const reversed = loadLanding({ logo: broken(), techmo: drawn(468) });
  assert.equal(reversed.logo.hidden, true);
  assert.equal(reversed.techmo.hidden, false);
});

test("한 그림이 없어도 다른 그림과 화면 초기화는 그대로 진행된다", () => {
  const shown = loadLanding({ logo: null, techmo: drawn(468) });
  assert.equal(shown.logo.hidden, true);
  assert.equal(shown.techmo.hidden, false);
  assert.equal(shown.composer.listeners.has("submit"), true);
});

test("그림이 실패한 뒤에도 질문을 보낼 수 있고, 새 대화가 같은 첫 화면을 되돌린다", async () => {
  const shown = loadLanding({ logo: broken(), techmo: broken() });

  shown.input.value = "가상 별빛열람증을 누가 발급하나요?";
  shown.composer.fire("submit");
  assert.equal(shown.transcript.children.includes(shown.empty), false);
  await setImmediate();
  assert.deepEqual(shown.requests, [chatPath]);
  assert.equal(shown.transcript.children.length, 1);

  shown.reset.fire("click");
  assert.deepEqual(shown.transcript.children, [shown.empty]);
  assert.equal(shown.logo.hidden, true);
  assert.equal(shown.techmo.hidden, true);
  assert.equal(shown.input.value, "");
});

test("첫 화면의 버튼과 카드는 화면에 이미 있는 기능으로만 이어진다", () => {
  assert.deepEqual(controlsInPage, [
    ["내 졸업 체크 보기", "graduation"],
    ["졸업 체크", "graduation"],
    ["비교과 추천", "graduation"],
    ["사진으로 묻기", "photo"],
    ["규정 질문", "ask"],
  ]);
  // 「테크모에게 묻기」 글자 버튼은 없앴다(#64). 그 이름은 펫 버튼의 읽기용 이름으로 한 번만 남는다.
  assert.equal(landing.includes("테크모에게 묻기"), false);
  assert.equal(html.split("테크모에게 묻기").length, 2);
  assert.equal(styles.includes("secondary"), false);
});

for (const label of ["내 졸업 체크 보기", "졸업 체크", "비교과 추천"]) {
  test(`${label}를 연달아 눌러도 졸업 체크 요청은 하나만 나가고, 끝난 뒤에는 다시 부를 수 있다`, async () => {
    const shown = loadLanding();
    shown.control(label).fire("click");
    shown.control(label).fire("click");
    assert.equal(shown.transcript.children.includes(shown.empty), false);
    await setImmediate();
    assert.deepEqual(shown.requests, [graduationPath]);

    shown.reset.fire("click");
    assert.deepEqual(shown.transcript.children, [shown.empty]);
    shown.control(label).fire("click");
    await setImmediate();
    assert.deepEqual(shown.requests, [graduationPath, graduationPath]);
  });
}

test("사진으로 묻기는 기존 사진 선택을 열고, 규정 질문은 입력창으로 초점을 옮긴다", () => {
  const shown = loadLanding();
  shown.control("사진으로 묻기").fire("click");
  assert.equal(shown.file.clicked, 1);
  assert.equal(shown.input.focused, 0);

  shown.control("규정 질문").fire("click");
  assert.equal(shown.input.focused, 1);

  // 요청은 나가지 않고 첫 화면도 그대로다.
  assert.deepEqual(shown.requests, []);
  assert.deepEqual(shown.transcript.children, [shown.empty]);
});

test("다른 요청이 진행 중이면 첫 화면의 버튼과 카드는 아무 일도 하지 않는다", async () => {
  const requests = [];
  let release;
  const held = new Promise(resolve => {
    release = resolve;
  });
  const shown = loadLanding({
    fetch: async path => {
      requests.push(path);
      await held;
      return { ok: false, status: 500, json: async () => ({ detail: "fictional error" }) };
    },
  });

  shown.input.value = "가상 질문";
  shown.composer.fire("submit");
  for (const control of shown.controls) control.fire("click");
  assert.deepEqual(requests, [chatPath]);
  assert.equal(shown.file.clicked, 0);
  assert.equal(shown.input.focused, 0);

  release();
  await setImmediate();
  assert.deepEqual(requests, [chatPath]);
});
