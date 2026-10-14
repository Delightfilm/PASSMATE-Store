import type { Metadata } from "next";
import Link from "next/link";
import { getPrivacyDocument } from "@/lib/privacy-document";
import { businessInfo } from "@/lib/business-info";
import { BusinessInformation } from "@/components/business-information";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "개인정보처리방침 | PASSMATE",
  description: "PASSMATE의 회원·학습·AI·분석 정보 처리와 확인된 보관·국외 처리 사항, 개인정보 문의처를 안내합니다.",
  alternates: { canonical: "/privacy/" },
};

export default function PrivacyPage() {
  const document = getPrivacyDocument();
  return <article className="legal-policy" aria-labelledby="legal-policy-title">
    <header>
      <h1 id="legal-policy-title">{document.title}</h1>
      <p className="legal-policy-date">시행일 <time dateTime={document.effectiveDate}>{document.effectiveDate}</time></p>
      <nav className="legal-policy-links" aria-label="다른 정책"><Link href="/terms/" prefetch={false}>이용약관</Link></nav>
    </header>
    <nav className="legal-policy-toc" aria-label="개인정보처리방침 목차">
      {document.blocks.map(block => block.kind === "heading" ? <a key={block.id} href={`#${block.id}`}>{block.text}</a> : null)}
    </nav>
    <div className="legal-policy-body">
      {document.blocks.map((block, index) => {
        if (block.kind === "heading") return <h3 id={block.id} key={block.id}>{block.text}</h3>;
        if (block.kind === "list") return <ol key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ol>;
        if (block.kind === "table") return <div className="legal-policy-table" role="region" aria-label={`${block.headers[0]} 안내 표`} tabIndex={0} key={index}><table><thead><tr>{block.headers.map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
        return <p key={index}>{block.text}</p>;
      })}
    </div>
    <section className="legal-policy-business" aria-label="개인정보 책임자와 사업자 정보">
      <dl className="business-information"><div><dt>개인정보보호책임자</dt><dd>{businessInfo.privacyOfficer}</dd></div>{businessInfo.email && <div><dt>개인정보 문의</dt><dd><a href={`mailto:${businessInfo.email}`}>{businessInfo.email}</a></dd></div>}</dl>
      <BusinessInformation />
    </section>
    <nav className="legal-policy-links" aria-label="개인정보 설정 및 권익 구제">
      <Link href="/analytics-settings/" prefetch={false}>분석 설정</Link>
      <a href="https://privacy.kisa.or.kr/">개인정보침해신고센터</a>
      <a href="https://www.privacy.go.kr/front/contents/cntntsView.do?contsNo=49">개인정보분쟁조정 안내</a>
    </nav>
  </article>;
}
