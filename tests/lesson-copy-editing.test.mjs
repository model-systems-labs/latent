import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("maintainer copy is reviewed source and lessons render without a mutation wrapper", async () => {
  const [page, homepageRoute, homepage] = await Promise.all([
    source("app/lessons/[slug]/page.tsx"),
    source("app/page.tsx"),
    source("products/courses/CoursesLanding.tsx"),
  ]);

  assert.match(page, /<PaperLab lesson=\{lesson\} outcome=\{lessonLearningOutcome\(lesson\.id\)\} \/>/);
  assert.doesNotMatch(page, /LessonCopyEditor/);
  assert.doesNotMatch(homepageRoute, /HomepageCopyEditor|HomepageCopyProvider|EditableText|fetch\(/);
  assert.doesNotMatch(homepage, /HomepageCopyEditor|HomepageCopyProvider|EditableText|fetch\(/);
});

test("the former public copy editors, PUT routes, and D1 tables do not exist", async () => {
  for (const path of [
    "app/components/HomepageCopyEditor.tsx",
    "app/components/LessonCopyEditor.tsx",
    "app/api/site-copy/route.ts",
    "app/api/lesson-copy/route.ts",
    "db/site-copy.ts",
    "db/lesson-copy.ts",
    "db/schema.ts",
    "drizzle.config.ts",
  ]) {
    await assert.rejects(access(new URL(path, root)), undefined, path);
  }

  const [packageJson, worker, vite] = await Promise.all([
    source("package.json"),
    source("worker/index.ts"),
    source("vite.config.ts"),
  ]);
  assert.doesNotMatch(packageJson, /drizzle/);
  assert.doesNotMatch(worker, /\bDB:\s*D1Database/);
  assert.doesNotMatch(vite, /d1_databases|site-creator-d1/);
});
