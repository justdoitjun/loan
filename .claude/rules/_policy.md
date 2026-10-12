# 정부 정책값 (LTV · DTI · 추정금리 · 규제지역)

> 디딤돌 상품 고유 상한(소득·가격·면적·종별 한도)은 `products/didimdol.md`.
> 여기 두는 건 **정부 방침으로 바뀌는 공통 숫자**다. 코드의 출처는 `src/data.js`.
> 값을 바꾸면 이 문서를 먼저 고치고 코드를 맞춘다.

| 항목 | 값 | 코드 | 비고 |
|---|---|---|---|
| 지역 | **규제지역** (서울 전역) | `REGION = "regulated"` | 키: `regulated`(규제지역) / `metroOther`(규제지역 외 수도권) / `local`(지방) |
| 은행 LTV | 일반차주 **40%** · 생애최초 **70%** · 서민·실수요 **60%** | `LTV_TABLE` · `engine.regulatoryLtv` | 표는 `products/_common.md`. 어느 행인지는 `products/bank/bank.md` 1절. 여러 행이면 **높은 비율** |
| 서민·실수요 | 부부합산 **9천만원 이하** · 주택가격 **8억원 이하** · **무주택 세대주** | `REAL_DEMAND` | 셋이 모두 맞을 때만 60%. 세대주는 가족정보로 추정. 가족정보가 없으면 이 행을 주지 않는다 |
| 예산 화면 LTV | 일반차주 **40%** | `RULE.LTV` = `LTV_TABLE[REGION].noHome` | 차주 유형을 아직 모르므로 우대(생애최초·서민)를 넣지 않는다 |
| 디딤돌 LTV | 70% | `PRODUCTS.didimdol.LTV` | 원문: 생애최초 80%(소유권·규제지역이면 70%). **MVP는 70%만**. 규제지역 은행 표와 별개 |
| 보금자리 LTV | 70% | `PRODUCTS.bogeumjari.LTV` | ⚠️ 스텁. 규제지역 은행 표를 타지 않는다 |
| 방공제 | 5,500만 차감 | `RULE.roomDeduction` | 방법 화면 기본은 차감(아니오). 네일 때만 상쇄. 디딤돌 상품 플래그는 상쇄 안 함. 금액은 가정치 |
| DTI 상한 | 60% | `DIDIMDOL_DTI.cap` | 디딤돌 상환능력 상한 |
| DTI 산정만기 | 30년 | `DIDIMDOL_DTI.years` | 실제 대출 만기와 무관한 산정 강제 |
| 본건 원리금 환산금리 | 3.0% | `DIDIMDOL_LOAN_RATE` | **계산 전용.** 화면에 금리로 표시하지 않음 |
| 기타부채 추정금리 | 5.34% | `ESTIMATED_DEBT_RATE` | 한은 가계대출 가중평균 + 1%p. **매달 갱신 대상** |
| 지역별 주담대 cap | 15억 이하 6억 · 15~25억 4억 · 25억 초과 2억 (지방 제한 없음) | `REGION_CAP` · `engine.regionCapOf` | 표는 `products/_common.md`. 은행·예산 화면 천장에 적용, 정부상품은 제한 없음 |

은행 DSR(`RULE.DSR` 40% · `RULE.loanRate` 4.0% · 스트레스 3%p · `RULE.creditRate` 5.5% · `RULE.creditYears` 5년)은 `products/bank/bank.md` 3절이 단일 출처다. 예산 화면 천장과 보금자리(임시)도 같은 `RULE` 값을 읽는다.
