import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { Script } from "node:vm";
import { createHash } from "node:crypto";
import ts from "typescript";

function load(path, dependencies = {}) {
  const file = resolve(path), module = { exports: {} };
  const output = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Script(`(function(require,module,exports){${output}\n})`).runInThisContext()((name) => dependencies[name] || (name === "@/lib/question-bank-answers" ? load("lib/question-bank-answers.ts") : createRequire(file)(name)), module, module.exports);
  return module.exports;
}
const question = { id: "a".repeat(20), certId: "kh", stem: "Question", choices: [0,1,2,3].map((i) => ({ label: String(i + 1), text: `Choice ${i}` })), answer: 1, images: [], explanation: "", sourceHash: "source" };
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const stats = load("lib/cbt-question-stats.ts", { "./question-bank": { sourceHash: async (value) => hash(value) } });
assert.equal(stats.statsPresentation({ total: 0, correct: 0 }).rate, null);
assert.equal(stats.statsPresentation({ total: 2, correct: 1 }).tone, "good");
assert.equal(stats.statsPresentation({ total: 20, correct: 6 }).tone, "hard");
assert.equal(stats.statsPresentation({ total: 20, correct: 12 }).tone, "good");
for (const [correct, tone] of [[0,"hard"],[39,"hard"],[40,"careful"],[49,"careful"],[50,"good"],[69,"good"],[70,"high"],[100,"high"]]) {
  assert.equal(stats.statsPresentation({ total: 100, correct }).tone, tone, `Rate boundary ${correct}%`);
}
assert.equal(stats.statsPresentation({ total: 20, correct: 19 }).rate, 95);
assert.notEqual(hash(stats.questionStatsInput(question)), hash(stats.questionStatsInput({ ...question, answer: 2 })), "Corrections must isolate old answer statistics");
const state = load("lib/cbt-review-state.ts");
const attempt = { id: "attempt-test", answers: { [question.id]: 0 } };
const store = { attempts: [attempt], wrongNotes: {}, bookmarks: [] };
const preAnswerMemo = state.saveQuestionMemo({ ...store, attempts: [{ ...attempt, answers: {} }] }, question, "답을 고르기 전의 메모");
assert.deepEqual(preAnswerMemo.attempts[0].answers, {}, "A pre-answer memo must not select an answer");
assert.equal(preAnswerMemo.attempts[0].reviewedQuestionIds, undefined, "A pre-answer memo must not mark an ungraded question reviewed");
assert.equal(preAnswerMemo.wrongNotes[question.id].wrongCount, 0);
assert.equal(state.recordInstantReview(preAnswerMemo, preAnswerMemo.attempts[0], question, 0).wrongNotes[question.id].wrongCount, 1, "The first actual wrong answer still counts after a memo");
const reviewed = state.recordInstantReview(store, attempt, question, 0);
assert.equal(reviewed.wrongNotes[question.id].wrongCount, 1);
assert.equal(store.wrongNotes[question.id], undefined, "Do not mutate the previous store");
const withMemo = state.saveQuestionMemo(reviewed, question, "오답 원인");
assert.equal(withMemo.wrongNotes[question.id].memo, "오답 원인");
assert.equal(withMemo.questionCerts[question.id], "kh");
const correctMemo = state.saveQuestionMemo(state.recordInstantReview(store, attempt, question, question.answer), question, "맞힌 문제의 메모");
assert.equal(correctMemo.wrongNotes[question.id].wrongCount, 0, "A memo on a correct answer must not create a personal error");
assert.equal(state.saveQuestionMemo(correctMemo, question, "수정된 메모").wrongNotes[question.id].wrongCount, 0, "Editing a memo must preserve zero errors");
assert.equal(state.recordInstantReview(correctMemo, { ...attempt, reviewedQuestionIds: [] }, question, 0).wrongNotes[question.id].wrongCount, 1, "A later real error starts at one and retains the memo");
const oldAttemptMemo = state.saveQuestionMemo(state.recordInstantReview(store, attempt, question, 0), question, "Old attempt note");
assert.equal(oldAttemptMemo.attempts[0].reviewedQuestionIds.includes(question.id), true, "Saving an old instant attempt's memo marks its already-graded answer before finalization");
assert.equal(state.recordInstantReview(withMemo, withMemo.attempts[0], question, 0).wrongNotes[question.id].wrongCount, 1, "Do not count the same instant review twice");
assert.equal(state.recordInstantReview(withMemo, { ...attempt, reviewedQuestionIds: [] }, question, 0).wrongNotes[question.id].wrongCount, 2, "A new attempt can count as another personal error");
assert.throws(() => state.saveQuestionMemo(store, question, "x".repeat(2001)));

