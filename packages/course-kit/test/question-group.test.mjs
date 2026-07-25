import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  canonicalQuestionGroupLibraryJson,
  parseQuestionGroupLibraryJson,
  QUESTION_GROUP_LIBRARY_FORMAT,
  QUESTION_GROUP_LIBRARY_SCHEMA_VERSION,
  questionGroupLibraryJsonSchema,
  questionGroupLibrarySchema,
  validateQuestionGroupLibrary,
} from "../dist/index.js";
import * as questionGroupSubpath from "../dist/question-group.js";

function question(overrides = {}) {
  return {
    id: "sum-values",
    order: 1,
    title: "Sum two values",
    prompt: "Implement the requested entrypoint so that it returns the sum of both numeric inputs.",
    difficulty: "easy",
    language: "javascript",
    path: "solution.js",
    starterCode: "export function sumValues(left, right) {\n  // Your code here.\n}\n",
    entrypoint: { kind: "function", functionName: "sumValues" },
    objectiveIds: ["add-values"],
    sourceIds: ["original-library"],
    runtimeId: "browser-javascript",
    constraints: ["Both arguments are finite JSON numbers."],
    cases: [
      {
        id: "small-values",
        label: "Adds two small values",
        visibility: "example",
        args: [2, 3],
        assertions: [{
          id: "expected-sum",
          label: "Returns the expected sum",
          kind: "deep-equal",
          expected: 5,
        }],
      },
      {
        id: "negative-value",
        label: "Adds a negative value",
        visibility: "check",
        args: [-3, 8],
        assertions: [
          {
            id: "finite-result",
            label: "Returns a finite result",
            kind: "finite",
          },
          {
            id: "expected-negative-sum",
            label: "Returns the expected signed sum",
            kind: "deep-equal",
            expected: 5,
          },
        ],
      },
    ],
    tags: ["arithmetic", "functions"],
    ...overrides,
  };
}

function library(overrides = {}) {
  return {
    format: QUESTION_GROUP_LIBRARY_FORMAT,
    schemaVersion: QUESTION_GROUP_LIBRARY_SCHEMA_VERSION,
    library: {
      id: "model-systems-labs/method-practice",
      version: "1.0.0",
      title: "Method practice",
      description: "Small programming questions designed for focused, repeatable practice.",
      authors: [{
        name: "Model Systems Labs",
        url: "https://github.com/model-systems-labs",
      }],
      license: {
        expression: "Apache-2.0",
        url: "https://www.apache.org/licenses/LICENSE-2.0",
      },
      provenance: {
        sourceUrl: "https://github.com/model-systems-labs/latent",
        revision: "test-fixture-1.0.0",
      },
    },
    objectives: [{
      id: "add-values",
      title: "Implement numeric functions",
      description: "Implement and verify a bounded function over finite JSON numbers.",
    }],
    sources: [{
      id: "original-library",
      title: "Original Course Kit test fixture",
      url: "https://github.com/model-systems-labs/latent/tree/main/packages/course-kit/test",
      note: "Original practice content used to verify the public Question Group contract.",
      license: { expression: "Apache-2.0" },
    }],
    runtimes: [{
      id: "browser-javascript",
      language: "javascript",
      environment: "browser-worker",
      engine: "esbuild-wasm",
      engineVersion: "0.28.1",
      capabilities: ["function", "class-method", "exceptions"],
      limits: { timeoutMs: 1_000, maxOutputBytes: 50_000 },
    }],
    groups: [{
      id: "warmups",
      order: 1,
      title: "Warmups",
      description: "Short function and method exercises that establish the portable question contract.",
      objectiveIds: ["add-values"],
      questions: [question()],
      tags: ["fundamentals"],
    }],
    ...overrides,
  };
}

function copy(value) {
  return structuredClone(value);
}

test("validates a strict question-group library and reports useful totals", () => {
  const validation = validateQuestionGroupLibrary(library());
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.warnings, []);
  assert.deepEqual(validation.summary, {
    groups: 1,
    questions: 1,
    cases: 2,
    exampleCases: 1,
    checkCases: 1,
  });
  assert.equal(validation.library.format, "latent-question-group-library");
});

