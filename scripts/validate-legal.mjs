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
  const expectedDate = name === "terms" ? "2026-10-14" : "2026-10-05";
  const datePattern = new RegExp(`^effectiveDate:\\s*["']?${expectedDate}["']?\\s*$`, "m");
  if (!frontmatter || !/^title:\s*\S+/m.test(frontmatter[1]) || !datePattern.test(frontmatter[1])) issues.push(`${name}: invalid title/effectiveDate frontmatter`);
  const withoutLinks = text.replace(/!?\[[^\]\n]*\]\([^\n]*?\)/g, "").replace(/^\[[^\]\n]+\]:\s*.+$/gm, "");
  if (/\[[^\]\n]*\]/.test(withoutLinks)) issues.push(`${name}: unresolved bracket placeholders`);
  if (!fs.existsSync(route)) issues.push(`${name}: content exists without route`);
  if (name === "terms") {
    const articles = [...text.matchAll(/^## 제(\d+)조 /gm)].map(match => Number(match[1]));
    assert.deepEqual(articles, Array.from({ length: 18 }, (_, index) => index + 1), "Terms must contain every approved article in order");
    assert(!/편집·시행 메모|검토용|확인 필요|공기출|0gichul/.test(text), "Do not publish editorial notes or competitor information");
    assert(!/^\|/m.test(text), "Published terms use the existing paragraph/list renderer; business values come from config");
    for (const required of ["보조공학·접근성", "검색엔진", "robots.txt", "AI 모델 학습", "이의 신청", "단순 결제 완료나 링크 발급", "회사의 고의 또는 중대한 과실"])
      assert(text.includes(required), `Preserve approved protections: ${required}`);
  }
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
