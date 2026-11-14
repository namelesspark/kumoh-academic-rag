// 현수막 회귀 테스트 (#52). '현수막으로 행사 찾기' 칸을 없애고 사진을 채팅 입력창의 첨부로 옮긴 뒤에도
// 기존 현수막 사례가 같은 행사 카드를 보이는지 확인한다. 브라우저와 서버를 띄우지 않고, 가짜 화면 객체와
// 가짜 서버 요청 함수(fetch)로 chat.js를 그대로 실행한다. 사진 바이트·행사 이름·주소는 모두 가상 값이다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../../app/chat_web/assets/chat.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../../app/chat_web/index.html", import.meta.url), "utf8");

const photoPath = "/api/v1/photo-input";
const textPath = "/api/v1/photo-question";

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
  // 예전 안내 상자의 버튼은 없어졌다(#61). 첫 화면에 남은 「내 졸업 체크 보기」 버튼으로 잠금을 확인한다.
  const graduation = new FakeElement("button");
  graduation.dataset = { action: "graduation" };
  runInNewContext(script, {
    document: {
      addEventListener() {},
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, new FakeElement(selector));
        return elements.get(selector);
      },
      querySelectorAll: selector => (selector === "[data-action]" ? [graduation] : []),
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
    send: elements.get("#send"),
    graduation,
    file: elements.get("#photo-file"),
    clear: elements.get("#photo-clear"),
    note: elements.get("#photo-note"),
  };
  page.transcript.append(page.empty);
  // 브라우저의 파일 입력 칸은 value에 빈 글자를 넣으면 고른 파일 목록이 비워진다. 가짜 입력 칸도 같게 맞춘다.
  Object.defineProperty(page.file, "value", {
    get: () => "",
    set(value) {
      if (value === "") page.file.files = [];
    },
  });
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

function type(page, question) {
  page.input.value = question;
  page.input.listeners.get("input")({});
}

function submit(page) {
  page.composer.listeners.get("submit")({ preventDefault() {} });
}

// 사진 주소에는 payload를, 글자 주소에는 answer를 돌려준다. answer를 주지 않았는데 글자 주소를 부르면 500으로 답한다.
function answering(payload, requests = [], answer = undefined) {
  return async (path, options = {}) => {
    requests.push({ path, ...options, headers: { ...options.headers } });
    if (path === textPath) {
      if (answer === undefined) return { ok: false, status: 500, json: async () => ({ detail: "fictional error" }) };
      return { ok: true, status: 200, json: async () => answer };
    }
    return { ok: true, status: 200, json: async () => payload };
  };
}

function refusing(status) {
  return async () => ({ ok: false, status, json: async () => ({ detail: "fictional error" }) });
}

async function lookup(fetch, file = photo(), question = "") {
  const page = loadChat(fetch);
  choose(page, file);
  if (question) type(page, question);
  submit(page);
  await setImmediate();
  return page;
}

function shown(payload) {
  return lookup(answering(payload));
}

function paths(requests) {
  return requests.map(request => request.path);
}

const eventTitle = "가상 해외 취업 설명회";

