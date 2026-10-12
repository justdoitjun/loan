/* 규제지역(서울) 은행 LTV. 출처 .claude/rules/products/_common.md · bank.md 1절.
   일반차주 40% · 생애최초 70% · 서민·실수요 60%(부부합산 9천만 · 가격 8억 · 무주택 세대주).
   디딤돌 LTV는 이 표를 타지 않는다. */
import { REGION, RULE, PRODUCTS, REAL_DEMAND, LTV_TABLE } from "../src/data.js";
import { regulatoryLtv, realDemandHeadGap, limitParts, evaluate, buildCtx, deriveFacts, judgeAll } from "../src/engine.js";
import { BANK_RULES } from "../src/products/index.js";
import { limitAt, ceilingAt } from "../src/products/limit.js";
import { EMPTY_PERSON, bankSteps, leverOf } from "../src/person.js";

const fail = (name, detail) => {
  console.error(`FAIL ${name}: ${detail}`);
  process.exitCode = 1;
};
const eq = (name, actual, expected) => {
  if (actual !== expected) fail(name, `expected ${expected}, got ${actual}`);
};

eq("region", REGION, "regulated");
eq("rule ltv is general", RULE.LTV, 0.4);
eq("real demand income", REAL_DEMAND.incomeCap, 9000);
eq("real demand price", REAL_DEMAND.priceCap, 80000);
eq("didimdol stays 70", PRODUCTS.didimdol.LTV, 0.7);
eq("bogeumjari stays 70", PRODUCTS.bogeumjari.LTV, 0.7);
eq("bank fallback is general", PRODUCTS.bank.LTV, LTV_TABLE.regulated.noHome);

const base = { householdHead: false, householdHeadKnown: false, income: 0, price: 0 };
const tier = (over) => regulatoryLtv({ ...base, ...over });

eq("no home general", tier({ noHome: true, income: 5000, price: 50000 }).rate, 0.4);
eq("first time beats real demand", tier({
  noHome: true, firstTime: true, householdHead: true, householdHeadKnown: true, income: 5000, price: 50000,
}).rate, 0.7);
eq("real demand", tier({
  noHome: true, householdHead: true, householdHeadKnown: true, income: 9000, price: 80000,
}).rate, 0.6);
eq("real demand price over", tier({
  noHome: true, householdHead: true, householdHeadKnown: true, income: 9000, price: 80001,
}).rate, 0.4);
eq("real demand income over", tier({
  noHome: true, householdHead: true, householdHeadKnown: true, income: 9001, price: 50000,
}).rate, 0.4);
eq("head unknown is not real demand", tier({
  noHome: true, householdHead: true, householdHeadKnown: false, income: 5000, price: 50000,
}).rate, 0.4);
eq("not household head", tier({
  noHome: true, householdHead: false, householdHeadKnown: true, income: 5000, price: 50000,
}).rate, 0.4);
eq("disposing is general even if firstTime flag sticks", tier({
  disposing: true, oneHome: true, firstTime: true, income: 5000, price: 50000,
}).rate, 0.4);
eq("keep home closed", tier({ oneHome: true, disposing: false }).rate, 0);
eq("multi closed", tier({ multiHome: true }).rate, 0);
eq("unknown borrower falls back to general", tier({}).rate, 0.4);

eq("gap unknown", realDemandHeadGap({
  noHome: true, firstTime: false, householdHeadKnown: false, income: 5000, price: 50000,
}), "unknown");
eq("gap hidden when first time", realDemandHeadGap({
  noHome: true, firstTime: true, householdHeadKnown: false, income: 5000, price: 50000,
}), null);
eq("gap not head", realDemandHeadGap({
  noHome: true, householdHead: false, householdHeadKnown: true, income: 5000, price: 50000,
}), "notHead");

const didimdol = limitParts(PRODUCTS.didimdol, 50000, 5000);
eq("didimdol ltv amount", didimdol.parts.find((p) => p.key === "ltv").value, 50000 * 0.7 - RULE.roomDeduction);

const bank = limitAt("bank", {
  price: 50000, income: 5000, incomeMax: 30000, debt: 0, debts: {},
  ltv: { noHome: true, householdHead: true, householdHeadKnown: true },
});
eq("bank real demand ltv amount", bank.parts.find((p) => p.key === "ltv").value, 50000 * 0.6);

const atCap = limitAt("bank", {
  price: 50000, income: 9000, incomeMax: 30000, debt: 0, debts: {},
  ltv: { noHome: true, householdHead: true, householdHeadKnown: true },
});
const atMax = limitAt("bank", {
  price: 50000, income: 30000, incomeMax: 30000, debt: 0, debts: {},
  ltv: { noHome: true, householdHead: true, householdHeadKnown: true },
});
const ceil = ceilingAt("bank", {
  price: 50000, income: 5000, incomeMax: 30000, debt: 0, debts: {},
  ltv: { noHome: true, householdHead: true, householdHeadKnown: true },
});
eq("ceiling picks the better income", ceil.limit, Math.max(atCap.limit, atMax.limit));
if (!(atCap.limit > atMax.limit)) fail("60% tier should beat 40% tier at this price", `${atCap.limit} vs ${atMax.limit}`);

const listed = evaluate({ price: 100000 }, 999999);
eq("budget screen uses general ltv minus room", listed.loan, 100000 * 0.4 - RULE.roomDeduction);

const none = { ...EMPTY_PERSON.elig, homeCount: 0, bankIncomeJoint: false, firstTime: null };
eq("bank waits for first time", bankSteps(none).ready, false);
eq("bank ready after first time no", bankSteps({ ...none, firstTime: false }).ready, true);
eq("dispose does not ask first time", bankSteps({
  ...EMPTY_PERSON.elig, homeCount: 1, disposeExisting: true, bankIncomeJoint: false, firstTime: null,
}).ready, true);

const person = {
  ...EMPTY_PERSON,
  ownIncome: 4000,
  elig: {
    ...EMPTY_PERSON.elig,
    homeCount: 0,
    firstTime: false,
    hasSpouse: false,
    ownBirthday: "1990-01-01",
    marital: "single",
  },
};
const lever = leverOf(person, 50000);
eq("lever marks household head", lever.ltv.householdHead, true);
eq("lever marks head known", lever.ltv.householdHeadKnown, true);
eq("limitAt from lever is real demand", limitAt("bank", lever).parts.find((p) => p.key === "ltv").value, 50000 * 0.6);

function cardLtv(elig, price, ownIncome) {
  const facts = deriveFacts(buildCtx({ unit: { price, areaM2: 59 }, ownIncome, elig }));
  const passed = judgeAll(facts, BANK_RULES).passed;
  if (passed.length !== 1) fail("bank card count", String(passed.length));
  return passed[0].roughParts.find((p) => p.key === "ltv");
}
const headElig = person.elig;
eq("card real demand", cardLtv(headElig, 50000, 4000).value, 30000);
eq("card first time", cardLtv({ ...headElig, firstTime: true }, 50000, 4000).value, 35000);
eq("card price over 8억", cardLtv(headElig, 80001, 4000).value, 80001 * 0.4);

if (process.exitCode) process.exit(process.exitCode);
console.log("ltv ok");
