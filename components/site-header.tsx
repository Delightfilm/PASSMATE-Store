import Link from "next/link";
import { PassmateLogo } from "./logo";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <Link href="/" className="logo-link"><PassmateLogo compact /></Link>
        <nav className="main-nav" aria-label="주요 메뉴">
          <Link href="/products">요약노트</Link>
          <Link href="/library">내 자료</Link>
        </nav>
        <Link href="/products/computer-literacy-2" className="nav-cta">첫 상품 보기</Link>
      </div>
    </header>
  );
}
