"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { readAccountStudy } from "@/lib/account-study";
import { summarizeStudy } from "@/lib/account-insights";
import type { LocalStore } from "@/lib/question-bank";
import { AccountAccuracyChart } from "./account-accuracy-chart";
import { AccountSummary } from "./account-summary";
import { AccountReveal } from "./account-reveal";

const dateLabel = (date: string) => new Date(date).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" });

export function AccountStudy({ userId, qualificationNames }: { userId: string; qualificationNames: Record<string, string> }) {
  const [study, setStudy] = useState<LocalStore | null>(null);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setStudy(null); setError(false);
    void readAccountStudy(getSupabaseBrowserClient(), userId, controller.signal)
      .then(value => { if (active) setStudy(value); })
      .catch(() => { if (active) setError(true); })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [userId, refresh]);
  if (error) return <div className="account-empty" role="status"><p>학습 기록을 불러오지 못했어요.</p><button className="button button-ghost" onClick={() => setRefresh(value => value + 1)}>다시 시도</button></div>;
  if (!study) return <div className="account-study-skeleton" role="status" aria-label="학습 기록을 불러오는 중"><span /><span /><span /></div>;
  const summary = summarizeStudy(study);
  const trend = summary.trend;
  return <div data-study-ready>
    <AccountSummary completionRate={summary.completionRate} accuracy={summary.accuracy} total={summary.total} completed={summary.completed} scored={summary.scored} />
    <div className="account-learning-grid">
      <section className="account-panel account-trend" aria-labelledby="account-trend-title">
        <div className="account-panel-heading"><h3 id="account-trend-title">최근 정답률</h3><span className="account-muted">최근 {trend.length}회</span></div>
        <AccountAccuracyChart trend={trend} />
      </section>
      <AccountReveal className="account-panel account-review" labelledBy="account-review-title">
        <h3 id="account-review-title">다음 복습</h3>
        <Link className="account-review-link" href="/cbt/wrong-notes/"><span>남은 오답</span><strong>{summary.wrong}개</strong><span className="account-review-arrow" aria-hidden="true">→</span></Link>
        <Link className="account-review-link" href="/cbt/bookmarks/"><span>북마크</span><strong>{summary.bookmarks}개</strong><span className="account-review-arrow" aria-hidden="true">→</span></Link>
        <p className="account-muted">오답 {summary.mastered}개를 복습 완료했어요.</p>
      </AccountReveal>
    </div>
    <AccountReveal className="account-panel account-history" labelledBy="account-history-title">
      <div className="account-panel-heading"><h3 id="account-history-title">최근 학습 기록</h3><Link className="account-text-link" href="/cbt/history/">전체 기록</Link></div>
      {summary.recent.length ? <div className="account-table-wrap"><table><caption className="sr-only">최근 시험의 자격증, 날짜, 제출 상태와 정답률, 이어풀기 또는 결과 보기</caption><thead><tr><th scope="col">자격증</th><th scope="col">날짜</th><th scope="col">상태</th><th scope="col">정답률</th><th scope="col"><span className="sr-only">학습 행동</span></th></tr></thead><tbody>{summary.recent.map(attempt => {
        const cert = attempt.config.certSlug || (qualificationNames[attempt.config.certId] ? attempt.config.certId : null);
        const action = attempt.status === "submitted" ? "결과 보기" : "이어서 풀기";
        return <tr key={attempt.id}><th scope="row">{qualificationNames[attempt.config.certId] || "모의고사"}</th><td>{dateLabel(attempt.submittedAt || attempt.startedAt)}</td><td>{attempt.status === "submitted" ? "완료" : "진행 중"}</td><td>{attempt.status === "submitted" ? attempt.score === undefined ? "미채점" : `${attempt.score}%` : "—"}</td><td>{cert ? <Link className="account-history-action" href={`/cbt/${encodeURIComponent(cert)}/exam/${encodeURIComponent(attempt.id)}/`} prefetch={false} aria-label={`${qualificationNames[attempt.config.certId] || "모의고사"} ${dateLabel(attempt.submittedAt || attempt.startedAt)} ${action}`}>{action}</Link> : <span className="account-muted">기록만 표시</span>}</td></tr>;
      })}</tbody></table></div> : <div className="account-empty"><p>아직 저장된 학습 기록이 없어요.</p><Link className="account-text-link" href="/cbt/">자격증 찾아보기</Link></div>}
    </AccountReveal>
  </div>;
}
