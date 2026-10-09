import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeLocalStore, type LocalStore, type AttemptConfig } from "@/lib/question-bank";

type AttemptRow = { id: string; client_id: string | null; config: AttemptConfig & { lockedIds?: string[] }; question_ids: string[]; answers: Record<string,number>; started_at: string; end_at: string | null; submitted_at: string | null; score: number | null; status: string };
type NoteRow = { question_id: string; wrong_count: number; last_wrong_at: string | null; memo: string | null; mastered: boolean };
type NasRow = Omit<NoteRow,"question_id"> & { question_ref: string; bookmarked: boolean };

/** Read-only, account-scoped queries. Shared browser guest records are excluded. */
export async function readAccountStudy(client: SupabaseClient, userId: string, signal: AbortSignal): Promise<LocalStore> {
  if (!userId) throw new Error("로그인이 필요합니다.");
  async function rows<Row>(table: string, columns: string, order: string) {
    const records: Row[] = [];
    for (let start = 0; ; start += 1000) {
      const { data, error } = await client.from(table).select(columns).eq("user_id", userId).order(order).range(start, start + 999).returns<Row[]>().abortSignal(signal);
      if (error || signal.aborted) throw new Error("학습 기록을 불러오지 못했어요.");
      records.push(...(data || []));
      if (!data || data.length < 1000) return records;
    }
  }
  const [attempts, bookmarks, notes, nas] = await Promise.all([
    rows<AttemptRow>("question_bank_attempts", "id,client_id,config,question_ids,answers,started_at,end_at,submitted_at,score,status", "id"),
    rows<{ question_id: string }>("question_bank_bookmarks", "question_id", "question_id"),
    rows<NoteRow>("question_bank_wrong_notes", "question_id,wrong_count,last_wrong_at,memo,mastered", "question_id"),
    rows<NasRow>("question_bank_user_question_state", "question_ref,bookmarked,wrong_count,last_wrong_at,memo,mastered", "question_ref"),
  ]);
  const wrongNotes: LocalStore["wrongNotes"] = {};
  for (const row of notes) wrongNotes[row.question_id] = { wrongCount: row.wrong_count, lastWrongAt: row.last_wrong_at || "", memo: row.memo || "", mastered: row.mastered };
  for (const row of nas) wrongNotes[row.question_ref] = { wrongCount: row.wrong_count, lastWrongAt: row.last_wrong_at || "", memo: row.memo || "", mastered: row.mastered };
  return normalizeLocalStore({
    attempts: attempts.map(row => ({ id: row.client_id || row.id, config: row.config, questionIds: row.question_ids, answers: row.answers, lockedIds: row.config?.lockedIds || [], startedAt: row.started_at, endAt: row.end_at, submittedAt: row.submitted_at || undefined, score: row.score == null ? undefined : Number(row.score), status: row.status })),
    bookmarks: [...bookmarks.map(row => row.question_id), ...nas.filter(row => row.bookmarked).map(row => row.question_ref)],
    wrongNotes,
  });
}
