"use client";

import { useEffect, useId, useRef } from "react";
import { basicSetup } from "codemirror";
import { indentWithTab, temporarilySetTabFocusMode } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";

type PythonCodeEditorProps = {
  value: string;
  path: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
};

const pythonEditorPalette = {
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

const pythonEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: pythonEditorPalette.background,
    color: pythonEditorPalette.foreground,
    fontSize: "14px",
    height: "100%",
    minHeight: "420px",
  },
  ".cm-content": {
    caretColor: "#d9b98c",
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
    lineHeight: "1.72",
    padding: "18px 0 56px",
  },
  ".cm-line": { padding: "0 22px 0 10px" },
  ".cm-gutters": {
    backgroundColor: pythonEditorPalette.background,
    borderRight: "1px solid rgba(255,255,255,.055)",
    color: pythonEditorPalette.gutter,
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

const pythonSyntaxTheme = HighlightStyle.define([
  { tag: tags.keyword, color: pythonEditorPalette.keyword, fontWeight: "600" },
  { tag: [tags.string, tags.regexp, tags.escape], color: pythonEditorPalette.string },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: pythonEditorPalette.number },
  { tag: tags.comment, color: pythonEditorPalette.comment, fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.labelName], color: pythonEditorPalette.function },
  { tag: [tags.definition(tags.variableName), tags.className, tags.typeName], color: pythonEditorPalette.type },
  { tag: [tags.propertyName, tags.attributeName], color: pythonEditorPalette.property },
  { tag: [tags.variableName, tags.name], color: pythonEditorPalette.variable },
  { tag: tags.operator, color: pythonEditorPalette.operator },
  { tag: tags.punctuation, color: pythonEditorPalette.punctuation },
  { tag: tags.invalid, color: pythonEditorPalette.invalid, textDecoration: "underline wavy" },
]);

export function PythonCodeEditor({ value, path, onChange, onSave, readOnly = false }: PythonCodeEditorProps) {
  const instructionId = useId();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const changeRef = useRef(onChange);
  const saveRef = useRef(onSave);
  const valueRef = useRef(value);

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
          python(),
          saveKeymap,
          pythonEditorTheme,
          syntaxHighlighting(pythonSyntaxTheme),
          EditorState.tabSize.of(4),
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) changeRef.current(update.state.doc.toString());
          }),
          EditorView.contentAttributes.of({
            "aria-label": `Python project file editor: ${path}`,
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
  }, [instructionId, path, readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  return (
    <>
      <div className="code-editor python-code-editor" ref={hostRef} />
      <span className="sr-only" id={instructionId}>Python code editor. Tab indents four spaces. Press Escape, then Tab, to leave the editor.</span>
    </>
  );
}
