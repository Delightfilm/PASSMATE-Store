import type { Question } from "./question-bank";

export const EXPLANATION_MODEL = "alibaba/qwen3.7-flash";
export const EXPLANATION_VERSION = "answer-locked-v1";
export const VERIFICATION_VERSION = "answer-blind-v2";
export const REPAIR_VERSION = "answer-repair-v2";
export type AiExplanation = {
  correctAnswer: number;
  summary: string;
  choiceReasons: string[];
};
export type ExplanationReply = {
  status: "ready" | "generating" | "refused" | "failed";
  explanation?: AiExplanation;
  cached?: boolean;
  message?: string;
  retryable?: boolean;
  repairVersion?: string;
  verification?: { version: string; solvedAnswer: number; explanationAnswer: number };
};

export function hasAnswerVerification(value: Pick<ExplanationReply, "verification">, answer: number) {
  return value.verification?.version === VERIFICATION_VERSION &&
    value.verification.solvedAnswer === answer && value.verification.explanationAnswer === answer;
}

// Identical for every selected wrong answer/user. An admin edit changes the key.
export function explanationInput(question: Question) {
  return { version: EXPLANATION_VERSION, model: EXPLANATION_MODEL, id: question.id, certId: question.certId,
    sourceHash: question.sourceHash, stem: question.stem, choices: question.choices,
    answer: question.answer, images: question.images, explanation: question.explanation };
}

export function validateExplanation(value: unknown, answer: number): AiExplanation {
  const item = value as AiExplanation;
  if (!item || item.correctAnswer !== answer || typeof item.summary !== "string" ||
      item.summary.trim().length < 10 || item.summary.length > 2200 ||
      !Array.isArray(item.choiceReasons) || item.choiceReasons.length !== 4 ||
      !item.choiceReasons.every((text) => typeof text === "string" && text.trim().length >= 5 && text.length <= 900)) {
    throw new Error("explanation_invalid");
  }
  const text = [item.summary, ...item.choiceReasons].join("\n");
  // Defense in depth: the semantic verifier also checks contradictions/negative stems.
  if (/[<>]|https?:\/\/|등록된\s*정답.{0,10}(틀렸|오류|잘못)/i.test(text)) throw new Error("explanation_unsafe");
  for (let i = 0; i < 4; i++) {
    if (i === answer) continue;
    const label = ["①", "②", "③", "④"][i];
    const pattern = new RegExp(`(?:정답(?:은|는|이)?\\s*(?:${label}|${i + 1}\\s*번)|(?:${label}|${i + 1}\\s*번)\\s*(?:이|가|은|는)?\\s*정답(?:입니다|이다|이에요|이다))`);
    if (pattern.test(text)) throw new Error("explanation_contradiction");
  }
  return { correctAnswer: answer, summary: item.summary.trim(), choiceReasons: item.choiceReasons.map((text) => text.trim()) };
}
