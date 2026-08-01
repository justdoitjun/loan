/* 조종간(cockpit) — 이 서비스의 정체성이 가장 진하게 드러나는 화면.
   대출을 '조회'해주는 게 아니라, 원하는 집에 닿도록 '레버'를 쥐여준다.
   그래서 한도는 고정 결과가 아니라, 레버를 당기면 실시간으로 반응하는 값이다.

   위→아래 3층:
     ① 목표선   고른 집의 필요 대출액을 고정 기준선으로. 지금 닿는 지점과 그 간극을 항상 보여준다.
     ② 레버 2개 부채 레버(왼쪽으로 = 일부상환 가정) / 소득 레버(오른쪽으로 = 인정소득 상향 가정).
                레버 끝에는 항상 '행동 번역'을 붙인다 — 시뮬레이션에서 멈추지 않는다.
     ③ 천장     두 레버를 끝까지 당겼을 때 닿는 최대선. 그 위는 정직하게 "지금은 무리"라고 긋는다.

   계산은 직접 하지 않는다. products/limit.js의 limitAt/ceilingAt에 레버 값을 넘기고 결과만 그린다
   — 그래서 이 파일은 어떤 상품인지 몰라도 된다(레버 → 모듈 → 결과 파이프).
   ⚠️ 자격은 여기서 절대 다시 묻지 않는다. 자격은 Eligibility 한 곳에서만 받는다. */
import { useState } from "react";
import { PRODUCTS, LEVER, C } from "./data.js";
import { deriveFacts, judgeAll, withAssumedIncome, incomeTrust, won, eok } from "./engine.js";
import { limitAt, ceilingAt, debtToReach, incomeToReach } from "./products/limit.js";
import { BackButton, Slider, ContextSummary, Section, Placeholder, Block, Stat, useTween, eyebrow, h1, card, fine } from "./ui.jsx";
import DetailInfo, { detailReady, TrustBadge } from "./DetailInfo.jsx";

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export default function Strategy({ ctx, pickedKey, onPickOther, detail, setDetail, onBack }) {
  /* 레버를 당긴 값. null = 아직 한 번도 안 당김(= 유도 애니메이션을 켜는 신호). */
  const [pull, setPull] = useState(null);

  const facts = deriveFacts(ctx);
  const { passed } = judgeAll(facts);
  const picked = passed.find((p) => p.key === pickedKey) ?? passed[0] ?? null;

  /* 자격이 통과한 게 하나도 없으면 여기 올 일이 없다. 방어만. */
  if (!picked) {
    return (
      <div className="slideup">
        <BackButton onClick={onBack}>자격 조건으로</BackButton>
        <div style={{ ...card, color: C.inkSoft, fontSize: 14, lineHeight: 1.6 }}>조건이 바뀌어서 지금 열리는 상품이 없어요. 앞 화면에서 자격 답변을 다시 확인해주세요.</div>
      </div>
    );
  }

  const target = ctx.needed;                 // 목표선 = 이 집에 필요한 대출액 (앞 화면에서 확정)
  const ready = detailReady(detail);

  /* 소득 레버의 상한은 이 상품의 소득상한에서 잘린다.
     소득을 더 올리면 한도가 아니라 '자격'이 닫히기 때문 — 거짓 희망을 만들지 않으려면 여기서 막아야 한다. */
  const incomeCap = picked.income.value;
  const incomeMax = Math.min(incomeCap, ctx.totalIncome + LEVER.incomeHeadroom);
  const incomeRoom = Math.max(incomeMax - ctx.totalIncome, 0);

  /* DetailInfo가 답한 값 = 레버의 시작 위치. 다시 답하면 당긴 건 초기화한다(기준이 바뀌었으니까). */
  const base = ready ? {
    price: ctx.unit.price, income: ctx.totalIncome, incomeMax, debt: detail.debt,
  } : null;
  const lever = base && {
    ...base,
    debt: clamp(pull?.debt ?? base.debt, 0, base.debt),
    income: clamp(pull?.income ?? base.income, base.income, incomeMax),
  };

  const onDetail = (next) => { setDetail(next); setPull(null); };
  const pullLever = (k, v) => setPull((p) => ({ ...(p ?? {}), [k]: v }));

  return (
    <div className="slideup">
      <BackButton onClick={onBack}>가능한 상품 목록으로</BackButton>
      <div style={eyebrow}>조종간</div>
      <h1 style={h1}>{picked.title}으로<br />이 집에 닿는 길을 찾아요.</h1>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: "0 0 16px", lineHeight: 1.6 }}>
        여기 숫자는 고정된 판정이 아니에요. <b style={{ color: C.ink }}>레버를 당기면 움직입니다</b> — 어디까지 움직이는지, 그리고 어디서부터는 안 움직이는지를 같이 보여드려요.
      </p>

      {/* <ContextSummary ctx={ctx} facts={facts} title={picked.title} /> */}

      <DetailInfo value={detail} onChange={onDetail} />

      {!ready ? (
        <Section title="② 레버" subtitle="위 세 칸을 채우면 레버가 나타나요.">
          <Placeholder>
            채우고 나면 <b>부채 레버</b>와 <b>소득 레버</b>가 열려요. 당기면 이 집까지의 거리가 실시간으로 좁혀지고,
            어디까지 당겨야 닿는지를 <b>“기존 대출 약 얼마 일부상환”</b> 같은 실제 행동으로 번역해 드려요.
          </Placeholder>
        </Section>
      ) : (
        <Cockpit
          ctx={ctx} passed={passed} picked={picked} onPickOther={onPickOther}
          lever={lever} base={base} target={target}
          incomeMax={incomeMax} incomeRoom={incomeRoom} incomeCap={incomeCap}
          trust={incomeTrust(detail.incomeQuality)}
          pulled={pull !== null} pullLever={pullLever} onReset={() => setPull(null)} />
      )}

      <p style={fine}>※ 레버는 “이렇게 가정하면 이 정도 가능성”을 보여주는 시뮬레이터예요. 확정 한도가 아니고, 자격·상한·금리 숫자는 전부 가상 예시예요. 담보평가와 대출 가부는 상담역이 확정하며, 이 화면은 대출을 약속하지 않아요.</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   조종간 본체 — 레버 state는 위에서 받고, 여기서는 "레버 → 모듈 → 결과"만 한다.
   ══════════════════════════════════════════════════════════════════════════ */
