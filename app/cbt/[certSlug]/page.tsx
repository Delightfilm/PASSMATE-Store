import { QuestionBankClient } from "@/components/question-bank-client";

export default async function CertPage({ params }: { params: Promise<{ certSlug: string }> }) {
  const { certSlug } = await params;
  return <QuestionBankClient mode="cert" certParam={certSlug} />;
}
