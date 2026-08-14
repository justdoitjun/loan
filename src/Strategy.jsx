/* 조종간(cockpit) — 이 서비스의 정체성이 가장 진하게 드러나는 화면.
   대출을 '조회'해주는 게 아니라, 원하는 집에 닿도록 '레버'를 쥐여준다.
   그래서 한도는 고정 결과가 아니라, 레버를 당기면 실시간으로 반응하는 값이다.

   위→아래:
     ① 부채 입력   레버의 시작 위치.
     ② 한도 + 게이지  고른 집의 필요 대출액을 고정 기준선으로. 지금 닿는 지점과 간극.
     ③ 레버 2개     부채(일부상환 가정) / 소득(인정소득 상향 가정).
                    결과가 안 움직이면 레버를 그리지 않고 열린 길을 말한다.

   계산은 직접 하지 않는다. products/limit.js의 limitAt/ceilingAt에 레버 값을 넘기고 결과만 그린다
   — 그래서 이 파일은 어떤 상품인지 몰라도 된다(레버 → 모듈 → 결과 파이프).
   ⚠️ 자격은 여기서 절대 다시 묻지 않는다. 자격은 Eligibility 한 곳에서만 받는다. */
import { useMemo, useState } from "react";
import { DATA, PRODUCTS, LEVER, C, COLOR_VALUE } from "./data.js";
import { deriveFacts, judgeAll, withAssumedIncome, won, eok } from "./engine.js";
import { limitAt, ceilingAt } from "./products/limit.js";
import { leverOf, detailReady } from "./person.js";
import { judgeUnits } from "./verdict.js";
import { BackButton, Section, Stat, useTween, eyebrow, h1, card, fine } from "./ui.jsx";
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

  const target = ctx.needed;                 // 목표선 = 이 집에 필요한 대출액 (앞 화면에서 확정)
  const ready = detailReady(detail);

  /* 소득 레버의 상한은 이 상품의 소득상한에서 잘린다.
     소득을 더 올리면 한도가 아니라 '자격'이 닫히기 때문 — 거짓 희망을 만들지 않으려면 여기서 막아야 한다. */
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
      <div style={eyebrow}>함께 전략을 짜봐요</div>
      <h1 style={h1}>{picked.title}으로<br />이 집에 닿는 길을 찾아요.</h1>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: "0 0 16px", lineHeight: 1.6 }}>
        여기 숫자는 고정된 판정이 아니에요. <b style={{ color: C.ink }}>레버를 당기면 움직입니다</b> — 어디까지 움직이는지, 그리고 어디서부터는 안 움직이는지를 같이 보여드려요.
      </p>

      <DetailInfo value={detail} onChange={onDetail} />

      {/* 부채 확정 전에는 레버를 그리지 않는다 — 슬라이더를 만지작거리는 중간값으로 한도가 그려지면 안 된다. */}
      {ready && (
        <Cockpit
          ctx={ctx} picked={picked} onPickOther={onPickOther}
          lever={lever} base={base} target={target}
          incomeMax={incomeMax} incomeRoom={incomeRoom} incomeCap={incomeCap}
          pulled={pull !== null} pullLever={pullLever} onReset={() => setPull(null)} />
      )}

      {/* 다른 매물을 볼 때만 위 내용을 접는다. 기본은 닫힘 — 조종간이 주인공이고 이건 곁가지다. */}
      <OtherUnits person={person} currentId={ctx.unit.id} onSwapUnit={onSwapUnit} />

      <p style={fine}>※ 레버는 “이렇게 가정하면 이 정도 가능성”을 보여주는 시뮬레이터예요. 확정 한도가 아니고, 자격·상한·금리 숫자는 전부 가상 예시예요. 담보평가와 대출 가부는 상담역이 확정하며, 이 화면은 대출을 약속하지 않아요.</p>
    </div>
  );
}

/* ── 레버가 결과를 못 움직일 때 그 자리에 오는 것 ──
   레버를 숨기는 대신 반드시 세 가지를 준다: 무엇이 벽인지 / 왜 부채·소득으로 안 되는지 /
   그럼 어디가 열려 있는지. 셋째가 빠지면 이건 그냥 거절 화면이 된다(가드레일 4). */
