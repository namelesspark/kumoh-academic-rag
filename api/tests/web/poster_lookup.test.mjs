// '현수막으로 행사 찾기' 화면 테스트 (#46). 브라우저와 서버를 띄우지 않고, 가짜 화면 객체와
// 가짜 서버 요청 함수(fetch)로 chat.js를 그대로 실행한다. 사진 바이트·행사 이름·주소는 모두 가상 값이다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../../app/chat_web/assets/chat.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../../app/chat_web/index.html", import.meta.url), "utf8");

class FakeElement {
  children = [];
  listeners = new Map();
  attributes = new Map();
  textContent = "";
  className = "";
  value = "";
  parent = null;

  constructor(tagName) {
    this.tagName = tagName;
  }

  // 서버 값을 HTML로 해석하는 경로를 쓰면 테스트가 바로 실패한다.
  set innerHTML(_value) {
    throw new Error("innerHTML must not be used");
  }

  set outerHTML(_value) {
    throw new Error("outerHTML must not be used");
  }

  insertAdjacentHTML() {
    throw new Error("insertAdjacentHTML must not be used");
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
    this.listeners.set(event, listener);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  querySelectorAll(selector) {
    if (!selector.startsWith(".")) return [];
    const name = selector.slice(1);
    return descendants(this).filter(node => node.className.split(" ").includes(name));
  }

  scrollIntoView() {}

  focus() {}
}

function descendants(node) {
  const found = [];
  for (const child of node.children) {
    if (child instanceof FakeElement) found.push(child, ...descendants(child));
  }
  return found;
}

function byTag(node, tagName) {
  return descendants(node).filter(child => child.tagName === tagName);
}

function text(node) {
  return typeof node === "string" ? node : node.textContent + node.children.map(text).join("");
}

function loadChat(fetch) {
  const elements = new Map();
  runInNewContext(script, {
    document: {
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, new FakeElement(selector));
        return elements.get(selector);
      },
      createElement: tag => new FakeElement(tag),
      createTextNode: value => value,
    },
    window: { matchMedia: () => ({ matches: false }) },
    URL,
    AbortSignal: { timeout: () => undefined },
    fetch,
  }, { filename: "chat.js" });

  const page = {
    transcript: elements.get("#transcript"),
    empty: elements.get("#empty"),
    status: elements.get("#status"),
    reset: elements.get("#reset"),
    composer: elements.get("#composer"),
    input: elements.get("#question"),
    graduation: elements.get("#graduation-check"),
    form: elements.get("#poster-form"),
    file: elements.get("#poster-file"),
    submit: elements.get("#poster-submit"),
    note: elements.get("#poster-note"),
  };
  page.transcript.append(page.empty);
  return page;
}

const fileName = "가상-현수막-비밀이름.jpg";
const jpegBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

function photo(type = "image/jpeg", bytes = jpegBytes, name = fileName) {
  return new File([bytes], name, { type });
}

function choose(page, file) {
  page.file.files = file ? [file] : [];
  page.file.listeners.get("change")({});
}

function submit(page) {
  page.form.listeners.get("submit")({ preventDefault() {} });
}

function answering(payload, requests = []) {
  return async (path, options = {}) => {
    requests.push({ path, ...options, headers: { ...options.headers } });
    return { ok: true, status: 200, json: async () => payload };
  };
}

function refusing(status) {
  return async () => ({ ok: false, status, json: async () => ({ detail: "fictional error" }) });
}

async function lookup(fetch, file = photo()) {
  const page = loadChat(fetch);
  choose(page, file);
  submit(page);
  await setImmediate();
  return page;
}

function shown(payload) {
  return lookup(answering(payload));
}

function event(fields = {}) {
  return {
    title: "가상 해외 취업 설명회",
    event_date: "2026-11-23",
    official_deadline: "2026-11-22",
    poster_deadline: null,
    application_state: "open",
    mileage: null,
    notice_url: "https://notice.example.invalid/view?articleNo=1",
    application_url: "https://apply.example.invalid/login?next=%2Fprograms%2F1",
    login_required: true,
    checked_on: "2026-11-13",
    ...fields,
  };
}

