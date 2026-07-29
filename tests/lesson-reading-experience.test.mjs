import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const paperLabUrl = new URL("app/components/PaperLab.tsx", root);
const pageAtmosphereUrl = new URL("app/components/PageAtmosphere.tsx", root);
const learnerUiUrl = new URL("packages/course-kit/src/learner-ui.ts", root);
const syntaxCodeUrl = new URL("app/features/ide/SyntaxCode.tsx", root);
const codeEditorUrl = new URL("app/features/ide/CodeEditor.tsx", root);
const learnerCodeEditorUrl = new URL("packages/course-kit/src/learner-code-editor.ts", root);
const learningFlowUrl = new URL("app/styles/learning-flow.css", root);
const codingWorkspaceUrl = new URL("app/styles/coding-workspace.css", root);
const responsiveUrl = new URL("app/styles/responsive.css", root);
const paperLabMobileUrl = new URL("app/components/PaperLab.module.css", root);
const projectPageUrl = new URL("app/project/page.tsx", root);
const learningDataPanelUrl = new URL("app/components/LearningDataPanel.tsx", root);
const projectStructureUrl = new URL("app/styles/project-structure.css", root);
const lessonOutcomeCssUrl = new URL("app/components/LessonOutcome.module.css", root);
const lessonExperimentUrl = new URL("app/components/LessonExperiment.tsx", root);
const artifactRuntimePanelUrl = new URL("app/features/artifacts/ArtifactRuntimePanel.tsx", root);

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
  assert.match(learningFlow, /\.paper-section\s*\{[^}]*padding:\s*clamp\(1\.6rem,\s*2\.8vw,\s*2\.3rem\)/);
  assert.match(lessonMobile, /\.lessonShell :global\(\.paper-hero h1\)\s*\{[^}]*font-size:\s*clamp\(2\.15rem,\s*9vw,\s*2\.65rem\)[^}]*white-space:\s*normal/);
  assert.match(lessonMobile, /\.lessonShell :global\(\.exercise-body\) \{ padding:\s*0\.15rem 0 1\.7rem; \}/);
  assert.match(lessonMobile, /\.lessonShell :global\(\.exercise-feedback\) \{[^}]*flex-direction:\s*column/);
  assert.match(lessonMobile, /\.lessonShell :global\(\.answer-area\),[\s\S]*?\.lessonShell :global\(\.syntax-code\) \{ max-width:\s*100%; min-width:\s*0; \}/);
  assert.doesNotMatch(responsive.slice(0, responsive.indexOf("@media (max-width: 650px)")), /\.summary-copy\s*\{[^}]*columns:\s*2/);
  assert.doesNotMatch(paperLab, /className=\{`summary-layout/);
});

test("decorative lines crossfade through the reading flow", async () => {
  const [atmosphere, learnerUi] = await Promise.all([
    readFile(pageAtmosphereUrl, "utf8"),
    readFile(learnerUiUrl, "utf8"),
  ]);
  assert.match(atmosphere, /className="learner-atmosphere"/);
  assert.match(atmosphere, /data-learner-atmosphere=""/);
  assert.equal(atmosphere.match(/data-learner-atmosphere-trace=""/g)?.length, 3);
  assert.doesNotMatch(atmosphere, /"use client"|useEffect|useRef|style=\{/);
  assert.match(learnerUi, /const traceInterval = 1\.45/);
  assert.match(learnerUi, /const traceFadeWidth = 0\.92/);
  assert.match(learnerUi, /const fadeDistance = viewportHeight \* 0\.7/);
  assert.match(learnerUi, /Math\.max\(0, 1 - \(scrollY \/ fadeDistance\)\)/);
  assert.match(learnerUi, /const traceOpacity = [\s\S]*?Math\.cos/);
  assert.match(learnerUi, /const traceIntroduction = Math\.min\(1, traceScroll \/ \(viewportHeight \* 0\.45\)\)/);
  assert.match(learnerUi, /traceOpacity\(tracePhase, index, traces\.length\)/);
  assert.match(learnerUi, /globalThis\.requestAnimationFrame\(updateAtmospheres\)/);
  assert.match(learnerUi, /addEventListener\("scroll", scheduleAtmospheres, \{ passive: true \}\)/);
  assert.match(learnerUi, /prefers-reduced-motion: reduce[\s\S]*?reducedMotion\.matches\s*\? 0/);
});

test("selection prompts and project history stay out of the primary reading path", async () => {
  const [paperLab, projectPage, projectStructure, learningDataPanel] = await Promise.all([
    readFile(paperLabUrl, "utf8"),
    readFile(projectPageUrl, "utf8"),
    readFile(projectStructureUrl, "utf8"),
    readFile(learningDataPanelUrl, "utf8"),
  ]);
  assert.doesNotMatch(paperLab, /SelectionAsk|selection-ask|data-selection-ask|Highlight a passage|questions-disclosure|paper-chat|OpenRouter/);
  assert.match(projectPage, /<details className="project-history-disclosure">[\s\S]*?History and privacy/);
  assert.doesNotMatch(projectPage, /<details className="project-history-disclosure" open/);
  assert.match(learningDataPanel, /<section className="learning-data-panel"/);
  assert.doesNotMatch(learningDataPanel, /<details className="learning-data-panel"/);
  assert.match(rule(projectStructure, ".project-history-disclosure > summary"), /min-height:\s*3\.5rem/);
});

test("summary prose owns the reading flow and the mechanism follows the concepts it visualizes", async () => {
  const paperLab = await readFile(paperLabUrl, "utf8");
  const opening = paperLab.indexOf("{opening.map");
  const diagram = paperLab.indexOf('<div className="summary-interlude">');
  const closing = paperLab.indexOf("{closing.length ?");
  assert.ok(opening >= 0 && opening < diagram && diagram < closing);
  assert.doesNotMatch(paperLab, /fidelity-record|summary-boundary|What the source says|What this browser lab shows|What it doesn.t cover/);
  assert.match(paperLab, /const diagramAfter = Math\.max\(1, lesson\.summary\.length - 1\)/);
});

test("every shared lesson teaches and checks the concept before its coding practice", async () => {
  const paperLab = await readFile(paperLabUrl, "utf8");
  const lessonShell = paperLab.slice(paperLab.indexOf("export function PaperLab"));
  const header = lessonShell.indexOf("<HeaderSection");
  const implementation = lessonShell.indexOf("<CodingSection");
  const summary = lessonShell.indexOf("<ParagraphSection");
  const outcome = lessonShell.indexOf("<LessonOutcome");
  const codeNav = lessonShell.indexOf('<a href="#implementation">Code</a>');
  const readNav = lessonShell.indexOf('<a href="#summary">Read</a>');
  const codingSection = paperLab.slice(
    paperLab.indexOf("export function CodingSection"),
    paperLab.indexOf("function LessonRecoveryCandidates"),
  );

  assert.ok(header >= 0 && header < summary && summary < outcome && outcome < implementation);
  assert.ok(readNav >= 0 && readNav < codeNav);
  assert.ok(codingSection.indexOf('className="practice-editor"') < codingSection.indexOf('className="implementation-intro"'));
});

test("lesson prose, diagrams, code, and outcomes share one editorial rail", async () => {
  const [learningFlow, codingWorkspace, lessonMobile, lessonOutcome] = await Promise.all([
    readFile(learningFlowUrl, "utf8"),
    readFile(codingWorkspaceUrl, "utf8"),
    readFile(paperLabMobileUrl, "utf8"),
    readFile(lessonOutcomeCssUrl, "utf8"),
  ]);
  assert.match(learningFlow, /\.paper-page\s*\{\s*max-width:\s*60rem/);
  for (const selector of [".paper-hero", ".paper-thesis", ".source-set", ".section-title", ".summary-reading", ".summary-copy", ".implementation-intro"]) {
    assert.match(rule(learningFlow, selector), /max-width:\s*none/, selector);
  }
  assert.match(rule(codingWorkspace, ".practice-editor"), /max-width:\s*none/);
  assert.match(rule(codingWorkspace, ".editor-footer"), /padding:\s*1rem 0 1\.4rem/);
  assert.match(rule(learningFlow, ".implementation-intro"), /margin:\s*0 0 1\.4rem/);
  assert.match(
    rule(lessonMobile, ".lessonShell :global(.implementation-section .implementation-intro)"),
    /margin:\s*0 0 1\.5rem/,
  );
  assert.match(rule(lessonOutcome, ".layout"), /display:\s*grid/);
  assert.match(rule(lessonOutcome, ".check"), /border:\s*0/);
});

test("interactive experiments introduce their purpose before one compact dataset sample", async () => {
  const source = await readFile(lessonExperimentUrl, "utf8");
  const dataset = source.slice(source.indexOf("function DatasetRecord"), source.indexOf("type ExperimentProps"));
  const surface = source.slice(source.indexOf("export function LessonExperiment"));
  assert.match(dataset, /aria-label=\{`Dataset sample: \$\{lesson\.dataset\.name\}`\}/);
  assert.match(dataset, /<strong>\{lesson\.dataset\.name\}<\/strong>[\s\S]*?<span>\{lesson\.dataset\.preview\}<\/span>/);
  assert.doesNotMatch(dataset, /lesson\.dataset\.(?:source|license|size)/);
  assert.match(surface, /<section className="experiment-lab" id="experiment" aria-labelledby=\{`experiment-title-\$\{lesson\.id\}`\}>/);
  assert.match(surface, /<header className="experiment-header">[\s\S]*?<h3 id=\{`experiment-title-\$\{lesson\.id\}`\}>\{lesson\.experiment\.title\}<\/h3>[\s\S]*?<p>\{lesson\.experiment\.intro\}<\/p>/);
});

test("the neural language model reveals learning as a controllable checkpoint replay", async () => {
  const [source, learningFlow, responsive] = await Promise.all([
    readFile(lessonExperimentUrl, "utf8"),
    readFile(learningFlowUrl, "utf8"),
    readFile(responsiveUrl, "utf8"),
  ]);
  const experiment = source.slice(
    source.indexOf("function NeuralLmExperiment"),
    source.indexOf("function BpeExperiment"),
  );
  assert.match(experiment, /\{ label: "Start", steps: 1 \}/);
  assert.match(experiment, /\{ label: "Best", steps: 2_880 \}/);
  assert.match(experiment, /\{ label: "Too far", steps: 4_000 \}/);
  assert.match(experiment, /aria-label="Inspect a training checkpoint"/);
  assert.match(experiment, /aria-pressed=\{index === checkpointIndex\}/);
  assert.match(experiment, /Pause replay/);
  assert.match(experiment, /Training loss can keep improving while held-out loss rises/);
  assert.match(experiment, /prefers-reduced-motion: reduce/);
  assert.match(rule(learningFlow, ".neural-replay-steps"), /grid-template-columns:\s*repeat\(5/);
  assert.match(rule(learningFlow, '.neural-replay-steps button[aria-pressed="true"]'), /background:\s*var\(--violet-deep\)/);
  assert.match(responsive, /\.neural-replay > header\s*\{[^}]*grid-template-columns:\s*1fr/);
});

test("saved results render only artifacts that exist", async () => {
  const source = await readFile(artifactRuntimePanelUrl, "utf8");
  assert.match(source, /view\.input \|\| view\.output \? \(/);
  assert.match(source, /view\.input \? <ArtifactIdentity artifact=\{view\.input\} label="Previous result" \/> : null/);
  assert.match(source, /view\.output \? <ArtifactIdentity artifact=\{view\.output\} label="Validation result" \/> : null/);
  assert.doesNotMatch(source, /artifact-identity pending|Not available yet|Pass all checks to create it/);
  assert.match(source, /No saved results yet\./);
});

test("lesson further reading uses one compact inline list with assistive metadata", async () => {
  const [paperLab, learningFlow, lessonMobile] = await Promise.all([
    readFile(paperLabUrl, "utf8"),
    readFile(learningFlowUrl, "utf8"),
    readFile(paperLabMobileUrl, "utf8"),
  ]);
  assert.match(paperLab, /<div className="source-set" aria-labelledby="lesson-sources-title">[\s\S]*?<span className="source-set-title" id="lesson-sources-title">Further reading<\/span>/);
  assert.doesNotMatch(paperLab, /<details className="source-set"|matchMedia\("\(max-width: 650px\)/);
  assert.equal(paperLab.match(/<ul className="source-list">/g)?.length, 1, "references must have one semantic copy");
  assert.match(paperLab, /aria-label=\{`\$\{source\.title\}, \$\{source\.authors\}, \$\{source\.year\}; opens in a new tab`\}/);
  assert.match(paperLab, /<details className=\{styles\.evidencePanel\}>[\s\S]*?<summary>Evidence &amp; limits<\/summary>/);
  assert.doesNotMatch(paperLab, /<details className=\{styles\.evidencePanel\} open/);
  assert.match(paperLab, /<dt>What the further reading establishes<\/dt>[\s\S]*?\{lesson\.claims\.paper\}/);
  assert.match(paperLab, /<dt>What this lab runs<\/dt>[\s\S]*?\{lesson\.claims\.lab\}/);
  assert.match(paperLab, /<dt>What it does not prove<\/dt>[\s\S]*?\{lesson\.claims\.limit\}/);
  assert.match(paperLab, /<div><dt>Source<\/dt><dd>\{lesson\.dataset\.source\}<\/dd><\/div>/);
  assert.match(paperLab, /<div><dt>License<\/dt><dd>\{lesson\.dataset\.license\}<\/dd><\/div>/);
  assert.match(paperLab, /<div><dt>Size<\/dt><dd>\{lesson\.dataset\.size\}<\/dd><\/div>/);
  assert.match(paperLab, /<p>\{source\.role\} · \{source\.authors\} · \{source\.year\}<\/p>[\s\S]*?<p>\{source\.relevance\}<\/p>/);
  assert.match(paperLab, /aria-label=\{`\$\{source\.title\}, \$\{source\.role\}, \$\{source\.authors\}, \$\{source\.year\}; opens in a new tab`\}/);
  assert.match(rule(learningFlow, ".source-list"), /display:\s*flex/);
  assert.match(rule(learningFlow, ".source-entry > a"), /min-height:\s*2\.25rem/);
  assert.match(lessonMobile, /\.lessonShell :global\(\.source-set\)\s*\{[^}]*display:\s*grid/);
  assert.doesNotMatch(lessonMobile, /source-set\[open\]|source-set-title::after/);
});

test("lesson code opens progressive starter-first syntax-aware Python practice in a light-neutral workspace", async () => {
  const [paperLab, syntaxCode, codeEditor, learnerCodeEditor, codingWorkspace, learningFlow] = await Promise.all([
    readFile(paperLabUrl, "utf8"),
    readFile(syntaxCodeUrl, "utf8"),
    readFile(codeEditorUrl, "utf8"),
    readFile(learnerCodeEditorUrl, "utf8"),
    readFile(codingWorkspaceUrl, "utf8"),
    readFile(learningFlowUrl, "utf8"),
  ]);
  assert.match(paperLab, /import \{ SyntaxCode \} from "@\/app\/features\/ide\/SyntaxCode"/);
  assert.doesNotMatch(paperLab, /tensor-runtime-strip|Python runtime|Tensor runtime|CPython · NumPy|NumPy handles the array operations/);
  assert.match(paperLab, /lazy\(async \(\) => \(\{[\s\S]*?import\("@\/app\/features\/ide\/CodeEditor"\)/);
  assert.match(syntaxCode, /import \{ parser \} from "@lezer\/javascript"/);
  assert.match(syntaxCode, /parser\.parse\(source\)/);
  assert.match(syntaxCode, /classHighlighter/);
  assert.match(syntaxCode, /highlightCode\(/);
  assert.match(syntaxCode, /role="region" tabIndex=\{0\}/);
  assert.doesNotMatch(syntaxCode, /dangerouslySetInnerHTML/);
  assert.match(codeEditor, /from "@latent\/course-kit\/learner-code-editor"/);
  assert.match(codeEditor, /if \(normalized\.endsWith\("\.py"\)\) return "python"/);
  assert.match(
    codeEditor,
    /extensions:\s*\[[\s\S]*?\.\.\.createLearnerCodeEditorExtensions\(\{/,
  );
  assert.match(learnerCodeEditor, /import \{ python \} from "@codemirror\/lang-python"/);
  assert.match(learnerCodeEditor, /if \(language === "python"\) return python\(\)/);
  assert.match(paperLab, /const \[activeBlockId, setActiveBlockId\] = useState\(blocks\[0\]\?\.id \?\? ""\)/);
  assert.match(paperLab, /const active = activeBlockId === block\.id/);
  assert.match(paperLab, /className="exercise-summary"[\s\S]*?aria-expanded=\{active\}[\s\S]*?aria-controls=\{`exercise-\$\{lesson\.id\}-\$\{block\.id\}`\}/);
  assert.match(paperLab, /\{active \? \([\s\S]*?className="exercise-body" id=\{`exercise-\$\{lesson\.id\}-\$\{block\.id\}`\}/);
  assert.match(paperLab, /const starterSource = round === 1[\s\S]*?\? starterCodeFor\(block, lesson\)[\s\S]*?: practiceRepetitionSource\(lesson\.implementation\.filename, block, round\)/);
  assert.match(paperLab, /<fieldset className="practice-rounds"[^>]*>[\s\S]*?<legend className="sr-only">\{block\.label\} progressive practice rounds<\/legend>/);
  assert.match(paperLab, /\{PRACTICE_ROUNDS\.map\(\(option\) => \{/);
  assert.match(paperLab, /const unlocked = option\.id === 1[\s\S]*?option\.id === 2 && baselineVerified[\s\S]*?option\.id === 3 && baselineVerified && roundTwoVerified/);
  assert.match(paperLab, /const status = complete \? "Complete" : option\.required \? "Required" : unlocked \? "Optional" : "Locked"/);
  assert.match(paperLab, /Pass this guided round to complete the exercise\. The harder rounds stay optional\./);
  assert.match(paperLab, /className="answer-area" data-direct-edit="true"/);
  assert.match(paperLab, /value=\{workingSource\}/);
  assert.match(paperLab, /onChange=\{\(value\) => updateAnswer\(block, value\)\}/);
  assert.match(paperLab, /<div className="lesson-editor-loading" role="status">Restoring saved code…<\/div>/);
  assert.doesNotMatch(paperLab, /<SyntaxCode code=\{starterSource\}/);
  assert.match(paperLab, /"Running…" : `Run round \$\{round\}`/);
  assert.match(paperLab, /"Running tests…" : "Run all tests"/);
  assert.match(paperLab, /className="reference-comparison"[\s\S]*?<summary>Reference solution<\/summary>[\s\S]*?className="reference-editorial"[\s\S]*?\{displayBlock\.purpose\}[\s\S]*?<SyntaxCode code=\{block\.code\}/);
  assert.match(paperLab, /dirty \? <button className="start-over-button"[\s\S]*?>Start over<\/button> : null/);
  assert.match(paperLab, /resetArmed \? \([\s\S]*?Confirm start over for \$\{block\.label\}, round \$\{round\}[\s\S]*?>Confirm<\/button>[\s\S]*?Cancel start over for \$\{block\.label\}, round \$\{round\}[\s\S]*?>Cancel<\/button>/);
  assert.doesNotMatch(paperLab, /Reset all|Restore all|Restore reference|Restore draft|Run all examples|Run practice checks|Practice cell|Show solution|Hide solution/);
  assert.doesNotMatch(paperLab, /const (?:hideAll|showSolution|restoreBlock|recoverBlock)\s*=/);
  assert.match(paperLab, /setCellOutputs/);
  assert.match(paperLab, /output: execution\.output[\s\S]*?stdout: execution\.stdout[\s\S]*?stderr: execution\.stderr/);
  assert.match(paperLab, /executionOutput\?\.output\.length \? \(/);
  assert.doesNotMatch(paperLab, /<p>No output\.<\/p>/);
  assert.match(paperLab, /className="cell-output" aria-label=\{`\$\{block\.label\} program output`\}/);
  assert.match(paperLab, /chunk\.stream === "stderr" \? "standard error" : "standard output"/);
  assert.match(paperLab, />Output<\/span>/);
  assert.match(paperLab, />Standard error<\/span>/);
  assert.match(paperLab, /<strong>\{result\.passed \? "Passed" : "Not passed"\}<\/strong>/);
  assert.match(paperLab, /<span className="exercise-state">\{visibleState\}<\/span>/);
  assert.match(codeEditor, /variant === "project" \? "workspace-dark" : "integrated"/);
  assert.match(learnerCodeEditor, /variant === "workspace-dark" \? workspaceDarkTheme : integratedTheme/);
  assert.match(learnerCodeEditor, /syntaxHighlighting\([\s\S]*?workspaceDarkSyntaxTheme[\s\S]*?integratedSyntaxTheme/);
  assert.match(learnerCodeEditor, /const integratedTheme = EditorView\.theme\([\s\S]*?\}, \{ dark: false \}\);/);
  assert.match(learnerCodeEditor, /formatNumber: \(line\) => String\(line \+ lineNumberStart - 1\)/);
  for (const token of ["keyword", "string", "number", "comment", "variableName", "propertyName", "operator", "punctuation", "invalid"]) {
    assert.match(codingWorkspace, new RegExp(`\\.tok-${token}`));
  }
  assert.doesNotMatch(codingWorkspace, /box-shadow:\s*inset 2px/);
  assert.doesNotMatch(learningFlow, /box-shadow:\s*inset [^;]+/);
  assert.match(rule(codingWorkspace, ".practice-editor"), /background:\s*transparent/);
  assert.match(rule(codingWorkspace, ".lesson-code-editor"), /background:\s*#fbfaf8/);
  assert.match(rule(codingWorkspace, ".lesson-editor-loading"), /background:\s*#fbfaf8/);
  assert.match(rule(codingWorkspace, ".cell-output"), /background:\s*#f4f2ee/);
  assert.match(rule(codingWorkspace, ".cell-result"), /border-left:\s*4px solid/);
  assert.match(rule(codingWorkspace, ".cell-result.passed"), /background:\s*#edf4ee[\s\S]*color:\s*#315d40/);
  assert.match(rule(codingWorkspace, ".cell-result.failed"), /background:\s*#faece9[\s\S]*color:\s*#843c36/);
  assert.match(rule(codingWorkspace, ".editor-footer"), /background:\s*transparent/);
  assert.match(rule(codingWorkspace, ".cell-output-streams"), /max-height:\s*16rem/);
});
