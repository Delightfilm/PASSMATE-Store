import { QuestionBankClient } from "@/components/question-bank-client";

export default async function ExamPage({ params }: { params: Promise<{ certSlug: string; attemptId: string }> }) {
  const { certSlug, attemptId } = await params;
  return <QuestionBankClient mode="exam" certParam={certSlug} attemptId={attemptId} />;
}
