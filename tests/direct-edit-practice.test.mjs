import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = new URL("../", import.meta.url);
const paperLabUrl = new URL("app/components/PaperLab.tsx", root);
const codeEditorUrl = new URL("app/features/ide/CodeEditor.tsx", root);
const pythonCodeEditorUrl = new URL("app/features/ide/PythonCodeEditor.tsx", root);

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

test("the first direct edit preserves the visible source, creates a draft, and invalidates only that cell", () => {
  const typedSource = "function first() { return 42; } // typed directly into the reference";
  const next = practiceState.editPracticeBlock(verifiedState(), "first", typedSource);

  assert.deepEqual(next.hiddenBlocks, ["first"]);
  assert.equal(next.answers.first, typedSource, "the first edit must retain the complete editor document");
  assert.deepEqual(next.verification, {
    ids: ["second"],
    sources: { second: "reference second" },
    contractVersion: "contracts-v1",
  });
  assert.equal(
    practiceState.practiceBlockSource({ id: "first", code: "reference first" }, next.hiddenBlocks, next.answers),
    typedSource,
  );

  const restoredFromStorage = JSON.parse(JSON.stringify(next));
  assert.equal(
    practiceState.practiceBlockSource({ id: "first", code: "reference first" }, restoredFromStorage.hiddenBlocks, restoredFromStorage.answers),
    typedSource,
    "a serialized learner draft must resolve to the same source after reload",
  );
});

test("reset and restore remain explicit, source-bound transitions", () => {
  const edited = practiceState.editPracticeBlock(verifiedState(), "first", "learner attempt");
  const reset = practiceState.resetPracticeBlock(edited, "first", "starter TODO");
  assert.deepEqual(reset.hiddenBlocks, ["first"]);
  assert.equal(reset.answers.first, "starter TODO");
  assert.deepEqual(reset.verification.ids, ["second"]);

  const restored = practiceState.restoreReferenceBlock(reset, "first");
  assert.deepEqual(restored.hiddenBlocks, []);
  assert.equal(restored.answers.first, "starter TODO", "restoring the reference must retain the prior draft for recovery");
  assert.equal(
    practiceState.practiceBlockSource({ id: "first", code: "reference first" }, restored.hiddenBlocks, restored.answers),
    "reference first",
  );
  assert.deepEqual(restored.verification.ids, ["second"]);
});

test("a pre-migration JavaScript draft is preserved but never injected into a Python lesson", () => {
  const answers = {
    softmax: "function stableSoftmax(logits) { return logits; }",
    untouched: "def untouched(value):\n    return value",
  };
  const migrated = practiceState.compatiblePracticeDrafts(
    "neural-language-model.py",
    [{ id: "softmax" }, { id: "untouched" }],
    ["softmax"],
    answers,
  );

  assert.deepEqual(migrated.hiddenBlocks, []);
  assert.equal(migrated.answers.softmax, answers.softmax, "legacy bytes remain available for recovery");
  assert.equal(migrated.ignoredLegacyLanguage, true);

  const python = practiceState.compatiblePracticeDrafts(
    "neural-language-model.py",
    [{ id: "untouched" }],
    ["untouched"],
    answers,
  );
  assert.deepEqual(python.hiddenBlocks, ["untouched"]);
  assert.equal(python.ignoredLegacyLanguage, false);
});

test("saved Python drafts can be restored while legacy JavaScript remains quarantined", () => {
  assert.equal(practiceState.practiceDraftIsCompatible("lesson.py", "def softmax(values):\n    return values"), true);
  assert.equal(practiceState.practiceDraftIsCompatible("lesson.py", "function softmax(values) { return values; }"), false);
  assert.equal(practiceState.practiceDraftIsCompatible("lesson.js", "function softmax(values) { return values; }"), true);
});

