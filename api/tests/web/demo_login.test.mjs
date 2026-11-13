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
  assert.doesNotMatch(script, /localStorage|document\.cookie|\.src\s*=|\.style\b/);
  assert.equal([...script.matchAll(/\bsetTimeout\s*\(/g)].length, 1);
  assert.equal([...script.matchAll(/prefers-reduced-motion/g)].length, 1);
});
