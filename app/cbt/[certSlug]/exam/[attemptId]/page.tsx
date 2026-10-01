import type { Metadata } from "next";

export const metadata: Metadata = { title: "CBT 시험 | CBT MATE", description: "기출 및 모의고사 문제를 풀고 결과를 확인하세요." };

import { QuestionBankClient } from "@/components/question-bank-client";

export default async function ExamPage({ params }: { params: Promise<{ certSlug: string; attemptId: string }> }) {
  const { certSlug, attemptId } = await params;
  return <QuestionBankClient mode="exam" certParam={certSlug} attemptId={attemptId} />;
}
