import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
function load(relativePath, overrides = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(name => overrides[name] ?? require(name), module, module.exports);
  return module.exports;
}
const legal = load("lib/legal-document.ts");
const privacy = load("lib/privacy-document.ts", { "./legal-document": legal });
const source = fs.readFileSync(path.join(root, "content/legal/privacy.md"), "utf8");
const parsed = privacy.parsePrivacyDocument(source);
assert.equal(parsed.title, "개인정보처리방침");
const headings = parsed.blocks.filter(block => block.kind === "heading");
assert.equal(headings.length, 13);
assert.equal(new Set(headings.map(block => block.id)).size, 13);
const countries = parsed.blocks.find(block => block.kind === "table" && block.headers.includes("확인한 지역"));
assert(countries.rows.some(row => row[1].includes("일본 도쿄")));
assert.equal(parsed.blocks.filter(block => block.kind === "table").length, 3);
const metadata = "---\ntitle: 개인정보처리방침\neffectiveDate: 2026-10-14\n---\n";
assert.throws(() => privacy.parsePrivacyDocument(metadata + "| A | B |\n|---|---|\n| only one |"), /column mismatch/);
assert.throws(() => privacy.parsePrivacyDocument(metadata + "| A | B |\n|wrong|---|\n|one|two|"), /Invalid privacy/);
const hostile = privacy.parsePrivacyDocument(metadata + "| A |\n|---|\n| <script>alert(1)</script> |");
assert.equal(hostile.blocks[0].rows[0][0], "<script>alert(1)</script>"); // Text, not evaluated markup.
const terms = legal.parseLegalDocument(fs.readFileSync(path.join(root, "content/legal/terms.md"), "utf8"));
assert.equal(terms.blocks.filter(block => block.kind === "heading").length, 18);
console.log("Privacy document PASS: real sections/anchors/tables, malformed table rejection, text-only content, existing terms preserved");
