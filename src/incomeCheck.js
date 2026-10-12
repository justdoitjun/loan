/* 소득 신뢰도 자가진단의 판정 — 화면(IncomeCheck.jsx) 없이 돌아가는 순수 함수.
   질문·선택지·조건은 전부 src/data/incomeRules.js 데이터에서 읽는다. JSX 금지.
   조건부 질문의 키는 데이터 필드 이름 그대로(condition.dependsOn · condition.answer). */
import { ACTIVE_INCOME_TYPES } from "./data/incomeRules.js";

export const typeOf = (typeKey) => ACTIVE_INCOME_TYPES.find((t) => t.incomeType === typeKey) ?? null;

/* 조건부 질문(예: "20% 넘게 차이나요?"에 '네'라고 답했을 때만 다음 질문)을 걸러낸다.
   조건이 가리키는 이전 질문이 아직 안 채워졌으면 이 질문도 아직 안 보인다. */
export function visibleChecklist(type, answers) {
  return type.checklist.filter((q) => {
    if (!q.condition) return true;
    const depIdx = answers[q.condition.dependsOn];
    if (depIdx == null) return false;
    const depQ = type.checklist.find((x) => x.id === q.condition.dependsOn);
    return depQ.choices[depIdx].pass === q.condition.answer;
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
   어떤 메모를 보여줄지만 정한다. 기본논조가 green인 유형은 질문 하나라도 "pass:false"로
   답해지면 노랑으로 떨어진다. 준비가 안 됐으면 null(화면이 결과 대신 다음 질문을 그린다). */
export function incomeCheckResult(value) {
  const type = typeOf(value.typeKey);
  if (!type || !incomeCheckReady(value)) return null;
  const visible = visibleChecklist(type, value.answers);
  const picked = visible.map((q) => ({ q, choice: q.choices[value.answers[q.id]] }));
  /* "20% 넘게 차이나요?"처럼 위험 답변이 후속 질문(조건부)을 여는 경우, 그 후속 질문의
     답이 최종 결론이다 — 앞 질문 자체의 pass:false는 "final" 판정에서 빼야 한다.
     안 그러면 후속 질문에서 "상시소득이라 괜찮다"고 답해도 계속 노랑에 갇힌다. */
  const hasVisibleFollowUp = (qid) => visible.some((v) => v.condition?.dependsOn === qid);
  const failed = picked.some((p) => p.choice.pass === false && !hasVisibleFollowUp(p.q.id));
  const tone = type.baseTone === "amber" || failed ? "amber" : "green";
  const notes = picked.filter((p) => p.choice.note).map((p) => p.choice.note);
  return { tone, type, notes };
}
