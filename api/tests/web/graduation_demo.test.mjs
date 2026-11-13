// 졸업 체크 화면 테스트. 브라우저와 서버를 띄우지 않고, 가짜 화면 객체와 가짜 서버 요청 함수(fetch)로
// chat.js를 그대로 실행한다. 숫자·이름·주소는 모두 가상 값이다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../../app/chat_web/assets/chat.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../app/chat_web/assets/chat.css", import.meta.url), "utf8");

// 390px 화면에서 링크 안의 낭독용 글자가 표 밖으로 뻗어 페이지 폭이 621px로 늘어난 적이 있다(#41).
// 배치 자체는 브라우저에서 확인하고, 여기서는 그 원인을 막는 선언이 빠지지 않았는지만 본다.
test("근거 링크가 낭독용 글자의 위치 기준이 되고, 표는 자기 영역 안에서만 가로로 스크롤된다", () => {
  const declarations = selector => {
    const rules = [...styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selectors]) => selectors.split(",").some(part => part.trim() === selector));
    return rules.map(([, , body]) => body.replace(/\/\*.*?\*\//gs, "")).join(";");
  };

  assert.match(declarations(".sr-only"), /position:\s*absolute/);
  assert.match(declarations(".graduation .source-link"), /position:\s*relative/);
  assert.match(declarations(".evidence .source-link"), /position:\s*relative/);
  assert.match(declarations(".table-scroll"), /overflow-x:\s*auto/);
});

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
  // 예전 안내 상자의 버튼은 없어졌다(#61). 첫 화면에 남은 「내 졸업 체크 보기」 버튼으로 같은 동작을 확인한다.
  const button = new FakeElement("button");
  button.dataset = { action: "graduation" };
  runInNewContext(script, {
    document: {
      addEventListener() {},
      querySelector(selector) {
        if (!elements.has(selector)) {
          elements.set(selector, new FakeElement(selector));
          if (selector === "#demo-students") elements.get(selector).hidden = true;
        }
        return elements.get(selector);
      },
      querySelectorAll: selector => (selector === "[data-action]" ? [button] : []),
      createElement: tag => new FakeElement(tag),
      createTextNode: value => value,
    },
    window: { matchMedia: () => ({ matches: false }) },
    URL,
    AbortSignal: { timeout: () => undefined },
    fetch: (path, options) => path === "/api/v1/demo-students"
      ? Promise.resolve({ ok: true, json: async () => ({ students: [
        { id: "demo-d02", label: "가상 학생 D02", scenario: "졸업 요건에 가까움", is_fictional: true },
      ] }) })
      : fetch(path, options),
  }, { filename: "chat.js" });

  const page = {
    login: elements.get("#demo-login"),
    studentList: elements.get("#demo-student-list"),
    transcript: elements.get("#transcript"),
    empty: elements.get("#empty"),
    button,
    reset: elements.get("#reset"),
    composer: elements.get("#composer"),
    input: elements.get("#question"),
    status: elements.get("#status"),
  };
  page.transcript.append(page.empty);
  return page;
}

function click(node) {
  node.listeners.get("click")({});
}

async function selectStudent(page) {
  if (page.selected) return;
  click(page.login);
  await setImmediate();
  click(page.studentList.children[0]);
  page.selected = true;
}

async function pressCheck(page) {
  await selectStudent(page);
  click(page.button);
  await setImmediate();
}

function serving(payload, requests = []) {
  return async (path, options = {}) => {
    requests.push([path, options.method ?? "GET"]);
    return { ok: true, json: async () => payload };
  };
}

async function shown(payload) {
  const page = loadChat(serving(payload));
  await pressCheck(page);
  return page;
}

function readRows(page) {
  const tables = byTag(page.transcript, "table");
  assert.equal(tables.length, 1, "expected exactly one result table");
  const [tbody] = byTag(tables[0], "tbody");
  return tbody.children.map(row => {
    const [name, state, amount, note, basis] = row.children;
    assert.equal(row.children.length, 5);
    return {
      kind: row.className,
      label: text(name),
      status: text(state),
      amount: text(amount),
      note: note.children.map(text),
      basis: basis.children.filter(child => child.tagName === "p").map(text),
      links: byTag(basis, "a"),
    };
  });
}

