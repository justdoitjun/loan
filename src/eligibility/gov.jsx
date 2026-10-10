import { useLayoutEffect, useRef, useState } from "react";
import { SPOUSE_INCOME_BANDS, NO_HOME_EXCEPTION, C } from "../data.js";
import { deriveFacts, judgeAll, nearIncomeCap, won, eok, cashNeededOf } from "../engine.js";
import { GOV_RULES } from "../products/index.js";
import { bucketOf, filledAge, eligSteps, withSpouse } from "../person.js";
import { Section, ClosedCard, Placeholder, eyebrow, h1, card, fine, inputBox, pill } from "../ui.jsx";
import { YesNo, SpouseIncomeTrack, AnswersDropdown, SkippedNote } from "./shared.jsx";

const MARITAL_BUCKETS = [
  { key: "planned", label: "곧 할 거예요",             desc: "예비배우자 소득까지 합산해서 봐요. 3개월 이내인지는 상담 때 확인해요", marital: "planned", within7: null,  needsSpouse: false },
  { key: "new7",    label: "혼인신고한 지 7년 안 됐어요", desc: "신혼가구 — 소득상한과 한도가 같이 올라가요",         marital: "married", within7: true,  needsSpouse: true },
  { key: "over7",   label: "혼인신고한 지 7년 넘었어요", desc: "결혼했지만 신혼 기준에선 벗어나요",                 marital: "married", within7: false, needsSpouse: true },
  { key: "none",    label: "배우자가 없어요",           desc: "미혼·이혼·사별 모두 포함해요",                     marital: "single",  within7: null,  needsSpouse: false },
];

/* 접힌 드랍다운이 보여줄 요약. 접어도 '무엇으로 판정했는지'는 숨기지 않는다 —
   근거가 사라지고 결과 숫자만 남으면, 사용자는 자기가 뭘 답했는지부터 의심하게 된다. */
const answerRows = (elig, facts, ownIncome, needsDream) => {
  const bucket = MARITAL_BUCKETS.find((b) => b.key === bucketOf(elig));
  const band = SPOUSE_INCOME_BANDS.find((b) => b.key === elig.spouseBand);
  const spouse = elig.spouseIncomeRaw !== "" ? `${won(Number(elig.spouseIncomeRaw))}원` : band ? band.label : "—";
  /* 결혼예정이면 예비배우자를 합산 대상으로 세고, 요약에도 그렇게 적는다 —
     "배우자 없음"이라고 접어두고 소득은 합산하면 사용자가 숫자의 출처를 못 찾는다. */
  const counted = elig.hasSpouse === true || elig.marital === "planned";
  const who = elig.hasSpouse === true ? "배우자" : "예비배우자";
  const rows = [
    ["가족", `만 ${facts.age}세 · ${counted ? `${who} 있음` : "배우자 없음"} · 자녀 ${elig.birthdays.length}명${facts.minors > 0 ? ` (미성년 ${facts.minors}명)` : ""}`],
    ["무주택", "네"],
    ["생애최초", elig.firstTime ? "네" : "아니오"],
    ["결혼", bucket ? bucket.label : "—"],
    ["소득", counted ? `본인 ${won(ownIncome)}원 + ${who} ${spouse}` : `본인 ${won(ownIncome)}원만`],
  ];
  if (needsDream) rows.push(["청년 주택드림", elig.hasDreamAccount ? "당첨됐어요" : "해당 없음"]);
  return rows;
};

