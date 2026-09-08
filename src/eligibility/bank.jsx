import { C } from "../data.js";
import { card } from "../ui.jsx";

export default function Bank() {
  return (
    <div style={{ ...card, color: C.inkSoft, fontSize: 14, lineHeight: 1.6 }}>
      은행대출 로직은 곧 준비할게요. 지금은 정부대출 탭을 먼저 만들었어요.
    </div>
  );
}