function assertErrorInsteadOfTable(page) {
  assert.equal(byTag(page.transcript, "table").length, 0);
  const errors = page.transcript.querySelectorAll(".error");
  assert.equal(errors.length, 1);
  assert.match(text(errors[0]), /졸업 체크 결과를 받지 못했어요\./);
}

const fictionalBasis = {
  applied_rule: "가상 기준",
  source_title: "가상 기준 문서 1쪽",
  source_url: "https://example.invalid/rules#page=1",
  checked_on: "2026-01-01",
};
const unconfirmedBasis = { applied_rule: "가상 기준", source_title: null, source_url: null, checked_on: null };

function entry(id, label, status, fields = {}) {
  return {
    id,
    label,
    status,
    current: null,
    required: null,
    shortfall: null,
    reason: null,
    basis: unconfirmedBasis,
    ...fields,
  };
}

// 이슈 #40의 「응답 형식」에 고정한 예시 그대로다.
const issueExample = {
  profile: {
    id: "demo-d02",
    label: "가상 학생 T01",
    department: "컴퓨터공학전공",
    admission_year: 2023,
    admission_type: "일반 신입학",
    track: "주전공 단일",
    is_fictional: true,
  },
  items: [
    {
      id: "total_credits",
      label: "학점",
      status: "short",
      current: null,
      required: null,
      shortfall: "세부 1건 부족",
      reason: null,
      basis: { applied_rule: "가상 기준", source_title: null, source_url: null, checked_on: null },
      details: [
        {
          id: "major",
          label: "전공",
          status: "short",
          current: "70학점",
          required: "75학점",
          shortfall: "5학점 부족",
          reason: null,
          basis: {
            applied_rule: "가상 기준",
            source_title: "가상 기준 문서 1쪽",
            source_url: "https://example.invalid/rules#page=1",
            checked_on: "2026-01-01",
          },
        },
      ],
    },
  ],
};

// 세 상위 항목이 각각 부족·충족·확인 필요인 가상 응답.
const threeItems = {
  profile: issueExample.profile,
  items: [
    entry("total_credits", "학점", "short", {
      shortfall: "세부 1건 부족",
      details: [
        entry("credits_total", "총학점", "met", { current: "40학점", required: "40학점", basis: fictionalBasis }),
        entry("msc", "수학·기초과학", "needs_check", { reason: "가상 기준값 확인 전" }),
        entry("major", "전공", "short", {
          current: "70학점",
          required: "75학점",
          shortfall: "5학점 부족",
          basis: fictionalBasis,
        }),
      ],
    }),
    entry("major_required", "전공필수", "met", {
      details: [
        entry("required_courses", "필수 과목", "met", { current: "3과목", required: "3과목" }),
        entry("thesis", "졸업논문", "met", { current: "합격", required: "합격" }),
      ],
    }),
    entry("extracurricular", "비교과", "needs_check", {
      reason: "세부 1건 확인 필요",
      details: [
        entry("mileage", "마일리지", "needs_check", { reason: "가상 잔여 학기 기록 없음" }),
      ],
    }),
  ],
};

test("버튼 한 번에 요청 한 번을 보내고, 이슈의 예시 응답을 상위 행과 세부 행으로 그린다", async () => {
  const requests = [];
  const page = loadChat(serving(issueExample, requests));
  await pressCheck(page);

  assert.deepEqual(requests, [["/api/v1/graduation-demo?student_id=demo-d02", "GET"]]);
  assert.equal(page.transcript.children.includes(page.empty), false);

  const [caption] = byTag(page.transcript, "caption");
  assert.equal(text(caption), "가상 학생 T01 · 컴퓨터공학전공 · 2023학년도 입학 · 일반 신입학 · 주전공 단일");
  const headers = byTag(byTag(page.transcript, "thead")[0], "th");
  assert.deepEqual(headers.map(text), ["항목", "상태", "현재 / 기준", "부족·확인할 점", "적용 근거"]);
  assert.ok(headers.every(header => header.scope === "col"));

  const [item, detail] = readRows(page);
  assert.deepEqual(
    { ...item, links: item.links.length },
    { kind: "item", label: "학점", status: "부족", amount: "—", note: ["세부 1건 부족"], basis: ["가상 기준"], links: 0 },
  );
  assert.deepEqual(
    { ...detail, links: detail.links.length },
    {
      kind: "detail",
      label: "전공",
      status: "부족",
      amount: "70학점 / 75학점",
      note: ["5학점 부족"],
      basis: ["가상 기준", "가상 기준 문서 1쪽", "확인일 2026-01-01"],
      links: 1,
    },
  );

  const [link] = detail.links;
  assert.equal(link.attributes.get("href"), "https://example.invalid/rules#page=1");
  assert.equal(link.target, "_blank");
  assert.equal(link.rel, "noopener noreferrer");
  assert.equal(text(link), "공식 근거 보기 (전공 근거, 새 탭에서 열림)");
  assert.equal(page.button.disabled, false);
  assert.equal(page.status.textContent, "");
});

