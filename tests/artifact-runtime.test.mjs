import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";
import { createServer } from "vite";

globalThis.window ??= {};

const vite = await createServer({
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: false,
  logLevel: "silent",
  server: { middlewareMode: true },
  appType: "custom",
});
const runtime = await vite.ssrLoadModule("/packages/artifact-runtime/src/index.ts");
const blueprints = await vite.ssrLoadModule("/app/features/artifacts/lesson-blueprints.ts");
const training = await vite.ssrLoadModule("/app/features/artifacts/training-scenarios/index.ts");
const artifactService = await vite.ssrLoadModule("/app/features/artifacts/lesson-artifacts.ts");
const artifactClient = await vite.ssrLoadModule("/packages/artifact-runtime/src/client.ts");
const contracts = await vite.ssrLoadModule("/examples/learning-platform/llm-learning/content/llm-systems/contracts.ts");
const manifest = await vite.ssrLoadModule("/examples/learning-platform/llm-learning/content/llm-systems/manifest.ts");

after(async () => {
  await vite.close();
});

function artifactInput(overrides = {}) {
  return {
    kind: "test-artifact",
    mode: "learner-validated",
    title: "Validated test artifact",
    description: "A deterministic artifact used to verify the independent runtime.",
    projectId: "test-project",
    moduleId: "test-module",
    lessonId: "test-lesson",
    producer: { runtime: "test", version: "1", operation: "verify", sourceHash: "sha256:source" },
    validation: { status: "passed", passedCount: 1, totalCount: 1 },
    labels: ["test"],
    links: [],
    metrics: { loss: 2, steps: 1 },
    payload: { value: 1, nested: { state: "before" } },
    replay: { clock: "step", unit: "update", frames: [{ index: 0, at: 0, label: "Start", payload: { value: 1 }, metrics: { loss: 2 } }] },
    ...overrides,
  };
}

test("artifacts are content-addressed, tamper-evident, comparable, and replayable", async () => {
  const first = await runtime.createArtifact(artifactInput({ createdAt: 10 }));
  const repeated = await runtime.createArtifact(artifactInput({ createdAt: 20 }));
  assert.equal(first.id, repeated.id);
  assert.equal(first.contentHash, repeated.contentHash);
  await runtime.assertArtifactEnvelope(first);

  const tampered = structuredClone(first);
  tampered.payload.value = 2;
  await assert.rejects(runtime.assertArtifactEnvelope(tampered), /tampered/i);

  const second = await runtime.createArtifact(artifactInput({
    metrics: { loss: 1.25, steps: 2 },
    payload: { value: 1, nested: { state: "after" } },
    replay: {
      clock: "step",
      unit: "update",
      frames: [
        { index: 0, at: 0, label: "Start", payload: { value: 1 }, metrics: { loss: 2 } },
        { index: 1, at: 1, label: "Finish", payload: { value: 2 }, metrics: { loss: 1.25 } },
      ],
    },
  }));
  const comparison = runtime.compareArtifacts(first, second);
  assert.equal(comparison.metrics.find((metric) => metric.key === "loss").delta, -0.75);
  assert.deepEqual(comparison.changedPayloadPaths, ["$.nested.state"]);
  const cursor = new runtime.ArtifactReplayCursor(second.replay);
  assert.equal(cursor.frame.label, "Start");
  assert.equal(cursor.next().label, "Finish");
  assert.equal(cursor.progress, 1);
});

test("the Dexie adapter stores immutable lineage and round-trips portable bundles", async () => {
  const database = new runtime.ArtifactRuntimeDatabase(`artifact-test-${crypto.randomUUID()}`);
  await database.open();
  const store = new runtime.ArtifactStore(database);
  const parent = await runtime.createArtifact(artifactInput({ kind: "input", title: "Input artifact", lessonId: "one" }));
  const child = await runtime.createArtifact(artifactInput({
    kind: "output",
    title: "Output artifact",
    lessonId: "two",
    links: [{ artifactId: parent.id, contentHash: parent.contentHash, kind: parent.kind, relation: "input" }],
  }));
  await store.put(parent);
  await store.put(child);
  await store.activate(child, "lesson-output", "two");
  assert.equal((await store.latestForLesson("two", "test-project")).id, child.id);
  assert.equal((await store.lineage(child.id)).length, 2);
  const bundle = await store.bundle(child.id);
  const serialized = runtime.serializeArtifactBundle(bundle);
  const parsed = await runtime.parseArtifactBundle(serialized);
  assert.equal(parsed.rootArtifactId, child.id);
  assert.equal(parsed.artifacts.length, 2);

  const destination = new runtime.ArtifactRuntimeDatabase(`artifact-test-${crypto.randomUUID()}`);
  await destination.open();
  const destinationStore = new runtime.ArtifactStore(destination);
  await destinationStore.import(serialized);
  assert.equal((await destinationStore.get(child.id)).contentHash, child.contentHash);
  database.close();
  destination.close();
  await database.delete();
  await destination.delete();
});

