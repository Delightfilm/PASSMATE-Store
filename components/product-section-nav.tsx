"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

export function ProductSectionNav() {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState("product-overview");
  useEffect(() => {
    const nav = ref.current;
    const detail = nav?.closest<HTMLElement>(".product-detail");
    const header = document.querySelector<HTMLElement>(".site-header");
    if (!nav || !detail) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = header?.getBoundingClientRect().height || 0;
      detail.style.setProperty("--product-nav-top", `${top}px`);
      const limit = top + nav.getBoundingClientRect().height + 24;
      const current = ["product-overview", "product-package"].filter(id => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= limit).at(-1);
      setActive(current || "product-overview");
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    if (header) observer?.observe(header);
    observer?.observe(nav);
    update(); addEventListener("scroll", schedule, { passive: true }); addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); removeEventListener("scroll", schedule); removeEventListener("resize", schedule); detail.style.removeProperty("--product-nav-top"); };
  }, []);
  function jump(event: MouseEvent<HTMLAnchorElement>) {
    if (event.detail !== 0 && !matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = document.getElementById(event.currentTarget.hash.slice(1));
    if (!target) return;
    event.preventDefault();
    const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    window.scrollTo({ top: target.getBoundingClientRect().top + scrollY - margin, behavior: "instant" });
    history.pushState(null, "", event.currentTarget.hash);
  }
  return <nav className="product-section-nav" aria-label="상품 설명 위치" ref={ref}>
    <a href="#product-overview" onClick={jump} aria-current={active === "product-overview" ? "location" : undefined}>상품 정보</a>
    <a href="#product-package" onClick={jump} aria-current={active === "product-package" ? "location" : undefined}>구성·구매</a>
  </nav>;
}
