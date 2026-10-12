import { E, D, P, V, L, R, UNITS, unit, ELIG, PERSON, cards, strategy, confirmed, check, r0, dump } from "./h.mjs";
const single90 = (ft, extra = {}) => ELIG({ ownBirthday: "1990-01-01", hasSpouse: false, homeCount: 0, firstTime: ft, marital: "single", hasDreamAccount: false, ...extra });

// N-02: 인근 다른 매물/목록 숫자가 방공제 토글 이력(null vs false)에 따라 달라진다
{
  const zh = unit("중앙하이츠", 84.21, "중계동");
  const el = ELIG({ homeCount: 0, firstTime: true, bankIncomeJoint: false });
  const fresh = PERSON(12000, el, { detail: confirmed(), pull: null });
  const toggled = PERSON(12000, el, { detail: confirmed(), pull: { offsetRoom: false } }); // 네 → 아니오
  const a = V.judgeUnit(zh, fresh), b = V.judgeUnit(zh, toggled);
  check("N-02", "같은 '아니오' 화면인데 다른 매물 숫자가 같아야", [r0(a.loan), r0(b.loan)], (x) => x[0] === x[1], `처음=${r0(a.loan)} / 네→아니오 후=${r0(b.loan)}`);
  const sa = strategy(zh, fresh, "bankMortgage"), sb = strategy(zh, toggled, "bankMortgage");
  check("N-02b", "방법 화면 숫자는 둘 다 같다", [r0(sa.reach.limit), r0(sb.reach.limit)], (x) => x[0] === x[1]);
}

// N-03: 디딤돌에서 방공제 '네'를 고르면 벽이 DTI로 옮겨도 손잡이가 숨는다 (F-03의 거울)
{
  const us = unit("우성", 47.11, "묵동");
  const p = PERSON(1500, single90(true), { detail: confirmed(), pull: { offsetRoom: true } });
  const s = strategy(us, p, "general");
  check("N-03", "네 상태: 벽=DTI면 손잡이가 보여야", [s.binding, r0(s.reach.limit), s.leversInert], (x) => !(x[0] === "dti" && x[2] === true), `binding=${s.binding} limit=${r0(s.reach.limit)} inert=${s.leversInert} parts=${JSON.stringify(s.parts)}`);
  // 손잡이를 쓸 수 있었다면 얼마까지 열리는가
  const up = strategy(us, { ...p, pull: { offsetRoom: true, income: 6000 } }, "general");
  // 이 폭이 0보다 크면 손잡이가 보여야 한다(N-03). 폭 자체는 결함이 아니라 도메인 사실이다.
  check("N-03b", "열리는 폭이 있으면 손잡이가 보인다", [r0(up.reach.limit - s.reach.limit), s.leversInert], (x) => x[0] > 0 && x[1] === false, `열리는 폭 ${r0(up.reach.limit - s.reach.limit)}만`);
}

// N-04: 정부 질문 도중(배우자 없음·무주택·생애최초까지만) 이미 정밀 모드
{
  const mid = ELIG({ ownBirthday: "1990-01-01", hasSpouse: false, homeCount: 0, firstTime: true }); // 결혼 미답
  check("N-04", "결혼 미답인데 personReady", [P.eligReady(mid), P.bankReady(mid), P.personReady(PERSON(4000, mid))], [false, false, false], "bankReady=true면 정부 답 일부로 은행이 '완료'된다");
  const dj = unit("동진", 38.79, "중계동");
  const j = V.judgeUnit(dj, PERSON(4000, mid));
  check("N-04b", "그 시점 목록 숫자", [r0(j.loan), j.best?.key], (x) => true, `정밀 숫자 ${r0(j.loan)} (${j.best?.key}), 대략이면 ${r0(E.evaluate(dj, E.repaymentCapacity(4000, .4, .04, 30, 0)).loan)}`);
}

