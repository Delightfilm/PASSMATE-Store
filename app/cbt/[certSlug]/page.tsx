import type { Metadata } from "next";
import { QuestionBankClient } from "@/components/question-bank-client";
import { publicQualifications, qualificationHref } from "@/lib/cbt-home-catalog";
import { publicMetadata, privateMetadata } from "@/lib/seo";
import { QualificationIntro, QualificationStudyGuide } from "@/components/cbt-public-content";
import { qualificationGuide } from "@/lib/cbt-public-content";

export async function generateMetadata({ params }: { params: Promise<{ certSlug: string }> }): Promise<Metadata> {
  const { certSlug } = await params;
  let slug: string;
  try { slug = decodeURIComponent(certSlug); }
  catch { return { title: "종목을 찾을 수 없습니다 | PASSMATE", ...privateMetadata }; }
  const qualification = publicQualifications.find(item => item.slug === slug);
  if (!qualification) return { title: "종목을 찾을 수 없습니다 | PASSMATE", ...privateMetadata };
  const name = qualification.title;
  const guide = qualificationGuide(slug);
  return publicMetadata(`${name}${/기능사$/.test(name) ? " 필기" : ""} 기출문제·CBT 문제은행 | PASSMATE`, `${name} ${guide ? `${guide.years}년 ` : ""}기출문제를 회차별로 풀어보세요. CBT 모의시험으로 점검하고 정답 확인과 오답 복습을 이어갈 수 있습니다.`, qualificationHref(qualification.slug));
}

export default async function CertPage({ params }: { params: Promise<{ certSlug: string }> }) {
  const { certSlug } = await params;
  let slug: string;
  try { slug = decodeURIComponent(certSlug); } catch { return <QuestionBankClient mode="cert" certParam={certSlug} />; }
  const qualification = publicQualifications.find(item => item.slug === slug);
  if (!qualification) return <QuestionBankClient mode="cert" certParam={certSlug} />;
  return <><QualificationIntro qualification={qualification} /><QuestionBankClient mode="cert" certParam={certSlug} /><QualificationStudyGuide qualification={qualification} /></>;
}
