import type { LocalAttempt, LocalStore, Question } from "./question-bank";

export function recordInstantReview(store: LocalStore, attempt: LocalAttempt, question: Question, answer: number): LocalStore {
  const reviewed = attempt.reviewedQuestionIds || [];
  if (reviewed.includes(question.id)) return store;
  const old = store.wrongNotes[question.id];
  const note = answer === question.answer ? old && { ...old, mastered: true } : {
    wrongCount: (old?.wrongCount || 0) + 1, lastWrongAt: new Date().toISOString(), memo: old?.memo || "", mastered: false,
  };
  return { ...store, wrongNotes: { ...store.wrongNotes, ...(note ? { [question.id]: note } : {}) },
    attempts: store.attempts.map((item) => item.id === attempt.id ? { ...item, reviewedQuestionIds: [...reviewed, question.id] } : item) };
}
export function saveQuestionMemo(store: LocalStore, question: Question, memo: string): LocalStore {
  if (memo.length > 2000) throw new Error("memo_too_long");
  const old = store.wrongNotes[question.id];
  return { ...store, questionCerts: { ...store.questionCerts, [question.id]: question.certId },
    wrongNotes: { ...store.wrongNotes, [question.id]: { wrongCount: old?.wrongCount ?? 0, lastWrongAt: old?.lastWrongAt || new Date().toISOString(),
      mastered: old?.mastered || false, memo: memo.trim() } } };
}
