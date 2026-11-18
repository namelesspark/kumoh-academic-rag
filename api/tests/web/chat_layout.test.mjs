import assert from "node:assert/strict";

import { readFileSync } from "node:fs";

import { test } from "node:test";

const css = readFileSync(
  new URL("../../app/chat_web/assets/chat.css", import.meta.url),
  "utf8",
);

function body(selector) {
  const start = css.indexOf(selector + " {");
  assert.notEqual(start, -1, selector);
  return css.slice(start, css.indexOf("}", start));
}
test("가운데 정렬과 테크모 예약 폭은 합의한 경계와 폭을 쓴다", () => {
  assert.match(
    css,
    /@media \(min-width: 961px\) \{\s*:root \{ --pet-reserve: 152px;/,
  );
  assert.match(
    css,
    /@media \(min-width: 1464px\) \{\s*:root \{ --pet-reserve: 192px;/,
  );
  assert.match(
    css,
    /\.masthead-inner, \.main-welcome \{[^}]*margin-inline: auto/,
  );
  assert.match(css, /right: 24px;/);
  const expected = [
    [961, 152, 657, 373],
    [1280, 152, 976, 692],
    [1384, 152, 1080, 760],
    [1463, 152, 1080, 760],
    [1464, 192, 1080, 760],
    [2000, 192, 1080, 760],
  ];
  for (const [width, reserve, home, chat] of expected) {
    assert.equal(Math.min(1080, width - 2 * reserve), home);
    assert.equal(Math.min(760, width - 284 - 2 * reserve), chat);
  }
});

test("채팅은 목록 260px과 가운데 대화 열, 고정 높이 입력 줄을 둔다", () => {
  assert.match(
    body('body[data-view="chat"] .layout'),
    /grid-template-columns: 260px minmax\(0, 1fr\)/,
  );
  assert.match(
    body('body[data-view="chat"] .chat'),
    /justify-self: center; width: min\(760px, 100%\)/,
  );
  assert.match(body('body[data-view="chat"] .transcript'), /overflow-y: auto/);
  assert.match(
    body('body[data-view="chat"] .composer textarea'),
    /height: 44px/,
  );
  assert.match(
    body("#conversation-sidebar"),
    /background: var\(--main-surface\); color: var\(--ink\); -webkit-backdrop-filter: blur\(16px\) saturate\(1\.3\); backdrop-filter: blur\(16px\) saturate\(1\.3\)/,
  );
  assert.match(body(".conversation-unread"), /width: 8px; height: 8px/);
});

test("화면 전환은 transform과 opacity만 움직이고 서랍도 transform으로 움직인다", () => {
  for (
    const name of ["chat-rise", "chat-lower", "chat-fade-in", "chat-fade-out"]
  ) {
    const start = css.indexOf("@keyframes " + name);
    const end = css.indexOf("} }", start);
    const motion = css.slice(start, end + 3);
    assert.doesNotMatch(motion, /(?:width|height|top|left):/);
    assert.match(motion, /opacity:/);
  }
  assert.match(
    css,
    /#conversation-sidebar \{[^}]*transform: translateX\(-105%\); transition: transform \.35s ease;/,
  );
  assert.match(css, /@media \(max-width: 960px\)/);
  assert.match(css, /@media \(max-width: 680px\)/);
});

test("제목 그림과 대체 제목은 같은 축에서 로드 상태에 맞춰 보인다", () => {
  assert.match(body(".main-lettering img"), /height: 72px/);
  assert.match(css, /\.main-lettering img \{ height: 48px; \}/);
  // 강조 글자는 흰색이고 노랑은 밑줄로만 쓴다(#131). 흰 사진 위에서 노란 글자는 큰 글자 기준 3:1에 못 미친다.
  assert.match(css, /\.main-title-fallback em \{[^}]*color: var\(--white\);[^}]*text-decoration: underline \.12em var\(--yellow\)/);
  assert.match(
    css,
    /\.main-lettering:not\(\[hidden\]\) \+ \.main-title-fallback \{ display: none; \}/,
  );
});
