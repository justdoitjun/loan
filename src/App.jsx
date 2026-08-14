/* 최상위 화면 전환 + 단계 오케스트레이션.
   진짜 URL 라우팅은 나중. 지금은 step state 하나로 전환한다.

   흐름:
     budget      지도(예산 리빌)
     list        가능한 매물 목록
      └ 팝업     매물 선택 → 정부/은행
     eligibility 자격 조건 입력 → 가능한 상품 목록   ← 자격은 여기서만 받는다
     strategy    부채 입력 + 구체 한도 + 지렛대

   상태 소유는 둘로 갈린다:
     사람 상태(person)  — 매물과 무관한 것 전부. person.js의 한 객체에 모여 있고 화면을 오가도 유지된다.
                          { ownIncome, cash, elig, detail, pull, incomeCheck }
     화면 상태(여기 지역) — 지금 어느 매물을 보고 있나·어느 단계인가 같은 '탐색' 상태.
                          { step, unit, kind, pickedKey, selectedId, modalUnit, budgetConfirmed }
   이 경계가 핵심이다. 매물을 바꿔도 사람은 안 바뀌므로 자격·부채·레버를 다시 묻지 않는다. */
import { useState, useMemo } from "react";
import { DATA, RULE, C, COLOR_VALUE, COLOR_TEXT, DONG_LABELS } from "./data.js";
import { evaluate, repaymentCapacity, buildCtx, won } from "./engine.js";
import { AppShell, BackButton, Slider, eyebrow, h1, card, primaryBtn, ghostBtn, listItem, modalOpt, fine } from "./ui.jsx";
import { EMPTY_PERSON, personReady } from "./person.js";
import { judgeUnits } from "./verdict.js";
import Eligibility from "./Eligibility.jsx";
import Strategy from "./Strategy.jsx";
import IncomeCheck, { incomeCheckResult } from "./IncomeCheck.jsx";

