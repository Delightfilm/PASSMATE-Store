import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { Script } from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const path = resolve("components/cbt-exam-ui.tsx");
const output = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Script(`(function(require,module,exports){${output}\n})`).runInThisContext()(createRequire(path), module, module.exports);
const { toggleAnswerSelection, AnswerChoices, MockExamGuide } = module.exports;

const original = { q1: 0, q2: 3 };
const selected = toggleAnswerSelection(original, "q3", 2);
assert.deepEqual(selected, { q1: 0, q2: 3, q3: 2 });
assert.deepEqual(original, { q1: 0, q2: 3 }, "Editing another row must not mutate earlier answers");
assert.deepEqual(toggleAnswerSelection(selected, "q3", 1), { q1: 0, q2: 3, q3: 1 });
assert.deepEqual(toggleAnswerSelection(selected, "q3", 2), original);
assert.equal(Object.keys(toggleAnswerSelection(selected, "q3", 2)).length, 2, "Deselect must update the answered count");
assert.deepEqual(toggleAnswerSelection({}, "q1", 0), { q1: 0 }, "The first choice must count as an answer");

const html = renderToStaticMarkup(React.createElement(AnswerChoices, { number: 12, selected: 2, disabled: false, onSelect() {} }));
assert.equal((html.match(/role="radio"/g) || []).length, 4);
assert.equal((html.match(/aria-checked="true"/g) || []).length, 1);
assert.match(html, /aria-label="12번 문항 ③번 보기"/);
assert.equal((html.match(/tabindex="0"/g) || []).length, 1);
const disabled = renderToStaticMarkup(React.createElement(AnswerChoices, { number: 12, selected: 2, disabled: true, onSelect() {} }));
assert.equal((disabled.match(/disabled=""/g) || []).length, 4);
const guide = renderToStaticMarkup(React.createElement(MockExamGuide, { name: "테스트 이름", practiceNumber: "20261002-01234", date: "2026-10-02", certName: "금속도장기능사", onStart() {} }));
assert.match(guide, /1\/4/);
assert.doesNotMatch(guide, /20261001-12345|@/);
assert.match(guide, /테스트 이름/); assert.match(guide, /20261002-01234/); assert.match(guide, /60문항 · 60분/);

