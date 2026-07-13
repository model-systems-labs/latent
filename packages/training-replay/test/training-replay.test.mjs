import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RecordedTrainingRegistry,
  RecordedTrainingValidationError,
  assertRecordedTrainingDocument,
  materializeRecordedTraining,
  trainingCheckpointView,
} from "../dist/index.js";

class MemoryRepository {
  artifacts = new Map();
  async put(artifact) {
    const existing = this.artifacts.get(artifact.id);
    if (existing && existing.contentHash !== artifact.contentHash) throw new Error("Immutable artifact conflict.");
    this.artifacts.set(artifact.id, existing ?? artifact);
    return this.artifacts.get(artifact.id);
  }
}

function recording(overrides = {}) {
  return {
    format: "latent-recorded-training",
    version: 1,
    recordedAt: "2026-07-12T00:00:00.000Z",
    producer: { runtime: "test-trainer", version: "1" },
    dataset: { name: "Tiny corpus" },
    config: { seed: 7 },
    checkpoints: [
      { step: 10, metrics: { loss: 2.4, parameters: 12 }, traces: { loss: [3, 2.4] }, outputs: { sample: "rough" }, state: { weights: [1, 2] } },
      { step: 20, metrics: { loss: 1.2, parameters: 12 }, traces: { loss: [3, 2.4, 1.2] }, outputs: { sample: "clear" }, state: { weights: [2, 3] } },
    ],
    ...overrides,
  };
}

const scenario = {
  id: "tiny-model",
  projectId: "test-project",
  moduleId: "model",
  lessonId: "tiny-training",
  primaryMetricKey: "loss",
  checkpoint: {
    kind: "model-checkpoint",
    title: "Tiny model",
    description: "A real checkpoint from the deterministic test trainer.",
    payloadFormat: "tiny-model-checkpoint",
    labels: ["tiny-model"],
  },
  run: {
    kind: "training-run",
    title: "Tiny model training replay",
    description: "A deterministic training replay used by package tests.",
    labels: ["tiny-model"],
    metrics: { parameters: { checkpoint: "last", metric: "parameters" } },
  },
  replay: { unit: "optimizer update", stepLabel: "updates" },
};

const presentation = {
  checkpointEyebrow: "Actual checkpoint state",
  metrics: [
    { id: "loss", key: "loss", label: "Loss", format: { kind: "decimal", digits: 2 } },
    { id: "change", key: "loss", label: "Change", format: { kind: "decimal", digits: 2 }, comparison: true },
    { id: "parameters", key: "parameters", label: "Parameters", format: { kind: "integer" } },
  ],
  traceKey: "loss",
  traceLabel: "Recorded loss trace",
  output: { key: "sample", label: "Generated sample" },
  disclosure: "Time is replayed; values come from the recorded run.",
};

test("recordings are normalized and reject unsafe or misleading structures", () => {
  const normalized = assertRecordedTrainingDocument(recording());
  assert.equal(normalized.checkpoints.length, 2);
  assert.equal(Object.isFrozen(normalized.checkpoints[0].state), true);
  assert.throws(() => { normalized.checkpoints[0].metrics.loss = 10; }, TypeError);
  assert.throws(() => assertRecordedTrainingDocument(recording({ checkpoints: [
    recording().checkpoints[1],
    recording().checkpoints[0],
  ] })), /strictly increasing/i);
  assert.throws(() => assertRecordedTrainingDocument(recording({ checkpoints: [
    recording().checkpoints[0],
    { ...recording().checkpoints[1], metrics: { loss: Number.NaN } },
  ] })), RecordedTrainingValidationError);
});

test("model-neutral recordings materialize immutable checkpoint lineage and a run", async () => {
  const repository = new MemoryRepository();
  const replay = await materializeRecordedTraining({ recording: recording(), scenario, presentation, repository });
  assert.equal(replay.checkpoints.length, 2);
  assert.equal(replay.checkpoints[1].links[0].artifactId, replay.checkpoints[0].id);
  assert.deepEqual(replay.run.links.map((item) => item.artifactId), replay.checkpoints.map((item) => item.id));
  assert.equal(replay.run.metrics.initialPrimaryMetric, 2.4);
  assert.equal(replay.run.metrics.finalPrimaryMetric, 1.2);
  assert.equal(replay.run.replay.frames[1].metrics.loss, 1.2);
  assert.equal(repository.artifacts.size, 3);

  const repeated = await materializeRecordedTraining({ recording: recording(), scenario, presentation, repository });
  assert.equal(repeated.run.id, replay.run.id);
  assert.equal(repository.artifacts.size, 3);
});

test("presentation view models keep model-specific field knowledge out of React", async () => {
  const replay = await materializeRecordedTraining({ recording: recording(), scenario, presentation, repository: new MemoryRepository() });
  const first = trainingCheckpointView(replay, 0);
  const second = trainingCheckpointView(replay, 1);
  assert.equal(first.metrics.find((metric) => metric.id === "change").display, "—");
  assert.equal(second.metrics.find((metric) => metric.id === "change").display, "-1.20");
  assert.equal(second.metrics.find((metric) => metric.id === "parameters").display, "12");
  assert.equal(second.output.text, "clear");
  assert.deepEqual(second.trace.values, [3, 2.4, 1.2]);
});

test("the lazy registry owns uniqueness, caching, retry, and lesson lookup", async () => {
  let loads = 0;
  const mutableScenario = structuredClone(scenario);
  const registry = new RecordedTrainingRegistry().register({
    scenario: mutableScenario,
    presentation,
    loadRecording: async () => { loads += 1; return recording(); },
  });
  assert.equal(registry.scenarioIdForLesson("tiny-training"), "tiny-model");
  mutableScenario.checkpoint.labels.push("mutated-after-registration");
  assert.equal(registry.list()[0].scenario.checkpoint.labels.includes("mutated-after-registration"), false);
  const repository = new MemoryRepository();
  await registry.materializeForLesson("tiny-training", repository);
  await registry.materialize("tiny-model", repository);
  assert.equal(loads, 1);
  assert.equal(await registry.materializeForLesson("unregistered", repository), null);
  assert.throws(() => registry.register({ scenario, presentation, loadRecording: async () => recording() }), /already registered/i);

  let attempts = 0;
  const retryScenario = { ...scenario, id: "retry-model", lessonId: "retry-training" };
  const retryRegistry = new RecordedTrainingRegistry().register({
    scenario: retryScenario,
    presentation,
    loadRecording: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("Temporary recording failure");
      return recording();
    },
  });
  await assert.rejects(retryRegistry.materialize("retry-model", new MemoryRepository()), /temporary/i);
  await retryRegistry.materialize("retry-model", new MemoryRepository());
  assert.equal(attempts, 2);
});

test("scenario compatibility rejects absent metrics, traces, and text outputs", async () => {
  const invalid = recording();
  delete invalid.checkpoints[1].outputs.sample;
  await assert.rejects(
    materializeRecordedTraining({ recording: invalid, scenario, presentation, repository: new MemoryRepository() }),
    /output sample must be text/i,
  );
});
