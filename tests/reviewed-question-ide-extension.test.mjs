import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import * as esbuild from "esbuild-wasm";

let browserLab;
let browserWorker;
let content;
let reviewedQuestionIde;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [browserLab, browserWorker, content, reviewedQuestionIde] = await Promise.all([
    vite.ssrLoadModule("/packages/browser-lab/src/index.ts"),
    vite.ssrLoadModule("/packages/browser-lab/src/worker/index.ts"),
    vite.ssrLoadModule("/app/content/practice/question-library.ts"),
    vite.ssrLoadModule("/app/platform/ide/reviewed-question-extension.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

test("a reviewed bundled question becomes an injected Browser IDE definition", () => {
  const exercise = reviewedQuestionIde.bundledMethodQuestionIdeExercise("unique-values");
  const definition = exercise.definition;
  assert.equal(definition.schemaVersion, 1);
  assert.equal(definition.files.length, 2);
  const learner = definition.files.find((file) => file.editable);
  const wrapper = definition.files.find((file) => !file.editable);
  assert.equal(learner.path, "unique-values.ts");
  assert.match(learner.contents, /^export class Solution/m);
  assert.match(wrapper.path, /\.__latent_checks\.ts$/);
  assert.match(wrapper.contents, /import \{ Solution as __LatentTarget \}/);
  assert.deepEqual(definition.entryPoints, [wrapper.path]);
  assert.ok(definition.checks.contracts[0].cases.every((exerciseCase) => (
    exerciseCase.invoke.modulePath === wrapper.path
  )));
  assert.equal(Object.isFrozen(definition), true);
  assert.equal(Object.isFrozen(definition.checks.contracts[0].cases), true);
  assert.equal(exercise.libraryId, "latent/method-practice@1.0.0");
  assert.equal(exercise.groupId, "arrays-and-maps");
  assert.deepEqual(exercise.runtimeOptions.limits, {
    cpuTimeoutMs: 2_000,
    wallTimeoutMs: 2_000,
    maxLogCharacters: 100_000,
    maxSerializedValueBytes: 100_000,
  });
  assert.doesNotMatch(
    reviewedQuestionIde.restoreReviewedQuestionSource(exercise.question, learner.contents),
    /^export class Solution/m,
  );
});

test("the adapter grants no authority to unknown or unbundled questions", () => {
  assert.throws(
    () => reviewedQuestionIde.bundledMethodQuestionIdeExtension("not-in-the-bundle"),
    /does not contain/,
  );
});

test("the read-only wrapper compiles and checks an edited learner solution in QuickJS", async () => {
  const definition = reviewedQuestionIde.bundledMethodQuestionIdeExtension("unique-values");
  const files = definition.files.map(({ path, loader, contents, editable }) => ({
    path,
    loader,
    contents: editable
      ? `export class Solution {
  uniqueValues(values: number[]): number[] {
    return [...new Set(values)];
  }
}
`
      : contents,
  }));
  const snapshot = { projectId: definition.id, revision: 1, files };
  const compilerVersion = browserLab.compilerVersionForEsbuild(esbuild.version);
  const job = await browserLab.createCompileJob({
    jobId: "reviewed-question-compile",
    snapshot,
    compilerVersion,
    entryPoints: definition.entryPoints,
    submittedAt: 10,
  });
  const program = await browserLab.compileVirtualProject(job, {
    version: esbuild.version,
    build: esbuild.build,
  });
  const request = {
    schemaVersion: 1,
    jobId: "reviewed-question-check",
    projectId: definition.id,
    projectRevision: 1,
    sourceHash: job.sourceHash,
    contractVersion: definition.checks.contractVersion,
    requestedAt: 20,
    deterministicSeed: 71,
    deterministicNowMs: 1_700_000_000_000,
    program,
    suite: definition.checks,
    limits: { ...browserLab.DEFAULT_SANDBOX_LIMITS },
  };
  const receipt = await browserWorker.handleSandboxRunRequest(
    request,
    new browserWorker.QuickJSSandboxEngine(),
    () => {},
    () => 30,
  );
  assert.equal(receipt.status, "passed");
  assert.equal(receipt.results.length, 4);
  assert.ok(receipt.results.every((result) => result.passed));
});

test("the reviewed Question Group limits reach the constructed Browser Lab runtime", async () => {
  const exercise = reviewedQuestionIde.bundledMethodQuestionIdeExercise("unique-values");
  let request;
  const runtime = browserLab.createBrowserLabIdeRuntime({
    ...exercise.runtimeOptions,
    createId: (prefix) => `${prefix}-limits`,
    now: () => 10,
    createCompiler: () => ({
      compile: async (job) => ({
        schemaVersion: 1,
        format: "browser-lab-iife-v1",
        compileJobId: job.jobId,
        projectId: job.projectId,
        projectRevision: job.projectRevision,
        sourceHash: job.sourceHash,
        compilerVersion: job.compilerVersion,
        modules: [],
        diagnostics: [],
      }),
      dispose: () => {},
    }),
    createRunner: () => ({
      runSuite: async (input) => {
        request = input;
        return {};
      },
    }),
  });
  await runtime.run({
    extensionId: exercise.definition.id,
    snapshot: {
      projectId: exercise.definition.id,
      revision: 0,
      files: exercise.definition.files,
    },
    entryPoints: exercise.definition.entryPoints,
    suite: exercise.definition.checks,
  });

  assert.equal(request.limits.cpuTimeoutMs, 2_000);
  assert.equal(request.limits.wallTimeoutMs, 2_000);
  assert.equal(request.limits.maxLogCharacters, 100_000);
  assert.equal(request.limits.maxSerializedValueBytes, 100_000);
});

test("runtime declarations fail closed outside the pinned browser profile", () => {
  const question = content.methodQuestions[0];
  const hostManaged = structuredClone(content.methodQuestionLibrary);
  hostManaged.runtimes[0].environment = "host-managed";
  assert.throws(
    () => reviewedQuestionIde.assertReviewedQuestionBrowserRuntime(hostManaged, question),
    /supported browser JavaScript or TypeScript runtime/,
  );

  const wrongEngine = structuredClone(content.methodQuestionLibrary);
  wrongEngine.runtimes[0].engineVersion = "999.0.0";
  assert.throws(
    () => reviewedQuestionIde.assertReviewedQuestionBrowserRuntime(wrongEngine, question),
    /this host provides esbuild-wasm-0\.28\.1/,
  );

  const python = {
    ...question,
    language: "python",
    path: "unique-values.py",
    runtimeId: "browser-typescript",
  };
  assert.throws(
    () => reviewedQuestionIde.assertReviewedQuestionBrowserRuntime(
      content.methodQuestionLibrary,
      python,
    ),
    /supported browser JavaScript or TypeScript runtime/,
  );
});
