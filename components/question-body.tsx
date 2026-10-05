import type { Question } from "@/lib/question-bank";

// An official full-question crop already contains its stem and every option.
// Display it once. Text-only questions and legacy diagram assets keep their
// usual presentation; the audited bundle explicitly selects the mode.
export function QuestionBody({ question, heading: Heading = "h1" }: { question: Question; heading?: "h1" | "h3" }) {
  const original = question.displayMode === "source_image" && question.images.length > 0;
  const images = question.images.length > 0 && <div className="question-image-list">
    {question.images.map((src, index) => <img src={src} key={src}
      alt={original || question.displayMode === "corrected_source" ? `원문 문제와 보기 ${index + 1}` : "문항 참고 이미지"} />)}
  </div>;
  return <>
    <Heading className={original ? "sr-only" : undefined}>{question.stem}</Heading>
    {question.displayMode === "corrected_source" && images
      ? <details><summary>원문 문제와 그림 보기</summary>{images}</details> : images}
  </>;
}
