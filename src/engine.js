/* 계산 로직 한 곳. 화면(JSX)을 넣지 말 것.
   여러 페이지가 여기서만 import 한다 — 파일마다 다시 정의하면 규칙이 갈라진다.
   역할 분담: 상품 '규칙 데이터'는 src/products/*, 그 데이터를 읽는 '판정·계산'은 여기. */
import { RULE, AMBER_BAND, PRODUCTS, SPOUSE_INCOME_BANDS, INCOME_EDGE_MARGIN, ESTIMATED_DEBT_RATE, DIDIMDOL_LOAN_RATE, DIDIMDOL_DTI } from "./data.js";
import { PRODUCT_RULES, NEWBORN_RULE, NEWLYWED_YEARS, WEDDING_SOON_MONTHS } from "./products/index.js";

/* ── 포맷 ── */
export const eok = (man) => (man / 10000).toFixed(1) + "억";
export function won(man) {
  man = Math.round(Math.abs(man));
  const e = Math.floor(man / 10000), m = man % 10000;
  if (e > 0 && m > 0) return `${e}억 ${m.toLocaleString()}만`;
  if (e > 0) return `${e}억`;
  return `${m.toLocaleString()}만`;
}
export const num = (v) => Math.max(Number(v) || 0, 0);

/* ── 날짜·나이 ── */
export function ageOf(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday); if (isNaN(b.getTime())) return null;
  const t = new Date(); let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a;
}
export const countMinors = (birthdays) => (birthdays || []).filter((d) => { const a = ageOf(d); return a !== null && a < 19; }).length;
const monthsBetween = (from, to) => (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

/* ── 부채 ── */
/* 자격 화면은 부채를 묻지 않는다 — 자격은 소득상한 위/아래로 갈리지 부채로 갈리지 않기 때문.
   부채는 상품을 고른 뒤 Strategy(조종간)의 '부채 레버' 값으로 들어온다.

   ⚠️ 사용자에게 받는 부채 입력은 **잔액 하나뿐이다**(신용대출·마이너스통장·할부 등을 합친 대충값).
      월상환액은 묻지 않는다 — 두 잣대 모두 잔액에서 출발하고, 해석만 다르기 때문이다.

   여기(DSR 계열) view = 상품이 그 잔액을 보는 잣대:
     "interestOnly"          이자만 본다
     "principalAndInterest"  원리금으로 본다 (은행 DSR 관행 근사)
   ⚠️ 디딤돌은 이 함수를 쓰지 않는다 — 디딤돌 DTI는 아래 didimdolDtiLimit / otherDebtInterest.
   ✏️ 가정 금리·만기는 RULE.creditRate / RULE.creditYears — 전부 가상값. 실제 값으로 교체할 것. */
export function annualDebtService(debtBalance, view = "principalAndInterest") {
  const d = num(debtBalance);
  if (d <= 0) return 0;
  return view === "interestOnly" ? d * RULE.creditRate : d / RULE.creditYears + d * RULE.creditRate;
}

/* 소득의 질 → 신뢰도. 금액만큼 중요한 게 "지금도 인정되는 소득인가"다.
   근로 + 재직 2개월 이상이면 초록. 그 외는 노랑 — 문을 닫는 게 아니라
   "입력대로 다 인정 안 될 수 있어요 → 상담역 확인"이라는 뜻이다(가드레일 3·4). */
export function incomeTrust(q) {
  if (!q || !q.type || q.stable == null) return null;
  return q.type === "work" && q.stable === true ? "ok" : "warn";
}

/* ── 한도 ── */
/* 순수 계산: 월상환액 1을 감당할 수 있을 때의 원금(= 연금현가계수). PMT 역산의 공통 산수다.
   '정책'이 아니라 '산수'라서 DSR·DTI 두 잣대가 같이 쓴다 — 잣대의 차이는 무엇을 빼는지에 있다. */
const annuityFactor = (annualRate, years) => {
  const r = annualRate / 12, n = years * 12;
  return (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
};

/* 위의 역방향 — 원금이 정해졌을 때의 '연 원리금상환액'(원리금균등).
   한도 역산이 아니라, 확정된 대출액에서 DTI 분자 ①을 만들 때 쓴다. */
export const annualPayment = (principal, annualRate, years) =>
  (num(principal) / annuityFactor(annualRate, years)) * 12;

/* 은행(DSR) 잣대 — 기존 부채를 '원리금 전체'로 보고 소득에서 뺀다.
   ⚠️ 디딤돌은 이 함수를 쓰지 않는다(디딤돌은 아래 didimdolDtiLimit). 두 식을 다시 합치지 말 것.
   지금 쓰는 곳: 예산 화면의 천장(App.jsx), 그리고 capacityModel이 fundDTI가 아닌 상품. */
export function repaymentCapacity(annualIncome, ratio, annualRate, years, existingAnnual) {
  const monthlyRoom = (annualIncome * ratio) / 12 - existingAnnual / 12;
  if (monthlyRoom <= 0) return 0;
  return monthlyRoom * annuityFactor(annualRate, years);
}

/* ② 기존 부채가 DTI에서 먹는 연간 금액 = 이자만.
   기타부채 = 주담대 제외 대출(현금서비스 포함) − 상환예정 전세자금대출 − 예적금담보대출.
   MVP는 이 차감을 구분하지 않고 '기타 대출 잔액' 하나로 근사한다(상담역 확인 영역). */
export const otherDebtInterest = (balance) => num(balance) * ESTIMATED_DEBT_RATE;

/* 디딤돌 DTI 파라미터의 기본값 풀기 — Limit(역산)과 At(정산)이 같은 가정을 쓰게 한 곳에 모은다.
   여기가 갈라지면 "한도는 3.8억인데 그 3.8억의 DTI는 63%" 같은 모순이 화면에 나온다. */
const didimdolDtiOpts = (opts = {}) => ({
  annualRate: opts.annualRate ?? DIDIMDOL_LOAN_RATE,   // ①의 금리(디딤돌 자체 금리)
  years: opts.years ?? DIDIMDOL_DTI.years,             // 본건 산정만기 = 30년 강제 (data.js 한 곳)
  dtiCap: opts.dtiCap ?? DIDIMDOL_DTI.cap,
  /* TODO(①): MVP는 둘 다 0. 기금 주담대 중복 보유/상환예정 주담대를 다루게 되면
     여기에 '연 원리금(만원)'을 넣는다 — 잔액이 아니라 연 원리금이다. 화면에서 묻지는 않는다.
     상환예정을 뺀 순액. 음수면 0 — 상환예정이 한도를 늘려주진 않는다. */
  otherMortgageAnnual: Math.max(num(opts.otherFundLoanAnnual) - num(opts.repayingMortgageAnnual), 0),
});

/* 디딤돌(DTI) 잣대 — 은행 DSR과 식 자체가 다르다. 그래서 함수를 따로 둔다.
     DTI(%) = ( ① 주담대 연간 원리금상환액 + ② 기타부채 연간 이자상환 추정액 ) / 연소득 × 100

   ① = 본건 디딤돌 원리금(원리금균등·만기 DIDIMDOL_DTI.years·DIDIMDOL_LOAN_RATE)
        + 동일 금융기관 실행예정 기금주담대 + 기존 기금주담대 − 상환예정 주담대
     ↳ MVP는 본건만 계산한다. 나머지 세 항은 opts로 열려 있고 기본값이 0이다.
   ② = 잔액 × ESTIMATED_DEBT_RATE. 기존 부채에서 보는 건 이자뿐이다 —
        원금 상환 스케줄(월상환액·산정만기)은 보지 않는다. 그래서 사용자에게도 '잔액'만 물으면 된다.
        은행 DSR용 annualDebtService를 여기 쓰면 안 된다.

   ⚠️ 두 금리는 다른 값이다: ①은 DIDIMDOL_LOAN_RATE(디딤돌 자체 금리),
      ②는 ESTIMATED_DEBT_RATE(한국은행 고시 기준 추정금리). 하나로 합치지 말 것.

   ⚠️ 본건 대출액(didimdolAmount)을 **인자로 받지 않는다** — 받으면 순환이다.
      본건 대출액 = Min(LTV, DTI, cap)인데 그 DTI가 다시 본건 대출액을 필요로 하기 때문.
      대신 "본건 원리금이 DTI 여유분을 정확히 다 채우는 원금"을 PMT로 역산한다.
      즉 여기서 나온 한도에는 ①(본건 원리금)이 이미 반영돼 있다.
      확정된 대출액에서 실제 DTI·월 원리금을 보고 싶으면 아래 didimdolDtiAt을 쓴다(역방향).

   otherDebtBalance = 갖고 있는 대출 잔액 합계(만원). 부채 레버 값이 그대로 들어온다. */
export function didimdolDtiLimit(annualIncome, otherDebtBalance, opts = {}) {
  const { annualRate, years, dtiCap, otherMortgageAnnual } = didimdolDtiOpts(opts);
  const allowedAnnual = num(annualIncome) * dtiCap;                     // DTI상한이 허용하는 연 상환총액
  const roomAnnual = allowedAnnual - otherDebtInterest(otherDebtBalance) - otherMortgageAnnual;
  if (roomAnnual <= 0) return 0;
  return (roomAnnual / 12) * annuityFactor(annualRate, years);          // PMT 역산 → 본건 최대 원금
}

/* 역방향 — 본건 대출액이 확정됐을 때(= Min을 통과해 실제로 실행될 금액) 그 상태의 DTI를 정산한다.
   디딤돌은 대개 cap이나 LTV가 먼저 걸려서 실행액이 didimdolDtiLimit보다 **낮다**.
   그때 실제 DTI는 상한(60%)이 아니라 그보다 낮은 값이고, 그게 사용자가 봐야 할 숫자다.
   레버(부채·소득)를 움직이면 한도가 안 움직이는 구간에서도 이 숫자는 움직인다 — 정직한 피드백.
   ratio = null 은 '소득 0이라 판정 불가'. 0%와 구분해야 화면에서 거짓말이 안 된다. */
export function didimdolDtiAt(didimdolAmount, annualIncome, otherDebtBalance, opts = {}) {
  const { annualRate, years, dtiCap, otherMortgageAnnual } = didimdolDtiOpts(opts);
  const ownAnnual = annualPayment(didimdolAmount, annualRate, years);   // ① 본건 디딤돌 연 원리금
  const debtAnnual = otherDebtInterest(otherDebtBalance);               // ② 기타부채 연 이자
  const totalAnnual = ownAnnual + otherMortgageAnnual + debtAnnual;
  const income = num(annualIncome);
  const ratio = income > 0 ? totalAnnual / income : null;
  return {
    ownAnnual, ownMonthly: ownAnnual / 12,   // 본건 원리금 (연/월)
    debtAnnual, otherMortgageAnnual, totalAnnual,
    ratio, cap: dtiCap, years, rate: annualRate,
    /* 여유: DTI상한까지 연 상환액을 얼마나 더 얹을 수 있나(만원). 0이면 DTI가 벽이라는 뜻. */
    roomAnnual: Math.max(income * dtiCap - totalAnnual, 0),
  };
}

/* 지도·목록의 초록/노랑/회색 판정. 부채 0을 가정한 '천장' 기준이다. */
export function evaluate(unit, dsrCap, cash) {
  const ltv = unit.price * RULE.LTV - RULE.roomDeduction;
  let loanable = Math.min(dsrCap, ltv);
  if (RULE.seoulCap) loanable = Math.min(loanable, RULE.seoulCap);
  loanable = Math.max(loanable, 0);
  const budget = loanable + cash, slack = budget - unit.price, ratio = slack / unit.price;
  const color = ratio > AMBER_BAND ? "green" : ratio < -AMBER_BAND ? "grey" : "amber";
  return { ...unit, budget, slack, color, limitedBy: ltv <= dsrCap ? "ltv" : "dsr" };
}

/* 상품 한도 = Min(LTV기반, 상환능력, 이 경로의 한도).
   한 함수가 '대략 한도'(부채 0)와 '구체 한도'(정밀 부채)를 둘 다 만든다 — 잣대를 갈라놓지 않기 위해.
   capOverride = 자격 판정에서 고른 티어의 loanCap(2억/3.2억/4억…). 없으면 상품 기본 cap.

   debt = 레버에서 온 raw 부채 { balance, view } (만원). null이면 무부채(천장 잣대).
   받는 건 잔액 하나뿐이고, 그걸 이자로 볼지 원리금으로 볼지는 잣대가 정한다.
   상환능력을 어떤 식으로 볼지는 상품 데이터(PRODUCTS[key].capacityModel)가 정한다 —
   여기서 productKey로 분기하지 말 것. fundDTI = 디딤돌 DTI식 / 그 외 = 은행 DSR식(보수적 기본값).

   돌려주는 dti = 디딤돌 계열일 때만 채워지는 '확정 대출액 기준 DTI 정산'(그 외 null).
   한도(Min)를 먼저 정한 다음 그 금액으로 다시 계산한다 — 순서가 뒤집히면 순환이 된다. */
export function limitParts(p, price, income, debt = null, capOverride = null) {
  const ltv = Math.max(price * p.LTV - (p.offsetsRoomDeduction ? 0 : RULE.roomDeduction), 0);
  const balance = debt?.balance ?? 0;

  /* 디딤돌: DTI(기존 부채는 이자만) / 그 외: DSR(기존 부채를 원리금으로) */
  const fund = p.capacityModel === "fundDTI";
  const existingAnnual = fund ? otherDebtInterest(balance) : annualDebtService(balance, debt?.view);
  const capacity = fund
    ? didimdolDtiLimit(income, balance)   // 금리·만기·DTI상한은 data.js의 디딤돌 파라미터가 정한다
    : repaymentCapacity(income, p.ratio, p.calcRate, 30, existingAnnual);

  const parts = [
    { key: "ltv", label: p.offsetsRoomDeduction ? "담보(LTV · 방공제 상쇄)" : "담보(LTV - 방공제)", value: ltv },
    { key: "dti", label: fund ? "상환능력(DTI)" : "상환능력(DSR)", value: capacity },
    { key: "cap", label: "정책상 최대한도", value: capOverride ?? p.cap },
  ];
  const binding = parts.reduce((a, b) => (b.value < a.value ? b : a));
  const limit = Math.max(binding.value, 0);

  /* 여기서 비로소 본건 원리금이 '숫자'가 된다 — 한도를 만든 뒤 그 한도로 되짚는 방향.
     레버가 한도를 못 움직이는 구간(cap·LTV가 벽)에서도 이 값은 살아 움직인다. */
  return { limit, parts, binding, existingAnnual, dti: fund ? didimdolDtiAt(limit, income, balance) : null };
}

/* ══════════════════════════════════════════════════════════════════════════
   컨텍스트 — 앞 화면들이 확정한 것 + 자격 답변을 객체 하나로 묶는다.
   여기 담긴 건 뒤 화면에서 절대 다시 묻지 않는다.
   ══════════════════════════════════════════════════════════════════════════ */

/* 배우자 소득 = 정밀값 우선, 없으면 밴드 대표값. 미혼이면 질문 자체를 건너뛰므로 0. */
export function spouseIncomeOf(elig) {
  if (elig.marital === "single") return 0;
  const band = SPOUSE_INCOME_BANDS.find((b) => b.key === elig.spouseBand) || null;
  const precise = elig.spouseIncomeRaw === "" || elig.spouseIncomeRaw == null ? null : num(elig.spouseIncomeRaw);
  return precise ?? band?.rep ?? 0;
}

export function buildCtx({ unit, cash, ownIncome, elig }) {
  const spouseIncome = spouseIncomeOf(elig);
  return {
    ...elig,
    unit, cash, ownIncome, spouseIncome,
    totalIncome: ownIncome + spouseIncome,
    needed: Math.max(unit.price - cash, 0),
  };
}

/* 소득 레버용 — 가정 합산소득을 얹은 컨텍스트 사본.
   자격은 소득상한으로 갈리므로, 소득 레버를 올리면 '한도'만 아니라 '자격'도 움직인다.
   올린 몫은 배우자 합산·인정소득에서 온다고 본다(화면 설명과 같은 축).
   미혼이면 배우자가 없으니 본인 인정소득에 얹는다 — 맞벌이 플래그가 잘못 켜지지 않게. */
export function withAssumedIncome(ctx, assumedTotal) {
  const delta = Math.max(assumedTotal - ctx.totalIncome, 0);
  const toSpouse = ctx.marital !== "single";
  return {
    ...ctx,
    ownIncome: ctx.ownIncome + (toSpouse ? 0 : delta),
    spouseIncome: ctx.spouseIncome + (toSpouse ? delta : 0),
    totalIncome: ctx.totalIncome + delta,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   자격 판정 — 트리가 아니라 "규칙 데이터 순회 + 필터".
   상품이 늘어도 이 함수들은 그대로. src/products/*의 규칙 배열만 고친다.
   ══════════════════════════════════════════════════════════════════════════ */

/* 컨텍스트 → 규칙이 이름으로 참조하는 플래그 묶음.
   새 조건이 필요하면 여기에 플래그를 추가하고, 규칙 데이터에서 이름으로 쓴다. */
export function deriveFacts(ctx) {
  const today = new Date();
  const age = ageOf(ctx.ownBirthday);
  const minors = countMinors(ctx.birthdays);

  const married = ctx.marital === "married";
  const planned = ctx.marital === "planned";
  const single = ctx.marital === "single";

  /* 신혼 판정은 '혼인신고 7년 이내' 버킷이 1차 출처다 — 화면이 날짜 대신 버킷으로 묻기 때문.
     marriedDate는 정밀 확인이 필요해질 때를 위해 열어둔 보조 경로다(지금 화면에선 안 받는다).
     둘 중 하나라도 7년 이내면 신혼. 버킷이 false면 날짜가 없으므로 자연히 false다. */
  const marriageMonths = married && ctx.marriedDate ? monthsBetween(new Date(ctx.marriedDate), today) : null;
  const withinNewlywed = married && (ctx.marriedWithin7 === true || (marriageMonths !== null && marriageMonths <= NEWLYWED_YEARS * 12));

  const weddingMonths = planned && ctx.weddingDate ? monthsBetween(today, new Date(ctx.weddingDate)) : null;
  const weddingSoon = weddingMonths !== null && weddingMonths >= 0 && weddingMonths <= WEDDING_SOON_MONTHS;

  /* 신생아 = 접수일로부터 N년 이내 출생 AND 기준일 이후 출생 (둘 다 만족) */
  const newbornFloor = new Date(NEWBORN_RULE.since);
  const hasNewborn = (ctx.birthdays || []).some((d) => {
    if (!d) return false;
    const b = new Date(d);
    if (isNaN(b.getTime())) return false;
    const withinYears = monthsBetween(b, today) <= NEWBORN_RULE.withinYears * 12 && b <= today;
    return withinYears && b >= newbornFloor;
  });

  /* ⚠️ 세대주 여부는 화면에서 직접 묻지 않는다 — 가족정보(나이·배우자·자녀)에서만 추정한다.
     등본상 실제 세대 구성은 우리가 알 수 없으므로 여기 나오는 건 전부 '후보 판정'이고,
     화면은 그 결과에 노랑(상담역 확인) 안내를 붙여서 보여준다(가드레일 3). */
  const hasDependents = married || minors > 0;     // 부양가족 = 배우자 또는 미성년 자녀
  const sole = !married && !hasDependents;         // 단독세대주 후보(배우자·미성년 자녀 없음)

  /* 세대주 요건: 기혼 || (30세 이상, 배우자 없음) || (30세 미만인데 미성년 자녀를 부양)
     만30세 미만 미혼의 "미성년 형제자매·직계존속 6개월 이상 부양" 예외는 묻지 않는다 →
     이 경우 요건이 안 잡힌 채로 나가고, 화면이 "상담역이 등본으로 확인" 경로를 안내한다. */
  const adult30Plus = !married && age !== null && age >= 30;               // 30세 이상, 배우자 없음
  const soleException30Under = single && age !== null && age < 30 && minors > 0;
  const householdHead = married || adult30Plus || soleException30Under;    // 세대주 요건(자격 게이트)
  /* tier는 게이트보다 좁다 — 부양이 있으면 게이트는 통과해도 tier에선 빠진다(일반가구 기준 적용). */
  const adult30SoleSingle = single && age !== null && age >= 30 && sole;   // 30세 이상 미혼 단독세대주

  return {
    /* 금액·물건 */
    income: ctx.totalIncome, price: ctx.unit.price, areaM2: ctx.unit.areaM2,
    maxPersonIncome: Math.max(ctx.ownIncome || 0, ctx.spouseIncome || 0),
    /* 플래그 */
    noHome: ctx.homeCount === 0,
    firstTime: ctx.firstTime === true,
    single, married, planned,
    newlywed: withinNewlywed || weddingSoon,   // 혼인 7년 이내 또는 결혼예정 3개월 이내
    weddingSoon,
    hasDependents, sole, adult30Plus, householdHead, soleException30Under,
    adult30SoleSingle,
    minors, twoPlusMinors: minors >= 2,
    hasNewborn,
    dualIncome: (ctx.spouseIncome || 0) > 0,
    /* 청년주택드림의 나이 게이트. 만 40세 이상은 이 플래그가 꺼져서 규칙 requires에서 걸러진다. */
    under39: age !== null && age <= 39,
    hasDreamAccount: ctx.hasDreamAccount === true,
    jeonseVictim: ctx.jeonseVictim === true,
    /* 표시용 */
    age, marriageMonths, weddingMonths,
  };
}

/* 플래그 DSL: [] = 항상 참, ["a","b"] = AND, ["a",["b","c"]] = a AND (b OR c) */
export function matchFlags(expr, f) {
  if (!expr || expr.length === 0) return true;
  return expr.every((term) => (Array.isArray(term) ? term.some((k) => !!f[k]) : !!f[term]));
}

/* 위에서부터 첫 매치. 아무것도 안 맞으면 마지막(기본) 티어. */
export function pickTier(tiers, f) {
  return tiers.find((t) => matchFlags(t.when, f)) ?? tiers[tiers.length - 1];
}

/* 규칙 하나 판정. 통과 여부와 함께 "무엇이 얼마 모자란지"를 항상 같이 돌려준다
   — 실패해도 길을 보여줘야 하므로 gap을 버리지 않는다. */
export function judgeRule(rule, f) {
  const income = pickTier(rule.incomeCap, f);
  const price = pickTier(rule.priceCap, f);
  const loan = pickTier(rule.loanCap, f);

  const unmetRequires = rule.requires.filter((r) => !matchFlags(r.flags, f));

  const checks = [
    { key: "income", label: "소득", actual: f.income, cap: income.value, tier: income.label, over: f.income - income.value },
    { key: "price", label: "가격", actual: f.price, cap: price.value, tier: price.label, over: f.price - price.value },
  ];
  /* 맞벌이 티어처럼 '1인 상한'이 따로 붙는 경우 */
  if (income.perPersonCap != null) {
    checks.push({ key: "perPerson", label: "1인 소득", actual: f.maxPersonIncome, cap: income.perPersonCap, tier: income.label, over: f.maxPersonIncome - income.perPersonCap });
  }
  /* areaCap이 null인 상품은 면적 요건이 데이터에 없다는 뜻 → 검사하지 않는다.
     배열이면 priceCap·loanCap처럼 조건별 티어(예: 미혼단독세대주만 60㎡) — 위에서부터 첫 매치. */
  if (rule.areaCap != null) {
    const area = Array.isArray(rule.areaCap) ? pickTier(rule.areaCap, f) : { value: rule.areaCap, label: `${rule.areaCap}㎡ 이하` };
    checks.push({ key: "area", label: "전용면적", actual: f.areaM2, cap: area.value, tier: area.label, over: f.areaM2 - area.value, unit: "㎡" });
  }

  const failedChecks = checks.filter((c) => c.over > 0);
  const ok = rule.enabled && unmetRequires.length === 0 && failedChecks.length === 0;
  const p = PRODUCTS[rule.product];

  return {
    key: rule.key, product: rule.product, name: rule.name, note: rule.note, enabled: rule.enabled,
    /* 목록에 찍을 이름. 규칙명이 상품명과 같으면 두 번 쓰지 않는다. */
    title: rule.name === p.name ? p.name : `${p.name} · ${rule.name}`,
    rateLabel: p.rateLabel, leadTime: p.leadTime,
    ok, unmetRequires, checks, failedChecks,
    income, price, loan, limit: loan.value,
    /* '가장 근접' 정렬용 거리.
       자격이 다 맞고 금액만 넘은 경우(=좁힐 여지가 있는 경우)를 먼저 세운다.
       자격 자체가 막힌 경우엔 초과금액으로 줄 세우지 않는다 — "출생아가 없어서 못 받네,
       금액은 딱 맞는데"처럼 손쓸 수 없는 조건이 '가장 가까운 길'로 올라오면 안 되기 때문. */
    distance: unmetRequires.length > 0
      ? unmetRequires.length * 1e9
      : failedChecks.reduce((s, c) => s + Math.max(c.over, 0), 0),
  };
}

/* 대략 한도 = Min(경로 한도, LTV기반, 상환능력@부채0).
   부채를 아직 안 받았으니 예산 화면과 같은 '천장' 잣대다. 상품을 고르면 여기서 내려간다.
   debt=null → 무부채 가정. 상환능력 식(디딤돌 DTI / 은행 DSR)은 상품 데이터가 고른다. */
export function roughLimit(judged, f) {
  return limitParts(PRODUCTS[judged.product], f.price, f.income, null, judged.limit).limit;
}

/* 전 상품 판정 → { passed(대략 한도 높은 순), others(근접 순), all }.
   ⚠️ 가능한 걸 하나로 좁히지 않는다. 통과한 건 전부 passed에 담아 그대로 보여준다. */
export function judgeAll(f) {
  const all = PRODUCT_RULES.filter((r) => r.enabled).map((r) => {
    const j = judgeRule(r, f);
    return { ...j, rough: j.ok ? roughLimit(j, f) : 0 };
  });
  return {
    all,
    passed: all.filter((r) => r.ok).sort((a, b) => b.rough - a.rough),
    others: all.filter((r) => !r.ok).sort((a, b) => a.distance - b.distance),
  };
}

/* 소득이 어느 상품 소득상한의 언저리면 "경계"다 → 배우자 소득 정밀 입력을 펼친다.
   이 구간은 상한 위/아래로 가능 목록 자체가 갈려서, 밴드 대표값으로 두면 답이 틀린다. */
export function nearIncomeCap(all, income) {
  return all.some((j) => Math.abs(income - j.income.value) <= INCOME_EDGE_MARGIN);
}
