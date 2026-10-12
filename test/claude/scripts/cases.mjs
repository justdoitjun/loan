import { E, D, P, V, L, R, GEO, BANKDSR, INCOME, UNITS, RAW, unit, ELIG, PERSON, cards, strategy, confirmed, check, r0, dump } from "./h.mjs";

const rough = (u, inc) => E.evaluate(u, E.repaymentCapacity(inc, D.RULE.DSR, D.RULE.loanRate, D.RULE.loanYears, 0));
const card = (res, key) => res.passed.find((p) => p.key === key);
const others = (res, key) => res.others.find((p) => p.key === key);

// ═══ 01 first screen ═══
const jg = UNITS.filter((u) => u.gu === "노원구" && u.dong === "중계동");
check("FS-01", "중계동 건수", jg.length, 102);
check("FS-02", "노원구 건수", UNITS.filter((u) => u.gu === "노원구").length, 523);
check("FS-11", "노원구 동별", Object.fromEntries(GEO.DONGS["노원구"].map((d) => [d, UNITS.filter((u) => u.gu === "노원구" && u.dong === d).length])), { 월계동: 82, 공릉동: 109, 하계동: 45, 상계동: 185, 중계동: 102 });
const reachable = UNITS.filter((u) => (GEO.DONGS[u.gu] ?? []).includes(u.dong));
check("FS-12", "도달 가능 매물 합", reachable.length, 8607);
check("FS-08", "순화동 건수", UNITS.filter((u) => u.gu === "중구" && u.dong === "순화동").length, 6);
check("DA-11", "구 개수", GEO.GUS.length, 25);
{
  const list = (inc) => jg.map((u) => rough(u, inc)).sort((a, b) => b.cashNeeded - a.cashNeeded || b.price - a.price);
  const l0 = list(0);
  check("FS-21", "0원 맨위/맨아래", [l0[0].name, l0[0].areaM2, l0[0].cashNeeded, l0.at(-1).name, l0.at(-1).cashNeeded], ["동진신안", 134.74, 153750, "동진", 22950]);
  const l4 = list(4000);
  check("FS-22", "4000 맨위", [l4[0].name, r0(l4[0].loan), r0(l4[0].cashNeeded)], ["동진신안", 27928, 125822]);
  check("FS-22b", "4000 맨아래 2개", [l4.at(-1).name, r0(l4.at(-1).loan), r0(l4.at(-1).cashNeeded), l4.at(-2).name, r0(l4.at(-2).loan), r0(l4.at(-2).cashNeeded)], ["동진", 3680, 19270, "화인상가", 9620, 28180]);
  const hg = unit("현대그린", 84.99, "중계동");
  check("FS-23", "현대그린 4000", [r0(rough(hg, 4000).loan), r0(rough(hg, 4000).cashNeeded)], [19300, 42700]);
  check("FS-24", "현대그린 1000", [r0(rough(hg, 1000).loan), r0(rough(hg, 1000).cashNeeded)], [6982, 55018]);
  const sy = unit("숭인한양LEEPS", 12.78, "숭인동");
  check("FS-25", "숭인한양 0", rough(sy, 12000).loan, 0);
  check("FS-26", "evaluate 13750/13751", [rough({ price: 13750 }, 12000).loan, +rough({ price: 13751 }, 12000).loan.toFixed(1)], [0, 0.4]);
}

// person shortcuts
const bankOnly = (own, extra = {}) => PERSON(own, ELIG({ homeCount: 0, firstTime: false, hasSpouse: false, ...extra }));
{
  // FS-30/31 (F-02): bank-only answers then list
  const p = bankOnly(4000, { firstTime: false });
  check("FS-30", "현대그린 정밀 = 은행 DSR", r0(V.judgeUnit(unit("현대그린", 84.99, "중계동"), p).loan), 20041);
  const sw = V.judgeUnit(unit("성원2", 84.78, "중계동"), p);
  check("FS-31/F-02", "성원2 정밀(규칙 기대=은행 2억41만)", [r0(sw.loan), sw.best?.product], [20041, "bank"], "현재 코드가 보금자리 cap 3.6억을 낸다면 F-02 재현");
  check("FS-31/F-02b", "은행 카드는 2억41만", r0(card(cards(unit("성원2", 84.78, "중계동"), p, "bank"), "bankMortgage").rough), 20041);
  check("X-12", "정부 무주택 아니오 → personReady", P.personReady(PERSON(4000, ELIG({ ownBirthday: "1990-01-01", hasSpouse: false, homeCount: 1 }))), false);
  check("X-13", "은행 keep → personReady", P.personReady(PERSON(4000, ELIG({ homeCount: 1, disposeExisting: false, hasSpouse: false }))), false);
  check("X-14", "은행 없어요 → ready", P.personReady(bankOnly(4000)), true);
  check("X-15", "처분조건부 → ready(생애최초 무관)", P.personReady(PERSON(4000, ELIG({ homeCount: 1, disposeExisting: true, hasSpouse: false }))), true);
  check("X-16", "39세 청년 미답", P.personReady(PERSON(4000, ELIG({ ownBirthday: "1990-01-01", hasSpouse: false, homeCount: 0, firstTime: true, marital: "single" }))), false);
}

