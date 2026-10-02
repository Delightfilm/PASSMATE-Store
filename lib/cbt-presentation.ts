import type { LocalAttempt } from "./question-bank";

export const MOCK_SUBJECTS = [
  { internal: "금속도장재료", name: "금속도장재료", short: "재료" },
  { internal: "금속도장", name: "금속도장 작업 및 안전", short: "도장" },
  { internal: "색채", name: "색채 및 조색", short: "색채" },
] as const;
export function subjectName(name: string) { return MOCK_SUBJECTS.find((subject) => subject.internal === name)?.name || name; }
export function attemptLabel(attempt: LocalAttempt) {
  return attempt.config.mode === "mock" ? "모의시험" : attempt.config.mode === "custom" ? "맞춤 시험지" : attempt.config.mode === "subject" ? "단원 연습" : attempt.config.mode === "past" || attempt.config.examIds.length === 1 ? "회차 기출" : "이전 시험";
}
export function expiredAttempt(attempt: LocalAttempt, now = Date.now()) {
  return attempt.status === "in_progress" && !!attempt.endAt && new Date(attempt.endAt).getTime() <= now;
}
// Scroll only this container; scrollIntoView can also move the page vertically.
export function centerInScroller(element: HTMLElement, container: HTMLElement) {
  const item = element.getBoundingClientRect(), parent = container.getBoundingClientRect();
  container.scrollTo({ left: container.scrollLeft + item.left - parent.left - (parent.width - item.width) / 2, behavior: "instant" });
}