function event(fields = {}) {
  return {
    title: eventTitle,
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
const readingStatus = "사진에서 글자를 읽는 중…";
const askingStatus = "읽은 글자로 답을 찾는 중…";
const foundNote = `행사를 찾았어요. ${eventTitle}`;

test("화면에 현수막 전용 칸이 없고, 입력창에 사진 첨부·첨부 제거·알림 영역이 있으며 기존 요소 id가 그대로 남아 있다", () => {
  for (const gone of ["poster-form", "poster-file", "poster-submit", "poster-note", "현수막으로 행사 찾기"]) {
    assert.equal(html.includes(gone), false, gone);
  }
  assert.match(html, /<input type="file" id="photo-file" accept="image\/jpeg,image\/png"/);
  // 글자 라벨 대신 이름이 「사진 첨부」인 클립 버튼이 파일 창을 연다. 그림 파일은 쓰지 않고 선으로 직접 그린다.
  const [attach] = /<button type="button" class="attach-button" id="photo-attach" aria-label="사진 첨부"[^>]*>[\s\S]*?<\/button>/.exec(html) ?? [""];
  assert.match(attach, /<svg\b[^>]*aria-hidden="true"[^>]*>\s*<path d="[^"]+"\/>\s*<\/svg><\/button>$/);
  assert.doesNotMatch(attach, /<img\b|data-action|feature-badge/);
  assert.equal(html.includes('<label for="photo-file"'), false);
  assert.equal(html.split('id="photo-attach"').length, 2);
  assert.match(html, /<button type="button"[^>]*id="photo-clear" hidden>/);
  assert.match(html, /<p[^>]*id="photo-note" role="status">/);
  assert.match(html, /<button type="submit"[^>]*id="send" disabled>/);
  for (const id of [
    "topics", "reset", "transcript", "empty", "status", "composer", "question", "send",
    "photo-file", "photo-clear", "photo-note",
  ]) {
    assert.equal(html.split(`id="${id}"`).length, 2, id);
  }
  // 예전 안내 상자와 그 안의 졸업 체크 버튼은 없앴다(#61).
  assert.equal(html.includes("graduation-check"), false);

  // 사진만 보낼 수 있어야 하므로 질문 칸은 필수 입력이 아니다.
  const [question] = /<textarea id="question"[^>]*>/.exec(html);
  assert.equal(question.includes("required"), false);
});

test("화면은 옛 현수막 주소(/api/v1/poster-lookup)를 더는 부르지 않는다", () => {
  assert.equal(script.includes("poster-lookup"), false);
  assert.equal(script.includes("#poster-"), false);
});

for (const [label, mime] of [["JPEG", "image/jpeg"], ["PNG", "image/png"]]) {
  test(`첨부한 ${label} 사진의 바이트와 형식을 본문 그대로 보내고 파일명은 보내지 않는다`, async () => {
    const requests = [];
    const page = await lookup(answering(needsCheck(["no_readable_clue"]), requests), photo(mime));

    assert.equal(requests.length, 1);
    const [request] = requests;
    assert.equal(request.path, photoPath);
    assert.equal(request.method, "POST");
    assert.deepEqual(request.headers, { "Content-Type": mime, Accept: "application/json" });

    assert.ok(request.body instanceof Blob);
    assert.equal(request.body instanceof File, false, "the body must not carry a file name");
    assert.equal(request.body.name, undefined);
    assert.equal(request.body.type, mime);
    assert.deepEqual(new Uint8Array(await request.body.arrayBuffer()), jpegBytes);

    assert.equal(JSON.stringify([request.path, request.headers]).includes("비밀이름"), false);
    assert.equal(text(page.transcript).includes("비밀이름"), false);
    assert.equal(page.note.textContent.includes("비밀이름"), false);
    assert.equal(text(page.transcript.querySelectorAll(".question")[0]), "내 질문: 사진 1장");
    assert.equal(page.transcript.querySelectorAll(".reply")[0].className, "reply photo");
  });
}

test("질문과 사진을 함께 보내면 말풍선에 질문과 '사진 1장'이 함께 보이고 입력 칸은 비워진다", async () => {
  const requests = [];
  const page = await lookup(answering(confirmed(), requests), photo(), "가상 질문");

  assert.equal(text(page.transcript.querySelectorAll(".question")[0]), "내 질문: 가상 질문사진 1장");
  assert.deepEqual(page.transcript.querySelectorAll(".attachment").map(text), ["사진 1장"]);
  assert.equal(page.input.value, "");
  assert.deepEqual(paths(requests), [photoPath]);
  assert.equal(page.transcript.querySelectorAll(".reading-question")[0].value, "가상 질문");
});

test("질문도 사진도 없으면 보내기 버튼이 잠겨 있고, 사진만 고르거나 질문만 적어도 풀린다", () => {
  const requests = [];
  const page = loadChat(answering(needsCheck([]), requests));
  assert.equal(page.send.disabled, true);
  assert.equal(page.clear.hidden, true);

  submit(page);
  assert.equal(requests.length, 0);
  assert.equal(page.note.textContent, "");
  assert.deepEqual(page.transcript.children, [page.empty]);

  choose(page, photo());
  assert.equal(page.send.disabled, false);
  assert.equal(page.clear.hidden, false);
  assert.equal(page.note.textContent, "");

  choose(page, null);
  assert.equal(page.send.disabled, true);
  assert.equal(page.clear.hidden, true);

  type(page, "가상 질문");
  assert.equal(page.send.disabled, false);
  type(page, "   ");
  assert.equal(page.send.disabled, true);
});

test("첨부 제거를 누르면 고른 사진이 비워져 보내기 버튼이 다시 잠기고, 요청 중에는 눌리지 않는다", async () => {
  const requests = [];
  let respond;
  const page = loadChat(path => {
    requests.push(path);
    return new Promise(resolve => { respond = resolve; });
  });
  choose(page, photo());

  page.clear.listeners.get("click")({});
  assert.deepEqual(page.file.files, []);
  assert.equal(page.send.disabled, true);
  assert.equal(page.clear.hidden, true);
  submit(page);
  assert.equal(requests.length, 0);

  choose(page, photo());
  submit(page);
  const later = photo("image/png");
  choose(page, later);
  assert.equal(page.clear.disabled, true);
  page.clear.listeners.get("click")({});
  assert.equal(page.file.files[0], later);

  respond({ ok: true, status: 200, json: async () => confirmed() });
  await setImmediate();
  assert.equal(page.clear.disabled, false);
  assert.deepEqual(requests, [photoPath]);
});

for (const mime of ["image/gif", "image/webp", "application/pdf", ""]) {
  test(`JPEG·PNG가 아닌 형식(${mime || "형식 없음"})은 보내지 않고 안내하며 고른 파일은 그대로 둔다`, async () => {
    const requests = [];
    const chosen = photo(mime);
    const page = await lookup(answering(confirmed(), requests), chosen, "가상 질문");

    assert.equal(requests.length, 0);
    assert.equal(page.note.textContent, "JPEG나 PNG 사진만 읽을 수 있어요.");
    assert.deepEqual(page.transcript.children, [page.empty]);
    assert.equal(page.file.files[0], chosen);
    assert.equal(page.input.value, "가상 질문");
    assert.equal(page.send.disabled, false);
    assert.equal(page.status.textContent, "");
  });
}

// 서버 한도(5,000,000바이트)와 같은 경계다. 5,000,001바이트는 서버가 413으로 거절하므로 화면이 먼저 막는다.
test("5,000,001바이트 사진은 읽지도 보내지도 않고 안내하며, 정확히 5,000,000바이트는 보낸다", async () => {
  const limit = 5_000_000;
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
  assert.equal(page.file.files[0], tooLarge);

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
  assert.equal(page.note.textContent, "");
  submit(page);
  await setImmediate();

  assert.deepEqual(sliced, [[0, limit, "image/png"]]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, photoPath);
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
  assert.equal(page.send.disabled, true);
  assert.equal(page.graduation.disabled, true);
  assert.equal(page.reset.disabled, true);
  assert.equal(page.file.disabled, true);
  assert.equal(page.status.textContent, readingStatus);
  // 전송 직후 고른 파일이 비워진다.
  assert.deepEqual(page.file.files, []);

  type(page, "가상 질문");
  assert.equal(page.send.disabled, true);
  submit(page);
  submit(page);
  page.graduation.listeners.get("click")({});
  page.reset.listeners.get("click")({});
  await setImmediate();
  assert.deepEqual(requests, [photoPath]);
  assert.equal(page.transcript.querySelectorAll(".turn").length, 1);

  respond({ ok: true, status: 200, json: async () => confirmed() });
  await setImmediate();
  assert.equal(page.graduation.disabled, false);
  assert.equal(page.reset.disabled, false);
  assert.equal(page.file.disabled, false);
  assert.equal(page.status.textContent, "");
  assert.equal(readCard(page).lines[0], eventTitle);

  // 사진은 이미 비워졌으므로 다시 고르기 전에는 같은 사진이 또 가지 않는다.
  type(page, "");
  assert.equal(page.send.disabled, true);
  submit(page);
  await setImmediate();
  assert.deepEqual(requests, [photoPath]);

  choose(page, photo());
  assert.equal(page.send.disabled, false);
  submit(page);
  await setImmediate();
  assert.deepEqual(requests, [photoPath, photoPath]);
});

test("질문을 보내는 중에는 사진 전송이 막힌다", async () => {
  const requests = [];
  let answer;
  const page = loadChat((path, options) => {
    requests.push(path);
    if (path === "/api/v1/chat") return new Promise(resolve => { answer = resolve; });
    return answering(confirmed())(path, options);
  });

  type(page, "가상 질문");
  submit(page);
  assert.equal(page.send.disabled, true);
  assert.equal(page.file.disabled, true);

  choose(page, photo());
  assert.equal(page.send.disabled, true);
  submit(page);
  await setImmediate();
  assert.deepEqual(requests, ["/api/v1/chat"]);
  assert.equal(page.transcript.querySelectorAll(".turn").length, 1);

  answer({ ok: true, json: async () => ({ session_id: "fictional-session", answered: false }) });
  await setImmediate();
  assert.equal(page.send.disabled, false);
  assert.equal(page.file.disabled, false);

  submit(page);
  await setImmediate();
  assert.deepEqual(requests, ["/api/v1/chat", photoPath]);
  assert.equal(readCard(page).lines[0], eventTitle);
});

test("확정된 행사 카드는 사진 답변 자리에 그려지고, 그 아래에 판독문 편집 칸이 붙는다", async () => {
  const requests = [];
  const page = await lookup(answering(confirmed({}, { recognized_text: "가상 판독문" }), requests));
  const { card } = readCard(page);

  assert.equal(card.tagName, "section");
  assert.equal(card.className, "poster-result");
  assert.equal(card.parent.className, "photo-answer");
  const reply = page.transcript.querySelectorAll(".reply")[0];
  assert.deepEqual(reply.children.map(child => child.className), ["photo-answer", "reading"]);
  assert.deepEqual(page.transcript.querySelectorAll(".reading-text").map(box => box.value), ["가상 판독문"]);
  assert.deepEqual(page.transcript.querySelectorAll(".reading-question").map(box => box.value), [""]);
  assert.equal(page.transcript.querySelectorAll(".reask").length, 1);
  assert.equal(byTag(page.transcript.querySelectorAll(".reading")[0], "a").length, 0);
  // 확정된 행사는 읽은 글자가 있어도 글자 주소로 다시 묻지 않는다.
  assert.deepEqual(paths(requests), [photoPath]);
});

test("확정된 행사는 제목, 행사일, 공식 마감 순으로 보이고 사진 마감 안내는 그 아래에 붙는다", async () => {
  const page = await shown(confirmed({ poster_deadline: "11-20" }, { reasons: ["deadline_mismatch"] }));
  const { card, lines, badges } = readCard(page);

  assert.deepEqual(lines, [
    eventTitle,
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
  assert.equal(page.note.textContent, foundNote);
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
    `공식 공지 보기 (${eventTitle}, 새 탭에서 열림)`,
    `신청 페이지 열기 (${eventTitle}, 새 탭에서 열림)`,
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
    assert.deepEqual(hints, ["공식 공지 확인 필요", "BISKIT 로그인 필요 · 로그인 후 프로그램명으로 검색"]);
    assert.deepEqual(lines, [
      eventTitle,
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
  assert.deepEqual(hints, ["BISKIT 로그인 필요 · 로그인 후 프로그램명으로 검색"]);
});

test("신청 주소가 null이어도 로그인이 필요하면 'BISKIT 로그인 필요'를 적고, 필요 없으면 적지 않는다", async () => {
  const login = readCard(await shown(confirmed({ application_url: null, login_required: true })));
  assert.equal(login.links.length, 1);
  assert.equal(login.hints.length, 1);
  assert.match(login.hints[0], /^BISKIT 로그인 필요/);

  const open = readCard(await shown(confirmed({ application_url: null, login_required: false })));
  assert.equal(open.links.length, 1);
  assert.deepEqual(open.hints, []);
});

// chat.js의 photoNeedsCheck·photoMessages와 같은 문구다.
const needsCheckMessages = {
  no_readable_clue: "사진에서 읽을 수 있는 글자나 QR을 찾지 못했어요. 글자가 또렷하게 보이게 다시 찍어 주세요.",
  ambiguous_event: "사진만으로는 어느 행사인지 하나로 정하지 못했어요. 제목과 날짜가 함께 보이거나 QR이 보이는 사진으로 다시 시도해 주세요.",
  text_reader_unavailable: "지금은 서버가 사진 속 글자를 읽을 수 없어요. QR이 보이는 사진으로 다시 시도하거나 글자를 직접 적어 주세요.",
};
const nothingReadLine = "사진에서 읽은 글자가 없어요. 글자를 직접 적거나 질문을 함께 보내 주세요.";
const heldLine = "근거가 충분하지 않아 답변을 보류했어요. 읽은 글자를 고치거나 질문을 더 구체적으로 적어 다시 물어 주세요.";
const noLinkLine = "확인하지 못한 내용에는 링크를 붙이지 않아요. 학교 공지에서 직접 찾아 주세요.";
const nothingNote = "사진에서 확인한 내용이 없어요. 링크는 보여 주지 않아요.";
const heldNote = "답변을 보류했어요. 링크는 보여 주지 않아요.";

for (const [reason, message] of Object.entries(needsCheckMessages)) {
  test(`확인 필요(${reason})이고 읽은 글자와 질문이 없으면 서버를 더 부르지 않고 사유에 맞는 문구를 보여 준다`, async () => {
    const requests = [];
    const page = await lookup(answering(needsCheck([reason], { recognized_text: "" }), requests));
    const { card, lines, links } = readCard(page);

    assert.deepEqual(lines, ["확인 필요", message, noLinkLine]);
    assert.equal(links.length, 0);
    assert.equal(byTag(page.transcript, "a").length, 0);
    assert.equal(card.tagName, "section");
    assert.equal(card.className, "poster-result unconfirmed");
    assert.equal(page.transcript.querySelectorAll(".error").length, 0);
    assert.equal(page.note.textContent, nothingNote);
    assert.deepEqual(paths(requests), [photoPath]);
    assert.equal(page.transcript.querySelectorAll(".reading").length, 1);
  });
}

test("확인 필요 사유별 문구는 서로 다르고, 사유가 여럿이면 모두 보여 준다", async () => {
  assert.equal(new Set([...Object.values(needsCheckMessages), nothingReadLine, heldLine]).size, 5);

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
  test(`확인 필요인데 ${label}이면 읽은 글자가 없다는 문구를 보여 준다`, async () => {
    const { lines, links } = readCard(await shown(needsCheck(reasons)));

    assert.deepEqual(lines, ["확인 필요", nothingReadLine, noLinkLine]);
    assert.equal(links.length, 0);
  });
}

for (const eventMatch of ["needs_check", "CONFIRMED", "maybe", null, undefined, true]) {
  test(`event_match가 ${eventMatch}이면 서버가 행사와 주소를 함께 보내도 행사와 링크를 보이지 않는다`, async () => {
    const requests = [];
    const page = await lookup(answering({ ...confirmed(), event_match: eventMatch }, requests));
    const { lines, links } = readCard(page);

    assert.equal(links.length, 0);
    assert.equal(byTag(page.transcript, "a").length, 0);
    assert.deepEqual(lines, ["확인 필요", nothingReadLine, noLinkLine]);
    assert.equal(text(page.transcript).includes(eventTitle), false);
    assert.equal(page.note.textContent, nothingNote);
    assert.deepEqual(paths(requests), [photoPath]);
  });
}

test("확정이 아닌 응답에 행사와 읽은 글자가 함께 와도 글자만 다시 묻고, 보류되면 행사와 링크를 보이지 않는다", async () => {
  const requests = [];
  const payload = { ...confirmed(), event_match: "needs_check", recognized_text: "가상 판독문" };
  const page = await lookup(answering(payload, requests, { kind: "hold" }));
  const { lines } = readCard(page);

  assert.deepEqual(paths(requests), [photoPath, textPath]);
  assert.deepEqual(JSON.parse(requests[1].body), { question: "", recognized_text: "가상 판독문", session_id: null });
  assert.equal(requests[1].body.includes("example.invalid"), false);
  assert.deepEqual(lines, ["확인 필요", heldLine, noLinkLine]);
  assert.equal(byTag(page.transcript, "a").length, 0);
  assert.equal(text(page.transcript).includes(eventTitle), false);
});

test("글자 주소가 행사(event)로 답하면 사진으로 확정됐을 때와 같은 행사 카드를 보여 준다", async () => {
  const direct = readCard(await shown(confirmed()));

  const requests = [];
  const answer = { kind: "event", event: event(), reasons: [], identified_by: ["text"] };
  const page = await lookup(answering(needsCheck([], { recognized_text: eventTitle }), requests, answer));
  const { card, lines, links, hints } = readCard(page);

  assert.deepEqual(paths(requests), [photoPath, textPath]);
  assert.equal(card.className, "poster-result");
  assert.equal(card.parent.className, "photo-answer");
  assert.deepEqual(lines, direct.lines);
  assert.deepEqual(
    links.map(link => link.attributes.get("href")),
    direct.links.map(link => link.attributes.get("href")),
  );
  assert.deepEqual(hints, direct.hints);
  assert.equal(page.note.textContent, foundNote);
});

test("읽은 글자로 답을 찾는 동안에는 상태 줄이 바뀌고 잠금이 이어진다", async () => {
  const requested = [];
  let respond;
  const page = await lookup((path, options) => {
    requested.push(path);
    if (path === textPath) return new Promise(resolve => { respond = resolve; });
    return answering(needsCheck([], { recognized_text: "가상 판독문" }))(path, options);
  });

  assert.equal(page.status.textContent, askingStatus);
  assert.equal(page.reset.disabled, true);
  assert.equal(page.send.disabled, true);
  // 답을 기다리는 동안에는 '고쳐서 다시 묻기'를 눌러도 요청이 더 가지 않는다.
  page.transcript.querySelectorAll(".reask")[0].listeners.get("click")({});
  await setImmediate();
  assert.deepEqual(requested, [photoPath, textPath]);

  respond({ ok: true, status: 200, json: async () => ({ kind: "hold" }) });
  await setImmediate();
  assert.equal(page.status.textContent, "");
  assert.equal(page.reset.disabled, false);
  assert.equal(page.transcript.querySelectorAll(".reask")[0].disabled, false);
  assert.equal(page.note.textContent, heldNote);
});

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
    assert.equal(page.status.textContent, "");
    assert.equal(page.reset.disabled, false);
    // 고른 파일은 전송 직후 비워졌으므로, 다시 고르기 전에는 보내기 버튼이 잠겨 있다.
    assert.deepEqual(page.file.files, []);
    assert.equal(page.send.disabled, true);
    assert.equal(page.transcript.querySelectorAll(".reading").length, 0);
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
  assert.equal(page.reset.disabled, false);
  assert.equal(page.status.textContent, "");
  assert.deepEqual(page.file.files, []);

  online = true;
  retries[0].listeners.get("click")({});
  assert.equal(page.status.textContent, readingStatus);
  await setImmediate();

  assert.equal(bodies.length, 2);
  assert.equal(bodies[1], bodies[0]);
  assert.deepEqual(new Uint8Array(await bodies[1].arrayBuffer()), jpegBytes);
  assert.equal(page.transcript.querySelectorAll(".error").length, 0);
  assert.equal(page.transcript.querySelectorAll(".turn").length, 1);
  assert.equal(readCard(page).lines[0], eventTitle);
  assert.equal(page.note.textContent, foundNote);
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
    const requests = [];
    const page = await lookup(answering(payload, requests));
    const { message, retries } = readError(page);

    assert.equal(message, failureMessages.server);
    assert.equal(retries.length, 1);
    assert.equal(page.note.textContent, failureMessages.server);
    assert.equal(page.transcript.querySelectorAll(".reading").length, 0);
    assert.deepEqual(paths(requests), [photoPath]);
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
  assert.equal(page.reset.disabled, false);
  assert.equal(page.status.textContent, "");
});

// 상태 코드 200은 받았지만 본문을 받는 중에 연결이 끊긴 경우다. 브라우저는 이때 SyntaxError가 아닌 오류를 낸다.
for (const [label, failure] of [
  ["연결 끊김", () => new TypeError("fictional connection lost while reading the body")],
  ["시간 초과", () => new DOMException("fictional timeout", "TimeoutError")],
  ["중단", () => new DOMException("fictional abort", "AbortError")],
]) {
  test(`응답 본문을 받는 중 ${label}이면 통신 실패 문구를 보여 주고, 다시 시도하면 같은 바이트를 보낸다`, async () => {
    const bodies = [];
    let broken = true;
    const page = await lookup(async (_path, options) => {
      bodies.push(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => {
          if (broken) throw failure();
          return confirmed();
        },
      };
    });
    const { message, retries } = readError(page);

    assert.equal(message, failureMessages.network);
    assert.equal(page.note.textContent, failureMessages.network);
    assert.equal(retries.length, 1);
    assert.equal(page.reset.disabled, false);
    assert.equal(page.status.textContent, "");

    broken = false;
    retries[0].listeners.get("click")({});
    await setImmediate();

    assert.equal(bodies.length, 2);
    assert.equal(bodies[1], bodies[0]);
    assert.equal(page.transcript.querySelectorAll(".error").length, 0);
    assert.equal(readCard(page).lines[0], eventTitle);
  });
}

test("서버 값은 글자 그대로 넣고 HTML로 해석하지 않는다", async () => {
  const markup = "<img src=x onerror=alert(1)>";
  const page = await shown(confirmed(
    { title: markup, event_date: markup, official_deadline: markup, poster_deadline: markup, checked_on: markup },
    { reasons: ["deadline_mismatch"], recognized_text: markup },
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
  // 판독문은 입력 칸의 값으로만 들어간다.
  assert.equal(page.transcript.querySelectorAll(".reading-text")[0].value, markup);
});

test("사진을 여러 번 보내면 결과가 차례로 쌓이고, 새 대화를 누르면 결과와 알림이 지워진다", async () => {
  const page = await shown(confirmed());
  choose(page, photo());
  submit(page);
  await setImmediate();
  assert.equal(page.transcript.querySelectorAll(".turn").length, 2);
  assert.equal(page.transcript.querySelectorAll(".poster-result").length, 2);
  assert.equal(page.note.textContent, foundNote);

  page.reset.listeners.get("click")({});

  assert.deepEqual(page.transcript.children, [page.empty]);
  assert.equal(page.note.textContent, "");
});

test("새 대화를 누르면 고른 사진도 비워져, 다시 고르기 전에는 보내기 버튼이 잠기고 같은 사진이 가지 않는다", async () => {
  const requests = [];
  const page = loadChat(answering(confirmed(), requests));
  choose(page, photo());
  type(page, "가상 질문");
  assert.equal(page.send.disabled, false);

  page.reset.listeners.get("click")({});

  assert.deepEqual(page.file.files, []);
  assert.equal(page.input.value, "");
  assert.equal(page.send.disabled, true);
  assert.equal(page.clear.hidden, true);
  assert.deepEqual(page.transcript.children, [page.empty]);

  submit(page);
  await setImmediate();
  assert.equal(requests.length, 0, "the previous photo must not be sent");
  assert.equal(page.transcript.querySelectorAll(".poster-result").length, 0);

  choose(page, photo("image/png"));
  assert.equal(page.send.disabled, false);
  submit(page);
  await setImmediate();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, photoPath);
  assert.equal(requests[0].headers["Content-Type"], "image/png");
});

test("요청 중에는 새 대화가 눌리지 않아 대화와 잠금이 그대로다", async () => {
  let respond;
  const page = loadChat(() => new Promise(resolve => { respond = resolve; }));
  choose(page, photo());
  submit(page);
  type(page, "가상 질문");

  page.reset.listeners.get("click")({});

  assert.equal(page.input.value, "가상 질문");
  assert.equal(page.send.disabled, true);
  assert.equal(page.reset.disabled, true);
  assert.equal(page.transcript.querySelectorAll(".turn").length, 1);
  assert.equal(page.status.textContent, readingStatus);

  respond({ ok: true, status: 200, json: async () => confirmed() });
  await setImmediate();
  assert.equal(page.reset.disabled, false);
  assert.equal(readCard(page).lines[0], eventTitle);
});

test("사진을 다시 고르면 이전 알림이 지워진다", async () => {
  const page = await lookup(refusing(415));
  assert.equal(page.note.textContent, failureMessages[415]);
  assert.equal(page.send.disabled, true);

  choose(page, photo("image/png"));

  assert.equal(page.note.textContent, "");
  assert.equal(page.send.disabled, false);
});

// 여기부터는 기존 현수막 사례다. 서버 응답은 모두 가상 값이고, 바뀐 화면에서도 같은 카드가 보이는지만 확인한다.

test("기존 사례: SJA 행사 사진과 두 QR은 단서가 달라도 같은 제목·날짜·링크의 카드를 보이고 글자 주소는 부르지 않는다", async () => {
  const clueLines = [
    [["text"], "확인 단서 · 사진 글자"],
    [["qr_notice"], "확인 단서 · 공지 QR"],
    [["qr_program"], "확인 단서 · BISKIT 프로그램 QR"],
    [["qr_notice", "qr_program"], "확인 단서 · 공지 QR, BISKIT 프로그램 QR"],
  ];
  const expectedLines = [
    eventTitle,
    "행사일 2026년 11월 23일",
    "공식 신청 마감 2026년 11월 22일",
    "신청 접수 중",
    "마일리지 미공개 · 공식 공지에서 확인",
    checkedLine,
  ];

  for (const [identifiedBy, clueLine] of clueLines) {
    const requests = [];
    const payload = confirmed({}, { identified_by: identifiedBy, recognized_text: `${eventTitle} 11.23` });
    const page = await lookup(answering(payload, requests));
    const { card, lines, links, hints } = readCard(page);
    const label = identifiedBy.join("+");

    assert.equal(lines[1], clueLine, label);
    assert.deepEqual(lines.filter((_line, index) => index !== 1), expectedLines, label);
    assert.deepEqual(byTag(card, "time").map(time => time.dateTime), ["2026-11-23", "2026-11-22", "2026-11-13"], label);
    assert.deepEqual(links.map(link => link.attributes.get("href")), [
      "https://notice.example.invalid/view?articleNo=1",
      "https://apply.example.invalid/login?next=%2Fprograms%2F1",
    ], label);
    assert.deepEqual(hints, ["BISKIT 로그인 필요"], label);
    assert.equal(page.note.textContent, foundNote, label);
    assert.deepEqual(paths(requests), [photoPath], label);
  }
});

test("기존 사례: 같은 이름의 풍경 사진은 읽은 단서가 없으면 카드와 행사 링크를 보이지 않고 글자 주소도 부르지 않는다", async () => {
  const requests = [];
  const payload = needsCheck(["no_readable_clue"], { recognized_text: "" });
  const page = await lookup(answering(payload, requests), photo("image/jpeg", jpegBytes, fileName));
  const { card, lines } = readCard(page);

  assert.deepEqual(paths(requests), [photoPath]);
  assert.equal(card.className, "poster-result unconfirmed");
  assert.deepEqual(lines, ["확인 필요", needsCheckMessages.no_readable_clue, noLinkLine]);
  assert.equal(byTag(page.transcript, "a").length, 0);
  assert.equal(text(page.transcript).includes(eventTitle), false);
  assert.equal(text(page.transcript).includes("비밀이름"), false);
  assert.equal(page.note.textContent, nothingNote);
});

test("기존 사례: 풍경 사진에서 행사 이름만 읽히면 사진 없이 글자만 다시 묻고, 보류되면 노란 카드만 보이며 링크가 하나도 없다", async () => {
  const requests = [];
  const payload = needsCheck([], { recognized_text: eventTitle });
  // 보류 응답에 행사 정보가 섞여 와도 화면은 그리지 않는다.
  const page = await lookup(
    answering(payload, requests, { kind: "hold", event: event() }),
    photo("image/jpeg", jpegBytes, fileName),
  );

  assert.deepEqual(paths(requests), [photoPath, textPath]);
  const [, textRequest] = requests;
  assert.equal(textRequest.method, "POST");
  assert.deepEqual(textRequest.headers, { "Content-Type": "application/json", Accept: "application/json" });
  assert.equal(typeof textRequest.body, "string", "the photo must not be sent again");
  assert.deepEqual(JSON.parse(textRequest.body), { question: "", recognized_text: eventTitle, session_id: null });
  assert.equal(textRequest.body.includes("비밀이름"), false);

  const { card, lines, links } = readCard(page);
  assert.equal(card.className, "poster-result unconfirmed");
  assert.equal(card.parent.className, "photo-answer");
  assert.deepEqual(lines, ["확인 필요", heldLine, noLinkLine]);
  assert.equal(links.length, 0);
  assert.equal(byTag(page.transcript, "a").length, 0);
  assert.equal(page.transcript.querySelectorAll(".error").length, 0);
  assert.equal(page.note.textContent, heldNote);
  assert.equal(page.status.textContent, "");
  // 읽힌 행사 이름은 편집 칸의 값으로만 남고, 대화 글자로는 나오지 않는다.
  assert.deepEqual(page.transcript.querySelectorAll(".reading-text").map(box => box.value), [eventTitle]);
  assert.equal(text(page.transcript).includes(eventTitle), false);
});

test("기존 사례: 마감이 다른 사진은 공식 마감을 먼저 보이고 사진 마감은 차이 안내 줄로만 보인다", async () => {
  const requests = [];
  const payload = confirmed({ poster_deadline: "11-20" }, { reasons: ["deadline_mismatch"] });
  const page = await lookup(answering(payload, requests));
  const { card, lines } = readCard(page);

  const official = lines.indexOf("공식 신청 마감 2026년 11월 22일");
  const onPoster = lines.indexOf("확인 필요 사진에는 마감이 11월 20일로 적혀 있어요. 공식 공지의 마감을 따르세요.");
  assert.equal(official, 3);
  assert.equal(onPoster, 4);
  assert.deepEqual(card.querySelectorAll(".mismatch").map(text), [lines[onPoster]]);
  // 사진 마감에는 연도를 붙이지 않으며, 날짜 요소로도 만들지 않는다.
  assert.deepEqual(byTag(card, "time").map(time => time.dateTime), ["2026-11-23", "2026-11-22", "2026-11-13"]);
  assert.equal(lines.join("\n").includes("2026년 11월 20일"), false);
  assert.deepEqual(paths(requests), [photoPath]);
});

test("기존 사례: 마감 당일인 사진은 신청 상태를 확인 필요로 보이고 마감 당일 안내를 붙인다", async () => {
  const requests = [];
  const payload = confirmed({ application_state: "needs_check" }, { reasons: ["deadline_day"] });
  const page = await lookup(answering(payload, requests));
  const { card, lines, badges } = readCard(page);

  assert.deepEqual(card.querySelectorAll(".state").map(text), [
    "신청 상태 확인 필요 오늘이 마감일이에요. 공지에 마감 시각이 없어 공식 공지에서 확인해야 해요.",
  ]);
  assert.deepEqual(badges, ["신청 상태 확인 필요"]);
  assert.equal(card.querySelectorAll(".mismatch").length, 0);
  assert.equal(lines[3], "공식 신청 마감 2026년 11월 22일");
  assert.deepEqual(paths(requests), [photoPath]);
});
