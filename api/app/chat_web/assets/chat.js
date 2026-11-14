// 저장 객체는 허용한 텍스트 필드만 복사한다. DOM과 서버 세션은 저장하지 않는다.
function trimConversations(records) {
  if (!Array.isArray(records)) return [];
  return records.filter(record => record && !record.photo && typeof record.id === "string" && Array.isArray(record.messages))
    .map(record => ({
      id: record.id, time: Number(record.time) || 0, unread: record.unread === true,
      title: conversationTitle(record),
      messages: record.messages.filter(message => message && !message.photo &&
        ["question", "answer"].includes(message.role) && typeof message.text === "string" &&
        !/\b\d{8,10}\b/.test(message.text))
        .slice(-40).map(message => ({ role: message.role, text: message.text,
          time: Number(message.time) || 0,
          sources: (Array.isArray(message.sources) ? message.sources : [])
            .filter(source => source && typeof source.title === "string" && isSafeSourceUrl(source.url))
            .map(source => ({ title: source.title, url: source.url })) })),
    })).filter(record => record.messages.length).sort((a, b) => b.time - a.time).slice(0, 20);
}
function conversationTitle(record) {
  const title = record.title || record.messages.find(message => message?.role === "question")?.text || "";
  if (typeof title !== "string" || /\b\d{8,10}\b/.test(title)) return "";
  return Array.from(title).slice(0, 29).join("");
}
function conversationKey(account) {
  return "kumoh-chat-history:v1:" + (/^demo-d0[234]$/.test(account) ? account : "browse");
}
function loadConversations(storage, account) {
  try { return trimConversations(JSON.parse(storage.getItem(conversationKey(account)) || "[]")); }
  catch { return []; }
}
function saveConversations(storage, account, records) {
  try { storage.setItem(conversationKey(account), JSON.stringify(trimConversations(records))); return true; }
  catch { return false; }
}
function deleteConversation(storage, account, id) {
  const records = loadConversations(storage, account).filter(record => record.id !== id);
  saveConversations(storage, account, records);
  return records;
}
function clearConversations(storage, account) {
  try { storage.removeItem(conversationKey(account)); } catch { /* 저장 불가 환경에서도 화면은 유지한다. */ }
  return [];
}
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
// 파일 입력은 화면에서 숨긴다. 입력창 왼쪽의 클립 버튼이 대신 파일 창을 열고 초점도 받는다.
const photoAttach = document.querySelector("#photo-attach");
const photoClear = document.querySelector("#photo-clear");
const photoNote = document.querySelector("#photo-note");

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
const celebrateMs = 800;

