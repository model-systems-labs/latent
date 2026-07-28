/// <reference lib="dom" />

import {
  acceptCompletion,
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  temporarilySetTabFocusMode,
} from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import {
  HighlightStyle,
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { lintKeymap } from "@codemirror/lint";
import {
  highlightSelectionMatches,
  searchKeymap,
} from "@codemirror/search";
import {
  Compartment,
  EditorState,
  Prec,
  type Extension,
} from "@codemirror/state";
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

export const LEARNER_CODE_EDITOR_VERSION = 1 as const;

/**
 * CodeMirror installs its generated theme rules in a style element. Standalone
 * static learners allow only this reviewed style module, using the matching
 * source in their style-src directive.
 */
export const LEARNER_CODE_EDITOR_CSP_NONCE =
  "latent-learner-code-editor-v1" as const;
export const LEARNER_CODE_EDITOR_CSP_SOURCE =
  `'nonce-${LEARNER_CODE_EDITOR_CSP_NONCE}'` as const;
export const learnerCodeEditorCspNonce =
  EditorView.cspNonce.of(LEARNER_CODE_EDITOR_CSP_NONCE);

export type LearnerCodeEditorLanguage =
  | "javascript"
  | "jsx"
  | "python"
  | "text"
  | "tsx"
  | "typescript";

export type LearnerCodeEditorVariant =
  | "integrated"
  | "workspace-dark";

export type LearnerCodeEditorRunMode = "check" | "examples";

export type LearnerCodeEditorOptions = {
  language: LearnerCodeEditorLanguage;
  tabSize?: number;
  variant?: LearnerCodeEditorVariant;
  disabled?: boolean;
  readOnly?: boolean;
  lineNumberStart?: number;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  onChange?: (value: string) => void;
  onRun?: (mode: LearnerCodeEditorRunMode) => void;
  runModes?: readonly LearnerCodeEditorRunMode[];
  onSave?: () => void;
};

export type LearnerCodeEditorController = {
  readonly host: HTMLElement;
  focus(): void;
  setValue(value: string): void;
  setDisabled(disabled: boolean): void;
  destroy(): void;
};

const integratedTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--learner-code-surface, #fbfaf8)",
    color: "var(--learner-code-text, #292623)",
    fontSize: ".875rem",
    height: "100%",
    minHeight: "var(--learner-editor-min-height, 18rem)",
  },
  ".cm-content": {
    caretColor: "var(--learner-code-caret, #4f5e96)",
    cursor: "text",
    fontFamily:
      'var(--learner-font-mono, "SFMono-Regular", Consolas, "Liberation Mono", monospace)',
    lineHeight: "1.65",
    padding: "var(--learner-space-4, 1rem) 0",
    userSelect: "text",
    WebkitUserSelect: "text",
  },
  ".cm-line": {
    padding:
      "0 var(--learner-space-4, 1rem) 0 var(--learner-space-3, .75rem)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--learner-code-gutter-surface, #f3f0eb)",
    borderRight: "1px solid var(--learner-color-border, #ded8cf)",
    color: "var(--learner-code-muted, #69635d)",
    paddingLeft: "var(--learner-space-2, .5rem)",
  },
  ".cm-foldGutter": {
    display: "none",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--learner-code-active-line, #f0edf4)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--learner-code-active-line, #f0edf4)",
    color: "var(--learner-code-keyword, #4f5e96)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "var(--learner-code-selection, #dedbea)",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "var(--learner-code-selection, #dedbea)",
  },
  ".cm-selectionMatch": {
    backgroundColor: "var(--learner-code-selection, #dedbea)",
    outline:
      "1px solid color-mix(in srgb, var(--learner-color-accent, #6576b4) 36%, transparent)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--learner-code-caret, #4f5e96)",
  },
  ".cm-scroller": {
    minHeight: "0",
    overflow: "auto",
    overscrollBehaviorX: "contain",
    overscrollBehaviorY: "auto",
    scrollbarColor:
      "var(--learner-color-border, #ded8cf) transparent",
    scrollbarWidth: "thin",
  },
  ".cm-matchingBracket": {
    backgroundColor: "var(--learner-code-selection, #dedbea)",
    outline:
      "1px solid color-mix(in srgb, var(--learner-color-accent, #6576b4) 55%, var(--learner-color-border, #ded8cf))",
  },
  "&.cm-focused": {
    outline: "3px solid var(--learner-color-focus, #3159b7)",
    outlineOffset: "-3px",
  },
}, { dark: false });

