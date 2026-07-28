"use client";

import { isLeechQuestionProgress } from "@latent/course-kit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PracticeContractRun } from "@/app/features/ide/browser-lab-service";
import { CodeEditor } from "@/app/features/ide/CodeEditor";
import {
  methodQuestionGroups,
  methodQuestionLibrary,
  methodQuestions,
} from "@/examples/learning-platform/llm-learning/content/practice/question-library";
import {
  contractVersionForMethodQuestion,
  runMethodQuestion,
  type MethodQuestionRunMode,
} from "@/app/features/practice/question-runner";
import { methodPracticeReferenceSolution } from "@/app/features/practice/reference-solutions";
import {
  applyQuestionAttemptMutation,
  applyQuestionDraftMutation,
  applyQuestionResetMutation,
  emptyQuestionProgress,
  loadQuestionProgress,
  questionProgressStatus,
  resetQuestionProgress,
  saveQuestionAttempt,
  saveQuestionDraft,
  subscribeQuestionLibraryProgress,
  type QuestionProgress,
  type QuestionProgressIdentity,
  type QuestionProgressStatus,
} from "@/app/lib/question-progress";
import styles from "@/app/practice/PracticeWorkbench.module.css";

type MethodQuestion = (typeof methodQuestions)[number];
type StatusFilter = "all" | QuestionProgressStatus;
type MobileView = "question" | "code" | "results";
type RunState =
  | { status: "idle" }
  | { status: "running"; mode: MethodQuestionRunMode; source: string }
  | {
      status: "complete";
      mode: MethodQuestionRunMode;
      source: string;
      passed: boolean;
      run: PracticeContractRun;
    }
  | { status: "error"; mode: MethodQuestionRunMode; source: string; message: string };

const libraryProgressId = `${methodQuestionLibrary.library.id}@${methodQuestionLibrary.library.version}`;

function questionKey(question: MethodQuestion) {
  return `${question.groupId}/${question.id}`;
}

function questionIdentity(question: MethodQuestion): QuestionProgressIdentity {
  return { libraryId: libraryProgressId, questionId: questionKey(question) };
}

function mutationId(action: string, question: MethodQuestion) {
  return `${action}:${questionKey(question)}:${Date.now()}:${crypto.randomUUID()}`;
}

function formatJson(value: unknown) {
  const formatted = JSON.stringify(value);
  return formatted === undefined ? String(value) : formatted;
}

function expectedForCase(exerciseCase: MethodQuestion["cases"][number]) {
  const assertion = exerciseCase.assertions.find((candidate) => "expected" in candidate);
  return assertion && "expected" in assertion ? formatJson(assertion.expected) : "See the check description";
}

function resultDetail(result: PracticeContractRun["cases"][number]) {
  const failures = result.assertions.filter((assertion) => !assertion.passed);
  if (!failures.length) return result.detail;
  return failures.map((failure) => failure.detail).join(" ");
}

