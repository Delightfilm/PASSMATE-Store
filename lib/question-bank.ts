import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { normalizeLiveChoices } from "./question-bank-choices";

export type QuestionStatus = "draft" | "needs_review" | "published";
export type GradeMode = "submit" | "instant";
export type QuestionTarget = "all" | "unanswered" | "wrong" | "bookmark";

export type Choice = { label: string; text: string; images?: string[] };
export type Question = {
  id: string; examId: string; certId: string; no: number; subjectId: string;
  stem: string; images: string[]; choices: Choice[]; answer: number;
  explanation: string; status: QuestionStatus; sourceHash: string;
};
export type Subject = { id: string; certId: string; name: string };
export type Exam = { id: string; certId: string; year: number; round: string; title: string; durationMinutes: number; passScore: number; questionCount: number };
export type Cert = { id: string; name: string; category?: string; slug?: string; questionCount?: number; examCount?: number };
export type Dataset = { certs: Cert[]; subjects: Subject[]; exams: Exam[]; questions: Question[]; totalQuestions?: number };
export type AttemptConfig = { certId: string; certSlug?: string; examIds: string[]; subjectIds: string[]; count: number; order: "ordered" | "random"; target: QuestionTarget; gradeMode: GradeMode; timeLimitMinutes: number | null };
export type LocalAttempt = { id: string; config: AttemptConfig; questionIds: string[]; answers: Record<string, number>; lockedIds: string[]; reviewedQuestionIds?: string[]; startedAt: string; endAt: string | null; submittedAt?: string; status: "in_progress" | "submitted"; score?: number };
export type IssueReport = { id: string; questionId: string; qualificationCode?: string; attemptId?: string; kind: "wrong_answer" | "broken_image" | "missing_choice" | "other"; memo: string; createdAt: string; status: "open" | "resolved" };
export type LocalStore = { attempts: LocalAttempt[]; bookmarks: string[]; wrongNotes: Record<string, { wrongCount: number; lastWrongAt: string; memo: string; mastered: boolean }>; presets: { name: string; config: AttemptConfig }[]; imports: ImportBatch[]; issueReports: IssueReport[]; questionCerts?: Record<string, string> };
export type ImportRow = { id?: string; question_uid?: string; source_uid?: string; exam_id?: string; question_no?: number; subject_id?: string; stem?: string; question?: string; choices?: unknown; answer?: unknown; answer_no?: unknown; images?: unknown; visual_refs?: unknown; visual_assets?: unknown; exam?: string; subject?: string; cert?: string; sourceHash?: string; status?: QuestionStatus; [key: string]: unknown };
export type ImportError = { row: number; message: string };
export type ImportContext = {
  schemaVersion: string;
  qualification: Record<string, unknown>;
  examSessions: Record<string, unknown>[];
  subjects: Record<string, unknown>[];
};
export type ParsedImport = { rows: ImportRow[]; errors: ImportError[]; context: ImportContext | null };
export type ImportBatch = { id: string; remoteId?: string; createdAt: string; fileName: string; rows: ImportRow[]; errors: ImportError[]; status: "importing" | "needs_review" | "published" | "rolled_back" | "failed" };

