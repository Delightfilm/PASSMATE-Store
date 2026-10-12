import type { Metadata } from "next";
import { HomeProducts } from "@/components/home-products";
import { getProducts } from "@/lib/products";
import { getServerProductPrices } from "@/lib/server-product-prices";
import { getPackageSlug } from "@/lib/cart";
import { ScrollReveal } from "@/components/scroll-reveal";
import { STORE_ENABLED } from "@/lib/store-availability";
import { StoreUnavailable } from "@/components/store-unavailable";

export const metadata: Metadata = STORE_ENABLED
  ? { title: "자격증 핵심노트 스토어 | PASSMATE", description: "자격증 핵심노트와 시험대비 완성패키지의 구성과 가격을 확인하세요." }
  : { title: "스토어 준비중 | PASSMATE", description: "패스메이트 스토어는 준비 중입니다. 문제은행에서 기출문제 풀이와 복습을 이용해 보세요.", robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";

export default async function StoreHome() {
  if (!STORE_ENABLED) return <StoreUnavailable />;
  const products = await getProducts();
  const featured = products.find((product) => product.code === "PM-C2") ?? null;
  const prices = await getServerProductPrices(featured ? [featured.slug, getPackageSlug(featured.slug, "pass")] : []);
  return <div className="store-home">
    <HomeProducts product={featured} initialPrices={prices} />
    <ScrollReveal className="home-method section section-soft" labelledBy="home-method-title">
      <div className="container">
        <div className="section-heading"><h2 id="home-method-title">핵심을 이해하고, 외우고, 점검하세요.</h2></div>
        <div className="home-method-grid">
          <article><strong>01 이해</strong><p>핵심개념 요약노트</p></article>
          <article><strong>02 암기</strong><p>공식·수치 한눈표</p></article>
          <article><strong>03 점검</strong><p>시험 직전 체크리스트</p></article>
        </div>
      </div>
    </ScrollReveal>
  </div>;
}
