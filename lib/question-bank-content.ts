import type { Cert, Dataset, Exam, LocalStore, Question, Subject } from "./question-bank";
import { createContentRequest, readContentJson, watchContentRequest, type ContentRequest, type LoadOptions } from "./question-bank-download";

export type CatalogEntry = { code: string; title: string; bundle: string; sha256: string; questions: number; exams: number; images: number; uncompressedBytes?: number };
export type ContentCatalog = { schemaVersion: string; releaseId: string; totals: { questions: number; qualifications: number }; qualifications: CatalogEntry[] };
type Bundle = { schemaVersion: string; releaseId: string; qualification: { code: string }; exams: Exam[]; subjects: Subject[]; questions: Question[] };

export function contentBase() { return (process.env.NEXT_PUBLIC_QUESTION_BANK_CONTENT_URL || "").trim().replace(/\/+$/, ""); }
const bundles = new Map<string, ContentRequest<Dataset>>();
let catalogCache: { expires: number; value: ContentRequest<ContentCatalog> } | undefined;

async function fetchContent(url: string, cache: RequestCache, signal?: AbortSignal) {
  try { return await fetch(url, { cache, signal }); }
  catch (error) {
    // One retry for a transient transport failure only; HTTP/access errors are
    // left to the normal error UI, and the existing dataset is never replaced by samples.
    if (!(error instanceof TypeError) || signal?.aborted) throw error;
    await new Promise((resolve) => setTimeout(resolve, 500));
    signal?.throwIfAborted();
    return fetch(url, { cache, signal });
  }
}

export async function loadContentCatalog(options: LoadOptions = {}): Promise<ContentCatalog> {
  options.signal?.throwIfAborted();
  if (catalogCache && catalogCache.expires > Date.now() && !catalogCache.value.controller.signal.aborted) return watchContentRequest(catalogCache.value, options);
  const value = createContentRequest(async (requestOptions) => {
    const url = `${contentBase()}/catalog.json`;
    const response = await fetchContent(url, "no-store", requestOptions.signal);
    if (!response.ok) throw new Error(`question_bank_catalog_${response.status}`);
    const catalog = await readContentJson<ContentCatalog>(response, requestOptions);
    if (catalog.schemaVersion !== "passmate.question-bank.catalog.v1" || !Array.isArray(catalog.qualifications)) throw new Error("question_bank_catalog_invalid");
    return catalog;
  });
  catalogCache = { expires: Date.now() + 60_000, value };
  void value.promise.catch(() => { if (catalogCache?.value === value) catalogCache = undefined; });
  return watchContentRequest(value, options);
}

export async function loadContentBundle(catalog: ContentCatalog, code: string, options: LoadOptions = {}): Promise<Dataset> {
  options.signal?.throwIfAborted();
  const entry = catalog.qualifications.find((item) => item.code === code);
  if (!entry || !/^bundles\/[a-z0-9-]+\.json\.gz$/i.test(entry.bundle)) throw new Error("question_bank_qualification_missing");
  const key = `${contentBase()}:${catalog.releaseId}:${entry.sha256}`;
  const cached = bundles.get(key);
  if (cached && !cached.controller.signal.aborted) { bundles.delete(key); bundles.set(key, cached); return watchContentRequest(cached, options); }
  const value = createContentRequest(async (requestOptions) => {
    const url = `${contentBase()}/${entry.bundle}`;
    const response = await fetchContent(url, "no-cache", requestOptions.signal);
    if (!response.ok) throw new Error(`question_bank_bundle_${response.status}`);
    const bundle = await readContentJson<Bundle>(response, requestOptions);
    if (bundle.schemaVersion !== "passmate.question-bank.bundle.v1" || bundle.releaseId !== catalog.releaseId || bundle.qualification.code !== code || bundle.questions.length !== entry.questions || bundle.exams.length !== entry.exams) throw new Error("question_bank_bundle_invalid");
    const imageUrl = (image: string) => {
      if (!/^images\/[a-f0-9]{2}\/[a-f0-9]{64}\.[a-z0-9]+$/i.test(image)) throw new Error("question_bank_image_invalid");
      return `${contentBase()}/${image}`;
    };
    return { certs: [{ id: code, name: entry.title, questionCount: entry.questions, examCount: entry.exams }], subjects: bundle.subjects, exams: bundle.exams, questions: bundle.questions.map((question) => ({ ...question, status: "published" as const,
      images: question.images.map(imageUrl), choices: (question.choices || []).map((choice) => ({ ...choice,
        ...(choice.images ? { images: choice.images.map(imageUrl) } : {}) })) })) };
  });
  bundles.set(key, value);
  if (bundles.size > 4) bundles.delete(bundles.keys().next().value!);
  void value.promise.catch(() => { if (bundles.get(key) === value) bundles.delete(key); });
  return watchContentRequest(value, options);
}

export async function loadContentDataset(mode: string, certParam: string, attemptId: string, store: LocalStore, options: LoadOptions = {}): Promise<Dataset> {
  const catalog = await loadContentCatalog(options);
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
    const bundle = await loadContentBundle(catalog, code, options);
    dataset.subjects.push(...bundle.subjects); dataset.exams.push(...bundle.exams); dataset.questions.push(...bundle.questions);
  }
  return dataset;
}
