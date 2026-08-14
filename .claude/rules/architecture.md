# 아키텍처 · 코드 구조

## 확정된 것 (지금 단계)

- **정적 프론트엔드 한 장. 백엔드·DB·Redis·배치 전부 없음.**
- 데이터는 정적 JSON: 매물 시세(노원 한 동네 스냅샷) / 한도 룰셋 / 대처법 족보.
- 모든 계산은 브라우저에서. 시세 갱신 = JSON 갈아끼우고 재배포(라이브 파이프라인 X).
- 스택: React + Vite. `npm run dev`로 로컬 구동, Vercel/Netlify로 정적 배포.
- 서버/DB/카카오맵/PostGIS는 "리빌이 먹힌다"가 검증된 **한참 뒤** 얘기. 지금 짓지 말 것.

## 파일 구조

| 파일 | 역할 |
|---|---|
| `src/App.jsx` | 지도(예산) → 가능 매물 목록 → 매물선택 + 정부/은행 팝업. **단계 오케스트레이션 + 사람상태 소유** |
| `src/person.js` | **사람상태 스키마 + 순수 판단**(EMPTY_PERSON·eligSteps·detailReady·leverOf). JSX 금지 |
| `src/verdict.js` | **`judgeUnit(매물, 사람)` — 매물별 판정 순수 함수.** 지도 전체 재채색의 단일 진입점 |
| `src/Eligibility.jsx` | **"자격 조건 입력" + "가능 상품 목록" 한 화면.** 자격을 묻는 유일한 곳 |
| `src/Strategy.jsx` | **조종간.** 부채 입력 → 한도 게이지(목표선·천장선) → 레버 2개(또는 `leversInert`) |
| `src/DetailInfo.jsx` | **부채 잔액 입력** = 레버의 시작 위치. Strategy 상단 |
| `src/IncomeCheck.jsx` | **소득 신뢰도 자가진단.** 소득유형 선택 → 체크리스트 → 초록/노랑 논조 |
| `src/engine.js` | 계산·판정 전부(중복 정의 금지). JSX 금지 |
| `src/data.js` | 매물·예산규칙·상품 **금융 파라미터**·`LEVER`(레버 범위)·화면 상수. 로직 금지 |
| `src/data/incomeRules.js` | 디딤돌 **소득 인정 규정 원문 보존본**(엑셀 구조화, 원문 대조 완료). 요약으로 덮어쓰지 말 것. 화면은 `ACTIVE_INCOME_TYPES`(소득추정 제외) |
| `src/products/didimdol.js` | 디딤돌 5종 **자격 상한 규칙 데이터** |
| `src/products/bogeumjari.js` | 보금자리 규칙 데이터(같은 DSL) |
| `src/products/index.js` | `PRODUCT_RULES`로 합침 + 기금 공통 기준(신생아·신혼 기간) |
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

**상품 추가 = 규칙 파일 하나 + `products/index.js`에 이어붙이기.** 판정 코드는 안 고친다.

## 사람상태 vs 화면상태 (상태 구조의 뼈대)

**자격·부채·레버는 매물과 무관한 "사람"이다. 매물마다 다른 건 가격·면적뿐이다.**
그래서 사람은 App에 한 벌만 두고(`person.js`의 `EMPTY_PERSON`), 매물별 판정은
`verdict.judgeUnit(unit, person)` 순수 함수가 전부 처리한다.

- **사람상태**(App의 `person` 하나) — `{ ownIncome, cash, elig, detail, pull, incomeCheck }`.
  화면을 오가도 유지된다. **매물을 바꿔도 초기화하지 않는다** — 그게 재질문을 없앤 지점이다.
- **화면상태**(App의 개별 useState) — `{ step, unit, kind, pickedKey, selectedId, modalUnit, budgetConfirmed }`.
  "지금 어디를 보고 있나"만. 매물을 바꾸면 `pickedKey`만 리셋한다(통과 목록이 달라지므로).
- ⚠️ **레버(`pull`)를 Strategy 로컬 state로 되돌리지 말 것.** 지도가 같은 값을 읽어서
  레버를 당기면 모든 매물이 다시 칠해진다. 로컬로 내리면 그 연결이 끊긴다.
- ⚠️ `person.js`·`verdict.js`에 **JSX/React를 import하지 말 것.** 화면 없이 돌아가야
  지도 전체를 한 번에 돌릴 수 있고 테스트도 된다.

**지도 채색은 두 모드다.** `personReady(person)`(=자격 답변 완료) 전에는 기존 DSR 근사
천장(`engine.evaluate`), 그 후에는 매물별 정밀 판정(`judgeUnit`). 전환 시 dot의 key가 바뀌어
pop 애니메이션이 한 번 더 돈다 — 판정 근거가 바뀐 걸 사건으로 보여주기 위해서다.

## 파일별 경계 (어기면 중복 정의로 되돌아간다)

- 계산은 `engine.js`에만. 화면 파일에서 같은 식을 다시 쓰지 않는다.
- 데이터는 `data.js`·`products/*`에만. **로직(함수)을 데이터 파일에 넣지 않는다.**
- 자격 상한(소득·가격·면적·한도)은 `products/*`가 유일한 출처, 금융 파라미터(금리·LTV·cap·실행시점)는
  `data.PRODUCTS`가 유일한 출처. 같은 숫자를 두 곳에 두지 않는다.
- 컨텍스트는 `engine.buildCtx()`가 만든 객체 하나(`ctx`)로만 흐른다. 화면이 상태를 복제하지 않는다.
- 자격 판정 결과는 들고 다니지 않고 `deriveFacts(ctx) → judgeAll(facts)`로 그때그때 다시 계산한다.

## 실행

`npm run dev` → `localhost:5173`. 배포는 `npm run build` 후 `dist`를 Vercel/Netlify.
