import type { Metadata } from "next";
import Link from "next/link";
import { learningGuides, learningGuideHref } from "@/lib/public-learning-guides";

export const metadata: Metadata = { title: "페이지를 찾을 수 없습니다 | PASSMATE", robots: { index: false, follow: true } };

// Search Console reports 404s for URLs that no longer name a page (retired links, mistyped or
// differently encoded slugs). The response still has to be a real 404, but the page it shows can
// help the visitor find the right one instead of Next's default English screen.
export default function NotFound() {
  return <section className="section page-section not-found-page">
    <div className="container">
      <div className="section-heading">
        <p className="eyebrow eyebrow--latin">404</p>
        <h1 className="page-title">페이지를 찾을 수 없습니다</h1>
        <p className="page-lead">주소가 바뀌었거나 더 이상 제공하지 않는 페이지입니다. 아래에서 원하는 시험을 다시 찾아보세요.</p>
      </div>
      <nav className="cbt-public-links" aria-label="다시 찾기">
        <Link href="/cbt/" prefetch={false}>CBT 문제은행 전체 보기</Link>
        <Link href="/" prefetch={false}>PASSMATE 홈</Link>
        {learningGuides.map(guide => <Link key={guide.slug} href={learningGuideHref(guide.slug)} prefetch={false}>{guide.slug.replace(/-([123]급)$/, " $1")} 공부 방법</Link>)}
      </nav>
    </div>
  </section>;
}
