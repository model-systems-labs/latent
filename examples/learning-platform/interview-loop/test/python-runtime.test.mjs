import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { build } from "esbuild";

const library = JSON.parse(await readFile(
  new URL("../content/question-groups.json", import.meta.url),
  "utf8",
));
const question = library.groups[0].questions[0];
const requirement = library.runtimes[0];
const exerciseCase = question.cases[0];
let runtimeModule;

test.before(async () => {
  const result = await build({
    entryPoints: [
      new URL(
        "../trusted/python-exercise-runtime.ts",
        import.meta.url,
      ).pathname,
    ],
    absWorkingDir: new URL("../../../..", import.meta.url).pathname,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    write: false,
  });
  runtimeModule = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
  );
});

function request(overrides = {}) {
  return {
    source: question.starterCode,
    path: question.path,
    entrypoint: question.entrypoint,
    cases: [exerciseCase],
    requirement,
    ...overrides,
  };
}

function returned(value, purity) {
  return [{
    caseId: exerciseCase.id,
    observation: {
      status: "returned",
      value,
      purity,
    },
  }];
}

function fakeClient(result, calls) {
  return {
    async initialize(payload, options) {
      calls.initialize = { payload, options };
      return {
        schemaVersion: 1,
        runtime: "pyodide",
        runtimeVersion: "314.0.2",
        pythonVersion: "3.14.0",
        packages: [],
        guardrailsApplied: true,
        capabilityReduced: true,
      };
    },
    async sync(payload, options) {
      calls.sync = { payload, options };
      return {
        schemaVersion: 1,
        revision: 1,
        files: payload.files.map((file) => file.path),
      };
    },
    async run(payload, options) {
      calls.run = { payload, options };
      return {
        schemaVersion: 1,
        requestId: "fake",
        kind: "run",
        status: "completed",
        result,
        artifacts: [],
      };
    },
    dispose() {
      calls.disposed = true;
    },
  };
}

test("the adapter admits only the exact pinned host-managed Python profile", () => {
  assert.equal(runtimeModule.supportsInterviewPython(requirement), true);
  for (const changed of [
    { ...requirement, language: "javascript" },
    { ...requirement, environment: "browser-worker" },
    { ...requirement, engine: "cpython" },
    { ...requirement, engineVersion: "314.0.1" },
    { ...requirement, capabilities: [] },
  ]) {
    assert.equal(runtimeModule.supportsInterviewPython(changed), false);
  }
});

test("the trusted harness checks input values and aliases before normalization", () => {
  const harness = runtimeModule.createPythonInvocationHarness(
    question.path,
    question.entrypoint.functionName,
    [exerciseCase],
  );
  assert.match(harness, /_latent_snapshot = _latent_copy\.deepcopy/);
  assert.match(harness, /_latent_input_ids = _latent_container_ids/);
  assert.match(harness, /"inputUnchanged": _latent_args == _latent_snapshot/);
  assert.match(harness, /"outputFresh": not _latent_aliases_input/);
  assert.ok(
    harness.indexOf('"outputFresh": not _latent_aliases_input')
      < harness.indexOf('"value": _latent_normalize'),
  );
});

test("value-correct post-call changes and alias evidence fail while pure evidence passes", async () => {
  const expected = exerciseCase.assertions[0].expected;
  const evidence = [
    {
      purity: { inputUnchanged: false, outputFresh: true },
      failedAssertion: "platform-input-unchanged",
    },
    {
      purity: { inputUnchanged: true, outputFresh: false },
      failedAssertion: "platform-output-fresh",
    },
    {
      purity: { inputUnchanged: true, outputFresh: true },
      failedAssertion: null,
    },
  ];

  for (const sample of evidence) {
    const calls = {};
    const adapter = runtimeModule.createInterviewPythonRuntime({
      createClient() {
        return fakeClient(returned(expected, sample.purity), calls);
      },
    });
    const [result] = await adapter.run(request());
    assert.equal(result.passed, sample.failedAssertion === null);
    if (sample.failedAssertion) {
      assert.equal(
        result.assertions.find((entry) => entry.id === sample.failedAssertion)?.passed,
        false,
      );
    }
    assert.deepEqual(calls.initialize.payload, { packages: [] });
    assert.equal(calls.initialize.options.timeoutMs, 120_000);
    assert.equal(calls.sync.payload.files[0].path, "collapse_attempts.py");
    assert.match(calls.sync.payload.files[0].contents, /^def collapse_attempts/);
    assert.equal(calls.run.options.timeoutMs, 10_000);
    assert.equal(calls.disposed, true);
  }
});

test("an incomplete Python result fails closed and disposes the worker", async () => {
  const calls = {};
  const adapter = runtimeModule.createInterviewPythonRuntime({
    createClient() {
      return fakeClient([], calls);
    },
  });
  await assert.rejects(adapter.run(request()), /incomplete case set/);
  assert.equal(calls.disposed, true);
});
