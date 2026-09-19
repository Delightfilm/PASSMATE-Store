"use client";

import { useSearchParams } from "next/navigation";
import { AdminProductPreview } from "@/components/admin-product-preview";

export function AdminProductPreviewQuery() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code")?.trim() ?? "";

  if (!code) {
    return (
      <div className="admin-denied">
        <strong>상품 코드가 없습니다.</strong>
        <p>관리자 상품 목록에서 미리보기를 다시 눌러주세요.</p>
      </div>
    );
  }

  return <AdminProductPreview code={code} />;
}