function confirmed(fields = {}, top = {}) {
  return { event_match: "confirmed", identified_by: ["text"], reasons: [], event: event(fields), ...top };
}

function needsCheck(reasons, top = {}) {
  return { event_match: "needs_check", identified_by: [], reasons, event: null, ...top };
}

function readCard(page) {
  const cards = page.transcript.querySelectorAll(".poster-result");
  assert.equal(cards.length, 1, "expected exactly one poster result");
  const [card] = cards;
  return {
    card,
    lines: card.children.filter(child => child.className !== "links").map(text),
    links: byTag(card, "a"),
    hints: card.querySelectorAll(".hint").map(text),
    badges: card.querySelectorAll(".badge").map(text),
  };
}

function readError(page) {
  assert.equal(page.transcript.querySelectorAll(".poster-result").length, 0);
  assert.equal(byTag(page.transcript, "a").length, 0);
  const errors = page.transcript.querySelectorAll(".error");
  assert.equal(errors.length, 1);
  return {
    message: text(byTag(errors[0], "p")[0]),
    retries: errors[0].querySelectorAll(".retry"),
  };
}

const checkedLine = "확인일 2026년 11월 13일 · 현재 정원과 접수 상태는 공식 링크에서 다시 확인";

test("화면에 사진 선택, 제출 버튼, 알림 영역이 있고 기존 요소 id가 그대로 남아 있다", () => {
  assert.match(html, /<form id="poster-form"/);
  assert.match(html, /<input type="file" id="poster-file" accept="image\/jpeg,image\/png"/);
  assert.match(html, /<button type="submit"[^>]*id="poster-submit" disabled>/);
  assert.match(html, /<p[^>]*id="poster-note" role="status">/);
  assert.match(html, /<label for="poster-file">현수막으로 행사 찾기<\/label>/);
  for (const id of ["topics", "reset", "graduation-check", "transcript", "empty", "status", "composer", "question", "send"]) {
    assert.equal(html.split(`id="${id}"`).length, 2, id);
  }
});

for (const [label, type] of [["JPEG", "image/jpeg"], ["PNG", "image/png"]]) {
  test(`고른 ${label} 사진의 바이트와 형식을 본문 그대로 보내고 파일명은 보내지 않는다`, async () => {
    const requests = [];
    const page = await lookup(answering(needsCheck(["no_readable_clue"]), requests), photo(type));

    assert.equal(requests.length, 1);
    const [request] = requests;
    assert.equal(request.path, "/api/v1/poster-lookup");
    assert.equal(request.method, "POST");
    assert.deepEqual(request.headers, { "Content-Type": type, Accept: "application/json" });

    assert.ok(request.body instanceof Blob);
    assert.equal(request.body instanceof File, false, "the body must not carry a file name");
    assert.equal(request.body.name, undefined);
    assert.equal(request.body.type, type);
    assert.deepEqual(new Uint8Array(await request.body.arrayBuffer()), jpegBytes);

    assert.equal(JSON.stringify([request.path, request.headers]).includes("비밀이름"), false);
    assert.equal(text(page.transcript).includes("비밀이름"), false);
    assert.equal(page.note.textContent.includes("비밀이름"), false);
    assert.equal(text(page.transcript.querySelectorAll(".question")[0]), "내 요청: 현수막 사진으로 행사 찾기");
  });
}

test("사진을 고르기 전에는 제출 버튼이 잠겨 있고, 고르면 풀린다", () => {
  const requests = [];
  const page = loadChat(answering(needsCheck([]), requests));
  assert.equal(page.submit.disabled, true);

  submit(page);
  assert.equal(page.note.textContent, "현수막 사진을 먼저 골라 주세요.");
  assert.equal(requests.length, 0);

  choose(page, photo());
  assert.equal(page.submit.disabled, false);
  assert.equal(page.note.textContent, "");

  choose(page, null);
  assert.equal(page.submit.disabled, true);
});

