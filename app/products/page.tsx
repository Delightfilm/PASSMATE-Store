import { ProductCard } from "@/components/product-card";
import { getProducts } from "@/lib/products";

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <section className="section page-section">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">PASSMATE LIBRARY</span>
          <h1 className="page-title">요약노트</h1>
          <p className="page-lead">자격증별 핵심요약 · 치트시트 · 시험직전 체크리스트 패키지를 순차 발행합니다.</p>
        </div>
        {products.length > 0 ? (
          <div className="product-list">{products.map((p) => <ProductCard key={p.slug} product={p} />)}</div>
        ) : (
          <p className="page-lead">현재 판매 중인 요약노트가 없습니다.</p>
        )}
      </div>
    </section>
  );
}
