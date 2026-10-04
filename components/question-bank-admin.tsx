"use client";

import { QuestionChoiceContent } from "@/components/question-choice-content";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPublicSupabaseConfig } from "@/lib/public-supabase-config";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { makeId, parseImportFile, sourceHash, type ImportBatch, type ImportContext, type ImportError, type ImportRow } from "@/lib/question-bank";
import type { Question } from "@/lib/question-bank";
import { loadContentCatalog } from "@/lib/question-bank-content";

type RemoteBatch = {
  id: string;
  file_name: string;
  schema_version: string | null;
  qualification_code: string;
  status: ImportBatch["status"];
  row_count: number;
  error_count: number;
  created_at: string;
};

type IssueReport = { id: string; question_id: string | null; question_ref?: string | null; qualification_code?: string | null; kind: string; memo: string; created_at: string; question_bank_questions: { no: number; stem: string } | null };
type ReviewContent = Pick<Question, "stem" | "choices" | "answer" | "explanation">;
type ReviewQuestion = ReviewContent & Pick<Question, "id" | "certId" | "no" | "images">;
type ReviewEvent = { id: number; report_id: string; question_ref: string; qualification_code: string | null; actor_user_id: string; action: string; reason: string; before_content: ReviewContent | { status: string }; after_content: ReviewContent | { status: string }; created_at: string };
type ReviewData = { question: ReviewQuestion; version: number; sourceHash: string };
const reportKinds: Record<string, string> = { wrong_answer: "잘못된 정답", broken_image: "이미지 깨짐", missing_choice: "보기 누락", other: "기타" };
function reviewError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("version_conflict")) return "다른 수정이 먼저 저장됐습니다. 문항을 다시 불러온 후 수정해 주세요.";
  if (message.includes("source_changed")) return "원본 데이터가 변경됐습니다. 관리자 확인이 필요합니다.";
  if (message.includes("already_resolved")) return "이미 검수 완료된 신고입니다. 목록을 새로고침해 주세요.";
  if (message.includes("qualification_required")) return "이전 신고에는 종목 정보가 없습니다. 종목을 선택한 뒤 문항을 불러오세요.";
  if (message.includes("question_not_found")) return "선택한 종목에서 해당 문항을 찾지 못했습니다.";
  if (message.includes("invalid_question_patch")) return "문제와 보기 4개, 정답 및 수정 사유를 확인해 주세요.";
  return "요청을 처리하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.";
}

