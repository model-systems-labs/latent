import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = new URL("../", import.meta.url);
const completionUrl = new URL("app/features/ide/autocomplete.ts", root);

let autocomplete;
let codeMirrorAutocomplete;
let codeMirrorPython;
let codeMirrorState;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(root),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [autocomplete, codeMirrorAutocomplete, codeMirrorPython, codeMirrorState] = await Promise.all([
    vite.ssrLoadModule("/app/features/ide/autocomplete.ts"),
    import("@codemirror/autocomplete"),
    import("@codemirror/lang-python"),
    import("@codemirror/state"),
  ]);
});

after(async () => {
  await vite?.close();
});

function completionFor(doc, explicit = false) {
  const state = codeMirrorState.EditorState.create({
    doc,
    extensions: [codeMirrorPython.python(), autocomplete.pythonCourseCompletions],
  });
  const context = new codeMirrorAutocomplete.CompletionContext(state, state.doc.length, explicit);
  return autocomplete.pythonCourseCompletionSource(context);
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = new URL(entry.name, directory);
    if (entry.isDirectory()) files.push(...await filesBelow(new URL(`${entry.name}/`, directory)));
    else files.push(path);
  }
  return files;
}

test("the course source fills only the Python vocabulary missing from CodeMirror", () => {
  assert.deepEqual(
    autocomplete.PYTHON_KEYWORD_COMPLETIONS.map(({ label }) => label),
    [
      "and", "as", "assert", "async", "await", "break", "case", "continue", "del",
      "elif", "else", "except", "finally", "global", "in", "is", "lambda", "match",
      "nonlocal", "not", "or", "pass", "raise", "return", "with", "yield",
    ],
  );
  const labels = autocomplete.PYTHON_KEYWORD_COMPLETIONS.map(({ label }) => label);
  assert.equal(new Set(labels).size, labels.length);
  for (const nativeSnippet of ["def", "for", "while", "try", "if", "class", "import", "from"]) {
    assert.ok(!labels.includes(nativeSnippet), `${nativeSnippet} remains owned by CodeMirror's native snippets`);
  }
  assert.equal(autocomplete.PYTHON_KEYWORD_COMPLETIONS.find(({ label }) => label === "return")?.type, "keyword");
});

test("NumPy completion follows an actual import alias and replaces only the member prefix", () => {
  const topLevel = completionFor("import numpy as np\nnp.as");
  assert.equal(topLevel?.from, 22);
  assert.ok(topLevel?.options.some(({ label }) => label === "asarray"));
  assert.ok(topLevel?.options.some(({ label }) => label === "exp"));
  assert.equal(topLevel?.options.find(({ label }) => label === "asarray")?.type, "function");
  assert.equal(topLevel?.options.find(({ label }) => label === "float64")?.type, "type");
  assert.equal(topLevel?.options.find(({ label }) => label === "inf")?.type, "constant");
  assert.equal(topLevel?.options.find(({ label }) => label === "random")?.type, "namespace");

  const customAlias = completionFor("import numpy as tensor\ntensor.ze");
  assert.equal(customAlias?.from, 30);
  assert.ok(customAlias?.options.some(({ label }) => label === "zeros"));

  const nested = completionFor("import numpy as np\nnp.random.de");
  assert.equal(nested?.from, 29);
  assert.deepEqual(nested?.options.map(({ label }) => label), ["default_rng"]);
});

test("completion is quiet in prose-like syntax and for unrecognized objects", () => {
  for (const doc of [
    "foo.as",
    "NP.as",
    "'np.as'",
    '"np.as"',
    "# np.as",
    "import numpy as np\n# np.as",
    "import numpy as np\n'np.as'",
  ]) {
    assert.equal(completionFor(doc), null, doc);
  }
  assert.equal(completionFor(""), null);
});

test("keywords complete implicitly by prefix and explicitly from an empty line", () => {
  const prefixed = completionFor("ret");
  assert.equal(prefixed?.from, 0);
  assert.ok(prefixed?.options.some(({ label }) => label === "return"));

  const explicit = completionFor("", true);
  assert.equal(explicit?.from, 0);
  assert.ok(explicit?.options.some(({ label }) => label === "return"));
});

test("native built-ins, snippets, and scope names remain installed beside course completion", async () => {
  const doc = `import numpy as np

def softmax(logits, temperature=1):
    shifted_logits = logits
    ret`;
  const state = codeMirrorState.EditorState.create({
    doc,
    extensions: [codeMirrorPython.python(), autocomplete.pythonCourseCompletions],
  });
  const context = new codeMirrorAutocomplete.CompletionContext(state, state.doc.length, true);
  const sources = state.languageDataAt("autocomplete", state.doc.length);
  assert.ok(sources.length >= 3, "the two native Python sources and course source are all present");

  const results = await Promise.all(sources.map((source) => typeof source === "function" ? source(context) : null));
  const labels = results.flatMap((result) => result?.options.map(({ label }) => label) ?? []);
  for (const expected of ["softmax", "logits", "temperature", "shifted_logits", "print", "range", "return"]) {
    assert.ok(labels.includes(expected), `${expected} should remain available`);
  }
});

test("the NumPy catalog covers every member taught by the lesson corpus", async () => {
  const lessonRoot = new URL("app/lessons/", root);
  const files = (await filesBelow(lessonRoot)).filter((path) => /\.(ts|tsx)$/.test(path.pathname));
  const usedMembers = new Set();
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/\bnp\.([A-Za-z_][A-Za-z_0-9]*)/g)) usedMembers.add(match[1]);
  }
  const catalog = new Set(autocomplete.NUMPY_COMPLETIONS.map(({ label }) => label));
  assert.deepEqual([...usedMembers].sort(), [...catalog].sort());
  assert.deepEqual(autocomplete.NUMPY_RANDOM_COMPLETIONS.map(({ label }) => label), ["default_rng"]);
});

test("autocomplete stays deterministic and does not boot the Python runtime", async () => {
  const source = await readFile(completionUrl, "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|Worker|python-lab|Pyodide/i);
  assert.ok(!(completionFor("import numpy as np\nnp.") instanceof Promise));
});
