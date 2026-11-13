// 채팅 입력창의 사진 첨부 화면 테스트 (#52). 브라우저와 서버를 띄우지 않고, 가짜 화면 객체와
// 가짜 서버 요청 함수(fetch)로 chat.js를 그대로 실행한다. 사진 바이트·판독문·장소·주소는 모두 가상 값이다.
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

  // 서버 값이나 판독문을 HTML로 해석하는 경로를 쓰면 테스트가 바로 실패한다.
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

const photoPath = "/api/v1/photo-input";
const textPath = "/api/v1/photo-question";
const chatPath = "/api/v1/chat";
const fileName = "가상-사진-비밀이름.jpg";
const jpegBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

function photo(type = "image/jpeg") {
  return new File([jpegBytes], fileName, { type });
}

function choose(page, file) {
  page.file.files = file ? [file] : [];
  page.file.listeners.get("change")({});
}

function submit(page) {
  page.composer.listeners.get("submit")({ preventDefault() {} });
}

// 질문과 사진을 입력창에 넣고 보낸 뒤, 이어지는 요청이 모두 끝날 때까지 기다린다.
async function sendFrom(page, { question = "", file = null } = {}) {
  page.input.value = question;
  if (file) choose(page, file);
  submit(page);
  await setImmediate();
}

const ok = payload => ({ ok: true, status: 200, json: async () => payload });
const refused = status => ({ ok: false, status, json: async () => ({ detail: "fictional error" }) });

// 주소별로 정해 둔 가짜 응답을 돌려주고, 받은 요청을 순서대로 적어 둔다.
function serving(routes, requests = []) {
  return async (path, options = {}) => {
    requests.push({ path, ...options, headers: { ...options.headers } });
    const route = routes[path];
    if (route === undefined) throw new Error(`unexpected request: ${path}`);
    return typeof route === "function" ? route(options) : route;
  };
}

function paths(requests) {
  return requests.map(request => request.path);
}