// ═══ 03 didimdol ═══
const single90 = (ft, extra = {}) => ELIG({ ownBirthday: "1990-01-01", hasSpouse: false, homeCount: 0, firstTime: ft, marital: "single", hasDreamAccount: false, ...extra });
const gov = (u, own, elig) => cards(u, PERSON(own, elig), "gov");
{
  const dj = unit("동진", 38.79, "중계동");
  let g = gov(dj, 4000, single90(true));
  const gen = card(g, "general");
  check("DG-01", "일반가구 rough/티어", [r0(gen?.rough), gen?.income.value, gen?.price.value, gen?.limit, g.passed[0].key, r0(g.passed[0].rough)], [10565, 6000, 30000, 20000, "bogeumjari", 16065]);
  g = gov(unit("화인상가", 59.31, "중계동"), 4000, single90(true));
  check("DG-02", "화인상가 가격초과", [others(g, "general")?.failedChecks.map((c) => [c.key, c.over]), g.passed.map((p) => p.key)], [[["price", 7800]], ["bogeumjari"]]);
  const us = unit("우성", 47.11, "묵동");
  check("DG-03", "우성 1.5억", r0(card(gov(us, 4000, single90(false)), "general")?.rough), 15000);
  check("DG-04", "우성 생애최초 2억 티어 / LTV", [card(gov(us, 4000, single90(true)), "general")?.limit, r0(card(gov(us, 4000, single90(true)), "general")?.rough)], [20000, 15500]);
  check("DG-05", "소득 6000 통과", !!card(gov(dj, 6000, single90(false)), "general"), true);
  check("DG-06", "소득 6100 초과", others(gov(dj, 6100, single90(false)), "general")?.failedChecks.map((c) => [c.key, c.over]), [["income", 100]]);
  check("DG-11", "삼성 59.91", r0(card(gov(unit("삼성", 59.91, "상계동"), 4000, single90(false)), "general")?.rough), 14590);
  const vb = unit("동진빌라(56-100)", 60.24, "화곡동");
  const o13 = others(gov(vb, 4000, single90(false)), "general");
  check("DG-13/F-09", "면적 초과 표시값", o13?.failedChecks.map((c) => `${c.over}㎡`), ["0.24㎡"], "F-09: 부동소수 그대로면 FAIL");
  check("DG-14", "자녀 있는 30+ → 기본 85㎡", [r0(card(gov(vb, 4000, single90(false, { birthdays: ["2020-01-01"] })), "general")?.rough)], [8150]);
  const y97 = (ft, extra = {}) => ELIG({ ownBirthday: "1997-12-31", hasSpouse: false, homeCount: 0, firstTime: ft, marital: "single", hasDreamAccount: false, ...extra });
  g = gov(dj, 4000, y97(true));
  check("DG-15", "28세 단독 → 세대주 막힘, 보금자리만", [others(g, "general")?.unmetRequires.length, g.passed.map((p) => p.key)], [1, ["bogeumjari"]]);
  check("DG-16", "28세+자녀 삼창 2.4억", r0(card(gov(unit("삼창타워주상프라자", 59.39, "중계동"), 4000, y97(true, { birthdays: ["2020-01-01"] })), "general")?.rough), 24000);
  check("DG-17", "1996-10-12 만30 통과", r0(card(gov(dj, 4000, ELIG({ ownBirthday: "1996-10-12", hasSpouse: false, homeCount: 0, firstTime: false, marital: "single", hasDreamAccount: false })), "general")?.rough), 10565);
  check("DG-18", "1996-10-13 만29 세대주 막힘", !!others(gov(dj, 4000, ELIG({ ownBirthday: "1996-10-13", hasSpouse: false, homeCount: 0, firstTime: false, marital: "single", hasDreamAccount: false })), "general")?.unmetRequires.length, true);
  const m85 = (ft, w7, band, extra = {}) => ELIG({ ownBirthday: "1985-01-01", hasSpouse: true, homeCount: 0, firstTime: ft, marital: "married", marriedWithin7: w7, spouseBand: band, ...extra });
  const sc = unit("삼창타워주상프라자", 59.39, "중계동");
  check("DG-21", "기혼 7년초과 생애최초 2.4억", r0(card(gov(sc, 5000, m85(true, false, "u3000")), "general")?.rough), 24000);
  check("DG-22", "신일 가격 5000초과", others(gov(unit("신일", 59.97, "중계동"), 5000, m85(true, false, "u3000")), "general")?.failedChecks.map((c) => [c.key, c.over]), [["price", 5000]]);
  check("DG-23", "소득 500초과", others(gov(sc, 5000, m85(false, false, "u3000")), "general")?.failedChecks.map((c) => [c.key, c.over]), [["income", 500]]);
  check("DG-23-edge", "경계칸 열림(nearIncomeCap)", E.nearIncomeCap(gov(sc, 5000, m85(false, false, "u3000")).all, 6500), true);
  check("DG-23a", "정밀1000 → 2억", r0(card(gov(sc, 5000, m85(false, false, "u3000", { spouseIncomeRaw: "1000" })), "general")?.rough), 20000);
  check("DG-23b", "정밀1001 → 1초과", others(gov(sc, 5000, m85(false, false, "u3000", { spouseIncomeRaw: "1001" })), "general")?.failedChecks.map((c) => [c.key, c.over]), [["income", 1]]);
  const m92 = (ft, extra = {}) => ELIG({ ownBirthday: "1992-01-01", hasSpouse: true, homeCount: 0, firstTime: ft, marital: "married", marriedWithin7: true, spouseBand: "3to5", hasDreamAccount: false, ...extra });
  const yk = unit("염광", 59.34, "중계동");
  check("DG-24", "신혼 500초과", others(gov(yk, 5000, m92(false)), "general")?.failedChecks.map((c) => [c.key, c.over]), [["income", 500]]);
  check("DG-24a", "정밀3500 → 3.2억", r0(card(gov(yk, 5000, m92(false, { spouseIncomeRaw: "3500" })), "general")?.rough), 32000);
  g = gov(yk, 5000, m92(true, { spouseIncomeRaw: "3500" }));
  check("DG-25", "일반+생애최초신혼 둘다 3.2억, 보금자리 4억 맨위", [r0(card(g, "general")?.rough), r0(card(g, "firstNewlywed")?.rough), g.passed[0].key, r0(g.passed[0].rough)], [32000, 32000, "bogeumjari", 40000]);
  check("DG-26", "현대2(4차) 가격초과 1700", others(gov(unit("현대2(4차)", 84.78, "중계동"), 5000, m92(false, { spouseIncomeRaw: "3500" })), "general")?.failedChecks.map((c) => [c.key, c.over]), [["price", 1700]]);
  const m80 = (kids) => ELIG({ ownBirthday: "1980-01-01", hasSpouse: true, homeCount: 0, firstTime: false, marital: "married", marriedWithin7: false, spouseBand: "u3000", birthdays: kids });
  check("DG-27", "미성년 2자녀 3.2억", r0(card(gov(yk, 5000, m80(["2012-01-01", "2015-01-01"])), "general")?.rough), 32000);
  check("DG-28", "2007-10-12생(만19) → 미성년1", others(gov(yk, 5000, m80(["2007-10-12", "2015-01-01"])), "general")?.failedChecks.map((c) => [c.key, c.over]), [["income", 500], ["price", 9995]]);
  check("DG-29", "2007-10-13생(만18) → 3.2억", r0(card(gov(yk, 5000, m80(["2007-10-13", "2015-01-01"])), "general")?.rough), 32000);
  // B firstNewlywed
  g = gov(sc, 3000, ELIG({ ownBirthday: "1999-01-01", hasSpouse: false, homeCount: 0, firstTime: true, marital: "planned", spouseBand: "3to5", hasDreamAccount: false }));
  check("DG-51/Q-02", "27세 결혼예정 생애최초신혼 열림 / 일반 세대주 막힘", [r0(card(g, "firstNewlywed")?.rough), !!others(g, "general")?.unmetRequires.length], [29500, true]);
  g = gov(sc, 3000, ELIG({ ownBirthday: "1994-01-01", hasSpouse: false, homeCount: 0, firstTime: false, marital: "planned", spouseBand: "u3000", hasDreamAccount: false }));
  check("DG-52/Q-01", "32세 결혼예정 → 일반 기본 티어", [card(g, "general")?.income.label, r0(card(g, "general")?.rough)], ["기본", 20000]);
  // C newborn
  const nb = (band, extra = {}) => ELIG({ ownBirthday: "1990-01-01", hasSpouse: true, homeCount: 0, firstTime: false, marital: "married", marriedWithin7: true, birthdays: ["2025-03-01"], spouseBand: band, hasDreamAccount: false, ...extra });
  const bs = unit("중계3벽산", 85, "중계동"), hw = unit("한화꿈에그린", 84.902, "중계동");
  g = gov(bs, 8000, nb("3to5"));
  check("DG-31", "벽산 85 신생아만 4억", [g.passed.map((p) => p.key), r0(card(g, "newborn")?.rough)], [["newborn"], 40000]);
  check("DG-32", "한화 4억/현금", [r0(card(gov(hw, 8000, nb("3to5")), "newborn")?.rough), hw.price - 40000], [40000, 48500]);
  check("DG-33/F-09", "서울가든 면적 표시값", others(gov(unit("서울가든", 85.92, "휘경동"), 8000, nb("3to5")), "newborn")?.failedChecks.map((c) => `${c.over}㎡`), ["0.92㎡"], "F-09");
  check("DG-34", "롯데 가격 250초과", others(gov(unit("롯데(505)", 84.97, "중계동"), 8000, nb("3to5")), "newborn")?.failedChecks.map((c) => [c.key, c.over]), [["price", 250]]);
  check("DG-35", "외벌이 1.2억", r0(card(gov(hw, 12000, ELIG({ ownBirthday: "1990-01-01", hasSpouse: false, homeCount: 0, firstTime: false, marital: "single", birthdays: ["2025-03-01"], hasDreamAccount: false })), "newborn")?.rough), 40000);
  check("DG-36", "합 1.3억 통과", !!card(gov(hw, 5000, nb("o7000")), "newborn"), true);
  g = gov(hw, 5000, nb("o7000", { spouseIncomeRaw: "14000" }));
  check("DG-36a", "1인 1000초과, 통과0", [others(g, "newborn")?.failedChecks.map((c) => [c.key, c.over]), g.passed.length, g.others[0].key], [[["perPerson", 1000]], 0, "newborn"]);
  check("DG-37", "합1.35억 맞벌이", card(gov(hw, 12000, nb("u3000")), "newborn")?.income.label, "맞벌이");
  check("DG-37a", "정밀0 → 외벌이", card(gov(hw, 12000, nb("u3000", { spouseIncomeRaw: "0" })), "newborn")?.income.label, "외벌이");
  const nbS = (bd) => ELIG({ ownBirthday: "1990-01-01", hasSpouse: false, homeCount: 0, firstTime: false, marital: "single", birthdays: [bd], hasDreamAccount: false });
  check("DG-41", "2024-09-30 신생아 아님", gov(hw, 6000, nbS("2024-09-30")).f.hasNewborn, false);
  check("DG-42/F-05", "2024-10-05 신생아 아님(규칙)", gov(hw, 6000, nbS("2024-10-05")).f.hasNewborn, false, "F-05: true면 재현");
  check("DG-42b/F-05", "2024-10-01 신생아 아님(규칙)", gov(hw, 6000, nbS("2024-10-01")).f.hasNewborn, false);
  check("DG-43", "2024-10-13 신생아", gov(hw, 6000, nbS("2024-10-13")).f.hasNewborn, true);
  check("DG-45", "미래 출생", gov(hw, 6000, nbS("2026-11-01")).f.hasNewborn, false);
  // D youth
  const y87 = (bd, extra = {}) => ELIG({ ownBirthday: bd, hasSpouse: false, homeCount: 0, firstTime: true, marital: "single", hasDreamAccount: true, ...extra });
  g = gov(yk, 7000, y87("1987-01-01"));
  check("DG-61", "청년 3억, 보금자리 위, 일반 초과", [r0(card(g, "youthDream")?.rough), g.passed[0].key, others(g, "general")?.failedChecks.map((c) => [c.key, c.over])], [30000, "bogeumjari", [["income", 1000], ["price", 29995]]]);
  g = gov(yk, 7000, y87("1986-10-01", { hasDreamAccount: null }));
  check("DG-62", "40세 청년 미통과 사유", others(g, "youthDream")?.unmetRequires.map((r) => r.label), ["주택드림 통장 청약당첨 + 통장 연계", "만 39세 이하"]);
  g = gov(yk, 5000, ELIG({ ownBirthday: "1995-01-01", hasSpouse: true, homeCount: 0, firstTime: false, marital: "married", marriedWithin7: true, spouseBand: "3to5", hasDreamAccount: true }));
  check("DG-63", "신혼 청년 LTV 3억6497", [r0(card(g, "youthDream")?.rough), card(g, "youthDream")?.limit], [36497, 40000]);
  check("DG-64", "7100 통과0", gov(yk, 7100, y87("1987-01-01")).passed.length, 0);
  check("DG-65", "28세 청년 세대주 막힘", others(gov(yk, 4000, y87("1997-12-31")), "youthDream")?.unmetRequires.map((r) => r.label.slice(0, 3)), ["세대주"]);
  // E limits
  const djP = (inc) => r0(card(gov(dj, inc, single90(true)), "general")?.rough);
  check("DG-71..73", "DTI 600/800/1000", [djP(600), djP(800), djP(1000)], [7116, 9488, 10565]);
  check("DG-74", "didimdolDtiLimit", [r0(E.didimdolDtiLimit(5000, 0)), r0(E.didimdolDtiLimit(5000, 2000))], [59297, 57186]);
  check("DG-75", "2110", r0(E.didimdolDtiLimit(2110, 0)), 25023);
  check("DG-76", "음수 아님", E.didimdolDtiLimit(1000, 12000), 0);
  const at = E.didimdolDtiAt(E.didimdolDtiLimit(5000, 2000), 5000, 2000);
  check("DG-77", "역산=정산", [+at.ratio.toFixed(6), r0(at.roomAnnual)], [0.6, 0]);
  const at2 = E.didimdolDtiAt(20000, 5000, 0);
  check("DG-78", "DTI 20.24%, 월84", [+(at2.ratio * 100).toFixed(2), r0(at2.ownMonthly)], [20.24, 84]);
  check("DG-79", "소득0 → null", E.didimdolDtiAt(10000, 0, 0).ratio, null);
  check("DG-83", "region 항 없음", E.limitParts(D.PRODUCTS.didimdol, 200000, 5000).parts.map((p) => p.key), ["ltv", "dti", "cap"]);
}

