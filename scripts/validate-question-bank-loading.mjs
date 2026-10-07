import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const urlFor = (source) => "data:text/javascript;base64," + Buffer.from(ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 })).toString("base64");
const downloadUrl = urlFor(read("../lib/question-bank-download.ts"));
const { readContentJson, createContentRequest, watchContentRequest } = await import(downloadUrl);

const { loadingDisplayName, loadingMessages, startLoadingMessages, SLOW_LOADING_MESSAGE, LOADING_MESSAGE_INTERVAL_MS, LOADING_MESSAGE_FADE_MS, LOADING_SHOW_DELAY_MS, LOADING_SLOW_DELAY_MS } = await import(urlFor(read("../lib/question-bank-loading.ts")));
assert.equal(LOADING_MESSAGE_INTERVAL_MS, 5_000);
assert.equal(loadingDisplayName(), "수험자");
assert.equal(loadingDisplayName(undefined, { email: "private@example.test", phone: "010-1234-5678" }), "수험자");
assert.equal(loadingDisplayName("프로필 이름", { display_name: "메타 이름" }), "프로필 이름");
assert.equal(loadingDisplayName(" ", { nickname: "별명" }), "별명");
assert.equal(loadingDisplayName("private@example.test"), "수험자");
assert.equal(loadingDisplayName("+82 (10) 1234-5678"), "수험자");
assert.equal(loadingDisplayName("가나다라마바사아자차카타파하거너"), "가나다라마바사아자차…");
assert.equal(loadingDisplayName("😀".repeat(15)), "😀".repeat(10) + "…");
assert.equal(loadingDisplayName("가나다라마바사아자차"), "가나다라마바사아자차");
const taggedName = loadingDisplayName("<b>민수</b>");
const markup = renderToStaticMarkup(React.createElement("p", null, loadingMessages(taggedName)[0]));
assert.ok(markup.includes("&lt;b&gt;민수&lt;/b&gt;"), "names are plain escaped React text");
assert.ok(!markup.includes("<b>"), "tags cannot become DOM markup");
assert.equal(loadingMessages("수험자")[0], "수험자님의 시험지를 준비하고 있어요");
assert.equal(loadingMessages("별명").length, 7);

function fakeTimers() {
  let now = 0, sequence = 0;
  const jobs = new Map();
  const add = (callback, delay, interval = 0) => { const id = ++sequence; jobs.set(id, { id, callback, at: now + delay, interval }); return id; };
  return {
    setTimeout: (callback, delay) => add(callback, delay),
    clearTimeout: (id) => jobs.delete(id),
    setInterval: (callback, delay) => add(callback, delay, delay),
    clearInterval: (id) => jobs.delete(id),
    get count() { return jobs.size; },
    advance(ms) {
      const target = now + ms;
      while (true) {
        const job = [...jobs.values()].filter((job) => job.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!job) break;
        now = job.at;
        if (job.interval) job.at += job.interval; else jobs.delete(job.id);
        job.callback();
      }
      now = target;
    },
  };
}
let name = "첫 이름";
const timers = fakeTimers(), seen = [], announcements = [], fades = [];
const callbacks = {
  getName: () => name,
  onShow: (message) => { seen.push(message); announcements.push(message); },
  onMessage: (message) => seen.push(message),
  onFadeOut: () => fades.push(seen.at(-1)),
  onSlow: (message) => { seen.push(message); announcements.push(message); },
};
const dispose = startLoadingMessages(callbacks, timers);
timers.advance(LOADING_SHOW_DELAY_MS - 1); assert.equal(seen.length, 0, "do not flash below 300ms");
name = "등장 이름"; timers.advance(1); assert.equal(seen[0], loadingMessages(name)[0]);
name = "뒤늦은 이름";
timers.advance(LOADING_MESSAGE_INTERVAL_MS - LOADING_MESSAGE_FADE_MS - 1);
assert.equal(fades.length, 0);
timers.advance(1); assert.equal(fades.length, 1, "fade out before replacing text");
timers.advance(LOADING_MESSAGE_FADE_MS - 1); assert.equal(seen.length, 1);
timers.advance(1); assert.equal(seen[1], loadingMessages("등장 이름")[1], "replace at the shared interval boundary");
timers.advance(LOADING_MESSAGE_INTERVAL_MS); assert.equal(seen[2], loadingMessages("등장 이름")[2]);
assert.equal(announcements.length, 1, "rotating text does not announce");
timers.advance(LOADING_SLOW_DELAY_MS - LOADING_SHOW_DELAY_MS - LOADING_MESSAGE_INTERVAL_MS * 2 - 1); assert.notEqual(seen.at(-1), SLOW_LOADING_MESSAGE);
timers.advance(1); assert.equal(seen.at(-1), SLOW_LOADING_MESSAGE);
assert.equal(announcements.length, 2, "announce only initial and 15-second warning");
assert.equal(fades.length, 2, "the pending next rotation must not fade before the 15-second notice");
assert.equal(seen.length, 4, "only first three messages, then the fixed notice");
const stoppedLength = seen.length; timers.advance(20000); assert.equal(seen.length, stoppedLength);
dispose(); assert.equal(timers.count, 0, "all timers are cleaned up");
const interrupted = fakeTimers();
const stopInterrupted = startLoadingMessages(callbacks, interrupted);
interrupted.advance(LOADING_SHOW_DELAY_MS + LOADING_MESSAGE_INTERVAL_MS - LOADING_MESSAGE_FADE_MS);
stopInterrupted(); assert.equal(interrupted.count, 0, "dispose cleans up during a fade");
const restarted = fakeTimers(), restartMessages = [];
const stopRestart = startLoadingMessages({ ...callbacks, onShow: (message) => restartMessages.push(message) }, restarted);
restarted.advance(LOADING_SHOW_DELAY_MS); assert.equal(restartMessages[0], loadingMessages(name)[0], "retry starts at first message");
stopRestart();

