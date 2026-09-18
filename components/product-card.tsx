import Link from "next/link";
import type { Product } from "@/lib/products";
import { ProductCover } from "./product-cover";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="product-card">
      <div className="product-visual"><ProductCover small /></div>
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
