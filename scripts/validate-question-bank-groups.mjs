import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Script } from "node:vm";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const urlFor = (source) => "data:text/javascript;base64," + Buffer.from(ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 })).toString("base64");
const groupUrl = urlFor(read("../lib/question-bank-groups.ts"));
const groups = await import(groupUrl);
const { qualificationGroups, qualificationIdentity, resolveQualificationGroup, examSelectionLabel, belongsToQualification, groupSourceIdsForAttempt } = groups;
const cert = (id, name, questionCount = 1, examCount = 1) => ({ id, name, questionCount, examCount });
const certs = [cert("cek", "감정평가사 1차 1교시", 1197, 10), cert("cen", "감정평가사 1차 1교시(구)", 558, 7), cert("cem", "감정평가사 1차 2교시", 1359, 17), cert("cfm", "경영지도사 1차"), cert("cda", "경영지도사 1차 1교시"), cert("ru", "경영지도사 1차 2교시(구)"), cert("a", "정보처리기사"), cert("b", "정보처리기사(구)"), cert("c", "정보처리산업기사"), cert("d", "정보처리기능사"), cert("dc", "화공기사(구)(구)")];
const before = JSON.stringify(certs);
const projected = qualificationGroups(certs);
const appraiser = resolveQualificationGroup(certs, "감정평가사-1차");
assert.equal(appraiser.questionCount, 3114); assert.equal(appraiser.examCount, 34);
assert.deepEqual(appraiser.memberIds, ["cek", "cen", "cem"]);
assert.equal(resolveQualificationGroup(certs, "감정평가사-1차-1교시(구)").id, appraiser.id);
assert.equal(resolveQualificationGroup(certs, "cen").id, appraiser.id);
assert.equal(resolveQualificationGroup(certs, "%broken"), undefined);
assert.equal(projected.filter(item => item.name.startsWith("정보처리")).length, 3, "Never merge grades");
assert(!projected.some(item => item.name.includes("(구)")));
assert.equal(JSON.stringify(certs), before, "Source identities/counts/names must remain untouched");
const exam = { id: "cen20150627", certId: "cen", year: 2015, round: "1회", title: "original" };
assert.equal(examSelectionLabel(exam, certs), "1교시 · 개편 전 기출 · 06.27");
assert.equal(examSelectionLabel({ ...exam, id: "cen20150401" }, certs), "1교시 · 개편 전 기출 · 04.01");
assert.equal(examSelectionLabel({ ...exam, id: "legacy-uuid" }, certs), "1교시 · 개편 전 기출");
assert.equal(examSelectionLabel({ id: "cfm20250412", certId: "cfm", year: 2025, round: "1회" }, certs), "1회 · 04.12", "Do not fabricate integrated periods");
assert(belongsToQualification(appraiser, "cen")); assert(!belongsToQualification(appraiser, "cda"));
assert.notEqual(qualificationIdentity("9급 국가직 공무원 국어").name, qualificationIdentity("9급 지방직 공무원 국어").name);
assert.notEqual(qualificationIdentity("9급 지방직 공무원 서울시 국어").name, qualificationIdentity("9급 지방직 공무원 국어").name);
assert.notEqual(qualificationIdentity("9급 지방직 공무원 서울시 사회(유공자)").name, qualificationIdentity("9급 지방직 공무원 서울시 사회").name);
assert.notEqual(qualificationIdentity("9급 지방직 공무원 서울시 수학(지적)").name, qualificationIdentity("9급 지방직 공무원 서울시 수학").name);
assert.notEqual(qualificationIdentity("소방공무원(공개) 소방관계법규").name, qualificationIdentity("소방공무원(경력) 소방관계법규").name);
assert.equal(qualificationIdentity("계리직공무원 컴퓨터 일반").name, "계리직 공무원");
assert.notEqual(qualificationIdentity("경비지도사 2차(경호학)").name, qualificationIdentity("경비지도사 2차(기계경비개론)").name);
assert.equal(qualificationIdentity("전파통신기능사(구)").name, "전파전자통신기능사");
assert.deepEqual(groupSourceIdsForAttempt(certs, { certId: "cek", examIds: ["cen20150627", "cem20150627"] }), ["cek", "cen", "cem"]);

const snapshot = JSON.parse(read("../data/cbt-home-catalog.generated.json"));
const allCerts = snapshot.qualifications.map(q => cert(q.code, q.title, q.questions, q.exams));
const allGroups = qualificationGroups(allCerts);
assert.equal(allGroups.flatMap(g => g.memberIds).length, allCerts.length);
assert.equal(new Set(allGroups.flatMap(g => g.memberIds)).size, allCerts.length, "Exactly one group per source");
assert.equal(allGroups.reduce((n, g) => n + g.questionCount, 0), allCerts.reduce((n, q) => n + q.questionCount, 0));
assert.equal(allGroups.reduce((n, g) => n + g.examCount, 0), allCerts.reduce((n, q) => n + q.examCount, 0));
assert(!allGroups.some(g => g.name.includes("(구)")));
for (const group of allGroups) {
  const technicalGrades = new Set(group.sourceNames.map(name => name.match(/산업기사|기능사|기능장|기사/)?.[0]).filter(Boolean));
  assert(technicalGrades.size <= 1, "Technical grades cannot be mixed: " + group.name);
  for (const id of group.memberIds) assert.equal(resolveQualificationGroup(allCerts, id).id, group.id);
}