for (const type of ["image/gif", "image/webp", "application/pdf", ""]) {
  test(`JPEG·PNG가 아닌 형식(${type || "형식 없음"})은 보내지 않고 안내한다`, async () => {
    const requests = [];
    const page = await lookup(answering(confirmed(), requests), photo(type));

    assert.equal(requests.length, 0);
    assert.equal(page.note.textContent, "JPEG나 PNG 사진만 읽을 수 있어요.");
    assert.deepEqual(page.transcript.children, [page.empty]);
    assert.equal(page.submit.disabled, false);
  });
}

test("5MB를 넘는 사진은 읽지도 보내지도 않고 안내하며, 딱 5MB는 보낸다", async () => {
  const limit = 5 * 1024 * 1024;
  const requests = [];
  const tooLarge = {
    type: "image/png",
    size: limit + 1,
    slice() {
      throw new Error("an oversized photo must not be read");
    },
  };
  const page = await lookup(answering(confirmed(), requests), tooLarge);

  assert.equal(requests.length, 0);
  assert.equal(page.note.textContent, "사진이 5MB를 넘어요. 더 작은 사진으로 다시 올려 주세요.");
  assert.deepEqual(page.transcript.children, [page.empty]);

  const marker = new Blob([jpegBytes], { type: "image/png" });
  const sliced = [];
  const atLimit = {
    type: "image/png",
    size: limit,
    slice(...range) {
      sliced.push(range);
      return marker;
    },
  };
  choose(page, atLimit);
  submit(page);
  await setImmediate();

  assert.deepEqual(sliced, [[0, limit, "image/png"]]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body, marker);
});

test("결과를 기다리는 동안 다시 제출해도 요청은 한 번이고, 다른 버튼도 잠긴다", async () => {
  const requests = [];
  let respond;
  const page = loadChat(path => {
    requests.push(path);
    return new Promise(resolve => { respond = resolve; });
  });
  choose(page, photo());

  submit(page);
  assert.equal(page.submit.disabled, true);
  assert.equal(page.graduation.disabled, true);
  assert.equal(page.reset.disabled, true);
  assert.equal(page.status.textContent, "사진에서 행사를 찾는 중…");

  submit(page);
  submit(page);
  page.graduation.listeners.get("click")({});
  page.input.value = "가상 질문";
  page.composer.listeners.get("submit")({ preventDefault() {} });
  page.reset.listeners.get("click")({});
  await setImmediate();
  assert.deepEqual(requests, ["/api/v1/poster-lookup"]);
  assert.equal(page.transcript.querySelectorAll(".turn").length, 1);

  respond({ ok: true, status: 200, json: async () => confirmed() });
  await setImmediate();
  assert.equal(page.submit.disabled, false);
  assert.equal(page.graduation.disabled, false);
  assert.equal(page.status.textContent, "");
  assert.equal(readCard(page).lines[0], "가상 해외 취업 설명회");

  submit(page);
  await setImmediate();
  assert.deepEqual(requests, ["/api/v1/poster-lookup", "/api/v1/poster-lookup"]);
});

test("질문을 보내는 중에는 사진 제출이 막힌다", async () => {
  const requests = [];
  let answer;
  const page = loadChat(path => {
    requests.push(path);
    if (path === "/api/v1/chat") return new Promise(resolve => { answer = resolve; });
    return answering(confirmed())(path);
  });
  choose(page, photo());

  page.input.value = "가상 질문";
  page.composer.listeners.get("submit")({ preventDefault() {} });
  assert.equal(page.submit.disabled, true);
  submit(page);
  await setImmediate();
  assert.deepEqual(requests, ["/api/v1/chat"]);

  answer({ ok: true, json: async () => ({ session_id: "fictional-session", answered: false }) });
  await setImmediate();
  assert.equal(page.submit.disabled, false);
});