// ═══ 04 bogeumjari ═══
{
  const dj = unit("동진", 38.79, "중계동");
  const bj = card(gov(dj, 4000, single90(true)), "bogeumjari");
  check("BJ-01", "보금자리 카드", [r0(bj.rough), bj.limit], [16065, 36000]);
  const per = PERSON(4000, single90(true), { detail: confirmed() });
  let s = strategy(dj, per, "bogeumjari");
  check("BJ-02", "방법 아니오", [s.parts.ltv, s.binding], [10565, "ltv"]);
  s = strategy(dj, { ...per, pull: { offsetRoom: true } }, "bogeumjari");
  check("BJ-03", "방법 네", s.parts.ltv, 16065);
  s = strategy(dj, PERSON(4000, single90(true), { detail: confirmed({ credit: 1000 }) }), "bogeumjari");
  check("BJ-04", "신용1000 DSR60", [s.parts.dti, s.binding], [41939, "ltv"]);
  const g5 = gov(unit("성원2", 84.78, "중계동"), 4000, ELIG({ ownBirthday: "1997-12-31", hasSpouse: false, homeCount: 0, firstTime: false, marital: "single", hasDreamAccount: false }));
  check("BJ-05/Q-03", "28세 보금자리 3.6억", r0(card(g5, "bogeumjari")?.rough), 36000);
  check("BJ-06", "7100 초과", others(gov(dj, 7100, single90(false)), "bogeumjari")?.failedChecks.map((c) => [c.key, c.over]), [["income", 100]]);
  check("BJ-07", "신혼 9500 4억", [card(gov(unit("염광", 59.34, "중계동"), 6000, ELIG({ ownBirthday: "1992-01-01", hasSpouse: true, homeCount: 0, firstTime: false, marital: "married", marriedWithin7: true, spouseBand: "3to5", spouseIncomeRaw: "3500", hasDreamAccount: false })), "bogeumjari")?.limit], [40000]);
  check("BJ-12", "소득800 보금자리", r0(card(gov(dj, 800, single90(true)), "bogeumjari")?.rough), 8584);
  const lt = L.limitAt("bogeumjari", { price: 22950, income: 4000, debt: 1000, debts: { credit: 1000 }, offsetRoom: false }, 36000);
  const expectCap = (4000 * 0.6 - 1000 * 0.055) / 12 * ((Math.pow(1 + 0.038 / 12, 360) - 1) / ((0.038 / 12) * Math.pow(1 + 0.038 / 12, 360)));
  check("BJ-13", "이자만 5.5%, 스트레스 없음", r0(lt.parts.find((p) => p.key === "dti").value), r0(expectCap));
  check("BJ-15", "예상 원리금 1억6065 → 월75", r0(E.monthlyInstallment(D.PRODUCTS.bogeumjari, 16065)), 75);
}

