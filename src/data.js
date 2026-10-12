/* 데이터·상수만 두는 곳. 계산은 engine.js, 화면은 각 컴포넌트 파일.
   여기에 로직(함수)을 넣지 말 것 — 중복 정의의 시작점이 된다.
   상품별 '자격 상한 규칙'은 src/products/* 로 나갔다. 여기 남은 건 금융 파라미터뿐.
   매물(단지)은 여기 없다 — src/data/seoul/units_YYYYMMDD.json(시세 export)을 src/units.js 가 UNITS 로 바꾼다. */

/* 첫 화면 지역(시·구·동)은 src/data/geo/geo_code.js(법정동 코드표) → src/geo.js. */

/* ✏️ 여기 2-a — 지역 (출처 .claude/rules/_policy.md · LTV 표는 products/_common.md)
   regulated = 규제지역 / metroOther = 규제지역 외 수도권 / local = 지방.
   서울 전역은 규제지역. 은행 LTV 행은 engine.regulatoryLtv가 이 키로 LTV_TABLE을 읽는다. */
export const REGION = "regulated";
export const REGION_LABEL = { regulated: "규제지역", metroOther: "규제지역 외 수도권", local: "지방" };

/* 은행 규제 LTV. 열 = 지역, 행 = 차주. 비율. 숫자의 출처는 products/_common.md.
   여러 행에 맞으면 engine.regulatoryLtv가 높은 비율을 고른다. 디딤돌·보금자리는 이 표를 안 탄다. */
export const LTV_TABLE = {
  regulated:  { firstTime: 0.70, realDemand: 0.60, noHome: 0.40, disposing: 0.40, oneHome: 0, multiHome: 0 },
  metroOther: { firstTime: 0.70, realDemand: 0.60, noHome: 0.70, disposing: 0.70, oneHome: 0, multiHome: 0 },
  local:      { firstTime: 0.80, realDemand: 0.80, noHome: 0.70, disposing: 0.60, oneHome: 0.60, multiHome: 0.60 },
};

/* 서민·실수요. 셋이 모두 맞을 때만 LTV_TABLE의 realDemand 행. 단위는 만원. */
export const REAL_DEMAND = { incomeCap: 9000, priceCap: 80000 };

/* ✏️ 여기 2 — RULE : 예산 계산.
   LTV는 차주 유형을 모르므로 그 지역 일반차주(무주택) 행. 은행 상품 한도는 regulatoryLtv가 다시 고른다. */
export const RULE = {
  LTV: LTV_TABLE[REGION].noHome, roomDeduction: 5500, DSR: 0.40, loanRate: 0.04, loanYears: 30, creditRate: 0.055, creditYears: 5,
};

/* 지역별 주담대 한도 (만원). 담보가격 구간(upTo 이하)에 따라 갈린다 — 위에서부터 첫 매치.
   null = 제한 없음(그 항이 Min에서 빠진다). 정부상품은 이 표를 안 탄다(PRODUCTS[key].regionCapped 없음).
   이주비·중도금 행은 미구현. 읽는 곳은 engine.regionCapOf 하나. */
export const REGION_CAP = [
  { upTo: 150000, cap: { regulated: 60000, metroOther: 60000, local: null } },
  { upTo: 250000, cap: { regulated: 40000, metroOther: 40000, local: null } },
  { upTo: Infinity, cap: { regulated: 20000, metroOther: 20000, local: null } },
];
/* 기존 대출 종류. DetailInfo(입력)와 Strategy(얼마를 줄일지)는 이 배열만 그린다.
   종류를 늘리거나 줄이려면 여기만 고친다. key는 저장 키라서 바꾸면 그 값은 사라진다.
   max는 확정 전 입력 천장(만원)이다. 규제 한도도 DSR 산식도 아니다.
   빼면 LEVER.debtMax를 쓴다. step을 빼면 LEVER.debtStep.
   dsr은 은행이 이 금액을 1년 상환액으로 볼 때의 파라미터다. 함수는 두지 않는다.
   계산은 engine_bank_dsr.js. 디딤돌 DTI는 이 필드를 읽지 않는다.
     method "principalPlusInterest"  잔액 ÷ years + 이자. years를 빼면 5년.
     method "interest"               이자만. 원금은 넣지 않는다.
     method "principal"              잔액 ÷ years. 이자는 넣지 않는다.
     method "actual"                 실제 1년 원리금. 잔액으로 나누지 않는다.
   월상환액·만기 필드를 넣지 말 것. 화면에서 묻지 않는 값이다. */
