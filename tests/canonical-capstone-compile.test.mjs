import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { chromium } from "playwright";
import { createServer } from "vite";

let vite;
let course;
let implementation;
let contracts;
let template;
let compiler;
let browserLab;
let tensor;
let behaviorRunner;
let browser;
let behaviorPage;
let behaviorRuntimeSource;
let behaviorSandboxWorkerSource;
let behaviorSandboxWasmSource;
let httpServer;

before(async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  vite = await createServer({
    root,
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [course, implementation, contracts, template, compiler, browserLab, tensor, behaviorRunner] = await Promise.all([
    vite.ssrLoadModule("/app/lessons/course.ts"),
    vite.ssrLoadModule("/app/lessons/implementation-source.ts"),
    vite.ssrLoadModule("/app/content/llm-systems/contracts.ts"),
    vite.ssrLoadModule("/app/content/browser-chat/project-template.ts"),
    vite.ssrLoadModule("/packages/browser-lab/src/compiler/index.ts"),
    vite.ssrLoadModule("/packages/browser-lab/src/index.ts"),
    vite.ssrLoadModule("/packages/tensor/src/browser-source.ts"),
    vite.ssrLoadModule("/app/features/ide/capstone-behavior-runner.ts"),
  ]);
  const runner = await esbuild.build({
    stdin: {
      contents: `import { runCapstoneBehaviorContract } from "./app/features/ide/capstone-behavior-runner.ts"; globalThis.__runCapstoneBehaviorContract = runCapstoneBehaviorContract;`,
      resolveDir: root,
      sourcefile: "capstone-behavior-test-entry.ts",
      loader: "ts",
    },
    bundle: true,
    platform: "browser",
    format: "iife",
    target: "es2022",
    write: false,
  });
  const chromeCandidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  const executablePath = chromeCandidates.find((candidate) => existsSync(candidate));
  browser = await chromium.launch(executablePath ? { headless: true, executablePath } : { headless: true });
  behaviorSandboxWorkerSource = await readFile(new URL("../public/capstone-sandbox-worker.js", import.meta.url), "utf8");
  behaviorSandboxWasmSource = await readFile(new URL("../public/emscripten-module.wasm", import.meta.url));
  httpServer = createHttpServer((request, response) => {
    if (request.url === "/capstone-sandbox-worker.js") {
      response.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
      response.end(behaviorSandboxWorkerSource);
      return;
    }
    if (request.url === "/emscripten-module.wasm") {
      response.writeHead(200, { "content-type": "application/wasm", "cache-control": "no-store" });
      response.end(behaviorSandboxWasmSource);
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><html><body><main>Capstone behavior host</main></body></html>");
  });
  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", resolve);
  });
  const address = httpServer.address();
  behaviorPage = await browser.newPage();
  await behaviorPage.goto(`http://127.0.0.1:${address.port}`);
  await behaviorPage.addScriptTag({ content: runner.outputFiles[0].text });
  behaviorRuntimeSource = await readFile(new URL("../public/capstone-react-runtime.js", import.meta.url), "utf8");
});

after(async () => {
  await behaviorPage?.close();
  await browser?.close();
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  await vite?.close();
});

function loaderFor(path) {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".jsx")) return "jsx";
  if (path.endsWith(".json")) return "json";
  return "js";
}

function canonicalFiles(overrides = new Map()) {
  const exportsByPath = new Map();
  for (const contract of contracts.llmSystemsContractSuite.contracts) {
    for (const exerciseCase of contract.cases) {
      const names = exportsByPath.get(exerciseCase.invoke.modulePath) ?? new Set();
      names.add(exerciseCase.invoke.exportName);
      exportsByPath.set(exerciseCase.invoke.modulePath, names);
    }
  }
  const lessonFiles = course.courseLessons.map((lesson) => {
    const path = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
    const source = implementation.lessonImplementationSource(lesson, lesson.implementation.codeBlocks.map((block) => block.code));
    const names = [...(exportsByPath.get(path) ?? [])];
    if (path.endsWith(".py")) {
      return {
        path,
        contents: JSON.stringify({ path, contents: source }),
        loader: "json",
      };
    }
    return {
      path,
      contents: overrides.get(path) ?? (names.length ? compiler.exposeLessonFunctions(source, names) : source),
      loader: loaderFor(path),
    };
  });
  return [
    ...lessonFiles,
    ...template.CANONICAL_BROWSER_CHAT_FILES.map((file) => ({
      path: file.path,
      contents: overrides.get(file.path) ?? file.source,
      loader: loaderFor(file.path),
    })),
    { path: tensor.LATENT_TENSOR_PATH, contents: tensor.LATENT_TENSOR_SOURCE, loader: "js" },
  ];
}

