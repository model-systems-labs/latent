import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const paperLabUrl = new URL("app/components/PaperLab.tsx", root);
const syntaxCodeUrl = new URL("app/features/ide/SyntaxCode.tsx", root);
const codeEditorUrl = new URL("app/features/ide/CodeEditor.tsx", root);
const learningFlowUrl = new URL("app/styles/learning-flow.css", root);
const codingWorkspaceUrl = new URL("app/styles/coding-workspace.css", root);
const responsiveUrl = new URL("app/styles/responsive.css", root);
const paperLabMobileUrl = new URL("app/components/PaperLab.module.css", root);
const projectPageUrl = new URL("app/project/page.tsx", root);
const projectStructureUrl = new URL("app/styles/project-structure.css", root);
const pytorchHandoffCssUrl = new URL("app/features/pytorch/PyTorchHandoff.module.css", root);
const productizationUrl = new URL("app/styles/productization.css", root);

function rule(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected a CSS rule for ${selector}`);
  return match[1];
}

test("lessons use an editorial hierarchy instead of landing-page scale", async () => {
  const [paperLab, learningFlow, responsive, lessonMobile] = await Promise.all([
    readFile(paperLabUrl, "utf8"),
    readFile(learningFlowUrl, "utf8"),
    readFile(responsiveUrl, "utf8"),
    readFile(paperLabMobileUrl, "utf8"),
  ]);
  assert.match(learningFlow, /\.paper-hero\s*\{[^}]*min-height:\s*0/);
  assert.match(learningFlow, /\.paper-hero h1\s*\{[^}]*font-size:\s*clamp\(2\.65rem,\s*4vw,\s*4rem\)/);
  assert.match(learningFlow, /\.paper-hero h1\s*\{[^}]*white-space:\s*nowrap/);
  assert.match(learningFlow, /\.section-title h2\s*\{[^}]*font-size:\s*clamp\(1\.65rem,\s*2\.3vw,\s*2\.15rem\)/);
  assert.match(learningFlow, /\.paper-section\s*\{[^}]*padding:\s*clamp\(3\.25rem,\s*5vw,\s*4\.5rem\)/);
  assert.match(lessonMobile, /\.lessonShell :global\(\.paper-hero h1\)\s*\{[^}]*font-size:\s*clamp\(2\.15rem,\s*9vw,\s*2\.65rem\)[^}]*white-space:\s*normal/);
  assert.match(lessonMobile, /\.practice-block \.concept-strip\) \{ order: 2; \}/);
  assert.match(lessonMobile, /\.practice-block \.answer-area\) \{ order: 3; \}/);
  assert.match(lessonMobile, /\.practice-block \.cell-output\) \{ order: 4; \}/);
  assert.match(lessonMobile, /\.practice-block \.cell-footer\) \{ order: 5; \}/);
  assert.doesNotMatch(responsive.slice(0, responsive.indexOf("@media (max-width: 650px)")), /\.summary-copy\s*\{[^}]*columns:\s*2/);
  assert.doesNotMatch(paperLab, /className=\{`summary-layout/);
});

test("contextual help and project history stay out of the primary reading path", async () => {
  const [paperLab, learningFlow, projectPage, projectStructure] = await Promise.all([
    readFile(paperLabUrl, "utf8"),
    readFile(learningFlowUrl, "utf8"),
    readFile(projectPageUrl, "utf8"),
    readFile(projectStructureUrl, "utf8"),
  ]);
  assert.match(paperLab, /<p className="selection-ask-instruction">Highlight a passage to ask Claude or Codex\.<\/p>/);
  assert.match(paperLab, /<SelectionAsk lessonTitle=\{lesson\.title\} \/>/);
  assert.doesNotMatch(paperLab, /questions-disclosure|paper-chat|OpenRouter/);
  assert.match(rule(learningFlow, ".selection-ask-instruction"), /max-width:\s*none/);
  assert.match(projectPage, /<details className="project-history-disclosure">[\s\S]*?History and learning data/);
  assert.doesNotMatch(projectPage, /<details className="project-history-disclosure" open/);
  assert.match(rule(projectStructure, ".project-history-disclosure > summary"), /min-height:\s*5rem/);
});

