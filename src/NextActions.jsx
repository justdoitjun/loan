/* 방법 화면의 「다음 액션」 — 규칙은 .claude/rules/ux.md 「다음 액션」.
   부채를 확정해 전략이 선 뒤에만 "이대로 알아보기" 바가 화면 아래 고정으로 뜬다(StickyCta).
   누르면 바텀시트(NextActionsSheet)에 네 액션이 버튼으로 한 번에 보인다 — 저장 · 영업점 예약 · 부동산 상담 · 전문가 상담.
   문구·주소·서류 목록은 data.NEXT_ACTIONS, 기록은 src/nextAction.js. 여기는 그리기와 클릭 연결만.
   확답하지 않고, 거절로 문을 닫지 않고, 영업처럼 굴지 않는다 — 노란 버튼은 영업점 예약 하나(고정 바 제외).
   ⚠️ 아직 안 열린 기능(부동산·전문가)은 그 줄 안에서 "준비 중이에요"라고 말하고 클릭은 기록한다. window.alert는 쓰지 않는다. */
import { useEffect, useRef, useState } from "react";
import { C, NEXT_ACTIONS } from "./data.js";
import { won } from "./engine.js";
import { primaryBtn, Placeholder, BottomSheet } from "./ui.jsx";
import { recordInterest, savePlan, isSaved } from "./nextAction.js";

const A = Object.fromEntries(NEXT_ACTIONS.actions.map((a) => [a.kind, a]));

/* 항상 보이는 바 — 전략이 선 뒤(부채 확정)에만 Strategy가 그린다. 스크롤해도 사라지지 않는다. 본문 열 너비(460px)에 맞춘다. */
export function StickyCta({ onClick }) {
  return (
    <div className="sticky-cta" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 20, pointerEvents: "none", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 460, padding: "0 clamp(12px, 4.2vw, 18px) max(12px, env(safe-area-inset-bottom))", pointerEvents: "auto" }}>
        <button type="button" onClick={onClick} style={{ ...primaryBtn, marginTop: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
          <span>{NEXT_ACTIONS.stickyLabel}</span><span aria-hidden="true">↑</span>
        </button>
      </div>
    </div>
  );
}

