import { useState, useMemo, useLayoutEffect, useRef, useId } from "react";
import { RULE, C, REVEAL } from "./data.js";
import { UNITS } from "./units.js";
import { CITY, GUS, DONGS } from "./geo.js";
import { evaluate, repaymentCapacity, buildCtx, affordablePrice, won } from "./engine.js";
import { AppShell, pill, BottomSheet, useOverlayLock } from "./ui.jsx";
import { EMPTY_PERSON, personReady, emptyDebts } from "./person.js";
import { judgeUnits, judgeUnit } from "./verdict.js";
import Home from "./Home.jsx";
import Eligibility from "./Eligibility.jsx";
import Strategy from "./Strategy.jsx";
import IncomeCheck from "./IncomeCheck.jsx";
import { incomeCheckResult } from "./incomeCheck.js";

export default function App() {
  /* 연소득 초기값은 홈 리빌 기본값(data.REVEAL) — 진입 시 초록이 3~4곳 보이는 선. EMPTY_PERSON 자체는 그대로다. */
  const [person, setPerson] = useState(() => ({ ...EMPTY_PERSON, ownIncome: REVEAL.defaultIncome }));
  const patch = (key, v) => setPerson((p) => ({ ...p, [key]: typeof v === "function" ? v(p[key]) : v }));
  const setElig = (v) => patch("elig", v);
  const setDetail = (v) => patch("detail", v);
  const setPull = (v) => patch("pull", v);
  const { ownIncome: income } = person;
  const [step, setStep] = useState("budget");
  const [incomeAsk, setIncomeAsk] = useState(null);  // 매물을 누르고, 이 소득으로 볼지 묻는 중
  const [unit, setUnit] = useState(null);              // 고른 매물
  const [pickedKey, setPickedKey] = useState(null);    // 가능 목록에서 고른 상품(규칙 key)
  const [place, setPlace] = useState({ city: CITY, gu: "노원구", dong: "중계동" });
  const [sheet, setSheet] = useState(null);            // "gu" | "dong" | null
  /* 보유 현금 — 홈 화면 전용 리빌 가정값(화면상태). 사람상태에 넣지 않고 다른 화면은 읽지 않는다(ux.md 1단계). */
  const [cash, setCash] = useState(REVEAL.defaultCash);

  const incomeTrustResult = incomeCheckResult(person.incomeCheck); // null | { tone, type, notes }

  /* ── 매물별 대출·필요 현금: 대략(천장) → 정밀(매물별 판정) 두 모드 ──
     자격 답변 전엔 상품 판정을 돌릴 수 없으니 DSR 근사 천장으로 본다.
     자격이 다 차는 순간 precise가 켜지고, 그때부터 모든 매물이 judgeUnit을 거친다 —
     실제 자격·상품별 한도·레버까지 반영된 숫자다. 레버를 당기면 이 배열이 통째로 다시 나온다. */
  const dsrCap = useMemo(() => repaymentCapacity(income, RULE.DSR, RULE.loanRate, RULE.loanYears, 0), [income]);
  const precise = personReady(person);
  const scoped = useMemo(
    () => UNITS.filter((d) => d.city === place.city && d.gu === place.gu && d.dong === place.dong),
    [place],
  );
  const results = useMemo(
    () => (precise ? judgeUnits(scoped, person) : scoped.map((d) => evaluate(d, dsrCap))),
    [precise, person, dsrCap, scoped],
  );
  /* 예산선 시세 = 지금 현금으로 닿는 최대 시세. 목록과 같은 잣대(대략 → 정밀)를 가격만 바꿔 되묻는다.
     정밀 모드는 상품 가격상한 때문에 근사다(engine.affordablePrice 주석). 단지 접기·정렬은 Home이 reveal.js로 한다. */
  const budgetPrice = useMemo(() => {
    const probe = (price) => ({ id: "probe", name: "", gu: place.gu, dong: place.dong, areaM2: 84, price });
    const loanAt = precise ? (p) => judgeUnit(probe(p), person).loan : (p) => evaluate(probe(p), dsrCap).loan;
    return affordablePrice(cash, loanAt);
  }, [cash, precise, person, dsrCap, place]);

  /* 뒤 화면 전부가 공유하는 컨텍스트. 여기 담긴 건 절대 다시 묻지 않는다. */
  const ctx = useMemo(() => (unit ? buildCtx({ unit, ownIncome: income, elig: person.elig }) : null), [unit, income, person.elig]);


  /* 가능 목록에서 상품 하나 선택 → 전략. 컨텍스트는 ctx가 통째로 넘어간다. */
  function pickProduct(key) { setPickedKey(key); setStep("strategy"); }

  /* 방법 화면에서 만든 가정(부채 확정·레버)을 비운다.
     뒤로 가는 것은 선택을 다시 하는 것이다. 자격 답변과 연소득 슬라이더는 그대로 둔다. */
  function clearStrategy() {
    setPull(null);
    setPickedKey(null);
    setDetail({ debts: emptyDebts(), debtConfirmed: false, incomeQuality: { type: null, stable: null } });
  }

  /* 소득 확인 Yes → 바로 자격 화면. 정부/은행을 고르는 팝업은 없다(ux.md 2단계).
     ⚠️ 여기서 사람 상태를 하나도 지우지 않는다 — 자격도 부채도 레버도 매물과 무관하기 때문.
        초기화하는 건 '고른 상품'뿐인데, 매물이 바뀌면 통과 목록이 달라져 이전 선택이 유효하지 않을 수 있어서다. */
  function acceptIncome() {
    if (!incomeAsk) return;
    setUnit(incomeAsk);
    setPickedKey(null);
    setIncomeAsk(null);
    setStep("eligibility");
  }

  /* 방법 화면에서 다른 매물을 골랐을 때 — 화면 전환 없이 '목표 매물'만 갈아끼운다.
     ⚠️ 사람 상태(자격·부채·레버)는 건드리지 않는다. 고른 상품(pickedKey)도 그대로 둔다 —
        상품은 사람이 고른 것이다. 새 매물에서 안 열리면 방법 화면이 가장 크게 열리는 길로 대신 보여 주고
        그렇다고 말한다. 다시 열리는 매물로 가면 고른 상품으로 돌아온다. */
  function swapUnit(id) {
    const next = scoped.find((d) => d.id === id);
    if (!next) return;
    setUnit(next);
  }

  const overlay = sheet || incomeAsk;

  return (
    <AppShell>
      <div inert={overlay ? "" : undefined}>
      {step === "budget" && (
        <Home
          header={<PlacePath place={place} sheet={sheet} onGu={() => setSheet("gu")} onDong={() => setSheet("dong")} />}
          dong={place.dong}
          income={income} setIncome={(v) => patch("ownIncome", v)} incomeMax={12000}
          cash={cash} setCash={setCash}
          results={results} budgetPrice={budgetPrice}
          onPickUnit={setIncomeAsk} />
      )}

      {step === "incomeCheck" && (
        <IncomeCheck value={person.incomeCheck} onChange={(v) => patch("incomeCheck", v)} onBack={() => setStep("budget")} />
      )}

      {step === "eligibility" && ctx && (
        <Eligibility
          unit={unit} ownIncome={income}
          elig={person.elig} setElig={setElig}
          onBack={() => { clearStrategy(); setStep("budget"); }} onPick={pickProduct} />
      )}

      {step === "strategy" && ctx && (
        <Strategy
          ctx={ctx} person={person} pickedKey={pickedKey}
          detail={person.detail} setDetail={setDetail}
          pull={person.pull} setPull={setPull}
          onSwapUnit={swapUnit}
          onPickProduct={setPickedKey}
          units={scoped}
          onBack={() => { clearStrategy(); setStep("eligibility"); }} />
      )}
      </div>

      {incomeAsk && <IncomeAsk income={income} onYes={acceptIncome} onNo={() => setIncomeAsk(null)} />}
      {sheet && (
        <PlaceSheet
          start={sheet}
          place={place}
          onCommit={setPlace}
          onClose={() => setSheet(null)} />
      )}
    </AppShell>
  );
}

