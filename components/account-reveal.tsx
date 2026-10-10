"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Animate only below-fold sections; content and keyboard actions stay available. */
export function AccountReveal({ children, className, labelledBy }: { children: ReactNode; className: string; labelledBy: string }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animation: Animation | undefined;
    let observer: IntersectionObserver | undefined;
    let revealed = false;
    const finish = () => {
      revealed = true;
      observer?.disconnect();
      animation?.cancel();
    };
    const onPreference = () => { if (preference.matches) finish(); };
    element.addEventListener("focusin", finish);
    preference.addEventListener("change", onPreference);
    if (preference.matches || element.getBoundingClientRect().top < innerHeight || typeof IntersectionObserver === "undefined") finish();
    else {
      observer = new IntersectionObserver(entries => {
        if (revealed || !entries.some(entry => entry.isIntersecting)) return;
        revealed = true;
        observer?.disconnect();
        if (!preference.matches && !element.contains(document.activeElement)) {
          animation = element.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 240, easing: "cubic-bezier(.23,1,.32,1)" });
        }
      }, { threshold: 0 });
      observer.observe(element);
    }
    return () => {
      finish();
      element.removeEventListener("focusin", finish);
      preference.removeEventListener("change", onPreference);
    };
  }, []);
  return <section ref={ref} className={className} aria-labelledby={labelledBy} data-account-reveal>{children}</section>;
}
