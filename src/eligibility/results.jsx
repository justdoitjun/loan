/* 결과 카드 — 자격 되는 상품 전부를 한 목록에. 하나로 좁히지 않는다(ux.md 3단계).
   카드 한 종류다. 정부/은행은 꼬리표(PRODUCTS[key].channel)일 뿐 갈림길이 아니다.
   한도 / 금리 / 실행시점 3줄 + 그 한도로 이 집에 필요한 현금. 은행(ltvFromTable)이면 LTV 행과 "무엇이 벽인가" 표를 더 적는다.
   통과 0개면 가장 근접한 것과 무엇이 얼마 모자란지(가드레일 4). ⚠️ 계산은 engine. 여기선 그리기만. */
import { PRODUCTS, CHANNEL_LABEL, REGION, LTV_TABLE, C } from "../data.js";
import { regulatoryLtv, realDemandHeadGap, won, eok, cashNeededOf } from "../engine.js";
import { Section } from "../ui.jsx";

const ROW = LTV_TABLE[REGION];
const pct = (rate) => `${Math.round(rate * 100)}%`;

export function Results({ ctx, facts, passed, others, onPick }) {
  if (passed.length === 0) return <><NoneCard others={others} ctx={ctx} />{others.length > 0 && <OthersNote others={others} />}</>;
  return (
    <>
      <Section title={`가능한 대출 ${passed.length}가지`} tone="ok">
        {passed.map((p, i) => <ProductCard key={p.key} p={p} ctx={ctx} facts={facts} best={i === 0} onPick={onPick} />)}
      </Section>
      {others.length > 0 && <OthersNote others={others} />}
    </>
  );
}

