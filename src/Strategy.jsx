/* 이 집 사는 방법을 같이 보는 화면.
   대출을 '조회'해주는 게 아니라, 이 집에 필요한 현금을 줄이는 방법을 보여준다.
   숫자는 고정 결과가 아니다. 기존 대출을 줄이거나 소득이 더 인정되면 달라진다.

   위→아래:
     ① 부채 입력      가정의 시작 위치.
     ② 필요 현금 + 게이지  "계산해 보면". 집값이 막대 전체. 남은 칸이 필요 현금.
     ③ 이렇게 바꿔 보면요  기존 대출을 줄이면 / 소득이 더 인정되면.
                           결과가 안 움직이면 슬라이더를 그리지 않고 열린 길을 말한다.

   화면에 조종간·엔진·레버를 쓰지 않는다.
   계산은 직접 하지 않는다. products/limit.js의 limitAt/ceilingAt에 가정값을 넘기고 결과만 그린다.
   ⚠️ 자격은 여기서 절대 다시 묻지 않는다. 자격은 Eligibility 화면에서만 받는다
      (정부 → eligibility/gov.jsx, 은행 → eligibility/bank.jsx). */
import { useMemo, useState } from "react";
import { DATA, PRODUCTS, LEVER, C } from "./data.js";
import { deriveFacts, judgeAll, withAssumedIncome, won, eok, cashNeededOf } from "./engine.js";
import { limitAt, ceilingAt } from "./products/limit.js";
import { leverOf, detailReady } from "./person.js";
import { judgeUnits } from "./verdict.js";
import { BackButton, Section, Stat, useTween, eyebrow, h1, card, fine, rangeFill } from "./ui.jsx";
import DetailInfo from "./DetailInfo.jsx";

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/* ⚠️ 레버(pull)는 이 화면의 로컬 state가 아니다 — person.pull에 있고 props로 내려온다.
   이 화면을 나갔다 와도 당긴 위치가 유지되고, 더 중요하게는 지도가 같은 값을 읽어서
   레버를 움직이는 순간 모든 매물이 다시 칠해진다. 여기 useState로 되돌리지 말 것. */
