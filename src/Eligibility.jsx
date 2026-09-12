/* 자격 화면 껍데기 — 탭 + 매물카드.
   자격을 묻는 입구는 여기 하나다. 본문은 탭별로 갈린다:
     정부 → eligibility/gov.jsx
     은행 → eligibility/bank.jsx
   뒤(Strategy)에서 자격을 다시 묻지 않는다. */
import { TABS, C } from "./data.js";
import { buildCtx, won } from "./engine.js";
import { BackButton, card } from "./ui.jsx";
import Gov from "./eligibility/gov.jsx";
import Bank from "./eligibility/bank.jsx";

export default function Eligibility({ unit, ownIncome, kind, setKind, elig, setElig, onBack, onPick }) {
  const ctx = buildCtx({ unit, ownIncome, elig });

  return (
    <div className="slideup">
      <BackButton onClick={onBack}>매물목록으로</BackButton>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setKind(t.key)} style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", border: `1.5px solid ${kind === t.key ? C.greenDeep : C.line}`, background: kind === t.key ? C.greenDeep : "#fff", color: kind === t.key ? "#fff" : C.ink }}>{t.label}대출</button>
        ))}
      </div>

      <div style={{ ...card, padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{unit.name}</div>
        <div style={{ fontSize: 12, color: C.inkSoft }}>{won(unit.price)}원 · 전용 {unit.areaM2}㎡</div>
      </div>

      {kind === "bank"
        ? <Bank ctx={ctx} elig={elig} setElig={setElig} onPick={onPick} />
        : <Gov ctx={ctx} elig={elig} setElig={setElig} onPick={onPick} />}
    </div>
  );
}
