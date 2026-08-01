/* 데이터·상수만 두는 곳. 계산은 engine.js, 화면은 각 컴포넌트 파일.
   여기에 로직(함수)을 넣지 말 것 — 중복 정의의 시작점이 된다.
   상품별 '자격 상한 규칙'은 src/products/* 로 나갔다. 여기 남은 건 금융 파라미터뿐. */

/* ✏️ 여기 1 — DATA : 노원구 단지 (가격 만원) */
export const DATA = [
  { id: 1,  name: "상계주공3단지",  dong: "상계동", areaM2: 41, price: 35000,  x: 22, y: 20 },
  { id: 2,  name: "상계주공9단지",  dong: "상계동", areaM2: 46, price: 43000,  x: 30, y: 30 },
  { id: 3,  name: "상계주공16단지", dong: "상계동", areaM2: 49, price: 46000,  x: 16, y: 38 },
  { id: 4,  name: "불암현대",       dong: "상계동", areaM2: 59, price: 55000,  x: 42, y: 22 },
  { id: 5,  name: "중계주공5단지",  dong: "중계동", areaM2: 59, price: 62000,  x: 56, y: 50 },
  { id: 6,  name: "하계1청구",      dong: "하계동", areaM2: 84, price: 78000,  x: 60, y: 74 },
  { id: 7,  name: "상계주공4단지",  dong: "상계동", areaM2: 84, price: 81500,  x: 34, y: 42 },
  { id: 8,  name: "중계무지개",     dong: "중계동", areaM2: 84, price: 92000,  x: 64, y: 42 },
  { id: 9,  name: "포레나노원",     dong: "상계동", areaM2: 84, price: 99000,  x: 48, y: 32 },
  { id: 10, name: "중계청구3차",    dong: "중계동", areaM2: 85, price: 115000, x: 68, y: 52 },
];

/* ✏️ 여기 2 — RULE : 예산 계산 (노원=비규제 가정) */
export const RULE = { LTV: 0.70, roomDeduction: 5500, DSR: 0.40, loanRate: 0.04, loanYears: 30, creditRate: 0.055, creditYears: 5, seoulCap: null };
export const AMBER_BAND = 0.10;

/* ✏️ 여기 2-b — 조종간(Strategy) 레버의 움직임 범위. 전부 가상값 — 실제 관행으로 교체.
   가정 금리·만기는 여기 두지 않는다(RULE.creditRate / RULE.creditYears가 유일한 출처). */
export const LEVER = {
  /* 부채는 '잔액' 하나만 받는다. 두 잣대 모두 잔액에서 출발하기 때문 —
     디딤돌 DTI는 잔액 × 추정금리(이자만), 은행 DSR은 잔액을 원리금으로 환산. 월상환액은 안 묻는다. */
  debtPills: [0, 1000, 3000, 5000, 10000, 20000],     // 대출 잔액 합계 '대충' 선택지(만원). 마지막 칸은 '이상'
  incomeHeadroom: 4000,                               // 소득 레버가 위로 열리는 폭(만원). 상품 소득상한에서 잘린다
  incomeStep: 100,
};

/* ✏️ 여기 3 — 상품 금융 파라미터 (전부 가상 숫자! 현직 지식으로 교체)
   key = src/products/*.js 규칙의 product 필드와 맞춰야 한다.
   ⚠️ 자격 상한(소득·가격·면적·한도)은 여기 두지 말 것 — src/products/* 의 규칙 데이터가 유일한 출처다. */
export const PRODUCTS = {
  didimdol: {
    /* capacityModel: "fundDTI" = 상환한도를 은행 DSR식이 아니라 디딤돌 DTI식으로 계산한다
       (engine.didimdolDtiLimit). 그래서 이 상품엔 ratio(DSR비율)가 없다 — DTI상한은 DIDIMDOL_DTI.cap. */
    key: "didimdol", name: "디딤돌대출", rateLabel: "연 2~3%대", capacityModel: "fundDTI",
    calcRate: 0.030, LTV: 0.70, offsetsRoomDeduction: false, cap: 25000, leadTime: "약 2개월",
    guide: {
      prepare: ["소득 증빙(원천징수/소득금액증명)", "무주택 확인(세대 전원 등본·전입세대열람)", "혼인·가족관계증명(해당 시)"],
      ask: ["제 소득으로 디딤돌 대상이 되나요?", "이 단지 전용면적·매매가가 요건 안에 드나요?"],
      fallback: ["가격·면적·소득 상한 중 하나라도 넘으면 보금자리론 가능 여부를 이어서 물어보세요."],
    },
  },
  bogeumjari: {
    key: "bogeumjari", name: "보금자리론", rateLabel: "연 3~4%대",
    calcRate: 0.038, ratio: 0.60, LTV: 0.70, offsetsRoomDeduction: true, cap: 36000, leadTime: "약 1.5~2개월",
    guide: {
      prepare: ["소득 증빙", "무주택/1주택 확인 서류", "매매계약서"],
      ask: ["제 조건에서 보금자리론 한도는 얼마까지 나오나요?", "MCG로 방공제 상쇄하면 한도가 얼마나 늘어나나요?"],
      fallback: ["가격 상한을 살짝 넘으면 일반 은행 주담대와 한도를 비교해달라고 하세요."],
    },
  },
};

