"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { sourceHash, type Question } from "@/lib/question-bank";
import { explanationInput, validateExplanation, type ExplanationReply } from "@/lib/ai-explanation-contract";
import { AI_DEVICE_EVENT, AI_DEVICE_STORAGE_KEY, AI_SIGNUP_THRESHOLD, deviceGenerationCount, recordDeviceGeneration } from "@/lib/ai-explanation-device";

type Props = {
  question: Question; selectedAnswer?: number; allowGenerate?: boolean; collapsible?: boolean; onReport?: () => void;
};
function ExplanationProgress() {
  return <div className="ai-explanation-progress">
    <div className="ai-explanation-progress-row" role="status" aria-live="polite">
      <span className="ai-explanation-spinner" aria-hidden="true" />
      <div className="ai-explanation-progress-copy">
        <strong>AI 해설을 준비하고 있어요</strong>
        <p>문항에 맞는 해설과 정답 근거를 확인하고 있습니다. 잠시만 기다려 주세요.</p>
      </div>
    </div>
    <div className="ai-explanation-progress-bar" role="progressbar" aria-label="AI 해설 준비 중" />
  </div>;
}
export function AiQuestionExplanation(props: Props) {
  return <ExplanationPanel key={JSON.stringify(explanationInput(props.question))} {...props} />;
}
function ExplanationPanel({ question, selectedAnswer, allowGenerate = true, collapsible = false, onReport }: Props) {
  const [result, setResult] = useState<ExplanationReply | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [guest, setGuest] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [returnPath, setReturnPath] = useState("/cbt/");
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const savedExplanation = useRef<ExplanationReply | null>(null);
  const lookup = useRef<Promise<ExplanationReply | null> | null>(null);
  useEffect(() => () => { controller.current?.abort(); }, []);
  useEffect(() => {
    function updateCount() {
      try { setCreatedCount(deviceGenerationCount(window.localStorage)); } catch { /* storage may be disabled */ }
    }
    function onStorage(event: StorageEvent) {
      if (event.key === AI_DEVICE_STORAGE_KEY || event.key === null) updateCount();
    }
    updateCount();
    setReturnPath(window.location.pathname + window.location.search);
    window.addEventListener("storage", onStorage);
    window.addEventListener(AI_DEVICE_EVENT, updateCount);
    const { data } = getSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => setGuest(!session));
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AI_DEVICE_EVENT, updateCount);
    };
  }, []);
  useEffect(() => {
    if (!allowGenerate || question.explanation.trim() || question.choices.length !== 4 || question.answerComparison === "disagree" || (question.acceptedAnswers?.length || 0) > 1) return;
    const abort = new AbortController();
    savedExplanation.current = null;
    lookup.current = (async () => {
      try {
        const revision = await sourceHash(explanationInput(question));
        if (abort.signal.aborted) return null;
        const response = await fetch("/api/cbt/explanations/", { method: "POST", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10_000)]),
          body: JSON.stringify({ questionId: question.id, qualificationCode: question.certId, revision, readOnly: true }) });
        if (!response.ok) return null;
        const body = await response.json();
        if (body.status !== "ready" || abort.signal.aborted) return null;
        const ready: ExplanationReply = { ...body, explanation: validateExplanation(body.explanation, question.answer) };
        savedExplanation.current = ready;
        return ready;
      } catch { return null; } // Optional cache lookup must never block explicit generation.
    })();
    return () => abort.abort();
  }, [question, allowGenerate]);

  async function showExplanation() {
    if (busy.current) return;
    if (savedExplanation.current) { setResult(savedExplanation.current); setError(""); setLoginRequired(false); return; }
    busy.current = true; setLoading(true); setError(""); setLoginRequired(false);
    const abort = new AbortController(); controller.current = abort;
    try {
      const saved = await lookup.current;
      if (abort.signal.aborted) return;
      if (saved) { setResult(saved); return; }
      const revision = await sourceHash(explanationInput(question));
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      setGuest(!data.session);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
      const started = Date.now();
      let readOnly = false;
      while (!abort.signal.aborted) {
        const response = await fetch("/api/cbt/explanations/", { method: "POST", headers, cache: "no-store",
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(290_000)]),
          body: JSON.stringify({ questionId: question.id, qualificationCode: question.certId, revision, readOnly }) });
        const body = await response.json();
        if (!response.ok) { setLoginRequired(response.status === 401); throw new Error(body.error || "해설을 불러오지 못했습니다."); }
        if (body.status === "ready") body.explanation = validateExplanation(body.explanation, question.answer);
        if (!["ready", "generating", "refused", "failed"].includes(body.status)) throw new Error("해설 저장 상태를 확인하지 못했습니다.");
        setResult(body);
        if (body.status === "ready" && body.cached === false) {
          try {
            setCreatedCount(recordDeviceGeneration(window.localStorage, revision, body));
            window.dispatchEvent(new Event(AI_DEVICE_EVENT));
          } catch { /* Storage disabled: explanations remain usable. */ }
        }
        if (body.status !== "generating") break;
        if (Date.now() - started > 110_000) { setError("생성이 계속 진행 중입니다. 잠시 후 해설보기를 누르면 저장 상태만 확인합니다."); break; }
        readOnly = true; // Polls can NEVER claim a job or invoke the model.
        await new Promise<void>((resolve) => {
          const timer = setTimeout(done, 5000);
          function done() { clearTimeout(timer); abort.signal.removeEventListener("abort", done); resolve(); }
          abort.signal.addEventListener("abort", done, { once: true });
        });
      }
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "해설을 불러오지 못했습니다.");
    } finally {
      if (!abort.signal.aborted) { setLoading(false); busy.current = false; }
    }
  }

  function disclosure(content: ReactNode) {
    if (!collapsible) return content;
    return <details className="cbt-explanation-disclosure" onToggle={(event) => {
      if (event.currentTarget.open && !question.explanation.trim() && !result && allowGenerate) void showExplanation();
    }}>
      <summary><strong>해설보기</strong><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 7.5 5 5 5-5" /></svg></summary>
      {content}
    </details>;
  }
  if (question.explanation.trim()) return disclosure(<p>{question.explanation}</p>);
  if (question.choices.length !== 4 || question.answerComparison === "disagree" || (question.acceptedAnswers?.length || 0) > 1) return <p>답안 정보를 참고해 복습해 주세요. 이 문항의 해설은 준비 중입니다.</p>;
  if (!allowGenerate) return null;
  const explanation = result?.explanation;
  return disclosure(<div className="ai-question-explanation" aria-busy={loading}>
    <small className="ai-explanation-notice">AI가 생성한 해설로, 부정확한 내용이 포함될 수 있습니다.</small>
    {!explanation && <>{loading ? <ExplanationProgress /> : <>
      {(!result || result.status === "generating" || (["failed", "refused"].includes(result.status) && result.retryable)) && <button type="button" className="button button-secondary" disabled={loading} onClick={showExplanation}>
        {result?.status === "refused" && result.retryable ? "해설 보완 생성" : result?.retryable ? "해설 다시 생성" : result ? "해설 상태 확인" : "해설보기"}
      </button>}</>}</>}
    {error && <p className="ai-explanation-error" role="alert">{error}</p>}
    {loginRequired && <Link className="button button-secondary" href="/account/login/?next=%2Fcbt%2F">로그인</Link>}
    {guest && createdCount >= AI_SIGNUP_THRESHOLD && <aside className="ai-explanation-signup" aria-label="회원가입 안내">
      <strong>AI 해설로 10개 이상의 문제를 복습했어요!</strong>
      <p>회원가입하고 학습 기록과 오답노트를 계정에 보관해 보세요. 가입하지 않아도 해설은 계속 이용할 수 있습니다.</p>
      <Link className="button button-primary" href={`/account/signup/?next=${encodeURIComponent(returnPath)}`}>무료 회원가입</Link>
      <Link className="button button-secondary" href={`/account/login/?next=${encodeURIComponent(returnPath)}`}>이미 계정이 있어요</Link>
    </aside>}
    {(result?.status === "refused" || result?.status === "failed") && <p role="status">{result.message}</p>}
    {explanation && <section aria-label="AI 학습 해설"><div className="ai-explanation-heading"><strong>핵심 해설</strong><span>{result.cached ? "저장된 AI 해설" : "AI 해설"}</span><b className="ai-explanation-answer">정답 {question.choices[question.answer].label}</b></div>
      <p className="ai-explanation-text">{explanation.summary}</p>
      <h3 className="ai-explanation-detail-title">보기별 풀이</h3>
      <ol className="ai-explanation-choices">{explanation.choiceReasons.map((reason, index) => <li key={index} className={index === question.answer ? "is-correct" : index === selectedAnswer ? "is-selected-wrong" : ""}>
        <strong><span className="ai-reason-number">{question.choices[index].label}</span> {index === question.answer ? "정답 보기" : index === selectedAnswer ? "내가 고른 오답" : "다른 보기"}</strong><p>{reason}</p>
      </li>)}</ol>
    </section>}
    {onReport && result && <button type="button" className="cbt-report-link" onClick={onReport}>해설 오류 신고</button>}
  </div>);
}
