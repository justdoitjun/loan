/* 화면 디자인 규칙 — 한 줄이 칸을 넘치면 줄을 내리지 않고 글자를 줄인다.
   글에 넣어 둔 <br>만 줄을 나눈다.
   10px까지 줄여도 한 줄이 안 되는 긴 문단만 원래 크기로 줄을 넘긴다.
   data-fit="line"  무조건 한 줄(하한에서도 줄바꿈 대신 말줄임)
   data-fit="prose" 이 요소와 자손은 줄바꿈 허용
   data-fit="off"   이 요소와 자손은 건드리지 않음 (키패드 글자 등)
   스타일은 #fit-lines 가 담당한다. React 인라인 글자 크기를 덮어쓰지 않으려고
   줄여야 할 때만 font-size 를 !important 로 둔다. */

const MIN_PX = 10;
const ABS_FLOOR = 8;

const rules = new Map();
let styleTag = null;
let layoutStamp = 0;

function excluded(el) {
  return !!el.closest("[data-fit='off'], [data-fit='prose'], .kp-key");
}

function skipTag(el) {
  return ["SCRIPT", "STYLE", "SVG", "PATH", "INPUT", "TEXTAREA", "SELECT", "CANVAS", "IMG", "BR"].includes(el.tagName);
}

function authoredPx(el) {
  const inline = el.style.fontSize;
  if (inline && inline.endsWith("px")) return parseFloat(inline);
  if (el.dataset.fitAuth) return parseFloat(el.dataset.fitAuth);
  const computed = parseFloat(getComputedStyle(el).fontSize);
  if (Number.isFinite(computed)) el.dataset.fitAuth = String(computed);
  return Number.isFinite(computed) ? computed : 14;
}

function ensureId(el) {
  if (!el.dataset.fitId) el.dataset.fitId = "f" + Math.random().toString(36).slice(2, 8);
  return el.dataset.fitId;
}

function flush() {
  if (!styleTag) {
    styleTag = document.getElementById("fit-lines");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "fit-lines";
      document.head.appendChild(styleTag);
    }
  }
  styleTag.textContent = [...rules.values()].join("\n");
}

function write(el, px, auth, box, ellipsis) {
  const id = ensureId(el);
  const size = Math.round(px * 10) / 10;
  const authR = Math.round(auth * 10) / 10;
  const font = Math.abs(size - authR) < 0.15 ? "" : `font-size:${size}px !important;`;
  let boxCss = "";
  if (box) {
    boxCss = "white-space:nowrap !important;max-width:100%;min-width:0;";
    if (ellipsis) boxCss += "overflow:hidden;text-overflow:ellipsis;";
  }
  if (!font && !boxCss) {
    rules.delete(id);
    return;
  }
  rules.set(id, `[data-fit-id="${id}"]{${font}${boxCss}}`);
}

function applyScale(el, scale, box, ellipsis) {
  const auth = authoredPx(el);
  const floor = Math.min(ABS_FLOOR, auth);
  write(el, Math.max(floor, auth * scale), auth, box, ellipsis);
  for (const child of el.children) {
    if (child.tagName === "BR" || skipTag(child) || excluded(child)) continue;
    applyScale(child, scale, false, false);
  }
}

function clearTree(el) {
  const id = el.dataset.fitId;
  if (id) rules.delete(id);
  delete el.dataset.fitCheap;
  for (const child of el.children) {
    if (child.nodeType === 1) clearTree(child);
  }
}

function fits(el) {
  return el.scrollWidth <= el.clientWidth + 1;
}

function hasBlockChild(el) {
  for (const child of el.children) {
    if (child.tagName === "BR") continue;
    const display = getComputedStyle(child).display;
    if (display === "block" || display === "flex" || display === "grid" || display === "list-item" || display === "flow-root") return true;
  }
  return false;
}

function isLine(el) {
  if (skipTag(el) || excluded(el)) return false;
  if (!(el.textContent || "").trim()) return false;
  if (el.dataset.fit === "prose" || el.dataset.fit === "off") return false;
  if (hasBlockChild(el)) return false;
  return true;
}

function collectLines(root) {
  const all = [...root.querySelectorAll("h1,h2,h3,p,button,a,li,label,span,div,strong,b,em")].filter(isLine);
  const set = new Set(all);
  return all.filter((el) => {
    let parent = el.parentElement;
    while (parent && parent !== root) {
      if (set.has(parent)) return false;
      parent = parent.parentElement;
    }
    return true;
  });
}

/* 글자마다 사각형이 따로 나오므로, 같은 높이에 있는 사각형을 한 줄로 묶는다.
   <br> 한 번은 허용하는 줄 하나에 해당한다. */
function visualLines(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
  const lines = [];
  for (const rect of rects) {
    const mid = rect.top + rect.height / 2;
    let line = lines.find((ln) => Math.abs(ln.mid - mid) < Math.max(4, rect.height * 0.6));
    if (!line) {
      line = { mid, left: rect.left, right: rect.right };
      lines.push(line);
    } else {
      line.left = Math.min(line.left, rect.left);
      line.right = Math.max(line.right, rect.right);
    }
  }
  return lines;
}

function needsShrink(el) {
  const lines = visualLines(el);
  if (lines.length === 0) return false;
  const allowed = el.querySelectorAll("br").length + 1;
  if (lines.length > allowed) return true;
  const box = el.getBoundingClientRect();
  return lines.some((line) => line.right - line.left > box.width + 1);
}

