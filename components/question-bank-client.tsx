"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEMO_DATASET,
  EMPTY_STORE,
  loadPublishedDataset,
  makeId,
  readLocalStore,
  writeLocalStore,
  type AttemptConfig,
  type Dataset,
  type GradeMode,
  type LocalAttempt,
  type LocalStore,
  type Question,
  type QuestionTarget,
} from "@/lib/question-bank";

type View = "exams" | "subjects" | "builder" | "records" | "exam" | "result";

const cert = DEMO_DATASET.certs[0];
const exam = DEMO_DATASET.exams[0];
const numberFormatter = new Intl.NumberFormat("ko-KR");

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function formatSeconds(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function isQuestion(question: Question | undefined): question is Question {
  return Boolean(question);
}

export function QuestionBankClient() {
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>("exams");
  const [dataset, setDataset] = useState<Dataset>(DEMO_DATASET);
  const [dataState, setDataState] = useState<"loading" | "live" | "demo">("loading");
  const [store, setStore] = useState<LocalStore>(EMPTY_STORE);
  const [attempt, setAttempt] = useState<LocalAttempt | null>(null);
  const [selected, setSelected] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [showPalette, setShowPalette] = useState(false);
  const [config, setConfig] = useState<AttemptConfig>({
    certId: cert.id,
    examIds: [exam.id],
    subjectIds: DEMO_DATASET.subjects.map((subject) => subject.id),
    count: exam.questionCount,
    order: "ordered",
    target: "all",
    gradeMode: "submit",
    timeLimitMinutes: exam.durationMinutes,
  });

  useEffect(() => {
    const next = readLocalStore();
    const active = next.attempts.find((item) => item.status === "in_progress");
    setStore(next);
    setHydrated(true);
    if (active) {
      setAttempt(active);
      setView("exam");
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadPublishedDataset().then((live) => {
      if (!active) return;
      if (!live?.certs.length || !live.exams.length || !live.questions.length) {
        setDataState("demo");
        return;
      }
      const savedAttempt = readLocalStore().attempts.find((item) => item.status === "in_progress");
      if (savedAttempt && !savedAttempt.questionIds.every((id) => live.questions.some((question) => question.id === id))) {
        setDataState("demo");
        return;
      }
      const nextCert = live.certs[0];
      const nextExams = live.exams.filter((item) => item.certId === nextCert.id);
      const nextSubjects = live.subjects.filter((item) => item.certId === nextCert.id);
      setDataset(live);
      setConfig({
        certId: nextCert.id,
        examIds: nextExams[0] ? [nextExams[0].id] : [],
        subjectIds: nextSubjects.map((item) => item.id),
        count: Math.min(60, live.questions.length),
        order: "ordered",
        target: "all",
        gradeMode: "submit",
        timeLimitMinutes: nextExams[0]?.durationMinutes ?? 60,
      });
      setDataState("live");
    }).catch(() => { if (active) setDataState("demo"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("cbt-exam-active", view === "exam");
    return () => document.body.classList.remove("cbt-exam-active");
  }, [view]);

  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") return;
    const tick = () => {
      const left = attempt.endAt
        ? Math.ceil((new Date(attempt.endAt).getTime() - Date.now()) / 1000)
        : 0;
      setSecondsLeft(left);
      if (attempt.endAt && left <= 0) finishAttempt(attempt, true);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [attempt]);

  const questions = useMemo(
    () => attempt
      ? attempt.questionIds
          .map((id) => dataset.questions.find((question) => question.id === id))
          .filter(isQuestion)
      : [],
    [attempt, dataset]
  );
  const current = questions[selected];
  const answeredCount = attempt ? Object.keys(attempt.answers).length : 0;
  const activeCert = dataset.certs.find((item) => item.id === config.certId) || dataset.certs[0] || cert;
  const activeExam = dataset.exams.find((item) => config.examIds.includes(item.id))
    || dataset.exams.find((item) => item.certId === activeCert.id)
    || exam;

  function persist(next: LocalStore) {
    setStore(next);
    writeLocalStore(next);
  }

  function startFromLibrary(examId?: string, subjectId?: string) {
    const nextExam = dataset.exams.find((item) => item.id === examId) || activeExam;
    const nextSubjectIds = subjectId
      ? [subjectId]
      : dataset.subjects.filter((item) => item.certId === activeCert.id).map((item) => item.id);
    const available = dataset.questions.filter(
      (question) => question.examId === nextExam.id && (!subjectId || question.subjectId === subjectId)
    ).length;
    const nextConfig: AttemptConfig = {
      ...config,
      certId: activeCert.id,
      examIds: [nextExam.id],
      subjectIds: nextSubjectIds,
      count: Math.max(1, Math.min(nextExam.questionCount || available, available)),
      timeLimitMinutes: nextExam.durationMinutes,
    };
    setConfig(nextConfig);
    startAttempt(nextConfig);
  }

  function startAttempt(nextConfig = config, questionIds?: string[]) {
    const certSubjects = dataset.subjects.filter((subject) => subject.certId === nextConfig.certId);
    const certExams = dataset.exams.filter((item) => item.certId === nextConfig.certId);
    const subjectIds = nextConfig.subjectIds.length
      ? nextConfig.subjectIds
      : certSubjects.map((subject) => subject.id);
    const examIds = nextConfig.examIds.length ? nextConfig.examIds : certExams.map((item) => item.id);
    let pool = dataset.questions.filter(
      (question) => examIds.includes(question.examId) && (!question.subjectId || subjectIds.includes(question.subjectId))
    );
    const eligible = nextConfig.target === "wrong"
      ? pool.filter((question) => store.wrongNotes[question.id])
      : nextConfig.target === "bookmark"
        ? pool.filter((question) => store.bookmarks.includes(question.id))
        : nextConfig.target === "unanswered"
          ? pool.filter((question) => !store.attempts.some(
              (item) => item.questionIds.includes(question.id) && item.answers[question.id] !== undefined
            ))
          : pool;
    pool = eligible.length ? eligible : pool;
    const ids = questionIds || (nextConfig.order === "random" ? shuffle(pool) : pool)
      .slice(0, Math.min(nextConfig.count, pool.length))
      .map((question) => question.id);
    if (!ids.length) return;

    const startedAt = new Date();
    const endAt = nextConfig.timeLimitMinutes
      ? new Date(startedAt.getTime() + nextConfig.timeLimitMinutes * 60_000).toISOString()
      : null;
    const created: LocalAttempt = {
      id: makeId("attempt"),
      config: nextConfig,
      questionIds: ids,
      answers: {},
      lockedIds: [],
      startedAt: startedAt.toISOString(),
      endAt,
      status: "in_progress",
    };
    const next = {
      ...store,
      attempts: [created, ...store.attempts.filter((item) => item.status !== "in_progress")],
    };
    persist(next);
    setAttempt(created);
    setSelected(0);
    setView("exam");
  }

  function updateAttempt(next: LocalAttempt) {
    persist({
      ...store,
      attempts: store.attempts.map((item) => item.id === next.id ? next : item),
    });
    setAttempt(next);
  }

  function answer(question: Question, choice: number) {
    if (!attempt || attempt.lockedIds.includes(question.id)) return;
    updateAttempt({
      ...attempt,
      answers: { ...attempt.answers, [question.id]: choice },
      lockedIds: attempt.config.gradeMode === "instant"
        ? [...attempt.lockedIds, question.id]
        : attempt.lockedIds,
    });
  }

  function finishAttempt(target: LocalAttempt, automatic = false) {
    if (target.status === "submitted") return;
    const correct = target.questionIds.filter(
      (id) => target.answers[id] === dataset.questions.find((question) => question.id === id)?.answer
    ).length;
    const submitted: LocalAttempt = {
      ...target,
      status: "submitted",
      submittedAt: new Date().toISOString(),
      score: Math.round((correct / Math.max(1, target.questionIds.length)) * 100),
    };
    const nextWrong = { ...store.wrongNotes };
    target.questionIds.forEach((id) => {
      const question = dataset.questions.find((item) => item.id === id);
      if (question && target.answers[id] !== question.answer) {
        nextWrong[id] = {
          wrongCount: (nextWrong[id]?.wrongCount || 0) + 1,
          lastWrongAt: new Date().toISOString(),
          memo: nextWrong[id]?.memo || "",
          mastered: false,
        };
      }
    });
    persist({
      ...store,
      attempts: store.attempts.map((item) => item.id === target.id ? submitted : item),
      wrongNotes: nextWrong,
    });
    setAttempt(submitted);
    setView("result");
    if (automatic) window.alert("제한 시간이 끝나 자동 제출되었습니다.");
  }

  function toggleBookmark(id: string) {
    const bookmarks = store.bookmarks.includes(id)
      ? store.bookmarks.filter((item) => item !== id)
      : [...store.bookmarks, id];
    persist({ ...store, bookmarks });
  }

  function retry(wrongOnly = false) {
    if (!attempt) return;
    const ids = wrongOnly
      ? attempt.questionIds.filter(
          (id) => attempt.answers[id] !== dataset.questions.find((question) => question.id === id)?.answer
        )
      : attempt.questionIds;
    if (ids.length) startAttempt({ ...attempt.config, order: "random" }, ids);
  }

  if (!hydrated || dataState === "loading") return <QuestionBankSkeleton />;

  if (view === "exam" && attempt && current) {
    return (
      <ExamView
        attempt={attempt}
        current={current}
        questions={questions}
        selected={selected}
        setSelected={setSelected}
        secondsLeft={secondsLeft}
        showPalette={showPalette}
        setShowPalette={setShowPalette}
        answeredCount={answeredCount}
        onAnswer={answer}
        onBookmark={toggleBookmark}
        bookmarks={store.bookmarks}
        onSubmit={() => {
          const unanswered = attempt.questionIds.length - Object.keys(attempt.answers).length;
          if (unanswered && !window.confirm(`안 푼 문제 ${unanswered}개가 있습니다. 제출할까요?`)) return;
          finishAttempt(attempt);
        }}
      />
    );
  }

  if (view === "result" && attempt) {
    return (
      <ResultView
        attempt={attempt}
        dataset={dataset}
        resultExam={dataset.exams.find((item) => attempt.config.examIds.includes(item.id)) || activeExam}
        onRetry={() => retry(false)}
        onWrongRetry={() => retry(true)}
        onBack={() => setView("records")}
      />
    );
  }

  return (
    <section className="question-bank-page">
      <div className="container question-bank-container">
        <header className="question-bank-hero">
          <div>
            <span className="eyebrow">CBT MATE</span>
            <h1>실전처럼 풀고,<br />약점을 바로 확인하세요.</h1>
            <p>회차와 단원을 고르면 나에게 필요한 문제만 모아 바로 시작할 수 있어요.</p>
          </div>
          <span className="question-bank-status">
            {dataState === "live" ? "운영 데이터" : "샘플 데이터"} {numberFormatter.format(dataset.questions.length)}문항
          </span>
        </header>

        <nav className="question-bank-tabs" aria-label="문제은행 메뉴" role="tablist">
          {[
            ["exams", "회차별 기출"],
            ["subjects", "단원별"],
            ["builder", "모의고사 만들기"],
            ["records", "내 기록"],
          ].map(([key, label]) => (
            <button
              aria-selected={view === key}
              className={view === key ? "is-active" : ""}
              key={key}
              onClick={() => setView(key as View)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>

        {view === "builder" ? (
          <Builder
            config={config}
            dataset={dataset}
            activeExam={activeExam}
            setConfig={setConfig}
            onStart={() => startAttempt()}
            onSave={() => {
              persist({
                ...store,
                presets: [{ name: `프리셋 ${store.presets.length + 1}`, config }, ...store.presets],
              });
              window.alert("이 브라우저에 프리셋을 저장했습니다.");
            }}
            presets={store.presets}
          />
        ) : view === "records" ? (
          <Records
            dataset={dataset}
            store={store}
            onBrowse={() => setView("exams")}
            onResume={() => {
              const active = store.attempts.find((item) => item.status === "in_progress");
              if (active) {
                setAttempt(active);
                setView("exam");
              }
            }}
          />
        ) : (
          <Library
            activeCert={activeCert}
            activeExam={activeExam}
            dataset={dataset}
            view={view === "subjects" ? "subjects" : "exams"}
            onStart={startFromLibrary}
            onBuild={() => setView("builder")}
          />
        )}
      </div>
    </section>
  );
}

function QuestionBankSkeleton() {
  return (
    <section className="question-bank-page" aria-label="문제은행을 불러오는 중" aria-busy="true">
      <div className="container question-bank-skeleton">
        <span /><strong /><i />
        <div><span /><span /></div>
      </div>
    </section>
  );
}

function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="question-card-head">
      <span>{number}</span>
      <div><strong>{title}</strong><p>{description}</p></div>
    </div>
  );
}

function Library({
  view,
  dataset,
  activeCert,
  activeExam,
  onStart,
  onBuild,
}: {
  view: "exams" | "subjects";
  dataset: Dataset;
  activeCert: Dataset["certs"][number];
  activeExam: Dataset["exams"][number];
  onStart: (examId?: string, subjectId?: string) => void;
  onBuild: () => void;
}) {
  const isSubjects = view === "subjects";
  const subjects = dataset.subjects.filter((subject) => subject.certId === activeCert.id);
  const exams = dataset.exams.filter((item) => item.certId === activeCert.id);
  return (
    <div className="question-bank-grid">
      <section className="question-library-card">
        <SectionHeading
          number="01"
          title={isSubjects ? "단원별 문제" : "회차별 기출"}
          description={isSubjects ? "복습할 단원을 골라 집중해서 풀어보세요." : "시험 회차를 선택해 실제 순서대로 풀어보세요."}
        />
        <div className="question-list">
          {isSubjects ? subjects.map((subject) => {
            const count = dataset.questions.filter((question) => question.subjectId === subject.id).length;
            return (
              <div className="question-list-row" key={subject.id}>
                <div><span>SUBJECT</span><strong>{subject.name}</strong><small>{numberFormatter.format(count)}문항</small></div>
                <button onClick={() => onStart(undefined, subject.id)} type="button">시작</button>
              </div>
            );
          }) : exams.map((item) => (
            <div className={`question-list-row${item.id === activeExam.id ? " is-selected" : ""}`} key={item.id}>
              <div><span>{item.year} · {item.round}</span><strong>{item.title}</strong><small>{numberFormatter.format(item.questionCount)}문항 · {item.durationMinutes}분</small></div>
              <button onClick={() => onStart(item.id)} type="button">시작</button>
            </div>
          ))}
        </div>
      </section>

      <aside className="question-selection-panel">
        <div className="question-selection-top">
          <span className="eyebrow">READY TO PLAY</span>
          <span className="question-bank-status">공개</span>
        </div>
        <h2>{isSubjects ? "단원 조합 모의고사" : activeExam.title}</h2>
        <p>{isSubjects ? "여러 단원을 원하는 비율로 조합할 수 있어요." : "공식 시험시간에 맞춰 실전 흐름을 연습해보세요."}</p>
        <dl className="question-meta-list">
          <div><dt>종목</dt><dd>{activeCert.name}</dd></div>
          <div><dt>문항</dt><dd>{numberFormatter.format(activeExam.questionCount)}문항</dd></div>
          <div><dt>시간</dt><dd>{activeExam.durationMinutes}분</dd></div>
          <div><dt>합격 기준</dt><dd>{activeExam.passScore}점</dd></div>
        </dl>
        <div className="question-selection-notes">
          <span>답안은 자동 저장됩니다.</span>
          <span>새로고침 후에도 이어서 풀 수 있어요.</span>
          <span>풀이 화면에는 광고가 표시되지 않습니다.</span>
        </div>
        <div className="question-selection-actions">
          <button className="button button-primary" onClick={isSubjects ? onBuild : () => onStart(activeExam.id)} type="button">
            {isSubjects ? "단원 선택하기" : "모의고사 시작"}
          </button>
          <button className="button button-ghost" onClick={onBuild} type="button">여러 회차·단원 조합하기</button>
        </div>
      </aside>
    </div>
  );
}

function Builder({
  config,
  dataset,
  activeExam,
  setConfig,
  onStart,
  onSave,
  presets,
}: {
  config: AttemptConfig;
  dataset: Dataset;
  activeExam: Dataset["exams"][number];
  setConfig: (config: AttemptConfig) => void;
  onStart: () => void;
  onSave: () => void;
  presets: { name: string; config: AttemptConfig }[];
}) {
  const set = (patch: Partial<AttemptConfig>) => setConfig({ ...config, ...patch });
  const exams = dataset.exams.filter((item) => item.certId === config.certId);
  const subjects = dataset.subjects.filter((item) => item.certId === config.certId);
  const selectedQuestions = dataset.questions.filter(
    (question) => config.examIds.includes(question.examId)
      && (config.subjectIds.length === 0 || !question.subjectId || config.subjectIds.includes(question.subjectId))
  ).length;

  return (
    <div className="question-builder-grid">
      <section className="builder-card">
        <SectionHeading number="01" title="출제 범위" description="회차와 단원을 선택해주세요." />
        <div className="builder-fields">
          <label>회차
            <select value={config.examIds[0]} onChange={(event) => {
              const nextExam = exams.find((item) => item.id === event.target.value);
              set({ examIds: [event.target.value], timeLimitMinutes: nextExam?.durationMinutes ?? config.timeLimitMinutes });
            }}>
              {exams.map((item) => <option key={item.id} value={item.id}>{item.year} · {item.round}</option>)}
            </select>
          </label>
          <fieldset>
            <legend>단원</legend>
            {subjects.map((subject) => (
              <label className="check-row" key={subject.id}>
                <input
                  checked={config.subjectIds.includes(subject.id)}
                  onChange={(event) => set({
                    subjectIds: event.target.checked
                      ? [...config.subjectIds, subject.id]
                      : config.subjectIds.filter((id) => id !== subject.id),
                  })}
                  type="checkbox"
                />
                {subject.name}
                <small>{numberFormatter.format(dataset.questions.filter((question) => question.subjectId === subject.id).length)}문항</small>
              </label>
            ))}
          </fieldset>
        </div>
      </section>

      <aside className="builder-summary-card">
        <span className="eyebrow">TEST SETTINGS</span>
        <h2>응시 설정</h2>
        <p>선택 범위 안에서 문항 수가 자동으로 제한됩니다.</p>
        <div className="builder-summary-fields">
          <label>총 문항 수
            <input
              max={Math.max(1, selectedQuestions)}
              min={1}
              onChange={(event) => set({ count: Math.min(selectedQuestions, Math.max(1, Number(event.target.value))) })}
              type="number"
              value={Math.max(1, Math.min(config.count, selectedQuestions))}
            />
          </label>
          <label>출제 순서
            <select value={config.order} onChange={(event) => set({ order: event.target.value as "ordered" | "random" })}>
              <option value="ordered">순서대로</option><option value="random">랜덤</option>
            </select>
          </label>
          <label>출제 대상
            <select value={config.target} onChange={(event) => set({ target: event.target.value as QuestionTarget })}>
              <option value="all">전체 문제</option><option value="unanswered">안 푼 문제</option>
              <option value="wrong">틀렸던 문제</option><option value="bookmark">북마크</option>
            </select>
          </label>
          <label>채점 모드
            <select value={config.gradeMode} onChange={(event) => set({ gradeMode: event.target.value as GradeMode })}>
              <option value="submit">한번에 채점</option><option value="instant">즉시 채점</option>
            </select>
          </label>
          <label>제한시간
            <select
              value={config.timeLimitMinutes ?? "none"}
              onChange={(event) => set({ timeLimitMinutes: event.target.value === "none" ? null : Number(event.target.value) })}
            >
              <option value={activeExam.durationMinutes}>{activeExam.durationMinutes}분 (공식 시간)</option>
              <option value="20">20분</option><option value="none">무제한</option>
            </select>
          </label>
        </div>
        <div className="builder-limit"><span>출제 가능</span><strong>{numberFormatter.format(selectedQuestions)}문항</strong></div>
        <button className="button button-primary" onClick={onStart} type="button">모의고사 시작</button>
        <button className="button button-ghost" onClick={onSave} type="button">프리셋 저장</button>
        {presets.length > 0 && <small className="builder-preset-note">저장된 프리셋 {numberFormatter.format(presets.length)}개</small>}
      </aside>
    </div>
  );
}

function Records({ dataset, store, onResume, onBrowse }: { dataset: Dataset; store: LocalStore; onResume: () => void; onBrowse: () => void }) {
  const submitted = store.attempts.filter((item) => item.status === "submitted");
  const active = store.attempts.find((item) => item.status === "in_progress");
  const wrongIds = Object.keys(store.wrongNotes);
  return (
    <div className="records-grid">
      {active && (
        <section className="resume-card">
          <div><span className="eyebrow">IN PROGRESS</span><strong>진행 중인 응시가 있어요.</strong><small>{Object.keys(active.answers).length}/{active.questionIds.length}문항 풀이</small></div>
          <button className="button button-primary" onClick={onResume} type="button">이어서 풀기</button>
        </section>
      )}
      <section className="records-card">
        <SectionHeading number="01" title="내 기록" description={`${numberFormatter.format(submitted.length)}회 응시했어요.`} />
        {submitted.length ? submitted.map((item) => (
          <div className="record-row" key={item.id}>
            <span>{new Date(item.submittedAt || item.startedAt).toLocaleDateString("ko-KR")}</span>
            <strong>{Math.round(item.score ?? 0)}점</strong>
            <small>{item.config.gradeMode === "instant" ? "즉시 채점" : "한번에 채점"}</small>
          </div>
        )) : <EmptyState text="첫 모의고사를 풀면 정답률 추이가 여기에 쌓여요." action="모의고사 시작하기" onAction={onBrowse} />}
      </section>
      <section className="records-card">
        <SectionHeading number="02" title="오답노트 · 북마크" description={`${numberFormatter.format(wrongIds.length)}개 오답 · ${numberFormatter.format(store.bookmarks.length)}개 북마크`} />
        {wrongIds.length ? wrongIds.map((id) => (
          <div className="record-row" key={id}>
            <span>문항 {dataset.questions.find((question) => question.id === id)?.no || "-"}</span>
            <strong>{numberFormatter.format(store.wrongNotes[id].wrongCount)}회 오답</strong>
            <small>{store.wrongNotes[id].mastered ? "복습 완료" : "복습 필요"}</small>
          </div>
        )) : <EmptyState text="틀린 문제와 북마크한 문제가 여기에 모여요." action="문제 풀러 가기" onAction={onBrowse} />}
      </section>
    </div>
  );
}

function EmptyState({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return <div className="question-empty"><p>{text}</p><button onClick={onAction} type="button">{action}</button></div>;
}

function ExamView({
  attempt,
  current,
  questions,
  selected,
  setSelected,
  secondsLeft,
  showPalette,
  setShowPalette,
  answeredCount,
  onAnswer,
  onBookmark,
  bookmarks,
  onSubmit,
}: {
  attempt: LocalAttempt;
  current: Question;
  questions: Question[];
  selected: number;
  setSelected: (value: number) => void;
  secondsLeft: number;
  showPalette: boolean;
  setShowPalette: (value: boolean) => void;
  answeredCount: number;
  onAnswer: (question: Question, choice: number) => void;
  onBookmark: (id: string) => void;
  bookmarks: string[];
  onSubmit: () => void;
}) {
  const instant = attempt.config.gradeMode === "instant";
  const chosen = attempt.answers[current.id];
  const locked = attempt.lockedIds.includes(current.id);
  const warning = Boolean(attempt.endAt && secondsLeft > 0 && secondsLeft <= 300);
  return (
    <section className="exam-page">
      <header className="exam-topbar">
        <div className={`exam-timer${warning ? " is-warning" : ""}`}>
          <span>남은 시간</span><strong>{attempt.endAt ? formatSeconds(secondsLeft) : "무제한"}</strong>
        </div>
        <div className="exam-progress">
          <span>진행률</span><strong>{answeredCount}/{questions.length}</strong>
          <i><b style={{ width: `${(answeredCount / questions.length) * 100}%` }} /></i>
        </div>
        <button className="button button-ghost exam-palette-toggle" onClick={() => setShowPalette(!showPalette)} type="button">문제 목록</button>
        <button className="button button-primary exam-submit" onClick={onSubmit} type="button">제출</button>
      </header>

      <div className={`exam-palette${showPalette ? " is-open" : ""}`} aria-label="문제 번호">
        <div className="exam-palette-head"><strong>문제 목록</strong><button onClick={() => setShowPalette(false)} type="button">닫기</button></div>
        {questions.map((question, index) => (
          <button
            aria-label={`${index + 1}번${attempt.answers[question.id] !== undefined ? ", 답변 완료" : ""}`}
            className={`${index === selected ? "is-current " : ""}${attempt.answers[question.id] !== undefined ? "is-answered" : ""}`}
            key={question.id}
            onClick={() => { setSelected(index); setShowPalette(false); }}
            type="button"
          >
            {index + 1}
          </button>
        ))}
      </div>

      <article className="exam-content">
        <div className="exam-question-head">
          <span className="eyebrow">QUESTION {current.no}</span>
          <button
            aria-label={bookmarks.includes(current.id) ? "북마크 해제" : "북마크 저장"}
            className={`exam-bookmark${bookmarks.includes(current.id) ? " is-active" : ""}`}
            onClick={() => onBookmark(current.id)}
            type="button"
          >
            <span aria-hidden="true">★</span>{bookmarks.includes(current.id) ? "저장됨" : "북마크"}
          </button>
        </div>
        <h1>{current.stem}</h1>
        {current.images.length > 0 && (
          <div className="question-image-list">
            {current.images.map((src, index) => (
              <img alt={`${current.no}번 문항 참고 이미지 ${index + 1}`} key={src} loading="lazy" src={src} />
            ))}
          </div>
        )}
        <div className="choice-list">
          {current.choices.map((choice, index) => (
            <button
              disabled={locked}
              className={`choice-button${chosen === index ? " is-selected" : ""}`}
              key={choice.label}
              onClick={() => onAnswer(current, index)}
              type="button"
            >
              <b>{choice.label}</b><span>{choice.text}</span>
            </button>
          ))}
        </div>
        {instant && chosen !== undefined && (
          <div className={`instant-feedback ${chosen === current.answer ? "is-correct" : "is-wrong"}`} role="status">
            <strong>{chosen === current.answer ? "✓ 정답입니다" : "✕ 오답입니다"}</strong>
            <p>{current.explanation}</p>
          </div>
        )}
        <div className="exam-nav">
          <button className="button button-ghost" disabled={selected === 0} onClick={() => setSelected(selected - 1)} type="button">이전</button>
          <button className="button button-primary" disabled={selected === questions.length - 1} onClick={() => setSelected(selected + 1)} type="button">다음</button>
        </div>
      </article>
    </section>
  );
}

function ResultView({
  attempt,
  dataset,
  resultExam,
  onRetry,
  onWrongRetry,
  onBack,
}: {
  attempt: LocalAttempt;
  dataset: Dataset;
  resultExam: Dataset["exams"][number];
  onRetry: () => void;
  onWrongRetry: () => void;
  onBack: () => void;
}) {
  const correct = attempt.questionIds.filter(
    (id) => attempt.answers[id] === dataset.questions.find((question) => question.id === id)?.answer
  ).length;
  const passed = (attempt.score ?? 0) >= resultExam.passScore;
  const wrongCount = attempt.questionIds.length - correct;
  return (
    <section className="result-page">
      <div className={`result-hero ${passed ? "is-pass" : "is-fail"}`}>
        <span className="eyebrow">RESULT</span>
        <strong>{Math.round(attempt.score ?? 0)}<small>점</small></strong>
        <h1>{passed ? "✓ 합격 기준을 넘겼어요." : "✕ 조금만 더 복습해볼까요?"}</h1>
        <p>{correct}/{attempt.questionIds.length} 정답 · 합격 기준 {resultExam.passScore}점</p>
      </div>
      <div className="result-actions">
        <button className="button button-primary" disabled={!wrongCount} onClick={onWrongRetry} type="button">틀린 문제만 다시 풀기</button>
        <button className="button button-ghost" onClick={onRetry} type="button">전체 다시 풀기</button>
        <button className="button button-ghost" onClick={onBack} type="button">오답노트 보기</button>
      </div>
      <div className="result-grid">
        {attempt.questionIds.map((id, index) => {
          const question = dataset.questions.find((item) => item.id === id)!;
          const correctAnswer = attempt.answers[id] === question.answer;
          return (
            <div className={correctAnswer ? "result-q is-correct" : "result-q is-wrong"} key={id}>
              <b>{index + 1}</b><span>{correctAnswer ? "✓ 정답" : "✕ 오답"}</span><small>{question.explanation}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
