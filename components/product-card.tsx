import Link from "next/link";
import type { Product } from "@/lib/products";
import { ProductCover } from "./product-cover";

export function ProductCard({ product }: { product: Product }) {
  const isStageSoundCore = product.code === "PM-SS3-CORE";

  return (
    <article className="product-card">
      <div className="product-visual">
        <ProductCover
          small
          theme={isStageSoundCore ? "light" : "dark"}
          year={product.year}
          titleLines={isStageSoundCore ? ["무대음향", "3급"] : ["컴퓨터활용능력", "2급"]}
          label={isStageSoundCore ? "핵심요약 NOTE" : "핵심요약 NOTE"}
          subtitle={isStageSoundCore ? "기출 기반 핵심 개념 · 공식 · 숫자 · 함정" : "필기 + 실기 + 벼락치기"}
          series={isStageSoundCore ? "STAGE SOUND" : "CORE 01"}
        />
      </div>
      <div className="product-card-body">
        <span className="eyebrow">{product.badge}</span>
        <h3>{product.year} {product.title}</h3>
        <p>{product.subtitle}</p>
        <div className="product-card-footer">
          <strong>{product.price.toLocaleString("ko-KR")}원</strong>
          <Link href={`/products/${product.slug}`}>자세히 보기 →</Link>
        </div>
      </div>
    </article>
  );
}
