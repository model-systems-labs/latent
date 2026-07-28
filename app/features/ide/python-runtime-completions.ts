import {
  pickedCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { pythonLanguage } from "@codemirror/lang-python";
import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";

type PythonRuntimeModule = "collections" | "sortedcontainers";

const COLLECTION_COMPLETIONS = [
  { label: "ChainMap", type: "class", info: "Groups multiple mappings into one updatable view." },
  { label: "Counter", type: "class", info: "Counts hashable values." },
  { label: "OrderedDict", type: "class", info: "A dictionary with ordering-specific operations." },
  { label: "UserDict", type: "class", info: "A wrapper that simplifies custom dictionary types." },
  { label: "UserList", type: "class", info: "A wrapper that simplifies custom list types." },
  { label: "UserString", type: "class", info: "A wrapper that simplifies custom string types." },
  { label: "defaultdict", type: "class", info: "Creates missing values with a default factory." },
  { label: "deque", type: "class", info: "A fast double-ended queue." },
  { label: "namedtuple", type: "function", info: "Creates tuple subclasses with named fields." },
] as const satisfies readonly Completion[];

const SORTED_CONTAINER_COMPLETIONS = [
  { label: "SortedDict", type: "class", info: "A dictionary that keeps its keys sorted." },
  { label: "SortedKeyList", type: "class", info: "A sorted list ordered by a key function." },
  { label: "SortedList", type: "class", info: "A list that keeps its values sorted." },
  { label: "SortedListWithKey", type: "class", info: "Compatibility alias for SortedKeyList." },
  { label: "SortedSet", type: "class", info: "A mutable set that iterates in sorted order." },
] as const satisfies readonly Completion[];

const MODULE_COMPLETIONS = [
  {
    label: "collections",
    type: "namespace",
    detail: "Python standard library",
    info: "Specialized container data types included with CPython.",
  },
  {
    label: "numpy",
    type: "namespace",
    detail: "Pyodide package",
    info: "The curated NumPy package included in Latent's Python runtime.",
  },
  {
    label: "sortedcontainers",
    type: "namespace",
    detail: "Pyodide package",
    info: "SortedList, SortedDict, and SortedSet from Sorted Containers 2.4.0.",
  },
] as const satisfies readonly Completion[];

const MEMBERS_BY_MODULE: Readonly<Record<PythonRuntimeModule, readonly Completion[]>> = {
  collections: COLLECTION_COMPLETIONS,
  sortedcontainers: SORTED_CONTAINER_COMPLETIONS,
};

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const VALID_IDENTIFIER_PREFIX = /^(?:[A-Za-z_][A-Za-z0-9_]*)?$/;
const COMPLETION_BLOCKED_NODES = new Set(["Comment", "FormatString", "String"]);

function escapedRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function alreadyImportsName(source: string, moduleName: PythonRuntimeModule, name: string): boolean {
  const importPattern = new RegExp(`^\\s*from\\s+${escapedRegExp(moduleName)}\\s+import\\s+([^#\\n]+)`, "gm");
  for (const match of source.matchAll(importPattern)) {
    const imports = match[1].replace(/[()]/g, "").split(",");
    if (imports.some((item) => {
      const parts = item.trim().split(/\s+as\s+/);
      return parts[0] === "*" || (parts[0] === name && (parts.length === 1 || parts[1] === name));
    })) return true;
  }
  return false;
}

function endOfLineWithBreak(state: EditorState, position: number): number {
  const line = state.doc.lineAt(position);
  return line.to < state.doc.length ? line.to + 1 : line.to;
}

function importInsertionPosition(state: EditorState): number {
  let position = 0;
  let canAcceptDocstring = true;
  for (let node = syntaxTree(state).topNode.firstChild; node; node = node.nextSibling) {
    if (node.name === "Comment") {
      position = endOfLineWithBreak(state, node.to);
      continue;
    }
    if (canAcceptDocstring && node.name === "ExpressionStatement" && node.getChild("String")) {
      position = endOfLineWithBreak(state, node.to);
      canAcceptDocstring = false;
      continue;
    }
    canAcceptDocstring = false;
    if (node.name === "ImportStatement") {
      position = endOfLineWithBreak(state, node.to);
      continue;
    }
    break;
  }
  return position;
}

function autoImport(moduleName: PythonRuntimeModule, name: string): Completion["apply"] {
  return (view, completion, from, to) => {
    const source = view.state.doc.toString();
    if (alreadyImportsName(source, moduleName, name)) {
      view.dispatch({
        changes: { from, to, insert: name },
        selection: { anchor: from + name.length },
        annotations: pickedCompletion.of(completion),
      });
      return;
    }

    const importAt = importInsertionPosition(view.state);
    const needsLeadingBreak = importAt > 0 && view.state.doc.sliceString(importAt - 1, importAt) !== "\n";
    const importText = `${needsLeadingBreak ? "\n" : ""}from ${moduleName} import ${name}\n`;

    if (importAt === from) {
      view.dispatch({
        changes: { from, to, insert: `${importText}${name}` },
        selection: { anchor: from + importText.length + name.length },
        annotations: pickedCompletion.of(completion),
      });
      return;
    }

    const replacement = { from, to, insert: name };
    const importChange = { from: importAt, to: importAt, insert: importText };
    view.dispatch({
      changes: importAt < from ? [importChange, replacement] : [replacement, importChange],
      selection: { anchor: from + name.length + (importAt < from ? importText.length : 0) },
      annotations: pickedCompletion.of(completion),
    });
  };
}

function moduleMembers(moduleName: PythonRuntimeModule, autoImportNames: boolean): readonly Completion[] {
  return MEMBERS_BY_MODULE[moduleName].map((completion) => ({
    ...completion,
    detail: autoImportNames ? `auto-import from ${moduleName}` : moduleName,
    ...(autoImportNames ? { apply: autoImport(moduleName, completion.label) } : {}),
  }));
}

function result(from: number, options: readonly Completion[]): CompletionResult {
  return { from, options, validFor: VALID_IDENTIFIER_PREFIX };
}

export function pythonRuntimeCompletionSource(context: CompletionContext): CompletionResult | null {
  const inner = syntaxTree(context.state).resolveInner(context.pos, -1);
  if (COMPLETION_BLOCKED_NODES.has(inner.name)) return null;

  const line = context.state.doc.lineAt(context.pos);
  const beforeCursor = context.state.sliceDoc(line.from, context.pos);

  const fromImport = /^\s*from\s+(collections|sortedcontainers)\s+import\s+(?:[A-Za-z_][A-Za-z0-9_]*\s*,\s*)*([A-Za-z_]*)$/.exec(beforeCursor);
  if (fromImport) {
    const moduleName = fromImport[1] as PythonRuntimeModule;
    return result(context.pos - fromImport[2].length, moduleMembers(moduleName, false));
  }

  const memberAccess = /(?:^|[^A-Za-z0-9_.])(collections|sortedcontainers)\.([A-Za-z_]*)$/.exec(beforeCursor);
  if (memberAccess) {
    const moduleName = memberAccess[1] as PythonRuntimeModule;
    return result(context.pos - memberAccess[2].length, moduleMembers(moduleName, false));
  }

  const moduleImport = /^\s*(?:from|import)\s+([A-Za-z_]*)$/.exec(beforeCursor);
  if (moduleImport) return result(context.pos - moduleImport[1].length, MODULE_COMPLETIONS);

  const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*/);
  if (!word && !context.explicit) return null;
  if (word && !IDENTIFIER.test(word.text)) return null;

  return result(word?.from ?? context.pos, [
    ...moduleMembers("collections", true),
    ...moduleMembers("sortedcontainers", true),
    ...MODULE_COMPLETIONS,
  ]);
}

export const pythonRuntimeCompletions = pythonLanguage.data.of({
  autocomplete: pythonRuntimeCompletionSource,
});
