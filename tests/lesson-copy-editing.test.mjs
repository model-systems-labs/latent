import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("every lesson route uses the durable lesson copy editor", async () => {
  const [page, editor, api, database] = await Promise.all([
    source("app/lessons/[slug]/page.tsx"),
    source("app/components/LessonCopyEditor.tsx"),
    source("app/api/lesson-copy/route.ts"),
    source("db/lesson-copy.ts"),
  ]);

  assert.match(page, /<LessonCopyEditor lesson=\{lesson\}/);
  assert.match(editor, />\s*Edit lesson\s*<\/button>/);
  assert.match(editor, /setTimeout\(\(\) => void persistLatest\(\), 800\)/);
  assert.match(editor, /<PaperLab lesson=\{editedDocument\.lesson\} outcome=\{editedDocument\.outcome\}/);
  assert.match(api, /lessonCopyFields\(editableDocument\(lessonId\)\)/);
  assert.match(api, /saveLessonCopy\(await database\(\), lessonId, edits\)/);
  assert.match(database, /PRIMARY KEY \(lesson_id, field\)/);
  assert.match(database, /ON CONFLICT\(lesson_id, field\) DO UPDATE/);
});

test("lesson copy fields cover the authored reading and practice surfaces", async () => {
  const fields = await source("app/content/lesson-copy.ts");

  for (const path of [
    "lesson.title",
    "lesson.thesis",
    "lesson.summary.${index}.body",
    "lesson.diagram.caption",
    "lesson.sources.${index}.title",
    "outcome.check.prompt",
    "lesson.implementation.intro",
    "lesson.implementation.codeBlocks.${index}.purpose",
    "lesson.dataset.preview",
  ]) {
    assert.ok(fields.includes(path), path);
  }

  assert.doesNotMatch(fields, /starterCode:\s*copyValue|code:\s*copyValue|checkCode:\s*copyValue/);
});
