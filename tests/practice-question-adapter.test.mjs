import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "#vite-test-server";

const root = new URL("../", import.meta.url);
let adapter;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(root),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  adapter = await vite.ssrLoadModule("/app/features/practice/question-adapter.ts");
});

after(async () => {
  await vite?.close();
});

function question(overrides = {}) {
  return {
    id: "sum-values",
    order: 1,
    title: "Sum values",
    difficulty: "easy",
    language: "javascript",
    path: "sum-values.js",
    prompt: "Return the sum.",
    constraints: [],
    starterCode: "function sumValues(values) { return values.reduce((sum, value) => sum + value, 0); }\n",
    entrypoint: { kind: "function", functionName: "sumValues" },
    tags: ["arrays"],
    cases: [{
      id: "positive",
      label: "adds positive values",
      visibility: "example",
      args: [[2, 3, 5]],
      assertions: [
        { id: "equal", label: "returns ten", kind: "deep-equal", expected: 10 },
        { id: "finite", label: "returns a finite value", kind: "finite" },
      ],
    }],
    ...overrides,
  };
}

test("function questions map portable cases to a host-owned contract", () => {
  const runtime = adapter.adaptPracticeQuestion(question());

  assert.equal(runtime.path, "sum-values.js");
  assert.match(runtime.exportName, /^__latent_question_[a-f0-9]{8}$/);
  assert.match(runtime.source, /function __latent_question_[a-f0-9]{8}\(\.\.\.__latent_args\)/);
  assert.match(runtime.source, /return sumValues\(\.\.\.__latent_args\);/);
  assert.equal(runtime.contract.id, "sum-values");
  assert.equal(runtime.contract.label, "Sum values");
  assert.deepEqual(runtime.contract.cases[0].invoke, {
    modulePath: "sum-values.js",
    exportName: runtime.exportName,
    args: [[2, 3, 5]],
  });
  assert.deepEqual(runtime.contract.cases[0].assertions.map(({ id, kind }) => ({ id, kind })), [
    { id: "equal", kind: "deep-equal" },
    { id: "finite", kind: "finite" },
  ]);
});

test("class-method questions carry constructor and method arguments through the wrapper", () => {
  const input = question({
    id: "prefixed-sum",
    language: "typescript",
    path: "prefixed-sum.ts",
    title: "Prefixed sum",
    starterCode: `class Solution {
  constructor(private prefix: string) {}
  solve(values: number[]): string { return this.prefix + values.reduce((sum, value) => sum + value, 0); }
}
`,
    entrypoint: { kind: "class-method", className: "Solution", methodName: "solve" },
    cases: [{
      id: "basic",
      label: "constructs the solution once for the case",
      visibility: "check",
      constructorArgs: ["total="],
      args: [[4, 5]],
      assertions: [{ id: "result", label: "returns total=9", kind: "deep-equal", expected: "total=9" }],
    }],
  });
  const runtime = adapter.adaptPracticeQuestion(input, input.starterCode, {
    contractId: "arrays/prefixed-sum",
  });

  assert.equal(runtime.contract.id, "arrays/prefixed-sum");
  assert.deepEqual(runtime.contract.cases[0].invoke.args, [["total="], [[4, 5]]]);
  assert.match(runtime.source, /const __latent_instance = new Solution\(\.\.\.__latent_constructor_args\);/);
  assert.match(runtime.source, /return __latent_instance\.solve\(\.\.\.__latent_method_args\);/);
});

