import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

const read = (path) => readFile(new URL(path, root), "utf8");

function primaryHeader(source) {
  const start = source.indexOf('<header className=');
  const end = source.indexOf("</header>", start);
  assert.ok(start >= 0 && end > start, "page must expose a primary header");
  return source.slice(start, end);
}

test("the framework homepage avoids learner-only IDE navigation while course pages retain it", async () => {
  const [landing, catalog, llmCourse] = await Promise.all([
    read("app/page.tsx"),
    read("app/course/page.tsx"),
    read("app/courses/llm-systems/page.tsx"),
  ]);

  assert.doesNotMatch(primaryHeader(landing), /href="\/workspace"/);
  for (const page of [catalog, llmCourse]) {
    assert.match(primaryHeader(page), /href="\/workspace"/);
  }
  assert.match(llmCourse, /secondaryLink=\{\{ href: "\/workspace", label: "Open coding workspace" \}\}/);
});

test("lesson exercise rows advertise the editor and leave the coding area unobstructed", async () => {
  const [paperLab, lessonPage, codingCss] = await Promise.all([
    read("app/components/PaperLab.tsx"),
    read("app/lessons/[slug]/page.tsx"),
    read("app/styles/coding-workspace.css"),
  ]);

  assert.match(paperLab, /`Running round \$\{round\}`/);
  assert.match(paperLab, /`Complete · \$\{completedRounds\}\/3 rounds`/);
  assert.match(paperLab, /"Round 1 of 3"/);
  assert.match(paperLab, />Open coding workspace ↗<\/Link>/);
  assert.match(lessonPage, /<PaperLab lesson=\{lesson\}/);
  assert.doesNotMatch(lessonPage, /CopyEditor/);
  assert.match(codingCss, /\.exercise-summary:hover\s*\{[^}]*background:\s*var\(--violet-wash\)/);
  assert.match(codingCss, /\.exercise-state::after\s*\{[^}]*content:\s*"\+"/);
  assert.match(codingCss, /\.practice-block\.is-active \.exercise-state::after\s*\{[^}]*content:\s*"−"/);
  assert.match(codingCss, /\.answer-area:hover\s*\{[^}]*border-color:/);
});

test("coding entry links retain full-size click targets", async () => {
  const [siteCss, codingCss, guideCss, projectCss] = await Promise.all([
    read("app/styles/learning-flow.css"),
    read("app/styles/coding-workspace.css"),
    read("app/components/CourseGuide.module.css"),
    read("app/styles/project-structure.css"),
  ]);

  assert.match(siteCss, /\.site-header nav a\s*\{[^}]*min-height:\s*2\.75rem/);
  assert.match(codingCss, /\.open-ide-link\s*\{[^}]*min-height:\s*2\.75rem/);
  assert.match(guideCss, /\.actions a\s*\{[^}]*display:\s*inline-flex/);
  assert.match(projectCss, /\.project-hero-link\s*\{[^}]*min-height:\s*2\.75rem/);
  assert.match(projectCss, /\.project-structure-group li a\s*\{[^}]*min-height:\s*2\.75rem/);
});
