/* 최상위 화면 전환 + 단계 오케스트레이션.
   진짜 URL 라우팅은 나중. 지금은 step state 하나로 전환한다.

   흐름:
     budget      지도(예산 리빌)
     list        가능한 매물 목록
      └ 팝업     매물 선택 → 정부/은행
     eligibility 자격 조건 입력 → 가능한 상품 목록   ← 자격은 여기서만 받는다
     strategy    부채·소득의 질 입력 + 구체 한도 + 지렛대 + 재배열

   상태 소유: 확정된 건 전부 여기 있고, 아래 화면은 props로 받아 쓴다.
   { 소득, 현금, 매물, 정부/은행, 자격답변, 선택상품, 부채·소득질 } */
import { useState, useMemo } from "react";
import { DATA, RULE, C, COLOR_VALUE, COLOR_TEXT, DONG_LABELS } from "./data.js";
import { evaluate, repaymentCapacity, buildCtx, won, eok } from "./engine.js";
import { AppShell, BackButton, Slider, eyebrow, h1, card, primaryBtn, ghostBtn, listItem, modalOpt, fine } from "./ui.jsx";
import Eligibility, { EMPTY_ELIG } from "./Eligibility.jsx";
import Strategy from "./Strategy.jsx";
import { EMPTY_DETAIL } from "./DetailInfo.jsx";

