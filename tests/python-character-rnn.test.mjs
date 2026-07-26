import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";
import { loadPyodide } from "pyodide";
import { createServer } from "vite";

const storage = new Map();
const sessionStorage = new Map();
const storageAdapter = (records) => ({
  getItem: (key) => records.get(key) ?? null,
  setItem: (key, value) => records.set(key, String(value)),
  removeItem: (key) => records.delete(key),
  get length() { return records.size; },
  key: (index) => [...records.keys()][index] ?? null,
});
globalThis.window = {
  localStorage: storageAdapter(storage),
  sessionStorage: storageAdapter(sessionStorage),
  dispatchEvent: () => true,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

let canonical;
let client;
let course;
let learner;
let persistence;
let pyodide;
let pyodidePythonLab;
let service;
let snapshot;
let source;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  [canonical, client, course, learner, persistence, service, snapshot, source] = await Promise.all([
    vite.ssrLoadModule("/app/lib/canonical-project.ts"),
    vite.ssrLoadModule("/app/platform/persistence/client.ts"),
    vite.ssrLoadModule("/examples/learning-platform/llm-learning/lessons/course.ts"),
    vite.ssrLoadModule("/app/lib/learner-state.ts"),
    vite.ssrLoadModule("/app/platform/persistence/index.ts"),
    vite.ssrLoadModule("/app/features/python/character-rnn-service.ts"),
    vite.ssrLoadModule("/app/features/ide/project-snapshot.ts"),
    vite.ssrLoadModule("/app/features/python/character-rnn-source.ts"),
  ]);
  await learner.initializeLearnerPersistence();
  await learner.flushLearnerPersistence();
});

after(async () => {
  await client?.closePersistenceContext();
  if (persistence) {
    const database = new persistence.BrowserLabDatabase();
    await database.delete();
  }
  pyodide?.globals.delete("RESULT");
  await vite?.close();
});