export default function Strategy({ ctx, person, pickedKey, onPickOther, detail, setDetail, pull, setPull, onSwapUnit, onBack }) {
  const { passed } = judgeAll(deriveFacts(ctx));
  const picked = passed.find((p) => p.key === pickedKey) ?? passed[0] ?? null;

  /* 자격이 통과한 게 하나도 없으면 여기 올 일이 없다. 방어만. */
  if (!picked) {
    return (
      <div className="slideup">
        <BackButton onClick={onBack}>자격 조건으로</BackButton>
        <div style={{ ...card, color: C.inkSoft, fontSize: 14, lineHeight: 1.6 }}>조건이 바뀌어서 지금 열리는 대출이 없어요. 앞 화면에서 자격 답변을 다시 확인해주세요.</div>
        <OtherUnits person={person} currentId={ctx.unit.id} onSwapUnit={onSwapUnit} />
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

  return (
    <div className="slideup">
      <BackButton onClick={onBack}>가능한 대출 목록으로</BackButton>
      <div style={eyebrow}>{picked.title}</div>
      <h1 style={h1}>어떻게 내 집으로 만들 수 있을까?</h1>

      <DetailInfo value={detail} onChange={onDetail} />

      {/* 부채 확정 전에는 레버를 그리지 않는다 — 슬라이더를 만지작거리는 중간값으로 한도가 그려지면 안 된다. */}
      {ready && (
        <Cockpit
          ctx={ctx} picked={picked} onPickOther={onPickOther}
          lever={lever} base={base} price={price}
          incomeMax={incomeMax} incomeRoom={incomeRoom} incomeCap={incomeCap}
          pulled={pull !== null} pullLever={pullLever} onReset={() => setPull(null)} />
      )}

      {/* 다른 매물을 볼 때만 위 내용을 접는다. 기본은 닫힘 — 조종간이 주인공이고 이건 곁가지다. */}
      <OtherUnits person={person} currentId={ctx.unit.id} onSwapUnit={onSwapUnit} />

      <p style={fine}>상담역이 확정해요. 대출을 약속하지 않아요.</p>
    </div>
  );
}

/* ── 레버가 결과를 못 움직일 때 그 자리에 오는 것 ──
   레버를 숨기는 대신 반드시 세 가지를 준다: 무엇이 벽인지 / 왜 부채·소득으로 안 되는지 /
   그럼 어디가 열려 있는지. 셋째가 빠지면 이건 그냥 거절 화면이 된다(가드레일 4). */
function InertLevers({ binding, cash, better, betterCash, productName, incomeCapped, offsetsRoomDeduction, onPickOther }) {
  /* 벽마다 '왜 안 움직이는지'가 다르다. 뭉뚱그리면 창구에서 물어볼 것도 못 정한다. */
  const why = {
    ltv: <>담보에서 걸려요. 대출을 줄여도 소득이 인정돼도 현금이 안 줄어요.</>,
    cap: <>{productName} 최대한도예요.</>,
    region: <>지역 한도예요. 대출을 줄여도 소득이 인정돼도 현금이 안 줄어요.</>,
    dti: incomeCapped
      ? <>소득 상한이에요. 더 올리면 자격이 닫혀요.</>
      : <>소득 벽이에요.</>,
  }[binding.key] ?? <>대출을 줄여도 소득이 인정돼도 안 움직여요.</>;

  return (
    <Section title={cash <= 0 ? "③ 이미 채워져요" : "③ 안 움직여요"} tone="off">
      <div style={{ fontSize: 13, lineHeight: 1.7, color: C.inkSoft }}>
         <b style={{ color: C.ink }}>{binding.label} 약 {won(binding.value)}원</b>. {why}
      </div>

      {cash > 0 && (better || (binding.key === "ltv" && !offsetsRoomDeduction)) && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
          {better && (
            <Path>
              <b>{better.title}</b>면 현금 약 {won(betterCash)}원.{" "}
              <button onClick={() => onPickOther(better.key)} style={{ border: "none", background: "none", padding: 0, color: C.greenDeep, fontSize: 13, fontWeight: 800, cursor: "pointer", textDecoration: "underline" }}>
                이걸로 볼게요 →
              </button>
            </Path>
          )}
          {binding.key === "ltv" && !offsetsRoomDeduction && (
            <Path>방공제가 상쇄되는 대출이 있는지는 상담역에게.</Path>
          )}
        </div>
      )}
    </Section>
  );
}

const Path = ({ children }) => (
  <div style={{ display: "flex", gap: 8, fontSize: 13, lineHeight: 1.65, color: C.inkSoft, marginBottom: 6 }}>
    <span style={{ color: C.greenDeep, fontWeight: 800, flex: "0 0 auto" }}>·</span><span>{children}</span>
  </div>
);

/* ══════════════════════════════════════════════════════════════════════════
   방법 화면 본체 — 가정값(pull)은 위에서 받고, 여기서는 가정 → 한도 → 결과만 그린다.
   ══════════════════════════════════════════════════════════════════════════ */
function Cockpit({ ctx, picked, onPickOther, lever, base, price, incomeMax, incomeRoom, incomeCap, pulled, pullLever, onReset }) {
  const P = PRODUCTS[picked.product];

  /* ── 레버 → 모듈 → 결과 ── */
  const reach = limitAt(picked.product, lever, picked.limit);
  const ceil = ceilingAt(picked.product, lever, picked.limit);
  const cash = cashNeededOf(price, reach.limit);

  /* 숫자도 툭 바뀌지 않게 보간한다(reduced-motion이면 즉시). */
  const shownLoan = useTween(reach.limit);
  const shownCash = useTween(cash);

  /* 소득 레버는 자격까지 움직인다(소득상한). 레버가 안 통할 때 다른 열린 길을 찾기 위해 다시 판정한다. */
  const sim = judgeAll(deriveFacts(withAssumedIncome(ctx, lever.income)));
  const better = sim.passed
    .map((p) => ({ ...p, at: limitAt(p.product, lever, p.limit).limit }))
    .sort((a, b) => b.at - a.at)
    .find((p) => p.key !== picked.key && p.at > reach.limit);
  const betterCash = better ? cashNeededOf(price, better.at) : null;

  /* 미혼에게 "배우자 소득 합산"을 안내하면 안 된다 — 소득 레버의 설명과 창구 질문이 갈린다. */
  const hasSpouse = ctx.marital !== "single";

  const debtSpent = base.debt - lever.debt;
  const incomeUp = lever.income - base.income;

  /* 이 레버들이 '통틀어' 열 수 있는 폭 = 시작 위치(base)에서 천장까지.
     0이면 손잡이만 있고 결과가 안 움직인다 — 벽이 담보(LTV)나 대출 한도라서
     부채·소득으로는 안 내려가기 때문. 그럴 땐 레버를 아예 안 그린다(아래 InertLevers).
     움직이는 척하는 손잡이는 이 화면을 거짓 희망 기계로 만든다.

     ⚠️ 현재 위치(reach)로 재면 안 된다. 가정을 끝까지 바꾼 순간 reach == ceil이 되어
        방금 9천만원을 열어놓고도 "이 길은 안 움직여요"라고 말하고, 슬라이더가 손 밑에서 사라진다.
        '열 수 있는 폭'은 사용자가 어디까지 바꿨느냐와 무관한 구조적 성질이다. */
  const baseReach = limitAt(picked.product, base, picked.limit);
  const leverRoom = Math.max(ceil.limit - baseReach.limit, 0);
  const leversInert = leverRoom < 100;

  return (
    <>
      {/* ── ② 필요 현금 ── */}
      <Section title="② 계산해 보면" tone={cash <= 0 ? "ok" : undefined}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, marginBottom: 2 }}>최대 대출</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.greenDeep, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
              약 {eok(shownLoan)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, marginBottom: 2 }}>필요 현금</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.ink, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
              {cash <= 0 ? "없음" : `약 ${eok(shownCash)}`}
            </div>
          </div>
        </div>

        <Gauge price={price} reach={reach.limit} ceiling={ceil.limit} />

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
          {reach.parts.map((p) => {
            const on = p.key === reach.binding.key;
            return (
              <div key={p.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", color: on ? C.ink : C.inkSoft, fontWeight: on ? 800 : 500 }}>
                <span>{p.label}{on && <span style={{ color: C.amber, marginLeft: 6, fontSize: 11 }}>← 여기</span>}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{won(p.value)}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
          <Stat label="금리" value={P.rateLabel} />
          <Stat label="준비기간" value={P.leadTime} warn />
        </div>
      </Section>

      {/* ── ② 레버 ──
          결과를 못 움직이는 레버는 그리지 않는다. 당겨도 숫자가 안 변하는 손잡이는
          "내가 뭘 잘못 당겼나" 하는 자책만 남기고, 이 화면의 신뢰를 통째로 깎는다.
          대신 무엇이 벽인지 말하고, 열려 있는 길로 넘긴다(가드레일 4). */}
      {leversInert ? (
        <InertLevers binding={ceil.binding} cash={cash} better={better} betterCash={betterCash}
          productName={P.name} incomeCapped={incomeCap != null} offsetsRoomDeduction={P.offsetsRoomDeduction} onPickOther={onPickOther} />
      ) : (
      <Section title="③ 바꿔 보면" tone={pulled ? undefined : "ok"}>

        <div style={{ marginBottom: 18 }}>
          <LeverHead title="기존 대출을 줄이면요?" />

          {base.debt > 0 ? (
            <LeverRow
              label="대출 잔액" value={lever.debt} max={base.debt} step={100}
              display={won(lever.debt) + "원"}
              sub={debtSpent > 0 ? `${won(base.debt)} → ${won(debtSpent)} 갚으면` : null}
              onChange={(v) => pullLever("debt", v)} />
          ) : (
            <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6, marginBottom: 10 }}>갚을 기존 대출이 없어요.</div>
          )}
        </div>

        <div style={{ paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
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

        {pulled && (
          <button onClick={onReset} style={{ marginTop: 14, padding: "9px 14px", borderRadius: 10, border: `1.5px solid ${C.line}`, background: "#fff", color: C.inkSoft, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            ↺ 원래대로
          </button>
        )}
      </Section>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   "다른 매물도 알아볼까요?" — 방법 화면의 곁가지.
   기본은 닫힘. 펼치면 지금 가정 그대로 DATA 전체를 다시 판정해서 보여준다.
   ⚠️ 여기서 매물을 고르면 '목표 매물'만 바뀐다 — 자격 답변도, 부채도, 가정도 그대로다.
      그래서 재질문이 없고, 고르는 즉시 위 내용이 새 매물 기준으로 다시 그려진다.
   ══════════════════════════════════════════════════════════════════════════ */
function OtherUnits({ person, currentId, onSwapUnit }) {
  const [open, setOpen] = useState(false);
  /* 소득 화면과 같은 함수·같은 사람상태를 쓴다(verdict.judgeUnit) — 두 화면의 숫자가 갈리지 않게. */
  const painted = useMemo(() => judgeUnits(DATA, person), [person]);
  const list = [...painted].sort((a, b) => a.cashNeeded - b.cashNeeded || a.price - b.price);

  return (
    <div style={{ ...card, padding: 0, marginTop: 12, overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "13px 16px", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>인근 다른 매물도 알아볼까요?</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: C.greenDeep }}>
          현금 적은 순 {list.length}곳
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
                    border: `1.5px solid ${on ? C.greenDeep : C.line}`, background: on ? "#F3F9F5" : "#fff" }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: C.ink }}>
                      {r.name}{on && <span style={{ fontSize: 11, color: C.greenDeep, marginLeft: 6 }}>지금 보는 중</span>}
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: C.inkSoft, marginTop: 1 }}>{r.dong} · 전용 {r.areaM2}㎡ · {won(r.price)}원</span>
                  </span>
                  {!on && (
                    <span style={{ fontSize: 12, fontWeight: 800, flex: "0 0 auto", color: C.greenDeep }}>
                      필요 현금 {won(r.cashNeeded)} ›
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
   축(0~100%) = 시세. "10억짜리 집 중 3억 대출 + 7억 현금" 처럼, 대출과 현금을
   같은 막대 위에서 바로 비교하게 한다 — 집값이 Maximum. */
function Gauge({ price, reach, ceiling }) {
  const scale = Math.max(price, ceiling, 1);
  const pos = (v) => clamp(v / scale, 0, 1) * 100;
  const cash = cashNeededOf(price, reach);
  const cashStart = pos(reach);
  const cashWidth = Math.max(pos(price) - pos(reach), 0);
  return (
    <div>
      <div style={{ position: "relative", height: 16, fontSize: 11 }}>
        <span className="gauge-mark" style={{ position: "absolute", left: 0, whiteSpace: "nowrap", fontWeight: 800, color: C.ink }}>
          대출 {won(reach)}
        </span>
        {cash > 0 && cashWidth > 12 && (
          <span className="gauge-mark" style={{ position: "absolute", left: `${cashStart + cashWidth / 2}%`, transform: "translateX(-50%)", whiteSpace: "nowrap", fontWeight: 800, color: C.ink }}>
            현금 {won(cash)}
          </span>
        )}
      </div>
      <div style={{ position: "relative", height: 44, borderRadius: 12, background: "#EDF1ED", border: `1px solid ${C.line}`, overflow: "hidden" }}>
        {/* 지금 대출액 */}
        <div className="gauge-fill" style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${pos(reach)}%`, background: C.green }} />
        {/* 필요 현금 — 레버를 당기면 이게 줄어든다 */}
        {cashWidth > 0 && <div className="stripe-gap gauge-gap" style={{ position: "absolute", top: 0, bottom: 0, left: `${cashStart}%`, width: `${cashWidth}%` }} />}
        {/* 천장선(레버를 다 당겼을 때의 최대 대출) = 현금이 어디까지 줄어들 수 있는지 */}
        {ceiling < price && (
          <div className="gauge-mark" style={{ position: "absolute", top: 0, bottom: 0, left: `${pos(ceiling)}%`, width: 2, background: C.inkSoft, opacity: .6, zIndex: 2 }} />
        )}
      </div>
      <div style={{ position: "relative", height: 16, marginTop: 4, fontSize: 11, color: C.inkSoft }}>
        {ceiling < price && pos(ceiling) > 8 && pos(ceiling) < 88 && (
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

/* ── 레버 조각 ── */
function LeverHead({ title }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.greenDeep }}>{title}</div>
    </div>
  );
}

function LeverRow({ label, value, min = 0, max, step, display, sub, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{display}</span>
      </div>
      <input type="range" className="lever" aria-label={label}
        min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        style={rangeFill(value, min, max)} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 11, color: "#9AA3A0", fontVariantNumeric: "tabular-nums" }}>
        <span>{won(min)}</span>
        <span>{won(max)}</span>
      </div>
      {sub && <div style={{ marginTop: 3, fontSize: 11, color: "#9AA3A0" }}>{sub}</div>}
    </div>
  );
}
