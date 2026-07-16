import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const productizationCssUrl = new URL("../app/styles/productization.css", import.meta.url);
const courseCatalogCssUrl = new URL("../app/styles/course-catalog.css", import.meta.url);
const codingWorkspaceCssUrl = new URL("../app/styles/coding-workspace.css", import.meta.url);
const responsiveCssUrl = new URL("../app/styles/responsive.css", import.meta.url);
const firstRunUrl = new URL("../app/components/FirstRunExperience.tsx", import.meta.url);
const landingPageUrl = new URL("../app/page.tsx", import.meta.url);
const landingCssUrl = new URL("../app/page.module.css", import.meta.url);

function cssRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected a CSS rule for ${selector}`);
  return match[1];
}

test("the course training demo stays on the warm editorial surface", async () => {
  const [source, catalog, component] = await Promise.all([
    readFile(productizationCssUrl, "utf8"),
    readFile(courseCatalogCssUrl, "utf8"),
    readFile(firstRunUrl, "utf8"),
  ]);
  const firstRunSource = source.slice(source.indexOf(".first-run {"), source.indexOf(".mobile-ide-tabs"));

  assert.match(cssRule(source, ".first-run-layout"), /background:\s*transparent/);
  assert.match(cssRule(source, ".first-run-layout"), /color:\s*var\(--ink\)/);
  assert.match(cssRule(source, ".first-run-controls"), /border-bottom:\s*1px solid var\(--line\)/);
  assert.match(cssRule(source, ".first-run-controls textarea"), /background:\s*rgba\(255,\s*255,\s*255,\s*0\.48\)/);
  assert.match(cssRule(source, ".first-run-controls textarea"), /color:\s*var\(--ink\)/);
  assert.match(cssRule(source, ".first-run-output article p"), /color:\s*var\(--ink\)/);
  assert.match(cssRule(catalog, ".first-run.first-run-minimal .first-run-output article p"), /min-height:\s*6\.5rem/);
  assert.doesNotMatch(component, /environment-readiness|Browser environment readiness|First run · real training|This tiny model/);
  assert.doesNotMatch(firstRunSource, /#211f23|#211f22|#272329|rgba\(255,\s*255,\s*255,\s*0\.0[468]\)/);
});

test("the course CTA and responsive dividers do not reintroduce dark surfaces", async () => {
  const [codingWorkspaceCss, responsiveCss] = await Promise.all([
    readFile(codingWorkspaceCssUrl, "utf8"),
    readFile(responsiveCssUrl, "utf8"),
  ]);

  const courseCta = cssRule(codingWorkspaceCss, ".full-course-page .hero-actions a:first-child");
  assert.match(courseCta, /background:\s*var\(--violet-wash\)/);
  assert.match(courseCta, /color:\s*var\(--violet-deep\)/);
  assert.match(responsiveCss, /\.first-run-controls\s*\{[^}]*border-bottom:\s*1px solid var\(--line\)/s);
  assert.match(responsiveCss, /\.first-run-output article \+ article\s*\{[^}]*border-top:\s*1px solid var\(--line\)/s);
});

test("the academic landing stays unboxed and reuses the established atmosphere", async () => {
  const [page, css] = await Promise.all([
    readFile(landingPageUrl, "utf8"),
    readFile(landingCssUrl, "utf8"),
  ]);

  assert.match(page, /page-atmosphere/);
  assert.match(page, /orbit orbit-one/);
  assert.match(page, /node node-one/);
  assert.match(page, /warm-star/);
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
