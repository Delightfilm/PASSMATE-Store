"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const [fading, setFading] = useState(false);
  const loadedPages = useRef(new Set([0]));
  const immediate = useRef(false);
  const frame = useRef<HTMLDivElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pointerFrame = useRef(0);
  const availablePages = pages.filter((page) => page.src && !page.src.includes("placeholder"));
  const page = availablePages[selected - 1];
  const cover = (small = false) => <ProductCover small={small} theme={theme} year={year} titleLines={titleLines} label="핵심노트" subtitle="핵심개념 · 공식·수치 · 시험 직전 체크" series={series} />;
  const surface = (index: number, hidden = false) => index && availablePages[index - 1]
    ? <Image className="product-gallery-page" src={availablePages[index - 1].src} alt={hidden ? "" : availablePages[index - 1].alt} width={900} height={1200} onLoad={() => { loadedPages.current.add(index); if (!hidden && index === selected && outgoing !== null) beginFade(); }} onError={() => { if (!hidden) { clearTimeout(resetTimer.current); setSelected(0); setOutgoing(null); setFading(false); } }} />
    : cover();
  const resetTilt = () => { cancelAnimationFrame(pointerFrame.current); pointerFrame.current = 0; frame.current?.style.removeProperty("--cover-rotate-x"); frame.current?.style.removeProperty("--cover-rotate-y"); };
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = matchMedia("(min-width: 768px) and (hover: hover) and (pointer: fine)");
    const changed = () => { if (preference.matches) { resetTilt(); clearTimeout(resetTimer.current); setOutgoing(null); setFading(false); } };
    const capabilityChanged = () => { if (!desktop.matches) resetTilt(); };
    preference.addEventListener("change", changed);
    desktop.addEventListener("change", capabilityChanged);
    return () => { preference.removeEventListener("change", changed); desktop.removeEventListener("change", capabilityChanged); clearTimeout(resetTimer.current); resetTilt(); };
  }, []);
  function beginFade() {
    if (immediate.current || matchMedia("(prefers-reduced-motion: reduce)").matches) { setOutgoing(null); setFading(false); return; }
    setFading(true); clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => { setOutgoing(null); setFading(false); }, 150);
  }
  function select(index: number, keyboard: boolean) {
    if (index === selected) return;
    resetTilt(); clearTimeout(resetTimer.current);
    immediate.current = keyboard || matchMedia("(prefers-reduced-motion: reduce)").matches;
    setOutgoing(selected); setFading(false);
    if (loadedPages.current.has(index)) beginFade();
    setSelected(index);
  }

  return <div className="product-gallery">
    <div className="product-gallery-stage">
      <div className={`product-gallery-frame${fading ? " is-changing" : ""}${outgoing !== null && !fading ? " is-waiting" : ""}`} aria-busy={outgoing !== null && !fading} ref={frame} onPointerLeave={resetTilt} onPointerMove={event => {
        if (page || event.pointerType !== "mouse" || !matchMedia("(min-width: 768px) and (hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = Math.max(-2, Math.min(2, (event.clientX - bounds.left) / bounds.width * 4 - 2));
        const y = Math.max(-2, Math.min(2, 2 - (event.clientY - bounds.top) / bounds.height * 4));
        cancelAnimationFrame(pointerFrame.current); pointerFrame.current = requestAnimationFrame(() => {
          pointerFrame.current = 0; frame.current?.style.setProperty("--cover-rotate-x", `${y}deg`); frame.current?.style.setProperty("--cover-rotate-y", `${x}deg`);
        });
      }}>
        <div className="product-gallery-size" aria-hidden="true">{cover()}</div>
        {outgoing !== null && <div className="product-gallery-outgoing" aria-hidden="true">{surface(outgoing, true)}</div>}
        <div className={`product-gallery-current${!page ? " is-cover" : ""}`} key={selected}>{surface(selected)}</div>
      </div>
      {availablePages.length > 0 && <span className="product-gallery-count">{page ? selected + 1 : 1} / {availablePages.length + 1}</span>}
    </div>
    {availablePages.length > 0 && <div className="product-gallery-thumbnails" aria-label="상품 이미지 선택">
      <button type="button" className={`product-gallery-thumb${!page ? " product-gallery-thumb--active" : ""}`} onClick={event => select(0, event.detail === 0)} aria-label="상품 표지 보기" aria-pressed={!page}>{cover(true)}</button>
      {availablePages.map((item, index) => <button type="button" className={`product-gallery-thumb${selected === index + 1 ? " product-gallery-thumb--active" : ""}`} onClick={event => select(index + 1, event.detail === 0)} aria-label={item.alt} aria-pressed={selected === index + 1} key={item.src}><Image src={item.src} alt="" width={90} height={120} /></button>)}
    </div>}
  </div>;
}
