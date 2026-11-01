/* 가족정보 카드 — 본인·배우자·자녀 생년월일(휠) + 배우자 유무. 자격 흐름의 첫 스텝.
   파생값(나이·미성년·신생아)은 engine.deriveFacts가 만들고, 여기선 그걸 그대로 되돌려 보여준다.
   ⚠️ 판정·계산을 두지 말 것(그건 engine/person). */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { C } from "../data.js";
import { filledAge } from "../person.js";
import { card, pill } from "../ui.jsx";

/* ── 가족정보 카드 ──
   질문을 셋으로 쪼개지 않고 한 카드에 묶는다. 사용자에겐 "우리 집 구성"이라는 한 덩어리이고,
   파생값(나이·배우자·자녀·신생아)도 이 덩어리에서 한꺼번에 나오기 때문. */
export function FamilyCard({ elig, set, setHasSpouse, facts, ready }) {
  const myAge = filledAge(elig.ownBirthday);
  const spouseAge = filledAge(elig.spouseBirthday);
  const kids = elig.birthdays;

  const addChild = () => set("birthdays", [...kids, ""]);
  const removeChild = (i) => set("birthdays", kids.filter((_, k) => k !== i));
  const setChild = (i, v) => set("birthdays", kids.map((d, k) => (k === i ? v : d)));

  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 3 }}>한 집에 같이 살 가족정보를 넣어주세요</div>
      {/* <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.55, marginBottom: 14 }}>
        생년월일만 있으면 나이·자녀 수·신생아 여부까지 저희가 알아서 봐요. 따로 또 묻지 않을게요.
      </div> */}

      <FieldRow label="본인 생년월일" hint={myAge !== null ? `만 ${myAge}세` : null}>
        <BirthdateInput value={elig.ownBirthday} onChange={(v) => set("ownBirthday", v)} maxYear={ADULT_YEAR_MAX} />
      </FieldRow>

      <Divider />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>배우자</span>
        {spouseAge !== null && <span style={{ fontSize: 12, color: C.greenDeep, fontWeight: 700 }}>만 {spouseAge}세</span>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setHasSpouse(true)} style={pill(elig.hasSpouse === true)}>배우자 있음</button>
        <button onClick={() => setHasSpouse(false)} style={pill(elig.hasSpouse === false)}>배우자 없음</button>
      </div>
      {elig.hasSpouse === true && (
        <div className="slideup" style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: C.faint, marginBottom: 4 }}>배우자 생년월일 (몰라도 넘어갈 수 있어요)</div>
          <BirthdateInput value={elig.spouseBirthday} onChange={(v) => set("spouseBirthday", v)} maxYear={ADULT_YEAR_MAX} />
        </div>
      )}

      <Divider />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>미성년 자녀 {kids.length > 0 ? `${kids.length}명` : "없음"}</span>
        <button onClick={addChild} style={{ padding: "6px 12px", borderRadius: 9, border: `1.5px solid ${C.line}`, background: "#fff", color: C.greenDeep, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>+ 자녀 추가</button>
      </div>
      {kids.length === 0
        ? <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.55 }}>없으면 그대로 두세요. 미성년 자녀 수와 신생아 여부로 상한이 달라져서 여쭤봐요.</div>
        : <div style={{ display: "grid", gap: 8 }}>
            {kids.map((d, i) => {
              const a = filledAge(d);
              return (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.inkSoft }}>{i + 1}번째 아이 생년월일{a !== null ? ` · 만 ${a}세` : ""}</span>
                    <button onClick={() => removeChild(i)} style={{ border: "none", background: "none", color: C.faint, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>삭제</button>
                  </div>
                  <BirthdateInput value={d} onChange={(v) => setChild(i, v)} />
                </div>
              );
            })}
          </div>}

      {/* 카드가 만들어낸 파생값을 그대로 되돌려 보여준다 — 무엇을 근거로 판정하는지 숨기지 않는다. */}
      {ready && (
        <div className="slideup" style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.inkSoft, lineHeight: 1.65 }}>
          <b style={{ color: C.greenDeep }}>이렇게 보고 계산해요</b><br />
          {/* 배우자 유무는 이 카드의 토글이 출처다 — facts.married는 아래 결혼여부 답이 있어야 켜진다.
              단 결혼예정은 아래에서 답해도 여기 계산에 들어오므로(예비배우자 소득 합산) 같이 적는다 */}
          만 {facts.age}세 · {elig.hasSpouse ? "배우자 있음" : facts.planned ? "예비배우자 있음(결혼예정)" : "배우자 없음"} · 자녀 {kids.length}명(미성년 {facts.minors}명)
          {facts.hasNewborn && <span style={{ color: C.greenDeep, fontWeight: 700 }}> · 신생아 특례 대상 자녀 있음</span>}
        </div>
      )}
    </div>
  );
}

