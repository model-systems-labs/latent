"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PythonLabClient, PythonLabEvent, PythonLabRunResult } from "@latent/python-lab";
import styles from "./PythonExecution.module.css";

export type PythonExecutionPhase =
  | "off"
  | "loading"
  | "ready"
  | "running"
  | "testing"
  | "stopping"
  | "stopped"
  | "failed";

export type PythonExecutionTest = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type PythonProjectCheck = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type PythonProjectChecks = {
  results: readonly PythonProjectCheck[];
  totalCount: number;
  busy: boolean;
  disabled?: boolean;
  runFile: () => void | Promise<void>;
  buildProject: () => void | Promise<void>;
};

export type PythonArtifactSummary = {
  finalLoss: number;
  parameters: number;
  vocabularySize: number;
  trainedAt: number;
  origin: "python";
};

export type PythonExecutionSession = {
  phase: PythonExecutionPhase;
  status: string;
  stdout: string;
  stderr: string;
  traceback: string | null;
  tests: PythonExecutionTest[];
  artifact: PythonArtifactSummary | null;
  artifactIsCurrent: boolean;
  canTestAndTrain: boolean;
  busy: boolean;
  start: () => Promise<void>;
  runFile: () => Promise<void>;
  testAndTrain: () => Promise<void>;
  stop: () => Promise<void>;
  restart: () => Promise<void>;
};

type UsePythonExecutionOptions = {
  enabled: boolean;
  canTestAndTrain: boolean;
  path: string;
  source: string;
  persistedArtifact?: PythonArtifactSummary | null;
  saveBeforeRun: () => Promise<void>;
  showPanel: (panel: "tests" | "output") => void;
};

const INITIAL_STATUS = "Python is off. Starting it downloads about 9 MB for the WebAssembly core, standard library, and NumPy. Your browser can cache those files.";

function sourceIdentity(path: string, source: string) {
  return `${path}\u0000${source}`;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
    || error instanceof Error && (error.name === "AbortError" || /abort|stopp?ed/i.test(error.message));
}

function appendOutput(current: string, next: string) {
  const combined = `${current}${next}`;
  return combined.length > 60_000 ? combined.slice(-60_000) : combined;
}

function resultTraceback(result: PythonLabRunResult) {
  return result.exception?.traceback || null;
}

