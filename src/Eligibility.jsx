/* 자격 조건 입력 + 가능한 상품 목록 — 한 화면.
   이 앱에서 자격을 묻는 곳은 여기 하나다. 뒤(Strategy)에서 다시 묻지 않는다.

   이 화면의 산출물 = "가능한 상품 목록". 부채는 여기서 묻지 않는다
   — 자격은 소득상한 위/아래로 갈리지 부채로 갈리지 않으니까.
   그래서 목록이 부채 입력 '전에' 뜨고, 그 자체가 리빌이 된다.

   ⚠️ 가능한 걸 하나로 좁히지 않는다. 조건이 되는 건 전부 카드로 보여준다. */
import { SPOUSE_INCOME_BANDS, NO_HOME_EXCEPTION, TABS, C } from "./data.js";
import { buildCtx, deriveFacts, judgeAll, nearIncomeCap, ageOf, won, eok } from "./engine.js";
import { BackButton, Choice, Section, ClosedCard, Placeholder, eyebrow, h1, card, fine, inputBox, pill } from "./ui.jsx";

/* 자격 답변의 빈 상태. App이 최상위 state로 들고 있고 여기서만 채운다. */
export const EMPTY_ELIG = {
  ownBirthday: "",        // 본인 생년월일 (만30세 단독세대주 / 만39세 이하 판정)
  homeCount: null,        // 보유 주택 수 — 무주택(0)이 기금 진입 게이트
  birthdays: [],          // 자녀 생년월일 (미성년 수 · 신생아 특례) — 혼인상태 전에 받음
  marital: null,          // "single" (미혼/이혼) | "married" | "planned"
  marriedDate: "",        // 기혼일 때만
  weddingDate: "",        // 결혼예정일 때만
  spouseBand: null,       // SPOUSE_INCOME_BANDS의 key (기혼만)
  spouseIncomeRaw: "",    // 소득상한 경계일 때만 받는 정밀값(만원)
  householdType: null,    // 미혼일 때만: "alone" | "withDependent" | "notHeadOfHouse"
  hasMiniDependents: null, // householdType === "withDependent" 또는 (미혼 && 30살 미만)일 때: 함께 사는 미성년자 있나요?
  firstTime: null,        // 생애최초 무주택
  hasDreamAccount: null,  // 주택드림 통장 (해당자만)
};

