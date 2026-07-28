import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";

import {
  LEARNER_UI_ATMOSPHERE_TRACE_COUNT,
  LEARNER_UI_BREAKPOINTS,
  LEARNER_UI_FAVICON_SVG,
  LEARNER_UI_PALETTE_NAMES,
  LEARNER_UI_PALETTES,
  LEARNER_UI_VERSION,
  createLearnerUiCss,
  learnerUiJavaScript,
  renderLearnerAtmosphere,
  renderLearnerContextNavigation,
  renderLearnerFooter,
  renderLearnerHeader,
  resolveLearnerUiTheme,
} from "../dist/learner-ui.js";
import { practiceCaseSchema } from "../dist/question-group.js";

function rgb(hex) {
  return [1, 3, 5].map((offset) => (
    Number.parseInt(hex.slice(offset, offset + 2), 16)
  ));
}

function mix(first, second, firstWeight) {
  return first.map((channel, index) => (
    Math.round(
      channel * firstWeight
      + second[index] * (1 - firstWeight),
    )
  ));
}

function relativeLuminance(color) {
  return color
    .map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    })
    .reduce(
      (total, channel, index) => (
        total + channel * [0.2126, 0.7152, 0.0722][index]
      ),
      0,
    );
}

function contrastRatio(first, second) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

