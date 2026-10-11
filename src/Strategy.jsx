/* 이 집 사는 방법을 같이 보는 화면.
   대출을 '조회'해주는 게 아니라, 이 집에 필요한 현금을 줄이는 방법을 보여준다.
   숫자는 고정 결과가 아니다. 기존 대출을 줄이거나 소득이 더 인정되면 달라진다.

   위→아래:
     ① 부채 입력      가정의 시작 위치.
     ② 필요 현금 + 게이지  "계산해 보면". 집값이 막대 전체. 남은 칸이 필요 현금.
     ③ 이렇게 바꿔 보면요  기존 대출을 줄이면 / 소득이 더 인정되면 / 방 공제 보전.
                           부채·소득은 결과가 안 움직이면 그 칸을 그리지 않는다.
                           방공제(세 번째)는 한도가 안 움직여도 항상 펼쳐 둔다.
                           기본은 아니오. 네로 바꾸면 보전으로 계산하고, 누가 받을 수 있는지는 팝업.

   화면에 조종간·엔진·레버를 쓰지 않는다.
   계산은 직접 하지 않는다. products/limit.js의 limitAt/ceilingAt에 가정값을 넘기고 결과만 그린다.
   ⚠️ 자격은 여기서 절대 다시 묻지 않는다. 자격은 Eligibility 화면에서만 받는다
      (정부 → eligibility/gov.jsx, 은행 → eligibility/bank.jsx). */
import { useId, useMemo, useRef, useState } from "react";
import { PRODUCTS, LEVER, DEBT_KINDS, RULE, C } from "./data.js";
import { deriveFacts, judgeAll, won, eok, cashNeededOf, monthlyInstallment } from "./engine.js";
import { limitAt, ceilingAt } from "./products/limit.js";
import { leverOf, detailReady } from "./person.js";
import { judgeUnits } from "./verdict.js";
import { BackButton, Section, Stat, useTween, eyebrow, h1, card, fine, rangeFill, useOverlayLock } from "./ui.jsx";
import DetailInfo from "./DetailInfo.jsx";

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/* ⚠️ 레버(pull)는 이 화면의 로컬 state가 아니다 — person.pull에 있고 props로 내려온다.
   이 화면에 있는 동안 지도가 같은 값을 읽어서, 레버를 움직이는 순간 모든 매물이 다시 칠해진다.
   여기 useState로 되돌리지 말 것.
   뒤로 가기(가능한 대출 목록 → 매물 목록)는 선택을 다시 하는 것이라, App이 pull과 부채 확정을 비운다. */
