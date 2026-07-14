"use client";

import { useEffect, useId, useRef } from "react";
import { basicSetup } from "codemirror";
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
  variant?: "lesson" | "project";
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
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
    lineHeight: "1.72",
  },
  ".cm-line": { padding: "0 22px 0 10px" },
  ".cm-gutters": {
    backgroundColor: editorPalette.background,
    color: editorPalette.gutter,
    borderRight: "1px solid rgba(255,255,255,.055)",
    paddingLeft: "8px",
  },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "rgba(191,169,214,.065)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(181,151,209,.20)" },
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
    minHeight: "0",
    fontSize: "14px",
  },
  ".cm-content": {
    padding: "15px 0 20px",
    lineHeight: "1.72",
  },
  ".cm-line": { padding: "0 20px 0 10px" },
  ".cm-gutters": {
    paddingLeft: "4px",
  },
  ".cm-foldGutter": { display: "none" },
  ".cm-scroller": { minHeight: "0" },
}, { dark: true });

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

export function CodeEditor({ value, path, onChange, onSave, readOnly = false, variant = "project", ariaLabel, lineNumberStart = 1 }: CodeEditorProps) {
  const isPython = path.toLowerCase().endsWith(".py");
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
          variant === "lesson" ? lineNumbers({ formatNumber: (line) => String(line + lineNumberStart - 1) }) : [],
          isPython ? python() : javascript({ jsx: /\.[jt]sx$/.test(path), typescript: /\.tsx?$/.test(path) }),
          saveKeymap,
          latentTheme,
          variant === "lesson" ? lessonTheme : [],
          syntaxHighlighting(syntaxTheme),
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
  }, [ariaLabel, instructionId, isPython, lineNumberStart, path, readOnly, variant]);

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
        className={variant === "lesson" ? "code-editor lesson-code-editor" : "code-editor"}
        ref={hostRef}
        style={variant === "lesson" ? { height: `${Math.max(7.25, Math.min(23, value.split("\n").length * 1.5 + 2.5))}rem` } : undefined}
      />
      <span className="sr-only" id={instructionId}>Code editor. Tab indents. Press Escape, then Tab, to leave the editor.</span>
    </>
  );
}
