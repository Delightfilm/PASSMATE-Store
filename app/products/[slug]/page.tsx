import { notFound } from "next/navigation";
import Link from "next/link";
import { ProductCover } from "@/components/product-cover";
import { getProduct, getStaticProductSlugs } from "@/lib/products";

export async function generateStaticParams() {
  return await getStaticProductSlugs();
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  return (
    <section className="section page-section product-detail">
      <div className="container product-detail-grid">
        <div className="product-cover-wrap"><ProductCover /></div>
        <div className="product-info">
          <span className="pill">PASSMATE CORE 01</span>
          <h1>{product.year}<br/>{product.title}</h1>
          <p className="product-subtitle">{product.subtitle}</p>
          <p>{product.description}</p>
          <ul className="check-list">{product.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
          <div className="price-row"><strong>{product.price.toLocaleString("ko-KR")}원</strong><span>디지털 PDF</span></div>
          <Link href={"/checkout/?product=" + product.slug} className="button button-primary button-wide">구매 준비 화면 보기</Link>
          <p className="fine-print">※ 현재는 기반 구축 단계이며 실제 결제는 아직 연결하지 않았습니다.</p>
        </div>
      </div>
      <div className="container detail-band">
        <div><b>CORE</b><span>20~30P 핵심요약</span></div>
        <div><b>CRAM</b><span>약 10P 벼락치기</span></div>
        <div><b>SHEET</b><span>함수·개념 치트시트</span></div>
        <div><b>CHECK</b><span>실수방지 체크리스트</span></div>
      </div>
    </section>
  );
}
