# 상품 공통 판단기준

## 한도 계산 모델
주담대 한도 = **Min( LTV, 상환능력, 상품별 cap, 지역별 cap )**
즉 **"금액들의 Min"을 "자격들의 AND"가 감싸는 구조**다.

- LTV = 담보가격 × LTV비율 − 방공제(소액임차보증금)
- 상환능력 = 소득·부채로 역산한 한도. 기금대출은 DTI, 은행대출은 DSR기준. 
- 방공제는 MCI/MCG 가입으로 상쇄 가능하다. 지역별로 소액임차보증금은 다르다. 
  코드에선 `PRODUCTS[key].offsetsRoomDeduction`가 정한다. ⚠️ 방공제액(`RULE.roomDeduction` 5,500만)은 가정치.

구현: `engine.limitParts` — `parts`(LTV · 상환능력 · 상품별 cap · 지역별 cap) 중 최솟값이 `binding`.
상품별 cap이 없으면(`cap: null`) 그 항이 빠지고, 지역별 cap은 `PRODUCTS[key].regionCapped`인 상품에만 붙는다
(값은 `data.REGION_CAP` + `engine.regionCapOf`, 제한 없음 = `null` → 항 자체가 빠진다).
**"무엇이 벽인가"가 곧 화면 문구다.**


## LTV
| | 규제지역 | 규제지역 외 수도권 | 지방 |
|---|---|---|---|
| LTV(생애최초) | 70% | 70% | 80% |
| LTV(서민,실수요자) | 60% | 60% | 80% | 
| LTV(무주택) | 40% | 70% | 70% | 
| LTV(1주택-처분조건부) | 40% | 70% | 60% | 
| LTV(1주택) | 0% | 0% | 60% | 
| LTV(2주택 이상) | 0% | 0% | 60% | 

## 상환능력 잣대 두 개 (기금 DTI vs 은행 DSR)

| | 기금 DTI | 은행 DSR |
|---|---|---|
| 함수 | `engine.didimdolDtiLimit` | `engine.repaymentCapacity`. 기존 부채는 `engine_bank_dsr.bankExistingAnnual` |
| 기존 부채를 보는 법 | **이자만** (잔액 × 추정금리) | **원리금 전체** |
| 쓰는 상품 | 디딤돌 (`capacityModel: "fundDTI"`) · 보금자리는 ❓ 아직 DSR 잣대 | 은행 일반 주담대 (`products/bank/bank.md`) · 보금자리(임시) |

어느 잣대를 쓰는지는 **상품 데이터**가 정한다(`PRODUCTS[key].capacityModel`). 화면·엔진에서 `if (productKey === ...)`로 분기하지 말 것.
사용자에게 받는 부채는 **종류별 금액**(`data.DEBT_KINDS`)이고, 월상환액·만기는 묻지 않는다.
은행 DSR은 종류별 파라미터(`DEBT_KINDS[].dsr`)를 `engine_bank_dsr.js`가 1년 상환액으로 바꾼다. 디딤돌 DTI는 아직 그 합계에 이자만 곱한다(`engine.combinedDebtBalance`).
이자만 볼지 원리금으로 볼지는 상품 잣대가 한다(`products/limit.js`의 `DEBT_VIEW`). 보금자리(임시)는 이자만이라 종류별 DSR 표를 타지 않는다.

## 상품별 Cap
정부상품은 종별 대출한도(`products/gov/*.md`, 코드 `loanCap` 티어). 은행 일반 주담대는 **상품별 cap 없음**(`cap: null`) — 아래 지역별 cap이 대신 건다.

## 지역별 Cap
| | 규제지역 | 규제지역 외 수도권 | 지방 |
|---|---|---|---|
| 25억원 초과 아파트 | 200,000,000 | 200,000,000| 제한 없음 |
| 15억원 초과 ~ 25억원 이하 | 400,000,000| 400,000,000 |제한 없음 | 
| 15억원 이하 | 600,000,000 | 600,000,000 | 제한 없음 | 
| 이주비,중도금대출 | 600,000,000 | 600,000,000 | 제한 없음 | 
| 정부상품(디딤돌, 보금자리) | 제한 없음 | 제한 없음 | 제한 없음 | 

코드: `data.REGION_CAP`(이 표) · 지역 가정은 `_policy.md`의 `REGION`. 이주비·중도금은 미구현.

