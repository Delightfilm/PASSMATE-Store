import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import sharp from "sharp";
import { createGateway, generateText } from "ai";
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const moduleFrom = (source) => import("data:text/javascript;base64," + Buffer.from(ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 })).toString("base64"));
const contract = await moduleFrom(read("../lib/ai-explanation-contract.ts"));
const { normalizeLiveChoices } = await moduleFrom(read("../lib/question-bank-choices.ts"));
assert.deepEqual(normalizeLiveChoices(["가", "나", "다", "라"]).map((item) => item.label), ["①", "②", "③", "④"]);
const { validateExplanation, explanationInput } = contract;
const question = { id: "a".repeat(20), certId: "kh", sourceHash: "source", stem: "테스트: 옳지 않은 것은?", choices: ["가", "나", "다", "라"].map((text, i) => ({ label: ["①", "②", "③", "④"][i], text })), answer: 0, images: [], explanation: "" };
const good = { correctAnswer: 0, summary: "등록 정답이 질문 조건에 맞는 원리를 설명합니다.", choiceReasons: ["질문 조건에 맞는 보기입니다.", "조건에 해당하지 않는 보기입니다.", "조건에 해당하지 않는 보기입니다.", "조건에 해당하지 않는 보기입니다."] };
const approved = { approved: true, solvedAnswer: 0, explanationAnswer: 0, feedback: "" };
const verification = { version: contract.VERIFICATION_VERSION, solvedAnswer: 0, explanationAnswer: 0 };
validateExplanation(good, 0);
for (const invalid of [{ ...good, correctAnswer: 2 }, { ...good, choiceReasons: [] }, { ...good, summary: "정답은 ③번입니다." }, { ...good, summary: "②가 정답입니다. 다른 문제를 봅시다." }, { ...good, summary: "<script>악성 내용</script>" }]) assert.throws(() => validateExplanation(invalid, 0));
assert.deepEqual(explanationInput(question), explanationInput({ ...question, selectedAnswer: 3, userId: "another-user" }));
assert.notDeepEqual(explanationInput(question), explanationInput({ ...question, stem: "관리자가 수정한 문항" }));
assert.notDeepEqual(explanationInput(question), explanationInput({ ...question, answer: 1 }));

