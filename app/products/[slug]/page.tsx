import type { Metadata } from "next";
export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { STORE_ENABLED } from "@/lib/store-availability";
import { StoreUnavailable } from "@/components/store-unavailable";
import { ProductGallery } from "@/components/product-gallery";
import { getProduct } from "@/lib/products";
import { ProductPurchaseOptions } from "@/components/product-purchase-options";
import { getServerProductPrices } from "@/lib/server-product-prices";
import { getPackageSlug } from "@/lib/cart";
import { ProductSectionNav } from "@/components/product-section-nav";
import {
  getCoreProductTitle,
  getCustomerCopy,
} from "@/lib/product-display";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  if (!STORE_ENABLED) return { title: "스토어 준비중 | PASSMATE", description: "패스메이트 스토어는 준비 중입니다.", robots: { index: false, follow: true } };
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "상품을 찾을 수 없습니다 | PASSMATE" };
  const title = getCoreProductTitle(product.title);
  return { title: `${title} | PASSMATE`, description: `${title} 요약노트의 구성과 구매 정보를 확인하세요.` };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!STORE_ENABLED) return <StoreUnavailable />;
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const prices = await getServerProductPrices([getPackageSlug(slug, "core"), getPackageSlug(slug, "pass")]);

  const isStageSoundCore = product.code === "PM-SS3-CORE";
  const displayTitle = getCoreProductTitle(product.title);

  return (
    <section className="section page-section product-detail">
      <div className="container product-section-nav-shell"><ProductSectionNav /></div>
      <div className="container product-detail-grid">
        <div className="product-visual-column" id="product-overview">
          <ProductGallery
            theme={isStageSoundCore ? "light" : "dark"}
            year={product.year}
            titleLines={
              isStageSoundCore
                ? ["무대음향", "3급"]
                : ["컴퓨터활용능력", "2급"]
            }
            series={isStageSoundCore ? "STAGE SOUND" : "PASSMATE"}
          />
        </div>
        <div className="product-info">
          <span className="pill">핵심노트</span>
          <h1>{product.year}<br/>{displayTitle}</h1>
          <p>{getCustomerCopy(product.description)}</p>
          <div className="price-row">
            <h2 id="product-package">패키지 선택</h2>
            <span>디지털 PDF</span>
          </div>
          <ProductPurchaseOptions slug={product.slug} title={displayTitle} initialPrices={prices} />
        </div>
      </div>
    </section>
  );
}
