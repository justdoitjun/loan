# 아키텍처 · 코드 구조

- 화면은 정적 프론트엔드다. 대출 계산은 브라우저에서 한다. 스택은 React + Vite. `npm run dev`로 로컬 구동, 배포는 `npm run build` 후 `dist`.
- 한도 룰셋·대처법 족보는 프론트 데이터 파일에 있다. 시세의 원본은 DB다. 화면이 읽는 시세는 배치가 export한 파일이다.

## 시세 파이프라인

`LAWD_CD`는 `project/batch/geo_code.js` 키 앞 5자리, 기본 `DEAL_YMD`는 202601~202609.

1. **수집.** 배치가 국토부 아파트 매매 실거래가를 받아 **테이블 1**에 넣는다. 테이블 1은 이력성 데이터다. 거래 한 건이 한 행으로 쌓인다.
2. **평균가.** 테이블 1을 조회해 평균가를 구하고 **테이블 2**를 갱신한다. 테이블 2는 화면용 현재 시세다.
3. **export.** 테이블 2를 프론트 서버로 내보낸다. `src/data/seoul/units_YYYYMMDD.json`(서울 전체 한 파일)을 갈아끼우고 `src/units.js`의 import 날짜를 바꾼다. 실패하면 그 파일은 한 바이트도 바꾸지 않는다.

지금 `python3 -m seoul_batch`는 아직 테이블 없이 XML에서 `src/data/seoul/`을 바로 쓴다. 위의 세 단계로 맞춘다.

## 파일 구조

| 파일 | 역할 |
|---|---|
| `src/App.jsx` | 지역(시·구·동)+소득+매물 목록 → 소득 확인(Yes/No) → 정부/은행 팝업. 뒤로 가면 방법 화면 가정(부채·레버)을 비운다. **단계 오케스트레이션 + 사람상태 소유** |
| `src/person.js` | **사람상태 스키마 + 순수 판단**(EMPTY_PERSON·eligSteps·detailReady·leverOf). JSX 금지 |
| `src/verdict.js` | **`judgeUnit(매물, 사람)` — 매물별 한도·필요 현금 순수 함수.** 목록 숫자 갱신의 단일 진입점 |
| `src/Eligibility.jsx` | **자격 화면 껍데기**(탭·매물카드). 자격을 묻는 유일한 입구. 본문은 탭별로 아래 두 파일 |
| `src/eligibility/gov.jsx` | **정부대출 자격 질문 + 가능 상품 목록.** 디딤돌·보금자리 판정이 여기 |
| `src/eligibility/bank.jsx` | **은행대출 탭.** 질문 2개(주택 보유 상태 · 배우자 소득) → 일반 주담대 카드. 은행 질문이 늘면 여기만 고친다 |
| `src/eligibility/shared.jsx` | 두 탭이 같이 쓰는 질문 조각(YesNo · 배우자 소득 트랙 · 답변 드랍다운). 상품 지식 없음 |
| `src/Strategy.jsx` | **방법 화면.** 부채 입력 → 필요 현금 + 게이지 → 기존 대출을 줄이면 / 소득이 인정되면 / 방 공제 보전(항상 펼침, 기본 아니오) |
| `src/DetailInfo.jsx` | **부채를 종류별로 입력**(`data.DEBT_KINDS`) = 가정의 시작 위치. Strategy 상단 |
| `src/IncomeCheck.jsx` | **소득 신뢰도 자가진단.** 소득유형 선택 → 체크리스트 → 초록/노랑 논조 |
| `src/engine.js` | 계산·판정 전부(중복 정의 금지). JSX 금지. 은행 기존부채 연상환은 `engine_bank_dsr.js`를 호출 |
| `src/engine_bank_dsr.js` | **은행 DSR 기존 부채의 종류별 연 상환액.** 파라미터는 `DEBT_KINDS[].dsr`. 디딤돌은 호출하지 않음 |
| `src/data.js` | 예산규칙·상품 **금융 파라미터**·`LEVER`(레버 범위)·화면 상수. 매물은 여기 없다(`src/units.js`). 로직 금지 |
| `src/data/geo/geo_code.js` | **서울 법정동 코드표** `GEO_CODE`(`{ 법정동코드: { city, gu, dong, exist } }`) + `CITY`. `scripts/build-geo-code.mjs`가 `../openapi_data/code_geo_seoul.csv`(원본)에서 생성. 손으로 고치지 않는다. 로직 금지 |
| `src/geo.js` | `GEO_CODE` → 화면용 `GUS`(구 목록)·`DONGS`(구별 현존 법정동). 코드 순서. JSX 금지 |
| `src/data/seoul/units_YYYYMMDD.json` | **서울 전체 단지·면적대별 대표가.** 테이블 2(`trade_average`) export 결과(`project/batch/job_average.py export`). 손으로 고치지 않는다. 필드: `id`(sgg_cd\|동\|단지\|면적대)·이름·동·전용·면적대·가격(만원)·거래건수·최근거래일 |
| `src/units.js` | 위 JSON → 화면용 `UNITS`(`{ id, name, city, gu, dong, areaM2, price, areaBand, tradeCount, latestDealDate }`). 구 이름은 `id` 앞 5자리 → `GEO_CODE`. `areaM2`는 **실제 대표 전용면적**(디딤돌 85㎡ 판정용, 면적대 아님). 새 export를 받으면 import 경로의 날짜만 바꾼다. JSX 금지 |
| `src/data/incomeRules.js` | 디딤돌 **소득 인정 규정 원문 보존본**(엑셀 구조화, 원문 대조 완료). 요약으로 덮어쓰지 말 것. 화면은 `ACTIVE_INCOME_TYPES`(소득추정 제외) |
| `project/batch` (`python3 -m seoul_batch`) | 실거래 수집. 목표 경로는 테이블 1 → 테이블 2(평균가) → `src/data/seoul/` export. 지금은 XML에서 파일을 바로 씀 |
| `scripts/fetch-units.mjs` | 예전 노원 수집. 결과는 `units.json`. 앱은 import하지 않음 |
| `src/products/didimdol.js` | 디딤돌 5종 **자격 상한 규칙 데이터** |
| `src/products/bogeumjari.js` | 보금자리 규칙 데이터(같은 DSL) |
| `src/products/bank.js` | 은행 일반 주담대 규칙 데이터(진입 조건만, 상한은 전부 `null`) |
| `src/products/index.js` | `GOV_RULES`·`BANK_RULES`·`PRODUCT_RULES`(전부)로 합침 + 기금 공통 기준(신생아·신혼 기간) |
| `src/products/limit.js` | **레버값 → 한도 인터페이스**(`limitAt`/`ceilingAt`). 상품별 부채 잣대 |
| `src/ui.jsx` | 스타일 토큰 + 공용 레이아웃 + `useTween`. 상품별 분기 금지 |