function Cockpit({ ctx, passed, picked, onPickOther, lever, base, target, incomeMax, incomeRoom, incomeCap, trust, pulled, pullLever, onReset }) {
  const P = PRODUCTS[picked.product];

  /* ── 레버 → 모듈 → 결과 ── */
  const reach = limitAt(picked.product, lever, picked.limit);
  // TODO: Ceiling을 
  const ceil = ceilingAt(picked.product, lever, picked.limit);

  const reached = reach.limit >= target;
  const gap = Math.max(target - reach.limit, 0);
  const overCeiling = target > ceil.limit;
  /* 소득의 질이 노랑이면 닿아도 결과는 노랑이다 — 인정소득이 깎이면 이 숫자가 내려가니까. */
  const tone = !reached ? "warn" : trust === "warn" ? "warn" : "ok";

  /* 숫자도 툭 바뀌지 않게 보간한다(reduced-motion이면 즉시). */
  const shownReach = useTween(reach.limit);
  const shownGap = useTween(gap);

  /* ── 행동 번역: 어디까지 당기면 닿는지를 역산해 실제 행동으로 옮긴다 ── */
  const debtNeed = debtToReach(picked.product, lever, picked.limit, target);
  const repay = debtNeed === null ? null : Math.max(lever.debt - debtNeed, 0);
  const incomeNeed = incomeToReach(picked.product, lever, picked.limit, target);

  /* ── 상품 순위 반응: 소득 레버는 자격까지 움직인다(소득상한). 그래서 매번 다시 판정한다. ── */
  const simFacts = deriveFacts(withAssumedIncome(ctx, lever.income));
  const sim = judgeAll(simFacts);
  const ranked = sim.passed
    .map((p) => ({ ...p, at: limitAt(p.product, lever, p.limit).limit }))
    .sort((a, b) => b.at - a.at);
  const closedByLever = passed.filter((p) => !sim.passed.some((s) => s.key === p.key));
  const better = ranked.find((p) => p.key !== picked.key && p.at >= target);

  /* 미혼에게 "배우자 소득 합산"을 안내하면 안 된다 — 소득 레버의 설명과 창구 질문이 갈린다. */
  const hasSpouse = ctx.marital !== "single";

  const debtSpent = base.debt - lever.debt;
  const incomeUp = lever.income - base.income;

  /* 레버로 여기서 더 열 수 있는 폭. 0이면 레버는 손잡이만 있고 결과가 안 움직인다
     — 벽이 담보(LTV)나 경로 한도라서 부채·소득으로는 안 내려가기 때문.
     그럴 때 움직이는 척하면 이 화면은 거짓 희망 기계가 된다. 그래서 명시적으로 말한다. */
  const leverRoom = Math.max(ceil.limit - reach.limit, 0);
  const leversInert = leverRoom < 100;

  return (
    <>
      {/* ── ① 목표선 ── */}
      <Section title="② 대출가능금액" tone={tone}
        subtitle={`${ctx.unit.name} 기준 필요 대출 약 ${won(target)}원. 이 선은 안 움직여요. 아래 레버가 움직여요.`}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: tone === "ok" ? C.greenDeep : C.amber, fontVariantNumeric: "tabular-nums" }}>약 {eok(shownReach)}</span>
          <span style={{ fontSize: 13, color: C.inkSoft }}>까지 닿는 중</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: reached ? C.greenDeep : "#9A6B12" }}>
          {reached
            ? `약 ${won(reach.limit - target)}원 여유 — 이 집은 닿아요.`
            : `이 집까지 앞으로 약 ${won(shownGap)}원`}
        </div>

        <Gauge price={base.price} target={target} reach={reach.limit} ceiling={ceil.limit} reached={reached} tone={tone} />

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
          {/* <div key={p.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", color: on ? C.ink : C.inkSoft, fontWeight: on ? 800 : 500 }}>
                <span>{p.label}{on && <span style={{ color: C.amber, marginLeft: 6, fontSize: 11 }}>← 지금 여기서 걸려요</span>}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{won(p.value)}</span>
          </div> */}
          
          {reach.parts.map((p) => {
            const on = p.key === reach.binding.key;
            return (
              <div key={p.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", color: on ? C.ink : C.inkSoft, fontWeight: on ? 800 : 500 }}>
                <span>{p.label}{on && <span style={{ color: C.amber, marginLeft: 6, fontSize: 11 }}>← 지금 여기서 걸려요</span>}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{won(p.value)}</span>
              </div>
            );
          })}

          {/* 디딤돌 계열에서만 채워진다 — 이 금액을 실제로 받았을 때의 월 원리금과 DTI 정산.
              한도가 cap·LTV에 걸려 안 움직이는 구간에서도 이 두 숫자는 레버를 따라 움직인다. */}
          {reach.dti && <DtiLine dti={reach.dti} />}
        </div>
        {reached && trust === "warn" && (
          <div style={{ marginTop: 10 }}><TrustBadge trust="warn" compact /></div>
        )}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
          <Stat label="금리" value={P.rateLabel} />
          <Stat label="실행" value={P.leadTime} warn />
        </div>
      </Section>

      {/* ── ② 레버 ── */}
      <Section title="③ 레버 두 개" tone={leversInert ? "off" : pulled ? undefined : "ok"}
        subtitle={leversInert
          ? "먼저 정직하게 말씀드릴 게 있어요 — 이 경로에선 레버가 결과를 못 움직여요."
          : pulled ? "당긴 만큼 위 거리가 움직여요. 되돌리려면 아래 '원래대로'를 누르세요."
          : `손잡이를 잡고 당겨보세요. 지금 레버로 더 열 수 있는 폭은 약 ${won(leverRoom)}원이에요.`}>

      {leversInert && (
        <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 16, padding: "11px 13px", borderRadius: 11, background: "#F1F3F1", border: `1px solid ${C.greyDot}`, color: C.inkSoft }}>
           <b style={{ color: C.ink }}>{ceil.binding.label}</b>({won(ceil.binding.value)})이에요. <br/>
           <b style={{ color: C.ink }}>부채를 갚아도, 소득이 올라도 이 금액이 최대에요.</b>
          {reached ? " (지금 이미 목표에 닿아 있으니 급하지 않아요)." : "(차액을 현금으로 채우는 길, 그리고 한도가 더 큰 다른 경로)."}
          <br />
        </div>
      )}

        {/* 부채 레버 */}
        <div style={{ marginBottom: 18 }}>
          <LeverHead
            title="부채 레버"
            label="기존 대출을 이만큼으로 가정하면"
            hint="왼쪽으로 밀면 '그만큼 갚았다고 가정'해요. 지금 갚으라는 뜻이 아니에요." />

          {base.debt > 0 ? (
            <LeverRow label="대출 잔액" value={lever.debt} max={base.debt} step={100}
              display={won(lever.debt) + "원"} sub={debtSpent > 0 ? `원래 ${won(base.debt)} → 약 ${won(debtSpent)} 상환 가정` : "아직 안 당김"}
              hint={!pulled && !leversInert} onChange={(v) => pullLever("debt", v)} />
          ) : (
            <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6, marginBottom: 10 }}>
              갖고 있는 대출이 없다고 하셨으니 이 레버는 <b>이미 끝까지 당겨져 있어요</b>. 부채로는 더 열 여지가 없어요.
            </div>
          )}

          {/* 잣대에 따라 이 설명이 달라진다. 상품 데이터(capacityModel)를 읽어 고른다 — 문구를 지어내지 않기 위해. */}
          <div style={{ fontSize: 12, color: "#9AA3A0", lineHeight: 1.6, marginTop: 8 }}>
            {P.capacityModel === "fundDTI"
              ? <>{P.name}은 DTI로 보기 때문에 기존 대출에서 <b>이자만</b> 잡혀요 — 잔액 × 추정금리가 상환능력에서 빠져요.
                  그래서 <b>잔액을 줄이면</b> 그만큼 열려요(월 얼마씩 갚는지는 이 상품 계산에 안 들어가요).</>
              : <>{P.name}은 기존 대출을 <b>원리금</b>으로 봐요(가정 금리·만기 기준 근사). 그래서 잔액을 줄이면 상환능력 칸이 그만큼 열려요.</>}
          </div>
        </div>

        {/* 소득 레버 */}
        <div style={{ paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
          <LeverHead
            title="소득 레버"
            label={incomeUp > 0 ? `인정소득을 약 ${won(lever.income)}원으로 가정하면` : "인정소득을 이만큼으로 가정하면"}
            hint={hasSpouse
              ? "오른쪽으로 밀면 '배우자 합산·인정소득이 이만큼 잡힌다고 가정'해요."
              : "오른쪽으로 밀면 '상여·수당까지 인정소득이 이만큼 잡힌다고 가정'해요."} />

          {incomeRoom >= LEVER.incomeStep ? (
            <LeverRow label={hasSpouse ? "가정 인정소득 (부부합산)" : "가정 인정소득"} value={lever.income} min={base.income} max={incomeMax} step={LEVER.incomeStep}
              display={won(lever.income) + "원"} sub={incomeUp > 0 ? `확정 ${won(base.income)} → 약 ${won(incomeUp)} 더 인정 가정` : "아직 안 당김"}
              hint={!pulled && !leversInert && base.debt === 0} onChange={(v) => pullLever("income", v)} />
          ) : (
            <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6, marginBottom: 10 }}>
              이 경로는 합산소득 <b>{won(incomeCap)}원</b>이 자격 상한이에요({picked.income.label}). 지금 소득이 이미 그 근처라 <b>소득 레버는 올릴 데가 없어요</b> —
              더 올리면 한도가 아니라 <b>자격이 닫혀요</b>.
            </div>
          )}
          {trust && <TrustBadge trust={trust} compact />}
          <div style={{ fontSize: 12, color: "#9AA3A0", lineHeight: 1.6, marginTop: 8 }}>
            소득 레버는 <b>{won(incomeCap)}원</b>({picked.income.label})에서 멈춰요{hasSpouse ? "(부부합산 기준)" : ""}. 그 위는 한도가 늘어나는 게 아니라 이 상품 자격에서 빠져요.
          </div>
        </div>

        {pulled && (
          <button onClick={onReset} style={{ marginTop: 14, padding: "9px 14px", borderRadius: 10, border: `1.5px solid ${C.line}`, background: "#fff", color: C.inkSoft, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            ↺ 원래대로
          </button>
        )}
      </Section>

      {/* ── 행동 번역 (레버 끝) ── */}
      <Translate
        reached={reached} trust={trust} gap={gap} overCeiling={overCeiling}
        lever={lever} base={base} hasSpouse={hasSpouse}
        debtNeed={debtNeed} repay={repay} incomeNeed={incomeNeed} incomeCap={incomeCap}
        productName={P.name} />

      {/* ── ③ 정직한 천장 ── */}
      <Ceiling ceil={ceil} target={target} reach={reach.limit} overCeiling={overCeiling} base={base} incomeMax={incomeMax} incomeCap={incomeCap} productName={P.name} />

      {/* ── 상품 순위 반응 ── */}
      <Ranked ranked={ranked} closedByLever={closedByLever} better={better} picked={picked}
        lever={lever} target={target} reached={reached} reachLimit={reach.limit} onPickOther={onPickOther} />

      {/* <Block title="은행 가기 전 준비" items={P.guide.prepare} />
      <Block title="창구에서 이렇게 물어보세요" items={P.guide.ask} />
      <Block title="애매할 때 대처" items={P.guide.fallback} /> */}
    </>
  );
}

