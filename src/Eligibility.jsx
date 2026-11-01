/* 자격 화면 = 스텝 컨트롤러. 자격을 묻는 유일한 입구. 정부/은행 탭은 없다 — 자격은 한 번만 받는다(ux.md 3단계).
   위→아래: 뒤로 · 매물 카드 · 실시간 요약(지금 답으로 열린 대출 N개 · 최대 약 X억 · 앞으로 M개만 더)
            · 현재 스텝 카드 하나 · 다음 · (끝나면) 입력한 조건 + 전 상품 카드.
   스텝 정의·순서·건너뛰기는 person.FLOW / flowOf 한 곳. 여기는 key로 카드를 고르고 cursor(어느 스텝을 보는지)만 든다.
   요약은 부분 입력 그대로 judgeAll을 돌린다 — 안 답한 조건은 거짓이라 "아직 안 열림". 답할수록 올라간다.
   프로그레스 바는 쓰지 않는다. 뒤(Strategy)에서 자격을 다시 묻지 않는다. */
import { useState } from "react";
import { SPOUSE_INCOME_BANDS, NO_HOME_EXCEPTION, C } from "./data.js";
import { buildCtx, deriveFacts, judgeAll, nearIncomeCap, won, eok } from "./engine.js";
import { flowOf, bucketOf, withSpouse, withHomeCount } from "./person.js";
import { BackButton, card, eyebrow, fine, inputBox, primaryBtn, useTween } from "./ui.jsx";
import { FamilyCard } from "./eligibility/family.jsx";
import { YesNo, SpouseIncomeTrack, SkippedNote, MARITAL_BUCKETS, MaritalChoice, HOME_BUCKETS, HomeChoice, ClosedByLtv, AnswerList } from "./eligibility/questions.jsx";
import { Results, SoleHouseholdNote, NoHouseholdHeadNote } from "./eligibility/results.jsx";

