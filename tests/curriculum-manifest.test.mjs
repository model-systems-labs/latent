import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let vite;
let course;
let manifestModule;
let lms;
let fileStatus;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [course, manifestModule, lms, fileStatus] = await Promise.all([
    vite.ssrLoadModule("/app/lessons/course.ts"),
    vite.ssrLoadModule("/app/content/llm-systems/manifest.ts"),
    vite.ssrLoadModule("/packages/course-kit/src/curriculum.ts"),
    vite.ssrLoadModule("/app/lib/project-file-status.ts"),
  ]);
});

after(async () => {
  await vite?.close();
});

test("one LLM Systems program owns four technical modules and every lesson", () => {
  const curriculum = course.llmSystemsCurriculum;
  assert.equal(curriculum.title, "Build an LLM System in Your Browser");
  assert.deepEqual(
    curriculum.modules.map((module) => module.title),
    ["Model Foundations", "Inference Runtime", "LLM Serving", "Chat Integration"],
  );
  assert.equal(curriculum.lessonCount, 14);
  assert.equal(curriculum.testCount, 34);
  assert.equal(curriculum.lessons.length, curriculum.lessonCount);
  assert.equal(new Set(curriculum.lessons.map((lesson) => lesson.id)).size, 14);
  assert.doesNotMatch(JSON.stringify(curriculum.modules), /Mock Backend Systems/);

  for (const curriculumModule of curriculum.modules) {
    assert.equal(curriculumModule.lessonCount, curriculumModule.lessons.length);
    assert.equal(
      curriculumModule.testCount,
      curriculumModule.lessons.reduce((total, lesson) => total + lesson.testCount, 0),
    );
  }
});

test("module identity is independent from stable saved-project paths", () => {
  const curriculum = course.llmSystemsCurriculum;
  for (const entry of curriculum.lessons) {
    assert.equal(
      entry.projectPath,
      `${entry.lesson.courseId}/${entry.lesson.implementation.filename}`,
    );
    assert.notEqual(entry.moduleId, entry.projectPath.split("/")[0]);
    assert.equal(curriculum.lessonById[entry.id], entry);
  }
  assert.deepEqual(
    curriculum.modules.map((module) => module.routeSlug),
    ["models", "systems", "backend", "product"],
  );
});

test("manifest validation rejects ambiguous files and unreachable source lessons", () => {
  const duplicatePathManifest = structuredClone(manifestModule.llmSystemsManifest);
  duplicatePathManifest.modules[1].lessons[0].projectPath =
    duplicatePathManifest.modules[0].lessons[0].projectPath;
  const issues = lms.validateCurriculumManifest(duplicatePathManifest);
  assert.ok(issues.some((issue) => /projectPath duplicates/.test(issue.message)));

  const sourceLessons = course.courseLessons.map((lesson) => ({
    id: lesson.id,
    implementation: lesson.implementation,
  }));
  sourceLessons.push({
    id: "unassigned-lesson",
    implementation: { filename: "unassigned.js", codeBlocks: [] },
  });
  assert.throws(
    () => lms.deriveCurriculum(manifestModule.llmSystemsManifest, sourceLessons),
    /source lesson is not assigned to a module: unassigned-lesson/,
  );
});

test("project files expose clear pending, complete, provided, and failure states", () => {
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: true, verifiedCells: 0, totalCells: 3 }),
    { tone: "pending", label: "Pending", complete: false },
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: true, verifiedCells: 2, totalCells: 3 }),
    { tone: "in-progress", label: "2/3 complete", complete: false },
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: true, verifiedCells: 3, totalCells: 3 }),
    { tone: "complete", label: "Complete", complete: true },
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: false, readOnly: true }),
    { tone: "provided", label: "Provided", complete: true },
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: false, requiresPassingTests: true }),
    { tone: "pending", label: "Pending", complete: false },
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: false, requiresPassingTests: true, results: [{ passed: true }] }),
    { tone: "passed", label: "Tests pass", complete: true },
  );
  const sharedCompile = [{ id: "capstone", path: "capstone/main.tsx", label: "Capstone", passed: true, detail: "Passed" }];
  assert.equal(
    fileStatus.projectResultsForFile(
      { "capstone/main.tsx": sharedCompile },
      "capstone/BrowserChat.tsx",
      "capstone/main.tsx",
    ),
    sharedCompile,
  );
  assert.deepEqual(
    fileStatus.projectFileStatus({ isLessonFile: true, verifiedCells: 3, totalCells: 3, results: [{ passed: false }] }),
    { tone: "failed", label: "Needs work", complete: false },
  );
});
