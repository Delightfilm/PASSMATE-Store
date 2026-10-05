"use client";

import Image from "next/image";
import { useState } from "react";
import type { Choice } from "@/lib/question-bank";

function ChoiceImage({ src, label }: { src: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="choice-image-error" role="status">{label}를 불러오지 못했습니다. 오류 신고를 이용해 주세요.</span>;
  // Formula/diagram dimensions vary. Native, unoptimized NAS bytes avoid paid
  // optimization and preserve GIF formulas; the containing row stays responsive.
  return <span className="choice-image"><Image src={src} alt={label} width={640} height={160}
    unoptimized style={{ width: "auto", height: "auto", maxWidth: "100%" }} onError={() => setFailed(true)} /></span>;
}

export function QuestionChoiceContent({ choice, sourceImage = false }: { choice: Choice; sourceImage?: boolean }) {
  if (sourceImage) return <span className="question-choice-content"><span aria-hidden="true">원문 보기</span><span className="sr-only">{choice.text || `${choice.label}번 보기`}</span></span>;
  return <span className="question-choice-content">{choice.text && <span>{choice.text}</span>}
    {(choice.images || []).map((src, index) => <ChoiceImage key={src} src={src} label={`${choice.label}번 보기 이미지 ${index + 1}`} />)}
  </span>;
}
