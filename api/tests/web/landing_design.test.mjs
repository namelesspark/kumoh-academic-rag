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
// 기본 환경: 1280px 화면, 흐림 지원, 움직임 줄이기 꺼짐, 테마 속성 없음, 시스템 라이트.
// theme은 html의 data-theme 값이다("light"·"dark", 없으면 undefined). scheme은 시스템 설정(prefers-color-scheme)이다.
const desktop = { width: 1280, supports: true, motion: false, theme: undefined, scheme: "light" };
function applies(context, env) {
  return context.every(header => {
    if (header.startsWith("@keyframes")) return false;
    if (header.startsWith("@supports not")) return !env.supports;
    if (header.startsWith("@supports")) return env.supports;
    if (header.includes("prefers-reduced-motion")) return env.motion;
    if (header.includes("prefers-color-scheme: dark")) return env.scheme === "dark";
    const limits = [...header.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)];
    return limits.length > 0 && limits.every(([, kind, pixels]) =>
      kind === "min" ? env.width >= Number(pixels) : env.width <= Number(pixels));
  });
}
// 색 이름표는 세 블록에 있다. 라이트 기본(:root), 직접 고른 다크(:root[data-theme="dark"]),
// 속성이 없을 때의 시스템 다크(@media (prefers-color-scheme: dark) 안 :root:not([data-theme])).
const rootRules = rules.filter(rule => rule.context.length === 0 && rule.selectors.includes(":root"));
const darkAttrRules = rules.filter(rule => rule.context.length === 0 && rule.selectors.includes(':root[data-theme="dark"]'));
const darkSystemRules = rules.filter(rule => rule.context.length === 1 && rule.context[0].includes("prefers-color-scheme: dark")
  && rule.selectors.includes(":root:not([data-theme])"));