function InertLevers({ binding, reached, gap, better, productName, onPickOther }) {
  /* 벽마다 '왜 안 움직이는지'가 다르다. 뭉뚱그리면 창구에서 물어볼 것도 못 정한다. */
  const why = {
    ltv: <>담보 가격이 정하는 벽이에요. 시세와 방공제로 계산돼서, <b>부채를 갚아도 소득이 올라도 안 내려가요.</b></>,
    cap: <>{productName} 상품 자체로 가능한 최대한도에요.</>,
    dti: <>소득으로는 최대한도에요. 더 올리면 한도가 늘어나는 게 아니라 <b>자격에서 빠져요.</b></>,
  }[binding.key] ?? <>지금 조건에선 부채·소득으로 이 금액이 안 움직여요.</>;

  return (
    <Section title="③ 여기선 레버가 안 통해요" tone="off"
      >
      <div style={{ fontSize: 13, lineHeight: 1.7, color: C.inkSoft }}>
         <b style={{ color: C.ink }}>{binding.label} 약 {won(binding.value)}원</b>이에요. <br/>{why}
      </div>

      {/* 벽을 말했으면 반드시 길을 같이 준다 */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
        {reached ? (
          <div style={{ fontSize: 13, color: C.greenDeep, lineHeight: 1.7, fontWeight: 700 }}>
            그래도 이 집엔 이미 닿아 있어요. 레버가 안 움직일 뿐, 지금 상태로 충분해요.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 7 }}>대안은 없을까요?</div>
            <Path>차액 <b>약 {won(gap)}원</b>만 현금으로 더 모아보면 돼요.</Path>
            {better && (
              <Path>
                <b>{better.title}</b>로 보면 약 {eok(better.at)}까지 열려요 — 지금 조건으로도 자격이 돼요.{" "}
                <button onClick={() => onPickOther(better.key)} style={{ border: "none", background: "none", padding: 0, color: C.greenDeep, fontSize: 13, fontWeight: 800, cursor: "pointer", textDecoration: "underline" }}>
                  이걸로 다시 볼게요 →
                </button>
              </Path>
            )}
            {binding.key === "ltv" && (
              <Path>방공제(소액임차보증금)가 <b>상쇄되는 대출</b>이 있는지 상담역에게 물어보세요. 대출에 따라 갈리는 부분이라 여기서 단정할 수 없어요.</Path>
            )}
            <div style={{ fontSize: 12, color: "#9AA3A0", lineHeight: 1.6, marginTop: 9 }}>
              어느 길이 실제로 열리는지는 담보평가와 서류를 보고 <b>상담역이 확정</b>해드려요.
            </div>
          </>
        )}
      </div>
    </Section>
  );
}

const Path = ({ children }) => (
  <div style={{ display: "flex", gap: 8, fontSize: 13, lineHeight: 1.65, color: C.inkSoft, marginBottom: 6 }}>
    <span style={{ color: C.greenDeep, fontWeight: 800, flex: "0 0 auto" }}>·</span><span>{children}</span>
  </div>
);

/* ══════════════════════════════════════════════════════════════════════════
   조종간 본체 — 레버 state는 위에서 받고, 여기서는 "레버 → 모듈 → 결과"만 한다.
   ══════════════════════════════════════════════════════════════════════════ */