function ProductCard({ p, ctx, facts, best, onPick }) {
  const product = PRODUCTS[p.product];
  const cash = cashNeededOf(ctx.unit.price, p.rough);
  const bankLike = product.ltvFromTable === true;
  const tier = bankLike ? regulatoryLtv(facts) : null;
  const gap = bankLike ? realDemandHeadGap(facts) : null;
  return (
    <button onClick={() => onPick(p.key)}
      style={{ width: "100%", textAlign: "left", marginBottom: 10, padding: "13px 15px", borderRadius: 13, cursor: "pointer", border: `1.5px solid ${best ? C.greenDeep : C.line}`, background: best ? C.soft : "#fff", fontFamily: "inherit" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span data-fit="line" style={{ minWidth: 0, fontSize: 15, fontWeight: 800, color: C.inkSoft }}>
          <span style={{ display: "inline-block", fontSize: 10, fontWeight: 800, color: C.inkSoft, border: `1px solid ${C.lineStrong}`, borderRadius: 6, padding: "1px 5px", marginRight: 6, verticalAlign: "middle" }}>{CHANNEL_LABEL[product.channel]}</span>
          {p.title}{best && <span style={{ fontSize: 11, color: C.greenDeep, marginLeft: 6 }}>한도 최대</span>}
        </span>
        <span style={{ flex: "0 0 auto", fontSize: 15, fontWeight: 800, color: C.greenDeep, fontVariantNumeric: "tabular-nums" }}>약 {eok(p.rough)}</span>
      </div>
      <div style={{ fontSize: 12, color: C.greenDeep, fontWeight: 700, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
        필요 현금 약 {won(cash)}원
      </div>
      {/* 한도 / 금리 / 실행시점 — 정부 vs 은행을 가르는 축이라 세 줄을 늘 같이 둔다 */}
      <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 1.6 }}>
        한도 {p.limit != null ? `최대 ${won(p.limit)}` : "상품 한도 없음 · 지역별 한도"} · 금리 {p.rateLabel} · 실행 {p.leadTime}
      </div>
      {bankLike && (
        <>
          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2, lineHeight: 1.6 }}>담보 LTV {pct(tier.rate)} · {tier.label}</div>
          {gap === "unknown" && <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>무주택 세대주로 확인되면 LTV {pct(ROW.realDemand)}예요.</div>}
          {gap === "notHead" && <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>가족정보만으로는 세대주로 안 보여요. 세대주면 LTV {pct(ROW.realDemand)}예요.</div>}
          {ctx.borrowerSpouseIncome > 0 && <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>배우자 소득 합산 기준이에요. 배우자 대출도 같이 들어가요.</div>}
          {/* Min의 항을 그대로 보여준다 — 은행에선 이 표가 곧 판정 근거다("무엇이 벽인가") */}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.line}` }}>
            {p.roughParts.map((part) => {
              const on = part.key === p.roughBinding?.key;
              return (
                <div key={part.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0", color: on ? C.ink : C.inkSoft, fontWeight: on ? 800 : 500 }}>
                  <span>{part.label}{on && <span style={{ color: C.amber, marginLeft: 6, fontSize: 11 }}>← 여기서 걸려요</span>}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{won(part.value)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
      {p.note && <div style={{ fontSize: 12, color: C.faint, marginTop: 4, lineHeight: 1.6 }}>{p.note}</div>}
      <div style={{ fontSize: 12, color: C.greenDeep, fontWeight: 800, marginTop: 7 }}>이걸로 볼게요 →</div>
    </button>
  );
}

/* ── 세대주 추정에 붙는 노랑 안내 ──
   세대주를 직접 묻지 않기로 한 대가다. 추정으로 계산해놓고 확답하지 않는다(가드레일 3). */
export function SoleHouseholdNote() {
  return (
    <Section title="단독세대는 상담역이 확인해요" tone="warn">
      <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.65 }}>
        만 30세 이상 단독세대로 보고 계산했어요. 등본 구성이 다르면 기준이 바뀝니다.
      </div>
    </Section>
  );
}

export function NoHouseholdHeadNote({ age }) {
  return (
    <Section title="세대주 요건이 아직 안 잡혀요" tone="warn">
      <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.65 }}>
        만 {age}세, 부양가족 없음. 미성년 형제·직계존속을 6개월 이상 부양하면 열릴 수 있어요.
      </div>
    </Section>
  );
}

/* 통과 0종 — 거절로 끝내지 않고 "가장 근접한 것 + 무엇이 얼마 차이인지"를 보여준다. */
function NoneCard({ others, ctx }) {
  const near = others[0];
  return (
    <Section title="지금 맞는 대출은 없어요" tone="warn">
      {near && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>가장 근접: {near.title}</div>
          {near.unmetRequires.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 3 }}>자격에서 막혀요</div>
              {near.unmetRequires.map((r) => <div key={r.label} style={{ fontSize: 13, lineHeight: 1.6 }}>· {r.label}</div>)}
            </div>
          )}
          {near.failedChecks.map((c) => (
            <div key={c.key} style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 3 }}>
              · <b>{c.label}</b> {c.unit === "㎡" ? `${c.actual}㎡` : won(c.actual)}
              {" → 상한 "}{c.unit === "㎡" ? `${c.cap}㎡` : won(c.cap)}({c.tier}),
              <b style={{ color: C.amber }}> {c.unit === "㎡" ? `${c.over}㎡` : `약 ${won(c.over)}원`} 초과</b>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 12, color: C.faint, marginTop: 8 }}>
        합산소득 {won(ctx.totalIncome)}원 · 시세 {won(ctx.unit.price)}원 · 전용 {ctx.unit.areaM2}㎡
      </div>
    </Section>
  );
}

/* 안 되는 것도 왜 안 되는지 보여준다 — 숨기면 "왜 나는 안 되지"가 남는다. */
function OthersNote({ others }) {
  return (
    <Section title="안 열린 대출">
      {others.map((o) => (
        <div key={o.key} style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.7, marginBottom: 4 }}>
          <b style={{ color: C.ink }}>{o.title}</b> —{" "}
          {o.unmetRequires.length > 0
            ? o.unmetRequires.map((r) => r.label).join(", ") + " 조건"
            : o.failedChecks.map((c) => `${c.label} ${c.unit === "㎡" ? `${c.over}㎡` : won(c.over) + "원"} 초과`).join(", ")}
        </div>
      ))}
    </Section>
  );
}
