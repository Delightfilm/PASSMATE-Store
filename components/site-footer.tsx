"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { businessInfo } from "@/lib/business-info";
import { BusinessInformation } from "./business-information";

export function SiteFooter() {
  const pathname = usePathname();
  if (/^\/cbt\/[^/]+\/exam\//.test(pathname)) return null;
  return (
    <footer className="site-footer site-footer--business">
      <div className="footer-container">
        <div className="footer-topline">
          <p className="footer-copyright">© 2026 PASSMATE</p>
          <nav className="footer-navigation" aria-label="하단 메뉴">
            <Link href="/cbt/" prefetch={false}>문제은행</Link>
            <Link href="/store/" prefetch={false}>스토어</Link>
            <Link href="/library/" prefetch={false}>내 자료</Link>
            {businessInfo.email && <a href={`mailto:${businessInfo.email}`}>문의</a>}
          </nav>
        </div>
        <div className="footer-business-block">
          <BusinessInformation />
        </div>
      </div>
    </footer>
  );
}
