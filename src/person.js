/* 사람 상태 — "이 사람이 누구인가"의 스키마와 순수 판단이 전부 여기 있다. 매물은 여기 없다.
   ⚠️ 이 파일에 매물(가격·면적·좌표)이 들어오는 순간 이 구조는 무너진다.
      매물별로 달라지는 건 verdict.judgeUnit이 인자로 받아서 처리한다.
   ⚠️ JSX·React를 import하지 말 것. 이 파일이 화면에 묶이면 verdict.js도 같이 묶여서
      "순수 함수인데 화면 없이는 못 돌린다"가 된다. 여기는 데이터와 함수만 둔다.

   왜 나눴나 — 자격 조건(가족·무주택·생애최초·결혼·소득)과 레버(부채 가정·소득 가정)는
   매물이 바뀌어도 그대로다. 매물마다 다른 건 가격·면적뿐이다. 그래서 사람은 앱 최상위에
   한 벌만 두고, 매물별 판정은 (매물 + 이 사람) → 결과인 순수 함수로 전부 돌린다.
   그래야 지도 전체를 동시에 다시 칠할 수 있고, 다른 매물을 골라도 재질문이 없다.

   소유: App.jsx가 useState로 EMPTY_PERSON 하나를 들고 있다. 각 화면은 자기 조각만 받아 쓴다.
     Eligibility  → elig       (자격 답변)
     DetailInfo   → detail     (부채 잔액 · 소득의 질)
     Strategy     → pull       (레버를 당긴 값) ⚠️ 로컬 state 아님 — 화면을 나가도 유지된다
     IncomeCheck  → incomeCheck(소득 신뢰도 자가진단)
     예산 화면     → ownIncome, cash */
import { LEVER } from "./data.js";
import { ageOf, spouseIncomeOf } from "./engine.js";

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/* ══════════════════════════════════════════════════════════════════════════
   1) 자격 답변 (Eligibility 화면이 채운다)
   ⚠️ 필드 이름은 engine.deriveFacts가 읽는 이름이다. 바꾸려면 거기도 같이 본다.
   ══════════════════════════════════════════════════════════════════════════ */
export const EMPTY_ELIG = {
  /* ── 가족정보 카드 — 이 셋이 나이·배우자유무·자녀수·미성년·신생아를 전부 만든다 ── */
  ownBirthday: "",        // 본인 생년월일 → 만나이(단독세대주 후보 / 만39세 이하 판정)
  hasSpouse: null,        // true | false — "배우자 없음" 토글. ⚠️ false여도 결혼예정이면 예비배우자 소득은 묻는다
  spouseBirthday: "",     // 배우자 생년월일. ⚠️ 지금 판정 규칙이 쓰는 값은 아니다(가구 확인용·향후 우대 대비)
  birthdays: [],          // 자녀 생년월일 — 0명부터 동적 추가/삭제

  /* ── 단일 질문 ── */
  homeCount: null,        // 0 = 무주택(진입 게이트). 화면은 네/아니오지만 엔진이 읽는 형식은 그대로 둔다
  firstTime: null,        // 생애최초 — "한 번도 소유한 적 없다". 무주택("지금 없다")과 다른 개념
  marital: null,          // "married" | "planned" | "single"  ← 4버킷이 이 둘로 매핑된다
  marriedWithin7: null,   // marital="married"일 때만: 혼인신고 7년 이내면 true → 신혼가구
  marriedDate: "",        // 이 화면에선 안 받는다(버킷으로 대체). 정밀 확인이 필요해지면 여기에 채운다
  weddingDate: "",        // 결혼예정 3개월 이내 판정용 — 추후 세부 확인 단계에서 받는다

  /* ── 소득 ── */
  spouseBand: null,       // SPOUSE_INCOME_BANDS의 key (합산할 배우자가 있을 때만)
  spouseIncomeRaw: "",    // 소득상한 경계일 때만 받는 정밀값(만원)

  /* ── 그 외 ── */
  hasDreamAccount: null,  // 청년 주택드림 통장 (만39세 이하에게만 묻는다)
};

/* 미래 날짜·빈칸을 걸러낸다. 아이 생년월일이 내일이면 나이가 음수가 되는데, 그걸 '입력 완료'로 보면 안 된다. */
export const filledAge = (d) => { const a = ageOf(d); return a !== null && a >= 0 ? a : null; };