test("세 상위 항목과 세부 행을 받은 순서대로, 세 상태와 세부 부족량을 함께 보여 준다", async () => {
  const rows = readRows(await shown(threeItems));

  assert.deepEqual(rows.map(row => [row.kind, row.label, row.status]), [
    ["item", "학점", "부족"],
    ["detail", "총학점", "충족"],
    ["detail", "수학·기초과학", "확인 필요"],
    ["detail", "전공", "부족"],
    ["item", "전공필수", "충족"],
    ["detail", "필수 과목", "충족"],
    ["detail", "졸업논문", "충족"],
    ["item", "비교과", "확인 필요"],
    ["detail", "마일리지", "확인 필요"],
  ]);
  assert.deepEqual(rows[1].note, []);
  assert.equal(rows[1].amount, "40학점 / 40학점");
  assert.deepEqual(rows[3].note, ["5학점 부족"]);
  assert.deepEqual(rows[7].note, ["세부 1건 확인 필요"]);
});

test("상위 항목이 부족이어도 세부 행의 확인 필요와 이유는 그대로 보인다", async () => {
  const rows = readRows(await shown(threeItems));

  assert.equal(rows[0].status, "부족");
  assert.equal(rows[2].status, "확인 필요");
  assert.deepEqual(rows[2].note, ["가상 기준값 확인 전"]);
  assert.deepEqual(rows[2].basis, ["가상 기준"]);
});

test("모르는 status 값은 확인 필요로 표시한다", async () => {
  const unknown = ["done", "MET", "constructor", "", null, 7];
  const items = unknown.map((status, index) => entry(`unknown_${index}`, `가상 항목 ${index}`, status));
  const { status: _dropped, ...missing } = entry("unknown_missing", "가상 항목 누락", null);
  const rows = readRows(await shown({ profile: issueExample.profile, items: [...items, missing] }));

  assert.equal(rows.length, unknown.length + 1);
  for (const row of rows) {
    assert.equal(row.status, "확인 필요", row.label);
    assert.deepEqual(row.note, ["확인이 필요해요."], row.label);
  }
});

for (const [label, details] of [
  ["필드 없음", undefined],
  ["null", null],
  ["문자열", "가상 문자열"],
  ["객체", { id: "major" }],
]) {
  test(`details가 배열이 아니면(${label}) 상위 행만 보여 준다`, async () => {
    const item = entry("total_credits", "학점", "short", { shortfall: "세부 1건 부족" });
    if (details !== undefined) item.details = details;
    const rows = readRows(await shown({ profile: issueExample.profile, items: [item] }));

    assert.deepEqual(rows.map(row => [row.kind, row.label, row.status]), [["item", "학점", "부족"]]);
    assert.deepEqual(rows[0].note, ["세부 1건 부족"]);
  });
}

for (const [label, sourceUrl] of [
  ["주소 없음", null],
  ["빈 문자열", ""],
  ["HTTP 주소", "http://example.invalid/rules"],
  ["JavaScript 주소", "javascript:alert(1)"],
  ["계정 정보가 든 주소", "https://user:pass@example.invalid/rules"],
  ["공백이 든 주소", "https://example.invalid/rules "],
  ["상대 경로", "/rules"],
]) {
  test(`${label}이면 링크만 숨기고 근거 문구는 남긴다`, async () => {
    const detail = entry("major", "전공", "met", { basis: { ...fictionalBasis, source_url: sourceUrl } });
    const item = entry("total_credits", "학점", "met", { details: [detail] });
    const [, row] = readRows(await shown({ profile: issueExample.profile, items: [item] }));

    assert.equal(row.links.length, 0);
    assert.deepEqual(row.basis, ["가상 기준", "가상 기준 문서 1쪽", "확인일 2026-01-01"]);
  });
}

