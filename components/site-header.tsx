"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PassmateLogo } from "./logo";
import { AuthNav } from "./auth-nav";

export function SiteHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cbt = pathname.startsWith("/cbt");
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
    <header className={`site-header${cbt ? " site-header--cbt" : ""}`}>
      <div className="container nav-wrap">
        <Link href={cbt ? "/cbt/" : "/"} className="logo-link" aria-label={cbt ? "CBT MATE 홈" : "PASSMATE 홈"}>
          {cbt ? <Image className="cbt-logo" src="/cbtmate-logo.png" width={194} height={38} alt="CBTMATE" priority /> : <PassmateLogo compact />}
        </Link>
        <nav className="main-nav" aria-label="주요 메뉴">
          {cbt ? cbtLinks.map((item) => (
            <Link className={item.active ? "is-active" : ""} href={item.href} key={item.href}>{item.label}</Link>
          )) : <>
            <Link href="/products">요약노트</Link>
            <Link href="/library">내 자료</Link>
          </>}
        </nav>
        {!cbt && <Link href="/products/computer-literacy-2" className="nav-cta">첫 상품 보기</Link>}
        <AuthNav service={cbt ? "cbt" : "passmate"} />
      </div>
    </header>
  );
}
