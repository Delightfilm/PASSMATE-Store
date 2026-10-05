import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { trustedQuestion } from "@/lib/ai-explanation-server";
import { questionStatsInput } from "@/lib/cbt-question-stats";
import { getPublicSupabaseConfig } from "@/lib/public-supabase-config";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  let cookie: string | undefined;
  const reply = (body: unknown, status = 200) => Response.json(body, { status,
    headers: { "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) } });
  try {
    if ((request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return reply({ error: "same_origin_required" }, 403);
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return reply({ error: "json_required" }, 415);
    const raw = await request.text();
    if (raw.length > 35_000) return reply({ error: "request_too_large" }, 413);
    const body = JSON.parse(raw);
    if (!["read", "record"].includes(body?.action) || !Array.isArray(body.questions) || !body.questions.length || body.questions.length > 100) return reply({ error: "invalid_request" }, 400);
    for (const row of body.questions) {
      if (!row || typeof row.qualificationCode !== "string" || !/^[a-z0-9-]{1,80}$/i.test(row.qualificationCode) ||
        typeof row.questionId !== "string" || !/^(?:[a-f0-9]{20}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(row.questionId) ||
        typeof row.revision !== "string" || !/^[a-f0-9]{64}$/.test(row.revision) ||
        (body.action === "record" && (!Number.isInteger(row.answer) || row.answer < 0 || row.answer > 9))) return reply({ error: "invalid_question" }, 400);
    }
    const token = process.env.PASSMATE_CBT_STATS_TOKEN || "";
    if (token.length < 32) return reply({ error: "stats_unavailable" }, 503);
    const sign = (id: string) => createHmac("sha256", token).update(`stats-cookie:${id}`).digest("hex");
    const stored = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("passmate_cbt_stats="))?.slice(19) || "";
    const match = /^([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(stored);
    const valid = match && timingSafeEqual(Buffer.from(match[2], "hex"), Buffer.from(sign(match[1]), "hex"));
    const id = valid ? match[1] : randomBytes(16).toString("hex");
    if (!valid) cookie = `passmate_cbt_stats=${id}.${sign(id)}; Path=/api/cbt/question-stats/; Max-Age=31536000; HttpOnly; SameSite=Lax${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
    const rows: { question_ref: string; qualification_code: string; revision: string; correct?: boolean }[] = [];
    // Reads expose aggregate counts only; source validation is needed when recording correctness.
    if (body.action === "read") {
      rows.push(...body.questions.map((row: { questionId: string; qualificationCode: string; revision: string }) =>
        ({ question_ref: row.questionId, qualification_code: row.qualificationCode, revision: row.revision })));
    } else for (let offset = 0; offset < body.questions.length; offset += 5) {
      rows.push(...await Promise.all(body.questions.slice(offset, offset + 5).map(async (row: { questionId: string; qualificationCode: string; revision: string; answer: number }) => {
        const question = await trustedQuestion(row.qualificationCode, row.questionId);
        const revision = createHash("sha256").update(JSON.stringify(questionStatsInput(question))).digest("hex");
        if (revision !== row.revision || row.answer >= question.choices.length) throw new Error("question_changed");
        return { question_ref: question.id, qualification_code: question.certId, revision,
          correct: row.answer === question.answer };
      })));
    }
    const { url, key } = getPublicSupabaseConfig();
    const response = await fetch(`${url}/functions/v1/question-bank-stats`, { method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", apikey: key, "x-passmate-stats-token": token }, signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({ action: body.action, visitorHash: createHmac("sha256", token).update(`stats-visitor:${id}`).digest("hex"), rows }) });
    if (!response.ok) return reply({ error: "stats_unavailable" }, 503);
    return reply(await response.json());
  } catch (error) {
    if (error instanceof SyntaxError) return reply({ error: "invalid_request" }, 400);
    if (error instanceof Error && error.message === "question_changed") return reply({ error: "question_changed" }, 409);
    return reply({ error: "stats_unavailable" }, 503);
  }
}