export default function App() {
  const [step, setStep] = useState("budget");
  const [income, setIncome] = useState(6500);
  const [cash, setCash] = useState(25000);
  const [selectedId, setSelectedId] = useState(null);  // 지도 인라인 상세
  const [modalUnit, setModalUnit] = useState(null);    // 정부/은행 선택 팝업

  const [unit, setUnit] = useState(null);              // 고른 매물
  const [kind, setKind] = useState("gov");             // 정부 | 은행
  const [elig, setElig] = useState(EMPTY_ELIG);        // 자격 답변 — Eligibility에서만 채운다
  const [pickedKey, setPickedKey] = useState(null);    // 가능 목록에서 고른 상품(규칙 key)
  const [detail, setDetail] = useState(EMPTY_DETAIL);  // 부채·소득의 질 — Strategy에서만 채운다

  // 기존 대출 0을 가정한 '천장'. 부채는 상품을 고른 뒤 Strategy에서 받는다.
  const dsrCap = useMemo(() => repaymentCapacity(income, RULE.DSR, RULE.loanRate, RULE.loanYears, 0), [income]);
  const results = useMemo(() => DATA.map((d) => evaluate(d, dsrCap, cash)), [dsrCap, cash]);
  const greenCount = results.filter((r) => r.color === "green").length;
  const amberCount = results.filter((r) => r.color === "amber").length;
  const selected = results.find((r) => r.id === selectedId) || null;
  const maxLoan = Math.min(dsrCap, RULE.seoulCap || Infinity);
  const reachable = results.filter((r) => r.color === "green" || r.color === "amber").sort((a, b) => a.price - b.price);

  /* 뒤 화면 전부가 공유하는 컨텍스트. 여기 담긴 건 절대 다시 묻지 않는다. */
  const ctx = useMemo(() => (unit ? buildCtx({ unit, cash, ownIncome: income, elig }) : null), [unit, cash, income, elig]);

  /* 팝업에서 정부/은행을 고르면 자격 화면으로. 자격 답변은 매물이 바뀌어도 유지한다
     — 같은 사람의 자격은 매물과 무관하니 다시 물으면 그게 중복이다. */
  function pickKind(k) {
    setUnit(modalUnit); setKind(k); setModalUnit(null);
    setPickedKey(null); setDetail(EMPTY_DETAIL);
    setStep("eligibility");
  }

  /* 가능 목록에서 상품 하나 선택 → 전략. 컨텍스트는 ctx가 통째로 넘어간다. */
  function pickProduct(key) { setPickedKey(key); setStep("strategy"); }

  return (
    <AppShell>
      {step === "budget" && (
        <>
          <div style={eyebrow}>노원구 · 그린라이트</div>
          <h1 style={h1}>소득만 알려주면,<br />살 수 있는 집에 불이 들어와요.</h1>
          {/* <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>로그인도, 조회도 없어요. 입력값은 이 화면 밖으로 나가지 않아요.</p> */}

          {/* <div style={{ ...card, marginTop: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 40, fontWeight: 800, color: C.greenDeep, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{greenCount}</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>곳, 천장 안에 들어와요</span>
            </div>
            <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 6 }}>경계선 <b style={{ color: C.amber }}>{amberCount}곳</b> · 소득만 보면 최대 <b>{eok(maxLoan)}</b>까지</div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}`, lineHeight: 1.6 }}>
              <b style={{ color: C.ink }}>기존 대출은 아직 안 뺐어요.</b> 지금 숫자는 대출이 하나도 없다고 봤을 때의 <b style={{ color: C.ink }}>천장</b>이에요. 부채가 있으면 여기서 내려가지만, 그걸로 문이 닫히진 않아요 — 상품을 고른 뒤에 함께 따져봐요.
            </div>
          </div> */}



          <Map results={results} selectedId={selectedId} onPick={setSelectedId} />
          <Legend />
                              <div style={{ marginTop: 16 }}>
            <Slider label="나의 연소득" value={income} min={2000} max={12000} step={100} onChange={setIncome} display={won(income) + "원"} />
            <Slider label="보유 현금" value={cash} min={0} max={70000} step={500} onChange={setCash} display={won(cash) + "원"} />
          </div>
          <div style={{ ...card, marginTop: 16, minHeight: 100, borderColor: selected ? COLOR_VALUE[selected.color] : C.line, transition: "border-color .3s" }}>
            {!selected ? <div style={{ color: C.inkSoft, fontSize: 14, paddingTop: 6 }}>지도에서 단지를 눌러보세요. 당신 예산에서 어떻게 보이는지 알려드릴게요.</div> : <Detail r={selected} />}
          </div>



          <button onClick={() => setStep("list")} style={primaryBtn}>가능한 매물목록 확인하기 →</button>
          <p style={fine}>기존 대출을 0으로 둔 상한선이라 실제 한도는 이보다 낮게 나올 수 있어요. 실거래가 기반 근사치예요. 정확한 담보평가·대출 가부는 상담역이 확정합니다. 데이터·상품 규칙 일부는 예시값이에요. 이 화면은 대출을 약속하지 않아요.</p>
        </>
      )}

      {step === "list" && (
        <div className="slideup">
          <BackButton onClick={() => setStep("budget")}>지도로</BackButton>
          <div style={eyebrow}>가능한 매물</div>
          <h1 style={h1}>지금 예산으로<br />닿는 집들이에요.</h1>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: "0 0 14px" }}>하나를 고르면 어떤 대출로 갈지 함께 정해드려요.</p>
          {reachable.length === 0 && <div style={{ ...card, color: C.inkSoft, fontSize: 14 }}>지금은 닿는 매물이 없어요. 지도 화면에서 소득·현금을 조정해보세요.</div>}
          {reachable.map((r) => (
            <button key={r.id} onClick={() => setModalUnit(r)} style={listItem}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <i style={{ width: 12, height: 12, borderRadius: "50%", background: COLOR_VALUE[r.color], flex: "0 0 auto" }} />
                <div>
                  <div style={{ fontSize: 15, color : C.inkSoft, fontWeight: 700 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{r.dong} · 전용 {r.areaM2}㎡ · {won(r.price)}원</div>
                </div>
              </div>
              <span style={{ fontSize: 13, color: r.color === "green" ? C.greenDeep : C.amber, fontWeight: 700 }}>{r.slack >= 0 ? `여유 ${won(r.slack)}` : `${won(r.slack)} 부족`} ›</span>
            </button>
          ))}
        </div>
      )}

      {step === "eligibility" && ctx && (
        <Eligibility
          unit={unit} cash={cash} ownIncome={income}
          kind={kind} setKind={setKind}
          elig={elig} setElig={setElig}
          onBack={() => setStep("list")} onPick={pickProduct} />
      )}

      {step === "strategy" && ctx && (
        <Strategy
          ctx={ctx} pickedKey={pickedKey} onPickOther={setPickedKey}
          detail={detail} setDetail={setDetail}
          onBack={() => setStep("eligibility")} />
      )}

      {modalUnit && <ProductModal r={modalUnit} onPick={pickKind} onClose={() => setModalUnit(null)} />}
    </AppShell>
  );
}

