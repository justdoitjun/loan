/* 레버 → 한도. 조종간(Strategy.jsx)이 계산에 대해 아는 유일한 창구.
   Strategy는 어떤 상품인지 몰라도 된다 — productKey와 레버 값만 넘기면 한도가 돌아온다.
   상품 고유 지식(부채를 어떤 잣대로 보는가)은 여기 DEBT_VIEW에만 둔다.

   레버 값(lever)의 모양 — 이게 이 인터페이스의 계약이다:
     { price, income, incomeMax, creditLoan, otherMonthly }
       price        담보 시세 (만원)         · 고정
       income       가정 인정소득 (만원)      · 소득 레버
       incomeMax    소득 레버가 갈 수 있는 최대 · 천장 계산에 씀
       creditLoan   가정 신용대출 잔액 (만원) · 부채 레버
       otherMonthly 가정 기타대출 월상환 (만원)· 부채 레버
   돌려주는 것: { limit, parts, binding, existingAnnual } — limitParts와 같은 모양. */
import { PRODUCTS } from "../data.js";
import { limitParts, annualDebtService } from "../engine.js";

/* ✏️ 가상값 — 실제 심사 관행으로 교체할 것.
   기금(디딤돌·보금자리) DTI는 기존 대출을 이자 위주로 보고, 은행 DSR은 원리금으로 본다.
   등록되지 않은 상품은 보수적으로 원리금(DSR)으로 본다 — 한도를 부풀리지 않는 쪽이 기본값. */
export const DEBT_VIEW = { didimdol: "interestOnly", bogeumjari: "interestOnly" };
const viewOf = (key) => DEBT_VIEW[key] ?? "principalAndInterest";

/* 지금 레버 위치에서 닿는 한도. */
export function limitAt(productKey, lever, capOverride = null) {
  const existingAnnual = annualDebtService(lever.creditLoan, lever.otherMonthly, viewOf(productKey));
  return { ...limitParts(PRODUCTS[productKey], lever.price, lever.income, existingAnnual, capOverride), existingAnnual };
}

/* 두 레버를 끝까지 당겼을 때(부채 0 · 소득 상한) = '정직한 천장'.
   이 위 구간은 레버로도 지금은 무리다. 거짓 희망을 만들지 않기 위해 반드시 같이 그린다. */
export function ceilingAt(productKey, lever, capOverride = null) {
  return limitAt(productKey, { ...lever, creditLoan: 0, otherMonthly: 0, income: lever.incomeMax }, capOverride);
}

/* ── 행동 번역용 역산 ──────────────────────────────────────────────────────
   한도는 부채에 대해 단조 감소, 소득에 대해 단조 증가라 이분탐색으로 충분하다.
   Min(LTV, DTI, cap)이라 구간별로 꺾여도 단조성은 유지된다. */

/* 목표에 닿으려면 신용대출을 얼마까지 줄여야 하나(만원). 0까지 줄여도 못 닿으면 null. */
export function creditLoanToReach(productKey, lever, capOverride, target) {
  if (limitAt(productKey, lever, capOverride).limit >= target) return lever.creditLoan; // 이미 닿아 있음
  if (limitAt(productKey, { ...lever, creditLoan: 0 }, capOverride).limit < target) return null;
  let lo = 0, hi = lever.creditLoan;   // lo = 닿는 쪽, hi = 못 닿는 쪽
  for (let i = 0; i < 40 && hi - lo > 1; i++) {
    const mid = (lo + hi) / 2;
    if (limitAt(productKey, { ...lever, creditLoan: mid }, capOverride).limit >= target) lo = mid; else hi = mid;
  }
  return lo;
}

/* 목표에 닿으려면 인정소득이 얼마여야 하나(만원). 소득상한까지 올려도 못 닿으면 null. */
export function incomeToReach(productKey, lever, capOverride, target) {
  if (limitAt(productKey, lever, capOverride).limit >= target) return lever.income;
  if (limitAt(productKey, { ...lever, income: lever.incomeMax }, capOverride).limit < target) return null;
  let lo = lever.income, hi = lever.incomeMax;   // lo = 못 닿는 쪽, hi = 닿는 쪽
  for (let i = 0; i < 40 && hi - lo > 10; i++) {
    const mid = (lo + hi) / 2;
    if (limitAt(productKey, { ...lever, income: mid }, capOverride).limit >= target) hi = mid; else lo = mid;
  }
  return hi;
}
