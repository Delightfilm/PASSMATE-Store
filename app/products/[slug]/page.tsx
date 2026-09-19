import { notFound } from "next/navigation";
import Link from "next/link";
import { ProductCover } from "@/components/product-cover";
import { getProduct, getStaticProductSlugs } from "@/lib/products";
import { ProductPurchaseOptions } from "@/components/product-purchase-options";

export async function generateStaticParams() {
  return await getStaticProductSlugs();
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const isStageSoundCore = product.code === "PM-SS3-CORE";
  const packageFeatures = isStageSoundCore
    ? product.features.slice(0, 3)
    : product.features.slice(0, 4);

  return (
    <section className="section page-section product-detail">
      <div className="container product-detail-grid">
        <div className="product-cover-wrap">
          <ProductCover
            theme={isStageSoundCore ? "light" : "dark"}
            year={product.year}
            titleLines={isStageSoundCore ? ["무대음향", "3급"] : ["컴퓨터활용능력", "2급"]}
            label="핵심요약 NOTE"
            subtitle={isStageSoundCore ? "기출 기반 핵심 개념 · 공식 · 숫자 · 함정" : "필기 + 실기 + 벼락치기"}
            series={isStageSoundCore ? "STAGE SOUND" : "CORE 01"}
          />
        </div>
        <div className="product-info">
          <span className="pill">PASSMATE CORE 01</span>
          <h1>{product.year}<br/>{product.title}</h1>
          <p className="product-subtitle">{product.subtitle}</p>
          <p>{product.description}</p>
          <ul className="check-list">{product.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
          <div className="price-row"><strong>{product.price.toLocaleString("ko-KR")}원부터</strong><span>디지털 PDF</span></div>
          <ProductPurchaseOptions slug={product.slug} title={product.title} corePrice={product.price} />
        </div>
      </div>
      <div className="container detail-band detail-band--dynamic">
        {packageFeatures.map((feature) => {
          const [first, ...rest] = feature.split(" ");
          const hasCode = ["CORE", "SHEET", "CHECK", "PASS"].includes(first);
          return (
            <div key={feature}>
              <b>{hasCode ? first : "INCLUDED"}</b>
              <span>{hasCode ? rest.join(" ") : feature}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
