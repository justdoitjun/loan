/* 공유 껍데기: 스타일 토큰 + 레이아웃 컴포넌트.
   상품/페이지가 다르다고 여기서 분기하지 말 것(if productKey === ... 금지).
   상품 차이는 src/products/* 와 data.js에만 둔다. */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { C } from "./data.js";

/* ── 스타일 토큰 ── */
export const eyebrow = { fontSize: 12, letterSpacing: 2, color: C.greenDeep, fontWeight: 700 };
export const h1 = { fontSize: 23, lineHeight: 1.35, margin: "8px 0 6px", fontWeight: 800 };
export const card = { padding: "16px 18px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16 };
export const primaryBtn = { width: "100%", marginTop: 16, padding: "14px", borderRadius: 13, border: "none", background: C.greenDeep, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" };
export const ghostBtn = { padding: "9px 14px", borderRadius: 10, border: `1.5px solid ${C.line}`, background: "#fff", color: C.ink, fontSize: 13, fontWeight: 700, cursor: "pointer" };
/* 선택형 버튼(주택수·소득밴드·신혼·자녀수)이 같은 리듬을 갖도록 한 곳에서 만든다. */
export const pill = (on) => ({ flex: 1, padding: "11px 6px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${on ? C.greenDeep : C.line}`, background: on ? C.greenDeep : "#fff", color: on ? "#fff" : C.ink });
export const listItem = { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", padding: "14px 16px", marginBottom: 10, borderRadius: 14, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer" };
export const modalOpt = { width: "100%", textAlign: "left", padding: "14px 16px", marginBottom: 10, borderRadius: 14, border: `1.5px solid ${C.line}`, background: "#fff", cursor: "pointer", color: C.ink };
export const fine = { fontSize: 11, color: "#9AA3A0", marginTop: 16, lineHeight: 1.6 };
export const inputBox = { width: "100%", padding: "10px 12px", fontSize: 15, borderRadius: 10, border: `1.5px solid ${C.line}`, boxSizing: "border-box" };

export const css = `
  input[type=range]{-webkit-appearance:none;appearance:none;height:6px;border-radius:4px;outline:none;}
  input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:4px;background:transparent;}
  input[type=range]::-moz-range-track{height:6px;border-radius:4px;background:transparent;}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:50%;background:#14705A;cursor:pointer;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);margin-top:-8px;}
  input[type=range]::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#14705A;cursor:pointer;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);}
  .dot{transition:background-color .5s ease,transform .2s ease;animation:pop .4s ease backwards;}
  .dot:focus-visible{outline:3px solid #14705A;outline-offset:2px;}
  @keyframes pop{from{opacity:0;transform:translate(-50%,-50%) scale(.2);}to{opacity:1;transform:translate(-50%,-50%) scale(1);}}
  .slideup{animation:slideup .3s ease;}
  @keyframes slideup{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
  .modal{animation:popin .22s ease;}
  @keyframes popin{from{opacity:0;transform:scale(.94);}to{opacity:1;transform:scale(1);}}
  .sheet-root{position:fixed;inset:0;z-index:50;display:flex;align-items:flex-end;justify-content:center;pointer-events:none;}
  .sheet-backdrop{position:absolute;inset:0;background:rgba(20,30,26,.45);pointer-events:auto;}
  .sheet-panel{pointer-events:auto;position:relative;z-index:1;width:100%;max-width:460px;min-width:0;max-height:min(84dvh,760px);display:flex;flex-direction:column;background:#fff;color:#1E2A24;color-scheme:light;border-radius:22px 22px 0 0;box-shadow:0 -10px 40px rgba(20,30,26,.18);padding-bottom:env(safe-area-inset-bottom,0px);outline:none;}
  .sheet-grab{flex:0 0 auto;display:flex;justify-content:center;align-items:center;height:28px;touch-action:none;cursor:grab;user-select:none;}
  .sheet-grab:active{cursor:grabbing;}
  .sheet-grab-bar{width:36px;height:4px;border-radius:99px;background:#D5DCD6;}
  .sheet-head{flex:0 0 auto;display:grid;grid-template-columns:1fr auto;grid-template-areas:"back close" "title title" "sub sub";align-items:center;column-gap:8px;padding:0 14px 12px 16px;touch-action:none;user-select:none;}
  .sheet-backslot{grid-area:back;justify-self:start;min-width:44px;min-height:44px;display:flex;align-items:center;}
  .sheet-back{border:none;background:none;padding:8px 4px;min-height:44px;font-family:inherit;font-size:14px;font-weight:700;color:#14705A;cursor:pointer;}
  .sheet-x{grid-area:close;justify-self:end;width:40px;height:40px;border:none;border-radius:50%;background:#F4F6F3;color:#1E2A24;font-family:inherit;font-size:20px;line-height:1;cursor:pointer;}
  .sheet-title{grid-area:title;margin:2px 0 0;font-size:18px;line-height:1.3;font-weight:800;letter-spacing:-.02em;color:#1E2A24;}
  .sheet-sub{grid-area:sub;margin:3px 0 0;font-size:13px;line-height:1.4;font-weight:600;color:#5B6660;}
  .sheet-pin{flex:0 0 auto;padding:0 16px 10px;}
  .sheet-body{overflow-y:auto;overscroll-behavior:contain;padding:2px 16px 18px;-webkit-overflow-scrolling:touch;}
  /* 키패드 시트: 휴대폰 화면의 60%. 창이 그보다 길면 가장 큰 휴대폰 시트(560px)에서 멈춘다.
     내용이 넘치면 스크롤하지 않고, 숫자 키가 남은 높이를 나눠 갖는다. */
  .sheet-panel[data-fit="keypad"]{height:min(60dvh,560px);min-height:min(432px,72dvh);max-height:min(72dvh,560px);overflow:hidden;}
  .sheet-panel[data-fit="keypad"] .sheet-grab{height:18px;}
  .sheet-panel[data-fit="keypad"] .sheet-head{position:relative;grid-template-columns:1fr;grid-template-areas:"title" "sub";padding:0 52px 4px 16px;}
  .sheet-panel[data-fit="keypad"] .sheet-backslot{display:none;}
  .sheet-panel[data-fit="keypad"] .sheet-x{position:absolute;top:0;right:10px;width:36px;height:36px;}
  .sheet-panel[data-fit="keypad"] .sheet-title{margin:0;font-size:17px;line-height:1.25;}
  .sheet-panel[data-fit="keypad"] .sheet-sub{margin:1px 0 0;font-size:12px;line-height:1.3;}
  .sheet-panel[data-fit="keypad"] .sheet-body{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;padding:0 16px 12px;}
  .sheet-pane{animation:sheetpane .2s ease;}
  @keyframes sheetpane{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
  .place-gus{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
  .place-gu,.place-dong,.place-find,.place-find-clear,.sheet-x,.sheet-back,.path-btn{font-family:inherit;-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
  .place-gu{min-height:48px;padding:8px 4px;border-radius:12px;border:1.5px solid #E4E9E4;background:#fff;color:#1E2A24;font-size:14px;font-weight:700;text-align:center;cursor:pointer;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:4px;}
  .place-count{font-size:11px;font-weight:700;color:#5B6660;font-variant-numeric:tabular-nums;line-height:1;}
  .place-gu[aria-current="true"] .place-count,.place-dong[aria-current="true"] .place-count{color:#14705A;}
  .place-dong{width:100%;min-height:48px;margin:0 0 6px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;border-radius:12px;border:1.5px solid #E4E9E4;background:#fff;color:#1E2A24;font-size:15px;font-weight:600;cursor:pointer;}
  .place-gu[aria-current="true"],.place-dong[aria-current="true"]{border-color:#14705A;background:#E8F4EF;color:#14705A;font-weight:800;}
  .place-check{flex:0 0 auto;width:22px;height:22px;border-radius:50%;background:#14705A;color:#fff;font-size:12px;font-weight:800;display:grid;place-items:center;}
  .place-side{display:flex;align-items:center;gap:8px;flex:0 0 auto;}
  .place-findwrap{position:relative;}
  .place-find{width:100%;height:44px;padding:0 40px 0 12px;border-radius:12px;border:1.5px solid #E4E9E4;background:#F4F6F3;color:#1E2A24;color-scheme:light;font-size:16px;}
  .place-find:focus{outline:none;border-color:#14705A;background:#fff;}
  .place-find-clear{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:32px;height:32px;border:none;border-radius:50%;background:transparent;color:#5B6660;font-size:18px;line-height:1;cursor:pointer;}
  .place-empty{margin:14px 2px 0;font-size:14px;color:#5B6660;line-height:1.5;}
  .path{display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;max-width:70%;font-size:12px;line-height:1.35;color:#5B6660;font-weight:600;}
  .path-city{padding:8px 0;}
  .path-sep{color:#9AA3A0;margin:0 5px;}
  .path-btn{display:inline-flex;align-items:center;border:none;background:none;padding:10px 3px;margin:-6px 0;min-height:40px;font-size:12px;font-weight:700;color:#14705A;cursor:pointer;}
  .path-caret{width:0;height:0;margin-left:4px;border-left:3px solid transparent;border-right:3px solid transparent;border-top:4px solid currentColor;opacity:.75;}
  @media (hover:hover){
    .place-gu:hover,.place-dong:hover{background:#F7FAF7;border-color:#D5DCD6;}
    .place-gu[aria-current="true"]:hover,.place-dong[aria-current="true"]:hover{background:#E8F4EF;border-color:#14705A;}
    .sheet-x:hover{background:#E8EEE9;}
    .path-btn:hover{color:#0E5343;}
  }
  .place-gu:active,.place-dong:active{background:#E7F0EA;}
  .place-gu:focus,.place-dong:focus,.sheet-x:focus,.sheet-back:focus,.path-btn:focus,.place-find-clear:focus{outline:none;}
  .place-gu:focus-visible,.place-dong:focus-visible,.sheet-x:focus-visible,.sheet-back:focus-visible,.path-btn:focus-visible,.place-find-clear:focus-visible{outline:3px solid #14705A;outline-offset:2px;}

  /* 아코디언 — 높이를 JS로 재지 않고 grid 1fr↔0fr로 접는다(내용이 바뀌어도 안 깨진다) */
  .acc{display:grid;grid-template-rows:0fr;transition:grid-template-rows .28s ease;}
  .acc[data-open="true"]{grid-template-rows:1fr;}
  .acc>.acc-inner{overflow:hidden;}

  /* 게이지: 대출이 채운 칸 옆의 빗금 = 필요 현금. 경고색이 아니다. */
  .stripe-gap{background:repeating-linear-gradient(-45deg,#E6EBE7,#E6EBE7 6px,#F4F7F4 6px,#F4F7F4 12px);}
  .stripe-off{background:repeating-linear-gradient(-45deg,#E8ECE8,#E8ECE8 6px,#F2F4F2 6px,#F2F4F2 12px);}
  .gauge-fill{transition:width .38s ease;}

  @media (prefers-reduced-motion: reduce){
    .dot,.slideup,.modal,.sheet-pane{animation:none;}
    .dot,.acc{transition:none;}
  }
`;

/* ── 레이아웃 ── */
export function AppShell({ children }) {
  return (
    <div style={{ minHeight: "100%", background: C.bg, color: C.ink, fontFamily: '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif' }}>
      <style>{css}</style>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "max(22px, env(safe-area-inset-top)) 18px max(40px, env(safe-area-inset-bottom))" }}>{children}</div>
    </div>
  );
}

export function BackButton({ onClick, children }) {
  return <button onClick={onClick} style={{ ...ghostBtn, marginBottom: 14 }}>← {children}</button>;
}

/* ── 조각들 ── */
export function Stat({ label, value, warn }) {
  return <div><div style={{ fontSize: 11, color: C.inkSoft }}>{label}</div><div style={{ fontSize: 15, fontWeight: 800, color: warn ? C.amber : C.ink }}>{value}</div></div>;
}

export function rangeFill(value, min, max) {
  const span = max - min;
  const pct = span > 0 ? Math.min(100, Math.max(0, ((value - min) / span) * 100)) : 0;
  return { width: "100%", background: `linear-gradient(to right, ${C.greenDeep} ${pct}%, #DCE3DE ${pct}%)` };
}

export function Slider({ label, value, min, max, step, onChange, display }) {
  return <div style={{ marginBottom: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
      <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{display}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={rangeFill(value, min, max)} />
  </div>;
}

/* 문을 닫지 않는 회색 카드. 사유만 받고, 대안은 호출부가 문장에 담는다. */
export function ClosedCard({ exception }) {
  return <div className="slideup" style={{ ...card, borderColor: C.greyDot, marginTop: 8 }}>
    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6, color: C.inkSoft }}>지금은 닫혀 있어요</div>
    <div style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.6 }}>{exception}</div>
  </div>;
}