test("validated lesson activation restores the prior head when source changes during promotion", async () => {
  await artifactClient.closeArtifactRuntime();
  const cleanDatabase = new runtime.ArtifactRuntimeDatabase(runtime.DEFAULT_ARTIFACT_DATABASE_NAME);
  await cleanDatabase.delete();

  const passing = [{ id: "character-rnns/rnn-step", label: "Recurrent transition", passed: true, detail: "Host-owned assertions passed." }];
  const previous = await artifactService.recordValidatedLessonArtifact({
    lessonId: "character-rnns",
    source: "# previously validated source",
    results: passing,
    isSourceCurrent: () => true,
  });

  let activationChecks = 0;
  await assert.rejects(
    artifactService.recordValidatedLessonArtifact({
      lessonId: "character-rnns",
      source: "# source superseded in another tab",
      results: passing,
      isSourceCurrent: () => ++activationChecks === 1,
    }),
    /source is no longer current/i,
  );

  const { store } = await artifactClient.getArtifactRuntime();
  assert.equal(activationChecks, 2, "activation must guard both sides of the head update");
  assert.equal((await store.latestForLesson("character-rnns")).id, previous.id, "the superseded source must never remain active");

  await artifactClient.closeArtifactRuntime();
  const database = new runtime.ArtifactRuntimeDatabase(runtime.DEFAULT_ARTIFACT_DATABASE_NAME);
  await database.delete();
});

test("the registered training scenario exposes real checkpoint state and improving samples", async () => {
  const database = new runtime.ArtifactRuntimeDatabase(`training-test-${crypto.randomUUID()}`);
  await database.open();
  const store = new runtime.ArtifactStore(database);
  const result = await training.recordedTrainingRegistry.materializeForLesson("character-rnns", store);
  assert.ok(result);
  assert.deepEqual(result.checkpoints.map((artifact) => artifact.metrics.step), [20, 100, 300, 600]);
  assert.equal(result.run.replay.frames.length, 4);
  assert.ok(result.checkpoints[0].metrics.finalLoss > result.checkpoints.at(-1).metrics.finalLoss);
  assert.equal(result.checkpoints.every((artifact) => artifact.metrics.parameters === 1267), true);
  assert.notEqual(result.recording.checkpoints[0].outputs.sample, result.recording.checkpoints.at(-1).outputs.sample);
  assert.equal(Array.isArray(result.recording.checkpoints.at(-1).state.Wxh), true);
  assert.equal((await store.bundle(result.run.id)).artifacts.length, 5);
  database.close();
  await database.delete();
});

test("every curriculum lesson has one ordered artifact adapter", () => {
  const lessons = manifest.llmSystemsManifest.modules.flatMap((module) => module.lessons);
  assert.equal(blueprints.lessonArtifactBlueprints.length, lessons.length);
  assert.deepEqual(blueprints.lessonArtifactBlueprints.map((blueprint) => blueprint.lessonId), lessons.map((lesson) => lesson.lessonId));
  assert.equal(new Set(blueprints.lessonArtifactBlueprints.map((blueprint) => blueprint.projectPath)).size, lessons.length);
  assert.equal(blueprints.previousArtifactLessonId(lessons[0].lessonId), null);
  assert.equal(blueprints.previousArtifactLessonId(lessons[1].lessonId), lessons[0].lessonId);
});

test("a passing project run creates the complete lesson lineage and build artifact", async () => {
  const files = Object.fromEntries(blueprints.lessonArtifactBlueprints.map((blueprint) => [blueprint.projectPath, { content: `// validated ${blueprint.lessonId}` }]));
  const results = contracts.llmSystemsContractSuite.contracts.map((contract) => ({
    id: contract.id,
    path: contract.cases[0].invoke.modulePath,
    label: contract.label,
    passed: true,
    detail: "Host-owned assertions passed.",
  }));
  const artifacts = await artifactService.recordValidatedProjectLessonArtifacts(files, results);
  assert.equal(artifacts.length, blueprints.lessonArtifactBlueprints.length);
  assert.equal(artifacts[0].links[0].kind, "training-run");
  assert.equal(artifacts.at(-1).links[0].artifactId, artifacts.at(-2).id);
  const build = await artifactService.recordProjectBuildArtifact({
    buildId: "build:test",
    buildNumber: 1,
    sourceTreeHash: "sha256:project",
    testedModules: artifacts.length,
    totalTests: results.length,
  });
  assert.equal(build.links.length, artifacts.length);
  assert.equal(build.replay.frames.length, artifacts.length);
  assert.equal((await artifactService.latestProjectBuildArtifact()).id, build.id);
  const { store } = await artifactClient.getArtifactRuntime();
  const bundle = await store.bundle(build.id);
  assert.equal(bundle.artifacts.length, artifacts.length + 6);
  const serialized = runtime.serializeArtifactBundle(bundle);
  assert.ok(serialized.length > 100_000 && serialized.length < 1_000_000);
  assert.equal((await runtime.parseArtifactBundle(serialized)).rootArtifactId, build.id);
  await artifactClient.closeArtifactRuntime();
  const database = new runtime.ArtifactRuntimeDatabase(runtime.DEFAULT_ARTIFACT_DATABASE_NAME);
  await database.delete();
});