/* ── 생년월일 휠 ──
   키보드로 치지 않는다. 가장 최근 해가 가운데에서 시작하고, 위로 밀면 더 이전 해로 간다.
   본인·배우자는 올해 성년(만 19세)이 되는 해가 가장 최근 해다 — 미성년은 차주가 될 수 없으니 고를 수 없게 한다.
   자녀는 올해까지.
   값은 여전히 "YYYY-MM-DD". 밀거나 누르기 전에는 빈 문자열 그대로라 나이가 생기지 않는다.
   윤년·월말는 고르는 쪽에서 자른다. "2월 30일"이 다음 달로 밀리지 않게.

   멈춤 규칙 — 밀고 손을 떼면 브라우저 스냅이 한 칸에 멈춘 뒤(scrollend, 없으면 조용해진 뒤)에만 값을 정한다.
   그 순간 칸 경계에 정확히 맞춰 놓고(scrollTop = index × 칸 높이) 값을 올린다. 중간에 걸친 채로 값이 정해지지 않는다. */
const THIS_YEAR = new Date().getFullYear();
const ADULT_AGE = 19;                                  // 민법상 성년 — engine.deriveFacts.adult와 같은 기준
export const ADULT_YEAR_MAX = THIS_YEAR - ADULT_AGE;   // 본인·배우자 휠의 가장 최근 해
const BIRTH_YEAR_MIN = THIS_YEAR - 100;
const yearsDownFrom = (max) => Array.from({ length: max - BIRTH_YEAR_MIN + 1 }, (_, i) => max - i);
const BIRTH_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const WHEEL_H = 32;
const SETTLE_FALLBACK_MS = 140;   // scrollend가 없는 브라우저: 스크롤 이벤트가 이만큼 조용하면 멈춘 것으로 본다
const hasScrollEnd = typeof window !== "undefined" && "onscrollend" in window;

const pad2 = (n) => String(n).padStart(2, "0");
const daysInMonth = (y, m) => new Date(Number(y), Number(m), 0).getDate() || 31;
const splitYMD = (v) => { const [y = "", m = "", d = ""] = (v || "").split("-"); return [y, m, d]; };

function WheelColumn({ label, items, selected, format, onSelect }) {
  const ref = useRef(null);
  const armed = useRef(false);      // 프로그램이 맞춘 스크롤은 사용자의 밀기로 보지 않는다
  const moving = useRef(false);     // 사용자가 밀고 있거나 아직 멈추지 않았다
  const touched = useRef(false);    // 한 번이라도 손을 댔다 — 그전의 스크롤 이벤트는 무시
  const timer = useRef(0);
  const latest = useRef({ items, selected, onSelect });
  latest.current = { items, selected, onSelect };
  const index = Math.max(0, items.findIndex((it) => it === selected));

  /* 값이 바뀌면 그 칸으로 맞춘다. 사용자가 미는 중이면 건드리지 않는다(싸우면 엉뚱한 칸에 선다).
     이미 그 자리면 다시 쓰지 않는다 — 스냅 애니메이션 끝에 우리가 맞춰 놓은 값이라 덮어쓸 게 없다. */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || moving.current) return;
    const top = index * WHEEL_H;
    if (Math.abs(el.scrollTop - top) < 0.5) return;
    armed.current = false;
    el.scrollTop = top;
    const id = requestAnimationFrame(() => { armed.current = true; });
    return () => cancelAnimationFrame(id);
  }, [index, items.length]);

  /* 멈춘 순간: 가장 가까운 칸으로 정확히 맞추고 값을 올린다. */
  function settle() {
    const el = ref.current;
    if (!el) return;
    const { items: its, selected: sel, onSelect: pick } = latest.current;
    const next = Math.min(its.length - 1, Math.max(0, Math.round(el.scrollTop / WHEEL_H)));
    moving.current = false;
    const top = next * WHEEL_H;
    if (Math.abs(el.scrollTop - top) >= 0.5) { armed.current = false; el.scrollTop = top; requestAnimationFrame(() => { armed.current = true; }); }
    if (its[next] !== sel) pick(its[next]);
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      if (!armed.current || !touched.current) return;
      moving.current = true;
      if (hasScrollEnd) return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(settle, SETTLE_FALLBACK_MS);
    };
    const onEnd = () => { if (moving.current) settle(); };
    el.addEventListener("scroll", onScroll, { passive: true });
    if (hasScrollEnd) el.addEventListener("scrollend", onEnd);
    const arm = requestAnimationFrame(() => { armed.current = true; });
    return () => {
      cancelAnimationFrame(arm);
      window.clearTimeout(timer.current);
      el.removeEventListener("scroll", onScroll);
      if (hasScrollEnd) el.removeEventListener("scrollend", onEnd);
    };
  }, []);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: C.faint, marginBottom: 4 }}>{label}</div>
      <div style={{ position: "relative", height: WHEEL_H * 5 }}>
        <div aria-hidden="true" style={{ position: "absolute", left: 2, right: 2, top: WHEEL_H * 2, height: WHEEL_H, borderRadius: 8, background: C.soft, pointerEvents: "none" }} />
        <div
          ref={ref}
          className="birth-wheel"
          role="listbox"
          aria-label={label}
          onPointerDown={() => { touched.current = true; }}
          onWheel={() => { touched.current = true; }}
        >
          <div style={{ height: WHEEL_H * 2 }} />
          {items.map((it) => {
            const on = it === selected;
            return (
              <button key={it} type="button" role="option" aria-selected={on}
                onClick={() => { if (!moving.current) onSelect(it); }}
                className={on ? "birth-opt on" : "birth-opt"}>
                {format(it)}
              </button>
            );
          })}
          <div style={{ height: WHEEL_H * 2 }} />
        </div>
      </div>
    </div>
  );
}