/* ── 상품 컴포넌트가 공유하는 섹션 껍데기 ──
   상품마다 내용은 달라도 레이아웃은 여기 하나. 새 상품이 자기 카드를 새로 그리지 않게 한다. */
export function Section({ title, subtitle, children, tone }) {
  const border = tone === "ok" ? C.greenDeep : tone === "warn" ? C.amber : tone === "off" ? C.greyDot : C.line;
  return (
    <div style={{ ...card, marginTop: 12, borderColor: border }}>
      <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3, lineHeight: 1.6 }}>{subtitle}</div>}
      {children ? <div style={{ marginTop: 10 }}>{children}</div> : null}
    </div>
  );
}

/* ── 훅 ──
   숫자가 뚝 바뀌지 않고 굴러가게 한다. 조종간에서 "내가 당기니 결과가 반응한다"는 감각이 여기서 나온다. */
export function useTween(target, ms = 380) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const a = from.current, b = target;
    if (a === b) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { from.current = b; setShown(b); return; }
    let raf = 0;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / ms);
      const v = a + (b - a) * (1 - Math.pow(1 - p, 3));   // easeOutCubic
      from.current = v;                                    // 중간에 다시 당기면 여기서 이어간다
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

/* 아직 구현 전인 자리를 정직하게 표시한다. 빈 화면 대신 "무엇이 올지"를 보여준다. */
export function Placeholder({ children }) {
  return <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.65, padding: "10px 12px", borderRadius: 10, background: "#F7FAF7", border: `1px dashed ${C.line}` }}>{children}</div>;
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function trapTab(e, root) {
  if (e.key !== "Tab" || !root) return;
  const items = [...root.querySelectorAll("button, input")].filter((el) => !el.disabled);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (!root.contains(active)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
    return;
  }
  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

/* 팝업이 떠 있는 동안 뒤 화면이 스크롤되지 않게 하고, Esc로 닫고, 포커스를 되돌린다. */
export function useOverlayLock(onClose, panelRef) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      trapTab(e, panelRef?.current);
    };
    window.addEventListener("keydown", onKey);
    const prevFocus = document.activeElement;
    const focusId = requestAnimationFrame(() => panelRef?.current?.focus());
    return () => {
      cancelAnimationFrame(focusId);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      if (prevFocus instanceof HTMLElement) prevFocus.focus();
    };
  }, [panelRef]);
}