async function compileCanonical(files, jobId, entryPoints = [template.CAPSTONE_ENTRY_PATH]) {
  const snapshot = { projectId: "browser-chat", revision: 1, files };
  const job = await browserLab.createCompileJob({
    jobId,
    snapshot,
    compilerVersion: compiler.compilerVersionForEsbuild(esbuild.version),
    entryPoints,
  });
  return compiler.compileVirtualProject(job, esbuild);
}

async function runBehavior(program, fixture) {
  const compiledEntry = program.modules.find((candidate) => candidate.modulePath === template.CAPSTONE_ENTRY_PATH);
  assert.ok(compiledEntry);
  return behaviorPage.evaluate(async ({ bundle, runtimeSource, fixture: behaviorFixture }) => {
    return globalThis.__runCapstoneBehaviorContract(bundle, { runtimeSource, timeoutMs: 10_000, fixture: behaviorFixture });
  }, { bundle: compiledEntry, runtimeSource: behaviorRuntimeSource, fixture });
}

test("the canonical IDE repository compiles its real React capstone entry", async () => {
  const program = await compileCanonical(canonicalFiles(), "canonical-capstone-compile");
  assert.equal(program.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length, 0);
  assert.equal(program.modules.length, 1);
  assert.equal(program.modules[0].modulePath, template.CAPSTONE_ENTRY_PATH);
  assert.match(program.modules[0].code, /Browser Chat/);
  assert.match(program.modules[0].code, /__LATENT_PREVIEW_HOST__/);
});

test("every course-provided JavaScript adapter compiles as an independent runtime module", async () => {
  const adapters = template.CANONICAL_BROWSER_CHAT_FILES.filter((file) => file.kind === "adapter");
  const files = adapters.map((file) => ({ path: file.path, contents: file.source, loader: "js" }));
  const entryPoints = adapters.map((file) => file.path);
  const program = await compileCanonical(files, "canonical-capstone-adapters", entryPoints);

  assert.deepEqual(program.diagnostics.filter((diagnostic) => diagnostic.severity === "error"), []);
  assert.deepEqual(program.modules.map((module) => module.modulePath), entryPoints);
  assert.ok(program.modules.every((module) => module.codeHash.startsWith("sha256:")));
});

test("the behavior frame authorizes only its fixed host bootstrap and transferred assets", () => {
  const expectedHash = `sha256-${createHash("sha256").update(behaviorRunner.CAPSTONE_BEHAVIOR_BOOTSTRAP_SOURCE).digest("base64")}`;
  const html = behaviorRunner.createCapstoneBehaviorFrameSrcdoc();
  assert.equal(behaviorRunner.CAPSTONE_BEHAVIOR_BOOTSTRAP_SHA256, expectedHash);
  assert.match(html, new RegExp(`script-src '${expectedHash.replaceAll("+", "\\+")}' blob:`));
  assert.doesNotMatch(html, /script-src 'unsafe-inline'/);
  assert.doesNotMatch(html, /allow-same-origin|connect-src (?!'none')/);
});

test("an editable capstone source change produces a different runnable bundle", async () => {
  const baseline = await compileCanonical(canonicalFiles(), "canonical-capstone-baseline");
  const component = template.CANONICAL_BROWSER_CHAT_FILES.find((file) => file.path === template.CAPSTONE_COMPONENT_PATH);
  assert.ok(component);
  const editedSource = component.source.replace("Ask the system you built.", "Ask your compiled project.");
  assert.notEqual(editedSource, component.source);

  const edited = await compileCanonical(
    canonicalFiles(new Map([[template.CAPSTONE_COMPONENT_PATH, editedSource]])),
    "canonical-capstone-edited",
  );
  assert.equal(edited.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length, 0);
  assert.notEqual(edited.modules[0].codeHash, baseline.modules[0].codeHash);
  assert.match(edited.modules[0].code, /Ask your compiled project\./);
});

