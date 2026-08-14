/* "내 소득, 그대로 인정될까?" — 소득의 신뢰도를 스스로 가늠해보는 화면.
   목적은 "소득이 얼마인지"가 아니라 "입력한 소득을 얼마나 믿을 수 있는지"를 보는 것
   — 디딤돌 실제 규정(src/data/incomeRules.js)의 체크리스트로
   초록/노랑 논조만 만든다. 한도 숫자는 깎지 않는다(didimdol.md 5절).

   흐름: 그룹 선택 → (그룹 안에 유형이 여럿이면) 세부 유형 선택 → 유형별 체크리스트
   질문 → 결과. 질문 목록·선택지·메모는 전부 incomeRules.js의 데이터에서 읽는다
   — 화면에 "근로소득이면 이 질문, 사업소득이면 저 질문" 식 하드코딩을 하지 않는다.

   ⚠️ incomeRules.js의 인정소득_산정방법/예외_비고는 은행 실무자용 원문 인용이라
   그대로 사용자에게 보여주지 않는다(Step①②③, 방법①② 같은 표기가 낯설다).
   화면에 보이는 질문·메모 문구는 그 원문을 사용자 언어로 옮긴 별도 카피다.

   가드레일: 숫자로 확답하지 않는다(초록/노랑만). 노랑도 문을 닫지 않고 필요서류를
   같이 보여준다. 정확한 인정 여부는 항상 상담역 확인으로 넘긴다.

   계산 함수를 engine.js가 아니라 여기 둔 이유: 지금은 이 화면 하나만 쓰는 계산이라서.
   자격 판정(Eligibility)이나 전략(Strategy)이 이 결과를 갖다 쓰게 되면 그때 옮긴다. */
import { useState } from "react";
import { ACTIVE_INCOME_TYPES } from "./data/incomeRules.js";
import { C } from "./data.js";
import { BackButton, Section, eyebrow, h1, fine, pill, ghostBtn } from "./ui.jsx";

/* 그룹은 규정을 그대로 노출하지 않고 "당신은 어느 쪽인가요"로 물을 수 있게
   묶은 단위다(incomeRules.js의 그룹 필드). 라벨·설명은 사용자 카피라 데이터 파일이
   아니라 여기 둔다 — incomeRules.js는 규정 원문, 이건 화면 문구라서 성격이 다르다. */
const GROUP_META = {
  "근로-재직": { label: "회사에 다니고 있어요", desc: "정규직·계약직 등, 지금 재직 중" },
  "근로-휴직복직": { label: "휴직 중이거나 최근 복직했어요", desc: "육아휴직·병가 등" },
  "근로-일용": { label: "일용직이에요", desc: "그때그때 또는 매일 급여를 받아요" },
  "사업": { label: "사업을 해요", desc: "개인사업자, 프리랜서·보험설계사·학원강사 등 포함" },
  "연금": { label: "연금을 받아요", desc: "국민연금·공무원연금·군인연금 등" },
  "기타": { label: "그 외 소득이에요", desc: "종교인 소득 등" },
  "소득추정": { label: "소득 증빙이 어려워요", desc: "서류로 증명하기 힘들면 건강보험료·국민연금 납부액으로도 볼 수 있어요" },
  "무소득": { label: "지금은 소득이 없어요", desc: "" },
};
const GROUP_ORDER = ["근로-재직", "근로-휴직복직", "근로-일용", "사업", "연금", "기타", "소득추정", "무소득"]
  .filter((g) => ACTIVE_INCOME_TYPES.some((t) => t.그룹 === g));

const typesInGroup = (groupKey) => ACTIVE_INCOME_TYPES.filter((t) => t.그룹 === groupKey);
const typeOf = (typeKey) => ACTIVE_INCOME_TYPES.find((t) => t.소득유형 === typeKey) ?? null;

/* 조건부 질문(예: "20% 넘게 차이나요?"에 '네'라고 답했을 때만 다음 질문)을 걸러낸다.
   조건이 가리키는 이전 질문이 아직 안 채워졌으면 이 질문도 아직 안 보인다. */
