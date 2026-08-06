import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import { loadPyodide } from "pyodide";

import {
  interviewIdeReferenceSolutions,
  interviewPracticeReferenceSolutions,
} from "../trusted/reference-solutions.mjs";

const library = JSON.parse(await readFile(
  new URL("../content/question-groups.json", import.meta.url),
  "utf8",
));
const { ideExercises } = await import(
  new URL("../trusted/ide-exercises.mjs", import.meta.url)
);
const questions = library.groups.flatMap((group) => group.questions.map((question) => ({
  ...question,
  groupId: group.id,
})));
const ideExercise = ideExercises[0];
const execFileAsync = promisify(execFile);
let createHarness;
const practiceReferenceSourceByQuestion = new Map(
  interviewPracticeReferenceSolutions.map((entry) => [
    `${entry.groupId}/${entry.questionId}`,
    entry.source,
  ]),
);
const ideReferenceSourceByContract = new Map(
  interviewIdeReferenceSolutions.map((entry) => [
    `${entry.exerciseId}@${entry.contractVersion}`,
    entry.source,
  ]),
);

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
  assert.equal(library.library.version, "2.1.0");
  assert.deepEqual(library.runtimes, [{
    id: "interview-host-python",
    language: "python",
    environment: "host-managed",
    engine: "pyodide",
    engineVersion: "314.0.3",
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
  assert.equal(ideExercise.contractVersion, "interview-loop.retry-plan.v4");
  assert.deepEqual(ideExercise.runtime, {
    language: "python",
    environment: "host-managed",
    engine: "pyodide",
    engineVersion: "314.0.3",
    capabilities: ["function"],
    limits: {
      timeoutMs: 10_000,
      maxOutputBytes: 50_000,
    },
  });
  for (const source of [
    ...questions.map((question) => question.starterCode),
    ideExercise.files[0].content,
  ]) {
    assert.match(
      source,
      /^def [a-z][a-z0-9_]*\((?=[^)\n]*:\s*)[^)\n]*\)\s*->\s*[^:\n]+:/,
    );
  }

  const python = await loadPyodide();
  python.FS.mkdirTree("/workspace");
  const exercises = [
    ...questions.map((question) => ({
      referenceSource: practiceReferenceSourceByQuestion.get(
        `${question.groupId}/${question.id}`,
      ),
      path: question.path,
      functionName: question.entrypoint.functionName,
      cases: question.cases,
    })),
    {
      referenceSource: ideReferenceSourceByContract.get(
        `${ideExercise.id}@${ideExercise.contractVersion}`,
      ),
      path: ideExercise.files[0].path,
      functionName: ideExercise.entrypoint.functionName,
      cases: ideCases(),
    },
  ];
  let checkedCases = 0;
  assert.equal(
    practiceReferenceSourceByQuestion.size + ideReferenceSourceByContract.size,
    exercises.length,
  );
  for (const exercise of exercises) {
    assert.match(exercise.path, /\.py$/);
    assert.equal(typeof exercise.referenceSource, "string");
    const observations = await runHarness(
      python,
      exercise.referenceSource,
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

test("authoring validation rejects a stale trusted reference identity", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "interview-loop-reference-validation-"));
  const fixtureRoot = join(temporaryRoot, "interview-loop");
  try {
    await cp(
      fileURLToPath(new URL("../", import.meta.url)),
      fixtureRoot,
      { recursive: true },
    );
    await cp(
      fileURLToPath(new URL("../../learning-suite.mjs", import.meta.url)),
      join(temporaryRoot, "learning-suite.mjs"),
    );
    const referencePath = join(fixtureRoot, "trusted/reference-solutions.mjs");
    const original = await readFile(referencePath, "utf8");
    const stale = original.replace(
      'groupId: "identity-and-signals"',
      'groupId: "retired-practice-group"',
    );
    assert.notEqual(stale, original);
    await writeFile(referencePath, stale, "utf8");

    await assert.rejects(
      execFileAsync(process.execPath, ["tools/validate.mjs"], {
        cwd: fixtureRoot,
      }),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(
          `${error.stdout ?? ""}\n${error.stderr ?? ""}`,
          /Stale trusted reference solution identity: retired-practice-group\/collapse-attempts/,
        );
        return true;
      },
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
