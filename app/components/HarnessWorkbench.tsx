"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CodeEditor } from "../features/ide/CodeEditor";
import { runPythonProjectContracts, runPythonProjectFile } from "../features/ide/python-lesson-service";
import { harnessEngineeringContractSuite } from "../content/harness-engineering/contracts";
import { HARNESS_PROJECT_STARTER_FILES } from "../content/harness-engineering/project-template";
import { initializeLearnerPersistence } from "../lib/learner-state";
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
} from "../lib/harness-workspace";
import type { TestResultRecord } from "../platform/persistence/types";
import styles from "./HarnessWorkbench.module.css";

type MobileView = "files" | "code" | "tests" | "output";
type CheckResult = Pick<TestResultRecord, "contractId" | "path" | "label" | "passed" | "detail">;

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
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("Restoring your project…");
  const [busy, setBusy] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("code");
  const [recovery, setRecovery] = useState<string | null>(null);
  const draftsRef = useRef<Record<string, string>>({});
  const runAbortRef = useRef<AbortController | null>(null);
  const selected = workspace.selectedPath ? workspace.files[workspace.selectedPath] : undefined;
  const draft = selected ? drafts[selected.path] ?? selected.content : "";
  const dirty = Boolean(selected && draft !== selected.content);
  const updateDraft = (path: string, content: string) => {
    draftsRef.current = { ...draftsRef.current, [path]: content };
    setDrafts((current) => ({ ...current, [path]: content }));
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
    setMobileView("tests");
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
      const passed = recorded.filter((result) => result.passed).length;
      setOutput([
        run.stdout,
        run.stderr ? `Standard error\n${run.stderr}` : "",
        `${passed}/${recorded.length} checks passed in ${((run.completedAt - run.startedAt) / 1000).toFixed(2)} s.`,
        run.stdout || run.stderr ? "" : "No standard output was written by this run.",
      ].filter(Boolean).join("\n\n"));
      setStatus(passed === recorded.length
        ? `${passed} checks pass for this exact saved source.`
        : `${passed} of ${recorded.length} checks pass. Open the first failure below.`);
    } catch (error) {
      if (controller.signal.aborted) {
        setStatus("Run stopped. Previous results remain attached to their saved source.");
      } else {
        const message = error instanceof Error ? error.message : "The Harness checks stopped safely.";
        setStatus(message);
        setOutput(message);
        setMobileView("output");
      }
    } finally {
      if (runAbortRef.current === controller) runAbortRef.current = null;
      setBusy(false);
    }
  };

  const runFile = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setMobileView("output");
    const controller = new AbortController();
    runAbortRef.current = controller;
    try {
      if (dirty) await save(false);
      const evidence = await harnessRunEvidence();
      requireCurrentVisibleSource(selected.path, evidence.files);
      setStatus(`Running ${selected.path}…`);
      const execution = await runPythonProjectFile({ files: evidence.files, path: selected.path, signal: controller.signal });
      if (execution.run.status === "failed") {
        throw new Error(execution.run.exception?.message ?? "Python execution failed.");
      }
      setOutput(execution.stdout || execution.stderr || "File executed successfully. No standard output was written.");
      setStatus(`${selected.path} finished.`);
    } catch (error) {
      if (controller.signal.aborted) {
        setStatus("Run stopped. Previous output remains visible.");
      } else {
        const message = error instanceof Error ? error.message : "The Python file stopped safely.";
        setStatus(message);
        setOutput(message);
      }
    } finally {
      if (runAbortRef.current === controller) runAbortRef.current = null;
      setBusy(false);
    }
  };

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
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link className="wordmark" href="/" aria-label="Latent home"><i />latent</Link>
        <div><strong>harness-engineering/</strong></div>
        <nav><Link href="/courses/harness-engineering">Course</Link><Link href="/lessons/agent-loop">Lessons</Link></nav>
      </header>
      <section className={styles.workbench} aria-busy={!workspace.ready || busy}>
      <header className={styles.projectBar}>
        <div><strong>{verifiedFiles} of {HARNESS_PROJECT_STARTER_FILES.length} files verified</strong><span>Saved in this browser</span></div>
        <div className={styles.projectActions}>
          {busy ? <button type="button" onClick={() => runAbortRef.current?.abort()}>Stop</button> : null}
          <button className={styles.primaryAction} type="button" onClick={() => void performTests("project")} disabled={!workspace.ready || busy}>Run all {harnessEngineeringContractSuite.contracts.length}</button>
        </div>
      </header>

      <nav className={styles.mobileTabs} aria-label="Workspace views">
        {(["files", "code", "tests", "output"] as const).map((view) => (
          <button type="button" aria-pressed={mobileView === view} onClick={() => setMobileView(view)} key={view}>{view}</button>
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
              <button type="button" onClick={() => void runFile()} disabled={!selected || busy}>Run file</button>
              <button className={styles.primaryAction} type="button" onClick={() => void performTests("file")} disabled={!selected || busy}>Test file</button>
            </div>
          </footer>
        </section>

        <aside className={styles.inspector} aria-live="polite">
          <section className={styles.testsPanel}>
            <header><div><strong>Tests</strong><span>{results.length ? `${results.filter((result) => result.passed).length}/${results.length} passing` : "Not run"}</span></div>{selected ? <button type="button" onClick={() => void performTests("file")} disabled={busy}>Run current</button> : null}</header>
            <div className={styles.resultList}>
              {results.length ? results.map((result) => (
                <button type="button" className={result.passed ? styles.passed : styles.failed} key={result.contractId} onClick={() => void openFile(resultPaths.get(result.contractId) ?? result.path)}>
                  <i>{result.passed ? "✓" : "×"}</i><span><strong>{result.label}</strong><small>{result.detail}</small></span>
                </button>
              )) : <p>Run this file to check its public behavior, or run all to test the complete project.</p>}
            </div>
          </section>
          <section className={styles.outputPanel}>
            <header><strong>Output</strong><span>CPython in your browser</span></header>
            <pre>{output || "Standard output will appear here."}</pre>
          </section>
        </aside>
      </div>
      </section>
    </main>
  );
}