/* 지역 목록의 동과 매물 데이터의 동은 둘 다 법정동이라 이름 그대로 맞춘다. */
function unitCount(gu, dong) {
  return UNITS.filter((d) => d.gu === gu && (!dong || d.dong === dong)).length;
}

function PlacePath({ place, onGu, onDong, sheet }) {
  const dongs = DONGS[place.gu] ?? [];
  return (
    <div className="path">
      <span className="path-city">{place.city}</span>
      <span className="path-sep">&gt;</span>
      <button type="button" className="path-btn" aria-haspopup="dialog" aria-expanded={sheet === "gu"} onClick={onGu}>
        {place.gu}<span className="path-caret" aria-hidden="true" />
      </button>
      {place.dong && dongs.length > 0 && (
        <>
          <span className="path-sep">&gt;</span>
          <button type="button" className="path-btn" aria-haspopup="dialog" aria-expanded={sheet === "dong"} onClick={onDong}>
            {place.dong}<span className="path-caret" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}

/* 구를 고르는 일과 동을 고르는 일은 한 장이다.
   구만 확정하면 첫 동이 임의로 들어가 목록이 비므로, 동을 고를 때까지 지역을 바꾸지 않는다. */
function PlaceSheet({ start, place, onCommit, onClose }) {
  const [level, setLevel] = useState(start);
  const [gu, setGu] = useState(place.gu);
  const [q, setQ] = useState("");
  const bodyRef = useRef(null);
  const closeRef = useRef(null);
  const dongs = DONGS[gu] ?? [];
  const query = q.trim();
  const shown = query ? dongs.filter((d) => d.includes(query)) : dongs;

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = 0;
    if (query) return;
    const cur = el.querySelector("[aria-current='true']");
    if (!cur) return;
    const c = el.getBoundingClientRect();
    const r = cur.getBoundingClientRect();
    el.scrollTop += (r.top + r.height / 2) - (c.top + c.height / 2);
  }, [level, gu, query]);

  function pickGu(opt) {
    setGu(opt);
    setQ("");
    setLevel("dong");
  }
  function pickDong(dong) {
    onCommit({ city: CITY, gu, dong });
    closeRef.current?.();
  }

  const finding = level === "dong";
  return (
    <BottomSheet
      title={finding ? "동을 골라요" : "구를 골라요"}
      subtitle={finding ? gu : "고르면 동을 이어서 골라요"}
      back={finding ? (
        <button type="button" className="sheet-back" aria-label="구 다시 고르기" onClick={() => { setQ(""); setLevel("gu"); }}>← 구</button>
      ) : null}
      pinned={finding ? (
        <div className="place-findwrap">
          <input
            className="place-find"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="동 이름"
            aria-label="동 이름"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search" />
          {q ? (
            <button type="button" className="place-find-clear" aria-label="검색 지우기" onClick={() => setQ("")}>×</button>
          ) : null}
        </div>
      ) : null}
      onClose={onClose}
      closeRef={closeRef}
      bodyRef={bodyRef}
    >
      <div key={`${level}:${gu}`} className="sheet-pane">
        {level === "gu" ? (
          <div className="place-gus">
            {GUS.map((opt) => {
              const count = unitCount(opt);
              return (
                <button key={opt} type="button" className="place-gu" aria-current={opt === gu ? "true" : undefined} onClick={() => pickGu(opt)}>
                  <span>{opt}</span>
                  {count > 0 ? <span className="place-count">{count}건</span> : null}
                </button>
              );
            })}
          </div>
        ) : shown.length === 0 ? (
          <p className="place-empty">그 이름의 동이 없어요</p>
        ) : (
          shown.map((opt) => {
            const on = gu === place.gu && opt === place.dong;
            const count = unitCount(gu, opt);
            return (
              <button key={opt} type="button" className="place-dong" aria-current={on ? "true" : undefined} onClick={() => pickDong(opt)}>
                <span>{opt}</span>
                <span className="place-side">
                  {count > 0 ? <span className="place-count">{count}건</span> : null}
                  {on ? <span className="place-check" aria-hidden="true">✓</span> : null}
                </span>
              </button>
            );
          })
        )}
      </div>
    </BottomSheet>
  );
}

/* 매물을 누르자마자 정부/은행으로 가지 않는다. 지금 슬라이더 소득으로 볼지 먼저 묻는다. */
function IncomeAsk({ income, onYes, onNo }) {
  const panelRef = useRef(null);
  const titleId = useId();
  useOverlayLock(onNo, panelRef);
  return (
    <div onClick={onNo} style={{ position: "fixed", inset: 0, background: "rgba(32,28,22,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 18 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onClick={(e) => e.stopPropagation()} className="modal" style={{ width: "100%", maxWidth: 420, background: "#fff", color: C.ink, colorScheme: "light", borderRadius: 20, padding: "20px 20px 22px", outline: "none" }}>
        <h2 id={titleId} data-fit="line" style={{ fontSize: 18, fontWeight: 800, margin: 0, lineHeight: 1.4 }}>소득 {won(income)}원으로 평가해볼까요?</h2>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onYes} style={pill(true)}>Yes</button>
          <button type="button" onClick={onNo} style={pill(false)}>No</button>
        </div>
      </div>
    </div>
  );
}

/* 대략 천장 → 매물별 정밀 판정으로 넘어갔다는 걸 숨기지 않는다. */
function PreciseNote() {
  return (
    <div className="slideup" style={{ marginTop: 10, padding: "9px 12px", borderRadius: 10, background: C.softer, border: `1px solid ${C.line}`, fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>
      <b style={{ color: C.greenDeep }}>자격 답변을 반영해서 다시 계산했어요.</b>
    </div>
  );
}
