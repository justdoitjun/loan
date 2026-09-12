/* 은행대출 탭 — 일반 주택담보대출. 규칙은 .claude/rules/products/bank/bank.md.
   정부탭과 달리 '자격'이 거의 없다. 갈리는 건 담보(주택 보유 상태 = LTV 표의 행)와 상환능력(DSR 40%)이다.
   그래서 질문은 둘뿐이다:
     ① 주택 보유 상태  → homeCount · disposeExisting  (무주택·처분조건부 70% / 유지·다주택 0% = 닫힘)
     ② 배우자 소득     → hasSpouse · spouseBand       (DSR 소득 합산)
   정부탭과 같은 elig 한 벌을 쓴다 — 한쪽에서 답한 건 다른 쪽에서 다시 묻지 않는다.
   ⚠️ 부채는 여기서 안 묻는다(DetailInfo 한 곳). 계산은 engine(limitParts/judgeAll), 진행 상태는 person.bankSteps.
   카드는 자격보다 "무엇이 벽인가"(LTV / DSR / 지역별 한도)를 말한다 — 은행에선 그게 곧 답이다. */
import { useState } from "react";
import { REGION, REGION_LABEL, C } from "../data.js";
import { deriveFacts, judgeAll, won, eok, cashNeededOf } from "../engine.js";
import { BANK_RULES } from "../products/index.js";
import { bankSteps, withSpouse } from "../person.js";
import { Section, Placeholder, eyebrow, h1, fine, pill } from "../ui.jsx";
import { SpouseIncomeTrack, AnswersDropdown, SkippedNote } from "./shared.jsx";

const REGION_NAME = REGION_LABEL[REGION];

/* 주택 보유 상태 4버킷 = LTV 표의 행. key는 person.homeBucketOf가 돌려주는 값과 같다. */
const HOME_BUCKETS = [
  { key: "none",    label: "지금 가진 집이 없어요",              desc: "무주택 — LTV 70%로 봐요",                                    homeCount: 0, dispose: null },
  { key: "dispose", label: "집이 하나 있는데, 처분할 거예요",     desc: "처분조건부 1주택 — 무주택과 같은 70%. 처분 약정은 상담역이 확인해요", homeCount: 1, dispose: true },
  { key: "keep",    label: "집이 하나 있고, 계속 갖고 있을래요",   desc: `${REGION_NAME}에선 LTV 0% — 이 길은 닫혀요`,                   homeCount: 1, dispose: false },
  { key: "multi",   label: "집이 둘 이상 있어요",                desc: `${REGION_NAME}에선 LTV 0% — 이 길은 닫혀요`,                   homeCount: 2, dispose: null },
];

/* 접힌 요약. 접어도 '무엇으로 판정했는지'는 남긴다(정부탭과 같은 원칙). */
const answerRows = (elig, ctx, bucket) => {
  const home = HOME_BUCKETS.find((b) => b.key === bucket);
  const spouse = elig.hasSpouse === true
    ? `본인 ${won(ctx.ownIncome)}원 + 배우자 ${won(ctx.spouseIncome)}원`
    : ctx.spouseIncome > 0
      ? `본인 ${won(ctx.ownIncome)}원 + 예비배우자 ${won(ctx.spouseIncome)}원 (정부탭 답변)`
      : `본인 ${won(ctx.ownIncome)}원만`;
  return [["주택 보유", home ? home.label : "—"], ["소득", spouse]];
};

export default function Bank({ ctx, elig, setElig, onPick }) {
  const facts = deriveFacts(ctx);
  const { bucket, homeReady, open, askIncome, ready } = bankSteps(elig);

  const pickHome = (b) => setElig((s) => ({ ...s, homeCount: b.homeCount, disposeExisting: b.dispose }));
  const setHasSpouse = (v) => setElig((s) => withSpouse(s, v));
  const pickBand = (k) => setElig((s) => ({ ...s, spouseBand: k, spouseIncomeRaw: "" }));

  /* 다 채우면 접는다. editing은 화면 로컬(답이 아니라 '고치는 중'이라는 일시 상태). */
  const [editing, setEditing] = useState(false);
  if (editing && !ready) setEditing(false);
  const collapsed = ready && !editing;

  const { passed, others } = judgeAll(facts, BANK_RULES);   // 은행탭 = 은행 규칙만

  return (
    <>
      {!collapsed && (
        <>
          <div style={eyebrow}>은행 주담대</div>
          <h1 style={h1}>자격보다 담보와<br />상환능력을 봐요.</h1>
          <div style={{ borderTop: `1px solid ${C.line}`, margin: "6px 0 16px" }} />
        </>
      )}

      {ready && (
        <AnswersDropdown open={editing} onToggle={() => setEditing((e) => !e)} rows={answerRows(elig, ctx, bucket)} />
      )}

      {!collapsed && (
        <>
          {/* ① 주택 보유 상태 — 진입 게이트이자 LTV 행 */}
          <HomeChoice bucket={bucket} onPick={pickHome} />
          {homeReady && !open && <ClosedByLtv bucket={bucket} onPick={pickHome} />}

          {/* ② 배우자 소득 — DSR 합산용. 정부탭에서 이미 답했으면 그대로 보인다. */}
          {askIncome && (
            <div className="slideup">
              <div style={{ fontSize: 14, color: C.ink, fontWeight: 700, marginBottom: 8 }}>배우자 소득을 합산해서 볼까요?</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button onClick={() => setHasSpouse(true)} style={pill(elig.hasSpouse === true)}>배우자 소득 합산</button>
                <button onClick={() => setHasSpouse(false)} style={pill(elig.hasSpouse === false)}>본인 소득만</button>
              </div>
              {elig.hasSpouse === true && (
                <div className="slideup">
                  <SpouseIncomeTrack value={elig.spouseBand} onPick={pickBand} ownIncome={ctx.ownIncome} planned={false}
                    desc="합산하면 배우자 대출도 같이 넣으세요." />
                </div>
              )}
              {elig.hasSpouse === false && (
                <SkippedNote>
                  본인 소득 {won(ctx.ownIncome)}원으로만 봐요.
                </SkippedNote>
              )}
            </div>
          )}
        </>
      )}

      {open && (ready
        ? <div className="slideup"><Results ctx={ctx} passed={passed} others={others} onPick={onPick} /></div>
        : homeReady && <Section title="가능한 대출">
            <Placeholder>소득 합산을 고르면 계산해요.</Placeholder>
          </Section>)}

      <p style={fine}>상담역이 확정해요. 대출을 약속하지 않아요.</p>
    </>
  );
}

