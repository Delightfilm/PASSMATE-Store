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
export function oldProgressAttempt(attempt: LocalAttempt, lastSeen: number | undefined, now = Date.now()) {
  const started = Date.parse(attempt.startedAt);
  const seen = Number.isFinite(lastSeen) ? Math.max(started, lastSeen!) : started;
  return attempt.status === "in_progress" && !attempt.endAt && Number.isFinite(seen) && now - seen >= 7 * 86400000;
}
export function readAttemptVisits(accountId: string): Record<string, number> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`passmate.cbt-visits.v1:${accountId}`) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([,time]) => typeof time === "number" && Number.isFinite(time))) : {};
  } catch { return {}; }
}
export function markAttemptVisit(accountId: string, id: string) {
  try { localStorage.setItem(`passmate.cbt-visits.v1:${accountId}`, JSON.stringify({ ...readAttemptVisits(accountId), [id]: Date.now() })); } catch { /* Display grouping only; no DB writes. */ }
}
// Scroll only this container; scrollIntoView can also move the page vertically.
export function centerInScroller(element: HTMLElement, container: HTMLElement) {
  const item = element.getBoundingClientRect(), parent = container.getBoundingClientRect();
  container.scrollTo({ left: container.scrollLeft + item.left - parent.left - (parent.width - item.width) / 2, behavior: "instant" });
}
