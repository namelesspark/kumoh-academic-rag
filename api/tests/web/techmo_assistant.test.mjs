// 테크모 펫 화면 테스트 (#64, 상태 규칙은 #61). 브라우저와 서버를 띄우지 않고 실제 index.html·chat.css·chat.js 파일을 읽어,
// 가짜 화면 객체·가짜 서버 요청 함수(fetch)·가짜 타이머로 chat.js를 그대로 실행한다.
// 스프라이트 시트(여러 자세를 한 장에 나란히 붙인 그림) 파일은 쓰지 않는다. 그림이 없어도 통과해야 하기 때문이다.
// 질문·응답·사진 바이트는 모두 가상 값이다. 1280px·390px 배치와 실제 움직임·초점·스크롤은 브라우저에서 따로 확인한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const read = path => readFileSync(new URL(`../../app/chat_web/${path}`, import.meta.url), "utf8");
const script = read("assets/chat.js");
const styles = read("assets/chat.css").replace(/\/\*[\s\S]*?\*\//g, "");
const html = read("index.html");

// 이슈 #61의 상태 규칙 표. [자세, 한 줄 말, 대기 점] 순서다.
const idle = ["guide", "궁금한 점을 물어보세요", "점 숨김"];
const searching = ["quiet", "쉿, 찾아보는 중이에요…", "점 보임"];
const found = ["celebrate", "찾았어요! 함께 확인해 봐요", "점 숨김"];
const answer = ["guide", "근거와 함께 안내해 드릴게요", "점 숨김"];
const hold = ["quiet", "확인할 근거가 더 필요해요", "점 숨김"];
const failed = ["guide", "잠시 문제가 생겼어요. 다시 시도해 주세요", "점 숨김"];
// 스프라이트 시트의 칸 순서와 그 칸을 고르는 가로 위치. 이슈 #64의 「두 작업이 지키는 약속」과 같다.
const frames = [["basic", "0"], ["quiet", "25%"], ["guide", "50%"], ["celebrate", "75%"], ["concert", "100%"]];
const spriteUrl = "/chat-assets/techmo-sprite.png";

// --- index.html과 chat.css 읽기 --------------------------------------------------------------

const landing = /<div id="empty"[\s\S]*?(?=<noscript>)/.exec(html)?.[0] ?? "";
const dockMarkup = /<div class="pet-dock"[\s\S]*?<\/div>/.exec(html)?.[0] ?? "";
const petMarkup = /<button[^>]*\bid="pet"[\s\S]*?<\/button>/.exec(dockMarkup)?.[0] ?? "";

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

// [선택자, 선언 글자] 목록. @media 안의 규칙도 같은 목록에 들어온다.
const rules = [...styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [
  selector.replace(/\s+/g, " ").trim(),
  body.replace(/\s+/g, " ").trim(),
]);
// 선택자가 정확히 같은 규칙 가운데 파일에서 가장 먼저 나오는 것의 선언. 화면 너비 조건 밖의 기본 규칙이 먼저 온다.
const first = selector => rules.find(([name]) => name === selector)?.[1] ?? "";
const wide = block("@media (min-width: 961px)");
const narrow = block("@media (max-width: 680px)");
const calm = block("@media (prefers-reduced-motion: reduce)");

test("예전 안내 상자가 없고, 채팅 영역 제목은 숨김 제목으로 남는다", () => {
  for (const gone of ["chat-header", "graduation-check", "chat-title", "가상 학생 졸업 체크"]) {
    assert.equal(html.includes(gone), false, gone);
  }
  assert.doesNotMatch(styles, /\.chat-header\b/);
  assert.equal(script.includes("graduation-check"), false);

  assert.match(html, /<section class="chat" aria-labelledby="chat-heading">\s*<h2 id="chat-heading" class="sr-only">학사 규정에 질문하기<\/h2>/);
  // 같은 버튼이 두 번 나오지 않는다. 졸업 체크로 가는 길은 소개 영역과 카드에만 남는다.
  assert.equal(html.includes("내 졸업 체크 보기"), false);
  assert.match(landing, /<button type="button" class="cta" data-action="graduation">졸업 체크 시작<\/button>/);
});

test("왼쪽 칸의 비서와 「테크모에게 묻기」 글자 버튼이 없고, 「규정 질문」 카드는 남는다", () => {
  for (const gone of ["assistant", "테크모 비서", 'class="side"', "cta secondary", "techmo-quiet", "techmo-guide", "techmo-celebrate"]) {
    assert.equal(html.includes(gone), false, gone);
  }
  for (const gone of [".assistant", ".side", ".pose", "pose-swap"]) assert.equal(styles.includes(gone), false, gone);
  // 예시 질문 묶음은 구조가 바뀌어도 한 번만 남는다.


  assert.equal(landing.includes("테크모에게 묻기"), false);
  // 카드는 패널을 여는 버튼이 됐다(#67). 기능은 패널 안의 시작 버튼이 부른다.
  assert.match(
    landing,
    /<button type="button" class="card" data-feature="ask" aria-controls="panel-ask" aria-expanded="false">\s*<span class="card-heading"><span class="feature-badge" aria-hidden="true">[\s\S]*?<\/svg><\/span>\s*<span class="card-title">규정 질문<\/span>/,
  );
  assert.match(landing, /<button type="button" class="cta" data-action="ask">질문 입력하기<\/button>/);
});

test("펫 줄은 입력창 바로 앞, 첫 화면(#empty) 밖에 있고 평소 상태로 시작한다", () => {
  assert.notEqual(dockMarkup, "");
  assert.equal(html.split('id="pet-dock"').length, 2);
  // 대화 내용 뒤, 입력창 앞이다. 좁은 화면에서 입력창 위의 낮은 줄이 되고, #empty 밖이라 첫 질문 뒤에도 남는다.
  assert.ok(html.indexOf('id="transcript"') < html.indexOf('id="pet-dock"'));
  assert.ok(html.indexOf("</main>") < html.indexOf('id="pet-dock"'), "유리 판의 backdrop-filter가 고정 펫의 위치 기준을 바꾸지 않게 판 밖에 둔다");
  assert.ok(html.indexOf('id="composer"') < html.indexOf('id="transcript"'));
  assert.equal(landing.includes("pet"), false);

  assert.match(dockMarkup, /^<div class="pet-dock" id="pet-dock" data-pose="guide" data-state="idle"[^>]*>/);
  assert.match(dockMarkup, new RegExp(`<span id="pet-line">${idle[1]}</span>`));
  assert.match(
    dockMarkup,
    /<span class="pet-dots" id="pet-dots" aria-hidden="true" hidden><span><\/span><span><\/span><span><\/span><\/span>/,
  );
  // 진행 알림은 #status가 읽어 준다. 말풍선까지 알림 영역이면 화면 낭독기가 같은 일을 두 번 읽는다.
  assert.doesNotMatch(dockMarkup, /role="status"|aria-live/);
});

test("펫은 요청 중에 잠기지 않는 버튼이다", () => {
  const [opening] = /^<button[^>]*>/.exec(petMarkup) ?? [""];
  assert.match(opening, /^<button type="button" class="pet" id="pet"[^>]* data-brand-slot hidden>$/);
  assert.match(opening, /aria-label="아이오와 새 대화"/);
  assert.equal(html.split('id="pet"').length, 2);
  // 스프라이트 시트가 받아졌는지 보는 그림이 버튼 바로 안에 있다. 버튼은 숨긴 채 시작한다.
  assert.ok(petMarkup.slice(opening.length).trimStart().startsWith(`<img src="${spriteUrl}" alt="테크모" width="960" height="192">`));
  // 떠 있기·튀기·그림 칸은 서로 다른 요소다.
  assert.ok(petMarkup.includes('<span class="pet-float"><span class="pet-hop"><span class="pet-frame"></span></span></span>'));
  // 화면 보안 정책이 막는 style 속성과 스크립트의 그림 주소 교체는 쓰지 않는다.
  // 스크립트는 테크모·대화 메뉴·선택 메뉴(답변 모드) 좌표를 CSS 변수로만 넘긴다.
  assert.doesNotMatch(html, /\sstyle=/);
  assert.doesNotMatch(script, /\.src\s*=|\.style\b(?!\??\.(?:setProperty|removeProperty)\(["`]--(?:techmo|conversation-menu|choice-menu)-)/);
  // 예외는 하나다(#122). 언어별 제목 그림은 index.html의 data-lettering-* 주소로만, letteringSwitcher 안에서만 바꾼다.
  const swapStart = script.indexOf("function letteringSwitcher(");
  const swapEnd = script.indexOf("// 퀵링크 카드 한 장", swapStart);
  assert.ok(swapStart >= 0 && swapEnd > swapStart);
  const sourceSwaps = [...script.matchAll(/setAttribute\("src"/g)].map(match => match.index);
  assert.equal(sourceSwaps.length, 2);
  assert.ok(sourceSwaps.every(index => index > swapStart && index < swapEnd));
});

test("그림 칸은 스프라이트 한 장의 배경 위치로만 고른다: 0·25·50·75·100%", () => {
  assert.equal(styles.split(spriteUrl).length, 2);
  assert.ok(first(".pet-frame").includes(`background: url("${spriteUrl}") 50% 0 / 500% 100% no-repeat;`));
  assert.match(first(".pet-frame"), /width: 100%; aspect-ratio: 1;/);
  for (const [name, x] of frames) {
    assert.equal(first(`.pet-dock[data-pose="${name}"] .pet-frame`), `background-position: ${x} 0;`, name);
  }
  // 로드 확인용 그림은 화면에 그리지 않는다.
  assert.equal(first(".pet img"), "display: none;");
});

test("기본 배치는 입력창 앞에 붙는 낮은 줄이고, 넓은 화면에서만 오른쪽 아래에 고정하며 그만큼 본문 칸을 비운다", () => {
  // 기본: 줄이 자리를 차지하므로 입력창을 덮지 않고, 입력창이 화면 밖이면 화면 아래에 붙는다.
  assert.match(first(".pet-dock"), /^position: sticky; bottom: 0;/);
  assert.match(first(".pet"), /^flex: none; width: 104px;/);
  assert.match(first(".pet-says"), /flex: 1; min-width: 0;/);

  // 넓은 화면의 실제 여백은 뒤의 선언까지 적용한 별도 검사에서 계산한다.
  assert.match(
    wide,
    /\.pet-dock \{ position: fixed; right: 24px; bottom: 24px;[^}]*\bwidth: 128px;/,
  );
  assert.ok(wide.includes(".pet { width: 128px; }"));

  // 좁은 화면: 배치 방식은 기본 그대로 두고 크기만 줄인다. 대화 영역 높이는 펫 줄을 뺀 예전 값으로 돌아온다.
  assert.doesNotMatch(narrow, /\.pet-dock \{[^}]*position/);
  assert.ok(narrow.includes(".pet { width: 72px; }"));
});

// 화면 너비에 맞는 규칙만 순서대로 읽는다. 뒤에 나온 기본 규칙이 앞의 @media를 덮는 경우도 포함한다.
function declarationsAtWidth(selector, width, source = styles) {
  const declarations = {};
  let cursor = 0;
  while (cursor < source.length) {
    const open = source.indexOf("{", cursor);
    if (open === -1) break;
    const header = source.slice(cursor, open).trim();
    let depth = 1;
    let close = open + 1;
    while (depth && close < source.length) {
      if (source[close] === "{") depth += 1;
      if (source[close] === "}") depth -= 1;
      close += 1;
    }
    assert.equal(depth, 0, "CSS 중괄호 짝");
    const body = source.slice(open + 1, close - 1);
    if (header.startsWith("@media")) {
      const limits = [...header.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)];
      const active = limits.length > 0 && limits.every(([, limit, pixels]) =>
        limit === "min" ? width >= Number(pixels) : width <= Number(pixels));
      if (active) Object.assign(declarations, declarationsAtWidth(selector, width, body));
    } else if (header === selector || header.split(",").map(name => name.trim()).includes(selector)) {
      for (const declaration of body.split(";")) {
        const colon = declaration.indexOf(":");
        if (colon === -1) continue;
        const name = declaration.slice(0, colon).trim();
        const value = declaration.slice(colon + 1).trim();
        declarations[name] = value;
        // 현재 배치의 padding은 위·좌우·아래 세 값이다. 괄호 안의 공백은 값 경계가 아니다.
        if (name === "padding") {
          const values = value.match(/(?:[^\s(]+|\((?:[^()]|\([^()]*\))*\))+/g);
          declarations["padding-right"] = values[1] ?? values[0];
        }
        if (name === "padding-inline") {
          declarations["padding-right"] = value;
        }
      }
    }
    cursor = close;
  }
  return declarations;
}

test("인사말이 있으면 입력창까지 12px 이상 확보하고 빈 인사말의 여백은 유지한다", () => {
  for (const width of [1280, 800, 680]) {
    const welcome = declarationsAtWidth(".main-welcome", width);
    const greetingWelcome = declarationsAtWidth(".main-welcome:has(#main-greeting:not(:empty))", width);
    const layout = declarationsAtWidth(".layout", width);
    const composer = declarationsAtWidth(".composer", width);
    const layoutTop = Number.parseFloat(layout["margin-top"] ?? layout.margin);
    const composerTop = Number.parseFloat(composer["margin-top"]);
    const bottom = Number.parseFloat(greetingWelcome["padding-bottom"]);
    assert.ok(bottom + layoutTop + composerTop >= 12, `${width}px 인사말 아래 간격`);
    assert.equal(welcome.padding, "40px 0 120px");
    assert.equal(welcome["padding-bottom"], undefined);
    assert.equal(layoutTop, -96);
    assert.equal(composerTop, -62);
    assert.equal(declarationsAtWidth(".main-welcome #main-greeting:empty", width).display, "none");
  }
});

function pixels(value, width) {
  assert.ok(value, "계산할 길이 선언이 있어야 한다");
  const expression = value.replace(/var\(--pet-reserve\)/g, width >= 1464 ? "192px" : "152px").replace(/([\d.]+)%/g, (_, amount) => String(width * Number(amount) / 100))
    .replace(/px\b/g, "").replace(/\bcalc\(/g, "(").replace(/\bmax\(/g, "Math.max(");
  assert.match(expression, /^[\d\s.+*/(),\-Mathmax]+$/, value);
  return runInNewContext(expression, {}, { timeout: 100 });
}

test("360·680px 상단은 한 줄과 40px 버튼을 유지하고 보조 줄을 숨긴다", () => {
  for (const width of [360, 680]) {
    assert.equal(declarationsAtWidth("#demo-identity", width)["flex-wrap"], "nowrap");
    assert.equal(declarationsAtWidth("#demo-identity .hint", width).display, "none");
    assert.equal(declarationsAtWidth("#demo-label", width)["text-overflow"], "ellipsis");
    assert.equal(declarationsAtWidth(".brand-logo img", width).height, "22px");
    assert.equal(declarationsAtWidth(".login-brand img", width).height, "22px");
    assert.ok(Number.parseInt(declarationsAtWidth("#demo-logout", width)["min-height"], 10) >= 40);
    assert.ok(Number.parseInt(declarationsAtWidth(".masthead-actions > .reset", width)["min-height"], 10) >= 40);
    assert.equal(declarationsAtWidth(".campus-site-links", width)["flex-wrap"], "wrap");
  }
});

test("큰 판은 56px 경계만 부드럽게 잇고 바닥과 같은 면을 쓴다", () => {
  const layout = declarationsAtWidth(".layout", 1280);
  assert.equal(layout.border, "0");
  assert.equal(layout["border-radius"], "0");
  assert.equal(layout.background, "linear-gradient(180deg, transparent, var(--main-surface) 56px)");
  assert.equal(declarationsAtWidth('body[data-view="chat"] .layout', 1280).border, "0");
});

test("일정 내용의 제목과 상자는 격자 간격 12px만 남긴다", () => {
  for (const width of [1280, 680]) {
    const content = declarationsAtWidth("[data-panel-content]", width);
    const title = declarationsAtWidth("#panel-calendar [data-panel-content] > h5", width);
    const evidence = declarationsAtWidth("#panel-calendar [data-panel-content] > .evidence", width);
    assert.equal(content.display, "grid");
    assert.equal(content.gap, "12px");
    assert.equal(title.margin, "0");
    assert.equal(title["font-size"], "16px");
    assert.equal(title["font-weight"], "700");
    assert.equal(title.color, "var(--ink)");
    assert.equal(evidence["margin-top"], "0");
  }
  assert.equal(declarationsAtWidth(".evidence", 1280)["margin-top"], "12px");
});

test("1024·1280·1440px의 최종 선언에서 본문이 고정 테크모와 겹치지 않는다", () => {
  for (const width of [1024, 1280, 1440]) {
    const layout = declarationsAtWidth(".layout", width);
    const dock = declarationsAtWidth(".pet-dock", width);
    assert.equal(layout["grid-template-columns"].replace(/\s+/g, ""), "minmax(0,1fr)");
    assert.equal(dock.position, "fixed");
    const contentRight = Math.min(width - 2 * (width >= 1464 ? 192 : 152), 1080) / 2 + width / 2;
    const dockLeft = width - pixels(dock.right, width) - pixels(dock.width, width);
    const dockWidth = pixels(dock.width, width);
    assert.equal(dockWidth, width >= 1464 ? 168 : 128);
    assert.ok(dockLeft - contentRight >= 0, `${width}px: 본문 ${contentRight}, 테크모 ${dockLeft}`);
  }
});

test("680·960·961·1463·1464px에서 버튼과 판과 예약 폭을 함께 적용한다", () => {
  for (const [width, button, reserve] of [[390, 72, 12], [680, 72, 12], [681, 104, 24], [960, 104, 24], [961, 128, 152], [1463, 128, 152], [1464, 168, 192]]) {
    const pet = { ...declarationsAtWidth(".pet", width), ...declarationsAtWidth(".pet-dock .pet", width) };
    assert.equal(pet.width, `${button}px`, `${width}px 버튼`);
    assert.equal(declarationsAtWidth(":root", width)["--pet-reserve"], `${reserve}px`, `${width}px 예약`);
    if (width >= 961) {
      assert.equal(declarationsAtWidth(".pet-dock", width).width, `${button}px`, `${width}px 판`);
    } else {
      const root = declarationsAtWidth(":root", width);
      const dock = declarationsAtWidth('body[data-view="chat"] .pet-dock', width);
      const layout = declarationsAtWidth('body[data-view="chat"] .layout', width);
      assert.equal(dock.height, "var(--techmo-dock-height)");
      assert.equal(layout.bottom, dock.height);
      assert.equal(root["--techmo-dock-height"], width <= 680 ? "96px" : "184px");
      assert.ok(Number.parseFloat(root["--techmo-dock-height"]) >= button + 12);
    }
  }
  assert.match(declarationsAtWidth(".chat", 680)["min-height"], /max\(350px, calc\(100dvh - 180px - var\(--techmo-dock-height\)\)\)/);
});

test("로그인 테크모는 112px 정사각 칸에 공통 시트 크기와 줄을 쓰고 부모가 자르지 않는다", () => {
  for (const width of [680, 960, 961, 1464]) {
    assert.equal(declarationsAtWidth(".login-techmo", width).width, "112px");
    assert.equal(declarationsAtWidth(".pet-frame", width)["aspect-ratio"], "1");
    const sprite = declarationsAtWidth(':is(.pet-dock, .login-pet)[data-sprite-layout="animated"] .pet-frame', width);
    assert.equal(sprite["background-size"], "var(--techmo-sheet-width) var(--techmo-sheet-height)");
    assert.equal(sprite["background-position"], "0 var(--techmo-row)");
    for (const selector of [".login-pet", ".login-card"]) {
      assert.doesNotMatch(Object.keys(declarationsAtWidth(selector, width)).join(" "), /overflow/);
    }
  }
});

test("펫의 움직임 네 가지는 서로 다른 요소·속성에 걸고, 움직임 줄이기 설정에서는 화면의 움직임을 모두 끈다", () => {
  const animated = rules
    .map(([selector, body]) => [selector, /(?:^|; )animation: ([^;]+);/.exec(body)?.[1]])
    .filter(([, value]) => value !== undefined);
  // 화면 전체에서 움직임을 거는 규칙의 목록이다. 마지막 줄은 첫 화면 도형의 모양 변화(#67)이고,
  // 그 내용은 motion_layout.test.mjs가 따로 확인한다.
  const allOff = ".pet-float, .pet-hop, .pet-frame, .pet-dots span, .hero-art::before, .login-card, .login-techmo, button.card:hover";
  const transitionOff = "::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*)";
  // 답변 모드 효과(mode-·is-deep-enter·is-waiting)는 landing_design.test.mjs와 motion_layout.test.mjs가 따로 본다.
  assert.deepEqual(animated.filter(([selector]) => !/chat-surface|chat-composer|conversation-pending|data-sprite-layout|data-facing|mode-|is-deep-enter|is-waiting/.test(selector)), [
    [".pet-dots span", "dot-hop 1s ease-in-out infinite"],
    [".pet-float", "pet-float 1.8s ease-in-out infinite alternate"],
    ['.pet-dock[data-pose="quiet"] .pet-hop', "pet-hop-quiet .4s ease-out"],
    ['.pet-dock[data-pose="guide"] .pet-hop', "pet-hop-guide .4s ease-out"],
    ['.pet-dock[data-pose="celebrate"] .pet-hop', "pet-hop-celebrate .4s ease-out"],
    ['.pet-dock[data-state="idle"] .pet-frame, .pet-dock[data-state="answer"] .pet-frame', "pet-rest 24s step-end infinite"],
    [allOff, "none !important"],
    [transitionOff, "none !important"],
    [".hero-art::before", "shape-morph 12s ease-in-out infinite"],
    ["::view-transition-old(feature-morph)", "feature-old-out .32s linear both"],
    ["::view-transition-new(feature-morph)", "feature-new-in .32s linear both"],
    ["::view-transition-old(feature-cards)", "feature-cards-out .2s ease both"],
    ["::view-transition-new(feature-cards)", "feature-cards-out .2s ease reverse both"],
    [".login-card", "login-rise .8s ease-out"],
    [".login-techmo", "login-float 3.6s ease-in-out infinite"],
    // #128: 말풍선이 나타날 때 커지는 움직임과, 프레임 재생과 같은 움직임 줄이기 묶음에서 그것을 끄는 규칙.
    ['.pet-dock[data-bubble-visible="true"] .pet-says', "pet-says-in .2s ease-out"],
    ['.pet-dock .pet-says, .pet-dock[data-bubble-visible="true"] .pet-says', "none !important"],
  ]);
  // 움직임 줄이기 묶음은 하나뿐이고, 펫·대기 점·도형과 카드 전환을 함께 끈다.
  assert.ok(styles.split("prefers-reduced-motion").length >= 3);
  assert.equal(calm, `${allOff} { animation: none !important; } ${transitionOff} { animation: none !important; }`);

  // 떠 있기: 제자리에서 조금 올라갔다 내려온다.
  assert.equal(block("@keyframes pet-float"), "from { transform: translateY(0); } to { transform: translateY(-5%); }");
  // 눌렸다 튀기: 자세마다 이름만 다르고 내용은 같다. 이름이 같으면 자세가 바뀌어도 다시 돌지 않는다.
  const hop = block("@keyframes pet-hop-quiet");
  assert.match(hop, /^0% \{ transform: scale\(1, 1\); \} 30% \{ transform: scale\(1\.\d+, \.\d+\); \} .*100% \{ transform: scale\(1, 1\); \}$/);
  assert.equal(block("@keyframes pet-hop-guide"), hop);
  assert.equal(block("@keyframes pet-hop-celebrate"), hop);

  // 쉬는 자세: 안내 칸에서 시작해 음악회 칸과 기본형 칸을 잠깐 보이고 안내 칸으로 끝난다. 배경 위치만 바꾼다.
  const rest = block("@keyframes pet-rest");
  assert.deepEqual(
    [...rest.matchAll(/background-position: ([^;]+);/g)].map(match => match[1]),
    ["50% 0", "100% 0", "50% 0", "0 0", "50% 0"],
  );
  assert.equal(rest.includes("transform"), false);
  assert.ok(rest.startsWith("0%, 44% {"));
});

test("쉬는 자세와 부드러운 이동에 스크립트 타이머나 문서 전체 스크롤 설정을 쓰지 않는다", () => {
  // 타이머는 축하 뒤 전환 하나뿐이다. 쉬는 자세는 chat.css의 움직임 규칙이 맡는다.
  assert.match(script, /setTimeout/);
  assert.equal(script.includes("setInterval"), false);
  // 부드러운 이동은 펫을 누를 때만 고르고, 움직임 줄이기 설정을 그때 읽는다.
  // 대화 칸의 overscroll-behavior는 다른 속성이라 세지 않는다.
  assert.doesNotMatch(styles, /(?<!over)scroll-behavior/);
  assert.equal(script.split('"(prefers-reduced-motion: reduce)"').length, 2);
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
  properties = new Map();
  style = {
    setProperty: (name, value) => this.properties.set(name, String(value)),
    removeProperty: name => this.properties.delete(name),
  };
  getBoundingClientRect() { return this.rect ?? { left: 1100, top: 620, width: 128, height: 128 }; }
  setPointerCapture(id) { this.capture = id; }
  releasePointerCapture(id) { if (this.capture === id) this.capture = null; }
  // 초점과 화면 이동을 부를 때 받은 선택 값을 차례로 적어 둔다.
  focuses = [];
  scrolls = [];

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

  fire(event, values = {}) {
    const detail = { preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...values };
    for (const listener of this.listeners.get(event) ?? []) listener(detail);
    return detail;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }

  querySelectorAll(selector) {
    if (!selector.startsWith(".")) return [];
    const name = selector.slice(1);
    return descendants(this).filter(node => node.className.split(" ").includes(name));
  }

  // 그림 자리가 자기 안의 그림을 찾을 때만 쓴다.
  querySelector(selector) {
    return selector === "img" ? this.image : null;
  }

  scrollIntoView(options) {
    this.scrolls.push(options);
  }

  focus(options) {
    this.focuses.push(options);
  }

  click() {}
}

function descendants(node) {
  const found = [];
  for (const child of node.children) {
    if (child instanceof FakeElement) found.push(child, ...descendants(child));
  }
  return found;
}

const chatPath = "/api/v1/chat";
const graduationPath = "/api/v1/graduation-demo?student_id=demo-d02";
const photoPath = "/api/v1/photo-input";
const textPath = "/api/v1/photo-question";

const ok = payload => ({ ok: true, status: 200, json: async () => payload });
const refused = status => ({ ok: false, status, json: async () => ({ detail: "fictional error" }) });

// 테스트가 원하는 때에 응답을 풀어 주는 약속. 기다리는 동안의 화면을 확인할 때 쓴다.
function deferred() {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
}

const answeredChat = { session_id: "fictional-session", answered: true, answer: "가상 답변입니다.", citations: [] };
const unansweredChat = { session_id: "fictional-session", answered: false, answer: null, citations: [] };
const graduationResult = {
  profile: { id: "demo-d02", label: "가상 학생 D02" },
  items: [{ id: "total_credits", label: "학점", status: "met", current: "40학점", required: "40학점", basis: null }],
};
const fictionalEvent = { title: "가상 설명회", login_required: false };
const confirmedPhoto = recognized => ({
  event_match: "confirmed", identified_by: ["text"], reasons: [], event: fictionalEvent, recognized_text: recognized,
});
const unmatchedPhoto = recognized => ({
  event_match: "needs_check", identified_by: [], reasons: [], event: null, recognized_text: recognized,
});
const campusAnswer = { kind: "campus", answer: "가상관은 정문 옆 건물입니다.", sources: [], event: null, hold_reason: null };
const holdAnswer = { kind: "hold", answer: null, sources: [], event: null, hold_reason: "가상 보류 사유" };

// routes는 주소별 응답이다. 값이 배열이면 부를 때마다 앞에서부터 하나씩 꺼내 쓴다.
// timers를 false로 주면 타이머 함수가 없는 환경을 흉내 낸다. 기존 화면 테스트들의 가짜 화면이 그렇다.
// sprite는 스프라이트 시트 그림의 가상 로드 상태다. 주면 펫 버튼이 index.html처럼 숨긴 그림 자리로 시작한다.
// motion은 움직임 줄이기 설정을 묻는 matchMedia가 돌려줄 값이다.
const techmoLayout = { version: 1, cell: 192, columns: 8, motions: [
  { name: "idle", frames: 8 }, { name: "guide", frames: 6 }, { name: "celebrate", frames: 8 },
  { name: "quiet", frames: 4 }, { name: "drag", frames: 6 },
] };

function loadAssistant({ routes = {}, timers = true, sprite = null, motion = { matches: false }, layout = null, stored = null, storageFails = false, readFails = false, writeFails = false, screenVisibility = false, petRect = null, bubbleSize = null, initialWidth = 1280 } = {}) {
  const requests = [];
  const elements = new Map();
  const pending = new Map();
  let nextTimer = 1;
  let clock = 0;
  const animationFrames = new Map();
  const windowEvents = new Map();
  const storedValues = new Map(stored === null ? [] : [["kumoh-techmo-position:v1", stored]]);
  const storage = {
    getItem(key) { if (storageFails || readFails) throw new Error("fictional storage failure"); return storedValues.get(key) ?? null; },
    setItem(key, value) { if (storageFails || writeFails) throw new Error("fictional storage failure"); storedValues.set(key, value); },
    removeItem(key) { if (storageFails) throw new Error("fictional storage failure"); storedValues.delete(key); },
  };

  const graduation = new FakeElement("button");
  graduation.dataset = { action: "graduation" };
  // 펫 버튼은 data-action이 없어 [data-action] 목록에 들지 않는다. 그림 자리 목록에는 든다.
  const pet = new FakeElement("button");
  elements.set("#pet", pet);
  const dock = new FakeElement("div");
  if (layout !== null) dock.dataset.techmoLayout = typeof layout === "string" ? layout : JSON.stringify(layout);
  elements.set("#pet-dock", dock);
  pet.getBoundingClientRect = () => {
    if (screenVisibility && (pet.hidden || elements.get("#main-screen")?.hidden)) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }
    return {
      left: Number.parseFloat(dock.properties.get("--techmo-x") ?? petRect?.left ?? "1100"),
      top: Number.parseFloat(dock.properties.get("--techmo-y") ?? petRect?.top ?? "620"),
      width: petRect?.width ?? 128, height: petRect?.height ?? 128,
    };
  };
  if (sprite) {
    pet.hidden = true;
    pet.image = Object.assign(new FakeElement("img"), sprite);
    pet.image.attributes.set("src", spriteUrl);
    pet.append(pet.image);
  }
  const lists = { "[data-action]": [graduation], "[data-brand-slot]": sprite ? [pet] : [] };

  const context = {
    document: {
      addEventListener() {},
      querySelector(selector) {
        if (!elements.has(selector)) {
          elements.set(selector, new FakeElement(selector));
          if (selector === "#demo-students") elements.get(selector).hidden = true;
          if (selector === "#pet-line") {
            const bubble = new FakeElement("div");
            bubble.getBoundingClientRect = () => ({ width: 144, height: bubbleSize?.height ?? 64 });
            elements.get(selector).parentElement = bubble;
          }
        }
        return elements.get(selector);
      },
      querySelectorAll: selector => lists[selector] ?? [],
      createElement: tag => new FakeElement(tag),
      createTextNode: value => value,
    },
    window: {
      innerWidth: initialWidth, innerHeight: 800, localStorage: storage,
      matchMedia: query => (query.includes("prefers-reduced-motion") ? motion : { matches: false }),
      addEventListener(name, callback) { windowEvents.set(name, callback); },
      requestAnimationFrame(callback) { const id = nextTimer++; animationFrames.set(id, callback); return id; },
      cancelAnimationFrame(id) { animationFrames.delete(id); },
    },
    URL,
    AbortSignal: { timeout: () => undefined },
    async fetch(path) {
      if (path === "/api/v1/demo-students") return ok({ students: [
        { id: "demo-d02", label: "가상 학생 D02", scenario: "졸업 요건에 가까움", is_fictional: true },
      ] });
      if (path === "/api/v1/demo-login") return { status: 200, json: async () => ({ student: { id: "demo-d02", label: "가상 학생 D02", scenario: "졸업 요건에 가까움", is_fictional: true } }) };
      requests.push(path);
      const route = routes[path];
      if (route === undefined) throw new Error(`unexpected request: ${path}`);
      return Array.isArray(route) ? route.shift() : route;
    },
  };
  if (timers) {
    context.setTimeout = (callback, delay) => {
      const id = nextTimer;
      nextTimer += 1;
      pending.set(id, { callback, delay, due: clock + delay });
      return id;
    };
    context.clearTimeout = id => {
      pending.delete(id);
    };
  }
  runInNewContext(script, context, { filename: "chat.js" });

  const page = {
    async selectStudent() {
      elements.get("#demo-login").fire("click");
      await setImmediate();
      elements.get("#student-number").value = "20990002";
      elements.get("#student-password").value = "demo-d02-pass";
      elements.get("#login-form").fire("submit");
      await setImmediate();
      page.runTimers();
    },
    requests,
    context,
    storage: storedValues,
    frameCount: () => animationFrames.size,
    draw() { for (const [id, callback] of [...animationFrames]) { animationFrames.delete(id); callback(); } },
    resize(width, height) { context.window.innerWidth = width; context.window.innerHeight = height; windowEvents.get("resize")?.(); },
    newConversation: elements.get("#new-conversation"),
    graduation,
    pet,
    assistant: elements.get("#pet-dock"),
    line: elements.get("#pet-line"),
    dots: elements.get("#pet-dots"),
    transcript: elements.get("#transcript"),
    empty: elements.get("#empty"),
    reset: elements.get("#reset"),
    composer: elements.get("#composer"),
    input: elements.get("#question"),
    file: elements.get("#photo-file"),
    status: elements.get("#status"),
    // 예약된 전환의 대기 시간 목록.
    delays: () => [...pending.values()].map(timer => timer.delay),
    // 예약된 전환을 모두 실행한다. 시간이 다 지난 것과 같다.
    runTimers() {
      for (const [id, timer] of [...pending]) {
        pending.delete(id);
        timer.callback();
      }
    },
    advance(milliseconds) {
      const end = clock + milliseconds;
      for (;;) {
        const next = [...pending].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        const [id, timer] = next;
        pending.delete(id);
        clock = timer.due;
        timer.callback();
      }
      clock = end;
    },
  };
  // index.html의 처음 모습을 가짜 화면에 옮긴다.
  page.assistant.setAttribute("data-pose", idle[0]);
  page.assistant.setAttribute("data-state", "idle");
  page.line.textContent = idle[1];
  page.dots.hidden = true;
  page.transcript.append(page.empty);
  return page;
}

function shown(page) {
  return [page.assistant.attributes.get("data-pose"), page.line.textContent, page.dots.hidden ? "점 숨김" : "점 보임"];
}

// 쉬는 자세를 평소와 답변 표시에서만 돌리려고 chat.css가 읽는 상태 이름.
const stateOf = page => page.assistant.attributes.get("data-state");

function ask(page, question) {
  page.input.value = question;
  page.composer.fire("submit");
}

function sendPhoto(page, question = "") {
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  page.file.files = [new File([bytes], "가상-사진.jpg", { type: "image/jpeg" })];
  page.input.value = question;
  page.composer.fire("submit");
  // 브라우저는 전송 뒤 고른 파일을 비운다. 가짜 입력 칸도 같게 맞춘다.
  page.file.files = [];
}

test("일반 질문: 기다리는 동안 정숙과 대기 점, 답이 오면 축하를 0.8초 보여 준 뒤 안내로 넘어간다", async () => {
  const reply = deferred();
  const page = loadAssistant({ routes: { [chatPath]: reply.promise } });
  assert.deepEqual(shown(page), idle);

  ask(page, "가상 질문");
  assert.deepEqual(shown(page), searching);
  assert.deepEqual(page.delays(), []);
  // 첫 질문을 보내 첫 화면이 사라져도 비서는 그대로 있다.
  assert.equal(page.transcript.children.includes(page.empty), false);

  reply.resolve(ok(answeredChat));
  await setImmediate();
  // 잠금이 풀린 뒤에도 축하가 남아 있다.
  assert.equal(page.reset.disabled, false);
  assert.equal(page.status.textContent, "");
  assert.deepEqual(shown(page), found);
  assert.deepEqual(page.delays(), [800]);

  page.runTimers();
  assert.deepEqual(shown(page), answer);
  assert.deepEqual(page.delays(), []);
});

test("근거를 찾지 못한 답은 보류로 남고, 잠금을 풀어도 평소로 돌아가지 않는다", async () => {
  const page = loadAssistant({ routes: { [chatPath]: ok(unansweredChat) } });
  ask(page, "가상 질문");
  assert.deepEqual(shown(page), searching);
  await setImmediate();

  assert.equal(page.reset.disabled, false);
  assert.deepEqual(shown(page), hold);
  assert.deepEqual(page.delays(), []);
});

test("요청이 실패하면 오류 말과 함께 점이 사라지고, 다시 시도하면 다시 찾는 중이 된다", async () => {
  const second = deferred();
  const page = loadAssistant({ routes: { [chatPath]: [refused(500), second.promise] } });
  ask(page, "가상 질문");
  await setImmediate();
  assert.deepEqual(shown(page), failed);

  const [retry] = page.transcript.querySelectorAll(".retry");
  retry.fire("click");
  assert.deepEqual(shown(page), searching);

  second.resolve(ok(answeredChat));
  await setImmediate();
  assert.deepEqual(shown(page), found);
  assert.deepEqual(page.requests, ["/api/v1/chat/stream", chatPath, "/api/v1/chat/stream", chatPath]);
});

test("축하 뒤 전환을 기다리는 동안 새 질문을 보내면 예약한 전환을 취소한다", async () => {
  const second = deferred();
  const page = loadAssistant({ routes: { [chatPath]: [ok(answeredChat), second.promise] } });
  ask(page, "가상 질문 하나");
  await setImmediate();
  assert.deepEqual(shown(page), found);
  assert.deepEqual(page.delays(), [800]);

  ask(page, "가상 질문 둘");
  assert.deepEqual(page.delays(), []);
  assert.deepEqual(shown(page), searching);
  // 시간이 지나도 앞 질문의 전환이 찾는 중을 덮어쓰지 않는다.
  page.runTimers();
  assert.deepEqual(shown(page), searching);

  second.resolve(ok(unansweredChat));
  await setImmediate();
  assert.deepEqual(shown(page), hold);
  page.runTimers();
  assert.deepEqual(shown(page), hold);
});

test("축하 뒤 전환을 기다리는 동안 새 대화를 누르면 예약을 취소하고 평소로 돌아간다", async () => {
  const page = loadAssistant({ routes: { [chatPath]: ok(answeredChat) } });
  ask(page, "가상 질문");
  await setImmediate();
  assert.deepEqual(page.delays(), [800]);

  page.reset.fire("click");
  assert.deepEqual(page.delays(), []);
  assert.deepEqual(shown(page), idle);
  page.runTimers();
  assert.deepEqual(shown(page), idle);
  assert.equal(page.transcript.children.length, 1);
  assert.equal(page.transcript.children[0], page.empty);
});

test("답변 표시에서 새 대화로 가면 자세는 안내 그대로이고 말만 바뀐다", async () => {
  const page = loadAssistant({ routes: { [chatPath]: ok(answeredChat) } });
  ask(page, "가상 질문");
  await setImmediate();
  page.runTimers();
  assert.deepEqual(shown(page), answer);

  // 전환 움직임은 data-pose 값이 달라질 때만 chat.css가 붙인다. 값이 그대로면 다시 돌지 않는다.
  page.reset.fire("click");
  assert.deepEqual(shown(page), idle);
  assert.equal(answer[0], idle[0]);
});

test("졸업 체크: 남은 버튼으로 불러도 같은 규칙을 따르고, 요청 중에는 버튼이 잠겨 요청이 하나만 나간다", async () => {
  const result = deferred();
  const page = loadAssistant({ routes: { [graduationPath]: [result.promise, refused(500)] } });
  await page.selectStudent();

  page.graduation.fire("click");
  assert.deepEqual(shown(page), searching);
  assert.equal(page.graduation.disabled, true);
  page.graduation.fire("click");
  ask(page, "가상 질문");
  assert.deepEqual(page.requests, [graduationPath]);

  result.resolve(ok(graduationResult));
  await setImmediate();
  assert.equal(page.graduation.disabled, false);
  assert.deepEqual(shown(page), found);
  page.runTimers();
  assert.deepEqual(shown(page), answer);

  // 두 번째 요청은 실패한다. 결과 대신 오류 상태가 된다.
  page.graduation.fire("click");
  assert.deepEqual(shown(page), searching);
  await setImmediate();
  assert.deepEqual(shown(page), failed);
  assert.deepEqual(page.requests, [graduationPath, graduationPath]);
});

test("사진 질문: 행사가 확정되면 축하, 읽은 글자로 이어 물어 보류되면 정숙이다", async () => {
  const confirmed = loadAssistant({ routes: { [photoPath]: ok(confirmedPhoto("가상 설명회 11.23")) } });
  sendPhoto(confirmed);
  assert.deepEqual(shown(confirmed), searching);
  await setImmediate();
  assert.deepEqual(shown(confirmed), found);
  assert.deepEqual(confirmed.requests, [photoPath]);
  confirmed.runTimers();
  assert.deepEqual(shown(confirmed), answer);

  // 사진 주소와 글자 주소가 이어지는 동안 계속 찾는 중이다.
  const text = deferred();
  const held = loadAssistant({ routes: { [photoPath]: ok(unmatchedPhoto("가상 안내문 글자")), [textPath]: text.promise } });
  sendPhoto(held, "여기 어디야?");
  await setImmediate();
  assert.deepEqual(held.requests, [photoPath, textPath]);
  assert.deepEqual(shown(held), searching);
  text.resolve(ok(holdAnswer));
  await setImmediate();
  assert.deepEqual(shown(held), hold);
  assert.equal(held.reset.disabled, false);
});

test("사진 질문: 글자 주소가 답을 찾으면 축하, 읽은 글자가 없으면 보류, 서버가 실패하면 오류다", async () => {
  const answered = loadAssistant({ routes: { [photoPath]: ok(unmatchedPhoto("가상관 안내")), [textPath]: ok(campusAnswer) } });
  sendPhoto(answered, "여기 어디야?");
  await setImmediate();
  assert.deepEqual(shown(answered), found);
  answered.runTimers();
  assert.deepEqual(shown(answered), answer);

  const nothing = loadAssistant({ routes: { [photoPath]: ok(unmatchedPhoto("")) } });
  sendPhoto(nothing);
  await setImmediate();
  assert.deepEqual(nothing.requests, [photoPath]);
  assert.deepEqual(shown(nothing), hold);

  const broken = loadAssistant({ routes: { [photoPath]: refused(500) } });
  sendPhoto(broken);
  await setImmediate();
  assert.deepEqual(shown(broken), failed);

  const textBroken = loadAssistant({ routes: { [photoPath]: ok(unmatchedPhoto("가상 글자")), [textPath]: refused(500) } });
  sendPhoto(textBroken);
  await setImmediate();
  assert.deepEqual(shown(textBroken), failed);
});

test("읽은 글자 재질문: 축하를 기다리는 중에 다시 물으면 예약을 취소하고 결과에 따라 상태를 바꾼다", async () => {
  const page = loadAssistant({ routes: { [photoPath]: ok(confirmedPhoto("가상 설명회 11.23")), [textPath]: ok(holdAnswer) } });
  sendPhoto(page);
  await setImmediate();
  assert.deepEqual(shown(page), found);
  assert.deepEqual(page.delays(), [800]);

  const [reask] = page.transcript.querySelectorAll(".reask");
  reask.fire("click");
  assert.deepEqual(page.delays(), []);
  assert.deepEqual(shown(page), searching);
  await setImmediate();

  assert.deepEqual(page.requests, [photoPath, textPath]);
  assert.deepEqual(shown(page), hold);
  page.runTimers();
  assert.deepEqual(shown(page), hold);
});

test("상태 이름도 함께 바뀌어, 쉬는 자세가 평소와 답변 표시에서만 돈다", async () => {
  const reply = deferred();
  const page = loadAssistant({ routes: { [chatPath]: [reply.promise, ok(unansweredChat), refused(500)] } });
  assert.equal(stateOf(page), "idle");

  ask(page, "가상 질문 하나");
  assert.equal(stateOf(page), "searching");
  reply.resolve(ok(answeredChat));
  await setImmediate();
  assert.equal(stateOf(page), "found");
  page.runTimers();
  assert.equal(stateOf(page), "answer");

  ask(page, "가상 질문 둘");
  await setImmediate();
  assert.equal(stateOf(page), "hold");
  ask(page, "가상 질문 셋");
  await setImmediate();
  assert.equal(stateOf(page), "error");

  page.reset.fire("click");
  assert.equal(stateOf(page), "idle");
  // chat.css는 이 두 상태에만 쉬는 자세를 건다. 오류는 자세가 안내로 같아도 쉬지 않는다.
  const resting = rules.filter(([, body]) => body.includes("pet-rest")).map(([selector]) => selector);
  assert.deepEqual(resting, ['.pet-dock[data-state="idle"] .pet-frame, .pet-dock[data-state="answer"] .pet-frame']);
});

test("펫을 누르면 빈 새 대화를 열고 입력창에 초점을 준다", () => {
  const page = loadAssistant();
  page.pet.fire("click");

  assert.equal(page.input.focuses.length, 1);
  assert.equal(page.input.scrolls.length, 0);
  assert.deepEqual(page.requests, []);
  assert.deepEqual(shown(page), idle);
  assert.equal(page.transcript.children.length, 0);
});

test("요청 중 펫으로 새 대화를 열면 늦은 답이 새 대화에 섞이지 않는다", async () => {
  const reply = deferred();
  const page = loadAssistant({ routes: { [chatPath]: reply.promise } });
  ask(page, "가상 질문");
  assert.notEqual(page.graduation.disabled, true);
  assert.notEqual(page.pet.disabled, true);

  page.pet.fire("click");
  assert.equal(page.input.focuses.length, 1);
  assert.equal(page.input.scrolls.length, 0);
  assert.deepEqual(page.requests, ["/api/v1/chat/stream"]);

  reply.resolve(ok(answeredChat));
  await setImmediate();
  assert.equal(page.transcript.querySelectorAll(".answer").length, 0);
  const records = JSON.parse(page.storage.get("kumoh-chat-history:v1:browse"));
  assert.equal(records.length, 1);
  assert.equal(records[0].messages[0].text, "가상 질문");
  assert.ok(records[0].messages.some(message => message.role === "answer"));
});

test("움직임 줄이기 설정에서도 펫과 새 대화 버튼은 같은 동작을 쓴다", () => {
  const motion = { matches: true };
  const page = loadAssistant({ motion });
  page.pet.fire("click");
  assert.equal(page.input.scrolls.length, 0);

  // 사용 중에 설정을 끄면 다음에 누를 때 반영된다.
  motion.matches = false;
  page.pet.fire("click");
  assert.equal(page.input.scrolls.length, 0);
  assert.equal(page.input.focuses.length, 2);

  // 설정 값을 돌려주지 않는 환경에서는 평소처럼 옮긴다.
  const bare = loadAssistant({ motion: null });
  bare.pet.fire("click");
  assert.equal(bare.input.focuses.length, 1);
});

test("스프라이트 시트가 없거나 깨져도 펫 버튼만 숨고 말풍선·질문·재시도·새 대화는 동작한다", async () => {
  const page = loadAssistant({
    sprite: { complete: true, naturalWidth: 0 },
    routes: { [chatPath]: [refused(500), ok(answeredChat)] },
  });
  page.pet.image.fire("error");
  // 보이지 않는 버튼에 초점이 가지 않게 버튼째 숨긴다.
  assert.equal(page.pet.hidden, true);

  ask(page, "가상 질문");
  assert.deepEqual(shown(page), searching);
  await setImmediate();
  assert.deepEqual(shown(page), failed);

  page.transcript.querySelectorAll(".retry")[0].fire("click");
  await setImmediate();
  assert.deepEqual(shown(page), found);
  page.runTimers();
  assert.deepEqual(shown(page), answer);

  page.reset.fire("click");
  assert.deepEqual(shown(page), idle);
  assert.equal(page.pet.hidden, true);
  // 그림을 다른 것으로 바꿔 끼우지 않는다.
  assert.equal(page.pet.image.src, undefined);
  assert.deepEqual([...page.pet.image.attributes], [["src", spriteUrl]]);
});

test("늦게 도착한 스프라이트 로드 신호는 펫 버튼만 보이게 하고, 지금 자세는 바꾸지 못한다", async () => {
  const page = loadAssistant({ sprite: { complete: false, naturalWidth: 0 }, routes: { [chatPath]: ok(answeredChat) } });
  assert.equal(page.pet.hidden, true);
  ask(page, "가상 질문");
  await setImmediate();
  assert.deepEqual(shown(page), found);
  assert.equal(page.pet.hidden, true);

  // 스프라이트 시트가 축하 상태에서야 도착한다.
  Object.assign(page.pet.image, { complete: true, naturalWidth: 960 });
  page.pet.image.fire("load");
  assert.equal(page.pet.hidden, false);
  assert.deepEqual(shown(page), found);
  assert.deepEqual(page.delays(), [800]);
});

test("스크립트가 늦게 실행돼도 이미 받아 둔 스프라이트 시트면 펫 버튼이 바로 보인다", () => {
  const page = loadAssistant({ sprite: { complete: true, naturalWidth: 960 } });
  assert.equal(page.pet.hidden, false);
  assert.deepEqual(shown(page), idle);
});

test("타이머가 없는 환경에서도 오류 없이 답변 표시까지 간다", async () => {
  const page = loadAssistant({ timers: false, routes: { [chatPath]: ok(answeredChat) } });
  ask(page, "가상 질문");
  assert.deepEqual(shown(page), searching);
  await setImmediate();

  assert.equal(page.transcript.querySelectorAll(".error").length, 0);
  assert.deepEqual(shown(page), answer);
});

const pointer = (x, y, id = 1) => ({ pointerId: id, clientX: x, clientY: y, button: 0 });
const coordinate = (page, axis) => Number.parseFloat(page.assistant.properties.get(`--techmo-${axis}`));

test("6px는 누르기이고 초과하면 한 번의 화면 그리기로 마지막 좌표를 반영한다", () => {
  const page = loadAssistant();
  page.pet.fire("pointerdown", pointer(100, 100));
  assert.equal(page.pet.capture, 1);
  page.pet.fire("pointermove", pointer(106, 100));
  assert.equal(page.frameCount(), 0);
  page.pet.fire("pointerup", pointer(106, 100));
  page.pet.fire("click");
  assert.equal(page.input.focuses.length, 1);
  page.pet.fire("pointerdown", pointer(100, 100));
  page.pet.fire("pointermove", pointer(90, 100));
  page.pet.fire("pointermove", pointer(80, 90));
  assert.equal(page.frameCount(), 1);
  assert.equal(page.assistant.dataset.dragging, "true");
  page.draw();
  assert.equal(coordinate(page, "x"), 1080);
  page.pet.fire("pointerup", pointer(70, 80));
  assert.equal(coordinate(page, "x"), 1070);
  assert.equal(page.frameCount(), 0);
  const saved = page.storage.get("kumoh-techmo-position:v1");
  const reopened = loadAssistant({ stored: saved, sprite: { complete: true, naturalWidth: 960, naturalHeight: 192 } });
  assert.equal(coordinate(reopened, "x"), 1070);
  page.pet.fire("click");
  assert.equal(page.input.focuses.length, 1);
  page.pet.fire("keydown", { key: "Enter" });
  page.pet.fire("click", { detail: 0 });
  assert.equal(page.input.focuses.length, 2);
});

test("끌기 취소와 다른 포인터는 대화·저장·축하를 만들지 않는다", () => {
  for (const event of ["pointercancel", "lostpointercapture"]) {
    const page = loadAssistant();
    page.pet.fire("pointerdown", pointer(100, 100));
    page.pet.fire("pointermove", pointer(0, 0, 2));
    assert.equal(page.frameCount(), 0);
    page.pet.fire("pointermove", pointer(90, 90));
    page.pet.fire(event, pointer(90, 90));
    assert.equal(page.assistant.dataset.dragging, "false");
    assert.equal(page.storage.has("kumoh-techmo-position:v1"), false);
    assert.equal(page.input.focuses.length, 0);
    assert.deepEqual(page.delays(), []);
  }
});

test("가두기·비율 변환은 네 가장자리와 깨진 값을 처리한다", () => {
  const page = loadAssistant();
  const viewport = { width: 390, height: 800 };
  const size = { width: 48, height: 48 };
  const clamp = value => JSON.parse(JSON.stringify(page.context.techmoClampPosition(value, viewport, size)));
  assert.deepEqual(clamp({ x: -100, y: -100 }), { x: 8, y: 8 });
  assert.deepEqual(clamp({ x: 9999, y: 9999 }), { x: 334, y: 744 });
  for (const ratio of [null, {}, { x: NaN, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 2 }, { x: "0", y: 0 }]) {
    assert.equal(page.context.techmoRestorePosition(ratio, viewport, size), null);
  }
  const ratio = page.context.techmoPositionRatio({ x: 195, y: 400 }, viewport);
  assert.equal(ratio.x, .5);
  assert.equal(ratio.y, .5);
});

test("저장 위치는 다시 열기와 창 크기 변경에 복원되며 Home은 기본 자리로 돌아간다", () => {
  const stored = JSON.stringify({ x: .25, y: .1 });
  const page = loadAssistant({ stored, sprite: { complete: true, naturalWidth: 960, naturalHeight: 192 } });
  assert.equal(coordinate(page, "x"), 320);
  assert.equal(page.assistant.dataset.facing, "right");
  assert.equal(page.assistant.dataset.bubbleBelow, "false");
  page.resize(390, 800);
  assert.equal(coordinate(page, "x"), 97.5);
  assert.equal(page.storage.get("kumoh-techmo-position:v1"), stored);
  assert.equal(page.pet.fire("keydown", { key: "ArrowLeft" }).defaultPrevented, true);
  assert.ok(page.storage.has("kumoh-techmo-position:v1"));
  page.pet.fire("keydown", { key: "Home" });
  assert.equal(page.assistant.dataset.placed, undefined);
  assert.equal(page.storage.has("kumoh-techmo-position:v1"), false);
  for (const stored of ["broken", '{"x":null,"y":0}', '{"x":-1,"y":0}']) {
    assert.equal(loadAssistant({ stored }).assistant.dataset.placed, undefined);
  }
  const denied = loadAssistant({ storageFails: true });
  denied.pet.fire("keydown", { key: "ArrowLeft" });
  assert.equal(denied.assistant.dataset.placed, undefined);
  assert.equal(loadAssistant({ stored, readFails: true }).assistant.dataset.placed, undefined);
  const noWrite = loadAssistant({ writeFails: true });
  noWrite.pet.fire("keydown", { key: "ArrowLeft" });
  assert.equal(noWrite.assistant.dataset.placed, undefined);
});

function assertBubble(page, { width, height = 64, below = false }) {
  const value = name => Number.parseFloat(page.assistant.properties.get(`--techmo-bubble-${name}`));
  const rect = page.pet.getBoundingClientRect();
  const x = value("x");
  const y = value("y");
  assert.equal(value("width"), width);
  assert.equal(page.assistant.dataset.bubbleBelow, String(below));
  assert.ok(x >= 8 && x + width <= page.context.window.innerWidth - 8);
  assert.ok(y >= 8 && y + height <= page.context.window.innerHeight - 8);
  assert.ok(Math.abs(x + value("tail-x") - rect.left - rect.width / 2) < .0001);
  if (below) assert.equal(y - 10 - (rect.top + rect.height), 8);
  else assert.ok(Math.abs(rect.top + rect.height * 44 / 192 - (y + height + 10) - 8) < .0001);
}

test("기본 자리도 머리 위 8px에 꼬리 끝을 붙이고 넓은 화면 예약 폭 안에서 줄바꿈한다", () => {
  const page = loadAssistant();
  page.context.techmoBubble();
  assertBubble(page, { width: 136 });
  page.resize(1464, 900);
  assertBubble(page, { width: 176 });
  page.resize(960, 900);
  assertBubble(page, { width: 240 });
});

test("961px 이상 기본 말풍선은 본문 오른쪽에서 8px를 비우고 꼬리는 머리를 가리킨다", () => {
  for (const viewportWidth of [961, 1024, 1280, 1384, 1463, 1464, 2000]) {
    const reserve = viewportWidth >= 1464 ? 192 : 152;
    const button = viewportWidth >= 1464 ? 168 : 128;
    const page = loadAssistant({ initialWidth: viewportWidth, petRect: { left: viewportWidth - reserve, top: 620, width: button, height: button } });
    page.context.techmoBubble();
    assertBubble(page, { width: reserve - 16 });
    const x = Number.parseFloat(page.assistant.properties.get("--techmo-bubble-x"));
    const homeRight = (viewportWidth + Math.min(1080, viewportWidth - 2 * reserve)) / 2;
    const chatRight = viewportWidth - reserve;
    assert.ok(x >= homeRight + 8, `${viewportWidth}px 홈`);
    assert.ok(x >= chatRight + 8, `${viewportWidth}px 채팅`);
    page.context.techmoPlace({ x: 400, y: 400 });
    page.context.techmoDrawPosition();
    page.context.techmoBubble();
    assertBubble(page, { width: 240 });
    assert.ok(Number.parseFloat(page.assistant.properties.get("--techmo-bubble-x")) < chatRight + 8);
  }
});

test("680px 이하 대기 말풍선은 숨기고 상태 문구는 움직임 줄이기와 무관하게 4초만 보인다", () => {
  for (const reduced of [false, true]) {
    const page = loadAssistant({ initialWidth: 390, motion: { matches: reduced } });
    page.context.showAssistant("idle");
    assert.equal(page.assistant.dataset.bubbleVisible, "false");
    assert.equal(page.line.textContent, idle[1]);
    for (const [state, expected] of [["searching", searching[1]], ["answer", answer[1]], ["hold", hold[1]], ["error", failed[1]]]) {
      page.context.showAssistant(state);
      assert.equal(page.assistant.dataset.bubbleVisible, "true", state);
      page.advance(3999);
      assert.equal(page.assistant.dataset.bubbleVisible, "true", state);
      page.advance(1);
      assert.equal(page.assistant.dataset.bubbleVisible, "false", state);
      assert.equal(page.line.textContent, expected);
    }
    page.context.showAssistant("idle", "답변이 도착했어요");
    assert.equal(page.assistant.dataset.bubbleVisible, "true");
    page.advance(3000);
    page.context.showAssistant("error");
    page.advance(1000);
    assert.equal(page.assistant.dataset.bubbleVisible, "true");
    page.advance(3000);
    assert.equal(page.assistant.dataset.bubbleVisible, "false");
  }
});

test("좁은 화면 로그인 안내도 문구를 유지하며 4초 후 말풍선만 숨긴다", () => {
  const page = loadAssistant({ initialWidth: 680 });
  const login = page.context.document.querySelector("#login-pet");
  const line = page.context.document.querySelector("#login-pet-line");
  page.context.loginMessage("가상 로그인 안내");
  assert.equal(login.dataset.bubbleVisible, "true");
  page.advance(3999);
  assert.equal(login.dataset.bubbleVisible, "true");
  page.advance(1);
  assert.equal(login.dataset.bubbleVisible, "false");
  assert.equal(line.textContent, "가상 로그인 안내");
});

test("681~960px에서는 대기와 상태 말풍선을 계속 표시한다", () => {
  for (const width of [681, 960]) {
    const page = loadAssistant({ initialWidth: width });
    page.context.showAssistant("idle");
    page.advance(4000);
    assert.notEqual(page.assistant.dataset.bubbleVisible, "false");
    page.context.showAssistant("error");
    page.advance(4000);
    assert.notEqual(page.assistant.dataset.bubbleVisible, "false");
  }
});

test("말풍선 표시 시간이 지나도 읽기 도구용 요청 상태는 유지된다", () => {
  const page = loadAssistant({ initialWidth: 390 });
  page.context.setBusy(true, "가상 요청을 처리하고 있어요");
  const status = page.status.textContent;
  assert.ok(status.length > 0);
  page.advance(4000);
  assert.equal(page.assistant.dataset.bubbleVisible, "false");
  assert.equal(page.status.textContent, status);
  assert.equal(page.line.textContent, searching[1]);
  page.context.showAssistant("hold");
  page.context.setBusy(false);
  assert.equal(page.assistant.dataset.bubbleVisible, "true");
  assert.equal(page.line.textContent, hold[1]);
});

test("680px 경계를 넘으면 표시 규칙을 바꾸고 같은 좁은 화면 크기 변경은 숨김 시간을 늘리지 않는다", () => {
  const page = loadAssistant({ initialWidth: 390 });
  page.context.showAssistant("error");
  page.advance(3000);
  page.resize(600, 800);
  page.advance(1000);
  assert.equal(page.assistant.dataset.bubbleVisible, "false");
  page.resize(681, 800);
  assert.equal(page.assistant.dataset.bubbleVisible, "true");
  page.advance(4000);
  assert.equal(page.assistant.dataset.bubbleVisible, "true");
  page.resize(680, 800);
  assert.equal(page.assistant.dataset.bubbleVisible, "true");
  page.advance(4000);
  assert.equal(page.assistant.dataset.bubbleVisible, "false");
  page.context.showAssistant("searching");
  page.context.showAssistant("idle");
  assert.equal(page.assistant.dataset.bubbleVisible, "false");
});

test("680px 이하 말풍선 숨김은 시각 규칙이며 본문 상태 영역에 적용하지 않는다", () => {
  const hidden = '.pet-dock .pet-says, .login-pet #login-pet-line';
  assert.equal(declarationsAtWidth(hidden, 680).visibility, "hidden");
  assert.equal(declarationsAtWidth('.pet-dock[data-bubble-visible="true"] .pet-says', 680).visibility, "visible");
  assert.equal(declarationsAtWidth('.login-pet[data-bubble-visible="true"] #login-pet-line', 680).visibility, "visible");
  assert.equal(declarationsAtWidth(hidden, 681).visibility, undefined);
  assert.equal(declarationsAtWidth(".status", 680).visibility, undefined);
});

test("옮긴 자리와 양쪽 끝에서 말풍선을 화면 안으로 밀어도 꼬리는 머리 가운데를 가리킨다", () => {
  const page = loadAssistant();
  for (const left of [8, 500, 1144]) {
    page.context.techmoPlace({ x: left, y: 400 });
    page.context.techmoDrawPosition();
    page.context.techmoBubble();
    assertBubble(page, { width: 240 });
  }
  assert.equal(Number.parseFloat(page.assistant.properties.get("--techmo-bubble-x")), 1032);
  assert.ok(Number.parseFloat(page.assistant.properties.get("--techmo-bubble-tail-x")) > 120);
});

test("실제 말풍선 높이로 위쪽 부족을 판단하고 긴 문구도 머리 간격을 지킨다", () => {
  const size = { height: 64 };
  const page = loadAssistant({ petRect: { left: 300, top: 8, width: 128, height: 128 }, bubbleSize: size });
  page.context.techmoBubble();
  assertBubble(page, { width: 136, below: true });
  page.context.techmoPlace({ x: 300, y: 180 });
  page.context.techmoDrawPosition();
  page.context.techmoBubble();
  assertBubble(page, { width: 240 });
  size.height = 220;
  page.context.showAssistant("error");
  assertBubble(page, { width: 240, height: 220, below: true });
});

test("창 크기 변경과 Home 복귀와 그림 로드가 기본 자리 말풍선 좌표를 다시 계산한다", () => {
  const page = loadAssistant({ sprite: { complete: false, naturalWidth: 0 } });
  page.pet.image.complete = true;
  page.pet.image.naturalWidth = 960;
  page.pet.image.fire("load");
  assertBubble(page, { width: 136 });
  page.pet.fire("keydown", { key: "ArrowLeft" });
  assertBubble(page, { width: 240 });
  page.resize(390, 800);
  assertBubble(page, { width: 240 });
  page.pet.fire("keydown", { key: "Home" });
  assert.equal(page.assistant.dataset.placed, undefined);
  assert.equal(page.assistant.dataset.facing, undefined);
  assert.equal(page.assistant.properties.has("--techmo-x"), false);
  page.resize(1280, 800);
  assertBubble(page, { width: 136 });
  page.context.techmoDefaultPosition();
  assert.equal(page.assistant.dataset.bubbleBelow, undefined);
  for (const name of ["x", "y", "width", "tail-x"]) assert.equal(page.assistant.properties.has(`--techmo-bubble-${name}`), false);
});

test("끄는 동안 말풍선을 숨기고 꼬리 방향은 위아래 배치에 따라 바뀐다", () => {
  assert.match(first('.pet-dock[data-dragging="true"] .pet-says'), /visibility: hidden/);
  // 꼬리는 #pet-line 밖의 장식 SVG 한 장이다(#128). 예전 삼각형 두 겹(::before·::after)은 남지 않는다.
  assert.doesNotMatch(styles, /\.pet-says::(?:before|after)/);
  const bubble = /<p class="pet-says">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
  const tail = /<svg class="pet-tail" viewBox="0 0 20 12" aria-hidden="true" focusable="false">([\s\S]*?)<\/svg>/.exec(bubble);
  assert.ok(tail, "말풍선 꼬리 SVG");
  assert.doesNotMatch(/<span id="pet-line">[^<]*<\/span>/.exec(bubble)?.[0] ?? "", /svg/);
  assert.equal(tail[1], '<path class="pet-tail-fill" d="M0 0 L10 11.5 L20 0 Z"/><path class="pet-tail-line" d="M0 0 L10 11.5 L20 0"/>');
  // 12px 그림의 위쪽 1.5px가 말풍선 선을 덮고 끝은 바깥 선에서 10px 떨어진다. 기준은 선 두께만큼 안쪽으로 옮긴다.
  const tailRule = first(".pet-dock .pet-tail");
  assert.match(tailRule, /left: calc\(var\(--techmo-bubble-tail-x\) - 1\.5px\);/);
  assert.match(tailRule, /top: 100%;/);
  assert.match(tailRule, /height: 12px;/);
  assert.match(tailRule, /transform: translateX\(-50%\);/);
  assert.match(first('.pet-dock[data-bubble-below="true"] .pet-tail'), /top: auto; bottom: 100%; transform: translateX\(-50%\) scaleY\(-1\);/);
  assert.match(first(".pet-tail-fill"), /fill: var\(--pet-bubble\);/);
  assert.match(first(".pet-tail-line"), /fill: none; stroke: var\(--navy\); stroke-width: 1\.5px;/);
  // 나타날 때 꼬리 끝을 기준으로 .92에서 1로 커지고, 움직임 줄이기에서는 끈다.
  assert.match(first(".pet-dock .pet-says"), /position: fixed;/);
  assert.match(rules.find(([name, body]) => name === ".pet-dock .pet-says" && body.startsWith("transform-origin"))?.[1] ?? "", /^transform-origin: var\(--techmo-bubble-tail-x\) calc\(100% \+ 10px\);$/);
  assert.match(first('.pet-dock[data-bubble-below="true"] .pet-says'), /transform-origin: var\(--techmo-bubble-tail-x\) -10px;/);
  assert.match(first('.pet-dock[data-bubble-visible="true"] .pet-says'), /animation: pet-says-in \.2s ease-out;/);
  assert.match(styles, /@keyframes pet-says-in \{\s*from \{ opacity: 0; transform: scale\(\.92\); \}\s*to \{ opacity: 1; transform: scale\(1\); \}\s*\}/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\) \{[^{}]*\{[^{}]*\}\s*\.pet-dock \.pet-says, \.pet-dock\[data-bubble-visible="true"\] \.pet-says \{ animation: none !important; \}\s*\}/);
  const page = loadAssistant();
  page.context.techmoBubble();
  const y = page.assistant.properties.get("--techmo-bubble-y");
  page.pet.fire("pointerdown", pointer(100, 100));
  page.pet.fire("pointermove", pointer(90, 90));
  assert.equal(page.assistant.dataset.dragging, "true");
  page.context.techmoBubble();
  assert.equal(page.assistant.properties.get("--techmo-bubble-y"), y);
});

test("말풍선은 패널 색과 나뉜 크림 바탕에 남색 선과 흐림 없는 그림자를 쓴다", () => {
  const says = first(".pet-says");
  for (const part of ["max-width: 22em;", "border: 1.5px solid var(--navy);", "background: var(--pet-bubble);",
    "box-shadow: 3px 3px 0 var(--navy);", "color: var(--navy);", "font-weight: 600;", "word-break: keep-all;"]) {
    assert.ok(says.includes(part), part);
  }
  assert.match(styles, /--pet-bubble: #FFF6D6;/);
  assert.match(styles, /--pet-bubble-dark: #F3E7BF;/);
  assert.match(styles, /@media \(prefers-color-scheme: dark\) \{\s*:root \{ --pet-bubble: var\(--pet-bubble-dark\); \}\s*\}/);
  // 패널 색과의 공유를 끊었다. 말풍선 규칙 어디에도 --glass-dense가 없다.
  for (const [selector, body] of rules) {
    if (/pet-says|pet-tail/.test(selector)) assert.doesNotMatch(body, /--glass-dense/, selector);
  }
  // 고정 배치 말풍선도 22em을 넘지 않고, 로그인 말풍선은 이번 범위 밖이라 그대로다.
  assert.match(first(".pet-dock .pet-says"), /max-width: min\(22em, calc\(100vw - 16px\)\);/);
  assert.match(first("#login-pet-line"), /background: var\(--glass-dense\);/);
});

test("화살표는 16px, Shift 화살표는 64px 움직이며 Space 기본 클릭이 한 번 실행된다", () => {
  const page = loadAssistant();
  page.pet.fire("keydown", { key: "ArrowLeft" });
  assert.equal(coordinate(page, "x"), 1084);
  page.pet.fire("keydown", { key: "ArrowLeft", shiftKey: true });
  assert.equal(coordinate(page, "x"), 1020);
  page.pet.fire("keydown", { key: " " });
  page.pet.fire("click", { detail: 0 });
  assert.equal(page.input.focuses.length, 1);
});

test("배치와 새 시트의 실제 크기가 모두 맞아야 프레임 재생을 켠다", () => {
  const page = loadAssistant({ layout: techmoLayout, sprite: { complete: true, naturalWidth: 1536, naturalHeight: 960 } });
  assert.equal(page.assistant.dataset.spriteLayout, "animated");
  assert.equal(page.assistant.properties.get("--techmo-frames"), "8");
  for (const options of [
    { layout: techmoLayout, sprite: { complete: true, naturalWidth: 960, naturalHeight: 192 } },
    { layout: "broken", sprite: { complete: true, naturalWidth: 1536, naturalHeight: 960 } },
    { sprite: { complete: true, naturalWidth: 1536, naturalHeight: 960 } },
  ]) assert.equal(loadAssistant(options).assistant.dataset.spriteLayout, "legacy");
  const animation = first(':is(.pet-dock, .login-pet)[data-sprite-layout="animated"] .pet-frame');
  assert.match(animation, /steps\(var\(--techmo-frames\), end\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*:is\(\.pet-dock, \.login-pet\)\[data-sprite-layout="animated"\] \.pet-frame \{ animation: none !important; background-position: 0 var\(--techmo-row\); \}/);
});

test("짧은 동작 줄은 유효 칸만 재생하고 끄는 동안 도착한 답은 끌기 동작을 유지한다", async () => {
  const reply = deferred();
  const page = loadAssistant({ layout: techmoLayout, sprite: { complete: true, naturalWidth: 1536, naturalHeight: 960 }, routes: { [chatPath]: reply.promise } });
  ask(page, "가상 질문");
  assert.equal(page.assistant.properties.get("--techmo-frames"), "4");
  page.pet.fire("pointerdown", pointer(100, 100));
  page.pet.fire("pointermove", pointer(90, 90));
  assert.equal(page.assistant.properties.get("--techmo-frames"), "6");
  reply.resolve(ok(answeredChat));
  await setImmediate();
  assert.equal(page.assistant.dataset.dragging, "true");
  assert.equal(page.assistant.properties.get("--techmo-frames"), "6");
  page.pet.fire("pointerup", pointer(90, 90));
  assert.equal(page.assistant.properties.get("--techmo-frames"), "8");
  page.runTimers();
  assert.equal(page.assistant.dataset.dragging, "false");
  assert.equal(page.assistant.dataset.motion, "guide");
});

test("390px에서도 끌 수 있고 제자리로 돌아온 끌기는 클릭으로 바뀌지 않는다", () => {
  const page = loadAssistant();
  page.resize(390, 800);
  page.pet.fire("pointerdown", pointer(100, 100));
  page.pet.fire("pointermove", pointer(110, 100));
  page.pet.fire("pointermove", pointer(100, 100));
  page.pet.fire("pointerup", pointer(100, 100));
  page.pet.fire("click");
  assert.equal(page.input.focuses.length, 0);
  assert.equal(page.assistant.dataset.placed, "true");
  assert.equal(coordinate(page, "x"), 254);
  assert.ok(page.storage.has("kumoh-techmo-position:v1"));
});

test("숨긴 그림의 저장 위치는 로드 후 실제 버튼 크기로 복원한다", () => {
  const page = loadAssistant({ stored: '{"x":0.5,"y":0.5}', sprite: { complete: false, naturalWidth: 0 } });
  assert.equal(page.pet.hidden, true);
  assert.equal(page.assistant.dataset.placed, undefined);
  Object.assign(page.pet.image, { complete: true, naturalWidth: 960, naturalHeight: 192 });
  page.pet.image.fire("load");
  assert.equal(page.pet.hidden, false);
  assert.equal(coordinate(page, "x"), 640);
  assert.equal(coordinate(page, "y"), 400);
});

test("본문이 숨은 동안 받은 그림의 저장 위치는 로그인과 둘러보기 직후 복원한다", async () => {
  const stored = '{"x":0.25,"y":0.5}';
  for (const entry of ["login", "browse"]) {
    const page = loadAssistant({
      stored,
      screenVisibility: true,
      sprite: { complete: true, naturalWidth: 960, naturalHeight: 192 },
    });
    const main = page.context.document.querySelector("#main-screen");
    assert.equal(main.hidden, true);
    assert.equal(page.pet.hidden, false);
    assert.equal(page.pet.getBoundingClientRect().width, 0);
    assert.equal(page.assistant.dataset.placed, undefined);
    if (entry === "login") await page.selectStudent();
    else page.context.document.querySelector("#browse-main").fire("click");
    assert.equal(main.hidden, false);
    assert.equal(coordinate(page, "x"), 320);
    assert.equal(coordinate(page, "y"), 400);
    assert.equal(page.assistant.properties.get("--techmo-pet-size"), "128px");
    assert.equal(page.storage.get("kumoh-techmo-position:v1"), stored);
  }
});

test("본문이 숨은 동안 받은 그림도 로그인과 둘러보기 직후 기본 말풍선을 계산한다", async () => {
  for (const entry of ["login", "browse"]) {
    const page = loadAssistant({ screenVisibility: true, sprite: { complete: true, naturalWidth: 960, naturalHeight: 192 } });
    assert.equal(page.pet.getBoundingClientRect().width, 0);
    if (entry === "login") await page.selectStudent();
    else page.context.document.querySelector("#browse-main").fire("click");
    assertBubble(page, { width: 136 });
    assert.equal(page.assistant.dataset.placed, undefined);
  }
});
