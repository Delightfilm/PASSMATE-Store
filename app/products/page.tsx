import { ProductCard } from "@/components/product-card";
import { products } from "@/lib/products";

export default function ProductsPage() {
  return (
    <section className="section page-section">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">PASSMATE LIBRARY</span>
          <h1 className="page-title">요약노트</h1>
          <p className="page-lead">자격증별 CORE · CRAM · SHEET 패키지를 순차 발행합니다.</p>
        </div>
        <div className="product-list">{products.map((p) => <ProductCard key={p.slug} product={p} />)}</div>
      </div>
    </section>
  );
}
