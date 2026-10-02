import type { Cert, Dataset, Exam, LocalStore, Question, Subject } from "./question-bank";

export type CatalogEntry = { code: string; title: string; bundle: string; sha256: string; questions: number; exams: number; images: number };
export type ContentCatalog = { schemaVersion: string; releaseId: string; totals: { questions: number; qualifications: number }; qualifications: CatalogEntry[] };
type Bundle = { schemaVersion: string; releaseId: string; qualification: { code: string }; exams: Exam[]; subjects: Subject[]; questions: Question[] };

export function contentBase() { return (process.env.NEXT_PUBLIC_QUESTION_BANK_CONTENT_URL || "").trim().replace(/\/+$/, ""); }
const bundles = new Map<string, Promise<Dataset>>();
let catalogCache: { expires: number; value: Promise<ContentCatalog> } | undefined;

export async function loadContentCatalog(): Promise<ContentCatalog> {
  if (catalogCache && catalogCache.expires > Date.now()) return catalogCache.value;
  const value = (async () => {
    const response = await fetch(`${contentBase()}/catalog.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`question_bank_catalog_${response.status}`);
    const catalog = await response.json() as ContentCatalog;
    if (catalog.schemaVersion !== "passmate.question-bank.catalog.v1" || !Array.isArray(catalog.qualifications)) throw new Error("question_bank_catalog_invalid");
    return catalog;
  })();
  catalogCache = { expires: Date.now() + 60_000, value };
  try { return await value; } catch (error) { catalogCache = undefined; throw error; }
}

export async function loadContentBundle(catalog: ContentCatalog, code: string): Promise<Dataset> {
  const entry = catalog.qualifications.find((item) => item.code === code);
  if (!entry || !/^bundles\/[a-z0-9-]+\.json\.gz$/i.test(entry.bundle)) throw new Error("question_bank_qualification_missing");
  const key = `${contentBase()}:${catalog.releaseId}:${entry.sha256}`;
  const cached = bundles.get(key);
  if (cached) { bundles.delete(key); bundles.set(key, cached); return cached; }
  const value = (async () => {
    const response = await fetch(`${contentBase()}/${entry.bundle}`, { cache: "no-cache" });
    if (!response.ok) throw new Error(`question_bank_bundle_${response.status}`);
    const bundle = await response.json() as Bundle;
    if (bundle.schemaVersion !== "passmate.question-bank.bundle.v1" || bundle.releaseId !== catalog.releaseId || bundle.qualification.code !== code || bundle.questions.length !== entry.questions || bundle.exams.length !== entry.exams) throw new Error("question_bank_bundle_invalid");
    return { certs: [{ id: code, name: entry.title, questionCount: entry.questions, examCount: entry.exams }], subjects: bundle.subjects, exams: bundle.exams, questions: bundle.questions.map((question) => ({ ...question, status: "published" as const, images: question.images.map((image) => {
      if (!/^images\/[a-f0-9]{2}\/[a-f0-9]{64}\.[a-z0-9]+$/i.test(image)) throw new Error("question_bank_image_invalid");
      return `${contentBase()}/${image}`;
    }) })) };
  })();
  bundles.set(key, value);
  if (bundles.size > 4) bundles.delete(bundles.keys().next().value!);
  try { return await value; } catch (error) { bundles.delete(key); throw error; }
}

export async function loadContentDataset(mode: string, certParam: string, attemptId: string, store: LocalStore): Promise<Dataset> {
  const catalog = await loadContentCatalog();
  const certs: Cert[] = catalog.qualifications.map((entry) => ({ id: entry.code, name: entry.title, questionCount: entry.questions, examCount: entry.exams }));
  const decoded = decodeURIComponent(certParam);
  const selected = certs.find((cert) => cert.id === decoded || cert.name.trim().replace(/\s+/g, "-") === decoded);
  const codes = new Set<string>();
  if (selected) codes.add(selected.id);
  if (mode === "exam") { const attempt = store.attempts.find((item) => item.id === attemptId); if (attempt) codes.add(attempt.config.certId); }
  if (["history", "bookmarks", "wrong-notes"].includes(mode)) {
    store.attempts.forEach((attempt) => codes.add(attempt.config.certId));
    Object.values(store.questionCerts || {}).forEach((code) => codes.add(code));
  }
  const dataset: Dataset = { certs, subjects: [], exams: [], questions: [], totalQuestions: catalog.totals.questions };
  // Sequential loads avoid a request burst and keep peak parsing memory bounded.
  for (const code of codes) {
    if (!certs.some((cert) => cert.id === code)) continue;
    const bundle = await loadContentBundle(catalog, code);
    dataset.subjects.push(...bundle.subjects); dataset.exams.push(...bundle.exams); dataset.questions.push(...bundle.questions);
  }
  return dataset;
}
