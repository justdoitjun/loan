/* 매물별 한도 — (매물 하나, 사람 상태) → 이 사람에게 이 집의 대출과 필요 현금.
   지도·목록 전체를 DATA.map(u => judgeUnit(u, person))로 한 번에 돌리는 게 존재 이유다.

   ⚠️ 순수 함수다. 같은 입력이면 같은 출력이고 부수효과가 없다.
      React state·화면·시간(Date.now)에 의존하지 말 것 — 그러면 매물 전체를 돌릴 수 없고
      테스트도 못 한다. 필요한 건 전부 인자로 받는다.

   왜 engine.js가 아니라 여기인가 — 이 함수는 engine.js(판정·산식)와 products/limit.js(레버→한도)를
   둘 다 부른다. engine.js에 넣으면 limit.js와 순환 import가 된다. 그래서 둘을 합치는 층을 따로 뒀다.
   호출부는 이 파일 하나만 알면 된다.

   파이프:
     사람 + 매물가격 ─→ leverOf ─→ lever { price, income, incomeMax, debt }
        lever.income ─→ withAssumedIncome → deriveFacts → judgeAll   (자격 재판정)
        lever        ─→ limitAt(상품별)                              (통과한 것들의 구체 한도)
        필요 현금    ─→ cashNeededOf(시세, 대출)

   색으로 살 수 있는지를 말하지 않는다. 결과는 대출과 필요 현금 두 숫자다.

   ⚠️ 소득 레버는 한도만이 아니라 자격도 움직인다(소득상한을 넘으면 상품이 닫힌다).
      그래서 한도만 다시 계산하고 자격은 놔두면 안 된다 — 둘 다 lever.income으로 다시 본다. */
import { buildCtx, deriveFacts, judgeAll, withAssumedIncome, cashNeededOf } from "./engine.js";
import { limitAt } from "./products/limit.js";
import { leverOf } from "./person.js";

export function judgeUnit(unit, person) {
  const lever = leverOf(person, unit.price);
  const ctx = buildCtx({ unit, ownIncome: person.ownIncome, elig: person.elig });
  const facts = deriveFacts(withAssumedIncome(ctx, lever.income));
  const { passed, others } = judgeAll(facts);

  /* 통과한 상품마다 지금 레버 위치에서의 구체 한도. 잣대(DTI/DSR)는 상품 데이터가 고른다. */
  const products = passed
    .map((p) => {
      const at = limitAt(p.product, lever, p.limit);
      return { key: p.key, product: p.product, title: p.title, limit: at.limit, binding: at.binding.key };
    })
    .sort((a, b) => b.limit - a.limit);

  /* 숫자는 '가장 크게 열리는 길' 기준이다 — 하나로 좁히지 않되, 보여줄 대출은 하나여야 하니까.
     통과가 0개면 자격에서 막힌 것이라 대출 0, 필요 현금 = 시세 전액. 다만 여기서 끝내지 않으려고
     others를 같이 돌려준다(왜 막혔는지·무엇이 얼마 모자란지 → 화면이 길을 제시할 재료). */
  const best = products[0] ?? null;
  const loan = best?.limit ?? 0;

  return {
    ...unit,
    loan,
    cashNeeded: cashNeededOf(unit.price, loan),
    limitedBy: best?.binding ?? null,
    products, best, others,
    mode: "precise",
  };
}

/* 매물 전체. 사람이 한 번 바뀌면 이 한 줄로 모든 매물의 대출·필요 현금이 다시 나온다. */
export const judgeUnits = (units, person) => units.map((u) => judgeUnit(u, person));
