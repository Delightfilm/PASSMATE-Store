import { getSupabaseBrowserClient } from "./supabase-browser";
import type { Dataset, Question } from "./question-bank";
import type { LoadOptions } from "./question-bank-download";
import { correctedChoices } from "./question-bank-choices";
import { validatePatch, type QuestionContent } from "../supabase/functions/question-bank-admin/question-review";

export type Correction = { question_ref: string; source_hash: string; content: QuestionContent };
export function applyCorrections(dataset: Dataset, corrections: Correction[]): Dataset {
  const map = new Map(corrections.map((correction) => [correction.question_ref, correction]));
  return { ...dataset, questions: dataset.questions.map((question) => {
    const correction = map.get(question.id);
    if (!correction || correction.source_hash !== question.sourceHash) return question;
    const content = correction.content;
    try { validatePatch(content); } catch { throw new Error("question_correction_invalid"); }
    // Preserve IDs, source hash and exam/qualification metadata; modern edits own media.
    return { ...question, stem: content.stem, choices: correctedChoices(question.choices, content.choices, content.schemaVersion === 2), answer: content.answer, explanation: content.explanation,
      ...(content.schemaVersion === 2 ? {images: content.images!} : {}),
      ...(question.displayMode === "source_image" && (content.stem !== question.stem || content.choices.length !== question.choices.length || content.choices.some((choice, index) => choice.text !== question.choices[index]?.text) || (content.schemaVersion === 2 && (JSON.stringify(content.images) !== JSON.stringify(question.images) || content.choices.some((choice,index)=>JSON.stringify(choice.images||[])!==JSON.stringify(question.choices[index]?.images||[]))))) ? { displayMode: "corrected_source" as const } : {}),
      acceptedAnswers: content.schemaVersion === 2 ? [...content.acceptedAnswers!] : [content.answer], answerStatus: undefined, answerLabel: undefined,
      inferredAnswers: undefined, inferredAnswerNote: undefined, answerComparison: undefined };
  }) };
}

export async function loadQuestionCorrections(dataset: Dataset, options: LoadOptions = {}): Promise<Dataset> {
  options.signal?.throwIfAborted();
  if (!dataset.questions.length) return dataset;
  const supabase = getSupabaseBrowserClient();
  const corrections: Correction[] = [];
  // Fresh reads outside the NAS bundle cache ensure edits appear on the next load.
  for (const code of new Set(dataset.questions.map((question) => question.certId))) {
    for (let offset = 0; ; offset += 1000) {
      const query = supabase.from("question_bank_question_corrections").select("question_ref,source_hash,content").eq("qualification_code", code).order("question_ref").range(offset, offset + 999);
      const { data, error } = await (options.signal ? query.abortSignal(options.signal) : query);
      options.signal?.throwIfAborted();
      if (error) throw new Error("question_corrections_load_failed");
      corrections.push(...(data || []) as Correction[]);
      if (!data || data.length < 1000) break;
    }
  }
  return applyCorrections(dataset, corrections);
}
