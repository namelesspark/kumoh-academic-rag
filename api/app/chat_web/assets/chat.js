const topics = document.querySelector("#topics");
const examples = topics.querySelectorAll("[data-question]");
const transcript = document.querySelector("#transcript");
const empty = document.querySelector("#empty");
const composer = document.querySelector("#composer");
const input = document.querySelector("#question");
const send = document.querySelector("#send");
const reset = document.querySelector("#reset");
const statusLine = document.querySelector("#status");
// 테크모 펫. 자세와 상태는 펫 줄(#pet-dock)에, 한 줄 말과 대기 점은 말풍선에 붙인다.
const assistant = document.querySelector("#pet-dock");
const assistantLine = document.querySelector("#pet-line");
const assistantDots = document.querySelector("#pet-dots");
const pet = document.querySelector("#pet");
// 첫 화면의 버튼과 카드. 요청 중에는 함께 잠근다. 펫은 여기에 들지 않아 요청 중에도 눌린다.
const landingControls = [...(document.querySelectorAll?.("[data-action]") ?? [])];
const featureCards = [...(document.querySelectorAll?.("[data-feature]") ?? [])];
const featurePanels = [...(document.querySelectorAll?.("[data-panel]") ?? [])];
const featureList = document.querySelector("#feature-cards");
const photoFile = document.querySelector("#photo-file");
const photoClear = document.querySelector("#photo-clear");
const photoNote = document.querySelector("#photo-note");
const compact = window.matchMedia("(max-width: 680px)");

// 첨부 사진 제한. 서버도 같은 제한으로 다시 검사하므로, 여기서는 보내기 전에 알려 주는 역할만 한다.
const photoTypes = ["image/jpeg", "image/png"];
const photoMaxBytes = 5_000_000;
// 글자 주소(/photo-question)가 받는 판독문 길이 한도. 서버처럼 글자 수(코드 포인트)로 센다.
const recognizedMaxChars = 2_000;
const photoRejections = {
  413: "사진이 5MB를 넘어요. 더 작은 사진으로 다시 올려 주세요.",
  415: "JPEG나 PNG 사진만 읽을 수 있어요.",
  422: "사진을 열 수 없거나 화소 수가 1,200만을 넘어요. 다른 사진으로 다시 올려 주세요.",
};
const posterClues = { text: "사진 글자", qr_notice: "공지 QR", qr_program: "BISKIT 프로그램 QR" };
const photoNeedsCheck = {
  no_readable_clue: "사진에서 읽을 수 있는 글자나 QR을 찾지 못했어요. 글자가 또렷하게 보이게 다시 찍어 주세요.",
  ambiguous_event: "사진만으로는 어느 행사인지 하나로 정하지 못했어요. 제목과 날짜가 함께 보이거나 QR이 보이는 사진으로 다시 시도해 주세요.",
  text_reader_unavailable: "지금은 서버가 사진 속 글자를 읽을 수 없어요. QR이 보이는 사진으로 다시 시도하거나 글자를 직접 적어 주세요.",
};
const photoMessages = {
  reading: "사진에서 글자를 읽는 중…",
  asking: "읽은 글자로 답을 찾는 중…",
  disconnected: "서버에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.",
  photoFailed: "서버가 사진을 처리하지 못했어요.",
  textFailed: "서버가 읽은 글자로 답을 만들지 못했어요.",
  textRejected: "서버가 이 글자를 받지 않았어요. 질문과 읽은 글자를 고친 뒤 다시 물어 주세요.",
  tooLong: "읽은 글자가 2,000자를 넘어요. 필요한 부분만 남기고 줄인 뒤 다시 물어 주세요.",
  nothingToAsk: "질문이나 읽은 글자를 적은 뒤 다시 물어 주세요.",
  nothingRead: "사진에서 읽은 글자가 없어요. 글자를 직접 적거나 질문을 함께 보내 주세요.",
  held: "근거가 충분하지 않아 답변을 보류했어요. 읽은 글자를 고치거나 질문을 더 구체적으로 적어 다시 물어 주세요.",
  noLink: "확인하지 못한 내용에는 링크를 붙이지 않아요. 학교 공지에서 직접 찾아 주세요.",
};
// 글자 주소가 답을 실어 보내는 종류. 행사(event)와 보류(hold)는 따로 그린다.
const textAnswerKinds = { regulation: "규정 검색", campus: "캠퍼스 안내" };
const posterStates = {
  open: { label: "신청 접수 중", className: "badge met" },
  closed: { label: "신청 마감", className: "badge short" },
  needs_check: { label: "신청 상태 확인 필요", className: "badge needs-check" },
};

// 서버가 보낸 status 값은 이 표에 있는 것만 인정하고, 나머지는 확인 필요로 보여 준다.
const graduationStatuses = {
  met: { label: "충족", className: "badge met" },
  short: { label: "부족", className: "badge short" },
  needs_check: { label: "확인 필요", className: "badge needs-check" },
};
const graduationColumns = ["항목", "상태", "현재 / 기준", "부족·확인할 점", "적용 근거"];

// 테크모 펫의 상태표. 상태마다 [자세, 한 줄 말]을 정한다. 자세 이름은 chat.css의 data-pose 규칙과 짝이다.
const assistantStates = {
  idle: ["guide", "궁금한 점을 물어보세요"],
  searching: ["quiet", "쉿, 찾아보는 중이에요…"],
  found: ["celebrate", "찾았어요! 함께 확인해 봐요"],
  answer: ["guide", "근거와 함께 안내해 드릴게요"],
  hold: ["quiet", "확인할 근거가 더 필요해요"],
  error: ["guide", "잠시 문제가 생겼어요. 다시 시도해 주세요"],
};
// 서버가 답변을 한 번에 보내므로, 축하를 이만큼 보여 준 뒤 답변 표시로 넘어간다.
const celebrateMs = 1_200;

let sessionId = null;
let busy = false;
let graduationTurn = null;
let assistantState = "idle";
let assistantTimer = null;
let openedCard = null;
let panelTransition = null;
let panelChange = 0;

function motionPreference() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)");
}

function reducedMotion() {
  return motionPreference()?.matches === true;
}

