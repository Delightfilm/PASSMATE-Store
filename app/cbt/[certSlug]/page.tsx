import type { Metadata } from "next";
import { QuestionBankClient } from "@/components/question-bank-client";

export async function generateMetadata({ params }: { params: Promise<{ certSlug: string }> }): Promise<Metadata> {
  const { certSlug } = await params;
  const name = decodeURIComponent(certSlug).replace(/-/g, " ");
  return { title: `${name} | CBT MATE`, description: `${name}의 회차별 기출과 단원별 문제를 풀고 모의고사를 만드세요.` };
}

export default async function CertPage({ params }: { params: Promise<{ certSlug: string }> }) {
  const { certSlug } = await params;
  return <QuestionBankClient mode="cert" certParam={certSlug} />;
}