let sessionId = null;
let busy = false;
let graduationTurn = null;
let assistantState = "idle";
let assistantTimer = null;
let techmoDropTimer = null;
let techmoDropCelebrating = false;
let techmoPosition = null;
let openedCard = null;
let panelTransition = null;
let panelChange = 0;
const demoLogin = document.querySelector("#demo-login");
const demoStudents = document.querySelector("#demo-students");
const demoStudentList = document.querySelector("#demo-student-list");
const demoIdentity = document.querySelector("#demo-identity");
const demoLabel = document.querySelector("#demo-label");
const demoLogout = document.querySelector("#demo-logout");
const demoNotice = document.querySelector("#demo-notice");
const studentStorageKey = "demo-student-id";
let selectedStudent = null;
let studentGeneration = 0;
let studentsRequest = null;
const sidebar = document.querySelector("#conversation-sidebar");
const conversationList = document.querySelector("#conversation-list");
const drawerToggle = document.querySelector("#conversation-toggle");
const drawerBackdrop = document.querySelector("#conversation-backdrop");
const homeButton = document.querySelector("#home-button");
let conversations = [];
let activeConversation = null;
let homeNodes = null;
let chatView = false;
let requestedChatView = false;
let historyAccount = "browse";
let conversationSequence = 0;
let screenSequence = 0;
let toastTimer = null;
let toastRecord = null;
let drawerOpen = false;
let hiddenAnswers = 0;
const originalTitle = document.title;
function runViewChange(update, { animate = true, current = () => true, cleanup = () => {}, ready = () => {} } = {}) {
  let applied = false;
  const apply = () => {
    if (applied || !current()) return;
    applied = true;
    update();
  };
  const finish = () => {
    apply();
    if (current()) cleanup();
  };
  if (!animate || reducedMotion() || typeof document.startViewTransition !== "function") {
    finish();
    return null;
  }
  try {
    const transition = document.startViewTransition(apply);
    Promise.resolve(transition.ready).then(() => { if (current()) ready(); }, finish).catch(finish);
    Promise.resolve(transition.updateCallbackDone).catch(finish);
    Promise.resolve(transition.finished).then(finish, finish);
    return transition;
  } catch {
    finish();
    return null;
  }
}
function historyStorage() {
  try { return window.localStorage; } catch { return null; }
}
function persistConversations() {
  saveConversations(historyStorage(), historyAccount, conversations.filter(record => !record.photo && record.saved)
    .map(record => ({ ...record, messages: record.committedMessages || record.messages })));
}
function switchHistoryAccount(account) {
  dismissConversationToast();
  if (window.location?.hash === "#chat") {
    window.history?.replaceState(null, "", window.location.pathname + window.location.search);
  }
  historyAccount = account || "browse";
  conversations = loadConversations(historyStorage(), historyAccount)
    .map(record => ({ ...record, saved: true, committedMessages: record.messages.slice() }));
  activeConversation = null;
  setChatView(false, false);
  renderConversations();
}
function closeDrawer(restoreFocus = true) {
  drawerOpen = false;
  document.body?.removeAttribute?.("data-conversation-drawer");
  drawerToggle?.setAttribute("aria-expanded", "false");
  if (drawerBackdrop) drawerBackdrop.hidden = true;
  for (const node of [composer, transcript, document.querySelector(".masthead"), assistant, document.querySelector("#conversation-toast")]) {
    if (node) node.inert = false;
  }
  updateSidebarAvailability();
  if (restoreFocus) drawerToggle?.focus();
}
function openDrawer() {
  if (window.matchMedia?.("(max-width: 960px)")?.matches === false) return;
  drawerOpen = true;
  if (sidebar) sidebar.inert = false;
  if (sidebar) sidebar.hidden = false;
  if (drawerBackdrop) drawerBackdrop.hidden = false;
  document.body?.setAttribute("data-conversation-drawer", "open");
  drawerToggle?.setAttribute("aria-expanded", "true");
  for (const node of [composer, transcript, document.querySelector(".masthead"), assistant, document.querySelector("#conversation-toast")]) {
    if (node) node.inert = true;
  }
  document.querySelector("#new-conversation")?.focus();
}
function updateSidebarAvailability() {
  const narrow = window.matchMedia?.("(max-width: 960px)")?.matches;
  if (drawerOpen && narrow === false) closeDrawer(false);
  if (sidebar) sidebar.inert = !drawerOpen && Boolean(narrow);
}
function setChatView(next, push = true) {
  requestedChatView = next;
  const sequence = ++screenSequence;
  const changed = next !== chatView;
  if (next && !chatView) homeNodes = Array.from(transcript.children);
  const apply = () => {
    if (sequence !== screenSequence) return;
    if (next && !chatView) {
      transcript.replaceChildren();
    } else if (!next && chatView) transcript.replaceChildren(...(homeNodes || [empty]));
    chatView = next;
    document.body?.setAttribute("data-view", next ? "chat" : "home");
    const welcome = document.querySelector(".main-welcome");
    if (welcome) welcome.hidden = next;
    if (sidebar) sidebar.hidden = !next;
    if (homeButton) homeButton.hidden = !next;
    if (drawerToggle) drawerToggle.hidden = !next;
    reset.hidden = next;
    if (next) renderActiveConversation();
    closeDrawer(false);
    updateSend();
  };
  document.body?.setAttribute("data-chat-direction", next ? "forward" : "back");
  if (push && window.history) {
    if (next && !chatView) window.history.pushState({ chat: true }, "", "#chat");
    else if (!next) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  runViewChange(apply, {
    animate: changed,
    current: () => sequence === screenSequence,
    cleanup: () => document.body?.removeAttribute?.("data-chat-direction"),
    ready: () => {
      for (const animation of document.getAnimations?.() || []) {
        const effect = animation.effect;
        if (effect?.pseudoElement !== "::view-transition-group(chat-composer)") continue;
        effect.setKeyframes(effect.getKeyframes().map(frame => {
          const safe = { offset: frame.offset, easing: frame.easing, composite: frame.composite };
          if (frame.transform !== undefined) safe.transform = frame.transform;
          if (frame.opacity !== undefined) safe.opacity = frame.opacity;
          return safe;
        }));
      }
    },
  });
}
function renderActiveConversation() {
  if (!chatView) return;
  transcript.replaceChildren(...(activeConversation?.turns || []));
  scrollToLatest();
}
function openConversation(record) {
  if (!conversations.includes(record)) return;
  if (toastRecord === record) dismissConversationToast();
  activeConversation = record;
  record.unread = false;
  if (!record.turns) {
    record.turns = [];
    for (const message of record.messages) {
      if (message.role === "question" || !record.turns.length) record.turns.push(element("div", "turn"));
      const node = record.turns[record.turns.length - 1];
      node.append(element("p", message.role === "question" ? "question" : "reply", message.text));
      for (const source of message.sources || []) {
        const link = sourceLink(source.url, source.title, source.title);
        if (link) node.append(link);
      }
    }
  }
  persistConversations();
  setChatView(true);
  renderConversations();
}
function renderConversations() {
  if (!conversationList) return;
  conversationList.replaceChildren();
  for (const record of [...conversations].sort((a, b) => b.time - a.time)) {
    const item = element("li", "conversation-item");
    item.setAttribute("data-conversation-id", record.id);
    if (record === activeConversation) item.setAttribute("aria-current", "true");
    const open = element("button", "conversation-open");
    open.type = "button";
    const title = conversationTitle(record) || "새 대화";
    const chars = Array.from(title);
    const date = new Date(record.time);
    const today = date.toDateString() === new Date().toDateString();
    open.append(element("span", "conversation-title", chars.slice(0, 28).join("") + (chars.length > 28 ? "…" : "")),
      element("span", "conversation-time", today ? date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) : `${date.getMonth() + 1}/${date.getDate()}`));
    open.addEventListener("click", () => openConversation(record));
    if (record.pending) {
      item.setAttribute("data-conversation-state", "pending");
      const pending = element("span", "conversation-pending");
      pending.append(element("span", "sr-only", "답변 기다리는 중"));
      open.append(pending);
    }
    if (record.unread) {
      const dot = element("span", "conversation-unread");
      dot.append(element("span", "sr-only", "읽지 않은 답변"));
      open.append(dot);
    }
    const remove = element("button", "conversation-delete");
    const icon = element("span", "conversation-delete-icon");
    icon.setAttribute("aria-hidden", "true");
    remove.append(icon);
    remove.type = "button";
    remove.setAttribute("aria-label", "이 대화 삭제");
    remove.addEventListener("click", () => {
      if (!window.confirm("이 대화를 지울까요?")) return;
      conversations = conversations.filter(value => value !== record);
      if (toastRecord === record) dismissConversationToast();
      if (activeConversation === record) { activeConversation = null; renderActiveConversation(); }
      persistConversations(); renderConversations(); updateSend();
    });
    item.append(open, remove);
    conversationList.append(item);
  }
}
function notifyConversation(record) {
  record.unread = true;
  showAssistant("answer", "답변이 도착했어요");
  const toast = document.querySelector("#conversation-toast");
  const open = document.querySelector("#conversation-toast-open");
  const line = `‘${Array.from(conversationTitle(record)).slice(0, 20).join("")}’ 대화에 답변이 왔어요`;
  const announce = document.querySelector("#conversation-announce");
  if (announce) announce.textContent = line;
  if (toast && open) {
    toastRecord = record;
    toast.hidden = false;
    open.textContent = line;
    open.onclick = () => { dismissConversationToast(); openConversation(record); };
    if (toastTimer !== null) clearTimeout(toastTimer);
    if (typeof setTimeout === "function") toastTimer = setTimeout(() => { toast.hidden = true; toastTimer = null; }, 6000);
  }
  if (document.hidden) { hiddenAnswers++; document.title = `(${hiddenAnswers}) ${originalTitle}`; }
}
function dismissConversationToast() {
  const toast = document.querySelector("#conversation-toast");
  if (toast) toast.hidden = true;
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = null;
  toastRecord = null;
}
drawerToggle?.addEventListener("click", openDrawer);
drawerBackdrop?.addEventListener("click", () => closeDrawer());
document.querySelector("#conversation-close")?.addEventListener("click", () => closeDrawer());
homeButton?.addEventListener("click", () => setChatView(false));
document.querySelector(".brand")?.addEventListener("click", () => setChatView(false));
function startNewConversation() {
  activeConversation = null;
  input.value = "";
  photoFile.value = "";
  photoNote.textContent = "";
  statusLine.textContent = "";
  setChatView(true); renderConversations(); input.focus();
}
document.querySelector("#new-conversation")?.addEventListener("click", startNewConversation);
document.querySelector("#clear-conversations")?.addEventListener("click", () => {
  if (!window.confirm("대화 기록을 모두 지울까요?")) return;
  clearConversations(historyStorage(), historyAccount);
  dismissConversationToast();
  conversations = []; activeConversation = null; renderConversations(); renderActiveConversation(); updateSend();
});
document.addEventListener?.("keydown", event => { if (event.key === "Escape" && drawerOpen) closeDrawer(); });
document.addEventListener?.("visibilitychange", () => {
  if (!document.hidden) { hiddenAnswers = 0; document.title = originalTitle; }
});
window.addEventListener?.("popstate", () => setChatView(window.location.hash === "#chat", false));
window.addEventListener?.("resize", updateSidebarAvailability);
document.querySelector("#conversation-toast-close")?.addEventListener("click", dismissConversationToast);

function storedStudentId() {
  try { return window.sessionStorage?.getItem(studentStorageKey); } catch { return null; }
}

function rememberStudent(id) {
  try {
    if (id) window.sessionStorage?.setItem(studentStorageKey, id);
    else window.sessionStorage?.removeItem(studentStorageKey);
  } catch { /* 저장 공간을 쓸 수 없어도 현재 탭에서는 선택을 유지한다. */ }
}

