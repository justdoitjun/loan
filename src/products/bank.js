/* 은행 일반 주택담보대출 규칙 데이터 — 출처 `.claude/rules/products/bank/bank.md`.
   디딤돌과 같은 DSL(engine.judgeRule이 그대로 판정). 다른 점은 딱 하나 —
   **상한이 없다.** 소득·가격·면적·상품 한도 전부 null → judgeRule이 그 검사를 만들지 않는다.
   갈리는 건 진입 조건(주택 보유 상태 = LTV 표의 행)뿐이고, 금액은 Min(LTV, DSR, 지역별 cap)이 정한다
   (금융 파라미터는 data.PRODUCTS.bank, 지역별 cap은 data.REGION_CAP).

   플래그(engine.deriveFacts): noHome(무주택) · disposing(1주택 처분조건부) → LTV 70%
                              oneHome & !disposing(1주택 유지) · multiHome(2주택+) → 수도권 LTV 0% = 닫힘 */
export const BANK_RULES = [
  {
    key: "bankMortgage", product: "bank", name: "일반 주택담보대출", enabled: true,
    requires: [
      { flags: [["noHome", "disposing"]], label: "무주택 또는 처분조건부 1주택 (1주택 유지·다주택은 수도권 LTV 0%)" },
    ],
    incomeCap: [{ when: [], value: null, label: "소득상한 없음" }],
    priceCap:  [{ when: [], value: null, label: "가격상한 없음" }],
    areaCap: null,
    loanCap:   [{ when: [], value: null, label: "상품 한도 없음 — 지역별 한도만" }],
    note: "담보와 상환능력이 전부예요. 금리는 정부대출보다 높지만 실행이 빨라 잔금일이 급하면 이쪽이 열려요.",
  },
];