test("the learner UI foundation publishes stable tokens, responsive breakpoints, and accessible states", () => {
  assert.equal(LEARNER_UI_VERSION, 2);
  assert.match(LEARNER_UI_FAVICON_SVG, /^<svg[\s\S]*rotate\(-7 32 32\)[\s\S]*<\/svg>$/);
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
  assert.match(css, /\.learner-nav-menu \{ margin-left: auto; \}/);
  assert.match(css, /data-learner-collapse-at="always"/);
  assert.match(css, /--learner-width-reading:/);
  assert.match(css, /--learner-width-wide:/);
  assert.match(css, /--learner-context-nav-height: 0rem;/);
  assert.match(
    css,
    /body\.learner-ui:has\(\.learner-context-nav\) \{\s*--learner-context-nav-height: 3\.35rem;/,
  );
  assert.match(
    css,
    /\.learner-context-nav a:focus-visible \{\s*outline-offset: -3px;/,
  );
  assert.match(
    css,
    /\.learner-ui :focus-visible \{\s*outline: 3px solid var\(--learner-color-focus\)/,
  );
  assert.match(css, /\.learner-button\[data-variant="primary"\]/);
  assert.match(css, /\.learner-form label:has\(input:checked\)/);
  assert.match(css, /\.learner-examples/);
  assert.match(css, /\.learner-field__label/);
  assert.match(
    css,
    /\.learner-textarea \{[\s\S]*?background: color-mix\([\s\S]*?width: 100%;/,
  );
  assert.match(css, /\.learner-textarea\[aria-invalid="true"\]/);
  assert.match(css, /\.learner-example__actions/);
  assert.match(css, /\.learner-status\[data-tone="success"\]/);
  assert.match(css, /\.learner-results/);
  assert.match(
    css,
    /\.learner-results \{[\s\S]*?overflow-wrap: anywhere;/,
  );
  assert.match(css, /\.learner-empty/);
  assert.match(css, /\.learner-solution > summary \{[\s\S]*?min-height: 2\.75rem;/);
  assert.match(css, /\.learner-solution pre \{[\s\S]*?overflow: auto;/);
  assert.match(css, /\.learner-solution pre \{[\s\S]*?background: transparent;/);
  assert.match(
    css,
    /\.learner-editor-frame \.learner-solution \{[\s\S]*?border-top: 0;[\s\S]*?margin-top: 0;[\s\S]*?padding: 0 var\(--learner-space-4\);/,
  );
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
  assert.match(css, /\.learner-nav-menu--local-only > summary \{ display: flex; \}/);
  assert.match(css, /\.learner-primary-nav--mobile \{[\s\S]*?display: grid;/);
  assert.match(css, /\.learner-mobile-panel > summary \{ display: flex; \}/);
  assert.match(css, /\.learner-editor \{ font-size: 1rem; \}/);
  assert.match(css, /\.learner-code-editor \.cm-editor \{ font-size: 1rem; \}/);
  assert.match(css, /--learner-code-surface:/);
  assert.match(css, /--learner-code-keyword:/);
  assert.match(css, /--learner-code-selection:/);
  assert.match(
    css,
    /\.learner-editor \{[\s\S]*?background: var\(--learner-code-surface\);/,
  );
  assert.match(
    css,
    /\.learner-code-editor \{[\s\S]*?background: var\(--learner-code-surface\);/,
  );
  assert.match(
    css,
    /\.learner-editor-frame:has\(\.learner-code-editor \.cm-editor\.cm-focused\)[\s\S]*?outline: 3px solid var\(--learner-color-focus\)/,
  );
  assert.doesNotMatch(css, /\.learner-nav-menu > \.learner-nav-menu__panel \{ display: flex !important; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.learner-atmosphere__line \{[\s\S]*?opacity: 0 !important;/,
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.learner-atmosphere__line::after \{ opacity: 0 !important; \}/,
  );
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*?\.learner-atmosphere \{ display: none; \}/);
  assert.match(css, /@media print[\s\S]*?\.learner-atmosphere \{ display: none; \}/);

  assert.throws(
    () => createLearnerUiCss({ accent: "rebeccapurple" }),
    /six-digit hexadecimal color/,
  );
  assert.throws(
    () => createLearnerUiCss({ unknownToken: "#000000" }),
    /Unknown learner UI theme token/,
  );
});

test("every palette keeps shared code syntax readable on its integrated surface", () => {
  for (const [paletteName, palette] of Object.entries(LEARNER_UI_PALETTES)) {
    const codeSurface = mix(
      rgb(palette.surface),
      rgb(palette.surfaceMuted),
      0.82,
    );
    const semanticSyntax = {
      comment: palette.muted,
      function: palette.accent,
      invalid: palette.danger,
      keyword: palette.accentStrong,
      number: palette.success,
      operator: palette.accentStrong,
      property: palette.accent,
      string: palette.warning,
      text: palette.ink,
      type: palette.accentStrong,
    };
    for (const [role, color] of Object.entries(semanticSyntax)) {
      assert.ok(
        contrastRatio(rgb(color), codeSurface) >= 4.5,
        `${paletteName} ${role} must clear WCAG AA on the integrated editor surface`,
      );
    }
  }
});

test("five constrained palettes change color without changing the shared ethereal geometry", () => {
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
  assert.equal(new Set(images).size, 1);
  const withoutPaletteValues = (css) => css
    .replace(
      /--learner-color-[a-z-]+: #[0-9a-f]{6};/g,
      "--learner-color-token: <palette>;",
    )
    .replace(
      /--learner-background-(?:recipe|image|position|repeat|size): [^;]+;/g,
      "--learner-background-token: <palette>;",
    )
    .replace(
      /--learner-atmosphere-glint-strength: [^;]+;/g,
      "--learner-atmosphere-glint-strength: <palette>;",
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
  assert.match(cssByPalette[0], /--learner-atmosphere-glint-strength: 0;/);
  for (const css of cssByPalette.slice(1)) {
    assert.match(css, /--learner-atmosphere-glint-strength: \.38;/);
  }
  assert.match(cssByPalette[0], /--learner-atmosphere-line:/);
  assert.match(
    cssByPalette[0],
    /\.learner-atmosphere__line::after \{[\s\S]*?linear-gradient\(90deg,[\s\S]*?height: 1px;/,
  );
  assert.match(
    cssByPalette[0],
    /\.learner-atmosphere__line--2::after \{[\s\S]*?linear-gradient\(180deg,[\s\S]*?width: 1px;/,
  );
  assert.match(cssByPalette[0], /\.learner-atmosphere__line--intro/);
  assert.match(cssByPalette[0], /\.learner-atmosphere__line--3/);
  assert.doesNotMatch(cssByPalette.join("\n"), /radial-gradient|conic-gradient|repeating-linear-gradient/);
  assert.doesNotMatch(cssByPalette.join("\n"), /@keyframes/);
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

test("the shared atmosphere renderer emits inert CSP-safe line markup", () => {
  const atmosphere = renderLearnerAtmosphere();
  assert.equal(LEARNER_UI_ATMOSPHERE_TRACE_COUNT, 3);
  assert.match(
    atmosphere,
    /^<div class="learner-atmosphere" data-learner-atmosphere aria-hidden="true">/,
  );
  assert.match(atmosphere, /data-learner-atmosphere-intro/);
  assert.equal(
    atmosphere.match(/data-learner-atmosphere-trace/g)?.length,
    LEARNER_UI_ATMOSPHERE_TRACE_COUNT,
  );
  assert.match(atmosphere, /learner-atmosphere__line--1/);
  assert.match(atmosphere, /learner-atmosphere__line--2/);
  assert.match(atmosphere, /learner-atmosphere__line--3/);
  assert.doesNotMatch(atmosphere, /\sstyle=|<script|\son[a-z]+=/i);
});

test("the shared header escapes authored labels and accepts only same-origin local links", () => {
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

  const rootAbsoluteHeader = renderLearnerHeader({
    productName: "Learning Studio",
    homeHref: "/latent/",
    navigationLabel: "Learning suite",
    navigation: [
      { label: "LLM Systems", href: "/latent/llm-systems/", current: true },
      { label: "Practice", href: "/latent/practice/" },
    ],
  });
  assert.match(rootAbsoluteHeader, /href="\/latent\/"/);
  assert.match(rootAbsoluteHeader, /href="\/latent\/llm-systems\/"/);

  const base = {
    productName: "Practice",
    homeHref: "./",
    navigationLabel: "Practice navigation",
    navigation: [{ label: "Problems", href: "./" }],
  };
  for (const unsafeHref of [
    "//other.example/",
    "https://other.example/",
    "javascript:alert(1)",
    "/latent/../escape/",
    "./review/?mode=all",
    "./review/#content",
    ".\\review\\",
  ]) {
    assert.throws(
      () => renderLearnerHeader({
        ...base,
        navigation: [{ label: "Unsafe", href: unsafeHref }],
      }),
      /same-origin local path or fragment|traverse from a root-absolute path/,
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

test("context navigation stays in the content plane and validates trusted links", () => {
  const navigation = renderLearnerContextNavigation({
    navigationLabel: "Course <navigation>",
    navigation: [
      {
        label: "Modules <all>",
        href: "#modules",
        current: true,
        dataView: "modules",
      },
      {
        label: "Coding & lab",
        href: "./lab/",
      },
    ],
  });

  assert.match(
    navigation,
    /^<nav class="learner-context-nav" aria-label="Course &lt;navigation&gt;">/,
  );
  assert.match(navigation, /class="learner-context-nav__inner"/);
  assert.match(navigation, /href="#modules" aria-current="page" data-view="modules"/);
  assert.match(navigation, /Modules &lt;all&gt;/);
  assert.match(navigation, /href="\.\/lab\/">Coding &amp; lab<\/a>/);
  assert.doesNotMatch(navigation, /<header|<details|<all>/);
  assert.throws(
    () => renderLearnerContextNavigation({
      navigationLabel: "Course navigation",
      navigation: [{ label: "Unsafe", href: "https://example.com/" }],
    }),
    /same-origin local path or fragment/,
  );
  assert.throws(
    () => renderLearnerContextNavigation({
      navigationLabel: "Course navigation",
      navigation: [],
    }),
    /must include at least one item/,
  );
});

test("the learner UI behavior closes compact menus and restores keyboard focus", () => {
  assert.match(
    learnerUiJavaScript,
    /matchMedia\("\(max-width: 760px\), \(max-height: 500px\)"\)/,
  );
  assert.match(learnerUiJavaScript, /matchMedia\("\(max-width: 980px\)"\)/);
  assert.match(learnerUiJavaScript, /learnerCollapseAt === "stacked"/);
  assert.match(learnerUiJavaScript, /learnerCollapseAt === "always"/);
  assert.match(learnerUiJavaScript, /event\.key !== "Escape"/);
  assert.match(learnerUiJavaScript, /disclosure\.removeAttribute\("open"\)/);
  assert.match(learnerUiJavaScript, /summary\?\.focus\(\)/);
  assert.match(learnerUiJavaScript, /document\.getElementById\(link\.hash\.slice\(1\)\)/);
  assert.match(learnerUiJavaScript, /target\?\.focus\(\)/);
  assert.match(learnerUiJavaScript, /!menu\.contains\(event\.target\)/);
  assert.match(learnerUiJavaScript, /new MutationObserver/);
  assert.match(learnerUiJavaScript, /disclosure\.setAttribute\("open", ""\)/);
  assert.match(learnerUiJavaScript, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(learnerUiJavaScript, /const traceInterval = 1\.45/);
  assert.match(learnerUiJavaScript, /const traceFadeWidth = 0\.92/);
  assert.match(learnerUiJavaScript, /const traceStart = viewportHeight \* 0\.55/);
  assert.match(
    learnerUiJavaScript,
    /const traceIntroduction = Math\.min\(1, traceScroll \/ \(viewportHeight \* 0\.45\)\)/,
  );
  assert.match(learnerUiJavaScript, /Math\.cos\(\(wrappedDistance \/ traceFadeWidth\) \* Math\.PI\)/);
  assert.match(learnerUiJavaScript, /requestAnimationFrame\(updateAtmospheres\)/);
  assert.match(learnerUiJavaScript, /createSolutionDisclosure/);
  assert.match(learnerUiJavaScript, /createEditableExamples/);
  assert.match(
    learnerUiJavaScript,
    /value: Object\.freeze\(\{[\s\S]*createEditableExamples,[\s\S]*createSolutionDisclosure,[\s\S]*prepareCodeEditor/,
  );
  assert.match(learnerUiJavaScript, /JSON\.parse\(field\.input\.value\)/);
  assert.match(learnerUiJavaScript, /if \(!Array\.isArray\(parsed\)\)/);
  assert.match(learnerUiJavaScript, /parsed\.length > 20/);
  assert.match(learnerUiJavaScript, /nodes > 2000/);
  assert.match(learnerUiJavaScript, /current\.depth > 12/);
  assert.match(learnerUiJavaScript, /firstInvalid\.focus\(\)/);
  assert.match(learnerUiJavaScript, /record\.status\.textContent = labels\.received/);
  assert.match(learnerUiJavaScript, /controller\.signal\.aborted/);
  assert.match(learnerUiJavaScript, /code\.textContent = trustedSource/);
  assert.doesNotMatch(learnerUiJavaScript, /\.innerHTML/);
  assert.match(
    learnerUiJavaScript,
    /addEventListener\("scroll", scheduleAtmospheres, \{ passive: true \}\)/,
  );
  assert.match(
    learnerUiJavaScript,
    /reducedMotion\.matches\s*\? 0[\s\S]*?traceOpacity\(tracePhase, index, traces\.length\)/,
  );
  assert.match(
    learnerUiJavaScript,
    /querySelectorAll\("\.learner-nav-menu"\)\.forEach\(\(menu\) => menu\.removeAttribute\("open"\)\)/,
  );
});

test("the shared code editor adapter owns indentation, persistence events, and keyboard escape", () => {
  class FakeElement {
    constructor() {
      this.attributes = new Map();
      this.className = "";
      this.dataset = {};
      this.id = "";
      this.style = {};
      this.textContent = "";
    }

    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }

    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }
  }

  class FakeTextArea extends FakeElement {
    constructor(value) {
      super();
      this.disabled = false;
      this.listeners = new Map();
      this.parentNode = {};
      this.readOnly = false;
      this.selectionDirection = "none";
      this.selectionEnd = 0;
      this.selectionStart = 0;
      this.siblings = [];
      this.scrollLeft = 0;
      this.scrollTop = 0;
      this.value = value;
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) ?? [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    after(node) {
      this.siblings.push(node);
    }

    dispatch(type, event) {
      for (const listener of this.listeners.get(type) ?? []) listener(event);
    }

    dispatchEvent(event) {
      this.dispatch(event.type, event);
      return !event.defaultPrevented;
    }

    setRangeText(insert, from, to) {
      this.value = this.value.slice(0, from) + insert + this.value.slice(to);
    }

    setSelectionRange(start, end, direction) {
      this.selectionStart = start;
      this.selectionEnd = end;
      this.selectionDirection = direction;
    }
  }

  let now = 1_000;
  const document = {
    addEventListener() {},
    createElement() {
      return new FakeElement();
    },
    documentElement: {},
    getElementById() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
  class FakeMutationObserver {
    observe() {}
  }
  const context = {
    Date: { now: () => now },
    Element: FakeElement,
    Event,
    HTMLTextAreaElement: FakeTextArea,
    MutationObserver: FakeMutationObserver,
    addEventListener() {},
    document,
    innerHeight: 900,
    matchMedia: () => ({ addEventListener() {}, matches: false }),
    requestAnimationFrame: () => 1,
    scrollY: 0,
  };
  vm.runInNewContext(learnerUiJavaScript, context);

  const prepareCodeEditor = context.LearnerUiComponents.prepareCodeEditor;
  const editor = new FakeTextArea("first\nsecond");
  editor.setAttribute("aria-describedby", "existing-help");
  editor.selectionStart = 0;
  editor.selectionEnd = editor.value.length;
  editor.selectionDirection = "backward";
  let inputEvents = 0;
  editor.addEventListener("input", () => {
    inputEvents += 1;
  });
  prepareCodeEditor(editor, { tabSize: 4 });

  assert.equal(editor.dataset.learnerTabSize, "4");
  assert.equal(editor.style.tabSize, "4");
  assert.equal(editor.siblings.length, 1);
  assert.equal(
    editor.getAttribute("aria-describedby"),
    `existing-help ${editor.siblings[0].id}`,
  );
  assert.equal(editor.getAttribute("aria-keyshortcuts"), "Tab Shift+Tab Escape");
  assert.equal(
    editor.siblings[0].textContent,
    "Code editor. Tab indents 4 spaces; Shift+Tab outdents. Press Escape, then Tab, to leave the editor.",
  );

  const keyboardEvent = (key, overrides = {}) => ({
    altKey: false,
    ctrlKey: false,
    defaultPrevented: false,
    isComposing: false,
    key,
    metaKey: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    shiftKey: false,
    ...overrides,
  });
  const indent = keyboardEvent("Tab");
  editor.dispatch("keydown", indent);
  assert.equal(indent.defaultPrevented, true);
  assert.equal(editor.value, "    first\n    second");
  assert.deepEqual(
    [editor.selectionStart, editor.selectionEnd, editor.selectionDirection],
    [4, 20, "backward"],
  );
  assert.equal(inputEvents, 1);

  const outdent = keyboardEvent("Tab", { shiftKey: true });
  editor.dispatch("keydown", outdent);
  assert.equal(outdent.defaultPrevented, true);
  assert.equal(editor.value, "first\nsecond");
  assert.deepEqual(
    [editor.selectionStart, editor.selectionEnd, editor.selectionDirection],
    [0, 12, "backward"],
  );
  assert.equal(inputEvents, 2);

  editor.dispatch("keydown", keyboardEvent("Escape"));
  const escapeTab = keyboardEvent("Tab");
  editor.dispatch("keydown", escapeTab);
  assert.equal(escapeTab.defaultPrevented, false);
  assert.equal(editor.value, "first\nsecond");
  assert.equal(inputEvents, 2);

  editor.selectionStart = 3;
  editor.selectionEnd = 3;
  editor.selectionDirection = "none";
  editor.dispatch("keydown", keyboardEvent("Escape"));
  editor.dispatch("keydown", keyboardEvent("a"));
  const canceledEscapeTab = keyboardEvent("Tab");
  editor.dispatch("keydown", canceledEscapeTab);
  assert.equal(canceledEscapeTab.defaultPrevented, true);
  assert.equal(editor.value, "    first\nsecond");
  assert.deepEqual([editor.selectionStart, editor.selectionEnd], [7, 7]);
  assert.equal(inputEvents, 3);

  editor.dispatch("keydown", keyboardEvent("Escape"));
  now += 2_001;
  const expiredEscapeTab = keyboardEvent("Tab");
  editor.dispatch("keydown", expiredEscapeTab);
  assert.equal(expiredEscapeTab.defaultPrevented, true);
  assert.equal(editor.value, "        first\nsecond");
  assert.equal(inputEvents, 4);

  const modifiedTab = keyboardEvent("Tab", { ctrlKey: true });
  editor.dispatch("keydown", modifiedTab);
  assert.equal(modifiedTab.defaultPrevented, false);
  assert.equal(inputEvents, 4);

  const composingTab = keyboardEvent("Tab", { isComposing: true });
  editor.dispatch("keydown", composingTab);
  assert.equal(composingTab.defaultPrevented, false);
  assert.equal(inputEvents, 4);

  const mixedIndentEditor = new FakeTextArea("  \tcode\n \t  next");
  mixedIndentEditor.selectionStart = 0;
  mixedIndentEditor.selectionEnd = mixedIndentEditor.value.length;
  prepareCodeEditor(mixedIndentEditor, { tabSize: 4 });
  const mixedOutdent = keyboardEvent("Tab", { shiftKey: true });
  mixedIndentEditor.dispatch("keydown", mixedOutdent);
  assert.equal(mixedOutdent.defaultPrevented, true);
  assert.equal(mixedIndentEditor.value, "code\n  next");
  assert.deepEqual(
    [mixedIndentEditor.selectionStart, mixedIndentEditor.selectionEnd],
    [0, 11],
  );

  prepareCodeEditor(editor, { tabSize: 2 });
  assert.equal(editor.dataset.learnerTabSize, "2");
  assert.equal(editor.siblings.length, 1);
  assert.match(editor.siblings[0].textContent, /Tab indents 2 spaces/);

  let enhancedOptions = null;
  let runMode = null;
  const enhancedController = {
    destroy() {},
    focus() {},
    host: new FakeElement(),
    setDisabled() {},
    setValue() {},
  };
  context.LatentLearnerCodeEditorRuntime = {
    enhanceTextarea(_textarea, options) {
      enhancedOptions = options;
      return enhancedController;
    },
  };
  const pythonEditor = new FakeTextArea(
    "def first_echo(values):\n    return None",
  );
  pythonEditor.setAttribute("aria-label", "First echo solution");
  const preparedPythonEditor = prepareCodeEditor(pythonEditor, {
    language: "python",
    onRun: (mode) => {
      runMode = mode;
    },
    tabSize: 4,
  });
  assert.equal(preparedPythonEditor, enhancedController);
  assert.equal(pythonEditor.dataset.learnerEditorLanguage, "python");
  assert.equal(
    pythonEditor.siblings[0].textContent,
    "Python code editor. Tab indents 4 spaces; Shift+Tab outdents. Press Escape, then Tab, to leave the editor. Press Command or Control plus Enter to check; add Shift to run examples.",
  );
  assert.equal(
    pythonEditor.getAttribute("aria-keyshortcuts"),
    "Tab Shift+Tab Escape Control+Enter Meta+Enter Control+Shift+Enter Meta+Shift+Enter",
  );
  assert.equal(enhancedOptions.language, "python");
  assert.equal(enhancedOptions.variant, "integrated");
  assert.equal(enhancedOptions.ariaLabel, "First echo solution");
  assert.equal(
    enhancedOptions.ariaDescribedBy,
    pythonEditor.getAttribute("aria-describedby"),
  );
  enhancedOptions.onRun("examples");
  assert.equal(runMode, "examples");

  const plainTextEditor = new FakeTextArea("untyped source");
  assert.doesNotThrow(() => prepareCodeEditor(plainTextEditor, {
    tabSize: 2,
  }));
  assert.equal(enhancedOptions.language, "text");
});

test("editable examples validate bounded JSON, reset safely, and return actual observations without grading", async () => {
  class FakeElement {
    constructor(tagName = "div") {
      this.attributes = new Map();
      this.children = [];
      this.className = "";
      this.dataset = {};
      this.disabled = false;
      this.hidden = false;
      this.id = "";
      this.listeners = new Map();
      this.parentNode = null;
      this.tagName = tagName.toUpperCase();
      this.textContent = "";
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) ?? [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    append(...children) {
      for (const child of children) {
        child.parentNode = this;
        this.children.push(child);
      }
    }

    dispatch(type, event = {}) {
      for (const listener of this.listeners.get(type) ?? []) listener(event);
    }

    focus() {
      document.activeElement = this;
    }

    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }

    removeAttribute(name) {
      this.attributes.delete(name);
    }

    scrollIntoView() {}

    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }
  }

  class FakeTextArea extends FakeElement {
    constructor() {
      super("textarea");
      this.maxLength = 0;
      this.rows = 0;
      this.spellcheck = true;
      this.value = "";
    }
  }

  const document = {
    activeElement: null,
    addEventListener() {},
    createElement(tagName) {
      return tagName === "textarea"
        ? new FakeTextArea()
        : new FakeElement(tagName);
    },
    documentElement: new FakeElement("html"),
    getElementById() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
  class FakeMutationObserver {
    observe() {}
  }
  const context = {
    AbortController,
    Element: FakeElement,
    Event,
    HTMLTextAreaElement: FakeTextArea,
    MutationObserver: FakeMutationObserver,
    addEventListener() {},
    document,
    innerHeight: 900,
    matchMedia: () => ({ addEventListener() {}, matches: false }),
    requestAnimationFrame: () => 1,
    scrollY: 0,
  };
  vm.runInNewContext(learnerUiJavaScript, context);

  const descendants = (root) => [
    root,
    ...root.children.flatMap((child) => descendants(child)),
  ];
  const boundaryArgument = Array.from(
    { length: 200 },
    () => [0, 1, 2, 3],
  );
  let depthTwelveArgument = 0;
  for (let depth = 0; depth < 12; depth += 1) {
    depthTwelveArgument = [depthTwelveArgument];
  }
  const longArguments = Array.from(
    { length: 11 },
    () => "x".repeat(20_000),
  );
  assert.equal(practiceCaseSchema.safeParse({
    id: "boundary-compatible",
    label: "accepts every portable argument boundary independently",
    visibility: "example",
    args: [
      boundaryArgument,
      structuredClone(boundaryArgument),
      depthTwelveArgument,
      ...longArguments,
    ],
    assertions: [{
      id: "result",
      label: "returns the expected result",
      kind: "deep-equal",
      expected: null,
    }],
  }).success, true);
  const calls = [];
  const busy = [];
  const controller = context.LearnerUiComponents.createEditableExamples({
    examples: [
      {
        id: "first-repeat",
        label: "finds the repeat encountered first",
        args: [[4, 1, 7, 1, 4]],
        expected: 1,
      },
      {
        id: "independent-node-budgets",
        label: "keeps each argument's node budget independent",
        args: [
          boundaryArgument,
          structuredClone(boundaryArgument),
        ],
        expected: null,
      },
      {
        id: "maximum-depth",
        label: "accepts the maximum portable JSON depth",
        args: [depthTwelveArgument],
        expected: null,
      },
      {
        id: "portable-raw-length",
        label: "accepts portable arguments longer than the old field cap",
        args: longArguments,
        expected: null,
      },
    ],
    async onRun(request) {
      calls.push(request);
      return { status: "returned", value: 4 };
    },
    onBusyChange(value) {
      busy.push(value);
    },
  });
  const nodes = descendants(controller.element);
  const input = nodes.find((node) => node.className === "learner-textarea");
  const run = nodes.find((node) => node.textContent === "Run this input");
  const reset = nodes.find((node) => node.textContent === "Reset input");
  const status = nodes.find((node) => (
    node.className === "learner-status learner-example__status"
  ));
  const expected = nodes.find((node) => node.textContent === "1");
  const exampleControls = controller.element.children.map((fieldset) => {
    const fieldNodes = descendants(fieldset);
    return {
      input: fieldNodes.find((node) => node.className === "learner-textarea"),
      run: fieldNodes.find((node) => node.textContent === "Run this input"),
    };
  });

  assert.equal(input.value, "[[4,1,7,1,4]]");
  assert.equal(input.maxLength, 2_000_000);
  assert.equal(input.getAttribute("aria-invalid"), null);
  assert.equal(input.getAttribute("aria-keyshortcuts"), "Control+Enter Meta+Enter");
  assert.equal(expected.tagName, "CODE");

  input.value = "[[4,1,7,4,1]]";
  input.dispatch("input");
  run.dispatch("click");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(JSON.stringify(calls[0].args), "[[4,1,7,4,1]]");
  assert.equal(status.textContent, "Received: 4");
  assert.equal(status.getAttribute("data-tone"), null);
  assert.deepEqual(busy, [true, false]);

  exampleControls[1].run.dispatch("click");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls[1].args.length, 2);
  assert.equal(calls[1].args[0].length, 200);

  exampleControls[2].run.dispatch("click");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(JSON.stringify(calls[2].args), JSON.stringify([depthTwelveArgument]));

  assert.ok(exampleControls[3].input.value.length > 200_000);
  exampleControls[3].run.dispatch("click");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls[3].args.length, 11);
  const successfulCallCount = calls.length;

  input.value = "{";
  input.dispatch("input");
  run.dispatch("click");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, successfulCallCount);
  assert.equal(input.getAttribute("aria-invalid"), "true");
  assert.equal(document.activeElement, input);
  assert.match(status.textContent, /Fix the highlighted input/);

  reset.dispatch("click");
  assert.equal(input.value, "[[4,1,7,1,4]]");
  assert.equal(input.getAttribute("aria-invalid"), null);
  assert.equal(status.textContent, "Published input restored.");

  input.value = JSON.stringify(Array.from({ length: 21 }, (_, index) => index));
  input.dispatch("input");
  run.dispatch("click");
  assert.equal(calls.length, successfulCallCount);
  assert.match(
    nodes.find((node) => node.className === "learner-field__error").textContent,
    /no more than 20/,
  );

  const oversizedArgument = Array.from(
    { length: 200 },
    () => Array.from({ length: 10 }, (_, index) => index),
  );
  input.value = JSON.stringify([oversizedArgument]);
  input.dispatch("input");
  run.dispatch("click");
  assert.equal(calls.length, successfulCallCount);
  assert.match(
    nodes.find((node) => node.className === "learner-field__error").textContent,
    /Argument 1: JSON values may not contain more than 2,000 values/,
  );

  const tabEvent = {
    altKey: false,
    ctrlKey: false,
    defaultPrevented: false,
    isComposing: false,
    key: "Tab",
    metaKey: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    shiftKey: false,
  };
  input.dispatch("keydown", tabEvent);
  assert.equal(tabEvent.defaultPrevented, false);
  controller.destroy();
});
