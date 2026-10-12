/* 매물별 한도 — (매물 하나, 사람 상태) → 이 사람에게 이 집의 대출과 필요 현금.
   지도·목록 전체를 UNITS.map(u => judgeUnit(u, person))로 한 번에 돌리는 게 존재 이유다.

   ⚠️ 순수 함수다. 같은 입력이면 같은 출력이고 부수효과가 없다.
      React state·화면·시간(Date.now)에 의존하지 말 것 — 그러면 매물 전체를 돌릴 수 없고
      테스트도 못 한다. 필요한 건 전부 인자로 받는다.

   왜 engine.js가 아니라 여기인가 — 이 함수는 engine.js(판정·산식)와 products/limit.js(레버→한도)를
   둘 다 부른다. engine.js에 넣으면 limit.js와 순환 import가 된다. 그래서 둘을 합치는 층을 따로 뒀다.
   호출부는 이 파일 하나만 알면 된다.

   파이프:
     사람 + 매물가격 ─→ leverOf ─→ lever { price, income, incomeMax, debt, debts }
        lever.income ─→ withAssumedIncome → deriveFacts → judgeAll   (자격 재판정)
        lever        ─→ limitAt(상품별)                              (통과한 것들의 구체 한도)
        필요 현금    ─→ cashNeededOf(시세, 대출)

   색으로 살 수 있는지를 말하지 않는다. 결과는 대출과 필요 현금 두 숫자다.

   ⚠️ 소득 레버는 한도만이 아니라 자격도 움직인다(소득상한을 넘으면 상품이 닫힌다).
      그래서 한도만 다시 계산하고 자격은 놔두면 안 된다 — 둘 다 lever.income으로 다시 본다. */
import { PRODUCTS } from "./data.js";
import { buildCtx, deriveFacts, judgeAll, withAssumedIncome, cashNeededOf, assumedIncomeCap, spouseCounted } from "./engine.js";
import { limitAt, ceilingAt } from "./products/limit.js";
import { leverOf, answeredRules, detailReady, bankJointOf } from "./person.js";

const basisOf = (productKey) => PRODUCTS[productKey].incomeBasis ?? "household";

export function judgeUnit(unit, person) {
  const lever = leverOf(person, unit.price);
  const ctx = buildCtx({ unit, ownIncome: person.ownIncome, elig: person.elig });
  const facts = deriveFacts(withAssumedIncome(ctx, lever.income));
  /* 답을 끝낸 탭의 상품만 본다(person.answeredRules). */
  const { passed, others } = judgeAll(facts, answeredRules(person.elig));

  /* 통과한 상품마다 지금 레버 위치에서의 구체 한도. 잣대(DTI/DSR)와 소득 기준은 상품 데이터가 고른다.
     방공제는 늘 상품 기본값이다 — 방법 화면의 네/아니오는 그 화면 숫자만 바꾼다(ux.md).
     토글 이력(null/false)에 따라 다른 매물 숫자가 갈리면 안 된다(test/claude N-02). */
  const products = passed
    .map((p) => {
      const lv = basisOf(p.product) === "household" ? lever : leverOf(person, unit.price, null, true, basisOf(p.product));
      const at = limitAt(p.product, { ...lv, offsetRoom: null }, p.limit);
      return { key: p.key, product: p.product, title: p.title, limit: at.limit, binding: at.binding.key, judged: p };
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

/* 방법 화면의 계산 전부 — Strategy.jsx는 이 결과를 그리기만 한다(화면 파일에서 식을 다시 쓰지 않는다).
   자격은 목록과 같은 판정(judgeUnit)을 쓴다. 그래야 소득을 가정해 상품이 닫히면 방법 화면과 목록이 같이 닫힌다.
   pickedKey가 이 매물에서 안 열리면 가장 크게 열리는 길로 대신 보여 주고 pickedMissing을 켠다
   (고른 상품은 사람의 선택이라 매물을 바꿔도 지우지 않는다 — 다시 열리는 매물로 가면 돌아온다). */
export function strategyView(unit, person, pickedKey) {
  const ctx = buildCtx({ unit, ownIncome: person.ownIncome, elig: person.elig });
  const judged = judgeUnit(unit, person);
  const row = judged.products.find((p) => p.key === pickedKey) ?? judged.products[0] ?? null;
  if (!row) return { ctx, judged, picked: null, ready: false };

  const picked = row.judged;
  const basis = basisOf(picked.product);
  const pickedMissing = pickedKey != null && picked.key !== pickedKey;
  const ready = detailReady(person.detail);
  const view = { ctx, judged, picked, pickedMissing, ready, basis };
  if (!ready) return view;

  /* 소득 가정의 최대 = 이 경로의 소득상한(1인 상한 포함). 넘기면 자격이 닫힌다. */
  const incomeCap = basis === "household" ? assumedIncomeCap(picked, ctx) : picked.income.value;
  const base = leverOf(person, unit.price, incomeCap, false, basis);    // 당기기 전
  const lever = leverOf(person, unit.price, incomeCap, true, basis);    // 당긴 후

  /* 방 공제 보전은 기본 아니오. 아직 안 고른 값(null)도 아니오와 같이 한도에서 뺀다. */
  const roomOffset = lever.offsetRoom === true;
  const reach = limitAt(picked.product, { ...lever, offsetRoom: roomOffset }, picked.limit);

  /* 기존 대출·소득으로 '통틀어' 열 수 있는 폭 = 시작 위치에서 천장까지. 화면과 같은 방공제로 잰다 —
     상품 기본값으로 재면 은행 '아니오'(담보 벽)에선 손잡이가 보이고, 디딤돌 '네'(DTI 벽)에선 숨는다. */
  const start = { ...base, offsetRoom: roomOffset };
  const baseReach = limitAt(picked.product, start, picked.limit);
  const baseCeil = ceilingAt(picked.product, start, picked.limit);
  const leversInert = baseCeil.limit - baseReach.limit < 100;
  /* 게이지 눈금은 방공제를 보전받았을 때까지 포함한 더 높은 쪽 — 토글에 따라 눈금이 흔들리지 않게. */
  const roomOffCeil = ceilingAt(picked.product, { ...base, offsetRoom: true }, picked.limit);
  const gaugeCeiling = Math.max(baseCeil.limit, roomOffCeil.limit);

  /* 합산 소득인지는 이 상품의 소득 기준으로 본다 — 은행만 답한 사람에게 '부부합산'이라고 쓰지 않는다. */
  const joint = basis === "borrower" ? bankJointOf(person.elig) === true : spouseCounted(person.elig);

  /* 막혔을 때 줄 다음 길 = 이 매물에서 지금보다 크게 열리는 다른 상품(목록과 같은 숫자). */
  const nextPaths = judged.products.filter((p) => p.key !== picked.key && p.limit > reach.limit);

  return {
    ...view, incomeCap, base, lever, roomOffset, reach, baseReach, baseCeil, roomOffCeil, gaugeCeiling, leversInert,
    incomeMax: base.incomeMax,
    incomeRoom: Math.max(base.incomeMax - base.income, 0),
    incomeLabel: joint ? "인정소득 (부부합산)" : "인정소득",
    cash: cashNeededOf(unit.price, reach.limit),
    nextPaths,
  };
}
