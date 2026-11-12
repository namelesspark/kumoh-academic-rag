const topics = document.querySelector("#topics");
const examples = topics.querySelectorAll("[data-question]");
const transcript = document.querySelector("#transcript");
const empty = document.querySelector("#empty");
const composer = document.querySelector("#composer");
const input = document.querySelector("#question");
const send = document.querySelector("#send");
const reset = document.querySelector("#reset");
const statusLine = document.querySelector("#status");
const graduationCheck = document.querySelector("#graduation-check");
const compact = window.matchMedia("(max-width: 680px)");

// 서버가 보낸 status 값은 이 표에 있는 것만 인정하고, 나머지는 확인 필요로 보여 준다.
const graduationStatuses = {
  met: { label: "충족", className: "badge met" },
  short: { label: "부족", className: "badge short" },
  needs_check: { label: "확인 필요", className: "badge needs-check" },
};
const graduationColumns = ["항목", "상태", "현재 / 기준", "부족·확인할 점", "적용 근거"];

let sessionId = null;
let busy = false;
let graduationTurn = null;

if (compact.matches) topics.open = false;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function updateSend() {
  send.disabled = busy || !input.value.trim();
}

function setBusy(pending, message = "서버에 질문을 보내는 중…") {
  busy = pending;
  statusLine.textContent = pending ? message : "";
  reset.disabled = pending;
  graduationCheck.disabled = pending;
  for (const retry of transcript.querySelectorAll(".retry")) retry.disabled = pending;
  updateSend();
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
  } catch {
    const retry = element("button", "retry", "다시 시도");
    retry.type = "button";
    retry.addEventListener("click", () => void checkGraduation());
    const error = element("div", "error");
    error.append(element("p", null, "졸업 체크 결과를 받지 못했어요."), retry);
    reply.replaceChildren(error);
  } finally {
    setBusy(false);
    turn.scrollIntoView?.({ block: "start" });
  }
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
    } else {
      reply.append(element("p", "fallback", "이 질문은 가상 규정에서 근거를 찾지 못했어요."));
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
  if (busy || !question) return;

  empty.remove();
  const turn = element("div", "turn");
  const prompt = element("p", "question");
  prompt.append(element("span", "sr-only", "내 질문: "), document.createTextNode(question));
  const reply = element("div", "reply");
  turn.append(prompt, reply);
  transcript.append(turn);
  input.value = "";
  scrollToLatest();
  void ask(question, reply);
});

graduationCheck.addEventListener("click", () => void checkGraduation());

reset.addEventListener("click", () => {
  if (busy) return;
  sessionId = null;
  graduationTurn = null;
  transcript.replaceChildren(empty);
  input.value = "";
  updateSend();
  input.focus();
});

updateSend();
