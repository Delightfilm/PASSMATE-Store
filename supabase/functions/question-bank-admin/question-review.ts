export type QuestionContent = { schemaVersion?: 2; stem: string; choices: { label: string; text: string; images?: string[] }[]; answer: number; acceptedAnswers?: number[]; images?: string[]; explanation: string };
const imagePath = /^https:\/\/content\.mypassmate\.com\/(?:images\/[a-f0-9]{2}\/[a-f0-9]{64}\.(png|jpe?g|gif|webp)|admin-images\/[a-f0-9]{64}\.png)$/i;
const legacyImagePath = /^https:\/\/img\.comcbt\.com\/cbt\/data\/[a-z0-9_-]{1,16}\/[a-z0-9_-]{1,32}\/[a-z0-9_-]{1,80}\.(png|jpe?g|gif|webp)$/i;
export const choiceLabel = (index: number) => ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩"][index] || String(index+1);
export function validEditImage(image: unknown): image is string { return typeof image === "string" && (imagePath.test(image) || legacyImagePath.test(image)); }
export function editableContent(question: Record<string, unknown>, source = question): QuestionContent {
  const choices = question.choices as QuestionContent["choices"];
  const original = source.choices as QuestionContent["choices"];
  const modern = question.schemaVersion === 2;
  const content: QuestionContent = { stem: String(question.stem || ""), choices: choices?.map((choice, index) => ({ label: choiceLabel(index), text: String(choice.text || ""),
    ...(modern ? {images: choice.images ?? []} : original?.[index]?.images?.length ? { images: original[index].images } : {}) })), answer: question.answer as number, explanation: String(question.explanation || ""),
    ...(modern ? { schemaVersion: 2, images: question.images as string[], acceptedAnswers: question.acceptedAnswers as number[] } : {}) };
  validatePatch(content);
  return content;
}
export function validatePatch(value: unknown): asserts value is QuestionContent {
  const p = value as QuestionContent | null;
  const imagesValid = (images: unknown) => Array.isArray(images) && images.length <= 10 && images.every(validEditImage);
  if (!p || typeof p.stem !== "string" || !p.stem.trim() || p.stem.length > 20000 || !Array.isArray(p.choices) || p.choices.length < 2 || p.choices.length > 10 || p.choices.some((choice) => !choice || typeof choice.text !== "string" || choice.text.length > 10000 ||
    (choice.images !== undefined && !imagesValid(choice.images)) ||
    (!choice.text.trim() && !choice.images?.length)) || !Number.isInteger(p.answer) || p.answer < 0 || p.answer >= p.choices.length || typeof p.explanation !== "string" || p.explanation.length > 20000) throw new Error("invalid_question_patch");
  if (p.schemaVersion === 2 && (!imagesValid(p.images) || !Array.isArray(p.acceptedAnswers) || !p.acceptedAnswers.length || new Set(p.acceptedAnswers).size !== p.acceptedAnswers.length || !p.acceptedAnswers.includes(p.answer) || p.acceptedAnswers.some(answer => !Number.isInteger(answer) || answer < 0 || answer >= p.choices.length))) throw new Error("invalid_question_patch");
}

// Fixed origin + catalog allowlist: no client-supplied URLs or private NAS endpoints.
export async function loadNasQuestion(code: string, ref: string) {
  const origin = "https://content.mypassmate.com";
  const get = async (path: string) => {
    const response = await fetch(`${origin}/${path}`, { signal: AbortSignal.timeout(30000), redirect: "error", cache: "no-store" });
    if (!response.ok) throw new Error("question_source_unavailable");
    // Enforce a decoded limit too (Content-Length can describe compressed bytes).
    const reader = response.body?.getReader();
    if (!reader) throw new Error("question_source_unavailable");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 64 * 1024 * 1024) { await reader.cancel(); throw new Error("question_source_too_large"); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder().decode(bytes));
  };
  const catalog = await get("catalog.json");
  const entry = catalog.qualifications.find((item: { code: string }) => item.code === code);
  if (!entry || !/^bundles\/[a-z0-9-]+\.json\.gz$/i.test(entry.bundle)) throw new Error("question_qualification_required");
  const bundle = await get(entry.bundle);
  if (bundle.schemaVersion !== "passmate.question-bank.bundle.v1" || bundle.releaseId !== catalog.releaseId || bundle.qualification.code !== code || bundle.questions.length !== entry.questions) throw new Error("question_source_changed");
  const question = bundle.questions.find((item: { id: string }) => item.id === ref);
  if (!question || question.certId !== code) throw new Error("question_not_found");
  const imageUrl = (image: string) => {
    if (!/^images\/[a-f0-9]{2}\/[a-f0-9]{64}\.[a-z0-9]+$/i.test(image)) throw new Error("question_image_invalid");
    return `${origin}/${image}`;
  };
  return { ...question, images: question.images.map(imageUrl), choices: question.choices.map((choice: QuestionContent["choices"][number]) => ({ ...choice,
    ...(choice.images ? { images: choice.images.map(imageUrl) } : {}) })) };
}
