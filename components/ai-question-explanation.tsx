"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { sourceHash, type Question } from "@/lib/question-bank";
import { explanationInput, validateExplanation, type ExplanationReply } from "@/lib/ai-explanation-contract";
import { AI_DEVICE_EVENT, AI_DEVICE_STORAGE_KEY, AI_SIGNUP_THRESHOLD, deviceGenerationCount, recordDeviceGeneration } from "@/lib/ai-explanation-device";

type Props = {
  question: Question; selectedAnswer?: number; allowGenerate?: boolean; onReport?: () => void;
};
export function AiQuestionExplanation(props: Props) {
  return <ExplanationPanel key={JSON.stringify(explanationInput(props.question))} {...props} />;
}
function ExplanationPanel({ question, selectedAnswer, allowGenerate = true, onReport }: Props) {
  const [result, setResult] = useState<ExplanationReply | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [guest, setGuest] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [returnPath, setReturnPath] = useState("/cbt/");
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
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
  // No automatic lookup/generation on wrong-answer selection or component mount.

  async function showExplanation() {
    if (busy.current) return;
    busy.current = true; setLoading(true); setError(""); setLoginRequired(false);
    const abort = new AbortController(); controller.current = abort;
    try {
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

  if (question.explanation.trim()) return <p>{question.explanation}</p>;
  if (!allowGenerate) return <p>등록된 해설이 없습니다.</p>;
  const explanation = result?.explanation;
  return <div className="ai-question-explanation" aria-busy={loading}>
    <small className="ai-explanation-notice">AI가 생성한 해설로, 부정확한 내용이 포함될 수 있습니다.</small>
    {!explanation && <><p>등록된 해설이 없습니다. AI 해설로 복습할 수 있습니다.</p>
      {(!result || result.status === "generating" || (["failed", "refused"].includes(result.status) && result.retryable)) && <button type="button" className="button button-secondary" disabled={loading} onClick={showExplanation}>
        {loading ? "해설을 작성하고 근거를 검사하고 있습니다…" : result?.status === "refused" && result.retryable ? "해설 보완 생성" : result?.retryable ? "해설 다시 생성" : result ? "해설 상태 확인" : "해설보기"}
      </button>}
      <small>등록 정답 기준 · 근거 검사에서 실패하면 한 번 보완하며, 저장된 해설은 함께 재사용합니다.</small></>}
    {error && <p className="ai-explanation-error" role="alert">{error}</p>}
    {loginRequired && <Link className="button button-secondary" href="/account/login/?next=%2Fcbt%2F">로그인</Link>}
    {guest && createdCount >= AI_SIGNUP_THRESHOLD && <aside className="ai-explanation-signup" aria-label="회원가입 안내">
      <strong>AI 해설로 10개 이상의 문제를 복습했어요!</strong>
      <p>회원가입하고 학습 기록과 오답노트를 계정에 보관해 보세요. 가입하지 않아도 해설은 계속 이용할 수 있습니다.</p>
      <Link className="button button-primary" href={`/account/signup/?next=${encodeURIComponent(returnPath)}`}>무료 회원가입</Link>
      <Link className="button button-secondary" href={`/account/login/?next=${encodeURIComponent(returnPath)}`}>이미 계정이 있어요</Link>
    </aside>}
    {result?.status === "generating" && !error && <p role="status">다른 사용자와 함께 사용할 해설을 생성 중입니다.</p>}
    {(result?.status === "refused" || result?.status === "failed") && <p role="status">{result.message}</p>}
    {explanation && <section aria-label="AI 학습 해설"><div className="ai-explanation-heading"><strong>AI 해설</strong><span>{result.cached ? "저장된 해설" : "새로 생성된 해설"}</span></div>
      <p className="ai-explanation-answer">등록된 정답: {question.choices[question.answer].label}</p>
      <p className="ai-explanation-text">{explanation.summary}</p>
      <ol className="ai-explanation-choices">{explanation.choiceReasons.map((reason, index) => <li key={index} className={index === selectedAnswer && index !== question.answer ? "is-selected-wrong" : ""}>
        <strong>{question.choices[index].label} {index === question.answer ? "등록 정답" : index === selectedAnswer ? "내가 고른 보기" : "보기 설명"}</strong><p>{reason}</p>
      </li>)}</ol>
    </section>}
    {onReport && result && <button type="button" className="cbt-report-link" onClick={onReport}>해설 오류 신고</button>}
  </div>;
}