function Cockpit({ ctx, picked, onPickOther, lever, base, target, incomeMax, incomeRoom, incomeCap, pulled, pullLever, onReset }) {
  const P = PRODUCTS[picked.product];

  /* ── 레버 → 모듈 → 결과 ── */
  const reach = limitAt(picked.product, lever, picked.limit);
  const ceil = ceilingAt(picked.product, lever, picked.limit);

  const reached = reach.limit >= target;
  const gap = Math.max(target - reach.limit, 0);
  const tone = reached ? "ok" : "warn";

  /* 숫자도 툭 바뀌지 않게 보간한다(reduced-motion이면 즉시). */
  const shownReach = useTween(reach.limit);

  /* 소득 레버는 자격까지 움직인다(소득상한). 레버가 안 통할 때 다른 열린 길을 찾기 위해 다시 판정한다. */
  const sim = judgeAll(deriveFacts(withAssumedIncome(ctx, lever.income)));
  const better = sim.passed
    .map((p) => ({ ...p, at: limitAt(p.product, lever, p.limit).limit }))
    .sort((a, b) => b.at - a.at)
    .find((p) => p.key !== picked.key && p.at >= target);

  /* 미혼에게 "배우자 소득 합산"을 안내하면 안 된다 — 소득 레버의 설명과 창구 질문이 갈린다. */
  const hasSpouse = ctx.marital !== "single";

  const debtSpent = base.debt - lever.debt;
  const incomeUp = lever.income - base.income;

  /* 이 레버들이 '통틀어' 열 수 있는 폭 = 시작 위치(base)에서 천장까지.
     0이면 손잡이만 있고 결과가 안 움직인다 — 벽이 담보(LTV)나 대출 한도라서
     부채·소득으로는 안 내려가기 때문. 그럴 땐 레버를 아예 안 그린다(아래 InertLevers).
     움직이는 척하는 손잡이는 이 화면을 거짓 희망 기계로 만든다.

     ⚠️ 현재 위치(reach)로 재면 안 된다. 레버를 끝까지 당긴 순간 reach == ceil이 되어
        방금 9천만원을 열어놓고도 "레버가 안 통해요"라고 말하고, 레버가 손 밑에서 사라진다.
        '열 수 있는 폭'은 사용자가 어디까지 당겼느냐와 무관한 구조적 성질이다. */
  const baseReach = limitAt(picked.product, base, picked.limit);
  const leverRoom = Math.max(ceil.limit - baseReach.limit, 0);
  const leversInert = leverRoom < 100;
  /* 지금 위치에서 아직 남은 폭 — 안내 문구용(당길수록 줄어드는 게 맞다) */
  const roomLeft = Math.max(ceil.limit - reach.limit, 0);

  return (
    <>
      {/* ── ① 목표선 ── */}
      <Section title="② 대출가능금액" tone={tone}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: tone === "ok" ? C.greenDeep : C.amber, fontVariantNumeric: "tabular-nums" }}>약 {eok(shownReach)}</span>
        </div>

        <Gauge price={base.price} target={target} reach={reach.limit} ceiling={ceil.limit} reached={reached} tone={tone} />

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
          {reach.parts.map((p) => {
            const on = p.key === reach.binding.key;
            return (
              <div key={p.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", color: on ? C.ink : C.inkSoft, fontWeight: on ? 800 : 500 }}>
                <span>{p.label}{on && <span style={{ color: C.amber, marginLeft: 6, fontSize: 11 }}>← 지금 여기서 걸려요</span>}</span>
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
        <InertLevers binding={ceil.binding} reached={reached} gap={gap} better={better}
          productName={P.name} onPickOther={onPickOther} />
      ) : (
      <Section title="③ 레버 두 개" tone={pulled ? undefined : "ok"}
        subtitle={pulled
          ? "당긴 만큼 위 거리가 움직여요. 되돌리려면 아래 '원래대로'를 누르세요."
          : `손잡이를 잡고 당겨보세요. 지금 레버로 더 열 수 있는 폭은 약 ${won(roomLeft)}원이에요.`}>

        {/* 부채 레버 */}
        <div style={{ marginBottom: 18 }}>
          <LeverHead
            title="부채 레버"
            label="기존 대출을 이만큼으로 가정하면"
            hint="왼쪽으로 밀면 '그만큼 갚았다고 가정'해요. 지금 갚으라는 뜻이 아니에요." />

          {base.debt > 0 ? (
            <LeverRow label="대출 잔액" value={lever.debt} max={base.debt} step={100}
              display={won(lever.debt) + "원"} sub={debtSpent > 0 ? `원래 ${won(base.debt)} → 약 ${won(debtSpent)} 상환 가정` : "아직 안 당김"}
              hint={!pulled} onChange={(v) => pullLever("debt", v)} />
          ) : (
            <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6, marginBottom: 10 }}>
              갖고 있는 대출이 없다고 하셨으니 이 레버는 <b>이미 끝까지 당겨져 있어요</b>. 부채로는 더 열 여지가 없어요.
            </div>
          )}

          {/* 잣대에 따라 이 설명이 달라진다. 상품 데이터(capacityModel)를 읽어 고른다 — 문구를 지어내지 않기 위해. */}
          <div style={{ fontSize: 12, color: "#9AA3A0", lineHeight: 1.6, marginTop: 8 }}>
            {P.capacityModel === "fundDTI"
              ? <>{P.name}은 DTI로 보기 때문에 기존 대출에서 <b>이자만</b> 잡혀요 — 잔액 × 추정금리가 상환능력에서 빠져요.
                  그래서 <b>잔액을 줄이면</b> 그만큼 열려요(월 얼마씩 갚는지는 이 대출 계산에 안 들어가요).</>
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
              hint={!pulled && base.debt === 0} onChange={(v) => pullLever("income", v)} />
          ) : (
            <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6, marginBottom: 10 }}>
              이 대출은 합산소득 <b>{won(incomeCap)}원</b>이 자격 상한이에요({picked.income.label}). 지금 소득이 이미 그 근처라 <b>소득 레버는 올릴 데가 없어요</b> —
              더 올리면 한도가 아니라 <b>자격이 닫혀요</b>.
            </div>
          )}
          <div style={{ fontSize: 12, color: "#9AA3A0", lineHeight: 1.6, marginTop: 8 }}>
            소득 레버는 <b>{won(incomeCap)}원</b>({picked.income.label})에서 멈춰요{hasSpouse ? "(부부합산 기준)" : ""}. 그 위는 한도가 늘어나는 게 아니라 이 대출 자격에서 빠져요.
          </div>
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
   "다른 매물도 알아볼까요?" — 조종간의 곁가지.
   기본은 닫힘. 펼치면 지금 레버 상태 그대로 DATA 전체를 다시 판정해서 보여준다.
   ⚠️ 여기서 매물을 고르면 '목표 매물'만 바뀐다 — 자격 답변도, 부채도, 레버도 그대로다.
      그래서 재질문이 없고, 고르는 즉시 위 조종간이 새 매물 기준으로 다시 그려진다.
   ══════════════════════════════════════════════════════════════════════════ */
