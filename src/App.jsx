import { useState, useMemo } from "react";
import { DATA, RULE, C } from "./data.js";
import { evaluate, repaymentCapacity, buildCtx, won } from "./engine.js";
import { AppShell, Slider, eyebrow, h1, ghostBtn, listItem, modalOpt, fine } from "./ui.jsx";
import { EMPTY_PERSON, personReady } from "./person.js";
import { judgeUnits } from "./verdict.js";
import Eligibility from "./Eligibility.jsx";
import Strategy from "./Strategy.jsx";
import IncomeCheck, { incomeCheckResult } from "./IncomeCheck.jsx";

export default function App() {
  const [person, setPerson] = useState(EMPTY_PERSON);
  const patch = (key, v) => setPerson((p) => ({ ...p, [key]: typeof v === "function" ? v(p[key]) : v }));
  const setElig = (v) => patch("elig", v);
  const setDetail = (v) => patch("detail", v);
  const setPull = (v) => patch("pull", v);
  const { ownIncome: income } = person;
  const [step, setStep] = useState("budget");
  const [modalUnit, setModalUnit] = useState(null);    // 정부/은행 선택 팝업
  const [unit, setUnit] = useState(null);              // 고른 매물
  const [kind, setKind] = useState("gov");             // 정부 | 은행
  const [pickedKey, setPickedKey] = useState(null);    // 가능 목록에서 고른 상품(규칙 key)

  const incomeTrustResult = incomeCheckResult(person.incomeCheck); // null | { tone, type, notes }

  /* ── 매물별 대출·필요 현금: 대략(천장) → 정밀(매물별 판정) 두 모드 ──
     자격 답변 전엔 상품 판정을 돌릴 수 없으니 DSR 근사 천장으로 본다.
     자격이 다 차는 순간 precise가 켜지고, 그때부터 모든 매물이 judgeUnit을 거친다 —
     실제 자격·상품별 한도·레버까지 반영된 숫자다. 레버를 당기면 이 배열이 통째로 다시 나온다. */
  const dsrCap = useMemo(() => repaymentCapacity(income, RULE.DSR, RULE.loanRate, RULE.loanYears, 0), [income]);
  const precise = personReady(person);
  const results = useMemo(
    () => (precise ? judgeUnits(DATA, person) : DATA.map((d) => evaluate(d, dsrCap))),
    [precise, person, dsrCap],
  );
  const listed = useMemo(
    () => [...results].sort((a, b) => a.cashNeeded - b.cashNeeded || a.price - b.price),
    [results],
  );

  /* 뒤 화면 전부가 공유하는 컨텍스트. 여기 담긴 건 절대 다시 묻지 않는다. */
  const ctx = useMemo(() => (unit ? buildCtx({ unit, ownIncome: income, elig: person.elig }) : null), [unit, income, person.elig]);

  /* 팝업에서 정부/은행을 고르면 자격 화면으로.
     ⚠️ 여기서 사람 상태를 하나도 지우지 않는다 — 자격도 부채도 레버도 매물과 무관하기 때문.
        매물마다 다시 묻던 게 이 리팩터링이 없앤 것이다. 초기화하는 건 '고른 상품'뿐인데,
        그건 매물이 바뀌면 통과 목록 자체가 달라져서 이전 선택이 유효하지 않을 수 있어서다. */
  function pickKind(k) {
    setUnit(modalUnit); setKind(k); setModalUnit(null);
    setPickedKey(null);
    setStep("eligibility");
  }

  /* 가능 목록에서 상품 하나 선택 → 전략. 컨텍스트는 ctx가 통째로 넘어간다. */
  function pickProduct(key) { setPickedKey(key); setStep("strategy"); }

  /* 조종간 미니지도에서 점을 눌렀을 때 — 화면 전환 없이 '목표 매물'만 갈아끼운다.
     ⚠️ 사람 상태(자격·부채·레버)는 건드리지 않는다. 그게 이 인터랙션의 전부다 —
        매물만 바뀌고 나머지는 그대로여서 재질문 없이 즉시 다시 판정된다.
     pickedKey는 비운다: 새 매물에선 통과 목록이 달라져 이전 선택이 없을 수 있고,
     Strategy가 passed[0]으로 알아서 대체한다. */
  function swapUnit(id) {
    const next = DATA.find((d) => d.id === id);
    if (!next) return;
    setUnit(next); setPickedKey(null);
  }

  return (
    <AppShell>
      {step === "budget" && (
        <>
          <div style={eyebrow}>노원구 · 그린라이트</div>
          <h1 style={h1}>내 소득으로,<br />필요한 현금을 알아봐요.</h1>
          <div style={{ marginTop: 16 }}>
            <Slider label="나의 연소득" value={income} min={0} max={12000} step={100} onChange={(v) => patch("ownIncome", v)} display={won(income) + "원"} />
          </div>

          <button onClick={() => setStep("incomeCheck")} style={{ ...ghostBtn, width: "100%", marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>내 소득, 그대로 인정될지 미리 확인해볼까요?</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: incomeTrustResult ? (incomeTrustResult.tone === "green" ? C.greenDeep : C.amber) : C.inkSoft }}>
              {incomeTrustResult ? (incomeTrustResult.tone === "green" ? "확인함 · 초록" : "확인함 · 노랑") : "확인 안 함 →"}
            </span>
          </button>

          {/* {precise && <PreciseNote />} */}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "16px 0 10px" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>총 {listed.length}건</span>
            <span style={{ fontSize: 12, color: C.inkSoft }}>필요 현금 적은 순</span>
          </div>
          {listed.map((r) => (
            <button key={r.id} onClick={() => setModalUnit(r)} style={listItem}>
              <div>
                <div style={{ fontSize: 15, color: C.ink, fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{r.dong} · 전용 {r.areaM2}㎡ · {won(r.price)}원</div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3 }}>대출 약 {won(r.loan)}원</div>
              </div>
              <span style={{ fontSize: 13, color: C.greenDeep, fontWeight: 700, textAlign: "right", flex: "0 0 auto" }}>
                현금 {won(r.cashNeeded)} ›
              </span>
            </button>
          ))}
          <p style={fine}>상담역이 확정해요. 대출을 약속하지 않아요.</p>
        </>
      )}

      {step === "incomeCheck" && (
        <IncomeCheck value={person.incomeCheck} onChange={(v) => patch("incomeCheck", v)} onBack={() => setStep("budget")} />
      )}

      {step === "eligibility" && ctx && (
        <Eligibility
          unit={unit} ownIncome={income}
          kind={kind} setKind={setKind}
          elig={person.elig} setElig={setElig}
          onBack={() => setStep("budget")} onPick={pickProduct} />
      )}

      {step === "strategy" && ctx && (
        <Strategy
          ctx={ctx} person={person} pickedKey={pickedKey} onPickOther={setPickedKey}
          detail={person.detail} setDetail={setDetail}
          pull={person.pull} setPull={setPull}
          onSwapUnit={swapUnit}
          onBack={() => setStep("eligibility")} />
      )}

      {modalUnit && <ProductModal r={modalUnit} onPick={pickKind} onClose={() => setModalUnit(null)} />}
    </AppShell>
  );
}

