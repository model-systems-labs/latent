import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const codeEditorUrl = new URL("../app/features/ide/CodeEditor.tsx", import.meta.url);
const learnerCodeEditorUrl = new URL("../packages/course-kit/src/learner-code-editor.ts", import.meta.url);
const projectWorkbenchUrl = new URL("../app/components/ProjectWorkbench.tsx", import.meta.url);
const workspacePageUrl = new URL("../app/workspace/page.tsx", import.meta.url);
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

test("the React adapter delegates language, syntax, themes, and keymaps to Course Kit", async () => {
  const [adapter, primitive] = await Promise.all([
    readFile(codeEditorUrl, "utf8"),
    readFile(learnerCodeEditorUrl, "utf8"),
  ]);

  assert.match(adapter, /from "@latent\/course-kit\/learner-code-editor"/);
  assert.match(adapter, /extensions:\s*\[[\s\S]*?\.\.\.createLearnerCodeEditorExtensions\(\{/);
  assert.match(adapter, /if \(normalized\.endsWith\("\.py"\)\) return "python"/);
  assert.match(adapter, /if \(normalized\.endsWith\("\.tsx"\)\) return "tsx"/);
  assert.match(adapter, /if \(normalized\.endsWith\("\.ts"\)\) return "typescript"/);
  assert.match(adapter, /if \(normalized\.endsWith\("\.jsx"\)\) return "jsx"/);
  assert.match(adapter, /variant === "project" \? "workspace-dark" : "integrated"/);

  assert.match(primitive, /import \{ python \} from "@codemirror\/lang-python"/);
  assert.match(primitive, /import \{ javascript \} from "@codemirror\/lang-javascript"/);
  assert.match(primitive, /if \(language === "python"\) return python\(\)/);
  assert.match(primitive, /return javascript\(\{[\s\S]*?jsx:[\s\S]*?typescript:/);
  assert.match(primitive, /syntaxHighlighting\([\s\S]*?workspaceDarkSyntaxTheme[\s\S]*?integratedSyntaxTheme/);
  assert.match(primitive, /tags\.keyword/);
  assert.match(primitive, /tags\.comment/);
  assert.doesNotMatch(primitive, /EditorView\.lineWrapping/);

  for (const duplicatedConcern of [
    /@codemirror\/autocomplete/,
    /@codemirror\/commands/,
    /@codemirror\/lang-/,
    /@codemirror\/language/,
    /@lezer\/highlight/,
    /HighlightStyle/,
    /syntaxHighlighting/,
    /EditorView\.theme/,
    /keymap\.of/,
    /tags\./,
  ]) {
    assert.doesNotMatch(
      adapter,
      duplicatedConcern,
      "the React lifecycle adapter must not reimplement the shared primitive",
    );
  }
});

test("lesson and workbook editors use the integrated light surface while the project IDE keeps its intentional dark workspace", async () => {
  const [adapter, primitive] = await Promise.all([
    readFile(codeEditorUrl, "utf8"),
    readFile(learnerCodeEditorUrl, "utf8"),
  ]);

  assert.match(adapter, /variant\?: "lesson" \| "project" \| "workbook"/);
  assert.match(adapter, /variant === "project" \? "workspace-dark" : "integrated"/);
  assert.match(adapter, /variant === "project"[\s\S]*?`Project file editor: \$\{path\}`[\s\S]*?variant === "lesson"[\s\S]*?`Lesson code editor: \$\{path\}`[\s\S]*?`Workbook code editor: \$\{path\}`/);
  assert.match(adapter, /ariaLabel: ariaLabel \?\? defaultAriaLabel/);
  assert.match(adapter, /defaultAriaLabel,[\s\S]*?editorVariant,/);
  assert.match(primitive, /const integratedTheme = EditorView\.theme\([\s\S]*?var\(--learner-code-surface, #fbfaf8\)[\s\S]*?\}, \{ dark: false \}\);/);
  assert.match(primitive, /const workspaceDarkTheme = EditorView\.theme\([\s\S]*?backgroundColor:\s*"#1f1e21"[\s\S]*?\}, \{ dark: true \}\);/);
  assert.match(primitive, /variant === "workspace-dark" \? workspaceDarkTheme : integratedTheme/);
  assert.match(primitive, /variant === "workspace-dark"[\s\S]*?workspaceDarkSyntaxTheme[\s\S]*?integratedSyntaxTheme/);
  assert.match(primitive, /&\.cm-focused > \.cm-scroller > \.cm-selectionLayer \.cm-selectionBackground/);
  assert.match(
    primitive,
    /var\(--learner-code-selection, #dedbea\)[\s\S]*?boxShadow:[\s\S]*?var\(--learner-color-accent, #6576b4\) 64%/,
    "integrated selections need a visible boundary in every learner palette",
  );
  assert.match(
    primitive,
    /backgroundColor:\s*"rgba\(181,151,209,\.22\)"[\s\S]*?boxShadow:\s*"inset 0 0 0 1px rgba\(221,189,242,\.6\)"/,
    "dark workspace selections need a stronger fill and visible boundary",
  );
  assert.match(primitive, /userSelect:\s*"text"/);
  assert.match(primitive, /WebkitUserSelect:\s*"text"/);
  assert.doesNotMatch(adapter, /#[0-9a-f]{3,8}|rgba?\(/i, "adapter-local palettes would let the products diverge again");
});

test("the React adapter keeps controlled-value updates distinct from learner typing", async () => {
  const source = await readFile(codeEditorUrl, "utf8");

  assert.match(source, /const applyingExternalValueRef = useRef\(false\)/);
  assert.match(source, /onChange:\s*\(nextValue\) => \{[\s\S]*?if \(!applyingExternalValueRef\.current\)[\s\S]*?changeRef\.current\(nextValue\)/);
  assert.match(source, /const current = view\.state\.doc\.toString\(\);[\s\S]*?if \(current === value\) return/);
  assert.match(source, /applyingExternalValueRef\.current = true;[\s\S]*?view\.dispatch\([\s\S]*?insert: value[\s\S]*?finally \{[\s\S]*?applyingExternalValueRef\.current = false/);
  assert.match(source, /const hasSaveHandler = Boolean\(onSave\)/);
  assert.match(source, /hasSaveHandler[\s\S]*?\{ onSave: \(\) => saveRef\.current\?\.\(\) \}/);
  assert.match(source, /onRun\?: \(mode: LearnerCodeEditorRunMode\) => void/);
  assert.match(source, /runModes\?: readonly LearnerCodeEditorRunMode\[\]/);
  assert.match(source, /onRun: \(mode: LearnerCodeEditorRunMode\) => runRef\.current\?\.\(mode\)/);
  assert.match(source, /runModes: \[[\s\S]*?supportsExampleRun[\s\S]*?supportsCheckRun/);
});

test("the mobile IDE source contract preserves readable type, bounded scrolling, focus, and touch targets", async () => {
  const [source, primitive, responsiveCss] = await Promise.all([
    readFile(codeEditorUrl, "utf8"),
    readFile(learnerCodeEditorUrl, "utf8"),
    readFile(responsiveCssUrl, "utf8"),
  ]);
  assert.match(primitive, /&\.cm-focused[\s\S]*?outline:\s*"3px solid/);
  assert.match(primitive, /overscrollBehaviorX:\s*"contain"[\s\S]*?overscrollBehaviorY:\s*"auto"/);
  assert.match(primitive, /import \{[\s\S]*?acceptCompletion,[\s\S]*?\} from "@codemirror\/autocomplete"/);
  assert.match(primitive, /temporarilySetTabFocusMode/);
  assert.match(primitive, /Prec\.high\(keymap\.of\(\[\s*\{ key: "Escape", run: temporarilySetTabFocusMode \},\s*\{ key: "Tab", run: acceptCompletion \},\s*indentWithTab/);
  assert.match(primitive, /indentUnit\.of\(" "\.repeat\(tabSize\)\)/);
  assert.match(primitive, /EditorState\.tabSize\.of\(tabSize\)/);
  assert.match(primitive, /"aria-keyshortcuts": shortcuts\.join\(" "\)/);
  assert.match(primitive, /"aria-multiline": "true"/);
  assert.match(primitive, /"aria-readonly": "true"/);
  assert.match(source, /ariaDescribedBy:\s*instructionId/);
  assert.match(source, /const editableEditorInstruction =\s*"Code editor\. Tab accepts an open suggestion or indents; Shift plus Tab outdents\. Press Escape, then Tab, to leave the editor\."/);
  const readOnlyInstruction = source.match(/const readOnlyEditorInstruction =\s*"([^"]+)"/)?.[1];
  assert.equal(
    readOnlyInstruction,
    "Read-only code example. Use the arrow keys to navigate the code. Press Escape, then Tab, to leave the code example.",
  );
  assert.doesNotMatch(readOnlyInstruction, /Tab indents/);
  assert.match(source, /\{readOnly \? readOnlyEditorInstruction : editableEditorInstruction\}/);
  assert.match(source, /supportsCheckRun && supportsExampleRun[\s\S]*?add Shift to run examples/);
  assert.match(source, /const className =[\s\S]*?"code-editor lesson-code-editor"[\s\S]*?"code-editor workbook-code-editor"[\s\S]*?"code-editor"/);
  assert.match(source, /className=\{className\}[\s\S]*?ref=\{hostRef\}[\s\S]*?\/>\s*<span className="sr-only" id=\{instructionId\}>/);
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

test("the mobile project header keeps project actions compact without shrinking touch targets", async () => {
  const responsiveCss = await readFile(responsiveCssUrl, "utf8");
  const actions = cssRule(responsiveCss, ".project-header-actions");
  assert.match(actions, /display:\s*grid/);
  assert.match(actions, /grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);

  const tabs = cssRule(responsiveCss, ".project-result-tabs");
  assert.match(tabs, /display:\s*none/);

  const actionsSummary = cssRule(responsiveCss, ".project-tools > summary");
  assert.match(actionsSummary, /min-height:\s*2\.75rem/);
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
  assert.doesNotMatch(responsiveCss, /\.project-workbench-grid\[data-mobile-view="files"\] > \.project-tree button > em/);
  assert.match(responsiveCss, /\.project-workbench-grid\[data-mobile-view="code"\] \.project-editor-panel > header > code\s*\{[^}]*font-size:\s*0\.75rem/);
  assert.match(responsiveCss, /\.project-workbench-grid\[data-mobile-view="code"\] \.project-editor-panel > header > div:last-child\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.doesNotMatch(responsiveCss, /\.project-editor-panel > footer p\s*\{/);
  assert.match(responsiveCss, /\.unit-test-list article p\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(responsiveCss, /\.project-output dt\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(responsiveCss, /\.project-file-history-list > div em,[\s\S]*?\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
});

test("desktop IDE microcopy uses the same release-quality size and contrast floor", async () => {
  const [capstoneCss, productizationCss] = await Promise.all([
    readFile(capstoneCssUrl, "utf8"),
    readFile(productizationCssUrl, "utf8"),
  ]);
  assert.match(capstoneCss, /\.project-progress span\s*\{[^}]*color:\s*#aaa3ad\s*!important[^}]*font-size:\s*max\(0\.68rem, 11px\)\s*!important/);
  assert.match(productizationCss, /\.project-result-tabs button,[\s\S]*?\.project-tools > summary\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(capstoneCss, /\.project-tree section > span\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(productizationCss, /\.project-editor-panel > header > code\s*\{[^}]*color:\s*#d5c3e2[^}]*font-size:\s*0\.72rem/);
  assert.match(capstoneCss, /\.project-editor-panel > header > div:last-child\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.doesNotMatch(capstoneCss, /\.project-editor-panel > footer p\s*\{/);
  assert.match(capstoneCss, /\.unit-test-list article p\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(capstoneCss, /\.project-output dt\s*\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
  assert.match(productizationCss, /\.project-file-history-list > div em,[\s\S]*?\{[^}]*color:\s*#aaa3ad[^}]*font-size:\s*max\(0\.68rem, 11px\)/);
});

test("the mobile view switcher uses honest toggle-button semantics", async () => {
  const source = await readFile(projectWorkbenchUrl, "utf8");
  assert.match(source, /<nav className="mobile-ide-tabs" aria-label="Choose a project workspace view">/);
  assert.match(source, /<button type="button" aria-pressed=\{mobilePanel === panel\}/);
  assert.doesNotMatch(source, /role="tablist"/);
  assert.doesNotMatch(source, /role="tab"/);
  assert.doesNotMatch(source, /aria-selected=\{mobilePanel === panel\}/);
});

test("tablet result controls show exactly one inspector pane and restore returns to code", async () => {
  const [source, responsiveCss] = await Promise.all([
    readFile(projectWorkbenchUrl, "utf8"),
    readFile(responsiveCssUrl, "utf8"),
  ]);
  const tablet = responsiveCss.slice(responsiveCss.indexOf("@media (max-width: 940px)"), responsiveCss.indexOf("@media (max-width: 650px)"));
  assert.match(tablet, /data-inspector-view="tests"\] \.project-output,[\s\S]*?data-inspector-view="output"\] \.unit-test-panel[\s\S]*?display:\s*none/);
  const restore = source.slice(source.indexOf("const restoreReference"), source.indexOf("return (", source.indexOf("const restoreReference")));
  assert.match(restore, /setMobilePanel\("code"\);[\s\S]*?saveNowRef\.current\?\.focus/);
  assert.ok((source.match(/setInspectorPanel\("output"\);\s*setMobilePanel\("output"\);/g) ?? []).length >= 4, "load and save failures must reveal Output on narrow screens");
});

test("the IDE defaults to tests and keeps secondary project metadata behind disclosures", async () => {
  const [source, workspace, productizationCss] = await Promise.all([
    readFile(projectWorkbenchUrl, "utf8"),
    readFile(workspacePageUrl, "utf8"),
    readFile(productizationCssUrl, "utf8"),
  ]);

  assert.match(source, /useState<InspectorPanel>\("tests"\)/);
  assert.match(source, /data-inspector-view=\{inspectorPanel\}/);
  assert.match(source, /<nav className="project-result-tabs" aria-label="Results panel">/);
  assert.match(source, /<details className="project-tools" ref=\{toolsRef\}>/);
  assert.match(source, /<details className="project-file-history">/);
  assert.doesNotMatch(source, /<em>\{status\.label\}<\/em>/);
  assert.doesNotMatch(source, /selected\?\.title/);
  assert.doesNotMatch(workspace, /<span>Project IDE<\/span>/);
  assert.match(productizationCss, /data-inspector-view="tests"\] \.project-output/);
  assert.match(productizationCss, /\.project-file-history > summary/);
});
