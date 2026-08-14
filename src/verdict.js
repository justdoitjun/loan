/* 매물별 판정 — (매물 하나, 사람 상태) → 이 사람에게 이 집이 어떤 색인지.
   지도 전체를 DATA.map(u => judgeUnit(u, person))로 한 번에 돌리는 게 존재 이유다.

   ⚠️ 순수 함수다. 같은 입력이면 같은 출력이고 부수효과가 없다.
      React state·화면·시간(Date.now)에 의존하지 말 것 — 그러면 지도 전체를 돌릴 수 없고
      테스트도 못 한다. 필요한 건 전부 인자로 받는다.

   왜 engine.js가 아니라 여기인가 — 이 함수는 engine.js(판정·산식)와 products/limit.js(레버→한도)를
   둘 다 부른다. engine.js에 넣으면 limit.js와 순환 import가 된다. 그래서 둘을 합치는 층을 따로 뒀다.
   호출부는 이 파일 하나만 알면 된다.

   파이프:
     사람 + 매물가격 ─→ leverOf ─→ lever { price, income, incomeMax, debt }
        lever.income ─→ withAssumedIncome → deriveFacts → judgeAll   (자격 재판정)
        lever        ─→ limitAt(상품별)                              (통과한 것들의 구체 한도)
        Min/색 판정  ─→ { color, slack, products[] }

   ⚠️ 소득 레버는 한도만이 아니라 자격도 움직인다(소득상한을 넘으면 상품이 닫힌다).
      그래서 한도만 다시 계산하고 자격은 놔두면 안 된다 — 둘 다 lever.income으로 다시 본다. */
import { AMBER_BAND } from "./data.js";
import { buildCtx, deriveFacts, judgeAll, withAssumedIncome } from "./engine.js";
import { limitAt } from "./products/limit.js";
import { leverOf } from "./person.js";

/* 여유(slack)가 시세 대비 몇 %냐로 색을 정한다. 예산 화면의 evaluate와 같은 잣대다 —
   모드가 바뀌어도(대략→정밀) 색의 '의미'는 그대로여야 사용자가 다시 배우지 않는다. */
function colorOf(slack, price) {
  const ratio = slack / price;
  return ratio > AMBER_BAND ? "green" : ratio < -AMBER_BAND ? "grey" : "amber";
}

export function judgeUnit(unit, person) {
  const lever = leverOf(person, unit.price);
  const ctx = buildCtx({ unit, cash: person.cash, ownIncome: person.ownIncome, elig: person.elig });
  const facts = deriveFacts(withAssumedIncome(ctx, lever.income));
  const { passed, others } = judgeAll(facts);

  /* 통과한 상품마다 지금 레버 위치에서의 구체 한도. 잣대(DTI/DSR)는 상품 데이터가 고른다. */
  const products = passed
    .map((p) => {
      const at = limitAt(p.product, lever, p.limit);
      return { key: p.key, product: p.product, title: p.title, limit: at.limit, binding: at.binding.key };
    })
    .sort((a, b) => b.limit - a.limit);

  /* 지도의 색은 '가장 크게 열리는 길' 기준이다 — 하나로 좁히지 않되, 색은 하나여야 하니까.
     통과가 0개면 자격에서 막힌 것이라 회색. 다만 여기서 끝내지 않으려고 others를 같이 돌려준다
     (왜 막혔는지·무엇이 얼마 모자란지 → 화면이 길을 제시할 재료). */
  const best = products[0] ?? null;
  const budget = (best?.limit ?? 0) + person.cash;
  const slack = budget - unit.price;

  return {
    /* 기존 지도·목록 UI가 evaluate()의 결과를 그대로 읽고 있어서 같은 모양으로 돌려준다.
       (id·name·dong·price·areaM2·x·y + color·slack·budget·limitedBy) */
    ...unit,
    budget, slack,
    color: best ? colorOf(slack, unit.price) : "grey",
    limitedBy: best?.binding ?? null,
    /* 정밀 모드에서만 있는 것들 */
    products, best, others,
    needed: ctx.needed,
    mode: "precise",
  };
}

/* 지도 전체. 사람이 한 번 바뀌면 이 한 줄로 모든 매물이 다시 칠해진다. */
export const judgeUnits = (units, person) => units.map((u) => judgeUnit(u, person));