const workspaceDarkTheme = EditorView.theme({
  "&": {
    backgroundColor: "#1f1e21",
    color: "#f0ebf2",
    fontSize: "14px",
    height: "100%",
    minHeight: "var(--learner-editor-min-height, 420px)",
  },
  ".cm-content": {
    caretColor: "#d9b98c",
    cursor: "text",
    fontFamily:
      'var(--learner-font-mono, "SFMono-Regular", Consolas, "Liberation Mono", monospace)',
    lineHeight: "1.72",
    padding: "18px 0 56px",
    userSelect: "text",
    WebkitUserSelect: "text",
  },
  ".cm-line": {
    padding: "0 22px 0 10px",
  },
  ".cm-gutters": {
    backgroundColor: "#1f1e21",
    borderRight: "1px solid rgba(255,255,255,.055)",
    color: "#9a939d",
    paddingLeft: "8px",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "rgba(191,169,214,.065)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "rgba(181,151,209,.20)",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "rgba(181,151,209,.20)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#e4c79e",
  },
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

const integratedSyntaxTheme = HighlightStyle.define([
  {
    tag: tags.keyword,
    color: "var(--learner-code-keyword, #4f5e96)",
    fontWeight: "600",
  },
  {
    tag: [tags.string, tags.regexp, tags.escape],
    color: "var(--learner-code-string, #7b4b1f)",
  },
  {
    tag: [tags.number, tags.bool, tags.null, tags.atom],
    color: "var(--learner-code-number, #1d6174)",
  },
  {
    tag: tags.comment,
    color: "var(--learner-code-muted, #69635d)",
    fontStyle: "italic",
  },
  {
    tag: [tags.function(tags.variableName), tags.labelName],
    color: "var(--learner-code-function, #2c5f78)",
  },
  {
    tag: [tags.definition(tags.variableName), tags.className, tags.typeName],
    color: "var(--learner-code-type, #67456e)",
  },
  {
    tag: [tags.propertyName, tags.attributeName],
    color: "var(--learner-code-property, #3f5969)",
  },
  {
    tag: [tags.variableName, tags.name],
    color: "var(--learner-code-text, #292623)",
  },
  {
    tag: tags.operator,
    color: "var(--learner-code-operator, #684c6e)",
  },
  {
    tag: tags.punctuation,
    color: "var(--learner-code-muted, #69635d)",
  },
  {
    tag: tags.invalid,
    color: "var(--learner-code-invalid, #915955)",
    textDecoration: "underline wavy",
  },
]);

const workspaceDarkSyntaxTheme = HighlightStyle.define([
  { tag: tags.keyword, color: "#ddbdf2", fontWeight: "600" },
  { tag: [tags.string, tags.regexp, tags.escape], color: "#e6c99e" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "#a9d6ef" },
  { tag: tags.comment, color: "#aaa3ad", fontStyle: "italic" },
  {
    tag: [tags.function(tags.variableName), tags.labelName],
    color: "#bed7ee",
  },
  {
    tag: [tags.definition(tags.variableName), tags.className, tags.typeName],
    color: "#d5c3ea",
  },
  { tag: [tags.propertyName, tags.attributeName], color: "#b9cfdf" },
  { tag: [tags.variableName, tags.name], color: "#ece7ef" },
  { tag: tags.operator, color: "#d8c7e3" },
  { tag: tags.punctuation, color: "#beb6c2" },
  {
    tag: tags.invalid,
    color: "#ffb4ad",
    textDecoration: "underline wavy",
  },
]);

function normalizedLanguage(
  language: LearnerCodeEditorLanguage,
): LearnerCodeEditorLanguage {
  if (
    language !== "javascript"
    && language !== "jsx"
    && language !== "python"
    && language !== "text"
    && language !== "tsx"
    && language !== "typescript"
  ) {
    throw new Error(`Unsupported learner code editor language: ${String(language)}`);
  }
  return language;
}

function normalizedVariant(
  variant: LearnerCodeEditorVariant | undefined,
): LearnerCodeEditorVariant {
  const resolved = variant ?? "integrated";
  if (resolved !== "integrated" && resolved !== "workspace-dark") {
    throw new Error(`Unsupported learner code editor variant: ${String(variant)}`);
  }
  return resolved;
}

function normalizedTabSize(
  tabSize: number | undefined,
  language: LearnerCodeEditorLanguage,
) {
  const resolved = tabSize ?? (language === "python" ? 4 : 2);
  if (!Number.isInteger(resolved) || resolved < 1 || resolved > 8) {
    throw new Error("Learner code editor tabSize must be an integer from 1 to 8.");
  }
  return resolved;
}

function normalizedRunModes(
  options: LearnerCodeEditorOptions,
): readonly LearnerCodeEditorRunMode[] {
  if (!options.onRun) return [];
  const modes = options.runModes ?? ["examples", "check"];
  if (
    !Array.isArray(modes)
    || modes.length === 0
    || modes.length > 2
    || modes.some((mode) => mode !== "examples" && mode !== "check")
    || new Set(modes).size !== modes.length
  ) {
    throw new Error(
      "Learner code editor runModes must contain unique examples and/or check modes.",
    );
  }
  return modes;
}

function languageExtension(language: LearnerCodeEditorLanguage): Extension {
  if (language === "python") return python();
  if (language === "text") return [];
  return javascript({
    jsx: language === "jsx" || language === "tsx",
    typescript: language === "typescript" || language === "tsx",
  });
}

function normalizedLineNumberStart(value: number | undefined) {
  const resolved = value ?? 1;
  if (
    !Number.isInteger(resolved)
    || resolved < 1
    || resolved > 1_000_000
  ) {
    throw new Error(
      "Learner code editor lineNumberStart must be an integer from 1 to 1000000.",
    );
  }
  return resolved;
}

function learnerEditorSetup(lineNumberStart: number): Extension[] {
  return [
    lineNumbers({
      formatNumber: (line) => String(line + lineNumberStart - 1),
    }),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      ...lintKeymap,
    ]),
  ];
}

