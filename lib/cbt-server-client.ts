import { getSupabaseBrowserClient } from "./supabase-browser";
import type { LocalAttempt } from "./question-bank";

export const SERVER_EXAMS = process.env.NEXT_PUBLIC_CBT_SERVER_EXAMS === "1";
export async function cbtPost<T>(path: string, body: unknown = {}): Promise<T> {
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  if (!data.session) throw new Error("로그인이 필요합니다.");
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "요청을 처리하지 못했습니다.");
  return result;
}
export function serverAttempt(row: { client_id: string; config: LocalAttempt["config"] & { practiceNumber: string; displayNameSnapshot: string; seed: string; reviewIds: string[]; lockedIds: string[] }; question_ids: string[]; answers: Record<string, number>; started_at: string; end_at: string | null; submitted_at?: string; score?: number; status: LocalAttempt["status"] }): LocalAttempt {
  return { id: row.client_id, config: row.config, questionIds: row.question_ids, answers: row.answers, startedAt: row.started_at, endAt: row.end_at, submittedAt: row.submitted_at, status: row.status, score: row.score, serverManaged: true, seed: row.config.seed, practiceNumber: row.config.practiceNumber, displayNameSnapshot: row.config.displayNameSnapshot, reviewIds: row.config.reviewIds, lockedIds: row.config.lockedIds || [] };
}