test("확정된 행사는 제목, 행사일, 공식 마감 순으로 보이고 사진 마감 안내는 그 아래에 붙는다", async () => {
  const page = await shown(confirmed({ poster_deadline: "11-20" }, { reasons: ["deadline_mismatch"] }));
  const { card, lines, badges } = readCard(page);

  assert.deepEqual(lines, [
    "가상 해외 취업 설명회",
    "확인 단서 · 사진 글자",
    "행사일 2026년 11월 23일",
    "공식 신청 마감 2026년 11월 22일",
    "확인 필요 사진에는 마감이 11월 20일로 적혀 있어요. 공식 공지의 마감을 따르세요.",
    "신청 접수 중",
    "마일리지 미공개 · 공식 공지에서 확인",
    checkedLine,
  ]);
  assert.deepEqual(badges, ["확인 필요", "신청 접수 중"]);
  assert.deepEqual(byTag(card, "time").map(time => time.dateTime), ["2026-11-23", "2026-11-22", "2026-11-13"]);
  assert.equal(page.note.textContent, "행사를 찾았어요. 가상 해외 취업 설명회");
  assert.equal(page.transcript.children.includes(page.empty), false);
});

test("사진 마감이 공식 마감과 어긋나지 않으면 사진 마감 안내를 붙이지 않는다", async () => {
  const { card, lines } = readCard(await shown(confirmed({ poster_deadline: "11-22" })));

  assert.equal(card.querySelectorAll(".mismatch").length, 0);
  assert.equal(lines.some(line => line.includes("사진에는")), false);
  assert.equal(lines[3], "공식 신청 마감 2026년 11월 22일");
});

test("어긋난다고 했는데 사진 마감 값이 없거나 꼴이 다르면 연도를 지어내지 않는다", async () => {
  const missing = readCard(await shown(confirmed({ poster_deadline: null }, { reasons: ["deadline_mismatch"] })));
  assert.equal(missing.lines[4], "확인 필요 사진에 적힌 마감이 공식 공지와 달라요. 공식 공지의 마감을 따르세요.");

  const odd = readCard(await shown(confirmed({ poster_deadline: "가상 표기" }, { reasons: ["deadline_mismatch"] })));
  assert.equal(odd.lines[4], "확인 필요 사진에는 마감이 가상 표기로 적혀 있어요. 공식 공지의 마감을 따르세요.");
  assert.equal(odd.lines.join("\n").includes("2026년 11월 20일"), false);
});

test("공식 날짜가 비어 있으면 확인 필요라고 적는다", async () => {
  const { lines } = readCard(await shown(confirmed({ event_date: null, official_deadline: null, checked_on: null })));

  assert.equal(lines[2], "행사일 확인 필요");
  assert.equal(lines[3], "공식 신청 마감 확인 필요");
  assert.equal(lines.at(-1), "현재 정원과 접수 상태는 공식 링크에서 다시 확인");
});

test("단서는 서버가 실제로 썼다고 밝힌 것만 적는다", async () => {
  const both = readCard(await shown(confirmed({}, { identified_by: ["qr_notice", "qr_program", "constructor", 7] })));
  assert.equal(both.lines[1], "확인 단서 · 공지 QR, BISKIT 프로그램 QR");

  const none = readCard(await shown(confirmed({}, { identified_by: null })));
  assert.equal(none.lines[1], "행사일 2026년 11월 23일");
});

for (const [state, reasons, expected] of [
  ["open", [], "신청 접수 중"],
  ["closed", [], "신청 마감"],
  ["needs_check", [], "신청 상태 확인 필요"],
  [
    "needs_check",
    ["deadline_day"],
    "신청 상태 확인 필요 오늘이 마감일이에요. 공지에 마감 시각이 없어 공식 공지에서 확인해야 해요.",
  ],
  ["OPEN", [], "신청 상태 확인 필요"],
  ["constructor", [], "신청 상태 확인 필요"],
  [null, [], "신청 상태 확인 필요"],
]) {
  test(`application_state가 ${state}${reasons.length ? "(마감일 당일)" : ""}이면 '${expected.split(" 오늘")[0]}'로 표시한다`, async () => {
    const { card } = readCard(await shown(confirmed({ application_state: state }, { reasons })));

    assert.deepEqual(card.querySelectorAll(".state").map(text), [expected]);
  });
}

test("마일리지는 서버가 준 양의 정수만 점수로 적는다", async () => {
  const mileage = async value => readCard(await shown(confirmed({ mileage: value }))).card.querySelectorAll(".mileage").map(text);

  assert.deepEqual(await mileage(40), ["마일리지 40점"]);
  for (const value of [null, 0, -40, "40", 19.5, { points: 40 }]) {
    assert.deepEqual(await mileage(value), ["마일리지 미공개 · 공식 공지에서 확인"], String(value));
  }
});

