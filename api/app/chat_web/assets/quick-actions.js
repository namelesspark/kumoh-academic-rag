// 빠른 실행 링(#137). 입력 줄 맨 앞의 + 버튼을 누르면 자주 쓰는 기능 다섯 개가 방울처럼 이어진 채 펼쳐진다.
// chat.js 다음에 불리며, 새 기능을 만들지 않고 이미 있는 버튼을 대신 누른다. 사진 질문은 #photo-attach,
// 손글씨는 #handwriting-button, 학사 기능은 첫 화면의 [data-feature] 카드다. 시연 계정 확인은 카드가 맡는다.
//
// 층은 둘이다. 방울 층(SVG)의 원에만 goo 필터(흐림 stdDeviation 10, 알파 행 0 0 0 19 -9)를 걸어 가까운 원끼리
// 이어 보이게 하고, 아이콘·이름·초점 고리는 필터 밖 버튼 층에 둔다. 넓은 화면은 + 둘레에 방사형으로,
// 좁은 화면(480px 이하)은 엄지 위쪽 반원 호로 놓고 화면 밖으로 나가면 묶음째 안쪽으로 민다.
// 움직임은 quick-actions.css의 transition이 맡아 도중에 닫아도 그 자리에서 되돌아간다. 동작 줄이기 설정에서는 끈다.
// 질문 칸(textarea)에는 아무것도 덮거나 붙이지 않는다. iPad 손글씨 입력(Scribble)이 그 칸에서 그대로 동작한다.
(() => {
  "use strict";
  const doc = document;
  const row = doc.querySelector(".composer-row");
  if (!row || typeof doc.createElementNS !== "function" || typeof row.insertBefore !== "function" || !doc.body) return;

  // 문구 사전. chat.js의 사전과 따로 두고, <html lang>이 바뀌면 이 표로 다시 쓴다.
  const text = {
    ko: { toggle: "빠른 실행", calendar: "학사 일정", graduation: "졸업 체크", biskit: "BISKIT", photo: "사진 질문", handwriting: "손글씨 입력" },
    en: { toggle: "Quick actions", calendar: "Academic calendar", graduation: "Graduation check", biskit: "BISKIT", photo: "Ask with a photo", handwriting: "Handwriting" },
    zh: { toggle: "快捷操作", calendar: "学事日程", graduation: "毕业检查", biskit: "BISKIT", photo: "拍照提问", handwriting: "手写输入" },
  };
  const svgNs = "http://www.w3.org/2000/svg";
  // 아이콘은 24칸 선 그림이다. 졸업 체크·BISKIT·손글씨는 화면의 카드·펜 버튼과 같은 그림을 쓴다.
  const actions = [
    { id: "calendar", feature: "calendar", paths: ["M5 6.5h14v13H5Z", "M5 10.5h14", "M9 4v4.5M15 4v4.5"] },
    { id: "graduation", feature: "graduation", paths: ["M5.2 16.5a8 8 0 1 1 13.6 0", "m8.6 12.4 2.5 2.5 4.5-5", "M4 19.5h16"] },
    { id: "biskit", feature: "biskit", paths: ["M7.5 6.5H11l3 4.2M7.5 17.5H11l3-4.2", "M11 6.5v11"], circles: [[5.5, 6.5, 2], [5.5, 17.5, 2], [18, 12, 2.6]] },
    { id: "photo", selector: "#photo-attach", paths: ["M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z"], circles: [[12, 13, 3.2]] },
    { id: "handwriting", selector: "#handwriting-button", paths: ["M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16Z", "m13.5 6.5 4 4"] },
  ];
  // 카드는 채팅 화면에서 문서 밖으로 빠지므로 처음 한 번 찾아 둔다. chat.js도 같은 때 카드를 기억해 둔다.
  const cards = new Map(actions.filter(action => action.feature)
    .map(action => [action.feature, doc.querySelector(`[data-feature="${action.feature}"]`)]));
  // settleMs는 quick-actions.css의 방울 이동(220ms)과 마지막 방울의 출발 지연(16ms × 4)을 더한 값이다.
  const bubbleRadius = 26, hubRadius = 22, edge = 8, closeMs = 300, settleMs = 290, waitMs = 1500;

  const lang = () => {
    const value = String(doc.documentElement?.getAttribute?.("lang") || "").toLowerCase();
    return value.startsWith("en") ? "en" : value.startsWith("zh") ? "zh" : "ko";
  };
  const say = key => text[lang()][key];
  const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  const nextFrame = callback => (typeof window.requestAnimationFrame === "function"
    ? window.requestAnimationFrame(callback) : setTimeout(() => callback(Date.now()), 16));
  const svg = (name, attributes = {}) => {
    const node = doc.createElementNS(svgNs, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  };
  const icon = ({ paths = [], circles = [] }) => {
    const node = svg("svg", { viewBox: "0 0 24 24", width: 22, height: 22, "aria-hidden": "true", focusable: "false" });
    for (const d of paths) node.append(svg("path", { d }));
    for (const [cx, cy, r] of circles) node.append(svg("circle", { cx, cy, r }));
    return node;
  };
  const make = (tag, className) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    return node;
  };

  // + 버튼. 사진·펜 버튼과 같은 .attach-button이라 44px 조작 영역과 3:1 경계를 그대로 받는다.
  const toggle = make("button", "attach-button quick-toggle");
  toggle.type = "button";
  toggle.setAttribute("aria-haspopup", "menu");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "quick-ring-menu");
  toggle.append(icon({ paths: ["M12 5v14M5 12h14"] }));
  row.insertBefore(toggle, row.firstChild);
  row.setAttribute("data-quick-actions", "");

  // 링 전체는 body 바로 아래 고정 층이다. 유리 판(backdrop-filter)이 고정 위치의 기준을 바꾸지 않게 판 밖에 둔다.
  const ring = make("div", "quick-ring");
  ring.hidden = true;
  const blobs = svg("svg", { class: "quick-ring-blobs", "aria-hidden": "true", focusable: "false" });
  const filter = svg("filter", { id: "quick-ring-goo", x: 0, y: 0, width: "100%", height: "100%", filterUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" });
  filter.append(
    svg("feGaussianBlur", { in: "SourceGraphic", stdDeviation: 10, result: "blur" }),
    svg("feColorMatrix", { in: "blur", mode: "matrix", values: "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9", result: "goo" }),
    svg("feComposite", { in: "SourceGraphic", in2: "goo", operator: "atop" }),
  );
  const defs = svg("defs");
  defs.append(filter);
  const gooey = svg("g", { class: "quick-ring-goo", filter: "url(#quick-ring-goo)" });
  const hub = svg("circle", { class: "quick-ring-hub", r: hubRadius });
  gooey.append(hub);
  blobs.append(defs, gooey);
  const menu = make("div", "quick-ring-menu");
  menu.id = "quick-ring-menu";
  menu.setAttribute("role", "menu");
  const caption = make("p", "quick-ring-caption");
  caption.setAttribute("aria-hidden", "true");
  const entries = actions.map((action, index) => {
    const blob = svg("circle", { class: "quick-ring-blob", r: bubbleRadius });
    gooey.append(blob);
    const item = make("button", "quick-item");
    item.type = "button";
    item.tabIndex = -1;
    item.dataset.quickAction = action.id;
    item.setAttribute("role", "menuitem");
    const name = make("span", "sr-only quick-item-name");
    item.append(icon(action), name);
    menu.append(item);
    for (const node of [blob, item]) node.style.setProperty("--qa-index", String(index));
    return { action, blob, item, name };
  });
  // 가운데 원(hub)은 불투명해 그 아래 + 버튼의 × 표시를 가린다. 같은 자리 필터 밖 층에 × 그림만 다시 그린다.
  // 이 그림은 누름을 받지 않아(pointer-events: none) 누름은 그대로 아래 + 버튼이 받는다. 이름은 + 버튼이 읽힌다.
  const close = make("span", "quick-ring-close");
  close.setAttribute("aria-hidden", "true");
  close.append(icon({ paths: ["M12 5v14M5 12h14"] }));
  ring.append(blobs, close, menu, caption);
  doc.body.append(ring);

  let open = false, hideTimer = null, settleTimer = null, captionKey = null, waiting = 0, openedAt = null;
  const visible = () => entries.filter(entry => !entry.item.hidden);
  const enabled = () => visible().filter(entry => !entry.item.disabled);

  function label() {
    toggle.setAttribute("aria-label", say("toggle"));
    menu.setAttribute("aria-label", say("toggle"));
    for (const entry of entries) entry.name.textContent = say(entry.action.id);
    caption.textContent = say(captionKey ?? "toggle");
  }
  function target(action) {
    return action.feature ? cards.get(action.feature) ?? null : doc.querySelector(action.selector);
  }
  // 대상 버튼이 없으면 그 방울을 숨기고, 잠겨 있으면 방울도 잠근다. 열 때마다 다시 본다.
  function refresh() {
    for (const entry of entries) {
      const node = target(entry.action);
      entry.item.hidden = !node || node.hidden === true;
      const locked = Boolean(node?.disabled) || node?.getAttribute?.("aria-disabled") === "true";
      entry.item.disabled = locked;
      entry.blob.setAttribute("class", locked ? "quick-ring-blob is-disabled" : "quick-ring-blob");
      if (locked) entry.item.setAttribute("aria-disabled", "true");
      else entry.item.removeAttribute("aria-disabled");
    }
  }
  // 방울 자리. 화면 좌표(px)로 돌려준다. 묶음이 화면 가장자리 8px 안쪽에 들어오도록 통째로 민다.
  function layout(anchor, width, height, count) {
    const narrow = width <= 480;
    const radius = narrow ? 84 : 92;
    const [from, to] = narrow ? [180, 0] : [210, -30];
    const points = Array.from({ length: count }, (_, index) => {
      const degrees = count === 1 ? (from + to) / 2 : from + (to - from) * index / (count - 1);
      const angle = degrees * Math.PI / 180;
      return { x: anchor.x + radius * Math.cos(angle), y: anchor.y - radius * Math.sin(angle) };
    });
    const shift = (low, high, size) => (low < edge ? edge - low : high > size - edge ? size - edge - high : 0);
    const xs = points.map(point => point.x), ys = points.map(point => point.y);
    const dx = shift(Math.min(...xs) - bubbleRadius, Math.max(...xs) + bubbleRadius, width);
    const fit = shift(Math.min(...ys) - bubbleRadius, Math.max(...ys) + bubbleRadius, height);
    // 묶음을 옆으로 밀면 끝 방울이 + 버튼 위에 얹힐 수 있다. 그러면 +를 다시 눌러 닫으려던 손가락이 방울을 누른다.
    // + 버튼과 가로로 겹치는 방울이 있으면 묶음을 + 위로 들어 올린다. 위에 자리가 없으면(+가 화면 위쪽에 있으면)
    // + 아래로 내린다. 둘 다 화면을 넘으면(키보드가 올라와 높이가 낮을 때) 호 대신 + 옆에 한 줄로 늘어놓는다.
    const clear = bubbleRadius + hubRadius + 6;
    const covering = points.filter(point => Math.abs(point.x + dx - anchor.x) < clear);
    const inside = dy => Math.min(...ys) + dy - bubbleRadius >= edge - 0.5 && Math.max(...ys) + dy + bubbleRadius <= height - edge + 0.5;
    const up = Math.min(fit, ...covering.map(point => anchor.y - clear - point.y));
    const down = Math.max(fit, ...covering.map(point => anchor.y + clear - point.y));
    const shape = narrow ? "arc" : "radial";
    const moved = dy => ({ kind: shape, points: points.map(point => ({ x: point.x + dx, y: point.y + dy })) });
    if (!covering.length || inside(up)) return moved(up);
    if (inside(down)) return moved(down);
    // 한 줄: + 오른쪽(자리가 없으면 왼쪽)에 + 버튼과 6px 떨어뜨려 놓는다. 높이는 화면 안으로 맞춘다.
    const step = bubbleRadius * 2 + 4, span = (count - 1) * step;
    const y = Math.min(Math.max(anchor.y, edge + bubbleRadius), height - edge - bubbleRadius);
    const right = anchor.x + clear, left = anchor.x - clear - span;
    const start = right + span + bubbleRadius <= width - edge ? right : left - bubbleRadius >= edge ? left : null;
    if (start === null) return moved(fit);
    return { kind: "row", points: Array.from({ length: count }, (_, index) => ({ x: start + index * step, y })) };
  }
  function place() {
    const box = toggle.getBoundingClientRect();
    const anchor = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const width = window.innerWidth || doc.documentElement?.clientWidth || 360;
    const height = window.innerHeight || doc.documentElement?.clientHeight || 640;
    const shown = visible();
    const { kind, points } = layout(anchor, width, height, shown.length);
    // 삼각함수 오차(-1e-14 같은 값)가 CSS 값에 섞이지 않게 0.01px 단위로 자른다.
    const px = value => `${Math.round(value * 100) / 100 || 0}px`;
    ring.setAttribute("data-layout", kind);
    ring.style.setProperty("--qa-anchor-x", px(anchor.x));
    ring.style.setProperty("--qa-anchor-y", px(anchor.y));
    hub.setAttribute("cx", String(anchor.x));
    hub.setAttribute("cy", String(anchor.y));
    for (const entry of entries) {
      entry.blob.setAttribute("cx", String(anchor.x));
      entry.blob.setAttribute("cy", String(anchor.y));
      entry.blob.setAttribute("display", entry.item.hidden ? "none" : "inline");
    }
    shown.forEach((entry, index) => {
      for (const node of [entry.blob, entry.item]) {
        node.style.setProperty("--qa-x", px(points[index].x - anchor.x));
        node.style.setProperty("--qa-y", px(points[index].y - anchor.y));
      }
    });
    // 이름표는 묶음 맨 위 방울 위에 한 장만 둔다. 이름을 방울마다 달면 호 위에서 서로 겹친다.
    const top = Math.min(...points.map(point => point.y), anchor.y) - bubbleRadius - 10;
    const middle = points.reduce((sum, point) => sum + point.x, 0) / Math.max(1, points.length);
    ring.style.setProperty("--qa-caption-x", px(Math.min(width - 96, Math.max(96, middle))));
    ring.style.setProperty("--qa-caption-y", px(Math.max(edge + 28, top)));
  }
  function show(key) {
    captionKey = key;
    caption.textContent = say(key ?? "toggle");
  }
  function openRing(focusLast = false) {
    if (open) return;
    cancelWaiting();
    refresh();
    if (!enabled().length && !visible().length) return;
    open = true;
    if (hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; }
    ring.hidden = false;
    place();
    openedAt = toggle.getBoundingClientRect();
    toggle.setAttribute("aria-expanded", "true");
    show(null);
    const list = enabled();
    const first = focusLast ? list[list.length - 1] : list[0];
    first?.item.focus();
    if (first) show(first.action.id);
    // 닫힌 자리를 한 번 그린 뒤 열린 자리로 옮겨야 전환이 돈다. 동작 줄이기면 바로 연다.
    // 방울은 + 버튼 가운데에서 출발하므로, 다 펼쳐지기 전에는 누름을 받지 않는다(data-settled).
    // 그래야 +를 빠르게 두 번 눌러 닫을 때 두 번째 누름이 출발 중인 방울에 가지 않는다. 키보드 초점은 바로 받는다.
    if (reduced()) { ring.setAttribute("data-open", "true"); ring.setAttribute("data-settled", ""); return; }
    void ring.getBoundingClientRect?.();
    nextFrame(() => {
      if (!open) return;
      ring.setAttribute("data-open", "true");
      settleTimer = setTimeout(() => { settleTimer = null; if (open) ring.setAttribute("data-settled", ""); }, settleMs);
    });
  }
  function closeRing(restore = false) {
    if (!open) return;
    open = false;
    ring.removeAttribute("data-open");
    ring.removeAttribute("data-settled");
    if (settleTimer !== null) { clearTimeout(settleTimer); settleTimer = null; }
    toggle.setAttribute("aria-expanded", "false");
    show(null);
    if (restore) toggle.focus();
    if (hideTimer !== null) clearTimeout(hideTimer);
    // 바깥의 초점을 받지 못하는 곳(빈 자리·글자)을 눌러 닫으면 초점이 숨는 방울에 남는다. 숨기기 전에 + 버튼으로 옮긴다.
    const hide = () => {
      hideTimer = null;
      if (open) return;
      if (ring.contains(doc.activeElement)) toggle.focus();
      ring.hidden = true;
    };
    if (reduced()) { hide(); return; }
    hideTimer = setTimeout(hide, closeMs);
  }
  // 채팅 화면에서 방울을 고르면 모두 홈으로 돌아간 뒤, 홈 화면이 적용되고 대상(카드는 문서에 다시 붙은 뒤)이 준비되면 누른다.
  // 기다리는 동안 학생이 화면을 옮기거나(뒤로 가기·다른 곳 누르기) 링을 다시 열면 실행하지 않는다.
  function cancelWaiting() { waiting++; }
  function afterHome(node, fire) {
    if (doc.body.getAttribute("data-view") !== "chat") { fire(); return; }
    const home = doc.querySelector("#home-button");
    if (!home || home.hidden || home.disabled) return;
    const ticket = ++waiting;
    const started = Date.now();
    home.click();
    const check = () => {
      if (ticket !== waiting) return;
      const screen = doc.querySelector("#main-screen");
      if (screen?.hidden || Date.now() - started > waitMs) { cancelWaiting(); return; }
      if (doc.body.getAttribute("data-view") === "home" && node.isConnected !== false) {
        cancelWaiting();
        // 홈으로 오는 사이 대상이 잠기면(요청 중) 누르지 않는다.
        if (!node.disabled) fire();
        return;
      }
      nextFrame(check);
    };
    nextFrame(check);
  }
  function run(entry) {
    if (!open || entry.item.disabled || entry.item.hidden) return;
    const node = target(entry.action);
    // 링이 사라져도 초점이 갈 곳이 있게 먼저 + 버튼에 둔다. 카드는 패널 제목으로, 펜 버튼은 필기 칸으로 초점을 다시 옮긴다.
    closeRing(true);
    if (!node || node.disabled) return;
    afterHome(node, () => {
      // 사진 창을 닫으면 초점이 돌아올 자리가 있어야 한다. 줄에 보이는 클립 버튼이면 그쪽에 둔다.
      if (entry.action.id === "photo" && (typeof node.getClientRects !== "function" || node.getClientRects().length > 0)) node.focus();
      node.click();
    });
  }
  function step(from, delta) {
    const list = enabled();
    if (!list.length) return;
    const index = list.findIndex(entry => entry.item === from);
    const next = delta === "first" ? list[0] : delta === "last" ? list[list.length - 1]
      : list[((index < 0 ? 0 : index + delta) + list.length) % list.length];
    next.item.focus();
    show(next.action.id);
  }

  toggle.addEventListener("click", () => (open ? closeRing(true) : openRing()));
  toggle.addEventListener("keydown", event => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      if (open) step(null, event.key === "ArrowUp" ? "last" : "first");
      else openRing(event.key === "ArrowUp");
    } else if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation(); closeRing(true);
    }
  });
  menu.addEventListener("keydown", event => {
    const current = doc.activeElement;
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: "first", End: "last" };
    if (Object.hasOwn(keys, event.key)) { event.preventDefault(); step(current, keys[event.key]); return; }
    if (event.key === "Escape") {
      // 링만 닫는다. 문서의 Esc 처리기(필기 패드·서랍·메뉴)까지 올라가지 않게 막는다.
      event.preventDefault(); event.stopPropagation(); closeRing(true);
    // Tab은 막지 않는다. 초점을 + 버튼에 먼저 돌려 두면 브라우저가 거기서 다음(Shift면 앞) 칸으로 옮긴다.
    // 링은 body 끝에 있어 그대로 두면 초점이 문서 끝으로 건너뛴다.
    } else if (event.key === "Tab") closeRing(true);
    // 버튼은 Enter·Space를 누르면 click을 한 번 낸다. 길게 눌러 되풀이되는 키는 막아 두 번 실행하지 않는다.
    else if ((event.key === "Enter" || event.key === " ") && event.repeat) event.preventDefault();
  });
  for (const entry of entries) {
    entry.item.addEventListener("click", () => run(entry));
    entry.item.addEventListener("pointerenter", () => show(entry.action.id));
    entry.item.addEventListener("focus", () => show(entry.action.id));
  }
  // 바깥을 누르면 링만 닫는다. 누른 자리의 기본 동작은 막지 않는다. 카드를 기다리던 실행도 이때 취소한다.
  doc.addEventListener("pointerdown", event => {
    if (ring.contains(event.target) || toggle.contains(event.target)) return;
    cancelWaiting();
    if (open) closeRing(false);
  }, true);
  window.addEventListener?.("popstate", cancelWaiting);
  window.addEventListener?.("hashchange", cancelWaiting);
  // 링은 화면 좌표에 고정돼 있다. 창 크기가 바뀌거나 문서가 굴러 + 버튼이 옮겨 가면 닫는다.
  // 안쪽 칸(답이 이어 나오는 대화 칸)이 굴러도 신호가 오므로 + 버튼이 실제로 옮겨 갔을 때만 닫는다.
  // 휴대전화에서 초점이 옮겨 가며 키보드가 닫히는 크기 변화도 같은 기준으로 거른다.
  const moved = () => {
    if (!open || !openedAt) return;
    const box = toggle.getBoundingClientRect();
    if (Math.abs(box.left - openedAt.left) > 1 || Math.abs(box.top - openedAt.top) > 1) { closeRing(false); return true; }
    return false;
  };
  // 창 크기만 바뀌고 +는 제자리면(키보드가 열리고 닫히는 등) 닫지 않고 새 화면 크기에 맞춰 방울을 다시 놓는다.
  window.addEventListener?.("resize", () => { if (moved() === false) place(); });
  doc.addEventListener("scroll", moved, true);
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.addEventListener?.("change", event => {
    if (event.matches && !open && hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; ring.hidden = true; }
  });
  if (typeof MutationObserver === "function" && doc.documentElement) {
    new MutationObserver(label).observe(doc.documentElement, { attributes: true, attributeFilter: ["lang"] });
    // 링을 연 채 답이 끝나 사진 버튼이 다시 켜지는 것처럼, 대상의 잠금·숨김이 바뀌면 열린 링의 방울도 바로 따라간다.
    const follow = new MutationObserver(() => {
      if (!open) return;
      refresh();
      place();
      if (ring.contains(doc.activeElement) && doc.activeElement.disabled) toggle.focus();
    });
    for (const action of actions) {
      const node = target(action);
      if (node) follow.observe(node, { attributes: true, attributeFilter: ["disabled", "hidden", "aria-disabled"] });
    }
  }
  label();
})();