motionPreference()?.addEventListener?.("change", event => {
  if (event.matches) panelTransition?.skipTransition?.();
});

// 이전 전환의 늦은 콜백이 새 조작을 되돌리지 않게 순서를 확인한다.
function changeFeature(card, { animate = true, focus = true } = {}) {
  const previous = openedCard;
  const panel = featurePanels.find(node => node.dataset.panel === card?.dataset.feature);
  if (card && (!panel || !featureList)) return;
  if (animate && card === openedCard) return;
  openedCard = card;
  const change = ++panelChange;
  panelTransition?.skipTransition?.();
  panelTransition = null;
  for (const node of featureCards) node.removeAttribute("data-morph");
  const source = card ?? previous;
  let applied = false;
  const apply = () => {
    if (change !== panelChange || applied) return;
    applied = true;
    if (featureList) featureList.hidden = Boolean(card);
    for (const node of featurePanels) node.hidden = node !== panel;
    for (const node of featureCards) node.setAttribute("aria-expanded", String(node === card));
    if (["calendar", "campus"].includes(card?.dataset.feature)) void loadFeaturePanel(panel, change);
    if (focus) {
      const target = card ? panel.querySelector("[data-panel-title]") : previous;
      target?.focus();
    }
  };
  if (!animate || reducedMotion() || typeof document.startViewTransition !== "function") {
    apply();
    return;
  }
  source?.setAttribute("data-morph", "");
  const cleanup = () => {
    if (change !== panelChange) return;
    source?.removeAttribute("data-morph");
    panelTransition = null;
  };
  try {
    panelTransition = document.startViewTransition(apply);
    Promise.resolve(panelTransition.ready).catch(apply);
    Promise.resolve(panelTransition.updateCallbackDone).catch(apply);
    Promise.resolve(panelTransition.finished).then(() => {
      apply();
      cleanup();
    }, () => {
      apply();
      cleanup();
    });
  } catch {
    apply();
    cleanup();
  }
}

for (const card of featureCards) {
  card.addEventListener("click", () => changeFeature(card));
}
for (const panel of featurePanels) {
  panel.querySelector("[data-panel-close]")?.addEventListener("click", () => changeFeature(null));
  panel.addEventListener("keydown", event => {
    if (event.key !== "Escape" || panel.hidden) return;
    event.preventDefault();
    changeFeature(null);
  });
}

if (compact.matches) topics.open = false;

// 펫의 자세·말·대기 점은 여기 한 곳에서만 바꾼다. 그림 주소는 건드리지 않고 data-pose와 data-state만 바꾸므로
// 늦게 도착한 그림 로드 신호가 지금 보이는 자세를 바꾸지 못한다.
// 어느 상태로 가든 축하 뒤에 예약해 둔 전환은 먼저 취소한다.
function showAssistant(state) {
  if (assistantTimer !== null) {
    clearTimeout(assistantTimer);
    assistantTimer = null;
  }
  const [pose, line] = assistantStates[state];
  assistantState = state;
  // 같은 자세면 속성 값이 그대로라 눌렸다 튀는 움직임이 다시 돌지 않는다.
  assistant.setAttribute("data-pose", pose);
  // 상태 이름은 쉬는 자세를 평소와 답변 표시에서만 돌리려고 chat.css가 읽는다. 타이머는 쓰지 않는다.
  assistant.setAttribute("data-state", state);
  assistantLine.textContent = line;
  assistantDots.hidden = state !== "searching";
}

