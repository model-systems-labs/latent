"use client";

import { lazy, Suspense, useState } from "react";
import {
  PYTORCH_HANDOFFS,
  PYTORCH_REQUIREMENTS,
  type PyTorchHandoff as PyTorchHandoffDefinition,
} from "../../content/pytorch/handoffs";
import { downloadBrowserBlob } from "../../lib/browser-download";
import styles from "./PyTorchHandoff.module.css";

const ReadOnlyPythonEditor = lazy(async () => ({
  default: (await import("../ide/CodeEditor")).CodeEditor,
}));

function notebookLines(source: string) {
  const parts = source.split("\n");
  return parts.map((line, index) => index < parts.length - 1 ? `${line}\n` : line);
}

function notebookRequirements(handoff: PyTorchHandoffDefinition) {
  const requirements = PYTORCH_REQUIREMENTS.trim().split("\n");
  return handoff.lessonId === "transformers"
    ? requirements
    : requirements.filter((requirement) => requirement.startsWith("torch=="));
}

function notebookExportCell(handoff: PyTorchHandoffDefinition) {
  if (handoff.lessonId !== "transformers") return [];
  return [{
    cell_type: "code",
    execution_count: null,
    metadata: {},
    outputs: [],
    source: notebookLines('artifact = export_onnx(model)\nprint("Exported", artifact)\n'),
  }];
}

export function pytorchNotebookSource(handoff: PyTorchHandoffDefinition) {
  const file = handoff.files[0];
  return JSON.stringify({
    cells: [
      {
        cell_type: "markdown",
        metadata: {},
        source: notebookLines(`# ${handoff.title}\n\n${handoff.rationale}\n`),
      },
      {
        cell_type: "markdown",
        metadata: {},
        source: notebookLines("This notebook uses the real native PyTorch package. It is the framework translation of the browser NumPy lesson; it does not execute inside Pyodide. Run the next cell to install the exact framework versions tested by Latent.\n"),
      },
      {
        cell_type: "code",
        execution_count: null,
        metadata: {},
        outputs: [],
        source: notebookLines(`%pip install -q ${notebookRequirements(handoff).join(" ")}\n`),
      },
      {
        cell_type: "code",
        execution_count: null,
        metadata: {},
        outputs: [],
        source: notebookLines('import torch\nprint("PyTorch", torch.__version__)\n'),
      },
      {
        cell_type: "code",
        execution_count: null,
        metadata: {},
        outputs: [],
        source: notebookLines(file.code),
      },
      ...notebookExportCell(handoff),
    ],
    metadata: {
      kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
      language_info: { name: "python", version: "3" },
      latent: { lessonId: handoff.lessonId, sourcePath: file.path },
    },
    nbformat: 4,
    nbformat_minor: 5,
  }, null, 2);
}

function downloadSource(handoff: PyTorchHandoffDefinition) {
  const file = handoff.files[0];
  downloadBrowserBlob(
    new Blob([file.code], { type: "text/x-python;charset=utf-8" }),
    file.path.split("/").at(-1) ?? "pytorch_lesson.py",
  );
}

function downloadNotebook(handoff: PyTorchHandoffDefinition) {
  downloadBrowserBlob(
    new Blob([pytorchNotebookSource(handoff)], { type: "application/x-ipynb+json;charset=utf-8" }),
    `latent-${handoff.lessonId}-pytorch.ipynb`,
  );
}

export function PyTorchHandoff({ lessonId }: { lessonId: string }) {
  const handoff = PYTORCH_HANDOFFS[lessonId];
  const [open, setOpen] = useState(false);
  if (!handoff) return null;
  const file = handoff.files[0];

  return (
    <details className={styles.handoff} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span className={styles.kicker}>Native framework handoff</span>
        <span className={styles.summaryTitle}><strong>PyTorch</strong><span>{handoff.title}</span></span>
        <span className={styles.toggle}>{open ? "Close" : "Inspect"}</span>
      </summary>
      <div className={styles.body}>
        <div className={styles.copy}>
          <p>{handoff.rationale}</p>
          <p><strong>Runtime boundary.</strong> The NumPy exercise above runs locally in this browser. This file uses genuine <code>import torch</code> and runs in native Python or Colab because official PyTorch is not distributed as a Pyodide package.</p>
        </div>
        <dl className={styles.mapping} aria-label="Lesson mechanism to PyTorch API mapping">
          {handoff.mappings.map((mapping) => <div key={mapping.mechanism}><dt>{mapping.mechanism}</dt><dd>{mapping.pytorch}</dd></div>)}
        </dl>
        <div className={styles.fileHeading}><span>{file.path}</span><em>Read-only translation · smoke test included</em></div>
        {open ? (
          <div className={styles.editorSurface}>
            <Suspense fallback={<div className={styles.editorLoading} role="status">Loading Python highlighting…</div>}>
              <ReadOnlyPythonEditor
                ariaLabel={`Read-only PyTorch translation for ${handoff.title}`}
                onChange={() => undefined}
                path={file.path}
                readOnly
                value={file.code}
                variant="lesson"
              />
            </Suspense>
          </div>
        ) : null}
        <footer>
          <p>Download the notebook, then choose <strong>File → Upload notebook</strong> in Colab. The same source is included in the completed portfolio ZIP.</p>
          <div>
            <button type="button" onClick={() => downloadSource(handoff)}>Download .py</button>
            <button type="button" onClick={() => downloadNotebook(handoff)}>Download notebook</button>
            <a href="https://colab.research.google.com/" target="_blank" rel="noreferrer">Open Colab ↗</a>
          </div>
        </footer>
      </div>
    </details>
  );
}