// N-05: 미성년(민법상 성년 아님)도 보금자리·은행·일부 디딤돌이 열린다
{
  const kid = ELIG({ ownBirthday: "2015-01-01", hasSpouse: false, homeCount: 0, firstTime: true, marital: "single", hasDreamAccount: false });
  const g = cards(unit("동진", 38.79, "중계동"), PERSON(3000, kid));
  check("N-05", "만 11세 단독 → 열리는 상품 없어야", g.passed.map((p) => p.key), [], "성년 요건 미검사");
  const teen = ELIG({ ownBirthday: "2010-01-01", hasSpouse: false, homeCount: 0, firstTime: true, marital: "single", birthdays: ["2025-03-01"], hasDreamAccount: false });
  const g2 = cards(unit("동진", 38.79, "중계동"), PERSON(3000, teen));
  check("N-05b", "만 16세 + 자녀 → 일반가구 세대주 통과?", g2.passed.map((p) => p.key), (x) => !x.includes("general"), `통과: ${g2.passed.map((p) => p.key).join(",")}`);
}

// N-06: 청년 주택드림 세대주 요건 — 규칙 문서 1-4에 없다
{
  const rule = R.DIDIMDOL_RULES.find((r) => r.key === "youthDream");
  // 결정(2026-10-12): 세대주 요건을 유지하고 didimdol.md 1-4에 적는다. 성년(adult)은 5종 공통 진입.
  check("N-06", "youthDream requires (문서 1-4: 성년·무주택·세대주·통장·39세)", rule.requires.map((r) => r.flags.flat().join("|")), ["adult", "noHome", "householdHead", "hasDreamAccount", "under39"]);
}

// N-07: stale disposeExisting — 은행 '처분' → 정부 '네'(무주택) → 정부 '아니오' → 은행 버킷
{
  let e = ELIG({ homeCount: 1, disposeExisting: true, bankIncomeJoint: false });
  e = P.withHomeCount(e, 0); // 정부 '네'
  e = P.withHomeCount(e, 1); // 정부 '아니오'
  check("N-07", "다시 묻지 않고 처분조건부로 자동 선택?", P.homeBucketOf(e), null, "dispose면 사용자가 다시 확인하지 않은 처분 약정이 살아 있다");
}

// N-08: 정부 카드 '현금' / 은행 카드 '자본금'이 방법 화면 기본값과 다른 폭 (보금자리)
{
  const sw = unit("성원2", 84.78, "중계동");
  const p = PERSON(4000, ELIG({ ownBirthday: "1997-12-31", hasSpouse: false, homeCount: 0, firstTime: false, marital: "single", hasDreamAccount: false }), { detail: confirmed() });
  const card = cards(sw, p, "gov").passed.find((x) => x.key === "bogeumjari");
  const s = strategy(sw, p, "bogeumjari");
  check("N-08", "보금자리 카드 vs 방법 화면 기본", [r0(card.rough), r0(s.reach.limit)], (x) => true, `카드 ${r0(card.rough)} / 방법 기본 ${r0(s.reach.limit)}`);
}

// N-09: 결혼예정 + '배우자 있음' 모순 상태 허용
{
  const e = P.withSpouse(ELIG({ marital: "planned", spouseBand: "3to5" }), true);
  check("N-09", "결혼예정인데 배우자 있음", [e.hasSpouse, e.marital], [true, "planned"]);
}

// N-10: 외벌이 신생아가 소득 손잡이를 올리면 목록은 맞벌이로 본다 (withAssumedIncome → spouse)
{
  const e = ELIG({ ownBirthday: "1990-01-01", hasSpouse: true, homeCount: 0, firstTime: false, marital: "married", marriedWithin7: true, birthdays: ["2025-03-01"], spouseBand: null, spouseIncomeRaw: "0", hasDreamAccount: false });
  const ctx = E.buildCtx({ unit: unit("한화꿈에그린", 84.902, "중계동"), ownIncome: 12000, elig: e });
  const f = E.deriveFacts(E.withAssumedIncome(ctx, 12900));
  check("N-10", "가정 +900을 배우자 몫으로 → dualIncome", [f.dualIncome, f.maxPersonIncome], (x) => true, `dualIncome=${f.dualIncome} max1인=${f.maxPersonIncome}`);
}

// N-11: 첫 화면 슬라이더 최대 1.2억 — 신생아 외벌이 1.3억 구간을 본인 소득으로는 못 본다 (정보)
dump();