test("the host-owned mounted behavior contract passes canonical BrowserChat and rejects a blank component", async () => {
  const canonical = await compileCanonical(canonicalFiles(), "canonical-capstone-behavior");
  const canonicalResult = await runBehavior(canonical);
  assert.equal(canonicalResult.passed, true, canonicalResult.detail);
  assert.equal(canonicalResult.path, template.CAPSTONE_COMPONENT_PATH);
  assert.match(canonicalResult.detail, /accessible chat surface/);
  assert.match(canonicalResult.detail, /streamed chunks are grouped into animation-frame updates/);
  assert.match(canonicalResult.detail, /live output announcements stay short, don’t fire too often, and announce the final state right away/);
  assert.match(canonicalResult.detail, /Regenerating uses the newest answer in later context/);
  assert.match(canonicalResult.detail, /Stopping keeps accepted chunks and clears pending screen updates/);
  assert.match(canonicalResult.detail, /Stopping ignores late stream output/);
  assert.match(canonicalResult.detail, /the error is visible and final/);

  const hiddenMetricsResult = await runBehavior(canonical, {
    selectedBackend: "local",
    assistantName: "Runtime Assistant",
    responsePrefix: "runtime-prefix: ",
    showMetrics: false,
    persistFailures: 1,
    requirePreparation: true,
    preparationDelayMs: 180,
  });
  assert.equal(hiddenMetricsResult.passed, true, hiddenMetricsResult.detail);
  assert.match(hiddenMetricsResult.detail, /saved backend and metrics choices were restored/);
  assert.match(hiddenMetricsResult.detail, /runtime name and response prefix show up in the streamed answer/);
  assert.match(hiddenMetricsResult.detail, /backend setup doesn’t show a misleading Stop button/);
  assert.match(hiddenMetricsResult.detail, /mobile model controls start in a compact button that can receive keyboard focus/);
  assert.match(hiddenMetricsResult.detail, /mobile inference controls stay available in the compact menu/);
  assert.match(hiddenMetricsResult.detail, /mobile save recovery can receive keyboard focus/);
  assert.match(hiddenMetricsResult.detail, /mobile save status and the Clear button stay visible/);

  const retryIdentityResult = await runBehavior(canonical, {
    selectedBackend: "student",
    assistantName: "Retry Tutor",
    responsePrefix: "retry-prefix: ",
    showMetrics: true,
    transientRetry: true,
  });
  assert.equal(retryIdentityResult.passed, true, retryIdentityResult.detail);
  assert.match(retryIdentityResult.detail, /a retry after a temporary error keeps the logical request id but creates new attempt and transport ids/);

  const invalidRestoreResult = await runBehavior(canonical, {
    selectedBackend: "student",
    assistantName: "Recovery Tutor",
    responsePrefix: "recovery-prefix: ",
    showMetrics: true,
    invalidConversation: true,
  });
  assert.equal(invalidRestoreResult.passed, true, invalidRestoreResult.detail);
  assert.match(invalidRestoreResult.detail, /an invalid saved conversation pauses saving until the user discards it/);

  const blankComponent = `export function BrowserChat() { return null; }`;
  const blank = await compileCanonical(
    canonicalFiles(new Map([[template.CAPSTONE_COMPONENT_PATH, blankComponent]])),
    "blank-capstone-behavior",
  );
  assert.equal(blank.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length, 0, "the adversary must remain compile-valid");
  const blankResult = await runBehavior(blank);
  assert.equal(blankResult.passed, false, "a compile-valid null component must not mint the behavior receipt");
  assert.match(blankResult.detail, /accessible (?:visible )?conversation log|accessible chat surface/i);
});

test("the isolated preflight rejects a synchronous render loop without freezing the host page", async () => {
  const loopingComponent = `export function BrowserChat() { while (true) {} }`;
  const looping = await compileCanonical(
    canonicalFiles(new Map([[template.CAPSTONE_COMPONENT_PATH, loopingComponent]])),
    "looping-capstone-behavior",
  );
  assert.equal(looping.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length, 0, "the adversary must remain compile-valid");
  const startedAt = Date.now();
  const loopingResult = await runBehavior(looping);
  assert.equal(loopingResult.passed, false, "an unbounded render must not reach the browser mount");
  assert.match(loopingResult.detail, /isolated QuickJS check stopped[\s\S]*browser preview didn’t start/i);
  assert.ok(Date.now() - startedAt < 5_000, "the isolated worker should fail closed promptly");
  assert.equal(await behaviorPage.evaluate(() => 6 * 7), 42, "the host page must remain responsive after terminating learner code");
});