function ProductModal({ r, onPick, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,30,26,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal" style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 20, padding: "20px 20px 22px" }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{r.name}</div>
        <div style={{ fontSize: 13, color: C.inkSoft }}>{r.dong} · 전용 {r.areaM2}㎡ · {won(r.price)}원</div>
        <div style={{ margin: "12px 0 4px", padding: "10px 12px", borderRadius: 12, background: "#F7FAF7", border: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
            <span style={{ color: C.inkSoft }}>가능한 대출</span>
            <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>약 {won(r.loan)}원</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
            <span style={{ color: C.inkSoft }}>필요 현금</span>
            <span style={{ fontWeight: 800, color: C.greenDeep, fontVariantNumeric: "tabular-nums" }}>약 {won(r.cashNeeded)}원</span>
          </div>
        </div>
        <div style={{ fontSize: 13, color: C.ink, margin: "14px 0 12px", fontWeight: 600 }}>어떤 대출로 알아볼까요?</div>
        <button onClick={() => onPick("gov")} style={{ ...modalOpt, borderColor: C.greenDeep }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>정부대출 <span style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>디딤돌·보금자리</span></div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3 }}>금리 낮음 · 한도 빡빡 · 실행 느림(약 2개월)</div>
        </button>
        <button onClick={() => onPick("bank")} style={modalOpt}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>은행대출 <span style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>일반 주담대</span></div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3 }}>한도 넉넉 · 금리 높음 · 실행 빠름(약 2~4주)</div>
        </button>
        <button onClick={onClose} style={{ ...ghostBtn, width: "100%", marginTop: 10 }}>닫기</button>
      </div>
    </div>
  );
}

/* 대략 천장 → 매물별 정밀 판정으로 넘어갔다는 걸 숨기지 않는다. */
function PreciseNote() {
  return (
    <div className="slideup" style={{ marginTop: 10, padding: "9px 12px", borderRadius: 10, background: "#F7FAF7", border: `1px solid ${C.line}`, fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>
      <b style={{ color: C.greenDeep }}>자격 답변을 반영해서 다시 계산했어요.</b>
    </div>
  );
}
