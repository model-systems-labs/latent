import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the public Browser IDE seam remains framework and application neutral", async () => {
  const [implementation, index, manifest] = await Promise.all([
    read("packages/browser-lab/src/ide-extension.ts"),
    read("packages/browser-lab/src/index.ts"),
    read("packages/browser-lab/package.json"),
  ]);
  assert.match(index, /export \* from "\.\/ide-extension"/);
  assert.match(manifest, /"\.\/ide":/);
  assert.doesNotMatch(implementation, /(?:from|import\()\s*["'](?:react|next|dexie|@\/|app\/)/);
  assert.doesNotMatch(manifest, /"react"|"next"|"dexie"/);
  assert.match(implementation, /BrowserIdeEditorAdapter<RenderedEditor>/);
  assert.match(implementation, /BrowserIdeRuntimeAdapter/);
  assert.match(implementation, /BrowserIdePersistenceAdapter/);
  assert.match(implementation, /stageReceipt/);
  assert.match(implementation, /admitReceipt/);
  assert.match(implementation, /definitionFingerprint/);
  assert.match(implementation, /readonly files: readonly BrowserIdeSourceFile\[\]/);
  assert.match(implementation, /readonly checks: ContractSuite/);
});

test("the Latent host injects CodeMirror, Browser Lab, and browser persistence", async () => {
  const [host, workbench, route, questionWorkbench, practicePage] = await Promise.all([
    read("app/platform/ide/browser-extension-host.tsx"),
    read("app/platform/ide/BrowserIdeExtensionWorkbench.tsx"),
    read("app/practice/ide/unique-values/page.tsx"),
    read("app/platform/ide/BundledQuestionIdeWorkbench.tsx"),
    read("app/practice/page.tsx"),
  ]);
  assert.match(host, /createLatentCodeMirrorIdeEditor/);
  assert.match(host, /createBrowserLabIdeRuntime\(options\.runtime\)/);
  assert.match(host, /createLatentBrowserIdePersistence/);
  assert.match(host, /database\.transaction\("rw", database\.settings/);
  assert.match(host, /currentReceiptArtifactKey/);
  assert.match(host, /BROWSER_IDE_MAX_RECEIPT_ARTIFACTS_PER_EXTENSION/);
  assert.match(host, /persistenceRecordToken/);
  assert.match(host, /repositories\.settings\.put/);
  assert.match(workbench, /createLatentBrowserIdeSession\(definition/);
  assert.match(workbench, /onReceiptRef/);
  assert.match(workbench, /initialization\?\.session !== session/);
  assert.doesNotMatch(workbench, /\[definition,\s*onReceipt\]/);
  assert.doesNotMatch(workbench, /CodeEditor|BrowserLabCompilerClient|BrowserLabWorkerClient|getPersistenceContext/);
  assert.match(route, /BundledQuestionIdeWorkbench questionId="unique-values"/);
  assert.match(questionWorkbench, /saveQuestionAttempt/);
  assert.match(questionWorkbench, /`\$\{exercise\.groupId\}\/\$\{exercise\.question\.id\}`/);
  assert.match(questionWorkbench, /runtimeOptions=\{exercise\.runtimeOptions\}/);
  assert.match(practicePage, /href="\/practice\/ide\/unique-values"/);
});

test("Browser IDE v1 is explicit about its JavaScript and TypeScript boundary", async () => {
  const [implementation, hostReadme] = await Promise.all([
    read("packages/browser-lab/src/ide-extension.ts"),
    read("app/platform/ide/README.md"),
  ]);
  assert.match(implementation, /SUPPORTED_LOADERS.*"js".*"jsx".*"ts".*"tsx".*"json"/);
  assert.match(implementation, /UNSUPPORTED_IDE_LANGUAGE/);
  assert.match(hostReadme, /Python is intentionally not part of this seam/);
  assert.match(hostReadme, /not arbitrary remote execution/);
});

test("the Question Group bridge authorizes only the reviewed bundled library", async () => {
  const source = await read("app/platform/ide/reviewed-question-extension.ts");
  assert.match(source, /import \{ methodQuestionLibrary \}/);
  assert.match(source, /validateQuestionGroupLibrary\(methodQuestionLibrary\)/);
  assert.match(source, /bundledMethodQuestionIdeExtension/);
  assert.match(source, /bundledMethodQuestionIdeExercise/);
  assert.match(source, /environment !== "browser-worker"/);
  assert.match(source, /BROWSER_LAB_COMPILER_VERSION/);
  assert.match(source, /wallTimeoutMs: runtime\.limits\.timeoutMs/);
  assert.match(source, /maxSerializedValueBytes/);
  assert.doesNotMatch(source, /\bfetch\s*\(|import\s*\(\s*(?!["'])/);
});