test("the native PyTorch handoff cannot widen a mobile lesson", async () => {
  const css = await readFile(pytorchHandoffCssUrl, "utf8");
  assert.match(rule(css, ".body"), /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(rule(css, ".body"), /min-width:\s*0/);
  assert.match(rule(css, ".copy"), /min-width:\s*0/);
  assert.match(rule(css, ".editorSurface"), /min-width:\s*0/);
});

test("summary prose owns the reading flow and the mechanism follows the concepts it visualizes", async () => {
  const paperLab = await readFile(paperLabUrl, "utf8");
  const opening = paperLab.indexOf("{opening.map");
  const diagram = paperLab.indexOf('<div className="summary-interlude">');
  const closing = paperLab.indexOf("{closing.length ?");
  const boundary = paperLab.indexOf('<dl className="fidelity-record summary-boundary">');
  assert.ok(opening >= 0 && opening < diagram && diagram < closing && closing < boundary);
  assert.match(paperLab, /const diagramAfter = Math\.max\(1, lesson\.summary\.length - 1\)/);
});

test("lesson prose, diagrams, contextual help, code, and outcomes share one editorial rail", async () => {
  const [learningFlow, codingWorkspace, pytorch, productization] = await Promise.all([
    readFile(learningFlowUrl, "utf8"),
    readFile(codingWorkspaceUrl, "utf8"),
    readFile(pytorchHandoffCssUrl, "utf8"),
    readFile(productizationUrl, "utf8"),
  ]);
  assert.match(learningFlow, /\.paper-page\s*\{\s*max-width:\s*60rem/);
  for (const selector of [".paper-hero", ".paper-thesis", ".source-set", ".section-title", ".summary-reading", ".summary-copy", ".selection-ask-instruction", ".implementation-intro", ".summary-boundary"]) {
    assert.match(rule(learningFlow, selector), /max-width:\s*none/, selector);
  }
  assert.match(rule(codingWorkspace, ".practice-editor"), /max-width:\s*none/);
  assert.match(rule(pytorch, ".copy"), /max-width:\s*none/);
  assert.match(rule(productization, ".lesson-outcome-layout"), /grid-template-columns:\s*1fr/);
  assert.match(rule(productization, ".knowledge-check"), /border-right:\s*0/);
});

test("lesson references use one responsive disclosure while full metadata remains available to assistive technology", async () => {
  const [paperLab, learningFlow, lessonMobile] = await Promise.all([
    readFile(paperLabUrl, "utf8"),
    readFile(learningFlowUrl, "utf8"),
    readFile(paperLabMobileUrl, "utf8"),
  ]);
  assert.match(paperLab, /function SourceSet[\s\S]*?useState\(false\)/, "references must not paint expanded before the mobile viewport is known");
  assert.match(paperLab, /<details className="source-set" open=\{open\}[\s\S]*?aria-labelledby="lesson-sources-title"[\s\S]*?<summary className="source-set-title"><span id="lesson-sources-title">References<\/span><em>\{lesson\.sources\.length\}<\/em><\/summary>/);
  assert.equal(paperLab.match(/<ul className="source-list">/g)?.length, 1, "references must have one semantic copy");
  assert.match(paperLab, /aria-label=\{`\$\{source\.title\} — \$\{source\.authors\}, \$\{source\.year\}\. \$\{source\.relevance\}`\}/);
  assert.doesNotMatch(paperLab, /<p>\{source\.relevance\}<\/p>/);
  assert.match(rule(learningFlow, ".source-list"), /display:\s*flex/);
  assert.match(rule(learningFlow, ".source-entry > a"), /min-height:\s*2\.75rem/);
  assert.match(lessonMobile, /\.lessonShell :global\(\.source-set-title\)\s*\{[^}]*min-height:\s*3\.25rem/);
  assert.match(lessonMobile, /\.lessonShell :global\(\.source-set-title\)\s*\{[^}]*list-style:\s*none/);
  assert.match(lessonMobile, /\.lessonShell :global\(\.source-set\[open\] \.source-set-title::after\)/);
});

test("lesson code uses lazy syntax-aware Python editors without loading the full IDE", async () => {
  const [paperLab, syntaxCode, codeEditor, codingWorkspace, learningFlow] = await Promise.all([
    readFile(paperLabUrl, "utf8"),
    readFile(syntaxCodeUrl, "utf8"),
    readFile(codeEditorUrl, "utf8"),
    readFile(codingWorkspaceUrl, "utf8"),
    readFile(learningFlowUrl, "utf8"),
  ]);
  assert.match(paperLab, /import \{ SyntaxCode \} from "\.\.\/features\/ide\/SyntaxCode"/);
  assert.match(paperLab, /lazy\(async \(\) => \(\{[\s\S]*?import\("\.\.\/features\/ide\/CodeEditor"\)/);
  assert.match(syntaxCode, /import \{ parser \} from "@lezer\/javascript"/);
  assert.match(syntaxCode, /parser\.parse\(source\)/);
  assert.match(syntaxCode, /classHighlighter/);
  assert.match(syntaxCode, /highlightCode\(/);
  assert.match(syntaxCode, /role="region" tabIndex=\{0\}/);
  assert.doesNotMatch(syntaxCode, /dangerouslySetInnerHTML/);
  assert.match(codeEditor, /import \{ python \} from "@codemirror\/lang-python"/);
  assert.match(codeEditor, /isPython \? python\(\) : javascript/);
  assert.match(paperLab, /className="answer-area" data-direct-edit="true"/);
  assert.match(paperLab, /"Running…" : "Run cell"/);
  assert.match(paperLab, /hiddenBlocks\.length === blocks\.length \? "Run practice checks"[\s\S]*?"Run all examples"/);
  assert.match(paperLab, /const combinedExecution = await runContracts\([\s\S]*?combinedSource[\s\S]*?blocks\.map\(\(block\) => `\$\{lesson\.id\}\/\$\{block\.id\}`\)/);
  assert.match(paperLab, /try \{[\s\S]*?lessonImplementationSource\(lesson, \[sourceSnapshots\[block\.id\]\]\)[\s\S]*?executions\.push\(\{ output: execution\.output[\s\S]*?catch \{[\s\S]*?outputCaptureIncomplete = true/);
  assert.match(paperLab, /Example passed · practice this cell to earn verification/);
  assert.match(paperLab, /executionOutput\?\.output\.length \? \(/);
  assert.doesNotMatch(paperLab, /<p>No output\.<\/p>/);
  assert.match(paperLab, /className="cell-output" aria-label=\{`\$\{block\.label\} program output`\}/);
  assert.match(paperLab, /chunk\.stream === "stderr" \? "standard error" : "standard output"/);
  assert.match(paperLab, />Output<\/span>/);
  assert.match(paperLab, />Standard error<\/span>/);
  assert.match(paperLab, />Tests<\/span>/);
  assert.match(paperLab, /Reference examples do not earn credit/);
  assert.match(codeEditor, /variant === "lesson" \? lessonTheme/);
  assert.match(codeEditor, /lineNumbers\(\{ formatNumber: \(line\) => String\(line \+ lineNumberStart - 1\) \}\)/);
  for (const token of ["keyword", "string", "number", "comment", "variableName", "propertyName", "operator", "punctuation", "invalid"]) {
    assert.match(codingWorkspace, new RegExp(`\\.tok-${token}`));
  }
  assert.doesNotMatch(codingWorkspace, /box-shadow:\s*inset 2px/);
  assert.doesNotMatch(learningFlow, /box-shadow:\s*inset [^;]+/);
  assert.match(rule(codingWorkspace, ".practice-block.is-hidden"), /background:\s*transparent/);
  assert.match(rule(codingWorkspace, ".cell-output"), /background:\s*#151417/);
  assert.match(rule(codingWorkspace, ".cell-output-streams"), /max-height:\s*16rem/);
});
