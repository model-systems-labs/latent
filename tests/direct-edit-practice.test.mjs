import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "#vite-test-server";

const root = new URL("../", import.meta.url);
const paperLabUrl = new URL("app/components/PaperLab.tsx", root);
const codeEditorUrl = new URL("app/features/ide/CodeEditor.tsx", root);
const pythonCodeEditorUrl = new URL("app/features/ide/PythonCodeEditor.tsx", root);
const learnerCodeEditorUrl = new URL("packages/course-kit/src/learner-code-editor.ts", root);

let vite;
let practiceState;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(root),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  practiceState = await vite.ssrLoadModule("/app/features/ide/practice-state.ts");
});

after(async () => {
  await vite?.close();
});

function verifiedState() {
  return {
    hiddenBlocks: [],
    answers: {},
    verification: {
      ids: ["first", "second"],
      sources: { first: "reference first", second: "reference second" },
      contractVersion: "contracts-v1",
    },
  };
}

const pythonBlocks = [{
  id: "softmax",
  label: "Stable softmax",
  code: `import numpy as np

def stable_softmax(logits):
    shifted = np.asarray(logits) - np.max(logits)
    weights = np.exp(shifted)
    return weights / np.sum(weights)`,
}, {
  id: "context",
  label: "Context embedding",
  code: `import numpy as np

def context_embedding(indices, embeddings):
    return np.asarray(embeddings)[indices].mean(axis=0)`,
}];

test("a fresh cell resolves directly to inviting starter source", () => {
  const starter = practiceState.starterPracticeSource("neural-language-model.py", pythonBlocks[0]);

  assert.equal(
    starter,
    `import numpy as np

def stable_softmax(logits):
    shifted = np.asarray(logits) - np.max(logits)
    weights = np.exp(shifted)
    return ...`,
  );
  assert.equal(
    practiceState.workingPracticeBlockSource("neural-language-model.py", pythonBlocks[0], {}),
    starter,
  );
  assert.deepEqual(
    practiceState.workingPracticeSources("neural-language-model.py", pythonBlocks, {}),
    {
      softmax: starter,
      context: practiceState.starterPracticeSource("neural-language-model.py", pythonBlocks[1]),
    },
  );
});

test("an authored scaffold takes precedence over the generated Python starter", () => {
  const scaffold = `def dot_product(left, right):
    total = 0.0
    # TODO: accumulate matching coordinate products.
    raise NotImplementedError("Accumulate products")`;
  const block = {
    id: "dot",
    label: "Dot product",
    starterCode: scaffold,
    code: "def dot_product(left, right):\n    return sum(a * b for a, b in zip(left, right))",
  };

  assert.equal(practiceState.starterPracticeSource("dot-products.py", block), scaffold);
  assert.equal(practiceState.workingPracticeBlockSource("dot-products.py", block, {}), scaffold);
});

test("active and formerly archived legacy drafts both reopen as the exact working source", () => {
  const typedSource = "def stable_softmax(logits):\n    return logits";
  const answers = { softmax: typedSource };

  for (const hiddenBlocks of [[], ["softmax"]]) {
    const compatible = practiceState.compatiblePracticeDrafts(
      "neural-language-model.py",
      pythonBlocks,
      hiddenBlocks,
      answers,
    );
    assert.equal(
      practiceState.workingPracticeBlockSource("neural-language-model.py", pythonBlocks[0], compatible.answers),
      typedSource,
      "legacy visibility state must not swap the learner's document",
    );
  }
});

test("the first direct edit retains exact bytes and invalidates only that cell", () => {
  const typedSource = "function first() { return 42; } // typed directly into the starter";
  const next = practiceState.editPracticeBlock(verifiedState(), "first", typedSource);

  assert.deepEqual(next.hiddenBlocks, ["first"]);
  assert.equal(next.answers.first, typedSource, "the first edit must retain the complete editor document");
  assert.deepEqual(next.verification, {
    ids: ["second"],
    sources: { second: "reference second" },
    contractVersion: "contracts-v1",
  });
  assert.equal(
    practiceState.workingPracticeBlockSource(
      "lesson.js",
      { id: "first", label: "First", code: "function first() { return 1; }" },
      next.answers,
    ),
    typedSource,
  );

  const restoredFromStorage = JSON.parse(JSON.stringify(next));
  assert.equal(
    practiceState.workingPracticeBlockSource(
      "lesson.js",
      { id: "first", label: "First", code: "function first() { return 1; }" },
      restoredFromStorage.answers,
    ),
    typedSource,
    "a serialized learner draft must resolve to the same source after reload",
  );
});

