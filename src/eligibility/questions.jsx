/* 스텝 카드 조각 — 자격 흐름(Eligibility.jsx)이 key로 골라 그린다. 상품 지식은 없다.
   라벨과 값만 받아 그린다. ⚠️ 판정·계산을 두지 말 것(그건 engine/person). 같은 질문을 두 곳에 그리지 않는다. */
import { SPOUSE_INCOME_BANDS, REGION, REGION_LABEL, LTV_TABLE, C } from "../data.js";
import { won } from "../engine.js";
import { card, pill, Section } from "../ui.jsx";

const REGION_NAME = REGION_LABEL[REGION];
const ROW = LTV_TABLE[REGION];
const pct = (rate) => `${Math.round(rate * 100)}%`;

/* ── 단일 yes/no. 부연은 버튼이 아니라 설명문이 진다. ── */
export function YesNo({ label, desc, value, onPick, yes = "네", no = "아니오" }) {
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

/* ── 배우자 소득 밴드 트랙 ──
   본인 소득은 앞 예산 화면에서 이미 받았다. 여기서 다시 묻지 않는다.
   desc = 탭별 부연(정부: 부부합산 상한 / 은행: DSR 합산 시 부채도 합산). */
export function SpouseIncomeTrack({ value, onPick, ownIncome, planned, desc }) {
  const picked = SPOUSE_INCOME_BANDS.find((b) => b.key === value) || null;
  const who = planned ? "예비배우자" : "배우자";
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, color: C.ink, fontWeight: 700, marginBottom: 3 }}>{who} 세전 연소득은 어느 구간인가요?</div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 8, lineHeight: 1.55 }}>
        본인 {won(ownIncome)}원. {who} 몫만 고르세요.
        {desc && <> {desc}</>}
      </div>
      <div style={{ display: "flex", border: `1.5px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
        {SPOUSE_INCOME_BANDS.map((b, i) => {
          const on = value === b.key;
          return (
            <button key={b.key} onClick={() => onPick(b.key)} aria-pressed={on}
              style={{ flex: 1, padding: "12px 4px", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
                borderLeft: i > 0 ? `1px solid ${on || value === SPOUSE_INCOME_BANDS[i - 1].key ? "transparent" : C.line}` : "none",
                background: on ? C.green : "#fff", color: on ? C.onAccent : C.inkSoft, fontVariantNumeric: "tabular-nums" }}>
              {b.short}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.faint, marginTop: 5 }}>
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

/* 답에 따라 건너뛴 질문은 조용히 지우지 않고 "왜 안 물었는지"를 남긴다. */
export function SkippedNote({ children }) {
  return <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.6, marginBottom: 14, padding: "9px 12px", borderRadius: 10, background: C.softer, border: `1px dashed ${C.line}` }}>{children}</div>;
}

export const MARITAL_BUCKETS = [
  { key: "planned", label: "곧 할 거예요",             desc: "예비배우자 소득까지 합산해서 봐요. 3개월 이내인지는 상담 때 확인해요", marital: "planned", within7: null,  needsSpouse: false },
  { key: "new7",    label: "혼인신고한 지 7년 안 됐어요", desc: "신혼가구 — 소득상한과 한도가 같이 올라가요",         marital: "married", within7: true,  needsSpouse: true },
  { key: "over7",   label: "혼인신고한 지 7년 넘었어요", desc: "결혼했지만 신혼 기준에선 벗어나요",                 marital: "married", within7: false, needsSpouse: true },
  { key: "none",    label: "배우자가 없어요",           desc: "미혼·이혼·사별 모두 포함해요",                     marital: "single",  within7: null,  needsSpouse: false },
];

/* ── 4) 결혼여부 4버킷 ──
   가족정보와 모순되는 선택지는 눌리지 않게 막고, 왜 막혔는지 그 자리에서 말한다. */
export function MaritalChoice({ bucket, hasSpouse, onPick }) {
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

export /* 주택 보유 상태 4버킷 = LTV 표의 행. key는 person.homeBucketOf가 돌려주는 값과 같다. */
const HOME_BUCKETS = [
  { key: "none",    label: "없어요",              desc: `무주택 — 일반 LTV ${pct(ROW.noHome)}`,                         homeCount: 0, dispose: null },
  { key: "dispose", label: "집이 하나 있지만, 처분할 거예요",     desc: `6개월 내 처분 및 전입조건 · LTV ${pct(ROW.disposing)}`, homeCount: 1, dispose: true },
  { key: "keep",    label: "집이 하나 있고, 계속 갖고 있을래요",   desc: `${REGION_NAME}에선 LTV ${pct(ROW.oneHome)}`,       homeCount: 1, dispose: false },
  { key: "multi",   label: "집이 둘 이상 있어요",                desc: `${REGION_NAME}에선 LTV ${pct(ROW.multiHome)}`,      homeCount: 2, dispose: null },
];

/* ── ① 주택 보유 상태 4버킷 ── 닫히는 선택지도 누를 수 있다. 눌러야 "왜 닫히는지"를 그 자리에서 볼 수 있으니까. */
export function HomeChoice({ bucket, onPick }) {
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
export function ClosedByLtv({ bucket, onPick }) {
  const dispose = HOME_BUCKETS.find((b) => b.key === "dispose");
  return (
    <Section title="은행 주담대가 닫혀요" tone="off">
      <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.7 }}>
        {bucket === "keep"
          ? <>처분조건으로 똘똘한 한 채를 갖는 건 어떠세요?</>
          : <>주택 하나를 처분해야 평가 가능해요.</>}
      </div>
      {bucket === "keep" && (
        <button onClick={() => onPick(dispose)} style={{ marginTop: 10, border: "none", background: "none", padding: 0, color: C.greenDeep, fontSize: 13, fontWeight: 800, cursor: "pointer", textDecoration: "underline" }}>
          처분조건부로 볼게요 →
        </button>
      )}
    </Section>
  );
}


/* ── 입력한 조건 목록 (결과 화면 위) ──
   접어도 '무엇으로 판정했는지'는 숨기지 않는다. 줄을 누르면 그 스텝으로 돌아가 고친다. */
export function AnswerList({ rows, onJump }) {
  return (
    <div style={{ ...card, padding: "12px 16px", marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.greenDeep, marginBottom: 8 }}>입력한 조건 <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>· 누르면 고쳐요</span></div>
      {rows.map((r) => (
        <button key={r.key} type="button" onClick={() => onJump(r.key)}
          style={{ width: "100%", display: "flex", gap: 10, alignItems: "baseline", padding: "4px 0", border: "none", background: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: C.ink }}>
          <span style={{ color: C.inkSoft, flex: "0 0 74px", fontSize: 12 }}>{r.label}</span>
          <span data-fit="line" style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.6 }}>{r.value}</span>
          <span aria-hidden="true" style={{ color: C.greenDeep, fontSize: 12, fontWeight: 800 }}>›</span>
        </button>
      ))}
    </div>
  );
}
