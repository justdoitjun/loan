/* 사람 상태 — "이 사람이 누구인가"의 스키마와 순수 판단이 전부 여기 있다. 매물은 여기 없다.
   ⚠️ 이 파일에 매물(가격·면적·좌표)이 들어오는 순간 이 구조는 무너진다.
      매물별로 달라지는 건 verdict.judgeUnit이 인자로 받아서 처리한다.
   ⚠️ JSX·React를 import하지 말 것. 이 파일이 화면에 묶이면 verdict.js도 같이 묶여서
      "순수 함수인데 화면 없이는 못 돌린다"가 된다. 여기는 데이터와 함수만 둔다.

   왜 나눴나 — 자격 조건(가족·무주택·생애최초·결혼·소득)과 레버(부채 가정·소득 가정)는
   매물이 바뀌어도 그대로다. 매물마다 다른 건 가격·면적뿐이다. 그래서 사람은 앱 최상위에
   한 벌만 두고, 매물별 판정은 (매물 + 이 사람) → 결과인 순수 함수로 전부 돌린다.
   그래야 매물 전체를 동시에 다시 계산할 수 있고, 다른 매물을 골라도 재질문이 없다.

   소유: App.jsx가 useState로 EMPTY_PERSON 하나를 들고 있다. 각 화면은 자기 조각만 받아 쓴다.
     Eligibility  → elig       (자격 답변 — 스텝 정의는 아래 FLOW)
     DetailInfo   → detail     (부채 잔액 · 소득의 질)
     Strategy     → pull       (레버를 당긴 값) ⚠️ 로컬 state 아님 — 화면을 나가도 유지된다
     IncomeCheck  → incomeCheck(소득 신뢰도 자가진단)
     소득 화면     → ownIncome */
import { LEVER, DEBT_KINDS } from "./data.js";
import { ageOf, spouseIncomeOf, borrowerSpouseIncomeOf, spouseCounted, debtTotal, buildCtx, deriveFacts } from "./engine.js";
import { PRODUCT_RULES } from "./products/index.js";

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/* ══════════════════════════════════════════════════════════════════════════
   1) 자격 답변 (Eligibility 화면이 채운다)
   ⚠️ 필드 이름은 engine.deriveFacts가 읽는 이름이다. 바꾸려면 거기도 같이 본다.
   ══════════════════════════════════════════════════════════════════════════ */
export const EMPTY_ELIG = {
  /* ── 가족정보 카드 — 이 셋이 나이·배우자유무·자녀수·미성년·신생아를 전부 만든다 ── */
  ownBirthday: "",        // 본인 생년월일 → 만나이(단독세대주 후보 / 만39세 이하 판정)
  hasSpouse: null,        // true | false — 가족정보의 "배우자 있음/없음"(가구 구성). ⚠️ false여도 결혼예정이면 예비배우자 소득은 묻는다
                          //   은행탭의 '합산할까요?'는 이 필드가 아니다(아래 bankIncomeJoint) — 한 필드에 두 뜻을 두면 한쪽 답이 다른 쪽을 지운다
  spouseBirthday: "",     // 배우자 생년월일. ⚠️ 지금 판정 규칙이 쓰는 값은 아니다(가구 확인용·향후 우대 대비)
  birthdays: [],          // 자녀 생년월일 — 0명부터 동적 추가/삭제

  /* ── 단일 질문 ── */
  homeCount: null,        // 0 = 무주택(진입 게이트) · 1 · 2(이상). 정부탭은 네/아니오(0/1), 은행탭은 4버킷(0/1/2)으로 채운다
  disposeExisting: null,  // homeCount=1일 때만: 처분조건부면 true(규제지역 일반차주 LTV), 유지면 false(LTV 0%). 은행탭만 묻는다
  firstTime: null,        // 생애최초 — "한 번도 소유한 적 없다". 무주택("지금 없다")과 다른 개념
  marital: null,          // "married" | "planned" | "single"  ← 4버킷이 이 둘로 매핑된다
  marriedWithin7: null,   // marital="married"일 때만: 혼인신고 7년 이내면 true → 신혼가구
  marriedDate: "",        // 이 화면에선 안 받는다(버킷으로 대체). 정밀 확인이 필요해지면 여기에 채운다
  weddingDate: "",        // 결혼예정 3개월 이내 판정용 — 추후 세부 확인 단계에서 받는다

  /* ── 소득 ── */
  spouseBand: null,       // SPOUSE_INCOME_BANDS의 key (합산할 배우자가 있을 때만)
  spouseIncomeRaw: "",    // 소득상한 경계일 때만 받는 정밀값(만원)
  bankIncomeJoint: null,  // 은행 DSR 합산 여부. 화면은 묻지 않는다(배우자 있음 = 합산, person.bankJointOf). 값이 있으면 그게 우선

  /* ── 그 외 ── */
  hasDreamAccount: null,  // 청년 주택드림 통장 (만39세 이하에게만 묻는다)
};