/* 결혼여부 4버킷 중 지금 고른 것. 화면의 라벨·설명은 Eligibility.MARITAL_BUCKETS가 갖는다
   — 여기는 key만 안다(문구가 바뀌어도 판단이 안 흔들리게). */
export const bucketOf = (elig) => {
  if (elig.marital === "single") return "none";
  if (elig.marital === "planned") return "planned";
  if (elig.marital === "married") return elig.marriedWithin7 === true ? "new7" : elig.marriedWithin7 === false ? "over7" : null;
  return null;
};

/* ── 질문 진행 상태 ──
   지도가 "정밀 재채색 모드로 갈 수 있나"를 판단하려면 자격 답변이 다 찼는지를 알아야 하는데,
   그 판단이 컴포넌트 안에만 있으면 App이 같은 조건을 또 쓰게 된다(= 두 벌이 되고 반드시 어긋난다).
   elig 하나만 보고 결정된다 — 매물·소득과 무관하다. */
export function eligSteps(elig) {
  const gateOpen = elig.homeCount === 0;

  /* 배우자는 두 갈래로 본다. 하나로 합치면 결혼예정자의 소득이 통째로 0이 된다.
       spouseDeclared = 가족정보 카드에서 직접 "있다"고 답한 것 → 버킷 모순 차단에만 쓴다.
       spouseCounted  = 소득을 합산할 상대가 있는가 → 결혼예정이면 예비배우자가 있다고 간주한다.
     engine.spouseIncomeOf는 marital !== "single"이면 배우자 소득을 합산한다(결혼예정 포함).
     그런데 화면이 "배우자 없음"만 보고 소득 질문을 건너뛰면 그 합산분이 0으로 들어가서,
     부부합산소득이 실제보다 낮게 잡히고 소득상한을 잘못 통과한다 — 없는 초록을 만든다. */
  const spouseDeclared = elig.hasSpouse === true;
  const spouseCounted = spouseDeclared || elig.marital === "planned";

  // 1) 가족정보: 배우자 생년월일은 판정에 안 쓰므로 진행을 막지 않는다 — 비워도 다음으로 간다.
  const childrenFilled = elig.birthdays.every((d) => filledAge(d) !== null);
  const familyReady = filledAge(elig.ownBirthday) !== null && elig.hasSpouse !== null && childrenFilled;
  // 2) 무주택 게이트 → 3) 생애최초 → 4) 결혼여부
  const askFirstTime = familyReady && gateOpen;
  const askMarital = askFirstTime && elig.firstTime !== null;
  const maritalReady = bucketOf(elig) !== null;
  // 5) 소득 — 합산할 상대가 없을 때만 건너뛴다
  const askIncome = askMarital && maritalReady;
  const incomeReady = !spouseCounted || elig.spouseBand !== null;
  /* 6) 청년 주택드림 — 만39세 이하에게만 묻는다(40대에겐 어차피 안 열리는 대출).
        facts.under39와 같은 판단이지만 여기선 elig만 보고 낸다 — ctx(매물 필요)를 안 쓰기 위해서다. */
  const age = filledAge(elig.ownBirthday);
  const needsDream = age !== null && age <= 39;
  const dreamReady = !needsDream || elig.hasDreamAccount !== null;

  return {
    gateOpen, spouseDeclared, spouseCounted, familyReady, askFirstTime, askMarital,
    askIncome, incomeReady, needsDream, dreamReady,
    ready: askIncome && incomeReady && dreamReady,
  };
}

/* 자격 답변이 다 찼는가 = 이 사람에 대해 상품 판정을 돌릴 수 있는가. */
export const eligReady = (elig) => eligSteps(elig).ready;

/* ══════════════════════════════════════════════════════════════════════════
   2) 부채 · 소득의 질 (DetailInfo가 채운다) — 레버의 시작 위치
   ══════════════════════════════════════════════════════════════════════════ */
/* debt는 0(왼쪽 끝)에서 시작 — 무부채도 유효한 값이라 처음부터 실제 값으로 둔다
   ("답 안 함"을 표현하는 건 debtConfirmed의 역할이다). */
export const EMPTY_DETAIL = { debt: 0, debtConfirmed: false, incomeQuality: { type: null, stable: null } };

