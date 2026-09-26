/* 은행 DSR — 기존 부채를 종류별 1년 상환액으로 바꾼다.
   화면은 잔액(마이너스통장은 한도)만 넘긴다. 월상환액·만기는 묻지 않는다.
   종류를 더하려면 data.DEBT_KINDS에 dsr 파라미터를 붙인다.
   디딤돌 DTI는 이 파일을 부르지 않는다. 호출은 engine.limitParts의 은행 경로만.
   정본은 .claude/rules/products/bank/bank.md 3절. */
import { DEBT_KINDS, PRODUCTS, RULE } from "./data.js";

const num = (v) => Math.max(Number(v) || 0, 0);

/* 기존 부채의 연 상환액(만원).
   debts가 없으면 종류를 모르므로 신용대출 식(원금 ÷ 5년 + 이자 가정)으로 본다. */
export function bankExistingAnnual(debt) {
  if (debt?.debts == null) return principalPlusInterest(num(debt?.balance), 5);
  return DEBT_KINDS.reduce((sum, kind) => sum + kindAnnual(kind, num(debt.debts?.[kind.key])), 0);
}

function kindAnnual(kind, amount) {
  if (amount <= 0) return 0;
  const spec = kind.dsr ?? { method: "principalPlusInterest", years: 5 };
  const years = spec.years > 0 ? spec.years : 5;
  if (spec.method === "actual") {
    // TODO: 주택담보대출은 실제 상환하는 1년 원리금이다. 잔액을 만기로 나누지 않는다.
    // 화면은 잔액만 받아서, 그 원리금을 받기 전에는 0으로 둔다. 잔액을 그대로 넣으면 1년 상환액이 된다.
    return 0;
  }
  if (spec.method === "interest") {
    // 전세자금대출: 원금은 넣지 않고 이자만.
    return assumedInterest(amount, spec);
  }
  if (spec.method === "principal") {
    // 카드대출: 원금 ÷ 약정만기. 최장 3년이라 만기를 받기 전에는 years(3)로 나눈다.
    // TODO: 카드 약정만기가 3년보다 짧으면 그 만기로 나눈다.
    // 자동차: 원금 ÷ 3년.
    return amount / years;
  }
  // principalPlusInterest: 원금 ÷ years + 이자.
  // 신용은 잔액 ÷ 5년. 마이너스통장은 그 식 그대로, 금액은 한도 전액. 비주택 담보는 8년.
  return amount / years + assumedInterest(amount, spec);
}

/* 연간 이자상환액 = 잔액 × (실제 대출금리 + 신규 취급시점 스트레스 금리).
   스트레스 금리는 실제 금리와 별개다. 화면 금리에는 더하지 않는다.
   TODO: 실제 대출금리로 바꿀 것. 받기 전에는 RULE.creditRate로 자리를 채운다.
   주담대(actual)·카드·자동차는 이 함수를 타지 않는다. */
function assumedInterest(amount, spec) {
  const actual = spec.rate == null ? RULE.creditRate : num(spec.rate);
  const stress = spec.stressRate == null ? num(PRODUCTS.bank.stressRate) : num(spec.stressRate);
  return amount * (actual + stress);
}

function principalPlusInterest(amount, years) {
  return amount / years + assumedInterest(amount, {});
}
