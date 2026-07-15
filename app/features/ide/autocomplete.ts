import { autocompletion, type Completion, type CompletionSource } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { pythonLanguage } from "@codemirror/lang-python";
import { EditorView } from "@codemirror/view";

const pythonKeywordLabels = [
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "case",
  "continue",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "global",
  "in",
  "is",
  "lambda",
  "match",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "with",
  "yield",
] as const;

export const PYTHON_KEYWORD_COMPLETIONS: readonly Completion[] = pythonKeywordLabels.map((label) => ({
  label,
  detail: "Python keyword",
  type: "keyword",
}));

export const NUMPY_COMPLETIONS: readonly Completion[] = [
  { label: "all", type: "function" },
  { label: "asarray", type: "function" },
  { label: "clip", type: "function" },
  { label: "dot", type: "function" },
  { label: "exp", type: "function" },
  { label: "float64", type: "type" },
  { label: "inf", type: "constant" },
  { label: "isfinite", type: "function" },
  { label: "isneginf", type: "function" },
  { label: "log", type: "function" },
  { label: "matmul", type: "function" },
  { label: "max", type: "function" },
  { label: "mean", type: "function" },
  { label: "outer", type: "function" },
  { label: "random", type: "namespace" },
  { label: "sqrt", type: "function" },
  { label: "sum", type: "function" },
  { label: "tanh", type: "function" },
  { label: "triu_indices", type: "function" },
  { label: "zeros", type: "function" },
  { label: "zeros_like", type: "function" },
].map((completion) => ({ ...completion, detail: "NumPy" }));

export const NUMPY_RANDOM_COMPLETIONS: readonly Completion[] = [
  { label: "default_rng", detail: "NumPy random", type: "function" },
];

const identifier = /^[A-Za-z_][A-Za-z_0-9]*$/;
const memberIdentifier = /^[A-Za-z_0-9]*$/;
const excludedSyntaxNodes = new Set(["Comment", "String", "FormatString"]);

function numpyAliases(source: string) {
  const aliases = new Set<string>();
  const imports = /^\s*import\s+numpy(?:\s+as\s+([A-Za-z_][A-Za-z_0-9]*))?/gm;
  for (const match of source.matchAll(imports)) aliases.add(match[1] ?? "numpy");
  return aliases;
}

function numpyCatalogForMember(source: string, memberText: string) {
  const parts = memberText.split(".");
  const prefix = parts.pop() ?? "";
  const [base, ...path] = parts;
  if (!base || !numpyAliases(source).has(base)) return null;

  if (path.length === 0) {
    return { prefix, options: NUMPY_COMPLETIONS };
  }
  if (path.length === 1 && path[0] === "random") {
    return { prefix, options: NUMPY_RANDOM_COMPLETIONS };
  }
  return null;
}

/**
 * Adds the course vocabulary that CodeMirror's Python package cannot infer.
 * Native CodeMirror sources continue to provide built-ins, snippets, and
 * names defined in the current scope.
 */
export const pythonCourseCompletionSource: CompletionSource = (context) => {
  const inner = syntaxTree(context.state).resolveInner(context.pos, -1);
  if (excludedSyntaxNodes.has(inner.name)) return null;

  const member = context.matchBefore(/[A-Za-z_][A-Za-z_0-9]*(?:\.[A-Za-z_][A-Za-z_0-9]*)*\.[A-Za-z_0-9]*$/);
  if (member) {
    const catalog = numpyCatalogForMember(context.state.doc.toString(), member.text);
    if (!catalog) return null;
    return {
      from: context.pos - catalog.prefix.length,
      options: catalog.options,
      validFor: memberIdentifier,
    };
  }

  const word = context.matchBefore(/[A-Za-z_][A-Za-z_0-9]*$/);
  if (!word && !context.explicit) return null;
  return {
    from: word?.from ?? context.pos,
    options: PYTHON_KEYWORD_COMPLETIONS,
    validFor: identifier,
  };
};

export const pythonCourseCompletions = pythonLanguage.data.of({
  autocomplete: pythonCourseCompletionSource,
});

// Prefer the code side of the cursor so the popup cannot cover the IDE footer
// on a short mobile viewport. CodeMirror falls back below when there is not
// enough space above.
export const editorAutocompleteBehavior = autocompletion({ aboveCursor: true });

export const editorAutocompleteTheme = EditorView.theme({
  ".cm-tooltip-autocomplete": {
    backgroundColor: "#2a282d",
    border: "1px solid rgba(221, 189, 242, 0.26)",
    borderRadius: "0.65rem",
    boxShadow: "0 18px 48px rgba(10, 8, 12, 0.32)",
    color: "#f0ebf2",
    maxWidth: "min(30rem, calc(100vw - 1.5rem))",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete > ul": {
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
    maxHeight: "min(18rem, 35vh)",
    maxWidth: "min(30rem, calc(100vw - 1.5rem))",
    minWidth: "min(15rem, calc(100vw - 1.5rem))",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    alignItems: "center",
    display: "flex",
    minHeight: "2.75rem",
    padding: "0.45rem 0.7rem",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "#51435f",
    color: "#ffffff",
  },
  ".cm-completionIcon": {
    flex: "0 0 auto",
    opacity: "0.78",
  },
  ".cm-completionLabel": {
    color: "#f0ebf2",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  ".cm-completionMatchedText": {
    color: "#ffffff",
    fontWeight: "700",
    textDecoration: "none",
  },
  ".cm-completionDetail": {
    color: "#bdb4c0",
    fontStyle: "normal",
    marginLeft: "auto",
    paddingLeft: "1rem",
  },
  "&.cm-focused .cm-tooltip-autocomplete > ul > li[aria-selected]": {
    outline: "1px solid rgba(240, 235, 242, 0.55)",
    outlineOffset: "-1px",
  },
  "@media (forced-colors: active)": {
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      outline: "2px solid HighlightText",
      outlineOffset: "-2px",
    },
  },
  "@media (max-width: 650px)": {
    ".cm-tooltip-autocomplete > ul": {
      maxHeight: "min(11rem, 35vh)",
    },
  },
}, { dark: true });
