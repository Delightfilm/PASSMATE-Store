"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DEMO_DATASET, EMPTY_STORE, loadPublishedDataset, makeId, readLocalStore, writeLocalStore, type AttemptConfig, type Dataset, type GradeMode, type LocalAttempt, type LocalStore, type Question, type QuestionTarget } from "@/lib/question-bank";

type View = "exams" | "subjects" | "builder" | "records" | "exam" | "result";
const cert = DEMO_DATASET.certs[0];
const exam = DEMO_DATASET.exams[0];

function shuffle<T>(items: T[]) { return [...items].sort(() => Math.random() - 0.5); }
function formatSeconds(seconds: number) { const safe = Math.max(0, seconds); return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`; }

export function QuestionBankClient() {
  const [view, setView] = useState<View>("exams");
  const [dataset, setDataset] = useState<Dataset>(DEMO_DATASET);
  const [dataState, setDataState] = useState<"loading" | "live" | "demo">("loading");
  const [store, setStore] = useState<LocalStore>(EMPTY_STORE);
  const [attempt, setAttempt] = useState<LocalAttempt | null>(null);
  const [selected, setSelected] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [showPalette, setShowPalette] = useState(false);
  const [config, setConfig] = useState<AttemptConfig>({ certId: cert.id, examIds: [exam.id], subjectIds: DEMO_DATASET.subjects.map((subject) => subject.id), count: exam.questionCount, order: "ordered", target: "all", gradeMode: "submit", timeLimitMinutes: exam.durationMinutes });

  useEffect(() => { const next = readLocalStore(); setStore(next); const active = next.attempts.find((item) => item.status === "in_progress"); if (active) { setAttempt(active); setView("exam"); } }, []);
  useEffect(() => {
    let active = true;
    loadPublishedDataset().then((live) => {
      if (!active) return;
      if (!live) { setDataState("demo"); return; }
      setDataset(live);
      const nextCert = live.certs[0];
      const nextExams = live.exams.filter((item) => item.certId === nextCert.id);
      const nextSubjects = live.subjects.filter((item) => item.certId === nextCert.id);
      setConfig({ certId: nextCert.id, examIds: nextExams.map((item) => item.id), subjectIds: nextSubjects.map((item) => item.id), count: Math.min(60, live.questions.length), order: "ordered", target: "all", gradeMode: "submit", timeLimitMinutes: nextExams[0]?.durationMinutes ?? 60 });
      setDataState("live");
    }).catch(() => { if (active) setDataState("demo"); });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (!attempt || attempt.status !== "in_progress") return; const tick = () => { const left = attempt.endAt ? Math.ceil((new Date(attempt.endAt).getTime() - Date.now()) / 1000) : 0; setSecondsLeft(left); if (attempt.endAt && left <= 0) finishAttempt(attempt, true); }; tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer); }, [attempt]);
  const questions = useMemo(() => attempt ? attempt.questionIds.map((id) => dataset.questions.find((question) => question.id === id)).filter((question): question is Question => Boolean(question)) : [], [attempt, dataset]);
  const current = questions[selected];
  const answeredCount = attempt ? Object.keys(attempt.answers).length : 0;

  function persist(next: LocalStore) { setStore(next); writeLocalStore(next); }
  function startAttempt(nextConfig = config, questionIds?: string[]) {
    const certSubjects = dataset.subjects.filter((subject) => subject.certId === nextConfig.certId);
    const certExams = dataset.exams.filter((item) => item.certId === nextConfig.certId);
    const subjectIds = nextConfig.subjectIds.length ? nextConfig.subjectIds : certSubjects.map((subject) => subject.id);
    const examIds = nextConfig.examIds.length ? nextConfig.examIds : certExams.map((item) => item.id);
    let pool = dataset.questions.filter((question) => examIds.includes(question.examId) && (!question.subjectId || subjectIds.includes(question.subjectId)));
    const eligible = nextConfig.target === "wrong" ? pool.filter((question) => store.wrongNotes[question.id]) : nextConfig.target === "bookmark" ? pool.filter((question) => store.bookmarks.includes(question.id)) : nextConfig.target === "unanswered" ? pool.filter((question) => !store.attempts.some((item) => item.questionIds.includes(question.id) && item.answers[question.id] !== undefined)) : pool;
    pool = eligible.length ? eligible : pool;
    const ids = questionIds || (nextConfig.order === "random" ? shuffle(pool) : pool).slice(0, Math.min(nextConfig.count, pool.length)).map((question) => question.id);
    const startedAt = new Date(); const endAt = nextConfig.timeLimitMinutes ? new Date(startedAt.getTime() + nextConfig.timeLimitMinutes * 60_000).toISOString() : null;
    const created: LocalAttempt = { id: makeId("attempt"), config: nextConfig, questionIds: ids, answers: {}, lockedIds: [], startedAt: startedAt.toISOString(), endAt, status: "in_progress" };
    const next = { ...store, attempts: [created, ...store.attempts.filter((item) => item.status !== "in_progress")] }; persist(next); setAttempt(created); setSelected(0); setView("exam");
  }
  function updateAttempt(next: LocalAttempt) { const nextStore = { ...store, attempts: store.attempts.map((item) => item.id === next.id ? next : item) }; persist(nextStore); setAttempt(next); }
  function answer(question: Question, choice: number) { if (!attempt || attempt.lockedIds.includes(question.id)) return; const next = { ...attempt, answers: { ...attempt.answers, [question.id]: choice }, lockedIds: attempt.config.gradeMode === "instant" ? [...attempt.lockedIds, question.id] : attempt.lockedIds }; updateAttempt(next); }
  function finishAttempt(target: LocalAttempt, automatic = false) {
    if (target.status === "submitted") return; const correct = target.questionIds.filter((id) => target.answers[id] === dataset.questions.find((question) => question.id === id)?.answer).length; const score = Math.round((correct / Math.max(1, target.questionIds.length)) * 100); const submitted = { ...target, status: "submitted" as const, submittedAt: new Date().toISOString(), score }; const nextWrong = { ...store.wrongNotes }; target.questionIds.forEach((id) => { const question = dataset.questions.find((item) => item.id === id); if (question && target.answers[id] !== question.answer) nextWrong[id] = { wrongCount: (nextWrong[id]?.wrongCount || 0) + 1, lastWrongAt: new Date().toISOString(), memo: nextWrong[id]?.memo || "", mastered: false }; }); persist({ ...store, attempts: store.attempts.map((item) => item.id === target.id ? submitted : item), wrongNotes: nextWrong }); setAttempt(submitted); setView("result"); if (automatic) window.alert("제한 시간이 끝나 자동 제출되었습니다."); }
  function toggleBookmark(id: string) { const bookmarks = store.bookmarks.includes(id) ? store.bookmarks.filter((item) => item !== id) : [...store.bookmarks, id]; persist({ ...store, bookmarks }); }
  function retry(wrongOnly = false) { if (!attempt) return; const ids = wrongOnly ? attempt.questionIds.filter((id) => attempt.answers[id] !== dataset.questions.find((question) => question.id === id)?.answer) : attempt.questionIds; startAttempt({ ...attempt.config, order: "random" }, ids); }
  function startFromLibrary(examId?: string, subjectId?: string) {
    const targetExam = examId ? dataset.exams.find((item) => item.id === examId) : undefined;
    const targetSubject = subjectId ? dataset.subjects.find((item) => item.id === subjectId) : undefined;
    const certId = targetExam?.certId || targetSubject?.certId || config.certId || dataset.certs[0].id;
    const examIds = examId ? [examId] : dataset.exams.filter((item) => item.certId === certId).map((item) => item.id);
    const subjectIds = subjectId ? [subjectId] : dataset.subjects.filter((item) => item.certId === certId).map((item) => item.id);
    const available = dataset.questions.filter((question) => examIds.includes(question.examId) && (!question.subjectId || subjectIds.includes(question.subjectId))).length;
    startAttempt({ ...config, certId, examIds, subjectIds, count: Math.max(1, Math.min(60, available)), timeLimitMinutes: examId ? targetExam?.durationMinutes ?? 60 : config.timeLimitMinutes });
  }

  if (view === "exam" && attempt && current) return <ExamView attempt={attempt} current={current} questions={questions} selected={selected} setSelected={setSelected} secondsLeft={secondsLeft} showPalette={showPalette} setShowPalette={setShowPalette} answeredCount={answeredCount} onAnswer={answer} onBookmark={toggleBookmark} bookmarks={store.bookmarks} onSubmit={() => { const unanswered = attempt.questionIds.length - Object.keys(attempt.answers).length; if (unanswered && !window.confirm(`안 푼 문제 ${unanswered}개가 있습니다. 제출할까요?`)) return; finishAttempt(attempt); }} />;
  if (view === "result" && attempt) return <DatasetResultView attempt={attempt} dataset={dataset} onRetry={() => retry(false)} onWrongRetry={() => retry(true)} onBack={() => setView("records")} />;

  return <section className="question-bank-page"><div className="container">
    <header className="question-bank-hero"><div><span className="eyebrow">CBT MATE</span><h1>실전처럼 풀고,<br />약점을 바로 확인하세요.</h1><p>{dataState === "live" ? "관리자가 공개한 실제 문제은행 데이터로 회차별·단원별 모의테스트를 만들 수 있습니다." : "운영 데이터가 아직 없어 샘플 문제로 모의테스트 흐름을 보여드립니다."}</p></div><span className="question-bank-status">{dataState === "loading" ? "데이터 불러오는 중" : `${dataState === "live" ? "운영" : "샘플"} 데이터 ${dataset.questions.length}문항`}</span></header>
    <nav className="question-bank-tabs" aria-label="문제은행 메뉴">{[["exams", "회차별 기출"], ["subjects", "단원별"], ["builder", "모의고사 만들기"], ["records", "내 기록"]].map(([key, label]) => <button className={view === key ? "is-active" : ""} key={key} onClick={() => setView(key as View)}>{label}</button>)}</nav>
    {view === "builder" ? <DatasetBuilder dataset={dataset} config={config} setConfig={setConfig} onStart={() => startAttempt()} onSave={() => { persist({ ...store, presets: [{ name: `프리셋 ${store.presets.length + 1}`, config }, ...store.presets] }); window.alert("이 브라우저에 프리셋을 저장했습니다."); }} presets={store.presets} /> : view === "records" ? <DatasetRecords dataset={dataset} store={store} onResume={() => { const active = store.attempts.find((item) => item.status === "in_progress"); if (active) { setAttempt(active); setView("exam"); } }} /> : <DatasetLibrary dataset={dataset} view={view} onStart={startFromLibrary} onBuild={() => setView("builder")} />}
  </div></section>;
}

function DatasetLibrary({ dataset, view, onStart, onBuild }: { dataset: Dataset; view: View; onStart: (examId?: string, subjectId?: string) => void; onBuild: () => void }) {
  const certId = dataset.certs[0]?.id;
  const certName = dataset.certs.find((item) => item.id === certId)?.name ?? "문제은행";
  const exams = dataset.exams.filter((item) => item.certId === certId);
  const subjects = dataset.subjects.filter((item) => item.certId === certId);
  const items = view === "subjects" ? subjects : exams;
  return <div className="question-bank-grid">
    <section className="question-setup-card">
      <div className="question-card-head"><span>01</span><div><strong>{view === "subjects" ? "단원별 문제" : "회차별 기출"}</strong><p>{certName} · 공개 문항 {dataset.questions.length}개</p></div></div>
      {items.map((item) => {
        const isSubject = view === "subjects";
        const count = isSubject ? dataset.questions.filter((question) => question.subjectId === item.id).length : dataset.questions.filter((question) => question.examId === item.id).length;
        const targetExam = !isSubject ? item as Dataset["exams"][number] : null;
        return <div className="exam-library-card" key={item.id}><div><b>{targetExam ? String(targetExam.year) + " · " + targetExam.round : "과목·단원"}</b><h2>{targetExam?.title ?? (item as Dataset["subjects"][number]).name}</h2><p>{count}문항{targetExam ? " · " + targetExam.durationMinutes + "분" : ""}</p></div><button className="button button-primary" onClick={() => onStart(targetExam?.id, isSubject ? item.id : undefined)}>시작</button></div>;
      })}
      <div className="question-setup-actions"><button className="button button-ghost" onClick={onBuild}>여러 회차·단원 조합하기</button></div>
    </section>
    <section className="question-preview-card"><span className="eyebrow">READY TO PLAY</span><h2>문제은행 모의테스트</h2><p>공개된 크롤링 문항을 회차와 단원 조건으로 골라 풀 수 있습니다.</p><ul><li>한번에 채점 · 즉시 채점</li><li>북마크 · 오답노트 · 재도전</li><li>제한시간 종료 시 자동 제출</li></ul></section>
  </div>;
}

function DatasetBuilder({ dataset, config, setConfig, onStart, onSave, presets }: { dataset: Dataset; config: AttemptConfig; setConfig: (config: AttemptConfig) => void; onStart: () => void; onSave: () => void; presets: { name: string; config: AttemptConfig }[] }) {
  const set = (patch: Partial<AttemptConfig>) => setConfig({ ...config, ...patch });
  const exams = dataset.exams.filter((item) => item.certId === config.certId);
  const subjects = dataset.subjects.filter((item) => item.certId === config.certId);
  const selectedExamIds = config.examIds.length ? config.examIds : exams.map((item) => item.id);
  const selectedSubjectIds = config.subjectIds.length ? config.subjectIds : subjects.map((item) => item.id);
  const available = dataset.questions.filter((question) => selectedExamIds.includes(question.examId) && (!question.subjectId || selectedSubjectIds.includes(question.subjectId))).length;
  return <section className="builder-card">
    <div className="admin-panel-head"><div><span className="eyebrow">MOCK TEST BUILDER</span><h2>나만의 모의고사</h2><p>여러 회차와 단원을 함께 선택할 수 있습니다.</p></div><span className="admin-state admin-state--on">{available}문항 선택 가능</span></div>
    <div className="builder-fields">
      <label>종목<select value={config.certId} onChange={(event) => { const certId = event.target.value; setConfig({ ...config, certId, examIds: dataset.exams.filter((item) => item.certId === certId).map((item) => item.id), subjectIds: dataset.subjects.filter((item) => item.certId === certId).map((item) => item.id) }); }}>{dataset.certs.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <fieldset><legend>회차</legend>{exams.map((item) => <label className="check-row" key={item.id}><input type="checkbox" checked={config.examIds.includes(item.id)} onChange={(event) => set({ examIds: event.target.checked ? [...config.examIds, item.id] : config.examIds.filter((id) => id !== item.id) })} />{item.year} · {item.round}<small>{dataset.questions.filter((question) => question.examId === item.id).length}문항</small></label>)}</fieldset>
      <fieldset><legend>단원</legend>{subjects.map((item) => <label className="check-row" key={item.id}><input type="checkbox" checked={config.subjectIds.includes(item.id)} onChange={(event) => set({ subjectIds: event.target.checked ? [...config.subjectIds, item.id] : config.subjectIds.filter((id) => id !== item.id) })} />{item.name}<small>{dataset.questions.filter((question) => question.subjectId === item.id).length}문항</small></label>)}</fieldset>
      <label>총 문항 수<input type="number" min={1} max={Math.max(1, available)} value={Math.min(config.count, Math.max(1, available))} onChange={(event) => set({ count: Math.min(Math.max(1, available), Math.max(1, Number(event.target.value))) })} /></label>
      <label>출제 순서<select value={config.order} onChange={(event) => set({ order: event.target.value as "ordered" | "random" })}><option value="ordered">순서대로</option><option value="random">랜덤</option></select></label>
      <label>출제 대상<select value={config.target} onChange={(event) => set({ target: event.target.value as QuestionTarget })}><option value="all">전체 문제</option><option value="unanswered">안 푼 문제</option><option value="wrong">틀렸던 문제</option><option value="bookmark">북마크</option></select></label>
      <label>채점 모드<select value={config.gradeMode} onChange={(event) => set({ gradeMode: event.target.value as GradeMode })}><option value="submit">한번에 채점</option><option value="instant">즉시 채점</option></select></label>
      <label>제한시간<select value={config.timeLimitMinutes ?? "none"} onChange={(event) => set({ timeLimitMinutes: event.target.value === "none" ? null : Number(event.target.value) })}><option value="60">60분</option><option value="40">40분</option><option value="20">20분</option><option value="none">무제한</option></select></label>
    </div>
    <div className="builder-actions"><button className="button button-primary" onClick={onStart} disabled={!available}>모의고사 시작</button><button className="button button-ghost" onClick={onSave}>프리셋 저장</button></div>
    {presets.length > 0 && <p className="admin-help">저장된 프리셋: {presets.map((preset) => preset.name).join(" · ")}</p>}
  </section>;
}

function DatasetRecords({ dataset, store, onResume }: { dataset: Dataset; store: LocalStore; onResume: () => void }) {
  const submitted = store.attempts.filter((item) => item.status === "submitted");
  const active = store.attempts.find((item) => item.status === "in_progress");
  const wrongIds = Object.keys(store.wrongNotes);
  return <div className="records-grid">{active && <section className="resume-card"><strong>진행 중인 응시가 있습니다.</strong><span>{active.questionIds.length}문항 · 답변 {Object.keys(active.answers).length}개</span><button className="button button-primary" onClick={onResume}>이어서 풀기</button></section>}<section className="admin-panel"><div className="admin-panel-head"><div><span className="eyebrow">MY RECORDS</span><h2>내 기록</h2></div><span>{submitted.length}회 응시</span></div>{submitted.length ? submitted.map((item) => <div className="record-row" key={item.id}><span>{new Date(item.submittedAt || item.startedAt).toLocaleDateString("ko-KR")}</span><strong>{item.score ?? 0}점</strong><small>{item.config.gradeMode === "instant" ? "즉시 채점" : "한번에 채점"}</small></div>) : <p className="admin-empty">아직 제출한 기록이 없습니다.</p>}</section><section className="admin-panel"><div className="admin-panel-head"><div><span className="eyebrow">WRONG NOTES · BOOKMARKS</span><h2>오답노트와 북마크</h2></div><span>{wrongIds.length} 오답 · {store.bookmarks.length} 북마크</span></div>{wrongIds.length ? wrongIds.map((id) => <div className="record-row" key={id}><span>문항 {dataset.questions.find((question) => question.id === id)?.no || "-"}</span><strong>{store.wrongNotes[id].wrongCount}회 오답</strong><small>{store.wrongNotes[id].mastered ? "mastered" : "복습 필요"}</small></div>) : <p className="admin-empty">아직 저장된 오답노트가 없습니다.</p>}</section></div>;
}

function Library({ view, onStart, onBuild }: { view: View; onStart: () => void; onBuild: () => void }) { return <div className="question-bank-grid"><section className="question-setup-card"><div className="question-card-head"><span>01</span><div><strong>{view === "subjects" ? "단원별 문제" : "회차별 기출"}</strong><p>현재는 운영 전 샘플 문제로 구성되어 있습니다.</p></div></div><div className="exam-library-card"><div><b>{exam.year} · {exam.round}</b><h2>{exam.title}</h2><p>{cert.name} · {exam.questionCount}문항 · {exam.durationMinutes}분</p></div><span className="admin-state admin-state--on">공개</span></div><div className="question-setup-actions"><button className="button button-primary" onClick={onStart}>바로 시작</button><button className="button button-ghost" onClick={onBuild}>조건 바꾸기</button></div></section><section className="question-preview-card"><span className="eyebrow">READY TO PLAY</span><h2>문제은행 모의테스트</h2><p>답안은 이 브라우저에 자동 저장되고, 새로고침 후에도 진행 중인 응시를 복원합니다.</p><ul><li>한번에 채점 · 즉시 채점</li><li>북마크 · 오답노트 · 재도전</li><li>제한시간 종료 시 자동 제출</li></ul></section></div>; }

function Builder({ config, setConfig, onStart, onSave, presets }: { config: AttemptConfig; setConfig: (config: AttemptConfig) => void; onStart: () => void; onSave: () => void; presets: { name: string; config: AttemptConfig }[] }) { const set = (patch: Partial<AttemptConfig>) => setConfig({ ...config, ...patch }); return <section className="builder-card"><div className="admin-panel-head"><div><span className="eyebrow">MOCK TEST BUILDER</span><h2>나만의 모의고사</h2><p>선택 범위 안에서 문항 수가 자동으로 제한됩니다.</p></div><span className="admin-state admin-state--on">{DEMO_DATASET.questions.length}문항 선택 가능</span></div><div className="builder-fields"><label>회차<select value={config.examIds[0]} onChange={(event) => set({ examIds: [event.target.value] })}><option value={exam.id}>{exam.year} · {exam.round}</option></select></label><fieldset><legend>단원</legend>{DEMO_DATASET.subjects.map((subject) => <label className="check-row" key={subject.id}><input type="checkbox" checked={config.subjectIds.includes(subject.id)} onChange={(event) => set({ subjectIds: event.target.checked ? [...config.subjectIds, subject.id] : config.subjectIds.filter((id) => id !== subject.id) })} />{subject.name}<small>{DEMO_DATASET.questions.filter((question) => question.subjectId === subject.id).length}문항</small></label>)}</fieldset><label>총 문항 수<input type="number" min={1} max={DEMO_DATASET.questions.length} value={config.count} onChange={(event) => set({ count: Math.min(DEMO_DATASET.questions.length, Math.max(1, Number(event.target.value))) })} /></label><label>출제 순서<select value={config.order} onChange={(event) => set({ order: event.target.value as "ordered" | "random" })}><option value="ordered">순서대로</option><option value="random">랜덤</option></select></label><label>출제 대상<select value={config.target} onChange={(event) => set({ target: event.target.value as QuestionTarget })}><option value="all">전체 문제</option><option value="unanswered">안 푼 문제</option><option value="wrong">틀렸던 문제</option><option value="bookmark">북마크</option></select></label><label>채점 모드<select value={config.gradeMode} onChange={(event) => set({ gradeMode: event.target.value as GradeMode })}><option value="submit">한번에 채점</option><option value="instant">즉시 채점</option></select></label><label>제한시간<select value={config.timeLimitMinutes ?? "none"} onChange={(event) => set({ timeLimitMinutes: event.target.value === "none" ? null : Number(event.target.value) })}><option value={exam.durationMinutes}>{exam.durationMinutes}분 (공식 시간)</option><option value="20">20분</option><option value="none">무제한</option></select></label></div><div className="builder-actions"><button className="button button-primary" onClick={onStart}>모의고사 시작</button><button className="button button-ghost" onClick={onSave}>프리셋 저장</button></div>{presets.length > 0 && <p className="admin-help">저장된 프리셋: {presets.map((preset) => preset.name).join(" · ")}</p>}</section>; }

function Records({ store, onResume }: { store: LocalStore; onResume: () => void }) { const submitted = store.attempts.filter((attempt) => attempt.status === "submitted"); const active = store.attempts.find((attempt) => attempt.status === "in_progress"); const wrongIds = Object.keys(store.wrongNotes); return <div className="records-grid">{active && <section className="resume-card"><strong>진행 중인 응시가 있습니다.</strong><span>{active.questionIds.length}문항 · 답변 {Object.keys(active.answers).length}개</span><button className="button button-primary" onClick={onResume}>이어서 풀기</button></section>}<section className="admin-panel"><div className="admin-panel-head"><div><span className="eyebrow">MY RECORDS</span><h2>내 기록</h2></div><span>{submitted.length}회 응시</span></div>{submitted.length ? submitted.map((item) => <div className="record-row" key={item.id}><span>{new Date(item.submittedAt || item.startedAt).toLocaleDateString("ko-KR")}</span><strong>{item.score ?? 0}점</strong><small>{item.config.gradeMode === "instant" ? "즉시 채점" : "한번에 채점"}</small></div>) : <p className="admin-empty">아직 제출한 기록이 없습니다.</p>}</section><section className="admin-panel"><div className="admin-panel-head"><div><span className="eyebrow">WRONG NOTES · BOOKMARKS</span><h2>오답노트와 북마크</h2></div><span>{wrongIds.length} 오답 · {store.bookmarks.length} 북마크</span></div>{wrongIds.length ? wrongIds.map((id) => <div className="record-row" key={id}><span>문항 {DEMO_DATASET.questions.find((question) => question.id === id)?.no || "-"}</span><strong>{store.wrongNotes[id].wrongCount}회 오답</strong><small>{store.wrongNotes[id].mastered ? "mastered" : "복습 필요"}</small></div>) : <p className="admin-empty">아직 저장된 오답노트가 없습니다.</p>}</section></div>; }

function ExamView({ attempt, current, questions, selected, setSelected, secondsLeft, showPalette, setShowPalette, answeredCount, onAnswer, onBookmark, bookmarks, onSubmit }: { attempt: LocalAttempt; current: Question; questions: Question[]; selected: number; setSelected: (value: number) => void; secondsLeft: number; showPalette: boolean; setShowPalette: (value: boolean) => void; answeredCount: number; onAnswer: (question: Question, choice: number) => void; onBookmark: (id: string) => void; bookmarks: string[]; onSubmit: () => void }) { const instant = attempt.config.gradeMode === "instant"; const chosen = attempt.answers[current.id]; const locked = attempt.lockedIds.includes(current.id); return <section className="exam-page"><div className="exam-topbar"><strong>{attempt.endAt ? formatSeconds(secondsLeft) : "무제한"}{secondsLeft > 0 && secondsLeft <= 300 ? <em>5분 이내</em> : null}</strong><span>{answeredCount}/{questions.length}</span><button onClick={() => setShowPalette(!showPalette)} className="button button-ghost">문제 목록</button><button onClick={() => onBookmark(current.id)} className={`exam-bookmark${bookmarks.includes(current.id) ? " is-active" : ""}`}>★</button><button onClick={onSubmit} className="button button-primary">제출</button></div>{(showPalette || true) && <div className={`exam-palette${showPalette ? " is-open" : ""}`}>{questions.map((question, index) => <button key={question.id} className={`${index === selected ? "is-current " : ""}${attempt.answers[question.id] !== undefined ? "is-answered" : ""}`} onClick={() => { setSelected(index); setShowPalette(false); }}>{index + 1}</button>)}</div>}<div className="exam-content"><span className="eyebrow">QUESTION {current.no}</span><h1>{current.stem}</h1>{current.images.length > 0 && <div className="question-image-list">{current.images.map((src, index) => <img src={src} alt={`문항 ${current.no} 참고 이미지 ${index + 1}`} key={src} />)}</div>}<div className="choice-list">{current.choices.map((choice, index) => <button disabled={locked} className={`choice-button ${chosen === index ? "is-selected" : ""}`} key={choice.label} onClick={() => onAnswer(current, index)}><b>{choice.label}</b><span>{choice.text}</span></button>)}</div>{instant && chosen !== undefined && <div className={`instant-feedback ${chosen === current.answer ? "is-correct" : "is-wrong"}`}><strong>{chosen === current.answer ? "정답입니다" : "오답입니다"}</strong><p>{current.explanation || "해설 준비 중입니다."}</p></div>}<div className="exam-nav"><button className="button button-ghost" disabled={selected === 0} onClick={() => setSelected(selected - 1)}>이전</button><button className="button button-primary" disabled={selected === questions.length - 1} onClick={() => setSelected(selected + 1)}>다음</button></div></div></section>; }

function DatasetResultView({ attempt, dataset, onRetry, onWrongRetry, onBack }: { attempt: LocalAttempt; dataset: Dataset; onRetry: () => void; onWrongRetry: () => void; onBack: () => void }) { const correct = attempt.questionIds.filter((id) => attempt.answers[id] === dataset.questions.find((question) => question.id === id)?.answer).length; const passScore = dataset.exams.find((item) => attempt.config.examIds.includes(item.id))?.passScore ?? 60; return <section className="result-page"><div className="result-hero"><span className="eyebrow">RESULT</span><strong>{attempt.score ?? 0}<small>점</small></strong><h1>{(attempt.score ?? 0) >= passScore ? "합격 기준을 넘겼어요." : "다음 응시에서 더 좋아질 수 있어요."}</h1><p>{correct}/{attempt.questionIds.length} 정답 · 합격 기준 {passScore}점</p></div><div className="result-actions"><button className="button button-primary" onClick={onWrongRetry}>틀린 문제만 다시 풀기</button><button className="button button-ghost" onClick={onRetry}>전체 다시 풀기</button><button className="button button-ghost" onClick={onBack}>오답노트 보기</button></div><div className="result-grid">{attempt.questionIds.map((id, index) => { const question = dataset.questions.find((item) => item.id === id); if (!question) return null; const ok = attempt.answers[id] === question.answer; return <div className={ok ? "result-q is-correct" : "result-q is-wrong"} key={id}><b>{index + 1}</b><span>{ok ? "O" : "X"}</span><small>{question.explanation}</small></div>; })}</div></section>; }