test("확인된 주소는 받은 그대로 새 탭 링크가 되고, 로그인이 필요하면 신청 링크 옆에 적는다", async () => {
  const { links, hints } = readCard(await shown(confirmed()));

  assert.deepEqual(links.map(link => link.attributes.get("href")), [
    "https://notice.example.invalid/view?articleNo=1",
    "https://apply.example.invalid/login?next=%2Fprograms%2F1",
  ]);
  assert.deepEqual(links.map(text), [
    "공식 공지 보기 (가상 해외 취업 설명회, 새 탭에서 열림)",
    "신청 페이지 열기 (가상 해외 취업 설명회, 새 탭에서 열림)",
  ]);
  for (const link of links) {
    assert.equal(link.target, "_blank");
    assert.equal(link.rel, "noopener noreferrer");
  }
  assert.deepEqual(hints, ["BISKIT 로그인 필요"]);
});

test("로그인이 필요 없으면 로그인 안내를 붙이지 않는다", async () => {
  const { links, hints } = readCard(await shown(confirmed({ login_required: false })));

  assert.equal(links.length, 2);
  assert.deepEqual(hints, []);
});

for (const [label, url] of [
  ["주소 없음", null],
  ["필드 없음", undefined],
  ["빈 문자열", ""],
  ["HTTP 주소", "http://notice.example.invalid/view"],
  ["JavaScript 주소", "javascript:alert(1)"],
  ["data 주소", "data:text/html,<script>alert(1)</script>"],
  ["계정 정보가 든 주소", "https://user:pass@notice.example.invalid/view"],
  ["공백이 든 주소", "https://notice.example.invalid/view "],
  ["//로 시작하는 주소", "//notice.example.invalid/view"],
  ["상대 경로", "/view"],
  ["글자가 아닌 값", 7],
]) {
  test(`확정된 행사의 주소가 ${label}이면 링크만 만들지 않고 나머지 내용은 남긴다`, async () => {
    const page = await shown(confirmed({ notice_url: url, application_url: url }));
    const { lines, links, hints } = readCard(page);

    assert.equal(links.length, 0);
    assert.equal(byTag(page.transcript, "a").length, 0);
    assert.deepEqual(hints, ["공식 공지 확인 필요", "BISKIT 로그인 후 프로그램명으로 검색"]);
    assert.deepEqual(lines, [
      "가상 해외 취업 설명회",
      "확인 단서 · 사진 글자",
      "행사일 2026년 11월 23일",
      "공식 신청 마감 2026년 11월 22일",
      "신청 접수 중",
      "마일리지 미공개 · 공식 공지에서 확인",
      checkedLine,
    ]);
  });
}

test("공지 주소만 안전하면 공지 링크만 만든다", async () => {
  const { links, hints } = readCard(await shown(confirmed({ application_url: "javascript:alert(1)" })));

  assert.deepEqual(links.map(link => link.attributes.get("href")), ["https://notice.example.invalid/view?articleNo=1"]);
  assert.deepEqual(hints, ["BISKIT 로그인 후 프로그램명으로 검색"]);
});

const needsCheckMessages = {
  no_readable_clue: "사진에서 읽을 수 있는 글자나 QR을 찾지 못했어요. 행사 제목과 날짜가 보이게 다시 찍어 주세요.",
  ambiguous_event: "사진만으로는 어느 행사인지 하나로 정하지 못했어요. 제목과 날짜가 함께 보이거나 QR이 보이는 사진으로 다시 시도해 주세요.",
  text_reader_unavailable: "지금은 서버가 사진 속 글자를 읽을 수 없어요. QR이 보이는 사진으로 다시 시도해 주세요.",
};
const noLinkLine = "확인하지 못한 행사는 링크를 보여 주지 않아요. 학교 공지에서 직접 찾아 주세요.";