test("supports JavaScript, TypeScript, and Python function and class-method entrypoints", () => {
  const configurations = [
    {
      language: "javascript",
      path: "solution.js",
      entrypoint: { kind: "function", functionName: "solve" },
    },
    {
      language: "javascript",
      path: "solution.mjs",
      entrypoint: { kind: "class-method", className: "Solution", methodName: "solve" },
    },
    {
      language: "typescript",
      path: "solution.ts",
      entrypoint: { kind: "function", functionName: "solve" },
    },
    {
      language: "typescript",
      path: "solution.ts",
      entrypoint: { kind: "class-method", className: "Solution", methodName: "solve" },
    },
    {
      language: "python",
      path: "solution.py",
      entrypoint: { kind: "function", functionName: "solve" },
    },
    {
      language: "python",
      path: "solution.py",
      entrypoint: { kind: "class-method", className: "Solution", methodName: "solve" },
    },
  ];

  for (const configuration of configurations) {
    const input = library();
    Object.assign(input.groups[0].questions[0], configuration);
    input.runtimes[0].language = configuration.language;
    input.runtimes[0].environment = configuration.language === "python"
      ? "host-managed"
      : "browser-worker";
    assert.equal(
      validateQuestionGroupLibrary(input).valid,
      true,
      `${configuration.language} ${configuration.entrypoint.kind}`,
    );
  }
});

test("portable assertions cover value, shape, pattern, and error checks", () => {
  const input = library();
  input.groups[0].questions[0].cases[1].assertions = [
    { id: "type", label: "Is an array", kind: "type", expected: "array" },
    { id: "truthy", label: "Has a result", kind: "truthy", path: [0] },
    { id: "finite", label: "Starts finite", kind: "finite", path: [0] },
    { id: "range", label: "Stays in range", kind: "range", path: [0], minimum: 0, maximum: 10 },
    { id: "length", label: "Has two entries", kind: "length", expected: 2 },
    { id: "includes", label: "Includes five", kind: "includes", expected: 5 },
    { id: "matches", label: "Matches output", kind: "matches", pattern: "^ok$", flags: "i" },
  ];
  assert.equal(validateQuestionGroupLibrary(input).valid, true);

  input.groups[0].questions[0].cases[1].assertions = [{
    id: "throws",
    label: "Rejects bad input",
    kind: "throws",
    errorName: "TypeError",
    messagePattern: "finite",
  }];
  assert.equal(validateQuestionGroupLibrary(input).valid, true);
});

test("rejects unknown fields and unsupported source-language shapes", () => {
  const unknownField = library();
  unknownField.groups[0].questions[0].untrusted = true;
  assert.equal(validateQuestionGroupLibrary(unknownField).valid, false);

  const unsupportedLanguage = library();
  unsupportedLanguage.groups[0].questions[0].language = "ruby";
  assert.equal(validateQuestionGroupLibrary(unsupportedLanguage).valid, false);

  const mismatchedPath = library();
  mismatchedPath.groups[0].questions[0].language = "python";
  mismatchedPath.groups[0].questions[0].path = "solution.ts";
  assert.match(
    validateQuestionGroupLibrary(mismatchedPath).errors.map((entry) => entry.code).join("\n"),
    /language-path-mismatch/,
  );

  const unsafePath = library();
  unsafePath.groups[0].questions[0].path = "../solution.js";
  assert.equal(validateQuestionGroupLibrary(unsafePath).valid, false);

  const currentDirectoryPath = library();
  currentDirectoryPath.groups[0].questions[0].path = "./solution.js";
  assert.equal(validateQuestionGroupLibrary(currentDirectoryPath).valid, false);

  const nestedCurrentDirectoryPath = library();
  nestedCurrentDirectoryPath.groups[0].questions[0].path = "src/./solution.js";
  assert.equal(validateQuestionGroupLibrary(nestedCurrentDirectoryPath).valid, false);

  const invalidPythonName = library();
  invalidPythonName.groups[0].questions[0].language = "python";
  invalidPythonName.groups[0].questions[0].path = "solution.py";
  invalidPythonName.groups[0].questions[0].entrypoint.functionName = "$solve";
  assert.match(
    validateQuestionGroupLibrary(invalidPythonName).errors.map((entry) => entry.code).join("\n"),
    /invalid-python-identifier/,
  );

  const reservedJavascriptName = library();
  reservedJavascriptName.groups[0].questions[0].entrypoint.functionName = "class";
  assert.match(
    validateQuestionGroupLibrary(reservedJavascriptName).errors
      .map((entry) => entry.code)
      .join("\n"),
    /reserved-entrypoint-identifier/,
  );

  const reservedPythonName = library();
  reservedPythonName.groups[0].questions[0].language = "python";
  reservedPythonName.groups[0].questions[0].path = "solution.py";
  reservedPythonName.groups[0].questions[0].entrypoint.functionName = "def";
  assert.match(
    validateQuestionGroupLibrary(reservedPythonName).errors
      .map((entry) => entry.code)
      .join("\n"),
    /reserved-entrypoint-identifier/,
  );
});

