"use client";
export function ProductPrice({ price, failed, retry, suffix = "원" }: { price?: number; failed: boolean; retry: () => void; suffix?: string }) {
  return <span className="product-price-slot" aria-live="polite" aria-busy={price === undefined && !failed}>
    {failed ? <button className="price-retry" type="button" onClick={retry}>가격을 불러오지 못했어요 · 다시 시도</button>
      : price === undefined ? <span className="price-skeleton" role="status" aria-label="가격 조회 중" />
        : <span>{price.toLocaleString("ko-KR")}{suffix}</span>}
  </span>;
}
