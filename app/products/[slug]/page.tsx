import { notFound } from "next/navigation";
import { ProductCover } from "@/components/product-cover";
import { getProduct, getStaticProductSlugs } from "@/lib/products";
import { ProductPurchaseOptions } from "@/components/product-purchase-options";
import {
  getCoreProductTitle,
  getCustomerCopy,
  getCustomerFeatureLabel,
  getProductFamilyTitle,
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
  const familyTitle = getProductFamilyTitle(product.title);
  const displayTitle = getCoreProductTitle(product.title);
  const displayFeatures = product.features.map(getCustomerFeatureLabel);
  const packageFeatures = isStageSoundCore
    ? displayFeatures.slice(0, 3)
    : displayFeatures.slice(0, 4);

  return (
    <section className="section page-section product-detail">
      <div className="container product-detail-grid">
        <div className="product-visual-column">
          <div className="product-cover-wrap">
            <ProductCover
              theme={isStageSoundCore ? "light" : "dark"}
              year={product.year}
              titleLines={
                isStageSoundCore
                  ? ["무대음향", "3급"]
                  : ["컴퓨터활용능력", "2급"]
              }
              label="핵심노트"
              subtitle="핵심개념 · 공식·수치 · 시험 직전 체크"
              series={isStageSoundCore ? "STAGE SOUND" : "PASSMATE"}
            />
          </div>

          <section className="inside-preview" aria-labelledby="inside-preview-title">
            <div className="inside-preview-heading">
              <div>
                <span className="eyebrow">INSIDE PREVIEW</span>
                <h2 id="inside-preview-title">내부 속지 미리보기</h2>
              </div>
              <span>3 PAGES</span>
            </div>
            <div className="inside-preview-pages">
              <article className="inside-preview-page inside-preview-page--summary">
                <div className="inside-preview-page-top"><span>01</span><small>{familyTitle}</small></div>
                <h3>핵심개념</h3>
                <p>개념의 흐름을 빠르게 이해하는 요약 페이지</p>
                <ul><li>핵심 정의</li><li>개념 간 관계</li><li>기억할 기준</li></ul>
              </article>
              <article className="inside-preview-page inside-preview-page--sheet">
                <div className="inside-preview-page-top"><span>02</span><small>{familyTitle}</small></div>
                <h3>공식·수치</h3>
                <p>항목별 기준을 한눈에 비교하는 정리표</p>
                <div className="inside-preview-table"><span>항목</span><span>기준</span><span>확인</span></div>
              </article>
              <article className="inside-preview-page inside-preview-page--check">
                <div className="inside-preview-page-top"><span>03</span><small>{familyTitle}</small></div>
                <h3>시험 직전</h3>
                <p>마지막 회독에 사용하는 체크리스트</p>
                <ul><li>핵심 용어</li><li>공식·단위</li><li>최종 확인</li></ul>
              </article>
            </div>
            <p className="inside-preview-note">일부 페이지를 축약한 샘플이며 실제 PDF에서는 더 자세한 내용을 제공합니다.</p>
          </section>
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