// 찾음: 축하를 잠깐 보여 준 뒤 답변 표시로 넘어간다. 타이머가 없는 환경에서는 바로 넘어간다.
function celebrate() {
  showAssistant("found");
  if (typeof setTimeout !== "function") {
    showAssistant("answer");
    return;
  }
  assistantTimer = setTimeout(() => {
    assistantTimer = null;
    showAssistant("answer");
  }, celebrateMs);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// 보내기 버튼과 첨부 제거 버튼은 여기 한 곳에서만 켜고 끈다. 질문이나 사진 중 하나만 있어도 보낼 수 있다.
function updateSend() {
  const attached = Boolean(photoFile.files?.length);
  send.disabled = busy || (!input.value.trim() && !attached);
  photoClear.hidden = !attached;
  photoClear.disabled = busy;
}

function setBusy(pending, message = "서버에 질문을 보내는 중…") {
  busy = pending;
  statusLine.textContent = pending ? message : "";
  reset.disabled = pending;
  for (const control of landingControls) control.disabled = pending;
  photoFile.disabled = pending;
  for (const retry of transcript.querySelectorAll(".retry")) retry.disabled = pending;
  for (const reask of transcript.querySelectorAll(".reask")) reask.disabled = pending;
  // 요청이 시작되면 찾는 중으로 바꾼다. 잠금을 풀 때는 요청이 남긴 축하·보류·오류 상태를 그대로 둔다.
  // 결과를 남기지 않고 끝난 요청이 있을 때만 평소로 돌려 대기 점이 남지 않게 한다.
  if (pending) showAssistant("searching");
  else if (assistantState === "searching") showAssistant("idle");
  updateSend();
}

// 사진 요청과 글자 요청이 이어지는 동안 잠금을 한 번만 걸고 한 번만 푼다.
async function whileBusy(message, work) {
  setBusy(true, message);
  try {
    await work();
  } finally {
    setBusy(false);
    scrollToLatest();
  }
}

function scrollToLatest() {
  transcript.scrollTop = transcript.scrollHeight;
}

function isSafeSourceUrl(value) {
  const prefix = "https://";
  if (typeof value !== "string" || /[\p{Z}\p{C}]/u.test(value)) return false;
  if (!value.toLowerCase().startsWith(prefix)) return false;

  const authority = value.slice(prefix.length).split(/[/?#]/, 1)[0];
  if (!authority || /[@\\]/.test(authority)) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && /[^.]/.test(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function citationCard(citation) {
  const card = element("section", "evidence");
  const reference = citation.document + " · " + citation.article_path;
  const date = element("time", null, citation.effective_date);
  date.dateTime = citation.effective_date;
  const dateLine = element("p", "date", "시행일 ");
  dateLine.append(date);
  card.append(
    element("h3", null, "가상 답변 근거"),
    element("p", null, reference),
    dateLine,
    element("blockquote", null, citation.snippet),
  );
  const link = sourceLink(citation.source_url, "공식 원문 보기", reference);
  if (link) card.append(link);
  return card;
}

// 안전 주소 검사를 통과한 주소만 새 탭 링크로 만든다. 통과하지 못하면 null을 돌려준다.
function sourceLink(url, label, context) {
  if (!isSafeSourceUrl(url)) return null;
  const link = element("a", "source-link", label);
  link.setAttribute("href", url);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.append(element("span", "sr-only", ` (${context}, 새 탭에서 열림)`));
  return link;
}

function shownText(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value : null;
}

function graduationBasis(basis, label) {
  const cell = element("td", "basis");
  cell.append(element("p", null, shownText(basis?.applied_rule) ?? "적용 기준 확인 전"));
  const title = shownText(basis?.source_title);
  if (title) cell.append(element("p", "source", title));
  const checkedOn = shownText(basis?.checked_on);
  if (checkedOn) {
    const line = element("p", "source", "확인일 ");
    line.append(element("time", null, checkedOn));
    cell.append(line);
  }
  const link = sourceLink(basis?.source_url, "공식 근거 보기", `${label} 근거`);
  if (link) cell.append(link);
  return cell;
}

function graduationRow(entry, className) {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    throw new TypeError("Malformed graduation item");
  }
  const known = typeof entry.status === "string" && Object.hasOwn(graduationStatuses, entry.status);
  const status = known ? entry.status : "needs_check";
  const label = shownText(entry.label) ?? "이름 없는 항목";

  const name = element("th", null, label);
  name.scope = "row";
  const state = element("td");
  state.append(element("span", graduationStatuses[status].className, graduationStatuses[status].label));

  const current = shownText(entry.current);
  const required = shownText(entry.required);
  const amount = element("td", "amount", current || required ? `${current ?? "—"} / ${required ?? "—"}` : "—");

  const note = element("td", "note");
  const shortfall = shownText(entry.shortfall);
  const reason = shownText(entry.reason);
  if (shortfall) note.append(element("p", "shortfall", shortfall));
  if (reason) note.append(element("p", null, reason));
  else if (status === "needs_check") note.append(element("p", null, "확인이 필요해요."));

  const row = element("tr", className);
  row.append(name, state, amount, note, graduationBasis(entry.basis, label));
  return row;
}

// 계산은 서버가 끝냈으므로 화면은 받은 순서대로 그리기만 한다. 세부 id는 해석하지 않는다.
function graduationResult(result) {
  if (!Array.isArray(result?.items) || !result.items.length) throw new TypeError("Malformed graduation result");

  const profile = result.profile ?? {};
  const year = shownText(profile.admission_year);
  const who = [
    shownText(profile.label),
    shownText(profile.department),
    year && `${year}학년도 입학`,
    shownText(profile.admission_type),
    shownText(profile.track),
  ].filter(Boolean);

  const head = element("tr");
  for (const column of graduationColumns) {
    const cell = element("th", null, column);
    cell.scope = "col";
    head.append(cell);
  }
  const thead = element("thead");
  thead.append(head);

  const tbody = element("tbody");
  for (const item of result.items) {
    tbody.append(graduationRow(item, "item"));
    if (!Array.isArray(item.details)) continue;
    for (const detail of item.details) tbody.append(graduationRow(detail, "detail"));
  }

  const table = element("table");
  table.append(element("caption", null, who.join(" · ") || "가상 학생 졸업 체크"), thead, tbody);
  const scroller = element("div", "table-scroll");
  scroller.tabIndex = 0;
  scroller.setAttribute("role", "region");
  scroller.setAttribute("aria-label", "졸업 체크 결과 표");
  scroller.append(table);
  return [
    scroller,
    element("p", "notice", "가상 이수 내역을 규칙으로 계산한 결과예요. 실제 학적 정보가 아니에요."),
  ];
}

// 날짜 글자(2026-11-26)를 읽기 쉬운 글자로만 바꾼다. 꼴이 다르면 받은 글자를 그대로 보여 준다.
function dateNode(value, withYear) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return element("span", null, value);
  const [, year, month, day] = match;
  const node = element("time", null, `${withYear ? `${year}년 ` : ""}${Number(month)}월 ${Number(day)}일`);
  node.dateTime = value;
  return node;
}

// 점수는 서버가 공개됐다고 표시한 양의 정수만 적는다. 더하거나 부족 점수와 견주지 않는다.
function mileageText(program) {
  const points = program.mileage_points;
  if (program.mileage_status === "published" && Number.isInteger(points) && points > 0) return `마일리지 ${points}점`;
  if (program.mileage_status === "announced") return "마일리지 지급 공지 · 정확한 점수 확인 필요";
  return "마일리지 미공개";
}

function biskitProgram(program) {
  if (program === null || typeof program !== "object" || Array.isArray(program)) {
    throw new TypeError("Malformed BISKIT program");
  }
  // 제목은 글자여야 한다. 숫자 같은 다른 값은 형식 오류로 보고 추천 영역을 그리지 않는다.
  const title = typeof program.title === "string" ? shownText(program.title) : null;
  if (!title) throw new TypeError("Malformed BISKIT program");
  // 로그인 여부는 참·거짓 값이어야 한다. "true" 같은 글자를 어림잡아 읽으면 로그인 안내가 조용히 빠진다.
  if (typeof program.login_required !== "boolean") throw new TypeError("Malformed BISKIT program");

  const when = element("p", "when");
  const audience = shownText(program.audience);
  if (audience) when.append(document.createTextNode(`${audience} · `));
  const applyUntil = shownText(program.apply_until);
  if (applyUntil) {
    when.append(document.createTextNode("신청 "), dateNode(applyUntil, false), document.createTextNode("까지"));
  } else {
    when.append(document.createTextNode("신청 마감 확인 필요"));
  }
  const eventOn = shownText(program.event_on);
  if (eventOn) when.append(document.createTextNode(" · 행사 "), dateNode(eventOn, true));

  const card = element("li", "program");
  card.append(element("h4", null, title), when);

  // 서버가 확인했다고 밝힌 값(eligible, open)이 아니면 모두 확인 필요로 보여 준다.
  const checks = [];
  if (program.eligibility !== "eligible") checks.push("대상 확인 필요");
  if (program.deadline_status !== "open") checks.push("마감 시각 확인 필요");
  if (checks.length) {
    const line = element("p", "checks");
    for (const check of checks) line.append(element("span", "badge needs-check", check));
    card.append(line);
  }
  card.append(element("p", "mileage", mileageText(program)));

  const links = element("div", "links");
  links.append(
    sourceLink(program.notice_url, "공식 공지 보기", title) ?? element("span", "hint", "공식 공지 확인 필요"),
  );
  const application = sourceLink(program.application_url, "신청 페이지 열기", title);
  // 신청 주소가 로그인 화면을 거치는 경로일 수 있으므로, 링크가 있어도 로그인 필요를 눈에 보이게 적는다.
  if (application) links.append(application);
  if (program.login_required) {
    links.append(element("span", "hint", application ? "BISKIT 로그인 필요" : "BISKIT 로그인 후 프로그램명으로 검색"));
  }
  card.append(links);
  return card;
}

// 교내 비교과 시스템(BISKIT) 추천 영역. 고르고 줄 세우는 일은 서버가 끝냈으므로 받은 순서대로 그린다.
// 값이 없거나 형식이 어긋나면 null을 돌려주어 추천 영역만 빠지고 졸업 표는 남는다.
function biskitRecommendations(recommendation) {
  try {
    if (recommendation === null || typeof recommendation !== "object" || Array.isArray(recommendation)) return null;
    const shortfall = recommendation.shortfall_points;
    if (!Number.isInteger(shortfall) || shortfall < 1 || !Array.isArray(recommendation.programs)) return null;

    const section = element("section", "biskit");
    section.append(element("h3", null, `BISKIT 추천 · ${shortfall}점 부족`));

    const listed = element("p", "source");
    const listedOn = shownText(recommendation.listed_on);
    if (listedOn) {
      listed.append(document.createTextNode("목록 확인 "), dateNode(listedOn, true), document.createTextNode(" · "));
    }
    listed.append(document.createTextNode("접수 상태와 정원은 공식 페이지에서 확인"));
    section.append(listed);

    if (recommendation.programs.length) {
      const list = element("ul", "programs");
      for (const program of recommendation.programs) list.append(biskitProgram(program));
      section.append(list);
    } else {
      section.append(element("p", "none", "지금 신청할 수 있는 프로그램을 확인하지 못했어요"));
    }

    const portal = sourceLink(recommendation.portal_url, "BISKIT 열기", "교내 비교과 시스템");
    if (portal) section.append(portal);
    return section;
  } catch {
    return null;
  }
}

async function checkGraduation() {
  if (busy) return;
  empty.remove();
  graduationTurn?.remove();
  const turn = element("div", "turn");
  const prompt = element("p", "question");
  prompt.append(element("span", "sr-only", "내 요청: "), document.createTextNode("가상 학생 졸업 체크"));
  const reply = element("div", "reply graduation");
  turn.append(prompt, reply);
  transcript.append(turn);
  graduationTurn = turn;

  setBusy(true, "졸업 체크 결과를 불러오는 중…");
  try {
    const response = await fetch("/api/v1/graduation-demo", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error("Graduation request failed");
    const result = await response.json();
    reply.append(...graduationResult(result));
    const recommendations = biskitRecommendations(result.biskit_recommendations);
    if (recommendations) reply.append(recommendations);
    celebrate();
  } catch {
    const retry = element("button", "retry", "다시 시도");
    retry.type = "button";
    retry.addEventListener("click", () => void checkGraduation());
    const error = element("div", "error");
    error.append(element("p", null, "졸업 체크 결과를 받지 못했어요."), retry);
    reply.replaceChildren(error);
    showAssistant("error");
  } finally {
    setBusy(false);
    turn.scrollIntoView?.({ block: "start" });
  }
}

// 사진에서 읽은 마감(11-20)은 연도가 없다. 월·일만 읽기 쉽게 바꾸고, 꼴이 다르면 받은 글자를 그대로 쓴다.
function posterDeadlineText(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(value);
  return match ? `${Number(match[1])}월 ${Number(match[2])}일` : value;
}

function posterDateLine(label, value) {
  const line = element("p", "when", `${label} `);
  const shown = typeof value === "string" ? shownText(value) : null;
  line.append(shown ? dateNode(shown, true) : document.createTextNode("확인 필요"));
  return line;
}

// 확정된 행사 카드. 날짜는 행사일, 공식 마감, 사진 마감 순서로 놓아 공식 값이 먼저 읽히게 한다.
function posterEventCard(event, reasonList, clueList) {
  const reasons = Array.isArray(reasonList) ? reasonList : [];
  const identifiedBy = Array.isArray(clueList) ? clueList : [];
  if (event === null || typeof event !== "object" || Array.isArray(event)) {
    throw new TypeError("Malformed poster event");
  }
  const title = typeof event.title === "string" ? shownText(event.title) : null;
  if (!title) throw new TypeError("Malformed poster event");
  // 로그인 여부를 어림잡아 읽으면 로그인 안내가 조용히 빠지므로, 참·거짓 값이 아니면 카드를 그리지 않는다.
  if (typeof event.login_required !== "boolean") throw new TypeError("Malformed poster event");

  const card = element("section", "poster-result");
  card.append(element("h3", null, title));

  const clues = identifiedBy.filter(clue => typeof clue === "string" && Object.hasOwn(posterClues, clue));
  if (clues.length) {
    card.append(element("p", "source", `확인 단서 · ${clues.map(clue => posterClues[clue]).join(", ")}`));
  }

  card.append(posterDateLine("행사일", event.event_date), posterDateLine("공식 신청 마감", event.official_deadline));
  if (reasons.includes("deadline_mismatch")) {
    const onPoster = posterDeadlineText(event.poster_deadline);
    const mismatch = element("p", "mismatch");
    mismatch.append(
      element("span", "badge needs-check", "확인 필요"),
      document.createTextNode(
        onPoster
          ? ` 사진에는 마감이 ${onPoster}로 적혀 있어요. 공식 공지의 마감을 따르세요.`
          : " 사진에 적힌 마감이 공식 공지와 달라요. 공식 공지의 마감을 따르세요.",
      ),
    );
    card.append(mismatch);
  }

  // 서버가 접수 중이나 마감이라고 밝힌 값이 아니면 모두 확인 필요로 보여 준다.
  const known = typeof event.application_state === "string" && Object.hasOwn(posterStates, event.application_state);
  const state = posterStates[known ? event.application_state : "needs_check"];
  const stateLine = element("p", "state");
  stateLine.append(element("span", state.className, state.label));
  if (reasons.includes("deadline_day")) {
    stateLine.append(document.createTextNode(" 오늘이 마감일이에요. 공지에 마감 시각이 없어 공식 공지에서 확인해야 해요."));
  }
  card.append(stateLine);

  const points = event.mileage;
  card.append(element(
    "p",
    "mileage",
    Number.isInteger(points) && points > 0 ? `마일리지 ${points}점` : "마일리지 미공개 · 공식 공지에서 확인",
  ));

  const links = element("div", "links");
  links.append(
    sourceLink(event.notice_url, "공식 공지 보기", title) ?? element("span", "hint", "공식 공지 확인 필요"),
  );
  const application = sourceLink(event.application_url, "신청 페이지 열기", title);
  if (application) links.append(application);
  // 신청 링크를 만들지 못해도 로그인이 필요하다는 말은 빠뜨리지 않는다.
  if (event.login_required) {
    links.append(element(
      "span",
      "hint",
      application ? "BISKIT 로그인 필요" : "BISKIT 로그인 필요 · 로그인 후 프로그램명으로 검색",
    ));
  }
  card.append(links);

  const checked = element("p", "source");
  const checkedOn = typeof event.checked_on === "string" ? shownText(event.checked_on) : null;
  if (checkedOn) checked.append(document.createTextNode("확인일 "), dateNode(checkedOn, true), document.createTextNode(" · "));
  checked.append(document.createTextNode("현재 정원과 접수 상태는 공식 링크에서 다시 확인"));
  card.append(checked);
  return card;
}

// 노란 확인 필요 카드. 행사·출처 링크는 넣지 않는다.
function needsCheckCard(messages) {
  const card = element("section", "poster-result unconfirmed");
  const heading = element("h3");
  heading.append(element("span", "badge needs-check", "확인 필요"));
  card.append(heading);
  for (const message of messages) card.append(element("p", null, message));
  card.append(element("p", "source", photoMessages.noLink));
  return card;
}

// 요청 실패 문구. 다시 시도할 일이 있을 때만 버튼을 붙인다.
function failureBox(message, retry) {
  const error = element("div", "error");
  error.append(element("p", null, message));
  if (retry) {
    const button = element("button", "retry", "다시 시도");
    button.type = "button";
    button.addEventListener("click", () => {
      if (!busy) retry();
    });
    error.append(button);
  }
  return error;
}

// 응답 줄(상태 코드)은 받았어도 본문을 받는 중에 연결이 끊길 수 있다.
// 다 받은 본문을 해석하지 못한 경우(SyntaxError)만 서버 오류로 보고, 나머지는 통신 실패로 본다.
// 돌려주는 값은 { result } 또는 { failure, status }다.
async function requestJson(path, options, unprocessed) {
  let response;
  try {
    response = await fetch(path, options);
  } catch {
    return { failure: photoMessages.disconnected };
  }
  if (!response.ok) return { failure: unprocessed, status: response.status };
  try {
    return { result: await response.json() };
  } catch (error) {
    return { failure: error?.name === "SyntaxError" ? unprocessed : photoMessages.disconnected };
  }
}

// 보내기 전에 화면이 먼저 막는 두 경우. 문제가 없으면 null을 돌려준다.
function textProblem(question, recognized) {
  if (!question && !recognized) return photoMessages.nothingToAsk;
  if ([...recognized].length > recognizedMaxChars) return photoMessages.tooLong;
  return null;
}

// 글자 주소의 출처 목록. 안전 주소 검사를 통과한 서버 출처만 링크가 되고, 나머지는 제목 글자만 남는다.
function sourceList(sources) {
  const list = element("ul", "sources");
  for (const source of Array.isArray(sources) ? sources : []) {
    if (source === null || typeof source !== "object" || Array.isArray(source)) continue;
    const title = typeof source.title === "string" ? shownText(source.title) : null;
    const link = sourceLink(source.url, title ?? "출처 보기", "출처");
    if (!link && !title) continue;
    const item = element("li");
    item.append(link ?? element("span", "hint", `${title} · 링크 확인 필요`));
    list.append(item);
  }
  return list.children.length ? list : null;
}

// 글자 주소의 응답을 그린다. 돌려주는 값은 [그릴 요소, 알림 영역에 쓸 한 줄]이다.
// 판독문과 답변 글은 글자로만 넣으므로, 그 안에 주소처럼 생긴 글자가 있어도 링크가 되지 않는다.
function textAnswer(result) {
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    throw new TypeError("Malformed photo answer");
  }
  const kind = typeof result.kind === "string" ? result.kind : "";
  if (kind === "event") {
    const card = posterEventCard(result.event, result.reasons, result.identified_by);
    return [card, `행사를 찾았어요. ${result.event.title}`];
  }
  if (kind === "hold") {
    // 서버가 아는 사유 이름을 보냈으면 그 문구를, 아니면 일반 보류 문구를 쓴다. 보류에는 출처를 그리지 않는다.
    const reason = result.hold_reason;
    const known = typeof reason === "string" && Object.hasOwn(photoNeedsCheck, reason);
    return [needsCheckCard([known ? photoNeedsCheck[reason] : photoMessages.held]), "답변을 보류했어요. 링크는 보여 주지 않아요."];
  }
  if (!Object.hasOwn(textAnswerKinds, kind)) throw new TypeError("Malformed photo answer");
  const answer = typeof result.answer === "string" ? shownText(result.answer) : null;
  if (!answer) throw new TypeError("Malformed photo answer");

  const section = element("section", "text-answer");
  section.append(element("h3", null, textAnswerKinds[kind]), element("p", null, answer));
  const sources = sourceList(result.sources);
  if (sources) section.append(sources);
  return [section, `${textAnswerKinds[kind]}에서 답을 찾았어요.`];
}

// 사진 없이 글자만 보낸다. 실패하면 같은 글자로만 다시 시도한다.
async function answerFromText(question, recognized, answer) {
  statusLine.textContent = photoMessages.asking;
  photoNote.textContent = "";
  answer.replaceChildren();

  const { result, failure, status } = await requestJson("/api/v1/photo-question", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ question, recognized_text: recognized, session_id: sessionId }),
    signal: AbortSignal.timeout(90_000),
  }, photoMessages.textFailed);

  let message = failure;
  if (!failure) {
    try {
      const [node, summary] = textAnswer(result);
      answer.append(node);
      photoNote.textContent = summary;
      if (result.kind === "hold") showAssistant("hold");
      else celebrate();
      return;
    } catch {
      message = photoMessages.textFailed;
    }
  }
  // 서버가 글자 자체를 거절하면(422) 같은 글자를 다시 보내도 결과가 같아 다시 시도 버튼을 두지 않는다.
  const rejected = status === 422;
  if (rejected) message = photoMessages.textRejected;
  answer.replaceChildren(failureBox(
    message,
    rejected ? null : () => void whileBusy(photoMessages.asking, () => answerFromText(question, recognized, answer)),
  ));
  photoNote.textContent = message;
  showAssistant("error");
}