const loginScreen = document.querySelector("#login-screen");
const mainScreen = document.querySelector("#main-screen");
const loginForm = document.querySelector("#login-form");
const studentNumber = document.querySelector("#student-number");
const studentPassword = document.querySelector("#student-password");
const loginError = document.querySelector("#login-error");
const loginPet = document.querySelector("#login-pet");
const loginPetLine = document.querySelector("#login-pet-line");
const mainGreeting = document.querySelector("#main-greeting");
const demoAccounts = {
  "20990002": "demo-d02-pass",
  "20990003": "demo-d03-pass",
  "20990004": "demo-d04-pass",
};
function loginMessage(line, pose = "guide") {
  if (loginPetLine) loginPetLine.textContent = line;
  loginPet?.setAttribute("data-pose", pose);
  applyTechmoMotion(loginPet, pose);
}
function showScreen(main) {
  if (loginScreen) loginScreen.hidden = main;
  if (mainScreen) mainScreen.hidden = !main;
  document.body?.setAttribute("data-screen", main ? "main" : "login");
}
function closeStudents() {
  studentGeneration++;
  if (demoStudents) demoStudents.hidden = true;
  demoNotice.textContent = "";
  demoLogin.setAttribute("aria-expanded", "false");
}
function selectStudent(student, { restored = false } = {}) {
  studentGeneration++;
  selectedStudent = student;
  switchHistoryAccount(student.id);
  rememberStudent(student.id);
  demoLabel.textContent = student.label;
  demoLogin.hidden = true;
  demoIdentity.hidden = false;
  if (mainGreeting) mainGreeting.textContent = `안녕하세요, ${student.label} 님`;
  if (restored) showScreen(true);
  else {
    const generation = studentGeneration;
    loginMessage(`${student.label} 이수 내역으로 들어왔어요`, "celebrate");
    celebrate("idle", `${student.label} 이수 내역으로 들어왔어요`, () => {
      if (generation !== studentGeneration || selectedStudent !== student) return;
      let applied = false;
      const apply = () => {
        if (generation !== studentGeneration || applied) return;
        applied = true;
        showScreen(true);
        demoLogout.focus();
      };
      if (!reducedMotion() && typeof document.startViewTransition === "function") {
        try {
          const transition = document.startViewTransition(apply);
          Promise.resolve(transition.ready).catch(apply);
          Promise.resolve(transition.updateCallbackDone).catch(apply);
          Promise.resolve(transition.finished).then(apply, apply);
        } catch { apply(); }
      } else apply();
    }, 650);
  }
}
function leaveStudent() {
  studentGeneration++;
  selectedStudent = null;
  switchHistoryAccount("browse");
  rememberStudent(null);
  graduationTurn?.remove();
  graduationTurn = null;
  if (!transcript.children.length) {
    changeFeature(null, { animate: false, focus: false });
    transcript.append(empty);
  }
  demoIdentity.hidden = true;
  demoLogin.hidden = false;
  demoLabel.textContent = "";
  if (studentNumber) studentNumber.value = "";
  if (studentPassword) studentPassword.value = "";
  showAssistant("idle");
  loginMessage("학번으로 들어와 보세요!");
  showScreen(false);
}
function validStudent(student) {
  return student && /^demo-d0[234]$/.test(student.id) && typeof student.label === "string" &&
    typeof student.scenario === "string" && student.is_fictional === true;
}
async function loadStudents() {
  if (!studentsRequest) studentsRequest = (async () => {
    const response = await fetch("/api/v1/demo-students", { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error("Students request failed");
    const result = await response.json();
    if (!Array.isArray(result?.students) || result.students.some(student => !validStudent(student))) throw new Error("Malformed students");
    return result.students;
  })();
  try { return await studentsRequest; } finally { studentsRequest = null; }
}
function openStudents(message = "") {
  studentGeneration++;
  showAssistant("idle");
  showScreen(false);
  if (loginError) loginError.textContent = message;
  loginMessage("학번으로 들어와 보세요!");
  studentNumber?.focus();
}
demoLogin.addEventListener("click", () => openStudents());
demoLogout.addEventListener("click", leaveStudent);
for (const account of document.querySelectorAll?.("[data-demo-account]") ?? []) {
  account.addEventListener("click", () => {
    studentGeneration++;
    showAssistant("idle");
    const number = account.dataset.demoAccount;
    if (!Object.hasOwn(demoAccounts, number)) return;
    studentNumber.value = number;
    studentPassword.value = demoAccounts[number];
    if (loginError) loginError.textContent = "";
    loginMessage("좋아요, 로그인을 눌러 보세요");
    studentNumber.focus();
  });
}
loginForm?.addEventListener("submit", async event => {
  event.preventDefault();
  const generation = ++studentGeneration;
  showAssistant("idle");
  if (loginError) loginError.textContent = "";
  if (!Object.hasOwn(demoAccounts, studentNumber.value)) {
    if (loginError) loginError.textContent = "학번 또는 비밀번호가 맞지 않아요";
    loginMessage("쉿, 시연 계정으로만 들어올 수 있어요", "quiet");
    return;
  }
  loginMessage("학번을 확인하고 있어요");
  try {
    const response = await fetch("/api/v1/demo-login", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ student_number: studentNumber.value, password: studentPassword.value }),
      signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json();
    if (generation !== studentGeneration) return;
    if (response.status !== 200 || !validStudent(result?.student)) {
      if (loginError) loginError.textContent = response.status === 401 ? "학번 또는 비밀번호가 맞지 않아요" : "로그인하지 못했어요. 다시 시도해 주세요.";
      loginMessage("쉿, 시연 계정으로만 들어올 수 있어요", "quiet");
      return;
    }
    selectStudent(result.student);
  } catch {
    if (generation !== studentGeneration) return;
    if (loginError) loginError.textContent = "서버에 연결하지 못했어요. 다시 시도해 주세요.";
    loginMessage("쉿, 시연 계정으로만 들어올 수 있어요", "quiet");
  }
});
document.querySelector("#browse-main")?.addEventListener("click", () => {
  leaveStudent();
  showScreen(true);
  if (mainGreeting) mainGreeting.textContent = "";
});
showScreen(false);
async function restoreStudent() {
  const id = storedStudentId();
  if (!id) return;
  const generation = studentGeneration;
  try {
    const students = await loadStudents();
    if (generation !== studentGeneration) return;
    const student = students.find(item => item.id === id);
    if (student) selectStudent(student, { restored: true });
    else rememberStudent(null);
  } catch {
    if (generation === studentGeneration) {
      demoNotice.textContent = "가상 학생을 복원하지 못했어요. 다시 로그인해 주세요.";
      if (loginError) loginError.textContent = demoNotice.textContent;
    }
  }
}

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
  if (!selectedStudent && ["graduation", "biskit"].includes(card?.dataset.feature)) { openStudents("이 기능은 시연 계정으로 로그인한 뒤 쓸 수 있어요"); return; }
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
  if (animate) source?.setAttribute("data-morph", "");
  panelTransition = runViewChange(apply, {
    animate,
    current: () => change === panelChange,
    cleanup: () => {
      source?.removeAttribute("data-morph");
      panelTransition = null;
    },
  });
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

// 칸 배치는 서버가 전달한 값만 쓰고, 실제 그림 크기가 맞아야 새 재생을 켠다.
function parseTechmoLayout(value) {
  try {
    const layout = JSON.parse(value);
    if (layout.version !== 1 || !Number.isSafeInteger(layout.cell) || layout.cell <= 0 ||
        !Number.isSafeInteger(layout.columns) || layout.columns <= 1 ||
        !Array.isArray(layout.motions) || layout.motions.length <= 1) return null;
    const names = new Set();
    for (const motion of layout.motions) {
      if (typeof motion.name !== "string" || names.has(motion.name) ||
          !Number.isSafeInteger(motion.frames) || motion.frames < 1 || motion.frames > layout.columns) return null;
      names.add(motion.name);
    }
    if (!["idle", "guide", "celebrate", "quiet", "drag"].every(name => names.has(name))) return null;
    return layout;
  } catch { return null; }
}

function applyTechmoMotion(target, name) {
  const layout = parseTechmoLayout(assistant.dataset?.techmoLayout);
  if (!target || !layout) return;
  const row = layout.motions.findIndex(motion => motion.name === name);
  if (row < 0) return;
  const motion = layout.motions[row];
  const timing = { idle: ["1.6s", "infinite"], guide: ["0.9s", "1"],
    celebrate: ["0.8s", "1"], quiet: ["2.4s", "infinite"], drag: ["0.5s", "infinite"] };
  target.setAttribute("data-motion", name);
  target.style?.setProperty("--techmo-sheet-width", `${layout.columns * 100}%`);
  target.style?.setProperty("--techmo-sheet-height", `${layout.motions.length * 100}%`);
  target.style?.setProperty("--techmo-row", `${row / (layout.motions.length - 1) * 100}%`);
  target.style?.setProperty("--techmo-frames", String(motion.frames));
  target.style?.setProperty("--techmo-end-x", `${motion.frames / (layout.columns - 1) * 100}%`);
  target.style?.setProperty("--techmo-duration", timing[name][0]);
  target.style?.setProperty("--techmo-iterations", timing[name][1]);
}

function updateTechmoMotion() {
  const motions = { idle: "idle", searching: "quiet", hold: "quiet", found: "celebrate", answer: "guide", error: "guide" };
  const motion = techmoDropCelebrating ? "celebrate" : motions[assistantState];
  applyTechmoMotion(assistant, assistant.dataset?.dragging === "true" ? "drag" : motion);
}

function celebrateTechmoDrop() {
  if (techmoDropTimer !== null) clearTimeout(techmoDropTimer);
  techmoDropCelebrating = true;
  updateTechmoMotion();
  techmoDropTimer = setTimeout(() => {
    techmoDropTimer = null;
    techmoDropCelebrating = false;
    updateTechmoMotion();
  }, celebrateMs);
}

function configureTechmoSprite(slot, image) {
  if (!image?.getAttribute?.("src")?.endsWith("/techmo-sprite.png")) return;
  const layout = parseTechmoLayout(assistant.dataset?.techmoLayout);
  const animated = layout && image.naturalWidth === layout.columns * layout.cell &&
    image.naturalHeight === layout.motions.length * layout.cell;
  const target = slot === pet ? assistant : loginPet;
  target?.setAttribute("data-sprite-layout", animated ? "animated" : "legacy");
  if (target === assistant) updateTechmoMotion();
  else applyTechmoMotion(target, target?.dataset?.pose || "guide");
}

// 상태가 바뀌면 앞서 예약한 답변 전환을 취소하고 말·점·동작을 함께 갱신한다.
function showAssistant(state, message) {
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
  assistantLine.textContent = message ?? line;
  assistantDots.hidden = state !== "searching";
  updateTechmoMotion();
  if (assistant.dataset?.dragging !== "true") techmoBubble();
}

// 찾음: 축하를 잠깐 보여 준 뒤 답변 표시로 넘어간다. 타이머가 없는 환경에서는 바로 넘어간다.
function celebrate(nextState = "answer", message, after, delay = celebrateMs) {
  showAssistant("found", message);
  if (typeof setTimeout !== "function") {
    showAssistant(nextState);
    after?.();
    return;
  }
  assistantTimer = setTimeout(() => {
    assistantTimer = null;
    showAssistant(nextState);
    after?.();
  }, delay);
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
  const pending = busy || (requestedChatView && Boolean(activeConversation?.pending));
  send.disabled = pending || (!input.value.trim() && !attached);
  photoClear.hidden = !attached;
  photoClear.disabled = pending;
  photoFile.disabled = pending;
  photoAttach.disabled = pending;
  reset.disabled = pending;
}

function setBusy(pending, message = "서버에 질문을 보내는 중…") {
  busy = pending;
  statusLine.textContent = pending ? message : "";
  reset.disabled = pending;
  for (const control of landingControls) control.disabled = pending;
  photoFile.disabled = pending;
  photoAttach.disabled = pending;
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

async function runPhotoRequest(record, message, work) {
  if (!record) return whileBusy(message, work);
  if (record.pending) return;
  record.pending = true;
  const account = historyAccount;
  if (record === activeConversation) statusLine.textContent = message;
  showAssistant("searching");
  updateSend(); renderConversations();
  for (const turn of record.turns || []) {
    for (const selector of [".reask", ".retry"]) {
      for (const button of turn.querySelectorAll(selector)) button.disabled = true;
    }
  }
  try {
    const succeeded = await work();
    if (account !== historyAccount || !conversations.includes(record)) return;
    if (!requestedChatView || activeConversation !== record || document.hidden) {
      if (succeeded) notifyConversation(record);
      else record.unread = true;
    }
  } finally {
    record.pending = false;
    for (const turn of record.turns || []) {
      for (const selector of [".reask", ".retry"]) {
        for (const button of turn.querySelectorAll(selector)) button.disabled = false;
      }
    }
    if (record === activeConversation) statusLine.textContent = "";
    updateSend(); renderConversations(); scrollToLatest();
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
  if (chatView) return;
  if (!selectedStudent) {
    void openStudents("먼저 가상 학생을 골라 주세요");
    return;
  }
  if (busy) return;
  const studentId = selectedStudent.id;
  const generation = studentGeneration;
  const current = () => generation === studentGeneration && selectedStudent?.id === studentId;
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
    const response = await fetch(`/api/v1/graduation-demo?student_id=${encodeURIComponent(studentId)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!current()) return;
    if (response.status === 404) {
      leaveStudent();
      void openStudents("먼저 가상 학생을 골라 주세요");
      return;
    }
    if (!response.ok) throw new Error("Graduation request failed");
    const result = await response.json();
    if (!current()) return;
    if (result?.profile?.id !== studentId) throw new Error("Student mismatch");
    reply.append(...graduationResult(result));
    const recommendations = biskitRecommendations(result.biskit_recommendations);
    if (recommendations) reply.append(recommendations);
    celebrate();
  } catch {
    if (!current()) return;
    const retry = element("button", "retry", "다시 시도");
    retry.type = "button";
    retry.addEventListener("click", () => { if (current()) void checkGraduation(); });
    const error = element("div", "error");
    error.append(element("p", null, "졸업 체크 결과를 받지 못했어요."), retry);
    reply.replaceChildren(error);
    showAssistant("error");
  } finally {
    setBusy(false);
    if (current()) turn.scrollIntoView?.({ block: "start" });
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
async function answerFromText(question, recognized, answer, record = null) {
  const account = historyAccount;
  statusLine.textContent = photoMessages.asking;
  photoNote.textContent = "";
  answer.replaceChildren();

  const { result, failure, status } = await requestJson("/api/v1/photo-question", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ question, recognized_text: recognized, session_id: record ? record.sessionId || null : sessionId }),
    signal: AbortSignal.timeout(90_000),
  }, photoMessages.textFailed);

  if (record && (account !== historyAccount || !conversations.includes(record))) return false;
  let message = failure;
  if (!failure) {
    try {
      const [node, summary] = textAnswer(result);
      answer.append(node);
      photoNote.textContent = summary;
      if (result.kind === "hold") showAssistant("hold");
      else celebrate();
      return true;
    } catch {
      message = photoMessages.textFailed;
    }
  }
  // 서버가 글자 자체를 거절하면(422) 같은 글자를 다시 보내도 결과가 같아 다시 시도 버튼을 두지 않는다.
  const rejected = status === 422;
  if (rejected) message = photoMessages.textRejected;
  answer.replaceChildren(failureBox(
    message,
    rejected ? null : () => void runPhotoRequest(record, photoMessages.asking, () => answerFromText(question, recognized, answer, record)),
  ));
  photoNote.textContent = message;
  showAssistant("error");
}

// 읽은 글자를 고치는 칸. 판독문은 입력 칸의 값으로만 넣어 일반 글자로 남는다.
// 다시 물을 때는 사진 없이 두 칸의 글자만 보내고, 결과는 같은 답변 자리(answer)에 바꿔 그린다.
function readingPanel(recognized, question, answer, notes, record = null) {
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
  reask.disabled = busy || Boolean(record?.pending);
  reask.addEventListener("click", () => {
    if (busy || record?.pending) return;
    const nextQuestion = questionBox.value.trim();
    const nextRecognized = textBox.value.trim();
    const problem = textProblem(nextQuestion, nextRecognized);
    problemLine.textContent = problem ?? "";
    if (problem) return;
    void runPhotoRequest(record, photoMessages.asking, () => answerFromText(nextQuestion, nextRecognized, answer, record));
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
function photoReading(result, question, record = null) {
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
      panel: readingPanel(recognized, question, answer, [], record),
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
      panel: readingPanel(recognized, question, answer, explained, record),
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
    panel: readingPanel(recognized, question, answer, [], record),
    summary: problem === photoMessages.tooLong ? photoMessages.tooLong : "사진에서 확인한 내용이 없어요. 링크는 보여 주지 않아요.",
    pending: null,
  };
}

// photo는 파일에서 바이트만 잘라 낸 값이라 파일명이 없다. 본문에 그대로 싣고 형식은 Content-Type으로 알린다.
// 사진은 여기서 한 번만 보낸다. 행사가 확인되지 않으면 읽은 글자만 글자 주소로 넘긴다.
async function readPhoto(photo, type, question, reply, record = null) {
  const account = historyAccount;
  statusLine.textContent = photoMessages.reading;
  photoNote.textContent = "";
  reply.replaceChildren();

  const { result, failure, status } = await requestJson("/api/v1/photo-input", {
    method: "POST",
    headers: { "Content-Type": type, Accept: "application/json" },
    body: photo,
    signal: AbortSignal.timeout(60_000),
  }, photoMessages.photoFailed);

  if (record && (account !== historyAccount || !conversations.includes(record))) return false;
  let message = failure;
  if (!failure) {
    let shown = null;
    try {
      shown = photoReading(result, question, record);
    } catch {
      message = photoMessages.photoFailed;
    }
    if (shown) {
      reply.append(shown.answer, shown.panel);
      photoNote.textContent = shown.summary;
      // 글자 주소로 이어서 물으면 그 결과가 비서 상태를 정한다. 여기서 끝나면 확정은 찾음, 나머지는 보류다.
      if (shown.pending) return await answerFromText(shown.pending.question, shown.pending.recognized, shown.answer, record);
      else if (result.event_match === "confirmed") celebrate();
      else showAssistant("hold");
      return true;
    }
  }
  // 사진 자체가 거절된 경우(413·415·422)는 같은 사진을 다시 보내도 결과가 같아 다시 시도 버튼을 두지 않는다.
  const rejected = Object.hasOwn(photoRejections, status ?? "");
  if (rejected) message = photoRejections[status];
  reply.replaceChildren(failureBox(
    message,
    rejected ? null : () => void runPhotoRequest(record, photoMessages.reading, () => readPhoto(photo, type, question, reply, record)),
  ));
  photoNote.textContent = message;
  showAssistant("error");
}

async function ask(question, reply, record = activeConversation) {
  if (record?.pending) return;
  const account = historyAccount;
  if (record) record.pending = true;
  else setBusy(true);
  showAssistant("searching");
  updateSend(); renderConversations();
  reply.replaceChildren();
  try {
    const response = await fetch("/api/v1/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, session_id: record ? record.sessionId || null : sessionId,
        use_academic_data: false }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) throw new Error("Chat request failed");
    const result = await response.json();
    if (record && (account !== historyAccount || !conversations.includes(record))) return;
    if (record) record.sessionId = result.session_id;
    else sessionId = result.session_id;
    const text = result.answered ? result.answer : "이 질문은 가상 규정에서 근거를 찾지 못했어요.";
    reply.append(element("p", result.answered ? null : "fallback", text));
    const citations = result.answered && Array.isArray(result.citations) ? result.citations : [];
    for (const citation of citations) reply.append(citationCard(citation));
    if (record) {
      record.messages.push({ role: "answer", text, time: Date.now(), sources: citations.map(citation => ({
        title: citation.document + " · " + citation.article_path, url: citation.source_url,
      })) });
      record.messages = record.messages.slice(-40);
      record.time = Date.now(); record.saved = true;
      record.committedMessages = [
        ...(record.committedMessages || []),
        { role: "question", text: question, time: record.time, sources: [] },
        record.messages[record.messages.length - 1],
      ].slice(-40);
      if (!requestedChatView || activeConversation !== record || document.hidden) notifyConversation(record);
      else if (result.answered) celebrate();
      else showAssistant("hold");
      persistConversations();
    } else if (result.answered) celebrate();
    else showAssistant("hold");
  } catch {
    if (record && (account !== historyAccount || !conversations.includes(record))) return;
    const retry = element("button", "retry", "다시 시도");
    retry.type = "button";
    retry.addEventListener("click", () => {
      if (busy || record?.pending) return;
      input.focus(); void ask(question, reply, record);
    });
    const error = element("div", "error");
    error.append(element("p", null, "서버 응답을 받지 못했어요."), retry);
    reply.replaceChildren(error);
    if (record && (!requestedChatView || activeConversation !== record)) {
      record.unread = true;
      persistConversations();
    }
    else showAssistant("error");
  } finally {
    if (record) record.pending = false;
    else setBusy(false);
    renderConversations(); updateSend(); scrollToLatest();
  }
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
  if (busy || (requestedChatView && activeConversation?.pending) || (!question && !file)) return;
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

  if (!activeConversation || Boolean(activeConversation.photo) !== Boolean(file) || !requestedChatView) {
    activeConversation = { id: `conversation-${Date.now()}-${++conversationSequence}`, time: Date.now(),
      title: Array.from(question).slice(0, 29).join(""), messages: [], turns: [], photo: Boolean(file), unread: false };
    conversations.unshift(activeConversation);
    conversations = conversations.sort((a, b) => b.time - a.time).slice(0, 20);
    if (chatView && requestedChatView) renderActiveConversation();
  }
  const record = activeConversation;
  record.messages.push({ role: "question", text: question, time: Date.now(), sources: [] });
  record.messages = record.messages.slice(-40);
  if (!chatView || !requestedChatView) setChatView(true);
  const turn = element("div", "turn");
  const prompt = element("p", "question");
  prompt.append(element("span", "sr-only", "내 질문: "));
  if (question) prompt.append(document.createTextNode(question));
  // 파일명은 화면에 적지 않는다. 사진을 붙였다는 사실만 보여 준다.
  if (file) prompt.append(element("span", "attachment", "사진 1장"));
  const reply = element("div", file ? "reply photo" : "reply");
  turn.append(prompt, reply);
  record.turns.push(turn);
  if (record.turns.length > 20) record.turns.shift().remove();
  if (chatView && requestedChatView) {
    empty.remove();
    transcript.append(turn);
  }
  renderConversations();
  input.value = "";
  photoNote.textContent = "";
  scrollToLatest();
  if (!file) {
    void ask(question, reply, record);
    return;
  }
  // 바이트만 잘라 내 들고, 고른 파일은 바로 비운다. 남겨 두면 다음 질문에 같은 사진이 또 실린다.
  const photo = file.slice(0, file.size, file.type);
  const type = file.type;
  photoFile.value = "";
  void runPhotoRequest(record, photoMessages.reading, () => readPhoto(photo, type, question, reply, record));
});

// 클립 버튼은 숨긴 파일 입력의 창을 연다. 요청 중에는 버튼이 잠겨 있지만 한 번 더 막는다.
photoAttach.addEventListener("click", () => {
  if (busy || (requestedChatView && activeConversation?.pending)) return;
  photoFile.click();
});
photoFile.addEventListener("change", () => {
  photoNote.textContent = "";
  updateSend();
});
photoClear.addEventListener("click", () => {
  if (busy || (requestedChatView && activeConversation?.pending)) return;
  photoFile.value = "";
  photoNote.textContent = "";
  updateSend();
});

reset.addEventListener("click", () => {
  if (busy || (requestedChatView && activeConversation?.pending)) return;
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
  // 숨긴 파일 입력은 초점을 받지 못하므로 초점은 클립 버튼에 둔다. 파일 창은 여기서 한 번만 연다.
  photo: () => { photoAttach.focus(); photoFile.click(); },
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

// 좌표는 버튼 테두리의 왼쪽 위를 기준으로 한다. 저장할 때만 화면 크기로 나눈다.
function techmoClampPosition(position, viewport, size) {
  return {
    x: Math.max(8, Math.min(position.x, viewport.width - size.width - 8)),
    y: Math.max(8, Math.min(position.y, viewport.height - size.height - 8)),
  };
}
function techmoPositionRatio(position, viewport) {
  return { x: position.x / viewport.width, y: position.y / viewport.height };
}
function techmoRestorePosition(ratio, viewport, size) {
  if (!ratio || ![ratio.x, ratio.y].every(value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1)) return null;
  return techmoClampPosition({ x: ratio.x * viewport.width, y: ratio.y * viewport.height }, viewport, size);
}
const techmoPositionKey = "kumoh-techmo-position:v1";
let techmoRatio = null;
let techmoPointer = null;
let techmoFrame = null;
let techmoSuppressClick = false;
const techmoViewport = () => ({ width: window.innerWidth, height: window.innerHeight });
const techmoSize = () => {
  const rect = pet.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
};
function techmoBubble() {
  if (!techmoPosition || !pet.getBoundingClientRect) return;
  const viewport = techmoViewport();
  const size = techmoSize();
  const right = techmoPosition.x + size.width / 2 < viewport.width / 2;
  const below = techmoPosition.y < 120;
  assistant.dataset.facing = right ? "right" : "left";
  assistant.dataset.bubbleRight = String(right);
  assistant.dataset.bubbleBelow = String(below);
  const bubble = assistantLine?.parentElement;
  const width = Math.min(240, viewport.width - 16);
  assistant.style?.setProperty("--techmo-bubble-width", `${width}px`);
  const height = bubble?.getBoundingClientRect?.().height || 64;
  const x = right ? techmoPosition.x + size.width + 12 : techmoPosition.x - width - 12;
  const y = below ? techmoPosition.y + size.height + 12 : techmoPosition.y - height - 12;
  assistant.style?.setProperty("--techmo-bubble-x", `${Math.max(8, Math.min(x, viewport.width - width - 8)) - techmoPosition.x}px`);
  assistant.style?.setProperty("--techmo-bubble-y", `${Math.max(8, Math.min(y, viewport.height - height - 8)) - techmoPosition.y}px`);
}
function techmoDrawPosition() {
  techmoFrame = null;
  if (!techmoPosition) return;
  assistant.style?.setProperty("--techmo-x", `${techmoPosition.x}px`);
  assistant.style?.setProperty("--techmo-y", `${techmoPosition.y}px`);
}
function techmoPlace(position) {
  const size = techmoSize();
  techmoPosition = techmoClampPosition(position, techmoViewport(), size);
  if (assistant.dataset.placed !== "true") {
    assistant.style?.setProperty("--techmo-pet-size", `${size.width}px`);
    assistant.style?.setProperty("--techmo-pet-height", `${size.height}px`);
    assistant.dataset.placed = "true";
  }
}
function techmoDefaultPosition() {
  techmoPosition = null;
  techmoRatio = null;
  delete assistant.dataset.placed;
  delete assistant.dataset.facing;
  for (const name of ["x", "y", "pet-size", "pet-height", "bubble-x", "bubble-y", "bubble-width"]) assistant.style?.removeProperty(`--techmo-${name}`);
}
function techmoSavePosition() {
  try {
    const storage = historyStorage();
    if (!storage) throw new Error("Position storage unavailable");
    techmoRatio = techmoPositionRatio(techmoPosition, techmoViewport());
    storage.setItem(techmoPositionKey, JSON.stringify(techmoRatio));
  } catch { techmoDefaultPosition(); }
}
function techmoEndPointer(cancelled) {
  const pointer = techmoPointer;
  if (!pointer) return;
  techmoPointer = null;
  if (techmoFrame !== null) window.cancelAnimationFrame?.(techmoFrame);
  techmoFrame = null;
  assistant.dataset.dragging = "false";
  document.body?.removeAttribute?.("data-techmo-dragging");
  if (pointer.dragged) {
    techmoSuppressClick = true;
    if (cancelled) {
      if (pointer.original) techmoPlace(pointer.original);
      else techmoDefaultPosition();
    } else techmoSavePosition();
    techmoDrawPosition();
    techmoBubble();
    if (!cancelled) celebrateTechmoDrop();
  }
  updateTechmoMotion();
  if (pet.hasPointerCapture?.(pointer.id)) pet.releasePointerCapture?.(pointer.id);
}
pet.addEventListener("pointerdown", event => {
  if (techmoPointer || event.isPrimary === false || (event.button !== undefined && event.button !== 0) || !pet.getBoundingClientRect) return;
  techmoSuppressClick = false;
  const rect = pet.getBoundingClientRect();
  techmoPointer = { id: event.pointerId, x: event.clientX, y: event.clientY,
    start: { x: rect.left, y: rect.top }, original: techmoPosition && { ...techmoPosition }, dragged: false };
  pet.setPointerCapture?.(event.pointerId);
});
function techmoMovePointer(event) {
  const pointer = techmoPointer;
  if (!pointer || pointer.id !== event.pointerId) return;
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  if (!pointer.dragged && Math.hypot(dx, dy) <= 6) return;
  if (!pointer.dragged) {
    pointer.dragged = true;
    assistant.dataset.dragging = "true";
    document.body?.setAttribute("data-techmo-dragging", "true");
    updateTechmoMotion();
  }
  techmoPlace({ x: pointer.start.x + dx, y: pointer.start.y + dy });
  event.preventDefault?.();
  if (techmoFrame === null) {
    if (window.requestAnimationFrame) techmoFrame = window.requestAnimationFrame(techmoDrawPosition);
    else techmoDrawPosition();
  }
}
pet.addEventListener("pointermove", techmoMovePointer);
pet.addEventListener("pointerup", event => {
  if (techmoPointer?.id !== event.pointerId) return;
  techmoMovePointer(event);
  techmoEndPointer(false);
});
for (const name of ["pointercancel", "lostpointercapture"]) pet.addEventListener(name, event => {
  if (techmoPointer?.id === event.pointerId) techmoEndPointer(true);
});
pet.addEventListener("click", event => {
  if (techmoSuppressClick) {
    techmoSuppressClick = false;
    event.preventDefault?.();
    return;
  }
  startNewConversation();
});
pet.addEventListener("keydown", event => {
  techmoSuppressClick = false;
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (event.key === "Home") {
    event.preventDefault();
    try { historyStorage()?.removeItem(techmoPositionKey); } catch { /* 기본 자리는 저장소 없이도 돌아간다. */ }
    techmoDefaultPosition();
    return;
  }
  if (!Object.hasOwn(arrows, event.key) || !pet.getBoundingClientRect) return;
  event.preventDefault();
  const rect = pet.getBoundingClientRect();
  const step = event.shiftKey ? 64 : 16;
  const [dx, dy] = arrows[event.key];
  techmoPlace({ x: rect.left + dx * step, y: rect.top + dy * step });
  techmoSavePosition();
  techmoDrawPosition();
  techmoBubble();
});
function restoreTechmoPosition() {
  if (!techmoRatio || !pet.getBoundingClientRect) return;
  const size = techmoSize();
  if (size.width <= 0 || size.height <= 0) return;
  const position = techmoRestorePosition(techmoRatio, techmoViewport(), size);
  if (position) { techmoPlace(position); techmoDrawPosition(); techmoBubble(); }
}
window.addEventListener?.("resize", restoreTechmoPosition);
try {
  const saved = historyStorage()?.getItem(techmoPositionKey);
  if (saved) {
    const ratio = JSON.parse(saved);
    const position = techmoRestorePosition(ratio, techmoViewport(), { width: 0, height: 0 });
    if (position) techmoRatio = ratio;
  }
} catch { techmoDefaultPosition(); }

// 로고, 첫 화면의 테크모, 펫 버튼은 숨긴 채 시작하고, 안에 든 그림이 실제로 받아졌을 때만 보인다.
// 펫은 스프라이트 시트를 배경으로 그리는데 배경 그림은 로드 신호를 주지 않아, 같은 주소의 그림을 버튼 안에 두고 그 신호를 본다.
// complete와 naturalWidth를 함께 보므로 이 스크립트가 로드·실패 신호보다 늦게 실행돼도 결과가 같다.
// 파일이 없거나(404) 깨졌으면 자리를 숨긴 채 두고, 다른 그림으로 바꾸지 않는다.
for (const slot of document.querySelectorAll?.("[data-brand-slot]") ?? []) {
  const image = slot.querySelector("img");
  if (!image) continue;
  const settle = () => {
    slot.hidden = !(image.complete && image.naturalWidth > 0);
    configureTechmoSprite(slot, image);
    if (slot === pet && !slot.hidden) restoreTechmoPosition();
  };
  image.addEventListener("load", settle);
  image.addEventListener("error", settle);
  settle();
}

updateSend();
if (window.location?.hash === "#chat") {
  window.history?.replaceState(null, "", window.location.pathname + window.location.search);
}
switchHistoryAccount("browse");
void restoreStudent();

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

// 그래픽 준비가 실패해도 다른 화면 기능은 계속 초기화한다.
async function initializeCampusBackdrop() {
  const canvas = document.querySelector("#campus-canvas");
  if (!canvas || typeof canvas.getContext !== "function" || reducedMotion() ||
      typeof window.requestAnimationFrame !== "function" || typeof createImageBitmap !== "function") return;
  let gl;
  let program = null;
  let buffer = null;
  let frame = null;
  let stopped = false;
  const bitmaps = [];
  const textures = [];
  const caption = document.querySelector("#campus-caption");
  const label = document.querySelector("#campus-name");
  const progressBar = document.querySelector("#campus-progress");
  let progressSteps = [];
  const fail = () => {
    stopped = true;
    if (frame !== null) window.cancelAnimationFrame?.(frame);
    frame = null;
    canvas.hidden = true;
    if (caption) caption.hidden = true;
    for (const bitmap of bitmaps) bitmap.close?.();
    if (gl) {
      for (const texture of textures) gl.deleteTexture(texture);
      if (buffer) gl.deleteBuffer?.(buffer);
      if (program) gl.deleteProgram?.(program);
    }
  };
  try {
    gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false });
    if (!gl || !gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision) return;
    const vertex = "attribute vec2 p; varying vec2 v; void main(){v=(p+1.0)*0.5;gl_Position=vec4(p,0.0,1.0);}";
    const fragment = `precision highp float;
      varying vec2 v; uniform sampler2D a,b; uniform float mixv,t,aspect,imgAspect,panA,panB,still;
      uniform vec3 drops[16];
vec2 cover(vec2 uv, float pan){ float win=min(1.0,aspect/imgAspect)*0.94;
  float x=mix(0.5*win,1.0-0.5*win,pan)+(uv.x-0.5)*win; return vec2(x,0.5+(uv.y-0.5)*0.94); }
void main(){ vec2 uv=v; vec2 off=vec2(0.0); float light=0.0;
  for(int i=0;i<16;i++){ float age=t-drops[i].z; if(age<0.0||age>1.8) continue;
    vec2 d=uv-drops[i].xy; d.x*=aspect; float r=length(d)+1e-4; float front=age*0.085;
    float env=exp(-age*2.2)*smoothstep(0.075,0.0,abs(r-front))*smoothstep(0.0,0.012,r);
    float w=cos((r-front)*70.0)*env; off+=(d/r)*w*0.0075; light+=w; }
  off+=still*0.0008*vec2(sin(uv.y*18.0+t*0.9),cos(uv.x*14.0-t*0.7));
  uv+=off; uv.y=1.0-uv.y;
  vec3 c=mix(texture2D(a,cover(uv,panA)).rgb,texture2D(b,cover(uv,panB)).rgb,mixv);
  c+=vec3(0.70,0.92,1.0)*max(light,0.0)*0.10; c-=vec3(0.08,0.06,0.03)*max(-light,0.0)*0.18;
  gl_FragColor=vec4(c,1.0); }`;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error("shader"); }
      return shader;
    };
    program = gl.createProgram();
    const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, fragment)];
    for (const shader of shaders) gl.attachShader(program, shader);
    gl.linkProgram(program);
    for (const shader of shaders) gl.deleteShader(shader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("program");
    gl.useProgram(program);
    buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program,"p");
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const photos = [
      ["campus-aerial.jpg","양호동 캠퍼스"], ["campus-hill.jpg","디지털관과 금오산 자락"],
      ["campus-gate.jpg","정문의 밤"], ["campus-field.jpg","대운동장의 저녁"],
    ];
    const photoStates = photos.map(() => "pending");
    const skippedPending = new Set();
    const readyIndices = () => photos.map((_, index) => index).filter(index => photoStates[index] === "ready");
    const refreshProgress = () => {
      progressSteps = readyIndices().map(index => {
        const step = document.createElement("span");
        step.setAttribute("data-campus-step", String(index));
        return { index, step };
      });
      progressBar?.replaceChildren(...progressSteps.map(({ step }) => step));
    };
    // 준비 중인 파일을 처음 만나면 그 주기만 기다리고, 다음 주기에는 받은 사진끼리 이어 간다.
    const nextPhoto = current => {
      for (let offset = 1; offset < photos.length; offset++) {
        const index = (current + offset) % photos.length;
        if (photoStates[index] === "failed") continue;
        if (photoStates[index] === "ready") return index;
        if (skippedPending.has(index)) continue;
        skippedPending.add(index);
        return null;
      }
      return null;
    };
    const uniforms = Object.fromEntries(["a","b","mixv","t","aspect","imgAspect","panA","panB","still","drops[0]"].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.uniform1i(uniforms.a,0); gl.uniform1i(uniforms.b,1);
    // 사진마다 1920×280인지 확인한 뒤에만 이 공통 비율로 그린다.
    gl.uniform1f(uniforms.imgAspect,1920/280); gl.uniform1f(uniforms.still,1);
    const drops = new Float32Array(48);
    for (let i=0;i<16;i++) drops[i*3+2]=-1000;
    const HOLD = 9;
    const FADE = 3.2;
    const period = HOLD + FADE;
    const life = HOLD + 2 * FADE;
    const clamp = value => Math.max(0, Math.min(1, value));
    const pan = (number, local) => {
      const progress = clamp(local / life);
      return number % 2 === 0 ? 0.28 + progress * 0.44 : 0.72 - progress * 0.44;
    };
    let cycleNumber = 0;
    let photoNumber = 0;
    let appearedAt = -FADE;
    let currentPhoto = null;
    let fadingPhoto = null;
    let fadeDecided = false;
    let singleStartedAt = null;
    let singlePhase = 0;
    let dropIndex = 0;
    let elapsed = 0;
    let previous = null;
    let automatic = 0;
    let lastPointer = -Infinity;
    let lastX = 0;
    let lastY = 0;
    const drop = (x, y) => {
      const index = (dropIndex++ % 16) * 3;
      drops[index] = x;
      drops[index + 1] = y;
      drops[index + 2] = elapsed;
    };
    const pointer = event => {
      if (stopped || reducedMotion() || document.hidden) return;
      const tooSoon = elapsed * 1000 - lastPointer < 70;
      const tooClose = Math.hypot(event.clientX - lastX, event.clientY - lastY) < 26;
      if (event.type === "pointermove" && (tooSoon || tooClose)) return;
      lastPointer = elapsed * 1000;
      lastX = event.clientX;
      lastY = event.clientY;
      drop(event.clientX / window.innerWidth, 1 - event.clientY / window.innerHeight);
    };
    // 먼저 받는 단계에서 들어야 입력란이나 패널이 전파를 멈춰도 포인터 자리에 물결을 남긴다.
    window.addEventListener("pointermove", pointer, { passive: true, capture: true });
    window.addEventListener("pointerdown", pointer, { passive: true, capture: true });
    const draw = timestamp => {
      try {
      frame=null;
      if (document.hidden) { previous=null; return; }
      if (reducedMotion()) { fail(); return; }
      if (previous !== null) elapsed+=(timestamp-previous)/1000;
      previous=timestamp;
      while (automatic<3 && elapsed >= [0.3,0.9,1.5][automatic]) { drop([0.25,0.67,0.44][automatic],[0.65,0.42,0.25][automatic]); automatic++; }
      const ratio=Math.min(window.devicePixelRatio||1,1.5);
      const width=Math.max(1,Math.round(window.innerWidth*ratio)), height=Math.max(1,Math.round(window.innerHeight*ratio));
      if (canvas.width!==width || canvas.height!==height) { canvas.width=width; canvas.height=height; gl.viewport(0,0,width,height); }
      if (currentPhoto === null) currentPhoto = readyIndices()[0];
      const cycle = Math.floor(elapsed / period);
      while (cycleNumber < cycle) {
        const next = fadeDecided ? fadingPhoto : nextPhoto(currentPhoto);
        if (next !== null) {
          currentPhoto = next;
          photoNumber++;
          appearedAt = cycleNumber * period + HOLD;
          singleStartedAt = null;
        }
        cycleNumber++;
        fadingPhoto = null;
        fadeDecided = false;
      }
      const phase = elapsed - cycle * period;
      if (phase >= HOLD && !fadeDecided) {
        fadingPhoto = nextPhoto(currentPhoto);
        fadeDecided = true;
      }
      const progress = fadingPhoto !== null ? clamp((phase - HOLD) / FADE) : 0;
      const mix = progress * progress * (3 - 2 * progress);
      gl.uniform1f(uniforms.mixv, mix);
      gl.uniform1f(uniforms.t,elapsed);
      gl.uniform1f(uniforms.aspect,width/height);
      let currentPan = pan(photoNumber, elapsed - appearedAt);
      // 늦게 도착한 사진이 있어도 현재 사진의 왕복 흐름은 전환이 끝날 때까지 이어 간다.
      if (singleStartedAt !== null || readyIndices().length === 1) {
        if (singleStartedAt === null) {
          singleStartedAt = elapsed;
          singlePhase = Math.acos(Math.max(-1, Math.min(1, (0.5 - currentPan) / 0.22)));
        }
        const local = (elapsed - singleStartedAt) / life;
        currentPan = 0.5 - 0.22 * Math.cos(singlePhase + local * Math.PI);
      }
      gl.uniform1f(uniforms.panA, currentPan);
      gl.uniform1f(uniforms.panB, pan(photoNumber + 1, phase - HOLD));
      gl.uniform3fv(uniforms["drops[0]"],drops);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,textures[currentPhoto]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,textures[fadingPhoto ?? currentPhoto]);
      gl.drawArrays(gl.TRIANGLES,0,6);
      const shownIndex = mix > 0.5 ? fadingPhoto : currentPhoto;
      if (label) label.textContent = photos[shownIndex][1];
      for (const { index, step } of progressSteps) step.setAttribute("data-current", String(index === shownIndex));
      if (caption) caption.hidden = false;
      canvas.hidden=false;
      frame=window.requestAnimationFrame(draw);
      } catch { fail(); }
    };
    document.addEventListener("visibilitychange",()=>{
      if (document.hidden) { if(frame!==null) window.cancelAnimationFrame(frame); frame=null; previous=null; }
      else if(!stopped && frame===null && readyIndices().length && !reducedMotion()) frame=window.requestAnimationFrame(draw);
    });
    canvas.addEventListener("webglcontextlost",event=>{event.preventDefault();fail();});
    const loadTexture = async index => {
      let bitmap;
      let texture;
      try {
        const response = await fetch(`/chat-assets/${photos[index][0]}`);
        if (!response.ok) throw new Error("photo");
        bitmap = await createImageBitmap(await response.blob());
        if (bitmap.width !== 1920 || bitmap.height !== 280) throw new Error("photo dimensions");
        if (stopped) { bitmap.close?.(); return; }
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, bitmap);
        textures[index] = texture;
        bitmaps.push(bitmap);
        photoStates[index] = "ready";
        skippedPending.delete(index);
        refreshProgress();
        if (!document.hidden && frame === null) frame = window.requestAnimationFrame(draw);
      } catch {
        bitmap?.close?.();
        if (texture) gl.deleteTexture(texture);
        photoStates[index] = "failed";
      }
      if (!stopped && photoStates.every(state => state === "failed")) fail();
    };
    void Promise.allSettled(photos.map((_, index) => loadTexture(index)));
  } catch { fail(); }
}
void initializeCampusBackdrop();
