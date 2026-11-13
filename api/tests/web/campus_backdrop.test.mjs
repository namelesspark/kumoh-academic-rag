// 가상 그림과 시계로 배경을 확인한다. 학교 사진을 내려받거나 서버를 띄우지 않는다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    "float front=age*0.26;",
    "cos((r-front)*58.0)*env",
    "off+=(d/r)*w*0.022;",
    "uv.y=1.0-uv.y;",
    "texture2D(a,cover(uv,panA)).rgb",
    "texture2D(b,cover(uv,panB)).rgb",
    "gl_FragColor=vec4(c,1.0);",
  ]) assert.ok(script.includes(expression), expression);
  assert.match(script, /uniform\s+vec3\s+drops\[16\]/);
  for (const constant of ["CLAMP_TO_EDGE", "LINEAR"]) assert.ok(script.includes(constant));
  assert.doesNotMatch(script, /generateMipmap\s*\(/);
});

async function backdrop({ unavailable = false, reduced = false, brokenPhoto = false, brokenShader = false } = {}) {
  const listeners = new Map(), pending = new Map(), uniforms = new Map(), requests = [], parameters = [];
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
    fetch: async path => { requests.push(path); return { ok: !brokenPhoto, blob: async () => ({}) }; },
    createImageBitmap: async () => ({ close() {} }),
  };
  const start = script.indexOf("async function initializeCampusBackdrop()");
  assert.ok(start >= 0);
  const source = script.slice(start, script.indexOf("void initializeCampusBackdrop();", start));
  await runInNewContext(`${source}\ninitializeCampusBackdrop()`, context);
  return { canvas, uniforms, requests, parameters, pending, document, label, steps, draws: () => draws,
    tick(time) { const callbacks = [...pending.values()]; pending.clear(); for (const fn of callbacks) fn(time); },
    fire(name, event = {}) { listeners.get(name)?.({ type: name, preventDefault() {}, ...event }); },
  };
}

test("사진은 9초 유지하고 2.2초 동안 smoothstep으로 다음 사진에 겹친다", async () => {
  const page = await backdrop();
  assert.equal(page.requests.length, 4);
  assert.equal(page.parameters.filter(args => args[2] === "CLAMP_TO_EDGE").length, 8);
  assert.equal(page.parameters.filter(args => args[2] === "LINEAR").length, 8);
  page.tick(0);
  assert.equal(page.canvas.width, 1920);
  assert.equal(page.canvas.height, 1200);
  page.tick(9000);
  assert.equal(page.uniforms.get("mixv"), 0);
  page.tick(10100);
  assert.ok(Math.abs(page.uniforms.get("mixv") - 0.5) < 1e-8);
  page.tick(11200);
  assert.equal(page.label.textContent, "디지털관과 금오산 자락");
  assert.equal(page.steps[1]["data-current"], "true");
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
