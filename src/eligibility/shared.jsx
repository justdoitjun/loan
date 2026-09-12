/* 두 탭(정부 gov.jsx · 은행 bank.jsx)이 같이 쓰는 질문 조각.
   상품 지식은 없다 — 라벨과 값만 받아 그린다. 상품별 문구는 각 탭이 props로 넘긴다.
   ⚠️ 여기에 판정·계산을 두지 말 것(그건 engine/person). 같은 질문을 두 탭에 두 벌 그리지 않으려는 자리다. */
import { SPOUSE_INCOME_BANDS, C } from "../data.js";
import { won } from "../engine.js";
import { card, pill } from "../ui.jsx";

/* ── 단일 yes/no. 부연은 버튼이 아니라 설명문이 진다. ── */
export function YesNo({ label, desc, value, onPick, yes = "네", no = "아니오" }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, color: C.ink, fontWeight: 700, marginBottom: desc ? 3 : 7 }}>{label}</div>
      {desc && <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 8, lineHeight: 1.55 }}>{desc}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onPick(true)} style={pill(value === true)}>{yes}</button>
        <button onClick={() => onPick(false)} style={pill(value === false)}>{no}</button>
      </div>
    </div>
  );
}

/* ── 배우자 소득 밴드 트랙 ──
   본인 소득은 앞 예산 화면에서 이미 받았다. 여기서 다시 묻지 않는다.
   desc = 탭별 부연(정부: 부부합산 상한 / 은행: DSR 합산 시 부채도 합산). */
export function SpouseIncomeTrack({ value, onPick, ownIncome, planned, desc }) {
  const picked = SPOUSE_INCOME_BANDS.find((b) => b.key === value) || null;
  const who = planned ? "예비배우자" : "배우자";
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, color: C.ink, fontWeight: 700, marginBottom: 3 }}>{who} 세전 연소득은 어느 구간인가요?</div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 8, lineHeight: 1.55 }}>
        본인 {won(ownIncome)}원. {who} 몫만 고르세요.
        {desc && <> {desc}</>}
      </div>
      <div style={{ display: "flex", border: `1.5px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
        {SPOUSE_INCOME_BANDS.map((b, i) => {
          const on = value === b.key;
          return (
            <button key={b.key} onClick={() => onPick(b.key)} aria-pressed={on}
              style={{ flex: 1, padding: "12px 4px", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
                borderLeft: i > 0 ? `1px solid ${on || value === SPOUSE_INCOME_BANDS[i - 1].key ? "transparent" : C.line}` : "none",
                background: on ? C.greenDeep : "#fff", color: on ? "#fff" : C.inkSoft, fontVariantNumeric: "tabular-nums" }}>
              {b.short}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9AA3A0", marginTop: 5 }}>
        <span>적음</span><span>많음</span>
      </div>
      {picked && (
        <div className="slideup" style={{ fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 1.55 }}>
          {picked.label} 선택 · 계산은 구간 대표값 <b>약 {won(picked.rep)}원</b>으로 봐요. 경계에 걸리면 정확한 값을 따로 여쭤볼게요.
        </div>
      )}
    </div>
  );
}

/* ── 다 채운 질문 더미를 접는 드랍다운 ──
   접어도 무엇으로 판정했는지는 남긴다. 펼치면 답을 고칠 수 있다. */
export function AnswersDropdown({ open, onToggle, rows }) {
  return (
    <div style={{ ...card, padding: "12px 16px", marginBottom: 16 }}>
      <button onClick={onToggle} aria-expanded={open}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 0, border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.greenDeep }}>입력한 조건</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, display: "flex", alignItems: "center", gap: 4 }}>
          {open ? "접기" : "고치기"}
          <span style={{ display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s ease" }}>▾</span>
        </span>
      </button>
      {!open && (
        <div style={{ marginTop: 8 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 10, fontSize: 12, lineHeight: 1.6, marginBottom: 3 }}>
              <span style={{ color: C.inkSoft, flex: "0 0 74px" }}>{k}</span>
              <span style={{ flex: 1 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* 답에 따라 건너뛴 질문은 조용히 지우지 않고 "왜 안 물었는지"를 남긴다. */
export function SkippedNote({ children }) {
  return <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6, marginBottom: 14, padding: "9px 12px", borderRadius: 10, background: "#F7FAF7", border: `1px dashed ${C.line}` }}>{children}</div>;
}