export const DEBT_KINDS = [
  // 신용과 같은 식. 입력값은 사용액이 아니라 한도 전액. 이자는 실제 금리 + 스트레스 금리.
  { key: "minus", label: "마이너스통장 한도", max: 20000, dsr: { method: "principalPlusInterest", years: 5 } },
  // 원금은 잔액 ÷ 5년. 이자는 실제 금리 + 스트레스 금리. 실제 금리는 engine_bank_dsr.js TODO.
  { key: "credit", label: "신용대출 잔액", max: 30000, dsr: { method: "principalPlusInterest", years: 5 } },
  // 원금은 넣지 않는다. 이자는 실제 금리 + 스트레스 금리.
  { key: "jeonse", label: "전세대출 잔액", max: 80000, dsr: { method: "interest" } },
  // 실제 갚는 1년 원리금. 잔액을 만기로 나누지 않는다.
  { key: "mortgage", label: "주택담보 잔액", max: 150000, dsr: { method: "actual" } },
  // 원금은 잔액 ÷ 8년. 이자는 실제 금리 + 스트레스 금리.
  { key: "nonHome", label: "비주택 담보 잔액", max: 30000, dsr: { method: "principalPlusInterest", years: 8 } },
  // TODO: 카드대출 원금은 약정만기, 최장 3년. 만기를 안 물어 3년으로 고정. 보험사 대출도 이 칸에 있다.
  { key: "cardIns", label: "카드사/보험사 대출", max: 10000, dsr: { method: "principal", years: 3 } },
  // 원금만 잔액 ÷ 3년.
  { key: "auto", label: "자동차 대출 잔액", max: 15000, dsr: { method: "principal", years: 3 } },
];

/* ✏️ 여기 2-b — 조종간(Strategy) 레버의 움직임 범위. 전부 가상값 — 실제 관행으로 교체.
   가정 금리·만기는 여기 두지 않는다(RULE.creditRate / RULE.creditYears가 유일한 출처). */
export const LEVER = {
  /* 줄이기 슬라이더의 최댓값은 종류별로 확정한 금액이다(0까지 줄일 수 있다).
     debtMax·debtStep은 종류 항목에 max·step이 없을 때의 입력 범위(만원). 정책 한도가 아니다.
     소득 레버 최댓값 = 3억(상품 소득상한이 더 낮으면 거기서 자른다). */
  debtMax: 30000,
  debtStep: 100,
  incomeMax: 30000,
  incomeStep: 100,
};

/* ✏️ 여기 3 — 상품 금융 파라미터 (전부 가상 숫자! 현직 지식으로 교체)
   key = src/products/*.js 규칙의 product 필드와 맞춰야 한다.
   ⚠️ 자격 상한(소득·가격·면적·한도)은 여기 두지 말 것 — src/products/* 의 규칙 데이터가 유일한 출처다. */
