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
        runtimeVersion: "314.0.3",
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
  assert.equal(adapter.supportsEditableExamples, true);
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
  assert.deepEqual(examples.cases[0].input, [[4, 1, 7, 1, 4]]);
  assert.deepEqual(examples.cases[0].expected, [1]);
  assert.equal(examples.cases[0].actual, 1);
  assert.equal(Object.hasOwn(examples.cases[0], "observation"), false);

  const check = await adapter.run(request({ mode: "check" }));
  assert.equal(check.passed, false);
  assert.equal(check.cases.length, 4);
  assert.equal(check.cases[0].assertions[0].passed, false);
  assert.equal(check.cases[0].actual, "definitely-wrong");
  assert.equal(Object.hasOwn(check.cases[0], "observation"), false);

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

test("a trusted custom example reaches Python and exposes actual output independently of the published assertion", async () => {
  const calls = {};
  const publicCase = question.cases.find((entry) => entry.visibility === "example");
  const customCase = {
    ...publicCase,
    args: [[4, 1, 7, 4, 1]],
  };
  const scopedQuestion = {
    ...question,
    cases: [customCase],
  };
  const adapter = runtimeModule.createPythonQuestionRuntime({
    assetRoot: "./assets/",
    createClient() {
      return fakeClient([{
        caseId: customCase.id,
        observation: {
          status: "returned",
          value: 4,
        },
      }], calls);
    },
  });

  const outcome = await adapter.run(request({
    question: scopedQuestion,
    includeObservation: true,
  }));

  assert.equal(outcome.passed, false);
  assert.deepEqual(outcome.cases[0].observation, {
    status: "returned",
    value: 4,
  });
  assert.equal(outcome.cases[0].actual, 4);
  assert.match(calls.run.payload.code, /\[\[4,1,7,4,1\]\]/);
  assert.equal(calls.disposed, true);
});

test("trusted custom examples expose thrown observations without changing canonical results", async () => {
  const calls = {};
  const publicCase = question.cases.find((entry) => entry.visibility === "example");
  const scopedQuestion = {
    ...question,
    cases: [publicCase],
  };
  const adapter = runtimeModule.createPythonQuestionRuntime({
    assetRoot: "./assets/",
    createClient() {
      return fakeClient([{
        caseId: publicCase.id,
        observation: {
          status: "threw",
          errorName: "ValueError",
          message: "custom input is unsupported",
        },
      }], calls);
    },
  });

  const outcome = await adapter.run(request({
    question: scopedQuestion,
    includeObservation: true,
  }));

  assert.deepEqual(outcome.cases[0].observation, {
    status: "threw",
    errorName: "ValueError",
    message: "custom input is unsupported",
  });
  assert.deepEqual(outcome.cases[0].actual, {
    errorName: "ValueError",
    message: "custom input is unsupported",
  });
  assert.equal(calls.disposed, true);
});

test("canonical Python runs retain their prior output budget near the declared limit", async () => {
  const publicCase = question.cases.find((entry) => entry.visibility === "example");
  const returnedValue = "x".repeat(1_200);
  const scopedCase = {
    ...publicCase,
    assertions: [{
      id: "result",
      label: "returns text",
      kind: "type",
      expected: "string",
    }],
  };
  const scopedQuestion = {
    ...question,
    cases: [scopedCase],
  };
  const result = [{
    caseId: scopedCase.id,
    observation: {
      status: "returned",
      value: returnedValue,
    },
  }];
  const runWithLimit = async (maxOutputBytes, includeObservation = false) => {
    const calls = {};
    const adapter = runtimeModule.createPythonQuestionRuntime({
      assetRoot: "./assets/",
      createClient() {
        return fakeClient(result, calls);
      },
    });
    return adapter.run(request({
      question: scopedQuestion,
      runtime: {
        ...runtimeRequirement,
        limits: {
          ...runtimeRequirement.limits,
          maxOutputBytes,
        },
      },
      includeObservation,
    }));
  };

  const baseline = await runWithLimit(100_000);
  assert.equal(Object.hasOwn(baseline.cases[0], "observation"), false);
  const baselineBytes = new TextEncoder().encode(
    JSON.stringify(baseline),
  ).byteLength;
  const duplicatedBytes = new TextEncoder().encode(JSON.stringify({
    ...baseline,
    cases: [{
      ...baseline.cases[0],
      observation: result[0].observation,
    }],
  })).byteLength;
  assert.ok(duplicatedBytes > baselineBytes);

  const nearLimit = await runWithLimit(baselineBytes);
  assert.equal(Object.hasOwn(nearLimit.cases[0], "observation"), false);
  await assert.rejects(
    runWithLimit(baselineBytes, true),
    /exceeded its declared output limit/,
  );
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
