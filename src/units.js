/* 시세 export(테이블 2 → JSON) → 화면용 매물 목록 UNITS. JSX 금지.
   원본: src/data/seoul/units_YYYYMMDD.json (project/batch/job_average.py export 가 생성). 손으로 고치지 않는다.
   새 export 를 받으면 아래 import 경로의 날짜만 바꾼다.
   구 이름은 JSON 에 없어서 id 앞 5자리(sgg_cd) → GEO_CODE 로 찾는다. */
import SNAPSHOT from "./data/seoul/units_20261011.json";
import { CITY, GEO_CODE } from "./data/geo/geo_code.js";

/* 시군구코드 5자리 → 구 이름 */
const GU_OF = {};
for (const [code, g] of Object.entries(GEO_CODE)) GU_OF[code.slice(0, 5)] ??= g.gu;

export const SNAPSHOT_YM = SNAPSHOT["스냅샷"];
export const SNAPSHOT_METHOD = SNAPSHOT["산식"];

/* 가격 만원. areaM2 = 실제 대표 전용면적(디딤돌 85㎡ 판정용) — 면적대(areaBand)가 아니다. */
export const UNITS = SNAPSHOT.units.map((u) => ({
  id: u.id,
  name: u["이름"],
  city: CITY,
  gu: GU_OF[u.id.slice(0, 5)],
  dong: u["동"],
  areaM2: u["전용"],
  areaBand: u["면적대"],
  price: u["가격"],
  tradeCount: u["거래건수"],
  latestDealDate: u["최근거래일"],
}));