export default function Eligibility({ unit, ownIncome, elig, setElig, onBack, onPick }) {
  const ctx = buildCtx({ unit, ownIncome, elig });
  const facts = deriveFacts(ctx);
  const flow = flowOf(elig);
  const { steps, firstOpen, remaining, ready, closed, bucket } = flow;

  /* cursor = 보고 있는 스텝. 다 답했으면 결과(= steps.length). 답에 따라 스텝이 줄면 clamp. */
  const [cursor, setCursor] = useState(() => (firstOpen === -1 ? steps.length : firstOpen));
  const at = Math.min(cursor, steps.length);
  const wantResult = at >= steps.length;
  /* 결과는 다 답했거나(ready) 닫혔을 때만. 그 밖에 끝에 와 있으면 첫 미완 스텝을 보여준다. */
  const idx = wantResult ? (ready || closed ? null : firstOpen) : at;
  const step = idx === null ? null : steps[idx];

  const set = (k, v) => setElig((s) => ({ ...s, [k]: v }));
  const setHasSpouse = (v) => setElig((s) => withSpouse(s, v));
  const pickHome = (b) => setElig((s) => ({ ...withHomeCount(s, b.homeCount), disposeExisting: b.dispose }));
  const pickBucket = (b) => setElig((s) => ({ ...s, marital: b.marital, marriedWithin7: b.within7 }));
  const pickBand = (k) => setElig((s) => ({ ...s, spouseBand: k, spouseIncomeRaw: "" }));
  const jump = (key) => { const i = steps.findIndex((s) => s.key === key); setCursor(i === -1 ? 0 : i); };

  /* 실시간 요약 — 전 상품. 부분 입력이어도 돌아간다. */
  const { all, passed, others } = judgeAll(facts);
  const shownCount = useTween(passed.length, 280);
  const best = passed[0]?.rough ?? 0;
  const shownBest = useTween(best, 320);

  const spouseCounted = elig.hasSpouse === true || elig.marital === "planned";
  const onEdge = spouseCounted && elig.spouseBand !== null && nearIncomeCap(all, ctx.totalIncome);
  const showPrecise = onEdge || elig.spouseIncomeRaw !== "";

  const canNext = step ? step.done(elig) : false;
  const isLast = step ? idx === steps.length - 1 : false;
  /* 결과 화면의 뒤로 = 매물목록. 답을 고치는 길은 '입력한 조건' 목록이다. */
  const goBack = () => { if (step === null || idx === 0) onBack(); else setCursor(idx - 1); };
  const goNext = () => { if (canNext) setCursor(idx + 1); };

  return (
    <div className="slideup">
      <BackButton onClick={goBack}>{step === null || idx === 0 ? "매물목록으로" : "뒤로"}</BackButton>

      <div style={{ ...card, padding: "12px 16px", marginBottom: 12 }}>
        <div data-fit="line" style={{ fontSize: 15, fontWeight: 800 }}>{unit.name}</div>
        <div data-fit="line" style={{ fontSize: 12, color: C.inkSoft }}>{won(unit.price)}원 · 전용 {unit.areaM2}㎡ · 소득 {won(ownIncome)}원</div>
      </div>

      {/* 실시간 요약 — 진행률이 아니라 진전. 답할 때마다 즉시 갱신 */}
      <div className="elig-sum" aria-live="polite" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, padding: "10px 2px 12px", borderBottom: `1px solid ${C.line}`, marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={eyebrow}>지금 답으로</div>
          <div data-fit="line" style={{ fontSize: 17, fontWeight: 800, color: C.ink, lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }}>
            열린 대출 <span style={{ color: C.greenDeep, fontSize: 24 }}>{Math.round(shownCount)}</span>개
            {best > 0 && <span style={{ color: C.inkSoft, fontWeight: 700, fontSize: 13 }}> · 최대 약 {eok(shownBest)}</span>}
          </div>
        </div>
        <div data-fit="line" style={{ flex: "0 0 auto", fontSize: 12, fontWeight: 700, color: C.inkSoft, textAlign: "right" }}>
          {closed ? "처분조건부면 열려요" : remaining > 0 ? `앞으로 ${remaining}개만 더` : "다 답했어요"}
        </div>
      </div>

      {step && (
        <div key={step.key} className="slideup">
          {step.key === "family" && (
            <FamilyCard elig={elig} set={set} setHasSpouse={setHasSpouse} facts={facts} ready={step.done(elig)} />
          )}
          {step.key === "home" && (
            <>
              <HomeChoice bucket={bucket} onPick={pickHome} />
              <p style={{ ...fine, marginTop: 0, whiteSpace: "pre-line" }} data-fit="prose">{NO_HOME_EXCEPTION}</p>
              {closed && <ClosedByLtv bucket={bucket} onPick={pickHome} />}
            </>
          )}
          {step.key === "firstTime" && (
            <YesNo label="생애 처음으로 집을 사시는 건가요?" desc="한 번도 집을 소유한 적이 없으면 네. 지금 없는 것과는 다른 질문이에요."
              value={elig.firstTime} onPick={(v) => set("firstTime", v)} />
          )}
          {step.key === "marital" && (
            <MaritalChoice bucket={bucketOf(elig)} hasSpouse={elig.hasSpouse === true} onPick={pickBucket} />
          )}
          {step.key === "income" && (
            <>
              <SkippedNote>본인 소득은 홈에서 고른 <b>{won(ownIncome)}원</b>으로 봐요. 바꾸려면 매물목록으로 돌아가 슬라이더를 움직이세요.</SkippedNote>
              <SpouseIncomeTrack value={elig.spouseBand} onPick={pickBand} ownIncome={ownIncome} planned={elig.marital === "planned"} />
              {showPrecise && (
                <div className="slideup" style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 12, background: C.softer, border: `1px solid ${C.line}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.greenDeep, marginBottom: 4 }}>소득상한 경계</div>
                  <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.55, marginBottom: 8 }}>정확한 금액을 넣으면 더 좁혀요.</div>
                  <input type="number" inputMode="numeric" placeholder="예: 4000" value={elig.spouseIncomeRaw} onChange={(e) => set("spouseIncomeRaw", e.target.value)} style={inputBox} />
                </div>
              )}
            </>
          )}
          {step.key === "dream" && (
            <YesNo label="혹시, 청년 주택드림 청약통장으로 당첨된 건인가요?" desc="통장 연계가 전제인 대출이 하나 있어서 여쭤봐요."
              value={elig.hasDreamAccount} onPick={(v) => set("hasDreamAccount", v)} yes="예" no="아니오·해당없음" />
          )}

          <button type="button" onClick={goNext} disabled={!canNext}
            style={{ ...primaryBtn, marginTop: 6, opacity: canNext ? 1 : 0.4, cursor: canNext ? "pointer" : "not-allowed" }}>
            {/* 답하기 전엔 늘 "다음" — 답에 따라 뒤 스텝이 더 생길 수 있어서 미리 "결과"라 하지 않는다 */}
            {canNext && (closed || isLast) ? "결과 보기" : "다음"}
          </button>
        </div>
      )}

      {step === null && (
        <div className="slideup">
          <AnswerList rows={answerRows(elig, facts, ownIncome, steps)} onJump={jump} />
          {closed
            ? <ClosedByLtv bucket={bucket} onPick={(b) => { pickHome(b); }} />
            : <>
                {facts.noHome && facts.adult30SoleSingle && <SoleHouseholdNote />}
                {facts.noHome && !facts.householdHead && <NoHouseholdHeadNote age={facts.age} />}
                <Results ctx={ctx} facts={facts} passed={passed} others={others} onPick={onPick} />
              </>}
        </div>
      )}

      <p style={fine}>대략적인 전략을 짜면, 전문가가 확인해드려요.</p>
    </div>
  );
}

/* 입력한 조건 — 보이는 스텝만, 그 스텝의 답으로. 무엇으로 판정했는지 숨기지 않는다. */
function answerRows(elig, facts, ownIncome, steps) {
  const counted = elig.hasSpouse === true || elig.marital === "planned";
  const who = elig.hasSpouse === true ? "배우자" : "예비배우자";
  const band = SPOUSE_INCOME_BANDS.find((b) => b.key === elig.spouseBand);
  const spouse = elig.spouseIncomeRaw !== "" ? `${won(Number(elig.spouseIncomeRaw))}원` : band ? band.label : "—";
  const home = HOME_BUCKETS.find((b) => b.key === (elig.homeCount === null ? null : (elig.homeCount === 0 ? "none" : elig.homeCount >= 2 ? "multi" : elig.disposeExisting === true ? "dispose" : elig.disposeExisting === false ? "keep" : null)));
  const marital = MARITAL_BUCKETS.find((b) => b.key === bucketOf(elig));
  const text = {
    family: `만 ${facts.age}세 · ${counted ? `${who} 있음` : "배우자 없음"} · 자녀 ${elig.birthdays.length}명${facts.minors > 0 ? ` (미성년 ${facts.minors}명)` : ""}`,
    home: home ? home.label : "—",
    firstTime: elig.firstTime ? "네" : "아니오",
    marital: marital ? marital.label : "—",
    income: counted ? `본인 ${won(ownIncome)}원 + ${who} ${spouse}` : `본인 ${won(ownIncome)}원만`,
    dream: elig.hasDreamAccount ? "당첨됐어요" : "해당 없음",
  };
  const label = { family: "가족", home: "주택 보유", firstTime: "생애최초", marital: "결혼", income: "소득", dream: "청년 주택드림" };
  return steps.map((s) => ({ key: s.key, label: label[s.key], value: text[s.key] }));
}
