import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const html = readFileSync(new URL("../../app/chat_web/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../../app/chat_web/assets/chat.js", import.meta.url), "utf8");

test("시연 계정 세 개와 비밀번호 입력란, 둘러보기 진입을 제공한다", () => {
  assert.match(html, /id="login-form"/);
  assert.match(html, /type="password"/);
  assert.match(html, /id="browse-main"/);
  assert.match(html, /로그인 없이 둘러보기/);
  for (const number of ["20990002", "20990003", "20990004"]) assert.match(html, new RegExp(`data-demo-account="${number}"`));
  const numberInput = /<input\b[^>]*id="student-number"[^>]*>/.exec(html)?.[0] ?? "";
  for (const attribute of ['inputmode="numeric"', 'maxlength="8"', 'placeholder="예: 20990002"']) assert.ok(numberInput.includes(attribute));
  for (const line of ["학번으로 들어와 보세요!", "좋아요, 로그인을 눌러 보세요", "쉿, 시연 계정으로만 들어올 수 있어요"]) {
    assert.ok((html + script).includes(line));
  }
});

test("문서 안 실행 코드와 스타일, 외부 라이브러리를 추가하지 않는다", () => {
  assert.equal([...html.matchAll(/<script\b/g)].length, 1);
  assert.match(html, /<script src="\/chat-assets\/chat.js" defer><\/script>/);
  assert.doesNotMatch(html, /\sstyle\s*=|<style\b|\son\w+\s*=/i);
  assert.doesNotMatch(script, /document\.cookie|\.src\s*=|\.style\b/);
  assert.match(script, /setTimeout/);
  assert.equal([...script.matchAll(/prefers-reduced-motion/g)].length, 1);
});

test("확정한 제목 그림과 도면 장식은 같은 글귀의 대체 제목과 함께 제공한다", () => {
  assert.match(html, /<img src="\/chat-assets\/title-lettering\.png" alt="졸업까지, 테크모와 함께"[^>]*>/);
  assert.doesNotMatch(html + script, /calligraphy-title\.png|East Sea Dokdo/);
  assert.match(html, /class="title-lettering"[^>]*data-brand-slot[^>]*hidden/);
  assert.match(html, /<h1 class="title-fallback">졸업까지,<span><em>테크모<\/em>와 함께<\/span><\/h1>/);
  assert.match(html, /class="drawing-dimension"[^>]*aria-hidden="true"[^>]*>KIT · ACADEMIC GUIDE  ⟵ 2026 ⟶<\//);
  assert.match(html, /class="title-ticks"[^>]*aria-hidden="true"/);
  assert.doesNotMatch(html, /feature-pills|가상 학생의 이수 내역으로 졸업 조건을 계산하고/);
});

test("여섯 기능 카드와 열린 패널의 배지에는 확정한 직접 그린 선 아이콘을 쓴다", () => {
  const glyphs = {
    graduation: '<path d="M5.2 16.5a8 8 0 1 1 13.6 0"/><path class="a" d="m8.6 12.4 2.5 2.5 4.5-5"/><path d="M4 19.5h16"/>',
    biskit: '<circle cx="5.5" cy="6.5" r="2"/><circle cx="5.5" cy="17.5" r="2"/><circle class="a f" cx="18" cy="12" r="2.6"/><path d="M7.5 6.5H11l3 4.2M7.5 17.5H11l3-4.2"/><path d="M11 6.5v11"/>',
    photo: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path class="a" d="M3 12h18"/><path d="M8 9h8M8 15h5"/>',
    ask: '<path d="M7 3.5h7.5L19 8v12.5H7Z"/><path d="M14.5 3.5V8H19"/><path class="a" d="m11.2 12-2 2.2 2 2.2M14.8 12l2 2.2-2 2.2"/>',
    calendar: '<path d="M4 4v16h16"/><path d="M7.5 8h6"/><path class="a" d="M10 12h7"/><path d="M8.5 16h4"/>',
    campus: '<path d="M4 9h16M4 15h16M9 4v16M15 4v16"/><circle class="a" cx="12" cy="12" r="3.2"/><circle class="a f" cx="12" cy="12" r="1"/>',
  };
  const badges = [...html.matchAll(/<span class="feature-badge" aria-hidden="true">\s*(<svg[^>]*>[\s\S]*?<\/svg>)\s*<\/span>/g)];
  assert.equal(badges.length, 12);
  for (const [feature, expected] of Object.entries(glyphs)) {
    const card = new RegExp(`<button[^>]*data-feature="${feature}"[^>]*>([\\s\\S]*?)<\\/button>`).exec(html)?.[1] ?? "";
    const panel = new RegExp(`<section[^>]*data-panel="${feature}"[^>]*>([\\s\\S]*?)<\\/h4>`).exec(html)?.[1] ?? "";
    for (const region of [card, panel]) {
      const svg = /<svg\b([^>]*)>([\s\S]*?)<\/svg>/.exec(region);
      assert.ok(svg, feature);
      assert.match(svg[1], /viewBox="0 0 24 24"/);
      assert.equal(svg[2].replace(/>\s+</g, "><").trim(), expected, feature);
    }
  }
});
