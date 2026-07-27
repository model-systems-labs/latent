import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { build } from "esbuild";
import { loadPyodide } from "pyodide";

const library = JSON.parse(await readFile(
  new URL("../content/question-groups.json", import.meta.url),
  "utf8",
));
const { ideExercises } = await import(
  new URL("../trusted/ide-exercises.mjs", import.meta.url)
);
const questions = library.groups.flatMap((group) => group.questions);
const ideExercise = ideExercises[0];
let createHarness;

const referenceSources = {
  collapse_attempts: `def collapse_attempts(attempts):
    seen = set()
    output = []
    for attempt in attempts:
        delivery_id = attempt["deliveryId"]
        if delivery_id not in seen:
            seen.add(delivery_id)
            output.append({
                "deliveryId": delivery_id,
                "status": attempt["status"],
            })
    return output
`,
  summarize_window: `def summarize_window(events, start_ms):
    traffic = 0
    errors = 0
    max_latency_ms = 0
    for event in events:
        if event["atMs"] >= start_ms:
            traffic += 1
            if event["outcome"] == "error":
                errors += 1
            max_latency_ms = max(max_latency_ms, event["latencyMs"])
    return {
        "traffic": traffic,
        "errors": errors,
        "maxLatencyMs": max_latency_ms,
    }
`,
  admit_per_tenant: `def admit_per_tenant(jobs, limit):
    admitted = []
    counts = {}
    for job in jobs:
        tenant = job["tenant"]
        if counts.get(tenant, 0) < limit:
            admitted.append(job["id"])
            counts[tenant] = counts.get(tenant, 0) + 1
    return admitted
`,
  schedule_retries: `def schedule_retries(deliveries, now_ms):
    delays = {1: 1000, 2: 2000, 3: 4000}
    output = []
    for delivery in deliveries:
        delay = delays.get(delivery["attempt"])
        if delivery["outcome"] == "retryable" and delay is not None:
            output.append({
                "deliveryId": delivery["deliveryId"],
                "runAtMs": now_ms + delay,
            })
    return output
`,
};

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
  const runtimeModule = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
  );
  createHarness = runtimeModule.createPythonInvocationHarness;
});

function ideCases() {
  return ideExercise.checks.map((check) => ({
    id: check.id,
    label: check.label,
    args: check.args,
    assertions: [{
      id: check.id,
      label: check.label,
      kind: "deep-equal",
      expected: check.expected,
    }],
  }));
}

async function runHarness(python, source, path, functionName, cases) {
  python.FS.writeFile(`/workspace/${path}`, source);
  await python.runPythonAsync(createHarness(path, functionName, cases));
  const resultProxy = python.globals.get("RESULT");
  try {
    return resultProxy.toJs({
      dict_converter: Object.fromEntries,
    });
  } finally {
    resultProxy.destroy();
    python.globals.delete("RESULT");
  }
}

test("all four exercises declare Python and all 13 authored cases pass", {
  timeout: 45_000,
}, async () => {
  assert.equal(library.library.version, "2.0.0");
  assert.deepEqual(library.runtimes, [{
    id: "interview-host-python",
    language: "python",
    environment: "host-managed",
    engine: "pyodide",
    engineVersion: "314.0.2",
    capabilities: ["function"],
    limits: {
      timeoutMs: 10_000,
      maxOutputBytes: 50_000,
    },
  }]);
  assert.equal(questions.length, 3);
  assert.equal(
    questions.reduce((total, question) => total + question.cases.length, 0),
    9,
  );
  assert.equal(ideExercise.language, "python");
  assert.equal(ideExercise.contractVersion, "interview-loop.retry-plan.v3");
  assert.deepEqual(ideExercise.runtime, {
    language: "python",
    environment: "host-managed",
    engine: "pyodide",
    engineVersion: "314.0.2",
    capabilities: ["function"],
    limits: {
      timeoutMs: 10_000,
      maxOutputBytes: 50_000,
    },
  });

  const python = await loadPyodide();
  python.FS.mkdirTree("/workspace");
  const exercises = [
    ...questions.map((question) => ({
      path: question.path,
      functionName: question.entrypoint.functionName,
      cases: question.cases,
    })),
    {
      path: ideExercise.files[0].path,
      functionName: ideExercise.entrypoint.functionName,
      cases: ideCases(),
    },
  ];
  let checkedCases = 0;
  for (const exercise of exercises) {
    assert.match(exercise.path, /\.py$/);
    const observations = await runHarness(
      python,
      referenceSources[exercise.functionName],
      exercise.path,
      exercise.functionName,
      exercise.cases,
    );
    assert.equal(observations.length, exercise.cases.length);
    for (const [index, envelope] of observations.entries()) {
      const expected = exercise.cases[index].assertions[0].expected;
      assert.equal(envelope.observation.status, "returned");
      assert.deepEqual(envelope.observation.value, expected);
      assert.deepEqual(envelope.observation.purity, {
        inputUnchanged: true,
        outputFresh: true,
      });
      checkedCases += 1;
    }
  }
  assert.equal(checkedCases, 13);
});

test("real Python detects post-call input changes and nested output aliasing", {
  timeout: 30_000,
}, async () => {
  const python = await loadPyodide();
  python.FS.mkdirTree("/workspace");
  const [exerciseCase] = questions[0].cases;
  const path = questions[0].path;
  const functionName = questions[0].entrypoint.functionName;
  const expected = exerciseCase.assertions[0].expected;
  const samples = [
    {
      source: `def collapse_attempts(attempts):
    output = [
        {"deliveryId": "evt-a", "status": "accepted"},
        {"deliveryId": "evt-b", "status": "failed"},
    ]
    attempts.pop()
    return output
`,
      purity: { inputUnchanged: false, outputFresh: true },
    },
    {
      source: `def collapse_attempts(attempts):
    return [attempts[0], attempts[1]]
`,
      purity: { inputUnchanged: true, outputFresh: false },
    },
    {
      source: `def collapse_attempts(attempts):
    return [dict(attempts[0]), dict(attempts[1])]
`,
      purity: { inputUnchanged: true, outputFresh: true },
    },
  ];
  for (const sample of samples) {
    const [envelope] = await runHarness(
      python,
      sample.source,
      path,
      functionName,
      [exerciseCase],
    );
    assert.equal(envelope.observation.status, "returned");
    assert.deepEqual(envelope.observation.value, expected);
    assert.deepEqual(envelope.observation.purity, sample.purity);
  }
});
