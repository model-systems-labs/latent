import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  LEARNER_UI_BREAKPOINTS,
  LEARNER_UI_VERSION,
  createLearnerUiCss,
  learnerUiJavaScript,
  renderLearnerFooter,
  renderLearnerHeader,
  resolveLearnerUiTheme,
} from "../tools/vendor/learner-ui.mjs";

const platform = JSON.parse(await readFile(
  new URL("../platform.json", import.meta.url),
  "utf8",
));

test("build-time learner UI config renders the shared shell and local assets", async () => {
  assert.equal(platform.schemaVersion, 2);
  assert.equal(LEARNER_UI_VERSION, 2);
  assert.deepEqual(platform.learnerUi.appearance, { palette: "sage" });
  assert.equal(LEARNER_UI_BREAKPOINTS.compact, 760);
  assert.deepEqual(
    platform.learnerUi.header.navigation.map(({ label, href, dataView }) => ({
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

  const header = renderLearnerHeader({
    productName: platform.brand.name,
    ...platform.learnerUi.header,
  });
  const footer = renderLearnerFooter(platform.learnerUi.footer);
  const css = createLearnerUiCss(
    resolveLearnerUiTheme(platform.learnerUi.appearance),
    { palette: platform.learnerUi.appearance.palette },
  );
  assert.match(header, /class="learner-header"/);
  assert.match(header, /class="learner-global-nav"/);
  assert.match(header, /href="\.\.\/">Learning Studio<\/a>/);
  assert.match(header, /href="\.\.\/llm-systems\/">LLM Systems<\/a>/);
  assert.match(header, /href="\.\/" aria-current="page">Interview Loop<\/a>/);
  assert.match(header, /href="\.\.\/practice\/">Ten Problems<\/a>/);
  assert.match(header, /href="#modules"[^>]*data-view="lesson"/);
  assert.match(header, /href="#practice"[^>]*data-view="practice"/);
  assert.match(header, /href="#review"[^>]*data-view="cards"/);
  assert.match(header, /href="#coding-lab"[^>]*data-view="ide"/);
  assert.match(footer, /Built with Latent\./);
  assert.match(css, /--learner-color-canvas: #eaf1e8/);
  assert.match(css, /--learner-color-accent: #47705d/);
  assert.match(css, /--learner-background-recipe: sage/);
  assert.match(css, /ellipse 46rem 62rem at -14% 58%/);
  assert.match(css, /--learner-font-reading: "Iowan Old Style"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(learnerUiJavaScript, /Escape/);

  const buildSource = await readFile(new URL("../tools/build.mjs", import.meta.url), "utf8");
  for (const asset of ["index.html", "learner-ui.css", "learner-ui.js"]) {
    assert.match(buildSource, new RegExp(asset.replace(".", "\\.")));
  }
  assert.match(buildSource, /\{ palette: platform\.learnerUi\.appearance\.palette \}/);
  assert.doesNotMatch(buildSource, /replaceExact|replaceAll\(before/);
});

test("learner-facing source contains no primitive-showcase advertising", async () => {
  const sources = await Promise.all([
    "../platform.json",
    "../site/app.mjs",
    "../site/styles.css",
    "../tools/build.mjs",
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
  const setStatusBody = appSource.match(
    /function setStatus\(node, message, tone = "neutral"\) \{([\s\S]*?)\n\}/,
  )?.[1];
  assert.ok(setStatusBody);
  assert.doesNotMatch(setStatusBody, /\bannounce\(/);

  assert.match(styles, /\.filter \{[\s\S]*min-height: 2\.75rem;/);
  assert.match(
    styles,
    /\.learner-editor-toolbar \.learner-eyebrow \{[\s\S]*overflow-wrap: anywhere;/,
  );
  assert.match(
    styles,
    /\.learner-status,[\s\S]*\.case-list p \{[\s\S]*overflow-wrap: anywhere;/,
  );
});
