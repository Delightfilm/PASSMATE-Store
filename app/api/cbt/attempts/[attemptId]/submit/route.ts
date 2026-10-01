import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "@/lib/public-supabase-config";

export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { url, key } = getPublicSupabaseConfig();
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return Response.json({ error: "로그인 정보를 확인할 수 없습니다." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "응시 정보가 올바르지 않습니다." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "응시 정보가 올바르지 않습니다." }, { status: 400 });
  const attempt = body as Record<string, unknown>;
  if (attempt.id !== attemptId || !/^attempt-[\w-]{1,100}$/.test(attemptId) ||
      !attempt.config || typeof attempt.config !== "object" ||
      !Array.isArray(attempt.questionIds) || !attempt.questionIds.length ||
      !attempt.questionIds.every((id) => typeof id === "string") ||
      !attempt.answers || typeof attempt.answers !== "object" || Array.isArray(attempt.answers) ||
      !Object.values(attempt.answers).every((value) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 3) ||
      !Array.isArray(attempt.lockedIds) ||
      typeof attempt.startedAt !== "string" || !Number.isFinite(Date.parse(attempt.startedAt)) ||
      !(attempt.endAt === null || (typeof attempt.endAt === "string" && Number.isFinite(Date.parse(attempt.endAt)))) ||
      !Number.isInteger(attempt.score) || Number(attempt.score) < 0 || Number(attempt.score) > 100) {
    return Response.json({ error: "응시 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const payload = {
    user_id: auth.user.id,
    client_id: attemptId,
    config: { ...(attempt.config as Record<string, unknown>), lockedIds: attempt.lockedIds },
    question_ids: attempt.questionIds,
    answers: attempt.answers,
    started_at: attempt.startedAt,
    end_at: attempt.endAt,
    submitted_at: new Date().toISOString(),
    score: attempt.score as number,
    status: "submitted",
  };
  const scope = () => supabase.from("question_bank_attempts").select("answers,submitted_at,score,status").eq("user_id", auth.user.id).eq("client_id", attemptId);
  const finalize = () => supabase.from("question_bank_attempts").update(payload).eq("user_id", auth.user.id).eq("client_id", attemptId).eq("status", "in_progress").select("answers,submitted_at,score,status").maybeSingle();

  let { data: row, error } = await finalize();
  let created = !!row;
  if (error) return Response.json({ error: "결과를 저장하지 못했습니다." }, { status: 500 });
  if (!row) {
    const inserted = await supabase.from("question_bank_attempts").upsert(payload, { onConflict: "user_id,client_id", ignoreDuplicates: true }).select("answers,submitted_at,score,status").maybeSingle();
    if (inserted.error) return Response.json({ error: "결과를 저장하지 못했습니다." }, { status: 500 });
    row = inserted.data;
    created = !!row;
  }
  if (!row) {
    const existing = await scope().maybeSingle();
    if (existing.error) return Response.json({ error: "결과를 확인하지 못했습니다." }, { status: 500 });
    row = existing.data;
  }
  if (row?.status === "in_progress") {
    const retried = await finalize();
    if (retried.error) return Response.json({ error: "결과를 저장하지 못했습니다." }, { status: 500 });
    row = retried.data || (await scope().maybeSingle()).data;
    created = !!retried.data;
  }
  if (!row || row.status !== "submitted") return Response.json({ error: "결과를 확인하지 못했습니다." }, { status: 500 });
  return Response.json({ answers: row.answers, submittedAt: row.submitted_at, score: Number(row.score), alreadySubmitted: !created }, { headers: { "Cache-Control": "no-store" } });
}
