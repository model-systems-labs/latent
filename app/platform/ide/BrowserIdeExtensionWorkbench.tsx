"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import type { TestReceipt } from "@latent/browser-lab";
import type {
  BrowserIdeExtensionDefinition,
  BrowserIdePersistedState,
  BrowserIdeSession,
  BrowserLabIdeRuntimeOptions,
} from "@latent/browser-lab/ide";
import { createLatentBrowserIdeSession } from "@/app/platform/ide/browser-extension-host";
import styles from "@/app/platform/ide/BrowserIdeExtensionWorkbench.module.css";

export type BrowserIdeExtensionWorkbenchProps = {
  /**
   * The definition reference is the session identity. Build reviewed
   * definitions once at module scope (or memoize them) so ordinary parent
   * rerenders preserve the active session.
   */
  readonly definition: BrowserIdeExtensionDefinition;
  readonly runtimeOptions?: BrowserLabIdeRuntimeOptions;
  readonly onReceipt?: (
    receipt: TestReceipt,
    state: BrowserIdePersistedState,
  ) => void;
};

type BrowserIdeInitialization =
  | {
      readonly session: BrowserIdeSession<ReactElement>;
      readonly status: "ready";
    }
  | {
      readonly session: BrowserIdeSession<ReactElement>;
      readonly status: "error";
      readonly message: string;
    };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The IDE operation failed.";
}

/**
 * Injectable reference player for trusted Browser IDE definitions. Courses
 * pass a definition rather than importing CodeMirror, workers, or persistence.
 */
export function BrowserIdeExtensionWorkbench({
  definition,
  runtimeOptions,
  onReceipt,
}: BrowserIdeExtensionWorkbenchProps) {
  const [, render] = useState(0);
  const [initialization, setInitialization] = useState<BrowserIdeInitialization | null>(null);
  const [message, setMessage] = useState("");
  const [completedReceipt, setCompletedReceipt] = useState<TestReceipt | null>(null);
  const onReceiptRef = useRef(onReceipt);
  const sessionRef = useRef<BrowserIdeSession<ReactElement> | null>(null);

  useEffect(() => {
    onReceiptRef.current = onReceipt;
  }, [onReceipt]);

  const handleReceipt = useCallback((receipt: TestReceipt) => {
    setMessage(receipt.status === "passed" ? "All checks passed." : "Some checks still need work.");
    setCompletedReceipt(receipt);
  }, []);

  const session = useMemo<BrowserIdeSession<ReactElement>>(() => (
    createLatentBrowserIdeSession(definition, {
      onStateChange: () => render((revision) => revision + 1),
      onReceipt: handleReceipt,
      onError: (error) => setMessage(errorMessage(error)),
    }, { runtime: runtimeOptions })
  ), [definition, handleReceipt, runtimeOptions]);

  useEffect(() => {
    let active = true;
    sessionRef.current = session;
    void session.initialize().then((state) => {
      if (!active) return;
      setMessage(state.recovery?.message ?? "");
      setInitialization({ session, status: "ready" });
    }).catch((error) => {
      if (active) {
        setInitialization({
          session,
          status: "error",
          message: errorMessage(error),
        });
      }
    });
    return () => {
      active = false;
      if (sessionRef.current === session) sessionRef.current = null;
      session.dispose();
    };
  }, [session]);

  useEffect(() => {
    if (!completedReceipt) return;
    const receiptState = sessionRef.current?.getReceiptState(completedReceipt.receiptId);
    if (receiptState) onReceiptRef.current?.(completedReceipt, receiptState);
  }, [completedReceipt]);

  if (initialization?.session !== session) {
    return <p className={styles.status} role="status">Loading the browser IDE…</p>;
  }
  if (initialization.status === "error") {
    return <p className={styles.status} role="alert">{initialization.message}</p>;
  }

  const state = session.getState();
  const run = async () => {
    setMessage("Running isolated checks…");
    render((revision) => revision + 1);
    try {
      const receipt = await session.runChecks();
      handleReceipt(receipt);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      render((revision) => revision + 1);
    }
  };
  const save = async () => {
    setMessage("Saving…");
    try {
      await session.save();
      setMessage("Saved in this browser.");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      render((revision) => revision + 1);
    }
  };

  return (
    <section
      className={styles.shell}
      aria-label={definition.title}
      data-browser-ide-extension={definition.id}
    >
      <div className={styles.toolbar}>
        <div className={styles.tabs} aria-label="Exercise files" role="group">
          {definition.files.map((file) => (
            <button
              aria-pressed={state.selectedPath === file.path}
              disabled={state.running}
              key={file.path}
              onClick={() => {
                session.select(file.path);
                render((revision) => revision + 1);
              }}
              type="button"
            >
              {file.title}{file.editable ? "" : " · provided"}
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          <button disabled={state.running || !state.dirty} onClick={() => void save()} type="button">
            Save
          </button>
          <button disabled={state.running} onClick={() => void run()} type="button">
            {state.running ? "Checking…" : "Run checks"}
          </button>
        </div>
      </div>
      <div className={styles.editor}>{session.renderEditor()}</div>
      <p aria-live="polite" className={styles.status} role="status">{message}</p>
      {state.lastReceipt ? (
        <section className={styles.results} aria-label="Check results">
          <h3>{state.lastReceipt.status === "passed" ? "Checks passed" : "Keep iterating"}</h3>
          <ul>
            {state.lastReceipt.results.map((result) => (
              <li key={`${result.contractId}/${result.caseId}`}>
                <strong>{result.passed ? "Passed" : "Needs work"}</strong>
                <span>{result.caseLabel}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
