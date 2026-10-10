"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/** A once-only enhancement: first-screen and focused content stay immediate. */
export function ScrollReveal({ children, className, labelledBy, label, as = "section" }: { children: ReactNode; className: string; labelledBy?: string; label?: string; as?: "section" | "div" }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let animation: Animation | undefined;
    let observer: IntersectionObserver | undefined;
    let revealed = false;
    const finish = () => { revealed = true; observer?.disconnect(); animation?.cancel(); };
    const changed = () => { if (preference.matches) finish(); };
    element.addEventListener("focusin", finish);
    preference.addEventListener("change", changed);
    if (preference.matches || element.getBoundingClientRect().top < innerHeight) finish();
    else {
      observer = new IntersectionObserver(entries => {
        if (revealed || !entries.some(entry => entry.isIntersecting)) return;
        revealed = true; observer?.disconnect();
        if (!preference.matches && !element.contains(document.activeElement)) animation = element.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 240, easing: "cubic-bezier(.23,1,.32,1)" });
      });
      observer.observe(element);
    }
    return () => { finish(); element.removeEventListener("focusin", finish); preference.removeEventListener("change", changed); };
  }, []);
  const Tag = as;
  return <Tag ref={ref as React.Ref<HTMLDivElement>} className={className} aria-labelledby={labelledBy} aria-label={label} data-scroll-reveal>{children}</Tag>;
}