/* maxYear = 고를 수 있는 가장 최근 해. 본인·배우자는 ADULT_YEAR_MAX, 자녀는 올해(기본). */
function BirthdateInput({ value, onChange, maxYear = THIS_YEAR }) {
  const [ys, ms, ds] = splitYMD(value);
  const filled = ys.length === 4 && ms.length >= 1 && ds.length >= 1;
  const years = useMemo(() => yearsDownFrom(maxYear), [maxYear]);
  const year = filled ? Math.min(Number(ys), maxYear) : maxYear;
  const month = filled ? Number(ms) : 1;
  const day = filled ? Number(ds) : 1;
  const dayItems = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);
  const safeDay = Math.min(day, dayItems.length);

  function commit(ny, nm, nd) {
    const last = daysInMonth(ny, nm);
    onChange(`${ny}-${pad2(nm)}-${pad2(Math.min(nd, last))}`);
  }

  return (
    <div>
      <style>{`.birth-wheel{height:${WHEEL_H * 5}px;overflow-y:auto;scroll-snap-type:y mandatory;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none;mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);}
.birth-wheel::-webkit-scrollbar{display:none;}
.birth-opt{display:block;width:100%;height:${WHEEL_H}px;scroll-snap-align:center;scroll-snap-stop:always;border:none;background:transparent;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:${C.faint};font-variant-numeric:tabular-nums;transition:color .15s ease,font-size .15s ease;}
.birth-opt.on{font-size:16px;font-weight:800;color:${C.ink};}
@media (prefers-reduced-motion: reduce){.birth-opt{transition:none;}}`}</style>
      {!filled && <div style={{ fontSize: 11, color: C.faint, marginBottom: 4 }}>{maxYear}년부터 위로 밀어 고르세요</div>}
      <div style={{ display: "flex", gap: 6 }}>
        <WheelColumn label="년" items={years} selected={year} format={(n) => String(n)} onSelect={(v) => commit(v, month, safeDay)} />
        <WheelColumn label="월" items={BIRTH_MONTHS} selected={month} format={(n) => `${n}월`} onSelect={(v) => commit(year, v, safeDay)} />
        <WheelColumn label="일" items={dayItems} selected={safeDay} format={(n) => `${n}일`} onSelect={(v) => commit(year, month, v)} />
      </div>
    </div>
  );
}

function FieldRow({ label, hint, children }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>{label}</span>
        {hint && <span style={{ fontSize: 12, color: C.greenDeep, fontWeight: 700 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const Divider = () => <div style={{ borderTop: `1px solid ${C.line}`, margin: "14px 0" }} />;