test("basis가 없어도 행을 그리고 적용 기준 확인 전이라고 적는다", async () => {
  const item = entry("total_credits", "학점", "met", { basis: null });
  const [row] = readRows(await shown({ profile: issueExample.profile, items: [item] }));

  assert.deepEqual(row.basis, ["적용 기준 확인 전"]);
  assert.equal(row.links.length, 0);
});

test("서버 값은 글자 그대로 넣고 HTML로 해석하지 않는다", async () => {
  const markup = "<img src=x onerror=alert(1)>";
  const item = entry("total_credits", markup, "short", {
    current: markup,
    required: markup,
    shortfall: markup,
    reason: markup,
    basis: { applied_rule: markup, source_title: markup, source_url: null, checked_on: markup },
  });
  const page = await shown({ profile: { id: "demo-d02", label: markup }, items: [item] });
  const [row] = readRows(page);

  assert.equal(text(byTag(page.transcript, "caption")[0]), markup);
  assert.equal(row.label, markup);
  assert.equal(row.amount, `${markup} / ${markup}`);
  assert.deepEqual(row.note, [markup, markup]);
  assert.deepEqual(row.basis, [markup, markup, `확인일 ${markup}`]);
  assert.equal(byTag(page.transcript, "img").length, 0);
});

test("서버가 오류 응답을 주면 표 대신 오류 문구를 보여 주고, 다시 시도하면 표가 나온다", async () => {
  const requests = [];
  let ok = false;
  const page = loadChat(async path => {
    requests.push(path);
    return { ok, json: async () => threeItems };
  });
  await pressCheck(page);

  assertErrorInsteadOfTable(page);
  assert.equal(page.button.disabled, false);

  ok = true;
  const [retry] = page.transcript.querySelectorAll(".retry");
  click(retry);
  await setImmediate();

  assert.deepEqual(requests, ["/api/v1/graduation-demo?student_id=demo-d02", "/api/v1/graduation-demo?student_id=demo-d02"]);
  assert.equal(page.transcript.querySelectorAll(".error").length, 0);
  assert.equal(readRows(page).length, 9);
});

test("서버에 연결하지 못하면 표 대신 오류 문구를 보여 준다", async () => {
  const page = loadChat(async () => {
    throw new TypeError("fictional network failure");
  });
  await pressCheck(page);

  assertErrorInsteadOfTable(page);
  assert.equal(page.button.disabled, false);
});

for (const [label, payload] of [
  ["items 없음", { profile: issueExample.profile }],
  ["빈 items", { profile: issueExample.profile, items: [] }],
  ["배열이 아닌 items", { profile: issueExample.profile, items: "가상 문자열" }],
  ["객체가 아닌 항목", { profile: issueExample.profile, items: [null] }],
  ["객체가 아닌 세부 행", { profile: issueExample.profile, items: [entry("a", "학점", "met", { details: [7] })] }],
  ["배열인 항목", { profile: issueExample.profile, items: [[]] }],
  ["배열인 세부 행", { profile: issueExample.profile, items: [entry("a", "학점", "met", { details: [[]] })] }],
  ["null 본문", null],
]) {
  test(`응답 형식이 어긋나면(${label}) 반쯤 그린 표 대신 오류 문구를 보여 준다`, async () => {
    assertErrorInsteadOfTable(await shown(payload));
  });
}

test("질문을 보내는 중에는 졸업 체크 버튼이 눌리지 않는다", async () => {
  const requests = [];
  let answer;
  const page = loadChat((path, options = {}) => {
    requests.push(path);
    if (path === "/api/v1/chat") return new Promise(resolve => { answer = resolve; });
    return serving(threeItems)(path, options);
  });

  await selectStudent(page);
  page.input.value = "가상 질문";
  page.composer.listeners.get("submit")({ preventDefault() {} });
  assert.equal(page.button.disabled, true);
  await pressCheck(page);
  assert.deepEqual(requests, ["/api/v1/chat"]);
  assert.equal(byTag(page.transcript, "table").length, 0);

  answer({ ok: true, json: async () => ({ session_id: "fictional-session", answered: false }) });
  await setImmediate();
  assert.equal(page.button.disabled, false);
  await pressCheck(page);
  assert.deepEqual(requests, ["/api/v1/chat", "/api/v1/graduation-demo?student_id=demo-d02"]);
  assert.equal(readRows(page).length, 9);
});

