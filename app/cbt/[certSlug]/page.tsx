import type { Metadata } from "next";
import { QuestionBankClient } from "@/components/question-bank-client";
import { publicQualifications, qualificationHref } from "@/lib/cbt-home-catalog";
import { publicMetadata, privateMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ certSlug: string }> }): Promise<Metadata> {
  const { certSlug } = await params;
  let slug: string;
  try { slug = decodeURIComponent(certSlug); }
  catch { return { title: "종목을 찾을 수 없습니다 | PASSMATE", ...privateMetadata }; }
  const qualification = publicQualifications.find(item => item.slug === slug);
  if (!qualification) return { title: "종목을 찾을 수 없습니다 | PASSMATE", ...privateMetadata };
  const name = qualification.title;
  return publicMetadata(`${name} 기출문제·CBT 모의고사 | PASSMATE`, `${name} 회차별 기출문제를 풀고 CBT 모의고사로 실력을 점검하세요. 정답과 AI 해설을 확인하고 틀린 문제를 오답노트로 복습할 수 있습니다.`, qualificationHref(qualification.slug));
}

export default async function CertPage({ params }: { params: Promise<{ certSlug: string }> }) {
  const { certSlug } = await params;
  return <QuestionBankClient mode="cert" certParam={certSlug} />;
}
