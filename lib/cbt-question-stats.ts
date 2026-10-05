import { sourceHash, type Question } from "./question-bank";

export type QuestionStats = { total: number; correct: number };
export function questionStatsInput(question: Question) {
  return { id: question.id, certId: question.certId, sourceHash: question.sourceHash,
    stem: question.stem, choices: question.choices, answer: question.answer, images: question.images };
}
export function statsPresentation(stats: QuestionStats) {
  if (!stats.total) return { label: "응답을 모으고 있어요", tone: "neutral", rate: null };
  const rate = Math.round(stats.correct / stats.total * 100);
  return { rate, tone: stats.total < 20 ? "neutral" : rate <= 30 ? "hard" : rate <= 60 ? "careful" : "easy",
    label: stats.total < 20 ? "아직 표본이 적어요" : rate <= 30 ? "많이 틀리는 문제" : rate <= 60 ? "주의해서 풀어보세요" : "정답률이 높은 문제" };
}
export async function questionStatsRequest(questions: Question[], answers?: Record<string, number>, signal?: AbortSignal) {
  const rows = await Promise.all(questions.map(async (question) => ({ questionId: question.id, qualificationCode: question.certId,
    revision: await sourceHash(questionStatsInput(question)), ...(answers ? { answer: answers[question.id] } : {}) })));
  const response = await fetch("/api/cbt/question-stats/", { method: "POST", cache: "no-store", signal,
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: answers ? "record" : "read", questions: rows }) });
  if (!response.ok) throw new Error("stats_unavailable");
  return (await response.json()) as { stats: Record<string, QuestionStats> };
}
let recording = Promise.resolve();
export function recordQuestionResponses(questions: Question[], answers: Record<string, number>) {
  const answered = questions.filter((question) => Number.isInteger(answers[question.id]));
  // Serialize batches so the anonymous cookie is established before the next write.
  recording = recording.catch(() => {}).then(async () => {
    for (let offset = 0; offset < answered.length; offset += 100) {
      await questionStatsRequest(answered.slice(offset, offset + 100), answers, AbortSignal.timeout(45_000));
    }
    window.dispatchEvent(new CustomEvent("cbt-stats-updated", { detail: answered.map((question) => question.id) }));
  }).catch(() => {}); // Optional statistics never prevent answering or saving an exam.
}
