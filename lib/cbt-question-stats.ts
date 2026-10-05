import { sourceHash, type Question } from "./question-bank";

export type QuestionStats = { total: number; correct: number };
export function questionStatsInput(question: Question) {
  return { id: question.id, certId: question.certId, sourceHash: question.sourceHash,
    stem: question.stem, choices: question.choices, answer: question.answer, images: question.images };
}
export function statsPresentation(stats: QuestionStats) {
  if (!stats.total) return { label: "응답을 모으고 있어요", tone: "neutral", rate: null };
  const rate = Math.round(stats.correct / stats.total * 100);
  return { rate, tone: rate >= 70 ? "high" : rate >= 50 ? "good" : rate >= 40 ? "careful" : "hard",
    label: rate >= 70 ? "많이 맞히는 문제예요" : rate >= 50 ? "대체로 잘 맞혀요" : rate >= 40 ? "많이 헷갈려하는 문제예요" : "많이 틀리는 문제예요" };
}
export async function questionStatsRequest(questions: Question[], answers?: Record<string, number>, signal?: AbortSignal, attemptId?: string) {
  const rows = await Promise.all(questions.map(async (question) => ({ questionId: question.id, qualificationCode: question.certId,
    revision: await sourceHash(questionStatsInput(question)), ...(answers ? { answer: answers[question.id] } : {}) })));
  const response = await fetch("/api/cbt/question-stats/", { method: "POST", cache: "no-store", signal,
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: answers ? "record" : "read", ...(answers ? { attemptId } : {}), questions: rows }) });
  if (!response.ok) throw new Error("stats_unavailable");
  return (await response.json()) as { stats: Record<string, QuestionStats> };
}
const cached = new Map<string, { stats: QuestionStats; at: number }>();
const pending = new Map<string, Promise<QuestionStats>>();
const cacheKey = (question: Question) => JSON.stringify(questionStatsInput(question));
function cacheStats(question: Question, stats: QuestionStats) {
  const key = cacheKey(question);
  cached.delete(key);
  cached.set(key, { stats, at: Date.now() });
  if (cached.size > 500) cached.delete(cached.keys().next().value!);
}
export function cachedQuestionStats(question: Question) {
  return cached.get(cacheKey(question))?.stats || null;
}
function freshQuestionStats(question: Question) {
  const entry = cached.get(cacheKey(question));
  return entry && Date.now() - entry.at < 60_000 ? entry.stats : null;
}
export async function loadQuestionStats(questions: Question[]) {
  const missing = questions.filter((question) => !freshQuestionStats(question) && !pending.has(cacheKey(question)));
  for (let offset = 0; offset < missing.length; offset += 100) {
    const batch = missing.slice(offset, offset + 100);
    const before = batch.map((question) => cached.get(cacheKey(question)));
    const request = questionStatsRequest(batch, undefined, AbortSignal.timeout(15_000)).then((body) => {
      batch.forEach((question, index) => {
        // A recording completed during this read: keep its newer aggregate.
        if (cached.get(cacheKey(question)) === before[index]) cacheStats(question, body.stats[question.id] || { total: 0, correct: 0 });
      });
      return body;
    }).finally(() => batch.forEach((question) => pending.delete(cacheKey(question))));
    batch.forEach((question) => pending.set(cacheKey(question), request.then((body) =>
      cachedQuestionStats(question) || body.stats[question.id] || { total: 0, correct: 0 })));
  }
  const values = await Promise.all(questions.map((question) => freshQuestionStats(question) || pending.get(cacheKey(question))!));
  return Object.fromEntries(questions.map((question, index) => [question.id, values[index]]));
}
let recording = Promise.resolve();
export function recordQuestionResponses(questions: Question[], answers: Record<string, number>, attemptId: string) {
  const answered = questions.filter((question) => Number.isInteger(answers[question.id]));
  // Serialize batches so the anonymous cookie is established before the next write.
  recording = recording.catch(() => {}).then(async () => {
    for (let offset = 0; offset < answered.length; offset += 100) {
      const batch = answered.slice(offset, offset + 100);
      const body = await questionStatsRequest(batch, answers, AbortSignal.timeout(45_000), attemptId);
      batch.forEach((question) => cacheStats(question, body.stats[question.id] || { total: 0, correct: 0 }));
    }
    window.dispatchEvent(new CustomEvent("cbt-stats-updated", { detail: answered.map((question) => question.id) }));
  }).catch(() => {}); // Optional statistics never prevent answering or saving an exam.
}