test("결과를 기다리는 동안 다시 눌러도 요청은 한 번이고, 질문도 보내지 않는다", async () => {
  const requests = [];
  let respond;
  const page = loadChat(path => {
    requests.push(path);
    return new Promise(resolve => { respond = resolve; });
  });

  await selectStudent(page);
  click(page.button);
  assert.equal(page.button.disabled, true);
  assert.equal(page.reset.disabled, true);
  assert.equal(page.status.textContent, "졸업 체크 결과를 불러오는 중…");
  click(page.button);
  page.input.value = "가상 질문";
  page.composer.listeners.get("submit")({ preventDefault() {} });
  click(page.reset);
  await setImmediate();
  assert.deepEqual(requests, ["/api/v1/graduation-demo?student_id=demo-d02"]);

  respond({ ok: true, json: async () => threeItems });
  await setImmediate();
  assert.equal(readRows(page).length, 9);
});

test("다시 누르면 이전 결과 표를 새 표로 바꾼다", async () => {
  const requests = [];
  const page = loadChat(serving(threeItems, requests));
  await pressCheck(page);
  await pressCheck(page);

  assert.equal(requests.length, 2);
  assert.equal(page.transcript.children.length, 1);
  assert.equal(readRows(page).length, 9);
});

// ── 교내 비교과 시스템(BISKIT) 추천 카드 (#43) ──────────────────────────────────────────
// 프로그램 이름·주소·점수는 모두 가상 값이다. 화면은 주소가 학교 것인지 따지지 않고(서버 몫)
// 안전한 HTTPS인지만 다시 본다.

function program(title, fields = {}) {
  return {
    title,
    audience: "가상 재학생",
    eligibility: "eligible",
    apply_until: "2026-11-26",
    deadline_status: "open",
    event_on: null,
    mileage_status: "undisclosed",
    mileage_points: null,
    notice_url: "https://notice.example.invalid/view?articleNo=1",
    application_url: null,
    login_required: true,
    ...fields,
  };
}

function recommending(programs, fields = {}) {
  return {
    shortfall_points: 20,
    listed_on: "2026-11-13",
    evaluated_at: "2026-11-13T09:00:00+09:00",
    portal_url: "https://portal.example.invalid/",
    programs,
    ...fields,
  };
}

const d02Items = [
  entry("extracurricular", "비교과", "short", {
    shortfall: "세부 2건 부족",
    details: [
      entry("mileage", "마일리지", "short", { current: "480점", required: "500점", shortfall: "20점 부족" }),
      entry("career_counseling", "취업진로상담", "short", { current: "3회", required: "4회", shortfall: "1회 부족" }),
    ],
  }),
];

function d02(recommendations) {
  const payload = { profile: { ...issueExample.profile, label: "가상 학생 D02" }, items: d02Items };
  if (recommendations !== undefined) payload.biskit_recommendations = recommendations;
  return payload;
}

const d02Programs = [
  program("가상 진로 설명회", { apply_until: "2026-11-20", event_on: "2026-11-23" }),
  program("2027년 가상 해외 설명회", { audience: "가상 재학생·졸업생", apply_until: "2026-11-22", event_on: "2026-11-23" }),
  program("가상 학습법 특강", { audience: "가상 학부 재학생", mileage_status: "announced" }),
];

function readBiskit(page) {
  const sections = page.transcript.querySelectorAll(".biskit");
  assert.equal(sections.length, 1, "expected exactly one recommendation section");
  const [section] = sections;
  return {
    section,
    heading: text(byTag(section, "h3")[0]),
    listed: text(section.querySelectorAll(".source")[0]),
    portal: section.children.filter(child => child.tagName === "a"),
    cards: section.querySelectorAll(".program").map(card => ({
      title: text(byTag(card, "h4")[0]),
      when: text(card.querySelectorAll(".when")[0]),
      checks: card.querySelectorAll(".badge").map(text),
      mileage: text(card.querySelectorAll(".mileage")[0]),
      hints: card.querySelectorAll(".hint").map(text),
      links: byTag(card, "a"),
    })),
  };
}

