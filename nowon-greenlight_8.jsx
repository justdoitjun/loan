import React, { useState, useMemo } from "react";

/* ✏️ 여기 1 — DATA : 노원구 단지 (가격 만원) */
const DATA = [
  { id: 1,  이름: "상계주공3단지",  동: "상계동", 전용: 41, 가격: 35000,  x: 22, y: 20 },
  { id: 2,  이름: "상계주공9단지",  동: "상계동", 전용: 46, 가격: 43000,  x: 30, y: 30 },
  { id: 3,  이름: "상계주공16단지", 동: "상계동", 전용: 49, 가격: 46000,  x: 16, y: 38 },
  { id: 4,  이름: "불암현대",       동: "상계동", 전용: 59, 가격: 55000,  x: 42, y: 22 },
  { id: 5,  이름: "중계주공5단지",  동: "중계동", 전용: 59, 가격: 62000,  x: 56, y: 50 },
  { id: 6,  이름: "하계1청구",      동: "하계동", 전용: 84, 가격: 78000,  x: 60, y: 74 },
  { id: 7,  이름: "상계주공4단지",  동: "상계동", 전용: 84, 가격: 81500,  x: 34, y: 42 },
  { id: 8,  이름: "중계무지개",     동: "중계동", 전용: 84, 가격: 92000,  x: 64, y: 42 },
  { id: 9,  이름: "포레나노원",     동: "상계동", 전용: 84, 가격: 99000,  x: 48, y: 32 },
  { id: 10, 이름: "중계청구3차",    동: "중계동", 전용: 85, 가격: 115000, x: 68, y: 52 },
];

/* ✏️ 여기 2 — RULE : 예산 계산 (노원=비규제 가정) */
const RULE = { LTV: 0.70, 방공제_만원: 5500, DSR: 0.40, 금리_연: 0.04, 기간_년: 30, 신용_가정금리: 0.055, 신용_산정만기: 5, 서울상한_만원: null };
const 노랑밴드 = 0.10;

/* ✏️ 여기 3 — 정부상품 규칙 (전부 가상 숫자! 현직 지식으로 교체) */
const 상품 = {
  디딤돌: { 이름: "디딤돌대출", 금리표시: "연 2~3%대", 계산금리: 0.030, 비율: 0.60, LTV: 0.70, 방공제상쇄: false, cap: 25000, 소요: "약 2개월",
    족보: { 준비: ["소득 증빙(원천징수/소득금액증명)", "무주택 확인(세대 전원 등본·전입세대열람)", "혼인·가족관계증명(해당 시)"],
      질문: ["제 소득으로 디딤돌 대상이 되나요?", "이 단지 전용면적·매매가가 요건 안에 드나요?"],
      대처: ["가격·면적·소득 상한 중 하나라도 넘으면 보금자리론 가능 여부를 이어서 물어보세요."] } },
  보금자리: { 이름: "보금자리론", 금리표시: "연 3~4%대", 계산금리: 0.038, 비율: 0.60, LTV: 0.70, 방공제상쇄: true, cap: 36000, 소요: "약 1.5~2개월",
    족보: { 준비: ["소득 증빙", "무주택/1주택 확인 서류", "매매계약서"],
      질문: ["제 조건에서 보금자리론 한도는 얼마까지 나오나요?", "MCG로 방공제 상쇄하면 한도가 얼마나 늘어나나요?"],
      대처: ["가격 상한을 살짝 넘으면 일반 은행 주담대와 한도를 비교해달라고 하세요."] } },
};
const 기금소득상한 = (신혼, 미성년) => { let b = 6000; if (신혼) b = 8500; return b + 미성년 * 1000; }; // 가상, 만원