// 읽은 글자를 고치는 칸. 판독문은 입력 칸의 값으로만 넣어 일반 글자로 남는다.
// 다시 물을 때는 사진 없이 두 칸의 글자만 보내고, 결과는 같은 답변 자리(answer)에 바꿔 그린다.
function readingPanel(recognized, question, answer, notes) {
  const panel = element("section", "reading");
  panel.append(element("h3", null, "사진에서 읽은 글자"));
  for (const note of notes) panel.append(element("p", "source", note));

  const textBox = element("textarea", "reading-text");
  textBox.rows = 3;
  textBox.value = recognized;
  const textField = element("label", "field");
  textField.append(element("span", null, "읽은 글자"), textBox);

  const questionBox = element("textarea", "reading-question");
  questionBox.rows = 1;
  questionBox.value = question;
  const questionField = element("label", "field");
  questionField.append(element("span", null, "함께 물을 질문"), questionBox);

  const problemLine = element("p", "reading-note");
  problemLine.setAttribute("role", "status");
  const reask = element("button", "reask check", "고쳐서 다시 묻기");
  reask.type = "button";
  // 이 칸은 요청이 진행 중일 때 만들어진다. 잠금이 풀릴 때 setBusy가 함께 풀어 준다.
  reask.disabled = busy;
  reask.addEventListener("click", () => {
    if (busy) return;
    const nextQuestion = questionBox.value.trim();
    const nextRecognized = textBox.value.trim();
    const problem = textProblem(nextQuestion, nextRecognized);
    problemLine.textContent = problem ?? "";
    if (problem) return;
    void whileBusy(photoMessages.asking, () => answerFromText(nextQuestion, nextRecognized, answer));
  });

  panel.append(
    textField,
    questionField,
    problemLine,
    reask,
    element("p", "source", "잘못 읽힌 글자를 고쳐 다시 물으면 사진은 다시 보내지 않고 글자만 보내요. 2,000자까지 보낼 수 있어요."),
  );
  return panel;
}

