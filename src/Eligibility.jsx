/* 자격 조건 입력 + 가능한 상품 목록 — 한 화면.
   이 앱에서 자격을 묻는 곳은 여기 하나다. 뒤(Strategy)에서 다시 묻지 않는다.

   이 화면의 산출물 = "가능한 상품 목록". 부채는 여기서 묻지 않는다
   — 자격은 소득상한 위/아래로 갈리지 부채로 갈리지 않으니까.
   그래서 목록이 부채 입력 '전에' 뜨고, 그 자체가 리빌이 된다.

   ⚠️ 가능한 걸 하나로 좁히지 않는다. 조건이 되는 건 전부 카드로 보여준다.

   질문 구성 (이 순서 = 화면 순서):
     1) 가족정보 카드 하나 — 본인/배우자/자녀 생년월일. 나이·배우자유무·자녀수·미성년·신생아를 전부 여기서 파생
     2) 무주택 (네/아니오)        — 기금 진입 게이트
     3) 생애최초 (네/아니오)      — 무주택과 다른 개념이라 따로 묻는다
     4) 결혼여부 4버킷            — 예정 / 신혼(7년 이내) / 7년 초과 / 배우자 없음
     5) 배우자 소득 밴드 트랙      — 배우자 없으면 항목 자체를 숨긴다
     6) 청년 주택드림             — 만39세 이하에게만
   ⚠️ 세대주는 묻지 않는다. 가족정보로 '후보'만 추정하고, 결과에 노랑(상담역 확인)을 붙인다. */
import { SPOUSE_INCOME_BANDS, NO_HOME_EXCEPTION, TABS, C } from "./data.js";
import { buildCtx, deriveFacts, judgeAll, nearIncomeCap, ageOf, won, eok } from "./engine.js";
import { BackButton, Section, ClosedCard, Placeholder, eyebrow, h1, card, fine, inputBox, pill } from "./ui.jsx";

/* 자격 답변의 빈 상태. App이 최상위 state로 들고 있고 여기서만 채운다.
   ⚠️ 필드 이름은 engine.deriveFacts가 읽는 이름이다. 바꾸려면 거기도 같이 본다. */
export const EMPTY_ELIG = {
  /* ── 1) 가족정보 카드 — 이 셋이 나이·배우자유무·자녀수·미성년·신생아를 전부 만든다 ── */
  ownBirthday: "",        // 본인 생년월일 → 만나이(단독세대주 후보 / 만39세 이하 판정)
  hasSpouse: null,        // true | false — "배우자 없음" 토글. false면 배우자 생년월일·소득을 안 묻는다
  spouseBirthday: "",     // 배우자 생년월일. ⚠️ 지금 판정 규칙이 쓰는 값은 아니다(가구 확인용·향후 우대 대비)
  birthdays: [],          // 자녀 생년월일 — 0명부터 동적 추가/삭제

  /* ── 2~4) 단일 질문 ── */
  homeCount: null,        // 0 = 무주택(진입 게이트). 화면은 네/아니오지만 엔진이 읽는 형식은 그대로 둔다
  firstTime: null,        // 생애최초 — "한 번도 소유한 적 없다". 무주택("지금 없다")과 다른 개념
  marital: null,          // "married" | "planned" | "single"  ← 4버킷이 이 둘로 매핑된다
  marriedWithin7: null,   // marital="married"일 때만: 혼인신고 7년 이내면 true → 신혼가구
  marriedDate: "",        // 이 화면에선 안 받는다(버킷으로 대체). 정밀 확인이 필요해지면 여기에 채운다
  weddingDate: "",        // 결혼예정 3개월 이내 판정용 — 추후 세부 확인 단계에서 받는다

  /* ── 5) 소득 ── */
  spouseBand: null,       // SPOUSE_INCOME_BANDS의 key (배우자 있을 때만)
  spouseIncomeRaw: "",    // 소득상한 경계일 때만 받는 정밀값(만원)

  /* ── 6) 그 외 ── */
  hasDreamAccount: null,  // 청년 주택드림 통장 (만39세 이하에게만 묻는다)
};

