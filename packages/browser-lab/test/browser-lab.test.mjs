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

test("throws assertions can require an exception-message pattern", () => {
  const assertion = {
    id: "message",
    label: "Explains the invalid input",
    kind: "throws",
    errorName: "TypeError",
    messagePattern: "positive integer",
  };
  assert.equal(browserLab.evaluateHostAssertion(assertion, {
    status: "threw",
    errorName: "TypeError",
    message: "Expected a positive integer.",
  }).passed, true);
  assert.equal(browserLab.evaluateHostAssertion(assertion, {
    status: "threw",
    errorName: "TypeError",
    message: "Invalid value.",
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

function ideFixture(overrides = {}) {
  return {
    schemaVersion: 1,
    id: "example.methods",
    title: "Method practice",
    description: "A small trusted TypeScript exercise.",
    initialFilePath: "src/math.ts",
    files: [
      {
        path: "src/math.ts",
        loader: "ts",
        title: "Math methods",
        editable: true,
        contents: "export const double = (value: number) => value;",
      },
      {
        path: "src/constants.ts",
        loader: "ts",
        title: "Provided constants",
        editable: false,
        contents: "export const factor = 2;",
      },
    ],
    entryPoints: ["src/math.ts"],
    checks: {
      contractVersion: "methods-v1",
      contracts: [{
        id: "double",
        label: "Double a value",
        cases: [{
          id: "positive",
          label: "Doubles a positive number",
          invoke: { modulePath: "src/math.ts", exportName: "double", args: [4] },
          assertions: [{ id: "value", label: "Returns eight", kind: "deep-equal", expected: 8 }],
        }],
      }],
    },
    ...overrides,
  };
}

async function receiptForIdeRun(input, status = "passed") {
  const sourceHash = await browserLab.hashSnapshot(input.snapshot);
  const passed = status === "passed";
  return {
    schemaVersion: 1,
    receiptId: `receipt-${input.snapshot.revision}`,
    jobId: `job-${input.snapshot.revision}`,
    projectId: input.snapshot.projectId,
    projectRevision: input.snapshot.revision,
    sourceHash,
    contractVersion: input.suite.contractVersion,
    status,
    startedAt: 10,
    completedAt: 20,
    results: input.suite.contracts.flatMap((contract) => contract.cases.map((exerciseCase) => ({
      contractId: contract.id,
      contractLabel: contract.label,
      caseId: exerciseCase.id,
      caseLabel: exerciseCase.label,
      observationStatus: "returned",
      passed,
      detail: passed ? "passed" : "failed",
      assertions: [],
    }))),
    logs: [],
    logsTruncated: false,
    limits: { ...browserLab.DEFAULT_SANDBOX_LIMITS },
  };
}

function sameIdeIdentity(left, right) {
  return left === null
    ? right === null
    : right !== null
      && left.revision === right.revision
      && left.sourceHash === right.sourceHash;
}

function createMemoryIdePersistence(options = {}) {
  let durableState = options.loaded ?? options.durableState ?? null;
  let durableIdentity = options.durableIdentity ?? null;
  let recordVersion = durableState === null ? 0 : 1;
  let currentReceiptArtifactKey = null;
  const artifacts = new Map();
  const calls = {
    saves: [],
    stages: [],
    admits: [],
    resets: 0,
  };
  return {
    adapter: {
      adapterId: "memory-persistence",
      load: async () => durableState === null
        ? null
        : {
            value: structuredClone(durableState),
            token: `memory-record:${recordVersion}`,
          },
      save: async (state, identity, expected) => {
        const call = { state, identity, expected };
        calls.saves.push(call);
        await options.beforeSave?.(call, calls.saves.length - 1);
        const idempotent = sameIdeIdentity(durableIdentity, identity);
        if (!idempotent && !sameIdeIdentity(durableIdentity, expected)) {
          throw new browserLab.BrowserLabError("IDE_WRITE_CONFLICT", "The durable source changed.");
        }
        if (
          durableIdentity
          && (
            identity.revision < durableIdentity.revision
            || (identity.revision === durableIdentity.revision
              && identity.sourceHash !== durableIdentity.sourceHash)
          )
        ) {
          throw new browserLab.BrowserLabError("IDE_WRITE_CONFLICT", "A stale source cannot replace newer source.");
        }
        if (!sameIdeIdentity(durableIdentity, identity)) currentReceiptArtifactKey = null;
        durableState = structuredClone(state);
        durableIdentity = { ...identity };
        recordVersion += 1;
        return identity;
      },
      stageReceipt: async (extensionId, receipt) => {
        const artifact = {
          artifactKey: [
            "receipt",
            extensionId,
            receipt.sourceHash,
            receipt.contractVersion,
            receipt.receiptId,
          ].join(":"),
          extensionId,
          sourceHash: receipt.sourceHash,
          contractVersion: receipt.contractVersion,
          receiptId: receipt.receiptId,
        };
        const call = { extensionId, receipt, artifact };
        calls.stages.push(call);
        await options.beforeStage?.(call, calls.stages.length - 1);
        artifacts.set(artifact.artifactKey, structuredClone(receipt));
        return artifact;
      },
      admitReceipt: async (extensionId, artifact, expected) => {
        const call = { extensionId, artifact, expected };
        calls.admits.push(call);
        await options.beforeAdmit?.(call, calls.admits.length - 1);
        if (
          extensionId !== artifact.extensionId
          || artifact.sourceHash !== expected.sourceHash
          || !sameIdeIdentity(durableIdentity, expected)
          || !artifacts.has(artifact.artifactKey)
        ) return false;
        currentReceiptArtifactKey = artifact.artifactKey;
        return true;
      },
      reset: async (_extensionId, rejectedToken) => {
        calls.resets += 1;
        if (options.resetError) throw options.resetError;
        await options.beforeReset?.({
          replace(state, identity = null) {
            durableState = structuredClone(state);
            durableIdentity = identity ? { ...identity } : null;
            recordVersion += 1;
          },
        });
        if (
          durableState === null
          || rejectedToken !== `memory-record:${recordVersion}`
        ) return false;
        durableState = null;
        durableIdentity = null;
        currentReceiptArtifactKey = null;
        recordVersion += 1;
        return true;
      },
    },
    calls,
    inspect: () => ({
      durableState,
      durableIdentity,
      currentReceiptArtifactKey,
      artifacts,
    }),
  };
}

test("the Browser IDE seam composes injected editor, runtime, files, checks, and persistence", async () => {
  const definition = browserLab.defineBrowserIdeExtension(ideFixture());
  const persistence = createMemoryIdePersistence();
  const runtimeInputs = [];
  let rendered;
  const session = browserLab.createBrowserIdeSession(definition, {
    editor: {
      adapterId: "test-editor",
      supports: (file) => file.loader === "ts",
      render: (model, actions) => {
        rendered = { model, actions };
        return model.path;
      },
    },
    runtime: {
      runtimeId: "test-browser-runtime",
      run: async (input) => {
        runtimeInputs.push(input);
        return receiptForIdeRun(input);
      },
    },
    persistence: persistence.adapter,
  }, { now: () => 100 });

  assert.equal((await session.initialize()).selectedPath, "src/math.ts");
  session.renderEditor();
  assert.equal(rendered.model.file.title, "Math methods");
  rendered.actions.change("export const double = (value: number) => value * 2;");
  const receipt = await rendered.actions.run();

  assert.equal(runtimeInputs.length, 1);
  assert.equal(runtimeInputs[0].snapshot.files.find((file) => file.path === "src/math.ts").contents.includes("* 2"), true);
  assert.equal(runtimeInputs[0].suite.contracts[0].id, "double");
  assert.equal(persistence.calls.saves.length, 1);
  assert.equal(persistence.calls.stages.length, 1);
  assert.equal(persistence.calls.admits.length, 1);
  assert.equal(
    persistence.inspect().currentReceiptArtifactKey,
    persistence.calls.stages[0].artifact.artifactKey,
  );
  assert.equal(receipt.status, "passed");
  assert.equal(session.getState().lastReceipt.receiptId, receipt.receiptId);
  assert.equal(session.getState().dirty, false);
  session.change("export const double = (value: number) => value + value;");
  assert.match(
    session.getReceiptState(receipt.receiptId).files
      .find((file) => file.path === "src/math.ts").contents,
    /value \* 2/,
    "receipt observers must receive the exact admitted source after a later edit",
  );
});

test("the Browser IDE runtime adapter compiles TypeScript and checks it in QuickJS", async () => {
  const definition = browserLab.defineBrowserIdeExtension(ideFixture({
    files: [
      {
        path: "src/math.ts",
        loader: "ts",
        title: "Math methods",
        editable: true,
        contents: "export const double = (value: number): number => value * 2;",
      },
    ],
  }));
  let sequence = 0;
  const runtime = browserLab.createBrowserLabIdeRuntime({
    createId: (prefix) => `${prefix}-${++sequence}`,
    now: () => 100 + sequence,
    createCompiler: () => ({
      compile: (job) => browserLab.compileVirtualProject(job, { version: esbuild.version, build: esbuild.build }),
      dispose: () => {},
    }),
    createRunner: () => ({
      runSuite: (request) => worker.handleSandboxRunRequest(
        request,
        new worker.QuickJSSandboxEngine(),
        () => {},
        () => 200 + sequence,
      ),
    }),
  });
  const session = browserLab.createBrowserIdeSession(definition, {
    editor: { adapterId: "test-editor", supports: () => true, render: () => null },
    runtime,
    persistence: createMemoryIdePersistence().adapter,
  });

  await session.initialize();
  const receipt = await session.runChecks();
  assert.equal(receipt.status, "passed");
  assert.equal(receipt.results.length, 1);
  assert.equal(receipt.results[0].passed, true);
  assert.match(receipt.sourceHash, /^sha256:[a-f0-9]{64}$/);
});

test("Browser IDE definitions fail closed on Python and checks outside declared entry points", () => {
  assert.throws(
    () => browserLab.defineBrowserIdeExtension(ideFixture({
      initialFilePath: "main.py",
      files: [{ path: "main.py", loader: "js", title: "Python", editable: true, contents: "def answer(): return 42" }],
      entryPoints: ["main.py"],
    })),
    (error) => error.code === "UNSUPPORTED_IDE_LANGUAGE",
  );
  assert.throws(
    () => browserLab.defineBrowserIdeExtension(ideFixture({
      checks: {
        ...ideFixture().checks,
        contracts: [{
          ...ideFixture().checks.contracts[0],
          cases: [{
            ...ideFixture().checks.contracts[0].cases[0],
            invoke: { modulePath: "src/constants.ts", exportName: "factor", args: [] },
          }],
        }],
      },
    })),
    (error) => error.code === "UNBOUND_IDE_CHECK",
  );
  assert.throws(
    () => browserLab.defineBrowserIdeExtension(ideFixture({
      initialFilePath: "src/constants.ts",
    })),
    (error) => error.code === "READ_ONLY_IDE_FILE",
  );
});

test("Browser IDE definitions expose logical identity and content migration fingerprints", async () => {
  const first = browserLab.defineBrowserIdeExtension(ideFixture());
  const equivalent = browserLab.defineBrowserIdeExtension(ideFixture());
  const changedSource = browserLab.defineBrowserIdeExtension(ideFixture({
    files: ideFixture().files.map((file) => (
      file.path === "src/math.ts"
        ? { ...file, contents: "export const double = (value: number) => value * 2;" }
        : file
    )),
  }));
  assert.equal(
    browserLab.browserIdeDefinitionIdentity(first),
    browserLab.browserIdeDefinitionIdentity(equivalent),
  );
  assert.equal(
    await browserLab.browserIdeDefinitionFingerprint(first),
    await browserLab.browserIdeDefinitionFingerprint(equivalent),
  );
  assert.notEqual(
    await browserLab.browserIdeDefinitionFingerprint(first),
    await browserLab.browserIdeDefinitionFingerprint(changedSource),
  );
});

test("Browser IDE persistence cannot modify a trusted read-only file", async () => {
  const definition = browserLab.defineBrowserIdeExtension(ideFixture());
  const definitionFingerprint = await browserLab.browserIdeDefinitionFingerprint(definition);
  const tampered = {
    schemaVersion: 1,
    extensionId: definition.id,
    definitionFingerprint,
    revision: 2,
    selectedPath: "src/math.ts",
    updatedAt: 100,
    files: definition.files.map(({ path, loader, contents }) => ({
      path,
      loader,
      contents: path === "src/constants.ts" ? "export const factor = 999;" : contents,
    })),
  };
  const persistence = createMemoryIdePersistence({ loaded: tampered });
  const session = browserLab.createBrowserIdeSession(definition, {
    editor: { adapterId: "test-editor", supports: () => true, render: () => null },
    runtime: { runtimeId: "test-runtime", run: (input) => receiptForIdeRun(input) },
    persistence: persistence.adapter,
  });
  const recovered = await session.initialize();
  assert.equal(recovered.recovery.code, "invalid-state");
  assert.equal(recovered.revision, 0);
  assert.equal(
    recovered.files.find((file) => file.path === "src/constants.ts").contents,
    "export const factor = 2;",
  );
  assert.equal(persistence.calls.resets, 1);
});

test("Browser IDE state recovers when the trusted definition fingerprint changes", async () => {
  const original = browserLab.defineBrowserIdeExtension(ideFixture());
  const originalFingerprint = await browserLab.browserIdeDefinitionFingerprint(original);
  const persisted = {
    schemaVersion: 1,
    extensionId: original.id,
    definitionFingerprint: originalFingerprint,
    revision: 3,
    selectedPath: "src/math.ts",
    updatedAt: 100,
    files: original.files.map(({ path, loader, contents }) => ({ path, loader, contents })),
  };
  const changed = browserLab.defineBrowserIdeExtension(ideFixture({
    files: ideFixture().files.map((file) => (
      file.path === "src/math.ts"
        ? { ...file, contents: "export const double = (value: number) => value * 2;" }
        : file
    )),
  }));
  const persistence = createMemoryIdePersistence({ loaded: persisted });
  const session = browserLab.createBrowserIdeSession(changed, {
    editor: { adapterId: "test-editor", supports: () => true, render: () => null },
    runtime: { runtimeId: "test-runtime", run: (input) => receiptForIdeRun(input) },
    persistence: persistence.adapter,
  });

  const recovered = await session.initialize();
  assert.equal(recovered.recovery.code, "definition-changed");
  assert.equal(recovered.revision, 0);
  assert.match(
    recovered.files.find((file) => file.path === "src/math.ts").contents,
    /value \* 2/,
  );
  assert.equal(persistence.calls.resets, 1);
});

test("an invalid stored record cannot brick the IDE when browser cleanup fails", async () => {
  const definition = browserLab.defineBrowserIdeExtension(ideFixture());
  const persistence = createMemoryIdePersistence({
    loaded: { invalid: true },
    resetError: new Error("storage is blocked"),
  });
  const session = browserLab.createBrowserIdeSession(definition, {
    editor: { adapterId: "test-editor", supports: () => true, render: () => null },
    runtime: { runtimeId: "test-runtime", run: (input) => receiptForIdeRun(input) },
    persistence: persistence.adapter,
  });

  const recovered = await session.initialize();
  assert.equal(recovered.revision, 0);
  assert.equal(recovered.recovery.code, "invalid-state");
  assert.match(recovered.recovery.message, /clean in-memory copy/);
  assert.equal(persistence.calls.resets, 1);
});

test("invalid-state cleanup keeps a concurrent valid repair", async () => {
  const definition = browserLab.defineBrowserIdeExtension(ideFixture());
  const definitionFingerprint = await browserLab.browserIdeDefinitionFingerprint(definition);
  const repairedState = {
    schemaVersion: 1,
    extensionId: definition.id,
    definitionFingerprint,
    revision: 4,
    selectedPath: "src/math.ts",
    updatedAt: 400,
    files: definition.files.map(({ path, loader, contents }) => ({
      path,
      loader,
      contents: path === "src/math.ts"
        ? "export const double = (value: number) => value * 2;"
        : contents,
    })),
  };
  const repairedIdentity = {
    revision: repairedState.revision,
    sourceHash: await browserLab.hashSnapshot({
      projectId: definition.id,
      revision: repairedState.revision,
      files: repairedState.files,
    }),
  };
  let repairWritten = false;
  const persistence = createMemoryIdePersistence({
    loaded: { invalid: true },
    beforeReset: ({ replace }) => {
      if (repairWritten) return;
      repairWritten = true;
      replace(repairedState, repairedIdentity);
    },
  });
  const session = browserLab.createBrowserIdeSession(definition, {
    editor: { adapterId: "test-editor", supports: () => true, render: () => null },
    runtime: { runtimeId: "test-runtime", run: (input) => receiptForIdeRun(input) },
    persistence: persistence.adapter,
  });

  const recovered = await session.initialize();
  assert.equal(recovered.revision, 4);
  assert.match(recovered.files.find((file) => file.path === "src/math.ts").contents, /value \* 2/);
  assert.match(recovered.recovery.message, /newer valid saved state/);
  assert.equal(persistence.calls.resets, 1);
  assert.equal(persistence.inspect().durableState.revision, 4);
});

test("Browser IDE sessions discard results when source changes during a run", async () => {
  const definition = browserLab.defineBrowserIdeExtension(ideFixture());
  let releaseRun;
  let runtimeInput;
  const persistence = createMemoryIdePersistence();
  const session = browserLab.createBrowserIdeSession(definition, {
    editor: { adapterId: "test-editor", supports: () => true, render: () => null },
    runtime: {
      runtimeId: "deferred-runtime",
      run: (input) => {
        runtimeInput = input;
        return new Promise((resolve) => { releaseRun = resolve; });
      },
    },
    persistence: persistence.adapter,
  });
  await session.initialize();
  const pending = session.runChecks();
  while (!runtimeInput) await new Promise((resolve) => setTimeout(resolve, 0));
  session.change("export const double = (value: number) => value * 2;");
  releaseRun(await receiptForIdeRun(runtimeInput));

  await assert.rejects(pending, (error) => error.code === "STALE_RESULT");
  assert.equal(persistence.calls.stages.length, 1);
  assert.equal(persistence.calls.admits.length, 0);
  assert.equal(persistence.inspect().currentReceiptArtifactKey, null);
  assert.equal(session.getState().lastReceipt, null);
});

test("a source edit during receipt staging cannot promote the stale artifact", async () => {
  const definition = browserLab.defineBrowserIdeExtension(ideFixture());
  let releaseStage;
  let stageStarted;
  const stageStartedPromise = new Promise((resolve) => { stageStarted = resolve; });
  const persistence = createMemoryIdePersistence({
    beforeStage: () => {
      stageStarted();
      return new Promise((resolve) => { releaseStage = resolve; });
    },
  });
  const session = browserLab.createBrowserIdeSession(definition, {
    editor: { adapterId: "test-editor", supports: () => true, render: () => null },
    runtime: { runtimeId: "test-runtime", run: (input) => receiptForIdeRun(input) },
    persistence: persistence.adapter,
  });
  await session.initialize();

  const pending = session.runChecks();
  await stageStartedPromise;
  session.change("export const double = (value: number) => value * 2;");
  releaseStage();

  await assert.rejects(pending, (error) => error.code === "STALE_RESULT");
  assert.equal(persistence.inspect().artifacts.size, 1);
  assert.equal(persistence.inspect().currentReceiptArtifactKey, null);
  assert.equal(persistence.calls.admits.length, 0);
});

test("disposing while a receipt artifact is staging prevents admission and resolution", async () => {
  const definition = browserLab.defineBrowserIdeExtension(ideFixture());
  let releaseStage;
  let signalStageStarted;
  const stageStarted = new Promise((resolve) => { signalStageStarted = resolve; });
  const persistence = createMemoryIdePersistence({
    beforeStage: () => {
      signalStageStarted();
      return new Promise((resolve) => { releaseStage = resolve; });
    },
  });
  const session = browserLab.createBrowserIdeSession(definition, {
    editor: { adapterId: "test-editor", supports: () => true, render: () => null },
    runtime: { runtimeId: "test-runtime", run: (input) => receiptForIdeRun(input) },
    persistence: persistence.adapter,
  });
  await session.initialize();

  const pending = session.runChecks();
  await stageStarted;
  session.dispose();
  releaseStage();

  await assert.rejects(pending, (error) => error.code === "IDE_DISPOSED");
  assert.equal(persistence.calls.admits.length, 0);
});

test("an already-aborted run performs no save, runtime, or receipt work", async () => {
  const definition = browserLab.defineBrowserIdeExtension(ideFixture());
  const persistence = createMemoryIdePersistence();
  let runtimeCalls = 0;
  const session = browserLab.createBrowserIdeSession(definition, {
    editor: { adapterId: "test-editor", supports: () => true, render: () => null },
    runtime: {
      runtimeId: "test-runtime",
      run: async (input) => {
        runtimeCalls += 1;
        return receiptForIdeRun(input);
      },
    },
    persistence: persistence.adapter,
  });
  await session.initialize();
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    session.runChecks({ signal: controller.signal }),
    (error) => error.code === "ABORTED",
  );
  assert.equal(persistence.calls.saves.length, 0);
  assert.equal(persistence.calls.stages.length, 0);
  assert.equal(runtimeCalls, 0);
});

test("aborting during receipt admission prevents a completed run from escaping", async () => {
  const definition = browserLab.defineBrowserIdeExtension(ideFixture());
  let releaseAdmission;
  let signalAdmissionStarted;
  const admissionStarted = new Promise((resolve) => { signalAdmissionStarted = resolve; });
  const persistence = createMemoryIdePersistence({
    beforeAdmit: () => {
      signalAdmissionStarted();
      return new Promise((resolve) => { releaseAdmission = resolve; });
    },
  });
  const session = browserLab.createBrowserIdeSession(definition, {
    editor: { adapterId: "test-editor", supports: () => true, render: () => null },
    runtime: { runtimeId: "test-runtime", run: (input) => receiptForIdeRun(input) },
    persistence: persistence.adapter,
  });
  await session.initialize();
  const controller = new AbortController();

  const pending = session.runChecks({ signal: controller.signal });
  await admissionStarted;
  controller.abort();
  releaseAdmission();

  await assert.rejects(pending, (error) => error.code === "ABORTED");
  assert.equal(session.getState().lastReceipt, null);
  assert.notEqual(
    persistence.inspect().currentReceiptArtifactKey,
    null,
    "admission may commit atomically, but an aborted caller must not publish it into session state",
  );
});

test("overlapping saves serialize and an older save cannot clear newer dirty source", async () => {
  const definition = browserLab.defineBrowserIdeExtension(ideFixture());
  let releaseFirst;
  let releaseSecond;
  const persistence = createMemoryIdePersistence({
    beforeSave: (_call, index) => new Promise((resolve) => {
      if (index === 0) releaseFirst = resolve;
      else releaseSecond = resolve;
    }),
  });
  const session = browserLab.createBrowserIdeSession(definition, {
    editor: { adapterId: "test-editor", supports: () => true, render: () => null },
    runtime: { runtimeId: "test-runtime", run: (input) => receiptForIdeRun(input) },
    persistence: persistence.adapter,
  });
  await session.initialize();

  session.change("export const double = (value: number) => value * 2;");
  const firstSave = session.save();
  while (!releaseFirst) await new Promise((resolve) => setTimeout(resolve, 0));
  session.change("export const double = (value: number) => value + value;");
  const secondSave = session.save();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(persistence.calls.saves.length, 1, "the second write must wait behind the first");

  releaseFirst();
  while (!releaseSecond) await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(session.getState().dirty, true, "the first completion must not clear newer edits");
  assert.equal(persistence.calls.saves[1].expected.revision, 1);
  assert.equal(persistence.calls.saves[1].state.revision, 2);

  releaseSecond();
  await Promise.all([firstSave, secondSave]);
  assert.equal(persistence.inspect().durableState.revision, 2);
  assert.match(
    persistence.inspect().durableState.files.find((file) => file.path === "src/math.ts").contents,
    /value \+ value/,
  );
  assert.equal(session.getState().dirty, false);
});
