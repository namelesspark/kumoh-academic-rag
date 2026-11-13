// 화면 파일과 가상 응답으로 디자인과 기존 기능을 확인한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
const read = path => readFileSync(new URL(`../../app/chat_web/${path}`, import.meta.url), "utf8");
const script = read("assets/chat.js");
const styles = read("assets/chat.css");
const html = read("index.html");
const rules = [...styles.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, body]) => ({
  selectors: selectors.split(",").map(part => part.trim().replace(/\s+/g, " ")),
  declarations: body.split(";").map(line => line.trim()).filter(Boolean).map(line => {
    const colon = line.indexOf(":");
    return [line.slice(0, colon), line.slice(colon + 1).trim()];
  }),
}));
const rootRule = rules.find(rule => rule.selectors.includes(":root"));
const variables = new Map(rootRule.declarations.filter(([name]) => name.startsWith("--")));
function declared(selector, names) {
  let value;
  for (const rule of rules) {
    if (!rule.selectors.includes(selector)) continue;
    for (const [name, candidate] of rule.declarations) {
      if (names.includes(name)) value = candidate;
    }
  }
  assert.notEqual(value, undefined, selector + " 선언 없음 " + names.join("/"));
  return value;
}
function resolve(value) {
  for (let i = 0; i < 8 && /var\(/.test(value); i++) {
    value = value.replace(/var\((--[\w-]+)\)/g, (_, name) => {
      assert.ok(variables.has(name), name);
      return variables.get(name);
    });
  }
  return value;
}
function colors(value) {
  value = resolve(value);
  if (value === "transparent" || value === "none") return [[0, 0, 0, 0]];
  return [...value.matchAll(/#[0-9a-f]{6}|rgba\([\d.,]+\)/gi)].map(([color]) => {
    if (color.startsWith("#")) return [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)).concat(1);
    return color.slice(5, -1).split(",").map(Number);
  });
}
const blend = (front, back) => front.slice(0, 3).map((channel, i) => channel * front[3] + back[i] * (1 - front[3]));
function luminance(color) {
  return color.map(channel => channel / 255)
    .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
    .reduce((sum, channel, i) => sum + channel * [.2126, .7152, .0722][i], 0);
}
function contrast(first, second) {
  const x = luminance(first);
  const y = luminance(second);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

test("대비 계산과 반투명 합성이 알려진 값과 맞는다", () => {
  assert.equal(contrast([0, 0, 0], [255, 255, 255]), 21);
  assert.equal(contrast([255, 255, 255], [255, 255, 255]), 1);
  assert.deepEqual(blend([255, 255, 255, .5], [0, 0, 0]), [127.5, 127.5, 127.5]);
});

const parents = {
  "#login-form input":".login-card", "#login-form input:focus":".login-card", "#demo-student-list button":".login-card", "#demo-student-list button:hover":".login-card", ".login-safety":".login-card", ".login-submit":".login-card",
  ".card":".layout", "button.card:hover":".layout", ".feature-panel":".layout", ".chat":".layout", ".composer":".layout", "textarea":".composer", ".primary":".composer", ".primary:not(:disabled):hover":".composer", ".reply":".layout", ".question":".layout",
  ".reset":".masthead", ".reset:not(:disabled):hover":".masthead", ".login":".masthead", ".panel-close":".feature-panel", ".panel-close:hover":".feature-panel", ".cta":".feature-panel", ".cta:hover":".feature-panel", ".check":".reply", ".check:not(:disabled):hover":".reply", ".evidence":".reply", ".graduation table":".reply", ".error":".reply", ".badge.met":".reply", ".badge.short":".reply", ".badge.needs-check":".reply", ".reading":".reply", ".reading textarea":".reading", ".biskit .program":".reply", ".poster-result":".reply",
};
function fills(selector, photo) {
  const backing = parents[selector] ? fills(parents[selector],photo) : [photo];
  const paint = colors(declared(selector,["background","background-color"]));
  assert.ok(paint.length,selector);
  return backing.flatMap(back => paint.map(front => blend(front,back)));
}
function checkText(pairs) {
  const failures = [];
  for (const photo of [[4, 20, 38], [255, 255, 255]]) {
    for (const [inkSelector, backSelector] of pairs) {
      for (const background of fills(backSelector, photo)) {
        const foreground = colors(declared(inkSelector, ["color"]))[0];
        const ratio = contrast(blend(foreground, background), background);
        if (ratio < 4.5) failures.push(`${inkSelector} on ${backSelector} ${ratio.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(failures, []);
}

test("모든 색은 root 변수로 선언하고 남색 테마의 밝은 글자를 쓴다", () => {
  for(const rule of rules.filter(rule=>rule!==rootRule)) for(const [,value] of rule.declarations) assert.doesNotMatch(value.replace(/var\(--[\w-]+\)/g,""),/#[0-9a-f]{3,8}\b|\brgba?\(/i);
  for(const [name,value] of Object.entries({"--sky":"#00A3D9","--blue":"#005B96","--navy":"#0A2540","--yellow":"#FFD100","--ink":"#eaf4fb","--card-ink":"#eef7fd","--link-ink":"#8fdcff"})) assert.equal(variables.get(name).toLowerCase(),value.toLowerCase());
});

test("남색 유리의 양 끝과 밝고 어두운 사진 양쪽에서 글자 대비가 4.5 이상이다", () => {
  checkText([
    [":root",":root"],[".masthead",".masthead"],[".reset",".reset"],[".reset:not(:disabled):hover",".reset:not(:disabled):hover"],[".login",".login"],
    [".login-card",".login-card"],[".login-help",".login-card"],["#login-form label",".login-card"],["#login-form input","#login-form input"],["#login-form input::placeholder","#login-form input"],["#login-form input::placeholder","#login-form input:focus"],["#login-error",".login-card"],[".browse-main",".login-card"],
    [".login-safety",".login-safety"],["#demo-student-list strong","#demo-student-list button"],["#demo-student-list button","#demo-student-list button"],["#demo-student-list strong","#demo-student-list button:hover"],["#demo-student-list button","#demo-student-list button:hover"],
    [".card-title",".card"],[".card-text",".card"],[".card-title","button.card:hover"],[".card-text","button.card:hover"],[".panel-title",".feature-panel"],[".panel-text",".feature-panel"],[".panel-close",".panel-close"],[".panel-close:hover",".panel-close:hover"],[".empty-hint",".layout"],[".status",".layout"],
    [".reply",".reply"],[".evidence h3",".evidence"],[".evidence .date",".evidence"],[".evidence .source-link",".evidence"],[".graduation caption",".graduation table"],[".graduation .source",".graduation table"],[".graduation .shortfall",".graduation table"],
    [".badge.met",".badge.met"],[".badge.short",".badge.short"],[".badge.needs-check",".badge.needs-check"],[".error",".error"],[".retry",".error"],
    [".reading textarea",".reading textarea"],[".reading textarea::placeholder",".reading textarea"],[".source-link",".reply"],[".source-link",".biskit .program"],[".source-link",".feature-panel"],[".source-link",".poster-result"],
    [".composer",".composer"],[".composer textarea","textarea"],[".composer textarea::placeholder","textarea"],[".composer p",".composer"],[".attach-clear",".composer"],
    [".login-submit",".login-submit"],[".primary",".primary"],[".primary:not(:disabled):hover",".primary:not(:disabled):hover"],[".pet-says",".pet-says"],["#login-pet-line","#login-pet-line"],
  ]);
});

test("테두리와 초점은 유리 안쪽 바탕과 3 이상이고 밝은 입력창은 안쪽 경계를 보강한다", () => {
  const selectors=[".login-card",".layout",".card","button.card:hover",".feature-panel","#demo-student-list button","#demo-student-list button:hover","#login-form input","#login-form input:focus",".reset",".login",".panel-close",".login-submit",".primary",".primary:not(:disabled):hover",".login-safety",".evidence"];
  const failures=[];
  for(const photo of [[4,20,38],[255,255,255]]) for(const selector of selectors) for(const back of fills(selector,photo)) {
    const edge=colors(declared(selector,["border","border-color"]))[0]; const ratio=contrast(blend(edge,back),back);
    if(ratio<3) failures.push(selector+" "+ratio.toFixed(2));
  }
  const focus=colors(declared(":focus-visible",["outline","outline-color"]))[0];
  for (const photo of [[4,20,38],[255,255,255]]) {
    for (const back of fills(".masthead",photo)) {
      const edge = colors(declared(".masthead",["border-bottom-color"]))[0];
      const ratio = contrast(blend(edge,back),back);
      if (ratio < 3) failures.push(".masthead " + ratio.toFixed(2));
    }
    for (const back of fills(".graduation table",photo)) {
      const edge = colors(declared(".graduation th",["border-color"]))[0];
      const ratio = contrast(blend(edge,back),back);
      if (ratio < 3) failures.push(".graduation th " + ratio.toFixed(2));
    }
  }
  for(const photo of [[4,20,38],[255,255,255]]) for(const surface of [".login-card",".layout",".card",".masthead"]) for(const back of fills(surface,photo)) assert.ok(contrast(blend(focus,back),back)>=3,surface);
  assert.match(declared(".composer",["box-shadow"]),/inset 0 0 0 1px var\(--blue\)/);
  for(const back of fills(".composer",[255,255,255])) assert.ok(contrast(colors("var(--blue)")[0].slice(0,3),back)>=3);
  assert.deepEqual(failures,[]);
});

test("로그인과 보내기 gradient 양 끝은 흰 글자 대비 4.5 이상이다", () => {
  for(const selector of [".login-submit",".primary",".primary:not(:disabled):hover"]) {
    assert.match(declared(selector,["background"]),/linear-gradient\(135deg,var\(--control-start\),var\(--control-end\)\)/);
    for(const color of colors(declared(selector,["background"]))) assert.ok(contrast([255,255,255],color.slice(0,3))>=4.5,selector);
  }
});

test("유리 흐림은 1.5px 이하이고 판은 흐리지 않으며 로고에 흰 판을 받친다", () => {
  assert.equal(declared(".login-card",["backdrop-filter"]),"blur(1.5px) saturate(1.2)");
  assert.equal(declared(".masthead",["backdrop-filter"]),"blur(1.5px) saturate(1.2)");
  assert.equal(declared(".layout",["backdrop-filter"]),"none");
  assert.equal(declared(".brand-logo",["padding"]),"7px 12px");
  assert.equal(declared(".login-brand",["border-radius"]),"12px");
  assert.equal(declared(".chat",["background"]),"transparent");
});

test("확정 제목 그림과 치수선·눈금·대체 제목을 제공하고 옛 그림·알약은 요청하지 않는다", () => {
  assert.match(html,/<img[^>]*src="\/chat-assets\/title-lettering.png"[^>]*alt="졸업까지, 테크모와 함께"/);
  assert.doesNotMatch(html+styles+script,/calligraphy-title|calligraphy-fallback|EastSeaDokdo|feature-pills/);
  assert.match(html,/class="drawing-dimension"[^>]*aria-hidden="true"/);
  assert.match(html,/KIT · ACADEMIC GUIDE  ⟵ 2026 ⟶/);
  assert.match(html,/class="title-ticks"[^>]*aria-hidden="true"/);
  assert.match(html,/<h1 class="title-fallback">졸업까지,<span><em>테크모<\/em>와 함께<\/span><\/h1>/);
  assert.equal(declared(".title-fallback span",["padding-left"]),"0");
  assert.equal(declared(".title-lettering",["width"]),"78vw");
  assert.ok(styles.includes("clamp(280px, 40vw, 507px)"));
  assert.equal(declared(".drawing-dimension",["font-size"]),"11px");
  assert.equal(declared(".drawing-dimension",["letter-spacing"]),".22em");
  assert.equal(declared(".intro-description",["font-size"]),"17px");
  assert.equal(declared(".title-lettering:not([hidden]) + .title-fallback",["display"]),"none");
});

test("기능 배지는 42px의 금오 구슬 꼴이고 선 아이콘은 23px이다", () => {
  assert.equal(declared(".feature-badge",["width"]),"42px"); assert.equal(declared(".feature-badge",["height"]),"42px");
  assert.equal(declared(".feature-badge",["border-radius"]),"6px 50% 50% 50%");
  assert.equal(declared(".feature-badge svg",["width"]),"23px"); assert.equal(declared(".feature-badge svg",["stroke-width"]),"1.7");
  assert.equal(declared(".feature-badge .a",["stroke"]),"var(--yellow)"); assert.equal(declared(".feature-badge .f",["fill"]),"var(--yellow)");
  assert.equal([...html.matchAll(/class="feature-badge"/g)].length,12);
});

const landing = /<div id="empty"[\s\S]*?(?=<noscript>)/.exec(html)?.[0] ?? "";

test("기능 카드 여섯 개·패널·질문과 보안 문서 약속을 유지한다",()=>{
  assert.deepEqual([...landing.matchAll(/<span class="card-title">([^<]+)<\/span>/g)].map(m=>m[1]),["졸업 체크","비교과 추천","사진으로 묻기","규정 질문","학사 일정","캠퍼스 안내"]);
  const cards=[...landing.matchAll(/<button type="button" class="card"[^>]*>[\s\S]*?<\/button>/g)]; assert.equal(cards.length,6);
  for(const [card]of cards) assert.doesNotMatch(card,/data-action/);
  assert.match(html,/data-question="달빛열람증을 누가 내주나요"/); assert.match(html,/data-question="얼룩말 풍금"/);
  assert.equal(html.split('/chat-assets/chat.css').length,2); assert.equal(html.split('/chat-assets/chat.js').length,2);
  assert.doesNotMatch(html,/\sstyle=|<style\b|<script(?![^>]*src=)/);
});

test("그림 자리는 숨긴 채 시작하며 서버가 준비하는 주소만 읽는다",()=>{
  const images=[...html.matchAll(/<img\b[^>]*>/g)].map(m=>m[0]);
  const slots=[...html.matchAll(/<\w+[^>]*\bdata-brand-slot\b[^>]*>\s*(<img\b[^>]*>)/g)];
  assert.deepEqual(slots.map(m=>m[1]),images); for(const [slot]of slots)assert.match(slot,/data-brand-slot hidden>/);
  assert.deepEqual(images.map(image=>/src="([^"]+)"/.exec(image)[1]),["/chat-assets/title-lettering.png","/chat-assets/techmo-sprite.png","/chat-assets/kumoh-signature.png","/chat-assets/kumoh-signature.png","/chat-assets/techmo-sprite.png"]);
});


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

// 실제 index.html에 적힌 소개 버튼과 패널 안 시작 버튼을 그대로 가짜 요소로 옮긴다. [이름, 동작] 순서쌍이다.
// 카드는 data-action이 없어 여기에 들지 않는다. 카드가 패널을 여닫는 동작은 feature_panels.test.mjs가 본다.
const controlsInPage = [...landing.matchAll(
  /<button type="button" class="[^"]*" data-action="([^"]+)">\s*(?:<span class="card-title">)?([^<]+)/g,
)].map(match => [match[2].trim(), match[1]]);

const chatPath = "/api/v1/chat";
const graduationPath = "/api/v1/graduation-demo?student_id=demo-d02";

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
      addEventListener() {},
      querySelector(selector) {
        if (!elements.has(selector)) {
          elements.set(selector, new FakeElement(selector));
          if (selector === "#demo-students") elements.get(selector).hidden = true;
        }
        return elements.get(selector);
      },
      querySelectorAll: selector => lists[selector] ?? [],
      createElement: tag => new FakeElement(tag),
      createTextNode: value => value,
    },
    window: { matchMedia: () => ({ matches: false }) },
    URL,
    AbortSignal: { timeout: () => undefined },
    fetch: (path, options) => path === "/api/v1/demo-students"
      ? Promise.resolve({ ok: true, json: async () => ({ students: [
        { id: "demo-d02", label: "가상 학생 D02", scenario: "졸업 요건에 가까움", is_fictional: true },
      ] }) })
      : path === "/api/v1/demo-login" ? Promise.resolve({ status: 200, json: async () => ({ student: { id: "demo-d02", label: "가상 학생 D02", scenario: "졸업 요건에 가까움", is_fictional: true } }) })
      : (fetch ?? serving(requests))(path, options),
  }, { filename: "chat.js" });

  const shown = {
    async selectStudent() {
      elements.get("#demo-login").fire("click");
      await setImmediate();
      elements.get("#student-number").value = "20990002";
      elements.get("#student-password").value = "demo-d02-pass";
      elements.get("#login-form").fire("submit");
      await setImmediate();
    },
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

test("첫 화면의 소개 버튼과 패널 안 시작 버튼은 화면에 이미 있는 기능으로만 이어진다", () => {
  assert.deepEqual(controlsInPage, [
    ["졸업 체크 시작", "graduation"],
    ["졸업 체크와 추천 보기", "graduation"],
    ["사진 선택", "photo"],
    ["질문 입력하기", "ask"],
  ]);
  // 기능을 부르는 버튼은 패널 안의 네 개뿐이다. 놓친 data-action이 없는지 개수도 맞춰 본다.
  assert.equal(html.split("data-action=").length - 1, controlsInPage.length);
  // 「테크모에게 묻기」 글자 버튼은 없앴다(#64). 그 이름은 펫 버튼의 읽기용 이름으로 한 번만 남는다.
  assert.equal(landing.includes("테크모에게 묻기"), false);
  assert.equal(html.split("테크모에게 묻기").length, 2);
  assert.equal(styles.includes("secondary"), false);
});

for (const label of ["졸업 체크 시작", "졸업 체크와 추천 보기"]) {
  test(`${label}를 연달아 눌러도 졸업 체크 요청은 하나만 나가고, 끝난 뒤에는 다시 부를 수 있다`, async () => {
    const shown = loadLanding();
    await shown.selectStudent();
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

test("「사진 선택」은 기존 사진 선택을 열고, 「질문 입력하기」는 입력창으로 초점을 옮긴다", () => {
  const shown = loadLanding();
  shown.control("사진 선택").fire("click");
  assert.equal(shown.file.clicked, 1);
  assert.equal(shown.input.focused, 0);

  shown.control("질문 입력하기").fire("click");
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
