/* 규칙 문서(.claude/rules/products/didimdol.md) vs 실제 출고 함수.
   기대값은 이 파일에 적지 않고 규칙 원문에서 읽는다.
   판정은 engine.deriveFacts → judgeRule / judgeAll / didimdolDtiLimit 로만 한다. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCtx, deriveFacts, judgeAll, judgeRule, didimdolDtiLimit, annualDebtService } from "../src/engine.js";
import { DIDIMDOL_RULES } from "../src/products/didimdol.js";
import { limitAt } from "../src/products/limit.js";
import { EMPTY_ELIG } from "../src/person.js";
import { ACTIVE_INCOME_TYPES, INCOME_TYPES } from "../src/data/incomeRules.js";
import { DIDIMDOL_DTI, DIDIMDOL_LOAN_RATE, ESTIMATED_DEBT_RATE, PRODUCTS } from "../src/data.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = process.env.SCRATCH || process.cwd();
const failures = [];
const ok = (name) => console.log("ok  " + name);
const fail = (name, msg) => { failures.push(`${name}: ${msg}`); console.error("FAIL  " + name + " — " + msg); };

const man = (s) => {
  const t = String(s).replace(/\*/g, "").replace(/,/g, "").trim();
  const eok = t.match(/^([\d.]+)\s*억$/);
  if (eok) return Math.round(Number(eok[1]) * 10000);
  const m = t.match(/^([\d.]+)\s*만$/);
  if (m) return Math.round(Number(m[1]));
  throw new Error("금액 파싱 실패: " + s);
};

const md = readFileSync(join(root, ".claude/rules/products/didimdol.md"), "utf8");

/* ── 1) 일반가구 표 → 출고 judgeRule ── */
const generalTable = [...md.matchAll(/^\| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)]
  .map((m) => ({ tier: m[1].trim(), income: m[2].trim(), price: m[3].trim(), loan: m[4].trim() }))
  .filter((r) => r.tier !== "티어" && !r.tier.startsWith("---") && r.income.includes("만"));

const ruleOf = (key) => DIDIMDOL_RULES.find((r) => r.key === key);

function facts(partial) {
  const elig = {
    ...EMPTY_ELIG,
    homeCount: 0,
    ownBirthday: partial.ownBirthday ?? "1991-08-01",
    hasSpouse: partial.hasSpouse ?? false,
    birthdays: partial.birthdays ?? [],
    firstTime: partial.firstTime ?? false,
    marital: partial.marital ?? "single",
    marriedWithin7: partial.marriedWithin7 ?? null,
    hasDreamAccount: partial.hasDreamAccount ?? false,
    spouseBand: partial.spouseIncome ? "o7000" : null,
    spouseIncomeRaw: partial.spouseIncome != null ? String(partial.spouseIncome) : "",
  };
  const unit = { id: 1, name: "t", dong: "x", price: partial.price ?? 40000, areaM2: partial.areaM2 ?? 59, x: 0, y: 0 };
  return deriveFacts(buildCtx({ unit, cash: 0, ownIncome: partial.ownIncome ?? 5000, elig }));
}

const cases = {
  "신혼": { marital: "married", marriedWithin7: true, hasSpouse: true, firstTime: false },
  "미성년 2자녀 이상": { marital: "married", marriedWithin7: false, hasSpouse: true, firstTime: false, birthdays: ["2015-01-01", "2018-03-01"] },
  "생애최초": { marital: "married", marriedWithin7: false, hasSpouse: true, firstTime: true },
  "만30세+ 단독세대주(미혼) · 생애최초": { marital: "single", firstTime: true, ownBirthday: "1991-08-01" },
  "만30세+ 단독세대주(미혼)": { marital: "single", firstTime: false, ownBirthday: "1991-08-01" },
  "기본": { marital: "married", marriedWithin7: false, hasSpouse: true, firstTime: false },
};

