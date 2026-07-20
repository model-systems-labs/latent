"use client";

import { useEffect, useId, useRef } from "react";
import { basicSetup } from "codemirror";
import { acceptCompletion } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { indentWithTab, temporarilySetTabFocusMode } from "@codemirror/commands";
import { tags } from "@lezer/highlight";

type CodeEditorProps = {
  value: string;
  path: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
  variant?: "lesson" | "project" | "workbook";
  ariaLabel?: string;
  lineNumberStart?: number;
};

const editorPalette = {
  background: "#1f1e21",
  foreground: "#f0ebf2",
  keyword: "#ddbdf2",
  string: "#e6c99e",
  number: "#a9d6ef",
  comment: "#aaa3ad",
  gutter: "#9a939d",
  variable: "#ece7ef",
  function: "#bed7ee",
  property: "#b9cfdf",
  type: "#d5c3ea",
  punctuation: "#beb6c2",
  operator: "#d8c7e3",
  invalid: "#ffb4ad",
} as const;

const lessonEditorPalette = {
  background: "#fbfaf8",
  foreground: "#292623",
  keyword: "#6f3e78",
  string: "#7b4b1f",
  number: "#1d6174",
  comment: "#605b56",
  gutter: "#6f6963",
  variable: "#292623",
  function: "#2c5f78",
  property: "#3f5969",
  type: "#67456e",
  punctuation: "#524d48",
  operator: "#684c6e",
  invalid: "#9c3434",
} as const;

const latentTheme = EditorView.theme({
  "&": {
    height: "100%",
    minHeight: "420px",
    color: editorPalette.foreground,
    backgroundColor: editorPalette.background,
    fontSize: "14px",
  },
  ".cm-content": {
    padding: "18px 0 56px",
    caretColor: "#d9b98c",
    cursor: "text",
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
    lineHeight: "1.72",
    userSelect: "text",
    WebkitUserSelect: "text",
  },
  ".cm-line": { padding: "0 22px 0 10px" },
  ".cm-gutters": {
    backgroundColor: editorPalette.background,
    color: editorPalette.gutter,
    borderRight: "1px solid rgba(255,255,255,.055)",
    paddingLeft: "8px",
  },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "rgba(191,169,214,.065)" },
  ".cm-selectionBackground": { backgroundColor: "rgba(181,151,209,.20)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": { backgroundColor: "rgba(181,151,209,.20)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#e4c79e" },
  ".cm-scroller": {
    overflow: "auto",
    overscrollBehaviorX: "contain",
    overscrollBehaviorY: "auto",
    scrollbarColor: "#6f6874 transparent",
    scrollbarWidth: "thin",
  },
  ".cm-matchingBracket": {
    backgroundColor: "rgba(190,215,238,.14)",
    outline: "1px solid rgba(190,215,238,.42)",
  },
  "&.cm-focused": {
    outline: "2px solid rgba(221,189,242,.72)",
    outlineOffset: "-2px",
  },
}, { dark: true });

const lessonTheme = EditorView.theme({
  "&": {
    height: "100%",
    minHeight: "0",
    color: lessonEditorPalette.foreground,
    backgroundColor: lessonEditorPalette.background,
    fontSize: "14px",
  },
  ".cm-content": {
    padding: "15px 0 20px",
    caretColor: "#6d557b",
    cursor: "text",
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
    lineHeight: "1.72",
    userSelect: "text",
    WebkitUserSelect: "text",
  },
  ".cm-line": { padding: "0 20px 0 10px" },
  ".cm-gutters": {
    backgroundColor: lessonEditorPalette.background,
    color: lessonEditorPalette.gutter,
    borderRight: "1px solid #e7e3de",
    paddingLeft: "4px",
  },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-activeLineGutter": { backgroundColor: "#f2edf4" },
  ".cm-selectionBackground": { backgroundColor: "#ded2e4" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": { backgroundColor: "#ded2e4" },
  ".cm-selectionMatch": { backgroundColor: "#eee8f0", outline: "1px solid #d2c2d9" },
  ".cm-selectionMatch-main": { backgroundColor: "#e5dbe9" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#6d557b" },
  ".cm-foldGutter": { display: "none" },
  ".cm-scroller": {
    minHeight: "0",
    overflow: "auto",
    overscrollBehaviorX: "contain",
    overscrollBehaviorY: "auto",
    scrollbarColor: "#b8b1aa transparent",
    scrollbarWidth: "thin",
  },
  ".cm-matchingBracket": {
    backgroundColor: "#eee8f0",
    outline: "1px solid #a997b3",
  },
  "&.cm-focused": {
    outline: "2px solid #6d557b",
    outlineOffset: "-2px",
  },
}, { dark: false });

const syntaxTheme = HighlightStyle.define([
  { tag: tags.keyword, color: editorPalette.keyword, fontWeight: "600" },
  { tag: [tags.string, tags.regexp, tags.escape], color: editorPalette.string },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: editorPalette.number },
  { tag: tags.comment, color: editorPalette.comment, fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.labelName], color: editorPalette.function },
  { tag: [tags.definition(tags.variableName), tags.className, tags.typeName], color: editorPalette.type },
  { tag: [tags.propertyName, tags.attributeName], color: editorPalette.property },
  { tag: [tags.variableName, tags.name], color: editorPalette.variable },
  { tag: tags.operator, color: editorPalette.operator },
  { tag: tags.punctuation, color: editorPalette.punctuation },
  { tag: tags.invalid, color: editorPalette.invalid, textDecoration: "underline wavy" },
]);

