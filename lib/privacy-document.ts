import fs from "node:fs";
import path from "node:path";
import { parseLegalDocument } from "./legal-document";

// Only controlled policy headings, paragraphs, numbered lists and simple tables.
// Text is escaped by React; raw HTML and arbitrary links are never evaluated.
export function parsePrivacyDocument(text: string) {
  const document = parseLegalDocument(text.replace(/^### /gm, "## "));
  const blocks = document.blocks.map((block, index) => {
    if (block.kind === "heading") return { ...block, id: `privacy-section-${index}` };
    if (block.kind !== "paragraph" || !block.text.startsWith("|")) return block;
    const lines = block.text.split("\n");
    const cells = (line: string) => line.trim().slice(1, -1).split("|").map(cell => cell.trim());
    if (lines.length < 3 || !lines.every(line => line.startsWith("|") && line.endsWith("|")) || !cells(lines[1]).every(cell => /^:?-{3,}:?$/.test(cell)))
      throw new Error("Invalid privacy policy table");
    const headers = cells(lines[0]);
    const rows = lines.slice(2).map(cells);
    if (cells(lines[1]).length !== headers.length || rows.some(row => row.length !== headers.length))
      throw new Error("Privacy policy table column mismatch");
    return { kind: "table" as const, headers, rows };
  });
  return { ...document, blocks };
}

export function getPrivacyDocument() {
  return parsePrivacyDocument(fs.readFileSync(path.join(process.cwd(), "content/legal/privacy.md"), "utf8"));
}