function keyboardExtensions(
  options: LearnerCodeEditorOptions,
): Extension {
  const runModes = normalizedRunModes(options);
  return Prec.high(keymap.of([
    { key: "Escape", run: temporarilySetTabFocusMode },
    { key: "Tab", run: acceptCompletion },
    indentWithTab,
    ...(options.onSave
      ? [{
          key: "Mod-s",
          preventDefault: true,
          run: () => {
            options.onSave?.();
            return true;
          },
        }]
      : []),
    ...(runModes.includes("examples")
      ? [
          {
            key: "Mod-Shift-Enter",
            preventDefault: true,
            run: () => {
              options.onRun?.("examples");
              return true;
            },
          },
        ]
      : []),
    ...(runModes.includes("check")
      ? [
          {
            key: "Mod-Enter",
            preventDefault: true,
            run: () => {
              options.onRun?.("check");
              return true;
            },
          },
        ]
      : []),
  ]));
}

function accessibilityAttributes(
  options: LearnerCodeEditorOptions,
  disabled: boolean,
  readOnly: boolean,
): Record<string, string> {
  const runModes = normalizedRunModes(options);
  const shortcuts = [
    "Tab",
    "Shift+Tab",
    "Escape",
    ...(options.onSave ? ["Control+S", "Meta+S"] : []),
    ...(runModes.includes("check")
      ? [
          "Control+Enter",
          "Meta+Enter",
        ]
      : []),
    ...(runModes.includes("examples")
      ? [
          "Control+Shift+Enter",
          "Meta+Shift+Enter",
        ]
      : []),
  ];
  return {
    "aria-label": options.ariaLabel ?? "Code editor",
    ...(options.ariaDescribedBy
      ? { "aria-describedby": options.ariaDescribedBy }
      : {}),
    "aria-keyshortcuts": shortcuts.join(" "),
    "aria-multiline": "true",
    ...(disabled ? { "aria-disabled": "true", tabindex: "-1" } : {}),
    ...(readOnly ? { "aria-readonly": "true" } : {}),
    autocapitalize: "off",
    autocomplete: "off",
    spellcheck: "false",
  };
}