/* 결혼여부 4버킷 → 엔진이 읽는 (marital, marriedWithin7) 조합.
   ⚠️ "신혼(7년 이내)" 버킷이 빠지면 실제 신혼부부를 못 잡아 소득상한·한도가 낮게 오판정된다. */
const MARITAL_BUCKETS = [
  { key: "planned", label: "곧 할 거예요",             desc: "결혼예정 — 3개월 이내인지는 상담 때 정확히 확인해요", marital: "planned", within7: null,  needsSpouse: false },
  { key: "new7",    label: "혼인신고한 지 7년 안 됐어요", desc: "신혼가구 — 소득상한과 한도가 같이 올라가요",         marital: "married", within7: true,  needsSpouse: true },
  { key: "over7",   label: "혼인신고한 지 7년 넘었어요", desc: "결혼했지만 신혼 기준에선 벗어나요",                 marital: "married", within7: false, needsSpouse: true },
  { key: "none",    label: "배우자가 없어요",           desc: "미혼·이혼·사별 모두 포함해요",                     marital: "single",  within7: null,  needsSpouse: false },
];

const bucketOf = (elig) => {
  if (elig.marital === "single") return "none";
  if (elig.marital === "planned") return "planned";
  if (elig.marital === "married") return elig.marriedWithin7 === true ? "new7" : elig.marriedWithin7 === false ? "over7" : null;
  return null;
};

/* 미래 날짜·빈칸을 걸러낸다. 아이 생년월일이 내일이면 나이가 음수가 되는데, 그걸 '입력 완료'로 보면 안 된다. */
const filledAge = (d) => { const a = ageOf(d); return a !== null && a >= 0 ? a : null; };