test("Python function and class-method wrappers stay as ordinary top-level callables", () => {
  const functionQuestion = question({
    id: "sum-values-python",
    language: "python",
    path: "sum_values.py",
    starterCode: "def sum_values(values):\n    return sum(values)\n",
    entrypoint: { kind: "function", functionName: "sum_values" },
  });
  const functionRuntime = adapter.adaptPracticeQuestion(functionQuestion);
  assert.match(functionRuntime.source, /def __latent_question_[a-f0-9]{8}\(\*__latent_args\):/);
  assert.match(functionRuntime.source, /return sum_values\(\*__latent_args\)/);

  const methodQuestion = question({
    id: "scaled-sum-python",
    language: "python",
    path: "scaled_sum.py",
    starterCode: "class Solution:\n    def __init__(self, scale):\n        self.scale = scale\n\n    def solve(self, values):\n        return self.scale * sum(values)\n",
    entrypoint: { kind: "class-method", className: "Solution", methodName: "solve" },
    cases: [{
      id: "basic",
      label: "uses constructor state",
      visibility: "check",
      constructorArgs: [3],
      args: [[2, 4]],
      assertions: [{ id: "result", label: "returns eighteen", kind: "deep-equal", expected: 18 }],
    }],
  });
  const methodRuntime = adapter.adaptPracticeQuestion(methodQuestion);
  assert.deepEqual(methodRuntime.contract.cases[0].invoke.args, [[3], [[2, 4]]]);
  assert.match(methodRuntime.source, /__latent_instance = Solution\(\*__latent_constructor_args\)/);
  assert.match(methodRuntime.source, /return __latent_instance\.solve\(\*__latent_method_args\)/);
});

test("portable exception-message assertions remain host-owned and lossless", () => {
  const runtime = adapter.adaptPracticeQuestion(question({
    cases: [{
      id: "invalid",
      label: "rejects invalid input",
      visibility: "check",
      args: [null],
      assertions: [{
        id: "throws",
        label: "explains the input",
        kind: "throws",
        errorName: "TypeError",
        messagePattern: "array",
      }],
    }],
  }));

  assert.deepEqual(runtime.contract.cases[0].assertions[0], {
    id: "throws",
    label: "explains the input",
    kind: "throws",
    errorName: "TypeError",
    messagePattern: "array",
  });
});

test("portable value assertions preserve paths, bounds, and regular-expression flags", () => {
  const assertions = [
    { id: "equal", label: "matches the value", kind: "deep-equal", expected: 4, path: ["value"] },
    { id: "type", label: "has the right type", kind: "type", expected: "number", path: ["value"] },
    { id: "truthy", label: "is truthy", kind: "truthy", path: ["value"] },
    { id: "finite", label: "is finite", kind: "finite", path: ["value"] },
    { id: "range", label: "is in range", kind: "range", minimum: 0, maximum: 10, path: ["value"] },
    { id: "length", label: "has two entries", kind: "length", expected: 2, path: ["items"] },
    { id: "includes", label: "contains four", kind: "includes", expected: 4, path: ["items"] },
    { id: "matches", label: "matches text", kind: "matches", pattern: "^done$", flags: "ims", path: ["status"] },
  ];
  const runtime = adapter.adaptPracticeQuestion(question({
    cases: [{
      id: "shape",
      label: "returns the expected shape",
      visibility: "check",
      args: [[]],
      assertions,
    }],
  }));

  assert.deepEqual(runtime.contract.cases[0].assertions, assertions);
});

test("the adapter rejects unsafe paths, invalid targets, and reserved-name collisions", () => {
  assert.throws(
    () => adapter.adaptPracticeQuestion(question({ path: "../sum-values.js" })),
    /unsafe source path/,
  );
  assert.throws(
    () => adapter.adaptPracticeQuestion(question({
      entrypoint: { kind: "function", functionName: "not-valid!" },
    })),
    /invalid function name/,
  );
  assert.throws(
    () => adapter.adaptPracticeQuestion(question({
      cases: [{
        id: "case",
        label: "case",
        visibility: "check",
        args: [],
        constructorArgs: [],
        assertions: [{ id: "result", label: "result", kind: "truthy" }],
      }],
    })),
    /cannot define constructor arguments/,
  );

  const input = question();
  const reservedName = adapter.practiceQuestionExportName(input);
  assert.throws(
    () => adapter.adaptPracticeQuestion(input, `${input.starterCode}\nconst ${reservedName} = 1;`),
    /reserved runtime export/,
  );
});
