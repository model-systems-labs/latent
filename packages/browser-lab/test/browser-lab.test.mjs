import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild-wasm";

let temporaryDirectory;
let browserLab;
let worker;

test.before(async () => {
  temporaryDirectory = await mkdtemp(join(fileURLToPath(new URL("../", import.meta.url)), ".test-output-"));
  const browserLabOutput = join(temporaryDirectory, "browser-lab.mjs");
  const workerOutput = join(temporaryDirectory, "worker.mjs");
  await esbuild.build({
    entryPoints: [fileURLToPath(new URL("../src/index.ts", import.meta.url))],
    outfile: browserLabOutput,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
  });
  await esbuild.build({
    entryPoints: [fileURLToPath(new URL("../src/worker/index.ts", import.meta.url))],
    outfile: workerOutput,
    bundle: true,
    packages: "external",
    platform: "node",
    format: "esm",
    target: "node22",
  });
  browserLab = await import(`${pathToFileURL(browserLabOutput).href}?test=${Date.now()}`);
  worker = await import(`${pathToFileURL(workerOutput).href}?test=${Date.now()}`);
});

test.after(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
});

test("the package compiles a relative-import-only virtual project", async () => {
  const files = [
    { path: "src/add.ts", loader: "ts", contents: "export const add = (left: number, right: number) => left + right;" },
    { path: "src/main.ts", loader: "ts", contents: "import { add } from './add'; export const answer = () => add(20, 22);" },
  ];
  const job = await browserLab.createCompileJob({
    jobId: "package-compile",
    snapshot: { projectId: "package-project", revision: 1, files },
    compilerVersion: browserLab.compilerVersionForEsbuild(esbuild.version),
    entryPoints: ["src/main.ts"],
    submittedAt: 100,
  });
  const program = await browserLab.compileVirtualProject(job, { version: esbuild.version, build: esbuild.build });
  assert.deepEqual(program.diagnostics, []);
  assert.equal(program.modules.length, 1);
  assert.match(program.modules[0].code, /answer/);
  assert.match(program.modules[0].codeHash, /^sha256:[a-f0-9]{64}$/);
});

test("external and project-escaping imports remain blocked", () => {
  const available = new Set(["src/main.ts"]);
  assert.throws(
    () => browserLab.resolveVirtualImport("react", "src/main.ts", available),
    (error) => error.code === "EXTERNAL_IMPORT_BLOCKED",
  );
  assert.throws(
    () => browserLab.resolveVirtualImport("../../host.ts", "src/main.ts", available),
    (error) => error.code === "IMPORT_OUTSIDE_PROJECT",
  );
});

test("course-authored assertions cannot be forged by a learner return value", () => {
  const contract = {
    id: "secure",
    label: "Secure",
    cases: [{
      id: "case",
      label: "Case",
      invoke: { modulePath: "src/main.js", exportName: "answer", args: [] },
      assertions: [{ id: "answer", label: "Returns 42", kind: "deep-equal", expected: 42 }],
    }],
  };
  const result = browserLab.evaluateExerciseCase(contract, contract.cases[0], {
    status: "returned",
    value: { passed: true },
  });
  assert.equal(result.passed, false);
});

test("throws assertions accept any exception message and preserve the actual error", () => {
  const contract = {
    id: "throws",
    label: "Throws",
    cases: [{
      id: "invalid-input",
      label: "Rejects invalid input",
      invoke: { modulePath: "src/main.js", exportName: "answer", args: [-1] },
      assertions: [{ id: "raises", label: "Raise an error", kind: "throws", errorName: "ValueError" }],
    }],
  };
  const observation = { status: "threw", errorName: "ValueError", message: "Any clear learner-authored explanation" };
  const result = browserLab.evaluateExerciseCase(contract, contract.cases[0], observation);
  assert.equal(result.passed, true);
  assert.deepEqual(result.observation, observation);
  assert.equal(browserLab.evaluateExerciseCase(contract, contract.cases[0], {
    status: "threw",
    errorName: "TypeError",
    message: observation.message,
  }).passed, false);
});

test("QuickJS is deterministic and has no host capabilities", async () => {
  const code = `var __browserLab_probe = (() => ({ probe: () => ({
    random: Math.random(),
    now: Date.now(),
    fetch: typeof fetch,
    storage: typeof localStorage,
    worker: typeof Worker
  }) }))();`;
  const sourceHash = await browserLab.hashText("probe source");
  const codeHash = await browserLab.hashText(code);
  const exerciseCase = {
    id: "probe",
    label: "Probe",
    invoke: { modulePath: "src/probe.js", exportName: "probe", args: [] },
    assertions: [],
  };
  const request = {
    schemaVersion: 1,
    jobId: "probe-job",
    projectId: "probe-project",
    projectRevision: 1,
    sourceHash,
    contractVersion: "probe-v1",
    requestedAt: 100,
    deterministicSeed: 71,
    deterministicNowMs: 1_700_000_000_000,
    program: {
      schemaVersion: 1,
      format: "browser-lab-iife-v1",
      compileJobId: "probe-compile",
      projectId: "probe-project",
      projectRevision: 1,
      sourceHash,
      compilerVersion: browserLab.BROWSER_LAB_COMPILER_VERSION,
      modules: [{ modulePath: "src/probe.js", globalName: "__browserLab_probe", code, codeHash }],
      diagnostics: [],
    },
    suite: { contractVersion: "probe-v1", contracts: [{ id: "probe", label: "Probe", cases: [exerciseCase] }] },
    limits: { ...browserLab.DEFAULT_SANDBOX_LIMITS, cpuTimeoutMs: 100 },
  };
  const engine = new worker.QuickJSSandboxEngine();
  const first = await engine.observe(request, exerciseCase, () => {});
  const second = await engine.observe(request, exerciseCase, () => {});
  assert.deepEqual(first, second);
  assert.deepEqual(first.value, {
    random: first.value.random,
    now: 1_700_000_000_000,
    fetch: "undefined",
    storage: "undefined",
    worker: "undefined",
  });
});

test("browser clients retain bundler-discoverable source-relative workers", async () => {
  const [compilerClient, sandboxClient] = await Promise.all([
    readFile(new URL("../src/compiler/client.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/worker-client.ts", import.meta.url), "utf8"),
  ]);
  assert.match(compilerClient, /new URL\("\.\/compiler\.worker\.ts", import\.meta\.url\)/);
  assert.match(sandboxClient, /new URL\("\.\/worker\/sandbox\.worker\.ts", import\.meta\.url\)/);
});