export default function Eligibility({ unit, cash, ownIncome, kind, setKind, elig, setElig, onBack, onPick }) {
  const set = (k, v) => setElig((s) => ({ ...s, [k]: v }));
  const ctx = buildCtx({ unit, cash, ownIncome, elig });
  const facts = deriveFacts(ctx);

  const gateOpen = elig.homeCount === 0;
  const hasSpouse = elig.hasSpouse === true;

  /* 배우자 토글은 뒤 질문들과 모순을 만들 수 있다 → 바뀌는 순간 어긋난 답만 조용히 비운다.
     (경고를 띄우고 사용자에게 치우게 하는 것보다, 애초에 모순이 못 남게 하는 쪽) */
  const setHasSpouse = (v) => setElig((s) => {
    const next = { ...s, hasSpouse: v };
    if (v === false) {
      next.spouseBirthday = ""; next.spouseBand = null; next.spouseIncomeRaw = "";
      if (s.marital === "married") { next.marital = null; next.marriedWithin7 = null; }
    } else if (s.marital === "single") { next.marital = null; next.marriedWithin7 = null; }
    return next;
  });

  const pickBucket = (b) => setElig((s) => ({ ...s, marital: b.marital, marriedWithin7: b.within7 }));
  const pickBand = (k) => setElig((s) => ({ ...s, spouseBand: k, spouseIncomeRaw: "" })); // 밴드 바뀌면 정밀값 무효

  /* ── 단계 (답에 따라 불필요한 질문은 건너뛴다) ── */
  // 1) 가족정보: 배우자 생년월일은 판정에 안 쓰므로 진행을 막지 않는다 — 비워도 다음으로 간다.
  const childrenFilled = elig.birthdays.every((d) => filledAge(d) !== null);
  const familyReady = filledAge(elig.ownBirthday) !== null && elig.hasSpouse !== null && childrenFilled;
  // 2) 무주택 게이트 → 3) 생애최초 → 4) 결혼여부
  const askFirstTime = familyReady && gateOpen;
  const askMarital = askFirstTime && elig.firstTime !== null;
  const maritalReady = bucketOf(elig) !== null;
  // 5) 소득 — 배우자 없으면 항목 자체를 숨긴다
  const askIncome = askMarital && maritalReady;
  const incomeReady = !hasSpouse || elig.spouseBand !== null;
  // 6) 청년 주택드림 — 만39세 이하에게만 묻는다(40대에겐 어차피 안 열리는 경로)
  const needsDream = facts.under39;
  const dreamReady = !needsDream || elig.hasDreamAccount !== null;

  const ready = askIncome && incomeReady && dreamReady;

  /* 경계 판정은 지금 답만으로 한 판정 결과를 근거로 한다(밴드 대표값 기준).
     이미 정밀값을 넣었으면 상한이 움직여도 칸을 닫지 않는다 — 입력값 유실 방지. */
  const { all, passed, others } = judgeAll(facts);
  const onEdge = hasSpouse && elig.spouseBand !== null && nearIncomeCap(all, ctx.totalIncome);
  const showPrecise = onEdge || elig.spouseIncomeRaw !== "";

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

          {/* 1) 가족정보 — 카드 하나 */}
          <FamilyCard elig={elig} set={set} setHasSpouse={setHasSpouse} facts={facts} ready={familyReady} />

          {/* 2) 무주택 — 진입 게이트 */}
          {familyReady && (
            <div className="slideup">
              <YesNo label="지금 가진 집이 없나요?"
                desc="같이 살려고 하는 가족들은 모두 무주택이어야 해요."
                value={elig.homeCount === null ? null : gateOpen}
                onPick={(v) => set("homeCount", v ? 0 : 1)} />
              {elig.homeCount !== null && !gateOpen ? <ClosedCard exception={NO_HOME_EXCEPTION} /> : null}
            </div>
          )}

          {/* 3) 생애최초 — 무주택과 다른 개념이라 따로 묻는다 */}
          {askFirstTime && (
            <div className="slideup">
              <YesNo label="생애 처음으로 집을 사시는 건가요?"
                desc="무주택은 '지금 집이 없다', 생애최초는 '한 번도 집을 가져본 적 없다'는 뜻이에요. 부부라면 두 분 모두요."
                value={elig.firstTime} onPick={(v) => set("firstTime", v)} />
            </div>
          )}

          {/* 4) 결혼여부 — 4버킷 */}
          {askMarital && (
            <div className="slideup">
              <MaritalChoice bucket={bucketOf(elig)} hasSpouse={hasSpouse} onPick={pickBucket} />
            </div>
          )}

          {/* 5) 소득 — 배우자 있을 때만 */}
          {askIncome && (
            <div className="slideup">
              {hasSpouse
                ? <>
                    <SpouseIncomeTrack value={elig.spouseBand} onPick={pickBand} ownIncome={ownIncome} />
                    {showPrecise && (
                      <div className="slideup" style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 12, background: "#F7FAF7", border: `1px solid ${C.line}` }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.greenDeep, marginBottom: 4 }}>소득상한 경계에 걸쳐 있어요</div>
                        <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.55, marginBottom: 8 }}>이 구간은 상한을 넘느냐 마느냐로 가능한 상품 자체가 갈려요. 배우자 세전 연소득을 정확히 넣으면 더 좁혀서 보여드릴게요. 비워두면 구간 대표값으로 계산해요.</div>
                        <input type="number" inputMode="numeric" placeholder="예: 4000" value={elig.spouseIncomeRaw} onChange={(e) => set("spouseIncomeRaw", e.target.value)} style={inputBox} />
                      </div>
                    )}
                  </>
                : <SkippedNote>
                    배우자가 없어서 소득은 본인 {won(ownIncome)}원으로만 봐요.
                    {elig.marital === "planned" && " 결혼예정이면 예비배우자 소득이 합산될 수 있어요 — 그건 상담역이 확인해드려요."}
                  </SkippedNote>}
            </div>
          )}

          {/* 6) 청년 주택드림 — 만39세 이하에게만 */}
          {askIncome && incomeReady && needsDream && (
            <div className="slideup" style={{ paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
              <YesNo label="주택드림 청약통장으로 당첨된 건인가요?"
                desc="해당자만요. 통장 연계가 전제라 없으면 이 경로는 안 열려요."
                value={elig.hasDreamAccount} onPick={(v) => set("hasDreamAccount", v)} yes="예" no="아니오·해당없음" />
            </div>
          )}

          {gateOpen && (ready
            ? <>
                {facts.adult30SoleSingle && <SoleHouseholdNote />}
                {!facts.householdHead && <NoHouseholdHeadNote age={facts.age} />}
                <Results ctx={ctx} passed={passed} others={others} onPick={onPick} />
              </>
            : familyReady && <Section title="가능한 상품" subtitle="위 항목을 채우면 바로 판정해 드려요.">
                <Placeholder>가족정보·무주택·생애최초·결혼여부가 채워지면 <b>조건이 되는 상품을 전부</b> 보여드려요. 하나로 좁히지 않아요.</Placeholder>
              </Section>)}

          <p style={fine}>※ 자격 상한·한도 숫자는 전부 가상 예시예요. 실제 규정 값으로 교체 예정. 여기 넣은 값은 이 화면 밖으로 나가지 않아요. 대출 가부는 상담역이 확정하며, 이 화면은 대출을 약속하지 않아요.</p>
        </>
      )}
    </div>
  );
}