/* ══════════════════════════════════════════════════════════════════════════
   ✏️ 여기 3-a — 디딤돌 DTI 산정 파라미터  (은행 DSR과 식이 다르다)

   디딤돌은 DSR이 아니라 DTI로 상환한도를 본다:
     DTI(%) = ( ① 디딤돌 대출 자체의 연간 원리금상환액 + ② 기타부채 × 추정금리 ) / 연소득 × 100
     ① 원리금균등, 만기는 30년으로 강제(years)
     ② 기존 부채는 원금 상환 스케줄을 보지 않는다 — 잔액에 추정금리를 곱한 '이자만'
   계산식은 engine.didimdolDtiLimit 하나에만 있다. 은행 DSR(engine.repaymentCapacity)과 섞지 말 것.

   ⚠️⚠️⚠️ ESTIMATED_DEBT_RATE (= 추정금리_현재값) 는 갱신이 필요한 값이다 ⚠️⚠️⚠️
   정의: 한국은행 고시 「예금은행 가중평균 가계대출금리(잔액기준)」 + 1.00%p
   이 고시값은 매달 바뀐다. 지금 값은 3.0% 가정치이므로 실제 고시값으로 교체할 것.
   갱신 방법: 아래 숫자 하나만 고치면 디딤돌 DTI 계산 전체에 반영된다(다른 곳에 복제하지 말 것).
   확인처: 한국은행 경제통계시스템(ECOS) 예금은행 가중평균금리 — 가계대출 잔액기준.
   ══════════════════════════════════════════════════════════════════════════ */
export const ESTIMATED_DEBT_RATE = 0.030;   // 한국은행 고시 + 1%p → 주기적 갱신 필요 (지금은 3.0% 가정)

export const DIDIMDOL_DTI = {
  cap: 0.60,    //  — DTI상한은 60%
  years: 30,    // 디딤돌 자체 원리금은 만기 30년으로 강제해서 계산한다.
};

/* ✏️ 여기 3-b — 배우자 세전 연소득 밴드 (전부 가상 숫자! 실제 기금 소득상한에 맞춰 끊을 것)
   rep = 한도 계산에 쓸 구간 대표값(중앙값), 단위 만원.
   미혼이면 이 질문 자체를 건너뛴다(engine.spouseIncomeOf가 0으로 본다) — "배우자 없음" 선택지는 두지 않는다. */
export const SPOUSE_INCOME_BANDS = [
  { key: "u3000",  label: "~ 3천만원",       rep: 1500 },
  { key: "3to5",   label: "3천만원 ~ 5천만원",  rep: 4000 },
  { key: "5to7",   label: "5천만원 ~ 7천만원",  rep: 6000 },
  { key: "o7000",  label: "7천만원 이상",   rep: 8000 },
];
/* ✏️ 밴드 대표값으로 계산한 부부합산이 어느 상품 소득상한의 ±이 값(만원) 안이면
   "경계"로 보고 정밀 입력을 펼친다. 상한 위/아래로 가능 목록 자체가 갈리는 구간이라서. */
export const INCOME_EDGE_MARGIN = 1000;

/* 무주택은 기금상품의 진입 게이트다. 여기서 막히면 뒤 질문은 물어볼 필요가 없다. */
export const NO_HOME_EXCEPTION = `이런 경우는 주택 수에 합산되지 않아요. \n 오피스텔, 25평 미만 단독주택(수도권 제외) 등, 무주택 여부에 대해 알고 싶다면 클릭하세요.`;


/* ── 화면 상수 ── */
export const C = { bg: "#F4F6F3", panel: "#FFFFFF", ink: "#1E2A24", inkSoft: "#5B6660", line: "#E4E9E4", green: "#2E9E6B", greenDeep: "#14705A", amber: "#E0A23A", greyDot: "#CBD1CE" };
export const COLOR_VALUE = { green: C.green, amber: C.amber, grey: C.greyDot };
export const COLOR_TEXT = { green: "예산 안에 들어와요", amber: "경계선이에요", grey: "지금은 예산을 넘어요" };
export const DONG_LABELS = [{ name: "상계동", x: 28, y: 15 }, { name: "중계동", x: 66, y: 40 }, { name: "하계동", x: 60, y: 66 }];
export const TABS = [{ key: "gov", label: "정부" }, { key: "bank", label: "은행" }];
