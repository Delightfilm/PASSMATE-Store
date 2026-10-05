import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { Script } from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = process.argv[2];
assert.ok(root, "provide the real prepared stage release directory");
const file = new URL("../lib/question-bank-answers.ts", import.meta.url);
const module = { exports: {} };
const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(createRequire(file), module, module.exports);
const helpers = module.exports;
const componentFile = new URL("../components/question-answer-info.tsx", import.meta.url);
const component = { exports: {} };
const jsx = ts.transpileModule(fs.readFileSync(componentFile, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const require = createRequire(componentFile);
new Script(`(function(require,module,exports){${jsx}\n})`).runInThisContext()(name => name.includes("question-bank-answers") ? helpers : require(name), component, component.exports);
const catalog = JSON.parse(fs.readFileSync(path.join(root, "catalog.json")));
assert.equal(catalog.totals.questions, 17235);
assert.equal(catalog.totals.excludedQuestions, 0);
let candidates = 0, disagreements = 0, noOption = 0, multi = 0, checks = 0;
for (const entry of catalog.qualifications) {
  const bundle = JSON.parse(gunzipSync(fs.readFileSync(path.join(root, entry.bundle))));
  for (const q of bundle.questions) {
    if (q.acceptedAnswers.length > 1) multi++;
    for (let selected = 0; selected < q.choices.length; selected++) {
      assert.equal(helpers.isCorrectAnswer(q, selected), q.acceptedAnswers.includes(selected)); checks++;
    }
    assert.equal(helpers.isCorrectAnswer(q, undefined), false);
    if (q.inferredAnswers === undefined) continue;
    candidates++;
    const html = renderToStaticMarkup(React.createElement(component.exports.QuestionAnswerInfo, { question: q }));
    const hidden = renderToStaticMarkup(React.createElement(component.exports.QuestionAnswerInfo, { question: q, reveal: false }));
    assert.ok(html.includes("가답안") && html.includes("추정 후보") && html.includes("공식 확정답안 아님"));
    assert.ok(hidden.includes("답안 확인 시 표시"));
    assert.ok(!hidden.includes(q.inferredAnswerNote));
    if (q.answerComparison === "disagree") {
      disagreements++;
      assert.ok(html.includes("답안 불일치") && html.includes("채점은 가답안 기준"));
      // A candidate outside the provisional key remains incorrect under provisional grading.
      for (const selected of q.inferredAnswers.filter(index => !q.acceptedAnswers.includes(index))) assert.equal(helpers.isCorrectAnswer(q, selected), false);
    }
    if (!q.inferredAnswers.length) { noOption++; assert.ok(html.includes("해당 보기 없음")); }
  }
}
assert.equal(candidates, 113); assert.equal(disagreements, 8); assert.equal(noOption, 3); assert.equal(multi, 45);
assert.equal(helpers.isCorrectAnswer({ answer: 2 }, 2), true);
assert.equal(helpers.isCorrectAnswer({ answer: 2 }, 1), false);
console.log(JSON.stringify({ status: "PASS", questions: 17235, candidates, disagreements, noOption, multi, gradingChecks: checks, renderedLabels: "PASS", preAnswerDisclosure: "PASS" }));