/* ── 1) 가족정보 카드 ──
   질문을 셋으로 쪼개지 않고 한 카드에 묶는다. 사용자에겐 "우리 집 구성"이라는 한 덩어리이고,
   파생값(나이·배우자·자녀·신생아)도 이 덩어리에서 한꺼번에 나오기 때문. */
function FamilyCard({ elig, set, setHasSpouse, facts, ready }) {
  const myAge = filledAge(elig.ownBirthday);
  const spouseAge = filledAge(elig.spouseBirthday);
  const kids = elig.birthdays;

  const addChild = () => set("birthdays", [...kids, ""]);
  const removeChild = (i) => set("birthdays", kids.filter((_, k) => k !== i));
  const setChild = (i, v) => set("birthdays", kids.map((d, k) => (k === i ? v : d)));

  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 3 }}>한 집에 같이 살 가족정보를 넣어주세요</div>
      <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.55, marginBottom: 14 }}>
        생년월일만 있으면 나이·자녀 수·신생아 여부까지 저희가 알아서 봐요. 따로 또 묻지 않을게요.
      </div>

      <FieldRow label="본인 생년월일" hint={myAge !== null ? `만 ${myAge}세` : null}>
        <input type="date" value={elig.ownBirthday} onChange={(e) => set("ownBirthday", e.target.value)} style={inputBox} />
      </FieldRow>

      <Divider />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>배우자</span>
        {spouseAge !== null && <span style={{ fontSize: 12, color: C.greenDeep, fontWeight: 700 }}>만 {spouseAge}세</span>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setHasSpouse(true)} style={pill(elig.hasSpouse === true)}>배우자 있음</button>
        <button onClick={() => setHasSpouse(false)} style={pill(elig.hasSpouse === false)}>배우자 없음</button>
      </div>
      {elig.hasSpouse === true && (
        <div className="slideup" style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "#9AA3A0", marginBottom: 4 }}>배우자 생년월일 (몰라도 넘어갈 수 있어요)</div>
          <input type="date" value={elig.spouseBirthday} onChange={(e) => set("spouseBirthday", e.target.value)} style={inputBox} />
        </div>
      )}

      <Divider />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>자녀 {kids.length > 0 ? `${kids.length}명` : "없음"}</span>
        <button onClick={addChild} style={{ padding: "6px 12px", borderRadius: 9, border: `1.5px solid ${C.line}`, background: "#fff", color: C.greenDeep, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>+ 자녀 추가</button>
      </div>
      {kids.length === 0
        ? <div style={{ fontSize: 12, color: "#9AA3A0", lineHeight: 1.55 }}>없으면 그대로 두세요. 미성년 자녀 수와 신생아 여부로 상한이 달라져서 여쭤봐요.</div>
        : <div style={{ display: "grid", gap: 8 }}>
            {kids.map((d, i) => {
              const a = filledAge(d);
              return (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.inkSoft }}>{i + 1}번째 아이 생년월일{a !== null ? ` · 만 ${a}세` : ""}</span>
                    <button onClick={() => removeChild(i)} style={{ border: "none", background: "none", color: "#9AA3A0", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>삭제</button>
                  </div>
                  <input type="date" value={d} onChange={(e) => setChild(i, e.target.value)} style={inputBox} />
                </div>
              );
            })}
          </div>}

      {/* 카드가 만들어낸 파생값을 그대로 되돌려 보여준다 — 무엇을 근거로 판정하는지 숨기지 않는다. */}
      {ready && (
        <div className="slideup" style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.inkSoft, lineHeight: 1.65 }}>
          <b style={{ color: C.greenDeep }}>이렇게 보고 계산해요</b><br />
          {/* 배우자 유무는 이 카드의 토글이 출처다 — facts.married는 아래 결혼여부 답이 있어야 켜진다 */}
          만 {facts.age}세 · {elig.hasSpouse ? "배우자 있음" : "배우자 없음"} · 자녀 {kids.length}명(미성년 {facts.minors}명)
          {facts.hasNewborn && <span style={{ color: C.greenDeep, fontWeight: 700 }}> · 신생아 특례 대상 자녀 있음</span>}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, hint, children }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>{label}</span>
        {hint && <span style={{ fontSize: 12, color: C.greenDeep, fontWeight: 700 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const Divider = () => <div style={{ borderTop: `1px solid ${C.line}`, margin: "14px 0" }} />;

/* ── 2·3·6) 단일 yes/no. 부연은 버튼이 아니라 설명문이 진다. ── */
function YesNo({ label, desc, value, onPick, yes = "네", no = "아니오" }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, color: C.ink, fontWeight: 700, marginBottom: desc ? 3 : 7 }}>{label}</div>
      {desc && <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 8, lineHeight: 1.55 }}>{desc}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onPick(true)} style={pill(value === true)}>{yes}</button>
        <button onClick={() => onPick(false)} style={pill(value === false)}>{no}</button>
      </div>
    </div>
  );
}

