import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const urlFor = (source) => "data:text/javascript;base64," + Buffer.from(ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 })).toString("base64");
const downloadUrl = urlFor(read("../lib/question-bank-download.ts"));
const { transferSize, createTransferMeter, readContentJson, createContentRequest, watchContentRequest } = await import(downloadUrl);

const plain = new Response("{}", { headers: { "Content-Length": "200" } });
const gzip = new Response("{}", { headers: { "Content-Length": "20", "Content-Encoding": "gzip" } });
assert.equal(transferSize(plain), 200);
assert.equal(transferSize(gzip), undefined, "encoded Content-Length must not be used");
assert.equal(transferSize(gzip, 200), 200, "original-byte metadata wins");
assert.equal(transferSize(gzip, -1), undefined);
assert.equal(transferSize(new Response("{}")), undefined);
const cors = new Response("{}", { headers: { "Content-Length": "20" } });
Object.defineProperty(cors, "type", { value: "cors" });
assert.equal(transferSize(cors), undefined, "CORS may hide an encoding header");
const identity = new Response("{}", { headers: { "Content-Length": "200", "Content-Encoding": "identity" } });
Object.defineProperty(identity, "type", { value: "cors" });
assert.equal(transferSize(identity), 200);

let time = 0;
const meter = createTransferMeter(10_000, () => time);
assert.equal(meter(100).etaSeconds, undefined);
time = 900; assert.equal(meter(1000).etaSeconds, undefined, "wait for 1 second of data");
time = 1000; const firstEta = meter(2000); assert.equal(firstEta.etaSeconds, 5, "exclude the first instantaneous chunk from throughput");
time = 2000; const secondEta = meter(3000); assert.ok(secondEta.etaSeconds > 0);
time = 2200; const backwards = meter(2500); assert.equal(backwards.loadedBytes, 3000); assert.equal(backwards.percent, 30);
time = 7000; assert.ok(meter(6000).etaSeconds > 0, "rolling window must retain a usable boundary sample");
time = 8000; assert.equal(meter(20_000).percent, 100);
assert.equal(meter(20_000, true).etaSeconds, undefined);
const underFive = createTransferMeter(100_000, () => time);
underFive(100); time += 2000; assert.equal(underFive(4000).etaSeconds, undefined);
const unknown = createTransferMeter(undefined, () => time);
assert.equal(unknown(500).percent, undefined); time += 2000; assert.equal(unknown(1000).etaSeconds, undefined);

const object = { text: "한글 · 숫자 2027".repeat(1000) };
const bytes = new TextEncoder().encode(JSON.stringify(object));
const updates = [];
let position = 0;
const stream = new ReadableStream({ async pull(controller) {
  if (position >= bytes.length) { controller.close(); return; }
  await new Promise((resolve) => setTimeout(resolve, 270));
  const end = Math.min(position + Math.ceil(bytes.length / 6), bytes.length);
  controller.enqueue(bytes.slice(position, end)); position = end;
} });
const decoded = await readContentJson(new Response(stream), "bundle", "test", { onProgress: (p) => updates.push(p) }, bytes.length);
assert.deepEqual(decoded, object, "UTF-8 boundaries must not corrupt JSON");
assert.equal(updates.at(-1).loadedBytes, bytes.length);
assert.equal(updates.at(-1).percent, 100);
assert.ok(updates.some((p) => p.etaSeconds !== undefined));
assert.ok(updates.every((p, i) => i === 0 || p.loadedBytes >= updates[i - 1].loadedBytes));
const noSize = [];
await readContentJson(Response.json(object), "catalog", "test", { onProgress: (p) => noSize.push(p) });
assert.ok(noSize.every((p) => p.percent === undefined && p.etaSeconds === undefined));
assert.equal(noSize.at(-1).loadedBytes, bytes.length);

const ac = new AbortController(); let cancelled = false;
const pending = readContentJson(new Response(new ReadableStream({ cancel() { cancelled = true; } })), "bundle", "test", { signal: ac.signal });
ac.abort(); await assert.rejects(pending, { name: "AbortError" }); assert.equal(cancelled, true);
let finish; const shared = createContentRequest(() => new Promise((resolve) => { finish = resolve; }));
const one = new AbortController(); const two = new AbortController();
const first = watchContentRequest(shared, { signal: one.signal }); const second = watchContentRequest(shared, { signal: two.signal });
one.abort(); await assert.rejects(first, { name: "AbortError" }); assert.equal(shared.controller.signal.aborted, false);
finish("ok"); assert.equal(await second, "ok");
const last = new AbortController();
const alone = createContentRequest(({ signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason))));
const watched = watchContentRequest(alone, { signal: last.signal }); last.abort();
await assert.rejects(watched, { name: "AbortError" }); assert.equal(alone.controller.signal.aborted, true);

