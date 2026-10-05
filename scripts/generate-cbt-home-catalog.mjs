import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { SNAPSHOT_SCHEMA, validateSnapshot } from "../lib/cbt-home-catalog-schema.mjs";

export function snapshotFromSource(source, bytes, generatedAt = new Date().toISOString()) {
  if (source?.schemaVersion !== "passmate.question-bank.catalog.v1" || typeof source.releaseId !== "string" || !source.releaseId.trim() || !Array.isArray(source.qualifications)) throw new Error("Invalid source catalog schema/releaseId");
  const qualifications = source.qualifications.map(item => ({ code: item.code, title: item.title, slug: typeof item.title === "string" ? item.title.trim().replace(/\s+/g, "-") : "", questions: item.questions, exams: item.exams }));
  qualifications.sort((a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
  return validateSnapshot({ snapshotSchemaVersion: SNAPSHOT_SCHEMA, releaseId: source.releaseId, generatedAt, sourceSha256: createHash("sha256").update(bytes).digest("hex"), qualifications });
}
export async function generateCatalog({ sourceUrl, output, fetcher = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const url = new URL(sourceUrl);
  if (url.username || url.password || url.search || (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)))) throw new Error("Public HTTPS catalog URL required");
  let bytes;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(5000), redirect: "error" });
      if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      break;
    } catch (error) { if (attempt === 1) throw error; await wait(1000); }
  }
  const snapshot = snapshotFromSource(JSON.parse(bytes.toString("utf8")), bytes);
  let previous;
  try { previous = validateSnapshot(JSON.parse(await fs.readFile(output, "utf8"))); } catch { /* Only a successfully validated old snapshot can skip a write. */ }
  if (previous?.sourceSha256 === snapshot.sourceSha256) return { changed: false, snapshot: previous };
  const temporary = `${output}.${randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(output), { recursive: true });
  try {
    await fs.writeFile(temporary, JSON.stringify(snapshot, null, 2) + "\n", { flag: "wx" });
    validateSnapshot(JSON.parse(await fs.readFile(temporary, "utf8")));
    await fs.rename(temporary, output);
  } finally { await fs.unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; }); }
  return { changed: true, snapshot };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  nextEnv.loadEnvConfig(process.cwd());
  const args = process.argv.slice(2);
  const index = args.indexOf("--source-url");
  const base = index >= 0 ? args[index + 1] : (process.env.NEXT_PUBLIC_QUESTION_BANK_CONTENT_URL || "").trim().replace(/\/+$/, "");
  if (!base) throw new Error("Configure NEXT_PUBLIC_QUESTION_BANK_CONTENT_URL before running catalog:snapshot");
  const sourceUrl = base.endsWith("/catalog.json") ? base : `${base}/catalog.json`;
  const output = fileURLToPath(new URL("../data/cbt-home-catalog.generated.json", import.meta.url));
  const result = await generateCatalog({ sourceUrl, output });
  console.log(`Home catalog ${result.changed ? "generated" : "unchanged"}: releaseId=${result.snapshot.releaseId}; qualifications=${result.snapshot.qualifications.length}; sha256=${result.snapshot.sourceSha256}`);
}