test("reset replaces only one working source and invalidates only its receipt", () => {
  const edited = practiceState.editPracticeBlock(verifiedState(), "first", "learner attempt");
  const reset = practiceState.resetPracticeBlock(edited, "first", "starter TODO");
  assert.deepEqual(reset.hiddenBlocks, ["first"]);
  assert.equal(reset.answers.first, "starter TODO");
  assert.deepEqual(reset.verification, {
    ids: ["second"],
    sources: { second: "reference second" },
    contractVersion: "contracts-v1",
  });
});

test("mixed Python migration quarantines only the incompatible JavaScript cell", () => {
  const answers = {
    softmax: "function stableSoftmax(logits) { return logits; }",
    context: "def context_embedding(indices, embeddings):\n    return embeddings[indices]",
    "removed-exercise": "def learner_archive():\n    return 'keep me'",
  };
  const migrated = practiceState.compatiblePracticeDrafts(
    "neural-language-model.py",
    pythonBlocks,
    ["softmax", "context"],
    answers,
  );

  assert.deepEqual(migrated.hiddenBlocks, ["context"]);
  assert.equal(migrated.answers.softmax, answers.softmax, "legacy bytes remain available for recovery");
  assert.equal(migrated.ignoredLegacyLanguage, true);
  assert.equal(
    practiceState.workingPracticeBlockSource("neural-language-model.py", pythonBlocks[0], migrated.answers),
    practiceState.starterPracticeSource("neural-language-model.py", pythonBlocks[0]),
  );
  assert.equal(
    practiceState.workingPracticeBlockSource("neural-language-model.py", pythonBlocks[1], migrated.answers),
    answers.context,
    "one incompatible save must not suppress a compatible Python draft",
  );
  assert.deepEqual(
    practiceState.preservedPracticeAnswers("neural-language-model.py", pythonBlocks, migrated.answers),
    {
      softmax: answers.softmax,
      "removed-exercise": answers["removed-exercise"],
    },
    "renamed or removed exercise answers must survive an unrelated current-cell save",
  );
});

test("saved Python drafts can be restored while legacy JavaScript remains quarantined", () => {
  assert.equal(practiceState.practiceDraftIsCompatible("lesson.py", "def softmax(values):\n    return values"), true);
  assert.equal(practiceState.practiceDraftIsCompatible("lesson.py", "function softmax(values) { return values; }"), false);
  assert.equal(practiceState.practiceDraftIsCompatible("lesson.js", "function softmax(values) { return values; }"), true);
});

test("verification binds to the exact stable working source without a visibility mode", () => {
  const empty = { ids: [], sources: {}, contractVersion: null };
  const workingSources = {
    softmax: "def stable_softmax(logits):\n    return logits",
    context: "def context_embedding(indices, embeddings):\n    return embeddings[indices]",
  };
  const verified = practiceState.verificationAfterWorkingSourceRun(
    empty,
    "softmax",
    workingSources.softmax,
    true,
    "contracts-v1",
  );
  assert.deepEqual(verified, {
    ids: ["softmax"],
    sources: { softmax: workingSources.softmax },
    contractVersion: "contracts-v1",
  });
  assert.deepEqual(
    practiceState.restoreWorkingSourceVerification(
      ["softmax", "context"],
      workingSources,
      ["softmax", "context"],
      { softmax: workingSources.softmax, context: "changed after verification" },
      "contracts-v1",
      "contracts-v1",
    ),
    verified,
  );
  assert.deepEqual(
    practiceState.creditableWorkingBlockIds(["softmax", "context"], ["context"]),
    ["context"],
  );
});