/* 레버를 그릴 수 있는가. 부채는 값이 아니라 '확정 여부'로 본다
   — 슬라이더를 만지작거리는 중간값으로 레버가 그려지면 안 된다.

   ⚠️ 지금 DetailInfo는 '소득의 질'을 묻지 않는다(그 블록이 주석 처리돼 있다).
      여기서 incomeTrust(d.incomeQuality) !== null 을 같이 요구하면, 물어보지도 않는 답을
      기다리느라 ready가 영원히 false가 되고 조종간(레버·천장) 전체가 렌더되지 않는다.
      → 소득의 질 질문을 되살리면 그 답변 완료를 여기 조건에 다시 붙일 것. */
export const detailReady = (d) => d.debtConfirmed === true;

/* ══════════════════════════════════════════════════════════════════════════
   3) 소득 신뢰도 자가진단 (IncomeCheck가 채운다)
      결과 판정(incomeCheckResult)은 규정 데이터가 필요해서 IncomeCheck.jsx가 갖는다.
   ══════════════════════════════════════════════════════════════════════════ */
export const EMPTY_INCOME_CHECK = { groupKey: null, typeKey: null, answers: {} };

/* ══════════════════════════════════════════════════════════════════════════
   4) 사람 상태 전체
   ══════════════════════════════════════════════════════════════════════════ */
export const EMPTY_PERSON = {
  /* 예산 화면에서 받는 값 (만원) */
  ownIncome: 0,
  cash: 0,
  /* ⚠️ 배우자 소득은 elig.spouseBand에 있다. 본인 소득(ownIncome)과 출처가 다르다 —
        본인은 예산 화면 슬라이더, 배우자는 자격 화면 밴드. 합치는 건 engine.buildCtx의 일이다. */
  elig: EMPTY_ELIG,
  detail: EMPTY_DETAIL,
  /* 레버를 당긴 값 { debt, income } · null = 아직 한 번도 안 당김(유도 애니메이션 신호).
     시작 위치(detail)와 당긴 값(pull)을 따로 두는 이유: "얼마나 움직였나"(= 행동 번역)를
     둘의 차이로 계산하기 때문. 하나로 합치면 '원래 얼마였는지'가 사라진다. */
  pull: null,
  incomeCheck: EMPTY_INCOME_CHECK,
};

/* 이 사람에 대해 상품 자격 판정을 돌릴 수 있는가 = 지도를 정밀 재채색해도 되는가.
   부채·레버는 조건이 아니다 — 안 받았으면 무부채로 가정하고 계산한다(기존 '천장' 잣대와 같다). */
export const personReady = (person) => eligReady(person.elig);

/* 부부합산 소득 (만원). 본인(예산 화면) + 배우자(자격 화면 밴드). */
export const totalIncomeOf = (person) => person.ownIncome + spouseIncomeOf(person.elig);

/* ── 사람 상태 → 레버 값 ──
   products/limit.js가 요구하는 계약 { price, income, incomeMax, debt }를 만든다.
   가격만 매물에서 오고 나머지는 전부 사람에게서 온다 — 이 함수가 그 경계다.

   incomeCap = 이 상품의 소득상한(만원). 넘기면 소득 레버가 거기서 잘린다 —
   소득을 더 올리면 한도가 느는 게 아니라 '자격'이 닫히기 때문이다(거짓 희망 방지).
   지도처럼 상품이 하나로 정해지지 않은 자리에선 안 넘긴다(LEVER.incomeHeadroom까지만).

   pulled=false로 부르면 '당기기 전' 시작 위치가 나온다 — 행동 번역의 기준선. */
export function leverOf(person, price, incomeCap = null, pulled = true) {
  const income = totalIncomeOf(person);
  /* 이미 소득상한을 넘었으면 상한이 현재 소득보다 낮게 나온다 → 레버 범위가 뒤집히지 않게 바닥을 깐다.
     (그 경우 incomeRoom이 0이 되고, 화면은 "소득 레버는 올릴 데가 없어요"로 넘어간다) */
  const incomeMax = Math.max(Math.min(incomeCap ?? Infinity, income + LEVER.incomeHeadroom), income);
  /* 확정 전엔 부채를 0으로 본다 — 슬라이더를 만지작거리는 중간값으로 지도가 흔들리면 안 된다. */
  const debtBase = person.detail.debtConfirmed ? person.detail.debt : 0;
  const pull = pulled ? person.pull : null;
  return {
    price,
    income: clamp(pull?.income ?? income, income, incomeMax),
    incomeMax,
    debt: clamp(pull?.debt ?? debtBase, 0, debtBase),
  };
}
