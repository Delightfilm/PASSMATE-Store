import type { Metadata } from "next";

export const metadata: Metadata = { title: "요약노트 | PASSMATE", description: "자격증별 요약노트를 비교하고 내 학습에 맞는 자료를 선택하세요." };

import { ProductCard } from "@/components/product-card";
import { getProducts } from "@/lib/products";
import { getServerProductPrices } from "@/lib/server-product-prices";

export default async function ProductsPage() {
  const products = await getProducts();
  const prices = await getServerProductPrices(products.map(product => product.slug));

  return (
    <section className="section page-section">
      <div className="container">
        <div className="section-heading">
          <h1 className="page-title">요약노트</h1>
          <p className="page-lead">자격증별 요약노트를 순차 발행합니다.</p>
        </div>
        {products.length > 0 ? (
          <div className="product-list">{products.map((p) => <ProductCard key={p.slug} product={p} initialPrice={prices[p.slug]} />)}</div>
        ) : (
          <p className="page-lead">현재 판매 중인 요약노트가 없습니다.</p>
        )}
      </div>
    </section>
  );
}
