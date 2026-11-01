/* 방법 화면 「다음 액션」의 기록 — 관심 클릭과 저장한 전략. 순수 함수 + localStorage. JSX 금지.
   ⚠️ 지금은 브라우저 저장소뿐이다. 서버·알림이 생기면 이 파일의 read/write만 바꾼다 — 화면(NextActions.jsx)은 이 함수들만 안다.
   기록 모양:
     { saved:    [{ id, unitId, name, productKey, productTitle, loan, cash, at }],   // 저장한 전략 (매물|상품 하나당 하나)
       interest: [{ kind, unitId, productKey, at, ... }] }                         // 눌러 본 액션 전부 (수요 측정용)
   kind는 data.NEXT_ACTIONS.actions[].kind. 실제 예약으로 바꿀 때 recordInterest 호출은 그대로 두고 그 뒤에 진짜 동작을 붙인다. */
import { NEXT_ACTIONS } from "./data.js";

const KEY = NEXT_ACTIONS.storageKey;
const EMPTY = () => ({ saved: [], interest: [] });

function read() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && Array.isArray(v.saved) && Array.isArray(v.interest) ? v : EMPTY();
  } catch { return EMPTY(); }
}
function write(v) {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(v)); } catch { /* 저장소가 없으면 조용히 넘어간다 */ }
  return v;
}

export const planId = (unitId, productKey) => `${unitId}|${productKey ?? ""}`;

/* 어떤 액션을 눌렀는지 남긴다. 아직 안 열린 기능도 기록한다 — 무엇을 먼저 열지는 이 수요로 정한다. */
export function recordInterest(kind, meta = {}) {
  const s = read();
  s.interest.push({ kind, ...meta, at: new Date().toISOString() });
  return write(s);
}

/* 전략 저장 = 매물|상품 하나당 하나. 다시 저장하면 숫자만 갱신. */
export function savePlan(plan) {
  const s = read();
  const id = planId(plan.unitId, plan.productKey);
  s.saved = [...s.saved.filter((p) => p.id !== id), { id, ...plan, at: new Date().toISOString() }];
  return write(s);
}

export const isSaved = (unitId, productKey) => read().saved.some((p) => p.id === planId(unitId, productKey));
export const readNextAction = read;
