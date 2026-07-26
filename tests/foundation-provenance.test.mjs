import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let vite;
let linearAlgebra;
let machineLearning;
let provenance;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [linearAlgebra, machineLearning, provenance] = await Promise.all([
    vite.ssrLoadModule("/examples/learning-platform/llm-learning/lessons/foundations/linear-algebra.ts"),
    vite.ssrLoadModule("/examples/learning-platform/llm-learning/lessons/foundations/machine-learning-basics.ts"),
    vite.ssrLoadModule("/examples/learning-platform/llm-learning/content/foundations/provenance.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

test("the ten stand-alone foundation lessons have an independent provenance record", () => {
  const lessons = [
    ...linearAlgebra.linearAlgebraLessons,
    ...machineLearning.machineLearningBasicsLessons,
  ];
  assert.equal(lessons.length, 10);
  assert.deepEqual(
    Object.keys(provenance.foundationLessonContentProvenance).sort(),
    lessons.map((lesson) => lesson.id).sort(),
  );

  for (const lesson of lessons) {
    const record = provenance.getFoundationLessonContentProvenance(lesson.id);
    assert.equal(record.prose, "course-authored", lesson.id);
    assert.equal(record.diagrams, "course-authored", lesson.id);
    assert.equal(record.exercises, "course-authored", lesson.id);
    assert.equal(record.implementation, "independent-course-implementation", lesson.id);
    assert.equal(record.dataset, "course-authored-synthetic", lesson.id);
    assert.equal(record.reviewedAt, "2026-07-18", lesson.id);
    assert.ok(record.note.length > 60, lesson.id);
  }
});