type ExtensionOverrides = {
  editable?: Extension;
  accessibility?: Extension;
};

function editorExtensions(
  options: LearnerCodeEditorOptions,
  overrides: ExtensionOverrides = {},
): Extension[] {
  const language = normalizedLanguage(options.language);
  const variant = normalizedVariant(options.variant);
  const tabSize = normalizedTabSize(options.tabSize, language);
  const disabled = Boolean(options.disabled);
  const readOnly = Boolean(options.readOnly);
  const lineNumberStart = normalizedLineNumberStart(
    options.lineNumberStart,
  );
  return [
    ...learnerEditorSetup(lineNumberStart),
    languageExtension(language),
    keyboardExtensions(options),
    variant === "workspace-dark" ? workspaceDarkTheme : integratedTheme,
    syntaxHighlighting(
      variant === "workspace-dark"
        ? workspaceDarkSyntaxTheme
        : integratedSyntaxTheme,
    ),
    indentUnit.of(" ".repeat(tabSize)),
    EditorState.tabSize.of(tabSize),
    learnerCodeEditorCspNonce,
    overrides.editable ?? [
      EditorState.readOnly.of(disabled || readOnly),
      EditorView.editable.of(!disabled && !readOnly),
    ],
    overrides.accessibility ?? EditorView.contentAttributes.of(
      accessibilityAttributes(options, disabled, readOnly),
    ),
    ...(options.onChange
      ? [EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            options.onChange?.(update.state.doc.toString());
          }
        })]
      : []),
  ];
}

/**
 * Returns the complete framework-neutral editor contract used by React and
 * standalone learners. Hosts provide only state synchronization and actions.
 */
export function createLearnerCodeEditorExtensions(
  options: LearnerCodeEditorOptions,
): readonly Extension[] {
  return editorExtensions(options);
}

const enhancedTextareas =
  new WeakMap<HTMLTextAreaElement, LearnerCodeEditorController>();

/**
 * Progressively replaces a mounted textarea with CodeMirror while retaining
 * the textarea as the form- and event-compatible source of truth.
 */
