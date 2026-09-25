import { useState, useMemo, useLayoutEffect, useRef, useId } from "react";
import { DATA, CITY, GUS, DONGS, RULE, C } from "./data.js";
import { evaluate, repaymentCapacity, buildCtx, won } from "./engine.js";
import { AppShell, Slider, eyebrow, h1, ghostBtn, listItem, modalOpt, fine, BottomSheet, useOverlayLock } from "./ui.jsx";
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
  const [place, setPlace] = useState({ city: CITY, gu: "노원구", dong: "중계본동" });
  const [sheet, setSheet] = useState(null);            // "gu" | "dong" | null

  const incomeTrustResult = incomeCheckResult(person.incomeCheck); // null | { tone, type, notes }

  /* ── 매물별 대출·필요 현금: 대략(천장) → 정밀(매물별 판정) 두 모드 ──
     자격 답변 전엔 상품 판정을 돌릴 수 없으니 DSR 근사 천장으로 본다.
     자격이 다 차는 순간 precise가 켜지고, 그때부터 모든 매물이 judgeUnit을 거친다 —
     실제 자격·상품별 한도·레버까지 반영된 숫자다. 레버를 당기면 이 배열이 통째로 다시 나온다. */
  const dsrCap = useMemo(() => repaymentCapacity(income, RULE.DSR, RULE.loanRate, RULE.loanYears, 0), [income]);
  const precise = personReady(person);
  const scoped = useMemo(
    () => DATA.filter((d) => d.city === place.city && d.gu === place.gu && (d.dong === place.dong || d.dong === legalDongOf(place.dong))),
    [place],
  );
  const results = useMemo(
    () => (precise ? judgeUnits(scoped, person) : scoped.map((d) => evaluate(d, dsrCap))),
    [precise, person, dsrCap, scoped],
  );
  const listed = useMemo(
    () => [...results].sort((a, b) => b.cashNeeded - a.cashNeeded || b.price - a.price),
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
    const next = scoped.find((d) => d.id === id);
    if (!next) return;
    setUnit(next); setPickedKey(null);
  }

  const overlay = sheet || modalUnit;

  return (
    <AppShell>
      <div inert={overlay ? "" : undefined}>
      {step === "budget" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={eyebrow}>그린라이트</div>
            <PlacePath place={place} sheet={sheet} onGu={() => setSheet("gu")} onDong={() => setSheet("dong")} />
          </div>
          <h1 style={h1}>내 소득으로<br />가능한 집은 얼마일까요?</h1>
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
            <span style={{ fontSize: 12, color: C.inkSoft }}>필요 현금 많은 순</span>
          </div>
          {listed.map((r) => (
            <button key={r.id} onClick={() => setModalUnit(r)} style={listItem}>
              <div>
                <div style={{ fontSize: 15, color: C.ink, fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{r.dong} · 전용 {r.areaM2}㎡ · 평균시세 {won(r.price)}원</div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3 }}>추가로 필요한 현금 {won(r.cashNeeded)}원</div>
              </div>
              <span style={{ fontSize: 15, color: C.greenDeep, fontWeight: 800, textAlign: "right", flex: "0 0 auto" }}>
                대출 {won(r.loan)} ›
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
          units={scoped}
          onBack={() => setStep("eligibility")} />
      )}
      </div>

      {modalUnit && <ProductModal r={modalUnit} onPick={pickKind} onClose={() => setModalUnit(null)} />}
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

/* 행정동 → 매물 데이터의 법정동. 중계1동·중계본동 → 중계동. 매물 없는 동은 그대로여서 목록이 빈다. */
function legalDongOf(dong) {
  if (!dong) return dong;
  return dong.replace(/본동$/, "동").replace(/제?\d+(·\d+)*동$/, "동");
}

function unitCount(gu, dong) {
  return DATA.filter((d) => d.gu === gu && (!dong || d.dong === dong || d.dong === legalDongOf(dong))).length;
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

function ProductModal({ r, onPick, onClose }) {
  const panelRef = useRef(null);
  const titleId = useId();
  useOverlayLock(onClose, panelRef);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,30,26,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 18 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onClick={(e) => e.stopPropagation()} className="modal" style={{ width: "100%", maxWidth: 420, maxHeight: "min(90dvh, 720px)", overflowY: "auto", background: "#fff", color: C.ink, colorScheme: "light", borderRadius: 20, padding: "20px 20px 22px", outline: "none" }}>
        <div id={titleId} style={{ fontSize: 18, fontWeight: 800 }}>{r.name}</div>
        <div style={{ fontSize: 13, color: C.inkSoft }}>{r.dong} · 전용 {r.areaM2}㎡ · {won(r.price)}원</div>
        <div style={{ margin: "12px 0 4px", padding: "10px 12px", borderRadius: 12, background: "#F7FAF7", border: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
            <span style={{ color: C.inkSoft }}>가능한 대출</span>
            <span style={{ fontWeight: 800, color: C.greenDeep, fontVariantNumeric: "tabular-nums" }}>약 {won(r.loan)}원</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
            <span style={{ color: C.inkSoft }}>필요 현금</span>
            <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>약 {won(r.cashNeeded)}원</span>
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
