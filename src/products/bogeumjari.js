/* 보금자리론 규칙 데이터 — ✏️ 전부 가상 숫자! 현직 지식으로 교체할 것.
   디딤돌과 같은 DSL을 쓴다(engine.judgeRule이 그대로 판정한다).
   디딤돌과의 차이는 여기 상한 숫자와 data.PRODUCTS.bogeumjari의 금융 파라미터에만 있다
   — 특히 offsetsRoomDeduction: true (MCG로 방공제 상쇄). */
export const BOGEUMJARI_RULES = [
  {
    key: "bogeumjari", product: "bogeumjari", name: "보금자리론", enabled: true,
    requires: [
      { flags: ["noHome"], label: "무주택" },
    ],
    incomeCap: [
      { when: ["hasNewborn"], value: 13000, label: "신생아" },
      { when: ["newlywed"], value: 10000, label: "신혼" },
      { when: ["twoPlusMinors"], value: 9000, label: "미성년 2자녀 이상" },
      { when: [], value: 7000, label: "기본" },
    ],
    priceCap: [{ when: [], value: 60000, label: "기본" }],
    areaCap: null, // 보금자리는 면적 요건 없음
    loanCap: [
      { when: [["newlywed", "twoPlusMinors", "hasNewborn"]], value: 40000, label: "우대" },
      { when: [], value: 36000, label: "기본" },
    ],
    note: "심사 조건은 간편하지만, 금리가 디딤돌보다 높아요. 방 공제를 보전받을 수 있단 장점도 있어요!",
  },
];
