/* 법정동 코드표(GEO_CODE) → 화면용 지역 목록. JSX 금지.
   폐지된 동은 고를 수 없다. 순서는 법정동코드 순(구도 코드 순). 매물 없는 구·동도 목록엔 있다. */
import { CITY, GEO_CODE } from "./data/geo/geo_code.js";

export { CITY };

const live = Object.entries(GEO_CODE)
  .filter(([, g]) => g.city === CITY && g.exist)
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([, g]) => g);

/* 구 → 현존 법정동 이름 목록 */
export const DONGS = {};
for (const { gu, dong } of live) {
  const list = (DONGS[gu] ??= []);
  if (!list.includes(dong)) list.push(dong);
}

export const GUS = Object.keys(DONGS);