function visibleChecklist(type, answers) {
  return type.체크리스트.filter((q) => {
    if (!q.조건) return true;
    const depIdx = answers[q.조건.dependsOn];
    if (depIdx == null) return false;
    const depQ = type.체크리스트.find((x) => x.id === q.조건.dependsOn);
    return depQ.선택지[depIdx].통과 === q.조건.답;
  });
}

/* 지금 보이는 질문에 전부 답했는지 = 결과를 계산할 수 있는지. */
export function incomeCheckReady(value) {
  const type = typeOf(value.typeKey);
  if (!type) return false;
  return visibleChecklist(type, value.answers).every((q) => value.answers[q.id] != null);
}

/* 답변 → 결과. 기본논조가 amber인 유형(일환산·휴직·소득추정 등, 애초에 액면가와
   산정법이 다른 경우)은 체크리스트 답과 무관하게 항상 노랑이다 — 체크리스트는 그때
   어떤 메모를 보여줄지만 정한다. 기본논조가 green인 유형은 질문 하나라도 "통과:false"로
   답해지면 노랑으로 떨어진다. 준비가 안 됐으면 null(화면이 결과 대신 다음 질문을 그린다). */
export function incomeCheckResult(value) {
  const type = typeOf(value.typeKey);
  if (!type || !incomeCheckReady(value)) return null;
  const visible = visibleChecklist(type, value.answers);
  const picked = visible.map((q) => ({ q, choice: q.선택지[value.answers[q.id]] }));
  /* "20% 넘게 차이나요?"처럼 위험 답변이 후속 질문(조건부)을 여는 경우, 그 후속 질문의
     답이 최종 결론이다 — 앞 질문 자체의 통과:false는 "final" 판정에서 빼야 한다.
     안 그러면 후속 질문에서 "상시소득이라 괜찮다"고 답해도 계속 노랑에 갇힌다. */
  const hasVisibleFollowUp = (qid) => visible.some((v) => v.조건?.dependsOn === qid);
  const failed = picked.some((p) => p.choice.통과 === false && !hasVisibleFollowUp(p.q.id));
  const tone = type.기본논조 === "amber" || failed ? "amber" : "green";
  const notes = picked.filter((p) => p.choice.메모).map((p) => p.choice.메모);
  return { tone, type, notes };
}