async function realPythonLab() {
  if (pyodidePythonLab) return pyodidePythonLab;
  pyodide = await loadPyodide({
    indexURL: fileURLToPath(new URL(".", import.meta.resolve("pyodide/package.json"))),
    packages: ["numpy"],
  });
  pyodide.FS.mkdirTree("/workspace");
  pyodide.runPython("import os; os.chdir('/workspace')");
  const files = new Set();
  let revision = 0;

  pyodidePythonLab = {
    async initialize() {
      return {
        schemaVersion: 1,
        runtime: "pyodide",
        runtimeVersion: "0.29.3",
        pythonVersion: String(pyodide.runPython("import platform; platform.python_version()")),
        packages: ["numpy"],
        guardrailsApplied: true,
        capabilityReduced: true,
      };
    },
    async sync({ files: nextFiles, deletePaths = [] }) {
      for (const path of deletePaths) {
        try { pyodide.FS.unlink(`/workspace/${path}`); } catch {}
        files.delete(path);
      }
      for (const file of nextFiles) {
        const segments = file.path.split("/");
        segments.pop();
        if (segments.length) pyodide.FS.mkdirTree(`/workspace/${segments.join("/")}`);
        pyodide.FS.writeFile(`/workspace/${file.path}`, file.contents, { encoding: "utf8" });
        files.add(file.path);
      }
      revision += 1;
      return { schemaVersion: 1, revision, files: [...files].sort() };
    },
    async runTests({ tests }) {
      const results = [];
      for (const pythonTest of tests) {
        pyodide.globals.set("__latent_test_source", pythonTest.code);
        try {
          pyodide.runPython(`
_latent_test_namespace = {
    "__name__": "__latent_test__",
    "__file__": ${JSON.stringify("<real-pyodide-character-rnn-test>")},
}
exec(compile(__latent_test_source, _latent_test_namespace["__file__"], "exec"), _latent_test_namespace)
`);
          results.push({ id: pythonTest.id, label: pythonTest.label, passed: true, durationMs: 0 });
        } catch (error) {
          const traceback = String(error);
          const message = traceback.trim().split("\n").at(-1) ?? traceback;
          results.push({
            id: pythonTest.id,
            label: pythonTest.label,
            passed: false,
            durationMs: 0,
            exception: { type: error?.name ?? "PythonError", message, traceback },
          });
        } finally {
          pyodide.globals.delete("__latent_test_source");
          pyodide.globals.delete("_latent_test_namespace");
        }
      }
      return {
        schemaVersion: 1,
        requestId: "real-tests",
        kind: "tests",
        status: "completed",
        passed: results.every((result) => result.passed),
        durationMs: 0,
        tests: results,
        artifacts: [],
      };
    },
    async run({ entryPath, resultVariable = "RESULT", artifactPaths = [] }) {
      for (const path of artifactPaths) {
        try { pyodide.FS.unlink(`/workspace/${path}`); } catch {}
      }
      pyodide.globals.set("__latent_entry_path", `/workspace/${entryPath}`);
      pyodide.globals.set("__latent_result_variable", resultVariable);
      try {
        pyodide.runPython(`
import runpy as _latent_runpy
_latent_entry_namespace = _latent_runpy.run_path(__latent_entry_path, run_name="__main__")
RESULT = _latent_entry_namespace.get(__latent_result_variable)
`);
        const result = JSON.parse(String(pyodide.runPython("import json; json.dumps(RESULT, allow_nan=False)")));
        const artifacts = artifactPaths.map((path) => {
          const data = pyodide.FS.readFile(`/workspace/${path}`, { encoding: "utf8" });
          return {
            path,
            mediaType: "application/json",
            encoding: "utf8",
            data,
            size: new TextEncoder().encode(data).byteLength,
          };
        });
        return {
          schemaVersion: 1,
          requestId: "real-run",
          kind: "run",
          status: "completed",
          durationMs: 0,
          result,
          artifacts,
        };
      } catch (error) {
        return {
          schemaVersion: 1,
          requestId: "real-run",
          kind: "run",
          status: "failed",
          durationMs: 0,
          result: null,
          artifacts: [],
          exception: { type: error?.name ?? "PythonError", message: String(error), traceback: String(error) },
        };
      } finally {
        pyodide.globals.delete("__latent_entry_path");
        pyodide.globals.delete("__latent_result_variable");
        pyodide.globals.delete("_latent_entry_namespace");
      }
    },
  };
  return pyodidePythonLab;
}

function replacePythonRegion(sourceText, pattern, replacement) {
  const next = sourceText.replace(pattern, replacement.trim());
  assert.notEqual(next, sourceText, `Expected Python source region ${pattern} to exist.`);
  return next;
}

function assertPythonParses(sourceText, label) {
  pyodide.globals.set("__latent_syntax_source", sourceText);
  try {
    pyodide.runPython("import ast; ast.parse(__latent_syntax_source); True");
  } catch (error) {
    assert.fail(`${label} must be valid Python: ${error}`);
  } finally {
    pyodide.globals.delete("__latent_syntax_source");
  }
}

function validPayload() {
  return {
    checkpoint: {
      version: 1,
      vocabulary: ["a", "b"],
      hiddenSize: 2,
      Wxh: [[0.1, 0.2], [0.3, 0.4]],
      Whh: [[0.1, 0], [0, 0.1]],
      Why: [[0.5, 0.6], [0.7, 0.8]],
      bh: [0, 0],
      by: [0, 0],
    },
    finalLoss: 0.5,
    parameters: 16,
    vocabularySize: 2,
  };
}

