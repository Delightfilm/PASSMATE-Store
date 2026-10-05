import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";

function load(path, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error("Unexpected storage test dependency: " + name);
  }, module, module.exports);
  return module.exports;
}

const { normalizeLocalStore, readLocalStore, parseImportFile } = load("../lib/question-bank.ts", {
  "@/lib/supabase-browser": { getSupabaseBrowserClient() { throw new Error("Tests must not access Supabase"); } },
  "./question-bank-choices": {},
  "./question-bank-groups": load("../lib/question-bank-groups.ts"),
});
const auth = load("../lib/auth-ui.ts");
const attempt = {
  id: "a1", config: { certId: "test", examIds: ["e1"], subjectIds: ["s1"], count: 2, order: "ordered", target: "all", gradeMode: "submit", timeLimitMinutes: 60 },
  questionIds: ["q1", "q2"], answers: { q1: 0, q2: 3 }, lockedIds: ["q1"], startedAt: "2026-10-04T00:00:00Z", endAt: "2026-10-04T01:00:00Z", status: "in_progress",
};
const note = { wrongCount: 2, lastWrongAt: "2026-10-04T00:00:00Z", memo: "keep my note", mastered: false };
const store = normalizeLocalStore({ attempts: [attempt, null, { id: "invalid" }], bookmarks: ["q1", null, "q1"], wrongNotes: { q1: note, bad: null }, presets: null, imports: null, issueReports: null, questionCerts: { q1: "test", bad: null } });
assert.deepEqual(store.attempts, [attempt], "Preserve valid attempts with all selected answers and timer");
assert.deepEqual(store.bookmarks, ["q1"]);
assert.deepEqual(store.wrongNotes, { q1: note });
assert.deepEqual(store.questionCerts, { q1: "test" });
for (const input of [null, [], 123, { attempts: null, bookmarks: null, wrongNotes: null }]) {
  const result = normalizeLocalStore(input);
  assert.deepEqual(result.attempts, []); assert.deepEqual(result.bookmarks, []); assert.deepEqual(result.wrongNotes, {});
}
const cleaned = normalizeLocalStore({ attempts: [{ ...attempt, answers: { q1: 0, q2: -1, alien: 2 }, lockedIds: ["alien"] }] });
assert.deepEqual(cleaned.attempts[0].answers, { q1: 0 }); assert.deepEqual(cleaned.attempts[0].lockedIds, []);
const wider = normalizeLocalStore({ attempts: [{ ...attempt, answers: { q1: 4 }, submittedAt: "bad-date", score: {} }] }).attempts[0];
assert.deepEqual(wider.answers, { q1: 4 }, "Keep answers to five-choice questions");
assert.equal(wider.submittedAt, undefined); assert.equal(wider.score, undefined);
const independent = normalizeLocalStore({}); independent.bookmarks.push("mutated");
assert.deepEqual(normalizeLocalStore({}).bookmarks, [], "Fallback collections must not be shared");

globalThis.window = { sessionStorage: { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } } };
globalThis.localStorage = { getItem() { return '{"attempts":null,"bookmarks":null}'; } };
try {
  assert.equal(auth.readOAuthNextPath(), null);
  assert.doesNotThrow(() => auth.rememberOAuthNextPath("/checkout/"));
  assert.doesNotThrow(() => auth.clearOAuthNextPath());
  assert.deepEqual(readLocalStore().attempts, []);
  globalThis.localStorage.getItem = () => { throw new Error("denied"); };
  assert.deepEqual(readLocalStore().bookmarks, []);
  let stored;
  window.sessionStorage = { getItem: () => stored, setItem: (_, value) => { stored = value; }, removeItem: () => { stored = null; } };
  auth.rememberOAuthNextPath("//outside.invalid/"); assert.equal(auth.readOAuthNextPath(), "/library/");
  auth.rememberOAuthNextPath("/checkout/?product=computer-literacy-2"); assert.equal(auth.readOAuthNextPath(), "/checkout/?product=computer-literacy-2");
  auth.clearOAuthNextPath(); assert.equal(auth.readOAuthNextPath(), null);
} finally { delete globalThis.window; delete globalThis.localStorage; }
for (const value of [{ questions: {} }, [null, 7], { questions: [] }]) {
  const result = await parseImportFile({ name: "invalid.json", text: async () => JSON.stringify(value) });
  assert.ok(result.errors.length > 0, "Malformed/empty imports must return validation errors");
  assert.deepEqual(result.rows, [], "Invalid rows must not reach the preview/save loop");
}
const importRow = { stem: "Keep this question", choices: ["A", "B", "C", "D"], answer: 1 };
const imported = await parseImportFile({ name: "valid.json", text: async () => JSON.stringify([importRow, importRow]) });
assert.deepEqual(imported.rows, [importRow, importRow], "Preserve source values and duplicate questions");
assert.deepEqual(imported.errors, []);
console.log("Browser storage OK: malformed data, valid-record preservation, independent fallbacks, denied OAuth storage and safe next paths; no network");
