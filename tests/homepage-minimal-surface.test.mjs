import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const courseCatalogCssUrl = new URL("../app/styles/course-catalog.css", import.meta.url);
const responsiveCssUrl = new URL("../app/styles/responsive.css", import.meta.url);
const projectCourseUrl = new URL("../app/courses/llm-systems/page.tsx", import.meta.url);
const landingPageUrl = new URL("../app/page.tsx", import.meta.url);
const pageAtmosphereUrl = new URL("../app/components/PageAtmosphere.tsx", import.meta.url);
const landingCssUrl = new URL("../app/page.module.css", import.meta.url);

function cssRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected a CSS rule for ${selector}`);
  return match[1];
}

test("the project course leads directly from its introduction to the modules", async () => {
  const page = await readFile(projectCourseUrl, "utf8");

  assert.match(page, /<CourseResume \/>/);
  assert.match(page, /<section className="course-track-grid"/);
  assert.doesNotMatch(page, /FirstRunExperience|Introductory JavaScript RNN|Train and generate/);
});

test("the course CTA does not reintroduce a dark surface", async () => {
  const [courseCatalogCss, responsiveCss] = await Promise.all([
    readFile(courseCatalogCssUrl, "utf8"),
    readFile(responsiveCssUrl, "utf8"),
  ]);

  const courseCta = cssRule(courseCatalogCss, ".catalog-capstone-link");
  assert.doesNotMatch(courseCta, /background:/);
  assert.match(courseCta, /border-top:\s*1px solid var\(--line-strong\)/);
  assert.doesNotMatch(courseCatalogCss, /\.first-run/);
  assert.doesNotMatch(responsiveCss, /\.first-run/);
});

test("the academic landing stays unboxed and reuses the established atmosphere", async () => {
  const [page, atmosphere, css] = await Promise.all([
    readFile(landingPageUrl, "utf8"),
    readFile(pageAtmosphereUrl, "utf8"),
    readFile(landingCssUrl, "utf8"),
  ]);

  assert.match(page, /<PageAtmosphere \/>/);
  assert.match(atmosphere, /page-atmosphere/);
  assert.match(atmosphere, /orbit orbit-one/);
  assert.match(atmosphere, /node node-one/);
  assert.match(atmosphere, /warm-star/);
  assert.match(page, /href="\/course"/);
  assert.match(page, /Browser-native LLM system/);
  assert.match(page, /aria-label="System boundaries"/);
  assert.match(page, /aria-label="Request and token event flow"/);
  assert.match(page, /aria-label="State reused or persisted across the request path"/);
  assert.match(page, /Model weights/);
  assert.match(page, /KV cache/);
  assert.match(page, /IndexedDB drafts/);
  assert.match(page, /BrowserChat\.tsx/);
  assert.doesNotMatch(page, /FirstRunExperience|courseTracks|testimonial|trusted by/i);
  assert.doesNotMatch(css, /box-shadow|linear-gradient|#[0-9a-f]{3,8}/i);
  assert.match(cssRule(css, ".argument"), /border-top:\s*1px solid var\(--line-strong\)/);
  assert.match(css, /\.architectureBoundaries\s*\{[^}]*grid-template-columns:\s*repeat\(8, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.architectureFlow\s*\{[^}]*grid-template-columns:\s*repeat\(8, minmax\(0, 1fr\)\)/s);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.architectureFlow\s*\{[\s\S]*grid-template-columns:\s*1fr/);
});
