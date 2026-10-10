"use client";

import { useLayoutEffect, useRef } from "react";

export function ResultRateBar({ name, rate }: { name: string; rate: number }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const bar = ref.current;
    if (!bar || !rate) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let animation: Animation | undefined, observer: IntersectionObserver | undefined;
    const finish = () => { animation?.cancel(); observer?.disconnect(); };
    const changed = () => { if (preference.matches) finish(); };
    const reveal = () => { observer?.disconnect(); if (!preference.matches) animation = bar.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 250, easing: "cubic-bezier(.23,1,.32,1)" }); };
    preference.addEventListener("change", changed);
    if (!preference.matches && typeof IntersectionObserver !== "undefined") { observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) reveal(); }); observer.observe(bar); }
    return () => { finish(); preference.removeEventListener("change", changed); };
  }, [rate]);
  return <i role="img" aria-label={`${name} 정답률 ${rate}%`}><b ref={ref} className="result-rate-fill" style={{ width: `${rate}%`, minWidth: rate ? 8 : 0 }} /></i>;
}
