import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const codeEditorUrl = new URL("../app/features/ide/CodeEditor.tsx", import.meta.url);
const projectWorkbenchUrl = new URL("../app/components/ProjectWorkbench.tsx", import.meta.url);
const capstoneCssUrl = new URL("../app/styles/capstone.css", import.meta.url);
const productizationCssUrl = new URL("../app/styles/productization.css", import.meta.url);
const responsiveCssUrl = new URL("../app/styles/responsive.css", import.meta.url);
const paperLabMobileCssUrl = new URL("../app/components/PaperLab.module.css", import.meta.url);

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
  assert.match(source, /syntaxHighlighting\s*\(\s*variant === "lesson" \? lessonSyntaxTheme : syntaxTheme\s*\)/);
  assert.match(source, /variant === "lesson" \? lessonTheme : latentTheme/);
  assert.match(source, /tags\.keyword/);
  assert.match(source, /tags\.comment/);
  assert.doesNotMatch(source, /EditorView\.baseTheme\s*\(/);
  assert.doesNotMatch(source, /EditorView\.lineWrapping/);
});

test("the lesson editor uses a mutually exclusive light theme whose tokens clear WCAG AA", async () => {
  const source = await readFile(codeEditorUrl, "utf8");
  const paletteSource = source.match(/const lessonEditorPalette = \{([\s\S]*?)\} as const;/)?.[1];
  assert.ok(paletteSource, "CodeEditor must expose a reviewable lesson palette");
  const palette = Object.fromEntries(
    [...paletteSource.matchAll(/(\w+):\s*"(#[0-9a-f]{6})"/gi)].map((match) => [match[1], match[2]]),
  );
  assert.match(source, /const lessonTheme = EditorView\.theme\([\s\S]*?\}, \{ dark: false \}\);/);
  assert.match(source, /const latentTheme = EditorView\.theme\([\s\S]*?\}, \{ dark: true \}\);/);
  assert.doesNotMatch(source, /latentTheme,\s*variant === "lesson"/);
  for (const [name, color] of Object.entries(palette)) {
    if (name === "background") continue;
    assert.ok(
      contrastRatio(color, palette.background) >= 4.5,
      `lesson ${name} (${color}) must remain readable on ${palette.background}`,
    );
  }
  const lessonThemeSource = source.slice(source.indexOf("const lessonTheme"), source.indexOf("const syntaxTheme"));
  const activeLineBackground = lessonThemeSource.match(/"\.cm-activeLine":\s*\{[^\n]*backgroundColor:\s*"([^"]+)"/)?.[1];
  const activeLineGutterBackground = lessonThemeSource.match(/"\.cm-activeLineGutter":\s*\{[^\n]*backgroundColor:\s*"(#[0-9a-f]{6})"/)?.[1];
  const selectedBackground = lessonThemeSource.match(/cm-selectionBackground[^\n]*backgroundColor: "(#[0-9a-f]{6})"/)?.[1];
  assert.equal(activeLineBackground, "transparent", "the active line must not cover CodeMirror's selection layer");
  assert.match(activeLineGutterBackground ?? "", /^#[0-9a-f]{6}$/i);
  assert.match(selectedBackground ?? "", /^#[0-9a-f]{6}$/i);
  assert.match(
    lessonThemeSource,
    /&\.cm-focused > \.cm-scroller > \.cm-selectionLayer \.cm-selectionBackground[^\n]*backgroundColor: "#[0-9a-f]{6}"/,
    "the lesson selection color must beat CodeMirror's focused-selection specificity",
  );
  assert.match(lessonThemeSource, /"\.cm-selectionMatch":\s*\{[^\n]*backgroundColor:/, "other occurrences of a selected token should also be visible");
  assert.ok(
    contrastRatio(selectedBackground, palette.background) >= 1.3,
    `selection ${selectedBackground} must be visibly distinct from editor ${palette.background}`,
  );
  assert.ok(
    contrastRatio(palette.gutter, activeLineGutterBackground) >= 4.5,
    `lesson gutter (${palette.gutter}) must remain readable on active line ${activeLineGutterBackground}`,
  );
  for (const [name, color] of Object.entries(palette)) {
    if (name === "background" || name === "gutter") continue;
    assert.ok(
      contrastRatio(color, selectedBackground) >= 4.5,
      `lesson ${name} (${color}) must remain readable on selected text background ${selectedBackground}`,
    );
  }
  assert.match(lessonThemeSource, /userSelect:\s*"text"/);
  assert.match(lessonThemeSource, /WebkitUserSelect:\s*"text"/);
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
  const latentThemeSource = source.slice(source.indexOf("const latentTheme"), source.indexOf("const lessonTheme"));
  assert.match(
    latentThemeSource,
    /&\.cm-focused > \.cm-scroller > \.cm-selectionLayer \.cm-selectionBackground[^\n]*backgroundColor: "rgba\(181,151,209,\.20\)"/,
    "the project selection color must beat CodeMirror's focused-selection specificity",
  );
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
  assert.match(source, /const editableEditorInstruction = "Code editor\. Tab indents\. Press Escape, then Tab, to leave the editor\."/);
  const readOnlyInstruction = source.match(/const readOnlyEditorInstruction = "([^"]+)"/)?.[1];
  assert.equal(
    readOnlyInstruction,
    "Read-only code example. Use the arrow keys to navigate the code. Press Escape, then Tab, to leave the code example.",
  );
  assert.doesNotMatch(readOnlyInstruction, /Tab indents/);
  assert.match(source, /\{readOnly \? readOnlyEditorInstruction : editableEditorInstruction\}/);
  assert.match(source, /className=\{variant === "lesson" \? "code-editor lesson-code-editor" : "code-editor"\}[\s\S]*?ref=\{hostRef\}[\s\S]*?\/>\s*<span className="sr-only" id=\{instructionId\}>/);
  assert.doesNotMatch(source, /<div className="code-editor" ref=\{hostRef\}>\s*<span/);
  assert.match(responsiveCss, /\.project-workbench-grid\[data-mobile-view="code"\][\s\S]*?\.cm-editor\s*\{[\s\S]*?font-size:\s*16px/);
  assert.match(responsiveCss, /\.project-workbench-grid\[data-mobile-view="code"\][\s\S]*?\.cm-scroller\s*\{[\s\S]*?overflow-x:\s*auto/);
  assert.match(responsiveCss, /touch-action:\s*pan-x pan-y pinch-zoom/);
  assert.match(responsiveCss, /overscroll-behavior-y:\s*auto/);
  assert.match(responsiveCss, /\.project-editor-panel\s*>\s*footer button\s*\{[\s\S]*?min-height:\s*2\.75rem/);
  assert.match(responsiveCss, /\.code-editor\s*\{[\s\S]*?max-width:\s*100%/);
  assert.match(responsiveCss, /\.mobile-ide-tabs button\s*\{[\s\S]*?color:\s*#aaa3ad[\s\S]*?font-size:\s*0\.7rem[\s\S]*?min-height:\s*2\.75rem/);
  assert.ok(contrastRatio("#aaa3ad", "#1f1d21") >= 4.5, "inactive mobile tabs must clear AA contrast");
});

test("the mobile code view is a bounded viewport instead of growing to the full source height", async () => {
  const responsiveCss = await readFile(responsiveCssUrl, "utf8");
  const shell = cssRule(responsiveCss, ".ide-shell");
  assert.match(shell, /grid-template-rows:\s*auto minmax\(0,\s*1fr\)/);
  assert.match(shell, /height:\s*100dvh/);
  assert.match(shell, /min-height:\s*0/);
  assert.match(shell, /overflow:\s*hidden/);

  const workbench = cssRule(responsiveCss, ".ide-shell .project-workbench");
  assert.match(workbench, /grid-template-rows:\s*auto auto minmax\(0,\s*1fr\)/);
  assert.match(workbench, /height:\s*100%/);
  assert.match(workbench, /min-height:\s*0/);
  assert.match(workbench, /overflow:\s*hidden/);

  const grid = cssRule(responsiveCss, ".ide-shell .project-workbench-grid");
  assert.match(grid, /height:\s*100%/);
  assert.match(grid, /min-height:\s*0/);
  assert.match(grid, /overflow:\s*hidden/);

  const panel = cssRule(
    responsiveCss,
    '.project-workbench-grid[data-mobile-view="code"] > .project-editor-panel',
  );
  assert.match(panel, /grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto/);
  assert.match(panel, /height:\s*100%/);
  assert.match(panel, /max-height:\s*100%/);
  assert.match(panel, /min-height:\s*0/);
  assert.doesNotMatch(panel, /calc\(100dvh/);

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

test("the desktop IDE keeps its three panes inside one workspace viewport", async () => {
  const capstoneCss = await readFile(capstoneCssUrl, "utf8");
  const desktopBlock = capstoneCss.match(/@media \(min-width: 941px\) \{([\s\S]*)\n\}\n\n\.project-workbench/)?.[1];
  assert.ok(desktopBlock, "the desktop IDE must own an explicit wide-screen viewport contract");

  const shell = cssRule(desktopBlock, ".ide-shell");
  assert.match(shell, /grid-template-rows:\s*auto minmax\(0,\s*1fr\)/);
  assert.match(shell, /height:\s*100dvh/);
  assert.match(shell, /overflow:\s*hidden/);

  const workbench = cssRule(desktopBlock, ".ide-shell .project-workbench");
  assert.match(workbench, /grid-template-rows:\s*auto minmax\(0,\s*1fr\)/);
  assert.match(workbench, /min-height:\s*0/);

  const tree = cssRule(desktopBlock, ".ide-shell .project-tree");
  assert.match(tree, /max-height:\s*none/);
  assert.match(tree, /overflow-y:\s*auto/);

  const editor = cssRule(desktopBlock, ".ide-shell .project-editor-panel");
  assert.match(editor, /grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto/);
  assert.match(editor, /overflow:\s*hidden/);

  const scroller = cssRule(desktopBlock, ".ide-shell .project-editor-panel .code-editor .cm-scroller");
  assert.match(scroller, /height:\s*100%/);
  assert.match(scroller, /overflow:\s*auto/);

  const inspector = cssRule(desktopBlock, ".ide-shell .project-inspector");
  assert.match(inspector, /overflow-y:\s*auto/);
});

test("the mobile project header fits its actions without shrinking touch targets", async () => {
  const responsiveCss = await readFile(responsiveCssUrl, "utf8");
  const actions = cssRule(responsiveCss, ".project-header-actions");
  assert.match(actions, /display:\s*grid/);
  assert.match(actions, /grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);

  const actionGroup = cssRule(responsiveCss, ".project-header-actions > div:last-child");
  assert.match(actionGroup, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);

  const button = cssRule(responsiveCss, ".project-header-actions button");
  assert.match(button, /min-height:\s*2\.75rem/);
  assert.match(button, /min-width:\s*0/);
  assert.match(button, /width:\s*100%/);
});

test("the mobile editor status yields space to the selected file name", async () => {
  const [source, responsiveCss] = await Promise.all([
    readFile(projectWorkbenchUrl, "utf8"),
    readFile(responsiveCssUrl, "utf8"),
  ]);
  assert.match(source, /const compactEditorStatus = selected\?\.readOnly \? "Read only" : dirty \? "Unsaved" : "Saved"/);
  assert.match(source, /<div role="status" aria-live="polite" aria-atomic="true">[\s\S]*?<span aria-hidden="true">\{compactEditorStatus\}<\/span><span className="sr-only">\{editorStatus\}<\/span>/);

  const status = cssRule(
    responsiveCss,
    '.project-workbench-grid[data-mobile-view="code"] .project-editor-panel > header > div:last-child',
  );
  assert.match(status, /grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
  assert.match(status, /min-width:\s*0/);

  const statusText = cssRule(
    responsiveCss,
    '.project-workbench-grid[data-mobile-view="code"] .project-editor-panel > header > div:last-child > span',
  );
  assert.match(statusText, /overflow:\s*hidden/);
  assert.match(statusText, /text-overflow:\s*ellipsis/);
  assert.match(statusText, /white-space:\s*nowrap/);
});

test("lesson practice uses the available mobile viewport width", async () => {
  const lessonMobileCss = await readFile(paperLabMobileCssUrl, "utf8");
  const practice = cssRule(lessonMobileCss, ".lessonShell :global(.implementation-section .practice-editor)");
  assert.match(practice, /margin-left:\s*-0\.75rem/);
  assert.match(practice, /max-width:\s*calc\(100% \+ 1\.5rem\)/);
  assert.match(practice, /width:\s*calc\(100% \+ 1\.5rem\)/);

  const surface = cssRule(lessonMobileCss, ".lessonShell :global(.implementation-section .answer-area)");
  assert.match(surface, /padding-inline:\s*0/);
});

test("mobile IDE microcopy stays legible across files, code, tests, and output", async () => {
  const responsiveCss = await readFile(responsiveCssUrl, "utf8");
  const secondary = "#aaa3ad";
  assert.ok(contrastRatio(secondary, "#1f1d22") >= 4.5, "secondary copy must clear AA on the IDE");
  assert.ok(contrastRatio(secondary, "#262329") >= 4.5, "secondary copy must clear AA on the inspector");

  assert.match(responsiveCss, /\.project-progress span\s*\{[^}]*display:\s*none/);
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