export function PracticeWorkbench({
  initialProgressQuery = "all",
}: {
  initialProgressQuery?: "all" | "leeches";
} = {}) {
  const questions = methodQuestions;
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activeKey, setActiveKey] = useState(() => questionKey(questions[0]));
  const [draft, setDraft] = useState(questions[0].starterCode);
  const [progressByQuestion, setProgressByQuestion] = useState<Record<string, QuestionProgress>>({});
  const [storageState, setStorageState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "unavailable">("saved");
  const [runState, setRunState] = useState<RunState>({ status: "idle" });
  const [mobileView, setMobileView] = useState<MobileView>("question");
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [announcement, setAnnouncement] = useState("Loading practice progress.");
  const progressRef = useRef(progressByQuestion);
  const draftRef = useRef(draft);
  const activeQuestionRef = useRef<MethodQuestion>(questions[0]);
  const draftTouchedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runAbortRef = useRef<AbortController | null>(null);
  const activeLoadRef = useRef(0);
  const storageUnavailableRef = useRef(false);
  const resultsRef = useRef<HTMLElement | null>(null);
  const mobileTabRefs = useRef<Partial<Record<MobileView, HTMLButtonElement | null>>>({});

  const activeQuestion = questions.find((question) => questionKey(question) === activeKey) ?? questions[0];
  const activeContractVersion = contractVersionForMethodQuestion(
    methodQuestionLibrary.library.version,
    activeQuestion,
  );
  const activeReferenceSolution = methodPracticeReferenceSolution(activeQuestion.id);

  useEffect(() => {
    progressRef.current = progressByQuestion;
  }, [progressByQuestion]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    activeQuestionRef.current = activeQuestion;
  }, [activeQuestion]);

  const enterTabOnlyMode = useCallback((announce = true) => {
    storageUnavailableRef.current = true;
    setStorageState("unavailable");
    setSaveState("unavailable");
    if (announce) {
      setAnnouncement("Device storage is unavailable. Practice progress will stay in this tab.");
    }
  }, []);

  const updateProgress = useCallback((progress: QuestionProgress) => {
    const next = {
      ...progressRef.current,
      [progress.questionId]: progress,
    };
    progressRef.current = next;
    setProgressByQuestion(next);
  }, []);

  const focusMobileView = useCallback((view: MobileView) => {
    if (
      typeof window === "undefined"
      || !window.matchMedia("(max-width: 820px)").matches
    ) return;
    window.requestAnimationFrame(() => {
      if (view === "results") {
        if (resultsRef.current) resultsRef.current.scrollTop = 0;
        resultsRef.current?.focus({ preventScroll: true });
        return;
      }
      mobileTabRefs.current[view]?.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    subscribeQuestionLibraryProgress(
      libraryProgressId,
      (records) => {
        if (cancelled || storageUnavailableRef.current) return;
        const next = Object.fromEntries(records.map((record) => [record.questionId, record]));
        progressRef.current = next;
        setProgressByQuestion(next);
        setStorageState("ready");
      },
      () => {
        if (cancelled) return;
        enterTabOnlyMode();
      },
    ).then((stop) => {
      if (cancelled) stop();
      else unsubscribe = stop;
    }).catch(() => {
      if (cancelled) return;
      enterTabOnlyMode();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enterTabOnlyMode]);

  const latestProgressForQuestion = useCallback((question: MethodQuestion) => {
    const identity = questionIdentity(question);
    return progressRef.current[identity.questionId] ?? emptyQuestionProgress(identity);
  }, []);

  const persistDraftInMemory = useCallback((
    question: MethodQuestion,
    source: string,
    current = latestProgressForQuestion(question),
  ) => {
    const outcome = applyQuestionDraftMutation(current, {
      source,
      expectedEpoch: current.epoch,
      expectedRevision: current.revision,
      mutationId: mutationId("draft-tab", question),
    });
    updateProgress(outcome.progress);
    setSaveState("unavailable");
    return outcome.progress;
  }, [latestProgressForQuestion, updateProgress]);

  const persistDraft = useCallback(async (question: MethodQuestion, source: string) => {
    let current = latestProgressForQuestion(question);
    if (storageUnavailableRef.current) {
      return persistDraftInMemory(question, source, current);
    }
    const identity = questionIdentity(question);
    if (current.draft === source) return current;
    setSaveState("saving");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const outcome = await saveQuestionDraft(identity, {
        source,
        expectedEpoch: current.epoch,
        expectedRevision: current.revision,
        mutationId: mutationId("draft", question),
      });
      if (!outcome.saved) {
        enterTabOnlyMode();
        return persistDraftInMemory(question, source, current);
      }
      current = outcome.value.progress;
      updateProgress(current);
      if (outcome.value.applied && outcome.value.reason !== "stale-epoch" && outcome.value.reason !== "stale-revision") {
        setSaveState("saved");
        return current;
      }
      try {
        current = await loadQuestionProgress(identity);
        updateProgress(current);
      } catch {
        enterTabOnlyMode();
        return persistDraftInMemory(question, source, current);
      }
    }
    setSaveState("unsaved");
    return current;
  }, [
    enterTabOnlyMode,
    latestProgressForQuestion,
    persistDraftInMemory,
    updateProgress,
  ]);

  const flushCurrentDraft = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!draftTouchedRef.current) return latestProgressForQuestion(activeQuestionRef.current);
    const question = activeQuestionRef.current;
    const source = draftRef.current;
    const progress = await persistDraft(question, source);
    if (
      questionKey(activeQuestionRef.current) === questionKey(question)
      && draftRef.current === source
      && progress.draft === source
    ) {
      draftTouchedRef.current = false;
    }
    return progress;
  }, [latestProgressForQuestion, persistDraft]);

  useEffect(() => () => {
    runAbortRef.current?.abort();
    void flushCurrentDraft();
  }, [flushCurrentDraft]);

  useEffect(() => {
    if (storageUnavailableRef.current) {
      setAnnouncement(`${activeQuestion.title} loaded from this tab.`);
      return;
    }
    const loadId = activeLoadRef.current + 1;
    activeLoadRef.current = loadId;
    loadQuestionProgress(questionIdentity(activeQuestion)).then((progress) => {
      if (activeLoadRef.current !== loadId || storageUnavailableRef.current) return;
      updateProgress(progress);
      if (!draftTouchedRef.current) {
        setDraft(progress.draft ?? activeQuestion.starterCode);
      }
      setStorageState("ready");
      setAnnouncement(`${activeQuestion.title} loaded.`);
    }).catch(() => {
      if (activeLoadRef.current !== loadId) return;
      enterTabOnlyMode();
    });
  }, [activeKey, activeQuestion, enterTabOnlyMode, updateProgress]);

  const progressForQuestion = useCallback((question: MethodQuestion) => {
    const identity = questionIdentity(question);
    return progressByQuestion[identity.questionId] ?? emptyQuestionProgress(identity);
  }, [progressByQuestion]);

  const statusOf = useCallback((question: MethodQuestion) => {
    const progress = progressForQuestion(question);
    const source = questionKey(question) === activeKey ? draft : progress.draft;
    return questionProgressStatus(
      progress,
      contractVersionForMethodQuestion(methodQuestionLibrary.library.version, question),
      source,
    );
  }, [activeKey, draft, progressForQuestion]);

  const isLeech = useCallback((question: MethodQuestion) => {
    const progress = progressForQuestion(question);
    return isLeechQuestionProgress({
      status: statusOf(question),
      attemptCount: progress.attemptCount,
      failureCount: progress.failureCount,
    });
  }, [progressForQuestion, statusOf]);

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return methodQuestionGroups.flatMap((group) => {
      if (groupFilter !== "all" && group.id !== groupFilter) return [];
      const visibleQuestions = group.questions.filter((question) => {
        const withGroup = questions.find((candidate) => candidate.groupId === group.id && candidate.id === question.id);
        if (!withGroup) return false;
        if (initialProgressQuery === "leeches" && !isLeech(withGroup)) return false;
        if (statusFilter !== "all" && statusOf(withGroup) !== statusFilter) return false;
        return !normalizedQuery || [
          question.title,
          question.prompt,
          ...question.tags,
        ].join(" ").toLowerCase().includes(normalizedQuery);
      });
      return visibleQuestions.length ? [{ ...group, questions: visibleQuestions }] : [];
    });
  }, [groupFilter, initialProgressQuery, isLeech, query, questions, statusFilter, statusOf]);

  const visibleQuestionKeys = useMemo(() => new Set(visibleGroups.flatMap((group) => (
    group.questions.map((question) => `${group.id}/${question.id}`)
  ))), [visibleGroups]);
  const firstVisibleQuestion = useMemo(() => {
    const group = visibleGroups[0];
    const question = group?.questions[0];
    return question
      ? questions.find((candidate) => (
          candidate.groupId === group.id && candidate.id === question.id
        )) ?? null
      : null;
  }, [questions, visibleGroups]);

  const openQuestion = useCallback((question: MethodQuestion) => {
    if (questionKey(question) === activeKey) {
      setMobileView("question");
      return;
    }
    void flushCurrentDraft();
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    const cached = progressRef.current[questionKey(question)];
    draftTouchedRef.current = false;
    setDraft(cached?.draft ?? question.starterCode);
    setRunState({ status: "idle" });
    setConfirmingReset(false);
    setSaveState(storageUnavailableRef.current ? "unavailable" : "saved");
    setActiveKey(questionKey(question));
    setMobileView("question");
  }, [activeKey, flushCurrentDraft]);

  useEffect(() => {
    if (
      initialProgressQuery === "leeches"
      && firstVisibleQuestion
      && !isLeech(activeQuestionRef.current)
    ) {
      openQuestion(firstVisibleQuestion);
    }
  }, [firstVisibleQuestion, initialProgressQuery, isLeech, openQuestion]);

  const resumeNext = useCallback(() => {
    const next = initialProgressQuery === "leeches"
      ? questions.find(isLeech)
      : questions.find((question) => statusOf(question) !== "solved");
    if (!next) return;
    openQuestion(next);
  }, [initialProgressQuery, isLeech, openQuestion, questions, statusOf]);

  const handleChange = useCallback((source: string) => {
    setDraft(source);
    draftRef.current = source;
    draftTouchedRef.current = true;
    setSaveState(storageUnavailableRef.current ? "unavailable" : "unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void flushCurrentDraft();
    }, 500);
  }, [flushCurrentDraft]);

  const recordAttempt = useCallback(async (
    question: MethodQuestion,
    source: string,
    passed: boolean,
  ) => {
    if (
      draftRef.current !== source
      || questionKey(activeQuestionRef.current) !== questionKey(question)
    ) return;
    const identity = questionIdentity(question);
    let current = await persistDraft(question, source);
    if (
      current.draft !== source
      || draftRef.current !== source
      || questionKey(activeQuestionRef.current) !== questionKey(question)
    ) return;
    const contractVersion = contractVersionForMethodQuestion(
      methodQuestionLibrary.library.version,
      question,
    );
    const recordInMemory = () => {
      const outcome = applyQuestionAttemptMutation(current, {
        source,
        contractVersion,
        passed,
        expectedEpoch: current.epoch,
        expectedRevision: current.revision,
        mutationId: mutationId("attempt-tab", question),
      });
      current = outcome.progress;
      updateProgress(current);
      setSaveState("unavailable");
    };
    if (storageUnavailableRef.current) {
      recordInMemory();
      return;
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (current.draft !== source) return;
      const outcome = await saveQuestionAttempt(identity, {
        source,
        contractVersion,
        passed,
        expectedEpoch: current.epoch,
        expectedRevision: current.revision,
        mutationId: mutationId("attempt", question),
      });
      if (!outcome.saved) {
        enterTabOnlyMode();
        recordInMemory();
        return;
      }
      current = outcome.value.progress;
      updateProgress(current);
      if (outcome.value.applied && outcome.value.reason !== "stale-epoch" && outcome.value.reason !== "stale-revision") return;
      try {
        current = await loadQuestionProgress(identity);
        updateProgress(current);
      } catch {
        enterTabOnlyMode();
        recordInMemory();
        return;
      }
    }
    setSaveState("unsaved");
    setAnnouncement("The result is ready, but progress changed in another tab and was not recorded.");
  }, [enterTabOnlyMode, persistDraft, updateProgress]);

  const runQuestion = useCallback(async (mode: MethodQuestionRunMode) => {
    const question = activeQuestionRef.current;
    const source = draftRef.current;
    await flushCurrentDraft();
    if (
      questionKey(activeQuestionRef.current) !== questionKey(question)
      || draftRef.current !== source
    ) {
      setAnnouncement("The check did not start because the open code changed.");
      return;
    }
    runAbortRef.current?.abort();
    const controller = new AbortController();
    runAbortRef.current = controller;
    setRunState({ status: "running", mode, source });
    setMobileView("results");
    focusMobileView("results");
    setAnnouncement(mode === "examples" ? "Running example checks." : "Checking the full solution.");
    try {
      const run = await runMethodQuestion({
        question,
        libraryVersion: methodQuestionLibrary.library.version,
        source,
        mode,
        signal: controller.signal,
      });
      if (controller.signal.aborted || questionKey(activeQuestionRef.current) !== questionKey(question)) return;
      const passed = run.results.length > 0 && run.results.every((result) => result.passed);
      setRunState({ status: "complete", mode, source, passed, run });
      const stale = draftRef.current !== source;
      setAnnouncement(stale
        ? "Checks finished, but the code changed while they ran."
        : passed
          ? mode === "examples"
            ? "All example checks passed."
            : "All checks passed. Question marked solved."
          : "Some checks still need work.");
      if (mode === "check" && !stale) void recordAttempt(question, source, passed);
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "The practice runner stopped with an error.";
      setRunState({ status: "error", mode, source, message });
      setAnnouncement(message);
    } finally {
      if (runAbortRef.current === controller) runAbortRef.current = null;
    }
  }, [flushCurrentDraft, focusMobileView, recordAttempt]);

  const cancelRun = useCallback(() => {
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    setRunState({ status: "idle" });
    setMobileView("code");
    focusMobileView("code");
    setAnnouncement("Practice check canceled.");
  }, [focusMobileView]);

  const resetActiveQuestion = useCallback(async () => {
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const question = activeQuestionRef.current;
    const identity = questionIdentity(question);
    let current = latestProgressForQuestion(question);
    let resetScope: "device" | "tab" | null = null;
    const resetInMemory = () => {
      const outcome = applyQuestionResetMutation(current, {
        expectedEpoch: current.epoch,
        expectedRevision: current.revision,
        mutationId: mutationId("reset-tab", question),
      });
      current = outcome.progress;
      updateProgress(current);
      return "tab" as const;
    };

    if (storageUnavailableRef.current) {
      resetScope = resetInMemory();
    } else {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const outcome = await resetQuestionProgress(identity, {
          expectedEpoch: current.epoch,
          expectedRevision: current.revision,
          mutationId: mutationId("reset", question),
        });
        if (!outcome.saved) {
          enterTabOnlyMode(false);
          resetScope = resetInMemory();
          break;
        }
        current = outcome.value.progress;
        updateProgress(current);
        if (
          outcome.value.applied
          && outcome.value.reason !== "stale-epoch"
          && outcome.value.reason !== "stale-revision"
        ) {
          resetScope = "device";
          break;
        }
        try {
          current = await loadQuestionProgress(identity);
          updateProgress(current);
        } catch {
          enterTabOnlyMode(false);
          resetScope = resetInMemory();
          break;
        }
      }
    }

    if (!resetScope) {
      setSaveState("unsaved");
      setAnnouncement("Progress changed in another tab, so this question was not reset. Try again.");
      return;
    }

    if (questionKey(activeQuestionRef.current) !== questionKey(question)) return;
    setDraft(question.starterCode);
    draftRef.current = question.starterCode;
    draftTouchedRef.current = false;
    setRunState({ status: "idle" });
    setConfirmingReset(false);
    if (resetScope === "tab") {
      setSaveState("unavailable");
      setAnnouncement(`${question.title} reset for this tab. Device storage still has its previous copy.`);
    } else {
      setSaveState("saved");
      setAnnouncement(`${question.title} reset to its starter.`);
    }
  }, [enterTabOnlyMode, latestProgressForQuestion, updateProgress]);

  const activeStatus = questionProgressStatus(
    progressForQuestion(activeQuestion),
    activeContractVersion,
    draft,
  );
  const solvedCount = questions.filter((question) => statusOf(question) === "solved").length;
  const leechCount = questions.filter(isLeech).length;
  const runIsStale = (runState.status === "complete" || runState.status === "error")
    && runState.source !== draft;

  if (initialProgressQuery === "leeches" && storageState === "loading") {
    return (
      <section className={styles.workbench} aria-busy="true" aria-label="Leech practice workspace">
        <p className={styles.emptyLibrary}>Loading device practice progress…</p>
      </section>
    );
  }

  if (initialProgressQuery === "leeches" && leechCount === 0) {
    return (
      <section className={styles.workbench} aria-label="Leech practice workspace">
        <p className={styles.emptyLibrary}>
          No leeched questions. A question appears here after three attempts and two misses,
          and leaves after you solve it.
        </p>
      </section>
    );
  }

  if (initialProgressQuery === "leeches" && !isLeech(activeQuestion)) {
    return (
      <section
        aria-busy={Boolean(firstVisibleQuestion)}
        aria-label="Leech practice workspace"
        className={styles.workbench}
      >
        <p className={styles.emptyLibrary}>
          {firstVisibleQuestion
            ? "Opening the next leeched question…"
            : "No leeched questions match the current filters."}
        </p>
      </section>
    );
  }

  return (
    <section className={styles.workbench} aria-label="Method practice workspace">
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <header className={styles.toolbar}>
        <div className={styles.progressSummary}>
          <strong>
            {initialProgressQuery === "leeches"
              ? `${leechCount} leeched question${leechCount === 1 ? "" : "s"}`
              : `${solvedCount} of ${questions.length} solved`}
          </strong>
          <span>{storageState === "loading" ? "Loading device progress" : storageState === "ready" ? "Saved on this device" : "Tab-only progress"}</span>
        </div>
        <div className={styles.filters}>
          <label>
            <span>Search questions</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search questions"
              type="search"
              value={query}
            />
          </label>
          <label>
            <span>Question group</span>
            <select onChange={(event) => setGroupFilter(event.target.value)} value={groupFilter}>
              <option value="all">All groups</option>
              {methodQuestionGroups.map((group) => <option value={group.id} key={group.id}>{group.title}</option>)}
            </select>
          </label>
          <label>
            <span>Question status</span>
            <select onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} value={statusFilter}>
              <option value="all">All status</option>
              <option value="new">New</option>
              <option value="attempted">Attempted</option>
              <option value="solved">Solved</option>
            </select>
          </label>
        </div>
        <button onClick={resumeNext} type="button">Resume next</button>
      </header>

      <div className={styles.layout} data-mobile-view={mobileView}>
        <nav className={styles.mobileTabs} aria-label="Practice workspace view">
          {(["question", "code", "results"] as const).map((view) => (
            <button
              aria-pressed={mobileView === view}
              key={view}
              onClick={() => setMobileView(view)}
              ref={(element) => {
                mobileTabRefs.current[view] = element;
              }}
              type="button"
            >
              {view[0].toUpperCase() + view.slice(1)}
            </button>
          ))}
        </nav>

        <aside className={styles.library} aria-label="Question library">
          {visibleGroups.map((group) => (
            <section className={styles.group} key={group.id}>
              <header>
                <strong>{group.title}</strong>
                <span>{group.questions.length} question{group.questions.length === 1 ? "" : "s"}</span>
              </header>
              <ol>
                {group.questions.map((question) => {
                  const withGroup = questions.find((candidate) => (
                    candidate.groupId === group.id && candidate.id === question.id
                  ))!;
                  const status = statusOf(withGroup);
                  return (
                    <li key={question.id}>
                      <button
                        aria-current={questionKey(withGroup) === activeKey ? "true" : undefined}
                        className={styles.questionButton}
                        onClick={() => openQuestion(withGroup)}
                        type="button"
                      >
                        <strong>{question.title}</strong>
                        <small>{question.difficulty}</small>
                        <i aria-label={status} data-status={status} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {!visibleGroups.length ? <p className={styles.emptyLibrary}>No questions match those filters.</p> : null}
          {visibleGroups.length && !visibleQuestionKeys.has(activeKey) ? (
            <p className={styles.emptyLibrary}>The open question is outside the current filters.</p>
          ) : null}
        </aside>

        <article className={styles.prompt}>
          <header>
            <div>
              <span data-difficulty={activeQuestion.difficulty}>{activeQuestion.difficulty}</span>
              <em>{activeStatus}</em>
            </div>
            <h2>{activeQuestion.title}</h2>
          </header>
          <p>{activeQuestion.prompt}</p>
          <h3>Examples</h3>
          <div className={styles.exampleList}>
            {activeQuestion.cases.filter((exerciseCase) => exerciseCase.visibility === "example").map((exerciseCase) => (
              <article className={styles.example} key={exerciseCase.id}>
                <strong>{exerciseCase.label}</strong>
                <dl>
                  <div><dt>Input</dt><dd>{formatJson(exerciseCase.args)}</dd></div>
                  <div><dt>Expected</dt><dd>{expectedForCase(exerciseCase)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <h3>Constraints</h3>
          <ul>{activeQuestion.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}</ul>
        </article>

        <section className={styles.codeWorkspace} aria-label="Code and results">
          <header className={styles.codeHeader}>
            <div>
              <code>{activeQuestion.path}</code>
              <span>{activeQuestion.entrypoint.className}.{activeQuestion.entrypoint.methodName}() · browser sandbox</span>
            </div>
            <span className={styles.saveState}>{saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved" : "Tab only"}</span>
          </header>
          <div className={styles.editorHost}>
            <CodeEditor
              ariaLabel={`${activeQuestion.title} solution editor`}
              onChange={handleChange}
              onRun={(mode) => void runQuestion(mode)}
              onSave={() => void flushCurrentDraft()}
              path={activeQuestion.path}
              runModes={["examples", "check"]}
              value={draft}
              variant="workbook"
            />
          </div>
          <div className={styles.editorControls}>
            <footer className={styles.editorFooter}>
              <span>⌘/Ctrl + Enter checks · ⇧ + ⌘/Ctrl + Enter runs examples · ⌘/Ctrl + S saves · Escape then Tab exits</span>
              <div className={styles.editorActions}>
                {runState.status === "running" ? (
                  <button className={styles.cancelAction} onClick={cancelRun} type="button">Cancel</button>
                ) : (
                  <button onClick={() => setConfirmingReset(true)} type="button">Start over</button>
                )}
                <button disabled={runState.status === "running"} onClick={() => void runQuestion("examples")} type="button">Run examples</button>
                <button
                  className={styles.primaryAction}
                  disabled={runState.status === "running"}
                  onClick={() => void runQuestion("check")}
                  type="button"
                >
                  {runState.status === "running" ? "Checking…" : "Check solution"}
                </button>
              </div>
            </footer>
            <div className={`learner-solution-host ${styles.solutionHost}`}>
              <details className="learner-solution">
                <summary aria-label={`View example solution for ${activeQuestion.title}`}>
                  View example solution
                </summary>
                <p className="learner-summary">
                  Compare the approach with your draft. Opening this reference does not replace
                  your code or update progress.
                </p>
                <div className={styles.solutionEditor}>
                  <CodeEditor
                    ariaLabel={`${activeQuestion.title} example solution`}
                    onChange={() => undefined}
                    path={activeQuestion.path}
                    readOnly
                    value={activeReferenceSolution}
                    variant="workbook"
                  />
                </div>
              </details>
            </div>
            {confirmingReset ? (
              <div className={styles.resetConfirmation} role="alert">
                <p>Replace this draft with the starter and clear its attempts?</p>
                <div>
                  <button onClick={() => setConfirmingReset(false)} type="button">Keep draft</button>
                  <button onClick={() => void resetActiveQuestion()} type="button">Reset question</button>
                </div>
              </div>
            ) : null}
          </div>
          <section
            aria-busy={runState.status === "running"}
            aria-label="Check results"
            className={styles.results}
            ref={resultsRef}
            tabIndex={-1}
          >
            <header>
              <strong>Results</strong>
              <span>{runIsStale ? "Code changed after this run" : runState.status === "running" ? "Running locally" : activeStatus}</span>
            </header>
            {runState.status === "idle" ? (
              <p className={styles.resultSummary}>Run the examples for a quick pass, or check the full solution to record progress.</p>
            ) : null}
            {runState.status === "running" ? <p className={styles.resultSummary}>Starting the isolated browser worker…</p> : null}
            {runState.status === "error" ? <p className={styles.resultSummary} data-tone="failed">{runState.message}</p> : null}
            {runState.status === "complete" ? (
              <>
                <p className={styles.resultSummary} data-tone={runState.passed && !runIsStale ? "passed" : "failed"}>
                  {runIsStale
                    ? "These results belong to an older draft. Run the checks again."
                    : runState.passed
                      ? runState.mode === "check" ? "All checks passed." : "All example checks passed."
                      : "At least one check needs work."}
                </p>
                <ol className={styles.resultList}>
                  {runState.run.cases.map((result) => (
                    <li data-passed={result.passed} key={`${result.contractId}/${result.caseId}`}>
                      <i aria-hidden="true">{result.passed ? "✓" : "×"}</i>
                      <div>
                        <strong>{result.caseLabel}</strong>
                        <small>{resultDetail(result)}</small>
                      </div>
                    </li>
                  ))}
                  {!runState.run.cases.length ? runState.run.results.map((result) => (
                    <li data-passed={result.passed} key={result.id}>
                      <i aria-hidden="true">{result.passed ? "✓" : "×"}</i>
                      <div><strong>{result.label}</strong><small>{result.detail}</small></div>
                    </li>
                  )) : null}
                </ol>
                {runState.run.output.length ? (
                  <details className={styles.output}>
                    <summary>Program output</summary>
                    <pre>{runState.run.output.map((chunk) => chunk.text).join("")}</pre>
                  </details>
                ) : null}
              </>
            ) : null}
          </section>
        </section>
      </div>
    </section>
  );
}