/* ── 4) 결혼여부 4버킷 ──
   가족정보와 모순되는 선택지는 눌리지 않게 막고, 왜 막혔는지 그 자리에서 말한다. */
function MaritalChoice({ bucket, hasSpouse, onPick }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, color: C.ink, fontWeight: 700, marginBottom: 3 }}>결혼은 어떤 상태인가요?</div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 8, lineHeight: 1.55 }}>혼인신고 7년 이내면 신혼가구로 봐서 소득상한과 한도가 달라져요.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {MARITAL_BUCKETS.map((b) => {
          const blocked = (b.needsSpouse && !hasSpouse) || (b.key === "none" && hasSpouse);
          const on = bucket === b.key;
          return (
            <button key={b.key} onClick={() => !blocked && onPick(b)} disabled={blocked} aria-pressed={on}
              style={{ ...pill(on), width: "100%", textAlign: "left", padding: "11px 14px", cursor: blocked ? "not-allowed" : "pointer", opacity: blocked ? 0.45 : 1 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{b.label}</span>
              <span style={{ display: "block", fontSize: 12, fontWeight: 500, marginTop: 2, lineHeight: 1.45, color: on ? "rgba(255,255,255,.85)" : C.inkSoft }}>
                {blocked ? (hasSpouse ? "위 가족정보에 배우자가 있어요" : "위 가족정보에서 '배우자 있음'을 고르면 열려요") : b.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── 5) 배우자 소득 밴드 트랙 ──
   본인 소득은 앞 예산 화면에서 이미 받았다. 여기서 다시 묻지 않는다. */
function SpouseIncomeTrack({ value, onPick, ownIncome }) {
  const picked = SPOUSE_INCOME_BANDS.find((b) => b.key === value) || null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, color: C.ink, fontWeight: 700, marginBottom: 3 }}>배우자 세전 연소득은 어느 구간인가요?</div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 8, lineHeight: 1.55 }}>
        본인 소득 {won(ownIncome)}원은 앞에서 이미 받았어요. 배우자 몫만 구간으로 골라주세요.
      </div>
      <div style={{ display: "flex", border: `1.5px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
        {SPOUSE_INCOME_BANDS.map((b, i) => {
          const on = value === b.key;
          return (
            <button key={b.key} onClick={() => onPick(b.key)} aria-pressed={on}
              style={{ flex: 1, padding: "12px 4px", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
                borderLeft: i > 0 ? `1px solid ${on || value === SPOUSE_INCOME_BANDS[i - 1].key ? "transparent" : C.line}` : "none",
                background: on ? C.greenDeep : "#fff", color: on ? "#fff" : C.inkSoft, fontVariantNumeric: "tabular-nums" }}>
              {b.short}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9AA3A0", marginTop: 5 }}>
        <span>적음</span><span>많음</span>
      </div>
      {picked && (
        <div className="slideup" style={{ fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 1.55 }}>
          {picked.label} 선택 · 계산은 구간 대표값 <b>약 {won(picked.rep)}원</b>으로 봐요. 경계에 걸리면 정확한 값을 따로 여쭤볼게요.
        </div>
      )}
    </div>
  );
}

/* ── 세대주 추정에 붙는 노랑 안내 ──
   세대주를 직접 묻지 않기로 한 대가다. 추정으로 계산해놓고 확답하지 않는다(가드레일 3). */
function SoleHouseholdNote() {
  return (
    <Section title="단독세대 여부는 상담역이 확인해드려요" tone="warn"
      subtitle="배우자도 미성년 자녀도 없고 만 30세가 넘어서, 디딤돌의 '만30세 이상 단독세대주'로 보고 계산했어요.">
      <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.65 }}>
        이 구간은 가격·면적·한도에 별도 상한이 붙어요(예: 전용 60㎡·3억 이하). 그런데 등본상 실제 세대 구성은 저희가 알 수 없어요 —
        부모님과 같은 세대로 묶여 있거나, 반대로 부양가족이 잡혀 있으면 적용 기준이 바뀝니다.
        <b style={{ color: C.ink }}> 아래 결과는 그 가정 위에서 나온 값이고, 확정은 상담역이 등본을 보고 해드려요.</b>
      </div>
    </Section>
  );
}

function NoHouseholdHeadNote({ age }) {
  return (
    <Section title="세대주 요건이 아직 안 잡혀요" tone="warn"
      subtitle={`만 ${age}세이고 부양가족이 없어서, 디딤돌 세대주 요건이 원칙적으로는 안 걸려요.`}>
      <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.65 }}>
        다만 닫힌 건 아니에요. <b style={{ color: C.ink }}>미성년 형제자매나 직계존속을 6개월 이상 부양하는 세대주</b>라면 열릴 수 있어요 —
        이건 등본으로 상담역이 확인해드려요. 만 30세가 되는 시점, 혼인신고 시점도 같이 짚어보면 좋아요.
      </div>
    </Section>
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

/* 답에 따라 건너뛴 질문은 조용히 지우지 않고 "왜 안 물었는지"를 남긴다. */
function SkippedNote({ children }) {
  return <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6, marginBottom: 14, padding: "9px 12px", borderRadius: 10, background: "#F7FAF7", border: `1px dashed ${C.line}` }}>{children}</div>;
}
