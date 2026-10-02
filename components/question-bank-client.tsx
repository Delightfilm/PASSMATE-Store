"use client";

import { CbtMateLogo } from "@/components/logo";
import { SiteHeader } from "@/components/site-header";
import { AnswerChoices, CBT_RIGHTS_NOTICE, ExamViewSettings, MockExamGuide, toggleAnswerSelection } from "@/components/cbt-exam-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { timeLeftSeconds } from "@/lib/exam-time";
import { SERVER_EXAMS, cbtPost, serverAttempt } from "@/lib/cbt-server-client";
import { MOCK_SUBJECTS, attemptLabel, centerInScroller, expiredAttempt, subjectName } from "@/lib/cbt-presentation";
import {
  CBT_PREVIEW_READ_ONLY, certCategory, certSlug, EMPTY_STORE, findCert, hangulInitials, STORE_KEY,
  loadPublishedDataset, makeId, mergeAccountStore, readLocalStore, submitIssueReport, syncAccountStore, writeLocalStore,
  type Cert, type Dataset, type GradeMode, type IssueReport, type LocalAttempt,
  type LocalStore, type Question, type QuestionTarget,
} from "@/lib/question-bank";

type Mode = "home" | "cert" | "exam" | "wrong-notes" | "bookmarks" | "history";
type ModalName = "question-menu" | "menu" | "interim" | "exit" | "submit" | "expired" | null;