/* 미래 날짜·빈칸을 걸러낸다. 아이 생년월일이 내일이면 나이가 음수가 되는데, 그걸 '입력 완료'로 보면 안 된다. */
export const filledAge = (d) => { const a = ageOf(d); return a !== null && a >= 0 ? a : null; };

/* 결혼여부 4버킷 중 지금 고른 것. 화면의 라벨·설명은 eligibility/gov.jsx의 MARITAL_BUCKETS가 갖는다
   — 여기는 key만 안다(문구가 바뀌어도 판단이 안 흔들리게). */
export const bucketOf = (elig) => {
  if (elig.marital === "single") return "none";
  if (elig.marital === "planned") return "planned";
  if (elig.marital === "married") return elig.marriedWithin7 === true ? "new7" : elig.marriedWithin7 === false ? "over7" : null;
  return null;
};

/* ── 자격 흐름: 스텝 정의를 데이터로 ──
   정부/은행 탭은 없다. 자격은 한 번만 받는다(ux.md 3단계). 한 화면에 스텝 하나.
   when(elig) = 이 스텝을 묻는가(답에 따라 건너뜀) · done(elig) = 답했는가.
   화면(Eligibility.jsx)은 key로 카드를 고를 뿐 순서·건너뛰기 지식이 없다. 스텝을 늘리면 여기 한 줄 + 카드 하나.
   ⚠️ elig만 보고 결정된다 — 매물·소득과 무관하다. */
export const familyReady = (e) =>
  filledAge(e.ownBirthday) !== null && e.hasSpouse !== null && e.birthdays.every((d) => filledAge(d) !== null);
const under39 = (e) => { const a = filledAge(e.ownBirthday); return a !== null && a <= 39; };
/* 어느 상품이든 열릴 수 있는 주택 상태 = 무주택 또는 처분조건부 1주택. 유지·다주택은 전부 닫힌다(규제지역 LTV 0%). */
const openAtAll = (e) => { const b = homeBucketOf(e); return b === "none" || b === "dispose"; };
/* 주택 보유까지 답한 뒤에만 뒤 스텝이 생긴다 — 앞을 비워 둔 채 뒤 스텝이 세어지면 "앞으로 N개"가 거짓이 된다. */
const afterHome = (e) => familyReady(e) && homeBucketOf(e) !== null;
const noHomeAfter = (e) => afterHome(e) && homeBucketOf(e) === "none";

export const FLOW = [
  { key: "family",    when: () => true,                                        done: familyReady },
  /* 가족·주택 두 스텝은 처음부터 보인다("앞으로 2개만 더"). 그 뒤는 주택 답에 따라 생긴다 */
  { key: "home",      when: () => true,                                        done: (e) => homeBucketOf(e) !== null },
  /* 처분조건부는 은행만 열리고 은행은 생애최초·혼인·통장을 읽지 않는다 → 무주택에게만 묻는다 */
  { key: "firstTime", when: noHomeAfter,                                       done: (e) => e.firstTime !== null },
  { key: "marital",   when: noHomeAfter,                                       done: (e) => bucketOf(e) !== null },
  /* 합산할 상대(배우자 또는 예비배우자)가 있을 때만. 은행 DSR도 같은 답을 쓴다(배우자 있음 = 합산) */
  { key: "income",    when: (e) => afterHome(e) && openAtAll(e) && spouseCounted(e), done: (e) => e.spouseBand !== null },
  { key: "dream",     when: (e) => noHomeAfter(e) && under39(e),               done: (e) => e.hasDreamAccount !== null },
];

