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
const posterForm = document.querySelector("#poster-form");
const posterFile = document.querySelector("#poster-file");
const posterSubmit = document.querySelector("#poster-submit");
const posterNote = document.querySelector("#poster-note");
const compact = window.matchMedia("(max-width: 680px)");

// 현수막 사진 제한. 서버도 같은 제한으로 다시 검사하므로, 여기서는 보내기 전에 알려 주는 역할만 한다.
const posterTypes = ["image/jpeg", "image/png"];
const posterMaxBytes = 5_000_000;
const posterRejections = {
  413: "사진이 5MB를 넘어요. 더 작은 사진으로 다시 올려 주세요.",
  415: "JPEG나 PNG 사진만 읽을 수 있어요.",
  422: "사진을 열 수 없거나 화소 수가 1,200만을 넘어요. 다른 사진으로 다시 올려 주세요.",
};
const posterClues = { text: "사진 글자", qr_notice: "공지 QR", qr_program: "BISKIT 프로그램 QR" };
const posterNeedsCheck = {
  no_readable_clue: "사진에서 읽을 수 있는 글자나 QR을 찾지 못했어요. 행사 제목과 날짜가 보이게 다시 찍어 주세요.",
  ambiguous_event: "사진만으로는 어느 행사인지 하나로 정하지 못했어요. 제목과 날짜가 함께 보이거나 QR이 보이는 사진으로 다시 시도해 주세요.",
  text_reader_unavailable: "지금은 서버가 사진 속 글자를 읽을 수 없어요. QR이 보이는 사진으로 다시 시도해 주세요.",
};
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

function updatePosterSubmit() {
  posterSubmit.disabled = busy || !posterFile.files?.length;
}

function setBusy(pending, message = "서버에 질문을 보내는 중…") {
  busy = pending;
  statusLine.textContent = pending ? message : "";
  reset.disabled = pending;
  graduationCheck.disabled = pending;
  for (const retry of transcript.querySelectorAll(".retry")) retry.disabled = pending;
  updateSend();
  updatePosterSubmit();
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
function posterEventCard(event, reasons, identifiedBy) {
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

// 사진 대조는 서버가 끝냈다. 화면은 확정(confirmed)일 때만 행사와 링크를 그리고,
// 그 밖의 값은 모두 확인 필요로 보아 서버가 행사 정보를 함께 보냈더라도 링크를 만들지 않는다.
// 돌려주는 값은 [그릴 요소, 알림 영역에 쓸 한 줄]이다.
function posterResult(result) {
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    throw new TypeError("Malformed poster result");
  }
  const reasons = Array.isArray(result.reasons) ? result.reasons : [];
  if (result.event_match === "confirmed") {
    const identifiedBy = Array.isArray(result.identified_by) ? result.identified_by : [];
    const card = posterEventCard(result.event, reasons, identifiedBy);
    return [card, `행사를 찾았어요. ${result.event.title}`];
  }

  const card = element("section", "poster-result unconfirmed");
  const heading = element("h3");
  heading.append(element("span", "badge needs-check", "확인 필요"));
  card.append(heading);
  const explained = reasons.filter(reason => typeof reason === "string" && Object.hasOwn(posterNeedsCheck, reason));
  if (explained.length) {
    for (const reason of explained) card.append(element("p", null, posterNeedsCheck[reason]));
  } else {
    card.append(element("p", null, "사진 속 행사를 공식 공지에서 확인하지 못했어요."));
  }
  card.append(element("p", "source", "확인하지 못한 행사는 링크를 보여 주지 않아요. 학교 공지에서 직접 찾아 주세요."));
  return [card, "행사를 확인하지 못했어요. 링크는 보여 주지 않아요."];
}

// photo는 파일에서 바이트만 잘라 낸 값이라 파일명이 없다. 본문에 그대로 싣고 형식은 Content-Type으로 알린다.
async function findPosterEvent(photo, type, reply) {
  setBusy(true, "사진에서 행사를 찾는 중…");
  posterNote.textContent = "";
  reply.replaceChildren();

  let failure = null;
  let retryable = true;
  try {
    let response = null;
    try {
      response = await fetch("/api/v1/poster-lookup", {
        method: "POST",
        headers: { "Content-Type": type, Accept: "application/json" },
        body: photo,
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      failure = "서버에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.";
    }

    if (response?.ok) {
      try {
        const [card, summary] = posterResult(await response.json());
        reply.append(card);
        posterNote.textContent = summary;
      } catch {
        failure = "서버가 사진을 처리하지 못했어요.";
      }
    } else if (response) {
      retryable = !Object.hasOwn(posterRejections, response.status);
      failure = retryable ? "서버가 사진을 처리하지 못했어요." : posterRejections[response.status];
    }

    if (failure) {
      const error = element("div", "error");
      error.append(element("p", null, failure));
      // 사진 자체가 거절된 경우(413·415·422)는 같은 사진을 다시 보내도 결과가 같아 다시 시도 버튼을 두지 않는다.
      if (retryable) {
        const retry = element("button", "retry", "다시 시도");
        retry.type = "button";
        retry.addEventListener("click", () => {
          if (!busy) void findPosterEvent(photo, type, reply);
        });
        error.append(retry);
      }
      reply.replaceChildren(error);
      posterNote.textContent = failure;
    }
  } finally {
    setBusy(false);
    scrollToLatest();
  }
}

function submitPoster() {
  if (busy) return;
  const file = posterFile.files?.[0];
  if (!file) {
    posterNote.textContent = "현수막 사진을 먼저 골라 주세요.";
    return;
  }
  if (!posterTypes.includes(file.type)) {
    posterNote.textContent = posterRejections[415];
    return;
  }
  if (file.size > posterMaxBytes) {
    posterNote.textContent = posterRejections[413];
    return;
  }

  empty.remove();
  const turn = element("div", "turn");
  const prompt = element("p", "question");
  prompt.append(element("span", "sr-only", "내 요청: "), document.createTextNode("현수막 사진으로 행사 찾기"));
  const reply = element("div", "reply poster");
  turn.append(prompt, reply);
  transcript.append(turn);
  void findPosterEvent(file.slice(0, file.size, file.type), file.type, reply);
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

posterFile.addEventListener("change", () => {
  posterNote.textContent = "";
  updatePosterSubmit();
});
posterForm.addEventListener("submit", event => {
  event.preventDefault();
  submitPoster();
});

reset.addEventListener("click", () => {
  if (busy) return;
  sessionId = null;
  graduationTurn = null;
  transcript.replaceChildren(empty);
  // 고른 사진도 함께 비운다. 남겨 두면 다시 고르지 않아도 같은 사진이 또 전송된다.
  posterFile.value = "";
  posterNote.textContent = "";
  input.value = "";
  updateSend();
  updatePosterSubmit();
  input.focus();
});

updateSend();
updatePosterSubmit();
