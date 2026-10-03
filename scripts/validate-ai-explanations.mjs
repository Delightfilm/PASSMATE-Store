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
  .replace(/import \{ createClient \} from "@supabase\/supabase-js";/, "const createClient = () => { throw new Error('not used'); };")
  .replace(/import \{ generateText, gateway, jsonSchema, Output, type UserContent \} from "ai";/,
    "const generateText = globalThis.testGenerateText; const gateway = (id) => id; const jsonSchema = (s) => s; const Output = { object: (s) => s };")
  .replace('import sharp from "sharp";', 'const sharp = globalThis.testSharp;')
  .replace(/import \{ getPublicSupabaseConfig \}[^;]+;/, 'const getPublicSupabaseConfig = () => ({});')
  .replace(/import \{ loadContentCatalog, loadContentBundle \}[^;]+;/, 'const loadContentCatalog = () => {}; const loadContentBundle = () => {};')
  .replace(/import \{ normalizeLiveChoices \}[^;]+;/, 'const normalizeLiveChoices = (value) => value;')
  .replace(/import \{ EXPLANATION_MODEL, explanationInput, validateExplanation,[^;]+;/, 'const { EXPLANATION_MODEL, explanationInput, validateExplanation } = globalThis.explanationContract;');
const server = await moduleFrom(serverSource);
outputs = [{ ...good, supported: true, imagesReadable: true }, { approved: true }];
assert.equal((await server.generateExplanation(question, [])).status, "ready"); assert.equal(calls.length, 2);
assert.ok(calls[0].system.includes("옳지 않은 것")); assert.ok(calls[1].system.includes("거짓 원리"));
outputs = [{ ...good, supported: false, imagesReadable: true }];
assert.equal((await server.generateExplanation(question, [])).status, "refused"); assert.equal(calls.length, 3);
outputs = [{ ...good, supported: true, imagesReadable: false }];
assert.equal((await server.generateExplanation(question, [])).status, "refused"); assert.equal(calls.length, 4);
outputs = [{ ...good, supported: true, imagesReadable: true }, { approved: false }];
assert.equal((await server.generateExplanation(question, [])).status, "refused");
outputs = [{ ...good, supported: true, imagesReadable: true, correctAnswer: 2 }];
await assert.rejects(server.generateExplanation(question, []), /invalid/);
const fetchOriginal = globalThis.fetch;
const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
globalThis.fetch = async () => new Response(gif);
try {
  const images = await server.imageParts({ ...question, images: ["https://content.mypassmate.com/images/aa/" + "a".repeat(64) + ".gif"] });
  assert.equal(images[0].type, "file"); assert.equal(images[0].mediaType, "image/png"); assert.equal((await sharp(images[0].data).metadata()).format, "png");
  assert.equal((await server.imageParts({ ...question, images: ["https://img.comcbt.com/cbt/data/hp/hp20160124/hp20160124m1.gif"] }))[0].mediaType, "image/png");
  outputs = [{ ...good, supported: true, imagesReadable: true }, { approved: true }];
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
let cacheState = { status: "missing" }; let billed = 0; let authenticated = 0;
globalThis.routeDependencies = { ...server, cacheConfig: () => ({}), trustedQuestion: async () => question,
  authenticatedUser: async () => { authenticated++; return "b".repeat(64); }, imageParts: async () => [],
  cacheRequest: async (_key, action, body) => {
    if (action === "claim") { if (cacheState.status !== "missing") return cacheState; cacheState = { status: "generating" }; return { status: "claimed", lease: "c".repeat(64) }; }
    if (action === "finish") { cacheState = body.payload; return { ok: true }; }
    return cacheState;
  }, generateExplanation: async () => { billed++; await new Promise((resolve) => setTimeout(resolve, 10)); return { status: "ready", explanation: good }; },
};
const route = await moduleFrom(read("../app/api/cbt/explanations/route.ts")
  .replace(/import \{ authenticatedUser,[^;]+;/, 'const { authenticatedUser, cacheConfig, cacheRequest, ExplanationError, fingerprint, generateExplanation, imageParts, trustedQuestion } = globalThis.routeDependencies;')
  .replace(/import \{ validateExplanation,[^;]+;/, 'const { validateExplanation } = globalThis.explanationContract;'));
const request = (readOnly = false, extra = {}) => new Request("https://www.mypassmate.com/api/cbt/explanations/", { method: "POST", body: JSON.stringify({ questionId: question.id, qualificationCode: "kh", revision: server.fingerprint(question), readOnly, ...extra }) });
const responses = await Promise.all(Array.from({ length: 12 }, () => route.POST(request())));
assert.ok(responses.every((response) => response.status === 200)); assert.equal(billed, 1);
assert.equal((await (await route.POST(request())).json()).cached, true); assert.equal(billed, 1);
cacheState = { status: "missing" };
assert.equal((await (await route.POST(request(true))).json()).status, "missing"); assert.equal(billed, 1);
assert.equal((await route.POST(request(false, { revision: "d".repeat(64) }))).status, 409);
assert.equal((await route.POST(new Request("https://example.test/", { method: "POST", body: "null" }))).status, 400);
cacheState = { status: "failed", message: "재생성 금지" };
await route.POST(request()); assert.equal(billed, 1);
cacheState = { status: "missing" };
const diagnostics = []; const consoleError = console.error;
const generateOriginal = globalThis.routeDependencies.generateExplanation;
// The injected binding is captured on import, so create a fresh route module.
globalThis.routeDependencies.generateExplanation = async () => { throw Object.assign(new Error("SECRET_PROVIDER_RESPONSE"), { name: "GatewayInvalidRequestError", statusCode: 400 }); };
const failingRoute = await moduleFrom(read("../app/api/cbt/explanations/route.ts")
  .replace(/import \{ authenticatedUser,[^;]+;/, 'const { authenticatedUser, cacheConfig, cacheRequest, ExplanationError, fingerprint, generateExplanation, imageParts, trustedQuestion } = globalThis.routeDependencies;')
  .replace(/import \{ validateExplanation,[^;]+;/, 'const { validateExplanation } = globalThis.explanationContract;') + "\n// diagnostic fixture");
try {
  console.error = (...args) => diagnostics.push(args);
  assert.equal((await failingRoute.POST(request())).status, 503);
  assert.equal(cacheState.status, "failed");
  assert.deepEqual(diagnostics, [["ai_explanation_failed", { stage: "generation", kind: "GatewayInvalidRequestError", status: 400 }]]);
  assert.ok(!JSON.stringify(diagnostics).includes("SECRET_PROVIDER_RESPONSE"));
} finally { console.error = consoleError; globalThis.routeDependencies.generateExplanation = generateOriginal; }
const component = read("../components/ai-question-explanation.tsx");
assert.ok(component.includes('onClick={showExplanation}')); assert.ok(component.includes('readOnly = true'));
assert.ok(!component.includes('dangerouslySetInnerHTML')); assert.ok(!component.includes('AI_GATEWAY_API_KEY'));
const api = read("../app/api/cbt/explanations/route.ts");
assert.ok(api.indexOf('"claim", { userHash }') < api.indexOf('await generateExplanation'));
console.log("AI explanations OK: explicit click, immutable answer, correction-aware key, independent verifier, safe GIF/image input, cache hit/no billing, concurrent claim, read-only polls, failed-job no rebilling");