/* 아래쪽에 붙는 선택 시트. 손잡이를 아래로 끌면 닫힌다.
   closeRef를 넘기면 고른 뒤에도 같은 닫힘 동작으로 사라진다. */
export function BottomSheet({ title, subtitle, back, pinned, onClose, closeRef, bodyRef, fit, children }) {
  const titleId = useId();
  const headingRef = useRef(null);
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [reduced] = useState(prefersReducedMotion);
  const [on, setOn] = useState(reduced);
  const [drag, setDrag] = useState(0);
  const pointer = useRef(null);
  const closing = useRef(false);
  const timer = useRef(0);

  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    pointer.current = null;
    setDrag(0);
    setOn(false);
    timer.current = window.setTimeout(() => onCloseRef.current(), reduced ? 0 : 240);
  }, [reduced]);

  useEffect(() => {
    if (!closeRef) return undefined;
    closeRef.current = requestClose;
    return () => {
      if (closeRef.current === requestClose) closeRef.current = null;
    };
  }, [closeRef, requestClose]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }
      trapTab(e, panelRef.current);
    };
    window.addEventListener("keydown", onKey);
    const prevFocus = document.activeElement;
    return () => {
      clearTimeout(timer.current);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      if (prevFocus instanceof HTMLElement) prevFocus.focus();
    };
  }, [requestClose]);

  useLayoutEffect(() => {
    const root = panelRef.current;
    if (!root) return;
    const current = root.querySelector("[aria-current='true']");
    (current || headingRef.current)?.focus({ preventScroll: true });
  }, [title]);

  useEffect(() => {
    if (reduced) return undefined;
    const id = requestAnimationFrame(() => {
      if (!closing.current) setOn(true);
    });
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  function onPointerDown(e) {
    if (reduced || closing.current || (e.button != null && e.button !== 0)) return;
    pointer.current = { y: e.clientY, t: performance.now() };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    if (!pointer.current) return;
    setDrag(Math.max(0, e.clientY - pointer.current.y));
  }
  function onPointerUp(e) {
    if (!pointer.current) return;
    const dy = Math.max(0, e.clientY - pointer.current.y);
    const dt = Math.max(1, performance.now() - pointer.current.t);
    pointer.current = null;
    if (dy > 96 || (dy > 36 && dy / dt > 0.55)) requestClose();
    else setDrag(0);
  }

  const dragHandlers = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
  const shown = on && drag === 0;
  const backdrop = !on ? 0 : drag > 0 ? Math.max(0.2, 1 - drag / 360) : 1;

  return (
    <div className="sheet-root">
      <div
        className="sheet-backdrop"
        style={{ opacity: backdrop, transition: reduced || drag > 0 ? "none" : "opacity .24s ease" }}
        onClick={requestClose} />
      <div
        ref={panelRef}
        className="sheet-panel"
        data-fit={fit || undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          transform: shown ? "translateY(0)" : drag > 0 ? `translateY(${drag}px)` : "translateY(100%)",
          transition: reduced || drag > 0 ? "none" : "transform .24s ease",
        }}
      >
        <div className="sheet-grab" {...dragHandlers}><div className="sheet-grab-bar" /></div>
        <div className="sheet-head" {...dragHandlers}>
          <div className="sheet-backslot" onPointerDown={(e) => e.stopPropagation()}>{back}</div>
          <button type="button" className="sheet-x" aria-label="닫기" onPointerDown={(e) => e.stopPropagation()} onClick={requestClose}>×</button>
          <h2 id={titleId} ref={headingRef} className="sheet-title" tabIndex={-1}>{title}</h2>
          {subtitle ? <p className="sheet-sub">{subtitle}</p> : null}
        </div>
        {pinned ? <div className="sheet-pin">{pinned}</div> : null}
        <div className="sheet-body" ref={bodyRef}>{children}</div>
      </div>
    </div>
  );
}
