import { getSupabaseBrowserClient } from "./supabase-browser";
import type { Dataset, Question } from "./question-bank";
import type { LoadOptions } from "./question-bank-download";
import { correctedChoices } from "./question-bank-choices";

export type Correction = { question_ref: string; source_hash: string; content: Pick<Question, "stem" | "choices" | "answer" | "explanation"> };
export function applyCorrections(dataset: Dataset, corrections: Correction[]): Dataset {
  const map = new Map(corrections.map((correction) => [correction.question_ref, correction]));
  return { ...dataset, questions: dataset.questions.map((question) => {
    const correction = map.get(question.id);
    if (!correction || correction.source_hash !== question.sourceHash) return question;
    const content = correction.content;
    if (!content || typeof content.stem !== "string" || !Array.isArray(content.choices) || content.choices.length !== 4 || !Number.isInteger(content.answer) || content.answer < 0 || content.answer > 3 || typeof content.explanation !== "string") throw new Error("question_correction_invalid");
    // Never overwrite IDs, source hash, images or exam/qualification metadata.
    return { ...question, stem: content.stem, choices: correctedChoices(question.choices, content.choices), answer: content.answer, explanation: content.explanation,
      ...(question.displayMode === "source_image" && (content.stem !== question.stem || content.choices.some((choice, index) => choice.text !== question.choices[index]?.text)) ? { displayMode: "corrected_source" as const } : {}),
      acceptedAnswers: [content.answer], answerStatus: undefined, answerLabel: undefined,
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
