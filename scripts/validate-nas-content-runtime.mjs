import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Exercise the adapter without needing Supabase or downloading the full corpus.
const source = fs.readFileSync(new URL("../lib/question-bank-content.ts", import.meta.url), "utf8");
const downloadSource = fs.readFileSync(new URL("../lib/question-bank-download.ts", import.meta.url), "utf8");
const downloadUrl = "data:text/javascript;base64," + Buffer.from(ts.transpile(downloadSource, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 })).toString("base64");
const js = ts.transpile(source.replace('from "./question-bank-download"', `from "${downloadUrl}"`), { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
process.env.NEXT_PUBLIC_QUESTION_BANK_CONTENT_URL = "https://content.example.test/";
const catalog = { schemaVersion: "passmate.question-bank.catalog.v1", releaseId: "test", totals: { questions: 2, qualifications: 2 }, qualifications: ["aa", "bb"].map((code) => ({ code, title: `${code} 기사`, bundle: `bundles/${code}.json.gz`, sha256: code, questions: 1, exams: 1 })) };
const requests = []; let failBundle = false; let invalidChoiceImage = false; let transportFailures = 1;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  requests.push(String(url));
  if (transportFailures-- > 0) throw new TypeError("Failed to fetch");
  if (String(url).endsWith("catalog.json")) return Response.json(catalog);
  const code = String(url).match(/bundles\/(\w+)/)[1];
  if (failBundle) return new Response("offline", { status: 503 });
  return Response.json({ schemaVersion: "passmate.question-bank.bundle.v1", releaseId: "test", qualification: { code }, subjects: [{ id: code + ":part1", certId: code, name: "과목" }], exams: [{ id: code + "20200101", certId: code }], questions: [{ id: code.padEnd(20, "a"), certId: code, images: ["images/aa/" + "a".repeat(64) + ".gif"], choices: [{ label: "1", text: "", images: [invalidChoiceImage ? "https://evil.example/a.gif" : "images/bb/" + "b".repeat(64) + ".gif"] }] }] });
};
try {
  const { loadContentDataset, loadContentBundle } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
  const store = { attempts: [], bookmarks: [], wrongNotes: {} };
  const home = await loadContentDataset("home", "", "", store);
  assert.equal(home.certs.length, 2); assert.equal(home.totalQuestions, 2); assert.equal(home.questions.length, 0); assert.equal(requests.length, 2, "one transient transport retry, no bundle fetch on home");
  const selected = await loadContentDataset("cert", "aa-기사", "", store);
  assert.equal(selected.questions.length, 1); assert.equal(selected.questions[0].status, "published"); assert.equal(selected.questions[0].images[0], "https://content.example.test/images/aa/" + "a".repeat(64) + ".gif");
  assert.equal(selected.questions[0].choices[0].text, "");
  assert.equal(selected.questions[0].choices[0].images[0], "https://content.example.test/images/bb/" + "b".repeat(64) + ".gif");
  await loadContentDataset("exam", "aa-기사", "attempt-test", { ...store, attempts: [{ id: "attempt-test", config: { certId: "aa" } }] });
  assert.equal(requests.length, 3, "bundle cache should reuse the selected qualification");
  failBundle = true;
  await assert.rejects(loadContentBundle(catalog, "bb"), /503/);
  failBundle = false;
  invalidChoiceImage = true;
  await assert.rejects(loadContentBundle(catalog, "bb"), /image_invalid/);
  invalidChoiceImage = false;
  const learning = await loadContentDataset("bookmarks", "", "", { ...store, questionCerts: { saved: "bb" } });
  assert.equal(learning.questions[0].certId, "bb", "failed bundle must retry and saved refs must hydrate");
  await assert.rejects(loadContentBundle({ ...catalog, releaseId: "changed" }, "aa"), /invalid/);
  console.log("NAS runtime OK: catalog-first, lazy qualification, counts, images, cache, saved refs, failure retry, release validation");
} finally { globalThis.fetch = originalFetch; }
