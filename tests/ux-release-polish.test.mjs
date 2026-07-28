import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tokensUrl = new URL("../app/styles/tokens.css", import.meta.url);
const capstoneStylesUrl = new URL("../app/styles/capstone.css", import.meta.url);
const codingWorkspaceStylesUrl = new URL("../app/styles/coding-workspace.css", import.meta.url);
const courseCatalogStylesUrl = new URL("../app/styles/course-catalog.css", import.meta.url);
const learningFlowStylesUrl = new URL("../app/styles/learning-flow.css", import.meta.url);
const productizationStylesUrl = new URL("../app/styles/productization.css", import.meta.url);
const projectStructureStylesUrl = new URL("../app/styles/project-structure.css", import.meta.url);
const responsiveStylesUrl = new URL("../app/styles/responsive.css", import.meta.url);
const paperLabMobileStylesUrl = new URL("../app/components/PaperLab.module.css", import.meta.url);
const projectTemplateUrl = new URL("../examples/learning-platform/llm-learning/content/browser-chat/project-template.ts", import.meta.url);
const projectWorkbenchUrl = new URL("../app/components/ProjectWorkbench.tsx", import.meta.url);
const lessonExperimentUrl = new URL("../app/components/LessonExperiment.tsx", import.meta.url);

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  return 0.2126 * channel(Number.parseInt(hex.slice(1, 3), 16))
    + 0.7152 * channel(Number.parseInt(hex.slice(3, 5), 16))
    + 0.0722 * channel(Number.parseInt(hex.slice(5, 7), 16));
}

function contrast(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function token(source, name) {
  return source.match(new RegExp(`--${name}:\\s*[^;]*(#[0-9a-f]{6})`, "i"))?.[1];
}

function assertReadableFloor(styles, selectors) {
  for (const selector of selectors) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(styles, new RegExp(`${escaped}\\s*\\{[^}]*font-size:\\s*max\\(0\\.68rem, 11px\\)`), selector);
  }
}

function absoluteFontSizePx(value) {
  const match = value.trim().match(/^([0-9]*\.?[0-9]+)(rem|px)$/);
  if (!match) return null;
  return Number(match[1]) * (match[2] === "rem" ? 16 : 1);
}