test("the active exercise waits for hydration, then exposes the editor and persists exact edits", async () => {
  const source = await readFile(paperLabUrl, "utf8");

  assert.match(source, /className="answer-area" data-direct-edit="true"/);
  assert.match(source, /const active = activeBlockId === block\.id/);
  assert.match(source, /aria-expanded=\{active\}/);
  assert.match(source, /setActiveBlockId\(\(current\) => current === block\.id \? "" : block\.id\)/);
  assert.match(source, /const round = activePracticeRounds\[block\.id\] \?\? 1/);
  assert.match(source, /const workingSource = practiceReady[\s\S]*?workingPracticeRepetitionSource/);
  assert.match(source, /ariaLabel=\{`Edit \$\{block\.label\}, round \$\{round\} of \$\{PRACTICE_ROUNDS\.length\}`\}/);
  assert.match(source, /const blockRunning = runningBlockIds\.includes\(block\.id\)/);
  assert.match(source, /readOnly=\{blockRunning \|\| \(projectConflict && round === 1\)\}/);
  assert.match(source, /value=\{workingSource\}/);
  assert.match(source, /<div className="lesson-editor-loading" role="status">Restoring saved code…<\/div>/);
  assert.doesNotMatch(source, /<SyntaxCode code=\{starterSource\}/);
  assert.match(source, /onChange=\{\(value\) => updateAnswer\(block, value\)\}/);
  assert.match(source, /editPracticeBlock\(practiceDraftState\(\), block\.id, value\)/);
  assert.match(source, /editPracticeRepetition\(practiceRepetitionsRef\.current, attemptKey, value\)/);
  assert.match(source, /saveLessonPracticeAndVerification\(lesson\.id, next\.hiddenBlocks, persistedAnswers/);
  assert.match(source, /saveCurrentProjectSeed\(projectSeedForLesson\(lesson, next\.hiddenBlocks, next\.answers/);
  assert.doesNotMatch(source, /Editable reference|Practice not run|Example not run|>Practice cell<\/button>/);
  assert.doesNotMatch(source, /data-reference-code/);
});

test("a single-cell check locks only that cell and preserves concurrent edits elsewhere", async () => {
  const source = await readFile(paperLabUrl, "utf8");
  const runCellSource = source.slice(source.indexOf("const runCell"), source.indexOf("const runAll"));

  assert.match(runCellSource, /const currentHidden = \[\.\.\.hiddenBlocksRef\.current\]/);
  assert.match(runCellSource, /const currentAnswers = \{ \.\.\.answersRef\.current \}/);
  assert.match(runCellSource, /applyPracticeState\(currentHidden, currentAnswers, nextVerified/);
  assert.match(runCellSource, /saveCurrentProjectSeed\(projectSeedForLesson\(lesson, currentHidden, currentAnswers, nextVerified\)\)/);
  assert.doesNotMatch(runCellSource, /applyPracticeState\(hiddenSnapshot, answersSnapshot, nextVerified/);
  assert.match(source, /dirty \? <button className="start-over-button"/);
  assert.match(source, /disabled=\{!practiceReady \|\| \(projectConflict && round === 1\) \|\| blockRunning\}>Start over/);
});

test("optional rounds use their own receipts while run all stays on required project sources", async () => {
  const source = await readFile(paperLabUrl, "utf8");
  const runCellSource = source.slice(source.indexOf("const runCell"), source.indexOf("const runAll"));
  const runAllSource = source.slice(source.indexOf("const runAll"), source.indexOf("const updateAnswer"));

  assert.match(runCellSource, /const roundSnapshot = activeRoundFor\(block\)/);
  assert.match(runCellSource, /if \(roundSnapshot === 1\) \{[\s\S]*?recordVerifiedCells[\s\S]*?saveCurrentProjectSeed/);
  assert.match(runCellSource, /else \{[\s\S]*?verificationAfterPracticeRepetitionRun\([\s\S]*?persistPracticeRepetitions/);
  assert.match(runCellSource, /Your required completion and project code are still saved/);
  assert.match(runAllSource, /const sourceSnapshots = Object\.fromEntries\(blocks\.map\(\(block\) => \[block\.id, baselineSourceFor\(block\)\]\)\)/);
  assert.doesNotMatch(runAllSource, /workingPracticeRepetitionSource/);
});

test("start over confirms inline while reference comparison never swaps the draft", async () => {
  const source = await readFile(paperLabUrl, "utf8");

  assert.match(source, /onClick=\{\(\) => armBlockReset\(block\)\}/);
  assert.match(source, /Confirm start over for \$\{block\.label\}, round \$\{round\}/);
  assert.match(source, /onClick=\{\(\) => resetBlock\(block\)\}[^\n]*>Confirm<\/button>/);
  assert.match(source, /onClick=\{\(\) => cancelBlockReset\(block\)\}/);
  assert.match(source, /aria-describedby=\{`practice-status-\$\{lesson\.id\}`\}/);
  assert.match(source, /round \$\{round\} is ready to start over\. Confirm to replace this round with its starter code, or cancel to keep your code/);
  assert.match(source, /<details className="reference-comparison">[\s\S]*?<SyntaxCode code=\{block\.code\}/);
  assert.match(source, /<summary>Reference solution<\/summary>/);
  assert.doesNotMatch(source, /Your draft stays unchanged|Compare with reference/);
  assert.doesNotMatch(source, /Restore reference|Restore draft|Restore all|Reset all|showSolution|hideAll|recoverBlock|restoreBlock/);
});

test("lesson writes preserve quarantined legacy bytes and never overwrite newer IDE source", async () => {
  const source = await readFile(paperLabUrl, "utf8");

  assert.match(source, /const quarantinedAnswersRef = useRef<Record<string, string>>\(\{\}\)/);
  assert.match(source, /quarantinedAnswersRef\.current = quarantinedAnswers/);
  assert.match(source, /const nextQuarantinedAnswers = \{ \.\.\.quarantinedAnswersRef\.current \}/);
  assert.match(source, /delete nextQuarantinedAnswers\[block\.id\]/);
  assert.match(source, /const persistedAnswers = \{ \.\.\.next\.answers, \.\.\.nextQuarantinedAnswers \}/);
  assert.match(source, /saveLessonPracticeAndVerification\(lesson\.id, next\.hiddenBlocks, persistedAnswers/);

  assert.match(source, /const projectSourceIsCurrent = \(\) => contributesToBrowserChat/);
  assert.match(source, /loadProjectState\(\)\.files\[projectPath\]\?\.content === projectContentRef\.current/);
  assert.match(source, /harnessFileSourceIsCurrent\(projectPath, projectContentRef\.current\)/);
  assert.match(source, /if \(!projectSourceIsCurrent\(\)\) \{\s*reportProjectConflict\(\);\s*return;\s*\}/);
  assert.match(source, /data-project-conflict=\{projectConflict\}/);
  assert.match(source, /readOnly=\{blockRunning \|\| \(projectConflict && round === 1\)\}/);
  assert.match(source, /This file changed in the project workspace\. Continue there so this lesson doesn.t overwrite the newer code\./);
});

test("lesson checks abort on unmount and cannot commit a superseded project snapshot", async () => {
  const source = await readFile(paperLabUrl, "utf8");

  assert.match(source, /const runAbortRef = useRef<AbortController \| null>\(null\)/);
  assert.match(source, /useEffect\(\(\) => \(\) => \{\s*runAbortRef\.current\?\.abort\(\);\s*runAbortRef\.current = null;\s*\}, \[\]\)/);
  assert.ok((source.match(/const controller = new AbortController\(\)/g) ?? []).length >= 2);
  assert.match(source, /runContracts\([\s\S]*?controller\.signal/);
  assert.match(source, /controller\.signal\.throwIfAborted\(\)/);
  assert.match(source, /await flushProjectPersistence\(\)/);
  assert.match(source, /recordValidatedLessonArtifact\(\{[\s\S]*?signal: controller\.signal[\s\S]*?isSourceCurrent: \(\) => projectFileSourceIsCurrent\(/);
  assert.match(source, /if \(runAbortRef\.current === controller\) \{\s*runAbortRef\.current = null;\s*setRunning\(\[\]\);/);
});

test("external reset and restore updates do not masquerade as learner typing", async () => {
  const [source, pythonSource] = await Promise.all([
    readFile(codeEditorUrl, "utf8"),
    readFile(pythonCodeEditorUrl, "utf8"),
  ]);

  assert.match(source, /const applyingExternalValueRef = useRef\(false\)/);
  assert.match(source, /onChange:\s*\(nextValue\) => \{[\s\S]*?!applyingExternalValueRef\.current[\s\S]*?changeRef\.current\(nextValue\)/);
  assert.match(source, /applyingExternalValueRef\.current = true;[\s\S]*view\.dispatch\([\s\S]*finally \{[\s\S]*applyingExternalValueRef\.current = false;/);
  assert.match(pythonSource, /import \{ CodeEditor \} from "@\/app\/features\/ide\/CodeEditor"/);
  assert.match(pythonSource, /<CodeEditor[\s\S]*?onChange=\{onChange\}[\s\S]*?value=\{value\}/);
  assert.doesNotMatch(pythonSource, /applyingExternalValueRef|EditorView|EditorState/, "Python must reuse the one controlled-value adapter");
  assert.match(source, /Press Escape, then Tab, to leave the editor\./, "keyboard users need an explicit escape route");
});

test("the shared lesson editor selects CPython syntax and four-space indentation for Python files", async () => {
  const [source, primitive] = await Promise.all([
    readFile(codeEditorUrl, "utf8"),
    readFile(learnerCodeEditorUrl, "utf8"),
  ]);

  assert.match(source, /if \(normalized\.endsWith\("\.py"\)\) return "python"/);
  assert.match(source, /tabSize: language === "python" \? 4 : 2/);
  assert.match(source, /extensions:\s*createLearnerCodeEditorExtensions\(\{/);
  assert.match(primitive, /import \{ python \} from "@codemirror\/lang-python"/);
  assert.match(primitive, /if \(language === "python"\) return python\(\)/);
  assert.match(primitive, /indentUnit\.of\(" "\.repeat\(tabSize\)\)/);
  assert.match(primitive, /EditorState\.tabSize\.of\(tabSize\)/);
});