/* 10px로도 한 줄이 안 되는 긴 설명만 줄을 넘긴다. 제목·버튼·목록은 말줄임으로 한 줄을 지킨다. */
function preferWrap(el) {
  if (el.dataset.fit === "line" || el.querySelector("br")) return false;
  if (el.dataset.fit === "prose") return true;
  const chars = [...(el.textContent || "").replace(/\s/g, "")].length;
  const cs = getComputedStyle(el);
  const fs = parseFloat(cs.fontSize) || 14;
  const lh = cs.lineHeight === "normal" ? fs * 1.2 : parseFloat(cs.lineHeight);
  return chars >= 36 && lh / fs >= 1.45;
}

function remember(el, text, auth, mode) {
  el.dataset.fitMode = mode;
  el.dataset.fitCheap = `${layoutStamp}|${text}|${auth}|${mode}`;
}

function fitHard(el, text, auth) {
  const keepLine = !preferWrap(el);
  applyScale(el, 1, true, false);
  flush();
  if (fits(el) && !needsShrink(el)) {
    remember(el, text, auth, "line");
    return;
  }
  const minScale = Math.min(MIN_PX, auth) / auth;
  applyScale(el, minScale, true, false);
  flush();
  if (!fits(el) && !keepLine) {
    clearTree(el);
    flush();
    remember(el, text, auth, "wrap");
    return;
  }
  let lo = minScale;
  let hi = 1;
  if (fits(el)) {
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      applyScale(el, mid, true, false);
      flush();
      if (fits(el) && !needsShrink(el)) lo = mid;
      else hi = mid;
    }
  }
  const still = !fits(el) || needsShrink(el);
  applyScale(el, lo, true, keepLine && still);
  flush();
  remember(el, text, auth, "line");
}

function consider(el, pending) {
  if (el.clientWidth < 2) return false;
  const text = el.textContent || "";
  const auth = authoredPx(el);
  const cheap = `${layoutStamp}|${text}|${auth}|${el.dataset.fitMode || ""}`;
  if (el.dataset.fitCheap === cheap) return false;
  if (!needsShrink(el)) {
    applyScale(el, 1, true, false);
    pending.push({ el, text, auth });
    return true;
  }
  fitHard(el, text, auth);
  return true;
}

function isLock(el) {
  return el.dataset.fit === "lock"
    || el.classList.contains("place-side")
    || el.classList.contains("place-check")
    || el.classList.contains("sheet-x")
    || el.classList.contains("path-caret")
    || el.classList.contains("kp-go");
}

function relaxOverflowRows(root) {
  let added = false;
  for (const row of root.querySelectorAll("*")) {
    if (excluded(row)) continue;
    const display = getComputedStyle(row).display;
    if (display !== "flex" && display !== "inline-flex") continue;
    if (getComputedStyle(row).flexDirection.startsWith("column")) continue;
    if (row.scrollWidth <= row.clientWidth + 1) continue;
    for (const child of row.children) {
      if (isLock(child) || child.hasAttribute("data-fit-relax")) continue;
      child.setAttribute("data-fit-relax", "");
      added = true;
    }
  }
  return added;
}

function gc(root) {
  for (const id of [...rules.keys()]) {
    if (!root.querySelector(`[data-fit-id="${id}"]`)) rules.delete(id);
  }
}

export function fitAll(root) {
  if (!root) return;
  gc(root);
  for (const el of root.querySelectorAll("[data-fit='prose'], [data-fit='off']")) clearTree(el);
  const relaxed = relaxOverflowRows(root);
  if (relaxed) layoutStamp += 1;
  const lines = collectLines(root);
  const pending = [];
  let dirty = false;
  for (const el of lines) dirty = consider(el, pending) || dirty;
  if (dirty) flush();
  for (const item of pending) {
    if (item.el.scrollWidth > item.el.clientWidth + 1 || needsShrink(item.el)) {
      delete item.el.dataset.fitCheap;
      fitHard(item.el, item.text, item.auth);
    } else {
      remember(item.el, item.text, item.auth, "line");
    }
  }
}

export function auditFit(root = document) {
  const page = document.documentElement;
  const bad = [];
  for (const el of root.querySelectorAll("[data-fit-mode='line']")) {
    if (el.clientWidth < 2) continue;
    if (needsShrink(el)) bad.push((el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 48));
  }
  return {
    pageOverflow: page.scrollWidth > page.clientWidth + 2,
    scrollWidth: page.scrollWidth,
    clientWidth: page.clientWidth,
    bad,
  };
}

export function bindFitLines(root) {
  if (!root) return () => {};
  let running = false;
  let again = false;
  let raf = 0;

  const run = () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      let guard = 0;
      do {
        again = false;
        fitAll(root);
      } while (again && ++guard < 3);
    } finally {
      running = false;
    }
  };

  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(run);
  };

  run();

  let lastW = root.clientWidth;
  const ro = new ResizeObserver(() => {
    const w = root.clientWidth;
    if (w === lastW) return;
    lastW = w;
    layoutStamp += 1;
    schedule();
  });
  ro.observe(root);

  const mo = new MutationObserver((records) => {
    if (running) return;
    const meaningful = records.some((record) => {
      if (record.type !== "attributes") return true;
      const el = record.target;
      if (!(el instanceof Element)) return true;
      if (el.classList.contains("sheet-panel") || el.classList.contains("sheet-backdrop")) return false;
      return true;
    });
    if (meaningful) schedule();
  });
  mo.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  });

  if (import.meta.env?.DEV) window.__auditFit = () => auditFit(root);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    mo.disconnect();
    if (import.meta.env?.DEV && window.__auditFit) delete window.__auditFit;
  };
}