const themeRules = [...rootRules, ...darkAttrRules, ...darkSystemRules];
const customProperties = list => list.flatMap(rule => rule.declarations).filter(([name]) => name.startsWith("--"));
const variables = new Map(customProperties(rootRules));
const darkAttrVariables = new Map([...variables, ...customProperties(darkAttrRules)]);
const darkSystemVariables = new Map([...variables, ...customProperties(darkSystemRules)]);
const isDark = env => env.theme === "dark" || (env.theme === undefined && env.scheme === "dark");
function variablesFor(env = {}) {
  env = { ...desktop, ...env };
  if (env.theme === "dark") return darkAttrVariables;
  if (env.theme === undefined && env.scheme === "dark") return darkSystemVariables;
  return variables;
}
// 대비 검사를 돌리는 테마 네 가지. 직접 고른 라이트는 시스템이 다크여도 라이트다.
const themes = [
  { theme: undefined, scheme: "light" }, { theme: "light", scheme: "dark" },
  { theme: "dark", scheme: "light" }, { theme: undefined, scheme: "dark" },
];
const themeName = env => env.theme === "dark" ? "dark" : isDark(env) ? "system-dark" : env.theme === "light" ? "light" : "system-light";
const lightEnv = themes[0];
const darkEnv = themes[2];
const systemDarkEnv = themes[3];
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
function resolve(value, env = {}) {
  const map = variablesFor(env);
  for (let i = 0; i < 8 && /var\(/.test(value); i++) {
    value = value.replace(/var\((--[\w-]+)\)/g, (_, name) => {
      assert.ok(map.has(name), name);
      return map.get(name);
    });
  }
  return value;
}
function colors(value, env = {}) {
  value = resolve(value, env);
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
  const paint = colors(declared(selector,["background","background-color"], selector === ".composer textarea:hover" ? ".composer textarea" : undefined, env), env);
  assert.ok(paint.length,selector);
  return backing.flatMap(back => paint.map(front => blend(front,back)));
}
// 테마를 정하지 않으면 네 테마를 모두 계산한다. 흐림 미지원·움직임 줄이기 같은 다른 조건은 env로 함께 넘긴다.
const looks = env => "scheme" in env ? [env] : themes.map(look => ({ ...env, ...look }));
function checkText(pairs, map = parents, env = {}) {
  const failures = [];
  for (const look of looks(env)) {
    for (const photo of [[4, 20, 38], [255, 255, 255]]) {
      for (const [inkSelector, backSelector] of pairs) {
        for (const background of fills(backSelector, photo, map, look)) {
          const foreground = colors(declared(inkSelector, ["color"], undefined, look), look)[0];
          const ratio = contrast(blend(foreground, background), background);
          if (ratio < 4.5) failures.push(`${themeName(look)} ${inkSelector} on ${backSelector} ${ratio.toFixed(2)}`);
        }
      }
    }
  }
  assert.deepEqual(failures, []);
}

test("CSS 읽기 함수는 시스템 다크 조건과 테마 속성을 구별한다", () => {
  assert.equal(applies(["@media (prefers-color-scheme: dark)"], { ...desktop, scheme: "dark" }), true);
  assert.equal(applies(["@media (prefers-color-scheme: dark)"], desktop), false);
  assert.equal(isDark({ theme: "light", scheme: "dark" }), false);
  assert.equal(isDark({ theme: "dark", scheme: "light" }), true);
  assert.equal(isDark({ theme: undefined, scheme: "dark" }), true);
  assert.equal(variablesFor({ theme: "light", scheme: "dark" }), variables);
  assert.equal(variablesFor(systemDarkEnv), darkSystemVariables);
  assert.equal(resolve("var(--ink)"), "#0A2540");
  assert.equal(resolve("var(--ink)", darkEnv), "#E8EEF6");
  assert.equal(resolve("var(--ink)", systemDarkEnv), "#E8EEF6");
});

test("모든 색은 세 이름표 블록에만 선언하고, 라이트·다크 이름표는 피드백 값과 같다", () => {
  for (const rule of rules.filter(rule => !themeRules.includes(rule))) for (const [, value] of rule.declarations) assert.doesNotMatch(value.replace(/var\(--[\w-]+\)/g, ""), /#[0-9a-f]{3,8}\b|\brgba?\(/i);
  // :root는 색 블록 말고도 배치 변수(--pet-reserve) 블록이 하나 더 있다. 그 블록에는 색이 없다.
  assert.equal(rootRules.length, 2);
  assert.ok(rootRules[1].declarations.every(([name]) => ["--pet-reserve", "--chat-header-height"].includes(name)));
  assert.equal(darkAttrRules.length, 1);
  assert.equal(darkSystemRules.length, 1);
  const light = { "--bg": "#F5F8FC", "--surface": "#FFFFFF", "--text": "#0A2540", "--text-muted": "#4A5D75", "--accent": "#005B96",
    "--sky-text": "#0071A4", "--sky": "#00A3D9", "--yellow": "#FFD100", "--coral": "#FF7A59", "--success": "#0F7A43", "--warning": "#9A5B00", "--danger": "#C62F2F" };
  const dark = { "--bg": "#0B1626", "--surface": "#13233A", "--raised": "#1A2B44", "--text": "#E8EEF6", "--text-muted": "#9DB0C7", "--accent": "#3DB8E8",
    "--yellow": "#FFD100", "--coral": "#FF8F73", "--success": "#4ADE80", "--warning": "#FBBF24", "--danger": "#F87171" };
  for (const [name, value] of Object.entries(light)) assert.equal(variables.get(name), value, `light ${name}`);
  for (const map of [darkAttrVariables, darkSystemVariables]) for (const [name, value] of Object.entries(dark)) assert.equal(map.get(name), value, `dark ${name}`);
  // 학교 색과 역할 변수의 연결. 하늘색 #00A3D9는 글자·테두리 색으로 쓰지 않는다.
  for (const [name, value] of Object.entries({ "--blue": "#005B96", "--navy": "#0A2540", "--edge-strong": "#6E8098" })) assert.equal(variables.get(name), value);
  for (const [name, target] of Object.entries({ "--ink": "--text", "--muted": "--text-muted", "--link-ink": "--sky-text", "--good": "--success", "--warn": "--warning", "--bad": "--danger" })) {
    assert.equal(variables.get(name), `var(${target})`, name);
  }
  for (const rule of rules) for (const [name, value] of rule.declarations) {
    if (["color", "border", "border-color", "outline", "outline-color", "stroke"].includes(name) || name.startsWith("border-")) assert.doesNotMatch(value, /var\(--sky\)/, rule.selectors.join(","));
  }
  // 노란 글자는 불투명 남색 면 위 준비 중 표시뿐이다. 사진 위 제목 강조는 흰 글자에 노란 밑줄이다.
  const yellowText = rules.filter(rule => rule.declarations.some(([name, value]) => name === "color" && value === "var(--yellow)")).flatMap(rule => rule.selectors);
  assert.deepEqual(yellowText, [".soon-label"]);
  for (const selector of [".login-intro em", ".main-title-fallback em"]) {
    assert.equal(declared(selector, ["color"]), "var(--white)", selector);
    assert.match(declared(selector, ["text-decoration"]), /var\(--yellow\)/, selector);
  }
  assert.equal(declared(".soon-label", ["background"]), "var(--navy)");
});

test("두 다크 블록은 같은 선언을 같은 순서로 적고, color-scheme을 테마에 맞춘다", () => {
  assert.deepEqual(darkAttrRules[0].declarations, darkSystemRules[0].declarations);
  for (const [name] of customProperties(darkAttrRules)) assert.ok(variables.has(name), `라이트에 없는 이름 ${name}`);
  const scheme = list => list.flatMap(rule => rule.declarations).filter(([name]) => name === "color-scheme").map(([, value]) => value);
  assert.deepEqual(scheme(rootRules), ["light"]);
  assert.deepEqual(scheme(darkAttrRules), ["dark"]);
  assert.deepEqual(scheme(darkSystemRules), ["dark"]);
  // 시스템 다크 조건은 이 블록 하나에만 쓴다. 말풍선도 같은 블록이 --pet-bubble을 바꾼다.
  assert.deepEqual(rules.filter(rule => rule.context.some(header => header.includes("prefers-color-scheme"))), darkSystemRules);
  assert.equal(darkAttrVariables.get("--pet-bubble"), "var(--pet-bubble-dark)");
  // 라이트 값과 다른 값은 라이트 블록에 그대로 남지 않는다. 다크는 라이트를 덮어쓰기만 한다.
  assert.ok(customProperties(darkAttrRules).every(([name, value]) => variables.get(name) !== value || name === "--yellow"));
});

test("라이트·다크와 밝고 어두운 사진 양쪽에서 글자 대비가 4.5 이상이다", () => {
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

test("테두리와 초점 고리는 네 테마에서 바탕과 3 이상이고, 초점은 어디서나 2px 실선 고리 하나다", () => {
  const selectors=[".login-card",".card","button.card:hover:not([data-restored])",".feature-panel","#demo-student-list button","#demo-student-list button:hover","#login-form input","#login-form input:focus",".reset",".login",".panel-close",".login-submit",".primary",".primary:not(:disabled):hover",".login-safety",".attach-button","textarea",".composer textarea",".composer textarea:hover",".composer-row",".mode-pill",'.mode-pill[aria-expanded="true"]',".choice-menu",'.choice-menu-item[aria-checked="true"]',".quicklink-nav",".pet-says","#campus-motion-toggle",
    ".quicklink-card","#home-button","#conversation-toggle"];
  const edgeParents = { ...parents, '.mode-pill[aria-expanded="true"]': ".composer-row", '.choice-menu-item[aria-checked="true"]': ".choice-menu", ".quicklink-nav": ".site-footer",
    ".quicklink-card": ".site-footer", "#home-button": ".masthead", "#conversation-toggle": ".masthead" };
  const surfaceOf = selector => selector === '.mode-pill[aria-expanded="true"]' ? ".mode-pill" : selector === ".quicklink-nav" ? ".quicklink-nav" : selector;
  const failures=[];
  for (const look of themes) {
    for(const photo of [[4,20,38],[255,255,255]]) for(const selector of selectors) for(const back of fills(surfaceOf(selector),photo,edgeParents,look)) {
      const edge=colors(declared(selector,["border","border-color"],undefined,look),look)[0]; const ratio=contrast(blend(edge,back),back);
      if(ratio<3) failures.push(themeName(look)+" "+selector+" "+ratio.toFixed(2));
    }
    // 로그인 화면 바닥의 바로가기 카드도 같은 경계를 쓴다.
    for (const photo of [[4,20,38],[255,255,255]]) for (const back of fills(".quicklink-card",photo,{ ...parents, ".quicklink-card": "#login-site-footer" },look)) {
      const ratio = contrast(blend(colors(declared(".quicklink-card",["border"],undefined,look),look)[0],back),back);
      if (ratio < 3) failures.push(themeName(look)+" login .quicklink-card "+ratio.toFixed(2));
    }
    for (const photo of [[4,20,38],[255,255,255]]) {
      for (const back of fills(".masthead",photo,parents,look)) {
        const edge = colors(declared(".masthead",["border-bottom-color"],undefined,look),look)[0];
        const ratio = contrast(blend(edge,back),back);
        if (ratio < 3) failures.push(themeName(look)+" .masthead " + ratio.toFixed(2));
      }
    }
    // 초점 고리는 라이트 남색, 다크 흰색이다. 반투명 판(흐림 지원·미지원)과 불투명 면 모두에서 3:1을 넘는다.
    const focus=colors(declared(":focus-visible",["outline"],undefined,look),look)[0];
    // 흐림 미지원에서는 대화 영역이 투명해지고 그 뒤 채팅 판이 불투명 바탕을 깐다.
    const noBlurParents = { ...parents, [chatSurface]: 'body[data-view="chat"] .layout' };
    for (const env of [look, { ...look, supports: false }]) for(const photo of [[4,20,38],[255,255,255]]) {
      for(const surface of [".login-card",".masthead",".choice-menu",".layout",".card",".reply",chatSurface,"#conversation-sidebar",".composer-row",".mode-pill"]) for(const back of fills(surface,photo,env.supports ? parents : noBlurParents,env)) {
        const ratio=contrast(blend(focus,back),back);
        if(ratio<3) failures.push(`${themeName(env)}${env.supports ? "" : " no-blur"} focus on ${surface} ${ratio.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(failures,[]);
  assert.equal(declared(":focus-visible",["outline"]),"2px solid var(--focus-ring)");
  assert.equal(declared(":focus-visible",["outline-offset"]),"2px");
  // 초점 규칙을 덮는 곳은 메뉴 항목(안쪽 고리)과 배경 일시정지 버튼(사진 위 흰 고리와 남색 띠)뿐이고, 모두 2px 실선이다.
  const focusRules = rules.filter(rule => rule.selectors.some(selector => selector.includes(":focus")));
  for (const rule of focusRules) for (const [name, value] of rule.declarations) {
    if (name === "outline") assert.match(value, /^2px solid var\(--(focus-ring|white)\)$/, rule.selectors.join(","));
    assert.notEqual(name, "outline-color", rule.selectors.join(","));
    assert.notEqual(value, "none", rule.selectors.join(","));
  }
  assert.equal(find("#main-screen :focus-visible", ["outline-color"]), undefined);
  assert.equal(find("#login-form input:focus", ["outline", "box-shadow"]), undefined);
  // 고른 상태는 그림자만이 아니라 테두리 색으로도 보인다.
  assert.equal(declared('.mode-pill[aria-expanded="true"]', ["border-color"]), "var(--focus-ink)");
  assert.equal(declared('.choice-menu-item[aria-checked="true"]', ["border-color"]), "var(--control-line)");
});

test("음각·양각은 불투명 입력 줄 안의 질문 칸과 답변 모드 버튼에만 피드백 수치로 쓴다", () => {
  assert.equal(variables.get("--emboss"), "6px 6px 14px rgba(10,37,64,.16), -6px -6px 14px rgba(255,255,255,.9)");
  assert.equal(variables.get("--deboss"), "inset 3px 3px 7px rgba(10,37,64,.14), inset -3px -3px 7px rgba(255,255,255,.85)");
  for (const map of [darkAttrVariables, darkSystemVariables]) {
    assert.equal(map.get("--emboss"), "6px 6px 14px rgba(0,0,0,.45), -6px -6px 14px rgba(255,255,255,.05)");
    assert.equal(map.get("--deboss"), "inset 3px 3px 8px rgba(0,0,0,.5), inset -3px -3px 8px rgba(120,160,210,.08)");
  }
  const users = rules.filter(rule => rule.declarations.some(([, value]) => /var\(--(emboss|deboss)\)/.test(value))).flatMap(rule => rule.selectors);
  assert.deepEqual(users, [".composer textarea", ".mode-pill", '.mode-pill[aria-expanded="true"]', '.mode-pill[data-mode="deep"]', '.mode-pill[data-mode="deep"][aria-expanded="true"]']);
  // 그 면들은 불투명 단색이다. 입력 줄도 불투명이라 바깥 사진이 비치지 않는다.
  for (const look of themes) for (const selector of [".composer-row", ".composer textarea", ".mode-pill"]) {
    for (const color of colors(declared(selector, ["background", "background-color"], undefined, look), look)) assert.equal(color[3], 1, `${themeName(look)} ${selector}`);
  }
  assert.equal(declared(".composer textarea", ["border-color"]), "var(--edge-strong)");
  assert.equal(declared(".mode-pill", ["border"]), "1.5px solid var(--edge-strong)");
  // 반투명 패널에는 음각·양각이 없다.
  for (const selector of [".reply", ".question", ".card", ".feature-panel", "#conversation-sidebar", chatSurface, ".masthead", ".login-card"]) {
    assert.doesNotMatch(find(selector, ["box-shadow"]) ?? "", /emboss|deboss|inset/, selector);
  }
});

test("조작 영역은 44px 이상이다", () => {
  for (const [selector, names] of [[".quicklink-nav", ["width", "height"]], ["#conversation-sidebar .conversation-more", ["width", "min-height"]],
    [".mode-pill", ["min-width", "min-height"]], [".attach-button", ["width", "min-height"]], [".lang-pill", ["min-width", "min-height"]]]) {
    for (const width of [1280, 480, 390]) for (const name of names) {
      assert.ok(Number.parseFloat(declared(selector, [name], undefined, { width })) >= 44, `${selector} ${name} ${width}px`);
    }
  }
  for (const selector of ["#demo-logout", 'body[data-view="chat"] #home-button']) {
    assert.ok(Number.parseFloat(declared(selector, ["min-height"], undefined, { width: 390 })) >= 44, selector);
  }
  // 390px 채팅 머리글의 대화 목록·홈 버튼은 가로도 44px, 생각 요약 토글은 한 줄이어도 44px 높이다.
  for (const selector of ['body[data-view="chat"] #home-button', 'body[data-view="chat"] #conversation-toggle']) {
    assert.ok(Number.parseFloat(declared(selector, ["min-width"], undefined, { width: 390 })) >= 44, selector);
  }
  for (const selector of ["#conversation-toggle", "#home-button"]) assert.equal(declared(selector, ["min-width"]), "44px", selector);
  // 390px 채팅 머리글: 대화 목록(44)·홈(44)·언어·테마 알약 두 개가 한 줄이다. 로고(약 140px)를 두면 자리가 모자라
  // 채팅 화면에서만 480px 이하에서 로고 그림을 감춘다. 첫 화면과 넓은 화면에서는 그대로 보인다.
  // 481px처럼 480px를 조금 넘는 화면에서도 영어 버튼 이름이면 로고와 버튼이 머리글을 넘는다. 그래서 기준은 680px다.
  for (const width of [390, 481, 680]) {
    assert.equal(declared('body[data-view="chat"] .brand-logo', ["display"], undefined, { width }), "none", `${width}px`);
    // 로고를 받지 못하면 대신 보이는 학교 이름 글자도 그 자리를 차지하므로 화면에서만 감춘다.
    assert.equal(declared('body[data-view="chat"] .brand-name', ["clip-path"], undefined, { width }), "inset(50%)", `${width}px`);
    assert.equal(declared('body[data-view="chat"] .brand-name', ["position"], undefined, { width }), "absolute", `${width}px`);
  }
  assert.equal(find('body[data-view="chat"] .brand-logo', ["display"], { width: 681 }), undefined);
  assert.equal(find('body[data-view="chat"] .brand-name', ["clip-path"], { width: 681 }), undefined);
  assert.equal(find(".brand-logo", ["display"], { width: 390 }), "inline-block");
  // 480px 이하 머리글: 언어 이름은 남기고 지구본만, 테마는 이름을 낭독기용으로 빼서 320px 로그인 채팅 머리글에도 들어간다.
  // 오른쪽 묶음은 내용 폭을 지키고 로고가 줄어 390px 첫 화면에서도 겹치지 않는다.
  for (const width of [320, 390, 480]) {
    assert.equal(declared('.masthead-actions > .lang-pill:not([id$="theme-button"]) .lang-pill-globe', ["display"], undefined, { width }), "none");
    assert.equal(declared('[id$="theme-button"] .lang-pill-label', ["clip-path"], undefined, { width }), "inset(50%)");
    assert.equal(declared(".brand", ["flex"], undefined, { width }), "0 1 auto");
    assert.equal(declared(".brand", ["min-width"], undefined, { width }), "0");
    assert.equal(declared(".masthead-actions", ["flex"], undefined, { width }), "0 1 auto");
    // 그림은 content-box라 받침 좌우 여백만큼 더 빼야 로고 칸(100%) 안에 들어간다.
    assert.equal(declared(".brand-logo > img", ["max-width"], undefined, { width }), "calc(100% - 2 * var(--logo-pad-x))");
    assert.equal(declared(".brand-logo > img", ["box-sizing"], undefined, { width }), "content-box");
    assert.equal(declared(".brand-logo", ["max-width"], undefined, { width }), "100%");
    assert.equal(declared(".brand-logo > img", ["object-fit"], undefined, { width }), "contain");
    // 로고 칸은 넘침을 잘라 내고, 그 안의 두 갈래(로고 그림, 로고 실패 때의 학교 이름 글자)는 모두 칸 폭 아래로 줄 수 있다.
    // 첫 화면(채팅이 아닌 화면)에서도 같은 규칙이다. 예전에는 그림만 고쳐 영어 이름 글자가 언어 버튼 쪽으로 넘쳤다.
    assert.equal(declared(".brand", ["overflow"], undefined, { width }), "hidden");
    for (const child of [".brand-logo", ".brand-name"]) {
      assert.equal(declared(child, ["min-width"], undefined, { width }), "0", `${child} ${width}px`);
      assert.equal(declared(child, ["max-width"], undefined, { width }), "100%", `${child} ${width}px`);
    }
    assert.equal(declared(".brand-name", ["text-overflow"], undefined, { width }), "ellipsis");
    assert.equal(declared(".brand-name", ["overflow"], undefined, { width }), "hidden");
    // 버튼 묶음과 로그인 상자는 버튼들의 최소 폭 아래로 줄지 않는다.
    assert.equal(declared(".masthead-actions", ["min-width"], undefined, { width }), "min-content");
    assert.equal(declared(".demo-account", ["min-width"], undefined, { width }), "min-content");
  }
  // 받침 여백은 라이트 9px, 다크 0이고 받침 전체 값은 이 여백을 쓴다.
  assert.equal(resolve("var(--logo-pad-x)", lightEnv), "9px");
  assert.equal(resolve("var(--logo-pad)", lightEnv), "5px 9px");
  assert.equal(resolve("var(--logo-pad-x)", darkEnv), "0px");
  assert.equal(find('[id$="theme-button"] .lang-pill-label', ["clip-path"], { width: 481 }), undefined);
  assert.equal(declared(".brand", ["flex"], undefined, { width: 481 }), "none");
  // 재시도 버튼은 두 글자(重试)여도 가로 44px다.
  for (const name of ["min-width", "min-height"]) assert.equal(declared(".retry", [name]), "44px", name);
  // 출처 링크는 답 아래 따로 놓인 조작 요소라 높이·너비 모두 44px 이상이다(제목이 한 글자여도).
  for (const selector of [".source-link", ".evidence .source-link", ".graduation .source-link", ".poster-result .source-link"]) {
    for (const name of ["min-height", "min-width"]) assert.equal(declared(selector, [name]), "44px", `${selector} ${name}`);
  }
  // 대화 목록 아래 학교 링크도 한 줄 글자보다 높은 44px 누름 영역이다.
  for (const width of [1280, 390]) assert.equal(declared(".campus-site-link", ["min-height"], undefined, { width }), "44px");
  assert.equal(declared(".thinking summary", ["min-height"]), "44px");
});

test("상태 표시와 열린 상태 테두리는 밝은 면에서도 3:1을 넘는다", () => {
  const ratioOn = (paint, surface, look) => contrast(colors(paint, look)[0].slice(0, 3), colors(surface, look)[0].slice(0, 3));
  for (const look of themes) {
    const name = themeName(look);
    // 현재 대화 선·대기 표시(라이트 파랑, 다크 노랑)는 고른 대화 바탕과 목록 면 위에서 보인다.
    assert.equal(declared('.conversation-item[aria-current="true"]', ["border-inline-start-color"]), "var(--current-mark)");
    assert.equal(declared(".conversation-pending", ["border-top-color"]), "var(--current-mark)");
    for (const surface of ["var(--surface)", "var(--bg)"]) assert.ok(ratioOn("var(--current-mark)", surface, look) >= 3, `${name} 현재 대화 선`);
    // 읽지 않은 점: 다크는 코랄 채움 자체가, 라이트는 남색 테두리가 3:1 경계다.
    const ring = resolve("var(--unread-ring)", look);
    const edge = ring === "transparent" ? "var(--coral)" : "var(--unread-ring)";
    for (const surface of ["var(--surface)", "var(--bg)"]) assert.ok(ratioOn(edge, surface, look) >= 3, `${name} 읽지 않은 점`);
    // 깊이 모드에서 메뉴를 열면 세 색 고리 대신 열린 상태 테두리색이 3:1 경계가 된다.
    assert.ok(ratioOn("var(--focus-ink)", "var(--raised)", look) >= 3, `${name} 깊이 모드 열림`);
    // 닫힌 깊이 모드는 고리 안쪽 1px 경계선이 3:1 경계다. 고리 색(하늘·밝은 하늘·노랑)은 흰 면과 3:1에 못 미치는 장식이다.
    assert.ok(ratioOn("var(--edge-strong)", "var(--raised)", look) >= 3, `${name} 깊이 모드 닫힘`);
    if (!isDark(look)) for (const ring of ["var(--sky)", "var(--deep-sky)", "var(--deep-gold)"]) assert.ok(ratioOn(ring, "var(--raised)", look) < 3, ring);
  }
  assert.match(declared(".conversation-unread", ["border"]), /^1\.5px solid var\(--unread-ring\)$/);
  assert.match(declared('.mode-pill[data-mode="deep"]', ["box-shadow"]), /^inset 0 0 0 1px var\(--edge-strong\), var\(--emboss\)$/);
  assert.equal(declared('.mode-pill[data-mode="deep"][aria-expanded="true"]', ["box-shadow"]), "var(--deboss)");
  assert.equal(declared('.mode-pill[data-mode="deep"][aria-expanded="true"]', ["border-color"]), "var(--focus-ink)");
  const deep = rules.findIndex(rule => rule.selectors.includes('.mode-pill[data-mode="deep"]') && rule.declarations.some(([name]) => name === "border-color"));
  const open = rules.findIndex(rule => rule.selectors.includes('.mode-pill[data-mode="deep"][aria-expanded="true"]'));
  assert.ok(open > deep, "열린 깊이 모드 규칙이 고리 규칙 뒤에 와야 덮이지 않는다");
});

test("로그인 화면 언어·테마 묶음은 hover 바탕이 없고 안의 알약이 흰 글자를 쓴다", () => {
  assert.equal(find(".login-lang:hover", ["background"]), undefined);
  assert.equal(declared("button.login-lang:hover", ["background"]), "var(--navy)");
  assert.equal(declared(".login-lang:not(button)", ["background"]), "transparent");
  assert.equal(declared(".login-lang .lang-pill", ["color"]), "var(--white)");
  assert.equal(declared(".login-lang .lang-pill", ["background"]), "var(--glass-pill)");
  assert.equal(declared(".login-lang .lang-pill:hover", ["background"]), "var(--navy)");
  // 사진 위 두 버튼의 초점은 테마색 고리가 아니라 흰 고리와 남색 띠다. 띠가 고리 뒤 바탕을 고정해 어느 사진·테마에서도 3:1을 넘는다.
  for (const selector of ["button.login-lang:focus-visible", ".login-lang .lang-pill:focus-visible"]) {
    assert.equal(declared(selector, ["outline"]), "2px solid var(--white)", selector);
    assert.equal(declared(selector, ["outline-offset"]), "2px", selector);
    assert.equal(declared(selector, ["box-shadow"]), "0 0 0 6px var(--navy)", selector);
  }
  for (const look of themes) {
    assert.ok(contrast(colors("var(--white)", look)[0].slice(0, 3), colors("var(--navy)", look)[0].slice(0, 3)) >= 3, themeName(look));
    // 근거: 라이트 남색 고리를 어두운 사진·위쪽 막 위에 바로 두면 3:1에 못 미친다.
    if (!isDark(look)) {
      const photoTop = blend(colors("var(--overlay-top)", look)[0], [4, 20, 38]);
      assert.ok(contrast(colors("var(--focus-ring)", look)[0].slice(0, 3), photoTop) < 3);
    }
  }
  // 대화 영역 초점은 안쪽 고리다. 윗변이 큰 판의 투명 띠에 걸리므로 안쪽 6px 남색 띠 위에 흰 고리(안쪽 2~4px)를 그린다.
  assert.equal(declared(".transcript:focus-visible", ["outline"]), "2px solid var(--white)");
  assert.equal(declared(".transcript:focus-visible", ["outline-offset"]), "-4px");
  assert.equal(declared(".transcript:focus-visible", ["box-shadow"]), "inset 0 0 0 6px var(--navy)");
  assert.ok(Math.abs(Number.parseFloat(declared(".transcript:focus-visible", ["outline-offset"]))) <= 6 - 2);
  // 저장 대화를 다시 열면 출처 링크와 작성자 이름이 말풍선 밖(.turn 바로 아래)에 붙는다. 그 자리에도 말풍선 보강 면을 깐다.
  const restoredParents = { ...chatParents, ".turn > .source-link": chatSurface, ".turn > .reply-author": chatSurface };
  checkText([[".source-link", ".turn > .source-link"], [".turn > .reply-author", ".turn > .reply-author"]], restoredParents);
  checkText([[".source-link", ".turn > .source-link"], [".turn > .reply-author", ".turn > .reply-author"]],
    { ...parents, ".turn > .source-link": ".layout", ".turn > .reply-author": ".layout" });
  // 테크모도 옮기면 판 없이 사진 위에 놓이므로 같은 흰 고리와 남색 띠를 쓴다.
  assert.equal(declared(".pet:focus-visible", ["outline"]), "2px solid var(--white)");
  assert.equal(declared(".pet:focus-visible", ["box-shadow"]), "0 0 0 6px var(--navy)");
  // 아래쪽 사진 이름은 남색 받침 위 흰 글자다. 라이트 아래쪽 막은 밝아서 받침 없이는 흰 사진에서 묻힌다.
  checkText([[".campus-caption", ".campus-caption-text"]]);
  // 사진 위 본문 크기 글자(소개 문구·인사말)도 남색 받침 위 불투명 흰 글자다. 사진 위 막은 빼고 계산해 더 엄격하게 본다.
  checkText([[".intro-description", ".intro-description"], [".main-welcome #main-greeting", ".main-welcome #main-greeting"]]);
  // 대체 제목은 화면 높이 25% 안팎, 막이 옅어지는 자리에 놓인다. 막에 기대지 않고 남색 받침 위 흰 글자로 계산한다.
  checkText([[".main-title-fallback", ".main-title-fallback"], [".login-intro", ".title-fallback"]]);
  // 근거: 막 맨 위(.50)보다 옅은 25% 지점(약 .30)에서는 흰 사진 위 흰 글자가 큰 글자 기준 3:1에도 못 미친다.
  const mid = colors("var(--overlay-top)", lightEnv)[0][3] - (colors("var(--overlay-top)", lightEnv)[0][3] - colors("var(--overlay-mid)", lightEnv)[0][3]) * 25 / 42;
  assert.ok(contrast([255, 255, 255], blend([10, 37, 64, mid], [255, 255, 255])) < 3);
  for (const look of themes) {
    const top = blend(colors("var(--overlay-top)", look)[0], [255, 255, 255]);
    if (!isDark(look)) assert.ok(contrast(colors("var(--yellow)", look)[0].slice(0, 3), top) < 3);
  }
  // 사진 위 설정 버튼 경계: 어두운 사진에서는 흰 테두리가, 흰 사진에서는 남색 면이 바깥과 3:1을 넘는다.
  for (const selector of [".login-lang", ".login-lang .lang-pill"]) assert.equal(declared(selector, ["border-color"]), "var(--white)", selector);
  for (const look of themes) {
    const pillOnWhite = blend(colors("var(--glass-pill)", look)[0], [255, 255, 255]);
    assert.ok(contrast([255, 255, 255], pillOnWhite) >= 3, `${themeName(look)} 흰 사진 위 알약 면`);
    assert.ok(contrast([255, 255, 255], [4, 20, 38]) >= 3);
  }
  // 근거: 받침 없이 흰 .88 글자를 라이트 위쪽 막(.50)과 흰 사진 위에 두면 4.5:1에 못 미친다.
  const washed = blend(colors("var(--overlay-top)", lightEnv)[0], [255, 255, 255]);
  assert.ok(contrast(blend(colors("var(--intro-ink)")[0], washed), washed) < 4.5);
  // 흰 글자는 남색 알약(흰 사진 가정)과 hover 남색 모두에서 4.5:1을 넘는다.
  for (const look of themes) {
    assert.ok(contrast([255, 255, 255], blend(colors("var(--glass-pill)", look)[0], [255, 255, 255])) >= 4.5);
    assert.ok(contrast([255, 255, 255], colors("var(--navy)", look)[0].slice(0, 3)) >= 4.5);
  }
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

test("내용 구분선과 상태색은 지정 변수를 쓰고, 글 상자는 라이트에서 밝고 다크에서 어둡다", () => {
  for (const [name, value] of Object.entries({ "--content-line": "rgba(10,37,64,.16)", "--control-line": "#6E8098" })) assert.equal(variables.get(name), value);
  for (const [name, value] of Object.entries({ "--content-line": "rgba(140,220,255,.28)", "--control-line": "rgba(140,220,255,.78)" })) assert.equal(darkAttrVariables.get(name), value);
  for (const [name, light, dark] of [["--good", "#0F7A43", "#4ADE80"], ["--bad", "#C62F2F", "#F87171"], ["--warn", "#9A5B00", "#FBBF24"]]) {
    assert.equal(resolve(`var(${name})`), light, name);
    assert.equal(resolve(`var(${name})`, darkEnv), dark, name);
  }
  for (const selector of [".evidence", ".graduation th", ".graduation td"]) {
    assert.equal(declared(selector, ["border-color"]), "var(--content-line)");
  }
  // 라이트 면은 흰색 쪽, 다크 면은 바탕색(#0B1626) 쪽이다.
  const tone = (color, look) => isDark(look) ? luminance(color.slice(0, 3)) < .02 : luminance(color.slice(0, 3)) > .8;
  for (const look of themes) {
    const name = themeName(look);
    // 말풍선·카드: 큰 판 위에 놓여 합성 불투명도는 라이트 .94, 다크 .88이다.
    for (const selector of [".reply", ".question", ".card", ".feature-panel", ".site-footer", ".status:not(:empty)"]) {
      for (const color of colors(declared(selector, ["background", "background-color"]), look)) {
        assert.ok(tone(color, look) && color[3] >= .60 && color[3] <= .85, `${name} ${selector}`);
      }
    }
    // 말풍선 안의 상자는 옅은 덧판만 깐다. 진하게 겹치면 말풍선 안이 다시 벽이 된다.
    for (const selector of [".evidence", ".fallback", ".reading", ".biskit .program", ".poster-result", "[data-panel-content] > .panel-action", ".graduation thead th", ".graduation .item td"]) {
      for (const color of colors(declared(selector, ["background", "background-color"]), look)) {
        assert.ok(tone(color, look) && color[3] <= .55, `${name} ${selector}`);
      }
    }
    // 작은 상태 상자와 입력칸, 사진 바로 위의 안내 줄은 진한 면을 유지한다.
    for (const selector of [".error", ".poster-result.unconfirmed", ".card.soon", "textarea", ".composer-meta"]) {
      for (const color of colors(declared(selector, ["background", "background-color"]), look)) {
        assert.ok(tone(color, look) && color[3] >= .80, `${name} ${selector}`);
      }
    }
  }
  // 테크모 말풍선은 패널과 나눈 불투명 크림 면이고(#128), 일시정지 버튼은 불투명 남색 면이다.
  assert.equal(declared(".pet-says", ["background"]), "var(--pet-bubble)");
  assert.deepEqual(colors("var(--pet-bubble)"), [[255, 246, 214, 1]]);
  assert.deepEqual(colors("var(--pet-bubble)", darkEnv), [[243, 231, 191, 1]]);
  assert.deepEqual(colors("var(--pet-bubble)", systemDarkEnv), [[243, 231, 191, 1]]);
  assert.deepEqual(colors("var(--pet-bubble)", { theme: "light", scheme: "dark" }), [[255, 246, 214, 1]]);
  assert.equal(declared("#campus-motion-toggle", ["background"]), "var(--navy)");
});

test("말풍선 글자는 라이트·다크 크림 모두에서, 일시정지 버튼과 초점 고리는 어떤 사진 위에서도 대비를 지킨다", () => {
  const navy = colors("var(--navy)")[0];
  for (const cream of [colors("var(--pet-bubble)")[0], colors("var(--pet-bubble-dark)")[0]]) {
    assert.ok(contrast(navy.slice(0, 3), cream.slice(0, 3)) >= 4.5);
    // 남색 선과 그림자도 크림 바탕과 3:1 이상이다.
    assert.ok(contrast(navy.slice(0, 3), cream.slice(0, 3)) >= 3);
  }
  checkText([["#campus-motion-toggle", "#campus-motion-toggle"], ["#campus-motion-toggle", "#campus-motion-toggle:hover"]]);
  // 펫 줄 말풍선은 상자 자신을 투명하게 두고 자식 층(::before)이 같은 크림 판·남색 선을 그린다.
  assert.equal(declared(".pet-dock .pet-says::before", ["background"]), "var(--pet-bubble)");
  checkText([[".pet-says", ".pet-dock .pet-says::before"]]);
  const plateEdge = colors(declared(".pet-dock .pet-says::before", ["border"]))[0];
  for (const cream of [colors("var(--pet-bubble)")[0], colors("var(--pet-bubble-dark)")[0]]) {
    assert.ok(contrast(plateEdge.slice(0, 3), cream.slice(0, 3)) >= 3);
  }
  // 초점 고리는 흰 2px 실선이고 그 뒤에 남색 띠를 깔아 밝은 사진에서도 3:1을 넘는다.
  assert.equal(declared("#campus-motion-toggle:focus-visible", ["outline"]), "2px solid var(--white)");
  assert.equal(declared("#campus-motion-toggle:focus-visible", ["box-shadow"]), "0 0 0 6px var(--navy)");
  assert.ok(contrast([255, 255, 255], navy.slice(0, 3)) >= 3);
  for (const name of ["width", "height", "min-width", "min-height"]) assert.equal(declared("#campus-motion-toggle", [name]), "44px", name);
  assert.equal(declared("#campus-motion-toggle", ["pointer-events"]), "auto");
  assert.equal(declared(".campus-caption", ["pointer-events"]), "none");
  // 옮겨 놓은 테크모(20)가 버튼을 덮지 않고, 대화 메뉴(30)·확인 창(40)보다는 아래다.
  const layer = selector => Number(declared(selector, ["z-index"]));
  assert.ok(layer(".campus-caption") > layer('.pet-dock[data-placed="true"]'));
  assert.ok(layer(".campus-caption") < layer(".conversation-menu"));
  // 서랍과 답변 도착 알림이 떠 있는 동안에는 그림·초점·낭독에서 모두 빠진다.
  for (const selector of ['body[data-conversation-drawer="open"] .campus-caption', "body:has(#conversation-toast:not([hidden])) .campus-caption"]) {
    assert.equal(declared(selector, ["visibility"]), "hidden", selector);
  }
});

test("큰 면은 사진이 비치는 반투명에 blur(16px) saturate(1.3), 말풍선·카드는 blur(10px)이고 -webkit- 접두사를 함께 적는다", () => {
  const alpha = (name, look) => colors(`var(${name})`, look)[0][3];
  // 라이트는 흰 큰 면 .70, 다크는 바탕색 큰 면 .50이다. 큰 면과 말풍선을 겹쳐도 완전히 막히지는 않는다.
  assert.equal(alpha("--main-surface", lightEnv), .70);
  assert.equal(alpha("--main-surface", darkEnv), .50);
  for (const look of themes) {
    for (const name of ["--main-bubble", "--main-bubble-hover", "--main-bubble-active"]) assert.ok(alpha(name, look) >= .60 && alpha(name, look) <= .90, name);
    const stacked = 1 - (1 - alpha("--main-surface", look)) * (1 - alpha("--main-bubble", look));
    assert.ok(stacked >= .85 && stacked < .95, `${themeName(look)} ${stacked}`);
  }
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
  // 깊이 모드 버튼은 테두리만 그라데이션이고 글자 뒤는 버튼 면(--raised) 한 겹이다.
  assert.match(declared('.mode-pill[data-mode="deep"]', ["background"]), /^linear-gradient\(var\(--raised\), var\(--raised\)\) padding-box, linear-gradient\(/);
  for (const look of themes) {
    const ink = colors(declared(".mode-pill", ["color"]), look)[0].slice(0, 3);
    assert.ok(contrast(ink, colors("var(--raised)", look)[0].slice(0, 3)) >= 4.5, themeName(look));
  }
});

test("흐림을 지원하지 않으면 큰 판은 불투명 바탕, 글이 놓이는 면은 진한 면을 쓴다", () => {
  assert.match(styles, /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\) \{/);
  const old = { supports: false };
  const panel = "linear-gradient(180deg, transparent, var(--panel-surface) 56px)";
  assert.equal(declared(".layout", ["background"], undefined, old), panel);
  // 채팅 화면 판은 투명 띠 없이 불투명하다. 색 읽기 함수는 그라데이션 안의 transparent를 색으로 세지 않으므로 글자로 따로 막는다.
  assert.equal(declared('body[data-view="chat"] .layout', ["background"], undefined, old), "var(--panel-surface)");
  assert.doesNotMatch(declared('body[data-view="chat"] .layout', ["background"], undefined, old), /transparent/);
  assert.equal(declared(".layout::before", ["display"], undefined, old), "none");
  assert.equal(declared(chatSurface, ["background"], undefined, old), "transparent");
  for (const selector of ["#conversation-sidebar", ".reply", ".question", ".card", ".feature-panel", ".composer-meta"]) {
    assert.equal(declared(selector, ["background"], undefined, old), "var(--glass-dense)", selector);
  }
  assert.equal(declared("button.card:hover:not([data-restored])", ["background"], undefined, old), "var(--feature-hover)");
  assert.equal(declared(".site-footer", ["background"], undefined, old), "var(--panel-surface)");
  checkText([[".reply", ".reply"], [".card-text", ".card"], [".status", ".status:not(:empty)"], [".composer .composer-hint", ".composer-meta"],
    [".evidence .source-link", ".evidence"], [".graduation .shortfall", ".graduation table"], ["#conversation-sidebar button", ".conversation-item"],
    [".site-footer p", ".site-footer"], [".campus-site-link", ".site-footer"]], parents, old);
  checkText([[".reply", ".reply"], [".status", ".status:not(:empty)"]], { ...chatParents, [chatSurface]: 'body[data-view="chat"] .layout' }, old);
  // 불투명 바탕은 테마의 바탕색이다.
  assert.deepEqual(colors("var(--panel-surface)", lightEnv), [[245, 248, 252, 1]]);
  assert.deepEqual(colors("var(--panel-surface)", darkEnv), [[11, 22, 38, 1]]);
});

test("로그인 화면은 같은 유리 구조에 테마별 값을 쓰고 흐림은 그대로다", () => {
  for (const [name, light, dark] of [
    ["--glass-card", "rgba(255,255,255,.95)", "rgba(19,35,58,.94)"], ["--card-end", "rgba(255,255,255,.93)", "rgba(11,22,38,.88)"],
    ["--glass-band", "rgba(255,255,255,.92)", "rgba(11,22,38,.76)"], ["--glass-dense", "rgba(255,255,255,.94)", "rgba(11,22,38,.84)"],
    ["--panel-surface", "#F5F8FC", "#0B1626"],
  ]) {
    assert.equal(variables.get(name), light, name);
    assert.equal(darkAttrVariables.get(name), dark, name);
  }
  // 사진 위 알약(언어 버튼·소개 배지)은 두 테마 모두 남색 반투명에 흰 글자다.
  assert.equal(variables.get("--glass-pill"), "rgba(10,37,64,.62)");
  assert.equal(darkAttrVariables.get("--glass-pill"), "rgba(10,37,64,.62)");
  assert.ok(contrast([255, 255, 255], blend(colors("var(--glass-pill)")[0], [255, 255, 255])) >= 4.5);
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
  // 언어 알약은 좁은 화면에서도 현재 언어 이름을 숨기지 않는다(#116).
  for (const width of [480, 390, 360, 320]) {
    for (const selector of [".lang-pill-label", ".masthead-actions > .lang-pill .lang-pill-label"]) {
      assert.notEqual(find(selector, ["display"], { width }), "none", `${selector} ${width}px`);
    }
  }
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
  assert.match(declared(".choice-menu-item:focus-visible", ["outline"]), /^2px solid var\(--focus-ring\)$/);
  assert.equal(declared(".choice-menu-item", ["min-height"]), "52px");
});

test("깊이 모드: 고정 테두리는 상태만으로 그리고, 효과는 효과 클래스에만 걸며 움직임 줄이기에서 모두 끈다", () => {
  assert.equal(variables.get("--sky"), "#00A3D9");
  assert.equal(variables.get("--deep-gold"), "#F7C500");
  // 깊이 생각 반짝임은 하늘색 계열이다. 예전 보라(--deep-violet)는 남기지 않는다.
  assert.equal(variables.get("--deep-sky"), "#38BDF8");
  assert.equal(variables.get("--deep-shine"), "rgba(0,163,217,.22)");
  assert.doesNotMatch(styles, /deep-violet|#6A4BD8|106,75,216/i);
  const [red, , blue] = colors("var(--deep-sky)")[0];
  assert.ok(blue > red * 2);
  const gradient = /linear-gradient\(90deg, var\(--sky\), var\(--deep-sky\), var\(--deep-gold\)/;
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
  const fixedRing = /linear-gradient\(90deg, var\(--sky\), var\(--deep-sky\), var\(--deep-gold\)\) 0 0 \/ 100% 100% border-box$/;
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

test("다크 테마에서 남은 밝은 바탕은 말풍선·노랑 표시·깊이 모드 장식이며 글자 대비를 확인한다", () => {
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
  for (const look of [darkEnv, systemDarkEnv]) {
    const lightSurfaces = [...backgrounds].filter(([, value]) =>
      colors(value, look).some(color => color[3] >= .8 && luminance(color.slice(0, 3)) > .5)
    ).map(([selector]) => selector).sort();
    assert.deepEqual(lightSurfaces, [
      ".composer-row.is-deep-enter::after", ".composer-row.is-deep::before", ".intro-badge::before",
      ".login-safety::before", ".mode-pill.is-flowing::after", '.mode-pill[data-mode="deep"]', ".mode-spark", ".pet-dock .pet-says::before", ".pet-says", '[data-campus-step][data-current="true"]',
    ], themeName(look));
  }
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

test("두 로고 자리는 테두리 없이 밝은 그림을 표시하고, 라이트에서만 그림에 남색 받침을 깐다", () => {
  for (const selector of [".brand-logo", ".login-brand"]) {
    assert.ok(["block", "inline-block"].includes(declared(selector, ["display"])), selector);
    assert.equal(declared(selector, ["padding"]), "0");
    assert.equal(declared(selector, ["background"]), "transparent");
    assert.equal(declared(selector, ["border"]), "0");
    assert.equal(declared(selector, ["box-shadow"]), "none");
  }
  // 밝은 로고는 흰 글자다. 라이트의 흰 띠·카드 위에서는 남색 받침, 다크에서는 받침 없이 어두운 유리 위에 놓는다.
  for (const selector of [".brand-logo > img", ".login-brand > img"]) {
    assert.equal(declared(selector, ["background"]), "var(--logo-plate)");
    assert.equal(declared(selector, ["padding"]), "var(--logo-pad)");
    // 높이 선언(30px·22px)은 그림 내용 높이로 남는다.
    assert.equal(declared(selector, ["box-sizing"]), "content-box");
  }
  assert.deepEqual(colors("var(--logo-plate)", lightEnv), [[10, 37, 64, 1]]);
  assert.ok(contrast([255, 255, 255], colors("var(--logo-plate)", lightEnv)[0].slice(0, 3)) >= 4.5);
  for (const look of [darkEnv, systemDarkEnv]) {
    assert.equal(resolve("var(--logo-plate)", look), "transparent");
    assert.equal(resolve("var(--logo-pad)", look), "0");
  }
  // 제목 그림(흰 글자 조각)은 두 테마 모두 사진 위 남색 막과 테마별 그림자 받침 위에 놓는다.
  for (const selector of [".title-lettering > img", ".main-lettering > img"]) {
    assert.equal(declared(selector, ["filter"]), "drop-shadow(0 2px 12px var(--lettering-shadow))");
  }
  assert.notEqual(resolve("var(--lettering-shadow)", lightEnv), resolve("var(--lettering-shadow)", darkEnv));
  for (const look of themes) assert.ok(colors("var(--overlay-top)", look)[0][3] >= .5, themeName(look));
  // 사진 위 글자(소개·인사말·제목 대체 글자)는 테마와 상관없이 흰 계열이다.
  for (const selector of [".login-intro", ".main-welcome", ".main-welcome #main-greeting", ".main-title-fallback"]) {
    assert.match(declared(selector, ["color"]), /^var\(--(white|intro-ink)\)$/, selector);
  }
});

test("확정 제목 그림과 치수선·눈금·대체 제목을 제공하고 옛 그림·알약은 요청하지 않는다", () => {
  assert.match(html,/<img[^>]*src="\/chat-assets\/title-lettering.png"[^>]*alt="졸업까지, 아이오와 함께"/);
  assert.doesNotMatch(html+styles+script,/calligraphy-title|calligraphy-fallback|EastSeaDokdo|feature-pills/);
  assert.match(html,/class="drawing-dimension"[^>]*aria-hidden="true"/);
  assert.match(html,/KIT · ACADEMIC GUIDE  ⟵ 2026 ⟶/);
  assert.match(html,/class="title-ticks"[^>]*aria-hidden="true"/);
  assert.match(html,/<h1 class="title-fallback">졸업까지, <span><em>아이오<\/em>와 함께<\/span><\/h1>/);
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

function loadLanding({ logo = waiting(), techmo = waiting(), fetch, lettering = null, lang = null } = {}) {
  const requests = [];
  const elements = new Map();
  const slots = [logo, techmo, ...(lettering ? [lettering] : [])].map((state, index) => {
    const slot = new FakeElement("slot");
    // index.html에서 그림 자리는 hidden으로 시작한다. 세 번째 자리는 한국어 글씨가 든 제목 그림이다.
    slot.hidden = true;
    if (index === 2) slot.className = "title-lettering";
    if (state) {
      slot.image = Object.assign(new FakeElement("img"), state);
      slot.append(slot.image);
    }
    return slot;
  });
  // lang을 주면 그 언어를 저장해 둔 브라우저처럼 시작한다.
  const window = { matchMedia: () => ({ matches: false }) };
  if (lang) window.localStorage = { getItem: key => key === "kumoh-chat-lang:v1" ? lang : null, setItem() {}, removeItem() {} };
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
    window,
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
    lettering: slots[2],
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

// 이 가짜 화면에는 Image와 data-lettering-* 속성이 없다. 그 언어 그림을 받지 못한 경우와 같아 글자 제목이 남는다.
// 그림을 바꾸는 순서는 아래 「언어별 제목 그림」 검사들이 letteringSwitcher만 떼어 본다.
test("영어·중국어 화면은 그 언어 그림을 받기 전에는 한국어 제목 그림이 받아져도 숨긴 채 두고 다른 그림은 보인다", () => {
  for (const lang of ["en", "zh"]) {
    const shown = loadLanding({ lettering: waiting(), lang });
    finish(shown.lettering, drawn(1014), "load");
    finish(shown.logo, drawn(782), "load");
    assert.equal(shown.lettering.hidden, true, lang);
    assert.equal(shown.logo.hidden, false, lang);
    const ready = loadLanding({ lettering: drawn(1014), lang });
    assert.equal(ready.lettering.hidden, true, lang);
  }
  const korean = loadLanding({ lettering: waiting() });
  finish(korean.lettering, drawn(1014), "load");
  assert.equal(korean.lettering.hidden, false);
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

// ── 언어별 제목 그림과 교내 주요 사이트 퀵링크 캐러셀(#122) ─────────────────────────
// chat.js에서 해당 함수 묶음만 떼어 가짜 그림·가짜 요소로 돌린다. 실제 학교 사이트에는 요청하지 않는다.
const langCode = script.slice(0, script.indexOf("function trimConversations("));
function scriptBetween(from, until) {
  const start = script.indexOf(from);
  const end = script.indexOf(until, start);
  assert.ok(start >= 0 && end > start, from);
  return script.slice(start, end);
}

class LetteringImage {
  constructor(attributes) {
    this.attributes = new Map(Object.entries(attributes));
    this.complete = true;
    this.naturalWidth = 1014;
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
}
const titleAttributes = {
  src: "/chat-assets/title-lettering.png", alt: "졸업까지, 아이오와 함께",
  "data-lettering-en": "/chat-assets/title-lettering-en.png?v=fictional-en",
};
// 누가 중국어 주소를 다시 적어도 중국어 화면이 글자 제목으로 남는지 보려고 가상 속성을 하나 더한 그림이다.
const titleWithFictionalZh = { ...titleAttributes, "data-lettering-zh": "/chat-assets/title-lettering-zh.png?v=fictional-zh" };
function letteringPage(attributes = titleAttributes, { withImage = true } = {}) {
  const probes = [];
  // 브라우저의 Image 대신 쓰는 가짜 그림. answer()를 부를 때까지 응답이 오지 않는다.
  class Image {
    constructor() { this.listeners = {}; this.naturalWidth = 0; this.naturalHeight = 0; probes.push(this); }
    addEventListener(type, listener) { this.listeners[type] = listener; }
    setAttribute(name, value) { this[name] = String(value); }
    answer(ok, width = 1200, height = 400) {
      if (ok) Object.assign(this, { naturalWidth: width, naturalHeight: height });
      this.listeners[ok ? "load" : "error"]();
    }
  }
  const image = new LetteringImage(attributes);
  const context = { image, swaps: 0, ...(withImage ? { Image } : {}) };
  runInNewContext(langCode + scriptBetween("function letteringSwitcher(", "// 퀵링크 카드 한 장") +
    "\nconst switcher = letteringSwitcher(image); switcher.onSwap = () => { swaps += 1; };", context);
  return {
    image, probes,
    swaps: () => context.swaps,
    switchTo(lang) { runInNewContext(`uiLang = ${JSON.stringify(lang)}; switcher.follow();`, context); },
    ready: () => runInNewContext("switcher.ready()", context),
  };
}

test("언어별 제목 그림: 받은 뒤에만 주소·alt를 바꾸고 이미지 비율을 사용한다", () => {
  const page = letteringPage();
  assert.equal(page.ready(), true);
  page.switchTo("ko");
  assert.equal(page.probes.length, 0);

  page.switchTo("en");
  assert.deepEqual(page.probes.map(probe => probe.src), ["/chat-assets/title-lettering-en.png?v=fictional-en"]);
  // 받는 중에는 한국어 그림을 그대로 두고 자리를 숨기게 한다.
  assert.equal(page.ready(), false);
  assert.equal(page.image.getAttribute("src"), "/chat-assets/title-lettering.png");
  page.probes[0].answer(true, 1200, 400);
  assert.equal(page.ready(), true);
  assert.equal(page.swaps(), 1);
  assert.deepEqual(Object.fromEntries(["src", "alt", "width", "height"].map(name => [name, page.image.getAttribute(name)])), {
    src: "/chat-assets/title-lettering-en.png?v=fictional-en", alt: "To graduation, with AIO", width: null, height: null,
  });

  // 한국어로 돌아오면 처음 주소·alt를 다시 쓴다.
  page.switchTo("ko");
  assert.equal(page.ready(), true);
  assert.deepEqual(Object.fromEntries(["src", "alt", "width", "height"].map(name => [name, page.image.getAttribute(name)])), {
    src: "/chat-assets/title-lettering.png", alt: "졸업까지, 아이오와 함께", width: null, height: null,
  });

  // 404나 깨진 그림이면 한국어 그림을 그대로 두고 자리를 숨긴다. 바로 뒤의 영어 글자 제목이 보인다.
  const missing = letteringPage();
  missing.switchTo("en");
  missing.probes[0].answer(false);
  assert.equal(missing.ready(), false);
  assert.equal(missing.swaps(), 0);
  assert.equal(missing.image.getAttribute("src"), "/chat-assets/title-lettering.png");

  const bare = letteringPage(titleAttributes, { withImage: false });
  assert.doesNotThrow(() => bare.switchTo("en"));
  assert.equal(bare.ready(), false);
  const unlisted = letteringPage({ src: "/chat-assets/title-lettering.png", alt: "졸업까지, 아이오와 함께" });
  unlisted.switchTo("en");
  assert.equal(unlisted.probes.length, 0);
  assert.equal(unlisted.ready(), false);
});

test("언어별 제목 그림: 중국어는 주소 속성이 있어도 그림을 받지 않고 늘 글자 제목을 보인다", () => {
  const page = letteringPage(titleWithFictionalZh);
  page.switchTo("zh");
  assert.equal(page.probes.length, 0);
  assert.equal(page.ready(), false);
  assert.equal(page.image.getAttribute("src"), "/chat-assets/title-lettering.png");

  // 영어 그림이 보이던 중에 중국어로 바꿔도 영어 그림을 보이지 않고 글자 제목으로 바꾼다.
  page.switchTo("en");
  page.probes[0].answer(true);
  assert.equal(page.ready(), true);
  page.switchTo("zh");
  assert.equal(page.probes.length, 1);
  assert.equal(page.ready(), false);
  page.switchTo("ko");
  assert.equal(page.ready(), true);
  assert.equal(page.image.getAttribute("src"), "/chat-assets/title-lettering.png");
});

test("언어별 제목 그림: ko→en→zh를 빠르게 바꾸면 늦게 온 영어 그림은 버리고 중국어 글자 제목을 남긴다", () => {
  const page = letteringPage(titleWithFictionalZh);
  page.switchTo("en");
  page.switchTo("zh");
  assert.equal(page.probes.length, 1);
  page.probes[0].answer(true, 1200, 400);
  assert.equal(page.image.getAttribute("src"), "/chat-assets/title-lettering.png");
  assert.equal(page.image.getAttribute("alt"), "졸업까지, 아이오와 함께");
  assert.equal(page.swaps(), 0);
  assert.equal(page.ready(), false);

  // 받는 도중 한국어로 돌아와도, 늦게 온 그림이 한국어 그림을 덮지 않는다.
  const back = letteringPage();
  back.switchTo("en");
  back.switchTo("ko");
  back.probes[0].answer(true);
  assert.equal(back.image.getAttribute("src"), "/chat-assets/title-lettering.png");
  assert.equal(back.swaps(), 0);
  assert.equal(back.ready(), true);

  // 메인 제목은 크기 속성 없이 시작하므로 바꾼 뒤에도 크기를 적지 않는다. 높이는 CSS가 정한다.
  const main = letteringPage({ src: "/chat-assets/main-lettering.png", alt: "물어봐요, 아이오",
    "data-lettering-en": "/chat-assets/main-lettering-en.png" });
  main.switchTo("en");
  main.probes[0].answer(true, 900, 200);
  assert.equal(main.image.getAttribute("src"), "/chat-assets/main-lettering-en.png");
  assert.equal(main.image.getAttribute("alt"), "Ask AIO");
  assert.equal(main.image.getAttribute("width"), null);
  assert.equal(main.image.getAttribute("height"), null);
  main.switchTo("ko");
  assert.equal(main.image.getAttribute("width"), null);
  assert.equal(main.image.getAttribute("src"), "/chat-assets/main-lettering.png");
});

// 서버가 두 그림을 내주는지는 test_web.py가 본다. 여기서는 화면 쪽 주소만 본다.
test("두 제목 그림은 영어 주소만 data 속성으로 갖고 중국어 주소는 없다", () => {
  for (const kind of ["title", "main"]) {
    const tag = new RegExp(`<img src="/chat-assets/${kind}-lettering\\.png"[^>]*>`).exec(html)?.[0] ?? "";
    assert.ok(tag.includes(`data-lettering-en="/chat-assets/${kind}-lettering-en.png"`), kind);
    assert.doesNotMatch(tag, /\s(?:width|height)=/);
  }
  assert.doesNotMatch(html + script, /lettering-zh/);
});

// 운영자가 2026-11-17 학교 누리집에서 확인한 순서와 주소다. chat.js의 목록과 따로 적어 서로 견준다.
const campusQuickLinks = [
  ["학교 홈페이지", "공지와 학교 소식", "https://www.kumoh.ac.kr/ko/index.do"],
  ["포털(Onekit)", "수강신청·성적·학적", "https://onekit.kumoh.ac.kr/"],
  ["BISKIT", "비교과·마일리지", "https://biskit.kumoh.ac.kr/"],
  ["학습관리시스템(LMS)", "강의 자료와 과제", "https://lms.kumoh.ac.kr/"],
  ["도서관", "자료 검색·열람실", "https://library.kumoh.ac.kr/"],
  ["생활관(기숙사)", "입사 신청과 생활 안내", "https://dorm.kumoh.ac.kr/"],
  ["학사일정", "학기 주요 날짜", "https://www.kumoh.ac.kr/ko/schedule.do"],
  ["식당 메뉴", "오늘의 학식", "https://www.kumoh.ac.kr/ko/restaurant02.do"],
  ["웹메일", "학교 메일", "https://mail.kumoh.ac.kr/"],
  ["학생상담센터", "심리·진로 상담", "https://consult.kumoh.ac.kr/"],
  ["국제교류·어학교육", "교환학생·한국어 과정", "https://iplec.kumoh.ac.kr/"],
  ["교내 전화번호", "부서 연락처", "https://www.kumoh.ac.kr/ko/campusTel.do"],
  ["에브리타임", "학생 커뮤니티·시간표", "https://everytime.kr/"],
];

class CarouselNode {
  constructor(tag) {
    Object.assign(this, { tag, children: [], attributes: new Map(), listeners: new Map(), className: "", textContent: "", hidden: false });
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  addEventListener(type, listener) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  fire(type) { for (const listener of this.listeners.get(type) ?? []) listener({}); }
  classes() { return (this.getAttribute("class") ?? this.className).split(/\s+/); }
  all(name) { return this.children.filter(child => child instanceof CarouselNode).flatMap(child => [...(child.classes().includes(name) ? [child] : []), ...child.all(name)]); }
  querySelector(selector) { return this.all(selector.slice(1))[0] ?? null; }
  get text() { return this.children.length ? this.children.map(child => child.text).join("") : this.textContent; }
}
function carouselPage({ clientWidth = 600, scrollWidth = 2800, reduced = false, observer = true } = {}) {
  const observers = [], resizes = [];
  const roots = ["login", "main"].map(() => {
    const root = new CarouselNode("nav");
    const button = name => Object.assign(new CarouselNode("button"), { className: `quicklink-nav ${name}`, hidden: true });
    const prev = button("quicklink-prev"), next = button("quicklink-next");
    prev.setAttribute("aria-disabled", "true");
    next.setAttribute("aria-disabled", "true");
    const track = Object.assign(new CarouselNode("ul"), { className: "quicklink-track", clientWidth, scrollWidth, scrollLeft: 0, moves: [] });
    track.scrollBy = function (options) {
      // vm 안에서 만든 객체는 프로토타입이 달라 deepEqual이 어긋난다. 이 테스트 쪽 객체로 옮겨 적는다.
      this.moves.push({ left: options.left, behavior: options.behavior });
      this.scrollLeft = Math.min(Math.max(0, this.scrollLeft + options.left), this.scrollWidth - this.clientWidth);
    };
    const viewport = Object.assign(new CarouselNode("div"), { className: "quicklink-viewport" });
    viewport.append(track);
    root.append(prev, viewport, next);
    return { root, prev, next, track };
  });
  const context = {
    document: {
      querySelectorAll: selector => selector === "[data-quicklink-carousel]" ? roots.map(({ root }) => root) : [],
      createElement: tag => new CarouselNode(tag),
      createElementNS: (namespace, tag) => Object.assign(new CarouselNode(tag), { namespace }),
    },
    window: { addEventListener: (type, listener) => { if (type === "resize") resizes.push(listener); } },
    reducedMotion: () => reduced,
    element(tag, className, text) {
      const node = new CarouselNode(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    },
    ResizeObserver: observer ? class { constructor(callback) { this.callback = callback; observers.push(this); } observe(node) { this.node = node; } } : undefined,
  };
  runInNewContext(langCode + scriptBetween("const svgNamespace =", "setupQuickLinks();") + "\nsetupQuickLinks();", context);
  return {
    roots, observers, resizes,
    switchTo(lang) { runInNewContext(`uiLang = ${JSON.stringify(lang)}; for (const listener of langListeners) listener();`, context); },
    measure() { runInNewContext("measureQuickLinks();", context); },
  };
}
const cardsOf = ({ track }) => track.children.map(item => item.children[0]);
const cardPart = (card, name) => card.all(name)[0]?.text;

test("퀵링크 캐러셀: 두 바닥이 같은 목록으로 카드 13장을 순서대로 그리고 새 창·외부 서비스 표시를 붙인다", () => {
  const page = carouselPage();
  for (const carousel of page.roots) {
    const cards = cardsOf(carousel);
    assert.equal(carousel.track.children.length, 13);
    assert.ok(carousel.track.children.every(item => item.tag === "li" && item.className === "quicklink-item"));
    assert.deepEqual(cards.map(card => [cardPart(card, "quicklink-name"), cardPart(card, "quicklink-desc"), card.getAttribute("href")]), campusQuickLinks);
    for (const card of cards) {
      assert.equal(card.tag, "a");
      assert.equal(card.className, "quicklink-card");
      assert.equal(card.getAttribute("target"), "_blank");
      assert.equal(card.getAttribute("rel"), "noopener noreferrer");
      assert.ok(card.getAttribute("href").startsWith("https://"));
      assert.equal(cardPart(card, "sr-only"), " (새 창)");
      // 선 아이콘 두 개(사이트 아이콘·새 창 표시)는 읽지 않고, 채운 도형 없이 선으로만 그린다.
      const icons = card.children.filter(child => child.tag === "svg");
      assert.deepEqual(icons.map(icon => icon.getAttribute("class")), ["quicklink-icon", "external-link-icon"]);
      for (const icon of icons) {
        assert.equal(icon.namespace, "http://www.w3.org/2000/svg");
        assert.deepEqual([icon.getAttribute("aria-hidden"), icon.getAttribute("focusable"), icon.getAttribute("fill"), icon.getAttribute("stroke")],
          ["true", "false", "none", "currentColor"]);
        assert.ok(icon.children.length > 0 && icon.children.every(path => path.tag === "path" && path.getAttribute("d")));
      }
    }
    // 학교 공식 사이트가 아닌 에브리타임에만 외부 서비스 표시가 붙는다.
    assert.deepEqual(cards.map(card => cardPart(card, "quicklink-badge") ?? null),
      [...Array(12).fill(null), "외부 서비스"]);
  }
  // 두 바닥은 같은 카드를 그리지만 요소는 따로다.
  assert.notEqual(page.roots[0].track.children[0], page.roots[1].track.children[0]);
});

test("퀵링크 캐러셀: 언어를 바꾸면 이름·설명·표시·(새 창)을 사전으로 다시 그리고, 한국어로 돌아온다", () => {
  const page = carouselPage();
  page.switchTo("en");
  let cards = cardsOf(page.roots[1]);
  assert.deepEqual([cardPart(cards[0], "quicklink-name"), cardPart(cards[0], "quicklink-desc"), cardPart(cards[0], "sr-only")],
    ["University website", "Notices and campus news", " (new window)"]);
  assert.equal(cardPart(cards[2], "quicklink-name"), "BISKIT");
  assert.equal(cardPart(cards[12], "quicklink-badge"), "External service");
  page.switchTo("zh");
  cards = cardsOf(page.roots[0]);
  assert.deepEqual([cardPart(cards[4], "quicklink-name"), cardPart(cards[4], "quicklink-desc")], ["图书馆", "资料检索·阅览室"]);
  assert.equal(cardPart(cards[12], "quicklink-badge"), "外部服务");
  assert.equal(cardPart(cards[12], "sr-only"), " （新窗口）");
  page.switchTo("ko");
  assert.deepEqual(cardsOf(page.roots[0]).map(card => cardPart(card, "quicklink-name")), campusQuickLinks.map(([name]) => name));
  // 모든 이름·설명·버튼 이름·표시는 영어·중국어 사전에 있다. BISKIT은 고유 이름이라 그대로 쓴다.
  const { en, zh } = runInNewContext(langCode + "\nuiText", {});
  for (const key of [...campusQuickLinks.flatMap(([name, description]) => [name, description]), "외부 서비스", "이전 사이트 보기", "다음 사이트 보기"]) {
    if (key === "BISKIT") continue;
    assert.ok(Object.hasOwn(en, key) && Object.hasOwn(zh, key), key);
  }
});

test("퀵링크 캐러셀: ‹ ›는 보이는 폭만큼 부드럽게 넘기고 끝에서는 그쪽 버튼을 aria-disabled로 둔다", () => {
  const page = carouselPage();
  const { root, prev, next, track } = page.roots[0];
  assert.deepEqual([prev.hidden, next.hidden], [false, false]);
  assert.deepEqual([prev.getAttribute("aria-disabled"), next.getAttribute("aria-disabled")], ["true", "false"]);
  assert.deepEqual([root.getAttribute("data-at-start"), root.getAttribute("data-at-end")], ["true", "false"]);
  // 처음 자리에서 ‹는 움직이지 않는다.
  prev.fire("click");
  assert.deepEqual(track.moves, []);

  next.fire("click");
  assert.deepEqual(track.moves, [{ left: 600, behavior: "smooth" }]);
  assert.deepEqual([prev.getAttribute("aria-disabled"), next.getAttribute("aria-disabled")], ["false", "false"]);
  prev.fire("click");
  assert.deepEqual(track.moves.at(-1), { left: -600, behavior: "smooth" });

  // 손가락·트랙패드로 끝까지 밀면 scroll 신호로 다시 잰다. 끝 판정에는 1px 오차를 허용한다.
  track.scrollLeft = 2199.5;
  track.fire("scroll");
  assert.deepEqual([prev.getAttribute("aria-disabled"), next.getAttribute("aria-disabled")], ["false", "true"]);
  assert.equal(root.getAttribute("data-at-end"), "true");
  const moves = track.moves.length;
  next.fire("click");
  assert.equal(track.moves.length, moves);

  // 움직임 줄이기 설정이면 즉시 옮긴다.
  const calm = carouselPage({ reduced: true });
  calm.roots[1].next.fire("click");
  assert.deepEqual(calm.roots[1].track.moves, [{ left: 600, behavior: "auto" }]);
});

test("퀵링크 캐러셀: 카드가 다 보이면 버튼을 숨기고, 폭이 0인 숨은 화면은 판정을 미뤘다가 크기 변화에 다시 잰다", () => {
  const fits = carouselPage({ clientWidth: 2800, scrollWidth: 2801 });
  for (const { root, prev, next } of fits.roots) {
    assert.deepEqual([prev.hidden, next.hidden], [true, true]);
    assert.deepEqual([root.getAttribute("data-at-start"), root.getAttribute("data-at-end")], ["true", "true"]);
  }

  const hidden = carouselPage({ clientWidth: 0, scrollWidth: 0 });
  const [login] = hidden.roots;
  assert.deepEqual([login.prev.hidden, login.next.hidden], [true, true]);
  assert.equal(login.root.getAttribute("data-at-start"), null);
  // 화면이 보이면 ResizeObserver가 track을 다시 잰다.
  assert.deepEqual(hidden.observers.map(observer => observer.node), hidden.roots.map(({ track }) => track));
  Object.assign(login.track, { clientWidth: 600, scrollWidth: 2800 });
  hidden.observers[0].callback();
  assert.deepEqual([login.prev.hidden, login.next.hidden], [false, false]);
  assert.equal(login.next.getAttribute("aria-disabled"), "false");

  // ResizeObserver가 없는 브라우저에서도 멈추지 않고, 창 크기 신호로 다시 잰다.
  // 창 크기 신호는 테크모 resize 처리기 하나가 받아 measureQuickLinks를 부른다. 처리기를 따로 늘리지 않는다.
  const old = carouselPage({ clientWidth: 0, scrollWidth: 0, observer: false });
  assert.equal(old.observers.length, 0);
  assert.equal(old.resizes.length, 0);
  Object.assign(old.roots[1].track, { clientWidth: 600, scrollWidth: 2800 });
  old.measure();
  assert.equal(old.roots[1].next.hidden, false);
  const resizeHandler = /window\.addEventListener\?\.\("resize", \(\) => \{[\s\S]*?\n\}\);/.exec(script)?.[0] ?? "";
  assert.match(resizeHandler, /refreshTechmoBubbleVisibility\(\)[\s\S]*measureQuickLinks\(\)/);
});

test("퀵링크 캐러셀의 마크업과 CSS: 빈 카드 줄·숨은 버튼·scroll-snap·클릭을 막지 않는 양 끝 흐림", () => {
  for (const id of ["login-campus-site-links", "main-campus-site-links"]) {
    const nav = new RegExp(`<nav class="quicklink-carousel" id="${id}" aria-label="교내 주요 사이트" data-quicklink-carousel>[\\s\\S]*?</nav>`).exec(html)?.[0] ?? "";
    assert.match(nav, /<button type="button" class="quicklink-nav quicklink-prev" aria-label="이전 사이트 보기" aria-disabled="true" hidden>/, id);
    assert.match(nav, /<div class="quicklink-viewport"><ul class="quicklink-track"><\/ul><\/div>/, id);
    assert.match(nav, /<button type="button" class="quicklink-nav quicklink-next" aria-label="다음 사이트 보기" aria-disabled="true" hidden>/, id);
    assert.doesNotMatch(nav, /<a\b/, id);
  }
  assert.equal(declared(".quicklink-track", ["scroll-snap-type"]), "x mandatory");
  assert.equal(declared(".quicklink-track", ["overflow-x"]), "auto");
  assert.equal(declared(".quicklink-item", ["scroll-snap-align"]), "start");
  assert.equal(declared(".quicklink-nav", ["border-radius"]), "50%");
  assert.equal(declared(".quicklink-viewport::before", ["pointer-events"], ".quicklink-viewport::after"), "none");
  assert.equal(declared(".quicklink-viewport::after", ["pointer-events"], ".quicklink-viewport::before"), "none");
  assert.equal(declared('.quicklink-carousel[data-at-start="true"] .quicklink-viewport::before', ["opacity"]), "0");
  assert.equal(declared('.quicklink-carousel[data-at-end="true"] .quicklink-viewport::after', ["opacity"]), "0");
  // 카드에는 transition을 걸지 않는다. 움직임은 scrollBy 넘김 하나이고 움직임 줄이기 설정은 chat.js가 따른다.
  assert.equal(find(".quicklink-card", ["transition", "transform"]), undefined);
  assert.equal(find(".quicklink-card:hover", ["transition", "transform"]), undefined);
  // 카드 글자는 메인·로그인 바닥 양쪽에서, 밝고 어두운 사진 위에서 4.5 이상이다.
  for (const footer of [".site-footer", "#login-site-footer"]) {
    checkText([
      [".quicklink-name", ".quicklink-card"], [".quicklink-desc", ".quicklink-card"], [".quicklink-badge", ".quicklink-card"],
      [".quicklink-name", ".quicklink-card:hover"], [".quicklink-desc", ".quicklink-card:hover"],
    ], { ...parents, ".quicklink-card": footer, ".quicklink-card:hover": footer });
  }
});