export default function Gov({ ctx, elig, setElig, onPick }) {
  const set = (k, v) => setElig((s) => ({ ...s, [k]: v }));
  const facts = deriveFacts(ctx);
  const ownIncome = ctx.ownIncome;

  /* 질문 진행 상태는 전부 eligSteps 한 곳에서 온다 — App/지도가 쓰는 것과 같은 판단이다. */
  const {
    gateOpen, spouseDeclared, spouseCounted, familyReady, askFirstTime,
    askMarital, askIncome, incomeReady, needsDream, ready,
  } = eligSteps(elig);

  /* 배우자 토글은 뒤 질문들과 모순을 만들 수 있다 → 바뀌는 순간 어긋난 답만 조용히 비운다.
     (경고를 띄우고 사용자에게 치우게 하는 것보다, 애초에 모순이 못 남게 하는 쪽) */
  const setHasSpouse = (v) => setElig((s) => withSpouse(s, v));   // 정리 규칙은 person.withSpouse 한 곳(은행탭도 같은 토글)

  const pickBucket = (b) => setElig((s) => ({ ...s, marital: b.marital, marriedWithin7: b.within7 }));
  const pickBand = (k) => setElig((s) => ({ ...s, spouseBand: k, spouseIncomeRaw: "" })); // 밴드 바뀌면 정밀값 무효

  /* 다 채우면 질문 더미를 접는다. editing은 "다시 펼쳐서 고치는 중"이라는 일시 상태라
     여기 로컬에 둔다 — 답 자체가 아니니 EMPTY_ELIG(상위 state)에 올리지 않는다.
     답을 고쳐서 ready가 깨지면 collapsed도 자동으로 풀린다(펼침 상태를 따로 관리 안 함). */
  const [editing, setEditing] = useState(false);
  /* 펼쳐서 고치다가 답이 깨지면(ready=false) 펼침 상태도 같이 버린다.
     안 그러면 다시 다 채웠을 때 editing이 true로 남아 두 번째부턴 안 접힌다.
     렌더 중 setState는 이 경우(파생 상태 보정) React가 허용하는 패턴 — effect보다 깜빡임이 없다. */
  if (editing && !ready) setEditing(false);
  const collapsed = ready && !editing;

  /* 경계 판정은 지금 답만으로 한 판정 결과를 근거로 한다(밴드 대표값 기준).
     이미 정밀값을 넣었으면 상한이 움직여도 칸을 닫지 않는다 — 입력값 유실 방지. */
  const { all, passed, others } = judgeAll(facts, GOV_RULES);   // 정부탭 = 정부 규칙만(은행 카드가 섞이지 않게)
  const onEdge = spouseCounted && elig.spouseBand !== null && nearIncomeCap(all, ctx.totalIncome);
  const showPrecise = onEdge || elig.spouseIncomeRaw !== "";

  return (
    <>
      {!collapsed && (
        <>
          <div style={eyebrow}>자격 조건</div>
          <h1 style={h1}>지금은 어떤 상태인가요?</h1>
          <div style={{ borderTop: `1px solid ${C.line}`, margin: "6px 0 16px" }} />
        </>
      )}

      {/* 다 채웠으면 질문 더미를 접는 드랍다운. 접힌 채로도 무엇으로 판정했는지는 다 보인다 */}
      {ready && (
        <AnswersDropdown open={editing} onToggle={() => setEditing((e) => !e)}
          rows={answerRows(elig, facts, ownIncome, needsDream)} />
      )}

      {!collapsed && (
        <>
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
                value={elig.firstTime} onPick={(v) => set("firstTime", v)} />
            </div>
          )}

          {/* 4) 결혼여부 — 4버킷 */}
          {askMarital && (
            <div className="slideup">
              {/* 모순 차단은 '직접 답한' 배우자 유무로만 한다 — 결혼예정으로 간주된 배우자가
                  "배우자가 없어요" 버킷을 잠그면 버킷을 되돌릴 길이 막힌다 */}
              <MaritalChoice bucket={bucketOf(elig)} hasSpouse={spouseDeclared} onPick={pickBucket} />
            </div>
          )}

          {/* 5) 소득 — 배우자 있을 때만 */}
          {askIncome && (
            <div className="slideup">
              {spouseCounted
                ? <>
                    <SpouseIncomeTrack value={elig.spouseBand} onPick={pickBand} ownIncome={ownIncome} planned={elig.marital === "planned"} />
                    {showPrecise && (
                      <div className="slideup" style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 12, background: C.softer, border: `1px solid ${C.line}` }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.greenDeep, marginBottom: 4 }}>소득상한 경계</div>
                        <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.55, marginBottom: 8 }}>정확한 금액을 넣으면 더 좁혀요.</div>
                        <input type="number" inputMode="numeric" placeholder="예: 4000" value={elig.spouseIncomeRaw} onChange={(e) => set("spouseIncomeRaw", e.target.value)} style={inputBox} />
                      </div>
                    )}
                  </>
                : <SkippedNote>
                    배우자가 없어서 소득은 본인 {won(ownIncome)}원으로만 봐요.
                  </SkippedNote>}
            </div>
          )}

          {/* 6) 청년 주택드림 — 만39세 이하에게만 */}
          {askIncome && incomeReady && needsDream && (
            <div className="slideup" style={{ paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
              <YesNo label="혹시, 청년 주택드림 청약통장으로 당첨된 건인가요?"
                value={elig.hasDreamAccount} onPick={(v) => set("hasDreamAccount", v)} yes="예" no="아니오·해당없음" />
            </div>
          )}
        </>
      )}

      {gateOpen && (ready
        ? <div className="slideup">
            {facts.adult30SoleSingle && <SoleHouseholdNote />}
            {!facts.householdHead && <NoHouseholdHeadNote age={facts.age} />}
            <Results ctx={ctx} passed={passed} others={others} onPick={onPick} />
          </div>
        : familyReady && <Section title="가능한 대출">
            <Placeholder>위를 채우면 계산해요.</Placeholder>
          </Section>)}

      <p style={fine}>대략적인 전략을 짜면, 전문가가 확인해드려요.</p>
    </>
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
        <BirthdateInput value={elig.ownBirthday} onChange={(v) => set("ownBirthday", v)} />
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
          <div style={{ fontSize: 12, color: C.faint, marginBottom: 4 }}>배우자 생년월일 (몰라도 넘어갈 수 있어요)</div>
          <BirthdateInput value={elig.spouseBirthday} onChange={(v) => set("spouseBirthday", v)} />
        </div>
      )}

      <Divider />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>미성년 자녀 {kids.length > 0 ? `${kids.length}명` : "없음"}</span>
        <button onClick={addChild} style={{ padding: "6px 12px", borderRadius: 9, border: `1.5px solid ${C.line}`, background: "#fff", color: C.greenDeep, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>+ 자녀 추가</button>
      </div>
      {kids.length === 0
        ? <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.55 }}>없으면 그대로 두세요. 미성년 자녀 수와 신생아 여부로 상한이 달라져서 여쭤봐요.</div>
        : <div style={{ display: "grid", gap: 8 }}>
            {kids.map((d, i) => {
              const a = filledAge(d);
              return (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.inkSoft }}>{i + 1}번째 아이 생년월일{a !== null ? ` · 만 ${a}세` : ""}</span>
                    <button onClick={() => removeChild(i)} style={{ border: "none", background: "none", color: C.faint, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>삭제</button>
                  </div>
                  <BirthdateInput value={d} onChange={(v) => setChild(i, v)} />
                </div>
              );
            })}
          </div>}

      {/* 카드가 만들어낸 파생값을 그대로 되돌려 보여준다 — 무엇을 근거로 판정하는지 숨기지 않는다. */}
      {ready && (
        <div className="slideup" style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.inkSoft, lineHeight: 1.65 }}>
          <b style={{ color: C.greenDeep }}>이렇게 보고 계산해요</b><br />
          {/* 배우자 유무는 이 카드의 토글이 출처다 — facts.married는 아래 결혼여부 답이 있어야 켜진다.
              단 결혼예정은 아래에서 답해도 여기 계산에 들어오므로(예비배우자 소득 합산) 같이 적는다 */}
          만 {facts.age}세 · {elig.hasSpouse ? "배우자 있음" : facts.planned ? "예비배우자 있음(결혼예정)" : "배우자 없음"} · 자녀 {kids.length}명(미성년 {facts.minors}명)
          {facts.hasNewborn && <span style={{ color: C.greenDeep, fontWeight: 700 }}> · 신생아 특례 대상 자녀 있음</span>}
        </div>
      )}
    </div>
  );
}

