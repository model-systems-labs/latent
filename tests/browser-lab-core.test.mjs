import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild-wasm";

let temporaryDirectory;
let core;
let quickjs;

test.before(async () => {
  temporaryDirectory = await mkdtemp(join(fileURLToPath(new URL("../", import.meta.url)), ".browser-lab-test-"));
  const coreOutput = join(temporaryDirectory, "core.mjs");
  const quickjsOutput = join(temporaryDirectory, "quickjs.mjs");
  await build({
    entryPoints: [fileURLToPath(new URL("../packages/browser-lab/src/index.ts", import.meta.url))],
    outfile: coreOutput,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
  });
  await build({
    entryPoints: [fileURLToPath(new URL("../packages/browser-lab/src/worker/quickjs-engine.ts", import.meta.url))],
    outfile: quickjsOutput,
    bundle: true,
    packages: "external",
    platform: "node",
    format: "esm",
    target: "node22",
  });
  core = await import(`${pathToFileURL(coreOutput).href}?test=${Date.now()}`);
  quickjs = await import(`${pathToFileURL(quickjsOutput).href}?test=${Date.now()}`);
});

test.after(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
});

async function fixture(overrides = {}) {
  const code = overrides.code ?? "var __browserLab_math = (() => ({ add: (a, b) => a + b }))();";
  const sourceHash = await core.hashText("fixture source");
  const codeHash = await core.hashText(code);
  const exerciseCase = {
    id: "adds-positive-values",
    label: "Adds positive values",
    invoke: { modulePath: "src/math.js", exportName: "add", args: [2, 3] },
    assertions: [{ id: "sum", label: "Returns the sum", kind: "deep-equal", expected: 5 }],
    ...overrides.exerciseCase,
  };
  const request = {
    schemaVersion: 1,
    jobId: "job-1",
    projectId: "project-1",
    projectRevision: 7,
    sourceHash,
    contractVersion: "contracts-3",
    requestedAt: 100,
    deterministicSeed: 71,
    deterministicNowMs: 1_700_000_000_000,
    program: {
      schemaVersion: 1,
      format: "browser-lab-iife-v1",
      compileJobId: "compile-1",
      projectId: "project-1",
      projectRevision: 7,
      sourceHash,
      compilerVersion: "esbuild-0.28.1",
      modules: [{ modulePath: "src/math.js", globalName: "__browserLab_math", code, codeHash }],
      diagnostics: [],
    },
    suite: {
      contractVersion: "contracts-3",
      contracts: [{ id: "math.add", label: "Addition", cases: [exerciseCase] }],
    },
    limits: { ...core.DEFAULT_SANDBOX_LIMITS, cpuTimeoutMs: 100 },
    ...overrides.request,
  };
  return { request, exerciseCase };
}

test("source hashes are order-independent, content-sensitive, and reject duplicate paths", async () => {
  const files = [
    { path: "src/b.js", loader: "js", contents: "export const b = 2" },
    { path: "src/a.js", loader: "js", contents: "export const a = 1" },
  ];
  assert.equal(await core.hashProjectSource(files), await core.hashProjectSource([...files].reverse()));
  assert.notEqual(await core.hashProjectSource(files), await core.hashProjectSource([{ ...files[0], contents: "export const b = 3" }, files[1]]));
  assert.throws(() => core.hashProjectSource([files[0], files[0]]), (error) => error.code === "DUPLICATE_PATH");
  assert.throws(() => core.hashProjectSource([{ ...files[0], path: "../host.js" }]), (error) => error.code === "INVALID_PATH");
});

test("learner-returned pass flags cannot forge a host-owned assertion", () => {
  const contract = {
    id: "secure-contract",
    label: "Secure contract",
    cases: [{
      id: "forged-return",
      label: "Forged return",
      invoke: { modulePath: "src/math.js", exportName: "add", args: [] },
      assertions: [{ id: "actual-value", label: "Returns four", kind: "deep-equal", expected: 4 }],
    }],
  };
  const result = core.evaluateExerciseCase(contract, contract.cases[0], {
    status: "returned",
    value: { passed: true, detail: "I decide whether this passes" },
  });
  assert.equal(result.passed, false);
  assert.equal(result.assertions[0].passed, false);
  assert.match(result.assertions[0].detail, /did not match/);
});

