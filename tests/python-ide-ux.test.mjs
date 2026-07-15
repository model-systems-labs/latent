import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const executionUrl = new URL("../app/features/ide/PythonExecution.tsx", import.meta.url);
const editorUrl = new URL("../app/features/ide/PythonCodeEditor.tsx", import.meta.url);
const workbenchUrl = new URL("../app/components/ProjectWorkbench.tsx", import.meta.url);
const pythonCssUrl = new URL("../app/styles/python-runtime.css", import.meta.url);
const responsiveCssUrl = new URL("../app/styles/responsive.css", import.meta.url);
const globalsUrl = new URL("../app/globals.css", import.meta.url);
const viteConfigUrl = new URL("../vite.config.ts", import.meta.url);

test("Python is an explicit, lazy runtime rather than part of page startup", async () => {
  const source = await readFile(executionUrl, "utf8");
  const start = source.slice(source.indexOf("const start = useCallback"), source.indexOf("const runFile = useCallback"));
  assert.match(start, /await import\("@latent\/python-lab"\)/);
  assert.match(start, /new PythonLabClient\(\)/);
  assert.match(start, /initialize\([\s\S]*?packages: \["numpy"\]/);
  assert.match(source, /downloads the roughly 9 MB WebAssembly core, the standard library, and NumPy/);
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
  assert.match(source, />Start Python</);
  assert.match(source, />Run file</);
  assert.match(source, />Test &amp; train</);
  assert.match(source, /session\.phase === "stopping" \? "Stopping…" : "Stop"/);
  assert.match(source, />Restart/);
  assert.match(source, /await client\.stop\(\)/);
  assert.match(source, /clientRef\.current\.reset\(/);
  assert.match(source, /clientRef\.current\?\.dispose\(\)/);
  assert.match(source, /className="python-traceback" role="alert"/);
  assert.match(source, /checkpoint was trained by Python and saved for browser inference/);
  assert.match(source, /A checkpoint is saved only after every test passes/);
  assert.match(source, /setArtifactSourceIdentity\(null\)/, "a rerun makes the previous artifact explicitly historical");
  assert.match(source, /Source changed\. Test and train again to replace the last verified checkpoint/);
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
  assert.match(source, /const PythonCodeEditor = lazy\(\(\) => import\("\.\.\/features\/ide\/PythonCodeEditor"\)/);
  assert.match(source, /const SelectedCodeEditor = isPythonFile \? PythonCodeEditor : CodeEditor/);
  assert.match(source, /<Suspense fallback=\{<div className="python-editor-loading" role="status">[\s\S]*?<SelectedCodeEditor path=\{selected\.path\}/);
  assert.match(source, /isPythonFile && selected \? <PythonInspector/);
  assert.match(source, /verifiedFiles = filesByGroup[\s\S]*?filter\(\(file\) => file\.lessonId && statusForFile\(file\)\.complete\)/);
});

test("the Python editor has native syntax highlighting and the same keyboard escape hatch", async () => {
  const [source, viteConfig] = await Promise.all([
    readFile(editorUrl, "utf8"),
    readFile(viteConfigUrl, "utf8"),
  ]);
  assert.match(source, /import \{ python \} from "@codemirror\/lang-python"/);
  assert.match(source, /python\(\)/);
  assert.match(source, /syntaxHighlighting\(pythonSyntaxTheme\)/);
  assert.match(source, /background:\s*"#1f1e21"/);
  assert.match(source, /\}, \{ dark: true \}\);/);
  assert.match(source, /EditorState\.tabSize\.of\(4\)/);
  assert.match(source, /\{ key: "Escape", run: temporarilySetTabFocusMode \}/);
  assert.match(source, /Python code editor\. Tab indents four spaces\. Press Escape, then Tab, to leave the editor\./);
  assert.match(
    viteConfig,
    /optimizeDeps:[\s\S]*?include: \[[\s\S]*?"@codemirror\/lang-python"/,
    "the first lazy Python-editor click must not request an unprepared Vite dependency chunk",
  );
});

test("Python evidence stays readable and uses the existing mobile Tests and Output views", async () => {
  const [execution, pythonStyles, responsive, globals] = await Promise.all([
    readFile(executionUrl, "utf8"),
    readFile(pythonCssUrl, "utf8"),
    readFile(responsiveCssUrl, "utf8"),
    readFile(globalsUrl, "utf8"),
  ]);
  assert.match(execution, /<section className="unit-test-panel">/);
  assert.match(execution, /<section className="project-output python-output">/);
  assert.match(pythonStyles, /\.python-output pre \{[\s\S]*?font-size: max\(0\.68rem, 11px\)/);
  assert.match(pythonStyles, /\.python-empty-output \{[^}]*font-size: max\(0\.68rem, 11px\)/);
  assert.match(globals, /@import "\.\/styles\/python-runtime\.css"/);
  assert.match(responsive, /\.project-workbench-grid\[data-mobile-view="tests"\] \.project-output,[\s\S]*?\.project-workbench-grid\[data-mobile-view="output"\] \.unit-test-panel/);
});
