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
  assert.match(script, /setTimeout/);
});

test("셰이더 핵심의 물결·합성 수식과 uniform을 유지한다", () => {
  for (const expression of [
    "float win=min(1.0,aspect/imgAspect)*0.94;",
    "for(int i=0;i<16;i++)",
    "if(age<0.0||age>1.8) continue;",
    "float front=age*0.085;",
    "exp(-age*2.2)*smoothstep(0.075,0.0,abs(r-front))*smoothstep(0.0,0.012,r)",
    "cos((r-front)*70.0)*env",
    "off+=(d/r)*w*0.0075;",
    "off+=still*0.0008*vec2(sin(uv.y*18.0+t*0.9),cos(uv.x*14.0-t*0.7));",
    "c+=vec3(0.70,0.92,1.0)*max(light,0.0)*0.10;",
    "c-=vec3(0.08,0.06,0.03)*max(-light,0.0)*0.18;",
    "uv.y=1.0-uv.y;",
    "texture2D(a,cover(uv,panA)).rgb",
    "texture2D(b,cover(uv,panB)).rgb",
    "gl_FragColor=vec4(c,1.0);",
  ]) assert.ok(script.includes(expression), expression);
  assert.match(script, /uniform\s+vec3\s+drops\[16\]/);
  for (const constant of ["CLAMP_TO_EDGE", "LINEAR"]) assert.ok(script.includes(constant));
  assert.doesNotMatch(script, /generateMipmap\s*\(/);
});

async function backdrop({ unavailable = false, reduced = false, brokenPhoto = false, brokenShader = false, delayedPhoto = null, failures = {} } = {}) {
  const listeners = new Map(), pending = new Map(), uniforms = new Map(), requests = [], parameters = [];
  const windowListeners = new Map();
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
  const label = {};
  const caption = { hidden: true };
  const progress = { children: [], replaceChildren(...children) { this.children = children; } };
  const document = { hidden: false,
    querySelector: selector => ({ "#campus-canvas": canvas, "#campus-name": label, "#campus-caption": caption, "#campus-progress": progress })[selector] ?? null,
    createElement: () => ({ setAttribute(name, value) { this[name] = value; } }),
    addEventListener: (name, fn) => listeners.set(name, fn),
  };
  const context = { document, reducedMotion: () => reduced,
    window: { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 3,
      requestAnimationFrame: fn => { pending.set(++next, fn); return next; },
      cancelAnimationFrame: id => pending.delete(id),
      addEventListener: (name, listener, options) => windowListeners.set(name, { listener, options }),
    },
    fetch: async path => {
      requests.push(path);
      if (path.endsWith(delayedPhoto ?? "never-delayed")) await delayed;
      const filename = path.split("/").at(-1);
      if (failures[filename] === "network") throw new Error("fictional connection failure");
      return { ok: !brokenPhoto && failures[filename] !== "404", blob: async () => ({ filename }) };
    },
    createImageBitmap: async ({ filename }) => {
      if (failures[filename] === "decode") throw new Error("fictional broken image");
      return { width: 1920, height: failures[filename] === "dimensions" ? 281 : 280, close() {} };
    },
  };
  const start = script.indexOf("async function initializeCampusBackdrop()");
  assert.ok(start >= 0);
  const source = script.slice(start, script.indexOf("void initializeCampusBackdrop();", start));
  await runInNewContext(`${source}\ninitializeCampusBackdrop()`, context);
  await setImmediate();
  return { canvas, caption, uniforms, requests, parameters, pending, document, label,
    get steps() { return progress.children; }, draws: () => draws,
    async finishPhoto() { finishPhoto(); await setImmediate(); },
    tick(time) { const callbacks = [...pending.values()]; pending.clear(); for (const fn of callbacks) fn(time); },
    fire(name, event = {}) {
      const dispatched = { type: name, preventDefault() {}, ...event };
      windowListeners.get(name)?.listener(dispatched);
      listeners.get(name)?.(dispatched);
    },
    dispatchOnTarget(name, event, targetListener) {
      const registered = windowListeners.get(name);
      assert.ok(registered, "포인터를 window에서 받는다");
      assert.equal(registered.options.capture, true, "패널의 전파 중단 전에 받는다");
      assert.equal(registered.options.passive, true);
      let stopped = false;
      const dispatched = { type: name, ...event, stopPropagation() { stopped = true; } };
      if (registered.options.capture) registered.listener(dispatched);
      targetListener(dispatched);
      if (!stopped && !registered.options.capture) registered.listener(dispatched);
      return stopped;
    },
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

const photoFiles = ["campus-aerial.jpg", "campus-hill.jpg", "campus-gate.jpg", "campus-field.jpg"];
const photoLabels = ["양호동 캠퍼스", "디지털관과 금오산 자락", "정문의 밤", "대운동장의 저녁"];

test("첫 사진을 포함해 어느 한 장이 404여도 성공한 세 장과 진행 칸으로 계속 그린다", async () => {
  for (let missing = 0; missing < photoFiles.length; missing++) {
    const page = await backdrop({ failures: { [photoFiles[missing]]: "404" } });
    const available = photoLabels.filter((_, index) => index !== missing);
    page.tick(0);
    assert.equal(page.canvas.hidden, false);
    assert.equal(page.caption.hidden, false);
    assert.equal(page.steps.length, 3);
    assert.equal(page.label.textContent, available[0]);
    page.tick(10601);
    assert.equal(page.label.textContent, available[1]);
    assert.equal(page.steps.filter(step => step["data-current"] === "true").length, 1);
    page.fire("pointerdown", { clientX: 256, clientY: 160 });
    page.tick(10700);
    assert.ok(page.uniforms.get("drops[0]").some((value, index) => index % 3 === 2 && value > 1.5));
    assert.equal(page.pending.size, 1);
  }
});

test("어느 한 장만 성공해도 이름과 진행 칸 하나를 보이고 30초 뒤에도 흐름과 물결을 유지한다", async () => {
  for (let only = 0; only < photoFiles.length; only++) {
    const failures = Object.fromEntries(photoFiles.filter((_, index) => index !== only).map(filename => [filename, "404"]));
    const page = await backdrop({ failures });
    page.tick(0);
    assert.equal(page.label.textContent, photoLabels[only]);
    assert.equal(page.steps.length, 1);
    assert.equal(page.uniforms.get("imgAspect"), 1920 / 280);
    page.tick(30000);
    const first = page.uniforms.get("panA");
    page.fire("pointerdown", { clientX: 256, clientY: 160 });
    page.tick(31000);
    assert.notEqual(page.uniforms.get("panA"), first);
    assert.equal(page.uniforms.get("mixv"), 0);
    assert.equal(page.canvas.hidden, false);
    assert.equal(page.caption.hidden, false);
    assert.equal(page.steps[0]["data-current"], "true");
    assert.ok(page.uniforms.get("drops[0]").some((value, index) => index % 3 === 2 && value === 30));
    assert.equal(page.pending.size, 1);
  }
});

test("연결·판독·비율 오류는 그 사진만 제외하고 남은 두 장의 전환 위치를 이어 그린다", async () => {
  for (const failure of ["network", "decode", "dimensions"]) {
    const page = await backdrop({ failures: { "campus-aerial.jpg": failure, "campus-gate.jpg": "404" } });
    page.tick(0);
    assert.equal(page.steps.length, 2);
    assert.equal(page.label.textContent, "디지털관과 금오산 자락");
    page.tick(12199.999);
    const before = page.uniforms.get("panB");
    page.tick(12200.00001);
    assert.equal(page.label.textContent, "대운동장의 저녁");
    assert.ok(Math.abs(before - page.uniforms.get("panA")) < 1e-6);
    page.tick(24400.00001);
    assert.equal(page.label.textContent, "디지털관과 금오산 자락");
    assert.equal(page.canvas.hidden, false);
    assert.equal(page.pending.size, 1);
  }
});

test("사진이 중간 위치일 때 한 장만 남아도 위치를 이어 받고 계속 흐른다", async () => {
  const page = await backdrop({
    delayedPhoto: "campus-hill.jpg",
    failures: { "campus-hill.jpg": "404", "campus-gate.jpg": "404", "campus-field.jpg": "404" },
  });
  page.tick(0);
  const initialPhase = Math.acos((0.5 - page.uniforms.get("panA")) / 0.22);
  const midpoint = (Math.PI / 2 - initialPhase) * 15.4 / Math.PI * 1000;
  page.tick(midpoint);
  const before = page.uniforms.get("panA");
  assert.ok(Math.abs(before - 0.5) < 1e-6);
  await page.finishPhoto();
  page.tick(midpoint);
  assert.ok(Math.abs(page.uniforms.get("panA") - before) < 1e-6);
  page.tick(midpoint + 1000);
  assert.notEqual(page.uniforms.get("panA"), before);
  assert.equal(page.steps.length, 1);
  assert.equal(page.canvas.hidden, false);
});

test("첫 사진만 늦어도 받은 사진을 먼저 그리고 늦은 준비 완료는 현재 사진을 되돌리지 않는다", async () => {
  const page = await backdrop({ delayedPhoto: "campus-aerial.jpg" });
  page.tick(0);
  assert.equal(page.label.textContent, "디지털관과 금오산 자락");
  assert.equal(page.steps.length, 3);
  page.tick(5000);
  const before = page.uniforms.get("panA");
  await page.finishPhoto();
  assert.equal(page.steps.length, 4);
  page.tick(5000);
  assert.equal(page.label.textContent, "디지털관과 금오산 자락");
  assert.equal(page.uniforms.get("panA"), before);
  page.tick(10601);
  assert.equal(page.label.textContent, "정문의 밤");
});

test("모든 사진이 실패한 경우에만 사진 이름·진행 칸과 캔버스를 숨긴다", async () => {
  const failures = Object.fromEntries(photoFiles.map((filename, index) => [filename, ["404", "network", "decode", "dimensions"][index]]));
  const page = await backdrop({ failures });
  assert.equal(page.canvas.hidden, true);
  assert.equal(page.caption.hidden, true);
  assert.equal(page.steps.length, 0);
  assert.equal(page.pending.size, 0);
  assert.equal(page.requests.length, 4);
});

test("다음 사진이 계속 준비 중이면 첫 주기만 기다리고 받은 사진끼리 전환한다", async () => {
  const page = await backdrop({ delayedPhoto: "campus-hill.jpg", failures: { "campus-field.jpg": "404" } });
  page.tick(0);
  assert.equal(page.steps.length, 2);
  page.tick(9000);
  page.tick(10601);
  assert.equal(page.uniforms.get("mixv"), 0);
  assert.equal(page.label.textContent, "양호동 캠퍼스");
  page.tick(12200);
  page.tick(21200);
  page.tick(22801);
  assert.equal(page.label.textContent, "정문의 밤");
  assert.ok(page.uniforms.get("mixv") > 0.5);
  assert.equal(page.steps.length, 2);
  assert.equal(page.canvas.hidden, false);
});

test("한 장과 준비 중인 사진만 있어도 계속 흐르고 늦은 합류와 전환 경계에서 위치가 이어진다", async () => {
  const page = await backdrop({
    delayedPhoto: "campus-hill.jpg",
    failures: { "campus-gate.jpg": "404", "campus-field.jpg": "404" },
  });
  page.tick(0);
  page.tick(30000);
  const beforeLatePhoto = page.uniforms.get("panA");
  page.tick(31000);
  assert.notEqual(page.uniforms.get("panA"), beforeLatePhoto);
  const beforeReady = page.uniforms.get("panA");
  await page.finishPhoto();
  page.tick(31000);
  assert.equal(page.uniforms.get("panA"), beforeReady, "새 사진을 받는 순간 현재 흐름을 초기화하지 않는다");
  assert.equal(page.steps.length, 2);
  page.tick(33400);
  page.tick(35001);
  assert.equal(page.label.textContent, "디지털관과 금오산 자락");
  page.tick(36599.999);
  const beforeBoundary = page.uniforms.get("panB");
  page.tick(36600.00001);
  assert.ok(Math.abs(beforeBoundary - page.uniforms.get("panA")) < 1e-6);
  assert.equal(page.canvas.hidden, false);
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

test("위쪽 20% 입력란의 포인터도 window에서 먼저 받아 물방울 y를 0.8로 보낸다", async () => {
  const page = await backdrop();
  page.tick(0);
  const stopped = page.dispatchOnTarget("pointerdown", { clientX: 256, clientY: 160 }, event => event.stopPropagation());
  page.tick(1);
  const drops = page.uniforms.get("drops[0]");
  assert.equal(stopped, true, "입력란이 이벤트 전파를 멈췄다");
  assert.ok(Math.abs(drops[0] - 0.2) < 1e-6);
  assert.ok(Math.abs(drops[1] - 0.8) < 1e-6);
  assert.equal(drops[2], 0);
});

test("움직임은 70ms와 26px를 모두 채워야 하고 누르기는 간격과 무관하다", async () => {
  const page = await backdrop();
  const count = () => page.uniforms.get("drops[0]").filter((value, index) => index % 3 === 2 && value >= 0).length;
  page.tick(0);
  page.fire("pointermove", { clientX: 100, clientY: 100 });
  page.tick(69);
  assert.equal(count(), 1);
  page.fire("pointermove", { clientX: 126, clientY: 100 });
  page.tick(70);
  assert.equal(count(), 1, "26px를 채워도 69ms에서는 넣지 않는다");
  page.fire("pointermove", { clientX: 125, clientY: 100 });
  page.tick(70);
  assert.equal(count(), 1, "70ms를 채워도 25px에서는 넣지 않는다");
  page.fire("pointermove", { clientX: 126, clientY: 100 });
  page.tick(71);
  assert.equal(count(), 2);
  page.dispatchOnTarget("pointerdown", { clientX: 127, clientY: 100 }, event => event.stopPropagation());
  page.tick(72);
  assert.equal(count(), 3);
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
