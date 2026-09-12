/* 상품 규칙 데이터의 입구.
   판정 함수는 여기 두지 않는다 — engine.js가 이 배열을 읽어 판정한다(순환 import 방지).
   ✏️ 상품 추가 = 파일 하나 만들고 아래 묶음에 이어붙이기. 판정 코드는 안 고친다. */
import { DIDIMDOL_RULES } from "./didimdol.js";
import { BOGEUMJARI_RULES } from "./bogeumjari.js";
import { BANK_RULES } from "./bank.js";

export { DIDIMDOL_RULES, BOGEUMJARI_RULES, BANK_RULES };

/* 탭별 묶음 — 자격 화면은 자기 탭 것만 판정한다(정부탭에 은행 카드가 섞이지 않게). */
export const GOV_RULES = [...DIDIMDOL_RULES, ...BOGEUMJARI_RULES];

/* 자격 판정 대상 전부 — 지도·조종간은 채널을 가리지 않고 "열리는 길 전부"를 본다.
   순서 = 목록에서 동점일 때의 표시 순서(범용 → 특수, 정부 → 은행). */
export const PRODUCT_RULES = [...GOV_RULES, ...BANK_RULES];

/* ── 기금 공통 판정 기준 (디딤돌·보금자리가 같이 쓴다) ── */
/* ✏️ 신생아: 접수일로부터 2년 이내 출생 & 2023.1.1 이후 출생 (둘 다 만족) */
export const NEWBORN_RULE = { since: "2023-01-01", withinYears: 2 };
/* ✏️ 신혼 인정 기간(년) / 결혼예정 인정 기간(개월) */
export const NEWLYWED_YEARS = 7;
export const WEDDING_SOON_MONTHS = 3;
