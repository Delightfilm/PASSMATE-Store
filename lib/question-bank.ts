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
export type Cert = { id: string; name: string };
export type Dataset = { certs: Cert[]; subjects: Subject[]; exams: Exam[]; questions: Question[] };
export type AttemptConfig = { certId: string; examIds: string[]; subjectIds: string[]; count: number; order: "ordered" | "random"; target: QuestionTarget; gradeMode: GradeMode; timeLimitMinutes: number | null };
export type LocalAttempt = { id: string; config: AttemptConfig; questionIds: string[]; answers: Record<string, number>; lockedIds: string[]; startedAt: string; endAt: string | null; submittedAt?: string; status: "in_progress" | "submitted"; score?: number };
export type LocalStore = { attempts: LocalAttempt[]; bookmarks: string[]; wrongNotes: Record<string, { wrongCount: number; lastWrongAt: string; memo: string; mastered: boolean }>; presets: { name: string; config: AttemptConfig }[]; imports: ImportBatch[] };
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

export const DEMO_DATASET: Dataset = {
  certs: [{ id: "cert-computer-literacy-2", name: "컴퓨터활용능력 2급" }],
  subjects: [
    { id: "subject-spreadsheet", certId: "cert-computer-literacy-2", name: "스프레드시트 일반" },
    { id: "subject-database", certId: "cert-computer-literacy-2", name: "데이터베이스 일반" },
  ],
  exams: [{ id: "exam-demo-2026-1", certId: "cert-computer-literacy-2", year: 2026, round: "1회", title: "2026년 1회 샘플 모의고사", durationMinutes: 40, passScore: 60, questionCount: 6 }],
  questions: [
    { id: "demo-q1", examId: "exam-demo-2026-1", certId: "cert-computer-literacy-2", no: 1, subjectId: "subject-spreadsheet", stem: "스프레드시트에서 수식 입력을 시작하는 기호는 무엇인가요?", images: [], choices: [{ label: "①", text: "=" }, { label: "②", text: "#" }, { label: "③", text: "@" }, { label: "④", text: "$" }], answer: 0, explanation: "수식은 등호(=)로 시작합니다.", status: "published", sourceHash: "demo-q1" },
    { id: "demo-q2", examId: "exam-demo-2026-1", certId: "cert-computer-literacy-2", no: 2, subjectId: "subject-spreadsheet", stem: "A1 셀과 B1 셀의 값을 더하는 올바른 수식은?", images: [], choices: [{ label: "①", text: "A1+B1" }, { label: "②", text: "=A1+B1" }, { label: "③", text: "SUM A1 B1" }, { label: "④", text: "+A1+B1" }], answer: 1, explanation: "셀 참조를 더할 때 =A1+B1을 사용합니다.", status: "published", sourceHash: "demo-q2" },
    { id: "demo-q3", examId: "exam-demo-2026-1", certId: "cert-computer-literacy-2", no: 3, subjectId: "subject-spreadsheet", stem: "필터 기능의 주된 목적은 무엇인가요?", images: [], choices: [{ label: "①", text: "조건에 맞는 데이터만 표시" }, { label: "②", text: "파일 삭제" }, { label: "③", text: "서식 초기화" }, { label: "④", text: "프로그램 종료" }], answer: 0, explanation: "필터는 조건에 맞는 행만 일시적으로 표시합니다.", status: "published", sourceHash: "demo-q3" },
    { id: "demo-q4", examId: "exam-demo-2026-1", certId: "cert-computer-literacy-2", no: 4, subjectId: "subject-database", stem: "데이터베이스에서 행을 의미하는 용어는?", images: [], choices: [{ label: "①", text: "필드" }, { label: "②", text: "레코드" }, { label: "③", text: "테이블" }, { label: "④", text: "쿼리" }], answer: 1, explanation: "행(row)은 레코드(record)라고 합니다.", status: "published", sourceHash: "demo-q4" },
    { id: "demo-q5", examId: "exam-demo-2026-1", certId: "cert-computer-literacy-2", no: 5, subjectId: "subject-database", stem: "조건에 맞는 레코드를 검색하는 데이터베이스 객체는?", images: [], choices: [{ label: "①", text: "쿼리" }, { label: "②", text: "폼" }, { label: "③", text: "보고서" }, { label: "④", text: "매크로" }], answer: 0, explanation: "쿼리는 조건에 따라 데이터를 검색·가공합니다.", status: "published", sourceHash: "demo-q5" },
    { id: "demo-q6", examId: "exam-demo-2026-1", certId: "cert-computer-literacy-2", no: 6, subjectId: "subject-database", stem: "데이터를 중복 없이 식별하는 필드는 무엇인가요?", images: [], choices: [{ label: "①", text: "외래 키" }, { label: "②", text: "기본 키" }, { label: "③", text: "정렬 키" }, { label: "④", text: "검색 키" }], answer: 1, explanation: "기본 키는 레코드를 유일하게 식별합니다.", status: "published", sourceHash: "demo-q6" },
  ],
};

export const EMPTY_STORE: LocalStore = { attempts: [], bookmarks: [], wrongNotes: {}, presets: [], imports: [] };
export const STORE_KEY = "passmate.cbt-mate.v1";
export function readLocalStore(): LocalStore { if (typeof window === "undefined") return EMPTY_STORE; try { return { ...EMPTY_STORE, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") }; } catch { return EMPTY_STORE; } }
export function writeLocalStore(store: LocalStore) { if (typeof window !== "undefined") localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
export function makeId(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
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

export async function loadPublishedDataset(): Promise<Dataset | null> {
  const supabase = getSupabaseBrowserClient();
  const [certResult, subjectResult, examResult] = await Promise.all([
    supabase.from("question_bank_certs").select("id,name").order("name"),
    supabase.from("question_bank_subjects").select("id,cert_id,name").order("part_number"),
    supabase.from("question_bank_exams").select("id,cert_id,year,round,title,duration_minutes,pass_score,question_count").order("exam_date", { ascending: false }),
  ]);
  if (certResult.error || subjectResult.error || examResult.error || !certResult.data?.length) return null;

  const questionRows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await supabase
      .from("question_bank_questions")
      .select("id,exam_id,cert_id,subject_id,no,stem,images,choices,answer,explanation,status,source_hash")
      .eq("status", "published")
      .order("exam_id")
      .order("no")
      .range(from, from + 999);
    if (result.error) return null;
    const page = (result.data ?? []) as Record<string, unknown>[];
    questionRows.push(...page);
    if (page.length < 1000) break;
  }
  if (!questionRows.length) return null;

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
