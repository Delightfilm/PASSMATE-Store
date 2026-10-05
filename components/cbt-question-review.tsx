"use client";

import { useEffect, useState } from "react";
import { questionStatsRequest, statsPresentation, type QuestionStats } from "@/lib/cbt-question-stats";
import type { Question } from "@/lib/question-bank";

export function QuestionResponseStats({ question, refresh }: { question: Question; refresh?: number }) {
  return <ResponseStats key={question.id} question={question} refresh={refresh} />;
}
function ResponseStats({ question, refresh }: { question: Question; refresh?: number }) {
  const [stats, setStats] = useState<QuestionStats | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const update = (event: Event) => { if ((event as CustomEvent<string[]>).detail?.includes(question.id)) setVersion((value) => value + 1); };
    window.addEventListener("cbt-stats-updated", update);
    return () => window.removeEventListener("cbt-stats-updated", update);
  }, [question.id]);
  useEffect(() => {
    const abort = new AbortController();
    setUnavailable(false);
    void questionStatsRequest([question], undefined, AbortSignal.any([abort.signal, AbortSignal.timeout(15_000)]))
      .then((body) => { if (!abort.signal.aborted) setStats(body.stats[question.id] || { total: 0, correct: 0 }); })
      .catch(() => { if (!abort.signal.aborted) setUnavailable(true); });
    return () => abort.abort();
  }, [question, refresh, version]);
  const display = stats ? statsPresentation(stats) : null;
  return <div className={`cbt-question-stats is-${display?.tone || "neutral"}`} aria-label="문항 응답 통계">
    {stats && display ? <><strong>{display.rate === null ? "첫 응답 통계" : `정답률 ${display.rate}%`}</strong><span>{display.label}</span>
      <small>{stats.total ? `응답 ${stats.total.toLocaleString()}개 중 ${(stats.total - stats.correct).toLocaleString()}개 오답` : "아직 집계된 응답이 없습니다."}</small></>
      : <span>{unavailable ? "응답 통계를 잠시 불러올 수 없어요" : "응답 통계 확인 중"}</span>}
  </div>;
}

export function QuestionMemo({ questionId, value, guest, onSave }: { questionId: string; value: string; guest: boolean; onSave: (memo: string) => void }) {
  return <MemoEditor key={questionId} value={value} guest={guest} onSave={onSave} />;
}
function MemoEditor({ value, guest, onSave }: { value: string; guest: boolean; onSave: (memo: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [message, setMessage] = useState("");
  useEffect(() => { setDraft(value); }, [value]);
  return <section className="cbt-question-memo" aria-label="나의 오답 메모">
    <div className="cbt-memo-heading"><label htmlFor="cbt-question-memo">나의 오답 메모</label><span>나만 볼 수 있어요</span></div>
    <textarea id="cbt-question-memo" rows={3} maxLength={2000} value={draft} placeholder="헷갈린 이유나 다시 기억할 내용을 적어 보세요."
      onChange={(event) => { setDraft(event.target.value); setMessage(""); }} />
    <div className="cbt-memo-footer"><small>{guest ? "이 브라우저에 보관돼요. 로그인하면 계정 기록과 연결할 수 있어요." : "오답노트에서도 이 메모를 확인할 수 있어요."}</small>
      <button type="button" className="button button-secondary" disabled={draft === value} onClick={() => {
        try { onSave(draft.trim()); setMessage("메모를 저장했어요."); } catch { setMessage("메모를 저장하지 못했어요. 다시 시도해 주세요."); }
      }}>메모 저장</button></div>
    {message && <p role="status">{message}</p>}
  </section>;
}
