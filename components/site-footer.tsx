"use client";

import { usePathname } from "next/navigation";
import { CbtMateLogo, PassmateLogo } from "./logo";
import { BusinessInformation } from "./business-information";

export function SiteFooter() {
  const pathname = usePathname();
  const cbt = pathname.startsWith("/cbt");
  if (/^\/cbt\/[^/]+\/exam\//.test(pathname)) return null;
  return (
    <footer className="site-footer site-footer--business">
      <div className="container footer-grid">
        <div>{cbt ? <CbtMateLogo /> : <PassmateLogo compact />}<p className="footer-copy">{cbt ? "짧게 풀고 꾸준히 익히는 CBT 문제은행." : "합격까지 함께하는 요약노트."}</p></div>
        <div className="footer-meta">{cbt && <p>시험에 필요한 핵심만, 더 빠르게.</p>}<p className="muted">© PASSMATE. All rights reserved.</p></div>
      </div>
      <div className="container footer-business-block"><BusinessInformation /></div>
    </footer>
  );
}