/* ── 본건 원리금 · DTI 정산 (디딤돌 계열 전용) ──
   "얼마 나오나"만이 아니라 "그럼 매달 얼마고, 내 DTI는 몇 %인가"까지 같이 봐야
   창구에서 예습이 된다. 이 줄은 engine.didimdolDtiAt이 계산한 값을 그리기만 한다.
   ⚠️ 가드레일 1 — 확정 상환액이 아니라 가정(만기·금리)에 따른 추정이다. 가정을 같이 적는다. */
function DtiLine({ dti }) {
  if (dti.ratio == null) return null;
  const pct = dti.ratio * 100, capPct = dti.cap * 100;
  const tight = dti.ratio >= dti.cap - 0.02;        // DTI가 벽에 붙은 상태
  const color = tight ? C.amber : C.greenDeep;
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13 }}>
        <span style={{ color: C.inkSoft }}>이 금액이면 매달 <b style={{ color: C.ink }}>약 {won(dti.ownMonthly)}원</b></span>
        <span style={{ fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>DTI 약 {pct.toFixed(0)}%</span>
      </div>
      <div style={{ position: "relative", height: 6, borderRadius: 3, background: "#EDF1ED", marginTop: 7, overflow: "hidden" }}>
        <div className="gauge-fill" style={{ position: "absolute", inset: 0, right: "auto", width: `${clamp(pct / capPct, 0, 1) * 100}%`, background: color }} />
      </div>
      <div style={{ fontSize: 11, color: "#9AA3A0", lineHeight: 1.6, marginTop: 5 }}>
        상한 {capPct.toFixed(0)}% 기준 · 본건은 만기 {dti.years}년·연 {(dti.rate * 100).toFixed(1)}% 원리금균등으로 계산해요(실제 만기와 무관한 산정 기준이에요).
        {dti.debtAnnual > 0 && <> 여기에 기존 대출 이자 약 연 {won(dti.debtAnnual)}원이 같이 잡혀요.</>}
        {tight
          ? <> <b style={{ color: "#9A6B12" }}>지금은 DTI가 벽이에요</b> — 부채를 줄이거나 인정소득이 오르면 이 칸이 열려요.</>
          : <> 상한까지 연 약 {won(dti.roomAnnual)}원 여유가 있어요.</>}
      </div>
    </div>
  );
}

