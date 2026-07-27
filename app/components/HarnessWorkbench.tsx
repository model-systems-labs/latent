"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CodeEditor } from "@/app/features/ide/CodeEditor";
import { runPythonProjectContracts, runPythonProjectFunction } from "@/app/features/ide/python-lesson-service";
import { harnessEngineeringContractSuite } from "@/examples/learning-platform/llm-learning/content/harness-engineering/contracts";
import { HARNESS_PROJECT_STARTER_FILES } from "@/app/lib/harness-project";
import {
  HARNESS_SCENARIO_EXPORT,
  HARNESS_SCENARIO_FIXTURES,
  HARNESS_SCENARIO_MODULE_PATH,
  harnessScenarioArguments,
  harnessScenarioMatchesExpected,
  harnessScenarioTrace,
  type HarnessScenarioTrace,
} from "@/examples/learning-platform/llm-learning/content/harness-engineering/scenarios";
import { initializeLearnerPersistence } from "@/app/lib/learner-state";
import {
  currentHarnessReceipt,
  firstHarnessSourceMismatch,
  flushHarnessWorkspacePersistence,
  harnessRunEvidence,
  initializeHarnessWorkspace,
  loadHarnessWorkspaceState,
  reconcileHarnessWorkspaceWithLearner,
  recordHarnessTestRun,
  saveHarnessWorkspaceFile,
  selectHarnessWorkspaceFile,
  useHarnessWorkspaceState,
  HARNESS_RECOVERY_PREFIX,
} from "@/app/lib/harness-workspace";
import type { TestResultRecord } from "@/app/platform/persistence/types";
import styles from "@/app/components/HarnessWorkbench.module.css";

type MobileView = "files" | "code" | "run" | "checks";
type InspectorView = "run" | "checks";
type ResultScope = "file" | "project";
type CheckResult = Pick<TestResultRecord, "contractId" | "path" | "label" | "passed" | "detail">;
type ScenarioAttempt = {
  scenarioId: string;
  trace: HarnessScenarioTrace | null;
  error: string | null;
  pythonOutput: string;
  matchesExpected: boolean;
  stale: boolean;
};

function terminalStatusLabel(status: HarnessScenarioTrace["status"]) {
  if (status === "completed") return "completed";
  if (status === "approval_required") return "approval required";
  if (status === "budget_exceeded") return "turn limit reached";
  return "fixed replies ended";
}

function contractsForPath(path: string) {
  return harnessEngineeringContractSuite.contracts.filter((contract) => (
    contract.cases.some((exerciseCase) => exerciseCase.invoke.modulePath === path)
  ));
}

function recoveryKey(path: string) {
  return `${HARNESS_RECOVERY_PREFIX}${path}`;
}

function readRecovery(path: string) {
  try { return window.sessionStorage.getItem(recoveryKey(path)); } catch { return null; }
}

function writeRecovery(path: string, content: string) {
  try { window.sessionStorage.setItem(recoveryKey(path), content); } catch { /* IndexedDB remains the primary save path. */ }
}

function clearRecovery(path: string) {
  try { window.sessionStorage.removeItem(recoveryKey(path)); } catch { /* Best effort only. */ }
}