/* ── 계산 ── */
function 기존연원리금(대출) {
  if (!대출.확정) return 0;
  const 만기 = (대출.mode === "precise" && +대출.만기) ? +대출.만기 : RULE.신용_산정만기;
  const 금리 = (대출.mode === "precise" && +대출.금리) ? +대출.금리 / 100 : RULE.신용_가정금리;
  const 신용 = +대출.신용대출 || 0;
  const 신용연 = 신용 > 0 ? 신용 / 만기 + 신용 * 금리 : 0;
  return 신용연 + (+대출.기타월상환 || 0) * 12;
}
function 상환한도(연소득, 비율, 금리연, 기간년, 기존연) {
  const r = 금리연 / 12, n = 기간년 * 12;
  const 월여력 = (연소득 * 비율) / 12 - 기존연 / 12;
  if (월여력 <= 0) return 0;
  const 계수 = (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
  return 월여력 * 계수;
}
function 판정(단지, pDsr, 현금) {
  const ltv = 단지.가격 * RULE.LTV - RULE.방공제_만원;
  let loanable = Math.min(pDsr, ltv);
  if (RULE.서울상한_만원) loanable = Math.min(loanable, RULE.서울상한_만원);
  loanable = Math.max(loanable, 0);
  const 예산 = loanable + 현금, 여유 = 예산 - 단지.가격, 비율 = 여유 / 단지.가격;
  const 색 = 비율 > 노랑밴드 ? "green" : 비율 < -노랑밴드 ? "grey" : "amber";
  return { ...단지, 예산, 여유, 색, 걸림: ltv <= pDsr ? "ltv" : "dsr" };
}
function 상품한도(p, 가격, 소득) {
  const ltv = 가격 * p.LTV - (p.방공제상쇄 ? 0 : RULE.방공제_만원);
  const dti = 상환한도(소득, p.비율, p.계산금리, 30, 0);
  return Math.max(Math.min(ltv, dti, p.cap), 0);
}
function 정부추천(가격, 부부소득, 신혼, 미성년, 무주택, 현금) {
  if (!무주택) return { 상태: "닫힘", 사유: "기금상품은 무주택이 기본이에요. 유주택이면 이 경로는 지금 닫혀 있어요(처분조건부 등 예외는 상담 확인)." };
  const 상한 = 기금소득상한(신혼, 미성년);
  if (부부소득 > 상한) return { 상태: "닫힘", 사유: `부부합산소득이 기금 소득상한(약 ${won(상한)}원)을 넘어서, 정부상품 경로는 닫혀요. 은행상품 탭을 보세요.` };
  const 필요 = 가격 - 현금;
  const dd = 상품한도(상품.디딤돌, 가격, 부부소득);
  if (dd >= 필요) return { 상태: "추천", p: 상품.디딤돌, 한도: dd, 이유: "저금리라 1순위예요. 방공제 빼고도 필요액을 채워요." };
  const bg = 상품한도(상품.보금자리, 가격, 부부소득);
  if (bg >= 필요) return { 상태: "추천", p: 상품.보금자리, 한도: bg, 이유: `디딤돌은 방공제·한도 상한 때문에 약 ${won(필요 - dd)}원 모자라요. 보금자리론(MCG로 방공제 상쇄)이면 채워져요.` };
  return { 상태: "부족", p: 상품.보금자리, 한도: bg, 사유: `정부상품 둘 다 약 ${won(필요 - Math.max(dd, bg))}원 모자라요. 은행상품 탭에서 MCI로 더 나오는지 비교해보세요.` };
}
function 만나이(생일) {
  if (!생일) return null;
  const b = new Date(생일); if (isNaN(b.getTime())) return null;
  const t = new Date(); let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a;
}

const eok = (만) => (만 / 10000).toFixed(1) + "억";
function won(만) { 만 = Math.round(Math.abs(만)); const e = Math.floor(만 / 10000), m = 만 % 10000; if (e > 0 && m > 0) return `${e}억 ${m.toLocaleString()}만`; if (e > 0) return `${e}억`; return `${m.toLocaleString()}만`; }

const C = { bg: "#F4F6F3", panel: "#FFFFFF", ink: "#1E2A24", inkSoft: "#5B6660", line: "#E4E9E4", green: "#2E9E6B", greenDeep: "#14705A", amber: "#E0A23A", greyDot: "#CBD1CE" };
const 색값 = { green: C.green, amber: C.amber, grey: C.greyDot };
const 색문구 = { green: "예산 안에 들어와요", amber: "경계선이에요", grey: "지금은 예산을 넘어요" };
const 동라벨 = [{ 이름: "상계동", x: 28, y: 15 }, { 이름: "중계동", x: 66, y: 40 }, { 이름: "하계동", x: 60, y: 66 }];

export default function App() {
  const [단계, set단계] = useState("budget"); // budget | list | strategy
  const [소득, set소득] = useState(6500);
  const [현금, set현금] = useState(25000);
  const [대출, set대출] = useState({ 확정: false, mode: null, 신용대출: 0, 금리: 5.5, 만기: 5, 기타월상환: 0 });
  const [sheet, setSheet] = useState(false);
  const [선택, set선택] = useState(null);       // 지도 인라인 상세
  const [모달매물, set모달매물] = useState(null); // 정부/은행 선택 팝업

  // 전략 화면
  const [전략매물, set전략매물] = useState(null);
  const [탭, set탭] = useState("정부");
  const [주택수, set주택수] = useState(null);
  const [부부소득, set부부소득] = useState("");
  const [신혼, set신혼] = useState(null);
  const [생일들, set생일들] = useState([]);

  const pDsr = useMemo(() => 상환한도(소득, RULE.DSR, RULE.금리_연, RULE.기간_년, 기존연원리금(대출)), [소득, 대출]);
  const 결과 = useMemo(() => DATA.map((d) => 판정(d, pDsr, 현금)), [pDsr, 현금]);
  const 초록수 = 결과.filter((r) => r.색 === "green").length;
  const 노랑수 = 결과.filter((r) => r.색 === "amber").length;
  const 선택결과 = 결과.find((r) => r.id === 선택) || null;
  const 최대대출 = Math.min(pDsr, RULE.서울상한_만원 || Infinity);
  const 가능목록 = 결과.filter((r) => r.색 === "green" || r.색 === "amber").sort((a, b) => a.가격 - b.가격);

  function 상품고르기(성격) {
    set전략매물(모달매물); set탭(성격); set모달매물(null);
    set주택수(null); set부부소득(""); set신혼(null); set생일들([]);
    set단계("strategy");
  }

  return (
    <div style={{ minHeight: "100%", background: C.bg, color: C.ink, fontFamily: '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif' }}>
      <style>{css}</style>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "22px 18px 40px" }}>

        {단계 === "budget" && (
          <>
            <div style={eyebrow}>노원구 · 그린라이트</div>
            <h1 style={h1}>소득만 알려주면,<br />살 수 있는 집에 불이 들어와요.</h1>
            <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>로그인도, 조회도 없어요. 입력값은 이 화면 밖으로 나가지 않아요.</p>

            <div style={{ ...card, marginTop: 18 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 40, fontWeight: 800, color: C.greenDeep, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{초록수}</span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>곳, 지금 예산 안에 있어요</span>
              </div>
              <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 6 }}>경계선 <b style={{ color: C.amber }}>{노랑수}곳</b> · 상환능력 기준 최대 대출 약 <b>{eok(최대대출)}</b></div>
            </div>

            <div style={{ marginTop: 16 }}>
              <Slider label="연소득" value={소득} min={2000} max={12000} step={100} onChange={set소득} display={won(소득) + "원"} />
              <Slider label="보유 현금" value={현금} min={0} max={70000} step={500} onChange={set현금} display={won(현금) + "원"} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: `1px solid ${C.line}` }}>
                <div><div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>기존 대출</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{대출.확정 ? `${대출.mode === "rough" ? "대충" : "정확"} · 신용 ${won(대출.신용대출)}원` : "아직 안 넣음"}</div></div>
                <button onClick={() => setSheet(true)} style={ghostBtn}>{대출.확정 ? "수정" : "확정하기"}</button>
              </div>
            </div>

            <Map 결과={결과} 선택={선택} onPick={set선택} />
            <Legend />
            <div style={{ ...card, marginTop: 16, minHeight: 100, borderColor: 선택결과 ? 색값[선택결과.색] : C.line, transition: "border-color .3s" }}>
              {!선택결과 ? <div style={{ color: C.inkSoft, fontSize: 14, paddingTop: 6 }}>지도에서 단지를 눌러보세요. 당신 예산에서 어떻게 보이는지 알려드릴게요.</div> : <Detail r={선택결과} />}
            </div>

            <button onClick={() => set단계("list")} style={primaryBtn}>가능한 매물목록 확인하기 →</button>
            <p style={fine}>실거래가 기반 근사치예요. 정확한 담보평가·대출 가부는 상담역이 확정합니다. 데이터·상품 규칙 일부는 예시값이에요. 이 화면은 대출을 약속하지 않아요.</p>
          </>
        )}

        {단계 === "list" && (
          <div className="slideup">
            <button onClick={() => set단계("budget")} style={{ ...ghostBtn, marginBottom: 14 }}>← 지도로</button>
            <div style={eyebrow}>가능한 매물</div>
            <h1 style={h1}>지금 예산으로<br />닿는 집들이에요.</h1>
            <p style={{ fontSize: 13, color: C.inkSoft, margin: "0 0 14px" }}>하나를 고르면 어떤 대출로 갈지 함께 정해드려요.</p>
            {가능목록.length === 0 && <div style={{ ...card, color: C.inkSoft, fontSize: 14 }}>지금은 닿는 매물이 없어요. 지도 화면에서 소득·현금을 조정해보세요.</div>}
            {가능목록.map((r) => (
              <button key={r.id} onClick={() => set모달매물(r)} style={listItem}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <i style={{ width: 12, height: 12, borderRadius: "50%", background: 색값[r.색], flex: "0 0 auto" }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{r.이름}</div>
                    <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{r.동} · 전용 {r.전용}㎡ · {won(r.가격)}원</div>
                  </div>
                </div>
                <span style={{ fontSize: 13, color: r.색 === "green" ? C.greenDeep : C.amber, fontWeight: 700 }}>{r.여유 >= 0 ? `여유 ${won(r.여유)}` : `${won(r.여유)} 부족`} ›</span>
              </button>
            ))}
          </div>
        )}

        {단계 === "strategy" && 전략매물 && (
          <div className="slideup">
            <button onClick={() => set단계("list")} style={{ ...ghostBtn, marginBottom: 14 }}>← 매물목록으로</button>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {["정부", "은행"].map((t) => (
                <button key={t} onClick={() => set탭(t)} style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", border: `1.5px solid ${탭 === t ? C.greenDeep : C.line}`, background: 탭 === t ? C.greenDeep : "#fff", color: 탭 === t ? "#fff" : C.ink }}>{t}상품</button>
              ))}
            </div>
            <div style={{ ...card, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{전략매물.이름}</div>
              <div style={{ fontSize: 12, color: C.inkSoft }}>{won(전략매물.가격)}원 · 필요 대출 약 {won(전략매물.가격 - 현금)}원</div>
            </div>
            {탭 === "정부" ? (
              <정부탭 매물={전략매물} 현금={현금} 주택수={주택수} set주택수={set주택수} 부부소득={부부소득} set부부소득={set부부소득} 신혼={신혼} set신혼={set신혼} 생일들={생일들} set생일들={set생일들} />
            ) : (
              <div style={{ ...card, color: C.inkSoft, fontSize: 14, lineHeight: 1.6 }}>은행상품 로직은 곧 준비할게요. 지금은 정부상품 탭을 먼저 만들었어요.</div>
            )}
          </div>
        )}
      </div>

      {모달매물 && <상품모달 r={모달매물} onPick={상품고르기} onClose={() => set모달매물(null)} />}
      {sheet && <Sheet 대출={대출} set대출={set대출} onClose={() => setSheet(false)} />}
    </div>
  );
}

function 정부탭({ 매물, 현금, 주택수, set주택수, 부부소득, set부부소득, 신혼, set신혼, 생일들, set생일들 }) {
  const 소득만 = Number(부부소득) || 0;
  const 기본완료 = 주택수 !== null && 부부소득 !== "" && 소득만 > 0;
  const 미성년 = 생일들.filter((d) => { const a = 만나이(d); return a !== null && a < 19; }).length;
  const 자녀채움 = 생일들.length === 0 || 생일들.every((d) => 만나이(d) !== null);
  const 세부완료 = 기본완료 && 신혼 !== null && 자녀채움;
  return (
    <div>
      <Choice label="보유 주택 수 (부부합산)" options={[["무주택", 0], ["1주택", 1], ["2주택+", 2]]} value={주택수} onPick={set주택수} />
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600, marginBottom: 5 }}>부부합산 연소득 (만원)</div>
        <input type="number" inputMode="numeric" placeholder="예: 5500" value={부부소득} onChange={(e) => set부부소득(e.target.value)}
          style={{ width: "100%", padding: "11px 12px", fontSize: 15, borderRadius: 10, border: `1.5px solid ${C.line}`, boxSizing: "border-box" }} />
      </div>
      {기본완료 && (
        <div className="slideup">
          <div style={{ borderTop: `1px solid ${C.line}`, margin: "6px 0 16px" }} />
          <Choice label="신혼가구이신가요?" options={[["예", true], ["아니오", false]]} value={신혼} onPick={set신혼} />
          <ChildDates 생일들={생일들} set생일들={set생일들} />
        </div>
      )}
      {세부완료 && <정부결과 매물={매물} 소득={소득만} 신혼={신혼} 미성년={미성년} 무주택={주택수 === 0} 현금={현금} />}
    </div>
  );
}
function ChildDates({ 생일들, set생일들 }) {
  const setCount = (n) => { const next = 생일들.slice(0, n); while (next.length < n) next.push(""); set생일들(next); };
  const setOne = (i, v) => { const next = [...생일들]; next[i] = v; set생일들(next); };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600, marginBottom: 7 }}>아이가 몇 명인가요?</div>
      <div style={{ display: "flex", gap: 8 }}>
        {[0, 1, 2, 3].map((n) => { const on = 생일들.length === n; return <button key={n} onClick={() => setCount(n)} style={{ flex: 1, padding: "11px 6px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${on ? C.greenDeep : C.line}`, background: on ? C.greenDeep : "#fff", color: on ? "#fff" : C.ink }}>{n === 3 ? "3+" : n}</button>; })}
      </div>
      {생일들.length > 0 && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {생일들.map((d, i) => (
            <div key={i}>
              <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 4 }}>{i + 1}번째 아이 생년월일</div>
              <input type="date" value={d} onChange={(e) => setOne(i, e.target.value)} style={{ width: "100%", padding: "10px 12px", fontSize: 15, borderRadius: 10, border: `1.5px solid ${C.line}`, boxSizing: "border-box" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function 정부결과({ 매물, 소득, 신혼, 미성년, 무주택, 현금 }) {
  const r = 정부추천(매물.가격, 소득, 신혼, 미성년, 무주택, 현금);
  if (r.상태 === "닫힘")
    return <div className="slideup" style={{ ...card, borderColor: C.greyDot, marginTop: 8 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6, color: C.inkSoft }}>지금은 닫혀 있어요</div>
      <div style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.6 }}>{r.사유}</div></div>;
  const 추천 = r.상태 === "추천";
  return (
    <div className="slideup" style={{ marginTop: 8 }}>
      <div style={{ ...card, borderColor: 추천 ? C.greenDeep : C.amber }}>
        <div style={eyebrow}>{추천 ? "추천 경로" : "가장 근접"}</div>
        <div style={{ fontSize: 18, fontWeight: 800, margin: "4px 0 10px" }}>{r.p.이름}</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Stat 라벨="한도(대략)" 값={`약 ${eok(r.한도)}`} />
          <Stat 라벨="금리" 값={r.p.금리표시} />
          <Stat 라벨="실행" 값={r.p.소요} 경고 />
        </div>
        <div style={{ fontSize: 13, color: 추천 ? C.greenDeep : "#9A6B12", lineHeight: 1.6, marginTop: 12 }}>{추천 ? r.이유 : r.사유}</div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 8 }}>⚠︎ 정부상품은 실행이 오래 걸려요. 잔금일이 언제인지 먼저 확인하세요.</div>
      </div>
      <Block title="은행 가기 전 준비" items={r.p.족보.준비} />
      <Block title="창구에서 이렇게 물어보세요" items={r.p.족보.질문} />
      <Block title="애매할 때 대처" items={r.p.족보.대처} />
      <p style={fine}>※ 상품 매칭·한도·족보는 가상 예시예요. 실제 규칙은 교체 예정. 대출을 약속하지 않아요.</p>
    </div>
  );
}
function Stat({ 라벨, 값, 경고 }) { return <div><div style={{ fontSize: 11, color: C.inkSoft }}>{라벨}</div><div style={{ fontSize: 15, fontWeight: 800, color: 경고 ? C.amber : C.ink }}>{값}</div></div>; }

function 상품모달({ r, onPick, onClose }) {
  const 색c = r.색 === "green" ? C.greenDeep : r.색 === "amber" ? "#9A6B12" : C.inkSoft;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,30,26,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal" style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 20, padding: "20px 20px 22px" }}>
        <div style={{ fontSize: 12, color: 색c, fontWeight: 700 }}>{색문구[r.색]}</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{r.이름}</div>
        <div style={{ fontSize: 13, color: C.inkSoft }}>{r.동} · 전용 {r.전용}㎡ · {won(r.가격)}원</div>
        <div style={{ fontSize: 13, color: C.ink, margin: "14px 0 12px", fontWeight: 600 }}>어떤 대출로 알아볼까요?</div>
        <button onClick={() => onPick("정부")} style={{ ...modalOpt, borderColor: C.greenDeep }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>정부상품 <span style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>디딤돌·보금자리</span></div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3 }}>금리 낮음 · 한도 빡빡 · 실행 느림(약 2개월)</div>
        </button>
        <button onClick={() => onPick("은행")} style={modalOpt}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>은행상품 <span style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>일반 주담대</span></div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3 }}>한도 넉넉 · 금리 높음 · 실행 빠름(약 2~4주)</div>
        </button>
        <button onClick={onClose} style={{ ...ghostBtn, width: "100%", marginTop: 10 }}>닫기</button>
      </div>
    </div>
  );
}

function Map({ 결과, 선택, onPick }) {
  return (
    <div style={{ position: "relative", marginTop: 18, height: 320, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#EEF2EE 1px,transparent 1px),linear-gradient(90deg,#EEF2EE 1px,transparent 1px)", backgroundSize: "38px 38px" }} />
      {동라벨.map((d) => <span key={d.이름} style={{ position: "absolute", left: `${d.x}%`, top: `${d.y}%`, transform: "translate(-50%,-50%)", fontSize: 11, color: "#AEB6B2", fontWeight: 600 }}>{d.이름}</span>)}
      {결과.map((r, i) => { const on = 선택 === r.id; return <button key={r.id} onClick={() => onPick(r.id)} aria-label={r.이름} className="dot" style={{ position: "absolute", left: `${r.x}%`, top: `${r.y}%`, transform: `translate(-50%,-50%) scale(${on ? 1.35 : 1})`, width: 26, height: 26, borderRadius: "50%", cursor: "pointer", background: 색값[r.색], border: `2px solid ${on ? C.ink : "#fff"}`, boxShadow: on ? "0 4px 14px rgba(0,0,0,.22)" : "0 1px 3px rgba(0,0,0,.14)", animationDelay: `${i * 45}ms`, zIndex: on ? 5 : 1 }} />; })}
    </div>
  );
}
function Legend() {
  return <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: C.inkSoft }}>
    {[["green", "살 수 있어요"], ["amber", "경계"], ["grey", "지금은 무리"]].map(([k, t]) => <span key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}><i style={{ width: 11, height: 11, borderRadius: "50%", background: 색값[k], display: "inline-block" }} />{t}</span>)}
  </div>;
}
function Detail({ r }) {
  const 걸림 = r.걸림 === "ltv" ? "담보(LTV) 한도에서 먼저 걸려요. 소득을 올려도 이 벽은 안 내려가고, 현금 비중을 높여야 열려요." : "상환능력(DSR)에서 걸려요. 기존 대출을 줄이거나 소득이 늘면 열려요.";
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <div style={{ fontSize: 17, fontWeight: 800 }}>{r.이름}</div><div style={{ fontSize: 13, color: C.inkSoft }}>{r.동} · 전용 {r.전용}㎡</div>
    </div>
    <div style={{ fontSize: 20, fontWeight: 800, margin: "4px 0 10px", fontVariantNumeric: "tabular-nums" }}>{won(r.가격)}원</div>
    {r.색 === "green" && <div style={{ fontSize: 14, color: C.greenDeep, lineHeight: 1.6 }}><b>예산 안에 들어와요.</b> 약 {won(r.여유)}원 여유가 있어요.</div>}
    {r.색 === "amber" && <div style={{ fontSize: 14, color: "#9A6B12", lineHeight: 1.6 }}><b>경계선이에요.</b> 전략을 세우면 열릴 수 있어요. {걸림}</div>}
    {r.색 === "grey" && <div style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.6 }}><b>약 {won(-r.여유)}원 부족해요.</b> {걸림}</div>}
  </div>;
}
function Block({ title, items }) {
  return <div style={{ ...card, marginTop: 12 }}>
    <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{title}</div>
    {items.map((t, i) => <div key={i} style={{ display: "flex", gap: 8, fontSize: 14, lineHeight: 1.55, marginBottom: 6 }}><span style={{ color: C.greenDeep, fontWeight: 800 }}>·</span><span>{t}</span></div>)}
  </div>;
}
function Choice({ label, options, value, onPick }) {
  return <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600, marginBottom: 7 }}>{label}</div>
    <div style={{ display: "flex", gap: 8 }}>
      {options.map(([t, v]) => { const on = value === v; return <button key={t} onClick={() => onPick(v)} style={{ flex: 1, padding: "11px 6px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${on ? C.greenDeep : C.line}`, background: on ? C.greenDeep : "#fff", color: on ? "#fff" : C.ink }}>{t}</button>; })}
    </div>
  </div>;
}
function Sheet({ 대출, set대출, onClose }) {
  const [local, setLocal] = useState(대출);
  const set = (k, v) => setLocal({ ...local, [k]: v });
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,30,26,.4)", display: "flex", alignItems: "flex-end", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} className="sheet" style={{ width: "100%", maxWidth: 460, margin: "0 auto", background: "#fff", borderRadius: "22px 22px 0 0", padding: "20px 20px 28px" }}>
        <div style={{ width: 40, height: 4, background: "#DDE3DE", borderRadius: 3, margin: "0 auto 14px" }} />
        <div style={{ fontSize: 17, fontWeight: 800 }}>기존 대출, 어떻게 넣을까요?</div>
        <p style={{ fontSize: 13, color: C.inkSoft, margin: "6px 0 16px" }}>정확한 한도는 상담역이 확정해요. 여기선 예산 감을 잡는 정도면 충분해요.</p>
        {!local.mode ? (
          <div style={{ display: "grid", gap: 10 }}>
            <button onClick={() => set("mode", "rough")} style={optBtn}><b>대충 넣을게요</b><span style={optSub}>신용대출 대략 금액만 · 금리 5~6% 가정</span></button>
            <button onClick={() => set("mode", "precise")} style={optBtn}><b>제대로 입력할게요</b><span style={optSub}>서류 보고 금액·금리 직접 입력</span></button>
          </div>
        ) : (
          <div>
            <Field label="신용대출 잔액 (만원)" value={local.신용대출} onChange={(v) => set("신용대출", v)} />
            {local.mode === "precise" && <Field label="금리 (%)" value={local.금리} onChange={(v) => set("금리", v)} step />}
            <Field label="기타 대출 월상환 (만원, 없으면 0)" value={local.기타월상환} onChange={(v) => set("기타월상환", v)} />
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button onClick={() => set("mode", null)} style={{ ...ghostBtn, flex: "0 0 auto" }}>뒤로</button>
              <button onClick={() => { set대출({ ...local, 확정: true }); onClose(); }} style={{ ...primaryBtn, marginTop: 0, flex: 1 }}>이 값으로 확정</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function Field({ label, value, onChange, step }) {
  return <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600, marginBottom: 5 }}>{label}</div>
    <input type="number" inputMode="decimal" step={step ? "0.1" : "1"} value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", padding: "11px 12px", fontSize: 15, borderRadius: 10, border: `1.5px solid ${C.line}`, boxSizing: "border-box" }} />
  </div>;
}
function Slider({ label, value, min, max, step, onChange, display }) {
  return <div style={{ marginBottom: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
      <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{display}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%" }} />
  </div>;
}

const eyebrow = { fontSize: 12, letterSpacing: 2, color: C.greenDeep, fontWeight: 700 };
const h1 = { fontSize: 23, lineHeight: 1.35, margin: "8px 0 6px", fontWeight: 800 };
const card = { padding: "16px 18px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16 };
const primaryBtn = { width: "100%", marginTop: 16, padding: "14px", borderRadius: 13, border: "none", background: C.greenDeep, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" };
const ghostBtn = { padding: "9px 14px", borderRadius: 10, border: `1.5px solid ${C.line}`, background: "#fff", color: C.ink, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const listItem = { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", padding: "14px 16px", marginBottom: 10, borderRadius: 14, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer" };
const optBtn = { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, textAlign: "left", padding: "14px 16px", borderRadius: 13, border: `1.5px solid ${C.line}`, background: "#fff", cursor: "pointer", fontSize: 15, color: C.ink };
const optSub = { fontSize: 12, color: C.inkSoft, fontWeight: 500 };
const modalOpt = { width: "100%", textAlign: "left", padding: "14px 16px", marginBottom: 10, borderRadius: 14, border: `1.5px solid ${C.line}`, background: "#fff", cursor: "pointer", color: C.ink };
const fine = { fontSize: 11, color: "#9AA3A0", marginTop: 16, lineHeight: 1.6 };

const css = `
  input[type=range]{-webkit-appearance:none;appearance:none;height:6px;border-radius:4px;background:#DCE3DE;outline:none;}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:50%;background:#14705A;cursor:pointer;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);}
  input[type=range]::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#14705A;cursor:pointer;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);}
  .dot{transition:background-color .5s ease,transform .2s ease;animation:pop .4s ease backwards;}
  .dot:focus-visible{outline:3px solid #14705A;outline-offset:2px;}
  @keyframes pop{from{opacity:0;transform:translate(-50%,-50%) scale(.2);}to{opacity:1;transform:translate(-50%,-50%) scale(1);}}
  .slideup{animation:slideup .3s ease;}
  @keyframes slideup{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
  .sheet{animation:sheetup .28s ease;}
  @keyframes sheetup{from{transform:translateY(100%);}to{transform:translateY(0);}}
  .modal{animation:popin .22s ease;}
  @keyframes popin{from{opacity:0;transform:scale(.94);}to{opacity:1;transform:scale(1);}}
  @media (prefers-reduced-motion: reduce){.dot,.slideup,.sheet,.modal{animation:none;transition:none;}}
`;