/* ── 생년월일 휠 ──
   키보드로 치지 않는다. 2026년이 가운데에서 시작하고, 위로 밀면 더 이전 해로 간다.
   값은 여전히 "YYYY-MM-DD". 밀거나 누르기 전에는 빈 문자열 그대로라 나이가 생기지 않는다.
   윤년·월말는 고르는 쪽에서 자른다. "2월 30일"이 다음 달로 밀리지 않게. */
const BIRTH_YEAR_MAX = 2026;
const BIRTH_YEAR_MIN = 1926;
const BIRTH_YEARS = Array.from({ length: BIRTH_YEAR_MAX - BIRTH_YEAR_MIN + 1 }, (_, i) => BIRTH_YEAR_MAX - i);
const BIRTH_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const WHEEL_H = 32;

const pad2 = (n) => String(n).padStart(2, "0");
const daysInMonth = (y, m) => new Date(Number(y), Number(m), 0).getDate() || 31;
const splitYMD = (v) => { const [y = "", m = "", d = ""] = (v || "").split("-"); return [y, m, d]; };

function WheelColumn({ label, items, selected, format, onSelect }) {
  const ref = useRef(null);
  const armed = useRef(false);
  const dragging = useRef(false);
  const touched = useRef(false);
  const timer = useRef(0);
  const index = Math.max(0, items.findIndex((it) => it === selected));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || dragging.current) return;
    armed.current = false;
    el.scrollTop = index * WHEEL_H;
    const id = requestAnimationFrame(() => { armed.current = true; });
    return () => cancelAnimationFrame(id);
  }, [index, items.length]);

  function settle() {
    const el = ref.current;
    if (!el) return;
    const next = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / WHEEL_H)));
    dragging.current = false;
    if (items[next] !== selected) onSelect(items[next]);
  }

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: C.faint, marginBottom: 4 }}>{label}</div>
      <div style={{ position: "relative", height: WHEEL_H * 5 }}>
        <div aria-hidden="true" style={{ position: "absolute", left: 2, right: 2, top: WHEEL_H * 2, height: WHEEL_H, borderRadius: 8, background: C.soft, pointerEvents: "none" }} />
        <div
          ref={ref}
          className="birth-wheel"
          role="listbox"
          aria-label={label}
          onPointerDown={() => { touched.current = true; dragging.current = true; }}
          onWheel={() => { touched.current = true; }}
          onScroll={() => {
            if (!armed.current || !touched.current) return;
            dragging.current = true;
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(settle, 90);
          }}
        >
          <div style={{ height: WHEEL_H * 2 }} />
          {items.map((it) => {
            const on = it === selected;
            return (
              <button key={it} type="button" role="option" aria-selected={on} onClick={() => onSelect(it)}
                style={{ display: "block", width: "100%", height: WHEEL_H, scrollSnapAlign: "center", border: "none", background: "transparent", cursor: "pointer", fontSize: on ? 16 : 13, fontWeight: on ? 800 : 600, color: on ? C.ink : C.faint, fontVariantNumeric: "tabular-nums" }}>
                {format(it)}
              </button>
            );
          })}
          <div style={{ height: WHEEL_H * 2 }} />
        </div>
      </div>
    </div>
  );
}