// Render the authenticated list without executing effects or contacting a DB.
const clientPath = resolve("components/question-bank-client.tsx");
const clientOutput = ts.transpileModule(readFileSync(clientPath, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const client = { exports: {} };
const helperPath = resolve("lib/cbt-presentation.ts");
const helperOutput = ts.transpileModule(readFileSync(helperPath, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const helpers = { exports: {} };
new Script(`(function(require,module,exports){${helperOutput}\n})`).runInThisContext()(createRequire(helperPath), helpers, helpers.exports);
const clientRequire = (name) => {
  if (name === "next/navigation") return { useRouter: () => ({}) };
  if (name === "next/link") return { default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) };
  if (name === "@/components/cbt-exam-ui") return module.exports;
  if (name === "@/components/logo") return { CbtMateLogo: () => null };
  if (name === "@/components/site-header") return { SiteHeader: () => null };
  if (name === "@/lib/cbt-presentation") return helpers.exports;
  if (name.startsWith("@/lib/")) return { certSlug: (cert) => cert.name, findCert: (dataset,id) => dataset.certs.find(cert=>cert.id===id) };
  return createRequire(clientPath)(name);
};
new Script(`(function(require,module,exports){${clientOutput}\nexports.LearningScreen=LearningScreen;exports.Records=Records;exports.ExamScreen=ExamScreen;})`).runInThisContext()(clientRequire, client, client.exports);
const questions = Array.from({ length: 25 }, (_, i) => ({ id: `q${i}`, certId: "test", subjectId: "test", no: i + 1, stem: `검증용 문항 ${i + 1}` }));
const wrongNotes = Object.fromEntries(questions.map((question) => [question.id, { wrongCount: 3, lastWrongAt: "2026-10-01T00:00:00Z", memo: "", mastered: false }]));
const list = renderToStaticMarkup(React.createElement(client.exports.LearningScreen, { mode: "wrong-notes", dataset: { certs: [{ id: "test", name: "검증용 종목" }], subjects: [{ id: "test", certId: "test", name: "검증용 과목" }], questions }, store: { attempts: [], bookmarks: [], wrongNotes }, user: {}, authReady: true, saveStore() { throw new Error("Rendering must not write data"); } }));
assert.equal((list.match(/class="cbt-learning-row cbt-wrong-row"/g) || []).length, 20);
assert.equal((list.match(/type="checkbox"/g) || []).length, 20);
assert.doesNotMatch(list, /<textarea/);
assert.match(list, /많이 틀린 순/);
assert.match(list, /20문항 풀기/);
const cert = { id: "test", name: "검증용 종목" };
const record = { id: "attempt-test", config: { certId: "test", mode: "mock", examIds: [] }, questionIds: ["q1"], status: "in_progress", answers: {}, lockedIds: [], startedAt: "2026-10-01T00:00:00Z", endAt: "2026-10-01T00:01:00Z" };
const unchanged = JSON.stringify(record);
const records = renderToStaticMarkup(React.createElement(client.exports.Records, { cert, dataset: { exams: [] }, store: { attempts: [record] } }));
assert.match(records, /시간 만료/); assert.match(records, /결과 저장하기/); assert.doesNotMatch(records, /이어서 풀기/);
assert.match(records,/만료된 기록 1건/); assert.match(records,/aria-expanded="false"/);
assert.match(records,/이 목록에서 숨기기/); assert.match(records,/<div id="expired-test" hidden=""/);
assert.equal(JSON.stringify(record), unchanged, "Expiry rendering cannot mutate records");
assert.equal(helpers.exports.attemptLabel(record), "모의시험");
assert.equal(helpers.exports.attemptLabel({ ...record, config: { ...record.config, mode: undefined } }), "이전 시험");
assert.equal(helpers.exports.expiredAttempt({ ...record, status: "submitted" }), false);
assert.equal(helpers.exports.expiredAttempt({ ...record, endAt: null }), false);
assert.equal(helpers.exports.subjectName("금속도장"), "금속도장 작업 및 안전");
// Render real UI at the three display thresholds; effects/API calls never run.
const paperQuestions = Array.from({ length: 60 }, (_, i) => ({ id: `q${i}`, certId: "test", examId: "test-round", subjectId: `s${Math.floor(i / 20)}`, no: i + 1, stem: `예시 문제 ${i + 1}`, choices: [0,1,2,3].map(n => ({ label: "①②③④"[n], text: "예시 보기" })), answer: 0, images: [], explanation: "" }));
const paper = { ...record, config: { ...record.config, gradeMode: "submit" }, questionIds: paperQuestions.map(q => q.id), endAt: new Date(Date.now() + 3600000).toISOString() };
const fakeDataset = { certs: [cert], exams: [], subjects: ["금속도장재료","금속도장","색채"].map((name,i)=>({ id:`s${i}`,certId:"test",name })), questions: paperQuestions };
for (const [seconds, klass, text] of [[601, null, null],[600, "is-warning", "10분 남았습니다"],[300, "is-urgent", "5분 남았습니다"]]) {
  let stateIndex = 0;
  const mocked = { ...React, useState: value => React.useState(++stateIndex === 2 ? seconds : value) };
  const clockClient = { exports: {} };
  new Script(`(function(require,module,exports){${clientOutput}\nexports.ExamScreen=ExamScreen;})`).runInThisContext()(name => name === "react" ? mocked : clientRequire(name), clockClient, clockClient.exports);
  const screen = renderToStaticMarkup(React.createElement(clockClient.exports.ExamScreen, { dataset: fakeDataset, store: { attempts: [paper], bookmarks: [], wrongNotes: {} }, saveStore() { throw new Error("Render cannot write data"); }, certParam: "test", attemptId: paper.id, user: null, displayName: "테스트 이름" }));
  if (klass) { assert.match(screen, new RegExp(`cbt-live-timer ${klass}`)); assert.match(screen, new RegExp(text)); }
  else assert.doesNotMatch(screen, /cbt-live-timer is-warning|cbt-live-timer is-urgent|cbt-time-warning/);
  assert.match(screen, /연습용 번호 –/); assert.doesNotMatch(screen, /응시 번호 attempt-/);
}
const pagePath = resolve("app/cbt/[certSlug]/page.tsx");
const pageOutput = ts.transpileModule(readFileSync(pagePath, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const pageModule = { exports: {} }; let redirectedTo;
new Script(`(function(require,module,exports){${pageOutput}\n})`).runInThisContext()(name => name === "next/navigation" ? { redirect: url => { redirectedTo = url; throw new Error("test redirect"); } } : name === "@/components/question-bank-client" ? {} : createRequire(pagePath)(name), pageModule, pageModule.exports);
for (const slug of ["금속도장기능사", encodeURIComponent("금속도장기능사")]) {
  await assert.rejects(pageModule.exports.default({ params: Promise.resolve({ certSlug: slug }), searchParams: Promise.resolve({ tab: "builder", filter: ["1", "2"] }) }), /test redirect/);
  assert.equal(redirectedTo, `/cbt/${encodeURIComponent("금속도장기능사")}/?tab=custom&filter=1&filter=2`, "Canonical redirect must not double encode Korean paths");
}
const parsedClient = ts.createSourceFile("client.js", clientOutput, ts.ScriptTarget.Latest);
let leaveCode;
function findLeave(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === "leave") leaveCode = node.getText(parsedClient); ts.forEachChild(node, findLeave); }
findLeave(parsedClient);
assert.ok(leaveCode, "Use the real exit function");
let releaseSave;
const exitState = { attempt: {}, cert: {}, pendingAnswers: { current: new Promise(resolve => { releaseSave = resolve; }) }, confirmedExit: { current: false }, question_bank_1: { certSlug: () => "테스트" }, window: { location: { replace: path => { exitState.path = path; } } }, setToast: text => { exitState.toast = text; } };
const exit = new Script(`(${leaveCode})`).runInNewContext(exitState);
const waitingExit = exit();
assert.equal(exitState.path, undefined, "Wait for pending answers before navigating");
assert.equal(exitState.confirmedExit.current, false);
releaseSave(); await waitingExit;
assert.equal(exitState.path, `/cbt/${encodeURIComponent("테스트")}/`);
assert.equal(exitState.confirmedExit.current, true);
exitState.path = undefined; exitState.confirmedExit.current = false;
exitState.pendingAnswers.current = Promise.reject(new Error("save failed"));
await exit();
assert.equal(exitState.path, undefined, "Failed saving must keep the user on the exam");
assert.equal(exitState.confirmedExit.current, false, "Failed saving keeps exit guards active");
assert.ok(exitState.toast);
console.log("CBT UI OK: answer selection/change/deselect, isolation, counters, radio semantics, locked controls, guide identity, 20-row paging, collapsed memos, sort controls, confirmed exit waits for saving; no DB writes");

// Controlled network replies exercise the actual per-question queue.
const queuePath = resolve("lib/cbt-answer-queue.ts"), queueModule = { exports: {} };
const queueOutput = ts.transpileModule(readFileSync(queuePath,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Script(`(function(require,module,exports){${queueOutput}\n})`).runInThisContext()(createRequire(queuePath),queueModule,queueModule.exports);
const choices = new Map(), calls = [], errors = [];
const state = id => ({choice:null,review:false,locked:false,...choices.get(id)});
const queue = queueModule.exports.createAnswerQueue(state,(id,field,value)=>{const next=state(id);if(field==='answer'){next.choice=value.choice;next.locked=value.locked;}else next.review=value.review;choices.set(id,next);},(id,choice,review)=>new Promise((resolve,reject)=>calls.push({id,choice,review,resolve,reject})),error=>errors.push(error));
const turn = () => new Promise(resolve=>setImmediate(resolve));
for (const choice of [0,1,2,3]) queue.enqueue('a',choice,null);
queue.enqueue('b',2,null);
assert.equal(state('a').choice,3,'Rapid keys update UI immediately to the latest selection');
await turn(); assert.deepEqual(calls.map(call=>call.id),['a','b'],'Another question starts saving while the first is pending');
calls[1].resolve({choice:2,review:false,locked:false});calls[0].resolve({choice:0,review:false,locked:false});
await turn(); assert.equal(state('a').choice,3,'An older ACK cannot replace optimistic choice');
for(let index=2;index<5;index++){assert.equal(calls[index].id,'a');calls[index].resolve({choice:calls[index].choice,review:false,locked:false});await turn();}
await queue.flush();assert.equal(state('a').choice,3);assert.equal(state('b').choice,2);
queue.enqueue('a',1,null);await turn();const failed=calls.at(-1);failed.reject(new Error('network failure'));await turn();
assert.equal(state('a').choice,3,'Failed latest save rolls back to confirmed selection');
await assert.rejects(queue.flush(),/network failure/);assert.equal(errors.length,1);
queue.enqueue('a',2,null);await turn();calls.at(-1).resolve({choice:2,review:false,locked:false});await queue.flush();
queue.enqueue('a',null,true);queue.enqueue('a',null,false);await turn();calls.at(-1).resolve({choice:2,review:true,locked:false});await turn();
assert.equal(state('a').review,false);calls.at(-1).resolve({choice:2,review:false,locked:false});await queue.flush();
assert.equal(state('a').choice,2);assert.equal(state('a').review,false);
const serverPath=resolve('lib/cbt-test-server.ts'), serverModule={exports:{}};
const serverOutput=ts.transpileModule(readFileSync(serverPath,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Script(`(function(require,module,exports){${serverOutput}\n})`).runInThisContext()(name=>name==='server-only'?{}:name.startsWith('./')?{}:createRequire(serverPath)(name),serverModule,serverModule.exports);
for(const [code,status] of [['PT403',403],['P0002',403],['PT409',409],['23505',409],['PT422',422],['22023',422],['XX000',500]]) assert.equal(serverModule.exports.cbtRpcError({code}).status,status);
const log=console.error;console.error=()=>{};
try{for(const status of [401,403,409,422,500]){const response=serverModule.exports.cbtError(new serverModule.exports.CbtRequestError(status));assert.equal(response.status,status);const body=await response.json();assert.match(body.error,/[가-힣]/);assert.doesNotMatch(body.error,/CBT request|SQL|token|postgres/);}
assert.equal(serverModule.exports.cbtError(new Error('private secret SQL details')).status,500);}finally{console.error=log;}
assert.match(readFileSync(clientPath,'utf8'),/previous === "all" \? "all"/);
assert.match(readFileSync(clientPath,'utf8'),/modal === "interim" && attempt.config.mode !== "mock"/);
console.log('CBT review OK: optimistic rapid keys, per-question serialization/concurrent saves, stale ACK isolation, rollback/retry, review independence, expired collapsed/hidden locally, persistent all-subject tab, Korean 401/403/409/422/500 errors.');