const quick = fakeTimers(), quickSeen = [];
const quickDispose = startLoadingMessages({ ...callbacks, onShow: (message) => quickSeen.push(message) }, quick);
quick.advance(200); quickDispose(); quick.advance(20000);
assert.equal(quickSeen.length, 0, "cache hits never display");
assert.equal(quick.count, 0);
const remount = fakeTimers();
const firstMount = startLoadingMessages(callbacks, remount); firstMount();
const secondMount = startLoadingMessages(callbacks, remount);
assert.equal(remount.count, 2, "Strict Mode remount must not double timers");
remount.advance(4000); secondMount(); assert.equal(remount.count, 0);

const object = { text: "한글 · 숫자 2027".repeat(1000) };
const bytes = new TextEncoder().encode(JSON.stringify(object));
let position = 0;
const stream = new ReadableStream({ pull(controller) {
  if (position >= bytes.length) { controller.close(); return; }
  const end = Math.min(position + 17, bytes.length);
  controller.enqueue(bytes.slice(position, end)); position = end;
} });
assert.deepEqual(await readContentJson(new Response(stream)), object, "UTF-8 split boundaries must not corrupt JSON");
assert.deepEqual(await readContentJson(Response.json(object)), object);

const ac = new AbortController(); let cancelled = false;
const pending = readContentJson(new Response(new ReadableStream({ cancel() { cancelled = true; } })), { signal: ac.signal });
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
const groupUrl = urlFor(read("../lib/question-bank-groups.ts"));
const adapter = await import(urlFor(read("../lib/question-bank-content.ts").replace('from "./question-bank-download"', `from "${downloadUrl}"`).replace('from "./question-bank-groups"', `from "${groupUrl}"`)));
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
  await adapter.loadContentCatalog();
  assert.equal(requests, 1, "completed catalog cache makes no request");
  await adapter.loadContentBundle(loaded, "aa"); await adapter.loadContentBundle(loaded, "aa");
  assert.equal(requests, 2, "completed bundle cache makes no request");
  for (const code of ["bb", "cc", "dd", "ee"]) await adapter.loadContentBundle(loaded, code);
  await adapter.loadContentBundle(loaded, "aa"); assert.equal(requests, 7, "four-bundle bound still evicts LRU");
  clock += 60_001; await adapter.loadContentCatalog(); assert.equal(requests, 8, "catalog expires at 60 seconds");
  block = true; clock += 60_001;
  const abort = new AbortController(); const load = adapter.loadContentCatalog({ signal: abort.signal });
  abort.abort(); await assert.rejects(load, { name: "AbortError" });
  block = false; await adapter.loadContentCatalog(); assert.equal(aborted, 1, "aborted cache entry must not block retry");
} finally { globalThis.fetch = originalFetch; Date.now = originalNow; }
const correctionSource = read("../lib/question-bank-corrections.ts").replace('import { getSupabaseBrowserClient } from "./supabase-browser";', 'const getSupabaseBrowserClient = () => globalThis.loadingTestSupabase;').replace('from "./question-bank-choices"', `from "${urlFor(read("../lib/question-bank-choices.ts"))}"`).replace('from "../supabase/functions/question-bank-admin/question-review"', `from "${urlFor(read("../supabase/functions/question-bank-admin/question-review.ts"))}"`);
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
const component = read("../components/question-bank-loading.tsx");
const clientSource = read("../components/question-bank-client.tsx");
const clientAst = ts.createSourceFile("client.tsx", clientSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let profileBody;
function findProfileEffect(node) {
  if (ts.isCallExpression(node) && node.expression.getText(clientAst) === "useEffect") {
    const callback = node.arguments[0];
    if (callback && ts.isArrowFunction(callback) && callback.body.getText(clientAst).includes('.from("profiles")')) profileBody = callback.body.getText(clientAst).slice(1, -1);
  }
  ts.forEachChild(node, findProfileEffect);
}
findProfileEffect(clientAst);
assert.ok(profileBody && !profileBody.includes("await") && !profileBody.includes("setDataState") && !profileBody.includes("setDataset"), "profile lookup cannot block or fail the dataset pipeline");
const runProfileEffect = new Function("loadingUserId", "setLoadingProfile", "getSupabaseBrowserClient", "AbortController", ts.transpile(profileBody, { target: ts.ScriptTarget.ES2022 }));
let profileCalls = 0, finishProfile, profileValue;
const profileApi = () => ({
  from(table) {
    profileCalls++;
    assert.equal(table, "profiles");
    const query = {
      select(fields) { assert.equal(fields, "display_name"); return query; },
      eq(field, id) { assert.equal(field, "id"); assert.equal(id, "local-test-user"); return query; },
      abortSignal(signal) { assert.ok(signal instanceof AbortSignal); return query; },
      maybeSingle() { return new Promise((resolve, reject) => { finishProfile = { resolve, reject }; }); },
    };
    return query;
  },
});
runProfileEffect(undefined, (value) => { profileValue = value; }, profileApi, AbortController);
assert.equal(profileCalls, 0, "guests must send no profiles request");
const stopProfile = runProfileEffect("local-test-user", (value) => { profileValue = value; }, profileApi, AbortController);
assert.equal(typeof stopProfile, "function", "effect returns cleanup immediately, not a profile promise");
assert.equal(loadingDisplayName(profileValue?.name), "수험자", "pending profile does not delay guest fallback");
finishProfile.reject(new Error("local profile lookup failed"));
await new Promise((resolve) => setImmediate(resolve));
assert.equal(loadingDisplayName(profileValue?.name), "수험자", "lookup failure is ignored");
stopProfile();
const lateTimers = fakeTimers(), lateMessages = [];
const stopLateProfile = runProfileEffect("local-test-user", (value) => { profileValue = value; }, profileApi, AbortController);
const stopLateLoader = startLoadingMessages({
  getName: () => loadingDisplayName(profileValue?.name),
  onShow: (message) => lateMessages.push(message),
  onMessage: (message) => lateMessages.push(message),
  onSlow: (message) => lateMessages.push(message),
}, lateTimers);
lateTimers.advance(300);
assert.equal(lateMessages[0], "수험자님의 시험지를 준비하고 있어요");
finishProfile.resolve({ data: { display_name: "늦은 닉네임" } });
await new Promise((resolve) => setImmediate(resolve));
assert.equal(profileValue.name, "늦은 닉네임");
assert.equal(lateMessages[0], "수험자님의 시험지를 준비하고 있어요", "late profile cannot replace first message");
stopLateLoader(); stopLateProfile();
const css = read("../components/question-bank-loading.module.css");
assert.ok(component.includes('role="status"') && component.includes('aria-live="polite"') && component.includes('aria-busy="true"'));
assert.ok(component.includes('aria-hidden="true"'));
assert.equal((component.match(/setAnnouncement\(/g) || []).length, 2);
assert.ok(!component.includes("dangerouslySetInnerHTML") && !component.includes("progressbar"));
assert.ok(css.includes("prefers-reduced-motion: reduce") && css.includes("animation: none"));
assert.ok(css.includes("min-height: 48px") && css.includes("transition: opacity var(--message-fade-duration)") && css.includes("transition: none"));
assert.ok(component.includes("LOADING_MESSAGE_FADE_MS") && component.includes("--message-fade-duration"));
assert.ok(!component.includes("styles.helper") && !css.includes(".helper"));
assert.ok(!component.includes("key={message}"), "text transitions must not remount the spinner or paragraph");
console.log("CBT loading OK: 5s guidance, sequential fade/no helper, private name rules/freeze, 300ms/15s, accessible announcements, timer cleanup, UTF-8 streaming, abort/coalescing, cache hit/expiry/LRU/retry, fresh corrections");
