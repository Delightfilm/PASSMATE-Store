import type { LocalStore } from "@/lib/question-bank";

export function summarizeStudy(store: Pick<LocalStore, "attempts" | "bookmarks" | "wrongNotes">) {
  const completed = store.attempts.filter(attempt => attempt.status === "submitted");
  const scored = completed.filter(attempt => typeof attempt.score === "number" && Number.isFinite(attempt.score) && attempt.score >= 0 && attempt.score <= 100);
  const notes = Object.values(store.wrongNotes).filter(note => note.wrongCount > 0);
  const date = (attempt: typeof completed[number]) => Date.parse(attempt.submittedAt || attempt.startedAt);
  return {
    completed: completed.length,
    total: store.attempts.length,
    completionRate: store.attempts.length ? Math.round(completed.length / store.attempts.length * 100) : null,
    accuracy: scored.length ? Math.round(scored.reduce((sum, attempt) => sum + attempt.score!, 0) / scored.length) : null,
    scored: scored.length,
    mastered: notes.filter(note => note.mastered).length,
    wrong: notes.filter(note => !note.mastered).length,
    bookmarks: store.bookmarks.length,
    trend: [...scored].sort((a,b) => date(a) - date(b)).slice(-7),
    recent: [...store.attempts].sort((a,b) => date(b) - date(a)).slice(0,5),
  };
}
