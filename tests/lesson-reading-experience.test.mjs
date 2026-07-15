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
  assert.doesNotMatch(responsive.slice(0, responsive.indexOf("@media (max-width: 650px)")), /\.summary-copy\s*\{[^}]*columns:\s*2/);
  assert.doesNotMatch(paperLab, /className=\{`summary-layout/);
});

test("optional study and project views stay out of the primary reading path", async () => {
  const [paperLab, learningFlow, projectPage, projectStructure] = await Promise.all([
    readFile(paperLabUrl, "utf8"),
    readFile(learningFlowUrl, "utf8"),
    readFile(projectPageUrl, "utf8"),
    readFile(projectStructureUrl, "utf8"),
  ]);
  assert.match(paperLab, /<details className="questions-disclosure">[\s\S]*?<summary>[\s\S]*?Ask about this lesson/);
  assert.doesNotMatch(paperLab, /<details className="questions-disclosure" open/);
  assert.match(rule(learningFlow, ".questions-disclosure > summary"), /min-height:\s*5rem/);
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

test("lesson prose, diagrams, questions, code, and outcomes share one editorial rail", async () => {
  const [learningFlow, codingWorkspace, pytorch, productization] = await Promise.all([
    readFile(learningFlowUrl, "utf8"),
    readFile(codingWorkspaceUrl, "utf8"),
    readFile(pytorchHandoffCssUrl, "utf8"),
    readFile(productizationUrl, "utf8"),
  ]);
  assert.match(learningFlow, /\.paper-page\s*\{\s*max-width:\s*60rem/);
  for (const selector of [".paper-hero", ".paper-thesis", ".source-set", ".section-title", ".summary-reading", ".summary-copy", ".questions-layout", ".questions-disclosure", ".implementation-intro", ".summary-boundary"]) {
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

test("lesson code opens one starter-first exercise with direct editing and a non-mutating reference comparison", async () => {
  const [paperLab, syntaxCode, codeEditor, codingWorkspace] = await Promise.all([
    readFile(paperLabUrl, "utf8"),
    readFile(syntaxCodeUrl, "utf8"),
    readFile(codeEditorUrl, "utf8"),
    readFile(codingWorkspaceUrl, "utf8"),
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
  assert.match(paperLab, /const \[activeBlockId, setActiveBlockId\] = useState\(blocks\[0\]\?\.id \?\? ""\)/);
  assert.match(paperLab, /const active = activeBlockId === block\.id/);
  assert.match(paperLab, /className="exercise-summary"[\s\S]*?aria-expanded=\{active\}[\s\S]*?aria-controls=\{`exercise-\$\{lesson\.id\}-\$\{block\.id\}`\}/);
  assert.match(paperLab, /\{active \? \([\s\S]*?className="exercise-body" id=\{`exercise-\$\{lesson\.id\}-\$\{block\.id\}`\}/);
  assert.match(paperLab, /const starterSource = starterCodeFor\(block, lesson\)/);
  assert.match(paperLab, /className="answer-area" data-direct-edit="true"/);
  assert.match(paperLab, /value=\{workingSource\}/);
  assert.match(paperLab, /onChange=\{\(value\) => updateAnswer\(block, value\)\}/);
  assert.match(paperLab, /<SyntaxCode code=\{starterSource\} label=\{`\$\{block\.label\} starter loading`\}/);
  assert.match(paperLab, /"Running…" : "Run cell"/);
  assert.match(paperLab, /"Running in sandbox…" : "Check all my code"/);
  assert.match(paperLab, /className="reference-comparison"[\s\S]*?<summary><span>Compare with reference<\/span><em>Your draft stays unchanged<\/em><\/summary>[\s\S]*?<SyntaxCode code=\{block\.code\}/);
  assert.match(paperLab, /dirty \? <button className="start-over-button"[\s\S]*?>Start over<\/button> : null/);
  assert.match(paperLab, /resetArmed \? \([\s\S]*?Confirm start over for \$\{block\.label\}[\s\S]*?>Confirm<\/button>[\s\S]*?Cancel start over for \$\{block\.label\}[\s\S]*?>Cancel<\/button>/);
  assert.doesNotMatch(paperLab, /Reset all|Restore all|Restore reference|Restore draft|Run all examples|Run practice checks|Practice cell|Show solution|Hide solution/);
  assert.doesNotMatch(paperLab, /const (?:hideAll|showSolution|restoreBlock|recoverBlock)\s*=/);
  assert.match(codeEditor, /variant === "lesson" \? lessonTheme/);
  assert.match(codeEditor, /lineNumbers\(\{ formatNumber: \(line\) => String\(line \+ lineNumberStart - 1\) \}\)/);
  for (const token of ["keyword", "string", "number", "comment", "variableName", "propertyName", "operator", "punctuation", "invalid"]) {
    assert.match(codingWorkspace, new RegExp(`\\.tok-${token}`));
  }
});
