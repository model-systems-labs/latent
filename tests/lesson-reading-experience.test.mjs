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

function rule(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected a CSS rule for ${selector}`);
  return match[1];
}

test("lessons use an editorial hierarchy instead of landing-page scale", async () => {
  const [paperLab, learningFlow, responsive] = await Promise.all([
    readFile(paperLabUrl, "utf8"),
    readFile(learningFlowUrl, "utf8"),
    readFile(responsiveUrl, "utf8"),
  ]);
  assert.match(learningFlow, /\.paper-hero\s*\{[^}]*min-height:\s*0/);
  assert.match(learningFlow, /\.paper-hero h1\s*\{[^}]*font-size:\s*clamp\(2\.75rem,\s*4\.6vw,\s*4\.5rem\)/);
  assert.match(learningFlow, /\.section-title h2\s*\{[^}]*font-size:\s*clamp\(1\.65rem,\s*2\.3vw,\s*2\.15rem\)/);
  assert.match(learningFlow, /\.paper-section\s*\{[^}]*padding:\s*clamp\(3\.25rem,\s*5vw,\s*4\.5rem\)/);
  assert.match(responsive, /\.paper-hero h1\s*\{[^}]*font-size:\s*clamp\(2\.35rem,\s*10vw,\s*3\.25rem\)/);
  assert.doesNotMatch(responsive.slice(0, responsive.indexOf("@media (max-width: 650px)")), /\.summary-copy\s*\{[^}]*columns:\s*2/);
  assert.doesNotMatch(paperLab, /className=\{`summary-layout/);
});

test("summary prose owns the reading flow and the mechanism is interpolated at its midpoint", async () => {
  const paperLab = await readFile(paperLabUrl, "utf8");
  const opening = paperLab.indexOf("{opening.map");
  const diagram = paperLab.indexOf('<div className="summary-interlude">');
  const closing = paperLab.indexOf("{closing.length ?");
  const boundary = paperLab.indexOf('<dl className="fidelity-record summary-boundary">');
  assert.ok(opening >= 0 && opening < diagram && diagram < closing && closing < boundary);
  assert.match(paperLab, /const diagramAfter = Math\.min\(2, Math\.max\(1, Math\.ceil\(lesson\.summary\.length \/ 2\)\)\)/);
});

test("lesson references are a compact title-only rail while full metadata remains available to assistive technology", async () => {
  const [paperLab, learningFlow] = await Promise.all([
    readFile(paperLabUrl, "utf8"),
    readFile(learningFlowUrl, "utf8"),
  ]);
  assert.match(paperLab, /id="lesson-sources-title">References/);
  assert.match(paperLab, /aria-label=\{`\$\{source\.title\} — \$\{source\.authors\}, \$\{source\.year\}\. \$\{source\.relevance\}`\}/);
  assert.doesNotMatch(paperLab, /<p>\{source\.relevance\}<\/p>/);
  assert.match(rule(learningFlow, ".source-list"), /display:\s*flex/);
  assert.match(rule(learningFlow, ".source-entry > a"), /min-height:\s*2\.75rem/);
});

test("reference and practice code both use real JavaScript syntax parsing without loading the IDE on the reading path", async () => {
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
  assert.match(paperLab, /hidden \? "Run practice" : "Run example"/);
  assert.match(paperLab, /hiddenBlocks\.length === blocks\.length \? "Run practice checks"[\s\S]*?"Run all examples"/);
  assert.match(paperLab, /Example passed · practice this cell to earn verification/);
  assert.match(paperLab, /Reference examples do not earn credit/);
  assert.match(codeEditor, /variant === "lesson" \? lessonTheme/);
  assert.match(codeEditor, /lineNumbers\(\{ formatNumber: \(line\) => String\(line \+ lineNumberStart - 1\) \}\)/);
  for (const token of ["keyword", "string", "number", "comment", "variableName", "propertyName", "operator", "punctuation", "invalid"]) {
    assert.match(codingWorkspace, new RegExp(`\\.tok-${token}`));
  }
});