export function usePythonExecution({
  enabled,
  canTestAndTrain,
  path,
  source,
  persistedArtifact = null,
  saveBeforeRun,
  showPanel,
}: UsePythonExecutionOptions): PythonExecutionSession {
  const [phase, setPhase] = useState<PythonExecutionPhase>("off");
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [traceback, setTraceback] = useState<string | null>(null);
  const [tests, setTests] = useState<PythonExecutionTest[]>([]);
  const [trainedArtifact, setTrainedArtifact] = useState<PythonArtifactSummary | null>(null);
  const [artifactSourceIdentity, setArtifactSourceIdentity] = useState<string | null>(null);
  const clientRef = useRef<PythonLabClient | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const operationRef = useRef(0);
  const phaseRef = useRef(phase);
  const sourceRef = useRef({ path, source });
  const saveRef = useRef(saveBeforeRun);
  const panelRef = useRef(showPanel);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const previous = sourceRef.current;
    sourceRef.current = { path, source };
    saveRef.current = saveBeforeRun;
    panelRef.current = showPanel;
    if (previous.path === path && previous.source === source) return;
    setTests([]);
    setTraceback(null);
    if (phaseRef.current === "ready") {
      setStatus(canTestAndTrain
        ? "The source changed. Test and train again to replace the last verified checkpoint. Until then, the app keeps its last matching checkpoint."
        : "The source changed. Run file executes it; use the separate project checks to verify it.");
    }
  }, [canTestAndTrain, path, saveBeforeRun, showPanel, source]);

  const clearRunEvidence = useCallback(() => {
    setStdout("");
    setStderr("");
    setTraceback(null);
  }, []);

  const eventHandler = useCallback((operation: number) => (event: PythonLabEvent) => {
    if (operation !== operationRef.current) return;
    if (event.type === "stdout") {
      setStdout((current) => appendOutput(current, event.text));
      return;
    }
    if (event.type === "stderr") {
      setStderr((current) => appendOutput(current, event.text));
      return;
    }
    setStatus(event.message);
  }, []);

  const beginOperation = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    operationRef.current += 1;
    return { controller, operation: operationRef.current };
  }, []);

  const failOperation = useCallback((error: unknown, operation: number, fallback: string) => {
    if (operation !== operationRef.current) return;
    if (isAbortError(error)) {
      setPhase("stopped");
      setStatus("Python stopped. Restart it before you run anything else.");
      return;
    }
    const message = error instanceof Error ? error.message : fallback;
    setPhase("failed");
    setStatus(message);
    setStderr((current) => appendOutput(current, `${current ? "\n" : ""}${message}`));
    panelRef.current("output");
  }, []);

  const start = useCallback(async () => {
    if (!enabled || clientRef.current || phase === "loading") return;
    const { controller, operation } = beginOperation();
    clearRunEvidence();
    setPhase("loading");
    setStatus("Loading Python and NumPy in an isolated worker…");
    try {
      // The package and its worker are split from the page bundle. This import
      // is intentionally reachable only from the explicit Start Python action.
      const { PythonLabClient } = await import("@latent/python-lab");
      if (operation !== operationRef.current) return;
      const client = new PythonLabClient();
      clientRef.current = client;
      const initialized = await client.initialize(
        { packages: ["numpy"] },
        { signal: controller.signal, timeoutMs: 120_000, onEvent: eventHandler(operation) },
      );
      if (operation !== operationRef.current) return;
      setPhase("ready");
      setStatus(`${initialized.pythonVersion} with NumPy is ready. Latent saves and syncs the current file before every run.`);
    } catch (error) {
      if (operation === operationRef.current) {
        clientRef.current?.dispose();
        clientRef.current = null;
      }
      failOperation(error, operation, "Python couldn’t start in this browser.");
    }
  }, [beginOperation, clearRunEvidence, enabled, eventHandler, failOperation, phase]);

  const runFile = useCallback(async () => {
    const client = clientRef.current;
    if (!enabled || !client || phase !== "ready") return;
    const snapshot = { ...sourceRef.current };
    const { controller, operation } = beginOperation();
    clearRunEvidence();
    setPhase("running");
    setStatus(`Saving ${snapshot.path} before execution…`);
    panelRef.current("output");
    try {
      await saveRef.current();
      if (operation !== operationRef.current) return;
      await client.sync(
        { files: [{ path: snapshot.path, contents: snapshot.source }] },
        { signal: controller.signal, timeoutMs: 15_000, onEvent: eventHandler(operation) },
      );
      const result = await client.run(
        { entryPath: snapshot.path },
        { signal: controller.signal, timeoutMs: 120_000, onEvent: eventHandler(operation) },
      );
      if (operation !== operationRef.current) return;
      if (result.status === "failed") {
        setTraceback(resultTraceback(result));
        setPhase("ready");
        setStatus(`${result.exception?.type ?? "Python error"}: ${result.exception?.message ?? "Execution failed."}`);
        return;
      }
      setPhase("ready");
      setStatus(`${snapshot.path} finished in ${(result.durationMs / 1000).toFixed(2)} s. This only ran the file; it did not run project checks or replace the source-bound checkpoint.`);
    } catch (error) {
      failOperation(error, operation, "The Python file couldn’t run.");
    }
  }, [beginOperation, clearRunEvidence, enabled, eventHandler, failOperation, phase]);

  const testAndTrain = useCallback(async () => {
    const client = clientRef.current;
    if (!enabled || !canTestAndTrain || !client || phase !== "ready") return;
    const snapshot = { ...sourceRef.current };
    const { controller, operation } = beginOperation();
    clearRunEvidence();
    setTests([]);
    setArtifactSourceIdentity(null);
    setPhase("testing");
    setStatus(`Saving ${snapshot.path}, then running the course tests…`);
    panelRef.current("tests");
    try {
      await saveRef.current();
      if (operation !== operationRef.current) return;
      const { savePythonCharacterRnnArtifact } = await import("../python/character-rnn-service");
      const result = await savePythonCharacterRnnArtifact({
        source: snapshot.source,
        pythonLab: client,
        signal: controller.signal,
        initialize: false,
        onEvent: eventHandler(operation),
      });
      if (operation !== operationRef.current) return;
      setTests(result.tests);
      setTraceback(result.traceback ?? null);
      if (!result.passed || !result.artifact) {
        setPhase("ready");
        setStatus("The current source didn’t replace the last verified checkpoint. Fix the failing test, then run the checks again.");
        return;
      }
      setTrainedArtifact({
        finalLoss: result.artifact.finalLoss,
        parameters: result.artifact.parameters,
        vocabularySize: result.artifact.vocabularySize,
        trainedAt: result.artifact.trainedAt,
        origin: "python",
      });
      setArtifactSourceIdentity(sourceIdentity(snapshot.path, snapshot.source));
      setPhase("ready");
      setStatus(`All ${result.tests.length} tests passed. Python trained the checkpoint, and it’s saved for the browser to use. The chatbot can load it after the separate app build verifies its JavaScript adapters.`);
    } catch (error) {
      failOperation(error, operation, "The Python tests or training couldn’t finish.");
    }
  }, [beginOperation, canTestAndTrain, clearRunEvidence, enabled, eventHandler, failOperation, phase]);

  const stop = useCallback(async () => {
    const client = clientRef.current;
    operationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    if (!client) {
      setPhase("stopped");
      setStatus("Python stopped. Restart it before you run anything else.");
      return;
    }
    setPhase("stopping");
    setStatus("Stopping the interpreter worker…");
    try {
      await client.stop();
    } finally {
      setPhase("stopped");
      setStatus("Python stopped. Restarting gives you a fresh interpreter and leaves your saved file alone.");
    }
  }, []);

  const restart = useCallback(async () => {
    if (!enabled) return;
    if (!clientRef.current) {
      setPhase("off");
      await start();
      return;
    }
    const { controller, operation } = beginOperation();
    clearRunEvidence();
    setPhase("loading");
    setStatus("Restarting a clean Python interpreter and loading NumPy…");
    try {
      const initialized = await clientRef.current.reset(
        { packages: ["numpy"] },
        { signal: controller.signal, timeoutMs: 120_000, onEvent: eventHandler(operation) },
      );
      if (operation !== operationRef.current) return;
      setPhase("ready");
      setStatus(`${initialized.pythonVersion} with NumPy is ready in a fresh worker.`);
    } catch (error) {
      failOperation(error, operation, "Python couldn’t restart.");
    }
  }, [beginOperation, clearRunEvidence, enabled, eventHandler, failOperation, start]);

  useEffect(() => {
    if (enabled) return;
    operationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    clientRef.current?.dispose();
    clientRef.current = null;
    queueMicrotask(() => {
      if (clientRef.current) return;
      setPhase("off");
      setStatus(INITIAL_STATUS);
      clearRunEvidence();
      setTests([]);
    });
  }, [clearRunEvidence, enabled]);

  useEffect(() => () => {
    operationRef.current += 1;
    abortRef.current?.abort();
    clientRef.current?.dispose();
    clientRef.current = null;
  }, []);

  const artifact = trainedArtifact && (!persistedArtifact || trainedArtifact.trainedAt >= persistedArtifact.trainedAt)
    ? trainedArtifact
    : persistedArtifact;

  return {
    phase,
    status,
    stdout,
    stderr,
    traceback,
    tests,
    artifact,
    artifactIsCurrent: Boolean(artifact && artifactSourceIdentity === sourceIdentity(path, source)),
    canTestAndTrain,
    busy: phase === "loading" || phase === "running" || phase === "testing" || phase === "stopping",
    start,
    runFile,
    testAndTrain,
    stop,
    restart,
  };
}

