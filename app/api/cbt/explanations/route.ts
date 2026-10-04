import { randomBytes } from "node:crypto";
import { generationIdentity, cacheConfig, cacheRequest, ExplanationError, fingerprint, generateExplanation, imageParts, trustedQuestion } from "@/lib/ai-explanation-server";
import { validateExplanation, hasAnswerVerification, type ExplanationReply } from "@/lib/ai-explanation-contract";

export const runtime = "nodejs";
export const maxDuration = 300;
function publicResult(result: Omit<ExplanationReply, "status"> & { status: string }, answer: number, cached = true) {
  if (!["ready", "generating", "refused", "failed"].includes(result.status)) throw new Error("cache_result_invalid");
  // Preserve old entries/key and billing claims, but never serve unchecked text
  // or automatically regenerate it after strengthening the safety gate.
  if (result.status === "ready" && !hasAnswerVerification(result, answer)) return { status: "refused", cached,
    message: "정답 일치 여부가 확인되지 않아 이 해설은 표시하지 않습니다. 중복 비용 방지를 위해 자동 재생성하지 않습니다." };
  return { status: result.status, ...(result.status === "ready" ? { explanation: validateExplanation(result.explanation, answer) } : {}), message: result.message, cached,
    ...(result.status === "failed" && result.retryable === true ? { retryable: true } : {}) };
}

export async function POST(request: Request) {
  let key: string | undefined; let lease: string | undefined;
  let guestCookie: string | undefined;
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: {
    "Cache-Control": "no-store", ...(guestCookie ? { "Set-Cookie": guestCookie } : {}),
  } });
  let stage = "request";
  try {
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
      return reply({ error: "이 사이트에서 해설보기를 눌러 주세요." }, 403);
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return reply({ error: "JSON 요청만 사용할 수 있습니다." }, 415);
    }
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
    stage = "question";
    const question = await trustedQuestion(qualificationCode, questionId);
    key = fingerprint(question);
    if (revision !== key) return reply({ error: "문제가 수정되었습니다. 페이지를 새로고침한 뒤 해설을 확인해 주세요." }, 409);
    if (question.explanation.trim()) return reply({ error: "등록된 해설이 있습니다. 페이지를 새로고침해 주세요." }, 409);
    stage = "cache";
    const existing = await cacheRequest(key);
    if (existing.status !== "missing" && !(existing.status === "failed" && existing.retryable === true && !readOnly)) return reply(publicResult(existing, question.answer));
    if (readOnly) return reply({ status: "missing" });
    stage = "identity";
    const identity = await generationIdentity(request);
    const userHash = identity.userHash; guestCookie = identity.cookie;
    stage = "claim";
    const requestedLease = randomBytes(32).toString("hex");
    lease = requestedLease; // Known BEFORE sending: recover a lost claim response without another AI call.
    const claimed = await cacheRequest(key, "claim", { userHash, lease: requestedLease });
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
    const diagnostic = error as { name?: unknown; statusCode?: unknown; message?: unknown } | null;
    const serializationName = "AI_SerializationError";
    const names = ["GatewayInvalidRequestError", "GatewayAuthenticationError", "GatewayRateLimitError", "GatewayInternalServerError", "GatewayResponseError", "GatewayForbiddenError", "GatewayFailedDependencyError", "GatewayTimeoutError", "GatewayModelNotFoundError", "GatewayNotFoundError", "AI_APICallError", "AI_NoOutputGeneratedError", "AI_NoObjectGeneratedError", "AI_InvalidPromptError", "AI_InvalidArgumentError", "AI_TypeValidationError", "AI_InvalidDataContentError", "AI_DownloadError", "AI_UnsupportedFunctionalityError", "AI_LoadAPIKeyError", "AI_LoadSettingError", "AI_JSONParseError", "AI_InvalidResponseDataError", "AI_EmptyResponseBodyError", "TimeoutError", "AbortError", "TypeError", "ReferenceError", "RangeError", "SyntaxError", "Error"];
    console.error("ai_explanation_failed", {
      stage,
      kind: typeof diagnostic?.name === "string" && (names.includes(diagnostic.name) || diagnostic.name === serializationName) ? diagnostic.name : "other",
      status: typeof diagnostic?.statusCode === "number" && Number.isInteger(diagnostic.statusCode) && diagnostic.statusCode >= 400 && diagnostic.statusCode <= 599 ? diagnostic.statusCode : undefined,
      reason: typeof diagnostic?.message === "string" && ["explanation_invalid", "explanation_unsafe", "explanation_contradiction"].includes(diagnostic.message) ? diagnostic.message : undefined,
    });
    if (key && lease) {
      // Retain the claim even if NAS is temporarily unreachable. Never silently re-bill.
      await cacheRequest(key, "finish", { lease, payload: { status: "failed", ...(stage === "claim" ? { retryable: true } : {}),
        message: stage === "claim" ? "생성 예약 응답을 받지 못했습니다. AI는 호출하지 않았으며 다시 생성할 수 있습니다." : "해설 생성 또는 저장에 실패했습니다. 중복 비용 방지를 위해 자동 재생성하지 않습니다." } }).catch(() => undefined);
    }
    if (error instanceof ExplanationError) return reply({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return reply({ error: "요청 형식이 올바르지 않습니다." }, 400);
    if (["question", "cache", "identity", "claim"].includes(stage)) return reply({ error: "문항 또는 해설 저장 서버의 응답이 지연되었습니다. AI는 호출하지 않았습니다. 해설보기를 다시 눌러 주세요." }, 503);
    // No raw provider response, NAS secret or question text in logs/browser errors.
    return reply({ error: "해설을 안전하게 생성하지 못했습니다. 잠시 후 저장 상태만 다시 확인해 주세요." }, 503);
  }
}