export default function Eligibility({ unit, cash, ownIncome, kind, setKind, elig, setElig, onBack, onPick }) {
  const set = (k, v) => setElig((s) => ({ ...s, [k]: v }));
  const ctx = buildCtx({ unit, cash, ownIncome, elig });

  const gateOpen = elig.homeCount === 0;
  const ageNow = ageOf(elig.ownBirthday);
  const childrenFilled = elig.birthdays.every((d) => ageOf(d) !== null);

  // Stage 1: 나이 → 무주택 확인
  const stage1 = elig.ownBirthday !== "" && gateOpen;

  // Stage 2: 자녀 정보
  const stage2 = stage1 && childrenFilled;

  // Stage 3: 혼인상태 · 배우자 소득
  const maritalReady =
    elig.marital === "single" ||
    (elig.marital === "married" && elig.marriedDate !== "") ||
    (elig.marital === "planned" );

    // (elig.marital === "planned" && elig.weddingDate !== "");
  const spouseSkipped = elig.marital === "single";
  const spouseReady = spouseSkipped || elig.spouseBand !== null;
  const stage3 = stage2 && maritalReady && spouseReady;

  // Stage 4: 세대 구성 (미혼만) + notHeadOfHouse는 자격 불가
  const isSingle = elig.marital === "single";
  const householdTypeReady = !isSingle || elig.householdType !== null;
  const isNotHeadOfHouse = isSingle && elig.householdType === "notHeadOfHouse";
  const stage4 = stage3 && householdTypeReady && !isNotHeadOfHouse;

  // Stage 5: 함께 사는 미성년자 여부 (미혼 + 30살 미만 || householdType="withDependent"일 때만)
  const isUnder30 = ageNow !== null && ageNow < 30;
  const needsMiniDependentsQuestion = isSingle && (isUnder30 || elig.householdType === "withDependent");
  const miniDependentsReady = !needsMiniDependentsQuestion || elig.hasMiniDependents !== null;
  const stage5 = stage4 && miniDependentsReady;

  // 최종 준비
  const ready = stage5 && elig.firstTime !== null && elig.hasDreamAccount !== null;

  /* 경계 판정은 지금 답만으로 한 판정 결과를 근거로 한다(밴드 대표값 기준).
     이미 정밀값을 넣었으면 상한이 움직여도 칸을 닫지 않는다 — 입력값 유실 방지. */
  const { all, passed, others } = judgeAll(deriveFacts(ctx));
  const onEdge = !spouseSkipped && elig.spouseBand !== null && nearIncomeCap(all, ctx.totalIncome);
  const showPrecise = onEdge || elig.spouseIncomeRaw !== "";

  const pickBand = (k) => setElig((s) => ({ ...s, spouseBand: k, spouseIncomeRaw: "" })); // 밴드 바뀌면 정밀값 무효

  return (
    <div className="slideup">
      <BackButton onClick={onBack}>매물목록으로</BackButton>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setKind(t.key)} style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", border: `1.5px solid ${kind === t.key ? C.greenDeep : C.line}`, background: kind === t.key ? C.greenDeep : "#fff", color: kind === t.key ? "#fff" : C.ink }}>{t.label}상품</button>
        ))}
      </div>

      <div style={{ ...card, padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{unit.name}</div>
        <div style={{ fontSize: 12, color: C.inkSoft }}>{won(unit.price)}원 · 전용 {unit.areaM2}㎡ · 필요 대출 약 {won(ctx.needed)}원</div>
      </div>

      {kind === "bank" ? (
        <div style={{ ...card, color: C.inkSoft, fontSize: 14, lineHeight: 1.6 }}>은행상품 로직은 곧 준비할게요. 지금은 정부상품 탭을 먼저 만들었어요.</div>
      ) : (
        <>
          <div style={eyebrow}>자격 조건</div>
          <h1 style={h1}>지금은 어떤 상태인가요?</h1>

          <div style={{ borderTop: `1px solid ${C.line}`, margin: "6px 0 16px" }} />

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600, marginBottom: 5 }}>본인 생일이 언제인가요?</div>
            <input type="date" value={elig.ownBirthday} onChange={(e) => set("ownBirthday", e.target.value)} style={inputBox} />
          </div>

          <Choice label="보유 주택 수 (부부합산)" options={[["무주택", 0], ["1주택", 1], ["2주택+", 2]]} value={elig.homeCount} onPick={(v) => set("homeCount", v)} />

          {elig.homeCount !== null && !gateOpen ? <ClosedCard exception={NO_HOME_EXCEPTION} /> : null}

          {stage1 && (
            <div className="slideup">
              <ChildDates birthdays={elig.birthdays} setBirthdays={(v) => set("birthdays", v)} />
            </div>
          )}

          {stage2 && (
            <div className="slideup">
              <MaritalChoice elig={elig} set={set} />
              {maritalReady && (spouseSkipped
                ? <SkippedNote>미혼이라 배우자 소득은 묻지 않아요. 본인 소득 {won(ownIncome)}원으로만 봐요.</SkippedNote>
                : <SpouseIncomeChoice value={elig.spouseBand} onPick={pickBand} />)}
              {showPrecise && (
                <div className="slideup" style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 12, background: "#F7FAF7", border: `1px solid ${C.line}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.greenDeep, marginBottom: 4 }}>소득상한 경계에 걸쳐 있어요</div>
                  <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.55, marginBottom: 8 }}>이 구간은 상한을 넘느냐 마느냐로 가능한 상품 자체가 갈려요. 배우자 세전 연소득을 정확히 넣으면 더 좁혀서 보여드릴게요. 비워두면 구간 대표값으로 계산해요.</div>
                  <input type="number" inputMode="numeric" placeholder="예: 4000" value={elig.spouseIncomeRaw} onChange={(e) => set("spouseIncomeRaw", e.target.value)} style={inputBox} />
                </div>
              )}
            </div>
          )}

          {stage3 && isSingle && (
            <div className="slideup">
              <HouseholdChoice elig={elig} set={set} />
            </div>
          )}

          {isNotHeadOfHouse && (
            <div className="slideup">
              <ClosedCard exception="아쉽게도, 디딤돌은 세대주만 허용해요. 3개월 이내에 결혼을 하시거나, 등본 상 세대주를 바꾸면 가능해요!" />
            </div>
          )}

          {stage4 && needsMiniDependentsQuestion && (
            <div className="slideup">
              <Choice label="혹시, 같이 사는 사람 중에 자녀나 미성년 형제가 있나요?"
                options={[["네", true], ["아니오", false]]} value={elig.hasMiniDependents} onPick={(v) => set("hasMiniDependents", v)} />
              {elig.hasMiniDependents === true && (
                <SkippedNote>같이 산지 6개월이 넘었다면, 디딤돌 자격이 되어요.</SkippedNote>
              )}
            </div>
          )}

          {stage5 && (
            <div className="slideup">
              <div style={{ paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
                <Choice label="주택드림 청약통장으로 당첨된 건인가요? (해당자만)"
                  options={[["예", true], ["아니오·해당없음", false]]} value={elig.hasDreamAccount} onPick={(v) => set("hasDreamAccount", v)} />
              </div>

              <Choice label="생애최초로 집을 사시나요? (부부 모두 주택 취득 이력 없음)"
              options={[["예", true], ["아니오", false]]} value={elig.firstTime} onPick={(v) => set("firstTime", v)} />
            </div>
          )}

          {gateOpen && (ready
            ? <Results ctx={ctx} passed={passed} others={others} onPick={onPick} />
            : stage5 && <Section title="가능한 상품" subtitle="위 항목을 채우면 바로 판정해 드려요.">
                <Placeholder>생애최초·세대구성·생년월일·자녀가 채워지면 <b>조건이 되는 상품을 전부</b> 보여드려요. 하나로 좁히지 않아요.</Placeholder>
              </Section>)}

          <p style={fine}>※ 자격 상한·한도 숫자는 전부 가상 예시예요. 실제 규정 값으로 교체 예정. 여기 넣은 값은 이 화면 밖으로 나가지 않아요. 대출 가부는 상담역이 확정하며, 이 화면은 대출을 약속하지 않아요.</p>
        </>
      )}
    </div>
  );
}

/* ── 결과: 가능한 상품 목록 (이 화면의 산출물) ── */
function Results({ ctx, passed, others, onPick }) {
  if (passed.length === 0) return <><NoneCard others={others} ctx={ctx} />{others.length > 0 && <OthersNote others={others} />}</>;
  return (
    <>
      <Section title={`가능한 상품 ${passed.length}가지`} subtitle="하나로 좁히지 않았어요. 조건이 되는 건 전부입니다. 대략 한도 높은 순." tone="ok">
        {passed.map((p, i) => <ProductCard key={p.key} p={p} ctx={ctx} best={i === 0} onPick={onPick} />)}
        <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>
          여기 한도는 <b>기존 대출을 0으로 둔 천장</b>이에요. 하나를 고르면 다음 화면에서 부채·소득을 받아 구체적으로 좁혀드려요.
        </div>
      </Section>
      {others.length > 0 && <OthersNote others={others} />}
    </>
  );
}

function ProductCard({ p, ctx, best, onPick }) {
  return (
    <button onClick={() => onPick(p.key)}
      style={{ width: "100%", textAlign: "left", marginBottom: 10, padding: "13px 15px", borderRadius: 13, cursor: "pointer", border: `1.5px solid ${best ? C.greenDeep : C.line}`, background: best ? "#F3F9F5" : "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: C.inkSoft }}>
          {p.title}{best && <span style={{ fontSize: 11, color: C.greenDeep, marginLeft: 6 }}>한도 최대</span>}
        </span>
        <span style={{ fontSize: 15, fontWeight: 800, color: C.greenDeep, fontVariantNumeric: "tabular-nums" }}>약 {eok(p.rough)}</span>
      </div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 1.6 }}>
        금리 {p.rateLabel} · 실행 {p.leadTime} · 경로 최대 {won(p.limit)}
      </div>
      <div style={{ fontSize: 12, color: C.greenDeep, marginTop: 4, lineHeight: 1.6 }}>
        → 합산소득 {won(ctx.totalIncome)} ≤ 상한 {won(p.income.value)}({p.income.label}), 시세 {won(ctx.unit.price)} ≤ 상한 {won(p.price.value)}({p.price.label})라 열려요.
      </div>
      {p.note && <div style={{ fontSize: 12, color: "#9AA3A0", marginTop: 4, lineHeight: 1.6 }}>{p.note}</div>}
      <div style={{ fontSize: 12, color: C.greenDeep, fontWeight: 800, marginTop: 7 }}>이걸로 전략 보기 →</div>
    </button>
  );
}

/* 통과 0종 — 거절로 끝내지 않고 "가장 근접한 것 + 무엇이 얼마 차이인지"를 보여준다. */
function NoneCard({ others, ctx }) {
  const near = others[0];
  return (
    <Section title="지금 조건에 딱 맞는 상품은 없어요" subtitle="하지만 여기서 끝이 아니에요. 가장 가까운 경로를 짚어드릴게요." tone="warn">
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
      <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.65, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
        자격 요건에서 막혔다면 시점 문제일 수 있어요 — 혼인신고일, 자녀 출생일, 세대 구성이 곧 바뀌는지 상담역과 짚어보세요. 소득·시세가 조금 넘은 경우라면 은행상품 탭의 일반 주담대가 먼저 열릴 가능성이 있어요.
      </div>
      <div style={{ fontSize: 12, color: "#9AA3A0", marginTop: 8 }}>
        판정 기준: 합산소득 {won(ctx.totalIncome)}원 · 시세 {won(ctx.unit.price)}원 · 전용 {ctx.unit.areaM2}㎡ · 무주택
      </div>
    </Section>
  );
}

/* 안 되는 것도 왜 안 되는지 보여준다 — 숨기면 "왜 나는 안 되지"가 남는다. */
function OthersNote({ others }) {
  return (
    <Section title="같이 본 것들" subtitle="아래는 지금 조건에선 안 열렸어요. 이유만 짧게 남겨둘게요.">
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

/* ── 질문 조각들 ── */
function MaritalChoice({ elig, set }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600, marginBottom: 7 }}>혼인상태</div>
      <div style={{ display: "flex", gap: 8 }}>
        {[["미혼", "single"], ["기혼", "married"], ["결혼예정(3개월 내)", "planned"]].map(([t, v]) => (
          <button key={v} onClick={() => set("marital", v)} style={pill(elig.marital === v)}>{t}</button>
        ))}
      </div>
      {elig.marital === "married" && (
        <div className="slideup" style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 4 }}>혼인신고는 언제 하셨나요? (7년 이내면 신혼으로 봐요)</div>
          <input type="date" value={elig.marriedDate} onChange={(e) => set("marriedDate", e.target.value)} style={inputBox} />
        </div>
      )}
      {elig.marital === "planned" 
      // && (
      //   <div className="slideup" style={{ marginTop: 8 }}>
      //     <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 4 }}>결혼 예정일 (3개월 이내면 신혼으로 봐요)</div>
      //     <input type="date" value={elig.weddingDate} onChange={(e) => set("weddingDate", e.target.value)} style={inputBox} />
      //   </div>
      // )
      }
    </div>
  );
}

function SpouseIncomeChoice({ value, onPick }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600, marginBottom: 3 }}>배우자 세전 연소득은 얼마인가요?</div>
      <div style={{ fontSize: 12, color: "#9AA3A0", marginBottom: 7, lineHeight: 1.5 }}>본인 소득은 앞 예산 화면에서 이미 받았어요. 여기선 배우자 몫만 고르면 돼요. (단위: 만원 · 세전)</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {SPOUSE_INCOME_BANDS.map((b) => <button key={b.key} onClick={() => onPick(b.key)} style={pill(value === b.key)}>{b.label}</button>)}
      </div>
    </div>
  );
}

function HouseholdChoice({ elig, set }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600, marginBottom: 7 }}>세대 구성</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[["혼자 사는 세대주", "alone"], ["세대주인데, 같이 사는 사람이 있어요", "withDependent"], ["세대원이에요", "notHeadOfHouse"]].map(([t, v]) => (
          <button key={v} onClick={() => set("householdType", v)} style={{ ...pill(elig.householdType === v), width: "100%" }}>{t}</button>
        ))}
      </div>
    </div>
  );
}

function ChildDates({ birthdays, setBirthdays }) {
  const setCount = (n) => { const next = birthdays.slice(0, n); while (next.length < n) next.push(""); setBirthdays(next); };
  const setOne = (i, v) => { const next = [...birthdays]; next[i] = v; setBirthdays(next); };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600, marginBottom: 7 }}>아이가 몇 명인가요?</div>
      <div style={{ display: "flex", gap: 8 }}>
        {[0, 1, 2, 3].map((n) => <button key={n} onClick={() => setCount(n)} style={pill(birthdays.length === n)}>{n === 3 ? "3+" : n}</button>)}
      </div>
      {birthdays.length > 0 && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {birthdays.map((d, i) => (
            <div key={i}>
              <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 4 }}>{i + 1}번째 아이 생년월일</div>
              <input type="date" value={d} onChange={(e) => setOne(i, e.target.value)} style={inputBox} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* 답에 따라 건너뛴 질문은 조용히 지우지 않고 "왜 안 물었는지"를 남긴다. */
function SkippedNote({ children }) {
  return <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6, marginBottom: 14, padding: "9px 12px", borderRadius: 10, background: "#F7FAF7", border: `1px dashed ${C.line}` }}>{children}</div>;
}
