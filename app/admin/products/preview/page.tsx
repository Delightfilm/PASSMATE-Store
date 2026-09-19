import { Suspense } from "react";
import { AdminProductPreviewQuery } from "@/components/admin-product-preview-query";

export default function AdminProductPreviewPage() {
  return (
    <section className="section page-section admin-page">
      <div className="container">
        <Suspense fallback={<p className="admin-loading">상품 미리보기를 불러오는 중입니다...</p>}>
          <AdminProductPreviewQuery />
        </Suspense>
      </div>
    </section>
  );
}
