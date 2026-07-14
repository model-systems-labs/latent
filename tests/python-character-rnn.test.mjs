import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";
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
    vite.ssrLoadModule("/app/lessons/course.ts"),
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
  await vite?.close();
});

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

test("the canonical project uses one editable manifest-owned Python source for the lesson and trainer", () => {
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
  assert.equal(python.content, source.PYTHON_CHARACTER_RNN_SOURCE);
  assert.equal(python.referenceContent, source.PYTHON_CHARACTER_RNN_SOURCE);
  assert.match(python.content, /def train_character_rnn/);
  assert.match(python.content, /np\.random\.default_rng\(19\)/);
  assert.equal(seeds.some((seed) => seed.lessonId === "character-rnns" && seed.path.endsWith(".js")), false);
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
    /parameters/i,
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
    /non-zero/i,
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
  assert.deepEqual(fake.calls.map(([kind]) => kind), ["initialize", "sync", "tests", "run"]);
  assert.equal(fake.calls[1][1].files[0].path, source.PYTHON_CHARACTER_RNN_PATH);
  assert.equal(fake.calls[2][1].tests.length, 4);
  assert.equal(fake.calls[3][1].artifactPaths[0], service.PYTHON_CHARACTER_RNN_ARTIFACT_PATH);
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
  assert.deepEqual(fake.calls.map(([kind]) => kind), ["sync", "tests", "run"]);
  await learner.flushLearnerPersistence();
  const { database } = await client.getPersistenceContext();
  const checkpoints = await database.checkpoints.where("projectId").equals("browser-chat").toArray();
  const checkpoint = checkpoints.find((record) => record.createdAt === result.artifact.trainedAt);
  assert.ok(checkpoint);
  assert.equal(checkpoint.metrics.pythonOrigin, 1);
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
  assert.match(result.tests.find((entry) => entry.id === "artifact-schema").detail, /do not match/i);
});
