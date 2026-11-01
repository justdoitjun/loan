/* 홈 화면(예산 리빌) — 규칙은 .claude/rules/ux.md 「화면 흐름」 1단계 · 「홈 리빌 모션」 · 「색의 뜻」.
   이 화면의 단 하나 = "회색이 초록으로 차오르는 순간".
   계산은 하지 않는다. App이 매물별 대출·필요 현금(evaluate / judgeUnits)과 예산선 시세(affordablePrice)를 넘기고,
   여기는 reveal.js로 단지 단위로 접어 그리기만 한다. 색은 판정이 아니라 내 현금 대비 구간이고 숫자를 항상 같이 적는다.
   보유 현금은 이 화면 전용 가정값(App 화면상태)이다 — 사람상태에 넣지 않는다.
   타이밍·초기값·구간 기준은 data.REVEAL, 접기·대표 평형·정렬은 reveal.js, 모션 클래스는 ui.jsx의 .rv-*. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { C, REVEAL } from "./data.js";
import { won, eok } from "./engine.js";
import { Slider, useTween, eyebrow, fine } from "./ui.jsx";
import { groupComplexes, splitByBudget, statusOf, shortOf } from "./reveal.js";

const M = REVEAL.motion;
const prefersReduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
/* 첫 리빌은 세션에 한 번뿐이다. 자격·방법 화면에 다녀오면 이 컴포넌트가 다시 마운트되는데,
   그때 다시 회색에서 시작하면 "한 번뿐인 연출"이 매번 반복된다. 모듈 변수로 재생 여부를 기억한다. */
let playedOnce = false;
const area = (m2) => Number(Number(m2).toFixed(2));