export const PRODUCTS = {
  didimdol: {
    /* capacityModel: "fundDTI" = 상환한도를 은행 DSR식이 아니라 디딤돌 DTI식으로 계산한다
       (engine.didimdolDtiLimit). 그래서 이 상품엔 ratio(DSR비율)가 없다 — DTI상한은 DIDIMDOL_DTI.cap.
       ⚠️ calcRate도 없다. 디딤돌 원리금 계산 금리는 아래 DIDIMDOL_LOAN_RATE 한 곳에만 둔다
          (기타부채 추정금리 ESTIMATED_DEBT_RATE와 구분하기 위해서다). 여기 되살리지 말 것. */
    key: "didimdol", name: "디딤돌대출", rateLabel: "연 2~3%대", capacityModel: "fundDTI",
    /* 상품 고유 LTV. 규제지역 은행 표(LTV_TABLE)와 별개 — didimdol.md. MVP는 70%만. */
    LTV: 0.70, offsetsRoomDeduction: false, cap: 20000, leadTime: "약 2개월",
  },
  bogeumjari: {
    key: "bogeumjari", name: "보금자리론", rateLabel: "연 3~4%대",
    /* ⚠️ 스텁. 규제지역 은행 표를 타지 않는다(bogeumjari.md). */
    calcRate: 0.038, ratio: 0.60, LTV: 0.70, offsetsRoomDeduction: true, cap: 36000, leadTime: "약 1.5~2개월",
  },
  /* 은행 일반 주담대 — 출처 .claude/rules/products/bank/bank.md. 숫자는 전부 ⚠️ 가정치.
       ratio/calcRate/years = DSR 잣대(engine.repaymentCapacity): 차주단위 40% · 산정만기 30년.
       calcRate = 본건 실제 금리 가정. stressRate = 신규 취급시점 스트레스 금리(3%p). 둘은 다른 숫자다.
       연간 이자와 본건 원리금균등은 (calcRate + stressRate)로 산정한다. 화면 금리(rateLabel)에는 더하지 않는다.
       cap: null = 상품 자체 한도가 없다 → 그 자리는 지역별 cap이 대신 건다(regionCapped: true → REGION_CAP).
       offsetsRoomDeduction: true = MCI 가입으로 방공제 상쇄.
       capacityModel 없음 = 은행 DSR(보수적 기본값). DEBT_VIEW.bank(products/limit.js)가 부채를 원리금으로 본다. */
  bank: {
    key: "bank", name: "일반 주택담보대출", rateLabel: "연 4%대",
    calcRate: RULE.loanRate, stressRate: 0.03, ratio: RULE.DSR, years: RULE.loanYears,
    /* LTV 폴백 = 일반차주. 실제 비율은 ltvFromTable → engine.regulatoryLtv (bank.md 1절). */
    LTV: LTV_TABLE[REGION].noHome, ltvFromTable: true, offsetsRoomDeduction: true, cap: null, regionCapped: true, leadTime: "약 2~4주",
  },
};

/* ══════════════════════════════════════════════════════════════════════════
   ✏️ 여기 3-a — 디딤돌 DTI 산정 파라미터  (은행 DSR과 식이 다르다)

   디딤돌은 DSR이 아니라 DTI로 상환한도를 본다:
     DTI(%) = ( ① 주택담보대출 연간 원리금상환액 + ② 기타부채 연간 이자상환 추정액 ) / 연소득 × 100

     ① = 본건 디딤돌대출 원리금상환액(원리금균등, 만기 years)
          + 동일 금융기관에서 실행예정인 기금 주담대
          + 기존 기금 주담대
          − 상환예정인 주택담보대출
     ② = 기타부채 잔액 × 추정금리
          기타부채 = 주담대 제외 대출(현금서비스 포함) − 상환예정 전세자금대출 − 예적금담보대출
          ⚠️ ②는 원금 상환 스케줄을 보지 않는다 — 잔액 × 금리의 '이자만'.
             그래서 사용자에게 잔액 하나만 물으면 된다.

   MVP 단순화 (의도적. 되살릴 때는 아래 필드에 값을 넣으면 된다):
     ① 본건 디딤돌 원리금만 계산한다. 나머지 세 항은 engine.didimdolDtiLimit의
        otherFundLoanAnnual / repayingMortgageAnnual 인자로 열어두되 기본값 0
        — 기금 주담대 중복 보유는 드문 케이스라 가정.
     ② 입력은 종류별로 받되(DEBT_KINDS), 산식은 아직 그 합계를 '기타 대출 잔액'으로 넣는다.
        전세·주담대를 빼는 구분은 아직 없다. 자리는 engine.combinedDebtBalance.

   계산식은 engine.didimdolDtiLimit 하나에만 있다. 은행 DSR(engine.repaymentCapacity)과 섞지 말 것.
   ══════════════════════════════════════════════════════════════════════════ */

/* ⚠️⚠️⚠️ ESTIMATED_DEBT_RATE (= ②의 추정금리) 는 주기적 갱신이 필요한 값이다 ⚠️⚠️⚠️
   ⚠️⚠️⚠️ 한국은행 고시 기준 — 최신값으로 교체할 것.                       ⚠️⚠️⚠️
   확인처: 한국은행 경제통계시스템(ECOS) 예금은행 가중평균금리 — 가계대출.
   지금 값은 5.34% 가정치다. 여기 숫자 하나만 고치면 디딤돌 DTI 전체에 반영된다
   (다른 파일에 복제하지 말 것). ①의 금리(DIDIMDOL_LOAN_RATE)와는 **다른 값**이다 — 섞지 말 것. */
