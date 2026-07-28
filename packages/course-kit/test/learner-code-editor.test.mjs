import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import vm from "node:vm";

import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import {
  LEARNER_CODE_EDITOR_CSP_NONCE,
  LEARNER_CODE_EDITOR_CSP_SOURCE,
  createLearnerCodeEditorExtensions,
} from "../dist/learner-code-editor.js";

const packageRoot = new URL("../", import.meta.url);
const assetUrl = new URL(
  "dist/assets/learner-code-editor.js",
  packageRoot,
);

function stateFor(language, doc, options = {}) {
  return EditorState.create({
    doc,
    extensions: createLearnerCodeEditorExtensions({
      language,
      ...options,
    }),
  });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: packageRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${command} exited ${code}\n${output}`));
    });
  });
}

test("shared editor selects exact Python, JavaScript, and TypeScript grammars", () => {
  const pythonState = stateFor(
    "python",
    "def first_echo(values):\n    return values[0] if values else None",
  );
  assert.match(
    syntaxTree(pythonState).toString(),
    /FunctionDefinition\(def,VariableName,ParamList/,
  );
  assert.match(
    syntaxTree(pythonState).toString(),
    /ConditionalExpression/,
  );
  assert.equal(pythonState.tabSize, 4);

  const javascriptState = stateFor(
    "javascript",
    "export function firstEcho(values) { return values[0] ?? null; }",
  );
  assert.match(
    syntaxTree(javascriptState).toString(),
    /ExportDeclaration\(export,FunctionDeclaration/,
  );
  assert.doesNotMatch(
    syntaxTree(javascriptState).toString(),
    /TypeAliasDeclaration/,
  );
  assert.equal(javascriptState.tabSize, 2);

  const typescriptState = stateFor(
    "typescript",
    'type Entry = { value: string };\nconst entry: Entry = { value: "x" };',
  );
  assert.match(
    syntaxTree(typescriptState).toString(),
    /TypeAliasDeclaration\(type,TypeDefinition/,
  );
  assert.match(
    syntaxTree(typescriptState).toString(),
    /TypeAnnotation/,
  );
  assert.equal(typescriptState.tabSize, 2);

  const plainTextState = stateFor(
    "text",
    "This remains editable source without a language grammar.",
  );
  assert.equal(plainTextState.tabSize, 2);
  assert.doesNotMatch(
    syntaxTree(plainTextState).toString(),
    /FunctionDefinition|TypeAliasDeclaration/,
  );
});

test("shared editor binds its generated style modules to the reviewed CSP nonce", () => {
  const state = stateFor("python", "return None");
  assert.equal(
    state.facet(EditorView.cspNonce),
    LEARNER_CODE_EDITOR_CSP_NONCE,
  );
  assert.equal(
    LEARNER_CODE_EDITOR_CSP_SOURCE,
    `'nonce-${LEARNER_CODE_EDITOR_CSP_NONCE}'`,
  );
});

test("read-only editors remain navigable while disabled editors leave the tab order", () => {
  const readOnly = stateFor("python", "return None", {
    ariaLabel: "Read-only Python example",
    readOnly: true,
  });
  assert.equal(readOnly.readOnly, true);
  assert.equal(readOnly.facet(EditorView.editable), false);
  const readOnlyAttributes = readOnly
    .facet(EditorView.contentAttributes)
    .filter((value) => typeof value !== "function")
    .reduce((attributes, value) => ({ ...attributes, ...value }), {});
  assert.equal(readOnlyAttributes["aria-readonly"], "true");
  assert.equal(readOnlyAttributes.tabindex, undefined);

  const disabled = stateFor("python", "return None", {
    ariaLabel: "Disabled Python editor",
    disabled: true,
  });
  assert.equal(disabled.readOnly, true);
  assert.equal(disabled.facet(EditorView.editable), false);
  const disabledAttributes = disabled
    .facet(EditorView.contentAttributes)
    .filter((value) => typeof value !== "function")
    .reduce((attributes, value) => ({ ...attributes, ...value }), {});
  assert.equal(disabledAttributes["aria-disabled"], "true");
  assert.equal(disabledAttributes.tabindex, "-1");

  assert.doesNotThrow(() => createLearnerCodeEditorExtensions({
    language: "tsx",
    lineNumberStart: 120,
  }));
  assert.throws(
    () => createLearnerCodeEditorExtensions({
      language: "typescript",
      lineNumberStart: 0,
    }),
    /lineNumberStart must be an integer/,
  );
});

test("editor configuration exposes only the run shortcuts owned by its host", () => {
  const checkOnly = stateFor("python", "return None", {
    onRun() {},
    runModes: ["check"],
  });
  const checkOnlyAttributes = checkOnly
    .facet(EditorView.contentAttributes)
    .filter((value) => typeof value !== "function")
    .reduce((attributes, value) => ({ ...attributes, ...value }), {});
  assert.equal(
    checkOnlyAttributes["aria-keyshortcuts"],
    "Tab Shift+Tab Escape Control+Enter Meta+Enter",
  );

  const examplesOnly = stateFor("python", "return None", {
    onRun() {},
    runModes: ["examples"],
  });
  const examplesOnlyAttributes = examplesOnly
    .facet(EditorView.contentAttributes)
    .filter((value) => typeof value !== "function")
    .reduce((attributes, value) => ({ ...attributes, ...value }), {});
  assert.equal(
    examplesOnlyAttributes["aria-keyshortcuts"],
    "Tab Shift+Tab Escape Control+Shift+Enter Meta+Shift+Enter",
  );
});

test("editor configuration rejects ambiguous language, indentation, and run inputs", () => {
  assert.throws(
    () => createLearnerCodeEditorExtensions({ language: "ruby" }),
    /Unsupported learner code editor language/,
  );
  assert.throws(
    () => createLearnerCodeEditorExtensions({
      language: "python",
      tabSize: 0,
    }),
    /integer from 1 to 8/,
  );
  assert.throws(
    () => createLearnerCodeEditorExtensions({
      language: "python",
      variant: "black",
    }),
    /Unsupported learner code editor variant/,
  );
  assert.throws(
    () => createLearnerCodeEditorExtensions({
      language: "python",
      onRun() {},
      runModes: [],
    }),
    /runModes must contain unique examples and\/or check modes/,
  );
  assert.throws(
    () => createLearnerCodeEditorExtensions({
      language: "python",
      onRun() {},
      runModes: ["check", "check"],
    }),
    /runModes must contain unique examples and\/or check modes/,
  );
});

test("Vite emits one deterministic, same-origin browser runtime", async () => {
  const first = await readFile(assetUrl);
  const temporaryOutput = await mkdtemp(
    join(tmpdir(), "latent-learner-editor-"),
  );
  let second;
  try {
    await run(process.execPath, [
      "scripts/build-learner-code-editor.mjs",
      "--out-dir",
      temporaryOutput,
    ]);
    second = await readFile(
      join(temporaryOutput, "learner-code-editor.js"),
    );
  } finally {
    await rm(temporaryOutput, { force: true, recursive: true });
  }
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(digest(first), digest(second));
  assert.doesNotMatch(
    second.toString("utf8"),
    /(?:import\s*\(|<script|https?:\/\/(?!www\.w3\.org\/2000\/svg))/,
  );

  const context = {};
  vm.createContext(context);
  vm.runInContext(second.toString("utf8"), context);
  const runtime = context.LatentLearnerCodeEditorRuntime;
  assert.equal(runtime.version, 1);
  assert.equal(runtime.cspNonce, LEARNER_CODE_EDITOR_CSP_NONCE);
  assert.equal(runtime.cspSource, LEARNER_CODE_EDITOR_CSP_SOURCE);
  assert.equal(typeof runtime.enhanceTextarea, "function");
  assert.ok(Object.isFrozen(runtime));
});

test("package publishes the framework-neutral module and keeps the asset in dist", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("package.json", packageRoot),
    "utf8",
  ));
  assert.deepEqual(
    manifest.exports["./learner-code-editor"],
    {
      types: "./dist/learner-code-editor.d.ts",
      import: "./dist/learner-code-editor.js",
    },
  );
  assert.match(
    manifest.scripts.build,
    /build:learner-code-editor/,
  );
  assert.ok((await readFile(assetUrl)).length > 0);
  assert.ok(manifest.files.includes("THIRD_PARTY_NOTICES.md"));
  assert.match(
    await readFile(new URL("THIRD_PARTY_NOTICES.md", packageRoot), "utf8"),
    /CodeMirror 6[\s\S]*Lezer[\s\S]*MIT/,
  );
});
