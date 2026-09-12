# 정부 정책값 (LTV · DTI · 추정금리 · 규제지역)

> 디딤돌 상품 고유 상한(소득·가격·면적·종별 한도)은 `products/didimdol.md`.
> 여기 두는 건 **정부 방침으로 바뀌는 공통 숫자**다. 코드의 출처는 `src/data.js`.
> 값을 바꾸면 이 문서를 먼저 고치고 코드를 맞춘다.

| 항목 | 값 | 코드 | 비고 |
|---|---|---|---|
| LTV | 70% | `RULE.LTV` · `PRODUCTS.didimdol.LTV` · `PRODUCTS.bank.LTV` | 원문: 생애최초 80%(소유권·규제지역이면 70%). **MVP는 70%만** — 80% 티어는 미구현. 은행 LTV 표는 `products/_common.md`, 행 선택은 `products/bank/bank.md` 1절 |
| 방공제 | 5,500만 차감 | `RULE.roomDeduction` | 디딤돌은 상쇄 안 함(`offsetsRoomDeduction: false`). 금액은 가정치 |
| DTI 상한 | 60% | `DIDIMDOL_DTI.cap` | 디딤돌 상환능력 상한 |
| DTI 산정만기 | 30년 | `DIDIMDOL_DTI.years` | 실제 대출 만기와 무관한 산정 강제 |
| 본건 원리금 환산금리 | 3.0% | `DIDIMDOL_LOAN_RATE` | **계산 전용.** 화면에 금리로 표시하지 않음 |
| 기타부채 추정금리 | 5.34% | `ESTIMATED_DEBT_RATE` | 한은 가계대출 가중평균 + 1%p. **매달 갱신 대상** |
| 지역 | **규제지역 외 수도권** | `REGION = "metroOther"` | 노원 스냅샷 가정. 키: `regulated`(규제지역) / `metroOther`(규제지역 외 수도권) / `local`(지방) |
| 지역별 주담대 cap | 15억 이하 6억 · 15~25억 4억 · 25억 초과 2억 (지방 제한 없음) | `REGION_CAP` · `engine.regionCapOf` | 표는 `products/_common.md`. 은행·예산 화면 천장에 적용, 정부상품은 제한 없음 |

은행 DSR(`RULE.DSR` 40% · `RULE.loanRate` 4.0% · 스트레스 1.5%p · `RULE.creditRate` 5.5% · `RULE.creditYears` 5년)은 `products/bank/bank.md` 3절이 단일 출처다. 예산 화면 천장과 보금자리(임시)도 같은 `RULE` 값을 읽는다.
