# 정부 정책값 (LTV · DTI · 추정금리 · 규제지역)

> 디딤돌 상품 고유 상한(소득·가격·면적·종별 한도)은 `products/didimdol.md`.
> 여기 두는 건 **정부 방침으로 바뀌는 공통 숫자**다. 코드의 출처는 `src/data.js`.
> 값을 바꾸면 이 문서를 먼저 고치고 코드를 맞춘다.

| 항목 | 값 | 코드 | 비고 |
|---|---|---|---|
| LTV | 70% | `RULE.LTV` · `PRODUCTS.didimdol.LTV` | 원문: 생애최초 80%(소유권·규제지역이면 70%). **MVP는 70%만** — 80% 티어는 미구현 |
| 방공제 | 5,500만 차감 | `RULE.roomDeduction` | 디딤돌은 상쇄 안 함(`offsetsRoomDeduction: false`). 금액은 가정치 |
| DTI 상한 | 60% | `DIDIMDOL_DTI.cap` | 디딤돌 상환능력 상한 |
| DTI 산정만기 | 30년 | `DIDIMDOL_DTI.years` | 실제 대출 만기와 무관한 산정 강제 |
| 본건 원리금 환산금리 | 3.0% | `DIDIMDOL_LOAN_RATE` | **계산 전용.** 화면에 금리로 표시하지 않음 |
| 기타부채 추정금리 | 5.34% | `ESTIMATED_DEBT_RATE` | 한은 가계대출 가중평균 + 1%p. **매달 갱신 대상** |
| 규제지역·서울 cap | 비규제 / 없음 | `RULE.seoulCap = null` | 노원 스냅샷 가정 |

은행 DSR용(`RULE.DSR` 40%, `RULE.creditRate` 5.5%)은 예산 화면 천장·보금자리 임시 잣대. 은행탭이 생기면 `products/bank.md`로 옮긴다.
