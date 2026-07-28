import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  LEARNER_CODE_EDITOR_CSP_SOURCE,
  LEARNER_CODE_EDITOR_VERSION,
  LEARNER_UI_BREAKPOINTS,
  LEARNER_UI_FAVICON_SVG,
  LEARNER_UI_VERSION,
  createLearnerUiCss,
  learnerUiJavaScript,
  renderLearnerContextNavigation,
  renderLearnerFooter,
  renderLearnerHeader,
  resolveLearnerUiTheme,
} from "../tools/vendor/learner-ui.mjs";
import { createInterviewLoopHeader } from "../site-config.mjs";

const platform = JSON.parse(await readFile(
  new URL("../platform.json", import.meta.url),
  "utf8",
));

test("build-time learner UI config renders the shared shell and local assets", async () => {
  assert.equal(platform.schemaVersion, 2);
  assert.equal(LEARNER_UI_VERSION, 2);
  assert.equal(LEARNER_CODE_EDITOR_VERSION, 1);
  assert.equal(
    LEARNER_CODE_EDITOR_CSP_SOURCE,
    "'nonce-latent-learner-code-editor-v1'",
  );
  assert.deepEqual(platform.learnerUi.appearance, { palette: "sage" });
  assert.equal(LEARNER_UI_BREAKPOINTS.compact, 760);
  assert.equal(
    platform.learnerUi.contextNavigation.navigationLabel,
    "Interview Loop sections",
  );
  assert.match(platform.brand.tagline, /one webhook-delivery scenario/);
  assert.match(LEARNER_UI_FAVICON_SVG, /^<svg/);
  assert.deepEqual(
    platform.learnerUi.contextNavigation.navigation.map(({ label, href, dataView }) => ({
      label,
      href,
      dataView,
    })),
    [
      { label: "Modules", href: "#modules", dataView: "lesson" },
      { label: "Practice", href: "#practice", dataView: "practice" },
      { label: "Review", href: "#review", dataView: "cards" },
      { label: "Coding lab", href: "#coding-lab", dataView: "ide" },
    ],
  );

  const header = renderLearnerHeader(createInterviewLoopHeader());
  const contextNavigation = renderLearnerContextNavigation(
    platform.learnerUi.contextNavigation,
  );
  const footer = renderLearnerFooter(platform.learnerUi.footer);
  const css = createLearnerUiCss(
    resolveLearnerUiTheme(platform.learnerUi.appearance),
    { palette: platform.learnerUi.appearance.palette },
  );
  assert.match(header, /class="learner-header"/);
  assert.match(header, /class="learner-wordmark"[^>]*>[\s\S]*Learning Studio/);
  assert.match(header, /learner-header__meta">Courses and practice/);
  assert.doesNotMatch(header, /class="learner-global-nav"/);
  assert.match(header, /href="\.\.\/llm-systems\/">LLM Systems<\/a>/);
  assert.match(header, /href="\.\/" aria-current="page">Interview Loop<\/a>/);
  assert.match(header, /href="\.\.\/practice\/">Ten Problems<\/a>/);
  assert.equal(platform.learnerUi.header, undefined);
  assert.doesNotMatch(header, /data-view=|href="#modules"/);
  assert.match(contextNavigation, /class="learner-context-nav"/);
  assert.match(contextNavigation, /aria-label="Interview Loop sections"/);
  assert.match(contextNavigation, /href="#modules"[^>]*data-view="lesson"/);
  assert.match(contextNavigation, /href="#practice"[^>]*data-view="practice"/);
  assert.match(contextNavigation, /href="#review"[^>]*data-view="cards"/);
  assert.match(contextNavigation, /href="#coding-lab"[^>]*data-view="ide"/);
  assert.match(footer, /Built with Latent\./);
  assert.match(css, /--learner-color-canvas: #eaf1e8/);
  assert.match(css, /--learner-color-accent: #47705d/);
  assert.match(css, /--learner-background-recipe: sage/);
  assert.match(css, /--learner-atmosphere-glint-strength: \.38/);
  assert.match(css, /\.learner-atmosphere__line--3/);
  assert.match(css, /--learner-atmosphere-line:/);
  assert.doesNotMatch(css, /radial-gradient|repeating-linear-gradient/);
  assert.match(css, /--learner-font-reading: "Iowan Old Style"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(learnerUiJavaScript, /Escape/);
  assert.match(learnerUiJavaScript, /const prepareCodeEditor = /);
  assert.match(
    learnerUiJavaScript,
    /Python code editor\. [\s\S]*Tab indents [\s\S]*Shift\+Tab outdents\. Press Escape, then Tab, to leave the editor\./,
  );

  const buildSource = await readFile(new URL("../tools/build.mjs", import.meta.url), "utf8");
  for (const asset of [
    "index.html",
    "learner-code-editor.js",
    "learner-ui.css",
    "learner-ui.js",
    "favicon.svg",
  ]) {
    assert.match(buildSource, new RegExp(asset.replace(".", "\\.")));
  }
  assert.ok(
    buildSource.indexOf('<script src="./learner-code-editor.js"></script>')
      < buildSource.indexOf('<script src="./learner-ui.js" defer></script>'),
  );
  assert.match(
    buildSource,
    /style-src 'self' \$\{LEARNER_CODE_EDITOR_CSP_SOURCE\}/,
  );
  assert.doesNotMatch(buildSource, /unsafe-inline|https?:\/\/.*learner-code-editor/);
  assert.match(buildSource, /\{ palette: platform\.learnerUi\.appearance\.palette \}/);
  assert.match(buildSource, /renderLearnerContextNavigation/);
  assert.doesNotMatch(buildSource, /replaceExact|replaceAll\(before/);
});

test("learner-facing source contains no primitive-showcase advertising", async () => {
  const sources = await Promise.all([
    "../platform.json",
    "../site/app.mjs",
    "../site/styles.css",
    "../tools/build.mjs",
    "../site-config.mjs",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const learnerSource = sources.join("\n");
  assert.doesNotMatch(
    learnerSource,
    /tiny Latent platform|four ways to learn|Portable Question Groups|Trusted browser exercise|primitive-nav/i,
  );
  assert.match(
    sources[1],
    /progressValue\.textContent = passed \? "Complete" : "In progress"/,
  );
});

test("Interview interactions preserve compact focus, touch targets, and wrapped feedback", async () => {
  const [appSource, styles] = await Promise.all([
    readFile(new URL("../site/app.mjs", import.meta.url), "utf8"),
    readFile(new URL("../site/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(appSource, /scheduleFocus as focusRendered/);
  assert.match(
    appSource,
    /focusRendered\("#leeches-only", \{ revealMobilePanel: true, scroll: true \}\)/,
  );
  assert.equal(
    appSource.match(/focusRendered\("#lesson-heading", \{ scroll: true \}\)/g)?.length,
    3,
  );
  assert.match(
    appSource,
    /focusRendered\("#practice-question-heading", \{ scroll: true \}\)/,
  );
  assert.match(
    appSource,
    /openedAnotherModule \? "#lesson-heading" : "#module-complete-action"/,
  );
  assert.equal(appSource.match(/element\("h1", \{ id: ".*-heading"/g)?.length, 4);
  assert.match(appSource, /element\("h2", \{ id: "active-card-heading"/);
  assert.match(appSource, /element\("h2", \{ id: "practice-question-heading"/);
  assert.match(appSource, /element\("h2", \{ text: exercise\.title \}\)/);
  assert.equal(
    appSource.match(/element\("div", \{ className: "learner-sidebar rail"/g)?.length,
    4,
  );
  assert.doesNotMatch(appSource, /element\("aside", \{ className: "learner-sidebar rail"/);
  assert.match(appSource, /element\("div", \{ className: "learner-card callout", role: "note" \}/);
  assert.doesNotMatch(appSource, /element\("aside"/);
  assert.match(appSource, /candidate\.dataset\.view === view/);
  assert.match(appSource, /\.learner-context-nav \[data-view\]/);
  assert.doesNotMatch(appSource, /\.learner-primary-nav \[data-view\]/);
  assert.match(appSource, /tabindex: "0"/);
  assert.match(appSource, /globalThis\.LearnerUiComponents\?\.createSolutionDisclosure/);
  assert.match(appSource, /globalThis\.LearnerUiComponents\?\.prepareCodeEditor/);
  assert.equal(
    appSource.match(/EditorController = prepareCodeEditor\(editor, \{/g)?.length,
    2,
  );
  assert.match(appSource, /language: "python"/);
  assert.match(appSource, /tabSize: 4/);
  assert.equal(appSource.match(/EditorController\?\.destroy\?\.\(\)/g)?.length, 2);
  assert.match(appSource, /ideEditorController\?\.setValue\?\.\(editor\.value\)/);
  assert.doesNotMatch(appSource, /event\.key === "Tab"|setRangeText/);
  const setStatusBody = appSource.match(
    /function setStatus\(node, message, tone = "neutral"\) \{([\s\S]*?)\n\}/,
  )?.[1];
  assert.ok(setStatusBody);
  assert.doesNotMatch(setStatusBody, /\bannounce\(/);

  assert.match(styles, /\.filter \{[\s\S]*min-height: 2\.75rem;/);
  assert.match(styles, /\.work > h2,/);
  assert.match(styles, /\.flash-card h2 \{/);
  assert.doesNotMatch(styles, /\.work > h3,|\.flash-card h3 \{/);
  assert.match(
    styles,
    /\.learner-editor-toolbar \.learner-eyebrow \{[\s\S]*overflow-wrap: anywhere;/,
  );
  assert.match(
    styles,
    /\.learner-status,[\s\S]*\.case-list p \{[\s\S]*overflow-wrap: anywhere;/,
  );
  assert.match(
    styles,
    /\.view \{[\s\S]*var\(--learner-header-height\)[\s\S]*var\(--learner-context-nav-height\)/,
  );
});

test("the checked-in learner code editor is a bounded same-origin build input", async () => {
  const editorSource = await readFile(
    new URL("../tools/vendor/learner-code-editor.js", import.meta.url),
    "utf8",
  );
  assert.match(editorSource, /LatentLearnerCodeEditorRuntime/);
  assert.doesNotMatch(editorSource, /sourceMappingURL=/);
  assert.ok(
    Buffer.byteLength(editorSource) < 700_000,
    "The standalone editor should remain below the reviewed 700 KB raw budget.",
  );
});