export const EMPTY_STORE: LocalStore = { attempts: [], bookmarks: [], wrongNotes: {}, presets: [], imports: [], issueReports: [] };
export const STORE_KEY = "passmate.cbt-mate.v1";
export function readLocalStore(): LocalStore { if (typeof window === "undefined") return EMPTY_STORE; try { return { ...EMPTY_STORE, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") }; } catch { return EMPTY_STORE; } }
export function writeLocalStore(store: LocalStore) { if (typeof window !== "undefined") { localStorage.setItem(STORE_KEY, JSON.stringify(store)); window.dispatchEvent(new Event("cbt-store")); } }
export function makeId(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
export function certCategory(name: string) { return ["산업기사", "기능사", "기능장", "기사", "공무원"].find((item) => name.includes(item)) || "기타"; }
export function certSlug(cert: Cert) { return cert.slug || cert.name.trim().replace(/\s+/g, "-"); }
export function findCert(dataset: Dataset, value: string) { const decoded = decodeURIComponent(value); return dataset.certs.find((cert) => cert.id === decoded || certSlug(cert) === decoded); }
export function hangulInitials(value: string) { const initials = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"; return Array.from(value).map((char) => { const code = char.charCodeAt(0) - 0xac00; return code >= 0 && code <= 11171 ? initials[Math.floor(code / 588)] : char; }).join(""); }
export async function submitIssueReport(report: IssueReport) { const supabase = getSupabaseBrowserClient(); const nas = /^[a-f0-9]{20}$/.test(report.questionId); const { error } = await supabase.from("question_bank_issue_reports").insert({ id: report.id, question_id: nas ? null : report.questionId, ...(nas ? { question_ref: report.questionId } : {}), qualification_code: report.qualificationCode || null, attempt_id: report.attemptId || null, kind: report.kind, memo: report.memo, status: report.status }); if (error) throw error; }
export async function syncAccountStore(store: LocalStore) {
  const supabase = getSupabaseBrowserClient(); const { data } = await supabase.auth.getSession(); const userId = data.session?.user.id; if (!userId) return;
  for (const attempt of store.attempts.filter((item) => item.status === "in_progress")) {
    const payload = { user_id: userId, client_id: attempt.id, config: { ...attempt.config, lockedIds: attempt.lockedIds, reviewedQuestionIds: attempt.reviewedQuestionIds || [] }, question_ids: attempt.questionIds, answers: attempt.answers, started_at: attempt.startedAt, end_at: attempt.endAt, submitted_at: null, score: null, status: "in_progress" };
    const { data: updated } = await supabase.from("question_bank_attempts").update(payload).eq("user_id", userId).eq("client_id", attempt.id).eq("status", "in_progress").select("id");
    if (!updated?.length) await supabase.from("question_bank_attempts").upsert(payload, { onConflict: "user_id,client_id", ignoreDuplicates: true });
  }
  const isNas = (id: string) => /^[a-f0-9]{20}$/.test(id);
  const nasIds = new Set([...store.bookmarks, ...Object.keys(store.wrongNotes), ...Object.keys(store.questionCerts || {})].filter(isNas));
  const state = [...nasIds].filter((id) => store.questionCerts?.[id]).map((id) => {
    const note = store.wrongNotes[id];
    return { user_id: userId, question_ref: id, qualification_code: store.questionCerts![id], bookmarked: store.bookmarks.includes(id), wrong_count: note?.wrongCount || 0, last_wrong_at: note?.lastWrongAt || null, memo: note?.memo || "", mastered: note?.mastered || false, updated_at: new Date().toISOString() };
  });
  if (state.length) { const { error } = await supabase.from("question_bank_user_question_state").upsert(state, { onConflict: "user_id,question_ref" }); if (error) console.error("[CBT MATE] 개인 문항 기록 동기화 실패", error); }
  const legacyBookmarks = store.bookmarks.filter((id) => !isNas(id));
  await supabase.from("question_bank_bookmarks").delete().eq("user_id", userId);
  if (legacyBookmarks.length) await supabase.from("question_bank_bookmarks").insert(legacyBookmarks.map((questionId) => ({ user_id: userId, question_id: questionId })));
  const notes = Object.entries(store.wrongNotes).filter(([id]) => !isNas(id)).map(([questionId, note]) => ({ user_id: userId, question_id: questionId, wrong_count: note.wrongCount, last_wrong_at: note.lastWrongAt, memo: note.memo, mastered: note.mastered }));
  if (notes.length) await supabase.from("question_bank_wrong_notes").upsert(notes, { onConflict: "user_id,question_id" });
}
export async function mergeAccountStore(local: LocalStore): Promise<LocalStore> {
  const supabase = getSupabaseBrowserClient(); const { data } = await supabase.auth.getSession(); const userId = data.session?.user.id; if (!userId) return local;
  const [attempts, bookmarks, wrongNotes, nasState] = await Promise.all([
    supabase.from("question_bank_attempts").select("id,client_id,config,question_ids,answers,started_at,end_at,submitted_at,score,status").eq("user_id", userId),
    supabase.from("question_bank_bookmarks").select("question_id").eq("user_id", userId),
    supabase.from("question_bank_wrong_notes").select("question_id,wrong_count,last_wrong_at,memo,mastered").eq("user_id", userId),
    supabase.from("question_bank_user_question_state").select("question_ref,qualification_code,bookmarked,wrong_count,last_wrong_at,memo,mastered").eq("user_id", userId),
  ]);
  const remoteAttempts: LocalAttempt[] = (attempts.data || []).map((row) => ({ id: row.client_id || row.id, config: row.config as AttemptConfig, questionIds: row.question_ids as string[], answers: row.answers as Record<string, number>, lockedIds: Array.isArray(row.config?.lockedIds) ? row.config.lockedIds : [], reviewedQuestionIds: Array.isArray(row.config?.reviewedQuestionIds) ? row.config.reviewedQuestionIds : [], startedAt: row.started_at, endAt: row.end_at, submittedAt: row.submitted_at || undefined, score: row.score === null ? undefined : Number(row.score), status: row.status as LocalAttempt["status"] }));
  const mergedAttempts = [...local.attempts]; for (const attempt of remoteAttempts) { const index = mergedAttempts.findIndex((item) => item.id === attempt.id); if (index < 0) mergedAttempts.push(attempt); else if (attempt.status === "submitted") mergedAttempts[index] = attempt; }
  const mergedNotes = { ...local.wrongNotes }; for (const row of wrongNotes.data || []) mergedNotes[row.question_id] = { wrongCount: row.wrong_count, lastWrongAt: row.last_wrong_at, memo: row.memo, mastered: row.mastered };
  const questionCerts = { ...local.questionCerts }; const nasBookmarks: string[] = [];
  for (const row of nasState.data || []) {
    questionCerts[row.question_ref] = row.qualification_code;
    if (row.bookmarked) nasBookmarks.push(row.question_ref);
    if (row.wrong_count > 0) mergedNotes[row.question_ref] = { wrongCount: row.wrong_count, lastWrongAt: row.last_wrong_at, memo: row.memo, mastered: row.mastered };
  }
  return { ...local, attempts: mergedAttempts, bookmarks: Array.from(new Set([...local.bookmarks, ...(bookmarks.data || []).map((row) => row.question_id), ...nasBookmarks])), wrongNotes: mergedNotes, questionCerts };
}
export async function sourceHash(value: unknown) { const text = JSON.stringify(value); if (typeof crypto !== "undefined" && crypto.subtle) { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)); return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join(""); } return Array.from(text).reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0).toString(16); }

function csvCells(line: string) { const cells: string[] = []; let cell = "", quoted = false; for (const char of line) { if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { cells.push(cell.trim()); cell = ""; } else cell += char; } cells.push(cell.trim()); return cells; }
export async function parseImportFile(file: File): Promise<ParsedImport> {
  const text = await file.text(); const name = file.name.toLowerCase(); let rows: ImportRow[] = []; let context: ImportContext | null = null;
  try {
    if (name.endsWith(".json")) {
      const parsed = JSON.parse(text);
      rows = Array.isArray(parsed) ? parsed : parsed.questions || [];
      if (!Array.isArray(parsed) && parsed.qualification && Array.isArray(parsed.exam_sessions) && Array.isArray(parsed.subjects)) {
        context = { schemaVersion: String(parsed.schema_version || ""), qualification: parsed.qualification, examSessions: parsed.exam_sessions, subjects: parsed.subjects };
      }
    }
    else if (name.endsWith(".csv")) { const [head, ...lines] = text.split(/\r?\n/).filter(Boolean); const keys = csvCells(head).map((key) => key.replace(/^\uFEFF/, "")); rows = lines.map((line) => Object.fromEntries(csvCells(line).map((value, i) => [keys[i] || `column${i + 1}`, value]))); }
    else { rows = text.split(/\n(?=##?\s)/).filter(Boolean).map((block) => { const lines = block.split(/\r?\n/); const stem = lines.find((line) => /^##?\s/.test(line))?.replace(/^##?\s*/, "") || ""; const choices = lines.filter((line) => /^\s*[①②③④1-4][.)\s]/.test(line)).map((line) => line.replace(/^\s*/, "")); const answer = lines.find((line) => /^(정답|answer)\s*:/i.test(line))?.split(":")[1]?.trim() || ""; return { stem, choices, answer }; }); }
  } catch { return { rows: [], errors: [{ row: 1, message: "파일 형식을 읽을 수 없습니다." }], context: null }; }
  const errors: ImportError[] = [];
  rows.forEach((row, index) => {
    const stem = String(row.stem || row.question || "").trim();
    const choices = Array.isArray(row.choices) ? row.choices : String(row.choices || "").split(/\s*\|\s*/).filter(Boolean);
    const answer = row.answer_no ?? row.answer;
    if (!stem) errors.push({ row: index + 2, message: "문항 본문(stem)이 없습니다." });
    if (choices.length < 2) errors.push({ row: index + 2, message: "보기(choices)는 2개 이상이어야 합니다." });
    if (answer === undefined || answer === "") errors.push({ row: index + 2, message: "정답(answer)이 없습니다." });
    if (context && !String(row.question_uid || "").trim()) errors.push({ row: index + 2, message: "원본 문항 ID(question_uid)가 없습니다." });
    if (context && !String(row.exam_id || "").trim()) errors.push({ row: index + 2, message: "시험 회차 ID(exam_id)가 없습니다." });
  });
  return { rows, errors, context };
}

export async function loadPublishedDataset(signal?: AbortSignal): Promise<Dataset> {
  signal?.throwIfAborted();
  const supabase = getSupabaseBrowserClient();
  const certQuery = supabase.from("question_bank_certs").select("id,name").order("name");
  const subjectQuery = supabase.from("question_bank_subjects").select("id,cert_id,name").order("part_number");
  const examQuery = supabase.from("question_bank_exams").select("id,cert_id,year,round,title,duration_minutes,pass_score,question_count").order("exam_date", { ascending: false });
  const [certResult, subjectResult, examResult] = await Promise.all([
    signal ? certQuery.abortSignal(signal) : certQuery,
    signal ? subjectQuery.abortSignal(signal) : subjectQuery,
    signal ? examQuery.abortSignal(signal) : examQuery,
  ]);
  signal?.throwIfAborted();
  if (certResult.error || subjectResult.error || examResult.error) {
    throw new Error(`CBT 목록 조회 실패: ${certResult.error?.message || subjectResult.error?.message || examResult.error?.message}`);
  }
  if (!certResult.data?.length) throw new Error("CBT 종목이 등록되지 않았습니다.");

  const questionRows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const query = supabase
      .from("question_bank_questions")
      .select("id,exam_id,cert_id,subject_id,no,stem,images,choices,answer,explanation,status,source_hash")
      .eq("status", "published")
      .order("exam_id")
      .order("no")
      .range(from, from + 999);
    const result = await (signal ? query.abortSignal(signal) : query);
    signal?.throwIfAborted();
    if (result.error) throw new Error(`CBT 문항 조회 실패: ${result.error.message}`);
    const page = (result.data ?? []) as Record<string, unknown>[];
    questionRows.push(...page);
    if (page.length < 1000) break;
  }
  if (!questionRows.length) throw new Error("공개된 CBT 문항이 없습니다.");

  return {
    certs: certResult.data.map((row) => ({ id: row.id, name: row.name })),
    subjects: subjectResult.data.map((row) => ({ id: row.id, certId: row.cert_id, name: row.name })),
    exams: examResult.data.map((row) => ({ id: row.id, certId: row.cert_id, year: row.year, round: row.round, title: row.title, durationMinutes: row.duration_minutes, passScore: Number(row.pass_score), questionCount: row.question_count })),
    questions: questionRows.map((row) => ({
      id: String(row.id), examId: String(row.exam_id), certId: String(row.cert_id), no: Number(row.no), subjectId: String(row.subject_id || ""),
      stem: String(row.stem), images: Array.isArray(row.images) ? row.images.map(String) : [], choices: normalizeLiveChoices(row.choices), answer: Number(row.answer),
      explanation: String(row.explanation || ""), status: row.status as QuestionStatus, sourceHash: String(row.source_hash),
    })),
  };
}