export default function App() {
  /* ── 사람 상태: 이 앱에서 "사람"에 관한 건 전부 이 한 객체다 ── */
  const [person, setPerson] = useState(EMPTY_PERSON);
  /* 조각 하나만 갈아끼운다. 값도 updater 함수도 받는다 — 하위 화면이 쓰던
     setElig((s) => ({...s, ...})) 관용구를 그대로 쓸 수 있게 하기 위해서다. */
  const patch = (key, v) => setPerson((p) => ({ ...p, [key]: typeof v === "function" ? v(p[key]) : v }));
  const setElig = (v) => patch("elig", v);
  const setDetail = (v) => patch("detail", v);
  const setPull = (v) => patch("pull", v);
  const { ownIncome: income, cash } = person;

  /* ── 화면(탐색) 상태: 지금 어디를 보고 있나. 사람과 섞지 않는다 ── */
  const [step, setStep] = useState("budget");
  /* 소득·현금도 부채 슬라이더와 같은 원칙 — 0(맨 왼쪽)에서 시작하고, 아직 "확정"은 안 된 상태.
     budgetConfirmed가 켜지기 전엔 지도가 실제 색으로 안 물든다(아래 shellResults) —
     리빌은 슬라이더를 만지작거리는 중이 아니라 "이걸로 볼게요"라고 확정한 순간 일어난다. */
  const [budgetConfirmed, setBudgetConfirmed] = useState(false);
  const [selectedId, setSelectedId] = useState(null);  // 지도 인라인 상세
  const [modalUnit, setModalUnit] = useState(null);    // 정부/은행 선택 팝업
  const [unit, setUnit] = useState(null);              // 고른 매물
  const [kind, setKind] = useState("gov");             // 정부 | 은행
  const [pickedKey, setPickedKey] = useState(null);    // 가능 목록에서 고른 상품(규칙 key)

  const incomeTrustResult = incomeCheckResult(person.incomeCheck); // null | { tone, type, notes }

  /* ── 지도 채색: 대략(천장) → 정밀(매물별 판정) 두 모드 ──
     자격 답변 전엔 상품 판정을 돌릴 수 없으니 기존대로 DSR 근사 천장으로 칠한다.
     자격이 다 차는 순간 precise가 켜지고, 그때부터 모든 매물이 judgeUnit을 거친다 —
     실제 자격·상품별 한도·레버까지 반영된 색이다. 레버를 당기면 이 배열이 통째로 다시 나온다. */
  const dsrCap = useMemo(() => repaymentCapacity(income, RULE.DSR, RULE.loanRate, RULE.loanYears, 0), [income]);
  const precise = personReady(person);
  const results = useMemo(
    () => (precise ? judgeUnits(DATA, person) : DATA.map((d) => evaluate(d, dsrCap, cash))),
    [precise, person, dsrCap, cash],
  );
  /* 확정 전의 지도 — 실제 색 대신 회색 껍데기. 슬라이더를 옮기는 중엔 아직 안 보여주고,
     "이 조건으로 알아볼게요"를 눌러야 비로소 켜진다(한 번의 리빌). */
  const shellResults = useMemo(() => results.map((r) => ({ ...r, color: "grey" })), [results]);
  const shownResults = budgetConfirmed ? results : shellResults;
  const selected = results.find((r) => r.id === selectedId) || null;
  const reachable = results.filter((r) => r.color === "green" || r.color === "amber").sort((a, b) => a.price - b.price);

  /* 뒤 화면 전부가 공유하는 컨텍스트. 여기 담긴 건 절대 다시 묻지 않는다. */
  const ctx = useMemo(() => (unit ? buildCtx({ unit, cash, ownIncome: income, elig: person.elig }) : null), [unit, cash, income, person.elig]);

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
    setUnit(next); setSelectedId(id); setPickedKey(null);
  }

  return (
    <AppShell>
      {step === "budget" && (
        <>
          <div style={eyebrow}>노원구 · 그린라이트</div>
          <h1 style={h1}>내가 살 수 있는 집은?</h1>
          {/* mode를 넘겨서 대략→정밀 전환 때 점들이 한 번 더 물들게 한다(기존 pop 애니메이션 재사용) */}
          <Map results={shownResults} mode={precise ? "precise" : "rough"} selectedId={selectedId} onPick={setSelectedId} />
          <Legend />
          {precise && <PreciseNote />}
          <div style={{ marginTop: 16 }}>
            <Slider label="나의 연소득" value={income} min={0} max={12000} step={100} onChange={(v) => patch("ownIncome", v)} display={won(income) + "원"} />
            <Slider label="보유 현금" value={cash} min={0} max={70000} step={500} onChange={(v) => patch("cash", v)} display={won(cash) + "원"} />
          </div>

          <button onClick={() => setStep("incomeCheck")} style={{ ...ghostBtn, width: "100%", marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>내 소득, 그대로 인정될지 미리 확인해볼까요?</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: incomeTrustResult ? (incomeTrustResult.tone === "green" ? C.greenDeep : C.amber) : C.inkSoft }}>
              {incomeTrustResult ? (incomeTrustResult.tone === "green" ? "확인함 · 초록" : "확인함 · 노랑") : "확인 안 함 →"}
            </span>
          </button>

          {!budgetConfirmed ? (
            <div style={{ ...card, marginTop: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>
                연소득 {won(income)}원 · 현금 {won(cash)}원 — 이 소득과 현금으로 알아볼까요?
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 5, marginBottom: 13, lineHeight: 1.55 }}>
                슬라이더를 옮겨서 맞추고 확인하면, 지도에 살 수 있는 집이 바로 켜져요.
              </div>
              <button onClick={() => setBudgetConfirmed(true)} style={primaryBtn}>네, 이걸로 알아볼게요</button>
            </div>
          ) : (
            <>
              <div style={{ ...card, marginTop: 16, minHeight: 100, borderColor: selected ? COLOR_VALUE[selected.color] : C.line, transition: "border-color .3s" }}>
                {!selected ? <div style={{ color: C.inkSoft, fontSize: 14, paddingTop: 6 }}>지도에서 단지를 눌러보세요. 당신 예산에서 어떻게 보이는지 알려드릴게요.</div> : <Detail r={selected} />}
              </div>

              <button onClick={() => setStep("list")} style={primaryBtn}>가능한 매물목록 확인하기 →</button>
              <p style={fine}>기존 대출을 0으로 둔 상한선이라 실제 한도는 이보다 낮게 나올 수 있어요. 실거래가 기반 근사치예요. 정확한 담보평가·대출 가부는 상담역이 확정합니다. 데이터·대출 규칙 일부는 예시값이에요. 이 화면은 대출을 약속하지 않아요.</p>
            </>
          )}
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

      {step === "incomeCheck" && (
        <IncomeCheck value={person.incomeCheck} onChange={(v) => patch("incomeCheck", v)} onBack={() => setStep("budget")} />
      )}

      {step === "eligibility" && ctx && (
        <Eligibility
          unit={unit} cash={cash} ownIncome={income}
          kind={kind} setKind={setKind}
          elig={person.elig} setElig={setElig}
          onBack={() => setStep("list")} onPick={pickProduct} />
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

/* 대략 천장 → 매물별 정밀 판정으로 넘어갔다는 걸 숨기지 않는다.
   같은 지도가 다른 근거로 칠해졌으면 그렇다고 말해야 한다(안 그러면 "아까랑 색이 다른데?"가 남는다). */
function PreciseNote() {
  return (
    <div className="slideup" style={{ marginTop: 10, padding: "9px 12px", borderRadius: 10, background: "#F7FAF7", border: `1px solid ${C.line}`, fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>
      <b style={{ color: C.greenDeep }}>자격 답변을 반영해서 다시 칠했어요.</b> 이제 소득 근사치가 아니라 <b>실제 자격·대출별 한도</b>로 본 색이에요. 전략에서 레버를 당기면 여기도 같이 움직여요.
    </div>
  );
}

/* mode가 바뀌면 key가 바뀌어 점이 다시 마운트된다 → pop 애니메이션이 한 번 더 돈다.
   색만 슬쩍 바꾸면 "판정 근거가 바뀌었다"는 사건이 안 보인다. 리빌은 두 번 일어나야 맞다. */
function Map({ results, mode = "rough", selectedId, onPick }) {
  return (
    <div style={{ position: "relative", marginTop: 18, height: 320, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#EEF2EE 1px,transparent 1px),linear-gradient(90deg,#EEF2EE 1px,transparent 1px)", backgroundSize: "38px 38px" }} />
      {DONG_LABELS.map((d) => <span key={d.name} style={{ position: "absolute", left: `${d.x}%`, top: `${d.y}%`, transform: "translate(-50%,-50%)", fontSize: 11, color: "#AEB6B2", fontWeight: 600 }}>{d.name}</span>)}
      {results.map((r, i) => { const on = selectedId === r.id; return <button key={`${mode}-${r.id}`} onClick={() => onPick(r.id)} aria-label={r.name} className="dot" style={{ position: "absolute", left: `${r.x}%`, top: `${r.y}%`, transform: `translate(-50%,-50%) scale(${on ? 1.35 : 1})`, width: 26, height: 26, borderRadius: "50%", cursor: "pointer", background: COLOR_VALUE[r.color], border: `2px solid ${on ? C.ink : "#fff"}`, boxShadow: on ? "0 4px 14px rgba(0,0,0,.22)" : "0 1px 3px rgba(0,0,0,.14)", animationDelay: `${i * 45}ms`, zIndex: on ? 5 : 1 }} />; })}
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