async function callQuestionBankAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("admin_session_missing");
  const { url, key } = getPublicSupabaseConfig();
  const response = await fetch(`${url}/functions/v1/question-bank-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(String(payload.error || "question_bank_admin_failed"));
  return payload as T;
}

export function QuestionBankAdmin() {
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [context, setContext] = useState<ImportContext | null>(null);
  const [recentBatches, setRecentBatches] = useState<RemoteBatch[]>([]);
  const [reports, setReports] = useState<IssueReport[]>([]);
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewNotice, setReviewNotice] = useState("");
  const [reviewFailure, setReviewFailure] = useState("");
  const [editing, setEditing] = useState<IssueReport | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [qualifications, setQualifications] = useState<{ code: string; title: string }[]>([]);
  const [qualificationCode, setQualificationCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadRecent() {
    try {
      const result = await callQuestionBankAdmin<{ batches: RemoteBatch[] }>({ action: "recent_batches" });
      setRecentBatches(result.batches);
    } catch {
      // The parent admin screen already handles authentication. Keep import usable if history fails.
    }
  }

  async function loadReports() {
    setReviewLoading(true);
    try {
      const [result, history] = await Promise.all([
        callQuestionBankAdmin<{ reports: IssueReport[] }>({ action: "list_reports" }),
        callQuestionBankAdmin<{ events: ReviewEvent[] }>({ action: "list_review_history" }),
      ]);
      setReports(result.reports);
      setEvents(history.events); setReviewFailure("");
    } catch { setReviewFailure("신고 목록 또는 처리 이력을 불러오지 못했습니다. 새로고침해 주세요."); }
    finally { setReviewLoading(false); }
  }

  useEffect(() => { void loadRecent(); void loadReports(); }, []);

  async function resolveReport(reportId: string) {
    if (!window.confirm("이 신고를 검수 완료로 처리할까요? 신고 기록과 처리 이력은 보존됩니다.")) return;
    setReviewBusy(true); setReviewFailure("");
    try {
      await callQuestionBankAdmin({ action: "resolve_report", reportId });
      setReports((items) => items.filter((item) => item.id !== reportId));
      if (editing?.id === reportId) { setEditing(null); setReviewData(null); }
      setReviewNotice("검수 완료했습니다. 대기 목록에서 제외하고 처리 이력을 저장했습니다.");
      await loadReports();
    } catch (error) { setReviewFailure(reviewError(error)); }
    finally { setReviewBusy(false); }
  }

  async function openEditor(report: IssueReport, code = report.qualification_code || "") {
    setEditing(report); setReviewData(null); setQualificationCode(code); setReviewBusy(true); setReviewFailure(""); setReviewNotice("");
    try {
      const data = await callQuestionBankAdmin<ReviewData>({ action: "get_report_question", reportId: report.id, qualificationCode: code });
      setReviewData(data); setQualificationCode(data.question.certId);
    } catch (error) {
      setReviewFailure(reviewError(error));
      if (report.question_ref) { try { const catalog = await loadContentCatalog(); setQualifications(catalog.qualifications); } catch { setReviewFailure("종목 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); } }
    } finally { setReviewBusy(false); }
  }

  async function saveReview(patch: ReviewContent, reason: string, resolve: boolean) {
    if (!editing || !reviewData) return;
    setReviewBusy(true); setReviewFailure("");
    try {
      const result = await callQuestionBankAdmin<{ version: number }>({ action: "save_report_question", reportId: editing.id, qualificationCode: qualificationCode, patch, reason, resolve, expectedVersion: reviewData.version, sourceHash: reviewData.sourceHash });
      if (resolve) { setReports((items) => items.filter((item) => item.id !== editing.id)); setEditing(null); setReviewData(null); }
      else setReviewData({ ...reviewData, question: { ...reviewData.question, ...patch }, version: result.version });
      setReviewNotice(resolve ? "문항 수정과 검수 완료를 저장했습니다." : "문항 수정을 저장했습니다. 다음 문항 조회부터 반영됩니다.");
      await loadReports();
    } catch (error) { setReviewFailure(reviewError(error)); }
    finally { setReviewBusy(false); }
  }

  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true); setNotice(""); setError(""); setProgress(0);
    const parsed = await parseImportFile(file);
    const rows: ImportRow[] = [];
    for (const row of parsed.rows) {
      const hash = String(row.sourceHash || "") || await sourceHash({ stem: row.stem || row.question, choices: row.choices, answer: row.answer_no ?? row.answer });
      rows.push({ ...row, sourceHash: hash, status: "needs_review" });
    }
    const next: ImportBatch = { id: makeId("preview"), createdAt: new Date().toISOString(), fileName: file.name, rows, errors: parsed.errors, status: "needs_review" };
    setBatch(next); setContext(parsed.context); setBusy(false);
    setNotice(parsed.errors.length ? `${parsed.errors.length}개 오류를 먼저 확인해주세요.` : `${rows.length}개 문항을 검증했습니다. 중복 문항도 모두 유지됩니다.`);
  }

  async function saveToDatabase() {
    if (!batch || !context || batch.errors.length || busy) return;
    setBusy(true); setError(""); setNotice(""); setProgress(0);
    try {
      const start = await callQuestionBankAdmin<{ batchId: string }>({
        action: "start_import",
        fileName: batch.fileName,
        schemaVersion: context.schemaVersion,
        qualification: context.qualification,
        examSessions: context.examSessions,
        subjects: context.subjects,
        questionCount: batch.rows.length,
      });
      const serverErrors: ImportError[] = [];
      const chunkSize = 100;
      for (let offset = 0; offset < batch.rows.length; offset += chunkSize) {
        const chunk = batch.rows.slice(offset, offset + chunkSize);
        const result = await callQuestionBankAdmin<{ errors: { index: number; message: string }[] }>({ action: "import_chunk", batchId: start.batchId, questions: chunk });
        for (const item of result.errors) serverErrors.push({ row: offset + item.index + 2, message: item.message });
        setProgress(Math.min(batch.rows.length, offset + chunk.length));
      }
      const finished = await callQuestionBankAdmin<{ batch: { status: ImportBatch["status"]; row_count: number } }>({ action: "finish_import", batchId: start.batchId, errorCount: serverErrors.length });
      setBatch({ ...batch, remoteId: start.batchId, errors: serverErrors, status: finished.batch.status });
      setNotice(`${finished.batch.row_count}개 문항을 운영 DB에 저장했습니다. 공개하면 문제은행 탭에 표시됩니다.`);
      await loadRecent();
    } catch (saveError) {
      console.error("[PASSMATE] question bank import failed", saveError);
      setError("운영 DB 저장에 실패했습니다. 오류 보고서를 내려받아 확인해주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function publish(batchId = batch?.remoteId) {
    if (!batchId || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await callQuestionBankAdmin<{ published: number }>({ action: "publish_batch", batchId });
      if (batch?.remoteId === batchId) setBatch({ ...batch, status: "published" });
      setNotice(`${result.published}개 문항을 공개했습니다. 이제 문제은행 탭에서 확인할 수 있습니다.`);
      await loadRecent();
    } catch (publishError) {
      console.error("[PASSMATE] question bank publish failed", publishError);
      setError("문제은행 공개에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function rollback(batchId = batch?.remoteId) {
    if (!batchId || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await callQuestionBankAdmin({ action: "rollback_batch", batchId });
      if (batch?.remoteId === batchId) setBatch({ ...batch, status: "rolled_back" });
      setNotice("이 배치를 문제은행에서 제외했습니다. 원본 배치 기록은 보존됩니다.");
      await loadRecent();
    } catch (rollbackError) {
      console.error("[PASSMATE] question bank rollback failed", rollbackError);
      setError("배치 되돌리기에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function downloadErrorReport() {
    if (!batch) return;
    const report = { generatedAt: new Date().toISOString(), fileName: batch.fileName, batchId: batch.remoteId ?? null, errors: batch.errors };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${batch.fileName}.error-report.json`; anchor.click();
    URL.revokeObjectURL(url);
  }

  return <section className="store-admin-view">
    <div className="admin-overview admin-overview--four">
      <Metric label="검수 대기" value={batch?.status === "needs_review" ? batch.rows.length : 0} />
      <Metric label="오류 행" value={batch?.errors.length || 0} />
      <Metric label="전체 문항" value={batch?.rows.length || 0} />
      <Metric label="최근 배치" value={recentBatches.length} />
    </div>
    <div className="question-admin-grid">
      <section className="admin-panel">
        <div className="admin-panel-head"><div><span className="eyebrow">DATA IMPORT</span><h2>크롤링 결과 가져오기</h2><p>PASSMATE bundle JSON을 검사한 뒤 100문항씩 안전하게 운영 DB에 저장합니다.</p></div><span className="admin-state admin-state--on">Supabase 운영 DB</span></div>
        <label className="question-admin-dropzone question-admin-dropzone--active"><strong>{busy ? "처리 중..." : "파일 선택 또는 끌어놓기"}</strong><span>.json 권장 · .csv · .md 미리보기 지원</span><input type="file" accept=".json,.csv,.md,.markdown,text/csv,application/json,text/markdown" onChange={(event) => void importFile(event.target.files?.[0])} /></label>
        {busy && batch && <p className="admin-help">업로드 진행 {progress}/{batch.rows.length}</p>}
        {notice && <p className="auth-message auth-message--success">{notice}</p>}
        {error && <p className="auth-message auth-message--error">{error}</p>}
        <div className="mapping-grid">
          <label>종목<input value={String(context?.qualification.title || "bundle JSON에서 자동 인식")} readOnly /></label>
          <label>회차<input value={context ? `${context.examSessions.length}개 회차` : "bundle JSON 필요"} readOnly /></label>
          <label>과목·단원<input value={context ? `${context.subjects.length}개 과목` : "bundle JSON 필요"} readOnly /></label>
        </div>
        <p className="admin-help">sourceHash가 같아도 삭제하지 않습니다. 실제 출현 단위인 question_uid별로 저장하며, 같은 배치의 재시도만 중복 삽입을 막습니다.</p>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head"><div><span className="eyebrow">BATCH</span><h2>배치 관리</h2></div>{batch && <span className="admin-state">{batch.remoteId || batch.id}</span>}</div>
        {batch ? <>
          <div className="batch-summary"><span>파일 <b>{batch.fileName}</b></span><span>상태 <b>{batch.status}</b></span><span>문항 <b>{batch.rows.length}</b></span></div>
          <div className="admin-card-actions">
            {!batch.remoteId && <button className="button button-primary" onClick={() => void saveToDatabase()} disabled={busy || batch.errors.length > 0 || !context}>운영 DB에 저장</button>}
            {batch.remoteId && batch.status === "needs_review" && <button className="button button-primary" onClick={() => void publish()} disabled={busy}>문제은행에 공개</button>}
            {batch.remoteId && batch.status !== "rolled_back" && <button className="button button-ghost" onClick={() => void rollback()} disabled={busy}>이 배치 되돌리기</button>}
            {batch.errors.length > 0 && <button className="button button-ghost" onClick={downloadErrorReport}>오류 보고서 내려받기</button>}
          </div>
          {!context && <p className="admin-help">CSV·Markdown은 미리보기만 지원합니다. 운영 저장에는 qualification, exam_sessions, subjects가 포함된 bundle JSON을 사용해주세요.</p>}
        </> : <p className="admin-empty">파일을 올리면 검증 결과와 운영 DB 저장 버튼이 표시됩니다.</p>}
      </section>
    </div>
    {batch && <section className="admin-panel">
      <div className="admin-panel-head"><div><span className="eyebrow">VALIDATION PREVIEW</span><h2>오류 행 미리보기</h2><p>중복은 제거하지 않으며 모든 원본 출현 문항을 보존합니다.</p></div></div>
      {batch.errors.length ? <div className="import-errors">{batch.errors.map((item, index) => <div key={`${item.row}-${index}`}><b>행 {item.row}</b><span>{item.message}</span></div>)}</div> : <p className="admin-empty">오류가 없습니다.</p>}
      <div className="import-preview-table"><div className="import-preview-head"><span>상태</span><span>문항</span><span>보기</span><span>sourceHash</span></div>{batch.rows.slice(0, 10).map((row, index) => <div className="import-preview-row" key={`${String(row.question_uid || row.sourceHash)}-${index}`}><span className="admin-state">{String(row.status || "needs_review")}</span><strong>{String(row.stem || row.question || "-")}</strong><span>{Array.isArray(row.choices) ? row.choices.length : String(row.choices || "").split("|").filter(Boolean).length}</span><code>{String(row.sourceHash).slice(0, 12)}…</code></div>)}</div>
    </section>}
    <section className="admin-panel">
      <div className="admin-panel-head"><div><span className="eyebrow">IMPORT HISTORY</span><h2>최근 운영 DB 배치</h2></div><Link href="/cbt/">CBT MATE 열기 ↗</Link></div>
      {recentBatches.length ? recentBatches.map((item) => <div className="record-row" key={item.id}><span>{item.file_name}<small>{item.qualification_code} · {new Date(item.created_at).toLocaleString("ko-KR")}</small></span><strong>{item.row_count}문항</strong><small>{item.status}</small>{item.status === "needs_review" && <button className="button button-primary" onClick={() => void publish(item.id)} disabled={busy}>공개</button>}</div>) : <p className="admin-empty">아직 운영 DB에 저장한 배치가 없습니다.</p>}
    </section>
    <section className="admin-panel">
      <div className="admin-panel-head"><div><span className="eyebrow">ISSUE REVIEW</span><h2>문제 오류 신고</h2><p>문항을 수정하거나 검수 완료로 처리할 수 있습니다. 완료한 신고와 처리 로그는 보존됩니다.</p></div><span className="admin-state">{reports.length}건 (최근 100건)</span></div>
      <button className="button button-ghost" disabled={reviewBusy || reviewLoading} onClick={() => void loadReports()}>신고·이력 새로고침</button>
      {reviewFailure && <p className="question-review-error" role="alert">{reviewFailure}</p>}
      {reviewNotice && <p className="admin-help" role="status">{reviewNotice}</p>}
      {reviewLoading ? <p role="status">신고·처리 이력을 불러오는 중…</p> : reports.length ? reports.map((report) => <div className="record-row question-review-row" key={report.id}><span>{report.question_bank_questions?.no || "-"}번 · {report.question_bank_questions?.stem || report.question_ref || report.question_id}<small>{reportKinds[report.kind] || report.kind} · {new Date(report.created_at).toLocaleString("ko-KR")} · {report.memo || "메모 없음"}</small></span><div className="admin-card-actions"><button className="button button-primary" disabled={reviewBusy} onClick={() => void openEditor(report)}>문항 수정</button><button className="button button-ghost" disabled={reviewBusy} onClick={() => void resolveReport(report.id)}>검수 완료</button></div></div>) : !reviewFailure && <p className="admin-empty">검수 대기 중인 오류 신고가 없습니다.</p>}
      {editing && <div className="question-review-editor"><div className="admin-panel-head"><h3>신고 문항 수정</h3><button className="button button-ghost" disabled={reviewBusy} onClick={() => { setEditing(null); setReviewData(null); }}>편집 닫기</button></div><p className="admin-help">신고 내용: {editing.memo || reportKinds[editing.kind]}</p>{reviewData ? <ReviewEditor key={editing.id} data={reviewData} busy={reviewBusy} onSave={saveReview} onReload={() => void openEditor(editing, qualificationCode)} /> : reviewBusy ? <p role="status">원본 문항을 불러오는 중…</p> : <div className="admin-form-grid"><label>종목<select value={qualificationCode} onChange={(event) => setQualificationCode(event.target.value)}><option value="">신고한 종목 선택</option>{qualifications.map((item) => <option key={item.code} value={item.code}>{item.title} ({item.code})</option>)}</select></label><button className="button button-primary" disabled={!qualificationCode} onClick={() => void openEditor(editing, qualificationCode)}>문항 불러오기</button></div>}</div>}
    </section>
    <section className="admin-panel">
      <div className="admin-panel-head"><div><span className="eyebrow">REVIEW HISTORY</span><h2>문항 수정·검수 로그</h2><p>최근 100건을 표시합니다. 전체 이력은 계속 보관됩니다.</p></div></div>
      {events.length ? events.map((event) => <details className="question-review-log" key={event.id}><summary>{event.action === "edit_question" ? "문항 수정" : "검수 완료"} · {event.qualification_code || "종목 미지정"} · {new Date(event.created_at).toLocaleString("ko-KR")}</summary><p>문항 {event.question_ref} · 신고 {event.report_id}</p><p>처리자 계정 ID: {event.actor_user_id}</p><p>사유: {event.reason || "검수 완료"}</p><div className="question-review-diff"><div><h4>변경 전</h4><ReviewSnapshot value={event.before_content} /></div><div><h4>변경 후</h4><ReviewSnapshot value={event.after_content} /></div></div></details>) : !reviewLoading && !reviewFailure && <p className="admin-empty">아직 문항 수정·검수 이력이 없습니다.</p>}
    </section>
  </section>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="admin-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function ReviewEditor({ data, busy, onSave, onReload }: { data: ReviewData; busy: boolean; onSave: (patch: ReviewContent, reason: string, resolve: boolean) => Promise<void>; onReload: () => void }) {
  const [stem, setStem] = useState(data.question.stem);
  const [choices, setChoices] = useState(data.question.choices.map((choice) => ({ ...choice })));
  const [answer, setAnswer] = useState(data.question.answer);
  const [explanation, setExplanation] = useState(data.question.explanation);
  const [reason, setReason] = useState("");
  const [validation, setValidation] = useState("");
  function submit(resolve: boolean) {
    if (!stem.trim() || choices.some((choice) => !choice.text.trim() && !choice.images?.length) || !reason.trim()) { setValidation("문제·보기 4개·수정 사유를 입력해 주세요."); return; }
    if (resolve && !window.confirm("문항 수정을 저장하고 이 신고를 검수 완료로 처리할까요?")) return;
    setValidation(""); void onSave({ stem, choices, answer, explanation }, reason, resolve);
  }
  return <form onSubmit={(event) => { event.preventDefault(); submit(false); }}>
    <p className="admin-help">{data.question.certId} · {data.question.no}번 · 수정 버전 {data.version}. 원본 이미지와 문항 ID는 유지됩니다.</p>
    {data.question.images.length > 0 && <div className="question-review-images">{data.question.images.map((src, index) => <img key={src} src={src} alt={`원본 문항 이미지 ${index + 1}`} loading="lazy" />)}</div>}
    <fieldset disabled={busy} className="question-review-fields"><label>문제 본문<textarea required maxLength={20000} rows={6} value={stem} onChange={(event) => setStem(event.target.value)} /></label>
      {choices.map((choice, index) => <label key={index}>{choice.label} 보기<QuestionChoiceContent choice={{ ...choice, text: "" }} /><textarea required={!choice.images?.length} maxLength={10000} rows={3} value={choice.text} onChange={(event) => setChoices((items) => items.map((item, i) => i === index ? { ...item, text: event.target.value } : item))} /></label>)}
      <label>정답<select value={answer} onChange={(event) => setAnswer(Number(event.target.value))}>{choices.map((choice, index) => <option key={index} value={index}>{choice.label}</option>)}</select></label>
      <label>해설<textarea maxLength={20000} rows={4} value={explanation} onChange={(event) => setExplanation(event.target.value)} /></label>
      <label>수정 사유 (로그에 저장)<textarea required maxLength={2000} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="예: 정답을 ②에서 ③으로 정정" /></label>
    </fieldset>{validation && <p role="alert" className="question-review-error">{validation}</p>}<div className="admin-card-actions"><button type="submit" className="button button-primary" disabled={busy}>{busy ? "저장 중…" : "수정 저장"}</button><button type="button" className="button button-primary" disabled={busy} onClick={() => submit(true)}>저장 후 검수 완료</button><button type="button" className="button button-ghost" disabled={busy} onClick={() => { if (window.confirm("입력 내용을 버리고 최신 문항을 다시 불러올까요?")) onReload(); }}>최신 문항 다시 불러오기</button></div>
  </form>;
}
function ReviewSnapshot({ value }: { value: ReviewEvent["before_content"] }) {
  if ("status" in value) return <p>{value.status === "open" ? "검수 대기" : "검수 완료"}</p>;
  return <div><p>{value.stem}</p>{value.choices.map((choice, index) => <p key={index}>{choice.label} <QuestionChoiceContent choice={choice} /></p>)}<p>정답: {value.choices[value.answer]?.label}</p>{value.explanation && <p>해설: {value.explanation}</p>}</div>;
}
