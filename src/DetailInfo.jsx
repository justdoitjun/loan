/* 부채 입력부 — Strategy 맨 위에 붙는 컴포넌트.
   이 앱에서 부채가 처음 등장하는 자리다. 자격 화면에서 일부러 빼둔 것들이 여기서 나온다.

   역할은 정답 수집이 아니라, 줄이기 슬라이더의 시작 위치 잡기다. 그래서 전부 '대충' 받는다.
   금액은 키패드로 적는다. 종류는 data.DEBT_KINDS만 그린다. 라벨을 여기 적지 않는다.
   여기서는 종류별 금액만 받는다. 월상환액·만기는 묻지 않는다.
   은행 DSR의 종류별 환산은 engine_bank_dsr.js가 한다. 여기서는 금액만 받는다.

   ⚠️ 자격은 여기서 절대 묻지 않는다. 자격 질문이 필요하면 그 경로 탭에만 단다
      (정부 → eligibility/gov.jsx, 은행 → eligibility/bank.jsx).

   진행: 처음엔 종류별 금액이 전부 0이다. 무부채도 유효한 답이라 안 만지고 넘어갈 수 있다.
   "확정"을 눌러야 잠기고, 그제서야 Strategy의 줄이기가 나타난다(detailReady). */
import { useEffect, useRef, useState } from "react";
import { C, DEBT_KINDS, LEVER } from "./data.js";
import { won, debtTotal } from "./engine.js";
import { debtsFrom } from "./person.js";
import { BottomSheet, Section, primaryBtn } from "./ui.jsx";

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "←"];

