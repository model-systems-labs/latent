import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = new URL("../", import.meta.url);
let course;
let contracts;
let progress;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(root),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [course, contracts, progress] = await Promise.all([
    vite.ssrLoadModule("/app/lessons/course.ts"),
    vite.ssrLoadModule("/app/lessons/exercise-contracts.ts"),
    vite.ssrLoadModule("/app/lessons/lesson-progress.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

test("every practice cell has a complete contract with its exact Python signature", () => {
  assert.equal(course.courseLessons.length, 14);
  const expectedKeys = [];
  for (const lesson of course.courseLessons) {
    for (const block of lesson.implementation.codeBlocks) {
      const key = `${lesson.id}/${block.id}`;
      expectedKeys.push(key);
      const contract = contracts.exerciseContractFor(lesson.id, block.id);
      const signature = block.code.match(/^def\s+[A-Za-z_][A-Za-z0-9_]*\s*\([^\n]*\):/m)?.[0];
      assert.ok(signature, `${key} has a top-level Python signature`);
      assert.equal(contract.signature, signature, `${key} exposes the exact authored signature`);
      assert.ok(block.purpose.length >= 20, `${key} has a useful purpose`);
      for (const field of ["inputs", "output", "rule", "example"]) {
        assert.ok(contract[field].length >= 12, `${key} has a useful ${field} contract`);
        assert.doesNotMatch(contract[field], /todo|implement this|fill in/i, `${key} ${field} is instructional`);
      }
    }
  }
  assert.equal(expectedKeys.length, 34);
  assert.deepEqual(Object.keys(contracts.exerciseContracts).sort(), expectedKeys.sort());
});

test("lesson completion requires current code, the experiment, and the knowledge check", () => {
  const lesson = course.courseLessons[0];
  const contractVersion = "contracts-current";
  const checkId = "knowledge-check";
  const answers = Object.fromEntries(lesson.implementation.codeBlocks.map((block) => [block.id, block.code]));
  const verifiedSources = { ...answers };
  const verifiedCells = lesson.implementation.codeBlocks.map((block) => block.id);
  const base = {
    verifiedCells,
    verifiedSources,
    verifiedContractVersion: contractVersion,
    experimentComplete: false,
    hiddenBlocks: [],
    answers,
    knowledgeAnswers: {},
    knowledgeVerified: [],
    updatedAt: 0,
  };

  assert.deepEqual(
    progress.lessonGateProgress(lesson, undefined, contractVersion, checkId).gates.map((gate) => gate.complete),
    [false, false, false],
  );
  assert.deepEqual(
    progress.lessonGateProgress(lesson, base, contractVersion, checkId).gates.map((gate) => gate.complete),
    [true, false, false],
  );
  const staleSource = { ...base, answers: { ...answers, [verifiedCells[0]]: "def changed():\n    pass" } };
  assert.equal(progress.lessonGateProgress(lesson, staleSource, contractVersion, checkId).gates[0].complete, false);
  const complete = progress.lessonGateProgress(lesson, {
    ...base,
    experimentComplete: true,
    knowledgeVerified: [checkId],
  }, contractVersion, checkId);
  assert.equal(complete.completed, 3);
  assert.equal(complete.complete, true);
});

test("saved code stays behind a neutral restoring state until hydration finishes", async () => {
  const source = await readFile(new URL("app/components/PaperLab.tsx", root), "utf8");
  const activeExercise = source.slice(
    source.indexOf('{active ? ('),
    source.indexOf(') : <div id={`exercise-${lesson.id}-${block.id}`} hidden />}'),
  );
  assert.ok(activeExercise.indexOf("<ExerciseContract") < activeExercise.indexOf('className="answer-area"'));
  assert.match(activeExercise, /<div className="lesson-editor-loading" role="status">Restoring saved code…<\/div>/);
  assert.doesNotMatch(activeExercise, /<SyntaxCode code=\{starterSource\}/);
});
