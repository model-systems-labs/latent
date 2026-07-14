import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const codeEditorUrl = new URL("../app/features/ide/CodeEditor.tsx", import.meta.url);
const projectWorkbenchUrl = new URL("../app/components/ProjectWorkbench.tsx", import.meta.url);
const capstoneCssUrl = new URL("../app/styles/capstone.css", import.meta.url);
const productizationCssUrl = new URL("../app/styles/productization.css", import.meta.url);
const responsiveCssUrl = new URL("../app/styles/responsive.css", import.meta.url);

function cssRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected a CSS rule for ${selector}`);
  return match[1];
}

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(foreground, background) {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function compositeOnHexBackground(red, green, blue, alpha, background) {
  const backgroundChannels = [1, 3, 5].map((offset) => Number.parseInt(background.slice(offset, offset + 2), 16));
  const channels = [red, green, blue].map((channel, index) => Math.round(
    (channel * alpha) + (backgroundChannels[index] * (1 - alpha)),
  ));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

test("the IDE installs a real CodeMirror syntax highlighter and keeps long lines horizontally scrollable", async () => {
  const source = await readFile(codeEditorUrl, "utf8");
  assert.match(source, /HighlightStyle\.define\s*\(/);
  assert.match(source, /syntaxHighlighting\s*\(\s*syntaxTheme\s*\)/);
  assert.match(source, /tags\.keyword/);
  assert.match(source, /tags\.comment/);
  assert.doesNotMatch(source, /EditorView\.baseTheme\s*\(/);
  assert.doesNotMatch(source, /EditorView\.lineWrapping/);
});

test("every declared editor token color clears WCAG AA contrast on the editor background", async () => {
  const source = await readFile(codeEditorUrl, "utf8");
  const paletteSource = source.match(/const editorPalette = \{([\s\S]*?)\} as const;/)?.[1];
  assert.ok(paletteSource, "CodeEditor must expose its visual palette as a reviewable constant");
  const palette = Object.fromEntries(
    [...paletteSource.matchAll(/(\w+):\s*"(#[0-9a-f]{6})"/gi)].map((match) => [match[1], match[2]]),
  );
  assert.match(palette.background ?? "", /^#[0-9a-f]{6}$/i);
  for (const [name, color] of Object.entries(palette)) {
    if (name === "background") continue;
    assert.ok(
      contrastRatio(color, palette.background) >= 4.5,
      `${name} (${color}) must remain readable on ${palette.background}`,
    );
  }
  const selection = source.match(/cm-selectionBackground[\s\S]*?rgba\((\d+),(\d+),(\d+),([.\d]+)\)/);
  assert.ok(selection, "the selection background must remain explicitly reviewable");
  const selectedBackground = compositeOnHexBackground(
    Number(selection[1]),
    Number(selection[2]),
    Number(selection[3]),
    Number(selection[4]),
    palette.background,
  );
  for (const [name, color] of Object.entries(palette)) {
    if (name === "background" || name === "gutter") continue;
    assert.ok(
      contrastRatio(color, selectedBackground) >= 4.5,
      `${name} (${color}) must remain readable when text is selected on ${selectedBackground}`,
    );
  }
});

test("the mobile IDE source contract preserves readable type, bounded scrolling, focus, and touch targets", async () => {
  const [source, responsiveCss] = await Promise.all([
    readFile(codeEditorUrl, "utf8"),
    readFile(responsiveCssUrl, "utf8"),
  ]);
  assert.match(source, /&\.cm-focused[\s\S]*?outline:\s*"2px solid/);
  assert.match(source, /overscrollBehaviorX:\s*"contain"[\s\S]*?overscrollBehaviorY:\s*"auto"/);
  assert.match(source, /import \{ indentWithTab, temporarilySetTabFocusMode \} from "@codemirror\/commands"/);
  assert.match(source, /Prec\.high\(keymap\.of\(\[\s*\{ key: "Escape", run: temporarilySetTabFocusMode \},\s*indentWithTab/);
  assert.match(source, /"aria-describedby":\s*instructionId/);
  assert.match(source, /Tab indents\. Press Escape, then Tab, to leave the editor\./);
  assert.match(source, /<div className="code-editor" ref=\{hostRef\}\s*\/>\s*<span className="sr-only" id=\{instructionId\}>/);
  assert.doesNotMatch(source, /<div className="code-editor" ref=\{hostRef\}>\s*<span/);
  assert.match(responsiveCss, /\.project-workbench-grid\[data-mobile-view="code"\][\s\S]*?\.cm-editor\s*\{[\s\S]*?font-size:\s*16px/);
  assert.match(responsiveCss, /\.project-workbench-grid\[data-mobile-view="code"\][\s\S]*?\.cm-scroller\s*\{[\s\S]*?overflow-x:\s*auto/);
  assert.match(responsiveCss, /touch-action:\s*pan-x pan-y pinch-zoom/);
  assert.match(responsiveCss, /overscroll-behavior-y:\s*auto/);
  assert.match(responsiveCss, /\.project-editor-panel\s*>\s*footer button\s*\{[\s\S]*?min-height:\s*2\.75rem/);
  assert.match(responsiveCss, /\.code-editor\s*\{[\s\S]*?max-width:\s*100%/);
  assert.match(responsiveCss, /\.mobile-ide-tabs button\s*\{[\s\S]*?color:\s*#aaa3ad[\s\S]*?font-size:\s*0\.7rem[\s\S]*?min-height:\s*3\.25rem/);
  assert.ok(contrastRatio("#aaa3ad", "#1f1d21") >= 4.5, "inactive mobile tabs must clear AA contrast");
});

test("the mobile code view is a bounded viewport instead of growing to the full source height", async () => {
  const responsiveCss = await readFile(responsiveCssUrl, "utf8");
  const panel = cssRule(
    responsiveCss,
    '.project-workbench-grid[data-mobile-view="code"] > .project-editor-panel',
  );
  assert.match(panel, /grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto/);
  assert.match(panel, /height:\s*calc\(100dvh - 11rem\)/);
  assert.match(panel, /max-height:\s*calc\(100dvh - 11rem\)/);
  assert.match(panel, /min-height:\s*0/);

  const host = cssRule(
    responsiveCss,
    '.project-workbench-grid[data-mobile-view="code"] .code-editor',
  );
  assert.match(host, /height:\s*100%/);
  assert.match(host, /max-height:\s*100%/);
  assert.match(host, /min-height:\s*0/);

  const editor = cssRule(
    responsiveCss,
    '.project-workbench-grid[data-mobile-view="code"] .code-editor .cm-editor',
  );
  assert.match(editor, /height:\s*100%/);
  assert.match(editor, /max-height:\s*100%/);
  assert.match(editor, /min-height:\s*0/);

  const scroller = cssRule(
    responsiveCss,
    '.project-workbench-grid[data-mobile-view="code"] .code-editor .cm-scroller',
  );
  assert.match(scroller, /height:\s*100%/);
  assert.match(scroller, /min-height:\s*0/);
  assert.match(scroller, /overflow-x:\s*auto/);
  assert.match(scroller, /overflow-y:\s*auto/);
  assert.match(scroller, /overscroll-behavior-x:\s*contain/);
  assert.match(scroller, /overscroll-behavior-y:\s*auto/);
});

test("mobile IDE microcopy stays legible across files, code, tests, and output", async () => {
  const responsiveCss = await readFile(responsiveCssUrl, "utf8");
  const secondary = "#aaa3ad";
  assert.ok(contrastRatio(secondary, "#1f1d22") >= 4.5, "secondary copy must clear AA on the IDE");
  assert.ok(contrastRatio(secondary, "#262329") >= 4.5, "secondary copy must clear AA on the inspector");

  assert.match(responsiveCss, /\.project-progress span\s*\{[^}]*color:\s*#aaa3ad\s*!important[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(responsiveCss, /\.project-header-actions button\s*\{[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(responsiveCss, /\.project-workbench-grid\[data-mobile-view="files"\] > \.project-tree section > span\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(responsiveCss, /\.project-workbench-grid\[data-mobile-view="files"\] > \.project-tree button > em,[\s\S]*?\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(responsiveCss, /\.project-workbench-grid\[data-mobile-view="code"\] \.project-editor-panel > header > div:first-child strong\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*0\.7rem/);
  assert.match(responsiveCss, /\.project-workbench-grid\[data-mobile-view="code"\] \.project-editor-panel > header > div:last-child\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(responsiveCss, /\.project-editor-panel > footer p\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*0\.7rem/);
  assert.match(responsiveCss, /\.unit-test-list article p\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(responsiveCss, /\.project-output dt\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(responsiveCss, /\.project-file-history > div em,[\s\S]*?\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
});

test("desktop IDE microcopy uses the same release-quality size and contrast floor", async () => {
  const [capstoneCss, productizationCss] = await Promise.all([
    readFile(capstoneCssUrl, "utf8"),
    readFile(productizationCssUrl, "utf8"),
  ]);
  assert.match(capstoneCss, /\.project-progress span\s*\{[^}]*color:\s*#aaa3ad\s*!important[^}]*font-size:\s*max\(0\.68rem, 11px\)\s*!important/);
  assert.match(capstoneCss, /\.project-header-actions button\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(capstoneCss, /\.project-tree section > span\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(capstoneCss, /\.project-tree button > em,[\s\S]*?\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(capstoneCss, /\.project-editor-panel > header > div:first-child strong\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(capstoneCss, /\.project-editor-panel > header > div:last-child\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(capstoneCss, /\.project-editor-panel > footer p\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*0\.7rem/);
  assert.match(capstoneCss, /\.unit-test-list article p\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(capstoneCss, /\.project-output dt\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(productizationCss, /\.project-file-history > div em,[\s\S]*?\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
});

test("the mobile view switcher uses honest toggle-button semantics", async () => {
  const source = await readFile(projectWorkbenchUrl, "utf8");
  assert.match(source, /<nav className="mobile-ide-tabs" aria-label="Choose a project workspace view">/);
  assert.match(source, /<button type="button" aria-pressed=\{mobilePanel === panel\}/);
  assert.doesNotMatch(source, /role="tablist"/);
  assert.doesNotMatch(source, /role="tab"/);
  assert.doesNotMatch(source, /aria-selected=\{mobilePanel === panel\}/);
});
