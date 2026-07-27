import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { build } from "esbuild";

const library = JSON.parse(await readFile(
  new URL("../content/question-groups.json", import.meta.url),
  "utf8",
));
const question = library.groups[0].questions[0];
const runtimeRequirement = library.runtimes[0];
let runtimeModule;

test.before(async () => {
  const result = await build({
    entryPoints: [
      new URL(
        "../trusted/python-question-runtime.ts",
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
  const source = result.outputFiles[0].text;
  runtimeModule = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  );
});

function request(overrides = {}) {
  return {
    question,
    runtime: runtimeRequirement,
    contractVersion: "question-groups-v1:test",
    source: question.starterCode,
    mode: "examples",
    ...overrides,
  };
}

function returnedCases(cases, alterFirst = false) {
  return cases.map((exerciseCase, index) => ({
    caseId: exerciseCase.id,
    observation: {
      status: "returned",
      value: alterFirst && index === 0
        ? "definitely-wrong"
        : exerciseCase.assertions[0].expected,
    },
  }));
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

test("the injected adapter supports only the exact pinned Python profile", () => {
  const adapter = runtimeModule.createPythonQuestionRuntime({
    assetRoot: "./assets/",
    createClient() {
      throw new Error("not used");
    },
  });
  assert.equal(adapter.supports(runtimeRequirement), true);
  for (const changed of [
    { ...runtimeRequirement, language: "javascript" },
    { ...runtimeRequirement, environment: "browser-worker" },
    { ...runtimeRequirement, engine: "cpython" },
    { ...runtimeRequirement, engineVersion: "314.0.1" },
    { ...runtimeRequirement, capabilities: [] },
  ]) {
    assert.equal(adapter.supports(changed), false);
  }
});

test("example and check runs map CPython observations into host-owned assertions", async () => {
  const calls = [];
  const resultQueue = [
    returnedCases(question.cases.filter((entry) => entry.visibility === "example")),
    returnedCases(question.cases, true),
  ];
  const adapter = runtimeModule.createPythonQuestionRuntime({
    assetRoot: "./assets/",
    createClient() {
      const call = {};
      calls.push(call);
      return fakeClient(resultQueue.shift(), call);
    },
  });

  const examples = await adapter.run(request());
  assert.equal(examples.passed, true);
  assert.deepEqual(examples.cases.map((entry) => entry.id), [
    "interleaved-repeats",
  ]);
  assert.equal(examples.cases[0].assertions[0].passed, true);

  const check = await adapter.run(request({ mode: "check" }));
  assert.equal(check.passed, false);
  assert.equal(check.cases.length, 4);
  assert.equal(check.cases[0].assertions[0].passed, false);

  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.deepEqual(call.initialize.payload, { packages: [] });
    assert.equal(call.initialize.options.timeoutMs, 120_000);
    assert.equal(call.sync.payload.files[0].path, "first-echo.py");
    assert.match(
      call.sync.payload.files[0].contents,
      /def __latent_question_[a-f0-9]{8}\(\*__latent_args\):/,
    );
    assert.equal(call.run.options.timeoutMs, 10_000);
    assert.match(call.run.payload.code, /_latent_runpy\.run_path/);
    assert.match(call.run.payload.code, /\[\[4,1,7,1,4\]\]/);
    assert.doesNotMatch(call.run.payload.code, /\"args\":null/);
    assert.equal(call.disposed, true);
  }
});

test("an incomplete worker result fails closed and still disposes the worker", async () => {
  const calls = {};
  const adapter = runtimeModule.createPythonQuestionRuntime({
    assetRoot: "./assets/",
    createClient() {
      return fakeClient([], calls);
    },
  });
  await assert.rejects(
    adapter.run(request()),
    /incomplete case set/,
  );
  assert.equal(calls.disposed, true);
});
