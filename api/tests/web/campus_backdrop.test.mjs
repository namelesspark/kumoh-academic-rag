// 가상 그림과 시계로 배경을 확인한다. 학교 사진을 내려받거나 서버를 띄우지 않는다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const read = name => readFileSync(new URL(`../../app/chat_web/${name}`, import.meta.url), "utf8");
const script = read("assets/chat.js");
const html = read("index.html");
const styles = read("assets/chat.css");

test("배경 사진 순서와 캔버스의 접근성·보안 약속을 지킨다", () => {
  const names = ["campus-aerial.jpg", "campus-hill.jpg", "campus-gate.jpg", "campus-field.jpg"];
  let previous = -1;
  for (const name of names) {
    const index = script.indexOf(name);
    assert.ok(index > previous, name);
    previous = index;
  }
  assert.match(html, /<canvas\b[^>]*aria-hidden="true"[^>]*>/);
  assert.match(styles, /background(?:-image)?:[^;]*campus-aerial\.jpg/);
  assert.doesNotMatch(html, /\sstyle=|<style\b|<script(?![^>]*\bsrc=)/);
  assert.doesNotMatch(script, /\.src\s*=|\.style\b|setInterval/);
  assert.equal(script.split("setTimeout(").length, 2);
});

test("셰이더 핵심의 물결·합성 수식과 uniform을 유지한다", () => {
  for (const expression of [
    "float win=min(1.0,aspect/imgAspect)*0.94;",
    "for(int i=0;i<16;i++)",
    "float front=age*0.22;",
    "exp(-age*1.15)*smoothstep(0.22,0.0,abs(r-front))*smoothstep(0.0,0.05,r)",
    "cos((r-front)*30.0)*env",
    "off+=(d/r)*w*0.013;",
    "c+=vec3(0.70,0.90,1.0)*max(light,0.0)*0.16;",
    "c-=vec3(0.06,0.05,0.03)*max(-light,0.0)*0.45;",
    "uv.y=1.0-uv.y;",
    "texture2D(a,cover(uv,panA)).rgb",
    "texture2D(b,cover(uv,panB)).rgb",
    "gl_FragColor=vec4(c,1.0);",
  ]) assert.ok(script.includes(expression), expression);
  assert.match(script, /uniform\s+vec3\s+drops\[16\]/);
  for (const constant of ["CLAMP_TO_EDGE", "LINEAR"]) assert.ok(script.includes(constant));
  assert.doesNotMatch(script, /generateMipmap\s*\(/);
});

async function backdrop({ unavailable = false, reduced = false, brokenPhoto = false, brokenShader = false, delayedPhoto = null } = {}) {
  const listeners = new Map(), pending = new Map(), uniforms = new Map(), requests = [], parameters = [];
  let finishPhoto;
  const delayed = new Promise(resolve => { finishPhoto = resolve; });
  let next = 0, draws = 0;
  const gl = new Proxy({
    getShaderPrecisionFormat: () => ({ precision: 23 }),
    getShaderParameter: () => !brokenShader,
    getProgramParameter: () => true,
    getUniformLocation: (_program, name) => name,
    uniform1f: (name, value) => uniforms.set(name, value),
    uniform3fv: (name, value) => uniforms.set(name, Array.from(value)),
    texParameteri: (...args) => parameters.push(args),
    drawArrays: () => { draws++; },
  }, { get: (target, key) => key in target ? target[key] : /^[A-Z_0-9]+$/.test(key) ? key : () => ({}) });
  const canvas = { hidden: true, getContext: () => unavailable ? null : gl,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
    addEventListener: (name, fn) => listeners.set(name, fn) };
  const label = {}, steps = Array.from({ length: 4 }, () => ({ setAttribute(name, value) { this[name] = value; } }));
  const document = { hidden: false,
    querySelector: selector => selector === "#campus-canvas" ? canvas : label,
    querySelectorAll: () => steps,
    addEventListener: (name, fn) => listeners.set(name, fn),
  };
  const context = { document, reducedMotion: () => reduced,
    window: { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 3,
      requestAnimationFrame: fn => { pending.set(++next, fn); return next; },
      cancelAnimationFrame: id => pending.delete(id),
    },
    fetch: async path => {
      requests.push(path);
      if (path.endsWith(delayedPhoto ?? "never-delayed")) await delayed;
      return { ok: !brokenPhoto, blob: async () => ({}) };
    },
    createImageBitmap: async () => ({ close() {} }),
  };
  const start = script.indexOf("async function initializeCampusBackdrop()");
  assert.ok(start >= 0);
  const source = script.slice(start, script.indexOf("void initializeCampusBackdrop();", start));
  await runInNewContext(`${source}\ninitializeCampusBackdrop()`, context);
  await setImmediate();
  return { canvas, uniforms, requests, parameters, pending, document, label, steps, draws: () => draws,
    async finishPhoto() { finishPhoto(); await setImmediate(); },
    tick(time) { const callbacks = [...pending.values()]; pending.clear(); for (const fn of callbacks) fn(time); },
    fire(name, event = {}) { listeners.get(name)?.({ type: name, preventDefault() {}, ...event }); },
  };
}

test("사진은 9초 유지하고 3.2초 겹치며 절반을 넘으면 이름과 진행 칸을 바꾼다", async () => {
  const page = await backdrop();
  assert.equal(page.requests.length, 4);
  assert.equal(page.parameters.filter(args => args[2] === "CLAMP_TO_EDGE").length, 8);
  assert.equal(page.parameters.filter(args => args[2] === "LINEAR").length, 8);
  page.tick(0);
  assert.equal(page.canvas.width, 1920);
  assert.equal(page.canvas.height, 1200);
  page.tick(9000);
  assert.equal(page.uniforms.get("mixv"), 0);
  page.tick(10600);
  assert.ok(Math.abs(page.uniforms.get("mixv") - 0.5) < 1e-8);
  assert.equal(page.label.textContent, "양호동 캠퍼스");
  page.tick(10601);
  assert.equal(page.label.textContent, "디지털관과 금오산 자락");
  assert.equal(page.steps[1]["data-current"], "true");
  page.tick(12200);
  assert.equal(page.uniforms.get("mixv"), 0);
  assert.equal(page.label.textContent, "디지털관과 금오산 자락");
});

test("여러 사진 주기의 교체 직전 panB와 교체 직후 panA는 1e-6 이내로 이어진다", async () => {
  const page = await backdrop();
  page.tick(0);
  const HOLD = 9, FADE = 3.2, period = HOLD + FADE, life = HOLD + 2 * FADE;
  const expectedPan = (number, local) => {
    const p = Math.max(0, Math.min(1, local / life));
    return number % 2 === 0 ? 0.28 + p * 0.44 : 0.72 - p * 0.44;
  };
  for (let k = 0; k < 12; k++) {
    assert.ok(Math.abs(expectedPan(k + 1, period - HOLD) - expectedPan(k + 1, FADE)) < 1e-6);
    page.tick(((k + 1) * period - 1e-7) * 1000);
    const before = page.uniforms.get("panB");
    assert.ok(Math.abs(before - expectedPan(k + 1, FADE)) < 1e-6);
    page.tick((k + 1) * period * 1000 + 1e-6);
    assert.ok(Math.abs(before - page.uniforms.get("panA")) < 1e-6, `cycle ${k}`);
  }
});

test("다음 사진이 늦으면 그 주기를 건너뛰고 다음 주기까지 현재 사진과 위치를 유지한다", async () => {
  const page = await backdrop({ delayedPhoto: "campus-hill.jpg" });
  page.tick(0);
  assert.equal(page.canvas.hidden, false, "첫 사진은 다음 사진을 기다리지 않고 보인다");
  page.tick(9000);
  const heldPan = page.uniforms.get("panA");
  await page.finishPhoto();
  page.tick(10601);
  assert.equal(page.uniforms.get("mixv"), 0, "준비가 끝나도 이미 건너뛴 주기는 전환하지 않는다");
  assert.equal(page.label.textContent, "양호동 캠퍼스");
  page.tick(12199.999);
  const beforeSkippedBoundary = page.uniforms.get("panA");
  page.tick(12200);
  assert.equal(page.label.textContent, "양호동 캠퍼스");
  assert.equal(page.uniforms.get("mixv"), 0);
  assert.ok(Math.abs(beforeSkippedBoundary - page.uniforms.get("panA")) < 1e-6);
  assert.ok(page.uniforms.get("panA") >= heldPan);
  page.tick(21200);
  page.tick(22801);
  assert.equal(page.label.textContent, "디지털관과 금오산 자락");
  page.tick(24399.999);
  const beforeSuccessfulBoundary = page.uniforms.get("panB");
  page.tick(24400.00001);
  assert.ok(Math.abs(beforeSuccessfulBoundary - page.uniforms.get("panA")) < 1e-6);
});

test("초기 물방울 세 개와 포인터 간격·거리를 그리기 시각으로 처리한다", async () => {
  const page = await backdrop();
  page.tick(0);
  assert.ok(page.uniforms.get("drops[0]").filter((_, i) => i % 3 === 2).every(value => value < 0));
  page.tick(300); page.tick(900); page.tick(1500);
  let drops = page.uniforms.get("drops[0]");
  assert.equal(drops.filter((value, i) => i % 3 === 2 && value >= 0).length, 3);
  page.fire("pointermove", { clientX: 100, clientY: 100 });
  page.fire("pointermove", { clientX: 300, clientY: 300 });
  page.tick(1600);
  assert.equal(page.uniforms.get("drops[0]").filter((value, i) => i % 3 === 2 && value >= 0).length, 4);
  page.fire("pointermove", { clientX: 101, clientY: 101 });
  page.tick(1700);
  assert.equal(page.uniforms.get("drops[0]").filter((value, i) => i % 3 === 2 && value >= 0).length, 4);
  page.fire("pointermove", { clientX: 300, clientY: 300 });
  page.fire("pointerdown", { clientX: 301, clientY: 301 });
  page.tick(1800);
  assert.equal(page.uniforms.get("drops[0]").filter((value, i) => i % 3 === 2 && value >= 0).length, 6);
});

test("가려진 시간은 제외하고 재개하며 그래픽·사진 실패와 움직임 줄이기는 정지 배경을 남긴다", async () => {
  const page = await backdrop();
  page.tick(0); page.tick(1000);
  page.document.hidden = true; page.fire("visibilitychange");
  assert.equal(page.pending.size, 0);
  page.document.hidden = false; page.fire("visibilitychange");
  page.tick(100000); page.tick(101000);
  assert.equal(page.uniforms.get("t"), 2);
  page.fire("webglcontextlost");
  assert.equal(page.canvas.hidden, true);
  assert.equal(page.pending.size, 0);
  page.document.hidden = true; page.fire("visibilitychange");
  page.document.hidden = false; page.fire("visibilitychange");
  assert.equal(page.pending.size, 0, "그래픽 실패 뒤 탭을 다시 열어도 정지 배경을 유지한다");
  for (const options of [{ unavailable: true }, { reduced: true }, { brokenPhoto: true }, { brokenShader: true }]) {
    const failed = await backdrop(options);
    assert.equal(failed.canvas.hidden, true);
    assert.equal(failed.pending.size, 0);
  }
});
