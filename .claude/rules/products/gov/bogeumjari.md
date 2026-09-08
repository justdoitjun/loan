# 보금자리론 판단기준

> **아직 안 채웠다.** 코드(`src/products/bogeumjari.js`, `data.PRODUCTS.bogeumjari`)의 숫자는 전부 ⚠️ 가정치다.
> 채울 때는 `didimdol.md`와 같은 목차를 쓴다: 판정 순서 → 진입 조건 → 상한 티어 → 플래그 →
> 소득 인정기준 → 한도 Min → 상환능력 잣대 → 검증 대기 목록 → 코드 매핑.
> 공통 부분(Min 구조·잣대 두 개·기금 공통 기준)은 `_common.md`에 있으니 복제하지 말 것.

먼저 확정해야 할 것:
- ❓ **capacityModel** — 보금자리도 실제로는 DTI 상품이다. 지금은 DSR 잣대(`ratio: 0.60`)에 남아 있다.
- ⚠️ 소득·가격·면적 상한, 대출한도 cap, 금리, LTV, 방공제 상쇄(MCG), 실행시점.
- ⚠️ `products/limit.js`의 `DEBT_VIEW.bogeumjari = "interestOnly"`가 실제 관행과 맞는지.