function BirthdateInput({ value, onChange }) {
  const [ys, ms, ds] = splitYMD(value);
  const filled = ys.length === 4 && ms.length >= 1 && ds.length >= 1;
  const year = filled ? Number(ys) : BIRTH_YEAR_MAX;
  const month = filled ? Number(ms) : 1;
  const day = filled ? Number(ds) : 1;
  const dayItems = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);
  const safeDay = Math.min(day, dayItems.length);

  function commit(ny, nm, nd) {
    const last = daysInMonth(ny, nm);
    onChange(`${ny}-${pad2(nm)}-${pad2(Math.min(nd, last))}`);
  }

  return (
    <div>
      <style>{`.birth-wheel{height:${WHEEL_H * 5}px;overflow-y:auto;scroll-snap-type:y mandatory;overscroll-behavior:contain;scrollbar-width:none;mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);}
.birth-wheel::-webkit-scrollbar{display:none;}`}</style>
      {!filled && <div style={{ fontSize: 11, color: C.faint, marginBottom: 4 }}>2026년부터 위로 밀어 고르세요</div>}
      <div style={{ display: "flex", gap: 6 }}>
        <WheelColumn label="년" items={BIRTH_YEARS} selected={year} format={(n) => String(n)} onSelect={(v) => commit(v, month, safeDay)} />
        <WheelColumn label="월" items={BIRTH_MONTHS} selected={month} format={(n) => `${n}월`} onSelect={(v) => commit(year, v, safeDay)} />
        <WheelColumn label="일" items={dayItems} selected={safeDay} format={(n) => `${n}일`} onSelect={(v) => commit(year, month, v)} />
      </div>
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

/* ── 4) 결혼여부 4버킷 ──
   가족정보와 모순되는 선택지는 눌리지 않게 막고, 왜 막혔는지 그 자리에서 말한다. */
function MaritalChoice({ bucket, hasSpouse, onPick }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, color: C.ink, fontWeight: 700, marginBottom: 3 }}>결혼하셨나요?</div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 8, lineHeight: 1.55 }}>혼인신고한지 7년 이내면 신혼가구로 봐서 소득상한과 한도가 달라져요.</div>
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

