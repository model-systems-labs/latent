import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const executionUrl = new URL("../app/features/ide/PythonExecution.tsx", import.meta.url);
const editorUrl = new URL("../app/features/ide/PythonCodeEditor.tsx", import.meta.url);
const sharedEditorUrl = new URL("../app/features/ide/CodeEditor.tsx", import.meta.url);
const completionsUrl = new URL("../app/features/ide/python-runtime-completions.ts", import.meta.url);
const lessonServiceUrl = new URL("../app/features/ide/python-lesson-service.ts", import.meta.url);
const learnerCodeEditorUrl = new URL("../packages/course-kit/src/learner-code-editor.ts", import.meta.url);
const workbenchUrl = new URL("../app/components/ProjectWorkbench.tsx", import.meta.url);
const pythonCssUrl = new URL("../app/styles/python-runtime.css", import.meta.url);
const pythonModuleCssUrl = new URL("../app/features/ide/PythonExecution.module.css", import.meta.url);
const responsiveCssUrl = new URL("../app/styles/responsive.css", import.meta.url);
const globalsUrl = new URL("../app/globals.css", import.meta.url);
const viteConfigUrl = new URL("../vite.config.ts", import.meta.url);

test("Python is an explicit, lazy runtime with curated scientific and sorted-collection packages", async () => {
  const source = await readFile(executionUrl, "utf8");
  const start = source.slice(source.indexOf("const start = useCallback"), source.indexOf("const runFile = useCallback"));
  assert.match(start, /await import\("@latent\/python-lab"\)/);
  assert.match(start, /new PythonLabClient\(\)/);
  assert.match(start, /initialize\([\s\S]*?packages: PYTHON_IDE_PACKAGES/);
  assert.match(source, /PYTHON_IDE_PACKAGES = \["numpy", "sortedcontainers"\] as const/);
  assert.match(source, /downloads about 9 MB for the WebAssembly core, standard library, NumPy, and Sorted Containers/);
  assert.doesNotMatch(source, /^import \{ PythonLabClient/m, "the runtime package must not be imported into the initial workspace chunk");
});

test("every Python execution saves the current draft before syncing or training", async () => {
  const source = await readFile(executionUrl, "utf8");
  const runFile = source.slice(source.indexOf("const runFile = useCallback"), source.indexOf("const testAndTrain = useCallback"));
  assert.ok(runFile.indexOf("await saveRef.current()") < runFile.indexOf("await client.sync("));
  assert.ok(runFile.indexOf("await client.sync(") < runFile.indexOf("await client.run("));
  const train = source.slice(source.indexOf("const testAndTrain = useCallback"), source.indexOf("const stop = useCallback"));
  assert.ok(train.indexOf("await saveRef.current()") < train.indexOf("savePythonCharacterRnnArtifact"));
  assert.match(train, /source: snapshot\.source/);
  assert.match(train, /pythonLab: client/);
  assert.match(train, /signal: controller\.signal/);
});

test("Python controls expose run, verified training, hard stop, restart, and honest evidence", async () => {
  const source = await readFile(executionUrl, "utf8");
  const runtimeActions = source.slice(source.indexOf("export function PythonRuntimeActions"), source.indexOf("export function PythonInspector"));
  const inspector = source.slice(source.indexOf("export function PythonInspector"));
  assert.match(source, />Start Python</);
  assert.match(source, />Run file</);
  assert.doesNotMatch(runtimeActions, />Test &amp; train</, "checkpoint verification belongs in the Tests view, not in the editor runtime controls");
  assert.equal(inspector.match(/>Test &amp; train</g)?.length, 1, "the character RNN exposes one checkpoint action");
  assert.match(source, /session\.phase === "stopping" \? "Stopping…" : "Stop"/);
  assert.match(source, />Restart/);
  assert.match(source, /await client\.stop\(\)/);
  assert.match(source, /clientRef\.current\.reset\(/);
  assert.match(source, /clientRef\.current\?\.dispose\(\)/);
  assert.match(source, /className="python-traceback" role="alert"/);
  assert.match(source, /Python trained the checkpoint, and it’s saved for the browser to use/);
  assert.match(source, /Checks this model file, trains its weights, and saves them for the app build/);
  assert.match(source, /setArtifactSourceIdentity\(null\)/, "a rerun makes the previous artifact explicitly historical");
  assert.match(source, /The source changed\. Test and train again to replace the last verified checkpoint/);
  assert.match(source, /setTraceback\(result\.traceback \?\? null\)/);
  assert.match(source, /session\.artifactIsCurrent \? "Verified for this source" : "Last verified · Python"/);
});

test("the project tree surfaces Python once without changing lesson completion semantics", async () => {
  const source = await readFile(workbenchUrl, "utf8");
  assert.match(source, /const lessonPaths = new Set\(lessonEntries\.map\(\(file\) => file\.path\)\)/);
  assert.match(source, /file\.courseId === group\.id && !lessonPaths\.has\(file\.path\)/);
  assert.match(source, /const isPythonFile = Boolean\(selected\?\.path\.endsWith\("\.py"\)\)/);
  assert.match(source, /canTestAndTrain: selected\?\.path === PYTHON_CHARACTER_RNN_PATH/);
  assert.match(source, /persistedArtifact: persistedPythonArtifact/);
  assert.match(source, /const PythonCodeEditor = lazy\(\(\) => import\("@\/app\/features\/ide\/PythonCodeEditor"\)/);
  assert.match(source, /const SelectedCodeEditor = isPythonFile \? PythonCodeEditor : CodeEditor/);
  assert.match(source, /<Suspense fallback=\{<div className="python-editor-loading" role="status">[\s\S]*?<SelectedCodeEditor path=\{selected\.path\}/);
  assert.match(source, /isPythonFile && selected \? <PythonInspector/);
  assert.match(source, /const status = statusForFile\(file\)/);
});

test("the Python editor is a thin adapter over the shared highlighted editor primitive", async () => {
  const [source, sharedEditor, primitive, completions, lessonService, viteConfig] = await Promise.all([
    readFile(editorUrl, "utf8"),
    readFile(sharedEditorUrl, "utf8"),
    readFile(learnerCodeEditorUrl, "utf8"),
    readFile(completionsUrl, "utf8"),
    readFile(lessonServiceUrl, "utf8"),
    readFile(viteConfigUrl, "utf8"),
  ]);
  assert.match(source, /import \{ CodeEditor \} from "@\/app\/features\/ide\/CodeEditor"/);
  assert.match(source, /<CodeEditor[\s\S]*?ariaLabel=\{`Python project file editor: \$\{path\}`\}[\s\S]*?path=\{path\}[\s\S]*?variant="project"/);
  assert.doesNotMatch(source, /@codemirror|@lezer|HighlightStyle|EditorView|keymap|python\(\)/);

  assert.match(sharedEditor, /if \(normalized\.endsWith\("\.py"\)\) return "python"/);
  assert.match(sharedEditor, /tabSize: language === "python" \? 4 : 2/);
  assert.match(sharedEditor, /\.\.\.createLearnerCodeEditorExtensions\(\{/);
  assert.match(sharedEditor, /language === "python" \? \[pythonRuntimeCompletions\] : \[\]/);
  assert.match(primitive, /if \(language === "python"\) return python\(\)/);
  assert.match(primitive, /syntaxHighlighting\([\s\S]*?workspaceDarkSyntaxTheme[\s\S]*?integratedSyntaxTheme/);
  assert.match(primitive, /indentUnit\.of\(" "\.repeat\(tabSize\)\)/);
  assert.match(primitive, /EditorState\.tabSize\.of\(tabSize\)/);
  assert.match(primitive, /\{ key: "Escape", run: temporarilySetTabFocusMode \}/);
  assert.match(primitive, /\{ key: "Tab", run: acceptCompletion \},\s*indentWithTab/);
  assert.match(primitive, /variant === "workspace-dark" \? workspaceDarkTheme : integratedTheme/);
  assert.match(completions, /label: "defaultdict"/);
  assert.match(completions, /label: "SortedSet"/);
  assert.match(completions, /fromImport/);
  assert.match(completions, /memberAccess/);
  assert.match(completions, /autoImport/);
  assert.match(lessonService, /import\\s\+sortedcontainers/);
  assert.match(lessonService, /from\\s\+sortedcontainers/);
  assert.match(
    viteConfig,
    /optimizeDeps:[\s\S]*?include: \[[\s\S]*?"@codemirror\/lang-python"/,
    "the first lazy Python-editor click must not request an unprepared Vite dependency chunk",
  );
});

test("Python evidence stays readable and uses the existing mobile Tests and Output views", async () => {
  const [execution, pythonStyles, pythonModuleStyles, responsive, globals] = await Promise.all([
    readFile(executionUrl, "utf8"),
    readFile(pythonCssUrl, "utf8"),
    readFile(pythonModuleCssUrl, "utf8"),
    readFile(responsiveCssUrl, "utf8"),
    readFile(globalsUrl, "utf8"),
  ]);
  assert.match(execution, /<section className=\{`unit-test-panel \$\{styles\.checksPanel\}`\}>/);
  assert.match(execution, />Project checks</);
  assert.match(execution, />Run file checks</);
  assert.match(execution, /"Test, build & run"/);
  assert.match(execution, />Model checkpoint</);
  assert.doesNotMatch(execution, /python-test-panels/);
  assert.match(execution, /<section className="project-output python-output">/);
  assert.match(pythonStyles, /\.python-output \{\s*min-height: 0;/);
  assert.doesNotMatch(pythonModuleStyles, /\.checksPanel[^}]*min-height:\s*14rem/);
  assert.match(pythonModuleStyles, /\.checkpointPanel \{[^}]*flex: 0 0 auto/);
  assert.match(pythonModuleStyles, /data-mobile-view="tests"\]\) \.checksPanel/);
  assert.match(pythonStyles, /\.python-output pre \{[\s\S]*?font-size: max\(0\.68rem, 11px\)/);
  assert.match(pythonStyles, /\.python-empty-output \{[^}]*font-size: max\(0\.68rem, 11px\)/);
  assert.match(globals, /@import "@\/app\/styles\/python-runtime\.css"/);
  assert.match(responsive, /\.project-workbench-grid\[data-mobile-view="tests"\] \.project-output,[\s\S]*?\.project-workbench-grid\[data-mobile-view="output"\] \.unit-test-panel/);
});
