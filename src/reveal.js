/* 홈 화면(예산 리빌)의 단지 접기 · 구간 · 정렬. 순수 함수만. JSX·React 금지.
   입력은 App이 이미 계산한 매물별 결과(engine.evaluate / verdict.judgeUnit의 배열:
   { id, name, gu, dong, areaM2, price, loan, cashNeeded, ... })와 보유 현금(만원).
   ⚠️ 여기서 한도를 다시 계산하지 않는다. cashNeeded와 현금을 비교할 뿐이다.
      색은 판정이 아니라 '내 현금 대비 구간'이다(ux.md 「색의 뜻」). 숫자(부족분)를 항상 같이 돌려준다.
   기준값(edgeRatio)은 data.REVEAL. 규칙은 .claude/rules/ux.md 「화면 흐름」 1단계. */
import { REVEAL } from "./data.js";

/* 부족분 = 필요 현금 − 보유 현금 (0 이하면 0). */
export const shortOf = (r, cash) => Math.max((r.cashNeeded ?? r.price) - Math.max(Number(cash) || 0, 0), 0);

/* "in" 현금 안 / "edge" 조금 모자람(부족분 ≤ 시세 × edgeRatio) / "out" 그 밖. */
export function statusOf(r, cash) {
  const short = shortOf(r, cash);
  if (short <= 0) return "in";
  return short <= r.price * REVEAL.edgeRatio ? "edge" : "out";
}

/* 단지 하나당 한 행. 대표 평형 = 현금 안에 드는 평형 중 가장 넓은 것, 없으면 가장 덜 모자란 것.
   행의 구간·부족분은 대표 평형 기준. 정렬은 대표 평형의 필요 현금 오름차순, 같으면 시세 낮은 순.
   key는 구|동|단지명 — 동이 바뀌어도 같은 이름이 섞이지 않게. */
export function groupComplexes(results, cash) {
  const by = new Map();
  for (const r of results) {
    const key = `${r.gu}|${r.dong}|${r.name}`;
    if (!by.has(key)) by.set(key, { key, name: r.name, gu: r.gu, dong: r.dong, units: [] });
    by.get(key).units.push(r);
  }
  const groups = [];
  for (const g of by.values()) {
    g.units.sort((a, b) => a.cashNeeded - b.cashNeeded || a.price - b.price || a.areaM2 - b.areaM2);
    const inside = g.units.filter((u) => shortOf(u, cash) <= 0);
    g.rep = inside.length ? inside.reduce((best, u) => (u.areaM2 > best.areaM2 ? u : best), inside[0]) : g.units[0];
    g.status = statusOf(g.rep, cash);
    g.short = shortOf(g.rep, cash);
    g.count = g.units.length;
    groups.push(g);
  }
  groups.sort((a, b) => a.rep.cashNeeded - b.rep.cashNeeded || a.rep.price - b.rep.price || (a.name < b.name ? -1 : 1));
  return groups;
}

/* 펼칠 것(초록·노랑)과 접을 것(회색). lineIndex = 예산선 자리(첫 노랑 앞, 노랑이 없으면 펼친 목록 끝). */
export function splitByBudget(groups) {
  const shown = groups.filter((g) => g.status !== "out");
  const folded = groups.filter((g) => g.status === "out");
  const inCount = shown.filter((g) => g.status === "in").length;
  const firstEdge = shown.findIndex((g) => g.status === "edge");
  return { shown, folded, inCount, lineIndex: firstEdge === -1 ? shown.length : firstEdge };
}
