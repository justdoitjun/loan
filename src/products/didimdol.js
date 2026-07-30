/* 디딤돌 5종 규칙 데이터 (2026.05.26 기준) — ✏️ 전부 가상 숫자! 현직 지식으로 교체할 것.
   규제가 바뀌면 이 배열만 고친다. 판정 함수(engine.judgeRule)는 손대지 않는다.
   금액 단위: 만원. 면적: ㎡.

   조건 표기 DSL (함수가 아니라 '플래그 이름'으로 쓴다 — 데이터 파일에 로직을 두지 않기 위해):
     []                     → 항상 참 (기본 티어)
     ["a", "b"]             → a AND b
     ["a", ["b", "c"]]      → a AND (b OR c)
   플래그는 engine.deriveFacts()가 만든다. 새 조건이 필요하면 거기에 추가.

   product = data.PRODUCTS의 키. 금리·LTV·방공제상쇄·실행시점 같은 '금융 파라미터'는
   거기서 가져온다. 여기 있는 건 '자격 상한'뿐 — 두 곳에 같은 숫자를 두지 않는다.

   incomeCap / priceCap / loanCap 은 '조건별 티어' 배열이다.
   ⚠️ 위에서부터 첫 번째로 매치되는 티어가 적용된다 — 유리한 조건을 위에 둘 것. */
export const DIDIMDOL_RULES = [
  {
    key: "general", product: "didimdol", name: "일반가구", enabled: true,
    requires: [
      { flags: ["noHome"], label: "무주택" },
      { flags: [["hasDependents", "adult30Sole"]], label: "세대주(부양가족 있거나 만30세 이상 단독세대주)" },
    ],
    incomeCap: [
      { when: ["newlywed"], value: 8500, label: "신혼" },
      { when: [["firstTime", "twoPlusMinors"]], value: 7000, label: "생애최초 또는 미성년 2자녀 이상" },
      { when: [], value: 6000, label: "기본" },
    ],
    priceCap: [
      { when: [["newlywed", "twoPlusMinors"]], value: 60000, label: "신혼 또는 미성년 2자녀 이상" },
      { when: ["adult30SoleSingle"], value: 30000, label: "만30세 이상 단독세대주(미혼)" },
      { when: [], value: 50000, label: "기본" },
    ],
    areaCap: 85,
    loanCap: [
      { when: [["newlywed", "twoPlusMinors"]], value: 32000, label: "신혼 또는 미성년 2자녀 이상" },
      { when: ["adult30SoleSingle", "firstTime"], value: 20000, label: "만30세 이상 단독세대주 + 생애최초" },
      { when: ["adult30SoleSingle"], value: 15000, label: "만30세 이상 단독세대주(미혼)" },
      { when: ["firstTime"], value: 24000, label: "생애최초" },
      { when: [], value: 20000, label: "기본" },
    ],
    note: "가장 기본 경로예요. 우대 조건이 붙을수록 상한과 한도가 같이 올라가요.",
  },
  {
    key: "firstNewlywed", product: "didimdol", name: "생애최초 신혼가구", enabled: true,
    requires: [
      { flags: ["noHome"], label: "무주택" },
      { flags: ["firstTime"], label: "생애최초" },
      { flags: [["newlywed", "weddingSoon"]], label: "혼인 7년 이내 또는 결혼예정 3개월 이내" },
    ],
    incomeCap: [{ when: [], value: 8500, label: "생애최초 신혼" }],
    priceCap: [{ when: [], value: 60000, label: "생애최초 신혼" }],
    areaCap: 85,
    loanCap: [{ when: [], value: 32000, label: "생애최초 신혼" }],
    note: "결혼 예정이어도 3개월 이내면 잡혀요. 예식일·혼인신고일 증빙을 미리 챙기세요.",
  },
  {
    key: "newborn", product: "didimdol", name: "신생아 특례", enabled: true,
    requires: [
      { flags: ["noHome"], label: "무주택" },
      { flags: ["hasNewborn"], label: "2년 이내 출생 + 2023.1.1 이후 출생아" },
    ],
    incomeCap: [
      /* 맞벌이는 2억까지 보되, 한 사람이 1.3억을 넘으면 불가 → perPersonCap으로 표현 */
      { when: ["dualIncome"], value: 20000, perPersonCap: 13000, label: "맞벌이" },
      { when: [], value: 13000, label: "외벌이" },
    ],
    priceCap: [{ when: [], value: 90000, label: "신생아 특례" }],
    areaCap: null, // 면적 요건은 이번 데이터에 없음 → 검사하지 않는다
    loanCap: [{ when: [], value: 40000, label: "신생아 특례" }],
    note: "소득 문턱이 가장 높은 경로예요. 아이 출생일이 기준이라 시점을 꼭 확인하세요.",
  },
  {
    key: "youthDream", product: "didimdol", name: "청년 주택드림", enabled: true,
    requires: [
      { flags: ["noHome"], label: "무주택" },
      { flags: ["hasDreamAccount"], label: "주택드림 통장 청약당첨 + 통장 연계" },
      { flags: ["under39"], label: "만 39세 이하" },
    ],
    incomeCap: [
      { when: ["newlywed"], value: 10000, label: "신혼" },
      { when: [], value: 7000, label: "미혼" },
    ],
    priceCap: [{ when: [], value: 60000, label: "청년 주택드림" }],
    areaCap: null,
    loanCap: [
      { when: ["newlywed"], value: 40000, label: "신혼" },
      { when: [], value: 30000, label: "미혼" },
    ],
    note: "통장 연계가 전제예요. 통장이 없으면 이 경로는 안 열려요.",
  },
  {
    key: "jeonseVictim", product: "didimdol", name: "전세사기피해자 전용", enabled: false, // ✏️ MVP 제외. true로 바꾸면 판정에 포함된다.
    requires: [
      { flags: ["noHome"], label: "무주택" },
      { flags: ["jeonseVictim"], label: "전세사기피해자 확인" },
    ],
    incomeCap: [{ when: [], value: 7000, label: "전세사기피해자" }],
    priceCap: [{ when: [], value: 50000, label: "전세사기피해자(주거용 오피스텔 포함)" }],
    areaCap: null,
    loanCap: [{ when: [], value: 40000, label: "전세사기피해자" }],
    note: "피해자 결정문 등 별도 확인이 필요해요. 지금은 판정에서 꺼둔 상태예요.",
  },
];
