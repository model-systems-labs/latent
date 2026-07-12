import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let browserLabContracts;
let contractModule;
let course;
let manifestModule;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [browserLabContracts, contractModule, course, manifestModule] = await Promise.all([
    vite.ssrLoadModule("/packages/browser-lab/src/contracts.ts"),
    vite.ssrLoadModule("/app/content/llm-systems/contracts.ts"),
    vite.ssrLoadModule("/app/lessons/course.ts"),
    vite.ssrLoadModule("/app/content/llm-systems/manifest.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

function expectedContracts() {
  const projectPathByLesson = new Map(
    manifestModule.llmSystemsManifest.modules.flatMap((module) =>
      module.lessons.map((lesson) => [lesson.lessonId, lesson.projectPath]),
    ),
  );
  const expected = new Map();
  for (const lesson of course.courseLessons) {
    const projectPath = projectPathByLesson.get(lesson.id);
    assert.ok(projectPath, `manifest projectPath for ${lesson.id}`);
    for (const block of lesson.implementation.codeBlocks) {
      const functionMatch = block.code.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/);
      assert.ok(functionMatch, `top-level function for ${lesson.id}/${block.id}`);
      expected.set(`${lesson.id}/${block.id}`, {
        exportName: functionMatch[1],
        label: block.label,
        projectPath,
      });
    }
  }
  return expected;
}

test("one typed host-owned contract covers every lesson code block", () => {
  const expected = expectedContracts();
  const contracts = contractModule.llmSystemsExerciseContracts;
  assert.equal(expected.size, 34);
  assert.equal(contracts.length, expected.size);
  assert.equal(new Set(contracts.map((contract) => contract.id)).size, contracts.length);

  const manifestPaths = new Set(
    manifestModule.llmSystemsManifest.modules.flatMap((module) =>
      module.lessons.map((lesson) => lesson.projectPath),
    ),
  );

  for (const contract of contracts) {
    const definition = expected.get(contract.id);
    assert.ok(definition, `unexpected contract ${contract.id}`);
    assert.equal(contract.label, definition.label);
    assert.ok(contract.cases.length > 0, `${contract.id} has cases`);
    browserLabContracts.validateExerciseContract(contract);

    for (const exerciseCase of contract.cases) {
      assert.equal(exerciseCase.invoke.modulePath, definition.projectPath);
      assert.equal(exerciseCase.invoke.exportName, definition.exportName);
      assert.ok(manifestPaths.has(exerciseCase.invoke.modulePath));
      assert.ok(exerciseCase.assertions.length > 0);
    }
  }
});

test("the suite contains only data and cannot execute learner-authored checks", () => {
  const suite = contractModule.llmSystemsContractSuite;
  assert.equal(suite.contractVersion, "llm-systems-contracts-v1");
  assert.deepEqual(suite.contracts, contractModule.llmSystemsExerciseContracts);

  const visit = (value) => {
    assert.notEqual(typeof value, "function");
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.notEqual(key, "checkCode");
      visit(child);
    }
  };
  visit(suite);

  const dataOnlyAssertionKinds = new Set([
    "deep-equal",
    "finite",
    "includes",
    "length",
    "matches",
    "range",
    "throws",
    "truthy",
    "type",
  ]);
  for (const contract of suite.contracts) {
    for (const exerciseCase of contract.cases) {
      for (const assertion of exerciseCase.assertions) {
        assert.ok(dataOnlyAssertionKinds.has(assertion.kind));
      }
    }
  }
});