/* 지금 답으로 본 흐름. steps = 보이는 스텝(순서대로) · firstOpen = 첫 미완 index(-1이면 다 답함) ·
   remaining = 남은 질문 수(화면의 "앞으로 N개만 더") · closed = 유지·다주택으로 전부 닫힘 ·
   ready = 다 답했고 닫히지 않음(= 목록 정밀 모드를 켜도 되는가). 닫힘은 완료가 아니다. */
export function flowOf(elig) {
  const steps = FLOW.filter((s) => s.when(elig));
  const firstOpen = steps.findIndex((s) => !s.done(elig));
  const remaining = steps.filter((s) => !s.done(elig)).length;
  const bucket = homeBucketOf(elig);
  const closed = bucket === "keep" || bucket === "multi";
  return { steps, firstOpen, remaining, closed, bucket, open: openAtAll(elig), ready: firstOpen === -1 && !closed };
}

/* 자격 답변이 다 찼는가 = 이 사람에 대해 상품 판정을 돌릴 수 있는가. */
export const eligReady = (elig) => flowOf(elig).ready;
/* 은행도 같은 흐름이다. 이름은 호환용. */
export const bankReady = eligReady;

/* 주택 보유 4버킷(products/bank/bank.md 1절) — LTV 표의 행. */
export const homeBucketOf = (elig) => {
  if (elig.homeCount === 0) return "none";
  if (elig.homeCount === 1) return elig.disposeExisting === true ? "dispose" : elig.disposeExisting === false ? "keep" : null;
  if (elig.homeCount >= 2) return "multi";
  return null;
};
/* 은행 소득 합산 여부. 따로 묻지 않는다 — 가족정보의 배우자 있음 = 합산(bank.md 1절).
   bankIncomeJoint는 스키마에 남아 있고 값이 있으면 그게 우선이다(화면은 채우지 않는다). null = 아직 모른다. */
export function bankJointOf(elig) {
  if (elig.bankIncomeJoint != null) return elig.bankIncomeJoint;
  return eligReady(elig) ? elig.hasSpouse === true : null;
}

/* 가족정보의 배우자 유무 토글 — 뒤 스텝들과 모순이 남지 않게 어긋난 답만 조용히 비운다. */
export function withSpouse(s, v) {
  const next = { ...s, hasSpouse: v };
  if (v === false) {
    next.spouseBirthday = "";
    /* 결혼예정은 '배우자 없음'과 모순이 아니다(예비배우자) → 그 소득은 계속 합산 대상이라 안 지운다 */
    if (s.marital !== "planned") { next.spouseBand = null; next.spouseIncomeRaw = ""; }
    if (s.marital === "married") { next.marital = null; next.marriedWithin7 = null; }
  } else if (s.marital === "single") { next.marital = null; next.marriedWithin7 = null; }
  return next;
}

/* 주택 수 답. 수가 바뀌면 처분조건부 답을 비운다 — 예전에 고른 처분 약정이
   다시 묻지 않은 채 살아나 LTV를 정하면 안 된다(test/claude N-07). 은행탭은 둘을 한 번에 고른다. */
export function withHomeCount(s, n) {
  return { ...s, homeCount: n, disposeExisting: n === s.homeCount ? s.disposeExisting : null };
}

/* ══════════════════════════════════════════════════════════════════════════
   2) 부채 · 소득의 질 (DetailInfo가 채운다) — 레버의 시작 위치
   ══════════════════════════════════════════════════════════════════════════ */
/* 종류마다 0에서 시작 — 무부채도 유효한 값이라 처음부터 실제 값으로 둔다
   ("답 안 함"을 표현하는 건 debtConfirmed의 역할이다).
   키 목록은 DEBT_KINDS. 여기 필드를 종류마다 적어 두지 않는다. */
export function emptyDebts() {
  return Object.fromEntries(DEBT_KINDS.map((k) => [k.key, 0]));
}