test("validates provenance, objectives, sources, runtimes, and inert extensions", () => {
  const unknownObjective = library();
  unknownObjective.groups[0].questions[0].objectiveIds = ["missing-objective"];
  assert.match(
    validateQuestionGroupLibrary(unknownObjective).errors.map((entry) => entry.code).join("\n"),
    /unknown-objective/,
  );

  const unknownSource = library();
  unknownSource.groups[0].questions[0].sourceIds = ["missing-source"];
  assert.match(
    validateQuestionGroupLibrary(unknownSource).errors.map((entry) => entry.code).join("\n"),
    /unknown-source/,
  );

  const unknownRuntime = library();
  unknownRuntime.groups[0].questions[0].runtimeId = "missing-runtime";
  assert.match(
    validateQuestionGroupLibrary(unknownRuntime).errors.map((entry) => entry.code).join("\n"),
    /unknown-runtime/,
  );

  const mismatchedRuntime = library();
  mismatchedRuntime.runtimes[0].language = "typescript";
  assert.match(
    validateQuestionGroupLibrary(mismatchedRuntime).errors.map((entry) => entry.code).join("\n"),
    /runtime-language-mismatch/,
  );

  const browserPython = library();
  browserPython.runtimes[0].language = "python";
  assert.match(
    validateQuestionGroupLibrary(browserPython).errors.map((entry) => entry.code).join("\n"),
    /unsupported-portable-python-runtime/,
  );

  const missingCapability = library();
  missingCapability.runtimes[0].capabilities = ["class-method"];
  assert.match(
    validateQuestionGroupLibrary(missingCapability).errors.map((entry) => entry.code).join("\n"),
    /missing-runtime-capability/,
  );

  const inertExtension = library({ extensions: {
    "example.org/review-style": { spacing: "daily", weight: 2 },
  } });
  assert.equal(validateQuestionGroupLibrary(inertExtension).valid, true);

  const executableLookingField = library({ extensions: {
    runtime: { module: "https://example.com/run.js" },
  } });
  assert.equal(
    validateQuestionGroupLibrary(executableLookingField).valid,
    false,
    "extension keys must be namespaced and cannot become runtime hooks",
  );

  const credentialUrl = library();
  credentialUrl.library.provenance.sourceUrl = "https://user:secret@example.com/private";
  assert.equal(validateQuestionGroupLibrary(credentialUrl).valid, false);

  const movingRevision = library();
  movingRevision.library.provenance.revision = "main";
  assert.match(
    validateQuestionGroupLibrary(movingRevision).errors.map((entry) => entry.code).join("\n"),
    /mutable-provenance-revision/,
  );

  const objectiveOutsideGroup = library();
  objectiveOutsideGroup.objectives.push({
    id: "advanced-values",
    title: "Implement advanced values",
    description: "Implement a second objective that is not assigned to the containing group.",
  });
  objectiveOutsideGroup.groups[0].questions[0].objectiveIds = ["advanced-values"];
  assert.match(
    validateQuestionGroupLibrary(objectiveOutsideGroup).errors.map((entry) => entry.code).join("\n"),
    /objective-outside-group/,
  );
});