export function PythonRuntimeActions({ session, disabled = false }: { session: PythonExecutionSession; disabled?: boolean }) {
  if (session.phase === "off") {
    return <button className="build" type="button" onClick={() => void session.start()} disabled={disabled}>Start Python</button>;
  }
  if (session.busy) {
    return <button className="python-stop" type="button" onClick={() => void session.stop()} disabled={disabled || session.phase === "stopping"}>{session.phase === "stopping" ? "Stopping…" : "Stop"}</button>;
  }
  if (session.phase === "stopped" || session.phase === "failed") {
    return <button className="build" type="button" onClick={() => void session.restart()} disabled={disabled}>Restart Python</button>;
  }
  return (
    <>
      <button type="button" onClick={() => void session.runFile()} disabled={disabled}>Run file</button>
      <button type="button" onClick={() => void session.restart()} disabled={disabled}>Restart</button>
    </>
  );
}

export function PythonInspector({
  session,
  path,
  persistenceError,
  projectChecks,
}: {
  session: PythonExecutionSession;
  path: string;
  persistenceError: string | null;
  projectChecks?: PythonProjectChecks;
}) {
  const passing = session.tests.filter((item) => item.passed).length;
  const projectPassing = projectChecks?.results.filter((item) => item.passed).length ?? 0;
  const checkpointStatus = session.tests.length
    ? `${passing}/${session.tests.length} passing`
    : session.artifactIsCurrent
      ? "Current"
      : session.artifact
        ? "Rebuild required"
        : "Not built";
  const phaseLabel = session.phase === "off" ? "Off" : session.phase === "ready" ? "Ready" : session.phase;
  return (
    <aside className={`project-inspector python-inspector${persistenceError ? " has-warning" : ""}`} aria-live="polite">
      {persistenceError ? <p className="persistence-warning" role="alert">Storage warning: {persistenceError}</p> : null}
      {projectChecks || session.canTestAndTrain ? (
        <section className={`unit-test-panel ${styles.checksPanel}`}>
          {projectChecks ? <>
            <header>
              <div><span>Project checks</span><strong>{projectChecks.results.length ? `${projectPassing}/${projectChecks.results.length} file checks passing` : `${projectChecks.totalCount} checks in full build`}</strong></div>
              <button className={styles.buildAction} type="button" onClick={() => void projectChecks.buildProject()} disabled={projectChecks.disabled || projectChecks.busy}>{projectChecks.busy ? "Running…" : "Test, build & run"}</button>
            </header>
            <div className="selected-test-heading"><span>{path}</span><button type="button" onClick={() => void projectChecks.runFile()} disabled={projectChecks.disabled || projectChecks.busy}>Run file checks</button></div>
            <div className={`unit-test-list ${styles.projectResults}`}>
              {projectChecks.results.length ? projectChecks.results.map((item) => (
                <article className={item.passed ? "passed" : "failed"} key={item.id}>
                  <i>{item.passed ? "✓" : "×"}</i><div><strong>{item.label}</strong><p>{item.detail}</p></div>
                </article>
              )) : <p>Run this file’s checks here, or test the complete app with the primary action above.</p>}
            </div>
          </> : null}
          {session.canTestAndTrain ? (
            <section className={styles.checkpointPanel} aria-labelledby="python-checkpoint-title">
              <header>
                <div><span id="python-checkpoint-title">Model checkpoint</span><strong>{checkpointStatus}</strong></div>
                <button type="button" onClick={() => void session.testAndTrain()} disabled={session.phase !== "ready"}>Test &amp; train</button>
              </header>
              {session.tests.length ? <div className={`unit-test-list ${styles.checkpointResults}`}>
                {session.tests.map((item) => (
                  <article className={item.passed ? "passed" : "failed"} key={item.id}>
                    <i>{item.passed ? "✓" : "×"}</i><div><strong>{item.label}</strong><p>{item.detail}</p></div>
                  </article>
                ))}
              </div> : <p>Checks this model file, trains its weights, and saves them for the app build.</p>}
            </section>
          ) : null}
        </section>
      ) : null}
      <section className="project-output python-output">
        <header><span>Output</span><strong>{phaseLabel}</strong></header>
        <p className="project-output-status" role="status">{session.status}</p>
        {session.traceback ? <pre className="python-traceback" role="alert">{session.traceback}</pre> : null}
        {session.stderr ? <pre className="python-stderr" aria-label="Python standard error">{session.stderr}</pre> : null}
        {session.stdout ? <pre className="python-stdout" aria-label="Python standard output">{session.stdout}</pre> : <p className="python-empty-output">Nothing printed yet.</p>}
        {session.artifact ? (
          <dl className="python-artifact-summary">
            <div><dt>checkpoint</dt><dd>{session.artifactIsCurrent ? "Verified for this source" : "Last verified · Python"}</dd></div>
            <div><dt>loss</dt><dd>{session.artifact.finalLoss.toFixed(3)}</dd></div>
            <div><dt>parameters</dt><dd>{session.artifact.parameters.toLocaleString()}</dd></div>
            <div><dt>vocabulary</dt><dd>{session.artifact.vocabularySize}</dd></div>
          </dl>
        ) : null}
        {session.artifact ? <p className={styles.handoffNote}><strong>Chatbot handoff.</strong> This source-bound Python checkpoint supplies the model weights. After the full app build passes, the chatbot loads them through its tested JavaScript adapters.</p> : null}
      </section>
    </aside>
  );
}
