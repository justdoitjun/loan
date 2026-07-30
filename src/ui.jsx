/* 공유 껍데기: 스타일 토큰 + 레이아웃 컴포넌트.
   상품/페이지가 다르다고 여기서 분기하지 말 것(if productKey === ... 금지).
   상품 차이는 src/products/* 와 data.js에만 둔다. */
import { C } from "./data.js";
import { won } from "./engine.js";

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
  input[type=range]{-webkit-appearance:none;appearance:none;height:6px;border-radius:4px;background:#DCE3DE;outline:none;}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:50%;background:#14705A;cursor:pointer;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);}
  input[type=range]::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#14705A;cursor:pointer;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);}
  .dot{transition:background-color .5s ease,transform .2s ease;animation:pop .4s ease backwards;}
  .dot:focus-visible{outline:3px solid #14705A;outline-offset:2px;}
  @keyframes pop{from{opacity:0;transform:translate(-50%,-50%) scale(.2);}to{opacity:1;transform:translate(-50%,-50%) scale(1);}}
  .slideup{animation:slideup .3s ease;}
  @keyframes slideup{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
  .modal{animation:popin .22s ease;}
  @keyframes popin{from{opacity:0;transform:scale(.94);}to{opacity:1;transform:scale(1);}}
  @media (prefers-reduced-motion: reduce){.dot,.slideup,.modal{animation:none;transition:none;}}
`;

/* ── 레이아웃 ── */
export function AppShell({ children }) {
  return (
    <div style={{ minHeight: "100%", background: C.bg, color: C.ink, fontFamily: '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif' }}>
      <style>{css}</style>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 18px 40px" }}>{children}</div>
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

export function Block({ title, items }) {
  return <div style={{ ...card, marginTop: 12 }}>
    <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{title}</div>
    {items.map((t, i) => <div key={i} style={{ display: "flex", gap: 8, fontSize: 14, lineHeight: 1.55, marginBottom: 6 }}><span style={{ color: C.greenDeep, fontWeight: 800 }}>·</span><span>{t}</span></div>)}
  </div>;
}

export function Choice({ label, options, value, onPick }) {
  return <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600, marginBottom: 7 }}>{label}</div>
    <div style={{ display: "flex", gap: 8 }}>
      {options.map(([t, v]) => <button key={t} onClick={() => onPick(v)} style={pill(value === v)}>{t}</button>)}
    </div>
  </div>;
}

export function Slider({ label, value, min, max, step, onChange, display }) {
  return <div style={{ marginBottom: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
      <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{display}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%" }} />
  </div>;
}

/* 문을 닫지 않는 회색 카드. 사유만 받고, 대안은 호출부가 문장에 담는다. */
export function ClosedCard({ reason }) {
  return <div className="slideup" style={{ ...card, borderColor: C.greyDot, marginTop: 8 }}>
    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6, color: C.inkSoft }}>지금은 닫혀 있어요</div>
    <div style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.6 }}>{reason}</div>
  </div>;
}

/* 앞에서 받은 걸 다시 묻지 않는다는 증거. DetailInfo·Strategy 상단에 고정으로 붙인다. */
export function ContextSummary({ ctx }) {
  const rows = [
    ["매물", `${ctx.unit.name} · ${won(ctx.unit.price)}원`],
    ["소득", `본인 ${won(ctx.ownIncome)} + 배우자 ${won(ctx.spouseIncome)} = 부부합산 약 ${won(ctx.totalIncome)}원`],
    ["가구", `${ctx.noHome ? "무주택" : "유주택"} · ${ctx.newlywed ? "신혼" : "신혼 아님"} · 미성년 ${ctx.minors}명`],
    ["필요 대출", `약 ${won(ctx.needed)}원 (보유 현금 ${won(ctx.cash)}원 제외)`],
    ["추천 상품", ctx.recommended.name],
  ];
  return (
    <div style={{ ...card, padding: "12px 16px", marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.greenDeep, marginBottom: 8 }}>앞에서 받은 정보 — 다시 묻지 않아요</div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: 10, fontSize: 12, lineHeight: 1.6, marginBottom: 3 }}>
          <span style={{ color: C.inkSoft, flex: "0 0 62px" }}>{k}</span>
          <span style={{ flex: 1 }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

/* ── 상품 컴포넌트가 공유하는 섹션 껍데기 ──
   상품마다 내용은 달라도 레이아웃은 여기 하나. 새 상품이 자기 카드를 새로 그리지 않게 한다. */
export function Section({ title, subtitle, children, tone }) {
  const border = tone === "ok" ? C.greenDeep : tone === "warn" ? C.amber : tone === "off" ? C.greyDot : C.line;
  return (
    <div style={{ ...card, marginTop: 12, borderColor: border }}>
      <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3, lineHeight: 1.6 }}>{subtitle}</div>}
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

/* 아직 구현 전인 자리를 정직하게 표시한다. 빈 화면 대신 "무엇이 올지"를 보여준다. */
export function Placeholder({ children }) {
  return <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.65, padding: "10px 12px", borderRadius: 10, background: "#F7FAF7", border: `1px dashed ${C.line}` }}>{children}</div>;
}