export default function DetailInfo({ value, onChange }) {
  const confirmed = value.debtConfirmed === true;
  const debts = debtsFrom(value.debts);
  const [pad, setPad] = useState(null);
  const active = !confirmed && pad ? pad : null;
  const typed = active ? clamp(parsedDigits(active.digits), 0, active.max) : 0;
  const view = active ? { ...debts, [active.key]: typed } : debts;
  const total = debtTotal(confirmed ? debts : view);
  const filled = DEBT_KINDS.filter((k) => debts[k.key] > 0);

  const confirmDebt = () => onChange({ ...value, debts, debtConfirmed: true });
  const editDebt = () => { setPad(null); onChange({ ...value, debtConfirmed: false }); };
  const setKind = (key, amount) => onChange({ ...value, debts: { ...debts, [key]: amount } });

  const open = (k) => {
    const max = k.max ?? LEVER.debtMax;
    const current = Math.round(debts[k.key] || 0);
    setPad({ key: k.key, label: k.label, max, digits: current > 0 ? String(Math.min(current, max)) : "", capped: false });
  };
  const commit = (amount) => {
    if (!active) return;
    setKind(active.key, clamp(Math.round(amount), 0, active.max));
    setPad(null);
  };

  return (
    <Section title="① 기존보유대출">
      <style>{DEBT_CSS}</style>
      {confirmed ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 12, background: "#F7FAF7", border: `1px solid ${C.line}` }}>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 6 }}>확정한 대출</div>
            {filled.length === 0 ? (
              <div style={{ fontSize: 16, fontWeight: 800 }}>없어요</div>
            ) : (
              <>
                {filled.map((k) => (
                  <div key={k.key} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "3px 0" }}>
                    <span style={{ color: C.inkSoft }}>{k.label}</span>
                    <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{won(debts[k.key])}원</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.line}`, fontSize: 14, fontWeight: 800 }}>
                  <span>합계</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{won(total)}원</span>
                </div>
              </>
            )}
          </div>
          <button onClick={editDebt} style={{ flex: "0 0 auto", padding: "8px 13px", borderRadius: 10, border: `1.5px solid ${C.line}`, background: "#fff", color: C.inkSoft, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            다시 정하기
          </button>
        </div>
      ) : (
        <>
          {DEBT_KINDS.map((k) => {
            const amount = view[k.key];
            return (
              <button key={k.key} type="button" className="debt-row" data-on={amount > 0 ? "true" : "false"} onClick={() => open(k)}
                aria-label={`${k.label}, ${amount > 0 ? won(amount) + "원" : "없어요"}. 금액 입력`}>
                <span className="debt-name">{k.label}</span>
                <span className="debt-side">
                  <span className="debt-amt">{amount > 0 ? `${won(amount)}원` : "없어요"}</span>
                  <span className="debt-edit">입력</span>
                </span>
              </button>
            );
          })}
          <button onClick={confirmDebt} style={primaryBtn}>
            {total === 0 ? "대출 없이 확정할게요" : `약 ${won(total)}원으로 확정할게요`}
          </button>
        </>
      )}

      {active && (
        <BalancePad
          pad={active}
          total={total}
          onDigits={(digits, capped) => setPad((p) => (p ? { ...p, digits, capped } : p))}
          onClose={() => setPad(null)}
          onCommit={commit} />
      )}
    </Section>
  );
}

function balancePresets(max) {
  return [
    { label: "없음", amount: 0 },
    { label: "1천만", amount: 1000 },
    { label: "3천만", amount: 3000 },
    { label: "5천만", amount: 5000 },
  ].filter((p) => p.amount <= max);
}

function BalancePad({ pad, total, onDigits, onClose, onCommit }) {
  const typed = clamp(parsedDigits(pad.digits), 0, pad.max);
  const digitsRef = useRef(pad.digits);
  const maxRef = useRef(pad.max);
  const onDigitsRef = useRef(onDigits);
  const onCommitRef = useRef(onCommit);
  digitsRef.current = pad.digits;
  maxRef.current = pad.max;
  onDigitsRef.current = onDigits;
  onCommitRef.current = onCommit;

  const pushDigits = (key) => {
    const prev = digitsRef.current;
    let next;
    let capped = false;
    if (key === "←") next = prev.slice(0, -1);
    else {
      const appended = appendDigits(prev, key, maxRef.current);
      next = appended.digits;
      capped = appended.capped;
    }
    digitsRef.current = next;
    onDigitsRef.current(next, capped);
  };

  useEffect(() => {
    const onKey = (e) => {
      const onButton = e.target instanceof HTMLElement && e.target.closest("button");
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        pushDigits(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        pushDigits("←");
      } else if (e.key === "Enter" && !onButton) {
        e.preventDefault();
        onCommitRef.current(parsedDigits(digitsRef.current));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hint = typed <= 0
    ? "이 대출은 없는 걸로 볼게요"
    : pad.capped
      ? `이 칸은 ${won(pad.max)}원까지 적어요`
      : `지금 합계 ${won(total)}원`;

  return (
    <BottomSheet fit="keypad" title={pad.label} subtitle="대략 얼마인지 적어도 돼요" onClose={onClose}>
      <div className="kp-fit">
      <div className="kp-amt">
        <div className="kp-figure" data-zero={typed === 0 ? "true" : "false"}>{won(typed)}원</div>
        <div className={typed > 0 && !pad.capped ? "kp-hint" : "kp-hint soft"} aria-live="polite">{hint}</div>
      </div>
      <div className="debt-chips">
        {balancePresets(pad.max).map((p) => (
          <button key={p.label} type="button" className="debt-chip" data-on={typed === p.amount ? "true" : "false"} aria-pressed={typed === p.amount}
            onClick={() => onCommit(p.amount)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="kp-grid" role="group" aria-label="금액 키패드">
        {PAD_KEYS.map((key) => (
          <button key={key} type="button" className={key === "←" || key === "00" ? "kp-key fn" : "kp-key"}
            aria-label={key === "←" ? "마지막 자리 지우기" : key}
            onClick={() => pushDigits(key)}>
            {key}
          </button>
        ))}
      </div>
      <button type="button" className="kp-go" onClick={() => onCommit(typed)}>이 금액으로</button>
      </div>
    </BottomSheet>
  );
}

function parsedDigits(digits) {
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

function appendDigits(prev, chunk, ceiling) {
  const base = !prev || prev === "0" ? "" : prev;
  let next = (base + chunk).replace(/^0+/, "");
  if (!next) return { digits: "", capped: false };
  if (next.length > 8) next = next.slice(0, 8);
  const n = Number(next);
  if (!Number.isFinite(n)) return { digits: prev || "", capped: false };
  if (n > ceiling) return { digits: ceiling > 0 ? String(Math.round(ceiling)) : "", capped: true };
  return { digits: next, capped: false };
}

const DEBT_CSS = `
  .debt-row,.debt-chip,.kp-key,.kp-go{font-family:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation;box-sizing:border-box;}
  .debt-row{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;margin:0 0 8px;padding:12px 14px;border-radius:14px;border:1.5px solid #E4E9E4;background:#fff;cursor:pointer;text-align:left;}
  .debt-row[data-on="true"]{border-color:#14705A;background:#F3F9F5;}
  .debt-row:active{background:#F7FAF7;}
  .debt-name{flex:1 1 auto;min-width:0;font-size:14px;font-weight:700;color:#1E2A24;line-height:1.35;}
  .debt-side{display:flex;align-items:center;gap:8px;flex:0 0 auto;}
  .debt-amt{font-size:15px;font-weight:800;color:#9AA3A0;font-variant-numeric:tabular-nums;}
  .debt-row[data-on="true"] .debt-amt{color:#14705A;}
  .debt-edit{font-size:12px;font-weight:800;color:#14705A;}
  .kp-fit{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;}
  .debt-chips{display:flex;gap:6px;margin:0 0 8px;flex:0 0 auto;}
  .debt-chip{flex:1 1 0;min-width:0;min-height:36px;padding:8px 2px;border-radius:11px;border:1.5px solid #E4E9E4;background:#fff;color:#1E2A24;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;}
  .debt-chip[data-on="true"]{border-color:#14705A;background:#E8F4EF;color:#14705A;}
  .debt-chip:active{background:#E7F0EA;}
  .kp-amt{flex:0 0 auto;padding:2px 2px 8px;text-align:center;}
  .kp-figure{font-size:32px;font-weight:800;letter-spacing:-.04em;line-height:1.1;font-variant-numeric:tabular-nums;color:#1E2A24;}
  .kp-figure[data-zero="true"]{color:#C5CDC8;}
  .kp-hint{margin-top:2px;min-height:1.25em;font-size:13px;font-weight:700;color:#14705A;}
  .kp-hint.soft{color:#5B6660;}
  .kp-grid{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(4,minmax(0,1fr));gap:6px;}
  .kp-key{height:auto;min-height:0;border:none;border-radius:14px;background:#F4F6F3;color:#1E2A24;font-size:22px;font-weight:700;cursor:pointer;font-variant-numeric:tabular-nums;}
  .kp-key.fn{font-size:16px;font-weight:800;color:#5B6660;}
  .kp-key:active{background:#E4EDE7;}
  .kp-go{flex:0 0 auto;width:100%;margin-top:8px;height:46px;border:none;border-radius:14px;background:#14705A;color:#fff;font-size:16px;font-weight:800;cursor:pointer;}
  .kp-go:active{background:#0E5343;}
  .kp-go:focus,.kp-key:focus,.debt-row:focus,.debt-chip:focus{outline:none;}
  .kp-go:focus-visible,.kp-key:focus-visible,.debt-row:focus-visible,.debt-chip:focus-visible{outline:3px solid #14705A;outline-offset:2px;}
`;