function minimumFontSizePx(value) {
  const normalized = value.trim();
  const absolute = absoluteFontSizePx(normalized);
  if (absolute !== null) return absolute;
  const maximum = normalized.match(/^max\((.+)\)$/);
  if (maximum) {
    const values = maximum[1].split(",").map(absoluteFontSizePx);
    return values.every((item) => item !== null) ? Math.max(...values) : null;
  }
  const clamp = normalized.match(/^clamp\(([^,]+),/);
  return clamp ? absoluteFontSizePx(clamp[1]) : null;
}

function subElevenPixelSelectors(styles) {
  const selectors = [];
  for (const match of styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declaration = match[2].match(/font-size:\s*([^;]+)/);
    const minimum = declaration ? minimumFontSizePx(declaration[1]) : null;
    if (minimum !== null && minimum < 11) selectors.push(match[1].trim().replace(/\s+/g, " "));
  }
  return selectors;
}

test("outer and compiled-capstone secondary copy clears the AA contrast floor", async () => {
  const [tokens, template, capstone] = await Promise.all([
    readFile(tokensUrl, "utf8"),
    readFile(projectTemplateUrl, "utf8"),
    readFile(capstoneStylesUrl, "utf8"),
  ]);
  assert.ok(contrast(token(tokens, "muted"), token(tokens, "paper")) >= 4.5);
  assert.ok(contrast(token(tokens, "faint"), token(tokens, "paper")) >= 4.5);
  assert.ok(contrast(token(tokens, "violet"), token(tokens, "paper")) >= 4.5);
  assert.ok(contrast(token(tokens, "green"), token(tokens, "paper")) >= 4.5);
  assert.ok(contrast(token(template, "faint"), "#f3f0ec") >= 4.5);
  assert.match(template, /\.inference-panel summary > strong \{[^}]*font-size: 0\.68rem/);
  assert.match(template, /\.control-panel footer span \{[^}]*font-size: 0\.68rem/);
  assert.match(template, /\.composer > div > span \{[^}]*font-size: 0\.68rem/);
  assert.match(capstone, /\.compiled-capstone-runtime > header strong \{[\s\S]*?font-size: max\(0\.68rem, 11px\)/);
});

test("lesson evidence and model-status text retain an 11px readable floor", async () => {
  const styles = await readFile(learningFlowStylesUrl, "utf8");
  assertReadableFloor(styles, [
    ".check em",
    ".generation-status",
    ".model-loader > div em",
    ".streaming-policy-evidence b,\n.streaming-announcement-log > span",
    ".streaming-policy-evidence code",
    ".streaming-announcement-log li b",
    ".streaming-announcement-log li code",
  ]);
});

test("course progress and lesson copy retain an 11px readable floor", async () => {
  const styles = await readFile(courseCatalogStylesUrl, "utf8");
  assertReadableFloor(styles, [
    ".course-progress-record span",
    ".lesson-card.lesson-card-simple p",
    ".lesson-card.lesson-card-simple > .lesson-card-status",
  ]);
});

test("live stylesheet copy cannot regress below 11px outside audited non-text exceptions", async () => {
  const sheets = [
    ["capstone.css", capstoneStylesUrl],
    ["coding-workspace.css", codingWorkspaceStylesUrl],
    ["course-catalog.css", courseCatalogStylesUrl],
    ["learning-flow.css", learningFlowStylesUrl],
    ["productization.css", productizationStylesUrl],
    ["project-structure.css", projectStructureStylesUrl],
    ["responsive.css", responsiveStylesUrl],
  ];
  const allowed = new Map([
    ["capstone.css", [
      ".project-workbench > header p",
      ".project-editor-panel textarea",
      ".capstone-sidebar > section > span, .transport-panel > span",
      ".mode-switch button",
      ".backend-card > p, .transport-panel p",
      ".backend-card dt, .runtime-panel dt",
      ".backend-card dd, .runtime-panel dd",
      ".backend-card > button",
      ".load-progress em",
      ".phase-row i",
      ".transport-panel code",
      ".transport-panel label span",
      ".transport-panel select",
      ".active-build-proof span",
      ".active-build-proof code",
      ".capstone-sidebar > footer span",
      ".capstone-sidebar > footer button",
      ".chat-workspace > header span",
      ".chat-workspace > header strong",
      ".runtime-status",
      ".capstone-message > span",
      ".capstone-message > em",
      ".grounding-record span",
      ".grounding-record strong",
      ".chat-actions button",
      ".capstone-composer > div span",
      ".capstone-composer button",
      ".capstone-contract span",
      ".capstone-contract p",
    ]],
    ["learning-flow.css", [".check > i"]],
  ]);

  for (const [name, url] of sheets) {
    const actual = subElevenPixelSelectors(await readFile(url, "utf8")).sort();
    assert.deepEqual(actual, [...(allowed.get(name) ?? [])].sort(), name);
  }
});

test("compiled project touch targets expand on mobile without changing the desktop rule", async () => {
  const template = await readFile(projectTemplateUrl, "utf8");
  const mobile = template.slice(template.indexOf("@media (max-width: 800px)"), template.indexOf("@media (max-width: 520px)"));
  assert.match(mobile, /button, \.inference-panel details summary, input\[type="range"\] \{ min-height: 2\.75rem; \}/);
  const desktopButtons = template.match(/\.segmented-control button, \.control-panel footer button, \.conversation-heading button, \.composer button \{([^}]*)\}/)?.[1] ?? "";
  assert.doesNotMatch(desktopButtons, /min-height/);
});

test("project autosave and recovery copy explain timing and expose a concise diff preview", async () => {
  const source = await readFile(projectWorkbenchUrl, "utf8");
  assert.match(source, /window\.setTimeout\(\(\) => \{[\s\S]*?\}, 650\)/);
  assert.match(source, /Unsaved draft · saves after you stop typing for 650 ms/);
  assert.match(source, /const recoveryStored = stageProjectDraftRecovery\(selected\.path, value\)/);
  assert.match(source, /setMessage\(recoveryStored \? "Saving…" : "Saving… keep this tab open\."\)/);
  assert.match(source, /draftDifferenceSummary\(draft, candidate\.content\)/);
  assert.match(source, /\+\$\{added\} \/ −\$\{removed\} lines/);
  assert.match(source, /setMessage\("Recovery copy loaded\."\)/);
  const loadBranch = source.slice(source.indexOf("const recoveryRestaged ="), source.indexOf("setMobilePanel(\"code\")", source.indexOf("const recoveryRestaged =")));
  assert.match(loadBranch, /loadProjectDraftRecoveryCandidate\(candidate, selected\.updatedAt \+ 1\)/);
  assert.match(loadBranch, /if \(!recoveryRestaged\)[\s\S]*?return/);
  assert.doesNotMatch(loadBranch, /discardProjectDraftRecoveryCandidate/);
  assert.match(source, /draftSnapshotIsCurrent\(pendingDraftRef\.current, draftEpochRef\.current, scheduled\)/);
});

test("test-gate failures expose actionable rows while compiler failures retain Output diagnostics", async () => {
  const [source, responsive, capstone] = await Promise.all([
    readFile(projectWorkbenchUrl, "utf8"),
    readFile(responsiveStylesUrl, "utf8"),
    readFile(capstoneStylesUrl, "utf8"),
  ]);
  const build = source.slice(source.indexOf("const build = async"), source.indexOf("const runTests = async"));
  const gateFailure = build.slice(build.indexOf("if (!gate.canPromote)"), build.indexOf("const result = compileProject"));
  assert.match(gateFailure, /setBuildFailures\(gate\.failures\)/);
  assert.match(gateFailure, /showResults\("output"\)/);
  const compileFailure = build.slice(build.indexOf("if (!result.ok"), build.indexOf("const \{ repositories \}"));
  assert.match(compileFailure, /setErrors\(result\.ok/);
  assert.match(compileFailure, /showResults\("output"\)/);
  assert.match(source, /<p className="project-output-status" role="status">\{message\}<\/p>/);
  assert.match(source, /failure\.detail/);
  assert.match(source, /actionableBuildFailurePath\(\{[\s\S]*?readOnly: failure\.path === CAPSTONE_ENTRY_PATH \|\| Boolean\(project\.files\[failure\.path\]\?\.readOnly\)[\s\S]*?editableFallbackPath: CAPSTONE_COMPONENT_PATH/);
  assert.match(source, /onClick=\{\(\) => openFile\(actionPath\)\}/);
  assert.match(capstone, /\.project-output-status \{[^}]*display: block;/);
  assert.match(responsive, /\.project-output-status \{\s*display: block;/);
});

test("revision queries and restore actions are bound to the currently selected file", async () => {
  const source = await readFile(projectWorkbenchUrl, "utf8");
  assert.match(source, /revisionResponseIsCurrent\(\{[\s\S]*?requestedPath: path,[\s\S]*?selectedPath: selectedPathRef\.current,[\s\S]*?currentRequestId: revisionRequestRef\.current/);
  assert.match(source, /selectedPathRef\.current = path;[\s\S]*?revisionRequestRef\.current \+= 1;[\s\S]*?setRevisions\(\[\]\)/);
  assert.match(source, /if \(!revisionCanRestore\(selected\.path, revision\.path\)\)[\s\S]*?Nothing was restored/);
});

test("top-level navigation fits phones, preserves tablet scrolling, and keeps touch targets", async () => {
  const [source, lessonMobile] = await Promise.all([
    readFile(responsiveStylesUrl, "utf8"),
    readFile(paperLabMobileStylesUrl, "utf8"),
  ]);
  const mobileHeader = source.slice(source.indexOf("@media (max-width: 940px)"), source.indexOf("@media (max-width: 650px)"));
  assert.match(mobileHeader, /\.site-header nav \{[\s\S]*?display: flex;[\s\S]*?overflow-x: auto/);
  assert.match(mobileHeader, /\.site-header nav a \{[\s\S]*?min-height: 2\.75rem/);
  assert.doesNotMatch(mobileHeader, /\.site-header nav \{[^}]*display: none/);
  const narrowHeader = source.slice(source.indexOf("@media (max-width: 650px)"), source.indexOf("@media (prefers-reduced-motion"));
  assert.match(narrowHeader, /\.site-header nav \{[\s\S]*?display: grid;[\s\S]*?overflow: visible/);
  assert.match(narrowHeader, /\.ide-topbar nav a,[\s\S]*?\.capstone-topbar nav a \{[^}]*display: inline-flex[^}]*min-height: 2\.75rem/);
  assert.doesNotMatch(narrowHeader, /\.ide-topbar nav a,[\s\S]*?\.capstone-topbar nav a \{[^}]*display: none/);
  assert.match(narrowHeader, /\.compiled-capstone-runtime \{[\s\S]*?height: calc\(100dvh - 3\.75rem\)/);
  assert.match(narrowHeader, /@media \(max-width: 940px\) and \(max-height: 500px\)[\s\S]*?height: calc\(100dvh - 2\.75rem\)/);
  assert.match(lessonMobile, /\.lessonSectionNav \{[^}]*display: flex;[^}]*flex-wrap: wrap;/);
  assert.match(lessonMobile, /\.lessonSectionNav a \{[^}]*flex: 1 1 6rem;/);
  assert.doesNotMatch(lessonMobile, /nav-label-short/);
});

test("the in-context-learning loader honestly defers disposal when upstream cannot abort a download", async () => {
  const source = await readFile(lessonExperimentUrl, "utf8");
  const icl = source.slice(source.indexOf("function IclExperiment"), source.indexOf("type SystemsVariant"));
  assert.match(icl, /requestPipelineLoadCleanup\(lifecycle\)/);
  assert.match(icl, /generatorRef\.current = null;[\s\S]*?disposeTextGenerator\(generator\)/);
  assert.match(icl, /settlePipelineLoad\(lifecycle, operation\) === "dispose"[\s\S]*?disposeTextGenerator\(generator\)/);
  assert.match(icl, /if \(!isCurrent\(\)\) return;[\s\S]*?const raw = extractGeneratedText/);
  assert.match(icl, /may still finish the current download before it can shut down the model/);
  assert.doesNotMatch(icl, /download cancelled|abort(?:ed)? download/i);
});