## 판정 엔진 구조 (상품이 늘어도 코드는 안 고친다)

`src/products/*`의 규칙 배열은 **플래그 이름으로 쓴 조건 DSL**이다 — 데이터에 함수를 두지 않는다.
```
[]                → 항상 참(기본 티어)   ["a","b"] → a AND b   ["a",["b","c"]] → a AND (b OR c)
```
플래그는 `engine.deriveFacts(ctx)`가 만든다. 새 조건이 필요하면 **거기에 플래그를 추가**하고
규칙 데이터에서 이름으로 참조한다. 판정 함수(`judgeRule`/`judgeAll`)는 손대지 않는다.
`incomeCap`/`priceCap`/`loanCap`은 조건별 티어 배열이고 **위에서부터 첫 매치**가 적용된다(유리한 걸 위로).
판정은 실패해도 `unmetRequires`·`failedChecks`(무엇이 얼마 초과)를 항상 같이 돌려준다 — 가드레일 4.
상한 값이 `null`이면 "상한 없음"이고 그 검사는 건너뛴다(은행). `judgeAll(facts, rules)`의 둘째 인자로 탭별 규칙 묶음을 넘긴다
(정부탭 `GOV_RULES`, 은행탭 `BANK_RULES`, 지도·조종간은 기본값 = 전부).

**상품 추가 = 규칙 파일 하나 + `products/index.js`에 이어붙이기.** 판정 코드는 안 고친다.

## 사람상태 vs 화면상태 (상태 구조의 뼈대)

**자격·부채·레버는 매물과 무관한 "사람"이다. 매물마다 다른 건 가격·면적뿐이다.**
그래서 사람은 App에 한 벌만 두고(`person.js`의 `EMPTY_PERSON`), 매물별 판정은
`verdict.judgeUnit(unit, person)` 순수 함수가 전부 처리한다.

- **사람상태**(App의 `person` 하나) — `{ ownIncome, elig, detail, pull, incomeCheck }`.
  화면을 오가도 유지된다. **매물을 바꿔도 초기화하지 않는다** — 그게 재질문을 없앤 지점이다.
  보유 현금은 여기 없다. 필요 현금은 시세와 대출에서 그때그때 계산한다(`engine.cashNeededOf`).
- **화면상태**(App의 개별 useState) — `{ step, unit, kind, pickedKey, modalUnit, place }`.
  "지금 어디를 보고 있나"만. `place`는 시·구·동. 매물을 바꾸면 `pickedKey`만 리셋한다(통과 목록이 달라지므로).
- ⚠️ **가정값(`pull`)을 Strategy 로컬 state로 되돌리지 말 것.** 목록이 같은 값을 읽어서
  기존 대출·소득 가정을 바꾸면 모든 매물의 대출·필요 현금이 다시 계산된다. 로컬로 내리면 그 연결이 끊긴다.
- ⚠️ `person.js`·`verdict.js`에 **JSX/React를 import하지 말 것.** 화면 없이 돌아가야
  매물 전체를 한 번에 돌릴 수 있고 테스트도 된다.

**첫 화면은 지도가 없다.** 소득 슬라이더와 매물 목록이 한 화면이다.
`personReady(person)`(=정부 **또는** 은행 자격 답변 완료) 전에는 DSR 근사 한도(`engine.evaluate`),
그 후에는 매물별 정밀 한도(`judgeUnit`). 전환 시 목록의 대출·필요 현금이 바뀌는 게 사건이다.

## 파일별 경계

- 계산은 `engine.js`에만. 화면 파일에서 같은 식을 다시 쓰지 않는다.
- 프론트 데이터는 `data.js`·`src/data/seoul/`·`src/data/geo/`·`products/*`에만. **로직(함수)을 데이터 파일에 넣지 않는다.** 시세의 원본은 테이블 1·2이고, `src/data/seoul/`은 테이블 2의 export다.
- 자격 상한(소득·가격·면적·한도)은 `products/*`가 유일한 출처, 금융 파라미터(금리·LTV·cap·실행시점)는
  `data.PRODUCTS`가 유일한 출처. 같은 숫자를 두 곳에 두지 않는다.
- 컨텍스트는 `engine.buildCtx()`가 만든 객체 하나(`ctx`)로만 흐른다. 화면이 상태를 복제하지 않는다.
- 자격 판정 결과는 들고 다니지 않고 `deriveFacts(ctx) → judgeAll(facts)`로 그때그때 다시 계산한다.

## 실행

`npm run dev` → `localhost:5173`. 배포는 `npm run build` 후 `dist`를 Vercel/Netlify.