function assertTableWithoutBiskit(page) {
  assert.equal(page.transcript.querySelectorAll(".biskit").length, 0);
  assert.equal(page.transcript.querySelectorAll(".error").length, 0);
  const rows = readRows(page);
  assert.deepEqual(rows.map(row => [row.label, row.amount, row.note]), [
    ["비교과", "—", ["세부 2건 부족"]],
    ["마일리지", "480점 / 500점", ["20점 부족"]],
    ["취업진로상담", "3회 / 4회", ["1회 부족"]],
  ]);
}

test("버튼 한 번에 요청 한 번으로 D02의 졸업 표와 추천 카드가 함께 나온다", async () => {
  const requests = [];
  const page = loadChat(serving(d02(recommending(d02Programs)), requests));
  await pressCheck(page);

  assert.deepEqual(requests, [["/api/v1/graduation-demo?student_id=demo-d02", "GET"]]);
  const rows = readRows(page);
  assert.equal(rows[1].amount, "480점 / 500점");
  assert.deepEqual(rows[1].note, ["20점 부족"]);
  assert.equal(rows[2].amount, "3회 / 4회");
  assert.deepEqual(rows[2].note, ["1회 부족"]);

  const biskit = readBiskit(page);
  assert.equal(biskit.heading, "BISKIT 추천 · 20점 부족");
  assert.equal(biskit.listed, "목록 확인 2026년 11월 13일 · 접수 상태와 정원은 공식 페이지에서 확인");
  assert.deepEqual(biskit.cards.map(card => [card.title, card.when, card.mileage]), [
    ["가상 진로 설명회", "가상 재학생 · 신청 11월 20일까지 · 행사 2026년 11월 23일", "마일리지 미공개"],
    [
      "2027년 가상 해외 설명회",
      "가상 재학생·졸업생 · 신청 11월 22일까지 · 행사 2026년 11월 23일",
      "마일리지 미공개",
    ],
    ["가상 학습법 특강", "가상 학부 재학생 · 신청 11월 26일까지", "마일리지 지급 공지 · 정확한 점수 확인 필요"],
  ]);
  for (const card of biskit.cards) {
    assert.deepEqual(card.checks, [], card.title);
    assert.deepEqual(card.hints, ["BISKIT 로그인 후 프로그램명으로 검색"], card.title);
    assert.equal(card.links.length, 1, card.title);
  }

  const [notice] = biskit.cards[2].links;
  assert.equal(notice.attributes.get("href"), "https://notice.example.invalid/view?articleNo=1");
  assert.equal(notice.target, "_blank");
  assert.equal(notice.rel, "noopener noreferrer");
  assert.equal(text(notice), "공식 공지 보기 (가상 학습법 특강, 새 탭에서 열림)");
  assert.equal(biskit.portal.length, 1);
  assert.equal(biskit.portal[0].attributes.get("href"), "https://portal.example.invalid/");

  // 추천 영역은 표 아래, 같은 답변 안에 놓인다.
  const [reply] = page.transcript.querySelectorAll(".reply");
  assert.equal(reply.children.at(-1), biskit.section);
  assert.equal(reply.children[0].className, "table-scroll");
});

test("점수는 공개된 정수만 N점으로 쓰고, 지급 공지와 미공개를 구분하며 합산하지 않는다", async () => {
  const page = await shown(d02(recommending([
    program("가상 공개", { mileage_status: "published", mileage_points: 40 }),
    program("가상 지급 공지", { mileage_status: "announced", mileage_points: 40 }),
    program("가상 미공개", { mileage_status: "undisclosed", mileage_points: 40 }),
    program("가상 모르는 값", { mileage_status: "constructor", mileage_points: 40 }),
    program("가상 값 없음", { mileage_status: null }),
    program("가상 점수 누락", { mileage_status: "published", mileage_points: null }),
    program("가상 점수 글자", { mileage_status: "published", mileage_points: "40" }),
    program("가상 점수 0", { mileage_status: "published", mileage_points: 0 }),
  ])));
  const biskit = readBiskit(page);

  assert.deepEqual(biskit.cards.map(card => card.mileage), [
    "마일리지 40점",
    "마일리지 지급 공지 · 정확한 점수 확인 필요",
    "마일리지 미공개",
    "마일리지 미공개",
    "마일리지 미공개",
    "마일리지 미공개",
    "마일리지 미공개",
    "마일리지 미공개",
  ]);
  assert.equal(biskit.heading, "BISKIT 추천 · 20점 부족");
  assert.doesNotMatch(text(biskit.section), /충족|채울|합계|80점/);
});

