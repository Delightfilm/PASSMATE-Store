"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PassmateLogo } from "./logo";
import { AuthNav } from "./auth-nav";
import { ServiceSwitcher } from "./service-switcher";

export function SiteHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cbt = pathname.startsWith("/cbt");
  const admin = pathname.startsWith("/admin");
  const exam = /^\/cbt\/[^/]+\/exam\//.test(pathname);
  const detailPath = /^\/cbt\/[^/]+\/?$/.test(pathname) && !/^\/cbt\/(wrong-notes|bookmarks|history)\/?$/.test(pathname);
  const builderActive = searchParams.get("tab") === "builder";

  const cbtLinks = [
    { href: "/cbt/", label: "종목 선택", active: !builderActive && (pathname === "/cbt" || pathname === "/cbt/" || detailPath) },
    { href: detailPath ? `${pathname}?tab=builder` : "/cbt/?tab=builder", label: "모의고사", active: builderActive },
    { href: "/cbt/wrong-notes/", label: "오답노트", active: pathname.startsWith("/cbt/wrong-notes") },
    { href: "/cbt/bookmarks/", label: "북마크", active: pathname.startsWith("/cbt/bookmarks") },
    { href: "/cbt/history/", label: "내 기록", active: pathname.startsWith("/cbt/history") },
  ];

  if (exam) return null;

  return (
    <header className={`site-header${cbt ? " site-header--cbt" : ""}${admin ? " site-header--admin" : ""}`}>
      <div className="container nav-wrap">
        <Link href="/" className="logo-link" aria-label="PASSMATE 홈">
          <PassmateLogo compact />
        </Link>
        <ServiceSwitcher />
        {!admin && <nav className="main-nav" aria-label={cbt ? "CBT 주요 메뉴" : "스토어 주요 메뉴"}>
          {cbt ? cbtLinks.map((item) => (
            <Link className={item.active ? "is-active" : ""} aria-current={item.active ? "page" : undefined} href={item.href} key={item.href}>{item.label}</Link>
          )) : <>
            <Link href="/products">요약노트</Link>
            <Link href="/library">내 자료</Link>
          </>}
        </nav>}
        {admin && <span className="header-context">관리자</span>}
        <AuthNav service={cbt ? "cbt" : "passmate"} />
      </div>
      {cbt && <nav className="mobile-cbt-nav" aria-label="CBT 모바일 주요 메뉴">
        {cbtLinks.map((item) => <Link href={item.href} aria-current={item.active ? "page" : undefined} key={item.href}>{item.label}</Link>)}
      </nav>}
    </header>
  );
}