/* 목록에 있는 종류만 남긴다. 뺀 종류의 값은 사라지고, 새 종류는 0이다. */
export function debtsFrom(raw) {
  const out = emptyDebts();
  if (raw == null || typeof raw !== "object") return out;
  for (const k of DEBT_KINDS) out[k.key] = Math.max(Number(raw[k.key]) || 0, 0);
  return out;
}

export const EMPTY_DETAIL = { debts: emptyDebts(), debtConfirmed: false, incomeQuality: { type: null, stable: null } };

/* 레버를 그릴 수 있는가. 부채는 값이 아니라 '확정 여부'로 본다
   — 슬라이더를 만지작거리는 중간값으로 레버가 그려지면 안 된다.

   ⚠️ 지금 DetailInfo는 '소득의 질'을 묻지 않는다(그 블록이 주석 처리돼 있다).
      여기서 incomeTrust(d.incomeQuality) !== null 을 같이 요구하면, 물어보지도 않는 답을
      기다리느라 ready가 영원히 false가 되고 조종간(레버·천장) 전체가 렌더되지 않는다.
      → 소득의 질 질문을 되살리면 그 답변 완료를 여기 조건에 다시 붙일 것. */
export const detailReady = (d) => d.debtConfirmed === true;

/* ══════════════════════════════════════════════════════════════════════════
   3) 소득 신뢰도 자가진단 (IncomeCheck가 채운다)
      결과 판정(incomeCheckResult)은 규정 데이터가 필요해서 IncomeCheck.jsx가 갖는다.
   ══════════════════════════════════════════════════════════════════════════ */
export const EMPTY_INCOME_CHECK = { groupKey: null, typeKey: null, answers: {} };

/* ══════════════════════════════════════════════════════════════════════════
   4) 사람 상태 전체
   ══════════════════════════════════════════════════════════════════════════ */
export const EMPTY_PERSON = {
  /* 소득 화면에서 받는 값 (만원). 보유 현금은 묻지 않는다 — 필요 현금은 시세−대출의 결과다. */
  ownIncome: 0,
  /* ⚠️ 배우자 소득은 elig.spouseBand에 있다. 본인 소득(ownIncome)과 출처가 다르다 —
        본인은 소득 화면 슬라이더, 배우자는 자격 화면 밴드. 합치는 건 engine.buildCtx의 일이다. */
  elig: EMPTY_ELIG,
  detail: { ...EMPTY_DETAIL, debts: emptyDebts() },
  /* 레버를 당긴 값 { debts, income, offsetRoom } · null = 아직 한 번도 안 당김(유도 애니메이션 신호).
     debts는 종류별 '줄인 뒤 금액'. 없는 키는 확정값 그대로다. 합계는 여기 두지 않는다.
     offsetRoom은 방공제 상쇄. 없으면 상품 기본값이다.
     시작 위치(detail)와 당긴 값(pull)을 따로 두는 이유: "얼마나 움직였나"를
     둘의 차이로 계산하기 때문. 하나로 합치면 '원래 얼마였는지'가 사라진다. */
  pull: null,
  incomeCheck: EMPTY_INCOME_CHECK,
};

/* 이 사람에 대해 상품 자격 판정을 돌릴 수 있는가 = 매물별 한도를 정밀 계산해도 되는가.
   자격 스텝을 끝까지 답하면 켠다 — 숫자는 채널을 가리지 않고 "가장 크게 열리는 길"로 본다.
   부채·레버는 조건이 아니다 — 안 받았으면 무부채로 가정하고 계산한다(기존 '천장' 잣대와 같다). */
export const personReady = (person) => eligReady(person.elig);

/* 정밀 숫자에 쓰는 상품 = 한 흐름을 다 답했으면 전부, 아니면 빈 배열(부분 입력으로 목록이 뛰면 안 된다). */
export const answeredRules = (elig) => (eligReady(elig) ? PRODUCT_RULES : []);