test("대상이나 마감이 확인됨이 아니면 카드에 확인 필요를 붙인다", async () => {
  const page = await shown(d02(recommending([
    program("가상 확인됨"),
    program("가상 대상 미확인", { eligibility: "needs_check" }),
    program("가상 마감 당일", { deadline_status: "needs_check" }),
    program("가상 둘 다", { eligibility: "needs_check", deadline_status: "needs_check" }),
    program("가상 모르는 값", { eligibility: "ELIGIBLE", deadline_status: null }),
    program("가상 마감일 없음", { apply_until: null }),
  ])));
  const { cards } = readBiskit(page);

  assert.deepEqual(cards.map(card => card.checks), [
    [],
    ["대상 확인 필요"],
    ["마감 시각 확인 필요"],
    ["대상 확인 필요", "마감 시각 확인 필요"],
    ["대상 확인 필요", "마감 시각 확인 필요"],
    [],
  ]);
  assert.equal(cards[5].when, "가상 재학생 · 신청 마감 확인 필요");
});

for (const [label, url] of [
  ["주소 없음", null],
  ["빈 문자열", ""],
  ["HTTP 주소", "http://notice.example.invalid/view"],
  ["JavaScript 주소", "javascript:alert(1)"],
  ["계정 정보가 든 주소", "https://user:pass@notice.example.invalid/view"],
  ["공백이 든 주소", "https://notice.example.invalid/view "],
  ["상대 경로", "/view"],
]) {
  test(`추천 카드의 주소가 ${label}이면 링크만 숨기고 나머지 내용은 남긴다`, async () => {
    const page = await shown(d02(recommending(
      [
        program("가상 로그인 필요", { notice_url: url, application_url: url, event_on: "2026-11-23" }),
        program("가상 로그인 불필요", { notice_url: url, application_url: url, login_required: false }),
      ],
      { portal_url: url },
    )));
    const biskit = readBiskit(page);
    const [login, open] = biskit.cards;

    assert.equal(byTag(biskit.section, "a").length, 0);
    assert.deepEqual(login.hints, ["공식 공지 확인 필요", "BISKIT 로그인 후 프로그램명으로 검색"]);
    assert.deepEqual(open.hints, ["공식 공지 확인 필요"]);
    assert.equal(login.title, "가상 로그인 필요");
    assert.equal(login.when, "가상 재학생 · 신청 11월 26일까지 · 행사 2026년 11월 23일");
    assert.equal(login.mileage, "마일리지 미공개");
    assert.equal(readRows(page).length, 3);
  });
}

test("확인된 신청 주소가 오면 주소 그대로 신청 링크를 붙이고, 로그인이 필요하면 눈에 보이게 적는다", async () => {
  const loginPath = "https://apply.example.invalid/login?next=%2Fprograms%2F1";
  const page = await shown(d02(recommending([
    program("가상 로그인 경로", { application_url: loginPath, login_required: true }),
    program("가상 바로 신청", { application_url: "https://apply.example.invalid/programs/2", login_required: false }),
  ])));
  const [login, open] = readBiskit(page).cards;

  assert.deepEqual(login.links.map(link => link.attributes.get("href")), [
    "https://notice.example.invalid/view?articleNo=1",
    loginPath,
  ]);
  assert.equal(text(login.links[1]), "신청 페이지 열기 (가상 로그인 경로, 새 탭에서 열림)");
  assert.deepEqual(login.hints, ["BISKIT 로그인 필요"]);

  assert.equal(open.links.length, 2);
  assert.deepEqual(open.hints, []);
});