for (const row of generalTable) {
  const input = cases[row.tier];
  if (!input) { fail("일반표:" + row.tier, "테스트 픽스처 없음"); continue; }
  const f = facts(input);
  const j = judgeRule(ruleOf("general"), f);
  const want = { income: man(row.income), price: man(row.price), loan: man(row.loan) };
  const got = { income: j.income.value, price: j.price.value, loan: j.loan.value };
  if (got.income !== want.income || got.price !== want.price || got.loan !== want.loan) {
    fail("일반표:" + row.tier, `규칙 ${JSON.stringify(want)} / 코드 ${JSON.stringify(got)}`);
  } else ok("일반표:" + row.tier);
}

/* ── 2) 종별 한 줄 상한 (문서의 **N만** / **N억** / **N㎡**) ── */
function grab(section, re) {
  const i = md.indexOf(section);
  if (i < 0) throw new Error("섹션 없음: " + section);
  const chunk = md.slice(i, i + 800);
  const m = chunk.match(re);
  if (!m) throw new Error("패턴 없음 in " + section + " / " + re);
  return m;
}

{
  const m = grab("### 1-2. 생애최초 신혼가구", /소득 \*\*([^*]+)\*\* \/ 가격 \*\*([^*]+)\*\* \/ 면적 \*\*([^*]+)\*\* \/ 한도 \*\*([^*]+)\*\*/);
  const f = facts({ marital: "married", marriedWithin7: true, hasSpouse: true, firstTime: true, areaM2: 84 });
  const j = judgeRule(ruleOf("firstNewlywed"), f);
  const want = { income: man(m[1]), price: man(m[2]), area: Number(m[3].replace("㎡", "")), loan: man(m[4]) };
  if (!j.ok) fail("firstNewlywed", "자격 탈락 " + JSON.stringify(j.unmetRequires));
  else if (j.income.value !== want.income || j.price.value !== want.price || j.loan.value !== want.loan) {
    fail("firstNewlywed", JSON.stringify({ want, got: { income: j.income.value, price: j.price.value, loan: j.loan.value } }));
  } else ok("firstNewlywed 상한");
}

{
  const f = facts({ marital: "married", marriedWithin7: false, hasSpouse: true, birthdays: ["2025-06-01"], ownIncome: 12000, spouseIncome: 5000, areaM2: 84 });
  const j = judgeRule(ruleOf("newborn"), f);
  if (!j.ok) fail("newborn", "자격 탈락");
  else if (j.income.value !== 20000 || j.loan.value !== 40000 || j.price.value !== 90000) {
    fail("newborn", "맞벌이 상한 " + JSON.stringify({ i: j.income.value, l: j.loan.value, p: j.price.value }));
  } else ok("newborn 맞벌이");
  const over = facts({ marital: "married", marriedWithin7: false, hasSpouse: true, birthdays: ["2025-06-01"], ownIncome: 14000, spouseIncome: 1000, areaM2: 84 });
  const jo = judgeRule(ruleOf("newborn"), over);
  if (jo.ok) fail("newborn 1인 상한", "1.3억 초과인데 통과");
  else ok("newborn 1인 상한");
}

{
  const f = facts({ marital: "single", firstTime: true, hasDreamAccount: true, ownBirthday: "1995-01-01", areaM2: 84 });
  const j = judgeRule(ruleOf("youthDream"), f);
  if (!j.ok) fail("youthDream", "자격 탈락 " + JSON.stringify(j.unmetRequires));
  else if (j.income.value !== 7000 || j.loan.value !== 30000) fail("youthDream", "미혼 상한");
  else ok("youthDream 미혼");
}

{
  const big = facts({ marital: "married", marriedWithin7: false, hasSpouse: true, birthdays: ["2025-06-01"], areaM2: 90 });
  const j = judgeRule(ruleOf("newborn"), big);
  if (j.ok) fail("newborn 면적", "90㎡가 통과 — 규칙은 85㎡");
  else if (!j.failedChecks.some((c) => c.key === "area")) fail("newborn 면적", "area 실패가 없음");
  else ok("newborn 면적 85㎡");
}

