import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CompletionContext } from "@codemirror/autocomplete";
import { python } from "@codemirror/lang-python";
import { EditorState } from "@codemirror/state";
import * as esbuild from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
let outputDirectory;
let pythonRuntimeCompletionSource;

before(async () => {
  outputDirectory = await mkdtemp(join(root, ".python-completions-test-"));
  const output = join(outputDirectory, "python-runtime-completions.mjs");
  await esbuild.build({
    entryPoints: [join(root, "app/features/ide/python-runtime-completions.ts")],
    outfile: output,
    bundle: true,
    packages: "external",
    platform: "node",
    format: "esm",
    target: "node22",
  });
  ({ pythonRuntimeCompletionSource } = await import(`${pathToFileURL(output).href}?test=${Date.now()}`));
});

after(async () => {
  if (outputDirectory) await rm(outputDirectory, { recursive: true, force: true });
});

function completionResult(doc, explicit = false) {
  const state = EditorState.create({ doc, extensions: [python()] });
  return pythonRuntimeCompletionSource(new CompletionContext(state, doc.length, explicit));
}

function labelsFor(doc, explicit = false) {
  return completionResult(doc, explicit)?.options.map((option) => option.label) ?? [];
}

test("Python runtime completions cover stdlib collections and Sorted Containers imports", () => {
  assert.ok(labelsFor("from collections import defau").includes("defaultdict"));
  assert.ok(labelsFor("collections.").includes("defaultdict"));
  assert.ok(labelsFor("from sortedcontainers import Sorted").includes("SortedSet"));
  assert.ok(labelsFor("sortedcontainers.").includes("SortedSet"));
  assert.ok(labelsFor("import sorted").includes("sortedcontainers"));
  assert.deepEqual(labelsFor("\"collections.\""), []);
});

test("a bare runtime type completion adds its import after the module header", () => {
  const doc = "\"\"\"Example module.\"\"\"\nfrom __future__ import annotations\n\nvalues = SortedS";
  const state = EditorState.create({ doc, extensions: [python()] });
  const context = new CompletionContext(state, doc.length, false);
  const completion = pythonRuntimeCompletionSource(context).options.find((option) => option.label === "SortedSet");
  assert.equal(typeof completion?.apply, "function");

  const view = {
    state,
    dispatch(spec) {
      this.state = this.state.update(spec).state;
    },
  };
  completion.apply(view, completion, doc.lastIndexOf("SortedS"), doc.length);
  assert.equal(
    view.state.doc.toString(),
    "\"\"\"Example module.\"\"\"\nfrom __future__ import annotations\nfrom sortedcontainers import SortedSet\n\nvalues = SortedSet",
  );
});

test("auto-import completion does not duplicate an existing direct import", () => {
  const doc = "from collections import defaultdict\n\ncounts = defau";
  const state = EditorState.create({ doc, extensions: [python()] });
  const context = new CompletionContext(state, doc.length, false);
  const completion = pythonRuntimeCompletionSource(context).options.find((option) => option.label === "defaultdict");
  const view = {
    state,
    dispatch(spec) {
      this.state = this.state.update(spec).state;
    },
  };
  completion.apply(view, completion, doc.lastIndexOf("defau"), doc.length);
  assert.equal(
    view.state.doc.toString(),
    "from collections import defaultdict\n\ncounts = defaultdict",
  );
});
