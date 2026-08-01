/* 부채 · 소득의 질 입력부 — Strategy(조종간) 맨 위에 붙는 컴포넌트.
   이 앱에서 부채가 처음 등장하는 자리다. 자격 화면에서 일부러 빼둔 것들이 여기서 나온다.

   역할은 "정답 수집"이 아니라 **레버의 시작 위치 잡기**다. 그래서 전부 '대충' 받는다
   — 정확한 값을 요구하면 사용자가 멈추고, 멈추면 레버를 만져볼 기회 자체가 사라진다.
   여기서 받은 값은 Strategy의 레버 초기값이 되고, 사용자는 곧바로 그걸 당겨서 움직인다.

   원칙: 여기서는 raw 값만 받는다. 해석(DTI/DSR 잣대)은 products/limit.js가 한다.
   ⚠️ 자격은 여기서 절대 묻지 않는다. 자격 질문이 필요하면 Eligibility에 추가할 것. */
import { LEVER, C } from "./data.js";
import { incomeTrust, won } from "./engine.js";
import { Section, Slider, Pills, Choice } from "./ui.jsx";

/* 아직 아무것도 안 받은 상태. debt가 null이면 조종간은 레버를 아직 못 그린다(첫 박자 대기).
   debt = 갖고 있는 대출 '잔액 합계'(만원) 하나. 월상환액은 묻지 않는다 —
   디딤돌 DTI는 잔액의 이자만 보고, 은행 DSR도 같은 잔액에서 출발한다. */
export const EMPTY_DETAIL = { debt: null, incomeQuality: { type: null, stable: null } };

/* 이 컴포넌트의 산출물이 다 찼는지 = 레버를 그릴 수 있는지.
   0도 유효한 답이라 != null로 본다(0을 '안 답함'으로 읽으면 무부채인 사람이 막힌다). */
export const detailReady = (d) => d.debt != null && incomeTrust(d.incomeQuality) !== null;

const manLabel = (v) => (v === 0 ? "없어요" : won(v));

export default function DetailInfo({ value, onChange }) {
  const q = value.incomeQuality ?? { type: null, stable: null };

  const setQ = (k, v) => onChange({ ...value, incomeQuality: { ...q, [k]: v } });

  const trust = incomeTrust(q);

  return (
    <Section title="① 지금 상태를 대충만 알려주세요"
      subtitle="정확하지 않아도 돼요. 얼마나 늘리고 줄여야하는지를 볼거에요.">
      {/* 부채는 이 한 칸이 전부다. 상환액·만기를 쪼개 묻지 않는다 — 잣대가 잔액에서 알아서 환산한다. */}
      {/* <Pills label="갖고 있는 대출이 어느 정도예요?" hint="마이너스통장은 약정 한도로 보는 게 안전해요. "
        options={LEVER.debtPills.map((v, i, arr) => [manLabel(v) + (i === arr.length - 1 ? " 이상" : ""), v])}
        value={value.debt} onPick={(v) => onChange({ ...value, debt: v })} /> */}
      <Slider label="대출" value={value.debt} min={0} max={30000} step={100} onChange={(v) => onChange({ ...value, debt: v })} display={won(value.debt) + "원"} />
      

      <div style={{ paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
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
