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
  new Script(`(function(require,module,exports){${output}\n})`).runInThisContext()((name) => dependencies[name] || createRequire(file)(name), module, module.exports);
  return module.exports;
}
const question = { id: "a".repeat(20), certId: "kh", stem: "Question", choices: [0,1,2,3].map((i) => ({ label: String(i + 1), text: `Choice ${i}` })), answer: 1, images: [], explanation: "", sourceHash: "source" };
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const stats = load("lib/cbt-question-stats.ts", { "./question-bank": { sourceHash: async (value) => hash(value) } });
assert.equal(stats.statsPresentation({ total: 0, correct: 0 }).rate, null);
assert.equal(stats.statsPresentation({ total: 2, correct: 1 }).tone, "neutral");
assert.equal(stats.statsPresentation({ total: 20, correct: 6 }).tone, "hard");
assert.equal(stats.statsPresentation({ total: 20, correct: 12 }).tone, "careful");
assert.equal(stats.statsPresentation({ total: 20, correct: 19 }).rate, 95);
assert.notEqual(hash(stats.questionStatsInput(question)), hash(stats.questionStatsInput({ ...question, answer: 2 })), "Corrections must isolate old answer statistics");
const state = load("lib/cbt-review-state.ts");
const attempt = { id: "attempt-test", answers: { [question.id]: 0 } };
const store = { attempts: [attempt], wrongNotes: {}, bookmarks: [] };
const reviewed = state.recordInstantReview(store, attempt, question, 0);
assert.equal(reviewed.wrongNotes[question.id].wrongCount, 1);
assert.equal(store.wrongNotes[question.id], undefined, "Do not mutate the previous store");
const withMemo = state.saveQuestionMemo(reviewed, question, "오답 원인");
assert.equal(withMemo.wrongNotes[question.id].memo, "오답 원인");
assert.equal(withMemo.questionCerts[question.id], "kh");
assert.equal(state.recordInstantReview(withMemo, withMemo.attempts[0], question, 0).wrongNotes[question.id].wrongCount, 1, "Do not count the same instant review twice");
assert.equal(state.recordInstantReview(withMemo, { ...attempt, reviewedQuestionIds: [] }, question, 0).wrongNotes[question.id].wrongCount, 2, "A new attempt can count as another personal error");
assert.throws(() => state.saveQuestionMemo(store, question, "x".repeat(2001)));

const route = load("app/api/cbt/question-stats/route.ts", {
  "@/lib/ai-explanation-server": { trustedQuestion: async () => question },
  "@/lib/cbt-question-stats": stats,
  "@/lib/public-supabase-config": { getPublicSupabaseConfig: () => ({ url: "https://test.supabase.co", key: "publishable-test" }) },
});
const tokenBefore = process.env.PASSMATE_CBT_STATS_TOKEN;
process.env.PASSMATE_CBT_STATS_TOKEN = "test-token-".padEnd(64, "x");
const fetchBefore = globalThis.fetch;
const calls = [];
globalThis.fetch = async (_url, init) => { calls.push(JSON.parse(init.body)); return Response.json({ stats: {} }); };
const revision = hash(stats.questionStatsInput(question));
const request = (action, extra = {}, headers = {}) => new Request("https://www.mypassmate.com/api/cbt/question-stats/", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ action, questions: [{ qualificationCode: "kh", questionId: question.id, revision, answer: 0, ...extra }] }) });
try {
  const first = await route.POST(request("read"));
  assert.equal(first.status, 200);
  assert.equal(calls[0].rows[0].correct, undefined, "Read does not include a response");
  const cookie = first.headers.get("set-cookie").split(";")[0];
  const second = await route.POST(request("record", { correct: true }, { cookie }));
  assert.equal(second.status, 200);
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
} finally { globalThis.fetch = fetchBefore; if (tokenBefore === undefined) delete process.env.PASSMATE_CBT_STATS_TOKEN; else process.env.PASSMATE_CBT_STATS_TOKEN = tokenBefore; }
const migration = readFileSync(resolve("supabase/migrations/20261005084944_cbt_question_answer_statistics.sql"), "utf8");
assert.match(migration, /security invoker/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /on conflict do nothing returning/i);
console.log("CBT review insights OK: memo preservation, instant-review dedup, low-sample labels, correction isolation, server grading, stable anonymous identity and cross-site rejection");