for (const [reason, message] of Object.entries(needsCheckMessages)) {
  test(`확인 필요(${reason})이면 링크 없이 사유에 맞는 문구를 보여 준다`, async () => {
    const page = await shown(needsCheck([reason]));
    const { card, lines, links } = readCard(page);

    assert.deepEqual(lines, ["확인 필요", message, noLinkLine]);
    assert.equal(links.length, 0);
    assert.equal(card.className, "poster-result unconfirmed");
    assert.equal(page.transcript.querySelectorAll(".error").length, 0);
    assert.equal(page.note.textContent, "행사를 확인하지 못했어요. 링크는 보여 주지 않아요.");
  });
}

test("확인 필요 사유별 문구는 서로 다르고, 사유가 여럿이면 모두 보여 준다", async () => {
  assert.equal(new Set(Object.values(needsCheckMessages)).size, 3);

  const { lines } = readCard(await shown(needsCheck(["text_reader_unavailable", "no_readable_clue"])));
  assert.deepEqual(lines, [
    "확인 필요",
    needsCheckMessages.text_reader_unavailable,
    needsCheckMessages.no_readable_clue,
    noLinkLine,
  ]);
});

for (const [label, reasons] of [
  ["빈 사유", []],
  ["모르는 사유", ["constructor", "deadline_mismatch", 7]],
  ["배열이 아닌 사유", "no_readable_clue"],
]) {
  test(`확인 필요인데 ${label}이면 일반 문구를 보여 준다`, async () => {
    const { lines, links } = readCard(await shown(needsCheck(reasons)));

    assert.deepEqual(lines, ["확인 필요", "사진 속 행사를 공식 공지에서 확인하지 못했어요.", noLinkLine]);
    assert.equal(links.length, 0);
  });
}

for (const eventMatch of ["needs_check", "CONFIRMED", "maybe", null, undefined, true]) {
  test(`event_match가 ${eventMatch}이면 서버가 행사와 주소를 함께 보내도 링크를 만들지 않는다`, async () => {
    const page = await shown({ ...confirmed(), event_match: eventMatch });
    const { lines, links } = readCard(page);

    assert.equal(links.length, 0);
    assert.equal(byTag(page.transcript, "a").length, 0);
    assert.equal(lines[0], "확인 필요");
    assert.equal(text(page.transcript).includes("가상 해외 취업 설명회"), false);
  });
}

const failureMessages = {
  413: "사진이 5MB를 넘어요. 더 작은 사진으로 다시 올려 주세요.",
  415: "JPEG나 PNG 사진만 읽을 수 있어요.",
  422: "사진을 열 수 없거나 화소 수가 1,200만을 넘어요. 다른 사진으로 다시 올려 주세요.",
  network: "서버에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.",
  server: "서버가 사진을 처리하지 못했어요.",
};

test("413·415·422·통신 실패·서버 오류 문구는 서로 다르다", () => {
  assert.equal(new Set(Object.values(failureMessages)).size, 5);
});

for (const status of [413, 415, 422]) {
  test(`서버가 ${status}로 거절하면 그에 맞는 문구를 보여 주고 다시 시도 버튼은 두지 않는다`, async () => {
    const page = await lookup(refusing(status));
    const { message, retries } = readError(page);

    assert.equal(message, failureMessages[status]);
    assert.equal(retries.length, 0);
    assert.equal(page.note.textContent, failureMessages[status]);
    assert.equal(page.submit.disabled, false);
    assert.equal(page.status.textContent, "");
  });
}

test("서버에 연결하지 못하면 통신 실패 문구를 보여 주고, 다시 시도하면 같은 바이트를 보낸다", async () => {
  const bodies = [];
  let online = false;
  const page = await lookup(async (_path, options) => {
    bodies.push(options.body);
    if (!online) throw new TypeError("fictional network failure");
    return { ok: true, status: 200, json: async () => confirmed() };
  });
  const { message, retries } = readError(page);

  assert.equal(message, failureMessages.network);
  assert.equal(page.note.textContent, failureMessages.network);
  assert.equal(retries.length, 1);
  assert.equal(page.submit.disabled, false);

  online = true;
  retries[0].listeners.get("click")({});
  await setImmediate();

  assert.equal(bodies.length, 2);
  assert.equal(bodies[1], bodies[0]);
  assert.deepEqual(new Uint8Array(await bodies[1].arrayBuffer()), jpegBytes);
  assert.equal(page.transcript.querySelectorAll(".error").length, 0);
  assert.equal(page.transcript.querySelectorAll(".turn").length, 1);
  assert.equal(readCard(page).lines[0], "가상 해외 취업 설명회");
  assert.equal(page.note.textContent, "행사를 찾았어요. 가상 해외 취업 설명회");
});