// ═══ 05 bank extra ═══
{
  const zh = unit("중앙하이츠", 84.21, "중계동");
  // F-01: planned + 예비배우자 band, bank own only
  const el = ELIG({ ownBirthday: "1995-01-01", hasSpouse: false, homeCount: 0, firstTime: true, marital: "planned", spouseBand: "3to5", hasDreamAccount: false });
  const s = strategy(zh, PERSON(4000, el, { detail: confirmed() }), "bankMortgage");
  check("BK-21/F-01", "예비배우자 은행 DSR 미합산(규칙 2억41만)", s.parts.dti, 20041, "F-01: 40082면 재현");
  // N-01 married + bank 본인 소득만 → withSpouse clears marital
  const married = ELIG({ ownBirthday: "1990-01-01", hasSpouse: true, homeCount: 0, firstTime: true, marital: "married", marriedWithin7: true, spouseBand: "3to5", hasDreamAccount: false });
  const after = P.withSpouse(married, false);
  check("N-01", "기혼이 은행 '본인 소득만' → 정부 결혼 답 유지돼야", [after.marital, after.marriedWithin7, P.eligReady(after)], ["married", true, true], "null이면 정부 답이 지워진다");
  // BK-31..37
  const sw = unit("성원2", 84.78, "중계동");
  const y97 = ELIG({ ownBirthday: "1997-12-31", hasSpouse: false, homeCount: 0, firstTime: false, marital: "single", hasDreamAccount: false });
  let b = cards(sw, PERSON(4000, y97), "bank");
  check("BK-31", "notHead / 2억41", [E.realDemandHeadGap({ ...b.f, income: 4000, price: sw.price }), r0(b.passed[0].rough), E.regulatoryLtv(b.f).rate], ["notHead", 20041, 0.4]);
  b = cards(sw, bankOnly(4000), "bank");
  check("BK-32", "unknown", E.realDemandHeadGap(b.f), "unknown");
  check("BK-33", "생애최초면 null", E.realDemandHeadGap(cards(sw, bankOnly(4000, { firstTime: true }), "bank").f), null);
  const m80s = ELIG({ ownBirthday: "1980-01-01", hasSpouse: false, homeCount: 0, firstTime: false, marital: "single", hasDreamAccount: false });
  const h6 = unit("현대(6차)", 84.98, "중계동");
  b = cards(h6, PERSON(9000, m80s), "bank");
  check("BK-34", "8억800 → 40% 3억2320", [E.regulatoryLtv(b.f).rate, r0(b.passed[0].rough), E.realDemandHeadGap(b.f)], [0.4, 32320, null]);
  const kh = unit("금호타운(583)", 84.98, "중계동");
  check("BK-35", "금호타운 정밀 4억5092", r0(V.judgeUnit(kh, PERSON(9000, m80s)).loan), 45092);
  const j36 = V.judgeUnit(kh, PERSON(9100, m80s));
  check("BK-36", "9100 → 은행 3억2000(정밀 best)", [r0(j36.loan), j36.best?.product], [32000, "bank"], "다른 상품이 best면 문서 전제가 다름");
  const lv = P.leverOf(PERSON(8000, m80s), 80000, null, false);
  check("BK-37", "ceilingAt 9천 지점", r0(L.ceilingAt("bank", lv).limit), 45092);
  // E debts
  const pb = (debts, own = 4000) => strategy(zh, PERSON(own, ELIG({ homeCount: 0, firstTime: true, hasSpouse: false }), { detail: confirmed(debts) }), "bankMortgage").parts.dti;
  check("BK-41..48", "부채 7종 DSR", [pb({ minus: 1000 }), pb({ credit: 1000 }), pb({ jeonse: 1000 }), pb({ mortgage: 1000 }), pb({ nonHome: 1000 }), pb({ cardIns: 1000 }), pb({ auto: 1000 }), pb({ credit: 1000, auto: 1000 })], [16471, 16471, 18976, 20041, 17411, 15866, 15866, 12296]);
  check("BK-49", "소득1000 신용2000 → 0", pb({ credit: 2000 }, 1000), 0);
  check("BK-51", "종류없음 285", r0(BANKDSR.bankExistingAnnual({ balance: 1000 })), 285);
  const s63 = strategy(zh, PERSON(4000, ELIG({ homeCount: 0, firstTime: true, hasSpouse: false }), { detail: confirmed() }), "bankMortgage");
  check("BK-63/F-14", "은행만 본인소득 → 라벨 인정소득", s63.incomeLabel, "인정소득");
  check("BK-64", "은행 소득 최대 3억", s63.incomeMax, 30000);
}