test("every lesson cell exposes an editor without a practice-mode gate and persists edits", async () => {
  const source = await readFile(paperLabUrl, "utf8");

  assert.match(source, /className="answer-area" data-direct-edit="true"/);
  assert.match(source, /ariaLabel=\{`Edit \$\{block\.label\}`\}/);
  assert.match(source, /const blockRunning = runningBlockIds\.includes\(block\.id\)/);
  assert.match(source, /readOnly=\{blockRunning\}/);
  assert.match(source, /value=\{hidden \? answers\[block\.id\] \?\? "" : block\.code\}/);
  assert.match(source, /onChange=\{\(value\) => updateAnswer\(block, value\)\}/);
  assert.match(source, /editPracticeBlock\(practiceDraftState\(\), block\.id, value\)/);
  assert.match(source, /saveLessonPracticeAndVerification\(lesson\.id, next\.hiddenBlocks, next\.answers/);
  assert.match(source, /saveLessonProjectFile\(projectSeedForLesson\(lesson, next\.hiddenBlocks, next\.answers/);
  assert.doesNotMatch(source, />Practice cell<\/button>/);
  assert.doesNotMatch(source, /hidden \? \([\s\S]*<LessonCodeEditor[\s\S]*\) : \([\s\S]*<SyntaxCode/);
});

test("a single-cell check locks only that cell and preserves concurrent edits elsewhere", async () => {
  const source = await readFile(paperLabUrl, "utf8");
  const runCellSource = source.slice(source.indexOf("const runCell"), source.indexOf("const runAll"));

  assert.match(runCellSource, /const currentHidden = \[\.\.\.hiddenBlocksRef\.current\]/);
  assert.match(runCellSource, /const currentAnswers = \{ \.\.\.answersRef\.current \}/);
  assert.match(runCellSource, /applyPracticeState\(currentHidden, currentAnswers, nextVerified/);
  assert.match(runCellSource, /saveLessonProjectFile\(projectSeedForLesson\(lesson, currentHidden, currentAnswers, nextVerified\)\)/);
  assert.doesNotMatch(runCellSource, /applyPracticeState\(hiddenSnapshot, answersSnapshot, nextVerified/);
  assert.match(source, /disabled=\{!practiceReady \|\| blockRunning\}>Reset starter/);
});

test("destructive resets arm inline and recovery actions render only when usable", async () => {
  const source = await readFile(paperLabUrl, "utf8");

  assert.match(source, /onClick=\{\(\) => armBlockReset\(block\)\}/);
  assert.match(source, /Confirm reset \$\{block\.label\} to starter code/);
  assert.match(source, /onClick=\{\(\) => resetBlock\(block\)\}[^\n]*>Confirm reset<\/button>/);
  assert.match(source, /onClick=\{\(\) => cancelBlockReset\(block\)\}/);
  assert.match(source, /hidden \? <button[^\n]*Show example<\/button>/);
  assert.match(source, /recoverableDraft \? <button[^\n]*Restore draft<\/button> : null/);
  assert.match(source, /onClick=\{armResetAll\}/);
  assert.match(source, /onClick=\{hideAll\}[^\n]*>Confirm reset all<\/button>/);
  assert.match(source, /onClick=\{cancelResetAll\}/);
  assert.match(source, /hiddenBlocks\.length > 0 \? <button[^\n]*Show all examples<\/button> : null/);
  assert.match(source, /aria-describedby=\{`practice-status-\$\{lesson\.id\}`\}/);
  assert.match(source, /is ready to reset\. Confirm to replace this draft with starter code, or cancel to keep your code/);
  assert.match(source, /Ready to reset everything\. Confirm to replace every cell with starter code, or cancel to keep your code/);
  assert.doesNotMatch(source, /disabled=\{!practiceReady \|\| \(!hidden && !recoverableDraft\)/);
});

test("external reset and restore updates do not masquerade as learner typing", async () => {
  const [source, pythonSource] = await Promise.all([
    readFile(codeEditorUrl, "utf8"),
    readFile(pythonCodeEditorUrl, "utf8"),
  ]);

  for (const editorSource of [source, pythonSource]) {
    assert.match(editorSource, /const applyingExternalValueRef = useRef\(false\)/);
    assert.match(editorSource, /update\.docChanged && !applyingExternalValueRef\.current/);
    assert.match(editorSource, /applyingExternalValueRef\.current = true;[\s\S]*view\.dispatch\([\s\S]*finally \{[\s\S]*applyingExternalValueRef\.current = false;/);
  }
  assert.match(source, /With suggestions closed, press Escape, then Tab, to leave the editor\./, "keyboard users need an explicit escape route");
});

test("the shared lesson editor selects CPython syntax and four-space indentation for Python files", async () => {
  const source = await readFile(codeEditorUrl, "utf8");

  assert.match(source, /import \{ python \} from "@codemirror\/lang-python"/);
  assert.match(source, /const isPython = path\.toLowerCase\(\)\.endsWith\("\.py"\)/);
  assert.match(source, /isPython \? python\(\) : javascript/);
  assert.match(source, /isPython && !readOnly \? pythonCourseCompletions : \[\]/);
  assert.match(source, /EditorState\.tabSize\.of\(isPython \? 4 : 2\)/);
});
