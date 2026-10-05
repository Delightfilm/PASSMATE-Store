"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CbtMateLogo, PassmateLogo } from "./logo";
import { AuthNav } from "./auth-nav";
import { ServiceSwitcher } from "./service-switcher";

export function SiteHeader({ showOnExam = false }: { showOnExam?: boolean } = {}) {
  const pathname = usePathname();
  const cbt = pathname.startsWith("/cbt");
  const admin = pathname.startsWith("/admin");
  const store = pathname === "/" || /^\/(store|products|library|cart|checkout)(\/|$)/.test(pathname) || /^\/account\/(login|signup)(\/|$)/.test(pathname);
  const exam = /^\/cbt\/[^/]+\/exam\//.test(pathname);
  const detailPath = /^\/cbt\/[^/]+\/?$/.test(pathname) && !/^\/cbt\/(wrong-notes|bookmarks|history)\/?$/.test(pathname);

  const cbtLinks = [
    { href: "/cbt/", label: "종목 선택", active: pathname === "/cbt" || pathname === "/cbt/" || detailPath },
    { href: "/cbt/wrong-notes/", label: "오답노트", active: pathname.startsWith("/cbt/wrong-notes") },
    { href: "/cbt/bookmarks/", label: "북마크", active: pathname.startsWith("/cbt/bookmarks") },
    { href: "/cbt/history/", label: "내 기록", active: pathname.startsWith("/cbt/history") },
  ];

  if (exam && !showOnExam) return null;

  return (
    <><header className={`site-header${cbt ? " site-header--cbt" : ""}${admin ? " site-header--admin" : ""}${store ? " site-header--store" : ""}`}>
      <div className="container nav-wrap">
        <Link href={cbt ? "/cbt/" : "/"} className="logo-link" aria-label={cbt ? "CBT MATE 홈" : "PASSMATE 홈"}>
          {cbt ? <CbtMateLogo priority /> : <PassmateLogo compact />}
        </Link>
        {!admin && <nav className="main-nav" aria-label={cbt ? "CBT 주요 메뉴" : "스토어 주요 메뉴"}>
          {cbt ? cbtLinks.map((item) => (
            <Link className={item.active ? "is-active" : ""} aria-current={item.active ? "page" : undefined} href={item.href} key={item.href}>{item.label}</Link>
          )) : <>
            <Link className={pathname.startsWith("/products") ? "is-active" : ""} aria-current={pathname.startsWith("/products") ? "page" : undefined} href="/products">요약노트</Link>
            <Link className={pathname.startsWith("/library") ? "is-active" : ""} aria-current={pathname.startsWith("/library") ? "page" : undefined} href="/library">내 자료</Link>
          </>}
        </nav>}
        {admin && <span className="header-context">관리자</span>}
        <div className="header-actions"><ServiceSwitcher /><AuthNav service={cbt ? "cbt" : "passmate"} /></div>
      </div>
      {cbt && <nav className="mobile-cbt-nav" aria-label="CBT 모바일 주요 메뉴">
        {cbtLinks.map((item) => <Link href={item.href} aria-current={item.active ? "page" : undefined} key={item.href}>{item.label}</Link>)}
      </nav>}
    </header>{store && <div className="store-mobile-switcher"><div className="container"><ServiceSwitcher /></div></div>}</>
  );
}