function passingPythonLab(payload = validPayload()) {
  const calls = [];
  const client = {
    async initialize(request, options) {
      calls.push(["initialize", request]);
      options.onEvent?.({ type: "stdout", requestId: "init", text: "Python ready\n" });
      return { schemaVersion: 1, runtime: "pyodide", runtimeVersion: "314.0.2", pythonVersion: "3.13", packages: ["numpy"], capabilityReduced: true };
    },
    async sync(request) {
      calls.push(["sync", request]);
      return { schemaVersion: 1, revision: 1, files: request.files.map((file) => file.path) };
    },
    async runTests(request) {
      calls.push(["tests", request]);
      return {
        schemaVersion: 1,
        requestId: "tests",
        kind: "tests",
        status: "completed",
        passed: true,
        durationMs: 4,
        tests: request.tests.map(({ id, label }) => ({ id, label, passed: true, durationMs: 1 })),
        artifacts: [],
      };
    },
    async run(request) {
      calls.push(["run", request]);
      return {
        schemaVersion: 1,
        requestId: "run",
        kind: "run",
        status: "completed",
        durationMs: 10,
        result: payload,
        artifacts: [{
          path: service.PYTHON_CHARACTER_RNN_ARTIFACT_PATH,
          mediaType: "application/json",
          encoding: "utf8",
          data: JSON.stringify(payload),
          size: JSON.stringify(payload).length,
        }],
      };
    },
  };
  return { calls, client };
}

