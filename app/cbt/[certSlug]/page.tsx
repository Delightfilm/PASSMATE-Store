import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuestionBankClient } from "@/components/question-bank-client";

export async function generateMetadata({ params }: { params: Promise<{ certSlug: string }> }): Promise<Metadata> {
  const { certSlug } = await params;
  const name = decodeURIComponent(certSlug).replace(/-/g, " ");
  return { title: `${name} | CBT MATE`, description: `${name}의 회차별 기출과 단원별 문제를 풀고 모의시험이나 맞춤 시험지를 시작하세요.` };
}

export default async function CertPage({ params, searchParams }: { params: Promise<{ certSlug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ certSlug }, query] = await Promise.all([params, searchParams]);
  if (query.tab === "builder") {
    const canonical = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) canonical.append(key, item);
    canonical.set("tab", "custom");
    redirect(`/cbt/${encodeURIComponent(decodeURIComponent(certSlug))}/?${canonical}`);
  }
  return <QuestionBankClient mode="cert" certParam={certSlug} />;
}