export function enhanceLearnerCodeEditorTextarea(
  textarea: HTMLTextAreaElement,
  requestedOptions: LearnerCodeEditorOptions,
): LearnerCodeEditorController {
  const TextareaConstructor =
    textarea?.ownerDocument?.defaultView?.HTMLTextAreaElement;
  if (!TextareaConstructor || !(textarea instanceof TextareaConstructor)) {
    throw new Error("The learner code editor requires a textarea.");
  }
  if (!textarea.parentNode) {
    throw new Error("The learner code editor requires a mounted textarea.");
  }
  enhancedTextareas.get(textarea)?.destroy();

  const originalHidden = textarea.hidden;
  const originalDisabled = textarea.disabled;
  const originalReadOnly = textarea.readOnly;
  const language = normalizedLanguage(requestedOptions.language);
  const variant = normalizedVariant(requestedOptions.variant);
  const tabSize = normalizedTabSize(requestedOptions.tabSize, language);
  const options: LearnerCodeEditorOptions = {
    ...requestedOptions,
    language,
    variant,
    tabSize,
    disabled: requestedOptions.disabled ?? textarea.disabled,
    readOnly: requestedOptions.readOnly ?? textarea.readOnly,
    ariaLabel:
      requestedOptions.ariaLabel
      ?? textarea.getAttribute("aria-label")
      ?? "Code editor",
    ariaDescribedBy:
      requestedOptions.ariaDescribedBy
      ?? textarea.getAttribute("aria-describedby")
      ?? undefined,
  };

  const host = textarea.ownerDocument.createElement("div");
  host.className = "learner-code-editor learner-code-editor-host";
  host.dataset.language = language;
  host.dataset.variant = variant;
  textarea.parentNode.insertBefore(host, textarea);
  textarea.hidden = true;

  const editableCompartment = new Compartment();
  const accessibilityCompartment = new Compartment();
  let disabled = Boolean(options.disabled);
  const readOnly = Boolean(options.readOnly);
  let applyingExternalValue = false;
  let syncingTextarea = false;
  let destroyed = false;

  const editableExtension = () => [
    EditorState.readOnly.of(disabled || readOnly),
    EditorView.editable.of(!disabled && !readOnly),
  ];
  const accessibilityExtension = () => EditorView.contentAttributes.of(
    accessibilityAttributes(options, disabled, readOnly),
  );
  const syncTextarea = (value: string) => {
    textarea.value = value;
    syncingTextarea = true;
    try {
      const EventConstructor =
        textarea.ownerDocument.defaultView?.Event ?? Event;
      textarea.dispatchEvent(new EventConstructor("input", { bubbles: true }));
    } finally {
      syncingTextarea = false;
    }
    options.onChange?.(value);
  };

  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: textarea.value,
      extensions: [
        ...editorExtensions(
          { ...options, onChange: undefined },
          {
            editable: editableCompartment.of(editableExtension()),
            accessibility: accessibilityCompartment.of(
              accessibilityExtension(),
            ),
          },
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !applyingExternalValue) {
            syncTextarea(update.state.doc.toString());
          }
        }),
      ],
    }),
  });

  const applyExternalTextareaValue = () => {
    if (syncingTextarea || destroyed) return;
    const current = view.state.doc.toString();
    if (current === textarea.value) return;
    applyingExternalValue = true;
    try {
      view.dispatch({
        changes: {
          from: 0,
          to: current.length,
          insert: textarea.value,
        },
      });
    } finally {
      applyingExternalValue = false;
    }
  };
  textarea.addEventListener("input", applyExternalTextareaValue);

  const controller: LearnerCodeEditorController = {
    host,
    focus() {
      if (!destroyed && !disabled) view.focus();
    },
    setValue(value) {
      if (destroyed) return;
      const current = view.state.doc.toString();
      textarea.value = value;
      if (current === value) return;
      applyingExternalValue = true;
      try {
        view.dispatch({
          changes: {
            from: 0,
            to: current.length,
            insert: value,
          },
        });
      } finally {
        applyingExternalValue = false;
      }
    },
    setDisabled(nextDisabled) {
      if (destroyed || disabled === Boolean(nextDisabled)) return;
      disabled = Boolean(nextDisabled);
      textarea.disabled = disabled;
      host.dataset.disabled = String(disabled);
      view.dispatch({
        effects: [
          editableCompartment.reconfigure(editableExtension()),
          accessibilityCompartment.reconfigure(accessibilityExtension()),
        ],
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      textarea.removeEventListener("input", applyExternalTextareaValue);
      view.destroy();
      host.remove();
      textarea.hidden = originalHidden;
      textarea.disabled = originalDisabled;
      textarea.readOnly = originalReadOnly;
      enhancedTextareas.delete(textarea);
    },
  };
  textarea.disabled = disabled;
  textarea.readOnly = readOnly;
  host.dataset.disabled = String(disabled);
  enhancedTextareas.set(textarea, controller);
  return controller;
}