test("the canonical project keeps one editable learner source while the trusted trainer remains host-owned", { timeout: 60_000 }, async () => {
  const manifestPath = course.llmSystemsCurriculum.lessonById["character-rnns"].projectPath;
  const seeds = canonical.completeCanonicalProjectSeeds({ version: 2, lessons: {}, artifacts: {} });
  const lessonSeeds = seeds.filter((seed) => seed.lessonId === "character-rnns");
  const python = lessonSeeds[0];
  assert.equal(manifestPath, source.PYTHON_CHARACTER_RNN_PATH);
  assert.match(manifestPath, /\.py$/);
  assert.equal(lessonSeeds.length, 1, "the lesson and trainable artifact share one canonical project file");
  assert.ok(python);
  assert.equal(python.path, manifestPath);
  assert.notEqual(python.readOnly, true);
  assert.notEqual(python.content, source.PYTHON_CHARACTER_RNN_SOURCE);
  assert.equal(python.referenceContent, source.PYTHON_CHARACTER_RNN_SOURCE);
  const lesson = course.getLesson("character-rnns");
  assert.ok(lesson);
  for (const block of lesson.implementation.codeBlocks) {
    assert.ok(block.starterCode, `${block.id} has course-authored guidance`);
    assert.match(python.content, new RegExp(block.starterCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(python.content, /# TODO:/);
  assert.match(python.content, /raise NotImplementedError\("Implement Recurrent transition\."\)/);
  assert.match(python.content, /def train_character_rnn/);
  assert.match(python.content, /np\.random\.default_rng\(19\)/);
  assert.equal(seeds.some((seed) => seed.lessonId === "character-rnns" && seed.path.endsWith(".js")), false);
  assert.equal(seeds.some((seed) => seed.path === service.PYTHON_CHARACTER_RNN_TRAINER_PATH), false);

  const pythonLab = await realPythonLab();
  assertPythonParses(python.content, "the Guided character RNN seed");
  assertPythonParses(python.referenceContent, "the authored character RNN reference");
  const initialRun = await service.runPythonCharacterRnnArtifact({ source: python.content, pythonLab });
  assert.equal(initialRun.passed, false);
  assert.equal(initialRun.artifact, undefined);
  assert.ok(initialRun.tests.some(({ passed }) => !passed));
  assert.match(
    initialRun.tests.filter(({ passed }) => !passed).map(({ detail }) => detail).join("\n"),
    /notimplemented|implement recurrent transition/i,
  );
});

test("Python bytes route to the CPython contract entry while remaining a JSON identity module", async () => {
  const pythonPath = course.llmSystemsCurriculum.lessonById["character-rnns"].projectPath;
  const files = {
    [pythonPath]: { path: pythonPath, content: "print('one')" },
    "runtime/helper.js": { path: "runtime/helper.js", content: "export const value = 1;" },
  };
  const prepared = snapshot.prepareProjectSnapshotFiles(files);
  const carrier = prepared.files.find((file) => file.path === pythonPath);
  assert.ok(carrier);
  assert.equal(carrier.loader, "json");
  assert.deepEqual(JSON.parse(carrier.contents), { path: pythonPath, contents: "print('one')" });
  assert.equal(prepared.entryPoints.includes(pythonPath), true, "the routed entry is dispatched to CPython, not the JavaScript compiler");
  assert.equal(prepared.failures.length, 0);
  assert.equal(prepared.files.find((file) => file.path === "runtime/helper.js").loader, "js");
  const first = await snapshot.hashProjectSnapshotSources(files);
  const second = await snapshot.hashProjectSnapshotSources({
    ...files,
    [pythonPath]: { path: pythonPath, content: "print('two')" },
  });
  assert.notEqual(first, second);
});

test("the host accepts only schema-compatible Python checkpoints", () => {
  const artifact = service.validatePythonCharacterRnnPayload(validPayload(), 123);
  assert.equal(artifact.origin, "python");
  assert.equal(artifact.trainedAt, 123);
  assert.equal(Object.isFrozen(artifact.checkpoint), true);
  assert.throws(
    () => service.validatePythonCharacterRnnPayload({ ...validPayload(), parameters: 15 }),
    /parameter count/i,
  );
  assert.throws(
    () => service.validatePythonCharacterRnnPayload({ ...validPayload(), checkpoint: { ...validPayload().checkpoint, Wxh: [] } }),
    /Wxh/i,
  );
  assert.throws(
    () => service.validatePythonCharacterRnnPayload({ ...validPayload(), finalLoss: Math.log(2) }),
    /uniform/i,
  );
  const zeroCheckpoint = validPayload().checkpoint;
  for (const key of ["Wxh", "Whh", "Why"]) zeroCheckpoint[key] = zeroCheckpoint[key].map((row) => row.map(() => 0));
  assert.throws(
    () => service.validatePythonCharacterRnnPayload({ ...validPayload(), checkpoint: zeroCheckpoint }),
    /aren’t all zero/i,
  );
});

test("the service syncs saved source, runs four hidden tests, and validates emitted JSON", async () => {
  const fake = passingPythonLab();
  const result = await service.runPythonCharacterRnnArtifact({
    source: source.PYTHON_CHARACTER_RNN_SOURCE,
    pythonLab: fake.client,
  });
  assert.equal(result.passed, true);
  assert.equal(result.tests.length, 4);
  assert.equal(result.tests.every((entry) => entry.passed), true);
  assert.equal(result.artifact.origin, "python");
  assert.equal(result.stdout, "Python ready\n");
  assert.deepEqual(fake.calls.map(([kind]) => kind), ["initialize", "sync", "tests", "sync", "run"]);
  assert.deepEqual(
    fake.calls[1][1].files.map((file) => file.path),
    [source.PYTHON_CHARACTER_RNN_PATH, service.PYTHON_CHARACTER_RNN_TRAINER_PATH],
  );
  assert.match(fake.calls[1][1].files[1].contents, /_latent_learner_function\("rnn_step"\)/);
  assert.notEqual(fake.calls[1][1].files[1].contents, source.PYTHON_CHARACTER_RNN_SOURCE);
  assert.equal(fake.calls[2][1].tests.length, 4);
  assert.deepEqual(fake.calls[3][1].files.map((file) => file.path), [service.PYTHON_CHARACTER_RNN_TRAINER_PATH]);
  assert.deepEqual(fake.calls[3][1].deletePaths, [service.PYTHON_CHARACTER_RNN_ARTIFACT_PATH]);
  assert.equal(fake.calls[4][1].entryPath, service.PYTHON_CHARACTER_RNN_TRAINER_PATH);
  assert.equal(fake.calls[4][1].artifactPaths[0], service.PYTHON_CHARACTER_RNN_ARTIFACT_PATH);
});

test("the trusted trainer admits the shipped source and rejects or ignores learner shortcuts in real Pyodide", { timeout: 60_000 }, async () => {
  const pythonLab = await realPythonLab();
  const reference = source.PYTHON_CHARACTER_RNN_SOURCE;
  const shipped = await service.runPythonCharacterRnnArtifact({ source: reference, pythonLab });
  assert.equal(
    shipped.passed,
    true,
    shipped.tests.map((entry) => `${entry.id}: ${entry.detail}`).join("\n"),
  );
  assert.ok(shipped.artifact);
  assert.equal(shipped.artifact.checkpoint.hiddenSize, 12);
  assert.equal(shipped.artifact.checkpoint.vocabulary.length, shipped.artifact.vocabularySize);

  const diagonalOnly = replacePythonRegion(
    reference,
    /def rnn_step[\s\S]*?(?=\n\n# 02 · Cross-entropy loss)/,
    `def rnn_step(input_vector, previous, parameters):
    Wxh = np.asarray(parameters["Wxh"], dtype=float)
    Whh = np.asarray(parameters["Whh"], dtype=float)
    bias = np.asarray(parameters["bias"], dtype=float)
    inputs = np.asarray(input_vector, dtype=float)
    state = np.asarray(previous, dtype=float)
    return np.tanh(np.diag(Wxh) * inputs + np.diag(Whh) * state + bias).tolist()`,
  );
  const diagonalRun = await service.runPythonCharacterRnnArtifact({ source: diagonalOnly, pythonLab });
  assert.equal(diagonalRun.passed, false);
  assert.equal(diagonalRun.artifact, undefined);
  assert.equal(diagonalRun.tests.find((entry) => entry.id === "rnn-step")?.passed, false);
  assert.match(diagonalRun.tests.find((entry) => entry.id === "rnn-step")?.detail ?? "", /matrix column|projection/i);

  const forgedTrainer = replacePythonRegion(
    reference,
    /def train_character_rnn[\s\S]*?(?=\n\n\nRESULT = None)/,
    `def train_character_rnn(steps=180):
    checkpoint = {
        "version": 1,
        "vocabulary": ["a", "b"],
        "hiddenSize": 2,
        "Wxh": [[0.1, 0.2], [0.3, 0.4]],
        "Whh": [[0.1, 0.0], [0.0, 0.1]],
        "Why": [[0.5, 0.6], [0.7, 0.8]],
        "bh": [0.0, 0.0],
        "by": [0.0, 0.0],
    }
    return {"checkpoint": checkpoint, "finalLoss": 0.1, "parameters": 16, "vocabularySize": 2}`,
  );
  const forgedRun = await service.runPythonCharacterRnnArtifact({ source: forgedTrainer, pythonLab });
  assert.equal(
    forgedRun.passed,
    true,
    forgedRun.tests.map((entry) => `${entry.id}: ${entry.detail}`).join("\n"),
  );
  assert.ok(forgedRun.artifact);
  assert.equal(forgedRun.artifact.checkpoint.hiddenSize, 12, "the trusted trainer, not the forged learner trainer, owns the checkpoint");
  assert.notDeepEqual(forgedRun.artifact.checkpoint.vocabulary, ["a", "b"]);
  assert.notEqual(forgedRun.artifact.finalLoss, 0.1);

  const overwriteCounterPath = "/workspace/.latent-trainer-overwrite-count";
  try { pyodide.FS.unlink(overwriteCounterPath); } catch {}
  const forgedEntrypoint = `import json
from pathlib import Path
RESULT = {
    "checkpoint": {
        "version": 1,
        "vocabulary": ["a", "b"],
        "hiddenSize": 2,
        "Wxh": [[0.1, 0.2], [0.3, 0.4]],
        "Whh": [[0.1, 0.0], [0.0, 0.1]],
        "Why": [[0.5, 0.6], [0.7, 0.8]],
        "bh": [0.0, 0.0],
        "by": [0.0, 0.0],
    },
    "finalLoss": 0.1,
    "parameters": 16,
    "vocabularySize": 2,
}
artifact_path = Path("artifacts/character-rnn.json")
artifact_path.parent.mkdir(parents=True, exist_ok=True)
artifact_path.write_text(json.dumps(RESULT), encoding="utf-8")`;
  const overwriteTrustedTrainer = reference.replace(
    "import numpy as np\n",
    `import numpy as np
from pathlib import Path as _latent_Path
_latent_counter_path = _latent_Path(${JSON.stringify(overwriteCounterPath)})
_latent_counter = int(_latent_counter_path.read_text()) + 1 if _latent_counter_path.exists() else 1
_latent_counter_path.write_text(str(_latent_counter))
if _latent_counter >= 4:
    _latent_Path(${JSON.stringify(service.PYTHON_CHARACTER_RNN_TRAINER_PATH)}).write_text(${JSON.stringify(forgedEntrypoint)}, encoding="utf-8")
`,
  );
  assert.notEqual(overwriteTrustedTrainer, reference);
  const overwriteRun = await service.runPythonCharacterRnnArtifact({ source: overwriteTrustedTrainer, pythonLab });
  assert.equal(
    overwriteRun.passed,
    true,
    overwriteRun.tests.map((entry) => `${entry.id}: ${entry.detail}`).join("\n"),
  );
  assert.equal(overwriteRun.artifact?.checkpoint.hiddenSize, 12, "the host must restore its trainer after learner-controlled hidden tests");
  assert.notDeepEqual(overwriteRun.artifact?.checkpoint.vocabulary, ["a", "b"]);

  const wrongAttempts = [
    {
      label: "recurrent state ignored",
      testId: "rnn-step",
      source: replacePythonRegion(
        reference,
        /def rnn_step[\s\S]*?(?=\n\n# 02 · Cross-entropy loss)/,
        `def rnn_step(input_vector, previous, parameters):
    Wxh = np.asarray(parameters["Wxh"], dtype=float)
    bias = np.asarray(parameters["bias"], dtype=float)
    return np.tanh(Wxh @ np.asarray(input_vector, dtype=float) + bias).tolist()`,
      ),
    },
    {
      label: "probability returned instead of cross-entropy",
      testId: "cross-entropy",
      source: replacePythonRegion(
        reference,
        /def cross_entropy[\s\S]*?(?=\n\n# 03 · Gradient clipping)/,
        `def cross_entropy(probabilities, target_index):
    return float(probabilities[target_index])`,
      ),
    },
    {
      label: "gradients returned without clipping",
      testId: "clip-gradients",
      source: replacePythonRegion(
        reference,
        /def clip_gradients[\s\S]*?(?=\n\nimport json)/,
        `def clip_gradients(gradients, limit=5):
    return np.asarray(gradients, dtype=float)`,
      ),
    },
  ];
  for (const attempt of wrongAttempts) {
    const result = await service.runPythonCharacterRnnArtifact({ source: attempt.source, pythonLab });
    assert.equal(result.passed, false, attempt.label);
    assert.equal(result.artifact, undefined, attempt.label);
    assert.equal(result.tests.find((entry) => entry.id === attempt.testId)?.passed, false, attempt.label);
  }
});

test("save admits a full-pass checkpoint and preserves Python provenance durably", async () => {
  const fake = passingPythonLab();
  const result = await service.savePythonCharacterRnnArtifact({
    source: source.PYTHON_CHARACTER_RNN_SOURCE,
    pythonLab: fake.client,
    initialize: false,
  });
  assert.equal(result.passed, true);
  assert.equal(learner.loadLearnerState().artifacts.characterRnn.origin, "python");
  assert.deepEqual(fake.calls.map(([kind]) => kind), ["sync", "tests", "sync", "run"]);
  await learner.flushLearnerPersistence();
  const { database } = await client.getPersistenceContext();
  const checkpoints = await database.checkpoints.where("projectId").equals("browser-chat").toArray();
  const checkpoint = checkpoints.find((record) => record.createdAt === result.artifact.trainedAt);
  assert.ok(checkpoint);
  assert.equal(checkpoint.metrics.pythonOrigin, 1);
  assert.equal(checkpoint.origin, "python");
  assert.equal(checkpoint.sourcePath, source.PYTHON_CHARACTER_RNN_PATH);
  assert.equal(checkpoint.sourceHash, await persistence.hashText(source.PYTHON_CHARACTER_RNN_SOURCE));
  assert.equal(checkpoint.importedFrom, undefined);
  assert.equal(learner.loadLearnerState().artifacts.characterRnn.checkpointId, checkpoint.id);
  const pythonArtifact = learner.loadLearnerState().artifacts.characterRnn;
  learner.saveCharacterRnnArtifact({
    checkpoint: pythonArtifact.checkpoint,
    finalLoss: pythonArtifact.finalLoss,
    parameters: pythonArtifact.parameters,
    vocabularySize: pythonArtifact.vocabularySize,
  }, "javascript", pythonArtifact.trainedAt + 1);
  assert.equal(
    learner.loadLearnerState().artifacts.characterRnn.checkpointId,
    checkpoint.id,
    "rerunning the disposable JavaScript lesson demo must not hide a source-bound Python checkpoint",
  );
});

test("the existing student backend visibly identifies and samples the Python checkpoint", async () => {
  const capstone = await readFile(new URL("../app/components/BrowserChatCapstone.tsx", import.meta.url), "utf8");
  assert.match(capstone, /student\.origin === "python"/);
  assert.match(capstone, /Python \+ NumPy checkpoint/);
  assert.match(capstone, /sampleCharacterRnn\(student\.checkpoint/);
});

test("a hidden-test failure prevents training and artifact admission", async () => {
  const fake = passingPythonLab();
  fake.client.runTests = async (request) => ({
    schemaVersion: 1,
    requestId: "tests",
    kind: "tests",
    status: "completed",
    passed: false,
    durationMs: 4,
    tests: request.tests.map(({ id, label }) => ({
      id,
      label,
      passed: id !== "cross-entropy",
      durationMs: 1,
      ...(id === "cross-entropy" ? { exception: { type: "AssertionError", message: "Use the observed target probability.", traceback: "" } } : {}),
    })),
    artifacts: [],
  });
  const result = await service.runPythonCharacterRnnArtifact({ source: "def broken(): pass", pythonLab: fake.client });
  assert.equal(result.passed, false);
  assert.equal(result.artifact, undefined);
  assert.match(result.tests.find((entry) => entry.id === "cross-entropy").detail, /observed target/i);
  assert.equal(fake.calls.some(([kind]) => kind === "run"), false);
});

test("a full-training exception preserves its Python traceback", async () => {
  const fake = passingPythonLab();
  fake.client.run = async () => ({
    schemaVersion: 1,
    requestId: "run",
    kind: "run",
    status: "failed",
    durationMs: 2,
    result: null,
    artifacts: [],
    exception: {
      type: "ValueError",
      message: "gradient became invalid",
      traceback: "Traceback (most recent call last):\n  File models/character-rnn.py\nValueError: gradient became invalid",
    },
  });
  const result = await service.runPythonCharacterRnnArtifact({ source: source.PYTHON_CHARACTER_RNN_SOURCE, pythonLab: fake.client });
  assert.equal(result.passed, false);
  assert.match(result.tests.find((entry) => entry.id === "artifact-schema").detail, /ValueError: gradient became invalid/);
  assert.match(result.traceback, /models\/character-rnn\.py/);
});

test("mismatched emitted JSON fails the host-owned artifact check", async () => {
  const fake = passingPythonLab();
  const originalRun = fake.client.run;
  fake.client.run = async (request) => {
    const result = await originalRun(request);
    result.artifacts[0].data = JSON.stringify({ ...validPayload(), finalLoss: 0.6 });
    return result;
  };
  const result = await service.runPythonCharacterRnnArtifact({ source: source.PYTHON_CHARACTER_RNN_SOURCE, pythonLab: fake.client });
  assert.equal(result.passed, false);
  assert.equal(result.tests.find((entry) => entry.id === "artifact-schema").passed, false);
  assert.match(result.tests.find((entry) => entry.id === "artifact-schema").detail, /match the checkpoint JSON/i);
});
