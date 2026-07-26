import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = new URL("../", import.meta.url);
let course;
let contracts;
let guidedExercises;
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
  [course, contracts, guidedExercises, progress] = await Promise.all([
    vite.ssrLoadModule("/products/courses/reference-curriculum/lessons/course.ts"),
    vite.ssrLoadModule("/products/courses/reference-curriculum/lessons/exercise-contracts.ts"),
    vite.ssrLoadModule("/products/courses/reference-curriculum/lessons/guided-exercises.ts"),
    vite.ssrLoadModule("/products/courses/reference-curriculum/lessons/lesson-progress.ts"),
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

test("every course after Linear Algebra asks for one guided core implementation", () => {
  const exercises = [];
  for (const program of course.coursePrograms.filter(({ order }) => order >= 2)) {
    for (const lesson of program.lessons) {
      for (const block of lesson.implementation.codeBlocks) {
        const exerciseId = `${lesson.id}/${block.id}`;
        exercises.push(exerciseId);
        assert.ok(block.starterCode, `${exerciseId} has an authored guided starter`);
        assert.equal((block.starterCode.match(/# TODO:/g) ?? []).length, 1, `${exerciseId} has one learner task`);
        assert.equal(
          (block.starterCode.match(/raise NotImplementedError\(/g) ?? []).length,
          1,
          `${exerciseId} has one incomplete core region`,
        );
        assert.notEqual(block.starterCode, block.code, `${exerciseId} does not reveal the reference answer`);
        assert.doesNotMatch(block.code, /# TODO:|NotImplementedError/, `${exerciseId} keeps a complete reference`);

        const signature = block.code.match(/^def\s+[A-Za-z_][A-Za-z0-9_]*\s*\([^\n]*\):/m)?.[0];
        assert.ok(signature, `${exerciseId} has a reference signature`);
        assert.match(block.starterCode, new RegExp(signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      }
    }
  }

  assert.equal(exercises.length, 60);
  assert.deepEqual([...guidedExercises.guidedExerciseIds].sort(), exercises.sort());
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
  const optionalRoundInProgress = {
    ...base,
    practiceRepetitions: {
      answers: { [`${verifiedCells[0]}::round-2`]: "def optional_draft():\n    pass" },
      verifiedSources: {},
      verifiedContractVersion: null,
    },
  };
  assert.equal(
    progress.lessonGateProgress(lesson, optionalRoundInProgress, contractVersion, checkId).gates[0].complete,
    true,
    "an unfinished optional repetition cannot revoke the required first-pass completion",
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
