import { createSupabaseContext } from "npm:@supabase/server@1.7.0";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
let credential: { hash: string; until: number } | undefined;
Deno.serve(async (request: Request) => {
  const provided = request.headers.get("x-passmate-stats-token") || "";
  // Only the same-origin Next server may submit validated/corrected question results.
  // No browser receives this credential or reads individual response rows.
  if (!/^[a-f0-9]{64}$/.test(provided)) return json({ error: "unauthorized" }, 401);
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const { data: context, error: contextError } = await createSupabaseContext(request, { auth: "none" });
    if (contextError || !context) return json({ error: "unavailable" }, 503);
    if (!credential || credential.until < Date.now()) {
      const { data, error } = await context.supabaseAdmin.from("question_bank_stats_credentials").select("token_hash").eq("id", true).single();
      if (error || !data) return json({ error: "unauthorized" }, 401);
      credential = { hash: data.token_hash, until: Date.now() + 300_000 };
    }
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(provided));
    const hash = Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    let difference = hash.length ^ credential.hash.length;
    for (let i = 0; i < hash.length; i++) difference |= hash.charCodeAt(i) ^ (credential.hash.charCodeAt(i) || 0);
    if (difference) return json({ error: "unauthorized" }, 401);
    const raw = await request.text();
    if (raw.length > 35_000) return json({ error: "too_large" }, 413);
    const body = JSON.parse(raw);
    if (!["read", "record"].includes(body.action) || !/^[a-f0-9]{64}$/.test(body.visitorHash) ||
      !Array.isArray(body.rows) || !body.rows.length || body.rows.length > 100 ||
      !body.rows.every((row: Record<string, unknown>) => typeof row.question_ref === "string" && row.question_ref.length <= 36 &&
        typeof row.qualification_code === "string" && row.qualification_code.length <= 80 && typeof row.revision === "string" && /^[a-f0-9]{64}$/.test(row.revision) &&
        (body.action === "read" || typeof row.correct === "boolean"))) return json({ error: "invalid_request" }, 400);
    if (body.action === "record") {
      const { error } = await context.supabaseAdmin.rpc("record_question_bank_responses", { p_visitor_hash: body.visitorHash, p_rows: body.rows });
      if (error) return json({ error: "unavailable" }, 503);
    }
    const { data, error } = await context.supabaseAdmin.from("question_bank_response_stats")
      .select("question_ref,revision,total_count,correct_count").in("revision", body.rows.map((row: { revision: string }) => row.revision));
    if (error) return json({ error: "unavailable" }, 503);
    const stats = Object.fromEntries(body.rows.map((row: { question_ref: string; revision: string }) => {
      const saved = data?.find((item) => item.question_ref === row.question_ref && item.revision === row.revision);
      return [row.question_ref, { total: Number(saved?.total_count || 0), correct: Number(saved?.correct_count || 0) }];
    }));
    return json({ stats });
  } catch { return json({ error: "unavailable" }, 503); }
});