export default function IncomeCheck({ value, onChange, onBack }) {
  const [showDetail, setShowDetail] = useState(false);
  const type = typeOf(value.typeKey);
  const group = value.groupKey;
  const candidates = group ? typesInGroup(group) : [];
  const needsSubPick = candidates.length > 1;

  const pickGroup = (g) => {
    const only = typesInGroup(g);
    onChange({ groupKey: g, typeKey: only.length === 1 ? only[0].소득유형 : null, answers: {} });
  };
  const pickType = (typeKey) => onChange({ ...value, typeKey, answers: {} });
  const answer = (qid, idx) => onChange({ ...value, answers: { ...value.answers, [qid]: idx } });

  const result = type ? incomeCheckResult(value) : null;
  const visible = type ? visibleChecklist(type, value.answers) : [];
  const nextQuestion = visible.find((q) => value.answers[q.id] == null);

  return (
    <div className="slideup">
      <BackButton onClick={onBack}>돌아가기</BackButton>
      <div style={eyebrow}>소득 미리 확인</div>
      <h1 style={h1}>내 소득, 그대로<br />인정될까요?</h1>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: "0 0 16px", lineHeight: 1.6 }}>
        금액이 아니라 <b style={{ color: C.ink }}>&ldquo;이 소득이 입력한 그대로 인정되는지&rdquo;</b>를 봐요.
        디딤돌대출이 실제로 보는 기준으로, 몇 가지만 여쭤볼게요.
      </p>

      {/* 1단계: 그룹 선택 */}
      <Section title="① 어느 쪽에 가까우세요?">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {GROUP_ORDER.map((g) => {
            const meta = GROUP_META[g];
            const on = group === g;
            return (
              <button key={g} onClick={() => pickGroup(g)} style={{ ...pill(on), width: "100%", textAlign: "left", padding: "12px 14px" }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{meta.label}</span>
                {meta.desc && <span style={{ display: "block", fontSize: 12, fontWeight: 500, marginTop: 2, lineHeight: 1.4, color: on ? "rgba(255,255,255,.85)" : C.inkSoft }}>{meta.desc}</span>}
              </button>
            );
          })}
        </div>
      </Section>

      {/* 2단계: 세부 유형 선택 (그룹 안에 여럿일 때만) */}
      {group && needsSubPick && (
        <div className="slideup">
          <Section title="② 좀 더 정확히는요?">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {candidates.map((t) => (
                <button key={t.소득유형} onClick={() => pickType(t.소득유형)} style={{ ...pill(value.typeKey === t.소득유형), flex: "1 1 auto" }}>
                  {t.표시명}
                </button>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* 3단계: 체크리스트 (유형이 정해지면, 데이터에서 순서대로 렌더) */}
      {type && visible.length > 0 && (
        <div className="slideup">
          <Section title={needsSubPick ? "③ 몇 가지만 더요" : "② 몇 가지만 더요"}>
            {visible.map((q, i) => {
              const answered = value.answers[q.id] != null;
              const isNext = nextQuestion && q.id === nextQuestion.id;
              if (!answered && !isNext) return null; // 아직 그 앞 질문에 답 안 함 → 안 보여줌(순서대로)
              return (
                <div key={q.id} className="slideup" style={{ marginBottom: i === visible.length - 1 ? 0 : 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{q.질문}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {q.선택지.map((opt, idx) => (
                      <button key={opt.라벨} onClick={() => answer(q.id, idx)} style={pill(value.answers[q.id] === idx)}>
                        {opt.라벨}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </Section>
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div className="slideup">
          <Result result={result} showDetail={showDetail} setShowDetail={setShowDetail} />
        </div>
      )}

      <p style={fine}>※ 여기 판정은 규정을 바탕으로 한 가능성 안내예요. 정확한 소득 인정 여부와 서류는 상담역이 확정해드려요. 입력한 답은 이 화면 밖으로 나가지 않아요.</p>
    </div>
  );
}

/* ── 결과 카드 ──
   초록 = "그대로 인정될 가능성이 높아요". 노랑 = "다를 수 있어요" + 왜 + 뭘 준비하면 되는지.
   가드레일 4: 노랑이어도 절대 거절로 안 끝낸다 — 항상 필요서류를 같이 보여준다. */
function Result({ result, showDetail, setShowDetail }) {
  const { tone, type, notes } = result;
  const ok = tone === "green";
  return (
    <Section title={ok ? "입력하신 소득, 그대로 인정될 가능성이 높아요" : "인정소득이 입력하신 금액과 다를 수 있어요"} tone={ok ? "ok" : "warn"}>
      {!ok && (
        <div style={{ marginBottom: notes.length ? 10 : 0 }}>
          {notes.length > 0
            ? notes.map((n, i) => <div key={i} style={{ fontSize: 13, color: "#9A6B12", lineHeight: 1.65, marginBottom: 4 }}>· {n}</div>)
            : <div style={{ fontSize: 13, color: "#9A6B12", lineHeight: 1.65 }}>· 이 소득 유형은 산정 방식 자체가 입력한 금액과 달라요.</div>}
          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 6, lineHeight: 1.6 }}>
            그래도 여기서 끝이 아니에요 — 아래 서류를 미리 준비해두면 상담역이 정확한 금액을 빠르게 확인해드려요.
          </div>
        </div>
      )}

      {type.필요서류?.length > 0 && (
        <div style={{ marginTop: ok ? 4 : 10, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.greenDeep, marginBottom: 5 }}>미리 준비하면 좋은 서류</div>
          {type.필요서류.map((d) => <div key={d} style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.65 }}>· {d}</div>)}
        </div>
      )}

      <button onClick={() => setShowDetail((s) => !s)} style={{ ...ghostBtn, marginTop: 12, fontSize: 12, padding: "7px 12px" }}>
        {showDetail ? "산정 기준 원문 접기" : "산정 기준 원문 보기(상담역용)"}
      </button>
      {showDetail && (
        <div className="slideup" style={{ marginTop: 10, padding: "12px 13px", borderRadius: 12, background: "#F7FAF7", border: `1px dashed ${C.line}`, fontSize: 12, color: C.inkSoft, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {type.인정소득_산정방법}
        </div>
      )}
    </Section>
  );
}