/* 부부합산 소득 (만원). 본인(소득 화면) + 배우자(자격 화면 밴드). */
export const totalIncomeOf = (person) => person.ownIncome + spouseIncomeOf(person.elig);
/* 차주단위 소득 (만원). 은행 DSR. 배우자는 은행탭에서 합산을 고른 경우만. */
export const borrowerIncomeOf = (person) => person.ownIncome + borrowerSpouseIncomeOf(person.elig);

/* ── 사람 상태 → 레버 값 ──
   products/limit.js가 요구하는 계약 { price, income, incomeMax, debt, debts, offsetRoom }를 만든다.
   가격만 매물에서 오고 나머지는 전부 사람에게서 온다 — 이 함수가 그 경계다.

   incomeCap = 이 상품의 소득상한(만원). 넘기면 소득 레버가 거기서 잘린다 —
   소득을 더 올리면 한도가 느는 게 아니라 '자격'이 닫히기 때문이다(거짓 희망 방지).
   지도처럼 상품이 하나로 정해지지 않은 자리에선 3억(LEVER.incomeMax)까지.

   pulled=false로 부르면 '당기기 전' 시작 위치가 나온다 — 행동 번역의 기준선.

   basis = 이 상품이 보는 소득(PRODUCTS[key].incomeBasis). "household" 부부합산 / "borrower" 차주단위(은행).
   pull.income은 늘 부부합산 기준의 가정값이다. 차주 기준이면 두 소득의 차이(incomeGap)만큼 빼서 쓴다. */
export function leverOf(person, price, incomeCap = null, pulled = true, basis = "household") {
  const household = totalIncomeOf(person);
  const income = basis === "borrower" ? borrowerIncomeOf(person) : household;
  const incomeGap = Math.max(household - income, 0);
  /* 소득 레버 최댓값 = 3억. 상품 소득상한이 더 낮으면 거기서 자른다.
     이미 상한을 넘었으면 범위가 뒤집히지 않게 현재 소득을 바닥으로 깐다. */
  const ceiling = Math.min(incomeCap ?? LEVER.incomeMax, LEVER.incomeMax);
  const incomeMax = Math.max(ceiling, income);
  /* 확정 전엔 부채를 0으로 본다 — 슬라이더를 만지작거리는 중간값으로 지도가 흔들리면 안 된다.
     줄이기는 종류마다 0~확정액. 확정액보다 크게 남은 당김은 확정액으로 자른다. */
  const debtBase = person.detail.debtConfirmed ? debtsFrom(person.detail.debts) : emptyDebts();
  const pull = pulled ? person.pull : null;
  const debts = {};
  for (const k of DEBT_KINDS) {
    const ceiling = debtBase[k.key];
    const raw = pull?.debts && pull.debts[k.key] != null ? Number(pull.debts[k.key]) : ceiling;
    debts[k.key] = clamp(Number.isFinite(raw) ? raw : ceiling, 0, ceiling);
  }
  const facts = deriveFacts(buildCtx({ unit: { price, areaM2: 0 }, ownIncome: person.ownIncome, elig: person.elig }));
  return {
    price,
    income: clamp(pull?.income != null ? pull.income - incomeGap : income, income, incomeMax),
    incomeMax,
    incomeGap,
    debts,
    debt: debtTotal(debts),
    /* null = 상품이 정한 방공제. true/false는 전략 화면에서 켠 값만.
       ⚠️ 목록(verdict.judgeUnit)은 이 값을 읽지 않고 늘 상품 기본값을 쓴다(ux.md 「방법 화면」). */
    offsetRoom: pull && typeof pull.offsetRoom === "boolean" ? pull.offsetRoom : null,
    /* 은행 LTV 행. 소득·가격은 레버 값이 따로 들어가므로 여기 넣지 않는다.
       incomeGap = 부부합산 − 차주단위. 서민·실수요의 소득 요건은 부부합산이라 그 차이를 다시 더해 본다. */
    ltv: {
      incomeGap,
      firstTime: facts.firstTime,
      noHome: facts.noHome,
      disposing: facts.disposing,
      oneHome: facts.oneHome,
      multiHome: facts.multiHome,
      householdHead: facts.householdHead,
      householdHeadKnown: facts.householdHeadKnown,
    },
  };
}