// 사진 대조는 서버가 끝냈다. 화면은 확정(confirmed)일 때만 행사와 링크를 그리고,
// 그 밖의 값은 서버가 행사 정보를 함께 보냈더라도 그리지 않고 읽은 글자로 다시 묻는다.
// 돌려주는 값은 { answer, panel, summary, pending }이고, pending이 있으면 글자 주소로 이어서 묻는다.
function photoReading(result, question) {
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    throw new TypeError("Malformed photo result");
  }
  const reasons = Array.isArray(result.reasons) ? result.reasons : [];
  const recognized = typeof result.recognized_text === "string" ? result.recognized_text : "";
  const answer = element("div", "photo-answer");

  if (result.event_match === "confirmed") {
    answer.append(posterEventCard(result.event, reasons, result.identified_by));
    return {
      answer,
      panel: readingPanel(recognized, question, answer, []),
      summary: `행사를 찾았어요. ${result.event.title}`,
      pending: null,
    };
  }

  const explained = reasons
    .filter(reason => typeof reason === "string" && Object.hasOwn(photoNeedsCheck, reason))
    .map(reason => photoNeedsCheck[reason]);
  const problem = textProblem(question, recognized.trim());
  if (!problem) {
    return {
      answer,
      panel: readingPanel(recognized, question, answer, explained),
      summary: "",
      pending: { question, recognized: recognized.trim() },
    };
  }
  // 물을 글자가 없거나 판독문이 한도를 넘으면 글자 주소로 보내지 않고, 고쳐서 다시 물을 칸만 남긴다.
  const messages = problem === photoMessages.tooLong
    ? [photoMessages.tooLong]
    : explained.length ? explained : [photoMessages.nothingRead];
  answer.append(needsCheckCard(messages));
  return {
    answer,
    panel: readingPanel(recognized, question, answer, []),
    summary: problem === photoMessages.tooLong ? photoMessages.tooLong : "사진에서 확인한 내용이 없어요. 링크는 보여 주지 않아요.",
    pending: null,
  };
}

