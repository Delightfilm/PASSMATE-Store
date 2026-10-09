"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** One reveal per mounted data set; interaction never waits for the animation. */
export function useAccountReveal(dataKey: string, duration = 850) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(1);
  useLayoutEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let started = false;
    let finished = false;
    let observer: IntersectionObserver | undefined;
    const finish = () => {
      finished = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      setProgress(1);
    };
    const start = () => {
      if (started || finished) return;
      started = true;
      observer?.disconnect();
      const startTime = performance.now();
      const tick = (now: number) => {
        const elapsed = Math.max(0, Math.min(1, (now - startTime) / duration));
        setProgress(1 - Math.pow(1 - elapsed, 3));
        if (elapsed < 1) frame = requestAnimationFrame(tick);
        else finished = true;
      };
      frame = requestAnimationFrame(tick);
    };
    const onPreference = () => { if (preference.matches) finish(); };
    preference.addEventListener("change", onPreference);
    if (preference.matches) finish();
    else {
      setProgress(0);
      if (typeof IntersectionObserver === "undefined") start();
      else {
        observer = new IntersectionObserver(entries => {
          if (entries.some(entry => entry.isIntersecting)) start();
        }, { threshold: 0.15 });
        if (ref.current) observer.observe(ref.current);
        else finish();
      }
    }
    return () => {
      finished = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      preference.removeEventListener("change", onPreference);
    };
  }, [dataKey, duration]);
  return { ref, progress };
}