test("QuickJS executes pure exports without host page capabilities", async () => {
  const code = `var __browserLab_math = (() => ({ inspect: () => ({
    fetch: typeof fetch,
    storage: typeof localStorage,
    worker: typeof Worker,
    messaging: typeof postMessage,
    first: Math.random(),
    now: Date.now(),
    constructedNow: new Date().getTime()
  }) }))();`;
  const exerciseCase = {
    id: "isolated",
    label: "Isolated",
    invoke: { modulePath: "src/math.js", exportName: "inspect", args: [] },
    assertions: [],
  };
  const { request } = await fixture({ code, exerciseCase });
  const engine = new quickjs.QuickJSSandboxEngine();
  const first = await engine.observe(request, exerciseCase, () => {});
  const second = await engine.observe(request, exerciseCase, () => {});
  assert.equal(first.status, "returned");
  assert.deepEqual(first, second, "seeded randomness and time must be reproducible");
  assert.deepEqual(first.value, {
    fetch: "undefined",
    storage: "undefined",
    worker: "undefined",
    messaging: "undefined",
    first: first.value.first,
    now: 1_700_000_000_000,
    constructedNow: 1_700_000_000_000,
  });
});

test("QuickJS freezes host-owned invocation inputs before learner code runs", async () => {
  const code = `var __browserLab_math = (() => ({ append: (messages, delta) => {
    messages[0].content += delta;
    messages.push({ id: "injected", content: delta });
    return messages;
  } }))();`;
  const exerciseCase = {
    id: "immutable-input",
    label: "Immutable input",
    invoke: {
      modulePath: "src/math.js",
      exportName: "append",
      args: [[{ id: "a", content: "Hel", status: "streaming" }], "lo"],
    },
    assertions: [],
  };
  const { request } = await fixture({ code, exerciseCase, request: { jobId: "job-immutable-input" } });
  const observation = await new quickjs.QuickJSSandboxEngine().observe(request, exerciseCase, () => {});
  assert.equal(observation.status, "threw", "mutating a frozen nested object or array must not produce a passing value");
  assert.match(observation.message, /read only|not extensible|object is not extensible/i);
});

test("QuickJS interrupts an infinite loop inside the per-case CPU limit", async () => {
  const code = "var __browserLab_math = (() => ({ spin: () => { while (true) {} } }))();";
  const exerciseCase = { id: "spin", label: "Spin", invoke: { modulePath: "src/math.js", exportName: "spin", args: [] }, assertions: [] };
  const { request } = await fixture({ code, exerciseCase, request: { jobId: "job-spin" } });
  request.limits = { ...request.limits, cpuTimeoutMs: 25 };
  const started = performance.now();
  const observation = await new quickjs.QuickJSSandboxEngine().observe(request, exerciseCase, () => {});
  assert.equal(observation.status, "timed-out");
  assert.ok(performance.now() - started < 1_000, "the VM interrupt should fire well before one second");
});

test("handler produces a source-bound receipt and caps learner logs", async () => {
  const code = "var __browserLab_math = (() => ({ add: (a, b) => { for (let i = 0; i < 20; i++) console.log('entry', i); return a + b; } }))();";
  const { request } = await fixture({ code });
  request.limits = { ...request.limits, maxLogEntries: 3, maxLogCharacters: 30 };
  const messages = [];
  // Bundle the handler separately so its engine adapter remains injectable.
  const handlerOutput = join(temporaryDirectory, "handler.mjs");
  await build({ entryPoints: [fileURLToPath(new URL("../packages/browser-lab/src/worker/handler.ts", import.meta.url))], outfile: handlerOutput, bundle: true, platform: "node", format: "esm", target: "node22" });
  const handler = await import(`${pathToFileURL(handlerOutput).href}?test=${Date.now()}`);
  const receipt = await handler.handleSandboxRunRequest(request, new quickjs.QuickJSSandboxEngine(), (message) => messages.push(message), () => 500);
  assert.equal(receipt.status, "passed");
  assert.equal(receipt.projectRevision, request.projectRevision);
  assert.equal(receipt.sourceHash, request.sourceHash);
  assert.equal(receipt.contractVersion, request.contractVersion);
  assert.equal(receipt.logs.length, 3);
  assert.equal(receipt.logsTruncated, true);
  assert.equal(messages.filter((message) => message.type === "browser-lab/log").length, 3);
});