function OtherUnits({ person, currentId, onSwapUnit }) {
  const [open, setOpen] = useState(false);
  /* 예산 지도와 같은 함수·같은 사람상태를 쓴다(verdict.judgeUnit) — 두 화면의 색이 갈리지 않게. */
  const painted = useMemo(() => judgeUnits(DATA, person), [person]);
  const green = painted.filter((r) => r.color === "green").length;
  const list = [...painted].sort((a, b) => a.price - b.price);

  return (
    <div style={{ ...card, padding: 0, marginTop: 12, overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "13px 16px", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>다른 매물도 알아볼까요?</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: C.greenDeep }}>
          지금 조건으로 {green}곳
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
                  <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <i style={{ width: 11, height: 11, borderRadius: "50%", background: COLOR_VALUE[r.color], flex: "0 0 auto" }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: C.ink }}>
                        {r.name}{on && <span style={{ fontSize: 11, color: C.greenDeep, marginLeft: 6 }}>지금 보는 중</span>}
                      </span>
                      <span style={{ display: "block", fontSize: 12, color: C.inkSoft, marginTop: 1 }}>{r.dong} · 전용 {r.areaM2}㎡ · {won(r.price)}원</span>
                    </span>
                  </span>
                  {!on && (
                    <span style={{ fontSize: 12, fontWeight: 800, flex: "0 0 auto", color: r.color === "green" ? C.greenDeep : r.color === "amber" ? C.amber : C.inkSoft }}>
                      {r.slack >= 0 ? `여유 ${won(r.slack)}` : `${won(r.slack)} 부족`} ›
                    </span>
                  )}
                </button>
              );
            })}
            <div style={{ fontSize: 11, color: "#9AA3A0", lineHeight: 1.6, marginTop: 4 }}>
              지금 레버와 자격 답변 그대로 본 색이에요. 고르면 위 내용만 그 매물 기준으로 바뀌고, 답변은 다시 묻지 않아요.
            </div>
          </div>
        </div>
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
  return (
    <div>
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
