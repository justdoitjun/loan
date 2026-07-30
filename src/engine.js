/* 계산 로직 한 곳. 화면(JSX)을 넣지 말 것.
   여러 페이지가 여기서만 import 한다 — 파일마다 다시 정의하면 규칙이 갈라진다.
   역할 분담: 상품 '규칙 데이터'는 src/products/*, 그 데이터를 읽는 '판정·계산'은 여기. */
import { RULE, AMBER_BAND, PRODUCTS, SPOUSE_INCOME_BANDS, INCOME_EDGE_MARGIN } from "./data.js";
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

   view = 상품이 기존 부채를 보는 잣대. 상품별로 어느 view를 쓰는지는 products/limit.js에 있다.
     "interestOnly"          기존 대출을 이자만 본다 (기금 DTI 관행 근사)
     "principalAndInterest"  원리금으로 본다 (은행 DSR 관행 근사)
   ✏️ 가정 금리·만기는 RULE.creditRate / RULE.creditYears — 전부 가상값. 실제 값으로 교체할 것.
   기타 대출은 이미 '월상환액'으로 받으므로 두 view 모두 그대로 12개월 환산한다. */
export function annualDebtService(creditLoan, otherMonthly, view = "principalAndInterest") {
  const credit = num(creditLoan);
  const creditAnnual = credit <= 0 ? 0
    : view === "interestOnly" ? credit * RULE.creditRate
    : credit / RULE.creditYears + credit * RULE.creditRate;
  return creditAnnual + num(otherMonthly) * 12;
}

/* 소득의 질 → 신뢰도. 금액만큼 중요한 게 "지금도 인정되는 소득인가"다.
   근로 + 재직 2개월 이상이면 초록. 그 외는 노랑 — 문을 닫는 게 아니라
   "입력대로 다 인정 안 될 수 있어요 → 상담역 확인"이라는 뜻이다(가드레일 3·4). */
export function incomeTrust(q) {
  if (!q || !q.type || q.stable == null) return null;
  return q.type === "work" && q.stable === true ? "ok" : "warn";
}

/* ── 한도 ── */
export function repaymentCapacity(annualIncome, ratio, annualRate, years, existingAnnual) {
  const r = annualRate / 12, n = years * 12;
  const monthlyRoom = (annualIncome * ratio) / 12 - existingAnnual / 12;
  if (monthlyRoom <= 0) return 0;
  const factor = (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
  return monthlyRoom * factor;
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

/* 상품 한도 = Min(LTV기반, DTI기반, 이 경로의 한도).
   한 함수가 '대략 한도'(부채 0)와 '구체 한도'(정밀 부채)를 둘 다 만든다 — 잣대를 갈라놓지 않기 위해.
   capOverride = 자격 판정에서 고른 티어의 loanCap(2억/3.2억/4억…). 없으면 상품 기본 cap. */
export function limitParts(p, price, income, existingAnnual = 0, capOverride = null) {
  const ltv = Math.max(price * p.LTV - (p.offsetsRoomDeduction ? 0 : RULE.roomDeduction), 0);
  const dti = repaymentCapacity(income, p.ratio, p.calcRate, 30, existingAnnual);
  const parts = [
    { key: "ltv", label: p.offsetsRoomDeduction ? "담보(LTV · 방공제 상쇄)" : "담보(LTV − 방공제)", value: ltv },
    { key: "dti", label: "상환능력(DTI)", value: dti },
    { key: "cap", label: "이 경로의 최대한도", value: capOverride ?? p.cap },
  ];
  const binding = parts.reduce((a, b) => (b.value < a.value ? b : a));
  return { limit: Math.max(binding.value, 0), parts, binding };
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
    /* 기혼이면 세대에 배우자가 있으니 단독세대주가 될 수 없다 — 묻지 않고 확정한다. */
    hasDependents: elig.marital === "married" ? true : elig.hasDependents,
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

  const marriageMonths = married && ctx.marriedDate ? monthsBetween(new Date(ctx.marriedDate), today) : null;
  const withinNewlywed = marriageMonths !== null && marriageMonths <= NEWLYWED_YEARS * 12;

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

  const hasDependents = ctx.hasDependents === true;
  const sole = ctx.hasDependents === false;         // 단독세대주
  const adult30Sole = sole && age !== null && age >= 30;

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
    hasDependents, sole, adult30Sole,
    adult30SoleSingle: adult30Sole && single,
    minors, twoPlusMinors: minors >= 2,
    hasNewborn,
    dualIncome: (ctx.spouseIncome || 0) > 0,
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
  /* areaCap이 null인 상품은 면적 요건이 데이터에 없다는 뜻 → 검사하지 않는다 */
  if (rule.areaCap != null) {
    checks.push({ key: "area", label: "전용면적", actual: f.areaM2, cap: rule.areaCap, tier: `${rule.areaCap}㎡ 이하`, over: f.areaM2 - rule.areaCap, unit: "㎡" });
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

/* 대략 한도 = Min(경로 한도, LTV기반, DTI기반@부채0).
   부채를 아직 안 받았으니 예산 화면과 같은 '천장' 잣대다. 상품을 고르면 여기서 내려간다. */
export function roughLimit(judged, f) {
  return limitParts(PRODUCTS[judged.product], f.price, f.income, 0, judged.limit).limit;
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