const downloadUrl = urlFor(read("../lib/question-bank-download.ts"));
const adapterUrl = urlFor(read("../lib/question-bank-content.ts").replace('from "./question-bank-download"', `from "${downloadUrl}"`).replace('from "./question-bank-groups"', `from "${groupUrl}"`));
const calls = [];
const nativeFetch = globalThis.fetch;
process.env.NEXT_PUBLIC_QUESTION_BANK_CONTENT_URL = "https://groups.example.test";
const catalog = { schemaVersion: "passmate.question-bank.catalog.v1", releaseId: "group-tests", totals: { questions: 3, qualifications: 3 }, qualifications: certs.slice(0, 3).map(c => ({ code: c.id, title: c.name, bundle: `bundles/${c.id}.json.gz`, sha256: c.id, questions: 1, exams: 1 })) };
globalThis.fetch = async (url) => {
  calls.push(String(url));
  if (String(url).endsWith("catalog.json")) return Response.json(catalog);
  const code = String(url).match(/bundles\/(\w+)/)[1];
  return Response.json({ schemaVersion: "passmate.question-bank.bundle.v1", releaseId: "group-tests", qualification: { code }, subjects: [{ id: code + "s", certId: code, name: "과목" }], exams: [{ id: code + "20250101", certId: code, year: 2025, round: "1회" }], questions: [{ id: code.padEnd(20, "a"), certId: code, examId: code + "20250101", subjectId: code + "s", images: [], choices: [{ label: "1", text: "보기" }], answer: 0 }] });
};
try {
  const adapter = await import(adapterUrl);
  const store = { attempts: [], bookmarks: [], wrongNotes: {} };
  const home = await adapter.loadContentDataset("home", "", "", store);
  assert.equal(calls.length, 1); assert.equal(home.questions.length, 0);
  const detail = await adapter.loadContentDataset("cert", "감정평가사-1차", "", store);
  assert.equal(detail.questions.length, 3); assert.deepEqual(detail.questions.map(q => q.certId), ["cek", "cen", "cem"]);
  const alias = await adapter.loadContentDataset("cert", "cen", "", store);
  assert.equal(alias.questions.length, 3); assert.equal(calls.length, 4);
  const oldAttempt = { id: "old", config: { certId: "cen", examIds: ["cen20250101"] } };
  const legacy = await adapter.loadContentDataset("exam", "감정평가사-1차", "old", { ...store, attempts: [oldAttempt] });
  assert.equal(legacy.questions.length, 1); assert.equal(legacy.questions[0].certId, "cen", "Do not expand an old attempt into unrelated papers");
  const combined = { id: "combined", config: { certId: "cek", sourceCertIds: ["cen", "cem"], examIds: ["cen20250101", "cem20250101"] } };
  const reopened = await adapter.loadContentDataset("exam", "감정평가사-1차", "combined", { ...store, attempts: [combined] });
  assert.equal(reopened.questions.length, 3, "Hydrate all exact attempt sources");
  const bookmark = await adapter.loadContentDataset("bookmarks", "", "", { ...store, questionCerts: { saved: "cem" } });
  assert.equal(bookmark.questions[0].certId, "cem"); assert.equal(calls.length, 4, "Reuse cache without re-download");
} finally { globalThis.fetch = nativeFetch; }

const file = resolve("components/question-bank-client.tsx");
const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
const customRequire = (name) => {
  if (name === "@/lib/question-bank-groups") return groups;
  if (name === "@/lib/question-bank") return { certCategory: () => "기타", certSlug: c => c.slug || c.name, hangulInitials: x => x };
  if (name === "next/navigation") return { useRouter: () => ({}) };
  if (name === "next/link") return { default: ({ children, ...props }) => React.createElement("a", props, children) };
  if (name.startsWith("@/")) return {};
  return createRequire(file)(name);
};
new Script(`(function(require,module,exports){${code}\nexports.CbtHome=CbtHome;exports.CertDetail=CertDetail;})`).runInThisContext()(customRequire, module, module.exports);
const markup = renderToStaticMarkup(React.createElement(module.exports.CbtHome, { dataset: { certs: certs.slice(0, 3), exams: [], subjects: [], questions: [], totalQuestions: 3114 } }));
assert.equal((markup.match(/class="cbt-cert-card"/g) || []).length, 1);
assert.match(markup, /감정평가사 1차/); assert.doesNotMatch(markup, /감정평가사 1차 1교시\(구\)/);
assert.match(markup, /3,114/); assert.match(markup, /기출 시험지 34/);
console.log(`Grouping OK: ${allCerts.length} source qualifications -> ${allGroups.length} cards; all counts and source IDs preserved; grade/authority/hiring boundaries, legacy URLs, periods/dates, exact saved-attempt hydration and one-card render passed. No DB writes.`);
