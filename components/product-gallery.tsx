"use client";

import Image from "next/image";
import { useState } from "react";
import { ProductCover } from "@/components/product-cover";

type ProductGalleryProps = {
  theme: "dark" | "light";
  year: number;
  titleLines: string[];
  series: string;
};

const pageNumbers = [1, 2, 3];

export function ProductGallery({
  theme,
  year,
  titleLines,
  series,
}: ProductGalleryProps) {
  const [selected, setSelected] = useState(0);

  const cover = (
    <ProductCover
      theme={theme}
      year={year}
      titleLines={titleLines}
      label="핵심노트"
      subtitle="핵심개념 · 공식·수치 · 시험 직전 체크"
      series={series}
    />
  );

  return (
    <div className="product-gallery">
      <div className="product-gallery-stage">
        {selected === 0 ? cover : (
          <Image
            className="product-gallery-page"
            src="/images/product-page-placeholder.svg"
            alt={`내부 속지 ${selected} 이미지 준비 중`}
            width={900}
            height={1200}
          />
        )}
        <span className="product-gallery-count">{selected + 1} / 4</span>
      </div>

      <div className="product-gallery-thumbnails" aria-label="상품 이미지 선택">
        <button
          type="button"
          className={selected === 0 ? "product-gallery-thumb product-gallery-thumb--active" : "product-gallery-thumb"}
          onClick={() => setSelected(0)}
          aria-label="상품 표지 보기"
          aria-pressed={selected === 0}
        >
          <ProductCover
            small
            theme={theme}
            year={year}
            titleLines={titleLines}
            label="핵심노트"
            subtitle="핵심개념 · 공식·수치 · 시험 직전 체크"
            series={series}
          />
        </button>
        {pageNumbers.map((pageNumber) => (
          <button
            type="button"
            className={selected === pageNumber ? "product-gallery-thumb product-gallery-thumb--active" : "product-gallery-thumb"}
            onClick={() => setSelected(pageNumber)}
            aria-label={`내부 속지 ${pageNumber} 보기`}
            aria-pressed={selected === pageNumber}
            key={pageNumber}
          >
            <Image
              src="/images/product-page-placeholder.svg"
              alt=""
              width={90}
              height={120}
            />
          </button>
        ))}
      </div>
      <p className="product-gallery-note">실제 속지 이미지는 콘텐츠 확정 후 교체됩니다.</p>
    </div>
  );
}
