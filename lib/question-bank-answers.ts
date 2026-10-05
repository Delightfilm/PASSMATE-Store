import type { Question } from "./question-bank";

// Runtime indexes are zero based. Inferred candidates never become grading keys.
export function acceptedAnswers(question: Question): number[] {
  return question.acceptedAnswers?.length ? question.acceptedAnswers : [question.answer];
}
export function isCorrectAnswer(question: Question, selected: number | undefined): boolean {
  return selected !== undefined && acceptedAnswers(question).includes(selected);
}
export function gradingAnswerLabel(question: Question): string {
  return question.answerStatus === "provisional" ? "가답안" : "정답";
}
export function answerChoicesText(question: Question, positions: number[]): string {
  return positions.map(index => question.choices[index]?.label || String(index + 1)).join(" · ");
}