test("requires example and check cases and stable unique identities", () => {
  const missingExample = library();
  missingExample.groups[0].questions[0].cases.forEach((practiceCase) => {
    practiceCase.visibility = "check";
  });
  assert.equal(
    questionGroupLibrarySchema.safeParse(missingExample).success,
    true,
    "the public JSON Schema boundary is structural; full validation owns cross-field rules",
  );
  assert.match(
    validateQuestionGroupLibrary(missingExample).errors.map((entry) => entry.code).join("\n"),
    /missing-example-case/,
  );

  const duplicateCase = library();
  duplicateCase.groups[0].questions[0].cases[1].id = duplicateCase.groups[0].questions[0].cases[0].id;
  assert.match(
    validateQuestionGroupLibrary(duplicateCase).errors.map((entry) => entry.code).join("\n"),
    /duplicate-case-id/,
  );

  const duplicateAssertion = library();
  duplicateAssertion.groups[0].questions[0].cases[1].assertions[1].id =
    duplicateAssertion.groups[0].questions[0].cases[1].assertions[0].id;
  assert.match(
    validateQuestionGroupLibrary(duplicateAssertion).errors.map((entry) => entry.code).join("\n"),
    /duplicate-assertion-id/,
  );

  const duplicateQuestion = library();
  const secondGroup = copy(duplicateQuestion.groups[0]);
  secondGroup.id = "more-warmups";
  secondGroup.order = 2;
  duplicateQuestion.groups.push(secondGroup);
  assert.match(
    validateQuestionGroupLibrary(duplicateQuestion).errors.map((entry) => entry.code).join("\n"),
    /duplicate-question-id/,
  );
});

test("enforces invocation and throws-assertion invariants", () => {
  const constructorOnFunction = library();
  constructorOnFunction.groups[0].questions[0].cases[0].constructorArgs = [];
  assert.match(
    validateQuestionGroupLibrary(constructorOnFunction).errors.map((entry) => entry.code).join("\n"),
    /unexpected-constructor-args/,
  );

  const mixedThrows = library();
  mixedThrows.groups[0].questions[0].cases[0].assertions.push({
    id: "throws",
    label: "Throws an error",
    kind: "throws",
  });
  assert.match(
    validateQuestionGroupLibrary(mixedThrows).errors.map((entry) => entry.code).join("\n"),
    /mixed-throws-assertion/,
  );

  const reversedRange = library();
  reversedRange.groups[0].questions[0].cases[0].assertions = [{
    id: "range",
    label: "Uses the expected range",
    kind: "range",
    minimum: 10,
    maximum: 0,
  }];
  assert.match(
    validateQuestionGroupLibrary(reversedRange).errors.map((entry) => entry.message).join("\n"),
    /minimum may not exceed/i,
  );

  const invalidMatchPattern = library();
  invalidMatchPattern.groups[0].questions[0].cases[0].assertions = [{
    id: "matches",
    label: "Uses a valid pattern",
    kind: "matches",
    pattern: "[",
  }];
  assert.match(
    validateQuestionGroupLibrary(invalidMatchPattern).errors
      .map((entry) => entry.code)
      .join("\n"),
    /invalid-regex/,
  );

  const invalidMessagePattern = library();
  invalidMessagePattern.groups[0].questions[0].cases[0].assertions = [{
    id: "throws",
    label: "Uses a valid error pattern",
    kind: "throws",
    messagePattern: "(?",
  }];
  assert.match(
    validateQuestionGroupLibrary(invalidMessagePattern).errors
      .map((entry) => entry.code)
      .join("\n"),
    /invalid-regex/,
  );
});

