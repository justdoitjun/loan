/* 부채 · 소득의 질 입력부 — Strategy(조종간) 맨 위에 붙는 컴포넌트.
   이 앱에서 부채가 처음 등장하는 자리다. 자격 화면에서 일부러 빼둔 것들이 여기서 나온다.

   역할은 "정답 수집"이 아니라 **레버의 시작 위치 잡기**다. 그래서 전부 '대충' 받는다
   — 정확한 값을 요구하면 사용자가 멈추고, 멈추면 레버를 만져볼 기회 자체가 사라진다.
   여기서 받은 값은 Strategy의 레버 초기값이 되고, 사용자는 곧바로 그걸 당겨서 움직인다.

   원칙: 여기서는 raw 값만 받는다. 해석(DTI/DSR 잣대)은 products/limit.js가 한다.
   ⚠️ 자격은 여기서 절대 묻지 않는다. 자격 질문이 필요하면 Eligibility에 추가할 것.

   진행 방식: 이 페이지에 처음 들어오면 부채 슬라이더 하나만 활성화돼 있다.
   슬라이더는 0(왼쪽 끝)에서 시작 — 무부채도 유효한 답이라 굳이 안 만지고 넘어갈 수 있다.
   "확정"을 눌러야 그 값이 잠기고, 그제서야 소득의 질 질문이 열린다(slideup).
   Strategy의 레버 이하 섹션들은 이 확정 + 소득의 질 답변이 다 끝나야 나타난다(detailReady).
   확정 없이 슬라이더 값만으로 다음 질문을 여는 걸 일부러 막았다 — 애매하게 넘어가지 않고
   "이 금액으로 본다"는 걸 사용자가 한 번은 분명히 짚고 넘어가게 하기 위해서다. */
import { C } from "./data.js";
import { incomeTrust, won } from "./engine.js";
import { Section, Slider, Choice, primaryBtn } from "./ui.jsx";

/* 아직 아무것도 확정 안 한 상태. debt는 0(왼쪽 끝)에서 시작 — 무부채도 유효한 값이라
   처음부터 실제 값으로 둔다("답 안 함"을 표현하는 건 아래 debtConfirmed의 역할이다).
   debtConfirmed = 이 금액으로 보겠다고 사용자가 확정했는지. 이게 켜져야 소득 질문이 열린다. */
export const EMPTY_DETAIL = { debt: 0, debtConfirmed: false, incomeQuality: { type: null, stable: null } };

/* 이 컴포넌트의 산출물이 다 찼는지 = 레버를 그릴 수 있는지.
   부채는 값이 아니라 '확정 여부'로 본다 — 슬라이더를 만지작거리는 중간값으로 레버가 그려지면 안 된다. */
export const detailReady = (d) => d.debtConfirmed === true && incomeTrust(d.incomeQuality) !== null;

export default function DetailInfo({ value, onChange }) {
  const q = value.incomeQuality ?? { type: null, stable: null };
  const setQ = (k, v) => onChange({ ...value, incomeQuality: { ...q, [k]: v } });
  const trust = incomeTrust(q);

  const confirmed = value.debtConfirmed === true;
  const confirmDebt = () => onChange({ ...value, debtConfirmed: true });
  const editDebt = () => onChange({ ...value, debtConfirmed: false });

  return (
    <Section title="① 지금 상태를 대충만 알려주세요"
      subtitle="정확하지 않아도 돼요. 얼마나 늘리고 줄여야하는지를 볼거에요.">

      {/* 부채는 이 한 칸이 전부다. 상환액·만기를 쪼개 묻지 않는다 — 잣대가 잔액에서 알아서 환산한다. */}
      {confirmed ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "#F7FAF7", border: `1px solid ${C.line}` }}>
          <div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 2 }}>확정한 대출</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{value.debt === 0 ? "없어요" : won(value.debt) + "원"}</div>
          </div>
          <button onClick={editDebt} style={{ flex: "0 0 auto", padding: "8px 13px", borderRadius: 10, border: `1.5px solid ${C.line}`, background: "#fff", color: C.inkSoft, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            다시 정하기
          </button>
        </div>
      ) : (
        <>
          <Slider label="대출" value={value.debt} min={0} max={30000} step={100}
            onChange={(v) => onChange({ ...value, debt: v })} display={won(value.debt) + "원"} />
          <button onClick={confirmDebt} style={primaryBtn}>
            {value.debt === 0 ? "대출 없이 확정할게요" : `약 ${won(value.debt)}원으로 확정할게요`}
          </button>
        </>
      )}

      {confirmed && (
        <div className="slideup" style={{ paddingTop: 12, marginTop: 12, borderTop: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>소득의 유형을 반영해요 <span style={{ color: C.greenDeep }}>(중요해요)</span></div>
          <div style={{ fontSize: 12, color: "#9AA3A0", marginBottom: 9, lineHeight: 1.55 }}>
            금액만큼 중요한 게 “지금도 인정되는 소득인가”예요. 같은 5천만원도 근로·재직이면 거의 그대로 잡히고, 프리랜서·이직 직후면 깎여서 잡힐 수 있어요.
          </div>
          <Choice label="소득 유형" options={[["근로", "work"], ["사업", "business"], ["프리랜서", "freelance"]]}
            value={q.type} onPick={(v) => setQ("type", v)} />
          <Choice label="지금 상태" options={[["재직·유지 2개월+", true], ["이직·휴직·최근입사", false]]}
            value={q.stable} onPick={(v) => setQ("stable", v)} />
          {trust && <TrustBadge trust={trust} />}
        </div>
      )}
    </Section>
  );
}

/* 소득의 질은 결과 색을 물들인다 — 노랑이면 아래 한도도 노랑으로 간다(가드레일 3). */
export function TrustBadge({ trust, compact }) {
  const ok = trust === "ok";
  return (
    <div style={{
      display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, lineHeight: 1.55,
      padding: compact ? "7px 10px" : "9px 12px", borderRadius: 10,
      background: ok ? "#F3F9F5" : "#FDF6E9", border: `1px solid ${ok ? "#CFE6D9" : "#F0DFBC"}`,
      color: ok ? C.greenDeep : "#9A6B12",
    }}>
      <span style={{ fontWeight: 800 }}>{ok ? "신뢰" : "확인 필요"}</span>
      <span>{ok
        ? "근로·재직 2개월 이상이라 넣은 소득이 거의 그대로 잡혀요."
        : "입력대로 다 인정 안 될 수 있어요 → 상담역 확인이 필요해요. 아래 숫자도 그래서 노랑이에요."}</span>
    </div>
  );
}
