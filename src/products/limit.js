/* 레버 → 한도. 조종간(Strategy.jsx)이 계산에 대해 아는 유일한 창구.
   Strategy는 어떤 상품인지 몰라도 된다 — productKey와 레버 값만 넘기면 한도가 돌아온다.
   상품 고유 지식(부채를 어떤 잣대로 보는가)은 여기 DEBT_VIEW와 PRODUCTS[key].capacityModel에만 둔다
   — 디딤돌은 DTI, 은행 계열은 DSR로 갈린다.

   레버 값(lever)의 모양 — 이게 이 인터페이스의 계약이다:
     { price, income, incomeMax, debt, debts }
       price      담보 시세 (만원)             · 고정
       income     가정 인정소득 (만원)          · 소득 레버
       incomeMax  소득 레버가 갈 수 있는 최대     · 천장 계산에 씀
       debt       종류별 금액의 합계 (만원)      · debts와 같다. 합계만 보는 호출용
       debts      { [DEBT_KINDS.key]: 금액 }   · 종류별. 없으면 debt 숫자를 쓴다
   월상환액은 묻지도 넘기지도 않는다.
   은행의 종류별 연 상환액은 engine_bank_dsr.js가 잔액을 해석한다. 여기선 raw 부채를 넘긴다.
   돌려주는 것: { limit, parts, binding } — limitParts와 같은 모양. */
import { PRODUCTS } from "../data.js";
import { limitParts } from "../engine.js";

/* 기존 부채를 어떤 잣대로 보는가 — DSR 계열 상품에만 해당한다.
   ⚠️ 디딤돌은 여기 없다. 디딤돌은 DSR이 아니라 DTI식(engine.didimdolDtiLimit)으로 계산하고,
      그 사실은 PRODUCTS.didimdol.capacityModel = "fundDTI"가 정한다. 여기에 다시 등록하지 말 것.
   ✏️ 가상값 — 실제 심사 관행으로 교체할 것.
   등록되지 않은 상품은 보수적으로 원리금(DSR)으로 본다 — 한도를 부풀리지 않는 쪽이 기본값. */
export const DEBT_VIEW = { bogeumjari: "interestOnly", bank: "principalAndInterest" };   // 은행: products/bank/bank.md 3절
const viewOf = (key) => DEBT_VIEW[key] ?? "principalAndInterest";

/* 지금 레버 위치에서 닿는 한도.
   종류별 금액(debts)을 raw로 넘긴다. 합계로 볼지, 나중에 종류별로 가를지는 engine이 한다.
   debts가 없으면 debt 숫자 하나를 쓴다. */
export function limitAt(productKey, lever, capOverride = null) {
  const debt = { balance: lever.debt ?? 0, debts: lever.debts ?? null, view: viewOf(productKey) };
  return limitParts(PRODUCTS[productKey], lever.price, lever.income, debt, capOverride);
}

/* 두 레버를 끝까지 당겼을 때(부채 0 · 소득 상한) = '정직한 천장'.
   이 위 구간은 레버로도 지금은 무리다. 거짓 희망을 만들지 않기 위해 반드시 같이 그린다.
   debts를 빈 객체로 비운다. debt만 0으로 두면 종류별 잔액이 합계에 남는다. */
export function ceilingAt(productKey, lever, capOverride = null) {
  return limitAt(productKey, { ...lever, debt: 0, debts: {}, income: lever.incomeMax }, capOverride);
}
