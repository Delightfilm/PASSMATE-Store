"use client";

import { usePathname } from "next/navigation";
import { PassmateLogo } from "./logo";

export function SiteFooter() {
  const pathname = usePathname();
  if (/^\/cbt\/[^/]+\/exam\//.test(pathname)) return null;
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div><PassmateLogo compact /><p className="footer-copy">합격까지 함께하는 요약노트.</p></div>
        <div className="footer-meta"><p>시험에 필요한 핵심만, 더 빠르게.</p><p className="muted">© PASSMATE. All rights reserved.</p></div>
      </div>
    </footer>
  );
}
