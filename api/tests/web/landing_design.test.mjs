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
// 규칙마다 감싼 @media·@supports·@keyframes 머리말을 context로 기억한다. 예전 읽기 함수는 조건을 지워
// @supports not 안의 대체 값이나 좁은 화면 값이 기본 값을 덮어썼다.
function parse(text, context = []) {
  const found = [];
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf("{", cursor);
    if (open === -1) break;
    const header = text.slice(cursor, open).trim();
    let depth = 1;
    let close = open + 1;
    while (depth && close < text.length) {
      if (text[close] === "{") depth += 1;
      else if (text[close] === "}") depth -= 1;
      close += 1;
    }
    assert.equal(depth, 0, "CSS 중괄호 짝");
    const body = text.slice(open + 1, close - 1);
    if (/^@(media|supports|keyframes)\b/.test(header)) found.push(...parse(body, [...context, header]));
    else found.push({
      context,
      selectors: header.split(",").map(part => part.trim().replace(/\s+/g, " ")),
      declarations: body.split(";").map(line => line.trim()).filter(Boolean).map(line => {
        const colon = line.indexOf(":");
        return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
      }),
    });
    cursor = close;
  }
  return found;
}
const rules = parse(styles.replace(/\/\*[\s\S]*?\*\//g, ""));
// 기본 환경: 1280px 화면, 흐림 지원, 움직임 줄이기 꺼짐.
const desktop = { width: 1280, supports: true, motion: false };
function applies(context, env) {
  return context.every(header => {
    if (header.startsWith("@keyframes")) return false;
    if (header.startsWith("@supports not")) return !env.supports;
    if (header.startsWith("@supports")) return env.supports;
    if (header.includes("prefers-reduced-motion")) return env.motion;
    const limits = [...header.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)];
    return limits.length > 0 && limits.every(([, kind, pixels]) =>
      kind === "min" ? env.width >= Number(pixels) : env.width <= Number(pixels));
  });
}
const rootRules = rules.filter(rule => rule.context.length === 0 && rule.selectors.includes(":root"));
const variables = new Map(rootRules.flatMap(rule => rule.declarations).filter(([name]) => name.startsWith("--")));
function find(selector, names, env = {}) {
  env = { ...desktop, ...env };
  let value;
  let important = false;
  for (const rule of rules) {
    if (!rule.selectors.includes(selector) || !applies(rule.context, env)) continue;
    for (const [name, candidate] of rule.declarations) {
      // 브라우저처럼 !important 선언은 뒤의 일반 선언에 지지 않는다.
      if (!names.includes(name) || (important && !candidate.endsWith("!important"))) continue;
      value = candidate;
      important = candidate.endsWith("!important");
    }
  }
  return value;
}
function declared(selector, names, fallback, env = {}) {
  const value = find(selector, names, env) ?? (fallback ? find(fallback, names, env) : undefined);
  assert.notEqual(value, undefined, selector + " 선언 없음 " + names.join("/"));
  return value;
}

test("CSS 읽기 함수는 @supports not과 화면 너비 조건을 기본 값과 구별한다", () => {
  const sample = parse(".a { color: red; } @media (max-width: 480px) { .a { color: blue; } } @supports not (x: y) { .a { color: green; } } @keyframes k { to { color: pink; } }");
  assert.deepEqual(sample.map(rule => rule.context), [[], ["@media (max-width: 480px)"], ["@supports not (x: y)"], ["@keyframes k"]]);
  assert.equal(applies(sample[1].context, { ...desktop, width: 390 }), true);
  assert.equal(applies(sample[1].context, desktop), false);
  assert.equal(applies(sample[2].context, desktop), false);
  assert.equal(applies(sample[2].context, { ...desktop, supports: false }), true);
  assert.equal(applies(sample[3].context, desktop), false);
  // 실제 파일에서도 대체 값과 좁은 화면 값이 기본 값을 덮지 않는다.
  assert.equal(declared(".reply", ["background"]), "var(--main-bubble)");
  assert.equal(declared(".reply", ["background"], undefined, { supports: false }), "var(--glass-dense)");
  assert.equal(find(".mode-pill-label", ["display"]), undefined);
  assert.equal(declared(".mode-pill-label", ["display"], undefined, { width: 480 }), "none");
});
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

// 글자 뒤 면 → 그 면이 놓인 면. 사진은 맨 아래에 깐다. 큰 판은 위쪽 56px이 투명에서 시작하므로
// 그 띠에 걸치는 입력 안내 줄(.composer-meta)은 큰 판 없이 사진 바로 위로 계산한다.
const chatSurface = 'body[data-view="chat"] .chat';
const parents = {
  ".login-safety::before":".login-safety",
  ".composer-row":".composer", ".composer textarea":".composer-row", ".mode-pill":".composer-row",
  ".status:not(:empty)":".layout", ".site-footer":".layout",
  ".conversation-item":"#conversation-sidebar", '.conversation-item[aria-current="true"]':"#conversation-sidebar",
  "#conversation-sidebar > button":"#conversation-sidebar", "#conversation-sidebar button:hover":"#conversation-sidebar",
  "#conversation-sidebar .conversation-item button:hover":".conversation-item",
  ".conversation-note":"#conversation-sidebar", ".campus-site-links--compact":"#conversation-sidebar",
  ".choice-menu-item:hover":".choice-menu", '.choice-menu-item[aria-checked="true"]':".choice-menu",
  ".composer textarea:hover":".composer-row", ".attach-button":".composer-row", ".attach-button:hover":".composer-row",
  ".card.soon":".layout", ".fallback":".reply", ".poster-result.unconfirmed":".reply", ".graduation thead th":".graduation table", ".graduation .item th":".graduation table", ".graduation .item td":".graduation table", "[data-panel-content] > .panel-action":".feature-panel", "[data-panel-content] > .panel-action:hover":".feature-panel",
  "#login-form input":".login-card", "#login-form input:focus":".login-card", "#demo-student-list button":".login-card", "#demo-student-list button:hover":".login-card", ".login-safety":".login-card", ".login-submit":".login-card",
  ".card":".layout", "button.card:hover:not([data-restored])":".layout", ".feature-panel":".layout", ".chat":".layout", ".composer":".layout", "textarea":".composer", ".primary":".composer", ".primary:not(:disabled):hover":".composer", ".reply":".layout", ".question":".layout",
  ".reset":".masthead", ".reset:not(:disabled):hover":".masthead", ".login":".masthead", ".panel-close":".feature-panel", ".panel-close:hover":".feature-panel", ".cta":".feature-panel", ".cta:hover":".feature-panel", ".check":".reply", ".check:not(:disabled):hover":".reply", ".evidence":".reply", ".graduation table":".reply", ".error":".reply", ".badge.met":".reply", ".badge.short":".reply", ".badge.needs-check":".reply", ".reading":".reply", ".reading textarea":".reading", ".biskit .program":".reply", ".poster-result":".reply",
};
// 채팅 화면에서는 큰 판 대신 대화 영역이 말풍선·상태 줄·안내 줄 뒤의 큰 면이다.
const chatParents = { ...parents, ".reply": chatSurface, ".question": chatSurface, ".status:not(:empty)": chatSurface, ".composer-meta": chatSurface };
// 사진 위로 면을 차례로 합성한다. 사진의 가장 밝은 부분은 흰색(#FFFFFF)으로 가정한다.
function fills(selector, photo, map = parents, env = {}) {
  const backing = map[selector] ? fills(map[selector], photo, map, env) : [photo];
  const paint = colors(declared(selector,["background","background-color"], selector === ".composer textarea:hover" ? ".composer textarea" : undefined, env));
  assert.ok(paint.length,selector);
  return backing.flatMap(back => paint.map(front => blend(front,back)));
}
function checkText(pairs, map = parents, env = {}) {
  const failures = [];
  for (const photo of [[4, 20, 38], [255, 255, 255]]) {
    for (const [inkSelector, backSelector] of pairs) {
      for (const background of fills(backSelector, photo, map, env)) {
        const foreground = colors(declared(inkSelector, ["color"], undefined, env))[0];
        const ratio = contrast(blend(foreground, background), background);
        if (ratio < 4.5) failures.push(`${inkSelector} on ${backSelector} ${ratio.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(failures, []);
}

test("모든 색은 root 변수로 선언하고 남색 테마의 밝은 글자를 쓴다", () => {
  for(const rule of rules.filter(rule=>!rootRules.includes(rule))) for(const [,value] of rule.declarations) assert.doesNotMatch(value.replace(/var\(--[\w-]+\)/g,""),/#[0-9a-f]{3,8}\b|\brgba?\(/i);
  for(const [name,value] of Object.entries({"--sky":"#00A3D9","--blue":"#005B96","--navy":"#0A2540","--yellow":"#FFD100","--ink":"#eaf4fb","--card-ink":"#eef7fd","--link-ink":"#8fdcff"})) assert.equal(variables.get(name).toLowerCase(),value.toLowerCase());
});

test("남색 유리의 양 끝과 밝고 어두운 사진 양쪽에서 글자 대비가 4.5 이상이다", () => {
  checkText([
    [":root",":root"],[".masthead",".masthead"],[".reset",".reset"],[".reset:not(:disabled):hover",".reset:not(:disabled):hover"],[".login",".login"],
    [".login-card",".login-card"],[".login-help",".login-card"],["#login-form label",".login-card"],["#login-form input","#login-form input"],["#login-form input::placeholder","#login-form input"],["#login-form input::placeholder","#login-form input:focus"],["#login-error",".login-card"],[".browse-main",".login-card"],
    [".login-safety",".login-safety"],["#demo-student-list strong","#demo-student-list button"],["#demo-student-list button","#demo-student-list button"],["#demo-student-list strong","#demo-student-list button:hover"],["#demo-student-list button","#demo-student-list button:hover"],
    [".card-title",".card"],[".card-text",".card"],[".card-title","button.card:hover:not([data-restored])"],[".card-text","button.card:hover:not([data-restored])"],[".panel-title",".feature-panel"],[".panel-text",".feature-panel"],[".panel-close",".panel-close"],[".panel-close:hover",".panel-close:hover"],[".status",".status:not(:empty)"],
    [".reply",".reply"],[".evidence h3",".evidence"],[".evidence .date",".evidence"],[".evidence .source-link",".evidence"],[".graduation caption",".graduation table"],[".graduation .source",".graduation table"],[".graduation .shortfall",".graduation table"],
    [".badge.met",".badge.met"],[".badge.short",".badge.short"],[".badge.needs-check",".badge.needs-check"],[".error",".error"],[".retry",".error"],
    [".reading textarea",".reading textarea"],[".reading textarea::placeholder",".reading textarea"],[".source-link",".reply"],[".source-link",".biskit .program"],[".source-link",".feature-panel"],[".source-link",".poster-result"],
    [".composer textarea",".composer textarea"],[".composer textarea::placeholder",".composer textarea"],[".composer p",".composer-meta"],[".attach-clear",".composer-meta"],
    [".conversation-menu",".conversation-menu"],[".conversation-menu-item.danger",".conversation-menu"],[".confirm-box",".confirm-box"],[".confirm-actions .confirm-delete",".confirm-actions .confirm-delete"],
    [".campus-site-link", ".site-footer"], [".campus-site-link", "#login-site-footer"], [".campus-site-link", ".campus-site-links--compact"],
    [".site-footer .campus-site-label", ".site-footer"], [".site-footer .campus-site-label", "#login-site-footer"],
    [".site-footer p", ".site-footer"], [".site-footer p", "#login-site-footer"],
    [".login-submit",".login-submit"],[".primary",".primary"],[".primary:not(:disabled):hover",".primary:not(:disabled):hover"],[".pet-says",".pet-says"],["#login-pet-line","#login-pet-line"],
  ]);
});

test("테두리와 초점은 유리 안쪽 바탕과 3 이상이고 밝은 입력창은 안쪽 경계를 보강한다", () => {
  const selectors=[".login-card",".card","button.card:hover:not([data-restored])",".feature-panel","#demo-student-list button","#demo-student-list button:hover","#login-form input","#login-form input:focus",".reset",".login",".panel-close",".login-submit",".primary",".primary:not(:disabled):hover",".login-safety",".attach-button","textarea",".composer textarea",".composer textarea:hover",".mode-pill",".choice-menu"];
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
  }
  for(const photo of [[4,20,38],[255,255,255]]) for(const surface of [".login-card",".masthead",".choice-menu"]) for(const back of fills(surface,photo)) assert.ok(contrast(blend(focus,back),back)>=3,surface);
  // 메인 화면은 반투명 판 위에서 흰 초점 테두리를 쓴다. 기존 하늘색은 흰 사진 가정에서 판(.50)과 약 2.1:1이다.
  const mainFocus=colors(declared("#main-screen :focus-visible",["outline-color"]))[0];
  for(const photo of [[4,20,38],[255,255,255]]) {
    for(const surface of [".layout",".card",".reply",".masthead",chatSurface,"#conversation-sidebar"]) for(const back of fills(surface,photo)) {
      const ratio=contrast(blend(mainFocus,back),back);
      if(ratio<3) failures.push("main focus on "+surface+" "+ratio.toFixed(2));
    }
  }
  assert.equal(declared("#main-screen .composer-row :focus-visible",["outline-color"]),"var(--blue)");
  assert.match(declared(".composer-row",["box-shadow"]),/inset 0 0 0 1px var\(--blue\)/);
  for(const back of fills(".composer-row",[255,255,255])) assert.ok(contrast(colors("var(--blue)")[0].slice(0,3),back)>=3);
  assert.deepEqual(failures,[]);
});

test("글이 많은 영역과 예시 질문은 밝고 어두운 사진에서 4.5 이상이다", () => {
  checkText([
    [".question", ".question"], [".fallback", ".fallback"],
    [".evidence", ".evidence"], [".evidence .source-link", ".evidence"],
    [".graduation thead th", ".graduation thead th"],
    [".graduation .item th", ".graduation .item th"], [".graduation .item td", ".graduation .item td"],
    [".graduation caption", ".graduation table"], [".graduation .notice", ".graduation table"],
    [".biskit .program", ".biskit .program"], [".biskit .mileage", ".biskit .program"],
    [".biskit .hint", ".biskit .program"],
    [".badge.met", ".biskit .program"], [".badge.short", ".biskit .program"], [".badge.needs-check", ".biskit .program"],
    [".feature-panel", ".feature-panel"], [".panel-text", ".feature-panel"], [".source-link", ".feature-panel"],
    ["[data-panel-content] > .panel-action", "[data-panel-content] > .panel-action"],
    ["[data-panel-content] > .panel-action:hover", "[data-panel-content] > .panel-action:hover"],
    [".reading", ".reading"], [".reading .field span", ".reading"], [".reading .source", ".reading"],
    [".reading .reading-note", ".reading"], [".check", ".check"],
    [".poster-result", ".poster-result.unconfirmed"], [".poster-result .hint", ".poster-result.unconfirmed"],
    [".card-title", ".card.soon"], [".card-text", ".card.soon"],
    ["textarea", "textarea"], ["textarea::placeholder", "textarea"],
    [".composer textarea", ".composer textarea:hover"], [".composer textarea::placeholder", ".composer textarea:hover"],
    [".composer .composer-hint", ".composer-meta"], [".composer .photo-note", ".composer-meta"],
    [".attach-button", ".attach-button"], [".attach-button", ".attach-button:hover"],
  ]);
});

test("내용 구분선과 상태색은 지정 변수를 사용하고 글 상자는 어둡다", () => {
  for (const [name, value] of Object.entries({
    "--content-line": "rgba(140,220,255,.28)", "--good": "#7be0a6", "--bad": "#ffb4a8",
    "--warn": "#ffd97a", "--muted": "rgba(214,232,245,.82)",
  })) assert.equal(variables.get(name), value);
  for (const selector of [".evidence", ".graduation th", ".graduation td"]) {
    assert.equal(declared(selector, ["border-color"]), "var(--content-line)");
  }
  const dark = color => color[0] <= 8 && color[1] <= 28 && color[2] <= 50;
  // 말풍선·카드: .60~.68. 큰 판(.50) 위에 놓여 합성 불투명도는 약 .83이다.
  for (const selector of [".reply", ".question", ".card", ".feature-panel", ".site-footer", ".status:not(:empty)"]) {
    for (const color of colors(declared(selector, ["background", "background-color"]))) {
      assert.ok(dark(color) && color[3] >= .60 && color[3] <= .68, selector);
    }
  }
  // 말풍선 안의 상자는 옅은 덧판만 깐다. 진하게 겹치면 말풍선 안이 다시 벽이 된다.
  for (const selector of [".evidence", ".fallback", ".reading", ".biskit .program", ".poster-result", "[data-panel-content] > .panel-action", ".graduation thead th", ".graduation .item td"]) {
    for (const color of colors(declared(selector, ["background", "background-color"]))) {
      assert.ok(dark(color) && color[3] <= .35, selector);
    }
  }
  // 작은 상태 상자와 입력칸, 사진 바로 위의 안내 줄은 진한 면을 유지한다.
  for (const selector of [".error", ".poster-result.unconfirmed", ".card.soon", "textarea", ".pet-says", ".composer-meta"]) {
    for (const color of colors(declared(selector, ["background", "background-color"]))) {
      assert.ok(dark(color) && color[3] >= .80, selector);
    }
  }
});

test("큰 면은 .45~.55에 blur(16px) saturate(1.3), 말풍선·카드는 .60~.68에 blur(10px)이고 -webkit- 접두사를 함께 적는다", () => {
  const alpha = name => colors(`var(${name})`)[0][3];
  assert.ok(alpha("--main-surface") >= .45 && alpha("--main-surface") <= .55);
  for (const name of ["--main-bubble", "--main-bubble-hover", "--main-bubble-active"]) assert.ok(alpha(name) >= .60 && alpha(name) <= .68, name);
  const big = "blur(16px) saturate(1.3)";
  for (const selector of [".layout::before", "#conversation-sidebar", chatSurface]) {
    assert.equal(declared(selector, ["backdrop-filter"]), big, selector);
    assert.equal(declared(selector, ["-webkit-backdrop-filter"]), big, selector);
  }
  for (const selector of [".reply", ".question", ".card", ".feature-panel"]) {
    assert.equal(declared(selector, ["background"]), "var(--main-bubble)", selector);
    assert.equal(declared(selector, ["backdrop-filter"]), "blur(10px)", selector);
    assert.equal(declared(selector, ["-webkit-backdrop-filter"]), "blur(10px)", selector);
  }
  // 흐림 층은 판 뒤에 깔고 판과 같은 56px 경계에서 시작한다.
  assert.equal(declared(".layout::before", ["z-index"]), "-1");
  assert.equal(declared(".layout::before", ["inset"]), "0");
  assert.equal(declared(".layout::before", ["mask-image"]), "linear-gradient(180deg, transparent, var(--white) 56px)");
  assert.equal(declared(".layout::before", ["-webkit-mask-image"]), "linear-gradient(180deg, transparent, var(--white) 56px)");
  assert.equal(declared(".layout", ["position"]), "relative");
});

test("큰 면은 한 지점에 한 장만 깔린다: 첫 화면은 판, 채팅 화면은 목록과 대화 영역", () => {
  const users = rules.filter(rule => applies(rule.context, desktop) || applies(rule.context, { ...desktop, width: 390 }))
    .filter(rule => rule.declarations.some(([name, value]) => ["background", "background-color"].includes(name) && value.includes("--main-surface")))
    .flatMap(rule => rule.selectors);
  assert.deepEqual([...new Set(users)].sort(), ["#conversation-sidebar", ".layout", chatSurface].sort());
  // 첫 화면: 대화 영역은 투명이고 목록은 숨긴 채 시작한다.
  assert.equal(declared(".chat", ["background"]), "transparent");
  assert.match(html, /<aside class="conversation-sidebar" id="conversation-sidebar"[^>]*\bhidden>/);
  // 채팅 화면: 판과 흐림 층을 비워 목록·대화 영역과 겹치지 않는다.
  for (const width of [1280, 960, 390]) {
    assert.equal(declared('body[data-view="chat"] .layout', ["background"], undefined, { width }), "transparent");
    assert.equal(declared('body[data-view="chat"] .layout::before', ["display"], undefined, { width }), "none");
  }
  // 판 자체에는 흐림을 주지 않는다. 주면 안쪽 고정 서랍과 가림막의 위치 기준이 판으로 바뀐다.
  assert.equal(declared(".layout", ["backdrop-filter"]), "none");
  assert.equal(find(".layout", ["-webkit-backdrop-filter"]), undefined);
  // 합성 근거: 큰 면 두 장(.50)이 겹치면 .75가 되어 사진이 다시 가려진다.
  assert.equal(1 - (1 - .5) * (1 - .5), .75);
});

test("흰 사진 가정에서 채팅 화면·대화 목록·답변 모드 메뉴의 글자도 4.5 이상이다", () => {
  // 근거 수치: 남색 .50 면 위의 흰 글자는 흰 사진 가정에서 약 3.3:1이라 글자를 바로 올리지 않는다.
  const navyHalf = blend([8, 28, 50, .5], [255, 255, 255]);
  assert.ok(contrast([255, 255, 255], navyHalf) < 4.5);
  assert.ok(contrast([255, 255, 255], blend([8, 28, 50, .68], [255, 255, 255])) > 5.5);
  checkText([
    [".reply", ".reply"], [".question", ".question"], [".status", ".status:not(:empty)"],
    [".evidence .date", ".evidence"], [".composer .composer-hint", ".composer-meta"], [".composer p", ".composer-meta"],
  ], chatParents);
  checkText([
    ["#conversation-sidebar button", ".conversation-item"], ["#conversation-sidebar button", '.conversation-item[aria-current="true"]'],
    ["#conversation-sidebar button", "#conversation-sidebar > button"], ["#conversation-sidebar button", "#conversation-sidebar button:hover"],
    ["#conversation-sidebar button", "#conversation-sidebar .conversation-item button:hover"],
    [".conversation-time", ".conversation-item"], [".conversation-time", '.conversation-item[aria-current="true"]'],
    [".conversation-time", "#conversation-sidebar .conversation-item button:hover"],
    [".conversation-note", ".conversation-note"], [".campus-site-link", ".campus-site-links--compact"],
    [".choice-menu-title", ".choice-menu"], [".choice-menu-name", ".choice-menu"], [".choice-menu-desc", ".choice-menu"],
    [".choice-menu-check", ".choice-menu"], [".choice-menu-name", ".choice-menu-item:hover"], [".choice-menu-desc", ".choice-menu-item:hover"],
    [".choice-menu-name", '.choice-menu-item[aria-checked="true"]'], [".choice-menu-desc", '.choice-menu-item[aria-checked="true"]'],
    [".choice-menu-check", '.choice-menu-item[aria-checked="true"]'],
    [".mode-pill", ".mode-pill"], [".mode-pill", ".mode-pill:hover"],
  ]);
  // 깊이 모드 버튼은 테두리만 그라데이션이고 글자 뒤는 흰색 한 겹이다.
  assert.match(declared('.mode-pill[data-mode="deep"]', ["background"]), /^linear-gradient\(var\(--white\), var\(--white\)\) padding-box, linear-gradient\(/);
  assert.ok(contrast(colors(declared(".mode-pill", ["color"]))[0].slice(0, 3), [255, 255, 255]) >= 4.5);
});

test("흐림을 지원하지 않으면 지금까지의 진한 값을 그대로 쓴다", () => {
  assert.match(styles, /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\) \{/);
  const old = { supports: false };
  const panel = "linear-gradient(180deg, transparent, var(--panel-surface) 56px)";
  assert.equal(declared(".layout", ["background"], undefined, old), panel);
  assert.equal(declared('body[data-view="chat"] .layout', ["background"], undefined, old), panel);
  assert.equal(declared(".layout::before", ["display"], undefined, old), "none");
  assert.equal(declared(chatSurface, ["background"], undefined, old), "transparent");
  for (const selector of ["#conversation-sidebar", ".reply", ".question", ".card", ".feature-panel", ".composer-meta"]) {
    assert.equal(declared(selector, ["background"], undefined, old), "var(--glass-dense)", selector);
  }
  assert.equal(declared("button.card:hover:not([data-restored])", ["background"], undefined, old), "var(--feature-hover)");
  assert.equal(declared(".site-footer", ["background"], undefined, old), "var(--panel-surface)");
  checkText([[".reply", ".reply"], [".card-text", ".card"], [".status", ".status:not(:empty)"], [".composer .composer-hint", ".composer-meta"]], parents, old);
});

test("로그인 화면의 유리 값과 흐림은 그대로다", () => {
  for (const [name, value] of Object.entries({
    "--glass-card": "rgba(12,44,78,.90)", "--glass-band": "rgba(8,30,54,.72)", "--glass-panel": "rgba(10,36,64,.84)",
    "--glass-feature": "rgba(255,255,255,.10)", "--glass-composer": "rgba(255,255,255,.94)", "--glass-account": "rgba(255,255,255,.08)",
    "--glass-dense": "rgba(8,28,50,.82)", "--glass-pill": "rgba(255,255,255,.14)", "--glass-edge": "rgba(255,255,255,.28)",
    "--card-end": "rgba(6,24,44,.82)", "--panel-surface": "#0a2440",
  })) assert.equal(variables.get(name), value, name);
  assert.equal(declared(".login-card", ["background"]), "linear-gradient(160deg, var(--glass-card), var(--card-end))");
  assert.equal(declared("#login-site-footer", ["background"]), "var(--glass-dense)");
  assert.equal(find(".login-card", ["-webkit-backdrop-filter"]), undefined);
  for (const width of [1280, 390]) {
    assert.equal(declared(".login-card", ["backdrop-filter"], undefined, { width }), "blur(1.5px) saturate(1.2)");
    assert.equal(declared(".masthead", ["backdrop-filter"], undefined, { width }), "blur(1.5px) saturate(1.2)");
  }
});

test("답변 모드 버튼과 메뉴: 480px 이하 아이콘만, 메뉴 너비·좌표 변수·겹침 순서·체크 표시", () => {
  assert.equal(declared(".mode-pill", ["border-radius"]), "999px");
  assert.equal(declared(".mode-pill", ["min-height"]), "44px");
  assert.equal(find(".mode-pill-label", ["display"]), undefined);
  for (const width of [480, 390, 320]) {
    assert.equal(declared(".mode-pill-label", ["display"], undefined, { width }), "none", `${width}px`);
    assert.equal(declared(".choice-menu", ["width"], undefined, { width }), "min(320px, calc(100vw - 32px))");
  }
  assert.equal(find(".mode-pill-label", ["display"], { width: 481 }), undefined);
  // 아이콘은 data-mode에 맞는 것 하나만 보인다.
  assert.equal(declared('.mode-pill:not([data-mode="deep"]) .mode-icon[data-icon="deep"]', ["display"]), "none");
  assert.equal(declared('.mode-pill[data-mode="deep"] .mode-icon[data-icon="fast"]', ["display"]), "none");
  // 메뉴는 화면 좌표 변수로만 움직이고, 서랍(11)·테크모(20) 위, 삭제 확인 창 아래에 뜬다.
  assert.equal(declared(".choice-menu", ["position"]), "fixed");
  assert.equal(declared(".choice-menu", ["left"]), "var(--choice-menu-x, 16px)");
  assert.equal(declared(".choice-menu", ["top"]), "var(--choice-menu-y, 16px)");
  assert.match(declared(".choice-menu", ["max-height"]), /100dvh/);
  const layer = selector => Number(declared(selector, ["z-index"]));
  assert.ok(layer(".choice-menu") > layer('.pet-dock[data-placed="true"]') && layer(".choice-menu") > 11);
  assert.ok(layer(".choice-menu") < layer(".confirm-scrim"));
  assert.equal(declared(".choice-menu-check", ["visibility"]), "hidden");
  assert.equal(declared('.choice-menu-item[aria-checked="true"] .choice-menu-check', ["visibility"]), "visible");
  assert.match(declared(".choice-menu-item:focus-visible", ["outline"]), /^2px solid var\(--focus-ink\)$/);
  assert.equal(declared(".choice-menu-item", ["min-height"]), "52px");
});

test("깊이 모드: 고정 테두리는 상태만으로 그리고, 효과는 효과 클래스에만 걸며 움직임 줄이기에서 모두 끈다", () => {
  assert.equal(variables.get("--sky"), "#00A3D9");
  assert.equal(variables.get("--deep-gold"), "#F7C500");
  const gradient = /linear-gradient\(90deg, var\(--sky\), var\(--deep-violet\), var\(--deep-gold\)/;
  assert.match(declared('.mode-pill[data-mode="deep"]', ["background"]), gradient);
  assert.match(declared(".composer-row.is-deep::before", ["background"]), gradient);
  assert.equal(declared(".composer-row.is-deep::before", ["padding"]), "1px");
  for (const selector of ['.mode-pill[data-mode="deep"]', ".composer-row.is-deep", ".composer-row.is-deep::before", ".mode-pill", ".composer-row"]) {
    assert.equal(find(selector, ["animation"]), undefined, selector);
  }
  // 움직임을 거는 규칙 가운데 답변 모드와 생각 칸에 관한 것은 모두 효과 클래스를 거친다.
  const effects = rules.filter(rule => !rule.context.some(header => header.includes("prefers-reduced-motion")))
    .filter(rule => rule.declarations.some(([name, value]) => name === "animation" && value !== "none"))
    .flatMap(rule => rule.selectors)
    .filter(selector => /mode-|composer-row|thinking|choice-menu/.test(selector));
  assert.deepEqual(effects, [
    ".composer-row.is-deep-enter::after", '.mode-pill.is-bursting .mode-icon[data-icon="deep"]', ".mode-spark",
    ".mode-pill.is-flowing::after", ".mode-pill.is-flowing::before", ".thinking.is-waiting > summary",
  ]);
  const seconds = selector => Number.parseFloat(/(\d*\.?\d+)s/.exec(declared(selector, ["animation"]))[1]);
  assert.equal(seconds(".composer-row.is-deep-enter::after"), .9);
  assert.equal(seconds('.mode-pill.is-bursting .mode-icon[data-icon="deep"]'), .7);
  assert.ok(seconds(".mode-spark") <= .7);
  assert.equal(seconds(".mode-pill.is-flowing::before"), 3);
  // 별 조각은 8방향으로 퍼진다.
  assert.equal(rules.filter(rule => rule.selectors.some(selector => /^\.mode-spark:nth-child\(\d of \.mode-spark\)$/.test(selector))).length, 7);
  // 움직임 줄이기 설정에서는 효과의 움직임을 끄고 별·빛줄기·감싸는 빛은 그리지 않는다.
  const calm = { motion: true };
  for (const selector of effects) assert.equal(declared(selector, ["animation"], undefined, calm), "none !important", selector);
  for (const selector of [".mode-spark", ".mode-pill.is-flowing::after", ".mode-pill.is-flowing::before", ".composer-row.is-deep-enter::after"]) {
    assert.equal(declared(selector, ["display"], undefined, calm), "none", selector);
  }
  assert.match(declared(".composer-row.is-deep::before", ["background"], undefined, calm), gradient);
  // 버튼 자신의 배경은 효과 클래스와 움직임 설정에 상관없이 고정 표시 하나로 정해진다.
  // 실제 버튼처럼 상태 클래스를 조합해 그 요소에 걸리는 규칙을 모두 모아 계산한다. 예전 결함 두 가지를 함께 본다.
  //  · 흐름 효과 없이 깊이 모드만 켠 버튼에서 300% 배경 때문에 노랑이 잘림
  //  · 흐름 효과가 붙은 채 움직임 줄이기를 켜면 애니메이션만 멈추고 300% 배경이 남아 노랑이 잘림
  const pillParts = selector => {
    const match = /^\.mode-pill((?:\.[\w-]+|\[[^\]]+\])*)$/.exec(selector);
    return match ? [...match[1].matchAll(/\.[\w-]+|\[[^\]]+\]/g)].map(([part]) => part) : null;
  };
  const pillBackground = (state, env) => {
    const result = {};
    for (const rule of rules) {
      if (!applies(rule.context, { ...desktop, ...env })) continue;
      if (!rule.selectors.some(selector => pillParts(selector)?.every(part => state.includes(part)))) continue;
      for (const [name, value] of rule.declarations) if (name.startsWith("background")) result[name] = value;
    }
    return result;
  };
  const fixedRing = /linear-gradient\(90deg, var\(--sky\), var\(--deep-violet\), var\(--deep-gold\)\) 0 0 \/ 100% 100% border-box$/;
  for (const state of [['[data-mode="deep"]'], ['[data-mode="deep"]', ".is-flowing"], ['[data-mode="deep"]', ".is-flowing", ".is-bursting"]]) {
    for (const env of [{ motion: false }, { motion: true }]) {
      const paint = pillBackground(state, env);
      assert.deepEqual(Object.keys(paint), ["background"], `${state.join("")} ${env.motion}`);
      assert.match(paint.background, fixedRing, `${state.join("")} ${env.motion}`);
      assert.doesNotMatch(paint.background, /300%/);
    }
  }
  // 흐르는 고리는 별도 층에서만 3배로 늘려 옮기고, 테두리 자리만 칠한다.
  assert.match(declared(".mode-pill.is-flowing::after", ["background"]), /\/ 300% 100%$/);
  assert.equal(declared(".mode-pill.is-flowing::after", ["mask-composite"]), "exclude");
  assert.equal(declared(".mode-pill.is-flowing::after", ["pointer-events"]), "none");
  // 생각 중 글자 빛은 글자를 배경으로 칠할 수 있는 브라우저에서만 켠다.
  assert.equal(declared(".thinking.is-waiting > summary", ["background-clip"]), "text");
  assert.equal(declared(".thinking.is-waiting > summary", ["-webkit-background-clip"]), "text");
  assert.equal(find(".thinking.is-waiting > summary", ["color"], { supports: false }), undefined);
});

test("전체 CSS에서 남은 밝은 바탕은 입력 줄과 상태 표시이며 글자 대비를 확인한다", () => {
  const backgrounds = new Map();
  for (const rule of rules) {
    // 글자 모양으로 오려 칠하는 배경(background-clip: text)은 면이 아니라 글자색이다.
    if (rule.declarations.some(([name, value]) => name.endsWith("background-clip") && value === "text")) continue;
    for (const selector of rule.selectors) {
      for (const [name, value] of rule.declarations) {
        if (["background", "background-color"].includes(name)) backgrounds.set(selector, value);
      }
    }
  }
  const lightSurfaces = [...backgrounds].filter(([, value]) =>
    colors(value).some(color => color[3] >= .8 && luminance(color.slice(0, 3)) > .5)
  ).map(([selector]) => selector).sort();
  assert.deepEqual(lightSurfaces, [
    ".attach-button:hover", ".composer textarea", ".composer-row",
    ".composer-row.is-deep-enter::after", ".composer-row.is-deep::before", ".conversation-unread", ".intro-badge::before",
    ".login-safety::before", ".mode-pill.is-flowing::after", ".mode-pill:hover", '.mode-pill[data-mode="deep"]', ".mode-spark", ".pet-dots span", '[data-campus-step][data-current="true"]',
  ]);
  checkText([
    [".composer-row", ".composer-row"], [".composer textarea", ".composer textarea"],
    [".composer textarea::placeholder", ".composer textarea"], [".attach-button", ".attach-button:hover"],
    [".login-safety::before", ".login-safety::before"], [".mode-pill", ".mode-pill:hover"],
  ]);
  // 테두리 고리·감싸는 빛·별 조각은 글자가 없는 장식이고 안쪽을 가린 채 테두리만 칠한다.
  for (const selector of [".composer-row.is-deep::before", ".composer-row.is-deep-enter::after"]) {
    assert.equal(declared(selector, ["pointer-events"]), "none");
    assert.equal(declared(selector, ["mask-composite"]), "exclude");
    assert.equal(declared(selector, ["-webkit-mask-composite"]), "xor");
  }
  assert.equal(declared(".mode-spark", ["pointer-events"]), "none");
});

test("로그인과 보내기 gradient 양 끝은 흰 글자 대비 4.5 이상이다", () => {
  for(const selector of [".login-submit",".primary",".primary:not(:disabled):hover"]) {
    assert.match(declared(selector,["background"]),/linear-gradient\(135deg,var\(--control-start\),var\(--control-end\)\)/);
    for(const color of colors(declared(selector,["background"]))) assert.ok(contrast([255,255,255],color.slice(0,3))>=4.5,selector);
  }
});

test("로그인 유리 흐림은 1.5px 이하이고 큰 판 자체에는 흐림을 걸지 않으며 로고는 여백 없이 띠 위에 놓는다", () => {
  assert.equal(declared(".login-card",["backdrop-filter"]),"blur(1.5px) saturate(1.2)");
  assert.equal(declared(".masthead",["backdrop-filter"]),"blur(1.5px) saturate(1.2)");
  assert.equal(declared(".layout",["backdrop-filter"]),"none");
  assert.equal(declared(".brand-logo",["padding"]),"0");
  assert.equal(declared(".login-brand",["border-radius"]),"0");
  assert.equal(declared(".chat",["background"]),"transparent");
});

test("두 로고는 받침과 테두리 없이 밝은 그림을 표시한다", () => {
  for (const selector of [".brand-logo", ".login-brand"]) {
    assert.ok(["block", "inline-block"].includes(declared(selector, ["display"])), selector);
    assert.equal(declared(selector, ["padding"]), "0");
    assert.equal(declared(selector, ["background"]), "transparent");
    assert.equal(declared(selector, ["border"]), "0");
    assert.equal(declared(selector, ["box-shadow"]), "none");
  }
});

test("확정 제목 그림과 치수선·눈금·대체 제목을 제공하고 옛 그림·알약은 요청하지 않는다", () => {
  assert.match(html,/<img[^>]*src="\/chat-assets\/title-lettering.png"[^>]*alt="졸업까지, 테크모와 함께"/);
  assert.doesNotMatch(html+styles+script,/calligraphy-title|calligraphy-fallback|EastSeaDokdo|feature-pills/);
  assert.match(html,/class="drawing-dimension"[^>]*aria-hidden="true"/);
  assert.match(html,/KIT · ACADEMIC GUIDE  ⟵ 2026 ⟶/);
  assert.match(html,/class="title-ticks"[^>]*aria-hidden="true"/);
  assert.match(html,/<h1 class="title-fallback">졸업까지,<span><em>테크모<\/em>와 함께<\/span><\/h1>/);
  assert.equal(declared(".title-fallback span",["padding-left"]),"0");
  assert.equal(declared(".title-lettering",["width"],undefined,{width:390}),"78vw");
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
  assert.equal(html.split('/chat-assets/chat.css').length,2); assert.equal(html.split('/chat-assets/chat.js').length,2);
  assert.doesNotMatch(html,/\sstyle=|<style\b|<script(?![^>]*src=)/);
});

test("그림 자리는 숨긴 채 시작하며 서버가 준비하는 주소만 읽는다",()=>{
  const images=[...html.matchAll(/<img\b[^>]*>/g)].map(m=>m[0]);
  const slots=[...html.matchAll(/<\w+[^>]*\bdata-brand-slot\b[^>]*>\s*(<img\b[^>]*>)/g)];
  assert.deepEqual(slots.map(m=>m[1]),images); for(const [slot]of slots)assert.match(slot,/data-brand-slot hidden>/);
  const allowed = new Set(["/chat-assets/title-lettering.png", "/chat-assets/main-lettering.png", "/chat-assets/techmo-sprite.png", "/chat-assets/kumoh-signature.png", "/chat-assets/kumoh-signature-light.png"]);
  for (const image of images) assert.ok(allowed.has(/src="([^"]+)"/.exec(image)[1]));
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
  assert.deepEqual(shown.requests, ["/api/v1/chat/stream", chatPath]);
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
  // 「테크모에게 묻기」 글자 버튼은 없앴다(#64).
  assert.equal(landing.includes("테크모에게 묻기"), false);
  // 펫 이름은 서버 쪽 테스트에서 확인한다.
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

test("대화 요청 중에도 홈 기능의 입력 초점과 사진 선택은 사용할 수 있다", async () => {
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
  assert.deepEqual(requests, ["/api/v1/chat/stream"]);
  assert.equal(shown.file.clicked, 1);
  assert.equal(shown.input.focused, 3);

  release();
  await setImmediate();
  assert.deepEqual(requests, ["/api/v1/chat/stream", chatPath]);
});
