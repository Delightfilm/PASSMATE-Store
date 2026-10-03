import { authenticatedUser, cacheConfig, cacheRequest, ExplanationError, fingerprint, generateExplanation, imageParts, trustedQuestion } from "@/lib/ai-explanation-server";
import { validateExplanation, type ExplanationReply } from "@/lib/ai-explanation-contract";

export const runtime = "nodejs";
export const maxDuration = 180;
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
function publicResult(result: Omit<ExplanationReply, "status"> & { status: string }, answer: number, cached = true) {
  if (!["ready", "generating", "refused", "failed"].includes(result.status)) throw new Error("cache_result_invalid");
  return { status: result.status, ...(result.status === "ready" ? { explanation: validateExplanation(result.explanation, answer) } : {}), message: result.message, cached };
}

export async function POST(request: Request) {
  let key: string | undefined; let lease: string | undefined;
  let stage = "request";
  try {
    if (Number(request.headers.get("content-length") || 0) > 2048) return reply({ error: "요청이 너무 큽니다." }, 413);
    const raw = await request.text();
    if (raw.length > 2048) return reply({ error: "요청이 너무 큽니다." }, 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ error: "요청 형식이 올바르지 않습니다." }, 400);
    const { qualificationCode, questionId, revision, readOnly } = body;
    if (typeof qualificationCode !== "string" || !/^[a-z0-9-]{1,80}$/i.test(qualificationCode) ||
        typeof questionId !== "string" || !/^(?:[a-f0-9]{20}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(questionId) ||
        typeof revision !== "string" || !/^[a-f0-9]{64}$/.test(revision) || typeof readOnly !== "boolean") {
      return reply({ error: "문항 정보가 올바르지 않습니다." }, 400);
    }
    cacheConfig(); // Fail closed: never call the model without durable NAS storage.
    const question = await trustedQuestion(qualificationCode, questionId);
    key = fingerprint(question);
    if (revision !== key) return reply({ error: "문제가 수정되었습니다. 페이지를 새로고침한 뒤 해설을 확인해 주세요." }, 409);
    if (question.explanation.trim()) return reply({ error: "등록된 해설이 있습니다. 페이지를 새로고침해 주세요." }, 409);
    const existing = await cacheRequest(key);
    if (existing.status !== "missing") return reply(publicResult(existing, question.answer));
    if (readOnly) return reply({ status: "missing" });
    const userHash = await authenticatedUser(request);
    const claimed = await cacheRequest(key, "claim", { userHash });
    if (claimed.status === "limited") return reply({ error: "오늘 또는 이번 달의 새 해설 생성 한도에 도달했습니다. 저장된 해설은 계속 이용할 수 있습니다." }, 429);
    if (claimed.status !== "claimed") return reply(publicResult(claimed, question.answer));
    lease = claimed.lease;
    if (!lease || !/^[a-f0-9]{64}$/.test(lease)) throw new Error("cache_lease_missing");
    stage = "images";
    const images = await imageParts(question); // One downloader per job; still BEFORE any billable call.
    stage = "generation";
    const result = await generateExplanation(question, images);
    stage = "storage";
    await cacheRequest(key, "finish", { lease, payload: result });
    lease = undefined;
    return reply(publicResult(result, question.answer, false));
  } catch (error) {
    // Only typed diagnostic metadata: never stringify an SDK error, message,
    // request, provider response, account, question, or credential.
    const diagnostic = error as { name?: unknown; statusCode?: unknown } | null;
    const names = ["GatewayInvalidRequestError", "GatewayAuthenticationError", "GatewayRateLimitError", "GatewayInternalServerError", "GatewayResponseError", "AI_APICallError", "AI_NoOutputGeneratedError", "AI_NoObjectGeneratedError", "TimeoutError", "AbortError", "TypeError"];
    console.error("ai_explanation_failed", {
      stage,
      kind: typeof diagnostic?.name === "string" && names.includes(diagnostic.name) ? diagnostic.name : "other",
      status: typeof diagnostic?.statusCode === "number" && Number.isInteger(diagnostic.statusCode) && diagnostic.statusCode >= 400 && diagnostic.statusCode <= 599 ? diagnostic.statusCode : undefined,
    });
    if (key && lease) {
      // Retain the claim even if NAS is temporarily unreachable. Never silently re-bill.
      await cacheRequest(key, "finish", { lease, payload: { status: "failed", message: "해설 생성 또는 저장에 실패했습니다. 중복 비용 방지를 위해 자동 재생성하지 않습니다." } }).catch(() => undefined);
    }
    if (error instanceof ExplanationError) return reply({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return reply({ error: "요청 형식이 올바르지 않습니다." }, 400);
    // No raw provider response, NAS secret or question text in logs/browser errors.
    return reply({ error: "해설을 안전하게 생성하지 못했습니다. 잠시 후 저장 상태만 다시 확인해 주세요." }, 503);
  }
}