/* ── 게이지: 숫자가 툭 바뀌는 게 아니라 '거리가 좁혀지는' 게 보여야 한다.
   축(0~100%) = 시세. "10억짜리 집 중 3억 대출 + 7억 현금" 처럼, 대출과 현금을
   같은 막대 위에서 바로 비교하게 한다 — 목표 대출액이 아니라 집값이 Maximum. */
function Gauge({ price, target, reach, ceiling, reached, tone }) {
  const scale = Math.max(price, ceiling, target, 1);
  const pos = (v) => clamp(v / scale, 0, 1) * 100;
  const fill = reached ? (tone === "warn" ? C.amber : C.green) : C.green;
  const cashNeeded = Math.max(price - reach, 0);
  return (
    <div>
      {/* <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12, color: C.inkSoft, marginBottom: 6 }}>
        <span>시세 {won(price)}원 중</span>
        <span>대출 <b style={{ color: C.ink }}>약 {won(reach)}원</b> + 현금 <b style={{ color: C.ink }}>약 {won(cashNeeded)}원</b></span>
      </div> */}
      <div style={{ position: "relative", height: 16, fontSize: 11 }}>
        <span className="gauge-mark" style={{ position: "absolute", left: `${pos(target)}%`, transform: "translateX(-50%)", whiteSpace: "nowrap", fontWeight: 800, color: C.ink }}>
          목표 {won(target)}
        </span>
      </div>
      <div style={{ position: "relative", height: 44, borderRadius: 12, background: "#EDF1ED", border: `1px solid ${C.line}`, overflow: "hidden" }}>
        {/* 천장(최대가능금액) 밖 = 레버를 다 당겨도 대출로는 못 채우는 구간 → 항상 현금 몫 */}
        <div className="stripe-off gauge-fill" style={{ position: "absolute", top: 0, bottom: 0, left: `${pos(ceiling)}%`, width: `${Math.max(100 - pos(ceiling), 0)}%` }} />
        {/* 지금 닿는 대출액 */}
        <div className="gauge-fill" style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${pos(reach)}%`, background: fill }} />
        {/* 남은 간극 — 레버를 당기면 이게 줄어든다 */}
        {!reached && <div className="stripe-gap gauge-gap" style={{ position: "absolute", top: 0, bottom: 0, left: `${pos(reach)}%`, width: `${Math.max(pos(target) - pos(reach), 0)}%` }} />}
        {/* 목표선(이 집에 필요한 대출액) */}
        <div className="gauge-mark" style={{ position: "absolute", top: 0, bottom: 0, left: `${pos(target)}%`, width: 3, marginLeft: -1, background: C.ink, zIndex: 3 }} />
        {/* 천장선(레버를 다 당겼을 때의 최대 대출) */}
        <div className="gauge-mark" style={{ position: "absolute", top: 0, bottom: 0, left: `${pos(ceiling)}%`, width: 2, background: C.inkSoft, opacity: .6, zIndex: 2 }} />
      </div>
      <div style={{ position: "relative", height: 16, marginTop: 4, fontSize: 11, color: C.inkSoft }}>
        {pos(ceiling) < 88 && (
          <span className="gauge-mark" style={{ position: "absolute", left: `${pos(ceiling)}%`, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
            최대가능금액 {won(ceiling)}
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
function LeverHead({ title, label, hint }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.greenDeep }}>{title}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#9AA3A0", marginTop: 2, lineHeight: 1.5 }}>{hint}</div>
    </div>
  );
}

function LeverRow({ label, value, min = 0, max, step, display, sub, hint, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{display}</span>
      </div>
      <input type="range" className={`lever${hint ? " hint" : ""}`} aria-label={label}
        min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 11, color: "#9AA3A0" }}>
        <span>{sub ?? " "}</span>
        {hint && <span style={{ color: C.greenDeep, fontWeight: 800 }}>← 당겨보세요</span>}
      </div>
    </div>
  );
}

/* ── 행동 번역 — 시뮬레이션에서 멈추지 않고 실제로 할 수 있는 일로 옮긴다 ──
   가드레일 2: '뚫는 법·협상 멘트'가 아니라 '예습'. 창구에서 확인할 질문만 준다. */
function Translate({ reached, trust, gap, overCeiling, lever, base, hasSpouse, debtNeed, repay, incomeNeed, incomeCap, productName }) {
  if (reached) {
    return (
      <Section title="④ 그래서 지금 뭘 하면 되나" tone={trust === "warn" ? "warn" : "ok"}
        subtitle="지금 레버 위치가 실제로 성립하는지만 확인하면 돼요.">
        <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 10 }}>
          {base.debt > lever.debt
            ? <>이 상태는 <b>기존 대출을 약 {won(base.debt - lever.debt)}원 정리했다는 가정</b>이에요. 실행과 동시에 갚는 <b>일부상환조건부</b>로 걸 수 있는지가 관건이에요.</>
            : <>지금 부채 그대로 목표에 닿아요. 레버를 더 당기지 않아도 돼요.</>}
          {lever.income > base.income && <><br />그리고 <b>인정소득 약 {won(lever.income)}원</b>이 잡힌다는 가정이에요 — {hasSpouse ? "배우자 소득 합산과 인정소득 산정이" : "상여·수당까지 인정소득 산정이"} 이대로 되는지 확인이 필요해요.</>}
        </div>
        <Block title="창구에서 이렇게 확인하세요" items={[
          ...(base.debt > lever.debt ? [`기존 대출을 약 ${won(base.debt - lever.debt)}원 일부상환조건부로 걸면 한도가 어디까지 되는지 확인 부탁드립니다.`] : []),
          ...(lever.income > base.income ? [hasSpouse ? "배우자 소득 합산과 인정소득이 제 서류에서 얼마로 잡히는지 알려주세요." : "제 서류에서 인정소득이 얼마로 잡히는지 알려주세요."] : []),
          `${productName} 기준으로 제 상환능력 한도와 담보 한도 중 어느 쪽이 먼저 걸리는지 알려주세요.`,
          "잔금일에 맞춰 실행이 가능한 일정인지 먼저 확인 부탁드립니다.",
        ]} />
        <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6, marginTop: 10 }}>
          목표를 넘는 금액은 현금으로 채울 필요가 없어요. 반대로 <b>부족한 만큼만 현금이 있으면</b> 되고, 지금은 부족하지 않아요.
        </div>
      </Section>
    );
  }

  const paths = [];
  if (debtNeed !== null && repay > 0) paths.push({
    key: "debt",
    title: `대출 잔액을 약 ${won(debtNeed)}원까지 줄이면 닿아요`,
    body: <>= <b>약 {won(repay)}원 일부상환</b>이에요. 실행과 동시에 갚는 <b>일부상환조건부</b>로 거는 방식이 있어요 — 목돈을 미리 다 준비해야 하는 건 아니에요.</>,
    ask: [`기존 대출 약 ${won(repay)}원을 일부상환조건부로 걸면 한도가 어디까지 되는지 확인 부탁드립니다.`,
          "일부상환 시점이 대출 실행일과 같아도 되는지 알려주세요."],
  });
  if (incomeNeed !== null && incomeNeed > lever.income) paths.push({
    key: "income",
    title: `인정소득이 약 ${won(incomeNeed)}원이면 닿아요`,
    body: <>지금 확정치보다 약 {won(incomeNeed - base.income)}원 더 인정돼야 해요. {hasSpouse ? "배우자 소득 합산이나 상여·수당이" : "상여·수당이"} 인정소득에 어떻게 잡히는지에 따라 갈려요 — 이건 <b>상담역과 서류로 확인</b>할 일이에요.</>,
    ask: ["제 서류에서 인정소득이 얼마로 잡히는지 알려주세요.",
          hasSpouse
            ? "배우자 소득을 합산하면 상환능력 한도가 얼마까지 올라가는지 확인 부탁드립니다."
            : "상여·수당이 인정소득에 포함되면 상환능력 한도가 얼마까지 올라가는지 확인 부탁드립니다.",
          `소득이 ${won(incomeCap)}원을 넘으면 이 상품 자격에서 빠지는지도 같이 확인해 주세요.`],
  });

  return (
    <Section title="④ 그래서 지금 뭘 하면 되나" tone="warn"
      subtitle={paths.length > 0 ? "레버를 여기까지 당기면 닿아요. 그 레버를 실제 행동으로 옮기면 이렇습니다." : "레버로는 여기까지예요. 그래도 길은 있어요."}>
      {paths.map((p) => (
        <div key={p.key} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{p.title}</div>
          <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.7 }}>{p.body}</div>
          <div style={{ marginTop: 7, paddingLeft: 11, borderLeft: `2px solid ${C.line}` }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.greenDeep, marginBottom: 3 }}>창구에서 이렇게 확인하세요</div>
            {p.ask.map((t) => <div key={t} style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.65 }}>· {t}</div>)}
          </div>
        </div>
      ))}

      <div style={{ paddingTop: paths.length > 0 ? 12 : 0, borderTop: paths.length > 0 ? `1px solid ${C.line}` : "none" }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>차액 약 {won(gap)}원을 현금으로 채우면 지금 그대로 돼요</div>
        <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.7 }}>
          레버를 안 당겨도 되는 길이에요. 이만큼 현금이 있으면 이 집은 지금 상태로 성립해요.
          {overCeiling && " 레버로는 이 집에 닿지 않으니, 지금은 이 길이 더 현실적이에요."}
        </div>
        <div style={{ fontSize: 12, color: "#9AA3A0", marginTop: 5 }}>※ 잔금 일정은 계약 전에 상담역과 먼저 맞춰보세요.</div>
      </div>
    </Section>
  );
}

/* ── ③ 정직한 천장 — 거짓 희망 기계가 되지 않기 위한 층 ── */
function Ceiling({ ceil, target, reach, overCeiling, base, incomeMax, incomeCap, productName }) {
  /* 벽 이름은 계산이 붙여준 라벨을 그대로 쓴다 — 상품에 따라 DTI/DSR로 갈리므로 화면에서 다시 적으면 갈라진다. */
  const wall = ceil.binding.label;
  return (
    <Section title="⑤ 정직한 천장" tone={overCeiling ? "off" : undefined}
      subtitle="두 레버를 끝까지 당겼을 때(부채 0 · 소득 상한) 닿는 최대선이에요. 이 위는 지금 무리라고 정직하게 그어둘게요.">
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>약 {eok(ceil.limit)}</span>
        <span style={{ fontSize: 13, color: C.inkSoft }}>이 최대선</span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.7, color: overCeiling ? "#9A6B12" : C.inkSoft }}>
        {overCeiling
          ? <><b>레버를 끝까지 당겨도 이 집까지 약 {won(target - ceil.limit)}원 모자라요.</b> 부채를 다 갚고 소득이 자격 상한까지 인정돼도요 — 그래서 “이 집은 지금 무리”라고 말씀드리는 게 맞아요. 대신 위 <b>차액을 현금으로 채우는 길</b>과 아래 <b>다른 상품</b>은 아직 열려 있어요.</>
          : <>이 집(약 {won(target)}원)은 천장 <b>안쪽</b>이에요. 레버를 당기면 닿는 범위라는 뜻이에요{reach >= target ? " — 이미 닿아 있어요." : "."}</>}
      </div>
      <div style={{ fontSize: 12, color: "#9AA3A0", lineHeight: 1.65, marginTop: 9, paddingTop: 9, borderTop: `1px solid ${C.line}` }}>
        천장을 만드는 벽: <b style={{ color: C.inkSoft }}>{wall}</b> ({won(ceil.binding.value)}).
        {ceil.binding.key === "ltv" && " 담보 벽은 부채를 다 갚아도, 소득이 올라도 안 내려가요. 시세와 방공제로 정해지는 값이에요."}
        {ceil.binding.key === "cap" && ` ${productName}의 경로 한도가 벽이라, 더 큰 한도의 경로로 갈아타는 게 유일한 길이에요.`}
        {ceil.binding.key === "dti" && ` 소득 레버 상한(${won(incomeMax)}, 자격 상한 ${won(incomeCap)})까지 올린 값이에요. 부채는 0으로 가정했어요(원래 ${won(base.debt)}).`}
      </div>
    </Section>
  );
}

/* ── 상품 순위 반응 — 레버를 당기면 목록 순서가 바뀐다 ──
   소득 레버는 자격까지 움직이므로(소득상한) 열리는 게 아니라 '닫히는' 경우도 정직하게 보여준다. */
function Ranked({ ranked, closedByLever, better, picked, lever, target, reached, reachLimit, onPickOther }) {
  if (ranked.length === 0) return null;
  return (
    <Section title="⑥ 레버를 당긴 지금, 어떤 상품이 유리한가" tone={better && !reached ? "ok" : undefined}
      subtitle="자격이 됐던 것들을 지금 레버 상태로 다시 세웠어요. 눌러서 갈아탈 수 있어요.">
      {better && !reached && (
        <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: "#F3F9F5", border: "1px solid #CFE6D9", color: C.greenDeep }}>
          지금 <b>{picked.title}</b>로는 약 {won(target - reachLimit)}원 부족한데,
          <b> {better.title}</b>는 이 레버 상태로 <b>이미 닿아요</b>. 눌러서 갈아타보세요.
        </div>
      )}
      {ranked.map((p) => {
        const on = p.key === picked.key;
        const covers = p.at >= target;
        /* 안 닿는 경로엔 "얼마 갚으면 열리는지"를 그 상품 기준으로 역산해 붙인다. */
        const need = covers ? null : debtToReach(p.product, lever, p.limit, target);
        const repay = need === null ? null : Math.max(lever.debt - need, 0);
        return (
          <button key={p.key} onClick={() => onPickOther(p.key)}
            style={{ width: "100%", textAlign: "left", marginBottom: 8, padding: "11px 13px", borderRadius: 12, cursor: "pointer", border: `1.5px solid ${on ? C.greenDeep : C.line}`, background: on ? "#F3F9F5" : "#fff" }}>
            <div style={{ display: "flex", color: C.inkSoft, justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{p.title}{on && <span style={{ fontSize: 11, color: C.greenDeep, marginLeft: 6 }}>보는 중</span>}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: covers ? C.greenDeep : C.amber, fontVariantNumeric: "tabular-nums" }}>약 {eok(p.at)}</span>
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3, lineHeight: 1.6 }}>
              {p.rateLabel} · 실행 {p.leadTime} · {covers ? "이 레버 상태로 닿아요" : `약 ${won(target - p.at)}원 부족`}
              {!covers && repay > 0 && <><br /><b style={{ color: C.greenDeep }}>약 {won(repay)}원 더 갚으면 이 경로도 닿아요.</b></>}
            </div>
          </button>
        );
      })}

      {closedByLever.length > 0 && (
        <div style={{ fontSize: 12, color: "#9A6B12", lineHeight: 1.7, marginTop: 4, padding: "9px 12px", borderRadius: 10, background: "#FDF6E9", border: "1px solid #F0DFBC" }}>
          소득 레버를 약 {won(lever.income)}원까지 올리면 <b>{closedByLever.map((p) => p.title).join(", ")}</b>는 소득상한을 넘어 자격이 닫혀요.
          소득을 올리는 게 항상 유리한 게 아니라는 뜻이에요 — 레버를 되돌리면 다시 열려요.
        </div>
      )}

      <Placeholder>
        금리·총이자까지 함께 놓고 보는 <b>본격 비교</b>는 다음에 붙일 자리예요(TODO). 지금은 한도 축만 세워뒀어요 —
        한도가 크다고 유리한 게 아니라 <b>잔금일에 맞느냐</b>가 먼저인 경우가 많아요.
      </Placeholder>
    </Section>
  );
}
