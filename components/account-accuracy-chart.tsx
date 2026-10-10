"use client";

import { useId, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { LocalAttempt } from "@/lib/question-bank";
import { useAccountReveal } from "./use-account-reveal";

const dateLabel = (attempt: LocalAttempt) => new Date(attempt.submittedAt || attempt.startedAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" });
const pointX = (index: number, count: number) => count === 1 ? 320 : 48 + index * 560 / (count - 1);
const pointY = (score: number) => 164 - score * 1.4;

export function AccountAccuracyChart({ trend }: { trend: LocalAttempt[] }) {
  const id = useId();
  const { ref, progress } = useAccountReveal(trend.map(attempt => `${attempt.id}:${attempt.score}`).join("|"));
  const [selected, setSelected] = useState<number | null>(null);
  if (!trend.length) return <div className="account-chart-empty"><p>시험을 제출하면 정답률 변화를 볼 수 있어요.</p></div>;
  const active = selected === null ? null : trend[selected];
  const change = selected !== null && selected > 0 && active ? Number((active.score! - trend[selected - 1].score!).toFixed(1)) : null;
  const changeLabel = change === null ? "" : `직전 대비 ${change > 0 ? "+" : ""}${change}%p`;
  const selectPointer = (event: MouseEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width * 640;
    setSelected(trend.length === 1 ? 0 : Math.max(0, Math.min(trend.length - 1, Math.round((x - 48) / 560 * (trend.length - 1)))));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = selected ?? trend.length - 1;
    const next = ({ ArrowLeft: Math.max(0, index - 1), ArrowRight: Math.min(trend.length - 1, index + 1), Home: 0, End: trend.length - 1 } as Record<string, number>)[event.key];
    if (event.key === "Escape") { event.preventDefault(); setSelected(null); }
    else if (next !== undefined) { event.preventDefault(); setSelected(next); }
  };
  return <>
    <div className="account-chart-plot" ref={ref}>
      <div className="account-chart-axis" aria-hidden="true"><span>100</span><span>50</span><span>0</span></div>
      <svg className="account-chart" viewBox="0 0 640 200" preserveAspectRatio="none" role="img" aria-labelledby={`${id}-description`}>
        <title id={`${id}-description`}>{trend.map((attempt, index) => `${index + 1}번째 시험 ${dateLabel(attempt)} 정답률 ${attempt.score}%`).join(", ")}</title>
        <defs><clipPath id={`${id}-reveal`}><rect className="account-chart-reveal" x="0" y="0" width={640 * progress} height="200" /></clipPath></defs>
        {[0, 50, 100].map(score => <line key={score} x1="48" x2="608" y1={pointY(score)} y2={pointY(score)} className="account-chart-grid" />)}
        <g clipPath={`url(#${id}-reveal)`}>
          <polyline points={trend.map((attempt, index) => `${pointX(index, trend.length)},${pointY(attempt.score!)}`).join(" ")} className="account-chart-line" />
          {trend.map((attempt, index) => <circle key={attempt.id} cx={pointX(index, trend.length)} cy={pointY(attempt.score!)} r="5" className="account-chart-point" />)}
        </g>
        {active && <><line x1={pointX(selected!, trend.length)} x2={pointX(selected!, trend.length)} y1="16" y2="172" className="account-chart-guide" /><circle cx={pointX(selected!, trend.length)} cy={pointY(active.score!)} r="7" className="account-chart-point account-chart-selected" /></>}
      </svg>
      <button type="button" className="account-chart-interaction" aria-label="최근 정답률 그래프. 좌우 방향키로 시험 이동, Home 첫 시험, End 마지막 시험, Escape 수치 닫기" aria-describedby={active ? `${id}-tooltip` : undefined}
        onMouseMove={selectPointer} onMouseLeave={event => { if (document.activeElement !== event.currentTarget) setSelected(null); }}
        onFocus={() => setSelected(index => index ?? trend.length - 1)} onBlur={() => setSelected(null)} onKeyDown={onKeyDown}
        onClick={event => { if (event.detail) selectPointer(event); else setSelected(index => index ?? trend.length - 1); }} />
      {active && <div id={`${id}-tooltip`} role="tooltip" className="account-chart-tooltip" style={{ left: `calc(24px + (100% - 24px) * ${Math.max(0.24, Math.min(0.76, pointX(selected!, trend.length) / 640))})`, top: `${pointY(active.score!) / 2}%`, transform: pointY(active.score!) < 90 ? "translate(-50%, 12px)" : "translate(-50%, calc(-100% - 12px))" }}>
        <span>{dateLabel(active)} · {selected! + 1}번째 시험</span><strong>정답률 {active.score}%</strong>
        {change !== null && <span>{changeLabel}</span>}
      </div>}
      <span className="sr-only" role="status" aria-live="polite">{active ? `${dateLabel(active)} ${selected! + 1}번째 시험 정답률 ${active.score}% ${changeLabel}` : ""}</span>
    </div>
    <div className="account-chart-dates account-muted"><span>{dateLabel(trend[0])}</span><span>{dateLabel(trend[trend.length - 1])}</span></div>
    <details className="account-chart-data"><summary>그래프 수치 보기</summary><ol>{trend.map(attempt => <li key={attempt.id}>{dateLabel(attempt)} <strong>{attempt.score}%</strong></li>)}</ol></details>
  </>;
}
