// QA harness helpers. Imports the real app modules read-only.
import { readFileSync } from "node:fs";
const SRC = new URL("../../../src", import.meta.url).href;
export const E = await import(`${SRC}/engine.js`);
export const D = await import(`${SRC}/data.js`);
export const P = await import(`${SRC}/person.js`);
export const V = await import(`${SRC}/verdict.js`);
export const L = await import(`${SRC}/products/limit.js`);
export const R = await import(`${SRC}/products/index.js`);
export const G = await import(`${SRC}/data/geo/geo_code.js`);
export const GEO = await import(`${SRC}/geo.js`);
export const BANKDSR = await import(`${SRC}/engine_bank_dsr.js`);
export const INCOME = await import(`${SRC}/data/incomeRules.js`);

const SNAP = JSON.parse(readFileSync(new URL("../../../src/data/seoul/units_20261011.json", import.meta.url), "utf8"));
const GU_OF = {};
for (const [code, g] of Object.entries(G.GEO_CODE)) GU_OF[code.slice(0, 5)] ??= g.gu;
export const RAW = SNAP;
export const UNITS = SNAP.units.map((u) => ({
  id: u.id, name: u["이름"], city: G.CITY, gu: GU_OF[u.id.slice(0, 5)], dong: u["동"],
  areaM2: u["전용"], areaBand: u["면적대"], price: u["가격"], tradeCount: u["거래건수"], latestDealDate: u["최근거래일"],
}));
export function unit(name, area, dong) {
  const hits = UNITS.filter((u) => u.name === name && (area == null || u.areaM2 === area) && (dong == null || u.dong === dong));
  if (hits.length !== 1) throw new Error(`unit ${name} ${area} ${dong}: ${hits.length} hits`);
  return hits[0];
}

export const ELIG = (o = {}) => ({ ...P.EMPTY_ELIG, birthdays: [], ...o });
export const PERSON = (ownIncome, elig, extra = {}) => ({ ...P.EMPTY_PERSON, ownIncome, elig, ...extra });
export const debtsOf = (o = {}) => ({ ...P.emptyDebts(), ...o });

// Tab card (gov / bank) = judgeAll(facts, tabRules).passed[*].rough
export function cards(u, person, tab) {
  const ctx = E.buildCtx({ unit: u, ownIncome: person.ownIncome, elig: person.elig });
  const f = E.deriveFacts(ctx);
  const rules = tab === "bank" ? R.BANK_RULES : tab === "gov" ? R.GOV_RULES : undefined;
  return { f, ctx, ...E.judgeAll(f, rules) };
}

// Mirror of Strategy.jsx + Cockpit calculations.
export function strategy(u, person, pickedKey) {
  const ctx = E.buildCtx({ unit: u, ownIncome: person.ownIncome, elig: person.elig });
  const { passed } = E.judgeAll(E.deriveFacts(ctx));
  const picked = passed.find((p) => p.key === pickedKey) ?? passed[0] ?? null;
  if (!picked) return { picked: null };
  const incomeCap = picked.income.value;
  const ready = P.detailReady(person.detail);
  if (!ready) return { picked, ready };
  const base = P.leverOf(person, u.price, incomeCap, false);
  const lever = P.leverOf(person, u.price, incomeCap, true);
  const roomOffset = lever.offsetRoom === true;
  const reach = L.limitAt(picked.product, { ...lever, offsetRoom: roomOffset }, picked.limit);
  const baseCeil = L.ceilingAt(picked.product, base, picked.limit);
  const roomOffCeil = L.ceilingAt(picked.product, { ...base, offsetRoom: true }, picked.limit);
  const baseReach = L.limitAt(picked.product, base, picked.limit);
  const leverRoom = Math.max(baseCeil.limit - baseReach.limit, 0);
  const hasSpouse = ctx.marital !== "single";
  return {
    ctx, picked, ready, base, lever, reach, baseCeil, roomOffCeil, baseReach,
    leversInert: leverRoom < 100, gaugeCeiling: Math.max(baseCeil.limit, roomOffCeil.limit),
    incomeMax: base.incomeMax, cash: E.cashNeededOf(u.price, reach.limit),
    incomeLabel: hasSpouse ? "인정소득 (부부합산)" : "인정소득",
    parts: Object.fromEntries(reach.parts.map((p) => [p.key, Math.round(p.value)])), binding: reach.binding.key,
  };
}

export const confirmed = (debts = {}) => ({ debts: debtsOf(debts), debtConfirmed: true, incomeQuality: { type: null, stable: null } });

// ── reporting ──
export const rows = [];
export function check(id, what, actual, expected, note = "") {
  const ok = typeof expected === "function" ? expected(actual) : JSON.stringify(actual) === JSON.stringify(expected);
  rows.push({ id, what, actual, expected: typeof expected === "function" ? "(predicate)" : expected, ok, note });
  return ok;
}
export const r0 = (x) => Math.round(x);
export function dump() {
  for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}\t${r.id}\t${r.what}\tactual=${JSON.stringify(r.actual)}\texpected=${JSON.stringify(r.expected)}${r.note ? "\t# " + r.note : ""}`);
  const f = rows.filter((r) => !r.ok).length;
  console.log(`\n${rows.length - f}/${rows.length} pass, ${f} fail`);
}