test("stale receipts cannot promote and tampered compiled code cannot become an artifact", async () => {
  const { request } = await fixture();
  const result = core.evaluateExerciseCase(request.suite.contracts[0], request.suite.contracts[0].cases[0], { status: "returned", value: 5 });
  const receipt = {
    schemaVersion: 1,
    receiptId: "receipt-1",
    jobId: request.jobId,
    projectId: request.projectId,
    projectRevision: request.projectRevision,
    sourceHash: request.sourceHash,
    contractVersion: request.contractVersion,
    status: "passed",
    startedAt: 1,
    completedAt: 2,
    results: [result],
    logs: [],
    logsTruncated: false,
    limits: request.limits,
  };
  const expected = { projectId: request.projectId, projectRevision: request.projectRevision, sourceHash: request.sourceHash, contractVersion: request.contractVersion };
  core.assertReceiptPromotable(receipt, expected, [{ contractId: "math.add", caseId: "adds-positive-values" }]);
  assert.throws(() => core.assertReceiptPromotable(receipt, { ...expected, projectRevision: expected.projectRevision + 1 }, [{ contractId: "math.add", caseId: "adds-positive-values" }]), (error) => error.code === "STALE_RESULT");
  const manifest = { schemaVersion: 1, bindings: [{ bindingId: "math", capability: "model.sample", modulePath: "src/math.js", exportName: "add", kind: "function", required: true }] };
  const artifact = await core.createBuildArtifact({ artifactId: "build-1", buildNumber: 1, program: request.program, receipt, bindingManifest: manifest, expectedCases: [{ contractId: "math.add", caseId: "adds-positive-values" }] });
  assert.equal(artifact.testReceiptId, receipt.receiptId);
  await assert.rejects(() => core.createBuildArtifact({ artifactId: "build-2", buildNumber: 2, program: { ...request.program, modules: [{ ...request.program.modules[0], code: `${request.program.modules[0].code}\n// tampered` }] }, receipt, bindingManifest: manifest, expectedCases: [{ contractId: "math.add", caseId: "adds-positive-values" }] }), (error) => error.code === "COMPILED_CODE_TAMPERED");
});

test("the outer worker watchdog terminates a non-responsive worker", async () => {
  const { request } = await fixture();
  request.limits = { ...request.limits, wallTimeoutMs: 50 };
  let terminated = false;
  const listeners = { message: new Set(), error: new Set() };
  const worker = {
    postMessage() {},
    terminate() { terminated = true; },
    addEventListener(type, listener) { listeners[type].add(listener); },
    removeEventListener(type, listener) { listeners[type].delete(listener); },
  };
  const client = new core.BrowserLabWorkerClient(() => worker);
  await assert.rejects(() => client.runSuite(request), (error) => error.code === "WALL_TIMEOUT");
  assert.equal(terminated, true);
});

test("Browser Lab source contains no application-realm dynamic evaluation fallback", async () => {
  const files = [
    "../packages/browser-lab/src/worker-client.ts",
    "../packages/browser-lab/src/worker/handler.ts",
    "../packages/browser-lab/src/worker/quickjs-engine.ts",
  ];
  const source = (await Promise.all(files.map((path) => readFile(new URL(path, import.meta.url), "utf8")))).join("\n");
  assert.doesNotMatch(source, /new\s+Function\s*\(/);
  assert.doesNotMatch(source, /globalThis\s*\.\s*eval\s*\(/);
  assert.match(source, /newQuickJSWASMModuleFromVariant/);
  assert.match(source, /worker\.terminate\(\)/);
});