test("추천 목록이 비면 안내 문구와 BISKIT 링크를 보여 준다", async () => {
  const page = await shown(d02(recommending([])));
  const biskit = readBiskit(page);

  assert.equal(biskit.heading, "BISKIT 추천 · 20점 부족");
  assert.deepEqual(biskit.cards, []);
  assert.deepEqual(biskit.section.querySelectorAll(".none").map(text), ["지금 신청할 수 있는 프로그램을 확인하지 못했어요"]);
  assert.equal(biskit.portal.length, 1);
  assert.equal(biskit.portal[0].attributes.get("href"), "https://portal.example.invalid/");
  assert.equal(text(biskit.portal[0]), "BISKIT 열기 (교내 비교과 시스템, 새 탭에서 열림)");
  assert.equal(readRows(page).length, 3);
});

for (const [label, recommendations] of [
  ["항목 없음", undefined],
  ["null", null],
  ["문자열", "가상 문자열"],
  ["배열", []],
  ["부족 점수 없음", recommending(d02Programs, { shortfall_points: undefined })],
  ["부족 점수 0", recommending(d02Programs, { shortfall_points: 0 })],
  ["부족 점수 글자", recommending(d02Programs, { shortfall_points: "20점 부족" })],
  ["부족 점수 소수", recommending(d02Programs, { shortfall_points: 19.5 })],
  ["배열이 아닌 programs", recommending("가상 문자열")],
  ["programs 없음", recommending(undefined)],
  ["객체가 아닌 프로그램", recommending([d02Programs[0], null])],
  ["배열인 프로그램", recommending([[]])],
  ["제목 없는 프로그램", recommending([program(null)])],
  ["제목이 숫자인 프로그램", recommending([program(123)])],
  [
    "로그인 여부가 글자인 프로그램",
    recommending([program("가상 글자 값", { application_url: "https://apply.example.invalid/login", login_required: "true" })]),
  ],
  ["로그인 여부가 숫자인 프로그램", recommending([d02Programs[0], program("가상 숫자 값", { login_required: 1 })])],
  ["로그인 여부가 null인 프로그램", recommending([program("가상 null 값", { login_required: null })])],
  ["로그인 여부가 없는 프로그램", recommending([program("가상 값 누락", { login_required: undefined })])],
  ["제목이 빈 글자인 프로그램", recommending([d02Programs[0], program("  ")])],
]) {
  test(`biskit_recommendations가 ${label}이면 추천 영역만 빼고 표는 그대로 그린다`, async () => {
    assertTableWithoutBiskit(await shown(d02(recommendations)));
  });
}

test("추천 카드도 서버 값을 글자 그대로 넣고 HTML로 해석하지 않는다", async () => {
  const markup = "<img src=x onerror=alert(1)>";
  const page = await shown(d02(recommending(
    [program(markup, { audience: markup, apply_until: markup, event_on: markup })],
    { listed_on: markup },
  )));
  const biskit = readBiskit(page);

  assert.equal(biskit.listed, `목록 확인 ${markup} · 접수 상태와 정원은 공식 페이지에서 확인`);
  assert.equal(biskit.cards[0].title, markup);
  assert.equal(biskit.cards[0].when, `${markup} · 신청 ${markup}까지 · 행사 ${markup}`);
  assert.equal(text(biskit.cards[0].links[0]), `공식 공지 보기 (${markup}, 새 탭에서 열림)`);
  assert.equal(byTag(page.transcript, "img").length, 0);
});

test("다시 누르면 추천 영역도 하나만 남고, 새 대화를 누르면 카드까지 지워진다", async () => {
  const page = await shown(d02(recommending(d02Programs)));
  await pressCheck(page);
  assert.equal(readBiskit(page).cards.length, 3);
  assert.equal(page.transcript.children.length, 1);

  click(page.reset);

  assert.equal(page.transcript.querySelectorAll(".biskit").length, 0);
  assert.equal(page.transcript.querySelectorAll(".program").length, 0);
  assert.equal(byTag(page.transcript, "table").length, 0);
  assert.deepEqual(page.transcript.children, [page.empty]);
});

test("새 대화를 누르면 결과 표도 지워진다", async () => {
  const page = await shown(threeItems);
  assert.equal(byTag(page.transcript, "table").length, 1);

  click(page.reset);

  assert.equal(byTag(page.transcript, "table").length, 0);
  assert.equal(page.transcript.children.length, 1);
  assert.equal(page.transcript.children[0], page.empty);

  await pressCheck(page);
  assert.equal(readRows(page).length, 9);
});