const cloudMemo = { question_ref: question.id, qualification_code: question.certId, wrong_count: 0, last_wrong_at: null, memo: "맞힌 문제의 계정 메모", bookmarked: false, mastered: false };
const accountBank = load("lib/question-bank.ts", {
  "./question-bank-groups": load("lib/question-bank-groups.ts"),
  "@/lib/supabase-browser": { getSupabaseBrowserClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: "test-member" } } } }) },
    from: (table) => ({ select: () => ({ eq: async () => ({ data: table === "question_bank_user_question_state" ? [cloudMemo] : [] }) }) }),
  }) },
  "./question-bank-choices": { normalizeLiveChoices: () => [] },
});
const pulledMemo = await accountBank.mergeAccountStore(store);
assert.equal(pulledMemo.wrongNotes[question.id].wrongCount, 0);
assert.equal(pulledMemo.wrongNotes[question.id].memo, cloudMemo.memo, "Cloud reads must retain notes on correctly answered questions");
cloudMemo.memo = "";
assert.equal((await accountBank.mergeAccountStore(pulledMemo)).wrongNotes[question.id].memo, "", "A cleared cloud memo must not revive stale local text");

let sourceReads = 0;
const route = load("app/api/cbt/question-stats/route.ts", {
  "@/lib/ai-explanation-server": { trustedQuestion: async () => { sourceReads++; return question; } },
  "@/lib/cbt-question-stats": stats,
  "@/lib/public-supabase-config": { getPublicSupabaseConfig: () => ({ url: "https://test.supabase.co", key: "publishable-test" }) },
});
const tokenBefore = process.env.PASSMATE_CBT_STATS_TOKEN;
process.env.PASSMATE_CBT_STATS_TOKEN = "test-token-".padEnd(64, "x");
const fetchBefore = globalThis.fetch;
const calls = [];
globalThis.fetch = async (_url, init) => { calls.push(JSON.parse(init.body)); return Response.json({ stats: {} }); };
const revision = hash(stats.questionStatsInput(question));
const request = (action, extra = {}, headers = {}, attemptId = "attempt-test-a") => new Request("https://www.mypassmate.com/api/cbt/question-stats/", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ action, ...(action === "record" && attemptId !== null ? { attemptId } : {}), questions: [{ qualificationCode: "kh", questionId: question.id, revision, answer: 0, ...extra }] }) });
try {
  const first = await route.POST(request("read"));
  assert.equal(first.status, 200);
  assert.equal(sourceReads, 0, "Aggregate reads must not wait for source questions or correction lookups");
  assert.equal(calls[0].rows[0].correct, undefined, "Read does not include a response");
  const cookie = first.headers.get("set-cookie").split(";")[0];
  const second = await route.POST(request("record", { correct: true }, { cookie }));
  assert.equal(second.status, 200);
  assert.equal(sourceReads, 1, "Recording must still resolve the authoritative question");
  assert.equal(calls[1].rows[0].correct, false, "Never trust a browser-supplied correctness flag");
  assert.equal(calls[1].visitorHash, calls[0].visitorHash, "One browser identity survives read/write without login");
  assert.equal(second.headers.get("set-cookie"), null);
  assert.equal((await route.POST(request("record", { answer: 1 }, { cookie }))).status, 200);
  assert.equal(calls[2].rows[0].correct, true);
  assert.equal((await route.POST(request("record", { answer: 4 }))).status, 409);
  assert.equal((await route.POST(request("record", { revision: "0".repeat(64) }))).status, 409);
  assert.equal((await route.POST(request("record", { answer: -1 }))).status, 400);
  assert.equal((await route.POST(request("read", {}, { origin: "https://other.example" }))).status, 403);
  assert.equal(calls.length, 3, "Invalid/cross-site writes must never reach the privileged backend");
  assert.match(calls[1].rows[0].attempt_hash, /^[a-f0-9]{64}$/);
  assert.equal(calls[2].rows[0].attempt_hash, calls[1].rows[0].attempt_hash, "Instant/final saves in one attempt retain the same deduplication key");
  assert.equal(JSON.stringify(calls).includes("attempt-test-a"), false, "Statistics storage never receives the raw attempt ID");
  assert.equal((await route.POST(request("record", {}, { cookie }, "attempt-test-b"))).status, 200);
  assert.notEqual(calls[3].rows[0].attempt_hash, calls[1].rows[0].attempt_hash, "A new attempt contributes a separate response for the same browser and question");
  assert.equal((await route.POST(request("record", { attempt_hash: "f".repeat(64) }, { cookie }))).status, 200);
  assert.equal(calls[4].rows[0].attempt_hash, calls[1].rows[0].attempt_hash, "Ignore browser-supplied row hashes");
  assert.equal((await route.POST(request("record", {}, { cookie }, null))).status, 200);
  assert.equal(calls[5].rows[0].attempt_hash, "0".repeat(64), "Old open clients keep their legacy sample key");
  assert.equal((await route.POST(request("record", {}, { cookie }, "bad id"))).status, 400);
  assert.equal(calls.length, 6);
} finally { globalThis.fetch = fetchBefore; if (tokenBefore === undefined) delete process.env.PASSMATE_CBT_STATS_TOKEN; else process.env.PASSMATE_CBT_STATS_TOKEN = tokenBefore; }
const migration = readFileSync(resolve("supabase/migrations/20261005084944_cbt_question_answer_statistics.sql"), "utf8");
assert.match(migration, /security invoker/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /on conflict do nothing returning/i);
const timeBefore = Date.now;
let now = timeBefore();
Date.now = () => now;
const clientCalls = [];
let releaseRead;
globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(init.body);
  clientCalls.push(body);
  if (releaseRead === undefined) await new Promise((resolve) => { releaseRead = resolve; });
  return Response.json({ stats: Object.fromEntries(body.questions.map((row) => [row.questionId, { total: 10, correct: 7 }])) });
};
try {
  const nextQuestion = { ...question, id: "b".repeat(20) };
  const prefetch = stats.loadQuestionStats([question, nextQuestion]);
  const concurrent = stats.loadQuestionStats([nextQuestion]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(clientCalls.length, 1, "Concurrent views share a pending prefetch");
  releaseRead();
  await Promise.all([prefetch, concurrent]);
  assert.equal(stats.cachedQuestionStats(nextQuestion).correct, 7);
  await stats.loadQuestionStats([nextQuestion, question]);
  assert.equal(clientCalls.length, 1, "Navigation to prefetched questions makes no request");
  await stats.loadQuestionStats([{ ...question, answer: 2 }]);
  assert.equal(clientCalls.length, 2, "A corrected question has a separate cache entry");
  now += 60_001;
  assert.equal(stats.cachedQuestionStats(question).total, 10, "Navigation can display the previous real aggregate while revalidating an expired entry");
  await stats.loadQuestionStats([question]);
  assert.equal(clientCalls.length, 3, "Expired aggregates refresh");
  globalThis.fetch = async () => { throw new Error("offline"); };
  await assert.rejects(stats.loadQuestionStats([nextQuestion]));
  globalThis.fetch = async () => Response.json({ stats: { [nextQuestion.id]: { total: 12, correct: 9 } } });
  assert.equal((await stats.loadQuestionStats([nextQuestion]))[nextQuestion.id].total, 12, "A failed lookup can retry instead of remaining pending");
  const raceQuestion = { ...question, id: "c".repeat(20) };
  let finishOldRead;
  const windowBefore = globalThis.window;
  const events = [];
  globalThis.window = { dispatchEvent: (event) => events.push(event) };
  try {
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.action === "read") await new Promise((resolve) => { finishOldRead = resolve; });
      return Response.json({ stats: { [raceQuestion.id]: body.action === "read" ? { total: 1, correct: 0 } : { total: 2, correct: 1 } } });
    };
    const oldRead = stats.loadQuestionStats([raceQuestion]);
    await new Promise((resolve) => setImmediate(resolve));
    stats.recordQuestionResponses([raceQuestion], { [raceQuestion.id]: 1 }, "attempt-test-c");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(events.length, 1, "Successful recording announces the updated aggregate");
    assert.equal(stats.cachedQuestionStats(raceQuestion).total, 2);
    finishOldRead();
    assert.equal((await oldRead)[raceQuestion.id].total, 2, "An earlier read cannot overwrite a newer recorded aggregate");
  } finally { if (windowBefore === undefined) delete globalThis.window; else globalThis.window = windowBefore; }
} finally { globalThis.fetch = fetchBefore; Date.now = timeBefore; }
console.log("CBT review insights OK: private memos, first-response grading, guest identity, fast aggregate reads, prefetch coalescing, revision cache isolation, expiry and retry");