// ═══ 06 strategy ═══
{
  const us = unit("우성", 47.11, "묵동"), dj = unit("동진", 38.79, "중계동"), zh = unit("중앙하이츠", 84.21, "중계동");
  const pd = (inc, debts = {}, pull = null) => PERSON(inc, single90(true), { detail: confirmed(debts), pull });
  let s = strategy(us, pd(4000), "general");
  check("ST-21", "P-담보", [s.parts.ltv, s.parts.dti, s.parts.cap, s.binding], [15500, 47438, 20000, "ltv"]);
  s = strategy(dj, pd(800), "general");
  check("ST-22", "P-DTI", [s.parts.dti, s.binding, r0(s.cash)], [9488, "dti", 13462]);
  s = strategy(zh, PERSON(4000, ELIG({ homeCount: 0, firstTime: true, hasSpouse: false }), { detail: confirmed() }), "bankMortgage");
  check("ST-23", "P-은행", [s.parts.ltv, s.parts.dti, s.parts.region, s.binding], [43640, 20041, 60000, "dti"]);
  check("ST-24/F-07", "주택담보 1천 → DTI 그대로(규칙)", strategy(dj, pd(800, { mortgage: 1000 }), "general").parts.dti, 9488, "F-07: 8432면 재현");
  check("ST-25", "신용 1천", strategy(dj, pd(800, { credit: 1000 }), "general").parts.dti, 8432);
  check("ST-28", "예상 원리금", [r0(E.monthlyInstallment(D.PRODUCTS.didimdol, 15500)), r0(E.monthlyInstallment(D.PRODUCTS.bank, 20041)), r0(E.monthlyInstallment(D.PRODUCTS.bogeumjari, 16065))], [65, 96, 75]);
  check("ST-31", "P-담보+신용 → inert", strategy(us, pd(4000, { credit: 1000 }), "general").leversInert, true);
  s = strategy(dj, pd(800, { credit: 1000 }), "general");
  check("ST-32", "P-DTI 손잡이 보임, 소득최대 6000", [s.leversInert, s.incomeMax], [false, 6000]);
  check("ST-33", "신용 0까지", r0(strategy(dj, pd(800, { credit: 1000 }, { debts: { credit: 0 } }), "general").reach.limit), 9488);
  s = strategy(dj, pd(800, { credit: 1000 }, { income: 3000 }), "general");
  check("ST-34", "소득 3000 → 담보", [r0(s.reach.limit), s.binding], [10565, "ltv"]);
  s = strategy(dj, pd(800, { credit: 1000 }, { income: 6000 }), "general");
  check("ST-35", "6000 끝, 게이지 천장", [r0(s.reach.limit), r0(s.gaugeCeiling)], [10565, 16065]);
  s = strategy(dj, PERSON(6000, single90(false), { detail: confirmed({ jeonse: 60000 }) }), "general");
  check("ST-37", "전세6억 DTI 7827, 소득칸 상한", [s.parts.dti, s.binding, s.incomeMax - 6000], [7827, "dti", 0]);
  s = strategy(zh, PERSON(9000, ELIG({ homeCount: 0, firstTime: true, hasSpouse: false }), { detail: confirmed() }), "bankMortgage");
  check("ST-42/F-03", "담보 벽이면 inert(규칙)", [s.parts.ltv, s.binding, s.leversInert], [43640, "ltv", true], "F-03: leversInert=false면 재현");
  const s42 = strategy(zh, PERSON(9000, ELIG({ homeCount: 0, firstTime: true, hasSpouse: false }), { detail: confirmed(), pull: { income: 12000 } }), "bankMortgage");
  check("ST-42b", "소득 1.2억 올려도 그대로", r0(s42.reach.limit), 43640);
  const kh = unit("금호타운(583)", 84.98, "중계동");
  const m80s = ELIG({ ownBirthday: "1980-01-01", hasSpouse: false, homeCount: 0, firstTime: false, marital: "single", hasDreamAccount: false });
  s = strategy(kh, PERSON(9000, m80s, { detail: confirmed() }), "bankMortgage");
  check("ST-43", "금호타운 서민 60% 4억2500, inert", [s.parts.ltv, s.binding, s.leversInert], [42500, "ltv", true]);
  // ST-51 newborn per-person
  const nbE = ELIG({ ownBirthday: "1990-01-01", hasSpouse: true, homeCount: 0, firstTime: false, marital: "married", marriedWithin7: true, birthdays: ["2025-03-01"], spouseBand: "u3000", hasDreamAccount: false });
  const hw = unit("한화꿈에그린", 84.902, "중계동");
  s = strategy(hw, PERSON(1500, nbE, { detail: confirmed() }), "newborn");
  check("ST-51/F-04", "소득 최대(규칙 1억4500)", [s.parts.dti, s.binding, s.incomeMax], [35578, "dti", 14500], "F-04: 20000이면 재현");
  const s51 = strategy(hw, PERSON(1500, nbE, { detail: confirmed(), pull: { income: 15000 } }), "newborn");
  const j51 = V.judgeUnit(hw, PERSON(1500, nbE, { detail: confirmed(), pull: { income: 15000 } }));
  check("ST-51b/F-04", "1.5억 가정: 방법화면 vs 목록 같은 상품?", [s51.picked.key, r0(s51.reach.limit), j51.best?.key, r0(j51.loan)], (a) => a[0] === a[2], `방법=${s51.picked.key} ${r0(s51.reach.limit)} / 목록=${j51.best?.key} ${r0(j51.loan)}`);
  const lv53 = P.leverOf(PERSON(9000, single90(false)), 22950, 6000, false);
  check("ST-53", "범위 안 뒤집힘", [lv53.income, lv53.incomeMax], [9000, 9000]);
  const ctx54 = E.buildCtx({ unit: dj, ownIncome: 4000, elig: single90(false) });
  const a54 = E.withAssumedIncome(ctx54, 7000);
  check("ST-54", "미혼 가정소득 → 본인", [a54.ownIncome, a54.spouseIncome, E.deriveFacts(a54).dualIncome], [7000, 0, false]);
  s = strategy(us, pd(4000, {}, { offsetRoom: true }), "general");
  check("ST-62", "P-담보 네 → cap 2억", [r0(s.reach.limit), s.binding], [20000, "cap"]);
  // ST-71 / F-06 swap
  const pbk = PERSON(4000, ELIG({ homeCount: 0, firstTime: true, hasSpouse: false }), { detail: confirmed() });
  const s71 = strategy(unit("성원2", 84.78, "중계동"), pbk, null);
  check("ST-71/F-06", "매물 교체 후 pickedKey=null → 상품", s71.picked.key, "bankMortgage", "F-06: bogeumjari면 재현");
}