/* ── 예산 화면 조각들 ── */
function ProductModal({ r, onPick, onClose }) {
  const toneColor = r.color === "green" ? C.greenDeep : r.color === "amber" ? "#9A6B12" : C.inkSoft;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,30,26,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal" style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 20, padding: "20px 20px 22px" }}>
        <div style={{ fontSize: 12, color: toneColor, fontWeight: 700 }}>{COLOR_TEXT[r.color]}</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{r.name}</div>
        <div style={{ fontSize: 13, color: C.inkSoft }}>{r.dong} · 전용 {r.areaM2}㎡ · {won(r.price)}원</div>
        <div style={{ fontSize: 13, color: C.ink, margin: "14px 0 12px", fontWeight: 600 }}>어떤 대출로 알아볼까요?</div>
        <button onClick={() => onPick("gov")} style={{ ...modalOpt, borderColor: C.greenDeep }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>정부상품 <span style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>디딤돌·보금자리</span></div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3 }}>금리 낮음 · 한도 빡빡 · 실행 느림(약 2개월)</div>
        </button>
        <button onClick={() => onPick("bank")} style={modalOpt}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>은행상품 <span style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>일반 주담대</span></div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3 }}>한도 넉넉 · 금리 높음 · 실행 빠름(약 2~4주)</div>
        </button>
        <button onClick={onClose} style={{ ...ghostBtn, width: "100%", marginTop: 10 }}>닫기</button>
      </div>
    </div>
  );
}

function Map({ results, selectedId, onPick }) {
  return (
    <div style={{ position: "relative", marginTop: 18, height: 320, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#EEF2EE 1px,transparent 1px),linear-gradient(90deg,#EEF2EE 1px,transparent 1px)", backgroundSize: "38px 38px" }} />
      {DONG_LABELS.map((d) => <span key={d.name} style={{ position: "absolute", left: `${d.x}%`, top: `${d.y}%`, transform: "translate(-50%,-50%)", fontSize: 11, color: "#AEB6B2", fontWeight: 600 }}>{d.name}</span>)}
      {results.map((r, i) => { const on = selectedId === r.id; return <button key={r.id} onClick={() => onPick(r.id)} aria-label={r.name} className="dot" style={{ position: "absolute", left: `${r.x}%`, top: `${r.y}%`, transform: `translate(-50%,-50%) scale(${on ? 1.35 : 1})`, width: 26, height: 26, borderRadius: "50%", cursor: "pointer", background: COLOR_VALUE[r.color], border: `2px solid ${on ? C.ink : "#fff"}`, boxShadow: on ? "0 4px 14px rgba(0,0,0,.22)" : "0 1px 3px rgba(0,0,0,.14)", animationDelay: `${i * 45}ms`, zIndex: on ? 5 : 1 }} />; })}
    </div>
  );
}

function Legend() {
  return <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: C.inkSoft }}>
    {[["green", "살 수 있어요"], ["amber", "경계"], ["grey", "지금은 무리"]].map(([k, t]) => <span key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}><i style={{ width: 11, height: 11, borderRadius: "50%", background: COLOR_VALUE[k], display: "inline-block" }} />{t}</span>)}
  </div>;
}

function Detail({ r }) {
  const limitNote = r.limitedBy === "ltv" ? "담보(LTV) 한도에서 먼저 걸려요. 소득을 올려도 이 벽은 안 내려가고, 현금 비중을 높여야 열려요." : "소득이 늘면 열려요. (배우자 합산 소득도 가능해요.) ";
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <div style={{ fontSize: 17, fontWeight: 800 }}>{r.name}</div><div style={{ fontSize: 13, color: C.inkSoft }}>{r.dong} · 전용 {r.areaM2}㎡</div>
    </div>
    <div style={{ fontSize: 20, fontWeight: 800, margin: "4px 0 10px", fontVariantNumeric: "tabular-nums" }}>{won(r.price)}원</div>
    {r.color === "green" && <div style={{ fontSize: 14, color: C.greenDeep, lineHeight: 1.6 }}><b>예산 안에 들어와요.</b> 약 {won(r.slack)}원 여유가 있어요.</div>}
    {r.color === "amber" && <div style={{ fontSize: 14, color: "#9A6B12", lineHeight: 1.6 }}><b>경계선이에요.</b> 전략을 세우면 열릴 수 있어요. {limitNote}</div>}
    {r.color === "grey" && <div style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.6 }}><b>약 {won(-r.slack)}원 부족해요.</b> {limitNote}</div>}
  </div>;
}
