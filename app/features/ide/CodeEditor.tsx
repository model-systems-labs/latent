"use client";

import { useEffect, useId, useRef } from "react";
import {
  createLearnerCodeEditorExtensions,
  type LearnerCodeEditorLanguage,
  type LearnerCodeEditorRunMode,
  type LearnerCodeEditorVariant,
} from "@latent/course-kit/learner-code-editor";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

type CodeEditorProps = {
  value: string;
  path: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  onRun?: (mode: LearnerCodeEditorRunMode) => void;
  runModes?: readonly LearnerCodeEditorRunMode[];
  readOnly?: boolean;
  variant?: "lesson" | "project" | "workbook";
  ariaLabel?: string;
  lineNumberStart?: number;
};

const editableEditorInstruction =
  "Code editor. Tab accepts an open suggestion or indents; Shift plus Tab outdents. Press Escape, then Tab, to leave the editor.";
const readOnlyEditorInstruction =
  "Read-only code example. Use the arrow keys to navigate the code. Press Escape, then Tab, to leave the code example.";

function languageForPath(path: string): LearnerCodeEditorLanguage {
  const normalized = path.toLowerCase();
  if (normalized.endsWith(".py")) return "python";
  if (normalized.endsWith(".tsx")) return "tsx";
  if (normalized.endsWith(".ts")) return "typescript";
  if (normalized.endsWith(".jsx")) return "jsx";
  return "javascript";
}

/**
 * React owns value synchronization and layout; Course Kit owns the actual
 * language, syntax, theme, accessibility, and keyboard editor primitive.
 */
export function CodeEditor({
  value,
  path,
  onChange,
  onSave,
  onRun,
  runModes,
  readOnly = false,
  variant = "project",
  ariaLabel,
  lineNumberStart = 1,
}: CodeEditorProps) {
  const language = languageForPath(path);
  const editorVariant: LearnerCodeEditorVariant =
    variant === "project" ? "workspace-dark" : "integrated";
  const defaultAriaLabel =
    variant === "project"
      ? `Project file editor: ${path}`
      : variant === "lesson"
        ? `Lesson code editor: ${path}`
        : `Workbook code editor: ${path}`;
  const hasRunHandler = Boolean(onRun);
  const hasSaveHandler = Boolean(onSave);
  const supportsExampleRun = hasRunHandler
    && (runModes === undefined || runModes.includes("examples"));
  const supportsCheckRun = hasRunHandler
    && (runModes === undefined || runModes.includes("check"));
  const instructionId = useId();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const changeRef = useRef(onChange);
  const saveRef = useRef(onSave);
  const runRef = useRef(onRun);
  const valueRef = useRef(value);
  const applyingExternalValueRef = useRef(false);

  useEffect(() => {
    changeRef.current = onChange;
    saveRef.current = onSave;
    runRef.current = onRun;
    valueRef.current = value;
  }, [onChange, onRun, onSave, value]);

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: valueRef.current,
        extensions: createLearnerCodeEditorExtensions({
          language,
          variant: editorVariant,
          tabSize: language === "python" ? 4 : 2,
          lineNumberStart,
          readOnly,
          ariaLabel: ariaLabel ?? defaultAriaLabel,
          ariaDescribedBy: instructionId,
          onChange: (nextValue) => {
            if (!applyingExternalValueRef.current) {
              changeRef.current(nextValue);
            }
          },
          ...(hasSaveHandler
            ? { onSave: () => saveRef.current?.() }
            : {}),
          ...(hasRunHandler
            ? {
                onRun: (mode: LearnerCodeEditorRunMode) => runRef.current?.(mode),
                runModes: [
                  ...(supportsExampleRun ? ["examples" as const] : []),
                  ...(supportsCheckRun ? ["check" as const] : []),
                ],
              }
            : {}),
        }),
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [
    ariaLabel,
    defaultAriaLabel,
    editorVariant,
    hasRunHandler,
    hasSaveHandler,
    instructionId,
    language,
    lineNumberStart,
    path,
    readOnly,
    supportsCheckRun,
    supportsExampleRun,
  ]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    applyingExternalValueRef.current = true;
    try {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    } finally {
      applyingExternalValueRef.current = false;
    }
  }, [value]);

  const className =
    variant === "lesson"
      ? "code-editor lesson-code-editor"
      : variant === "workbook"
        ? "code-editor workbook-code-editor"
        : "code-editor";
  const lessonHeight =
    variant === "lesson"
      ? `${Math.max(
          7.25,
          Math.min(23, value.split("\n").length * 1.5 + 2.5),
        )}rem`
      : undefined;

  return (
    <>
      <div
        className={className}
        ref={hostRef}
        style={lessonHeight ? { height: lessonHeight } : undefined}
      />
      <span className="sr-only" id={instructionId}>
        {readOnly ? readOnlyEditorInstruction : editableEditorInstruction}
        {!readOnly && supportsCheckRun && supportsExampleRun
          ? " Press Command or Control plus Enter to check; add Shift to run examples."
          : !readOnly && supportsCheckRun
            ? " Press Command or Control plus Enter to run the current check."
            : !readOnly && supportsExampleRun
              ? " Press Command or Control plus Shift plus Enter to run examples."
              : ""}
      </span>
    </>
  );
}