globalThis.explanationContract = contract;
globalThis.testSharp = sharp;
const calls = [];
let outputs = [];
globalThis.testGenerateText = async (options) => {
  calls.push(options); assert.equal(options.maxRetries, 0); assert.equal(options.reasoning, "none");
  assert.deepEqual(options.providerOptions.gateway.models, [contract.EXPLANATION_MODEL]);
  assert.equal(options.model, contract.EXPLANATION_MODEL);
  return { output: outputs.shift(), usage: { inputTokens: 100, outputTokens: 100 } };
};
const serverSource = read("../lib/ai-explanation-server.ts")
  .replace(/import \{ createClient \} from "@supabase\/supabase-js";/, "const createClient = () => ({ auth: { getUser: async () => globalThis.testAuthUser } });")
  .replace(/import \{ generateText, gateway, jsonSchema, Output, type UserContent \} from "ai";/,
    "const generateText = globalThis.testGenerateText; const gateway = (id) => id; const jsonSchema = (s) => s; const Output = { object: (s) => s };")
  .replace('import sharp from "sharp";', 'const sharp = globalThis.testSharp;')
  .replace(/import \{ getPublicSupabaseConfig \}[^;]+;/, 'const getPublicSupabaseConfig = () => ({});')
  .replace(/import \{ loadContentCatalog, loadContentBundle \}[^;]+;/, 'const loadContentCatalog = () => {}; const loadContentBundle = () => {};')
  .replace(/import \{ normalizeLiveChoices \}[^;]+;/, 'const normalizeLiveChoices = (value) => value;')
  .replace(/import \{ EXPLANATION_MODEL,[^;]+;/, 'const { EXPLANATION_MODEL, VERIFICATION_VERSION, REPAIR_VERSION, explanationInput, validateExplanation } = globalThis.explanationContract;');
const server = await moduleFrom(serverSource);
process.env.PASSMATE_AI_CACHE_TOKEN = "test-only-cache-token-not-a-secret";
process.env.PASSMATE_AI_CACHE_URL = "https://content.mypassmate.com/ai-cache";
const guestRequest = (headers = {}) => new Request("https://www.mypassmate.com/api/cbt/explanations/", { headers });
const guestIdentity = await server.generationIdentity(guestRequest());
assert.match(guestIdentity.userHash, /^[a-f0-9]{64}$/);
assert.ok(guestIdentity.cookie.includes("HttpOnly; SameSite=Lax; Secure"));
assert.ok(!guestIdentity.cookie.includes(process.env.PASSMATE_AI_CACHE_TOKEN));
const guestCookie = guestIdentity.cookie.split(";")[0];
assert.deepEqual(await server.generationIdentity(guestRequest({ cookie: guestCookie })), { userHash: guestIdentity.userHash });
assert.notEqual((await server.generationIdentity(guestRequest())).userHash, guestIdentity.userHash);
assert.notEqual((await server.generationIdentity(guestRequest({ cookie: guestCookie.slice(0, -1) + (guestCookie.endsWith("0") ? "1" : "0") }))).userHash, guestIdentity.userHash);
assert.ok((await server.generationIdentity(guestRequest({ cookie: "passmate_ai_guest=bad" }))).cookie);
globalThis.testAuthUser = { data: { user: { id: "fixture-user" } }, error: null };
assert.equal((await server.generationIdentity(guestRequest({ authorization: "Bearer fixture-token" }))).cookie, undefined);
assert.equal((await server.generationIdentity(guestRequest({ authorization: "Bearer fixture-token" }))).userHash,
  await server.authenticatedUser(guestRequest({ authorization: "Bearer fixture-token" })));
globalThis.testAuthUser = { data: { user: null }, error: new Error("invalid") };
await assert.rejects(server.generationIdentity(guestRequest({ authorization: "Bearer invalid" })), /로그인/);

const device = await moduleFrom(read("../lib/ai-explanation-device.ts"));
const deviceData = new Map();
const deviceStorage = { getItem: (key) => deviceData.get(key) ?? null, setItem: (key, value) => deviceData.set(key, value) };
assert.equal(device.deviceGenerationCount(deviceStorage), 0);
for (const result of [{ status: "ready", cached: true }, { status: "generating", cached: false }, { status: "refused", cached: false }, { status: "failed", cached: false }]) {
  assert.equal(device.recordDeviceGeneration(deviceStorage, "a".repeat(64), result), 0);
}
for (let i = 1; i <= 10; i++) {
  const revision = i.toString(16).padStart(64, "0");
  assert.equal(device.recordDeviceGeneration(deviceStorage, revision, { status: "ready", cached: false }), i);
  assert.equal(device.recordDeviceGeneration(deviceStorage, revision, { status: "ready", cached: false }), i);
  assert.equal(device.deviceGenerationCount(deviceStorage) >= device.AI_SIGNUP_THRESHOLD, i >= 10);
}
// Reload/module remount uses the persisted keys, not component state.
const reloadedDevice = await moduleFrom(read("../lib/ai-explanation-device.ts") + "\n// reloaded browser fixture");
assert.equal(reloadedDevice.deviceGenerationCount(deviceStorage), 10);
assert.equal(device.recordDeviceGeneration(deviceStorage, "f".repeat(64), { status: "ready", cached: false }), 10);
outputs = [{ ...good, supported: true, imagesReadable: true }, approved];
assert.equal((await server.generateExplanation(question, [])).status, "ready"); assert.equal(calls.length, 2);
assert.ok(calls[0].system.includes("옳지 않은 것")); assert.ok(calls[1].system.includes("거짓 원리"));
const blindInput = JSON.parse(calls[1].messages[0].content[0].text);
assert.ok(!("answer" in blindInput.question)); assert.ok(!("correctAnswer" in blindInput.proposedExplanation));
assert.deepEqual(calls[1].output.schema.properties.solvedAnswer.enum, [-1, 0, 1, 2, 3]);
outputs = [{ ...good, supported: false, imagesReadable: true }, { ...good, supported: false, imagesReadable: true }];
assert.equal((await server.generateExplanation(question, [])).status, "refused"); assert.equal(calls.length, 4);
outputs = [{ ...good, supported: true, imagesReadable: false }];
assert.equal((await server.generateExplanation(question, [])).status, "refused"); assert.equal(calls.length, 5);
const rejected = { ...approved, approved: false, feedback: "부정형 질문의 조건과 보기별 이유가 모순됩니다." };
outputs = [{ ...good, supported: true, imagesReadable: true }, rejected, { ...good, supported: true, imagesReadable: true }, rejected];
assert.equal((await server.generateExplanation(question, [])).status, "refused");
for (const mismatch of [{ ...approved, solvedAnswer: 2 }, { ...approved, explanationAnswer: 2 }, { ...approved, explanationAnswer: -1 }]) {
  outputs = [{ ...good, supported: true, imagesReadable: true }, mismatch, { ...good, supported: true, imagesReadable: true }, mismatch];
  assert.equal((await server.generateExplanation(question, [])).status, "refused");
}
outputs = [{ ...good, supported: true, imagesReadable: true, correctAnswer: 2 }, { ...good, supported: true, imagesReadable: true, correctAnswer: 2 }];
assert.equal((await server.generateExplanation(question, [])).status, "refused");
const beforeRepair = calls.length;
outputs = [{ ...good, supported: true, imagesReadable: true }, rejected, { ...good, supported: true, imagesReadable: true }, approved];
const repairedResult = await server.generateExplanation(question, []);
assert.equal(repairedResult.status, "ready"); assert.equal(repairedResult.rounds, 2);
assert.equal(repairedResult.repairVersion, contract.REPAIR_VERSION);
assert.deepEqual(repairedResult.usage, { inputTokens: 400, outputTokens: 400 });
assert.equal(calls.length - beforeRepair, 4);
assert.ok(calls[beforeRepair + 2].messages[0].content[0].text.includes(rejected.feedback));
const secondBlindInput = JSON.parse(calls[beforeRepair + 3].messages[0].content[0].text);
assert.ok(!("answer" in secondBlindInput.question)); assert.ok(!("correctAnswer" in secondBlindInput.proposedExplanation));
assert.ok(!JSON.stringify(secondBlindInput).includes(rejected.feedback));
outputs = [{ ...good, supported: false, imagesReadable: true }, { ...good, supported: true, imagesReadable: true }, approved];
assert.equal((await server.generateExplanation(question, [])).status, "ready");
const beforeProviderFailure = calls.length;
outputs = [{ ...good, supported: true, imagesReadable: true }, undefined];
await assert.rejects(server.generateExplanation(question, []));
assert.equal(calls.length - beforeProviderFailure, 2); // No paid transport retries.
const fetchOriginal = globalThis.fetch;
// NAS committed a claim, but its first HTTP response was lost. Retry only
// the identical lease-bearing request; this is separate from paid generation.
let claimRequests = 0; let claimBody;
globalThis.fetch = async (_url, init) => {
  claimRequests++;
  if (!claimBody) claimBody = init.body;
  assert.equal(init.body, claimBody);
  if (claimRequests === 1) throw new DOMException("transport timeout", "TimeoutError");
  return Response.json({ status: "claimed", lease: JSON.parse(init.body).lease });
};
try {
  const lease = "e".repeat(64);
  assert.deepEqual(await server.cacheRequest("a".repeat(64), "claim", { userHash: "b".repeat(64), lease }), { status: "claimed", lease });
  assert.equal(claimRequests, 2);
} finally { globalThis.fetch = fetchOriginal; }
const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
globalThis.fetch = async () => new Response(gif);
try {
  const images = await server.imageParts({ ...question, images: ["https://content.mypassmate.com/images/aa/" + "a".repeat(64) + ".gif"] });
  assert.equal(images[0].type, "file"); assert.equal(images[0].mediaType, "image/png"); assert.equal(typeof images[0].data, "string");
  assert.equal((await sharp(Buffer.from(images[0].data, "base64")).metadata()).format, "png");
  assert.equal((await server.imageParts({ ...question, images: ["https://img.comcbt.com/cbt/data/hp/hp20160124/hp20160124m1.gif"] }))[0].mediaType, "image/png");
  outputs = [{ ...good, supported: true, imagesReadable: true }, approved];
  await server.generateExplanation(question, images);
  assert.equal(calls.at(-1).messages[0].content[1].mediaType, "image/png");
  // Exercise the real installed SDK's PNG encoding, but intercept transport:
  // this is not a paid/provider call and needs no credentials.
  let transported = 0;
  const mockGateway = createGateway({ apiKey: "test-only-not-a-credential", fetch: async (_url, init) => {
    transported++;
    const payload = JSON.parse(init.body);
    const part = payload.prompt[0].content[1];
    assert.equal(part.type, "file"); assert.equal(part.mediaType, "image/png");
    assert.equal(part.data.type, "data");
    assert.equal((await sharp(Buffer.from(part.data.data, "base64")).metadata()).format, "png");
    return new Response(JSON.stringify({ error: { type: "invalid_request_error", message: "test_transport_complete" } }), { status: 400, headers: { "Content-Type": "application/json" } });
  } });
  await assert.rejects(generateText({ model: mockGateway(contract.EXPLANATION_MODEL), maxRetries: 0,
    messages: [{ role: "user", content: [{ type: "text", text: "transport fixture" }, ...images] }] }), /test_transport_complete/);
  assert.equal(transported, 1);
  await assert.rejects(server.imageParts({ ...question, images: ["http://192.168.0.48/private.png"] }), /안전/);
  await assert.rejects(server.imageParts({ ...question, images: ["https://content.mypassmate.com/images/aa/" + "a".repeat(64) + ".gif?secret=yes"] }), /안전/);
  globalThis.fetch = async () => new Response("missing", { status: 404 });
  await assert.rejects(server.imageParts({ ...question, images: ["https://content.mypassmate.com/images/aa/" + "a".repeat(64) + ".gif"] }), /이미지/);
} finally { globalThis.fetch = fetchOriginal; }

// Route-level dependency injection: all model/network writes are mocks.
let cacheState = { status: "missing" }; let billed = 0; let identities = 0; let limitClaims = false;
globalThis.routeDependencies = { ...server, cacheConfig: () => ({}), trustedQuestion: async () => question,
  generationIdentity: async (request) => { identities++; return server.generationIdentity(request); }, imageParts: async () => [],
  cacheRequest: async (_key, action, body) => {
    if (action === "claim") { if (limitClaims) return { status: "limited" }; if (cacheState.status !== "missing" && !(cacheState.status === "failed" && cacheState.retryable)) return cacheState; cacheState = { status: "generating" }; return { status: "claimed", lease: body.lease }; }
    if (action === "finish") { cacheState = body.payload; return { ok: true }; }
    return cacheState;
  }, generateExplanation: async () => { billed++; await new Promise((resolve) => setTimeout(resolve, 10)); return { status: "ready", explanation: good, verification }; },
};
const route = await moduleFrom(read("../app/api/cbt/explanations/route.ts")
  .replace(/import \{ generationIdentity,[^;]+;/, 'const { generationIdentity, cacheConfig, cacheRequest, ExplanationError, fingerprint, generateExplanation, imageParts, trustedQuestion } = globalThis.routeDependencies;')
  .replace(/import \{ validateExplanation,[^;]+;/, 'const { validateExplanation, hasAnswerVerification, REPAIR_VERSION } = globalThis.explanationContract;'));
const request = (readOnly = false, extra = {}, headers = {}) => new Request("https://www.mypassmate.com/api/cbt/explanations/", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ questionId: question.id, qualificationCode: "kh", revision: server.fingerprint(question), readOnly, ...extra }) });
const responses = await Promise.all(Array.from({ length: 12 }, () => route.POST(request())));
assert.ok(responses.every((response) => response.status === 200)); assert.equal(billed, 1);
assert.ok(responses.some((response) => response.headers.get("set-cookie")?.includes("passmate_ai_guest=")));
const identitiesBeforeCacheRead = identities;
assert.equal((await (await route.POST(request())).json()).cached, true); assert.equal(billed, 1);
assert.equal(identities, identitiesBeforeCacheRead);
for (const legacy of [{ status: "ready", explanation: good }, { status: "ready", explanation: good, verification: { ...verification, explanationAnswer: 2 } }]) {
  cacheState = legacy;
  assert.equal((await (await route.POST(request())).json()).status, "refused");
  assert.equal(billed, 1); assert.equal(cacheState, legacy);
}
cacheState = { status: "missing" };
assert.equal((await (await route.POST(request(true))).json()).status, "missing"); assert.equal(billed, 1);
assert.equal((await route.POST(request(false, { revision: "d".repeat(64) }))).status, 409);
assert.equal((await route.POST(new Request("https://example.test/", { method: "POST", headers: { "Content-Type": "application/json" }, body: "null" }))).status, 400);
assert.equal((await route.POST(request(false, {}, { Origin: "https://evil.example" }))).status, 403);
assert.equal((await route.POST(request(false, {}, { "Sec-Fetch-Site": "cross-site" }))).status, 403);
assert.equal((await route.POST(request(false, {}, { "Content-Type": "text/plain" }))).status, 415);
assert.equal(billed, 1);
limitClaims = true;
const limitedResponse = await route.POST(request());
assert.equal(limitedResponse.status, 429);
assert.ok(limitedResponse.headers.get("set-cookie")?.includes("passmate_ai_guest="));
assert.equal(billed, 1); limitClaims = false;
cacheState = { status: "failed", message: "재생성 금지" };
await route.POST(request()); assert.equal(billed, 1);
cacheState = { status: "missing" };
const diagnostics = []; const consoleError = console.error;
const generateOriginal = globalThis.routeDependencies.generateExplanation;
// The injected binding is captured on import, so create a fresh route module.
globalThis.routeDependencies.generateExplanation = async () => { throw Object.assign(new Error("SECRET_PROVIDER_RESPONSE"), { name: "GatewayInvalidRequestError", statusCode: 400 }); };
const failingRoute = await moduleFrom(read("../app/api/cbt/explanations/route.ts")
  .replace(/import \{ generationIdentity,[^;]+;/, 'const { generationIdentity, cacheConfig, cacheRequest, ExplanationError, fingerprint, generateExplanation, imageParts, trustedQuestion } = globalThis.routeDependencies;')
  .replace(/import \{ validateExplanation,[^;]+;/, 'const { validateExplanation, hasAnswerVerification, REPAIR_VERSION } = globalThis.explanationContract;') + "\n// diagnostic fixture");
try {
  console.error = (...args) => diagnostics.push(args);
  assert.equal((await failingRoute.POST(request())).status, 503);
  assert.equal(cacheState.status, "failed");
  assert.deepEqual(diagnostics, [["ai_explanation_failed", { stage: "generation", kind: "GatewayInvalidRequestError", status: 400, reason: undefined }]]);
  assert.ok(!JSON.stringify(diagnostics).includes("SECRET_PROVIDER_RESPONSE"));
} finally { console.error = consoleError; globalThis.routeDependencies.generateExplanation = generateOriginal; }
const cacheRequestOriginal = globalThis.routeDependencies.cacheRequest;
let loseClaim = true;
globalThis.routeDependencies.cacheRequest = async (key, action, body) => {
  if (action === "claim" && loseClaim) {
    loseClaim = false;
    await cacheRequestOriginal(key, action, body);
    throw new DOMException("transport timeout", "TimeoutError");
  }
  return cacheRequestOriginal(key, action, body);
};
const recoveryRoute = await moduleFrom(read("../app/api/cbt/explanations/route.ts")
  .replace(/import \{ generationIdentity,[^;]+;/, 'const { generationIdentity, cacheConfig, cacheRequest, ExplanationError, fingerprint, generateExplanation, imageParts, trustedQuestion } = globalThis.routeDependencies;')
  .replace(/import \{ validateExplanation,[^;]+;/, 'const { validateExplanation, hasAnswerVerification, REPAIR_VERSION } = globalThis.explanationContract;') + "\n// recovery fixture");
cacheState = { status: "missing" };
const billedBeforeRecovery = billed;
try {
  console.error = () => {};
  const failed = await recoveryRoute.POST(request());
  assert.equal(failed.status, 503);
  assert.match((await failed.json()).error, /AI는 호출하지 않았습니다/);
  assert.equal(cacheState.retryable, true);
  assert.equal(billed, billedBeforeRecovery);
  assert.equal((await (await recoveryRoute.POST(request(true))).json()).retryable, true);
  assert.equal(billed, billedBeforeRecovery);
  assert.equal((await (await recoveryRoute.POST(request())).json()).status, "ready");
  assert.equal(billed, billedBeforeRecovery + 1);
} finally { console.error = consoleError; globalThis.routeDependencies.cacheRequest = cacheRequestOriginal; }
// Old paid refusals remain immutable; one separate, durable upgrade job is
// shared by all callers. Polls never start it and refusal never opens a loop.
const originalKey = server.fingerprint(question);
const oldRefusal = { status: "refused", message: "old refusal", usage: { inputTokens: 100 } };
const jobs = new Map([[originalKey, oldRefusal]]);
globalThis.routeDependencies.cacheRequest = async (key, action, body) => {
  const current = jobs.get(key) || { status: "missing" };
  if (action === "claim") {
    if (current.status !== "missing") return current;
    jobs.set(key, { status: "generating" }); return { status: "claimed", lease: body.lease };
  }
  if (action === "finish") { jobs.set(key, body.payload); return { ok: true }; }
  return current;
};
globalThis.routeDependencies.generateExplanation = async () => {
  billed++; await new Promise((resolve) => setTimeout(resolve, 10));
  return { status: "refused", repairVersion: contract.REPAIR_VERSION, rounds: 2 };
};
const upgradeRoute = await moduleFrom(read("../app/api/cbt/explanations/route.ts")
  .replace(/import \{ generationIdentity,[^;]+;/, 'const { generationIdentity, cacheConfig, cacheRequest, ExplanationError, fingerprint, generateExplanation, imageParts, trustedQuestion } = globalThis.routeDependencies;')
  .replace(/import \{ validateExplanation,[^;]+;/, 'const { validateExplanation, hasAnswerVerification, REPAIR_VERSION } = globalThis.explanationContract;') + "\n// refusal upgrade fixture");
try {
  const before = billed;
  assert.equal((await (await upgradeRoute.POST(request(true))).json()).retryable, true);
  assert.equal(billed, before); assert.equal(jobs.size, 1);
  await Promise.all(Array.from({ length: 12 }, () => upgradeRoute.POST(request())));
  assert.equal(billed, before + 1); assert.equal(jobs.size, 2); assert.equal(jobs.get(originalKey), oldRefusal);
  for (const readOnly of [true, false, false]) {
    const result = await (await upgradeRoute.POST(request(readOnly))).json();
    assert.equal(result.status, "refused"); assert.equal(result.retryable, undefined);
  }
  assert.equal(billed, before + 1);
  // New-pipeline refusals use the original key and have no upgrade eligibility.
  jobs.clear(); jobs.set(originalKey, { status: "refused", repairVersion: contract.REPAIR_VERSION });
  await upgradeRoute.POST(request()); assert.equal(jobs.size, 1); assert.equal(billed, before + 1);
} finally {
  globalThis.routeDependencies.cacheRequest = cacheRequestOriginal;
  globalThis.routeDependencies.generateExplanation = generateOriginal;
}
const component = read("../components/ai-question-explanation.tsx");
const notice = "AI가 생성한 해설로, 부정확한 내용이 포함될 수 있습니다.";
assert.equal(component.split(notice).length - 1, 1);
assert.ok(component.indexOf(notice) < component.indexOf('{!explanation &&'));
assert.ok(!component.includes("관리자 검수 전"));
assert.ok(component.includes('onClick={showExplanation}')); assert.ok(component.includes('readOnly = true'));
assert.ok(!component.includes('dangerouslySetInnerHTML')); assert.ok(!component.includes('AI_GATEWAY_API_KEY'));
assert.ok(component.includes('createdCount >= AI_SIGNUP_THRESHOLD'));
assert.ok(component.includes('guest &&'));
assert.ok(component.includes('/account/signup/?next='));
assert.ok(component.includes('가입하지 않아도 해설은 계속 이용할 수 있습니다.'));
const api = read("../app/api/cbt/explanations/route.ts");
assert.ok(api.indexOf('"claim", { userHash, lease: requestedLease }') < api.indexOf('await generateExplanation'));
console.log("AI explanations OK: bounded feedback repair, blind recheck, no false-answer bypass, one durable refusal upgrade, concurrent/read-only no rebilling, image safety, guest quota and signup");
