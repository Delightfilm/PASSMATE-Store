import type { Question } from "../lib/question-bank";
import { acceptedAnswers, answerChoicesText } from "../lib/question-bank-answers";

export function QuestionAnswerInfo({ question, reveal = true }: { question: Question; reveal?: boolean }) {
  if (!question.answerStatus && question.inferredAnswers === undefined) return null;
  return <aside className="question-answer-info" aria-label="답안 출처와 검증 상태">
    <p><strong>{question.answerLabel || (question.answerStatus === "provisional" ? "가답안 (확정답안 미확보)" : "공식 확정답안")}</strong>
      {reveal && <>: {answerChoicesText(question, acceptedAnswers(question))}</>}</p>
    {question.inferredAnswers !== undefined && <>
      <p><strong>추정 후보 (공식 확정답안 아님)</strong>{reveal ? <>: {question.inferredAnswers.length ? answerChoicesText(question, question.inferredAnswers) : "해당 보기 없음"}</> : " · 답안 확인 시 표시"}</p>
      {question.answerComparison === "disagree" && <p><strong>답안 불일치</strong> · 채점은 가답안 기준입니다.</p>}
      {reveal && question.inferredAnswerNote && <p>{question.inferredAnswerNote}</p>}
    </>}
    {question.answerStatus === "provisional" && <small>가답안 기준으로 채점하며, 확정답안 확보 시 변경될 수 있습니다.</small>}
  </aside>;
}
