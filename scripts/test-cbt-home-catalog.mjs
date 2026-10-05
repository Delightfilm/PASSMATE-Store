import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { snapshotFromSource, generateCatalog } from "./generate-cbt-home-catalog.mjs";
import { validateSnapshot } from "../lib/cbt-home-catalog-schema.mjs";

const source = { schemaVersion: "passmate.question-bank.catalog.v1", releaseId: "fixture-release", qualifications: [{ code: "TEST", title: "컴퓨터활용능력 2급", questions: 80, exams: 2 }] };
const bytes = Buffer.from(JSON.stringify(source));
const output = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "passmate-home-catalog-")), "catalog.json");
let calls = 0;
const fetcher = async (_url, options) => { calls++; assert(options.signal instanceof AbortSignal); return new Response(bytes); };
try {
  const first = await generateCatalog({ sourceUrl: "https://example.test/catalog.json", output, fetcher });
  assert(first.changed); assert.equal(first.snapshot.qualifications[0].slug, "컴퓨터활용능력-2급");
  const before = await fs.readFile(output, "utf8"), mtime = (await fs.stat(output)).mtimeMs;
  const second = await generateCatalog({ sourceUrl: "https://example.test/catalog.json", output, fetcher });
  assert(!second.changed); assert.equal(await fs.readFile(output, "utf8"), before); assert.equal((await fs.stat(output)).mtimeMs, mtime);
  let retries = 0;
  await assert.rejects(generateCatalog({ sourceUrl: "https://example.test/catalog.json", output, fetcher: async () => { retries++; throw new Error("offline"); }, wait: async () => {} }));
  assert.equal(retries, 2); assert.equal(await fs.readFile(output, "utf8"), before);
  for (const invalid of [{ ...source, releaseId: "" }, { ...source, qualifications: [...source.qualifications, ...source.qualifications] }, { ...source, qualifications: [{ ...source.qualifications[0], questions: -1 }] }]) assert.throws(() => snapshotFromSource(invalid, bytes));
  assert.throws(() => validateSnapshot({ ...first.snapshot, releaseId: "" }));
  await assert.rejects(generateCatalog({ sourceUrl: "https://example.test/catalog.json", output, fetcher: async () => new Response("invalid-json") }));
  assert.equal(await fs.readFile(output, "utf8"), before);
  console.log(`Catalog tests passed: generation, stable write, retry limit, failure preservation, identity/count/release validation; ${calls} mocked fetches, no external network`);
} finally { await fs.unlink(output).catch(() => {}); await fs.rmdir(path.dirname(output)); }
