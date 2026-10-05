export const SNAPSHOT_SCHEMA = "passmate.cbt-home-catalog.v1";
export function validateSnapshot(value) {
  const fail = reason => { throw new Error(`Home catalog ${reason}. Run npm run catalog:snapshot explicitly, review and commit the JSON.`); };
  if (!value || value.snapshotSchemaVersion !== SNAPSHOT_SCHEMA) fail("schema is invalid");
  if (typeof value.releaseId !== "string" || !value.releaseId.trim()) fail("releaseId is missing");
  if (typeof value.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sourceSha256)) fail("source hash is invalid");
  if (typeof value.generatedAt !== "string" || !Number.isFinite(Date.parse(value.generatedAt))) fail("timestamp is invalid");
  if (!Array.isArray(value.qualifications) || !value.qualifications.length) fail("qualifications are missing");
  const codes = new Set(), slugs = new Set();
  for (const item of value.qualifications) {
    if (!item || [item.code, item.title, item.slug].some(field => typeof field !== "string" || !field.trim())) fail("qualification identity is invalid");
    if (item.slug !== item.title.trim().replace(/\s+/g, "-")) fail("qualification URL differs from CBT");
    if (![item.questions, item.exams].every(n => Number.isSafeInteger(n) && n >= 0)) fail("qualification counts are invalid");
    if (codes.has(item.code) || slugs.has(item.slug)) fail("qualification identity is duplicated");
    codes.add(item.code); slugs.add(item.slug);
  }
  return value;
}