/* ── ① 주택 보유 상태 4버킷 ── 닫히는 선택지도 누를 수 있다. 눌러야 "왜 닫히는지"를 그 자리에서 볼 수 있으니까. */
function HomeChoice({ bucket, onPick }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, color: C.ink, fontWeight: 700, marginBottom: 8 }}>지금 갖고 있는 집이 있나요?</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {HOME_BUCKETS.map((b) => {
          const on = bucket === b.key;
          return (
            <button key={b.key} onClick={() => onPick(b)} aria-pressed={on}
              style={{ ...pill(on), width: "100%", textAlign: "left", padding: "11px 14px" }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{b.label}</span>
              <span style={{ display: "block", fontSize: 12, fontWeight: 500, marginTop: 2, lineHeight: 1.45, color: on ? "rgba(255,255,255,.85)" : C.inkSoft }}>{b.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* LTV 0%로 닫힌 경우 — 거절로 끝내지 않는다. 열리는 길(처분조건부)을 같이 준다(가드레일 4). */
function ClosedByLtv({ bucket, onPick }) {
  const dispose = HOME_BUCKETS.find((b) => b.key === "dispose");
  return (
    <Section title="은행 주담대가 닫혀요" tone="off">
      <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.7 }}>
        {bucket === "keep"
          ? <>처분조건이면 열려요.</>
          : <>한 채로 줄인 뒤 처분조건이면 열려요.</>}
      </div>
      {bucket === "keep" && (
        <button onClick={() => onPick(dispose)} style={{ marginTop: 10, border: "none", background: "none", padding: 0, color: C.greenDeep, fontSize: 13, fontWeight: 800, cursor: "pointer", textDecoration: "underline" }}>
          처분조건부로 볼게요 →
        </button>
      )}
    </Section>
  );
}

/* ── 결과: 은행 주담대 카드 ── "한도 / 금리 / 실행시점" 3줄 + 무엇이 벽인가. */
function Results({ ctx, passed, others, onPick }) {
  if (passed.length === 0) {
    const near = others[0];
    return (
      <Section title="지금 조건에 맞는 은행 대출이 없어요" tone="warn">
        {near && near.unmetRequires.map((r) => <div key={r.label} style={{ fontSize: 13, lineHeight: 1.6 }}>· {r.label}</div>)}
      </Section>
    );
  }
  return (
    <Section title={`가능한 대출 ${passed.length}가지`} tone="ok">
      {passed.map((p) => <BankCard key={p.key} p={p} ctx={ctx} onPick={onPick} />)}
    </Section>
  );
}

function BankCard({ p, ctx, onPick }) {
  const b = p.roughBinding;
  return (
    <button onClick={() => onPick(p.key)}
      style={{ width: "100%", textAlign: "left", marginBottom: 10, padding: "13px 15px", borderRadius: 13, cursor: "pointer", border: `1.5px solid ${C.greenDeep}`, background: "#F3F9F5" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: C.inkSoft }}>{p.title}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: C.greenDeep, fontVariantNumeric: "tabular-nums" }}>약 {eok(p.rough)}</span>
      </div>
      <div style={{ fontSize: 12, color: C.greenDeep, fontWeight: 700, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
        현금 약 {won(cashNeededOf(ctx.unit.price, p.rough))}원
      </div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 1.6 }}>
        금리 {p.rateLabel} · 실행 {p.leadTime}
      </div>
      {/* Min의 세 항을 그대로 보여준다 — 은행에선 이 표가 곧 판정 근거다 */}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.line}` }}>
        {p.roughParts.map((part) => {
          const on = part.key === b?.key;
          return (
            <div key={part.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0", color: on ? C.ink : C.inkSoft, fontWeight: on ? 800 : 500 }}>
              <span>{part.label}{on && <span style={{ color: C.amber, marginLeft: 6, fontSize: 11 }}>← 여기서 걸려요</span>}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{won(part.value)}</span>
            </div>
          );
        })}
      </div>
      {p.note && <div style={{ fontSize: 12, color: "#9AA3A0", marginTop: 4, lineHeight: 1.6 }}>{p.note}</div>}
      <div style={{ fontSize: 12, color: C.greenDeep, fontWeight: 800, marginTop: 7 }}>이걸로 볼게요 →</div>
    </button>
  );
}
