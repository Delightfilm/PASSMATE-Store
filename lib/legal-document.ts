import fs from "node:fs";
import path from "node:path";

// Deliberately supports only this published document's plain paragraphs,
// level-two headings and numbered lists. No raw HTML or arbitrary URL rendering.
export function parseLegalDocument(text: string) {
  const match = text.replace(/\r\n/g, "\n").match(/^---\n(title: .+)\n(effectiveDate: \d{4}-\d{2}-\d{2})\n---\n([\s\S]+)$/);
  if (!match) throw new Error("Invalid legal document metadata");
  const title = match[1].slice(7).trim();
  const effectiveDate = match[2].slice(15).trim();
  if (new Date(`${effectiveDate}T00:00:00Z`).toISOString().slice(0, 10) !== effectiveDate) throw new Error("Invalid effective date");
  const blocks = match[3].trim().split(/\n\s*\n/).map(block => {
    if (block.startsWith("## ")) return { kind: "heading" as const, text: block.slice(3) };
    const lines = block.split("\n");
    if (lines.every(line => /^\d+\. /.test(line))) return { kind: "list" as const, items: lines.map(line => line.replace(/^\d+\. /, "")) };
    return { kind: "paragraph" as const, text: block };
  });
  return { title, effectiveDate, blocks };
}

export function getAutomationTerms() {
  return parseLegalDocument(fs.readFileSync(path.join(process.cwd(), "content/legal/terms.md"), "utf8"));
}
