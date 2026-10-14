import type { Metadata } from "next";
import Link from "next/link";
import { getAutomationTerms } from "@/lib/legal-document";
import { BusinessInformation } from "@/components/business-information";
import { businessInfo } from "@/lib/business-info";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "이용약관 | PASSMATE",
  description: "PASSMATE의 회원·학습·AI 해설·콘텐츠 이용, 자동화 접근 제한 및 소비자 권리에 관한 이용약관입니다.",
  alternates: { canonical: "/terms/" },
};

export default function TermsPage() {
  const document = getAutomationTerms();
  return <article className="legal-policy" aria-labelledby="legal-policy-title">
    <header><h1 id="legal-policy-title">{document.title}</h1><p className="legal-policy-date">시행일 <time dateTime={document.effectiveDate}>{document.effectiveDate}</time></p></header>
    <div className="legal-policy-body">{document.blocks.map((block, index) => block.kind === "heading" ? <h2 key={index}>{block.text}</h2> : block.kind === "list" ? <ol key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ol> : <p key={index}>{block.text}</p>)}</div>
    <nav className="legal-policy-links" aria-label="정책 문의 및 학습"><Link href="/cbt/" prefetch={false}>문제은행으로</Link>{businessInfo.email && <a href={`mailto:${businessInfo.email}`}>문의하기</a>}</nav>
    <section className="legal-policy-business" aria-label="사업자 정보"><BusinessInformation /></section>
  </article>;
}
