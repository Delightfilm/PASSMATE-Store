import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export type QuestionStatus = "draft" | "needs_review" | "published";
export type GradeMode = "submit" | "instant";
export type QuestionTarget = "all" | "unanswered" | "wrong" | "bookmark";

export type Choice = { label: string; text: string };
export type Question = {
  id: string; examId: string; certId: string; no: number; subjectId: string;
  stem: string; images: string[]; choices: Choice[]; answer: number;
  explanation: string; status: QuestionStatus; sourceHash: string;
};
export type Subject = { id: string; certId: string; name: string };
export type Exam = { id: string; certId: string; year: number; round: string; title: string; durationMinutes: number; passScore: number; questionCount: number };
export type Cert = { id: string; name: string; category?: string; slug?: string };
export type MockConfig = { certName: string; minutes: number; passScore: number; passRule: "overall"; subjects: { internal: string; name: string; count: number; position: number }[] };
export type Dataset = { certs: Cert[]; subjects: Subject[]; exams: Exam[]; questions: Question[]; mockConfigs?: MockConfig[] };
export type AttemptConfig = { mode?: "mock" | "custom" | "past" | "subject"; certId: string; certSlug?: string; examIds: string[]; subjectIds: string[]; count: number; order: "ordered" | "random"; target: QuestionTarget; gradeMode: GradeMode; timeLimitMinutes: number | null; passScore?: number };
export type LocalAttempt = { id: string; config: AttemptConfig; questionIds: string[]; answers: Record<string, number>; lockedIds: string[]; reviewIds?: string[]; practiceNumber?: string; displayNameSnapshot?: string; seed?: string; serverManaged?: boolean; startedAt: string; endAt: string | null; submittedAt?: string; status: "in_progress" | "submitted"; score?: number };
export type IssueReport = { id: string; questionId: string; attemptId?: string; kind: "wrong_answer" | "broken_image" | "missing_choice" | "other"; memo: string; createdAt: string; status: "open" | "resolved" };
export type LocalStore = { attempts: LocalAttempt[]; bookmarks: string[]; wrongNotes: Record<string, { wrongCount: number; lastWrongAt: string; memo: string; mastered: boolean }>; presets: { name: string; config: AttemptConfig }[]; imports: ImportBatch[]; issueReports: IssueReport[] };
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
// Memory only; protect optimistic fields during auth refresh/catalog account merge.
export const pendingManagedAnswers = new Set<string>();
export const CBT_PREVIEW_READ_ONLY = process.env.NEXT_PUBLIC_CBT_PREVIEW_READ_ONLY === "1";
export function readLocalStore(): LocalStore { if (typeof window === "undefined") return EMPTY_STORE; try { return { ...EMPTY_STORE, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") }; } catch { return EMPTY_STORE; } }
export function writeLocalStore(store: LocalStore) { if (typeof window !== "undefined") { localStorage.setItem(STORE_KEY, JSON.stringify(store)); window.dispatchEvent(new Event("cbt-store")); } }
export function makeId(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
export function certCategory(name: string) { return ["산업기사", "기능사", "기능장", "기사", "공무원"].find((item) => name.includes(item)) || "기타"; }
export function certSlug(cert: Cert) { return cert.slug || cert.name.trim().replace(/\s+/g, "-"); }
export function findCert(dataset: Dataset, value: string) { const decoded = decodeURIComponent(value); return dataset.certs.find((cert) => cert.id === decoded || certSlug(cert) === decoded); }
export function hangulInitials(value: string) { const initials = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"; return Array.from(value).map((char) => { const code = char.charCodeAt(0) - 0xac00; return code >= 0 && code <= 11171 ? initials[Math.floor(code / 588)] : char; }).join(""); }
export async function submitIssueReport(report: IssueReport) { if (CBT_PREVIEW_READ_ONLY) throw new Error("테스트 DB 연결이 필요합니다."); const supabase = getSupabaseBrowserClient(); await supabase.from("question_bank_issue_reports").insert({ id: report.id, question_id: report.questionId, attempt_id: report.attemptId || null, kind: report.kind, memo: report.memo, status: report.status }); }
export async function syncAccountStore(store: LocalStore) {
  if (CBT_PREVIEW_READ_ONLY) return;
  const supabase = getSupabaseBrowserClient(); const { data } = await supabase.auth.getSession(); const userId = data.session?.user.id; if (!userId) return;
  for (const attempt of store.attempts.filter((item) => item.status === "in_progress" && !item.serverManaged)) {
    const payload = { user_id: userId, client_id: attempt.id, config: { ...attempt.config, lockedIds: attempt.lockedIds, reviewIds: attempt.reviewIds || [] }, question_ids: attempt.questionIds, answers: attempt.answers, started_at: attempt.startedAt, end_at: attempt.endAt, submitted_at: null, score: null, status: "in_progress" };
    const { data: updated } = await supabase.from("question_bank_attempts").update(payload).eq("user_id", userId).eq("client_id", attempt.id).eq("status", "in_progress").select("id");
    if (!updated?.length) await supabase.from("question_bank_attempts").upsert(payload, { onConflict: "user_id,client_id", ignoreDuplicates: true });
  }
  await supabase.from("question_bank_bookmarks").delete().eq("user_id", userId);
  if (store.bookmarks.length) await supabase.from("question_bank_bookmarks").insert(store.bookmarks.map((questionId) => ({ user_id: userId, question_id: questionId })));
  const serverQuestions = new Set(store.attempts.filter((attempt) => attempt.serverManaged).flatMap((attempt) => attempt.questionIds));
  const notes = Object.entries(store.wrongNotes).filter(([id]) => !serverQuestions.has(id)).map(([questionId, note]) => ({ user_id: userId, question_id: questionId, wrong_count: note.wrongCount, last_wrong_at: note.lastWrongAt, memo: note.memo, mastered: note.mastered }));
  if (notes.length) await supabase.from("question_bank_wrong_notes").upsert(notes, { onConflict: "user_id,question_id" });
  for (const [questionId, note] of Object.entries(store.wrongNotes).filter(([id]) => serverQuestions.has(id))) await supabase.from("question_bank_wrong_notes").update({ memo: note.memo, mastered: note.mastered }).eq("user_id", userId).eq("question_id", questionId);
}
export async function mergeAccountStore(local: LocalStore): Promise<LocalStore> {
  const supabase = getSupabaseBrowserClient(); const { data } = await supabase.auth.getSession(); const userId = data.session?.user.id; if (!userId) return local;
  const [attempts, bookmarks, wrongNotes] = await Promise.all([
    supabase.from("question_bank_attempts").select("id,client_id,config,question_ids,answers,started_at,end_at,submitted_at,score,status").eq("user_id", userId),
    supabase.from("question_bank_bookmarks").select("question_id").eq("user_id", userId),
    supabase.from("question_bank_wrong_notes").select("question_id,wrong_count,last_wrong_at,memo,mastered").eq("user_id", userId),
  ]);
  const remoteAttempts: LocalAttempt[] = (attempts.data || []).map((row) => ({ id: row.client_id || row.id, config: row.config as AttemptConfig, questionIds: row.question_ids as string[], answers: row.answers as Record<string, number>, lockedIds: Array.isArray(row.config?.lockedIds) ? row.config.lockedIds : [], reviewIds: row.config?.reviewIds || [], practiceNumber: row.config?.practiceNumber, displayNameSnapshot: row.config?.displayNameSnapshot, seed: row.config?.seed, serverManaged: row.config?.serverManaged === true, startedAt: row.started_at, endAt: row.end_at, submittedAt: row.submitted_at || undefined, score: row.score === null ? undefined : Number(row.score), status: row.status as LocalAttempt["status"] }));
  const current = readLocalStore();
  const mergedAttempts = [...local.attempts]; for (const attempt of remoteAttempts) {
    const optimistic = current.attempts.find(item => item.id === attempt.id);
    if (attempt.serverManaged && attempt.status === "in_progress" && optimistic?.status === "in_progress") {
      for (const id of attempt.questionIds.filter(id => pendingManagedAnswers.has(`${attempt.id}:${id}`))) {
        if (optimistic.answers[id] === undefined) delete attempt.answers[id]; else attempt.answers[id] = optimistic.answers[id];
        attempt.reviewIds = [...(attempt.reviewIds || []).filter(value => value !== id), ...((optimistic.reviewIds || []).includes(id) ? [id] : [])];
        attempt.lockedIds = [...attempt.lockedIds.filter(value => value !== id), ...(optimistic.lockedIds.includes(id) ? [id] : [])];
      }
    }
    const index = mergedAttempts.findIndex((item) => item.id === attempt.id); if (index < 0) mergedAttempts.push(attempt); else if (attempt.status === "submitted" || attempt.serverManaged) mergedAttempts[index] = attempt;
  }
  const mergedNotes = { ...local.wrongNotes }; for (const row of wrongNotes.data || []) mergedNotes[row.question_id] = { wrongCount: row.wrong_count, lastWrongAt: row.last_wrong_at, memo: row.memo, mastered: row.mastered };
  return { ...local, attempts: mergedAttempts, bookmarks: Array.from(new Set([...local.bookmarks, ...(bookmarks.data || []).map((row) => row.question_id)])), wrongNotes: mergedNotes };
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

function normalizeLiveChoices(value: unknown): Choice[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (typeof item === "string") return { label: ["①", "②", "③", "④", "⑤"][index] ?? String(index + 1), text: item };
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return { label: String(record.label || index + 1), text: String(record.text || "") };
  }).filter((item) => item.text);
}

export async function loadPublishedDataset(): Promise<Dataset> {
  const supabase = getSupabaseBrowserClient();
  const [certResult, subjectResult, examResult, mockResult] = await Promise.all([
    supabase.from("question_bank_certs").select("id,name").order("name"),
    supabase.from("question_bank_subjects").select("id,cert_id,name").order("part_number"),
    supabase.from("question_bank_exams").select("id,cert_id,year,round,title,duration_minutes,pass_score,question_count").order("exam_date", { ascending: false }),
    supabase.from("question_bank_mock_configs").select("cert_name,duration_minutes,pass_score,pass_rule,question_bank_mock_subjects(internal_name,official_name,question_count,position)").eq("status", "published"),
  ]);
  if (certResult.error || subjectResult.error || examResult.error) {
    throw new Error(`CBT 목록 조회 실패: ${certResult.error?.message || subjectResult.error?.message || examResult.error?.message}`);
  }
  if (!certResult.data?.length) throw new Error("CBT 종목이 등록되지 않았습니다.");

  const questionRows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await supabase
      .from("question_bank_questions")
      .select("id,exam_id,cert_id,subject_id,no,stem,images,choices,answer,explanation,status,source_hash")
      .eq("status", "published")
      .order("exam_id")
      .order("no")
      .range(from, from + 999);
    if (result.error) throw new Error(`CBT 문항 조회 실패: ${result.error.message}`);
    const page = (result.data ?? []) as Record<string, unknown>[];
    questionRows.push(...page);
    if (page.length < 1000) break;
  }
  if (!questionRows.length) throw new Error("공개된 CBT 문항이 없습니다.");
  // The new table is absent before migration; legacy catalog must remain usable.
  if (mockResult.error && !["42P01", "PGRST205", "PGRST200"].includes(mockResult.error.code)) throw new Error("모의시험 구성을 불러오지 못했습니다. 다시 시도해 주세요.");

  return {
    mockConfigs: (mockResult.data || []).map(row => ({ certName: row.cert_name, minutes: row.duration_minutes, passScore: row.pass_score, passRule: row.pass_rule as "overall", subjects: row.question_bank_mock_subjects.map(subject => ({ internal: subject.internal_name, name: subject.official_name, count: subject.question_count, position: subject.position })).sort((a,b) => a.position-b.position) })),
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