const lessonSyntaxTheme = HighlightStyle.define([
  { tag: tags.keyword, color: lessonEditorPalette.keyword, fontWeight: "600" },
  { tag: [tags.string, tags.regexp, tags.escape], color: lessonEditorPalette.string },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: lessonEditorPalette.number },
  { tag: tags.comment, color: lessonEditorPalette.comment, fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.labelName], color: lessonEditorPalette.function },
  { tag: [tags.definition(tags.variableName), tags.className, tags.typeName], color: lessonEditorPalette.type },
  { tag: [tags.propertyName, tags.attributeName], color: lessonEditorPalette.property },
  { tag: [tags.variableName, tags.name], color: lessonEditorPalette.variable },
  { tag: tags.operator, color: lessonEditorPalette.operator },
  { tag: tags.punctuation, color: lessonEditorPalette.punctuation },
  { tag: tags.invalid, color: lessonEditorPalette.invalid, textDecoration: "underline wavy" },
]);

const editableEditorInstruction = "Code editor. Tab accepts an open suggestion; otherwise it indents. Press Escape, then Tab, to leave the editor.";
const readOnlyEditorInstruction = "Read-only code example. Use the arrow keys to navigate the code. Press Escape, then Tab, to leave the code example.";

export function CodeEditor({ value, path, onChange, onSave, readOnly = false, variant = "project", ariaLabel, lineNumberStart = 1 }: CodeEditorProps) {
  const isPython = path.toLowerCase().endsWith(".py");
  const lightEditor = variant !== "project";
  const instructionId = useId();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const changeRef = useRef(onChange);
  const saveRef = useRef(onSave);
  const valueRef = useRef(value);
  const applyingExternalValueRef = useRef(false);

  useEffect(() => {
    changeRef.current = onChange;
    saveRef.current = onSave;
    valueRef.current = value;
  }, [onChange, onSave, value]);

  useEffect(() => {
    if (!hostRef.current) return;
    const saveKeymap: Extension = Prec.high(keymap.of([
      { key: "Escape", run: temporarilySetTabFocusMode },
      { key: "Tab", run: acceptCompletion },
      indentWithTab,
      {
        key: "Mod-s",
        preventDefault: true,
        run: () => {
          saveRef.current?.();
          return true;
        },
      },
    ]));
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: valueRef.current,
        extensions: [
          basicSetup,
          lightEditor ? lineNumbers({ formatNumber: (line) => String(line + lineNumberStart - 1) }) : [],
          isPython ? python() : javascript({ jsx: /\.[jt]sx$/.test(path), typescript: /\.tsx?$/.test(path) }),
          saveKeymap,
          lightEditor ? lessonTheme : latentTheme,
          syntaxHighlighting(lightEditor ? lessonSyntaxTheme : syntaxTheme),
          EditorState.tabSize.of(isPython ? 4 : 2),
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !applyingExternalValueRef.current) {
              changeRef.current(update.state.doc.toString());
            }
          }),
          EditorView.contentAttributes.of({
            "aria-label": ariaLabel ?? `Project file editor: ${path}`,
            "aria-describedby": instructionId,
            spellcheck: "false",
            autocapitalize: "off",
            autocomplete: "off",
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Recreate the language mode when the selected path changes.
  }, [ariaLabel, instructionId, isPython, lightEditor, lineNumberStart, path, readOnly, variant]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    applyingExternalValueRef.current = true;
    try {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    } finally {
      applyingExternalValueRef.current = false;
    }
  }, [value]);

  return (
    <>
      <div
        className={variant === "lesson" ? "code-editor lesson-code-editor" : variant === "workbook" ? "code-editor workbook-code-editor" : "code-editor"}
        ref={hostRef}
        style={variant === "lesson" ? { height: `${Math.max(7.25, Math.min(23, value.split("\n").length * 1.5 + 2.5))}rem` } : undefined}
      />
      <span className="sr-only" id={instructionId}>
        {readOnly ? readOnlyEditorInstruction : editableEditorInstruction}
      </span>
    </>
  );
}