/* ── 3) 출고 DTI = 문서 산식 (이자만, DSR 원리금 아님) ── */
{
  const income = 5000, debt = 20000;
  const shipped = didimdolDtiLimit(income, debt);
  const r = DIDIMDOL_LOAN_RATE / 12, n = DIDIMDOL_DTI.years * 12;
  const factor = (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
  const spec = ((income * DIDIMDOL_DTI.cap - debt * ESTIMATED_DEBT_RATE) / 12) * factor;
  if (Math.abs(shipped - spec) > 1) fail("DTI 산식", `출고 ${shipped} vs 문서식 ${spec}`);
  else ok("DTI 산식 = didimdol.md §3");
  const dsr = annualDebtService(debt, "principalAndInterest");
  const interest = debt * ESTIMATED_DEBT_RATE;
  if (dsr <= interest) fail("DTI≠DSR", "원리금이 이자보다 작거나 같음");
  else ok("디딤돌은 이자만 (DSR 원리금과 다름)");
}

/* ── 4) Strategy 파이프: limitAt(didimdol) 이 종별 cap 을 씀 ── */
{
  const f = facts({ marital: "married", marriedWithin7: false, hasSpouse: true, firstTime: true, ownIncome: 5000 });
  const judged = judgeAll(f).all.find((r) => r.key === "general");
  const lever = { price: 40000, income: 5000, incomeMax: 7000, debt: 0 };
  const at = limitAt("didimdol", lever, judged.limit);
  if (judged.limit !== 24000) fail("limitAt cap", "생애최초 한도 " + judged.limit);
  else if (at.parts.find((p) => p.key === "cap").value !== 24000) fail("limitAt cap", "parts.cap " + JSON.stringify(at.parts));
  else ok("Strategy limitAt 이 종별 loanCap 사용");
  if (PRODUCTS.didimdol.cap !== 20000) fail("PRODUCTS.cap", String(PRODUCTS.didimdol.cap));
  else ok("기본 cap = 일반가구 기본 한도 2억");
}

/* ── 5) incomeRules: 화면 목록 ≠ 원문 전체 ── */
{
  const off = INCOME_TYPES.filter((t) => t.지원여부 === false);
  if (off.length !== 2) fail("소득추정 원문", "지원여부 false 가 2종이 아님: " + off.length);
  else ok("소득추정 2종은 원문에 보존");
  if (ACTIVE_INCOME_TYPES.some((t) => t.지원여부 === false)) fail("ACTIVE", "미지원이 섞임");
  else if (ACTIVE_INCOME_TYPES.length !== INCOME_TYPES.length - off.length) fail("ACTIVE", "개수");
  else ok("ACTIVE_INCOME_TYPES 는 미지원 제외");
  const checkSrc = readFileSync(join(root, "src/IncomeCheck.jsx"), "utf8");
  if (!checkSrc.includes("ACTIVE_INCOME_TYPES")) fail("IncomeCheck import", "ACTIVE_INCOME_TYPES 없음");
  if (/\bINCOME_TYPES\b/.test(checkSrc.replace(/ACTIVE_INCOME_TYPES/g, ""))) fail("IncomeCheck import", "원문 전체 INCOME_TYPES 를 화면이 읽음");
  else ok("IncomeCheck 는 ACTIVE_INCOME_TYPES");
  const strat = readFileSync(join(root, "src/Strategy.jsx"), "utf8");
  if (strat.includes("incomeRules")) fail("Strategy", "incomeRules 를 끌어와 한도에 반영하면 안 됨");
  else ok("Strategy 는 인정소득 산식을 한도에 안 넣음");
}

try {
  mkdirSync(scratch, { recursive: true });
  writeFileSync(join(scratch, "assert-didimdol-rules.txt"),
    (failures.length ? "FAIL\n" : "PASS\n") + failures.join("\n") + "\n", "utf8");
} catch { /* scratch 는 선택 */ }

if (failures.length) {
  console.error("\n" + failures.length + " failed");
  process.exit(1);
}
console.log("\nall passed");