// photo는 파일에서 바이트만 잘라 낸 값이라 파일명이 없다. 본문에 그대로 싣고 형식은 Content-Type으로 알린다.
// 사진은 여기서 한 번만 보낸다. 행사가 확인되지 않으면 읽은 글자만 글자 주소로 넘긴다.
async function readPhoto(photo, type, question, reply) {
  statusLine.textContent = photoMessages.reading;
  photoNote.textContent = "";
  reply.replaceChildren();

  const { result, failure, status } = await requestJson("/api/v1/photo-input", {
    method: "POST",
    headers: { "Content-Type": type, Accept: "application/json" },
    body: photo,
    signal: AbortSignal.timeout(60_000),
  }, photoMessages.photoFailed);

  let message = failure;
  if (!failure) {
    let shown = null;
    try {
      shown = photoReading(result, question);
    } catch {
      message = photoMessages.photoFailed;
    }
    if (shown) {
      reply.append(shown.answer, shown.panel);
      photoNote.textContent = shown.summary;
      // 글자 주소로 이어서 물으면 그 결과가 비서 상태를 정한다. 여기서 끝나면 확정은 찾음, 나머지는 보류다.
      if (shown.pending) await answerFromText(shown.pending.question, shown.pending.recognized, shown.answer);
      else if (result.event_match === "confirmed") celebrate();
      else showAssistant("hold");
      return;
    }
  }
  // 사진 자체가 거절된 경우(413·415·422)는 같은 사진을 다시 보내도 결과가 같아 다시 시도 버튼을 두지 않는다.
  const rejected = Object.hasOwn(photoRejections, status ?? "");
  if (rejected) message = photoRejections[status];
  reply.replaceChildren(failureBox(
    message,
    rejected ? null : () => void whileBusy(photoMessages.reading, () => readPhoto(photo, type, question, reply)),
  ));
  photoNote.textContent = message;
  showAssistant("error");
}