function sentText(request) {
  assert.equal(typeof request.body, "string", "a text question must not carry photo bytes");
  return JSON.parse(request.body);
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

// 사진 주소의 응답. 기존 행사 응답 필드에 판독문(recognized_text)이 더해진 모양이다.
function confirmedPhoto(recognized = "가상 해외 취업 설명회 11.23", top = {}) {
  return { event_match: "confirmed", identified_by: ["text"], reasons: [], event: event(), recognized_text: recognized, ...top };
}

function unmatchedPhoto(recognized, reasons = []) {
  return { event_match: "needs_check", identified_by: [], reasons, event: null, recognized_text: recognized };
}

// 이슈 #52에 적힌 글자 주소의 가상 응답이다.
const campusAnswer = {
  kind: "campus",
  answer: "가상관은 정문 옆 건물입니다.",
  sources: [{ title: "가상 캠퍼스 안내", url: "https://example.invalid/campus" }],
  event: null,
  hold_reason: null,
};
const regulationAnswer = {
  kind: "regulation",
  answer: "가상 열람증은 도서관장이 발급합니다.",
  sources: [{ title: "가상 별빛 도서관 규정", url: "https://example.invalid/rules" }],
  event: null,
  hold_reason: null,
};
const holdAnswer = { kind: "hold", answer: null, sources: [], event: null, hold_reason: "가상 보류 사유" };

const messages = {
  held: "근거가 충분하지 않아 답변을 보류했어요. 읽은 글자를 고치거나 질문을 더 구체적으로 적어 다시 물어 주세요.",
  noLink: "확인하지 못한 내용에는 링크를 붙이지 않아요. 학교 공지에서 직접 찾아 주세요.",
  tooLong: "읽은 글자가 2,000자를 넘어요. 필요한 부분만 남기고 줄인 뒤 다시 물어 주세요.",
  nothingToAsk: "질문이나 읽은 글자를 적은 뒤 다시 물어 주세요.",
  nothingRead: "사진에서 읽은 글자가 없어요. 글자를 직접 적거나 질문을 함께 보내 주세요.",
  disconnected: "서버에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.",
  textFailed: "서버가 읽은 글자로 답을 만들지 못했어요.",
  textRejected: "서버가 이 글자를 받지 않았어요. 질문과 읽은 글자를 고친 뒤 다시 물어 주세요.",
};

function only(nodes, label) {
  assert.equal(nodes.length, 1, `expected exactly one ${label}`);
  return nodes[0];
}

// 사진 답변 한 건에 붙는 판독문 편집 칸을 읽는다.
function readPanel(page) {
  const panel = only(page.transcript.querySelectorAll(".reading"), "reading panel");
  return {
    panel,
    recognized: only(panel.querySelectorAll(".reading-text"), "recognized text box"),
    question: only(panel.querySelectorAll(".reading-question"), "question box"),
    note: only(panel.querySelectorAll(".reading-note"), "panel note"),
    reask: only(panel.querySelectorAll(".reask"), "re-ask button"),
  };
}

async function reask(page) {
  readPanel(page).reask.listeners.get("click")({});
  await setImmediate();
}

function readTextAnswer(page) {
  const section = only(page.transcript.querySelectorAll(".text-answer"), "text answer");
  return {
    heading: text(byTag(section, "h3")[0]),
    answer: text(byTag(section, "p")[0]),
    links: byTag(section, "a"),
    items: byTag(section, "li").map(text),
  };
}

function readHold(page) {
  const card = only(page.transcript.querySelectorAll(".unconfirmed"), "hold card");
  assert.equal(byTag(page.transcript, "a").length, 0, "a held answer must not show any link");
  return card.children.map(text);
}

function eventTitles(page) {
  return page.transcript.querySelectorAll(".poster-result")
    .filter(card => !card.className.includes("unconfirmed"))
    .map(card => text(byTag(card, "h3")[0]));
}

test("입력창 안에 사진 첨부 칸이 있고, 별도의 현수막 칸과 옛 요소는 없다", () => {
  const composer = /<form id="composer"[\s\S]*?<\/form>/.exec(html)?.[0] ?? "";
  assert.match(composer, /<input type="file" id="photo-file" accept="image\/jpeg,image\/png"/);
  assert.match(composer, /<button type="button"[^>]*id="photo-clear" hidden>/);
  assert.match(composer, /<p[^>]*id="photo-note" role="status">/);
  assert.match(composer, /<label for="photo-file">사진 첨부<\/label>/);
  // 사진만 보낼 수 있어야 하므로 질문 칸을 필수로 두지 않는다.
  assert.doesNotMatch(composer, /<textarea id="question"[^>]*required/);

  assert.equal(html.includes("현수막으로 행사 찾기"), false);
  for (const id of ["poster-form", "poster-file", "poster-submit", "poster-note"]) {
    assert.equal(html.includes(`id="${id}"`), false, id);
    assert.equal(script.includes(`#${id}`), false, id);
  }
  assert.equal(html.split("<form").length, 2, "the composer must be the only form");
  assert.equal(script.includes("/api/v1/poster-lookup"), false);
});

test("질문만 보내면 기존 채팅 주소로만 가고 판독문 칸은 생기지 않는다", async () => {
  const requests = [];
  const page = loadChat(serving({
    [chatPath]: ok({ session_id: "s-1", answered: true, answer: "가상 답변입니다.", citations: [] }),
  }, requests));

  await sendFrom(page, { question: "가상 열람증은 누가 내주나요?" });

  assert.deepEqual(paths(requests), [chatPath]);
  assert.equal(JSON.parse(requests[0].body).message, "가상 열람증은 누가 내주나요?");
  assert.equal(page.transcript.querySelectorAll(".reading").length, 0);
  assert.equal(text(page.transcript.querySelectorAll(".question")[0]), "내 질문: 가상 열람증은 누가 내주나요?");
});

test("질문도 사진도 없으면 보내기 버튼이 잠겨 있고 제출해도 요청하지 않는다", async () => {
  const requests = [];
  const page = loadChat(serving({}, requests));
  assert.equal(page.send.disabled, true);
  assert.equal(page.clear.hidden, true);

  await sendFrom(page);

  assert.equal(requests.length, 0);
  assert.deepEqual(page.transcript.children, [page.empty]);
});

test("사진만 보내 행사가 확인되면 사진 주소 한 번으로 카드와 읽은 글자를 보여 준다", async () => {
  const requests = [];
  const page = loadChat(serving({ [photoPath]: ok(confirmedPhoto()) }, requests));
  choose(page, photo());
  assert.equal(page.send.disabled, false, "a photo alone must be enough to send");

  submit(page);
  await setImmediate();

  assert.deepEqual(paths(requests), [photoPath]);
  const [request] = requests;
  assert.equal(request.method, "POST");
  assert.deepEqual(request.headers, { "Content-Type": "image/jpeg", Accept: "application/json" });
  assert.ok(request.body instanceof Blob);
  assert.equal(request.body instanceof File, false, "the body must not carry a file name");
  assert.deepEqual(new Uint8Array(await request.body.arrayBuffer()), jpegBytes);

  assert.deepEqual(eventTitles(page), ["가상 해외 취업 설명회"]);
  const { recognized, question } = readPanel(page);
  assert.equal(recognized.tagName, "textarea");
  assert.equal(recognized.value, "가상 해외 취업 설명회 11.23");
  assert.equal(question.value, "");
  assert.equal(text(page.transcript.querySelectorAll(".question")[0]), "내 질문: 사진 1장");
  assert.equal(text(page.transcript).includes("비밀이름"), false);
  assert.equal(page.note.textContent, "행사를 찾았어요. 가상 해외 취업 설명회");
  assert.equal(page.status.textContent, "");
});

test("사진과 질문을 함께 보내 행사가 확인되면 카드를 보이고 질문은 편집 칸에 남는다", async () => {
  const requests = [];
  const page = loadChat(serving({ [photoPath]: ok(confirmedPhoto()), [textPath]: ok(regulationAnswer) }, requests));

  await sendFrom(page, { question: "신청하면 마일리지를 받나요?", file: photo() });

  assert.deepEqual(paths(requests), [photoPath], "a confirmed event must not trigger a text question");
  assert.deepEqual(eventTitles(page), ["가상 해외 취업 설명회"]);
  assert.equal(readPanel(page).question.value, "신청하면 마일리지를 받나요?");
  assert.equal(text(page.transcript.querySelectorAll(".question")[0]), "내 질문: 신청하면 마일리지를 받나요?사진 1장");
  assert.equal(page.input.value, "");

  // 남은 질문으로 다시 물으면 사진 없이 글자만 간다.
  await reask(page);

  assert.deepEqual(paths(requests), [photoPath, textPath]);
  assert.deepEqual(sentText(requests[1]), {
    question: "신청하면 마일리지를 받나요?",
    recognized_text: "가상 해외 취업 설명회 11.23",
    session_id: null,
  });
  assert.deepEqual(eventTitles(page), [], "the new answer replaces the card in the same turn");
  assert.equal(readTextAnswer(page).heading, "규정 검색");
});

test("사진만 보냈는데 행사가 아니면 읽은 글자가 질문이 되어 글자 주소로 간다", async () => {
  const requests = [];
  const page = loadChat(serving({ [photoPath]: ok(unmatchedPhoto("가상관 101호")), [textPath]: ok(campusAnswer) }, requests));

  await sendFrom(page, { file: photo("image/png") });

  assert.deepEqual(paths(requests), [photoPath, textPath]);
  assert.equal(requests[0].headers["Content-Type"], "image/png");
  assert.deepEqual(requests[1].headers, { "Content-Type": "application/json", Accept: "application/json" });
  assert.equal(requests[1].method, "POST");
  assert.deepEqual(sentText(requests[1]), { question: "", recognized_text: "가상관 101호", session_id: null });
  assert.equal(requests[1].body.includes("비밀이름"), false);

  const { heading, answer, links } = readTextAnswer(page);
  assert.equal(heading, "캠퍼스 안내");
  assert.equal(answer, "가상관은 정문 옆 건물입니다.");
  assert.deepEqual(links.map(link => link.attributes.get("href")), ["https://example.invalid/campus"]);
  assert.equal(text(links[0]), "가상 캠퍼스 안내 (출처, 새 탭에서 열림)");
  assert.equal(links[0].target, "_blank");
  assert.equal(links[0].rel, "noopener noreferrer");
  assert.equal(readPanel(page).recognized.value, "가상관 101호");
  assert.equal(eventTitles(page).length, 0);
  assert.equal(page.note.textContent, "캠퍼스 안내에서 답을 찾았어요.");
  assert.equal(page.status.textContent, "");
});

test("사진과 질문을 함께 보냈는데 행사가 아니면 질문과 읽은 글자를 나눠 보낸다", async () => {
  const requests = [];
  const page = loadChat(serving({ [photoPath]: ok(unmatchedPhoto("가상관 101호")), [textPath]: ok(campusAnswer) }, requests));

  await sendFrom(page, { question: "여기 어디야?", file: photo() });

  assert.deepEqual(paths(requests), [photoPath, textPath]);
  assert.deepEqual(sentText(requests[1]), { question: "여기 어디야?", recognized_text: "가상관 101호", session_id: null });
  assert.equal(readTextAnswer(page).answer, "가상관은 정문 옆 건물입니다.");
  assert.equal(readPanel(page).question.value, "여기 어디야?");
});

test("앞선 채팅에서 받은 대화 번호를 글자 질문에 그대로 싣는다", async () => {
  const requests = [];
  const page = loadChat(serving({
    [chatPath]: ok({ session_id: "s-1", answered: false }),
    [photoPath]: ok(unmatchedPhoto("가상관 101호")),
    [textPath]: ok(campusAnswer),
  }, requests));

  await sendFrom(page, { question: "가상 질문" });
  await sendFrom(page, { question: "여기 어디야?", file: photo() });

  assert.deepEqual(paths(requests), [chatPath, photoPath, textPath]);
  assert.equal(sentText(requests[2]).session_id, "s-1");
});

test("글자 주소가 행사라고 답하면 같은 행사 카드를 서버가 준 주소로 그린다", async () => {
  const page = loadChat(serving({
    [photoPath]: ok(unmatchedPhoto("가상 해외 취업 설명회 11.23")),
    [textPath]: ok({ kind: "event", answer: null, sources: [], event: event(), hold_reason: null }),
  }));

  await sendFrom(page, { file: photo() });

  assert.deepEqual(eventTitles(page), ["가상 해외 취업 설명회"]);
  assert.deepEqual(byTag(page.transcript, "a").map(link => link.attributes.get("href")), [
    "https://notice.example.invalid/view?articleNo=1",
    "https://apply.example.invalid/login?next=%2Fprograms%2F1",
  ]);
  assert.equal(page.note.textContent, "행사를 찾았어요. 가상 해외 취업 설명회");
});

test("보류 응답은 노란 확인 필요 카드로 보이고, 함께 온 출처와 행사는 그리지 않는다", async () => {
  const page = loadChat(serving({
    [photoPath]: ok(unmatchedPhoto("가상 낱말")),
    [textPath]: ok({ ...holdAnswer, sources: campusAnswer.sources, event: event(), answer: "가상 답" }),
  }));

  await sendFrom(page, { file: photo() });

  assert.deepEqual(readHold(page), ["확인 필요", messages.held, messages.noLink]);
  assert.equal(page.transcript.querySelectorAll(".error").length, 0, "a held answer is not an error");
  assert.equal(page.transcript.querySelectorAll(".text-answer").length, 0);
  assert.equal(text(page.transcript).includes("가상 해외 취업 설명회"), false);
  assert.equal(page.note.textContent, "답변을 보류했어요. 링크는 보여 주지 않아요.");
  assert.equal(readPanel(page).recognized.value, "가상 낱말");
});

test("질문과 읽은 글자가 모두 비면 글자 주소를 부르지 않고 확인 필요를 보여 준다", async () => {
  const requests = [];
  const page = loadChat(serving({ [photoPath]: ok(unmatchedPhoto("  ")) }, requests));

  await sendFrom(page, { file: photo() });

  assert.deepEqual(paths(requests), [photoPath]);
  assert.deepEqual(readHold(page), ["확인 필요", messages.nothingRead, messages.noLink]);

  // 편집 칸이 남아 있어 학생이 글자를 직접 적어 물을 수 있다. 둘 다 비워 둔 채로는 보내지 않는다.
  await reask(page);
  assert.deepEqual(paths(requests), [photoPath]);
  assert.equal(readPanel(page).note.textContent, messages.nothingToAsk);
});

test("서버가 글자를 읽지 못했어도 함께 보낸 질문은 글자 주소로 가고, 읽지 못한 까닭을 편집 칸에 적는다", async () => {
  const requests = [];
  const page = loadChat(serving({
    [photoPath]: ok(unmatchedPhoto("", ["text_reader_unavailable"])),
    [textPath]: ok(regulationAnswer),
  }, requests));

  await sendFrom(page, { question: "가상 열람증은 누가 내주나요?", file: photo() });

  assert.deepEqual(sentText(requests[1]), { question: "가상 열람증은 누가 내주나요?", recognized_text: "", session_id: null });
  assert.equal(readTextAnswer(page).heading, "규정 검색");
  assert.match(text(readPanel(page).panel), /지금은 서버가 사진 속 글자를 읽을 수 없어요/);
});

test("읽은 글자를 고쳐 다시 물으면 사진은 다시 보내지 않고 고친 글자만 보낸다", async () => {
  const requests = [];
  let answers = [holdAnswer, campusAnswer];
  const page = loadChat(serving({
    [photoPath]: ok(unmatchedPhoto("가싱관 1O1호")),
    [textPath]: () => ok(answers.shift()),
  }, requests));
  await sendFrom(page, { file: photo() });
  assert.equal(readHold(page)[1], messages.held);

  const panel = readPanel(page);
  panel.recognized.value = "  가상관 101호  ";
  panel.question.value = "여기 어디야?";
  await reask(page);

  assert.deepEqual(paths(requests), [photoPath, textPath, textPath], "the photo must be sent only once");
  assert.deepEqual(sentText(requests[2]), { question: "여기 어디야?", recognized_text: "가상관 101호", session_id: null });
  assert.equal(page.transcript.querySelectorAll(".unconfirmed").length, 0, "the earlier hold is replaced");
  assert.equal(readTextAnswer(page).answer, "가상관은 정문 옆 건물입니다.");
  assert.equal(page.transcript.querySelectorAll(".turn").length, 1);
  assert.equal(readPanel(page).recognized.value, "  가상관 101호  ", "the edited text stays for further edits");
  assert.equal(answers.length, 0);
});

test("글자 질의만 실패하면 다시 시도가 사진 없이 같은 글자만 다시 보낸다", async () => {
  const requests = [];
  let online = false;
  const page = loadChat(serving({
    [photoPath]: ok(unmatchedPhoto("가상관 101호")),
    [textPath]: () => {
      if (!online) throw new TypeError("fictional network failure");
      return ok(campusAnswer);
    },
  }, requests));

  await sendFrom(page, { question: "여기 어디야?", file: photo() });

  const error = only(page.transcript.querySelectorAll(".error"), "error");
  assert.equal(text(byTag(error, "p")[0]), messages.disconnected);
  assert.equal(page.note.textContent, messages.disconnected);
  assert.equal(readPanel(page).recognized.value, "가상관 101호", "the read text survives a failed text question");
  const retry = only(error.querySelectorAll(".retry"), "retry button");
  assert.equal(retry.disabled, false);

  online = true;
  retry.listeners.get("click")({});
  await setImmediate();

  assert.deepEqual(paths(requests), [photoPath, textPath, textPath]);
  assert.equal(requests[2].body, requests[1].body);
  assert.equal(page.transcript.querySelectorAll(".error").length, 0);
  assert.equal(readTextAnswer(page).answer, "가상관은 정문 옆 건물입니다.");
});

for (const status of [500, 503]) {
  test(`글자 주소가 ${status}로 답하면 오류 문구와 글자만 다시 보내는 다시 시도 버튼을 보여 준다`, async () => {
    const requests = [];
    const page = loadChat(serving({ [photoPath]: ok(unmatchedPhoto("가상관 101호")), [textPath]: refused(status) }, requests));

    await sendFrom(page, { file: photo() });

    const error = only(page.transcript.querySelectorAll(".error"), "error");
    assert.equal(text(byTag(error, "p")[0]), messages.textFailed);
    only(error.querySelectorAll(".retry"), "retry button").listeners.get("click")({});
    await setImmediate();
    assert.deepEqual(paths(requests), [photoPath, textPath, textPath]);
  });
}

test("글자 주소가 422로 거절하면 고쳐 달라고 안내하고 다시 시도 버튼은 두지 않는다", async () => {
  const page = loadChat(serving({ [photoPath]: ok(unmatchedPhoto("가상관 101호")), [textPath]: refused(422) }));

  await sendFrom(page, { file: photo() });

  const error = only(page.transcript.querySelectorAll(".error"), "error");
  assert.equal(text(byTag(error, "p")[0]), messages.textRejected);
  assert.equal(error.querySelectorAll(".retry").length, 0);
  assert.equal(readPanel(page).reask.disabled, false);
});

for (const [label, payload] of [
  ["null 본문", null],
  ["배열 본문", []],
  ["모르는 종류", { ...campusAnswer, kind: "weather" }],
  ["종류 누락", { ...campusAnswer, kind: undefined }],
  ["물려받은 이름의 종류", { ...campusAnswer, kind: "constructor" }],
  ["답이 빈 규정 응답", { ...regulationAnswer, answer: "  " }],
  ["답이 글자가 아닌 캠퍼스 응답", { ...campusAnswer, answer: 7 }],
  ["행사인데 행사 정보 없음", { kind: "event", event: null }],
  ["행사인데 로그인 여부가 글자", { kind: "event", event: event({ login_required: "true" }) }],
]) {
  test(`글자 주소의 응답 형식이 어긋나면(${label}) 반쯤 그린 답 대신 오류 문구를 보여 준다`, async () => {
    const page = loadChat(serving({ [photoPath]: ok(unmatchedPhoto("가상관 101호")), [textPath]: ok(payload) }));

    await sendFrom(page, { file: photo() });

    const error = only(page.transcript.querySelectorAll(".error"), "error");
    assert.equal(text(byTag(error, "p")[0]), messages.textFailed);
    assert.equal(error.querySelectorAll(".retry").length, 1);
    assert.equal(byTag(page.transcript, "a").length, 0);
    assert.equal(page.transcript.querySelectorAll(".text-answer").length, 0);
  });
}

test("고친 글자가 2,000자를 넘으면 보내지 않고 줄여 달라고 안내하며, 정확히 2,000자는 보낸다", async () => {
  const requests = [];
  const page = loadChat(serving({ [photoPath]: ok(confirmedPhoto()), [textPath]: ok(holdAnswer) }, requests));
  await sendFrom(page, { file: photo() });

  const panel = readPanel(page);
  panel.recognized.value = "가".repeat(2001);
  await reask(page);
  assert.deepEqual(paths(requests), [photoPath]);
  assert.equal(panel.note.textContent, messages.tooLong);
  assert.deepEqual(eventTitles(page), ["가상 해외 취업 설명회"], "the shown answer stays while the text is too long");

  panel.recognized.value = "가".repeat(2000);
  await reask(page);
  assert.deepEqual(paths(requests), [photoPath, textPath]);
  assert.equal(sentText(requests[1]).recognized_text.length, 2000);
  assert.equal(panel.note.textContent, "");
});

// 서버는 글자 수로 세므로, 두 칸을 차지하는 글자(그림 문자)도 한 글자로 센다.
test("2,000자 한도는 화면 내부의 저장 단위가 아니라 글자 수로 센다", async () => {
  const requests = [];
  const page = loadChat(serving({ [photoPath]: ok(confirmedPhoto()), [textPath]: ok(holdAnswer) }, requests));
  await sendFrom(page, { file: photo() });

  const wide = "🏫".repeat(2000);
  assert.equal(wide.length, 4000);
  readPanel(page).recognized.value = wide;
  await reask(page);

  assert.deepEqual(paths(requests), [photoPath, textPath]);
  assert.equal(sentText(requests[1]).recognized_text, wide);
});

test("사진에서 읽은 글자가 처음부터 2,000자를 넘으면 글자 주소로 보내지 않고 줄여 달라고 안내한다", async () => {
  const requests = [];
  const long = "가".repeat(2001);
  const page = loadChat(serving({ [photoPath]: ok(unmatchedPhoto(long)), [textPath]: ok(campusAnswer) }, requests));

  await sendFrom(page, { question: "여기 어디야?", file: photo() });

  assert.deepEqual(paths(requests), [photoPath]);
  assert.deepEqual(readHold(page), ["확인 필요", messages.tooLong, messages.noLink]);
  assert.equal(page.note.textContent, messages.tooLong);
  const panel = readPanel(page);
  assert.equal(panel.recognized.value, long);

  panel.recognized.value = "가상관 101호";
  await reask(page);
  assert.deepEqual(paths(requests), [photoPath, textPath]);
  assert.deepEqual(sentText(requests[1]), { question: "여기 어디야?", recognized_text: "가상관 101호", session_id: null });
});

const addressLike = "신청 https://phish.example.invalid/login www.phish.example.invalid javascript:alert(1)";

test("주소처럼 생긴 판독문은 편집 칸의 글자로만 남고 링크가 되지 않는다", async () => {
  const requests = [];
  const page = loadChat(serving({ [photoPath]: ok(unmatchedPhoto(addressLike)), [textPath]: ok(holdAnswer) }, requests));

  await sendFrom(page, { file: photo() });

  assert.equal(byTag(page.transcript, "a").length, 0);
  assert.equal(readPanel(page).recognized.value, addressLike);
  assert.equal(text(page.transcript).includes("phish.example.invalid"), false, "the read text lives only in the edit box");
  assert.equal(sentText(requests[1]).recognized_text, addressLike);
});

test("답변 글에 주소가 들어 있어도 링크는 서버가 준 안전한 출처로만 만든다", async () => {
  const page = loadChat(serving({
    [photoPath]: ok(unmatchedPhoto(addressLike)),
    [textPath]: ok({
      ...campusAnswer,
      answer: "자세한 내용은 https://phish.example.invalid/login 에서 확인하세요.",
      sources: [
        { title: "가상 캠퍼스 안내", url: "https://example.invalid/campus" },
        { title: "가상 위험 출처", url: "javascript:alert(1)" },
        { title: "가상 평문 출처", url: "http://example.invalid/plain" },
        { title: "가상 주소 없는 출처", url: null },
        { title: null, url: "https://example.invalid/untitled" },
        { title: "", url: "" },
        "https://phish.example.invalid/login",
        null,
      ],
    }),
  }));

  await sendFrom(page, { file: photo() });

  const { answer, links, items } = readTextAnswer(page);
  assert.equal(answer, "자세한 내용은 https://phish.example.invalid/login 에서 확인하세요.");
  assert.deepEqual(links.map(link => link.attributes.get("href")), [
    "https://example.invalid/campus",
    "https://example.invalid/untitled",
  ]);
  assert.deepEqual(byTag(page.transcript, "a").length, 2);
  assert.deepEqual(items, [
    "가상 캠퍼스 안내 (출처, 새 탭에서 열림)",
    "가상 위험 출처 · 링크 확인 필요",
    "가상 평문 출처 · 링크 확인 필요",
    "가상 주소 없는 출처 · 링크 확인 필요",
    "출처 보기 (출처, 새 탭에서 열림)",
  ]);
});

test("사진 응답에 QR 주소 같은 모르는 필드가 실려 와도 화면에 적거나 링크로 만들지 않는다", async () => {
  const page = loadChat(serving({
    [photoPath]: ok({ ...unmatchedPhoto(""), qr_urls: ["https://phish.example.invalid/qr"], qr_url: "https://phish.example.invalid/qr" }),
  }));

  await sendFrom(page, { file: photo() });

  assert.equal(byTag(page.transcript, "a").length, 0);
  assert.equal(text(page.transcript).includes("phish.example.invalid"), false);
});

test("서버 값과 판독문은 글자 그대로 넣고 HTML로 해석하지 않는다", async () => {
  const markup = "<img src=x onerror=alert(1)>";
  const page = loadChat(serving({
    [photoPath]: ok(unmatchedPhoto(markup)),
    [textPath]: ok({ ...campusAnswer, answer: markup, sources: [{ title: markup, url: "https://example.invalid/campus" }] }),
  }));

  await sendFrom(page, { question: markup, file: photo() });

  const { answer, links } = readTextAnswer(page);
  assert.equal(answer, markup);
  assert.equal(text(links[0]), `${markup} (출처, 새 탭에서 열림)`);
  assert.equal(byTag(page.transcript, "img").length, 0);
  assert.equal(readPanel(page).recognized.value, markup);
});

test("사진을 읽는 동안과 글자로 답을 찾는 동안 다시 보내도 요청이 늘지 않고 다른 버튼도 잠긴다", async () => {
  const requests = [];
  const waiting = {};
  const page = loadChat((path, options = {}) => {
    requests.push(path);
    return new Promise(resolve => { waiting[path] = resolve; });
  });
  page.input.value = "여기 어디야?";
  choose(page, photo());

  submit(page);
  assert.equal(page.send.disabled, true);
  assert.equal(page.reset.disabled, true);
  assert.equal(page.graduation.disabled, true);
  assert.equal(page.file.disabled, true);
  assert.equal(page.status.textContent, "사진에서 글자를 읽는 중…");

  const pressEverything = () => {
    choose(page, photo());
    page.input.value = "가상 질문";
    submit(page);
    submit(page);
    page.graduation.listeners.get("click")({});
    page.clear.listeners.get("click")({});
    page.reset.listeners.get("click")({});
  };
  pressEverything();
  await setImmediate();
  assert.deepEqual(requests, [photoPath]);
  assert.equal(page.transcript.querySelectorAll(".turn").length, 1);
  assert.equal(page.file.files.length, 1, "a busy screen must not drop the newly chosen photo");

  waiting[photoPath](ok(unmatchedPhoto("가상관 101호")));
  await setImmediate();
  assert.deepEqual(requests, [photoPath, textPath]);
  assert.equal(page.status.textContent, "읽은 글자로 답을 찾는 중…");
  assert.equal(page.send.disabled, true);
  assert.equal(page.reset.disabled, true);
  const panel = readPanel(page);
  assert.equal(panel.reask.disabled, true);

  pressEverything();
  panel.reask.listeners.get("click")({});
  await setImmediate();
  assert.deepEqual(requests, [photoPath, textPath]);
  assert.equal(page.transcript.querySelectorAll(".turn").length, 1);

  waiting[textPath](ok(campusAnswer));
  await setImmediate();
  assert.equal(page.status.textContent, "");
  assert.equal(page.reset.disabled, false);
  assert.equal(page.graduation.disabled, false);
  assert.equal(page.file.disabled, false);
  assert.equal(panel.reask.disabled, false);
  assert.equal(page.send.disabled, false);
  assert.equal(readTextAnswer(page).answer, "가상관은 정문 옆 건물입니다.");
});

test("다시 묻는 동안에는 다시 묻기와 보내기가 함께 잠겨 글자 요청이 한 번만 간다", async () => {
  const requests = [];
  let respond;
  const page = loadChat(serving({
    [photoPath]: ok(confirmedPhoto()),
    [textPath]: () => new Promise(resolve => { respond = resolve; }),
  }, requests));
  await sendFrom(page, { file: photo() });

  const panel = readPanel(page);
  panel.reask.listeners.get("click")({});
  assert.equal(panel.reask.disabled, true);
  assert.equal(page.reset.disabled, true);
  panel.reask.listeners.get("click")({});
  page.input.value = "가상 질문";
  submit(page);
  await setImmediate();
  assert.deepEqual(paths(requests), [photoPath, textPath]);

  respond(ok(holdAnswer));
  await setImmediate();
  assert.equal(panel.reask.disabled, false);
  assert.equal(readHold(page)[1], messages.held);
});

test("첨부 제거를 누르면 고른 사진이 비워져 질문만 채팅 주소로 간다", async () => {
  const requests = [];
  const page = loadChat(serving({ [chatPath]: ok({ session_id: "s-1", answered: false }) }, requests));
  choose(page, photo());
  assert.equal(page.clear.hidden, false);
  assert.equal(page.send.disabled, false);

  page.clear.listeners.get("click")({});

  assert.deepEqual(page.file.files, []);
  assert.equal(page.clear.hidden, true);
  assert.equal(page.send.disabled, true);
  submit(page);
  await setImmediate();
  assert.equal(requests.length, 0);

  await sendFrom(page, { question: "가상 질문" });
  assert.deepEqual(paths(requests), [chatPath]);
});

test("새 대화를 누르면 고른 사진과 알림, 대화가 함께 비워진다", async () => {
  const requests = [];
  const page = loadChat(serving({ [photoPath]: ok(confirmedPhoto()) }, requests));
  await sendFrom(page, { file: photo() });
  choose(page, photo("image/png"));
  page.input.value = "가상 질문";

  page.reset.listeners.get("click")({});

  assert.deepEqual(page.file.files, []);
  assert.equal(page.clear.hidden, true);
  assert.equal(page.send.disabled, true);
  assert.equal(page.input.value, "");
  assert.equal(page.note.textContent, "");
  assert.deepEqual(page.transcript.children, [page.empty]);
  submit(page);
  await setImmediate();
  assert.deepEqual(paths(requests), [photoPath], "the cleared photo must not be sent");
});

test("사진은 보낸 뒤 바로 비워져, 다음 질문에 같은 사진이 다시 실리지 않는다", async () => {
  const requests = [];
  const page = loadChat(serving({
    [photoPath]: ok(confirmedPhoto()),
    [chatPath]: ok({ session_id: "s-1", answered: false }),
  }, requests));

  await sendFrom(page, { file: photo() });
  assert.deepEqual(page.file.files, []);
  assert.equal(page.clear.hidden, true);
  assert.equal(page.send.disabled, true);

  await sendFrom(page, { question: "가상 질문" });
  assert.deepEqual(paths(requests), [photoPath, chatPath]);
});

for (const [label, file, expected] of [
  ["JPEG·PNG가 아닌 사진", { type: "image/gif", size: 10, slice() { throw new Error("must not be read"); } }, "JPEG나 PNG 사진만 읽을 수 있어요."],
  ["5,000,001바이트 사진", { type: "image/png", size: 5_000_001, slice() { throw new Error("must not be read"); } }, "사진이 5MB를 넘어요. 더 작은 사진으로 다시 올려 주세요."],
]) {
  test(`${label}을 질문과 함께 보내면 사진도 질문도 보내지 않고 안내한다`, async () => {
    const requests = [];
    const page = loadChat(serving({}, requests));

    await sendFrom(page, { question: "여기 어디야?", file });

    assert.equal(requests.length, 0);
    assert.equal(page.note.textContent, expected);
    assert.deepEqual(page.transcript.children, [page.empty]);
    assert.equal(page.input.value, "여기 어디야?", "the typed question is kept");
    assert.equal(page.file.files.length, 1);
    assert.equal(page.clear.hidden, false);
  });
}

test("사진 주소가 실패하면 다시 시도가 같은 바이트와 질문으로 처음부터 다시 한다", async () => {
  const requests = [];
  let online = false;
  const page = loadChat(serving({
    [photoPath]: () => (online ? ok(unmatchedPhoto("가상관 101호")) : refused(503)),
    [textPath]: ok(campusAnswer),
  }, requests));

  await sendFrom(page, { question: "여기 어디야?", file: photo() });

  assert.deepEqual(paths(requests), [photoPath]);
  assert.equal(page.transcript.querySelectorAll(".reading").length, 0);
  const error = only(page.transcript.querySelectorAll(".error"), "error");
  assert.equal(text(byTag(error, "p")[0]), "서버가 사진을 처리하지 못했어요.");

  online = true;
  only(error.querySelectorAll(".retry"), "retry button").listeners.get("click")({});
  await setImmediate();

  assert.deepEqual(paths(requests), [photoPath, photoPath, textPath]);
  assert.equal(requests[1].body, requests[0].body);
  assert.equal(sentText(requests[2]).question, "여기 어디야?");
  assert.equal(readTextAnswer(page).answer, "가상관은 정문 옆 건물입니다.");
});
