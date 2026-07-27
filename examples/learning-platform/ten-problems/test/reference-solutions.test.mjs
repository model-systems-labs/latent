import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { loadPyodide } from "pyodide";

import { tenProblemsReferenceSolutions } from "../trusted/reference-solutions.mjs";

const library = JSON.parse(await readFile(
  new URL("../content/question-groups.json", import.meta.url),
  "utf8",
));
const questions = library.groups.flatMap((group) => group.questions.map((question) => ({
  ...question,
  groupId: group.id,
})));
const referenceSourceByQuestion = new Map(tenProblemsReferenceSolutions.map((entry) => [
  `${entry.groupId}/${entry.questionId}`,
  entry.source,
]));

test("all ten portable contracts declare the pinned host-managed Python runtime", () => {
  assert.equal(library.library.version, "2.0.0");
  assert.deepEqual(library.runtimes, [{
    id: "host-python",
    language: "python",
    environment: "host-managed",
    engine: "pyodide",
    engineVersion: "314.0.2",
    capabilities: ["function"],
    limits: {
      timeoutMs: 10_000,
      maxOutputBytes: 100_000,
    },
  }]);
  assert.equal(questions.length, 10);
  assert.equal(
    questions.reduce((total, question) => total + question.cases.length, 0),
    39,
  );
  assert.equal(referenceSourceByQuestion.size, questions.length);
  for (const question of questions) {
    assert.equal(question.language, "python");
    assert.match(question.path, /\.py$/);
    assert.equal(question.runtimeId, "host-python");
    assert.match(question.starterCode, /^def [a-z][a-z0-9_]*\(/);
    assert.equal(
      typeof referenceSourceByQuestion.get(`${question.groupId}/${question.id}`),
      "string",
    );
    for (const exerciseCase of question.cases) {
      assert.equal(exerciseCase.assertions.length, 1);
      assert.equal(exerciseCase.assertions[0].kind, "deep-equal");
    }
  }
});

test("real Python reference implementations satisfy all 39 authored cases", {
  timeout: 30_000,
}, async () => {
  const python = await loadPyodide();
  for (const question of questions) {
    const functionName = question.entrypoint.functionName;
    const referenceSource = referenceSourceByQuestion.get(
      `${question.groupId}/${question.id}`,
    );
    assert.equal(typeof referenceSource, "string");
    const cases = question.cases.map((exerciseCase) => ({
      id: exerciseCase.id,
      args: exerciseCase.args,
      expected: exerciseCase.assertions[0].expected,
    }));
    python.globals.set("__latent_reference_source", referenceSource);
    python.globals.set("__latent_reference_name", functionName);
    python.globals.set("__latent_reference_cases", JSON.stringify(cases));
    let result;
    try {
      result = JSON.parse(await python.runPythonAsync(`
import json as _latent_json

_latent_namespace = {"__name__": "__latent_reference__"}
exec(
    compile(__latent_reference_source, "<reference>", "exec"),
    _latent_namespace,
)
_latent_function = _latent_namespace[__latent_reference_name]
_latent_cases = _latent_json.loads(__latent_reference_cases)
_latent_results = []
for _latent_case in _latent_cases:
    _latent_results.append({
        "id": _latent_case["id"],
        "actual": _latent_function(*_latent_case["args"]),
    })
_latent_json.dumps(_latent_results, allow_nan=False, separators=(",", ":"))
`));
    } finally {
      python.globals.delete("__latent_reference_source");
      python.globals.delete("__latent_reference_name");
      python.globals.delete("__latent_reference_cases");
    }
    assert.deepEqual(
      result,
      cases.map((exerciseCase) => ({
        id: exerciseCase.id,
        actual: exerciseCase.expected,
      })),
      question.id,
    );
  }
});
