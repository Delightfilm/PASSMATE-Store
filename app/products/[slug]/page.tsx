import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/product-gallery";
import { getProduct, getStaticProductSlugs } from "@/lib/products";
import { ProductPurchaseOptions } from "@/components/product-purchase-options";
import {
  getCoreProductTitle,
  getCustomerCopy,
  getCustomerFeatureLabel,
} from "@/lib/product-display";

export async function generateStaticParams() {
  return await getStaticProductSlugs();
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const isStageSoundCore = product.code === "PM-SS3-CORE";
  const displayTitle = getCoreProductTitle(product.title);
  const displayFeatures = product.features.map(getCustomerFeatureLabel);
  const packageFeatures = isStageSoundCore
    ? displayFeatures.slice(0, 3)
    : displayFeatures.slice(0, 4);

  return (
    <section className="section page-section product-detail">
      <div className="container product-detail-grid">
        <div className="product-visual-column">
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
          <span className="pill">PASSMATE 핵심노트</span>
          <h1>{product.year}<br/>{displayTitle}</h1>
          <p className="product-subtitle">{getCustomerCopy(product.subtitle)}</p>
          <p>{getCustomerCopy(product.description)}</p>
          <ul className="check-list">
            {displayFeatures.map((feature) => (
              <li key={feature}>✓ {feature}</li>
            ))}
          </ul>
          <div className="price-row">
            <strong>패키지 선택</strong>
            <span>현재 판매가는 아래 옵션에서 확인 · 디지털 PDF</span>
          </div>
          <ProductPurchaseOptions slug={product.slug} title={displayTitle} />
        </div>
      </div>
      <div className="container detail-band detail-band--dynamic">
        {packageFeatures.map((feature, index) => (
          <div key={feature}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <span>{feature}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
