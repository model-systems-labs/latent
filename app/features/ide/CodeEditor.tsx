"use client";

import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";

type CodeEditorProps = {
  value: string;
  path: string;
  onChange: (value: string) => void;
  onSave?: () => void;
};

const latentTheme = EditorView.theme({
  "&": {
    height: "100%",
    minHeight: "420px",
    color: "#eeeaf0",
    backgroundColor: "#1f1e21",
    fontSize: "13px",
  },
  ".cm-content": {
    padding: "18px 0 56px",
    caretColor: "#d9b98c",
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
    lineHeight: "1.72",
  },
  ".cm-line": { padding: "0 22px 0 10px" },
  ".cm-gutters": {
    backgroundColor: "#1f1e21",
    color: "#6f6a73",
    borderRight: "1px solid rgba(255,255,255,.055)",
    paddingLeft: "8px",
  },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "rgba(191,169,214,.065)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(181,151,209,.24)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#e4c79e" },
  ".cm-scroller": { overflow: "auto" },
  "&.cm-focused": { outline: "none" },
}, { dark: true });

const syntaxTheme = EditorView.baseTheme({
  ".tok-keyword": { color: "#cab1df" },
  ".tok-string": { color: "#d7bd8f" },
  ".tok-number, .tok-bool, .tok-null": { color: "#b3cee4" },
  ".tok-comment": { color: "#77727b", fontStyle: "italic" },
  ".tok-variableName": { color: "#ddd8e0" },
});

export function CodeEditor({ value, path, onChange, onSave }: CodeEditorProps) {
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
    const saveKeymap: Extension = keymap.of([
      indentWithTab,
      {
        key: "Mod-s",
        preventDefault: true,
        run: () => {
          saveRef.current?.();
          return true;
        },
      },
    ]);
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: valueRef.current,
        extensions: [
          basicSetup,
          javascript({ jsx: /\.[jt]sx$/.test(path), typescript: /\.tsx?$/.test(path) }),
          saveKeymap,
          latentTheme,
          syntaxTheme,
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) changeRef.current(update.state.doc.toString());
          }),
          EditorView.contentAttributes.of({
            "aria-label": `Project file editor: ${path}`,
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
  }, [path]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  return <div className="code-editor" ref={hostRef} />;
}