// ═══ 07 state ═══
{
  const u = unit("동진", 38.79, "중계동");
  const per = PERSON(4000, single90(true), { detail: confirmed({ credit: 1000 }) });
  check("X-34", "judgeUnit 결정적", JSON.stringify(V.judgeUnit(u, per)) === JSON.stringify(V.judgeUnit(u, per)), true);
  // X-35: same product, strategy vs list differ only by room deduction
  const zh = unit("중앙하이츠", 84.21, "중계동");
  const pp = PERSON(12000, ELIG({ homeCount: 0, firstTime: true, hasSpouse: false }), { detail: confirmed() });
  const st = strategy(zh, pp, "bankMortgage"), ju = V.judgeUnit(zh, pp);
  check("X-35", "목록 − 방법 = 5,500(은행 담보 벽)", r0(ju.loan - st.reach.limit), 5500);
}

// ═══ 08 income check (logic re-implemented from IncomeCheck.jsx with the same expression) ═══
{
  const { ACTIVE_INCOME_TYPES, INCOME_TYPES } = INCOME;
  const visible = (type, answers, key) => type.checklist.filter((q) => {
    if (!q.condition) return true;
    const depIdx = answers[q.condition.dependsOn];
    if (depIdx == null) return false;
    const depQ = type.checklist.find((x) => x.id === q.condition.dependsOn);
    return depQ.choices[depIdx].pass === q.condition[key];
  });
  const t25 = ACTIVE_INCOME_TYPES.find((t) => t.displayName.startsWith("25개월"));
  check("IC-01", "estimated 그룹 없음 / 원문 2종 보존", [ACTIVE_INCOME_TYPES.some((t) => t.group === "estimated"), INCOME_TYPES.filter((t) => t.supported === false).length], [false, 2]);
  check("IC-11/F-08", "swing20=네 → 후속 보임 (현재 코드식 condition.답)", visible(t25, { swing20: 1 }, "답").map((q) => q.id), ["swing20", "swingSteady"], "F-08");
  check("IC-11/F-08-fix", "같은 식에 condition.answer를 쓰면", visible(t25, { swing20: 1 }, "answer").map((q) => q.id), ["swing20", "swingSteady"]);
  check("IC-19", "effectiveDate 전부 null", INCOME_TYPES.every((t) => t.effectiveDate == null), true);
}

dump();