async function ask(question, reply) {
  setBusy(true);
  reply.replaceChildren();
  try {
    const response = await fetch("/api/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: question,
        session_id: sessionId,
        use_academic_data: false,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) throw new Error("Chat request failed");
    const result = await response.json();
    sessionId = result.session_id;
    if (result.answered) {
      reply.append(element("p", null, result.answer));
      for (const citation of result.citations) reply.append(citationCard(citation));
      celebrate();
    } else {
      reply.append(element("p", "fallback", "이 질문은 가상 규정에서 근거를 찾지 못했어요."));
      showAssistant("hold");
    }
  } catch {
    const retry = element("button", "retry", "다시 시도");
    retry.type = "button";
    retry.addEventListener("click", () => {
      if (busy) return;
      input.focus();
      void ask(question, reply);
    });
    const error = element("div", "error");
    error.append(element("p", null, "서버 응답을 받지 못했어요."), retry);
    reply.replaceChildren(error);
    showAssistant("error");
  } finally {
    setBusy(false);
    scrollToLatest();
  }
}

for (const example of examples) {
  example.addEventListener("click", () => {
    input.value = example.dataset.question;
    if (compact.matches) topics.open = false;
    updateSend();
    input.focus();
  });
}

input.addEventListener("input", updateSend);
input.addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  if (!send.disabled) composer.requestSubmit();
});

composer.addEventListener("submit", event => {
  event.preventDefault();
  const question = input.value.trim();
  const file = photoFile.files?.[0];
  if (busy || (!question && !file)) return;
  if (file) {
    // 보낼 수 없는 사진이면 질문도 보내지 않는다. 학생이 첨부를 빼거나 바꾼 뒤 다시 보낸다.
    const rejected = !photoTypes.includes(file.type)
      ? photoRejections[415]
      : file.size > photoMaxBytes ? photoRejections[413] : null;
    if (rejected) {
      photoNote.textContent = rejected;
      return;
    }
  }

  empty.remove();
  const turn = element("div", "turn");
  const prompt = element("p", "question");
  prompt.append(element("span", "sr-only", "내 질문: "));
  if (question) prompt.append(document.createTextNode(question));
  // 파일명은 화면에 적지 않는다. 사진을 붙였다는 사실만 보여 준다.
  if (file) prompt.append(element("span", "attachment", "사진 1장"));
  const reply = element("div", file ? "reply photo" : "reply");
  turn.append(prompt, reply);
  transcript.append(turn);
  input.value = "";
  photoNote.textContent = "";
  scrollToLatest();
  if (!file) {
    void ask(question, reply);
    return;
  }
  // 바이트만 잘라 내 들고, 고른 파일은 바로 비운다. 남겨 두면 다음 질문에 같은 사진이 또 실린다.
  const photo = file.slice(0, file.size, file.type);
  const type = file.type;
  photoFile.value = "";
  void whileBusy(photoMessages.reading, () => readPhoto(photo, type, question, reply));
});

photoFile.addEventListener("change", () => {
  photoNote.textContent = "";
  updateSend();
});
photoClear.addEventListener("click", () => {
  if (busy) return;
  photoFile.value = "";
  photoNote.textContent = "";
  updateSend();
});

reset.addEventListener("click", () => {
  if (busy) return;
  changeFeature(null, { animate: false, focus: false });
  sessionId = null;
  graduationTurn = null;
  transcript.replaceChildren(empty);
  // 고른 사진도 함께 비운다. 남겨 두면 다시 고르지 않아도 같은 사진이 또 전송된다.
  photoFile.value = "";
  photoNote.textContent = "";
  input.value = "";
  showAssistant("idle");
  updateSend();
  input.focus();
});

// 첫 화면의 버튼과 카드. 새 요청을 만들지 않고 이미 있는 기능만 부른다.
// 졸업 체크는 checkGraduation이 요청 중 잠금을 직접 확인하므로 연달아 눌러도 요청은 하나만 나간다.
const landingActions = {
  graduation: () => void checkGraduation(),
  photo: () => { photoFile.focus(); photoFile.click(); },
  ask: () => input.focus(),
};
for (const control of landingControls) {
  const action = control.dataset?.action;
  if (typeof action !== "string" || !Object.hasOwn(landingActions, action)) continue;
  control.addEventListener("click", () => {
    if (busy) return;
    changeFeature(null, { animate: false, focus: false });
    if (action === "graduation") input.focus();
    landingActions[action]();
  });
}