/* ── 세대주 추정에 붙는 노랑 안내 ──
   세대주를 직접 묻지 않기로 한 대가다. 추정으로 계산해놓고 확답하지 않는다(가드레일 3). */
function SoleHouseholdNote() {
  return (
    <Section title="단독세대는 상담역이 확인해요" tone="warn">
      <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.65 }}>
        만 30세 이상 단독세대로 보고 계산했어요. 등본 구성이 다르면 기준이 바뀝니다.
      </div>
    </Section>
  );
}

function NoHouseholdHeadNote({ age }) {
  return (
    <Section title="세대주 요건이 아직 안 잡혀요" tone="warn">
      <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.65 }}>
        만 {age}세, 부양가족 없음. 미성년 형제·직계존속을 6개월 이상 부양하면 열릴 수 있어요.
      </div>
    </Section>
  );
}

/* ── 결과: 가능한 상품 목록 (이 화면의 산출물) ── */
function Results({ ctx, passed, others, onPick }) {
  if (passed.length === 0) return <><NoneCard others={others} ctx={ctx} />{others.length > 0 && <OthersNote others={others} />}</>;
  return (
    <>
      <Section title={`가능한 대출 ${passed.length}가지`} tone="ok">
        {passed.map((p, i) => <ProductCard key={p.key} p={p} ctx={ctx} best={i === 0} onPick={onPick} />)}
      </Section>
      {others.length > 0 && <OthersNote others={others} />}
    </>
  );
}

function ProductCard({ p, ctx, best, onPick }) {
  const cash = cashNeededOf(ctx.unit.price, p.rough);
  return (
    <button onClick={() => onPick(p.key)}
      style={{ width: "100%", textAlign: "left", marginBottom: 10, padding: "13px 15px", borderRadius: 13, cursor: "pointer", border: `1.5px solid ${best ? C.greenDeep : C.line}`, background: best ? C.soft : "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: C.inkSoft }}>
          {p.title}{best && <span style={{ fontSize: 11, color: C.greenDeep, marginLeft: 6 }}>한도 최대</span>}
        </span>
        <span style={{ fontSize: 15, fontWeight: 800, color: C.greenDeep, fontVariantNumeric: "tabular-nums" }}>약 {eok(p.rough)}</span>
      </div>
      <div style={{ fontSize: 12, color: C.greenDeep, fontWeight: 700, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
        현금 약 {won(cash)}원
      </div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 1.6 }}>
        금리 {p.rateLabel} · 실행 {p.leadTime} · 최대 {won(p.limit)}
      </div>
      {p.note && <div style={{ fontSize: 12, color: C.faint, marginTop: 4, lineHeight: 1.6 }}>{p.note}</div>}
      <div style={{ fontSize: 12, color: C.greenDeep, fontWeight: 800, marginTop: 7 }}>이걸로 볼게요 →</div>
    </button>
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
