"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { businessInfo } from "@/lib/business-info";
import { BusinessInformation } from "./business-information";
import { CbtMateLogo, PassmateLogo } from "./logo";

export function SiteFooter() {
  const pathname = usePathname();
  const cbt = pathname.startsWith("/cbt");
  if (/^\/cbt\/[^/]+\/exam\//.test(pathname)) return null;
  return (
    <footer className="site-footer site-footer--business">
      <div className="container footer-topline">
        <div className="footer-brand">
          {cbt ? <CbtMateLogo /> : <PassmateLogo compact />}
          <p className="footer-copy">{cbt ? "짧게 풀고 꾸준히 익히는 CBT 문제은행." : "합격까지 함께하는 요약노트."}</p>
        </div>
        <nav className="footer-navigation" aria-label="하단 메뉴">
          <Link href="/cbt/" prefetch={false}>문제은행</Link>
          <Link href="/store/" prefetch={false}>스토어</Link>
          <Link href="/library/" prefetch={false}>내 자료</Link>
          {businessInfo.email && <a href={`mailto:${businessInfo.email}`}>문의</a>}
        </nav>
      </div>
      <div className="container footer-business-block">
        <BusinessInformation />
        <p className="footer-copyright">© PASSMATE. All rights reserved.</p>
      </div>
    </footer>
  );
}
