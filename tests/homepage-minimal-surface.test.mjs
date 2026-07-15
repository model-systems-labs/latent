import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const productizationCssUrl = new URL("../app/styles/productization.css", import.meta.url);
const codingWorkspaceCssUrl = new URL("../app/styles/coding-workspace.css", import.meta.url);
const responsiveCssUrl = new URL("../app/styles/responsive.css", import.meta.url);

function cssRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected a CSS rule for ${selector}`);
  return match[1];
}

test("the homepage training demo stays on the warm editorial surface", async () => {
  const source = await readFile(productizationCssUrl, "utf8");
  const firstRunSource = source.slice(source.indexOf(".first-run {"), source.indexOf(".mobile-ide-tabs"));

  assert.match(cssRule(source, ".first-run-layout"), /background:\s*transparent/);
  assert.match(cssRule(source, ".first-run-layout"), /color:\s*var\(--ink\)/);
  assert.match(cssRule(source, ".first-run-controls"), /border-bottom:\s*1px solid var\(--line\)/);
  assert.match(cssRule(source, ".first-run-controls textarea"), /background:\s*rgba\(255,\s*255,\s*255,\s*0\.48\)/);
  assert.match(cssRule(source, ".first-run-controls textarea"), /color:\s*var\(--ink\)/);
  assert.match(cssRule(source, ".first-run-output article p"), /color:\s*var\(--ink\)/);
  assert.match(cssRule(source, ".first-run-output article p"), /min-height:\s*9rem/);
  assert.doesNotMatch(firstRunSource, /#211f23|#211f22|#272329|rgba\(255,\s*255,\s*255,\s*0\.0[468]\)/);
});

test("the homepage CTA and responsive dividers do not reintroduce dark surfaces", async () => {
  const [codingWorkspaceCss, responsiveCss] = await Promise.all([
    readFile(codingWorkspaceCssUrl, "utf8"),
    readFile(responsiveCssUrl, "utf8"),
  ]);

  const homepageCta = cssRule(codingWorkspaceCss, ".full-course-page .hero-actions a:first-child");
  assert.match(homepageCta, /background:\s*var\(--violet-wash\)/);
  assert.match(homepageCta, /color:\s*var\(--violet-deep\)/);
  assert.match(responsiveCss, /\.first-run-controls\s*\{[^}]*border-bottom:\s*1px solid var\(--line\)/s);
  assert.match(responsiveCss, /\.first-run-output article \+ article\s*\{[^}]*border-top:\s*1px solid var\(--line\)/s);
});
