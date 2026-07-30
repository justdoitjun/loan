/* 상품 규칙 데이터의 입구.
   판정 함수는 여기 두지 않는다 — engine.js가 이 배열을 읽어 판정한다(순환 import 방지).
   ✏️ 상품 추가 = 파일 하나 만들고 여기 배열에 이어붙이기. 판정 코드는 안 고친다. */
import { DIDIMDOL_RULES } from "./didimdol.js";
import { BOGEUMJARI_RULES } from "./bogeumjari.js";

export { DIDIMDOL_RULES, BOGEUMJARI_RULES };

/* 자격 판정 대상 전부. 순서 = 목록에서 동점일 때의 표시 순서(범용 → 특수). */
export const PRODUCT_RULES = [...DIDIMDOL_RULES, ...BOGEUMJARI_RULES];

/* ── 기금 공통 판정 기준 (디딤돌·보금자리가 같이 쓴다) ── */
/* ✏️ 신생아: 접수일로부터 2년 이내 출생 & 2023.1.1 이후 출생 (둘 다 만족) */
export const NEWBORN_RULE = { since: "2023-01-01", withinYears: 2 };
/* ✏️ 신혼 인정 기간(년) / 결혼예정 인정 기간(개월) */
export const NEWLYWED_YEARS = 7;
export const WEDDING_SOON_MONTHS = 3;