export default function Strategy({ ctx, person, pickedKey, detail, setDetail, pull, setPull, onSwapUnit, units, onBack }) {
  const { passed } = judgeAll(deriveFacts(ctx));
  const picked = passed.find((p) => p.key === pickedKey) ?? passed[0] ?? null;

  /* 자격이 통과한 게 하나도 없으면 여기 올 일이 없다. 방어만. */
  if (!picked) {
    return (
      <div className="slideup">
        <BackButton onClick={onBack}>자격 조건으로</BackButton>
        <div style={{ ...card, color: C.inkSoft, fontSize: 14, lineHeight: 1.6 }}>조건이 바뀌어서 지금 열리는 대출이 없어요. 앞 화면에서 자격 답변을 다시 확인해주세요.</div>
        <OtherUnits person={person} units={units} currentId={ctx.unit.id} onSwapUnit={onSwapUnit} />
      </div>
    );
  }

  const price = ctx.unit.price;
  const ready = detailReady(detail);

  /* 소득 레버의 상한은 이 상품의 소득상한에서 잘린다.
     소득을 더 올리면 한도가 아니라 '자격'이 닫히기 때문 — 거짓 희망을 만들지 않으려면 여기서 막아야 한다.
     null = 소득상한이 없는 상품(은행) → leverOf가 3억(LEVER.incomeMax)까지 연다. */
  const incomeCap = picked.income.value;

  /* DetailInfo가 답한 값 = 레버의 시작 위치. 다시 답하면 당긴 건 초기화한다(기준이 바뀌었으니까).
     둘 다 person.js의 leverOf가 만든다 — 지도(verdict.judgeUnit)가 쓰는 것과 같은 함수다.
     여기서 레버 모양을 따로 조립하면 지도와 조종간이 서로 다른 값을 보게 된다. */
  const base = ready ? leverOf(person, ctx.unit.price, incomeCap, false) : null;   // 당기기 전
  const lever = ready ? leverOf(person, ctx.unit.price, incomeCap, true) : null;   // 당긴 후

  /* 소득 레버가 위로 열린 폭. 상한은 leverOf가 정한 값을 그대로 쓴다 — 여기서 다시 계산하면
     지도와 조종간의 레버 상한이 갈린다(같은 레버가 화면마다 다르게 잘리는 버그). */
  const incomeMax = base?.incomeMax ?? ctx.totalIncome;
  const incomeRoom = Math.max(incomeMax - ctx.totalIncome, 0);

  const onDetail = (next) => { setDetail(next); setPull(null); };
  const pullLever = (k, v) => setPull((p) => ({ ...(p ?? {}), [k]: v }));
  const pullDebt = (key, v) => setPull((p) => ({ ...(p ?? {}), debts: { ...(p?.debts ?? {}), [key]: v } }));

  return (
    <div className="slideup">
      <BackButton onClick={onBack}>가능한 대출 목록으로</BackButton>
      <div style={eyebrow}>{picked.title}</div>
      <h1 style={h1}>어떻게 내 집으로 만들 수 있을까?</h1>

      <DetailInfo value={detail} onChange={onDetail} />

      {/* 부채 확정 전에는 레버를 그리지 않는다 — 슬라이더를 만지작거리는 중간값으로 한도가 그려지면 안 된다. */}
      {ready && (
        <Cockpit
          ctx={ctx} picked={picked}
          lever={lever} base={base} price={price}
          incomeMax={incomeMax} incomeRoom={incomeRoom} incomeCap={incomeCap}
          pulled={pull !== null} pullLever={pullLever} pullDebt={pullDebt} onReset={() => setPull(null)} />
      )}

      {/* 다른 매물을 볼 때만 위 내용을 접는다. 기본은 닫힘 — 조종간이 주인공이고 이건 곁가지다. */}
      <OtherUnits person={person} units={units} currentId={ctx.unit.id} onSwapUnit={onSwapUnit} />

      <p style={fine}>대략적인 전략을 짜면, 전문가가 확인해드려요.</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   방법 화면 본체 — 가정값(pull)은 위에서 받고, 여기서는 가정 → 한도 → 결과만 그린다.
   ══════════════════════════════════════════════════════════════════════════ */
function Cockpit({ ctx, picked, lever, base, price, incomeMax, incomeRoom, incomeCap, pulled, pullLever, pullDebt, onReset }) {
  const [partsOpen, setPartsOpen] = useState(true);
  const [roomHelp, setRoomHelp] = useState(false);
  const P = PRODUCTS[picked.product];

  /* ── 레버 → 모듈 → 결과 ──
     방 공제 보전은 기본 아니오. 아직 안 고른 값(null)도 아니오와 같이 한도에서 뺀다.
     은행·보금자리가 상쇄를 기본으로 두어도, 이 화면에서는 네를 고르기 전에는 빼지 않는다. */
  const roomOffset = lever.offsetRoom === true;
  const reach = limitAt(picked.product, { ...lever, offsetRoom: roomOffset }, picked.limit);
  /* 부채·소득 천장은 시작 위치 기준. 방공제를 켜서 한도를 낮춰도 눈금이 따라 내려가면 안 된다.
     눈금은 방공제를 뺐을 때(상쇄)까지 포함한 더 높은 쪽. */
  const baseCeil = ceilingAt(picked.product, base, picked.limit);
  const roomOffCeil = ceilingAt(picked.product, { ...base, offsetRoom: true }, picked.limit);
  const gaugeCeiling = Math.max(baseCeil.limit, roomOffCeil.limit);
  const cash = cashNeededOf(price, reach.limit);

  /* 숫자도 툭 바뀌지 않게 보간한다(reduced-motion이면 즉시). */
  const shownLoan = useTween(reach.limit);
  const shownCash = useTween(cash);

  /* 미혼에게 "배우자 소득 합산"을 안내하면 안 된다 — 소득 레버의 설명과 창구 질문이 갈린다. */
  const hasSpouse = ctx.marital !== "single";

  const incomeUp = lever.income - base.income;
  const debtKinds = DEBT_KINDS.filter((k) => base.debts[k.key] > 0);

  /* 이 레버들이 '통틀어' 열 수 있는 폭 = 시작 위치(base)에서 천장까지.
     0이면 손잡이만 있고 결과가 안 움직인다 — 벽이 담보(LTV)나 대출 한도라서
     부채·소득으로는 안 내려가기 때문. 그때는 그 두 칸을 그리지 않는다.
     ⚠️ 현재 위치(reach)로 재면 안 된다. 가정을 끝까지 바꾼 순간 reach == ceil이 되어
        방금 9천만원을 열어놓고도 "이 길은 안 움직여요"라고 말하고, 슬라이더가 손 밑에서 사라진다.
        '열 수 있는 폭'은 사용자가 어디까지 바꿨느냐와 무관한 구조적 성질이다.
     방공제(세 번째)는 이 폭과 상관없이 항상 펼쳐 둔다. */
  const baseReach = limitAt(picked.product, base, picked.limit);
  const leverRoom = Math.max(baseCeil.limit - baseReach.limit, 0);
  const leversInert = leverRoom < 100;

  return (
    <>
      {/* ── ② 필요 현금 ── */}
      <Section title="② 계산해 보면" tone={cash <= 0 ? "ok" : undefined}>
        {/* 대출·현금은 여기 한 줄만. 막대 위에 같은 숫자를 다시 적지 않는다. */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>
            최대 대출{" "}
            <span style={{ fontSize: 16, fontWeight: 800, color: C.greenDeep, fontVariantNumeric: "tabular-nums" }}>약 {eok(shownLoan)}</span>
          </div>
          <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, textAlign: "right" }}>
            필요 자본금{" "}
            <span style={{ fontSize: 16, fontWeight: 800, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{cash <= 0 ? "없음" : `약 ${eok(shownCash)}`}</span>
          </div>
        </div>

        <Gauge price={price} reach={reach.limit} ceiling={gaugeCeiling} />

        <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}` }}>
          <button type="button" onClick={() => setPartsOpen((o) => !o)} aria-expanded={partsOpen}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "12px 0 0", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>
              상세이유
            </span>
          
            {/* <span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>
              {reach.binding.label}
              <span style={{ color: C.amber, marginLeft: 6, fontSize: 11, fontWeight: 700 }}>← 여기</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: C.inkSoft, fontVariantNumeric: "tabular-nums" }}>
              {won(reach.binding.value)}
              <span style={{ display: "inline-block", color: C.greenDeep, transform: partsOpen ? "rotate(180deg)" : "none", transition: "transform .25s ease" }}>▾</span>
            </span> */}
          </button>
          <div className="acc" data-open={partsOpen}>
            <div className="acc-inner">
              <div style={{ paddingTop: 8 }}>
                {reach.parts.map((p) => {
                  const on = p.key === reach.binding.key;
                  return (
                    <div key={p.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", color: on ? C.ink : C.inkSoft, fontWeight: on ? 800 : 500 }}>
                      <span>{p.label}{on && <span style={{ color: C.amber, marginLeft: 6, fontSize: 11 }}>← 여기</span>}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{won(p.value)}</span>
                    </div>
                  );
                })}
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                  <Stat label="금리" value={P.rateLabel} />
                  <Stat label="예상 원리금" value={`월 ${won(monthlyInstallment(P, shownLoan))}원`} color="#2E9E6B" />
                  <Stat label="준비기간" value={P.leadTime} warn />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── ③ 레버 ──
          부채·소득은 결과가 안 움직이면 그 칸만 뺀다. 방공제는 항상 펼친다. */}
      <Section title="③ 대출 전략" tone={pulled ? undefined : "ok"}>

        {!leversInert && <div style={{ marginBottom: 8 }}>
          <LeverHead title="기존 대출을 줄이면요?" />

          {debtKinds.length > 0 ? debtKinds.map((k) => {
            const spent = base.debts[k.key] - lever.debts[k.key];
            return (
              <LeverRow key={k.key}
                label={k.label} value={lever.debts[k.key]} max={base.debts[k.key]} step={k.step ?? LEVER.debtStep}
                display={won(lever.debts[k.key]) + "원"}
                sub={spent > 0 ? `${won(base.debts[k.key])} 중 ${won(spent)} 줄이면` : null}
                onChange={(v) => pullDebt(k.key, v)} />
            );
          }) : (
            <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6, marginBottom: 10 }}>갚을 기존 대출이 없어요.</div>
          )}
        </div>}

        {!leversInert && (
        <div style={{ paddingTop: 8, borderTop: `1px solid ${C.line}` }}>
          <LeverHead title="소득이 더 인정되면요?" />

          {incomeRoom >= LEVER.incomeStep ? (
            <LeverRow label={hasSpouse ? "인정소득 (부부합산)" : "인정소득"} value={lever.income} min={base.income} max={incomeMax} step={LEVER.incomeStep}
              display={won(lever.income) + "원"}
              sub={incomeUp > 0 ? `${won(base.income)} → ${won(incomeUp)} 더 인정되면` : null}
              onChange={(v) => pullLever("income", v)} />
          ) : (
            <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6, marginBottom: 10 }}>
              {incomeCap != null
                ? <>합산소득 상한 {won(incomeCap)}원. 더 올리면 자격이 닫혀요.</>
                : <>소득이 더 인정될 폭이 없어요.</>}
            </div>
          )}
        </div>
        )}

        <RoomSwitch
          yes={roomOffset}
          divided={!leversInert}
          onPick={(nextYes) => {
            if ((lever.offsetRoom === true) === nextYes) return;
            pullLever("offsetRoom", nextYes);
            if (nextYes) setRoomHelp(true);
          }} />

        {pulled && (
          <button onClick={() => { setRoomHelp(false); onReset(); }} style={{ marginTop: 8, padding: "7px 12px", borderRadius: 10, border: `1.5px solid ${C.line}`, background: "#fff", color: C.inkSoft, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ↺ 원래대로
          </button>
        )}
      </Section>
      {roomHelp && <RoomOffsetDialog onClose={() => setRoomHelp(false)} />}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   "다른 매물도 알아볼까요?" — 방법 화면의 곁가지.
   기본은 닫힘. 펼치면 지금 가정·고른 동 그대로 매물을 다시 판정해서 보여준다.
   ⚠️ 여기서 매물을 고르면 '목표 매물'만 바뀐다 — 자격 답변도, 부채도, 가정도 그대로다.
      그래서 재질문이 없고, 고르는 즉시 위 내용이 새 매물 기준으로 다시 그려진다.
   ══════════════════════════════════════════════════════════════════════════ */
function OtherUnits({ person, units, currentId, onSwapUnit }) {
  const [open, setOpen] = useState(false);
  /* 첫 화면과 같은 함수·같은 사람상태·같은 동을 쓴다. */
  const painted = useMemo(() => judgeUnits(units, person), [units, person]);
  const list = [...painted].sort((a, b) => a.cashNeeded - b.cashNeeded || a.price - b.price);

  return (
    <div style={{ ...card, padding: 0, marginTop: 12, overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "13px 16px", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>인근 다른 매물도 알아볼까요?</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: C.greenDeep }}>
          {list.length}곳
          <span style={{ display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform .25s ease" }}>▾</span>
        </span>
      </button>

      <div className="acc" data-open={open}>
        <div className="acc-inner">
          <div style={{ padding: "0 16px 14px" }}>
            {list.map((r) => {
              const on = r.id === currentId;
              return (
                <button key={r.id} onClick={() => onSwapUnit(r.id)} disabled={on}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, textAlign: "left",
                    padding: "10px 12px", marginBottom: 6, borderRadius: 11, cursor: on ? "default" : "pointer",
                    border: `1.5px solid ${on ? C.greenDeep : C.line}`, background: on ? C.soft : "#fff" }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: C.ink }}>
                      {r.name}{on && <span style={{ fontSize: 11, color: C.greenDeep, marginLeft: 6 }}>지금 보는 중</span>}
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: C.inkSoft, marginTop: 1 }}>{r.dong} · 전용 {r.areaM2}㎡ · {won(r.price)}원</span>
                  </span>
                  {!on && (
                    <span style={{ fontSize: 12, fontWeight: 800, flex: "0 0 auto", color: C.greenDeep }}>
                      자본금 {won(r.cashNeeded)} ›
                    </span>
                  )}
                </button>
              );
            })}

          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 게이지: 숫자가 툭 바뀌는 게 아니라 '필요 현금이 줄어드는' 게 보여야 한다.
   축(0~100%) = 시세. 대출·현금 금액은 위 한 줄이 이미 말한다. 막대는 비율만. */
function Gauge({ price, reach, ceiling }) {
  const scale = Math.max(price, ceiling, 1);
  const pos = (v) => clamp(v / scale, 0, 1) * 100;
  const cashStart = pos(reach);
  const cashWidth = Math.max(pos(price) - pos(reach), 0);
  return (
    <div>
      <div style={{ position: "relative", height: 18, borderRadius: 8, background: C.track, border: `1px solid ${C.line}`, overflow: "hidden" }}>
        {/* 지금 대출액 */}
        <div className="gauge-fill" style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${pos(reach)}%`, background: C.green }} />
        {/* 필요 현금 — 레버를 당기면 이게 줄어든다 */}
        {cashWidth > 0 && <div className="stripe-gap gauge-gap" style={{ position: "absolute", top: 0, bottom: 0, left: `${cashStart}%`, width: `${cashWidth}%` }} />}
        {/* 천장선(레버를 다 당겼을 때의 최대 대출) = 현금이 어디까지 줄어들 수 있는지 */}
        {ceiling < price && (
          <div className="gauge-mark" style={{ position: "absolute", top: 0, bottom: 0, left: `${pos(ceiling)}%`, width: 2, background: C.inkSoft, opacity: .6, zIndex: 2 }} />
        )}
      </div>
      <div style={{ position: "relative", height: 14, marginTop: 2, fontSize: 11, color: C.inkSoft }}>
        {ceiling < price && pos(ceiling) > 8 && pos(ceiling) < 62 && (
          <span className="gauge-mark" style={{ position: "absolute", left: `${pos(ceiling)}%`, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
             {won(ceiling)}
          </span>
        )}
        <span style={{ position: "absolute", right: 0, whiteSpace: "nowrap" }}>
          시세 {won(price)}
        </span>
      </div>
    </div>
  );
}

/* ── 레버 조각 ──
   방공제(전략 3)는 접지 않는다. 질문과 아니오·네는 한 줄.
   기본은 아니오. 네로 켜는 순간에만 누가 보전받을 수 있는지 팝업을 연다. */
function RoomSwitch({ yes, divided, onPick }) {
  const optStyle = (selected) => ({
    border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer",
    background: selected ? C.green : "transparent",
    color: selected ? C.onAccent : C.inkSoft,
    whiteSpace: "nowrap",
  });
  return (
    <div style={{ paddingTop: divided ? 8 : 0, borderTop: divided ? `1px solid ${C.line}` : "none" }}>
      <LeverHead title="방공제" />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "nowrap" }}>
        <span data-fit="line" style={{ flex: "1 1 auto", minWidth: 0, fontSize: 13, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>방 공제를 보전받을까요?</span>
        <div role="group" aria-label="방 공제를 보전받을까요?" style={{ display: "flex", flex: "0 0 auto", padding: 2, borderRadius: 10, background: C.track }}>
          <button type="button" aria-pressed={!yes} onClick={() => onPick(false)} style={optStyle(!yes)}>아니오</button>
          <button type="button" aria-pressed={yes} onClick={() => onPick(true)} style={optStyle(yes)}>네</button>
        </div>
      </div>
      {yes && (
        <div style={{ marginTop: 6, fontSize: 11, color: C.inkSoft, fontVariantNumeric: "tabular-nums" }}>
          {won(RULE.roomDeduction)}을 한도에서 빼지 않아요.
        </div>
      )}
    </div>
  );
}

/* 네로 켠 뒤에만. 누구의 한도를 보전으로 계산해도 되는지를 말한다. 닫아도 네는 유지된다. */
function RoomOffsetDialog({ onClose }) {
  const panelRef = useRef(null);
  const titleId = useId();
  useOverlayLock(onClose, panelRef);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(32,28,22,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 18 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onClick={(e) => e.stopPropagation()} className="modal" style={{ width: "100%", maxWidth: 420, maxHeight: "min(90dvh, 720px)", overflowY: "auto", background: "#fff", color: C.ink, colorScheme: "light", borderRadius: 20, padding: "20px 20px 22px", outline: "none" }}>
        <h2 id={titleId} data-fit="line" style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>방 공제 보전, 누가 받을 수 있나요?</h2>
        <div data-fit="prose" style={{ fontSize: 14, color: C.ink, lineHeight: 1.65, marginTop: 12 }}>
          <p style={{ margin: "0 0 10px" }}>
            집을 담보로 빌릴 때, 세입자가 가장 먼저 돌려받는 소액보증금만큼 한도에서 빼는 게 방 공제예요. 서울은 {won(RULE.roomDeduction)}원이에요. 아래 보증에 가입하면 그 금액을 빼지 않고 보전받아요.
          </p>
          <p style={{ margin: "0 0 6px", fontWeight: 800 }}>받을 수 있는 분</p>
          <ul style={{ margin: "0 0 12px", paddingLeft: 18 }}>
            <li>본인이 살 주택을 담보로 대출받고, 등기에 가압류·가처분처럼 권리를 막는 표시가 없는 분</li>
            <li>은행 주택담보대출은 MCI(모기지신용보험, 서울보증보험). 보증료는 은행이 내요.</li>
            <li>보금자리론처럼 주택금융공사 대출은 MCG(모기지신용보증). 보증료는 본인이 내요.</li>
          </ul>
          <p style={{ margin: "0 0 6px", fontWeight: 800 }}>받기 어려운 분</p>
          <ul style={{ margin: "0 0 12px", paddingLeft: 18 }}>
            <li>미성년자, 재외국민, 외국인</li>
            <li>신용정보 관리대상이거나, 주택금융공사 구상권이 남아 있는 분</li>
            <li>주택이 아니거나, 권리 제한이 있는 집</li>
          </ul>
          <p style={{ margin: 0, color: C.inkSoft }}>
            디딤돌대출은 원칙적으로 방 공제를 빼요. 구입자금보증에 가입되는 경우에만 보전받을 수 있어요. 가입되는지는 창구에서 확정해요.
          </p>
        </div>
        <button type="button" onClick={onClose} style={{ width: "100%", marginTop: 16, padding: "14px", borderRadius: 13, border: "none", background: C.green, color: C.onAccent, fontSize: 15, fontWeight: 800, cursor: "pointer" }}>확인</button>
      </div>
    </div>
  );
}

function LeverHead({ title }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.greenDeep }}>{title}</div>
    </div>
  );
}

/* 손잡이를 안 움직이면 최소·최대. 움직이면 그 두 눈금은 숨기고 sub 한 줄만 남긴다. */
function LeverRow({ label, value, min = 0, max, step, display, sub, onChange }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{display}</span>
      </div>
      <input type="range" className="lever" aria-label={label}
        min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        style={rangeFill(value, min, max)} />
      {sub
        ? <div style={{ marginTop: 6, fontSize: 11, color: C.inkSoft, fontVariantNumeric: "tabular-nums" }}>{sub}</div>
        : <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: C.faint, fontVariantNumeric: "tabular-nums" }}>
            <span>{won(min)}</span>
            <span>{won(max)}</span>
          </div>}
    </div>
  );
}