export function HarnessWorkbench() {
  const workspace = useHarnessWorkspaceState();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [results, setResults] = useState<CheckResult[]>([]);
  const [resultScope, setResultScope] = useState<ResultScope | null>(null);
  const [status, setStatus] = useState("Restoring your project…");
  const [busy, setBusy] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("code");
  const [inspectorView, setInspectorView] = useState<InspectorView>("run");
  const [scenarioId, setScenarioId] = useState(HARNESS_SCENARIO_FIXTURES[0]?.id ?? "");
  const [scenarioAttempt, setScenarioAttempt] = useState<ScenarioAttempt | null>(null);
  const [recovery, setRecovery] = useState<string | null>(null);
  const draftsRef = useRef<Record<string, string>>({});
  const runAbortRef = useRef<AbortController | null>(null);
  const selected = workspace.selectedPath ? workspace.files[workspace.selectedPath] : undefined;
  const scenario = HARNESS_SCENARIO_FIXTURES.find((candidate) => candidate.id === scenarioId)
    ?? HARNESS_SCENARIO_FIXTURES[0];
  const draft = selected ? drafts[selected.path] ?? selected.content : "";
  const dirty = Boolean(selected && draft !== selected.content);
  const updateDraft = (path: string, content: string) => {
    draftsRef.current = { ...draftsRef.current, [path]: content };
    setDrafts((current) => ({ ...current, [path]: content }));
    setScenarioAttempt((current) => current ? { ...current, stale: true } : current);
  };
  const visibleFilesForRun = (path: string) => ({
    ...Object.fromEntries(Object.values(workspace.files).map((file) => [file.path, file.content])),
    [path]: draftsRef.current[path] ?? draft,
  });
  const requireCurrentVisibleSource = (path: string, durableFiles: Readonly<Record<string, string>>) => {
    const visibleFiles = visibleFilesForRun(path);
    const mismatch = firstHarnessSourceMismatch(visibleFiles, durableFiles);
    if (!mismatch) return;
    if (mismatch === path) writeRecovery(path, visibleFiles[path] ?? "");
    throw new Error(`${mismatch} changed in another tab. Reload this project before running code.`);
  };

  const refreshReceipt = useCallback(async () => {
    const current = await currentHarnessReceipt();
    setResults(current?.run.results ?? []);
    setResultScope(current
      ? new Set(current.run.results.map((result) => result.path)).size > 1 ? "project" : "file"
      : null);
    if (current) {
      setStatus(current.receipt.passed
        ? `${current.receipt.passedCount} checks pass for this saved revision.`
        : `${current.receipt.passedCount} of ${current.receipt.totalCount} checks pass for this saved revision.`);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await Promise.all([initializeLearnerPersistence(), initializeHarnessWorkspace()]);
        await reconcileHarnessWorkspaceWithLearner();
        if (!active) return;
        const requested = new URL(window.location.href).searchParams.get("file");
        const restored = loadHarnessWorkspaceState();
        const initialPath = requested && HARNESS_PROJECT_STARTER_FILES.some((file) => file.path === requested)
          ? requested
          : restored.selectedPath ?? HARNESS_PROJECT_STARTER_FILES[0]?.path;
        if (initialPath) await selectHarnessWorkspaceFile(initialPath);
        await refreshReceipt();
        if (active) setStatus("");
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : "The Harness project could not be restored.");
      }
    })();
    return () => {
      active = false;
      runAbortRef.current?.abort();
    };
  }, [refreshReceipt]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!selected) {
        setRecovery(null);
        return;
      }
      const candidate = readRecovery(selected.path);
      setRecovery(candidate && candidate !== selected.content ? candidate : null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selected]);

  const save = useCallback(async (announce = true) => {
    if (!selected || !dirty) return;
    if (announce) setStatus(`Saving ${selected.path}…`);
    const snapshot = draft;
    try {
      await saveHarnessWorkspaceFile(selected.path, snapshot);
      await flushHarnessWorkspacePersistence();
      const latest = draftsRef.current[selected.path] ?? snapshot;
      if (latest === snapshot) {
        clearRecovery(selected.path);
        if (announce) setStatus("Saved locally.");
      } else if (announce) {
        setStatus("Newer changes are still waiting to save.");
      }
    } catch (error) {
      writeRecovery(selected.path, draftsRef.current[selected.path] ?? snapshot);
      setStatus(error instanceof Error ? error.message : "The file could not be saved. A recovery copy remains in this browser.");
      throw error;
    }
  }, [dirty, draft, selected]);

  useEffect(() => {
    if (!selected || !dirty || busy) return;
    writeRecovery(selected.path, draft);
    const timer = window.setTimeout(() => void save(false).catch(() => undefined), 700);
    return () => window.clearTimeout(timer);
  }, [busy, dirty, draft, save, selected]);

  useEffect(() => {
    const flush = () => {
      if (selected && dirty) writeRecovery(selected.path, draft);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [dirty, draft, selected]);

  const openFile = async (path: string) => {
    if (selected && dirty) {
      try { await save(false); } catch { return; }
    }
    await selectHarnessWorkspaceFile(path);
    const url = new URL(window.location.href);
    url.searchParams.set("file", path);
    window.history.replaceState({}, "", url);
    setMobileView("code");
    setRecovery(null);
  };

  const performTests = async (scope: "file" | "project") => {
    if (!selected || busy) return;
    setBusy(true);
    setInspectorView("checks");
    setMobileView("checks");
    const controller = new AbortController();
    runAbortRef.current = controller;
    try {
      if (dirty) await save(false);
      const evidence = await harnessRunEvidence();
      requireCurrentVisibleSource(selected.path, evidence.files);
      const contracts = scope === "file" ? contractsForPath(selected.path) : harnessEngineeringContractSuite.contracts;
      setStatus(scope === "file" ? `Running ${contracts.length} checks for ${selected.path}…` : `Running all ${contracts.length} project checks…`);
      const run = await runPythonProjectContracts({
        files: evidence.files,
        contracts,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === "progress") setStatus(event.message);
        },
      });
      controller.signal.throwIfAborted();
      const recorded = run.results.map((result): TestResultRecord => ({
        contractId: result.id,
        path: result.path,
        label: result.label,
        passed: result.passed,
        detail: result.detail,
        durationMs: 0,
      }));
      await recordHarnessTestRun(evidence, recorded);
      setResults(recorded);
      setResultScope(scope);
      const passed = recorded.filter((result) => result.passed).length;
      setStatus(passed === recorded.length
        ? `${passed} checks pass for this exact saved source.`
        : `${passed} of ${recorded.length} checks pass. Open the first failure below.`);
    } catch (error) {
      if (controller.signal.aborted) {
        setStatus("Run stopped. Previous results remain attached to their saved source.");
      } else {
        const message = error instanceof Error ? error.message : "The Harness checks stopped safely.";
        setStatus(message);
      }
    } finally {
      if (runAbortRef.current === controller) runAbortRef.current = null;
      setBusy(false);
    }
  };

  const runScenario = async () => {
    if (!selected || !scenario || busy) return;
    setBusy(true);
    setInspectorView("run");
    setMobileView("run");
    const controller = new AbortController();
    runAbortRef.current = controller;
    try {
      if (dirty) await save(false);
      const evidence = await harnessRunEvidence();
      requireCurrentVisibleSource(selected.path, evidence.files);
      setStatus(`Running “${scenario.label}”…`);
      const execution = await runPythonProjectFunction({
        files: evidence.files,
        path: HARNESS_SCENARIO_MODULE_PATH,
        exportName: HARNESS_SCENARIO_EXPORT,
        args: harnessScenarioArguments(scenario),
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === "progress") setStatus(event.message);
        },
      });
      controller.signal.throwIfAborted();
      const pythonOutput = [execution.stdout, execution.stderr].filter(Boolean).join("\n");
      if (execution.observation.status === "threw") {
        const error = `${execution.observation.errorName}: ${execution.observation.message}`;
        setScenarioAttempt({ scenarioId: scenario.id, trace: null, error, pythonOutput, matchesExpected: false, stale: false });
        setStatus(`“${scenario.label}” stopped in your Python code.`);
        return;
      }
      if (execution.observation.status !== "returned") {
        const error = execution.observation.message;
        setScenarioAttempt({ scenarioId: scenario.id, trace: null, error, pythonOutput, matchesExpected: false, stale: false });
        setStatus(`“${scenario.label}” could not finish in the browser runtime.`);
        return;
      }
      const trace = harnessScenarioTrace(execution.observation.value);
      const matchesExpected = harnessScenarioMatchesExpected(execution.observation.value, scenario);
      setScenarioAttempt({ scenarioId: scenario.id, trace, error: null, pythonOutput, matchesExpected, stale: false });
      setStatus(matchesExpected
        ? trace.summary
        : `Your harness returned ${terminalStatusLabel(trace.status)}; this case should end ${terminalStatusLabel(scenario.expected.terminalStatus)}.`);
    } catch (error) {
      if (controller.signal.aborted) {
        setStatus("Run stopped. The previous scenario result is still shown.");
      } else {
        const message = error instanceof Error ? error.message : "The recorded scenario stopped safely.";
        setStatus(message);
        setScenarioAttempt({ scenarioId: scenario.id, trace: null, error: message, pythonOutput: "", matchesExpected: false, stale: false });
      }
    } finally {
      if (runAbortRef.current === controller) runAbortRef.current = null;
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && busy) {
        event.preventDefault();
        runAbortRef.current?.abort();
        return;
      }
      if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey)) return;
      event.preventDefault();
      if (event.shiftKey) void performTests("file");
      else void runScenario();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const resultPaths = useMemo(() => new Map(
    results.map((result) => [result.contractId, result.path]),
  ), [results]);
  const passingByPath = useMemo(() => new Map(HARNESS_PROJECT_STARTER_FILES.map((file) => {
    const expected = contractsForPath(file.path);
    const fileResults = results.filter((result) => result.path === file.path);
    return [file.path, expected.length > 0 && expected.every((contract) => fileResults.some((result) => result.contractId === contract.id && result.passed))] as const;
  })), [results]);
  const verifiedFiles = HARNESS_PROJECT_STARTER_FILES.filter((file) => {
    const current = workspace.files[file.path];
    return passingByPath.get(file.path) || Boolean(current && current.verifiedCells === current.totalCells);
  }).length;

  return (
    <main className={styles.shell} id="main-content" tabIndex={-1}>
      <header className={styles.topbar}>
        <Link className="wordmark" href="/" aria-label="Latent Courses home"><i />latent courses</Link>
        <div><strong>harness-engineering/</strong></div>
        <nav><Link href="/courses/harness-engineering">Course</Link><Link href="/lessons/agent-loop">Lessons</Link></nav>
      </header>
      <section className={styles.workbench} aria-busy={!workspace.ready || busy}>
      <header className={styles.projectBar}>
        <div><strong>{verifiedFiles} of {HARNESS_PROJECT_STARTER_FILES.length} files verified</strong><span>Saved in this browser</span></div>
        <div className={styles.projectActions}>
          {busy ? <button type="button" onClick={() => runAbortRef.current?.abort()}>Stop</button> : null}
          <button className={styles.primaryAction} type="button" onClick={() => void performTests("project")} disabled={!workspace.ready || busy}>Test project</button>
        </div>
      </header>

      <nav className={styles.mobileTabs} aria-label="Workspace views">
        {(["files", "code", "run", "checks"] as const).map((view) => (
          <button type="button" aria-pressed={mobileView === view} onClick={() => {
            setMobileView(view);
            if (view === "run" || view === "checks") setInspectorView(view);
          }} key={view}>{view}</button>
        ))}
      </nav>

      <div className={styles.layout} data-mobile-view={mobileView}>
        <aside className={styles.fileTree} aria-label="Harness project files">
          <header><strong>harness/</strong><span>Python package</span></header>
          <ol>
            {HARNESS_PROJECT_STARTER_FILES.map((file, index) => {
              const current = workspace.files[file.path];
              const complete = passingByPath.get(file.path) || Boolean(current && current.verifiedCells === current.totalCells);
              return (
                <li key={file.path}>
                  <button className={selected?.path === file.path ? styles.activeFile : ""} type="button" onClick={() => void openFile(file.path)}>
                    <i data-complete={complete} aria-hidden="true" />
                    <span>{file.path.replace("harness/", "")}</span>
                    <em>{String(index + 1).padStart(2, "0")}</em>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className={styles.editorPanel}>
          <header>
            <div><code>{selected?.path ?? "Select a file"}</code><span>{dirty ? "Unsaved changes" : "Saved"}</span></div>
            {selected ? <Link href={`/lessons/${selected.lessonId}`}>Lesson ↗</Link> : null}
          </header>
          {recovery && selected ? (
            <div className={styles.recoveryNotice} role="status">
              <span>A newer recovery copy is available.</span>
              <div><button type="button" onClick={() => { updateDraft(selected.path, recovery); setRecovery(null); }}>Load</button><button type="button" onClick={() => { clearRecovery(selected.path); setRecovery(null); }}>Discard</button></div>
            </div>
          ) : null}
          <div className={styles.editorHost}>
            {selected ? <CodeEditor
              ariaLabel={`Edit ${selected.path}`}
              onChange={(value) => {
                updateDraft(selected.path, value);
                setResults([]);
                setResultScope(null);
              }}
              onSave={() => void save()}
              path={selected.path}
              value={draft}
              variant="workbook"
            /> : <p>Select a project file.</p>}
          </div>
          <footer>
            <span role="status" aria-live="polite">{workspace.error ?? status}</span>
            <div>
              {dirty ? <button type="button" onClick={() => void save()} disabled={busy}>Save</button> : null}
              <button type="button" onClick={() => void performTests("file")} disabled={!selected || busy} aria-keyshortcuts="Control+Shift+Enter Meta+Shift+Enter">Test file</button>
              <button className={styles.primaryAction} type="button" onClick={() => void runScenario()} disabled={!selected || busy} aria-keyshortcuts="Control+Enter Meta+Enter">Run scenario</button>
            </div>
          </footer>
        </section>

        <aside className={styles.inspector}>
          <nav className={styles.inspectorTabs} aria-label="Inspector views">
            <button type="button" aria-pressed={inspectorView === "run"} onClick={() => { setInspectorView("run"); setMobileView("run"); }}>
              <strong>Scenario</strong><span>Fixed replies</span>
            </button>
            <button type="button" aria-pressed={inspectorView === "checks"} onClick={() => { setInspectorView("checks"); setMobileView("checks"); }}>
              <strong>Checks</strong><span>{results.length ? `${results.filter((result) => result.passed).length}/${results.length}` : "Not run"}</span>
            </button>
          </nav>

          {inspectorView === "checks" ? (
            <section className={styles.testsPanel}>
              <header><div><strong>{resultScope === "project" ? "Project checks" : selected?.path.replace("harness/", "") ?? "Selected file"}</strong><span>{resultScope === "project" ? "All saved files" : "Checks for saved code"}</span></div>{selected ? <button type="button" onClick={() => void performTests("file")} disabled={busy}>Test file</button> : null}</header>
              <div className={styles.resultList}>
                {results.length ? results.map((result) => (
                  <button type="button" className={result.passed ? styles.passed : styles.failed} key={result.contractId} onClick={() => void openFile(resultPaths.get(result.contractId) ?? result.path)}>
                    <i>{result.passed ? "✓" : "×"}</i><span><strong>{result.label}</strong><small>{result.detail}</small></span>
                  </button>
                )) : <p>Run this file’s checks, or test the whole project.</p>}
              </div>
            </section>
          ) : scenario ? (
            <section className={styles.scenarioPanel}>
              <div className={styles.scenarioControls}>
                <label htmlFor="harness-scenario"><strong>Scenario</strong></label>
                <select id="harness-scenario" value={scenario.id} onChange={(event) => {
                  setScenarioId(event.target.value);
                  setScenarioAttempt(null);
                }} disabled={busy}>
                  {HARNESS_SCENARIO_FIXTURES.map((fixture) => <option value={fixture.id} key={fixture.id}>{fixture.label}</option>)}
                </select>
                <p>{scenario.description}</p>
                <p className={styles.adapterNote}>The model replies and tool results are fixed test data. Your Python parses each reply, checks permissions, applies the turn limit, and builds the trace.</p>
                <button className={styles.scenarioRunButton} type="button" onClick={() => void runScenario()} disabled={!selected || busy}>Run scenario</button>
              </div>

              <div className={styles.scenarioResult} data-stale={scenarioAttempt?.stale || undefined}>
                {scenarioAttempt?.stale ? <p className={styles.staleNotice}>Code changed. Run this scenario again.</p> : null}
                {scenarioAttempt?.error ? (
                  <div className={styles.scenarioError}><strong>Stopped in your code</strong><p>{scenarioAttempt.error}</p></div>
                ) : scenarioAttempt?.trace ? (
                  <>
                    <p className={styles.runSummary} data-matches={scenarioAttempt.matchesExpected}>
                      {scenarioAttempt.matchesExpected
                        ? scenarioAttempt.trace.summary
                        : `Returned ${terminalStatusLabel(scenarioAttempt.trace.status)}; expected ${terminalStatusLabel(scenario.expected.terminalStatus)}.`}
                    </p>
                    <ol className={styles.traceList}>
                      {scenarioAttempt.trace.rows.map((row, index) => (
                        <li data-tone={row.tone} key={`${row.actor}-${index}`}>
                          <em>{String(index + 1).padStart(2, "0")}</em><strong>{row.actor}</strong><span>{row.text}</span>
                        </li>
                      ))}
                    </ol>
                  </>
                ) : <p className={styles.emptyScenario}>Run this case against your saved project.</p>}

                <details className={styles.cassette}>
                  <summary>View fixed model replies</summary>
                  <div className={styles.cassetteEditor}>
                    <CodeEditor
                      ariaLabel={`Recorded replies for ${scenario.label}`}
                      onChange={() => undefined}
                      path="recorded-model.json"
                      readOnly
                      value={JSON.stringify({ adapter: "recorded", responses: scenario.recordedResponses }, null, 2)}
                      variant="workbook"
                    />
                  </div>
                </details>
                {scenarioAttempt?.pythonOutput ? <details className={styles.pythonOutput}><summary>Show Python output</summary><pre>{scenarioAttempt.pythonOutput}</pre></details> : null}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
      </section>
    </main>
  );
}
