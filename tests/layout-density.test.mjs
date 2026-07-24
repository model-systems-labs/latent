import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("macro layout rhythm is tuned to roughly seventy percent", async () => {
  const [tokens, landing, lessons, catalog, course] = await Promise.all([
    read("app/styles/tokens.css"),
    read("app/page.module.css"),
    read("app/styles/learning-flow.css"),
    read("app/styles/course-catalog.css"),
    read("app/course/page.module.css"),
  ]);

  assert.match(tokens, /--rhythm-landing:\s*clamp\(3\.85rem, 7vw, 5\.6rem\)/);
  assert.match(tokens, /--rhythm-major:\s*clamp\(3\.15rem, 5\.6vw, 4\.9rem\)/);
  assert.match(tokens, /--rhythm-section:\s*clamp\(2\.1rem, 4\.2vw, 3\.5rem\)/);
  assert.match(tokens, /--rhythm-group:\s*clamp\(2\.8rem, 5\.6vw, 4\.55rem\)/);
  assert.match(landing, /\.hero\s*\{[^}]*padding:\s*var\(--rhythm-landing\) 0/);
  assert.match(landing, /\.argument\s*\{[^}]*padding:\s*var\(--rhythm-major\) 0/);
  assert.match(lessons, /\.paper-page \.paper-section\s*\{\s*padding:\s*var\(--rhythm-section\) 0/);
  assert.match(catalog, /\.course-page\s*\{[^}]*padding:\s*1\.4rem 0 3\.5rem/);
  assert.match(course, /\.programGroup \+ \.programGroup\s*\{\s*margin-top:\s*var\(--rhythm-group\)/);
});

test("compact rhythm does not shrink coding and navigation targets", async () => {
  const [site, coding, project, guide] = await Promise.all([
    read("app/styles/learning-flow.css"),
    read("app/styles/coding-workspace.css"),
    read("app/styles/project-structure.css"),
    read("app/components/CourseGuide.module.css"),
  ]);

  assert.match(site, /\.site-header nav a\s*\{[^}]*min-height:\s*2\.75rem/);
  assert.match(coding, /\.exercise-summary\s*\{[^}]*min-height:\s*3\.8rem/);
  assert.match(coding, /\.open-ide-link\s*\{[^}]*min-height:\s*2\.75rem/);
  assert.match(project, /\.project-structure-group li a\s*\{[^}]*min-height:\s*2\.75rem/);
  assert.match(guide, /\.actions a,\s*\n\.quickLinks a\s*\{[^}]*min-height:\s*2\.75rem/);
  assert.doesNotMatch([site, coding, project, guide].join("\n"), /(?:zoom|transform):\s*scale\(0\.7\)/);
});
