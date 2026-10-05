import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
const issues = [];
const names = ["terms", "privacy", "refund", "copyright"];
for (const name of names) {
  const content = path.join(root, "content/legal", `${name}.md`);
  const route = path.join(root, "app", name, "page.tsx");
  if (!fs.existsSync(content)) {
    issues.push(`${name}: approved Markdown not supplied`);
    assert(!fs.existsSync(route), `${name}: route exists without approved content`);
    continue;
  }
  const text = fs.readFileSync(content, "utf8");
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter || !/^title:\s*\S+/m.test(frontmatter[1]) || !/^effectiveDate:\s*["']?2026-10-05["']?\s*$/m.test(frontmatter[1])) issues.push(`${name}: invalid title/effectiveDate frontmatter`);
  const withoutLinks = text.replace(/!?\[[^\]\n]*\]\([^\n]*?\)/g, "").replace(/^\[[^\]\n]+\]:\s*.+$/gm, "");
  if (/\[[^\]\n]*\]/.test(withoutLinks)) issues.push(`${name}: unresolved bracket placeholders`);
  if (!fs.existsSync(route)) issues.push(`${name}: content exists without route`);
}
const config = fs.readFileSync(path.join(root, "lib/business-info.ts"), "utf8");
const info = JSON.parse(config.match(/export const businessInfo = (\{[\s\S]*?\}) as const;/)[1]);
for (const [field, value] of Object.entries(info)) if (!value.trim()) issues.push(`business: ${field} not confirmed`);
assert.equal(info.companyName, "딜라이트 커머스");
assert.equal(info.registrationNumber, "876-59-00934");
const footer = fs.readFileSync(path.join(root, "components/site-footer.tsx"), "utf8");
for (const match of footer.matchAll(/href=["']\/(terms|privacy|refund|copyright)\/?["']/g)) {
  assert(fs.existsSync(path.join(root, "content/legal", `${match[1]}.md`)), "Footer links to missing policy");
}
for (const issue of issues) console.warn(`LEGAL WARNING: ${issue}`);
if (issues.length && process.env.LEGAL_STRICT === "1") {
  console.error(`Legal strict check failed: ${issues.length} unresolved items`);
  process.exitCode = 1;
} else console.log(`Legal check: confirmed business information valid; ${issues.length} pending items (warnings only)`);
