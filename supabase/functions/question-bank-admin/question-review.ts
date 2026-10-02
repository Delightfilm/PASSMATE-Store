export type QuestionContent = { stem: string; choices: { label: string; text: string }[]; answer: number; explanation: string };
export function editableContent(question: Record<string, unknown>): QuestionContent {
  const choices = question.choices as { label: string; text: string }[];
  const content = { stem: String(question.stem || ""), choices: choices?.map((choice, index) => ({ label: ["①", "②", "③", "④"][index], text: String(choice.text || "") })), answer: question.answer as number, explanation: String(question.explanation || "") };
  validatePatch(content);
  return content;
}
export function validatePatch(value: unknown): asserts value is QuestionContent {
  const p = value as QuestionContent | null;
  if (!p || typeof p.stem !== "string" || !p.stem.trim() || p.stem.length > 20000 || !Array.isArray(p.choices) || p.choices.length !== 4 || p.choices.some((choice) => typeof choice.text !== "string" || !choice.text.trim() || choice.text.length > 10000) || !Number.isInteger(p.answer) || p.answer < 0 || p.answer > 3 || typeof p.explanation !== "string" || p.explanation.length > 20000) throw new Error("invalid_question_patch");
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
  return { ...question, images: question.images.filter((image: string) => /^images\/[a-f0-9]{2}\/[a-f0-9]{64}\.[a-z0-9]+$/i.test(image)).map((image: string) => `${origin}/${image}`) };
}
