"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useAccountReveal } from "./use-account-reveal";

const percent = (value: number | null) => value === null ? "—" : `${value}%`;

export function AccountSummary({ completionRate, accuracy, total, completed, scored }: { completionRate: number | null; accuracy: number | null; total: number; completed: number; scored: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [floating, setFloating] = useState(false);
  useLayoutEffect(() => {
    const header = document.querySelector<HTMLElement>(".site-header");
    if (!header) return;
    const update = () => setHeaderHeight(header.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !headerHeight || typeof IntersectionObserver === "undefined") return;
    const update = () => setFloating(element.getBoundingClientRect().bottom <= headerHeight);
    update();
    const observer = new IntersectionObserver(update, { rootMargin: `-${headerHeight}px 0px 0px 0px`, threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [headerHeight]);
  return <>
    <div className="account-summary-origin" ref={ref}>
      <section className="account-metrics" aria-label="학습 요약">
        <Metric label="학습 완료율" value={completionRate} unit="%" ring description={`시작한 시험 ${total}회 중 ${completed}회 제출`} />
        <Metric label="평균 정답률" value={accuracy} unit="%" description={scored ? `채점된 시험 ${scored}회의 평균` : "채점된 시험이 없어요"} />
        <Metric label="완료한 시험" value={completed} unit="회" description={`진행 중 ${total - completed}회`} />
      </section>
    </div>
    {floating && <div className="account-floating-summary" style={{ top: headerHeight }} aria-hidden="true"><div><span>완료율 <strong>{percent(completionRate)}</strong></span><span>평균 정답률 <strong>{percent(accuracy)}</strong></span></div></div>}
  </>;
}

function Metric({ label, value, unit, description, ring = false }: { label: string; value: number | null; unit: string; description: string; ring?: boolean }) {
  const { ref, progress } = useAccountReveal(String(value));
  const finalValue = value === null ? "—" : `${value}${unit}`;
  return <div className="account-metric" ref={ref}>
    <h3>{label}</h3>
    <div className="account-metric-stat">
      <strong className="account-metric-value" data-value={finalValue} aria-label={`${label} ${finalValue}`}><span aria-hidden="true">{value === null ? "—" : `${Math.round(value * progress)}${unit}`}</span></strong>
      {ring && value !== null && <svg className="account-completion-ring" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" className="account-ring-track" /><circle cx="24" cy="24" r="20" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - value * progress} className="account-ring-fill" /></svg>}
    </div>
    <p className="account-muted">{description}</p>
  </div>;
}
