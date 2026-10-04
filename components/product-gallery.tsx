"use client";

import Image from "next/image";
import { useState } from "react";
import { ProductCover } from "@/components/product-cover";

type ProductGalleryProps = {
  theme: "dark" | "light";
  year: number;
  titleLines: string[];
  series: string;
  pages?: readonly { src: string; alt: string }[];
};

export function ProductGallery({ theme, year, titleLines, series, pages = [] }: ProductGalleryProps) {
  const [selected, setSelected] = useState(0);
  const availablePages = pages.filter((page) => page.src && !page.src.includes("placeholder"));
  const page = availablePages[selected - 1];
  const cover = (small = false) => <ProductCover small={small} theme={theme} year={year} titleLines={titleLines} label="핵심노트" subtitle="핵심개념 · 공식·수치 · 시험 직전 체크" series={series} />;

  return <div className="product-gallery">
    <div className="product-gallery-stage">
      {page ? <Image className="product-gallery-page" src={page.src} alt={page.alt} width={900} height={1200} /> : cover()}
      {availablePages.length > 0 && <span className="product-gallery-count">{page ? selected + 1 : 1} / {availablePages.length + 1}</span>}
    </div>
    {availablePages.length > 0 && <div className="product-gallery-thumbnails" aria-label="상품 이미지 선택">
      <button type="button" className={`product-gallery-thumb${!page ? " product-gallery-thumb--active" : ""}`} onClick={() => setSelected(0)} aria-label="상품 표지 보기" aria-pressed={!page}>{cover(true)}</button>
      {availablePages.map((item, index) => <button type="button" className={`product-gallery-thumb${selected === index + 1 ? " product-gallery-thumb--active" : ""}`} onClick={() => setSelected(index + 1)} aria-label={item.alt} aria-pressed={selected === index + 1} key={item.src}><Image src={item.src} alt="" width={90} height={120} /></button>)}
    </div>}
  </div>;
}