export default function Home({ header, dong, income, setIncome, incomeMax, cash, setCash, results, budgetPrice, onPickUnit }) {
  const [reduced] = useState(prefersReduced);
  /* grey = 진입 직후 전부 회색 · first = 첫 리빌 재생 중 · live = 이후 실시간. 한 번 live가 되면 돌아가지 않는다. */
  const [phase, setPhase] = useState(reduced || playedOnce ? "live" : "grey");
  const [openKey, setOpenKey] = useState(null);
  const [showFolded, setShowFolded] = useState(false);
  const [flashing, setFlashing] = useState(() => new Set());

  const groups = useMemo(() => groupComplexes(results, cash), [results, cash]);
  const { shown, folded, inCount, lineIndex } = useMemo(() => splitByBudget(groups), [groups]);
  const revealed = phase !== "grey";

  /* ── 첫 리빌 트리거: 연소득 슬라이더를 처음 놓는 순간, 또는 idleAuto 동안 아무것도 안 만지면 ── */
  const idle = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const start = () => { if (phaseRef.current === "grey") { playedOnce = true; setPhase("first"); } };
  const arm = () => { clearTimeout(idle.current); if (phaseRef.current === "grey") idle.current = window.setTimeout(start, M.idleAuto); };
  useEffect(() => { arm(); return () => clearTimeout(idle.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* 첫 리빌이 다 켜지면 live로. 그 순간 예산선이 내려오고 반짝임이 켜진다. */
  useEffect(() => {
    if (phase !== "first") return;
    const total = shown.length * M.stagger + M.rowIn;
    const t = window.setTimeout(() => setPhase("live"), total);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 카운터: 첫 리빌 동안은 점등 길이에 맞춰 길게, 이후는 짧게 굴러간다 ── */
  const counterMs = phase === "first" ? shown.length * M.stagger + M.rowIn : M.counter;
  const shownCount = useTween(revealed ? inCount : 0, counterMs);

  /* ── 새로 초록이 된 행만 반짝 (live에서만) ── */
  const prevStatus = useRef(new Map());
  useEffect(() => {
    const prev = prevStatus.current;
    const next = new Map(groups.map((g) => [g.key, g.status]));
    if (phase === "live" && !reduced) {
      const fresh = groups.filter((g) => g.status === "in" && prev.has(g.key) && prev.get(g.key) !== "in").map((g) => g.key);
      if (fresh.length) {
        setFlashing((s) => new Set([...s, ...fresh]));
        const t = window.setTimeout(() => setFlashing((s) => { const n = new Set(s); fresh.forEach((k) => n.delete(k)); return n; }), M.flash);
        prevStatus.current = next;
        return () => clearTimeout(t);
      }
    }
    prevStatus.current = next;
  }, [groups, phase, reduced]);

  /* ── 예산선 이동(FLIP): 자리가 바뀌면 이전 위치에서 새 위치로 line ms 동안 미끄러진다 ── */
  const lineRef = useRef(null);
  const lineTop = useRef(null);
  useLayoutEffect(() => {
    const el = lineRef.current;
    if (!el) { lineTop.current = null; return; }
    const top = el.getBoundingClientRect().top + window.scrollY;
    const prev = lineTop.current;
    lineTop.current = top;
    if (prev == null || reduced || phase !== "live") return;
    const d = prev - top;
    if (Math.abs(d) < 1) return;
    el.style.transition = "none";
    el.style.transform = `translateY(${d}px)`;
    const raf = requestAnimationFrame(() => {
      el.style.transition = `transform ${M.line}ms cubic-bezier(.2,.7,.2,1)`;
      el.style.transform = "translateY(0)";
    });
    return () => cancelAnimationFrame(raf);
  });

  /* 동이 바뀌면 펼친 것들을 접는다. 연출은 다시 재생하지 않는다. */
  useEffect(() => { setOpenKey(null); setShowFolded(false); }, [dong]);

  const vars = {
    "--rv-stagger": `${M.stagger}ms`, "--rv-in": `${M.rowIn}ms`, "--rv-color": `${M.color}ms`,
    "--rv-line": `${M.line}ms`, "--rv-flash": `${M.flash}ms`,
  };
  const showLine = phase === "live" && shown.length > 0 && budgetPrice > 0;
  const row = (g, i) => (
    <ComplexRow key={g.key} g={g} index={i}
      status={revealed ? g.status : "out"}
      grey={!revealed}
      first={phase === "first"}
      flash={flashing.has(g.key)}
      cash={cash}
      open={openKey === g.key}
      onToggle={() => setOpenKey(openKey === g.key ? null : g.key)}
      onPickUnit={onPickUnit} />
  );

  return (
    <div style={vars}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={eyebrow}>내집마련</div>
        {header}
      </div>

      {/* 1) 카운터 */}
      <div className="rv-hero" aria-live="polite">
        <span className="rv-counter">{Math.round(shownCount)}</span>
        <span className="rv-hero-txt">곳, 지금 살 수 있어요</span>
      </div>
      <div className="rv-hero-sub">{dong} 아파트 단지 {groups.length}곳 중</div>

      {/* 2) 입력 — 둘뿐. 부채는 묻지 않는다 */}
      <div style={{ marginTop: 18 }}>
        <Slider label="나의 연소득" value={income} min={0} max={incomeMax} step={100}
          onChange={(v) => { setIncome(v); arm(); }} onCommit={start} display={won(income) + "원"} />
        <Slider label="보유 현금" value={cash} min={0} max={REVEAL.cashMax} step={REVEAL.cashStep}
          onChange={(v) => { setCash(v); arm(); }} display={won(cash) + "원"} />
        <div style={{ fontSize: 11, color: C.faint, lineHeight: 1.6, marginTop: -4 }}>
          대출은 부채 반영 전 최대예요. 기존 대출이 있으면 줄어들어요. 금액은 모두 ‘약’이에요.
        </div>
      </div>

      {/* 3) 단지 목록 — 리빌의 무대 */}
      <div className="rv-list">
        {groups.length === 0 && <p className="rv-empty">이 동엔 아직 시세 자료가 없어요. 다른 동을 골라 보세요.</p>}
        {shown.slice(0, lineIndex).map(row)}
        {showLine && (
          <div ref={lineRef} className="rv-line" data-show="true" role="separator" aria-label={`내 예산 약 ${eok(budgetPrice)}`}>
            <span className="rv-line-bar" />
            <span className="rv-line-label">내 예산 약 {eok(budgetPrice)}</span>
            <span className="rv-line-bar" />
          </div>
        )}
        {shown.slice(lineIndex).map((g, i) => row(g, lineIndex + i))}
        {folded.length > 0 && (
          <>
            <button type="button" className="rv-fold" aria-expanded={showFolded} onClick={() => setShowFolded((v) => !v)}>
              <span>예산을 넘는 단지 {folded.length}곳</span>
              <span aria-hidden="true">{showFolded ? "접기" : "›"}</span>
            </button>
            {showFolded && <div style={{ marginTop: 8 }}>{folded.map((g, i) => row(g, shown.length + i))}</div>}
          </>
        )}
      </div>
      <p style={fine}>대략적인 전략을 짜면, 전문가가 확인해드려요.</p>
    </div>
  );
}

/* 단지 한 행. 대표 평형의 시세·대출·필요 현금을 적고, 탭하면 평형별 상세가 펼쳐진다. 평형을 고르면 소득 확인으로. */
function ComplexRow({ g, index, status, grey, first, flash, cash, open, onToggle, onPickUnit }) {
  const r = g.rep;
  const cls = ["rv-row", first ? "rv-first" : "", flash ? "rv-flash" : ""].filter(Boolean).join(" ");
  return (
    <div className={cls} data-status={status} style={{ "--i": index }}>
      <button type="button" className="rv-main" aria-expanded={open} onClick={onToggle}>
        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <div className="rv-name" data-fit="line">{g.name}</div>
          <div className="rv-sub" data-fit="line">
            {g.dong} · <b>{area(r.areaM2)}㎡</b>{status === "in" ? " 가능" : ""}{g.count > 1 ? ` · 평형 ${g.count}개` : ""}
          </div>
          <div className="rv-nums" data-fit="line">대출 약 {won(r.loan)} · 필요 현금 약 {won(r.cashNeeded)}</div>
        </div>
        <div className="rv-right">
          <div className="rv-price">약 {eok(r.price)}</div>
          {/* 진입 직후(회색)엔 구간 라벨을 쓰지 않는다 — 아직 아무것도 말하지 않은 상태다 */}
          {!grey && status === "in" && <div className="rv-tag">현금 안</div>}
          {!grey && status !== "in" && <div className="rv-tag">약 {won(g.short)} 부족</div>}
        </div>
      </button>
      <div className="acc" data-open={open}>
        <div className="acc-inner">
          <div className="rv-units">
            {g.units.map((u) => <UnitRow key={u.id} u={u} cash={cash} onPick={() => onPickUnit(u)} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* 평형 한 줄. 구간은 평형마다 따로 본다 — 같은 단지라도 넓은 평형은 모자랄 수 있다. */
function UnitRow({ u, cash, onPick }) {
  const st = statusOf(u, cash);
  const short = shortOf(u, cash);
  return (
    <button type="button" className="rv-unit" onClick={onPick}>
      <div style={{ minWidth: 0 }}>
        <div className="rv-unit-l" data-fit="line">전용 {area(u.areaM2)}㎡ · 약 {eok(u.price)}</div>
        <div className="rv-unit-s" data-fit="line">필요 현금 약 {won(u.cashNeeded)}원{st === "in" ? " · 현금 안" : ""}</div>
        {st !== "in" && <div className="rv-unit-tag" data-fit="line">약 {won(short)} 부족</div>}
      </div>
      <div className="rv-unit-r">대출 약 {won(u.loan)} ›</div>
    </button>
  );
}
