// 첫 화면 모핑·전환의 구조와 모양 테스트 (#67). 브라우저와 서버를 띄우지 않고 실제 index.html·chat.css와
// 설계 문서(UI_NOTES.md)를 읽어, 스크립트(chat.js)와 함께 지키기로 한 이름과 움직임 규칙이 그대로인지 확인한다.
// chat.js는 실행하지 않는다. 카드를 눌러 패널을 여닫는 동작은 feature_panels.test.mjs가 맡는다.
// 실제 전환, 겹침, 초점 위치, 390px에서의 입력창 좌표는 브라우저에서 따로 확인한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../../app/chat_web/index.html");
const styles = read("../../app/chat_web/assets/chat.css").replace(/\/\*[\s\S]*?\*\//g, "");
const notes = read("../../../web/docs/UI_NOTES.md");

// 카드별 패널 표. [식별자, 카드 이름, 준비 중 여부, 시작 버튼 문구, 시작 버튼이 부르는 동작] 순서다.
const features = [
  ["graduation", "졸업 체크", false, "졸업 체크 시작", "graduation"],
  ["biskit", "비교과 추천", false, "졸업 체크와 추천 보기", "graduation"],
  ["photo", "사진으로 묻기", false, "사진 선택", "photo"],
  ["ask", "규정 질문", false, "질문 입력하기", "ask"],
  ["calendar", "학사 일정", false, null, null],
  ["campus", "캠퍼스 안내", false, null, null],
];

// --- index.html 읽기 -------------------------------------------------------------------------

const landing = /<div id="empty"[\s\S]*?(?=<noscript>)/.exec(html)?.[0] ?? "";
const cards = [...landing.matchAll(/<button type="button" class="card[^>]*>[\s\S]*?<\/button>/g)].map(match => match[0]);
// 패널 안에는 다른 section이 없어, 여는 태그부터 첫 닫는 태그까지가 패널 하나다.
const panels = [...landing.matchAll(/<section class="feature-panel"[^>]*>[\s\S]*?<\/section>/g)].map(match => match[0]);

test("카드 여섯 개는 모두 패널을 가리키는 버튼이고, 기능을 바로 부르는 표시(data-action)가 없다", () => {
  assert.equal(cards.length, features.length);
  features.forEach(([id, title, soon], index) => {
    const opening = `<button type="button" class="card${soon ? " soon" : ""}" data-feature="${id}"`
      + ` aria-controls="panel-${id}" aria-expanded="false">`;
    assert.ok(cards[index].startsWith(opening), id);
    const content = cards[index].slice(opening.length).trimStart();
    assert.match(content, /^<span class="card-heading"><span class="feature-badge" aria-hidden="true">/, id);
    assert.ok(content.includes(`<span class="card-title">${title}</span>`), id);
    assert.match(cards[index], /<span class="card-text">[^<]+<\/span>/, id);
    assert.equal(cards[index].includes("data-action"), false, id);
    // 서버 자료가 연결된 카드에는 준비 중 표시가 없다.
    assert.equal(cards[index].includes('<span class="soon-label">준비 중</span>'), soon, id);
  });

  // 카드 목록에는 스크립트가 찾을 이름이 하나 있고, 카드는 모두 그 목록 안에 있다.
  assert.equal(html.split('id="feature-cards"').length, 2);
  const list = /<ul class="cards" id="feature-cards">[\s\S]*?<\/ul>/.exec(landing)?.[0] ?? "";
  assert.equal(list.split("data-feature=").length - 1, features.length);
  assert.equal(html.split("data-feature=").length - 1, features.length);
});

test("패널 여섯 개는 숨긴 채 시작하고 제목·닫기·시작 버튼이 표와 같다", () => {
  assert.equal(panels.length, features.length);
  features.forEach(([id, title, soon, label, action], index) => {
    const panel = panels[index];
    const opening = `<section class="feature-panel" id="panel-${id}" data-panel="${id}"`
      + ` aria-labelledby="panel-${id}-title" hidden>`;
    assert.ok(panel.startsWith(opening), id);
    assert.equal(html.split(`id="panel-${id}"`).length, 2, id);

    // 제목은 열릴 때 초점을 받는다. Tab 순서에는 들지 않는다.
    const heading = new RegExp(`<h4 class="panel-title" id="panel-${id}-title" data-panel-title tabindex="-1">([\\s\\S]*?)<\\/h4>`).exec(panel)?.[1] ?? "";
    assert.match(heading, /^<span class="feature-badge" aria-hidden="true">/, id);
    assert.ok(heading.trimEnd().endsWith(title), id);
    assert.equal(panel.split("data-panel-title").length, 2, id);
    assert.equal(panel.split('<button type="button" class="panel-close" data-panel-close>닫기</button>').length, 2, id);
    assert.equal(panel.split("data-panel-close").length, 2, id);
    assert.match(panel, /<p class="panel-text">[^<]+<\/p>/, id);

    const starts = [...panel.matchAll(/<button type="button" class="cta" data-action="([a-z]+)">([^<]+)<\/button>/g)]
      .map(match => [match[2], match[1]]);
    assert.deepEqual(starts, label ? [[label, action]] : [], id);
    assert.equal(panel.split("data-action=").length - 1, starts.length, id);
    assert.equal(panel.includes('<span class="soon-label">준비 중</span>'), soon, id);
    // 조회 패널은 열 때 자료를 불러오므로 별도 시작 버튼이 없다.
    assert.equal(panel.split("<button").length - 1, label ? 2 : 1, id);
    if (!label) assert.match(panel, /<div data-panel-content aria-live="polite"><\/div>/, id);
  });
});

test("패널은 #empty 안, 카드 목록 바로 뒤의 글 흐름에 있고 화면 위에 띄우는 요소를 쓰지 않는다", () => {
  const listEnd = landing.indexOf("</ul>");
  const firstPanel = landing.indexOf('<section class="feature-panel"');
  assert.ok(landing.indexOf('id="feature-cards"') < listEnd);
  assert.ok(listEnd < firstPanel);
  assert.equal(html.split('class="feature-panel"').length - 1, panels.length);
  // 카드 목록과 첫 패널 사이에는 주석 말고 다른 요소가 없다.
  assert.equal(landing.slice(listEnd + "</ul>".length, firstPanel).replace(/<!--[\s\S]*?-->/g, "").trim(), "");

  // 예시 질문 묶음은 구조가 바뀌어도 한 번만 남는다.
  assert.equal(html.includes("<dialog"), false);

  // 화면 보안 정책이 막는 방식과, 스크립트가 붙였다 떼는 표시는 처음 화면에 없다.
  for (const blocked of [/\sstyle=/, /<style\b/, /data-morph/, /view-transition/]) assert.doesNotMatch(html, blocked);
  // 다른 화면 테스트가 지키는 약속: 펫은 #empty 밖에 있고, 예전 버튼 문구는 화면에 없다.
  assert.equal(landing.includes("pet"), false);
  assert.equal(landing.includes("테크모에게 묻기"), false);
  assert.equal(html.includes("가상 학생 졸업 체크"), false);
});

// --- chat.css 읽기 ---------------------------------------------------------------------------

// "머리말 { ... }" 묶음의 안쪽 글자를 돌려준다. 중괄호 짝을 세어 @media와 @keyframes 안의 규칙까지 담는다.
function block(header) {
  const start = styles.indexOf(header);
  assert.notEqual(start, -1, header);
  const open = styles.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < styles.length; index += 1) {
    if (styles[index] === "{") depth += 1;
    else if (styles[index] === "}") depth -= 1;
    if (depth === 0) return styles.slice(open + 1, index).replace(/\s+/g, " ").trim();
  }
  throw new Error(`${header}: 닫는 중괄호가 없다`);
}

// [선택자, 선언 글자] 목록. 글자 묶음을 주면 그 안의 규칙만 나눈다.
const split = text => [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [
  selector.replace(/\s+/g, " ").trim(),
  body.replace(/\s+/g, " ").trim(),
]);
const rules = split(styles);
const narrowRules = split(block("@media (max-width: 680px)"));
const calmRules = [...styles.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].flatMap(match => split(match[1]));
// 선택자가 정확히 같은 첫 규칙의 선언. 화면 너비 조건 밖의 기본 규칙이 파일에서 먼저 온다.
const first = (selector, list = rules) => list.find(([name]) => name === selector)?.[1] ?? "";
// 선언 글자에서 속성 하나의 값을 꺼낸다.
const value = (body, property) => new RegExp(`(?:^|; )${property}: ([^;]+);`).exec(body)?.[1];
const pixels = text => {
  assert.match(text ?? "", /^\d+px$/, `픽셀 값이 아니다: ${text}`);
  return Number.parseInt(text, 10);
};

test("모바일 로고는 높이 20px 이상과 비율에 맞는 자리를 확보한다", () => {
  const logo = first(".brand-logo img", narrowRules);
  const minimumHeight = pixels(value(logo, "min-height"));
  assert.ok(minimumHeight >= 20);
  assert.ok(pixels(value(logo, "height")) >= minimumHeight);
  assert.equal(value(logo, "width"), "auto");

  const brandFlex = value(first(".brand", narrowRules), "flex");
  assert.match(brandFlex, /^0 0 \d+px$/);
  const reservedWidth = pixels(brandFlex.split(" ")[2]);
  assert.ok(reservedWidth >= minimumHeight * 782 / 113);
});

test("학생 로그인 버튼은 좁은 화면에서도 글자를 한 줄로 유지한다", () => {
  assert.equal(value(first(".login"), "white-space"), "nowrap");
  assert.equal(value(first(".masthead-actions"), "flex-wrap"), "nowrap");
});

test("전환 이름은 CSS가 누른 카드와 열린 패널에만 주고, 패널이 열리면 카드 목록은 보이지 않는다", () => {
  const named = rules.filter(([, body]) => body.includes("view-transition-name"));
  assert.deepEqual(named, [[".card[data-morph], .feature-panel:not([hidden])", "view-transition-name: feature-morph;"], [".composer-row", "view-transition-name: chat-composer;"], [".layout", "view-transition-name: chat-surface;"]]);
  // 숨긴 요소는 그려지지 않아 이름을 갖지 않는다. hidden 속성이 display 선언에 지지 않아야 한다.
  assert.equal(first("[hidden]"), "display: none !important;");
  // 같은 이름이 한 화면에 둘 보이지 않게, 패널이 열려 있으면 카드 목록을 그리지 않는다.
  assert.equal(first(".features:has(> .feature-panel:not([hidden])) > .cards"), "display: none;");

  // 전환의 길이만 정한다. 움직임 자체는 브라우저 기본값을 쓴다.
  const group = first("::view-transition-group(feature-morph)");
  assert.match(value(group, "animation-duration") ?? "", /^\.\d+s$/);
  assert.ok(Number.parseFloat(`0${value(group, "animation-duration")}`) <= 0.5);
});

test("패널은 자리를 차지하는 상자라 펫·말풍선·입력창 위에 뜨지 않는다", () => {
  const panelRules = rules.filter(([selector]) => /panel/.test(selector));
  assert.ok(panelRules.length > 0);
  for (const [selector, body] of panelRules) {
    assert.doesNotMatch(body, /(?:^|; )(?:position|z-index|inset|top|bottom|transform): /, selector);
  }
  assert.match(first(".feature-panel"), /^display: grid;/);
  // 화면에 고정하는 요소는 넓은 화면의 펫 줄과 공통 배경뿐이다.
  assert.deepEqual(rules.filter(([, body]) => body.includes("position: fixed")).map(([selector]) => selector), [".pet-dock", ".campus-backdrop", 'body[data-view="chat"] .layout', "#conversation-toast", 'body[data-view="chat"] .pet-dock', "#conversation-sidebar", "#conversation-backdrop", '.pet-dock[data-placed="true"], body[data-view="chat"] .pet-dock[data-placed="true"]']);

  // 닫기와 시작 버튼은 손가락으로 누를 만한 높이다.
  assert.equal(value(first(".panel-close"), "min-height"), "44px");
  assert.equal(value(first(".reset, .primary, .check, .cta, .login"), "min-height"), "44px");
});

test("초점을 받은 버튼과 패널 제목이 좁은 화면의 펫 줄 밑에 숨지 않게 아래쪽 여유를 둔다", () => {
  const margin = value(first(".empty button, .panel-title"), "scroll-margin-block") ?? "";
  const [top, bottom] = margin.split(" ").map(pixels);
  assert.ok(top >= 0);
  // 펫 줄은 펫 그림(56px)과 위아래 여백으로 70px쯤이다. 말풍선이 두 줄이 되어도 가리지 않을 만큼 둔다.
  const petWidth = pixels(/^flex: none; width: (\d+px);/.exec(first(".pet"))?.[1]);
  assert.ok(bottom >= petWidth * 2, `아래쪽 여유 ${bottom}px`);
  // 부드러운 이동을 문서 전체에 걸지 않는다. 대화 칸의 overscroll-behavior는 다른 속성이다.
  assert.doesNotMatch(styles, /(?<!over)scroll-behavior/);
});

test("도형은 모서리 둥글기만 12초 주기로 바꿔 구슬 꼴과 네모꼴 사이를 오가고, 테크모 그림은 변형하지 않는다", () => {
  const shape = first(".hero-art::before");
  assert.equal(value(shape, "animation"), "shape-morph 12s ease-in-out infinite");
  const bead = value(shape, "border-radius");
  assert.notEqual(bead, undefined);

  const steps = split(block("@keyframes shape-morph"));
  assert.deepEqual(steps.map(([name]) => name), ["0%, 100%", "50%"]);
  // 바꾸는 속성은 border-radius 하나다. 크기·위치·색은 그대로다.
  for (const [name, body] of steps) assert.match(body, /^border-radius: [^;]+;$/, name);
  const [start, middle] = steps.map(([, body]) => value(body, "border-radius"));
  // 시작과 끝은 멈춰 있을 때의 구슬 꼴과 같다. 움직임을 꺼도 모양이 튀지 않는다.
  assert.equal(start, bead);
  // 구슬 꼴은 모서리마다 둥글기가 다르고, 네모꼴은 네 모서리가 같으며 구슬 꼴보다 덜 둥글다.
  const corners = text => text.split(" / ").map(side => side.split(" ").map(part => Number.parseFloat(part)));
  const [beadWide, beadTall] = corners(start);
  const [squareWide, squareTall] = corners(middle);
  for (const side of [beadWide, beadTall, squareWide, squareTall]) assert.equal(side.length, 4);
  assert.ok(new Set(beadWide).size > 1 && new Set(beadTall).size > 1);
  assert.equal(new Set(squareWide).size, 1);
  assert.equal(new Set(squareTall).size, 1);
  assert.ok(squareWide[0] < Math.min(...beadWide) && squareTall[0] < Math.min(...beadTall));

  // 그림과 그림 자리에는 움직임을 걸지 않는다.
  for (const selector of [".hero-art", ".hero-art img"]) {
    assert.doesNotMatch(first(selector), /animation|transform|transition/, selector);
  }
  assert.equal(rules.filter(([, body]) => body.includes("shape-morph")).length, 1);
});

test("390px 묶음은 그림을 120px 이하로 줄여 제목 옆에 놓고 카드의 간격·패딩·글자 높이를 줄인다", () => {
  const narrow = selector => first(selector, narrowRules);

  // 그림: 기본 240px 자리에서 120px 이하 고정 폭으로. 소개 글 묶음의 상자를 없애 제목과 같은 줄에 선다.
  assert.match(first(".hero-art"), /flex: 0 1 240px;/);
  assert.ok(pixels(value(narrow(".hero-art"), "width")) <= 120);
  assert.equal(value(narrow(".hero-art"), "flex"), "none");
  assert.equal(narrow(".hero-copy"), "display: contents;");
  assert.equal(value(narrow(".hero"), "flex-wrap"), "wrap");
  // 순서: 제목(0) → 그림(1) → 설명(2) → 버튼(3). 설명과 버튼은 한 줄을 다 쓴다.
  assert.equal(value(narrow(".hero h2"), "order"), undefined);
  assert.equal(value(narrow(".hero-art"), "order"), "1");
  assert.equal(value(narrow(".hero-copy p"), "order"), "2");
  assert.equal(value(narrow(".hero-actions"), "order"), "3");
  for (const selector of [".hero-copy p", ".hero-actions"]) assert.equal(value(narrow(selector), "flex"), "1 1 100%", selector);

  // 간격과 패딩은 기본 규칙보다 작다.
  assert.ok(pixels(value(narrow(".empty"), "gap")) < pixels(value(first(".empty"), "gap")));
  assert.ok(pixels(value(narrow(".cards"), "gap")) < pixels(value(first(".cards"), "gap")));
  assert.ok(pixels(value(narrow(".card"), "padding")) < pixels(value(first(".card"), "padding")));
  assert.ok(pixels(value(narrow(".card"), "gap")) < pixels(value(first(".card"), "gap")));
  assert.equal(value(narrow(".card"), "min-height"), "0");
  assert.ok(pixels(value(narrow(".feature-panel"), "padding")) < 18);
  // 카드는 390px에서 두 줄, 더 좁으면 한 줄이다. 칸의 최소 폭이 화면 폭을 넘지 않는다.
  assert.equal(value(narrow(".cards"), "grid-template-columns"), "repeat(auto-fit, minmax(min(150px, 100%), 1fr))");

  // 설명 글은 자르지 않는다. 글자 크기와 줄 높이만 조금 줄이고, 읽을 수 있는 크기를 지킨다.
  const size = selector => Number.parseFloat(`0${value(narrow(selector), "font-size")?.replace("rem", "")}`);
  assert.ok(size(".card-text") >= 0.8 && size(".card-text") < 0.86);
  assert.ok(size(".hero-copy p") >= 0.9 && size(".hero-copy p") < 1);
  // 상단의 긴 학생 이름만 말줄임하고 설명 글은 끝까지 보여 준다.
  for (const [selector, body] of rules) {
    if (["#demo-label", ".conversation-title"].includes(selector)) continue;
    assert.doesNotMatch(body, /line-clamp|text-overflow|max-lines/, selector);
  }
  for (const [selector, body] of narrowRules) {
    assert.doesNotMatch(body, /display: none|visibility|overflow: hidden/, selector);
  }
});

test("움직임 줄이기 설정은 도형·펫·대기 점·카드 전환의 움직임을 모두 끈다", () => {
  assert.equal(styles.split("prefers-reduced-motion").length, 4);
  assert.ok(calmRules.length >= 2);
  for (const [selector, body] of calmRules) assert.match(body, /(?:animation|transition): none(?: !important)?;/, selector);

  const stopped = calmRules.flatMap(([selector]) => selector.split(", "));
  // 묶음 밖에서 움직임을 거는 요소는 모두 이 목록에 있어야 한다. 새 움직임을 넣고 끄는 것을 잊으면 여기서 걸린다.
  const moving = rules
    .filter(([, body]) => /(?:^|; )animation: (?!none)/.test(body))
    .flatMap(([selector]) => selector.split(", "));
  assert.ok(moving.includes(".hero-art::before"));
  for (const selector of moving) {
    // 자세·상태 조건이 붙은 선택자(.pet-dock[data-pose="quiet"] .pet-hop)는 마지막 요소 이름으로 찾는다.
    const target = selector.includes("::view-transition-") ? selector.slice(selector.indexOf("::view-transition-")) : selector.split(" ").at(-1);
    assert.ok(stopped.includes(selector) || stopped.includes(target) || (/::view-transition-(old|new|group)/.test(target) && stopped.includes(target.replace(/\([^)]*\)/, "(*)"))), `${selector}의 움직임을 끄는 규칙이 없다`);
  }
  for (const pseudo of ["::view-transition-group(*)", "::view-transition-old(*)", "::view-transition-new(*)"]) {
    assert.ok(stopped.includes(pseudo), pseudo);
  }
  // 움직임은 animation으로만 만든다. transition 선언이 있으면 이 묶음이 끄지 못한다.
  for (const [selector, body] of rules) {
    if (selector === "#conversation-sidebar" && body.includes("transition:")) assert.match(body, /transition: (?:transform \.35s ease|none);/);
    else assert.doesNotMatch(body, /(?:^|; )transition(?:-[a-z]+)?: /, selector);
  }
});

// --- UI_NOTES.md 읽기 ------------------------------------------------------------------------

test("설계 문서가 펫·말풍선·패널·모핑을 지금 화면대로 설명하고, 다른 테스트가 찾는 문구를 남긴다", () => {
  for (const kept of ["## 테크모 펫과 말풍선", "## 기능 카드와 패널", "## 로그인과 카드 움직임", "## 캠퍼스 사진 배경", "공식 원문 보기"]) {
    assert.ok(notes.includes(kept), kept);
  }
  // 화면과 스크립트가 함께 지키는 이름이 문서에도 같은 글자로 적혀 있다.
  for (const name of ["data-feature", "data-panel", "data-panel-title", "data-panel-close", "data-morph", "feature-morph", "login-rise", "login-float", "card-lift"]) {
    assert.ok(notes.includes(name), name);
  }
  for (const [, title, soon, label] of features) {
    assert.ok(notes.includes(title), title);
    if (label) assert.ok(notes.includes(`\`${label}\``), label);
  }
  // 없앤 왼쪽 비서와 자세 그림 세 장에 대한 설명은 남지 않는다.
  for (const gone of ["## 테크모 비서", "자세 그림 세 장", "예시 질문 아래(채팅 왼쪽)", "160×184px"]) {
    assert.equal(notes.includes(gone), false, gone);
  }
});
