import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { Script } from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

function load(relative) {
  const file = new URL(relative, import.meta.url), module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(createRequire(file), module, module.exports);
  return module.exports;
}
const { QuestionBody } = load("../components/question-body.tsx");
const { QuestionChoiceContent } = load("../components/question-choice-content.tsx");
const root = process.argv[2], previousRoot = process.argv[3];
assert.ok(root && previousRoot, "provide corrected and previous real release directories");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "catalog.json")));
let text = 0, source = 0, checked = 0, reported = 0;
const visible = html => html.replace(/<[^>]+class="sr-only"[^>]*>.*?<\/[^>]+>/gs, "");
for (const entry of catalog.qualifications.filter(q => q.code.startsWith("official-"))) {
  const bundle = JSON.parse(gunzipSync(fs.readFileSync(path.join(root, entry.bundle))));
  const old = JSON.parse(gunzipSync(fs.readFileSync(path.join(previousRoot, entry.bundle))));
  const oldQuestions = new Map(old.questions.map(q => [q.id, q]));
  assert.equal(bundle.questions.length, old.questions.length);
  for (const q of bundle.questions) {
    const prior = oldQuestions.get(q.id); assert.ok(prior, "stable question ID");
    for (const key of ["examId", "certId", "no", "stem", "choices", "answer", "acceptedAnswers", "answerStatus", "answerLabel", "inferredAnswers", "inferredAnswerNote", "answerComparison", "sourceHash"]) assert.deepEqual(q[key], prior[key], `${q.id}: preserve ${key}`);
    const html = renderToStaticMarkup(React.createElement(QuestionBody, { question: q }));
    assert.ok(["text", "source_image"].includes(q.displayMode));
    if (q.displayMode === "text") {
      text++; assert.equal(q.images.length, 0); assert.ok(!html.includes("<img"));
      assert.ok(!html.includes('class="sr-only"'));
    } else {
      source++; assert.ok(q.images.length); assert.ok(html.includes('class="sr-only"'));
      assert.equal((html.match(/<img /g) || []).length, q.images.length);
      for (const choice of q.choices) {
        const option = renderToStaticMarkup(React.createElement(QuestionChoiceContent, { choice, sourceImage: true }));
        assert.ok(option.includes('class="sr-only"')); assert.equal(visible(option), '<span class="question-choice-content"><span aria-hidden="true">원문 보기</span></span>');
      }
    }
    if (q.stem === "전류와 자기에 관한 설명 중 적절하지 않은 것은?") { assert.equal(q.displayMode, "text"); assert.equal(q.images.length, 0); reported++; }
    checked++;
  }
}
const legacy = { stem: "그림을 보고 답하세요", images: ["diagram.png"] };
const html = renderToStaticMarkup(React.createElement(QuestionBody, { question: legacy }));
assert.ok(html.includes("그림을 보고 답하세요") && html.includes("diagram.png") && !html.includes("sr-only"));
const corrected = renderToStaticMarkup(React.createElement(QuestionBody, { question: { ...legacy, displayMode: "corrected_source" } }));
assert.ok(corrected.includes("<details>") && !corrected.includes("<details open") && !corrected.includes("sr-only"), "corrected text is visible and original evidence opens on demand");
assert.ok(fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8").includes(".sr-only{position:absolute"));
assert.equal(checked, 18054); assert.ok(reported > 0);
console.log(JSON.stringify({ status: "PASS", checked, text, source, reported, stableContentAndAnswers: true, legacyDiagramsPreserved: true }));