for (const status of [400, 500, 503]) {
  test(`서버가 ${status}로 답하면 서버 오류 문구와 다시 시도 버튼을 보여 준다`, async () => {
    const { message, retries } = readError(await lookup(refusing(status)));

    assert.equal(message, failureMessages.server);
    assert.equal(retries.length, 1);
  });
}

for (const [label, payload] of [
  ["null 본문", null],
  ["배열 본문", []],
  ["글자 본문", "confirmed"],
  ["확정인데 행사 없음", { ...confirmed(), event: null }],
  ["확정인데 행사가 배열", { ...confirmed(), event: [] }],
  ["제목 없음", confirmed({ title: null })],
  ["빈 제목", confirmed({ title: "  " })],
  ["숫자 제목", confirmed({ title: 123 })],
  ["로그인 여부가 글자", confirmed({ login_required: "true" })],
  ["로그인 여부가 숫자", confirmed({ login_required: 1 })],
  ["로그인 여부가 null", confirmed({ login_required: null })],
  ["로그인 여부 누락", confirmed({ login_required: undefined })],
]) {
  test(`응답 형식이 어긋나면(${label}) 반쯤 그린 카드나 링크 대신 서버 오류 문구를 보여 준다`, async () => {
    const { message, retries } = readError(await shown(payload));

    assert.equal(message, failureMessages.server);
    assert.equal(retries.length, 1);
  });
}

test("본문을 JSON으로 읽지 못해도 서버 오류 문구를 보여 준다", async () => {
  const page = await lookup(async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError("fictional malformed body");
    },
  }));

  assert.equal(readError(page).message, failureMessages.server);
  assert.equal(page.submit.disabled, false);
});

test("서버 값은 글자 그대로 넣고 HTML로 해석하지 않는다", async () => {
  const markup = "<img src=x onerror=alert(1)>";
  const page = await shown(confirmed(
    { title: markup, event_date: markup, official_deadline: markup, poster_deadline: markup, checked_on: markup },
    { reasons: ["deadline_mismatch"] },
  ));
  const { lines, links } = readCard(page);

  assert.equal(lines[0], markup);
  assert.equal(lines[2], `행사일 ${markup}`);
  assert.equal(lines[3], `공식 신청 마감 ${markup}`);
  assert.equal(lines[4], `확인 필요 사진에는 마감이 ${markup}로 적혀 있어요. 공식 공지의 마감을 따르세요.`);
  assert.equal(lines.at(-1), `확인일 ${markup} · 현재 정원과 접수 상태는 공식 링크에서 다시 확인`);
  assert.equal(text(links[0]), `공식 공지 보기 (${markup}, 새 탭에서 열림)`);
  assert.equal(byTag(page.transcript, "img").length, 0);
  assert.equal(page.note.textContent, `행사를 찾았어요. ${markup}`);
});

test("사진을 여러 번 올리면 결과가 차례로 쌓이고, 새 대화를 누르면 결과와 알림이 지워진다", async () => {
  const page = await shown(confirmed());
  submit(page);
  await setImmediate();
  assert.equal(page.transcript.querySelectorAll(".poster-result").length, 2);

  page.reset.listeners.get("click")({});

  assert.deepEqual(page.transcript.children, [page.empty]);
  assert.equal(page.note.textContent, "");
});

test("사진을 다시 고르면 이전 알림이 지워진다", async () => {
  const page = await lookup(refusing(415));
  assert.equal(page.note.textContent, failureMessages[415]);

  choose(page, photo("image/png"));

  assert.equal(page.note.textContent, "");
  assert.equal(page.submit.disabled, false);
});