function shuffle<T>(items: T[]) { return [...items].sort(() => Math.random() - .5); }
function formatSeconds(value: number) { const seconds = Math.max(0, value); return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`; }
function scoreAttempt(attempt: LocalAttempt, questions: Question[]) { const correct = questions.filter((question) => attempt.answers[question.id] === question.answer).length; return questions.length ? Math.round(correct / questions.length * 100) : 0; }
function displayDate(value?: string) { return value ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value)) : "-"; }

export function QuestionBankClient({ mode = "home", certParam = "", attemptId = "" }: { mode?: Mode; certParam?: string; attemptId?: string }) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [store, setStore] = useState<LocalStore>(EMPTY_STORE);
  const [hydrated, setHydrated] = useState(false);
  const [dataState, setDataState] = useState<"loading" | "live" | "error">("loading");
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [displayName, setDisplayName] = useState("수험자");
  const syncTimer = useRef<number | null>(null);

  const retryDataset = useCallback(() => {
    setDataState("loading");
    void loadPublishedDataset().then((live) => { setDataset(live); setDataState("live"); }).catch((error) => {
      console.error("[CBT MATE] 운영 문제 데이터를 불러오지 못했습니다.", error);
      setDataset(null); setDataState("error");
    });
  }, []);

  useEffect(() => {
    setStore(readLocalStore()); setHydrated(true);
    retryDataset();
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setAuthReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); setAuthReady(true); });
    return () => data.subscription.unsubscribe();
  }, [retryDataset]);
  useEffect(() => { if (!user) return; void mergeAccountStore(readLocalStore()).then((next) => { setStore(next); writeLocalStore(next); }); }, [user]);
  useEffect(() => { let active = true; setDisplayName("수험자"); if (user) void getSupabaseBrowserClient().from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(({ data }) => { if (active) setDisplayName(data?.display_name?.trim() || "수험자"); }); return () => { active = false; }; }, [user?.id]);
  useEffect(() => { const refresh = (event: StorageEvent) => { if (event.key === STORE_KEY) setStore(readLocalStore()); }; window.addEventListener("storage", refresh); return () => window.removeEventListener("storage", refresh); }, []);
  const saveStore = useCallback((next: LocalStore) => { const current = readLocalStore(); const attempts = next.attempts.map((item) => item.status === "in_progress" ? current.attempts.find((saved) => saved.id === item.id && saved.status === "submitted") || item : item); const safe = { ...next, attempts }; const started = attempts.some((item) => item.status === "in_progress" && !current.attempts.some((saved) => saved.id === item.id)); setStore(safe); writeLocalStore(safe); if (user) { if (syncTimer.current) window.clearTimeout(syncTimer.current); if (started) void syncAccountStore(safe); else syncTimer.current = window.setTimeout(() => void syncAccountStore(safe), 400); } }, [user]);

  if (!hydrated || dataState === "loading") return <CbtSkeleton />;
  if (dataState === "error" || !dataset) return <PageShell><div className="cbt-load-error" role="alert"><h1>문제 데이터를 불러오지 못했습니다.</h1><p>잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 알려 주세요.</p><button type="button" className="button button-primary" onClick={retryDataset}>다시 시도</button></div></PageShell>;
  if (mode === "home") return <CbtHome dataset={dataset} />;
  if (mode === "exam") return <ExamScreen dataset={dataset} store={store} saveStore={saveStore} certParam={certParam} attemptId={attemptId} user={user} displayName={displayName} />;
  if (mode === "wrong-notes" || mode === "bookmarks" || mode === "history") return <LearningScreen mode={mode} dataset={dataset} store={store} saveStore={saveStore} user={user} authReady={authReady} />;
  const cert = findCert(dataset, certParam);
  if (!cert) return <PageShell><EmptyState title="종목을 찾을 수 없습니다." body="종목 선택 화면에서 다시 선택해 주세요." href="/cbt/" action="종목 선택으로" /></PageShell>;
  return <CertDetail dataset={dataset} cert={cert} store={store} saveStore={saveStore} user={user} displayName={displayName} />;
}

function PageShell({ children }: { children: React.ReactNode }) { return <section className="question-bank-page"><div className="container question-bank-container"><CbtPreviewNotice />{children}</div></section>; }
function CbtPreviewNotice() { return CBT_PREVIEW_READ_ONLY ? <p className="cbt-preview-notice" role="status">현재 Preview에는 테스트 DB가 연결되지 않았습니다. 선택 내용은 이 브라우저에만 저장되며 서버 제출·신고는 비활성 상태입니다.</p> : null; }
function CbtSkeleton() { return <section className="question-bank-page"><div className="container question-bank-skeleton" aria-label="불러오는 중"><span /><strong /><i /><div><span /><span /></div></div></section>; }

function CbtHome({ dataset }: { dataset: Dataset }) {
  const [query, setQuery] = useState(""); const [category, setCategory] = useState("전체"); const [builder, setBuilder] = useState(false);
  useEffect(() => { const search = new URLSearchParams(window.location.search); setCategory(search.get("cat") || "전체"); setBuilder(search.get("tab") === "builder"); }, []);
  const certs = useMemo(() => dataset.certs.map((cert) => ({ ...cert, category: cert.category || certCategory(cert.name) })), [dataset]);
  const categories = useMemo(() => ["전체", ...Array.from(new Set(certs.map((cert) => cert.category!))).sort((a, b) => a.localeCompare(b, "ko"))], [certs]);
  const filtered = certs.filter((cert) => { const word = query.replace(/\s/g, "").toLowerCase(); const name = cert.name.replace(/\s/g, "").toLowerCase(); return (category === "전체" || cert.category === category) && (!word || name.includes(word) || hangulInitials(name).includes(word)); });
  const groups = categories.filter((item) => item !== "전체").map((item) => ({ name: item, certs: filtered.filter((cert) => cert.category === item) })).filter((group) => group.certs.length);
  function chooseCategory(value: string) { setCategory(value); const url = new URL(window.location.href); if (value === "전체") url.searchParams.delete("cat"); else url.searchParams.set("cat", value); window.history.replaceState({}, "", `${url.pathname}${url.search}`); }
  return <PageShell>
    <div className="question-bank-hero cbt-home-hero"><div><span className="eyebrow">CBT MATE</span><h1>실전처럼 풀고, 약점을 바로 확인하세요.</h1><p>종목을 선택한 뒤 회차별 기출이나 모의시험을 시작하세요.</p></div><span className="question-bank-status">기출 {dataset.questions.length.toLocaleString()}문항</span></div>
    <label className="cbt-search"><span className="cbt-search-icon" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="종목명을 검색하세요 (예: 정보처리기사)" aria-label="종목 검색" /></label>
    {certs.length > 1 && <div className="cbt-category-chips" aria-label="종목 카테고리">{categories.map((item) => <button className={category === item ? "is-active" : ""} onClick={() => chooseCategory(item)} key={item}>{item}</button>)}</div>}
    {groups.length ? groups.map((group) => <section className="cbt-cert-group" key={group.name}>{certs.length > 1 && <div className="cbt-section-head"><h2>{group.name}</h2><span>{group.certs.length.toLocaleString()}개</span></div>}<div className="cbt-cert-grid">{group.certs.map((cert) => <Link href={`/cbt/${encodeURIComponent(certSlug(cert))}/${builder ? "?tab=custom" : ""}`} className="cbt-cert-card" key={cert.id}>{certs.length > 1 && <small>{cert.category}</small>}<strong>{cert.name}</strong><span>회차 {dataset.exams.filter((exam) => exam.certId === cert.id).length.toLocaleString()}개 · 문제 {dataset.questions.filter((question) => question.certId === cert.id).length.toLocaleString()}문항</span></Link>)}</div></section>) : <EmptyState title="검색 결과가 없습니다." body="다른 종목명이나 카테고리로 찾아보세요." action="검색 초기화" onAction={() => { setQuery(""); chooseCategory("전체"); }} />}
  </PageShell>;
}

function CertDetail({ dataset, cert, store, saveStore, user, displayName }: { dataset: Dataset; cert: Cert; store: LocalStore; saveStore: (store: LocalStore) => void; user: User | null; displayName: string }) {
  const router = useRouter();
  const certExams = useMemo(() => dataset.exams.filter((exam) => exam.certId === cert.id).sort((a, b) => b.year - a.year || b.round.localeCompare(a.round)), [dataset, cert]);
  const subjects = useMemo(() => dataset.subjects.filter((subject) => subject.certId === cert.id), [dataset, cert]);
  const years = Array.from(new Set(certExams.map((exam) => exam.year))).sort((a, b) => b - a);
  const [tab, setTabState] = useState<"exams" | "subjects" | "mock" | "custom" | "records">("exams"); const [year, setYear] = useState(years[0] || 0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [selectedExamId, setSelectedExamId] = useState(certExams[0]?.id || ""); const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]); const [selectedExamIds, setSelectedExamIds] = useState(certExams.map((exam) => exam.id));
  const [yearExpanded, setYearExpanded] = useState(false); const [startExamId, setStartExamId] = useState(""); const [gradeMode, setGradeMode] = useState<GradeMode>("submit");
  const [count] = useState(60); const [order, setOrder] = useState<"ordered" | "random">("random"); const [target, setTarget] = useState<QuestionTarget>("all"); const [timeLimit, setTimeLimit] = useState<number | null>(60); const [toast, setToast] = useState("");
  const [builderCounts, setBuilderCounts] = useState<Record<string, number>>(() => Object.fromEntries(subjects.map((subject) => [subject.id, 20])));
  const [showGuide, setShowGuide] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [identity, setIdentity] = useState<{ practiceNumber: string; displayName: string; date: string } | null>(null);
  const [starting, setStarting] = useState(false);
  useEffect(() => { const value = new URLSearchParams(window.location.search).get("tab"); if (value === "builder") setTab("custom"); else if (value === "subjects" || value === "mock" || value === "custom" || value === "records") setTabState(value); }, []);
  useEffect(() => {
    const container = tabsRef.current;
    const reveal = () => { const active = container?.querySelector<HTMLElement>('[aria-selected="true"]'); if (container && active) centerInScroller(active, container); };
    reveal();
    if (!container) return;
    const observer = new ResizeObserver(reveal);
    observer.observe(container);
    return () => observer.disconnect();
  }, [tab]);
  function setTab(value: typeof tab) { setTabState(value); const url = new URL(window.location.href); if (value === "exams") url.searchParams.delete("tab"); else url.searchParams.set("tab", value); window.history.replaceState({}, "", `${url.pathname}${url.search}`); }
  async function begin(questionIds: string[], examIds: string[], mode: GradeMode, minutes: number | null, exact = false, subjectIds = selectedSubjects) { const ids = exact ? questionIds : order === "random" ? shuffle(questionIds).slice(0, count) : questionIds.slice(0, count); if (!ids.length) { setToast("선택한 범위에 출제 가능한 문제가 없습니다."); return; } if (SERVER_EXAMS) {
    setStarting(true);
    try { const row = await cbtPost<Parameters<typeof serverAttempt>[0]>("/api/cbt/attempts/start/", { certId: cert.id, mode: tab === "custom" ? "custom" : tab === "subjects" ? "subject" : "past", questionIds: ids, minutes, gradeMode: mode }); const attempt = serverAttempt(row); const latest = readLocalStore(); saveStore({ ...latest, attempts: [attempt, ...latest.attempts] }); router.push(`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${attempt.id}/`); } catch (error) { setToast(error instanceof Error ? error.message : "시험을 시작하지 못했습니다."); } finally { setStarting(false); } return;
  } const id = makeId("attempt"); const now = new Date(); const attempt: LocalAttempt = { id, config: { mode: tab === "custom" ? "custom" : tab === "subjects" ? "subject" : "past", certId: cert.id, certSlug: certSlug(cert), examIds, subjectIds, count: ids.length, order: exact ? "ordered" : order, target, gradeMode: mode, timeLimitMinutes: minutes }, questionIds: ids, answers: {}, lockedIds: [], startedAt: now.toISOString(), endAt: minutes ? new Date(now.getTime() + minutes * 60000).toISOString() : null, status: "in_progress" }; saveStore({ ...store, attempts: [attempt, ...store.attempts] }); router.push(`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${id}/`); }
  function beginBuilder() { const scopedSubjects = selectedSubjects.length ? selectedSubjects : subjects.map((subject) => subject.id); const ids = scopedSubjects.flatMap((subjectId) => { const available = pool.filter((question) => question.subjectId === subjectId); const ordered = order === "random" ? shuffle(available) : available.sort((a, b) => a.no - b.no); return ordered.slice(0, Math.max(0, builderCounts[subjectId] || 0)).map((question) => question.id); }); begin(ids, selectedExamIds, gradeMode, timeLimit, true); }
  function beginExam() { const exam = certExams.find((item) => item.id === startExamId); if (exam) begin(dataset.questions.filter((question) => question.examId === exam.id).sort((a, b) => a.no - b.no).map((question) => question.id), [exam.id], gradeMode, exam.durationMinutes, true); }
  const mockAvailable = MOCK_SUBJECTS.every((rule) => { const matched = subjects.filter((subject) => subject.name === rule.internal || subject.name === rule.name); return matched.length === 1 && dataset.questions.filter((question) => question.subjectId === matched[0].id && question.choices.length === 4 && question.answer >= 0 && question.answer <= 3).length >= 20; });
  async function prepareMock() {
    if (!mockAvailable || starting) return;
    setStarting(true);
    try { const prepared = await cbtPost<{ practiceNumber: string; displayName: string; date: string }>("/api/cbt/identity/"); setIdentity(prepared); if (showGuide) setGuideOpen(true); else setStartExamId("__mock__"); }
    catch (error) { setToast(error instanceof Error ? error.message : "시험 정보를 준비하지 못했습니다."); } finally { setStarting(false); }
  }
  async function beginMock() {
    if (starting) return; setStarting(true);
    try { const row = await cbtPost<Parameters<typeof serverAttempt>[0]>("/api/cbt/attempts/start/", { certId: cert.id, mode: "mock", questionIds: [], minutes: 60, gradeMode: "submit" }); const attempt = serverAttempt(row); const latest = readLocalStore(); saveStore({ ...latest, attempts: [attempt, ...latest.attempts] }); router.push(`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${attempt.id}/`); }
    catch (error) { setToast(error instanceof Error ? error.message : "시험을 시작하지 못했습니다."); } finally { setStarting(false); }
  }
  const allBuilderQuestions = dataset.questions.filter((question) => question.certId === cert.id && selectedExamIds.includes(question.examId) && (!selectedSubjects.length || selectedSubjects.includes(question.subjectId)));
  const attempted = new Set(store.attempts.flatMap((attempt) => Object.keys(attempt.answers)));
  const pool = allBuilderQuestions.filter((question) => target === "all" || (target === "unanswered" && !attempted.has(question.id)) || (target === "wrong" && !!store.wrongNotes[question.id]) || (target === "bookmark" && store.bookmarks.includes(question.id)));
  const shownYears = yearExpanded ? years : years.slice(0, 6); const rounds = certExams.filter((exam) => exam.year === year); const selectedExam = certExams.find((exam) => exam.id === selectedExamId);
  const mockExam = { id: "__mock__", certId: cert.id, year: new Date().getFullYear(), round: "모의시험", title: `${cert.name} 모의시험`, durationMinutes: 60, passScore: 60, questionCount: 60 };
  return <PageShell>
    <nav className="cbt-breadcrumb" aria-label="현재 위치"><Link href="/cbt/">CBT MATE</Link><span>›</span><Link href={`/cbt/?cat=${encodeURIComponent(cert.category || certCategory(cert.name))}`}>{cert.category || certCategory(cert.name)}</Link><span>›</span><b>{cert.name}</b></nav>
    <div className="question-bank-hero"><div><span className="eyebrow">시험 준비</span><h1>{cert.name}</h1><p>원하는 방식으로 문제를 풀고 학습 기록을 이어가세요.</p></div></div>
    <div className="cbt-detail-tabs-wrap"><div ref={tabsRef} className="question-bank-tabs" role="tablist" aria-label="학습 방식" onKeyDown={(event) => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')); const index = tabs.indexOf(event.target as HTMLButtonElement); const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length; tabs[next]?.click(); tabs[next]?.focus({ preventScroll: true }); if (tabs[next]) centerInScroller(tabs[next], event.currentTarget); }}>{([['exams','회차별 기출'],['subjects','단원별'],['mock','모의시험'],['custom','맞춤 시험지'],['records','이 종목 기록']] as const).map(([value, label]) => <button type="button" role="tab" id={`cbt-tab-${value}`} aria-controls="cbt-detail-panel" aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} className={tab === value ? "is-active" : ""} onClick={() => setTab(value)} key={value}>{label}</button>)}</div></div>
    <div role="tabpanel" id="cbt-detail-panel" aria-labelledby={`cbt-tab-${tab}`}>
    {tab === "exams" && <div className="question-bank-grid"><section className="question-library-card"><CardHead no="01" title="연도와 회차 선택" desc="시험을 시작할 회차를 골라주세요." /><h3 className="cbt-field-label">연도 선택</h3><div className="cbt-chip-list">{shownYears.map((item) => <button type="button" className={year === item ? "is-active" : ""} aria-pressed={year === item} onClick={() => { setYear(item); setSelectedExamId(certExams.find((exam) => exam.year === item)?.id || ""); }} key={item}>{item}년</button>)}</div>{years.length > 6 && <button className="cbt-more" onClick={() => setYearExpanded(!yearExpanded)}>{yearExpanded ? "접기" : "더 보기"}</button>}<h3 className="cbt-field-label">회차 선택</h3><div className="cbt-chip-list">{rounds.map((exam) => <button type="button" className={selectedExamId === exam.id ? "is-active" : ""} aria-pressed={selectedExamId === exam.id} onClick={() => setSelectedExamId(exam.id)} key={exam.id}>{exam.round}</button>)}</div></section><aside className="question-selection-panel"><span className="eyebrow">선택한 시험</span>{selectedExam ? <><h2>{cert.name} {selectedExam.year}년 {selectedExam.round}</h2><p>시작 전 문항 수와 채점 방식을 확인합니다.</p><div className="question-selection-actions"><button className="button button-primary" onClick={() => setStartExamId(selectedExam.id)}>시험 시작</button></div></> : <EmptyState title="회차를 선택해 주세요." body="왼쪽에서 연도와 회차를 차례로 선택하면 시작할 수 있습니다." />}</aside></div>}
    {tab === "subjects" && <div className="question-bank-grid"><section className="question-library-card cbt-subject-card"><CardHead no="02" title="단원 선택" desc="풀고 싶은 단원을 1개 이상 선택하세요." /><div className="cbt-select-all"><button onClick={() => setSelectedSubjects(selectedSubjects.length === subjects.length ? [] : subjects.map((subject) => subject.id))}>{selectedSubjects.length === subjects.length ? "전체 해제" : "전체 선택"}</button><span>{selectedSubjects.length.toLocaleString()}개 선택</span></div><div className="cbt-subject-list">{subjects.map((subject) => { const checked = selectedSubjects.includes(subject.id); const total = dataset.questions.filter((question) => question.subjectId === subject.id).length; return <label className={`cbt-subject-row${checked ? " is-selected" : ""}`} key={subject.id}><CustomCheckbox checked={checked} onChange={() => setSelectedSubjects(checked ? selectedSubjects.filter((id) => id !== subject.id) : [...selectedSubjects, subject.id])} /><strong>{subject.name}</strong><small>{total.toLocaleString()}문항</small></label>; })}</div></section><aside className="question-selection-panel"><span className="eyebrow">단원 연습</span><h2>선택한 단원으로 연습</h2><p>여러 단원을 묶어 한 번에 풀 수 있습니다.</p><div className="question-selection-actions"><button className="button button-primary" disabled={!selectedSubjects.length} onClick={() => begin(dataset.questions.filter((question) => selectedSubjects.includes(question.subjectId)).map((question) => question.id), certExams.map((exam) => exam.id), "submit", null)}>시험 시작</button>{!selectedSubjects.length && <small className="cbt-guidance">단원을 1개 이상 선택해 주세요.</small>}</div></aside></div>}
    {tab === "custom" && <div className="question-builder-grid custom-builder"><section className="builder-card"><div className="custom-builder-heading"><div><span className="eyebrow">맞춤 출제</span><h2>맞춤 시험지</h2><p>원하는 범위와 문항 수로 시험지를 구성해 보세요.</p></div><span className="builder-limit-chip">최대 120문항</span></div><fieldset className="cbt-builder-group"><legend>회차 선택</legend><div className="cbt-select-all"><button type="button" onClick={() => setSelectedExamIds(selectedExamIds.length === certExams.length ? [] : certExams.map((exam) => exam.id))}>{selectedExamIds.length === certExams.length ? "전체 해제" : "전체 선택"}</button><button type="button" onClick={() => setSelectedExamIds(certExams.slice(0, 5).map((exam) => exam.id))}>최근 5회만</button><span>{selectedExamIds.length}/{certExams.length}회차 선택</span></div><div className="builder-chip-row builder-round-chips">{certExams.map((exam) => <button type="button" className={selectedExamIds.includes(exam.id) ? "is-active" : ""} aria-pressed={selectedExamIds.includes(exam.id)} onClick={() => setSelectedExamIds(selectedExamIds.includes(exam.id) ? selectedExamIds.filter((id) => id !== exam.id) : [...selectedExamIds, exam.id])} key={exam.id}>{selectedExamIds.includes(exam.id) && "✓ "}{exam.year}년 {exam.round}</button>)}</div><p className="cbt-builder-availability">선택 범위에서 가용 {pool.length.toLocaleString()}문항</p></fieldset><fieldset className="cbt-builder-group"><legend>출제 대상</legend><div className="builder-chip-row">{([['all','전체'],['unanswered','안 푼 문제'],['wrong','틀렸던 문제'],['bookmark','북마크']] as const).map(([value, label]) => <button type="button" className={target === value ? "is-active" : ""} aria-pressed={target === value} onClick={() => setTarget(value)} key={value}>{label}</button>)}</div></fieldset><label className="builder-field-label">문제 순서<select value={order} onChange={(event) => setOrder(event.target.value as typeof order)}><option value="random">섞어서</option><option value="ordered">회차순</option></select></label></section><aside className="builder-summary-card custom-builder-summary"><span className="eyebrow">시험지 구성</span><h2>문항 수와 진행 방식</h2><div className="builder-subject-counts">{subjects.map((subject) => <div className="builder-subject-count" key={subject.id}><div><label htmlFor={`builder-count-${subject.id}`}>{subject.name}</label><small>가용 {pool.filter((question) => question.subjectId === subject.id).length.toLocaleString()}문항</small></div><QuestionCountInput id={`builder-count-${subject.id}`} label={subject.name} value={builderCounts[subject.id] ?? 0} onChange={(value) => setBuilderCounts((counts) => ({ ...counts, [subject.id]: value }))} /></div>)}</div><div className="builder-total"><span>총 문항 수</span><strong>{Object.values(builderCounts).reduce((sum, value) => sum + value, 0)}문항</strong></div>{Object.values(builderCounts).reduce((sum, value) => sum + value, 0) > 120 && <p className="builder-warning" role="alert">120문항을 넘었습니다. 한 문제씩 학습 모드로 풀어 보세요.</p>}<div className="builder-summary-fields"><label>제한시간<select value={timeLimit === null ? "none" : timeLimit} onChange={(event) => setTimeLimit(event.target.value === "none" ? null : Number(event.target.value))}><option value="60">60분</option><option value="30">30분</option><option value="90">90분</option><option value="none">제한 없음</option></select></label><label>채점 방식<select value={gradeMode} onChange={(event) => setGradeMode(event.target.value as GradeMode)}><option value="submit">제출 후 채점</option><option value="instant">즉시 채점</option></select></label></div><div className="builder-action-row"><button className="button button-primary" disabled={!selectedExamIds.length || !pool.length || Object.values(builderCounts).reduce((sum, value) => sum + value, 0) < 1 || Object.values(builderCounts).reduce((sum, value) => sum + value, 0) > 120} onClick={beginBuilder}>시험지 시작</button>{user && <button className="button button-secondary" onClick={() => { const builderTotal = Object.values(builderCounts).reduce((sum, value) => sum + value, 0); const config = { certId: cert.id, certSlug: certSlug(cert), examIds: selectedExamIds, subjectIds: selectedSubjects, count: builderTotal, order, target, gradeMode, timeLimitMinutes: timeLimit }; saveStore({ ...store, presets: [...store.presets, { name: `${cert.name} 맞춤 시험지`, config }] }); setToast("맞춤 시험지를 저장했습니다."); }}>시험지 저장</button>}</div></aside></div>}
    {tab === "mock" && <div className="mock-exam-layout"><section className="mock-exam-card mock-preflight"><span className="eyebrow">실전 연습 · 모의시험 구성</span><h2>{cert.name}</h2><strong className="mock-preflight-total">{mockExam.questionCount}문항 · {mockExam.durationMinutes}분</strong><p>100점 만점 · 합격 기준 {mockExam.passScore}점 이상</p><div className="mock-subject-list">{MOCK_SUBJECTS.map((subject, index) => <div key={subject.name}><span>{subject.name} <small>{index * 20 + 1}–{(index + 1) * 20}</small></span><strong>20문항</strong></div>)}</div><p className="mock-exam-note">과목별 20문항 · 총 60문항</p><div className="mock-candidate"><span>수험자 <b>{displayName}</b></span><span>연습용 번호 {identity?.practiceNumber || "–"}</span></div></section><aside className="mock-exam-start"><span className="eyebrow">시험 준비</span><h2>준비되셨나요?</h2><p>시작하면 제한시간이 흐릅니다. 시험 중 답안은 자동 저장됩니다.</p><p className="mock-rights">{CBT_RIGHTS_NOTICE}</p><details className="mock-rights-details"><summary>자세히</summary><p>문제와 해설을 허락 없이 복제하거나 다른 곳에 배포하지 마세요.</p></details><label className="mock-guide-toggle"><input type="checkbox" checked={showGuide} onChange={(event) => setShowGuide(event.target.checked)} />시험 전 안내 보기</label><button className="button button-primary" disabled={!SERVER_EXAMS || !mockAvailable || starting || !user} onClick={prepareMock}>{showGuide ? "안내 보기 →" : "시험 시작"}</button><small>{!SERVER_EXAMS ? "별도 테스트 DB 연결 후 시작할 수 있습니다." : !user ? "로그인 후 시작할 수 있습니다." : !mockAvailable ? "과목별 가용 문항이 20개 이상이어야 합니다." : "모든 회차에서 과목별 무작위 출제 · 개인 학습용 연습"}</small></aside></div>}
    {tab === "records" && <Records cert={cert} dataset={dataset} store={store} />}
    </div>
    {startExamId && <StartModal exam={startExamId === "__mock__" ? mockExam : certExams.find((exam) => exam.id === startExamId)!} gradeMode={gradeMode} setGradeMode={setGradeMode} onClose={() => setStartExamId("")} busy={starting} onStart={startExamId === "__mock__" ? beginMock : beginExam} />}
    {guideOpen && <Modal title="시험 전 안내" onClose={() => setGuideOpen(false)}><MockExamGuide name={identity?.displayName || displayName} practiceNumber={identity?.practiceNumber} date={identity?.date} certName={cert.name} onStart={() => { setGuideOpen(false); setStartExamId("__mock__"); }} /></Modal>}
    <Toast message={toast} onDone={() => setToast("")} />
  </PageShell>;
}

function QuestionCountInput({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (value: number) => void }) {
  return <div className="number-stepper">
    <button type="button" disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))} aria-label={`${label} 문항 수 줄이기`}>−</button>
    <input id={id} type="number" inputMode="numeric" step="1" min="0" max="120" value={value} onChange={(event) => onChange(Math.min(120, Math.max(0, Number(event.target.value) || 0)))} aria-label={`${label} 문항 수`} />
    <button type="button" disabled={value >= 120} onClick={() => onChange(Math.min(120, value + 1))} aria-label={`${label} 문항 수 늘리기`}>+</button>
  </div>;
}

function StartModal({ exam, gradeMode, setGradeMode, onClose, onStart, busy = false }: { busy?: boolean; exam: Dataset["exams"][number]; gradeMode: GradeMode; setGradeMode: (mode: GradeMode) => void; onClose: () => void; onStart: () => void }) { return <Modal title="지금 시험을 시작할까요?" onClose={onClose}><p>{exam.questionCount.toLocaleString()}문항 · {exam.durationMinutes.toLocaleString()}분</p><p>시작하면 제한시간이 흐릅니다.</p>{exam.id !== "__mock__" && <fieldset className="cbt-mode-options"><legend>채점 방식 선택</legend><label><input type="radio" name="grade-mode" checked={gradeMode === "submit"} onChange={() => setGradeMode("submit")} />한번에 채점</label><label><input type="radio" name="grade-mode" checked={gradeMode === "instant"} onChange={() => setGradeMode("instant")} />즉시 채점</label></fieldset>}<div className="cbt-modal-actions"><button className="button button-ghost" onClick={onClose}>취소</button><button className="button button-primary" disabled={busy} onClick={onStart}>{busy ? "준비 중…" : "시작 확정"}</button></div></Modal>; }

function ExamScreen({ dataset, store, saveStore, certParam, attemptId, user, displayName: accountName }: { dataset: Dataset; store: LocalStore; saveStore: (store: LocalStore) => void; certParam: string; attemptId: string; user: User | null; displayName: string }) {
  const router = useRouter(); const attempt = store.attempts.find((item) => item.id === attemptId); const cert = findCert(dataset, certParam) || dataset.certs.find((item) => item.id === attempt?.config.certId);
  const questions = attempt?.questionIds.map((id) => dataset.questions.find((question) => question.id === id)).filter((item): item is Question => !!item) || [];
  const [selected, setSelected] = useState(0); const [secondsLeft, setSecondsLeft] = useState<number | null>(null); const [modal, setModal] = useState<ModalName>(null); const [toast, setToast] = useState(""); const [submitting, setSubmitting] = useState(false); const [reportQuestion, setReportQuestion] = useState<Question | null>(null); const [reshuffle, setReshuffle] = useState(false); const [layoutMode, setLayoutMode] = useState<"a" | "b">("a"); const [fontSize, setFontSize] = useState<"base" | "large" | "xlarge">("base"); const [choiceLayout, setChoiceLayout] = useState<"one" | "two" | "focus">("one"); const [sheetOpen, setSheetOpen] = useState(false); const [reviewOpen, setReviewOpen] = useState(false); const finishedIds = useRef(new Set<string>()); const sheetOpener = useRef<HTMLElement | null>(null); const warned = useRef(false); const question = questions[selected];
  const [sheetFilter, setSheetFilter] = useState<"all" | "answered" | "unanswered" | "review">("all");
  const [sheetSubject, setSheetSubject] = useState<string | null>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [timeAnnouncement, setTimeAnnouncement] = useState("");
  const announced = useRef(new Set<number>());
  const pendingAnswers = useRef<Promise<void>>(Promise.resolve());
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useEffect(() => { setSelected(0); setSheetSubject(null); setWarningDismissed(false); announced.current.clear(); warned.current = false; }, [attemptId]);
  useEffect(() => { if (secondsLeft === null || !attempt?.endAt || secondsLeft <= 0) return; const threshold = secondsLeft <= 300 ? 5 : secondsLeft <= 600 ? 10 : null; if (threshold && !announced.current.has(threshold)) { announced.current.add(threshold); setTimeAnnouncement(`${threshold}분 남았습니다. 미응답 문항을 점검하세요.`); } }, [secondsLeft, attempt?.endAt]);
  useEffect(() => { if (!sheetOpen) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSheetOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [sheetOpen]);
  useEffect(() => { if (!sheetOpen) { sheetOpener.current?.focus(); sheetOpener.current = null; return; } const sheet = document.querySelector<HTMLElement>(".cbt-answer-sheet.is-open"); sheet?.querySelector<HTMLElement>(".cbt-answer-close")?.focus(); const trap = (event: KeyboardEvent) => { if (event.key !== "Tab" || !sheet) return; const buttons = Array.from(sheet.querySelectorAll<HTMLButtonElement>('button:not(:disabled):not([tabindex="-1"])')); const first = buttons[0]; const last = buttons.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }; window.addEventListener("keydown", trap); return () => window.removeEventListener("keydown", trap); }, [sheetOpen]);
  useEffect(() => { document.body.classList.toggle("cbt-exam-active", attempt?.status === "in_progress"); return () => document.body.classList.remove("cbt-exam-active"); }, [attempt?.status]);
  useEffect(() => { try { const saved = localStorage.getItem("cbt-answer-position"); if (saved === "a" || saved === "b") setLayoutMode(saved); } catch { /* Storage can be disabled. */ } }, []);
  function setAnswerPosition(position: "a" | "b") { setLayoutMode(position); setSheetOpen(false); try { localStorage.setItem("cbt-answer-position", position); } catch { /* Keep the in-memory preference. */ } }
  useEffect(() => { if (question) setSheetSubject(question.subjectId); }, [selected, question?.subjectId]);
  useEffect(() => { const container = document.querySelector<HTMLElement>(".cbt-answer-scroll"); const row = container?.querySelector<HTMLElement>(".cbt-answer-row.is-current"); if (container && row) { const rect = row.getBoundingClientRect(), bounds = container.getBoundingClientRect(); if (rect.top < bounds.top + 6 || rect.bottom > bounds.bottom - 6) container.scrollTop += rect.top - bounds.top - 6; } const strip = document.querySelector<HTMLElement>(".cbt-number-strip nav"); const active = strip?.querySelector<HTMLElement>('[aria-current="step"]'); if (strip && active) centerInScroller(active, strip); }, [selected, sheetOpen, layoutMode, sheetSubject, sheetFilter]);
  useEffect(() => { if (!attempt || attempt.status !== "in_progress") return; const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; }; const back = () => { window.history.pushState({ cbtGuard: true }, "", window.location.href); setModal("exit"); }; window.history.pushState({ cbtGuard: true }, "", window.location.href); window.addEventListener("beforeunload", beforeUnload); window.addEventListener("popstate", back); return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("popstate", back); }; }, [attempt?.id, attempt?.status]);
  const finish = useCallback(async () => {
    if (!attempt || attempt.status !== "in_progress" || finishedIds.current.has(attempt.id)) return;
    finishedIds.current.add(attempt.id);
    setSubmitting(true);
    try {
      const session = (await getSupabaseBrowserClient().auth.getSession()).data.session;
      if (user && !session) throw new Error("로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.");
      await pendingAnswers.current;
      const latestAttempt = readLocalStore().attempts.find((item) => item.id === attempt.id) || attempt;
      const score = scoreAttempt(latestAttempt, questions);
      let result: { answers: Record<string, number>; submittedAt: string; score: number; alreadySubmitted: boolean };
      if (session) {
        const response = await fetch(`/api/cbt/attempts/${encodeURIComponent(attempt.id)}/submit/`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ ...latestAttempt, score }),
        });
        if (!response.ok) throw new Error("결과를 저장하지 못했습니다. 다시 시도해 주세요.");
        result = await response.json();
      } else {
        const saved = readLocalStore().attempts.find((item) => item.id === attempt.id);
        result = saved?.status === "submitted"
          ? { answers: saved.answers, submittedAt: saved.submittedAt || new Date().toISOString(), score: saved.score ?? score, alreadySubmitted: true }
          : { answers: attempt.answers, submittedAt: new Date().toISOString(), score, alreadySubmitted: false };
      }
      const latest = readLocalStore();
      const wrongNotes = { ...latest.wrongNotes };
      if (!result.alreadySubmitted && !latest.attempts.some((item) => item.id === attempt.id && item.status === "submitted")) {
        questions.forEach((item) => { const correct = result.answers[item.id] === item.answer; const old = wrongNotes[item.id]; if (!correct) wrongNotes[item.id] = { wrongCount: (old?.wrongCount || 0) + 1, lastWrongAt: result.submittedAt, memo: old?.memo || "", mastered: false }; else if (old) wrongNotes[item.id] = { ...old, mastered: true }; });
      }
      const submitted: LocalAttempt = { ...attempt, answers: result.answers, status: "submitted", submittedAt: result.submittedAt, score: result.score };
      saveStore({ ...latest, wrongNotes, attempts: latest.attempts.map((item) => item.id === attempt.id ? submitted : item) });
      setModal(null);
    } catch (error) {
      finishedIds.current.delete(attempt.id);
      setToast(error instanceof Error ? error.message : "결과를 저장하지 못했습니다.");
    } finally { setSubmitting(false); }
  }, [attempt, questions, saveStore, user]);
  useEffect(() => { if (!attempt?.endAt || attempt.status !== "in_progress") return; const tick = () => { const left = timeLeftSeconds(attempt.endAt); setSecondsLeft(left); if (left === 0) setModal("expired"); else if (left !== null && left <= 60 && !warned.current) { warned.current = true; setToast("종료까지 1분 미만 남았습니다."); } return left; }; if (tick() === 0) return; const timer = window.setInterval(() => { if (tick() === 0) window.clearInterval(timer); }, 1000); return () => window.clearInterval(timer); }, [attempt?.endAt, attempt?.status]);
  function updateAttempt(next: LocalAttempt) { saveStore({ ...store, attempts: store.attempts.map((item) => item.id === next.id ? next : item) }); }
  function persistManaged(questionId: string, choice: number | null, review: boolean | null) {
    setSavingAnswer(true);
    const work = pendingAnswers.current.catch(() => undefined).then(async () => {
      const row = await cbtPost<Parameters<typeof serverAttempt>[0]>(`/api/cbt/attempts/${encodeURIComponent(attemptId)}/answer/`, { questionId, choice, review });
      const next = serverAttempt(row), latest = readLocalStore();
      saveStore({ ...latest, attempts: latest.attempts.map((item) => item.id === next.id ? next : item) });
      setToast("답안을 저장했습니다.");
    }).finally(() => setSavingAnswer(false));
    pendingAnswers.current = work;
    void work.catch((error) => setToast(error instanceof Error ? error.message : "답안을 저장하지 못했습니다."));
  }
  const answerQuestion = useCallback((questionId: string, index: number) => {
    const latest = readLocalStore(), current = latest.attempts.find((item) => item.id === attemptId);
    if (!current || current.status !== "in_progress" || timeLeftSeconds(current.endAt) === 0 || current.lockedIds.includes(questionId) || !current.questionIds.includes(questionId)) return;
    const answers = current.config.gradeMode === "instant" ? { ...current.answers, [questionId]: index } : toggleAnswerSelection(current.answers, questionId, index);
    if (current.serverManaged) { persistManaged(questionId, answers[questionId] ?? null, null); return; }
    saveStore({ ...latest, attempts: latest.attempts.map((item) => item.id === current.id ? { ...current, answers, lockedIds: current.config.gradeMode === "instant" ? [...current.lockedIds, questionId] : current.lockedIds } : item) });
    setToast(answers[questionId] === undefined ? "선택을 해제했습니다." : "답안을 저장했습니다.");
  }, [attemptId, saveStore]);
  const answer = useCallback((index: number) => { if (question) answerQuestion(question.id, index); }, [answerQuestion, question]);
  const toggleReview = useCallback(() => {
    const latest = readLocalStore(), current = latest.attempts.find((item) => item.id === attemptId);
    if (!question || !current || current.status !== "in_progress" || timeLeftSeconds(current.endAt) === 0) return;
    const active = (current.reviewIds || []).includes(question.id);
    if (current.serverManaged) { persistManaged(question.id, null, !active); return; }
    const reviewIds = active ? (current.reviewIds || []).filter((id) => id !== question.id) : [...(current.reviewIds || []), question.id];
    saveStore({ ...latest, attempts: latest.attempts.map((item) => item.id === current.id ? { ...current, reviewIds } : item) });
    setToast(active ? "나중에 보기 표시를 해제했습니다." : "나중에 볼 문제로 표시했습니다.");
  }, [question, attemptId, saveStore]);
  function saveBookmark() { if (!question) return; const latest = readLocalStore(); saveStore({ ...latest, bookmarks: [...new Set([...latest.bookmarks, question.id])] }); setModal(null); setToast("북마크에 저장했습니다."); }
  function leave() { if (!attempt || !cert) return; router.replace(`/cbt/${encodeURIComponent(certSlug(cert))}/`); }
  async function retry(ids: string[]) { if (!attempt || !cert) return; if (attempt.serverManaged) { try { const row = await cbtPost<Parameters<typeof serverAttempt>[0]>("/api/cbt/attempts/start/", { certId: cert.id, mode: "custom", questionIds: reshuffle ? shuffle(ids) : ids, minutes: attempt.config.timeLimitMinutes, gradeMode: attempt.config.gradeMode }); const next = serverAttempt(row), latest = readLocalStore(); saveStore({ ...latest, attempts: [next, ...latest.attempts] }); router.replace(`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${next.id}/`); } catch (error) { setToast(error instanceof Error ? error.message : "다시 풀기를 시작하지 못했습니다."); } return; } const id = makeId("attempt"); const now = new Date(); const next: LocalAttempt = { ...attempt, id, config: { ...attempt.config, mode: "custom" }, reviewIds: [], practiceNumber: undefined, displayNameSnapshot: accountName, questionIds: reshuffle ? shuffle(ids) : ids, answers: {}, lockedIds: [], startedAt: now.toISOString(), endAt: attempt.config.timeLimitMinutes ? new Date(now.getTime() + attempt.config.timeLimitMinutes * 60000).toISOString() : null, submittedAt: undefined, score: undefined, status: "in_progress" }; saveStore({ ...store, attempts: [next, ...store.attempts] }); router.replace(`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${id}/`); }
  useEffect(() => { if (!attempt || attempt.status !== "in_progress") return; const keyboard = (event: KeyboardEvent) => { if (event.defaultPrevented || modal || shortcutsOpen || sheetOpen || reviewOpen || (event.target as HTMLElement)?.closest('input,textarea,select,[role="radiogroup"],[role="dialog"],dialog')) return; if (/^[1-4]$/.test(event.key)) answer(Number(event.key) - 1); else if (event.key === "ArrowLeft") setSelected((value) => Math.max(0, value - 1)); else if (event.key === "ArrowRight") setSelected((value) => Math.min(questions.length - 1, value + 1)); else if (event.key.toLowerCase() === "b") toggleReview(); }; window.addEventListener("keydown", keyboard); return () => window.removeEventListener("keydown", keyboard); }, [answer, attempt, questions.length, toggleReview, modal, shortcutsOpen, sheetOpen, reviewOpen]);
  if (!attempt || !cert || !questions.length) return <PageShell><EmptyState title="응시 기록을 찾을 수 없습니다." body="저장되지 않았거나 삭제된 시험입니다." href="/cbt/" action="종목 선택으로" /></PageShell>;
  if (attempt.status === "submitted") return <ResultScreen displayName={attempt.displayNameSnapshot || accountName} dataset={dataset} cert={cert} attempt={attempt} questions={questions} reshuffle={reshuffle} setReshuffle={setReshuffle} onRetry={retry} onReport={setReportQuestion} reportQuestion={reportQuestion} onReportClose={() => setReportQuestion(null)} store={store} saveStore={saveStore} toast={toast} setToast={setToast} />;
  const answered = Object.keys(attempt.answers).length;
  const selectedAnswer = question ? attempt.answers[question.id] : undefined;
  const expired = secondsLeft === 0 && !!attempt.endAt;
  const locked = question ? attempt.lockedIds.includes(question.id) : false;
  const interimQuestions = questions.filter((item) => attempt.answers[item.id] !== undefined);
  const interimCorrect = interimQuestions.filter((item) => attempt.answers[item.id] === item.answer).length;
  const reviewIds = attempt.reviewIds || [];
  const bookmarked = questions.filter((item) => reviewIds.includes(item.id)).length;
  const displayName = attempt.displayNameSnapshot || accountName;
  const pageStart = Math.floor(selected / 60) * 60;
  const paletteItems = questions.slice(pageStart, pageStart + 60).map((item, offset) => ({ item, index: pageStart + offset }));
  const paletteSections = paletteItems.reduce((sections, entry) => {
    const name = subjectName(dataset.subjects.find((subject) => subject.id === entry.item.subjectId)?.name || "과목 미분류");
    const section = sections.find((item) => item.name === name);
    if (section) section.entries.push(entry); else sections.push({ name, entries: [entry] });
    return sections;
  }, [] as { name: string; entries: typeof paletteItems }[]);
  const subjectProgress = dataset.subjects.filter((subject) => questions.some((item) => item.subjectId === subject.id)).map((subject) => {
    const scoped = questions.filter((item) => item.subjectId === subject.id);
    return { name: subjectName(subject.name), total: scoped.length, done: scoped.filter((item) => attempt.answers[item.id] !== undefined).length };
  });
  const unansweredNumbers = questions.map((item, index) => attempt.answers[item.id] === undefined ? index : -1).filter((index) => index >= 0);
  const bookmarkedNumbers = questions.map((item, index) => reviewIds.includes(item.id) ? index : -1).filter((index) => index >= 0);
  const goToQuestion = (index: number) => { setSelected(index); setSheetOpen(false); setReviewOpen(false); };
  const filteredSections = paletteSections.filter((section) => sheetSubject === "all" || !sheetSubject || section.entries.some(({ item }) => item.subjectId === sheetSubject)).map((section) => ({ ...section, shown: section.entries.filter(({ item }) => sheetFilter === "all" || sheetFilter === "answered" && attempt.answers[item.id] !== undefined || sheetFilter === "unanswered" && attempt.answers[item.id] === undefined || sheetFilter === "review" && reviewIds.includes(item.id)) }));
  function filterAnswers(filter: typeof sheetFilter) { setSheetFilter(filter); setSheetSubject("all"); if (layoutMode === "b" || window.matchMedia("(max-width: 900px)").matches) { sheetOpener.current = document.activeElement as HTMLElement; setSheetOpen(true); } }
  const answerSheet = <aside className={`cbt-answer-sheet${sheetOpen ? " is-open" : ""}`} aria-label="답안지" role={sheetOpen ? "dialog" : undefined} aria-modal={sheetOpen || undefined}>
    <div className="cbt-answer-head"><div><h2>답안지</h2><p>응답 {answered}/{questions.length} · {sheetFilter === "unanswered" ? "미응답만 보기" : sheetFilter === "review" ? "나중에 보기" : sheetFilter === "answered" ? "응답만 보기" : "전체 답안"}</p></div><button type="button" className="cbt-answer-close" onClick={() => setSheetOpen(false)} aria-label="답안지 닫기">×</button></div>
    {questions.length > 60 && <div className="cbt-answer-pages"><button type="button" disabled={pageStart === 0} onClick={() => goToQuestion(Math.max(0, pageStart - 60))}>이전 60문항</button><span>{pageStart + 1}–{Math.min(pageStart + 60, questions.length)} / {questions.length.toLocaleString()}</span><button type="button" disabled={pageStart + 60 >= questions.length} onClick={() => goToQuestion(pageStart + 60)}>다음 60문항</button></div>}
    <div className="cbt-answer-subject-tabs" aria-label="답안지 과목"><button type="button" aria-pressed={sheetSubject === "all"} onClick={() => setSheetSubject("all")}>전체</button>{paletteSections.map((section) => { const id = section.entries[0].item.subjectId; const short = MOCK_SUBJECTS.find((rule) => rule.name === section.name)?.short || section.name; return <button type="button" aria-pressed={sheetSubject === id} onClick={() => setSheetSubject(id)} key={id}>{short} {attempt.config.mode === "mock" ? `${section.entries[0].index + 1}–${section.entries.at(-1)!.index + 1}` : ""}</button>; })}</div><div className="cbt-answer-filter"><button type="button" aria-pressed={sheetFilter === "unanswered"} onClick={() => setSheetFilter(sheetFilter === "unanswered" ? "all" : "unanswered")}>미응답만 보기</button><button type="button" onClick={() => setSheetFilter("all")}>필터 해제</button></div>
    <div className={`cbt-answer-scroll${layoutMode === "b" ? " is-number-only" : ""}`}>{filteredSections.map((section) => <section className="cbt-answer-section" key={section.name}><h3>{section.name} {attempt.config.mode === "mock" && `${section.entries[0].index + 1}–${section.entries.at(-1)!.index + 1}`} <small>응답 {section.entries.filter(({ item }) => attempt.answers[item.id] !== undefined).length}/{section.entries.length}</small></h3>{!section.shown.length && <p className="cbt-empty-filter">조건에 맞는 문항이 없습니다.</p>}{section.shown.map(({ item, index }) => { const chosen = attempt.answers[item.id]; const current = selected === index; const saved = reviewIds.includes(item.id); const graded = attempt.config.gradeMode === "instant" && attempt.lockedIds.includes(item.id); return <div className={`cbt-answer-row${current ? " is-current" : ""}${chosen !== undefined ? " is-answered" : ""}${graded ? chosen === item.answer ? " is-correct" : " is-wrong" : ""}`} key={item.id}><button type="button" onClick={() => goToQuestion(index)} aria-label={`${index + 1}번 ${chosen === undefined ? "미응답" : `${chosen + 1}번 보기 선택`}${saved ? ", 나중에 보기" : ""} 문제로 이동`} aria-current={current ? "step" : undefined}>{index + 1}{saved ? " ◇" : ""}{layoutMode === "b" && chosen !== undefined ? ` ${"①②③④"[chosen]}` : ""}</button>{layoutMode === "a" && <AnswerChoices number={index + 1} selected={chosen} disabled={expired || graded || savingAnswer} onSelect={(value) => answerQuestion(item.id, value)} />}</div>; })}</section>)}</div>
    <div className="cbt-answer-legend"><span>□ 미응답</span><span>■ 응답 ①–④</span><span>◇ 나중에 보기</span><span>▣ 현재</span>{attempt.config.gradeMode === "instant" && <span>✓/× 정오</span>}</div>
  </aside>;
  return <section className={`exam-page exam-redesign exam-font-${fontSize}`}>
    <CbtPreviewNotice /><header className="exam-topbar cbt-live-topbar"><button className="cbt-exam-logo" onClick={() => setModal("exit")} aria-label="CBT MATE 홈으로"><CbtMateLogo /></button><div className="cbt-exam-identity"><strong>{cert.name} <span className="cbt-exam-type">{attemptLabel(attempt)}</span></strong><small>{displayName} · 연습용 번호 {attempt.practiceNumber || "–"}</small></div><div className={`cbt-live-timer${secondsLeft !== null && secondsLeft <= 300 && attempt.endAt ? " is-urgent" : secondsLeft !== null && secondsLeft <= 600 && attempt.endAt ? " is-warning" : ""}`} aria-label="남은 시간"><span>◷ 남은 시간</span><strong>{attempt.endAt ? secondsLeft === null ? "확인 중" : formatSeconds(secondsLeft) : "무제한"}</strong>{secondsLeft !== null && secondsLeft <= 600 && attempt.endAt && <small>{secondsLeft <= 300 ? "5분 이하" : "10분 이하"}</small>}</div><ExamViewSettings fontSize={fontSize} choiceLayout={choiceLayout} position={layoutMode} onFontSize={setFontSize} onChoiceLayout={setChoiceLayout} onPosition={setAnswerPosition} /><button type="button" className="cbt-exam-menu-button" aria-label="시험 메뉴" aria-haspopup="dialog" onClick={() => setModal("menu")}>⋯</button><button className="button button-primary exam-submit" disabled={savingAnswer || submitting} onClick={() => expired ? setModal("expired") : setReviewOpen(true)}>{expired ? "결과 저장" : "제출"}</button>
    </header>
    {expired && <p className="exam-expired-notice" role="alert">제한 시간이 끝났습니다. 답안은 잠겼으며 결과 저장은 확인 후 진행됩니다.</p>}
    <div className="cbt-sr-only" role="status">{timeAnnouncement}</div>
    {!expired && secondsLeft !== null && secondsLeft <= 600 && !warningDismissed && <div className="cbt-time-warning"><span>{secondsLeft <= 300 ? "5분 남았습니다. 제출 전 답안을 점검하세요." : "10분 남았습니다. 미응답 문항을 점검하세요."}</span><button type="button" aria-label="시간 안내 닫기" onClick={() => setWarningDismissed(true)}>×</button></div>}
    {reviewOpen ? <Modal variant="review" title="제출 전 점검" onClose={() => setReviewOpen(false)}><section className="cbt-submit-review"><div className="cbt-review-heading"><span className="eyebrow">제출 전 마지막 확인</span><h1>답안을 점검해 주세요</h1><p>응답 {answered.toLocaleString()}문항 · 미응답 {unansweredNumbers.length.toLocaleString()}문항 · 나중에 보기 {bookmarkedNumbers.length.toLocaleString()}문항</p></div><div className="cbt-review-grid"><div className="cbt-review-card"><h2>과목별 진행</h2>{subjectProgress.map((item) => <div className="cbt-review-progress" key={item.name}><span>{item.name}</span><i role="progressbar" aria-label={`${item.name} 응답`} aria-valuenow={item.done} aria-valuemin={0} aria-valuemax={item.total}><b style={{ width: `${item.total ? item.done / item.total * 100 : 0}%` }} /></i><strong>{item.done}/{item.total}</strong></div>)}<p className="cbt-review-notice">미응답 {unansweredNumbers.length.toLocaleString()}문항을 확인한 뒤 제출하세요.</p><div className="cbt-review-actions"><button className="button button-ghost" onClick={() => setReviewOpen(false)}>답안 수정</button><button className="button button-primary" onClick={() => setModal("submit")}>최종 제출</button></div></div><div className="cbt-review-card"><h2>다시 볼 문제</h2><div className="cbt-review-range"><button type="button" disabled={pageStart === 0} onClick={() => setSelected(pageStart - 60)}>이전 구간</button><span>{pageStart + 1}–{Math.min(pageStart + 60, questions.length)}</span><button type="button" disabled={pageStart + 60 >= questions.length} onClick={() => setSelected(pageStart + 60)}>다음 구간</button></div><h3>미응답 {unansweredNumbers.length.toLocaleString()}문항</h3><div className="cbt-review-numbers is-unanswered">{unansweredNumbers.filter((index) => index >= pageStart && index < pageStart + 60).map((index) => <button type="button" onClick={() => goToQuestion(index)} key={index}>{index + 1}</button>)}</div><h3>나중에 보기 {bookmarkedNumbers.length.toLocaleString()}문항</h3><div className="cbt-review-numbers">{bookmarkedNumbers.filter((index) => index >= pageStart && index < pageStart + 60).map((index) => <button type="button" onClick={() => goToQuestion(index)} key={index}>{index + 1} ◇</button>)}</div></div></div></section></Modal> : <>
    <div className="cbt-exam-summary"><button type="button" onClick={() => filterAnswers("answered")}>응답 {answered.toLocaleString()}/{questions.length.toLocaleString()}</button><button type="button" onClick={() => filterAnswers("unanswered")}>미응답 {(questions.length - answered).toLocaleString()}</button><button type="button" onClick={() => filterAnswers("review")}>◇ 나중에 보기 {bookmarked.toLocaleString()}</button><i role="progressbar" aria-label="응답 진행률" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={questions.length}><b style={{ width: `${answered / questions.length * 100}%` }} /></i></div>
    <div className={`cbt-live-layout is-${layoutMode}${choiceLayout === "focus" ? " is-focus" : ""}`}><div className="cbt-live-main"><article className={`exam-content cbt-live-question font-${fontSize} layout-${choiceLayout}`}><div className="exam-question-head"><span className="cbt-subject-chip">{dataset.subjects.find((subject) => subject.id === question.subjectId)?.name || "과목 미분류"}</span><div><button className={`exam-bookmark${reviewIds.includes(question.id) ? " is-active" : ""}`} onClick={toggleReview} aria-pressed={reviewIds.includes(question.id)} disabled={expired || savingAnswer}><span>◇</span> 나중에 보기</button><button type="button" className="cbt-question-menu-button" aria-label="문항 메뉴" aria-haspopup="dialog" onClick={() => setModal("question-menu")}>⋯</button></div></div><p className="cbt-question-number">문제 {selected + 1} <span>/ {questions.length.toLocaleString()}</span></p><h1>{question.stem}</h1>{question.images.length > 0 && <div className="question-image-list">{question.images.map((src) => <img src={src} alt="문항 참고 이미지" key={src} />)}</div>}<div className="choice-list">{question.choices.map((choice, index) => { const chosen = selectedAnswer === index; const correct = locked && question.answer === index; const wrong = locked && chosen && !correct; return <button className={`choice-button${chosen ? " is-selected" : ""}${correct ? " is-correct" : ""}${wrong ? " is-wrong" : ""}`} aria-pressed={chosen} disabled={locked || expired || savingAnswer} onClick={() => answer(index)} key={`${choice.label}-${index}`}><b>{choice.label}</b><span>{choice.text}</span>{correct && <em>정답</em>}{wrong && <em>오답</em>}</button>; })}</div>{locked && <div className={`instant-feedback ${selectedAnswer === question.answer ? "is-correct" : "is-wrong"}`}><strong>{selectedAnswer === question.answer ? "✓ 정답입니다." : "✕ 오답입니다."}</strong><p>{question.explanation || "등록된 해설이 없습니다."}</p></div>}<div className="exam-nav"><button className="button button-ghost" disabled={!selected} onClick={() => setSelected(selected - 1)}>← 이전</button><button type="button" className="button button-ghost cbt-shortcut-button" popoverTarget="cbt-shortcut-popup" aria-haspopup="dialog" aria-expanded={shortcutsOpen} aria-controls="cbt-shortcut-popup">ⓘ 단축키 보기</button><button className="button button-primary" disabled={selected === questions.length - 1} onClick={() => setSelected(selected + 1)}>다음 →</button></div></article>
      {layoutMode === "b" && <section className="cbt-number-strip" aria-label="가로 번호 스트립"><div><h2>문항 번호</h2><span>현재 {selected + 1}/{questions.length.toLocaleString()}</span></div><nav>{questions.map((item, index) => { return <button type="button" className={`${attempt.answers[item.id] !== undefined ? "is-answered" : ""}${index === selected ? " is-current" : ""}${reviewIds.includes(item.id) ? " is-bookmarked" : ""}`} onClick={() => setSelected(index)} aria-current={index === selected ? "step" : undefined} key={item.id}>{index + 1}{reviewIds.includes(item.id) ? "◇" : ""}</button>; })}</nav><div className="cbt-number-strip-footer"><span>전체 {questions.length.toLocaleString()} · 남은 {(questions.length - answered).toLocaleString()} · 나중에 보기 {bookmarked.toLocaleString()}</span><button type="button" onClick={(event) => { sheetOpener.current = event.currentTarget; setSheetOpen(true); }}>전체 번호 보기 →</button></div></section>}
      {layoutMode === "a" && <button type="button" className="cbt-mobile-answer-trigger" onClick={(event) => { sheetOpener.current = event.currentTarget; setSheetOpen(true); }}>답안지 열기 · 응답 {answered.toLocaleString()}/{questions.length.toLocaleString()}</button>}
    </div>{answerSheet}</div>

    </>}
    {!reviewOpen && <nav className="cbt-exam-bottom-bar" aria-label="문제 이동"><button type="button" disabled={!selected} onClick={() => setSelected(selected - 1)}>← 이전</button><button type="button" onClick={(event) => { sheetOpener.current = event.currentTarget; setSheetOpen(true); }}>답안지 {answered}/{questions.length}</button><button type="button" disabled={selected === questions.length - 1} onClick={() => setSelected(selected + 1)}>다음 →</button></nav>}
    <div id="cbt-shortcut-popup" popover="auto" className="cbt-shortcut-popup" role="dialog" aria-label="단축키 보기" onToggle={(event) => setShortcutsOpen((event.nativeEvent as ToggleEvent).newState === "open")}><h2>단축키 보기</h2><ul><li>1–4: 보기 선택</li><li>← / →: 이전 / 다음 문항</li><li>B: 나중에 보기 표시</li></ul><button className="button button-ghost" type="button" popoverTarget="cbt-shortcut-popup" popoverTargetAction="hide">닫기</button></div>
    {modal === "question-menu" && <Modal title="문항 메뉴" onClose={() => setModal(null)}><div className="cbt-menu-actions"><button className="button button-secondary" onClick={saveBookmark}>북마크 저장</button><button className="button button-ghost" onClick={() => { setModal(null); setReportQuestion(question); }}>오류 신고</button></div></Modal>}
    {sheetOpen && <button type="button" className="cbt-answer-backdrop" onClick={() => setSheetOpen(false)} aria-label="답안지 닫기" />}
    {modal === "menu" && <Modal title="시험 메뉴" onClose={() => setModal(null)} initialFocus><div className="cbt-menu-actions"><button className="button button-primary" autoFocus onClick={() => setModal(null)}>계속 풀기</button><button className="button button-ghost" onClick={() => setModal("interim")}>중간 채점</button><button className="button button-ghost" onClick={() => setModal("exit")}>목록으로 나가기</button></div></Modal>}
    {modal === "interim" && <Modal title="중간 채점 결과" onClose={() => setModal(null)}><div className="cbt-interim-summary"><strong>{interimQuestions.length ? Math.round(interimCorrect / interimQuestions.length * 100) : 0}%</strong><span>정답률</span><span>푼 문제 {interimQuestions.length.toLocaleString()}개</span><span>안 푼 문제 {(questions.length - interimQuestions.length).toLocaleString()}개</span></div><div className="result-grid">{questions.slice(pageStart, pageStart + 60).map((item, offset) => { const index = pageStart + offset; return <div className={`result-q${attempt.answers[item.id] === undefined ? "" : attempt.answers[item.id] === item.answer ? " is-correct" : " is-wrong"}`} key={item.id}><b>{index + 1}</b><span>{attempt.answers[item.id] === undefined ? "-" : attempt.answers[item.id] === item.answer ? "O" : "X"}</span></div>; })}</div><div className="cbt-modal-actions"><button className="button button-primary" onClick={() => setModal(null)}>계속 풀기</button></div></Modal>}
    {modal === "exit" && <Modal title="시험을 나갈까요?" onClose={() => setModal(null)}><p>나가도 답안은 저장됩니다. 시간은 계속 흐릅니다.</p><div className="cbt-menu-actions"><button className="button button-primary" autoFocus onClick={() => leave()}>저장하고 나가기</button><button className="button button-ghost" onClick={() => setModal(null)}>계속 풀기</button></div></Modal>}
    {modal === "submit" && <Modal title="답안을 제출할까요?" onClose={() => setModal(null)}><p>안 푼 문제 <strong>{(questions.length - answered).toLocaleString()}개</strong>가 있습니다. 제출하면 시험이 종료됩니다.</p><div className="cbt-modal-actions"><button className="button button-ghost" disabled={submitting} onClick={() => setModal(null)}>계속 풀기</button><button className="button button-primary" disabled={submitting} onClick={finish}>{submitting ? "저장 중…" : "제출하고 채점"}</button></div></Modal>}
    {modal === "expired" && <Modal title="제한 시간이 끝났습니다" onClose={() => setModal(null)} initialFocus><p>답안은 더 수정할 수 없습니다. 결과를 저장하고 확인할까요? 안 푼 문제 {(questions.length - answered).toLocaleString()}개도 오답으로 채점됩니다.</p><div className="cbt-modal-actions"><button className="button button-ghost" disabled={submitting} onClick={() => setModal(null)}>나중에 결정</button><button className="button button-primary" disabled={submitting} onClick={finish}>{submitting ? "저장 중…" : "결과 저장하고 보기"}</button></div></Modal>}
    {reportQuestion && <ReportModal question={reportQuestion} attemptId={attempt.id} store={store} saveStore={saveStore} onClose={() => setReportQuestion(null)} onDone={() => { setReportQuestion(null); setToast("오류 신고를 접수했습니다."); }} />}<Toast message={toast} onDone={() => setToast("")} />
  </section>;
}

function ResultScreen({ displayName, dataset, cert, attempt, questions, reshuffle, setReshuffle, onRetry, onReport, reportQuestion, onReportClose, store, saveStore, toast, setToast }: { displayName: string; dataset: Dataset; cert: Cert; attempt: LocalAttempt; questions: Question[]; reshuffle: boolean; setReshuffle: (value: boolean) => void; onRetry: (ids: string[]) => void; onReport: (question: Question) => void; reportQuestion: Question | null; onReportClose: () => void; store: LocalStore; saveStore: (store: LocalStore) => void; toast: string; setToast: (message: string) => void }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  useEffect(() => { document.title = "시험 결과 | CBT MATE"; window.scrollTo({ top: 0 }); }, []);
  const correct = questions.filter((question) => attempt.answers[question.id] === question.answer).length;
  const unanswered = questions.filter((question) => attempt.answers[question.id] === undefined).length;
  const score = attempt.score ?? (questions.length ? Math.round(correct / questions.length * 100) : 0);
  const timedOut = !!attempt.endAt && !!attempt.submittedAt && new Date(attempt.submittedAt).getTime() >= new Date(attempt.endAt).getTime();
  const wrongIds = questions.filter((question) => attempt.answers[question.id] !== question.answer).map((question) => question.id);
  const exam = dataset.exams.find((item) => attempt.config.examIds.includes(item.id));
  const spent = Math.max(0, Math.round((new Date(attempt.submittedAt || Date.now()).getTime() - new Date(attempt.startedAt).getTime()) / 60000));
  const subjectStats = dataset.subjects.filter((subject) => questions.some((question) => question.subjectId === subject.id)).map((subject) => {
    const scoped = questions.filter((question) => question.subjectId === subject.id);
    const right = scoped.filter((question) => attempt.answers[question.id] === question.answer).length;
    return { name: subject.name, rate: Math.round(right / scoped.length * 100) };
  });
  const selected = questions[selectedIndex];
  const resultStart = Math.floor(selectedIndex / 60) * 60;
  const weakest = subjectStats.length ? subjectStats.reduce((lowest, item) => item.rate < lowest.rate ? item : lowest) : null;
  function showWrongExplanation() { setSelectedIndex(questions.findIndex((question) => question.id === wrongIds[0])); document.getElementById("cbt-result-review")?.scrollIntoView({ block: "start" }); }
  return <section className="exam-page exam-redesign"><SiteHeader showOnExam /><div className="result-page"><CbtPreviewNotice />
    <div className="cbt-result-heading"><span className="eyebrow">학습을 돌아보세요</span><h1>시험 결과</h1><p>{cert.name}</p></div>
    {timedOut && <p className="cbt-result-timeout" role="status">시간 종료 · 저장된 답안으로 채점했습니다.</p>}
    <div className={`result-hero${score >= (exam?.passScore || 60) ? " is-pass" : " is-fail"}`}>
      <div className="cbt-result-identity"><span className="eyebrow">개인 학습용 연습</span><h2>{cert.name}</h2><p>{displayName} · 응시 번호 {attempt.practiceNumber || "–"}</p><p>응시일 {displayDate(attempt.startedAt)}</p><span className="cbt-result-badge">{score >= (exam?.passScore || 60) ? "✓ 합격 기준 충족" : "× 합격 기준 미달"}</span></div><div className="cbt-result-score-block">
      <strong className="result-score"><span>{score}</span><small>점</small></strong>
      <h1>{score >= (exam?.passScore || 60) ? "합격 기준을 넘었습니다." : "조금 더 복습해 보세요."}</h1>
      <p>정답 {correct}문항 · 오답 {questions.length - correct - unanswered}문항 · 미응답 {unanswered}문항 · 소요시간 {spent}분</p>
      <p>{timedOut ? "시간 초과 · " : ""}{displayDate(attempt.submittedAt)} · 전체 {questions.length}문항</p>
      </div>
    </div>
    <div className="cbt-result-next-grid"><section className="cbt-subject-stats"><h2>과목별 정답률</h2>{subjectStats.map((item) => <div key={item.name}><span>{item.name}</span><i role="img" aria-label={`정답률 ${item.rate}%`}><b style={{ width: `${item.rate}%`, minWidth: item.rate ? 8 : 0 }} /></i><strong>{item.rate}%</strong></div>)}{weakest && <p className="cbt-weakness">다음 학습 제안: {weakest.name} 문제를 복습해 보세요.</p>}</section><div className="result-action-group" aria-label="결과 다음 단계"><h2>다음 학습</h2><div className="result-actions">
      <button className="button button-primary" disabled={!wrongIds.length} onClick={showWrongExplanation}>틀린 문제 해설</button>
      <Link className="button button-secondary" href="/cbt/wrong-notes/">오답노트 보기</Link>
      <button className="button button-secondary" disabled={!wrongIds.length} onClick={() => onRetry(wrongIds)}>틀린 문제 다시 풀기</button>
    </div>
    <div className="result-more-actions">
      <button className="button button-ghost" onClick={() => onRetry(attempt.questionIds)}>전체 다시 풀기</button>
      <Link className="button button-ghost" href={`/cbt/${encodeURIComponent(certSlug(cert))}/`}>종목으로 돌아가기</Link>
    </div><label className="cbt-reshuffle"><CustomCheckbox checked={reshuffle} onChange={() => setReshuffle(!reshuffle)} />재도전할 때 순서 다시 섞기</label><p className="cbt-result-save-note">틀린 문항은 채점할 때 오답노트에 자동 저장됩니다.</p></div></div>
    <section className="result-review" id="cbt-result-review"><h2>문항별 결과</h2><p>번호를 선택하면 해당 문제와 해설을 볼 수 있습니다.</p><div className="result-legend" aria-label="문항 결과 기호"><span>O 정답</span><span>X 오답</span><span>– 미응답</span></div>
      {questions.length > 60 && <div className="cbt-result-range"><button type="button" disabled={resultStart === 0} onClick={() => setSelectedIndex(resultStart - 60)}>이전 60문항</button><strong>{resultStart + 1}–{Math.min(resultStart + 60, questions.length)} / {questions.length}</strong><button type="button" disabled={resultStart + 60 >= questions.length} onClick={() => setSelectedIndex(resultStart + 60)}>다음 60문항</button></div>}
      <div className="result-number-grid" aria-label="문항별 결과">{questions.slice(resultStart, resultStart + 60).map((question, offset) => {
        const index = resultStart + offset;
        const status = attempt.answers[question.id] === undefined ? "미응답" : attempt.answers[question.id] === question.answer ? "정답" : "오답";
        return <button type="button" className={`result-number is-${status === "정답" ? "correct" : status === "오답" ? "wrong" : "unanswered"}`} aria-label={`${index + 1}번 ${status} 상세 보기`} aria-pressed={selectedIndex === index} onClick={() => setSelectedIndex(index)} key={question.id}><b>{index + 1}</b><span aria-hidden="true">{status === "정답" ? "O" : status === "오답" ? "X" : "–"}</span></button>;
      })}</div>
      {selected && <article className="result-detail"><div className="result-detail-head"><strong>{selectedIndex + 1}번 · {attempt.answers[selected.id] === undefined ? "미응답" : attempt.answers[selected.id] === selected.answer ? "정답" : "오답"}</strong><button className="cbt-report-link" onClick={() => onReport(selected)}>오류 신고</button></div><h3>{selected.stem}</h3>{selected.images.length > 0 && <div className="question-image-list">{selected.images.map((src) => <img src={src} alt="문항 참고 이미지" key={src} />)}</div>}<ol className="result-choice-list">{selected.choices.map((choice, index) => <li className={`${index === selected.answer ? "is-correct" : ""}${index === attempt.answers[selected.id] && index !== selected.answer ? " is-wrong" : ""}`} key={`${choice.label}-${index}`}><span>{choice.label} {choice.text}</span>{index === selected.answer && <b>정답</b>}{index === attempt.answers[selected.id] && index !== selected.answer && <b>내 답</b>}</li>)}</ol><div className="result-explanation"><strong>해설</strong><p>{selected.explanation || "등록된 해설이 없습니다."}</p></div></article>}
    </section><p className="cbt-rights-footer">{CBT_RIGHTS_NOTICE}</p><div className="cbt-result-mobile-actions" aria-label="결과 빠른 동작"><button className="button button-primary" disabled={!wrongIds.length} onClick={showWrongExplanation}>틀린 문제 해설</button><Link className="button button-secondary" href="/cbt/wrong-notes/">오답노트 보기</Link></div>
  </div>{reportQuestion && <ReportModal question={reportQuestion} attemptId={attempt.id} store={store} saveStore={saveStore} onClose={onReportClose} onDone={() => { onReportClose(); setToast("오류 신고를 접수했습니다."); }} />}<Toast message={toast} onDone={() => setToast("")} /></section>;
}

function LearningScreen({ mode, dataset, store, saveStore, user, authReady }: { mode: "wrong-notes" | "bookmarks" | "history"; dataset: Dataset; store: LocalStore; saveStore: (store: LocalStore) => void; user: User | null; authReady: boolean }) {
  const router = useRouter();
  const [certId, setCertId] = useState("all");
  const [subjectId, setSubjectId] = useState("all");
  const [period, setPeriod] = useState("all");
  const [sort, setSort] = useState("recent");
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [expandedNotes, setExpandedNotes] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [explanationQuestion, setExplanationQuestion] = useState<Question | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const title = mode === "wrong-notes" ? "오답노트" : mode === "bookmarks" ? "북마크" : "내 기록";
  if (!authReady) return <CbtSkeleton />;
  if (!user) return <PageShell><div className="question-bank-hero"><div><span className="eyebrow">내 학습</span><h1>{title}</h1><p>로그인하면 학습 기록을 안전하게 이어서 볼 수 있습니다.</p></div></div><EmptyState title="로그인이 필요한 화면입니다." body="로그인 후 오답, 북마크와 응시 기록을 확인하세요." href={`/account/login/?next=${encodeURIComponent(`/cbt/${mode}/`)}`} action="로그인" /></PageShell>;

  const cutoff = period === "all" ? 0 : Date.now() - Number(period) * 86400000;
  const filterQuestion = (question: Question) => (certId === "all" || question.certId === certId) && (subjectId === "all" || question.subjectId === subjectId);
  const wrongQuestions = dataset.questions.filter((question) => store.wrongNotes[question.id] && filterQuestion(question) && (!cutoff || new Date(store.wrongNotes[question.id].lastWrongAt).getTime() >= cutoff)).sort((a, b) => (sort === "frequent" ? store.wrongNotes[b.id].wrongCount - store.wrongNotes[a.id].wrongCount : 0) || new Date(store.wrongNotes[b.id].lastWrongAt).getTime() - new Date(store.wrongNotes[a.id].lastWrongAt).getTime());
  const bookmarkQuestions = dataset.questions.filter((question) => store.bookmarks.includes(question.id) && filterQuestion(question));
  const hasBookmarks = dataset.questions.some((question) => store.bookmarks.includes(question.id));
  const bookmarkBatch = bookmarkQuestions.filter((question) => question.certId === bookmarkQuestions[0]?.certId);
  const attempts = store.attempts.filter((attempt) => attempt.status === "submitted" && (certId === "all" || attempt.config.certId === certId));
  const pageCount = Math.max(1, Math.ceil(wrongQuestions.length / 20));
  const currentPage = Math.min(page, pageCount);
  const visibleWrongQuestions = wrongQuestions.slice((currentPage - 1) * 20, currentPage * 20);
  const batchCertId = visibleWrongQuestions.find((question) => !selectedNotes.length || selectedNotes.includes(question.id))?.certId;
  const retryBatch = visibleWrongQuestions.filter((question) => question.certId === batchCertId && (!selectedNotes.length || selectedNotes.includes(question.id)));
  const batchCert = dataset.certs.find((cert) => cert.id === batchCertId);
  const resetPage = () => { setPage(1); setSelectedNotes([]); };

  function retry(questionIds: string[]) {
    const first = dataset.questions.find((question) => question.id === questionIds[0]);
    const cert = dataset.certs.find((item) => item.id === first?.certId);
    if (!first || !cert) return;
    const scopedIds = questionIds.filter((id) => dataset.questions.some((question) => question.id === id && question.certId === cert.id));
    const id = makeId("attempt");
    const attempt: LocalAttempt = {
      id,
      config: { certId: cert.id, certSlug: certSlug(cert), examIds: Array.from(new Set(scopedIds.map((qid) => dataset.questions.find((question) => question.id === qid)?.examId).filter(Boolean) as string[])), subjectIds: [], count: scopedIds.length, order: "ordered", target: mode === "bookmarks" ? "bookmark" : "wrong", gradeMode: "submit", timeLimitMinutes: null },
      questionIds: scopedIds, answers: {}, lockedIds: [], startedAt: new Date().toISOString(), endAt: null, status: "in_progress",
    };
    saveStore({ ...store, attempts: [attempt, ...store.attempts] });
    router.push(`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${id}/`);
  }

  return <PageShell>
    <div className="question-bank-hero"><div><span className="eyebrow">내 학습</span><h1>{title}</h1><p>{mode === "history" ? "응시 흐름과 약점 단원을 한눈에 확인하세요." : mode === "wrong-notes" ? "틀린 문제를 모아 다시 풀고 메모로 복습하세요." : "저장한 문제를 모아 다시 학습하세요."}</p></div></div>
    {(mode !== "bookmarks" || hasBookmarks) && <div className="cbt-learning-filters" aria-label="학습 필터">
      <select aria-label="종목 필터" value={certId} onChange={(event) => { setCertId(event.target.value); setSubjectId("all"); resetPage(); }}><option value="all">전체 종목</option>{dataset.certs.map((cert) => <option value={cert.id} key={cert.id}>{cert.name}</option>)}</select>
      {mode !== "history" && <select aria-label="단원 필터" value={subjectId} onChange={(event) => { setSubjectId(event.target.value); resetPage(); }}><option value="all">전체 단원</option>{dataset.subjects.filter((subject) => certId === "all" || subject.certId === certId).map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select>}
      {mode === "wrong-notes" && <select aria-label="기간 필터" value={period} onChange={(event) => { setPeriod(event.target.value); resetPage(); }}><option value="all">전체 기간</option><option value="7">최근 7일</option><option value="30">최근 30일</option><option value="90">최근 90일</option></select>}
      {mode === "wrong-notes" && <select aria-label="오답 정렬" value={sort} onChange={(event) => { setSort(event.target.value); resetPage(); }}><option value="recent">최근 틀린 순</option><option value="frequent">많이 틀린 순</option></select>}
    </div>}
    {mode === "wrong-notes" && (wrongQuestions.length ? <section className="records-card">
      <div className="cbt-section-head"><h2><small>전체 {wrongQuestions.length.toLocaleString()}문항</small></h2><button className="button button-primary" disabled={!retryBatch.length} onClick={() => retry(retryBatch.map((question) => question.id))}>{selectedNotes.length ? "선택한" : "이 목록"} {retryBatch.length}문항 풀기</button></div>
      <p className="cbt-list-range" aria-live="polite">{wrongQuestions.length.toLocaleString()}문항 중 {(currentPage - 1) * 20 + 1}~{Math.min(currentPage * 20, wrongQuestions.length)}번 표시 · 현재 페이지 문항을 다시 풉니다{batchCert ? ` (${batchCert.name})` : ""}</p>
      {visibleWrongQuestions.map((question) => { const note = store.wrongNotes[question.id]; const expanded = expandedNotes.includes(question.id); return <article className="cbt-learning-row cbt-wrong-row" key={question.id}>
        <label className="cbt-note-select"><input type="checkbox" aria-label={`${question.no}번 문제 선택`} checked={selectedNotes.includes(question.id)} onChange={(event) => setSelectedNotes(event.target.checked ? [...selectedNotes, question.id] : selectedNotes.filter((id) => id !== question.id))} /></label>
        <div className="cbt-note-content"><div className="cbt-note-meta"><small>{dataset.certs.find((cert) => cert.id === question.certId)?.name} · {dataset.subjects.find((subject) => subject.id === question.subjectId)?.name}</small><span className={`cbt-wrong-count${note.wrongCount >= 2 ? " is-repeated" : ""}`}>{note.wrongCount.toLocaleString()}회 틀림</span></div><strong className={expanded ? "" : "cbt-note-clamp"}>{question.no}. {question.stem}</strong><div className="cbt-note-foot"><span>최근 {displayDate(note.lastWrongAt)} {note.mastered ? "· 복습 완료" : ""}</span><button type="button" aria-expanded={expanded} onClick={() => setExpandedNotes(expanded ? expandedNotes.filter((id) => id !== question.id) : [...expandedNotes, question.id])}>{expanded ? "접기" : "펼치기"}</button></div></div>
        <div className="cbt-row-controls"><div className="cbt-row-actions"><button type="button" className="cbt-note-retry" onClick={() => retry([question.id])}>다시 풀기</button><button type="button" className="cbt-note-explanation" onClick={() => setExplanationQuestion(question)}>해설</button><details className="cbt-note-menu"><summary aria-label={`${question.no}번 문제 더 보기`}>⋯</summary><div><button type="button" aria-expanded={editingMemoId === question.id} onClick={(event) => { setEditingMemoId(editingMemoId === question.id ? null : question.id); event.currentTarget.closest("details")?.removeAttribute("open"); }}>{note.memo ? "메모 수정" : "메모"}</button><button type="button" onClick={(event) => { setDeletingQuestionId(question.id); event.currentTarget.closest("details")?.removeAttribute("open"); }}>삭제</button></div></details></div>{editingMemoId === question.id && <textarea aria-label={`${question.no}번 오답 메모`} rows={3} placeholder="오답 원인을 적어 보세요." value={note.memo} onChange={(event) => saveStore({ ...store, wrongNotes: { ...store.wrongNotes, [question.id]: { ...note, memo: event.target.value } } })} />}</div>
      </article>; })}
      {pageCount > 1 && <nav className="cbt-pagination" aria-label="오답노트 페이지"><button className="button button-ghost" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); setSelectedNotes([]); }}>이전</button><span aria-live="polite">{currentPage} / {pageCount}</span><button className="button button-ghost" disabled={currentPage === pageCount} onClick={() => { setPage(currentPage + 1); setSelectedNotes([]); }}>다음</button></nav>}
    </section> : <EmptyState title="조건에 맞는 오답이 없습니다." body="문제를 풀고 틀린 문항이 생기면 여기에 자동으로 모입니다." href="/cbt/" action="문제 풀기" />)}
    {mode === "bookmarks" && (bookmarkQuestions.length ? <section className="records-card"><div className="cbt-section-head"><h2>저장한 문제</h2><button className="button button-primary" onClick={() => retry(bookmarkBatch.map((question) => question.id))}>{dataset.certs.find((cert) => cert.id === bookmarkQuestions[0].certId)?.name} {bookmarkBatch.length}문항 다시 풀기</button></div>{bookmarkQuestions.map((question) => <article className="cbt-learning-row" key={question.id}><div><small>{dataset.certs.find((cert) => cert.id === question.certId)?.name}</small><strong>{question.no}. {question.stem}</strong></div><button className="button button-ghost" onClick={() => saveStore({ ...store, bookmarks: store.bookmarks.filter((id) => id !== question.id) })}>북마크 해제</button></article>)}</section> : hasBookmarks ? <EmptyState title="조건에 맞는 북마크가 없습니다." body="필터를 바꿔 다른 문제를 확인해 보세요." action="필터 초기화" onAction={() => { setCertId("all"); setSubjectId("all"); }} /> : <EmptyState title="저장한 북마크가 없습니다." body="시험 화면에서 다시 보고 싶은 문제를 저장해 보세요." href="/cbt/" action="문제 풀기" />)}
    {mode === "history" && (attempts.length ? <div className="records-grid"><section className="records-card"><h2>응시 이력</h2>{attempts.map((attempt) => { const firstQuestion = dataset.questions.find((question) => attempt.questionIds.includes(question.id)); const cert = dataset.certs.find((item) => item.id === attempt.config.certId || item.id === firstQuestion?.certId || certSlug(item) === attempt.config.certSlug); const exam = dataset.exams.find((item) => attempt.config.examIds.length === 1 && attempt.config.examIds[0] === item.id); return <div className="record-row" key={attempt.id}><span>{cert?.name || "이전 시험 기록"}<small>{attemptLabel(attempt)} · {attempt.questionIds.length}문항{exam ? ` · ${exam.year}년 ${exam.round}` : ""} · {displayDate(attempt.submittedAt)}</small></span><strong>{attempt.score ?? 0}점</strong>{cert ? <Link className="button button-ghost" href={`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${attempt.id}/`}>결과 다시 보기</Link> : <span className="record-unavailable">결과 확인 불가</span>}</div>; })}</section><section className="records-card"><h2>종목별 단원 정답률</h2>{dataset.subjects.map((subject) => { const answers = attempts.flatMap((attempt) => attempt.questionIds.map((id) => ({ attempt, question: dataset.questions.find((question) => question.id === id) }))).filter((item) => item.question?.subjectId === subject.id); if (!answers.length) return null; const rate = Math.round(answers.filter(({ attempt, question }) => question && attempt.answers[question.id] === question.answer).length / answers.length * 100); const cert = dataset.certs.find((item) => item.id === subject.certId); return <div className="cbt-rate-row" key={subject.id}><span>{cert?.name} · {subject.name}</span><i role="img" aria-label={`정답률 ${rate}%`}><b style={{ width: `${rate}%`, minWidth: rate ? 8 : 0 }} /></i><strong>{rate}%</strong></div>; })}</section></div> : <EmptyState title="응시 기록이 없습니다." body="첫 시험을 완료하면 점수와 정답률이 여기에 표시됩니다." href="/cbt/" action="종목 선택" />)}
    {explanationQuestion && <Modal title={`${explanationQuestion.no}번 해설`} onClose={() => setExplanationQuestion(null)}><p>{explanationQuestion.explanation || "등록된 해설이 없습니다."}</p><div className="cbt-modal-actions"><button className="button button-primary" onClick={() => setExplanationQuestion(null)}>닫기</button></div></Modal>}
    {deletingQuestionId && <Modal title="오답노트에서 삭제할까요?" onClose={() => setDeletingQuestionId(null)}><p>삭제한 문제는 다시 틀리면 오답노트에 저장됩니다.</p><div className="cbt-modal-actions"><button className="button button-ghost" onClick={() => setDeletingQuestionId(null)}>취소</button><button className="button button-primary" onClick={() => { const next = { ...store.wrongNotes }; delete next[deletingQuestionId]; saveStore({ ...store, wrongNotes: next }); setDeletingQuestionId(null); }}>삭제</button></div></Modal>}
  </PageShell>;
}

function Records({ cert, dataset, store }: { cert: Cert; dataset: Dataset; store: LocalStore }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const attempts = store.attempts.filter((attempt) => attempt.config.certId === cert.id).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const latest = attempts.find((attempt) => attempt.status === "in_progress" && !expiredAttempt(attempt, now));
  return attempts.length ? <section className="records-card"><h2>이 종목 기록</h2>{attempts.map((attempt) => {
    const exam = dataset.exams.find((item) => attempt.config.examIds.length === 1 && attempt.config.examIds[0] === item.id);
    const expired = expiredAttempt(attempt, now), submitted = attempt.status === "submitted";
    const remaining = attempt.endAt ? formatSeconds(Math.max(0, Math.ceil((Date.parse(attempt.endAt) - now) / 1000))) : "제한 없음";
    return <div className="record-row cbt-cert-record" key={attempt.id}><div><div className="cbt-record-meta"><span className="cbt-subject-chip">{attemptLabel(attempt)}</span><span>{attempt.questionIds.length}문항</span>{exam && <span>{exam.year}년 {exam.round}</span>}</div><small>{displayDate(attempt.submittedAt || attempt.startedAt)}{!submitted && !expired ? ` · 남은 ${remaining}` : ""}</small></div><span className={expired ? "cbt-record-status is-expired" : "cbt-record-status"}>{submitted ? `${attempt.score ?? 0}점` : expired ? "시간 만료" : "진행 중"}</span>{(submitted || expired || latest?.id === attempt.id) ? <Link className="button button-secondary" href={`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${attempt.id}/`}>{submitted ? "결과 보기" : expired ? "결과 저장하기" : "이어서 풀기"}</Link> : <span className="record-unavailable">다른 시험 진행 중</span>}</div>;
  })}</section> : <EmptyState title="아직 학습 기록이 없습니다." body="회차별 기출이나 모의시험을 시작해 보세요." />;
}
function CardHead({ no, title, desc }: { no: string; title: string; desc: string }) { return <div className="question-card-head"><span>{no}</span><div><strong>{title}</strong><p>{desc}</p></div></div>; }
function CustomCheckbox({ checked, onChange, disabled = false }: { checked: boolean; onChange: () => void; disabled?: boolean }) { return <span className="cbt-checkbox"><input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} /><span aria-hidden="true">{checked && <svg viewBox="0 0 16 16"><path d="m3 8 3 3 7-7" /></svg>}</span></span>; }
function Modal({ title, children, onClose, initialFocus = false, variant }: { variant?: "review"; title: string; children: React.ReactNode; onClose: () => void; initialFocus?: boolean }) { const ref = useRef<HTMLDialogElement>(null); const titleId = useId(); useEffect(() => { const dialog = ref.current; if (!dialog) return; if (!dialog.open) dialog.showModal(); if (initialFocus) dialog.querySelector<HTMLElement>(".cbt-modal-actions .button, .cbt-menu-actions .button")?.focus(); }, [initialFocus]); return <dialog className={`cbt-modal${variant === "review" ? " cbt-review-modal" : ""}`} aria-labelledby={titleId} ref={ref} onClose={onClose}><div className="cbt-modal-head"><h2 id={titleId}>{title}</h2><button onClick={() => ref.current?.close()} aria-label="닫기">×</button></div>{children}</dialog>; }
function EmptyState({ title, body, href, action, onAction }: { title: string; body: string; href?: string; action?: string; onAction?: () => void }) { return <div className="question-empty cbt-empty"><strong>{title}</strong><p>{body}</p>{href && action ? <Link className="button button-primary" href={href}>{action}</Link> : onAction && action ? <button onClick={onAction}>{action}</button> : null}</div>; }
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);
  useEffect(() => { if (!message) return; const timer = window.setTimeout(() => done.current(), 2700); return () => window.clearTimeout(timer); }, [message]);
  return message ? <div className="cbt-toast" role="status">{message}</div> : null;
}
function ReportModal({ question, attemptId, store, saveStore, onClose, onDone }: { question: Question; attemptId: string; store: LocalStore; saveStore: (store: LocalStore) => void; onClose: () => void; onDone: () => void }) { const [kind, setKind] = useState<IssueReport["kind"]>("wrong_answer"); const [memo, setMemo] = useState(""); function submit() { const report: IssueReport = { id: makeId("report"), questionId: question.id, attemptId, kind, memo, createdAt: new Date().toISOString(), status: "open" }; saveStore({ ...store, issueReports: [report, ...store.issueReports] }); void submitIssueReport(report).catch(() => undefined); onDone(); } return <Modal title="문제 오류 신고" onClose={onClose}><div className="builder-fields"><label>오류 유형<select value={kind} onChange={(event) => setKind(event.target.value as IssueReport["kind"])}><option value="wrong_answer">잘못된 정답</option><option value="broken_image">이미지 깨짐</option><option value="missing_choice">보기 누락</option><option value="other">기타</option></select></label><label>메모<textarea rows={4} value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="확인할 내용을 적어 주세요." /></label></div><div className="cbt-modal-actions"><button className="button button-ghost" onClick={onClose}>취소</button><button className="button button-primary" disabled={CBT_PREVIEW_READ_ONLY} onClick={submit}>신고 접수</button></div></Modal>; }