// 펫을 누르면 질문 입력창에 초점을 주고 입력창까지 화면을 옮긴다. 요청 중에도 동작한다.
// 초점을 줄 때 브라우저가 화면을 바로 옮기지 않게 하고, 옮기는 일은 scrollIntoView 한 곳에 맡긴다.
// 움직임 줄이기 설정은 누를 때마다 다시 읽어, 사용 중에 바꿔도 부드러운 이동이 꺼진다.
pet.addEventListener("click", () => {
  input.focus({ preventScroll: true });
  const calm = reducedMotion();
  input.scrollIntoView?.({ block: "center", behavior: calm ? "auto" : "smooth" });
});

// 로고, 첫 화면의 테크모, 펫 버튼은 숨긴 채 시작하고, 안에 든 그림이 실제로 받아졌을 때만 보인다.
// 펫은 스프라이트 시트를 배경으로 그리는데 배경 그림은 로드 신호를 주지 않아, 같은 주소의 그림을 버튼 안에 두고 그 신호를 본다.
// complete와 naturalWidth를 함께 보므로 이 스크립트가 로드·실패 신호보다 늦게 실행돼도 결과가 같다.
// 파일이 없거나(404) 깨졌으면 자리를 숨긴 채 두고, 다른 그림으로 바꾸지 않는다.
for (const slot of document.querySelectorAll?.("[data-brand-slot]") ?? []) {
  const image = slot.querySelector("img");
  if (!image) continue;
  const settle = () => {
    slot.hidden = !(image.complete && image.naturalWidth > 0);
  };
  image.addEventListener("load", settle);
  image.addEventListener("error", settle);
  settle();
}

updateSend();

const calendarScope = { year: 2027, semester: 1 };
function panelTodayInKorea() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function isPanelDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function panelSources(sources) {
  const box = element("div", "sources");
  for (const source of Array.isArray(sources) ? sources : []) {
    if (!source || typeof source.title !== "string") continue;
    const line = element("p", "hint");
    const checked = isPanelDate(source.checked_on);
    line.append((checked && sourceLink(source.url, source.title, "출처")) || element("span", null, source.title));
    if (checked) line.append(document.createTextNode(" · 확인일 "), dateNode(source.checked_on, true));
    box.append(line);
  }
  box.append(element("p", "hint", "공식 페이지에서 다시 확인해 주세요."));
  return box;
}
function renderCalendar(content, result) {
  if (!Array.isArray(result?.events) || result.events.some(event => !event || typeof event.audience !== "string" ||
    !isPanelDate(event.starts_on) || !isPanelDate(event.ends_on) || event.ends_on < event.starts_on)) throw new Error("format");
  const scope = `${calendarScope.year}학년도 ${calendarScope.semester}학기 수강신청`;
  content.replaceChildren(element("h5", null, scope));
  const today = panelTodayInKorea();
  const events = result.events.filter(event => event.ends_on >= today).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  if (!events.length) content.append(element("p", "hint", `${scope}에 남은 일정이 없어요.`));
  for (const event of events) {
    const row = element("section", "evidence");
    const dates = element("p");
    dates.append(dateNode(event.starts_on, true));
    if (event.starts_on !== event.ends_on) dates.append(document.createTextNode(" ~ "), dateNode(event.ends_on, true));
    row.append(element("h5", null, event.audience), dates, panelSources(event.sources));
    content.append(row);
  }
  return events.length;
}
function renderCampus(content, result) {
  if (!Array.isArray(result?.places) || result.places.some(place => !place ||
    ["id", "name", "purpose", "location"].some(key => typeof place[key] !== "string"))) throw new Error("format");
  const places = result.places;
  const list = selected => {
    content.replaceChildren();
    if (!places.length) content.append(element("p", "hint", "보여 드릴 장소가 없어요."));
    for (const place of places) {
      const button = element("button", "panel-action", `${place.name} · ${place.purpose}`);
      button.type = "button";
      button.addEventListener("click", () => detail(place.id));
      content.append(button);
      if (selected === place.id) button.focus();
    }
  };
  const detail = id => {
    const place = places.find(item => item.id === id);
    const title = element("h5", null, place.name);
    title.tabIndex = -1;
    content.replaceChildren(title, element("p", null, place.purpose), element("p", null, `위치 · ${place.location}`));
    for (const [key, label] of [["map_number", "지도 번호"], ["hours", "운영 시간"], ["audience", "이용 대상"], ["cost", "비용"], ["directions", "찾아가는 길"], ["valid_period", "적용 기간"]]) {
      if (typeof place[key] === "string" && place[key].trim()) content.append(element("p", null, `${label} · ${place[key]}`));
    }
    const back = element("button", "panel-action", "목록으로");
    back.type = "button";
    back.addEventListener("click", () => list(id));
    content.append(panelSources(place.sources), back);
    title.focus();
  };
  list();
  return places.length;
}
async function loadFeaturePanel(panel, change) {
  const content = panel.querySelector("[data-panel-content]");
  if (!content) return;
  const current = () => panelChange === change && openedCard?.dataset.feature === panel.dataset.panel;
  const retry = () => { if (current()) void loadFeaturePanel(panel, change); };
  if (busy) {
    content.replaceChildren(failureBox("다른 요청을 마친 뒤 다시 시도해 주세요.", retry));
    return;
  }
  content.replaceChildren(element("p", "hint", "안내를 찾는 중이에요…"));
  await whileBusy("안내를 찾는 중…", async () => {
    const calendar = panel.dataset.panel === "calendar";
    const path = calendar ? `/api/v1/academic-calendar/${calendarScope.year}/${calendarScope.semester}` : "/api/v1/campus-guide";
    const response = await requestJson(path, { method: "GET", signal: AbortSignal.timeout(30_000) }, "서버가 안내를 불러오지 못했어요.");
    if (!current()) return;
    if (response.failure) {
      content.replaceChildren(failureBox(response.failure, retry));
      showAssistant("error");
      return;
    }
    try {
      const count = calendar ? renderCalendar(content, response.result) : renderCampus(content, response.result);
      if (count) celebrate();
      else showAssistant("hold");
    } catch {
      content.replaceChildren(failureBox("서버 안내의 형식이 맞지 않아요.", retry));
      showAssistant("error");
    }
  });
}
