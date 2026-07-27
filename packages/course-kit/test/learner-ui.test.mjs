import assert from "node:assert/strict";
import { test } from "node:test";

import {
  LEARNER_UI_BREAKPOINTS,
  LEARNER_UI_PALETTE_NAMES,
  LEARNER_UI_PALETTES,
  LEARNER_UI_VERSION,
  createLearnerUiCss,
  learnerUiJavaScript,
  renderLearnerFooter,
  renderLearnerHeader,
  resolveLearnerUiTheme,
} from "../dist/learner-ui.js";

test("the learner UI foundation publishes stable tokens, responsive breakpoints, and accessible states", () => {
  assert.equal(LEARNER_UI_VERSION, 2);
  assert.deepEqual(
    { ...LEARNER_UI_BREAKPOINTS },
    { compact: 760, stacked: 980, wide: 1280 },
  );

  const css = createLearnerUiCss({
    accent: "#123ABC",
    focus: "#FEDCBA",
  });
  assert.match(css, /--learner-font-sans:/);
  assert.match(css, /--learner-font-reading:/);
  assert.match(css, /--learner-font-mono:/);
  assert.match(css, /--learner-color-accent: #123abc;/);
  assert.match(css, /--learner-color-focus: #fedcba;/);
  assert.match(css, /--learner-space-8:/);
  assert.match(css, /--learner-border:/);
  assert.match(css, /--learner-width-reading:/);
  assert.match(css, /--learner-width-wide:/);
  assert.match(
    css,
    /\.learner-ui :focus-visible \{\s*outline: 3px solid var\(--learner-color-focus\)/,
  );
  assert.match(css, /\.learner-button\[data-variant="primary"\]/);
  assert.match(css, /\.learner-form label:has\(input:checked\)/);
  assert.match(css, /\.learner-status\[data-tone="success"\]/);
  assert.match(css, /\.learner-results/);
  assert.match(
    css,
    /\.learner-results \{[\s\S]*?overflow-wrap: anywhere;/,
  );
  assert.match(css, /\.learner-empty/);
  assert.match(css, /\.learner-editor-frame/);
  assert.match(
    css,
    /\.learner-editor-frame:has\(\.learner-editor:focus-visible\)[\s\S]*outline: 3px solid var\(--learner-color-focus\)/,
  );
  assert.match(css, /\.learner-progress-summary/);
  assert.match(css, /\.learner-sr-only/);
  assert.match(
    css,
    /\.learner-wordmark \{[\s\S]*?min-height: 2\.75rem;/,
  );
  assert.match(
    css,
    /\.learner-nav-menu > summary \{[\s\S]*?min-height: 2\.75rem;/,
  );
  assert.match(
    css,
    /\.learner-global-nav a,[\s\S]*?\.learner-primary-nav a \{[\s\S]*?min-height: 2\.75rem;/,
  );
  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /data-learner-collapse-at="stacked"/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.learner-primary-nav--desktop \{ display: none; \}/);
  assert.match(css, /\.learner-nav-menu > summary \{ display: flex; \}/);
  assert.match(css, /\.learner-primary-nav--mobile \{[\s\S]*?display: grid;/);
  assert.match(css, /\.learner-mobile-panel > summary \{ display: flex; \}/);
  assert.match(css, /\.learner-editor \{ font-size: 1rem; \}/);
  assert.doesNotMatch(css, /\.learner-nav-menu > \.learner-nav-menu__panel \{ display: flex !important; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

  assert.throws(
    () => createLearnerUiCss({ accent: "rebeccapurple" }),
    /six-digit hexadecimal color/,
  );
  assert.throws(
    () => createLearnerUiCss({ unknownToken: "#000000" }),
    /Unknown learner UI theme token/,
  );
});

test("five constrained palettes change color and atmosphere without changing component grammar", () => {
  assert.deepEqual(
    [...LEARNER_UI_PALETTE_NAMES],
    ["paper", "sage", "cobalt", "plum", "graphite"],
  );
  assert.deepEqual(Object.keys(LEARNER_UI_PALETTES), [...LEARNER_UI_PALETTE_NAMES]);

  const cssByPalette = LEARNER_UI_PALETTE_NAMES.map((palette) => (
    createLearnerUiCss(resolveLearnerUiTheme({ palette }), { palette })
  ));
  const recipes = cssByPalette.map((css) => (
    css.match(/--learner-background-recipe: ([a-z]+);/)?.[1]
  ));
  const images = cssByPalette.map((css) => (
    css.match(/--learner-background-image: ([^;]+);/)?.[1]
  ));
  assert.deepEqual(recipes, [...LEARNER_UI_PALETTE_NAMES]);
  assert.equal(new Set(images).size, LEARNER_UI_PALETTE_NAMES.length);
  const withoutPaletteValues = (css) => css
    .replace(
      /--learner-color-[a-z-]+: #[0-9a-f]{6};/g,
      "--learner-color-token: <palette>;",
    )
    .replace(
      /--learner-background-(?:recipe|image|position|repeat|size): [^;]+;/g,
      "--learner-background-token: <palette>;",
    );
  assert.equal(new Set(cssByPalette.map(withoutPaletteValues)).size, 1);
  assert.match(cssByPalette[0], /--learner-color-canvas: #f4f0e8;/);
  assert.match(cssByPalette[0], /--learner-color-accent: #78667d;/);
  assert.match(cssByPalette[0], /--learner-font-reading: "Iowan Old Style"/);
  assert.match(cssByPalette[0], /--learner-background-recipe: paper;/);
  assert.match(cssByPalette[1], /--learner-color-accent: #47705d;/);
  assert.match(cssByPalette[1], /--learner-color-canvas: #eaf1e8;/);
  assert.match(cssByPalette[2], /--learner-color-accent: #42629b;/);
  assert.match(cssByPalette[2], /--learner-color-canvas: #eaf0fa;/);
  assert.doesNotMatch(cssByPalette.join("\n"), /url\(|https?:/);

  const legacyCss = createLearnerUiCss({ accent: "#123abc" });
  assert.match(legacyCss, /--learner-color-accent: #123abc;/);
  assert.match(legacyCss, /--learner-background-recipe: paper;/);
  const sageOverrideCss = createLearnerUiCss(
    resolveLearnerUiTheme({
      palette: "sage",
      theme: { accent: "#123abc" },
    }),
    { palette: "sage" },
  );
  assert.match(sageOverrideCss, /--learner-color-accent: #123abc;/);
  assert.match(sageOverrideCss, /--learner-background-recipe: sage;/);
  assert.throws(
    () => resolveLearnerUiTheme({ palette: "neon" }),
    /Unknown learner UI palette/,
  );
  assert.throws(
    () => createLearnerUiCss({}, { palette: "neon" }),
    /Unknown learner UI palette/,
  );
  assert.throws(
    () => createLearnerUiCss({}, { pattern: "grid" }),
    /Unknown learner UI CSS option/,
  );
  assert.throws(
    () => resolveLearnerUiTheme({ palette: "paper", spacing: "loose" }),
    /Unknown learner UI appearance field/,
  );
});

test("the shared header escapes authored labels and accepts only same-origin relative links", () => {
  const header = renderLearnerHeader({
    productName: "Practice <Lab>",
    homeHref: "../",
    homeLabel: 'Return to "Practice"',
    globalNavigationLabel: "Learning <experiences>",
    globalNavigation: [
      { label: "Course", href: "../course/" },
      { label: "Practice", href: "./", current: true },
    ],
    navigationLabel: "Primary <navigation>",
    menuLabel: "Open & close",
    meta: "Version <1>",
    navigation: [
      {
        label: "Problems <all>",
        href: "./",
        current: true,
        dataView: "problem-list",
      },
      {
        label: "Review & retry",
        href: "./review/",
      },
    ],
  });

  assert.match(header, /Practice &lt;Lab&gt;/);
  assert.match(header, /aria-label="Return to &quot;Practice&quot;"/);
  assert.match(header, /aria-label="Primary &lt;navigation&gt;"/);
  assert.match(header, /Open &amp; close/);
  assert.match(header, /Version &lt;1&gt;/);
  assert.match(header, /class="learner-global-nav"/);
  assert.match(header, /aria-label="Learning &lt;experiences&gt;"/);
  assert.match(header, /href="\.\.\/course\/">Course<\/a>/);
  assert.match(header, /Problems &lt;all&gt;/);
  assert.match(header, /Review &amp; retry/);
  assert.match(header, /<details class="learner-nav-menu">/);
  assert.doesNotMatch(header, /<details class="learner-nav-menu" open>/);
  assert.match(header, /class="learner-nav-menu__panel"/);
  assert.match(header, /learner-primary-nav learner-primary-nav--desktop/);
  assert.match(header, /learner-primary-nav learner-primary-nav--mobile/);
  assert.match(header, /href="\.\.\/"/);
  assert.match(header, /href="\.\/review\/"/);
  assert.match(header, /aria-current="page"/);
  assert.match(header, /data-view="problem-list"/);
  assert.doesNotMatch(header, /<Lab>|<navigation>|<all>/);

  const base = {
    productName: "Practice",
    homeHref: "./",
    navigationLabel: "Practice navigation",
    navigation: [{ label: "Problems", href: "./" }],
  };
  for (const unsafeHref of [
    "/absolute/",
    "//other.example/",
    "https://other.example/",
    "javascript:alert(1)",
    "./review/?mode=all",
    "./review/#content",
    ".\\review\\",
  ]) {
    assert.throws(
      () => renderLearnerHeader({
        ...base,
        navigation: [{ label: "Unsafe", href: unsafeHref }],
      }),
      /same-origin relative path or fragment/,
      unsafeHref,
    );
  }
  assert.throws(
    () => renderLearnerHeader({
      ...base,
      navigation: [{ label: "Unsafe", href: "./", dataView: "bad view" }],
    }),
    /simple identifier/,
  );

  const footer = renderLearnerFooter({
    summary: "Progress <stays> here",
    attribution: "Built & reviewed",
  });
  assert.match(footer, /Progress &lt;stays&gt; here/);
  assert.match(footer, /Built &amp; reviewed/);
  assert.doesNotMatch(footer, /<stays>/);
});

test("the learner UI behavior closes compact menus and restores keyboard focus", () => {
  assert.match(
    learnerUiJavaScript,
    /matchMedia\("\(max-width: 760px\), \(max-height: 500px\)"\)/,
  );
  assert.match(learnerUiJavaScript, /matchMedia\("\(max-width: 980px\)"\)/);
  assert.match(learnerUiJavaScript, /learnerCollapseAt === "stacked"/);
  assert.match(learnerUiJavaScript, /event\.key !== "Escape"/);
  assert.match(learnerUiJavaScript, /disclosure\.removeAttribute\("open"\)/);
  assert.match(learnerUiJavaScript, /summary\?\.focus\(\)/);
  assert.match(learnerUiJavaScript, /document\.getElementById\(link\.hash\.slice\(1\)\)/);
  assert.match(learnerUiJavaScript, /target\?\.focus\(\)/);
  assert.match(learnerUiJavaScript, /!menu\.contains\(event\.target\)/);
  assert.match(learnerUiJavaScript, /new MutationObserver/);
  assert.match(learnerUiJavaScript, /disclosure\.setAttribute\("open", ""\)/);
  assert.match(
    learnerUiJavaScript,
    /querySelectorAll\("\.learner-nav-menu"\)\.forEach\(\(menu\) => menu\.removeAttribute\("open"\)\)/,
  );
});
