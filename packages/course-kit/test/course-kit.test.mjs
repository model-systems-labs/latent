import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const vite = await createServer({
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: false,
  logLevel: "silent",
  server: { middlewareMode: true },
  appType: "custom",
});
const courseKit = await vite.ssrLoadModule("/src/index.ts");

after(async () => vite.close());

test("course manifests compile to stable ordered lessons", () => {
  const manifest = courseKit.defineCurriculumManifest({
    schemaVersion: 1,
    id: "test-course",
    title: "Test Course",
    shortTitle: "Test",
    thesis: "A typed course.",
    outcome: "A tested result.",
    capstone: { title: "Capstone", description: "Assemble it.", projectPath: "capstone/main.js" },
    modules: [{
      id: "foundations",
      routeSlug: "foundations",
      order: 1,
      title: "Foundations",
      shortTitle: "Core",
      thesis: "Learn it.",
      outcome: "Build it.",
      lessons: [{ lessonId: "lesson-one", projectPath: "models/lesson-one.js" }],
    }],
  });
  const lesson = { id: "lesson-one", implementation: { filename: "lesson-one.js", codeBlocks: [{ id: "one" }] } };
  const curriculum = courseKit.deriveCurriculum(manifest, [lesson]);
  assert.equal(curriculum.lessonCount, 1);
  assert.equal(curriculum.testCount, 1);
  assert.equal(curriculum.lessons[0].projectPath, "models/lesson-one.js");
});

test("course manifests reject unreachable source lessons", () => {
  const manifest = {
    schemaVersion: 1,
    id: "test-course",
    title: "Test Course",
    shortTitle: "Test",
    thesis: "A typed course.",
    outcome: "A tested result.",
    capstone: { title: "Capstone", description: "Assemble it.", projectPath: "capstone/main.js" },
    modules: [{ id: "foundations", routeSlug: "foundations", order: 1, title: "Foundations", shortTitle: "Core", thesis: "Learn it.", outcome: "Build it.", lessons: [{ lessonId: "lesson-one", projectPath: "models/lesson-one.js" }] }],
  };
  const lessons = [
    { id: "lesson-one", implementation: { filename: "one.js", codeBlocks: [] } },
    { id: "orphan", implementation: { filename: "orphan.js", codeBlocks: [] } },
  ];
  assert.throws(() => courseKit.deriveCurriculum(manifest, lessons), /not assigned/i);
});