process.env.NEXT_PUBLIC_QUESTION_BANK_CONTENT_URL = "https://content.example.test";
const adapter = await import(urlFor(read("../lib/question-bank-content.ts").replace('from "./question-bank-download"', `from "${downloadUrl}"`)));
const originalFetch = globalThis.fetch;
const originalNow = Date.now;
let clock = originalNow(); Date.now = () => clock;
let requests = 0; let block = false; let aborted = 0;
const catalog = { schemaVersion: "passmate.question-bank.catalog.v1", releaseId: "test", totals: { questions: 1 }, qualifications: ["aa", "bb", "cc", "dd", "ee"].map((code) => ({ code, title: code, bundle: `bundles/${code}.json.gz`, sha256: code, questions: 1, exams: 1 })) };
globalThis.fetch = async (url, init) => {
  requests++;
  if (block) return new Promise((_, reject) => init.signal.addEventListener("abort", () => { aborted++; reject(init.signal.reason); }));
  if (String(url).endsWith("catalog.json")) return Response.json(catalog);
  const code = String(url).match(/bundles\/(\w+)/)[1];
  return Response.json({ schemaVersion: "passmate.question-bank.bundle.v1", releaseId: "test", qualification: { code }, questions: [{ id: code, images: [] }], subjects: [], exams: [{}] });
};
try {
  const loaded = await adapter.loadContentCatalog();
  const hitUpdates = []; await adapter.loadContentCatalog({ onProgress: (p) => hitUpdates.push(p) });
  assert.equal(requests, 1); assert.equal(hitUpdates.length, 0, "completed catalog cache emits no progress");
  await adapter.loadContentBundle(loaded, "aa"); await adapter.loadContentBundle(loaded, "aa", { onProgress: (p) => hitUpdates.push(p) });
  assert.equal(requests, 2); assert.equal(hitUpdates.length, 0, "completed bundle cache emits no progress");
  for (const code of ["bb", "cc", "dd", "ee"]) await adapter.loadContentBundle(loaded, code);
  await adapter.loadContentBundle(loaded, "aa"); assert.equal(requests, 7, "four-bundle bound still evicts LRU");
  clock += 60_001; await adapter.loadContentCatalog(); assert.equal(requests, 8, "catalog expires at 60 seconds");
  block = true; clock += 60_001;
  const abort = new AbortController(); const load = adapter.loadContentCatalog({ signal: abort.signal });
  abort.abort(); await assert.rejects(load, { name: "AbortError" });
  block = false; await adapter.loadContentCatalog(); assert.equal(aborted, 1, "aborted cache entry must not block retry");
} finally { globalThis.fetch = originalFetch; Date.now = originalNow; }
const correctionSource = read("../lib/question-bank-corrections.ts").replace('import { getSupabaseBrowserClient } from "./supabase-browser";', 'const getSupabaseBrowserClient = () => globalThis.loadingTestSupabase;');
const { loadQuestionCorrections } = await import(urlFor(correctionSource));
let correctionReads = 0; let waitForAbort = false; let signalSeen;
globalThis.loadingTestSupabase = { from() {
  const query = { select() { return query; }, eq() { return query; }, order() { return query; }, range() { return query; }, abortSignal(signal) { signalSeen = signal; return query; }, then(resolve) {
    correctionReads++;
    if (waitForAbort) return new Promise((done) => signalSeen.addEventListener("abort", () => done({ data: null, error: {} }), { once: true })).then(resolve);
    return Promise.resolve({ data: [], error: null }).then(resolve);
  } };
  return query;
} };
try {
  const dataset = { questions: [{ id: "qa", certId: "qa" }] };
  await loadQuestionCorrections(dataset); await loadQuestionCorrections(dataset);
  assert.equal(correctionReads, 2, "corrections remain fresh on each dataset load");
  const correctionAbort = new AbortController(); waitForAbort = true;
  const request = loadQuestionCorrections(dataset, { signal: correctionAbort.signal });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(signalSeen, correctionAbort.signal);
  correctionAbort.abort(); await assert.rejects(request, { name: "AbortError" });
} finally { delete globalThis.loadingTestSupabase; }
console.log("CBT loading OK: exact decoded bytes, UTF-8, known/unknown sizes, compressed/CORS headers, gated smoothed ETA, monotonic progress, abort/coalescing, cache hit/expiry/LRU/retry");
