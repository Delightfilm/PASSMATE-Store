import fs from "node:fs";

const files = {
  library: fs.readFileSync(new URL("../lib/question-bank.ts", import.meta.url), "utf8"),
  admin: fs.readFileSync(new URL("../components/question-bank-admin.tsx", import.meta.url), "utf8"),
  client: fs.readFileSync(new URL("../components/question-bank-client.tsx", import.meta.url), "utf8"),
  edge: fs.readFileSync(new URL("../supabase/functions/question-bank-admin/index.ts", import.meta.url), "utf8"),
  migration: fs.readFileSync(new URL("../supabase/migrations/20260930003531_cbt_mate_question_bank_runtime.sql", import.meta.url), "utf8"),
};

for (const action of ["start_import", "import_chunk", "finish_import", "publish_batch", "rollback_batch", "recent_batches"]) {
  if (!files.edge.includes(`action === "${action}"`)) throw new Error("Question bank admin action missing: " + action);
}

if (files.admin.includes("new Set(readLocalStore().imports")) {
  throw new Error("Question bank import must not remove content duplicates in the browser.");
}
if (/source_hash\s+text\s+not null\s+unique/i.test(files.migration)) {
  throw new Error("source_hash must not be unique; repeated content occurrences are valid.");
}
if (!files.migration.includes("unique(import_batch_id, source_question_uid)")) {
  throw new Error("Chunk retries need occurrence identity within an import batch.");
}
if (!files.client.includes("loadPublishedDataset") || !files.library.includes('eq("status", "published")')) {
  throw new Error("The problem bank UI must load published Supabase questions.");
}
if (!files.admin.includes("100") || !files.edge.includes("questions.length > 100")) {
  throw new Error("Large crawler bundles must be uploaded in bounded chunks.");
}
if (!files.admin.includes("오류 보고서 내려받기")) {
  throw new Error("Validation failures need a downloadable error report.");
}

console.log("PASSMATE question bank import contract OK");
