import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const expectedLessonIds = [
  "agent-loop",
  "tool-contracts",
  "context-selection",
  "permissions-and-sandboxes",
  "state-and-recovery",
  "agent-evaluations",
  "task-orchestration",
  "integrated-harness",
];

let lessons;
let provenance;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [lessons, provenance] = await Promise.all([
    vite.ssrLoadModule("/products/courses/reference-curriculum/lessons/harness-engineering/index.ts"),
    vite.ssrLoadModule("/products/courses/reference-curriculum/content/harness-engineering/provenance.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

test("all eight Harness Engineering lessons have independent content provenance", () => {
  assert.deepEqual(
    lessons.harnessEngineeringLessons.map(({ id }) => id),
    expectedLessonIds,
  );
  assert.deepEqual(
    Object.keys(provenance.harnessLessonContentProvenance).sort(),
    [...expectedLessonIds].sort(),
  );

  for (const lesson of lessons.harnessEngineeringLessons) {
    const record = provenance.getHarnessLessonContentProvenance(lesson.id);
    assert.equal(record, provenance.harnessLessonContentProvenance[lesson.id], lesson.id);
    assert.equal(record.prose, "course-authored", lesson.id);
    assert.equal(record.diagrams, "course-authored", lesson.id);
    assert.equal(record.exercises, "course-authored", lesson.id);
    assert.equal(record.implementation, "independent-course-implementation", lesson.id);
    assert.equal(record.dataset, "course-authored-synthetic", lesson.id);
    assert.equal(record.reviewedAt, "2026-07-18", lesson.id);
    assert.ok(record.note.length > 70, lesson.id);
    assert.equal(Object.isFrozen(record), true, lesson.id);
  }
  assert.equal(Object.isFrozen(provenance.harnessLessonContentProvenance), true);
});

test("unknown Harness Engineering lessons cannot silently omit provenance", () => {
  assert.throws(
    () => provenance.getHarnessLessonContentProvenance("not-a-harness-lesson"),
    /requires a content-provenance record/,
  );
});
