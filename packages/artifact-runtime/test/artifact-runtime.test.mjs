import assert from "node:assert/strict";
import { test } from "node:test";
import "fake-indexeddb/auto";
import * as runtime from "../dist/index.js";
import * as core from "../dist/core.js";
import * as portable from "../dist/portable.js";
import * as storage from "../dist/store.js";

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
    replay: {
      clock: "step",
      unit: "update",
      frames: [{ index: 0, at: 0, label: "Start", payload: { value: 1 }, metrics: { loss: 2 } }],
    },
    ...overrides,
  };
}

test("explicit package seams expose the preserved runtime API", () => {
  assert.equal(runtime.createArtifact, core.createArtifact);
  assert.equal(runtime.createArtifactBundle, portable.createArtifactBundle);
  assert.equal(runtime.ArtifactStore, storage.ArtifactStore);
  assert.equal(runtime.ARTIFACT_SCHEMA_VERSION, 1);
});

test("artifacts remain content-addressed, tamper-evident, comparable, and replayable", async () => {
  const first = await core.createArtifact(artifactInput({ createdAt: 10 }));
  const repeated = await core.createArtifact(artifactInput({ createdAt: 20 }));
  assert.equal(first.id, repeated.id);
  assert.equal(first.contentHash, repeated.contentHash);
  await core.assertArtifactEnvelope(first);

  const tampered = structuredClone(first);
  tampered.payload.value = 2;
  await assert.rejects(core.assertArtifactEnvelope(tampered), /tampered/i);

  const second = await core.createArtifact(artifactInput({
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

  const comparison = core.compareArtifacts(first, second);
  assert.equal(comparison.metrics.find((metric) => metric.key === "loss").delta, -0.75);
  assert.deepEqual(comparison.changedPayloadPaths, ["$.nested.state"]);
  const cursor = new core.ArtifactReplayCursor(second.replay);
  assert.equal(cursor.frame.label, "Start");
  assert.equal(cursor.next().label, "Finish");
  assert.equal(cursor.progress, 1);
});

test("portable bundles reject incomplete lineage", async () => {
  const parent = await core.createArtifact(artifactInput({ kind: "input", title: "Input artifact", lessonId: "one", createdAt: 10 }));
  const child = await core.createArtifact(artifactInput({
    kind: "output",
    title: "Output artifact",
    lessonId: "two",
    createdAt: 20,
    links: [{ artifactId: parent.id, contentHash: parent.contentHash, kind: parent.kind, relation: "input" }],
  }));

  await assert.rejects(portable.createArtifactBundle(child.id, [child]), /incomplete/i);
  const bundle = await portable.createArtifactBundle(child.id, [child, parent]);
  const parsed = await portable.parseArtifactBundle(portable.serializeArtifactBundle(bundle));
  assert.equal(parsed.rootArtifactId, child.id);
  assert.deepEqual(parsed.artifacts.map((artifact) => artifact.id), [parent.id, child.id]);
});

test("the Dexie seam stores immutable lineage and round-trips portable bundles", async () => {
  const database = new storage.ArtifactRuntimeDatabase(`artifact-package-test-${crypto.randomUUID()}`);
  const destination = new storage.ArtifactRuntimeDatabase(`artifact-package-destination-${crypto.randomUUID()}`);
  await database.open();
  await destination.open();

  try {
    const store = new storage.ArtifactStore(database);
    const parent = await core.createArtifact(artifactInput({ kind: "input", title: "Input artifact", lessonId: "one" }));
    const child = await core.createArtifact(artifactInput({
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

    const serialized = portable.serializeArtifactBundle(await store.bundle(child.id));
    const destinationStore = new storage.ArtifactStore(destination);
    await destinationStore.import(serialized);
    assert.equal((await destinationStore.get(child.id)).contentHash, child.contentHash);
  } finally {
    database.close();
    destination.close();
    await database.delete();
    await destination.delete();
  }
});