export const ESTIMATED_DEBT_RATE = 0.0534;

/* ①의 금리 — 본건 디딤돌대출 자체의 원리금을 원리금균등으로 환산할 때 쓴다.
   디딤돌 금리는 소득·만기·우대에 따라 변동하므로 여기 한 곳에서만 가정한다(지금은 3.0% 가정치).
   ⚠️ ②의 ESTIMATED_DEBT_RATE와 목적이 다르다. 하나로 합치지 말 것. */
export const DIDIMDOL_LOAN_RATE = 0.030;

export const DIDIMDOL_DTI = {
  cap: 0.60,    //  — DTI상한은 60%
  /* ①의 산정만기(년). 실제 대출 만기가 몇 년이든 DTI 계산은 이 만기로 강제한다.
     한도 역산(didimdolDtiLimit)과 원리금 정산(didimdolDtiAt)이 같이 읽는 유일한 출처 —
     다른 파일에 30을 적어두지 말 것. 만기를 바꾸면 두 방향이 동시에 따라온다. */
  years: 30,
};

/* ✏️ 여기 3-b — 배우자 세전 연소득 밴드 (전부 가상 숫자! 실제 기금 소득상한에 맞춰 끊을 것)
   rep = 한도 계산에 쓸 구간 대표값(중앙값), 단위 만원.
   short = 밴드 트랙(가로 세그먼트) 안에 들어가는 짧은 표기. label은 선택 후 캡션에 쓴다.
   배우자가 없으면 이 질문 자체를 건너뛴다(engine.spouseIncomeOf가 0으로 본다) — "배우자 없음" 선택지는 두지 않는다. */
export const SPOUSE_INCOME_BANDS = [
  { key: "u3000",  label: "~ 3천만원",       short: "~3천",   rep: 1500 },
  { key: "3to5",   label: "3천만원 ~ 5천만원",  short: "3~5천",  rep: 4000 },
  { key: "5to7",   label: "5천만원 ~ 7천만원",  short: "5~7천",  rep: 6000 },
  { key: "o7000",  label: "7천만원 이상",   short: "7천~",   rep: 8000 },
];
/* ✏️ 밴드 대표값으로 계산한 부부합산이 어느 상품 소득상한의 ±이 값(만원) 안이면
   "경계"로 보고 정밀 입력을 펼친다. 상한 위/아래로 가능 목록 자체가 갈리는 구간이라서. */
export const INCOME_EDGE_MARGIN = 1000;

/* 무주택은 기금상품의 진입 게이트다. 여기서 막히면 뒤 질문은 물어볼 필요가 없다. */
export const NO_HOME_EXCEPTION = `이런 경우는 주택 수에 합산되지 않아요. \n 오피스텔, 25평 미만 단독주택(수도권 제외) 등, 무주택 여부에 대해 알고 싶다면 클릭하세요.`;


/* ── 화면 상수 ──
   브랜드는 KB 옐로. green = 면(#FFCC08). 그 위 글자는 onAccent.
   흰 글자를 노란 면에 올리면 대비가 무너진다.
   greenDeep = 흰 배경 위의 글자·테두리. #FFCC08을 작은 글자에 쓰면 안 보인다.
   amber는 경고라 브랜드 노랑과 겹치지 않게 한 톤 주황으로 둔다. */
export const C = {
  bg: "#F7F6F3", panel: "#FFFFFF", ink: "#2C2824", inkSoft: "#6B645C", faint: "#9A938A",
  line: "#E6E0D4", lineStrong: "#D9D3C6",
  green: "#FFCC08", greenDeep: "#8A6200", onAccent: "#2C2824",
  soft: "#FFF4C2", softer: "#FBF8F1", press: "#E6B400", track: "#EFEBE3",
  amber: "#E08A1E", greyDot: "#C9C3B8",
};
export const DONG_LABELS = [{ name: "상계동", x: 28, y: 15 }, { name: "중계동", x: 66, y: 40 }, { name: "하계동", x: 60, y: 66 }];
export const TABS = [{ key: "gov", label: "정부" }, { key: "bank", label: "은행" }];
