import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { Script } from "node:vm";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "passmate-image-choice-test-"));
try {
  const bytes = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const raw = `01_RAW/images/${hash}.gif`;
  fs.mkdirSync(path.join(root, "01_RAW/images"), { recursive: true });
  fs.mkdirSync(path.join(root, "admin"));
  fs.writeFileSync(path.join(root, raw), bytes);
  const asset = { sha256: hash, raw_path: raw, status: "done" };
  const base = { exam_id: "aa20200101", stem: "공식 보기", subject_id: "aa:part1", sourceHash: "immutable-source", visual_assets: [] };
  const questions = [
    { ...base, question_uid: "1".repeat(20), question_no: 1, choices: ["", "", "", ""], answer_no: 3, choice_assets: Array.from({ length: 4 }, () => [asset]) },
    { ...base, question_uid: "2".repeat(20), question_no: 2, choices: ["A", "B", "", ""], answer_no: 4, choice_assets: [[], [], [asset], [asset]] },
    { ...base, question_uid: "3".repeat(20), question_no: 3, choices: ["A", "", "C", "D"], answer_no: 3 },
    { ...base, question_uid: "4".repeat(20), question_no: 4, choices: ["A", "B", "C", "D"], answer_no: 2, choice_assets: [[], [{ source_url: "missing" }], [], []] },
  ];
  fs.writeFileSync(path.join(root, "admin/aa_problem_bank_bundle.json"), JSON.stringify({ qualification: { code: "aa", title: "검증" }, questions, subjects: [], exam_sessions: [{ exam_id: base.exam_id, year: 2020, round: 1 }] }));
  const output = path.join(root, "release");
  const run = spawnSync(process.execPath, [new URL("prepare-nas-question-bank.mjs", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"), "--source", root, "--bundle-root", path.join(root, "admin"), "--release", "test", "--output", output], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const catalog = JSON.parse(fs.readFileSync(path.join(output, "catalog.json")));
  const bundle = JSON.parse(gunzipSync(fs.readFileSync(path.join(output, "bundles/aa.json.gz"))));
  assert.equal(catalog.totals.questions, 2);
  assert.equal(catalog.totals.excludedQuestions, 2);
  assert.equal(catalog.totals.images, 1);
  for (const q of bundle.questions) {
    assert.equal(q.choices.length, 4);
    assert.ok(q.choices[q.answer].images?.length, "answer remains source ③/④, not compressed index");
    assert.equal(q.sourceHash, "immutable-source");
  }
  const excluded = gunzipSync(fs.readFileSync(path.join(output, "excluded-questions.jsonl.gz"))).toString();
  assert.ok(excluded.includes("empty_choice_without_image") && excluded.includes("missing_choice_image_asset"));
  const file = new URL("../components/question-choice-content.tsx", import.meta.url);
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} }, require = createRequire(file);
  const customRequire = (name) => name === "next/image" ? { default: ({ unoptimized, onError, ...props }) => React.createElement("img", props) } : require(name);
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(customRequire, module, module.exports);
  const html = renderToStaticMarkup(React.createElement(module.exports.QuestionChoiceContent, { choice: { label: "③", text: "", images: ["https://content.example.test/diagram.gif"] } }));
  assert.match(html, /③번 보기 이미지 1/);
  assert.match(html, /diagram.gif/);
  const mixed = renderToStaticMarkup(React.createElement(module.exports.QuestionChoiceContent, { choice: { label: "④", text: "<script>not HTML</script>", images: [] } }));
  assert.ok(mixed.includes("&lt;script&gt;") && !mixed.includes("<script>"));
  console.log("Image choices OK: original answer positions, all-image/mixed choices, exclusions, source hashes, image dedup, rendered labels and escaped text");
} finally {
  // Only this explicitly created, verified temporary test directory.
  if (!root.startsWith(path.join(os.tmpdir(), "passmate-image-choice-test-"))) throw new Error("unsafe test cleanup");
  fs.rmSync(root, { recursive: true, force: true });
}