test("bounds JSON values before they reach a language runtime", () => {
  const nonJson = library();
  nonJson.groups[0].questions[0].cases[0].args = [1n];
  assert.match(
    validateQuestionGroupLibrary(nonJson).errors.map((entry) => entry.message).join("\n"),
    /JSON data only/,
  );

  const tooDeep = library();
  let nested = { value: "leaf" };
  for (let index = 0; index < 14; index += 1) nested = { nested };
  tooDeep.groups[0].questions[0].cases[0].args = [nested];
  assert.match(
    validateQuestionGroupLibrary(tooDeep).errors.map((entry) => entry.message).join("\n"),
    /nested more than 12 levels/,
  );

  const tooWide = library();
  tooWide.groups[0].questions[0].cases[0].args = [Array.from({ length: 201 }, (_, index) => index)];
  assert.match(
    validateQuestionGroupLibrary(tooWide).errors.map((entry) => entry.message).join("\n"),
    /more than 200 entries/,
  );

  const cyclic = library();
  const value = {};
  value.self = value;
  cyclic.groups[0].questions[0].cases[0].args = [value];
  assert.match(
    validateQuestionGroupLibrary(cyclic).errors.map((entry) => entry.message).join("\n"),
    /cycles or shared object references/,
  );
});

test("parses size-bounded JSON and emits canonical, key-order-independent output", () => {
  assert.equal(parseQuestionGroupLibraryJson(JSON.stringify(library())).valid, true);
  assert.match(
    parseQuestionGroupLibraryJson("{").errors.map((entry) => entry.code).join("\n"),
    /invalid-json/,
  );
  assert.match(
    parseQuestionGroupLibraryJson(" ".repeat(2_000_001)).errors.map((entry) => entry.code).join("\n"),
    /file-too-large/,
  );

  const reordered = {
    groups: library().groups,
    runtimes: library().runtimes,
    sources: library().sources,
    objectives: library().objectives,
    library: library().library,
    schemaVersion: QUESTION_GROUP_LIBRARY_SCHEMA_VERSION,
    format: QUESTION_GROUP_LIBRARY_FORMAT,
  };
  assert.equal(
    canonicalQuestionGroupLibraryJson(library()),
    canonicalQuestionGroupLibraryJson(reordered),
  );
  assert.ok(canonicalQuestionGroupLibraryJson(library()).endsWith("\n"));
});

test("exports a versioned draft-07 JSON schema from root and the public subpath", () => {
  assert.equal(questionGroupSubpath.questionGroupLibrarySchema, questionGroupLibrarySchema);
  assert.equal(questionGroupSubpath.validateQuestionGroupLibrary, validateQuestionGroupLibrary);
  assert.equal(
    questionGroupLibraryJsonSchema.$id,
    "https://model-systems-labs.github.io/latent/question-groups/v1/question-group-library.schema.json",
  );
  assert.equal(questionGroupLibraryJsonSchema.$schema, "http://json-schema.org/draft-07/schema#");
  assert.equal(questionGroupLibraryJsonSchema.additionalProperties, false);
  assert.equal(
    questionGroupLibraryJsonSchema.properties.groups.items.properties.questions.items
      .properties.cases.items.properties.args.items.$ref,
    "#/definitions/JsonValue",
  );
  assert.equal(questionGroupLibraryJsonSchema.definitions.JsonValue.anyOf[4].maxItems, 200);
  assert.deepEqual(
    questionGroupLibraryJsonSchema.properties.format.const,
    QUESTION_GROUP_LIBRARY_FORMAT,
  );
});

test("the public guide contains a complete library that passes full validation", async () => {
  const guide = await readFile(
    new URL("../../../docs/question-groups.md", import.meta.url),
    "utf8",
  );
  const example = guide.match(
    /## Small valid library[\s\S]*?```json\n(?<json>[\s\S]*?)\n```/,
  )?.groups?.json;
  assert.ok(example, "the guide contains a JSON example");
  const validation = parseQuestionGroupLibraryJson(example);
  assert.equal(
    validation.valid,
    true,
    validation.errors?.map((entry) => `${entry.path}: ${entry.message}`).join("\n"),
  );
});