/* 바텀시트 — 네 액션이 컴팩트한 버튼 줄로 한 번에 보인다. */
export function NextActionsSheet({ unit, productKey, productTitle, loan, cash, onClose }) {
  const meta = { unitId: unit.id, name: unit.name, productKey, productTitle, loan, cash };
  const [saved, setSaved] = useState(() => isSaved(unit.id, productKey));
  const [docsOpen, setDocsOpen] = useState(false);
  const [soon, setSoon] = useState(null);   // 줄 안 "준비 중" 표시: "realtor" | "expert" | "branch-url"
  const closeRef = useRef(null);
  useEffect(() => { setSaved(isSaved(unit.id, productKey)); }, [unit.id, productKey]);

  const onSave = () => { savePlan(meta); recordInterest("save", meta); setSaved(true); };
  const onBranchOpen = () => {
    recordInterest("branch", meta);
    if (NEXT_ACTIONS.starBankingUrl) window.open(NEXT_ACTIONS.starBankingUrl, "_blank", "noopener");
    else setSoon("branch-url");
  };
  const onSoon = (kind) => { recordInterest(kind, meta); setSoon(kind); };

  return (
    <BottomSheet
      title="이대로 알아볼까요?"
      subtitle={`${productTitle} · 대출 약 ${won(loan)} · 필요 현금 약 ${won(cash)} · 숫자는 가정이에요`}
      onClose={onClose} closeRef={closeRef}>
      <div className="na-list">
        {/* ① 저장 — 가장 쉽게 눌리게. 여기서 안 움직이는 사람이 대다수라 재방문의 유일한 장치 */}
        <ActionRow n="1" a={A.save} onClick={onSave} disabled={saved}
          state={saved ? A.save.done : null}
          note={saved ? "이 기기에 저장했어요. 알림은 준비 중이라 아직 못 보내 드려요." : null} />

        {/* ② 영업점 예약 — 유일하게 실제로 작동하는 전환 지점. 서류를 아는 상태로 예약하는 게 가치 */}
        <ActionRow n="2" a={A.branch} tone="ok" onClick={() => setDocsOpen((v) => !v)} expanded={docsOpen}>
          <div className="acc" data-open={docsOpen}>
            <div className="acc-inner">
              <div style={{ padding: "2px 2px 4px" }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>이것만 챙기면 돼요</div>
                {NEXT_ACTIONS.branchDocs.length > 0
                  ? <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>{NEXT_ACTIONS.branchDocs.map((d) => <li key={d}>{d}</li>)}</ul>
                  : <div style={{ marginBottom: 10 }}><Placeholder>TODO · 준비 서류 목록을 정리하고 있어요. 곧 여기에 하나씩 적힐 거예요.</Placeholder></div>}
                <button type="button" onClick={onBranchOpen} style={{ ...primaryBtn, marginTop: 0, padding: "12px" }}>{A.branch.open}</button>
                <div style={{ fontSize: 11, color: C.faint, marginTop: 6, lineHeight: 1.5 }}>
                  {soon === "branch-url"
                    ? "스타뱅킹 예약 주소가 아직 연결되지 않았어요(TODO). 눌러 주신 건 기억해 둘게요."
                    : "예약 화면으로 넘어가요. 예약이 확정은 아니에요 — 창구에서 숫자를 다시 봐요."}
                </div>
              </div>
            </div>
          </div>
        </ActionRow>

        {/* ③ ④ 아직 안 열림 — 문을 닫지 않는다. 줄 안에서 "준비 중"이라 말하고 수요를 기록한다 */}
        <ActionRow n="3" a={A.realtor} onClick={() => onSoon("realtor")}
          state={soon === "realtor" ? NEXT_ACTIONS.soonTitle : null} note={soon === "realtor" ? NEXT_ACTIONS.soonBody : null} />
        <ActionRow n="4" a={A.expert} onClick={() => onSoon("expert")}
          state={soon === "expert" ? NEXT_ACTIONS.soonTitle : null} note={soon === "expert" ? NEXT_ACTIONS.soonBody : null} />
      </div>
      <style>{`
        .na-list{display:flex;flex-direction:column;gap:8px;padding-bottom:4px;}
        .na-row{border:1.5px solid ${C.line};border-radius:14px;background:#fff;}
        .na-row[data-tone="ok"]{border-color:${C.greenDeep};}
        .na-btn{width:100%;display:flex;align-items:center;gap:10px;padding:12px 14px;border:none;border-radius:14px;background:transparent;text-align:left;color:${C.ink};cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;}
        .na-btn:disabled{cursor:default;}
        .na-btn:focus{outline:none;} .na-btn:focus-visible{outline:3px solid ${C.greenDeep};outline-offset:2px;}
        .na-n{flex:0 0 22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:800;background:${C.softer};border:1px solid ${C.line};color:${C.ink};}
        .na-row[data-tone="ok"] .na-n{background:${C.green};border-color:${C.greenDeep};color:${C.onAccent};}
        .na-title{font-size:14px;font-weight:800;line-height:1.3;}
        .na-desc{font-size:12px;color:${C.inkSoft};line-height:1.5;margin-top:2px;}
        .na-state{flex:0 0 auto;font-size:11px;font-weight:800;color:${C.greenDeep};white-space:nowrap;}
        .na-chev{flex:0 0 auto;color:${C.inkSoft};font-size:12px;transition:transform .2s ease;}
        .na-note{padding:0 14px 12px 46px;font-size:11px;color:${C.inkSoft};line-height:1.55;}
        .na-body{padding:0 14px 12px 14px;}
        @media (prefers-reduced-motion: reduce){.na-chev{transition:none;}}
      `}</style>
    </BottomSheet>
  );
}

/* 액션 한 줄 = 버튼. 번호 · 제목 · 한 줄 설명 · 오른쪽 상태(저장됨 / 준비 중) 또는 화살표. children은 펼침 본문. */
function ActionRow({ n, a, tone, onClick, disabled, expanded, state, note, children }) {
  return (
    <div className="na-row" data-tone={tone || undefined}>
      <button type="button" className="na-btn" onClick={onClick} disabled={disabled} aria-expanded={children ? expanded : undefined}>
        <span className="na-n" aria-hidden="true">{n}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="na-title" data-fit="line" style={{ display: "block" }}>{a.title}</span>
          <span className="na-desc" data-fit="line" style={{ display: "block" }}>{a.desc}</span>
        </span>
        {state
          ? <span className="na-state">{state}</span>
          : <span className="na-chev" aria-hidden="true" style={{ transform: expanded ? "rotate(180deg)" : "none" }}>{children ? "▾" : "›"}</span>}
      </button>
      {note && <div className="na-note" data-fit="prose">{note}</div>}
      {children && <div className="na-body">{children}</div>}
    </div>
  );
}
