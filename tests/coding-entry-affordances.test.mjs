import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

const read = (path) => readFile(new URL(path, root), "utf8");

test("learner navigation keeps the workspace contextual to the LLM Systems artifact", async () => {
  const [learnerHeader, landing, catalog, frameworkLanding, frameworkHeader, llmCourse] = await Promise.all([
    read("app/components/LearnerHeader.tsx"),
    read("products/courses/CoursesLanding.tsx"),
    read("app/course/page.tsx"),
    read("products/framework/FrameworkLanding.tsx"),
    read("products/framework/FrameworkHeader.tsx"),
    read("app/courses/llm-systems/page.tsx"),
  ]);

  const generalDestinations = learnerHeader.slice(
    learnerHeader.indexOf("const destinations"),
    learnerHeader.indexOf("const learningSuiteBasePath"),
  );
  assert.doesNotMatch(generalDestinations, /href: "\/(?:workspace|open-learning)"/);
  assert.match(learnerHeader, /\{ id: "practice", href: "\/workspace", label: "Practice" \}/);
  for (const page of [landing, catalog]) {
    assert.match(page, /<LearnerHeader current="courses" \/>/);
    assert.doesNotMatch(page, /href="\/(?:workspace|open-learning)"/);
  }
  assert.match(frameworkLanding, /<FrameworkHeader current="overview" \/>/);
  assert.match(frameworkHeader, /href: "\/open-learning"/);
  assert.doesNotMatch(frameworkHeader, /href="\/workspace"|href: "\/workspace"/);
  assert.doesNotMatch(llmCourse, /aria-label="Course tools"/);
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
  const [learnerUi, codingCss, guideCss, projectCss] = await Promise.all([
    read("packages/course-kit/src/learner-ui.ts"),
    read("app/styles/coding-workspace.css"),
    read("app/components/CourseGuide.module.css"),
    read("app/styles/project-structure.css"),
  ]);

  assert.match(learnerUi, /\.learner-primary-nav a\s*\{[^}]*min-height:\s*2\.75rem/);
  assert.match(codingCss, /\.open-ide-link\s*\{[^}]*min-height:\s*2\.75rem/);
  assert.match(guideCss, /\.actions a\s*\{[^}]*display:\s*inline-flex/);
  assert.match(projectCss, /\.project-hero-link\s*\{[^}]*min-height:\s*2\.75rem/);
  assert.match(projectCss, /\.project-structure-group li a\s*\{[^}]*min-height:\s*2\.75rem/);
});
