import recordedTraining from "./recorded/character-rnn-training.json";
import { createArtifact, type ArtifactEnvelope, type ArtifactJson, type ArtifactStore } from "@latent/artifact-runtime";

type RecordedCheckpoint = {
  steps: number;
  initialLoss: number;
  finalLoss: number;
  parameters: number;
  vocabularySize: number;
  lossTrace: number[];
  sample: string;
  checkpoint: ArtifactJson;
};

const recording = recordedTraining as unknown as {
  format: string;
  version: number;
  recordedAt: string;
  trainer: string;
  dataset: ArtifactJson;
  config: ArtifactJson;
  checkpoints: RecordedCheckpoint[];
};

export type RecordedTrainingArtifacts = {
  run: ArtifactEnvelope;
  checkpoints: ArtifactEnvelope[];
};

export async function ensureRecordedTrainingArtifacts(store: ArtifactStore): Promise<RecordedTrainingArtifacts> {
  if (recording.format !== "latent-recorded-training" || recording.version !== 1 || recording.checkpoints.length < 2) {
    throw new Error("The recorded training fixture is invalid.");
  }
  const recordedAt = Date.parse(recording.recordedAt);
  const checkpoints: ArtifactEnvelope[] = [];
  for (const checkpoint of recording.checkpoints) {
    const parent = checkpoints.at(-1);
    const artifact = await createArtifact({
      kind: "model-checkpoint",
      mode: "recorded",
      title: `Character RNN · ${checkpoint.steps} updates`,
      description: "Actual weights captured from the deterministic course trainer; the browser replays the expensive lifecycle without fabricating model output.",
      projectId: "browser-chat",
      moduleId: "model-foundations",
      lessonId: "character-rnns",
      createdAt: recordedAt + checkpoint.steps,
      producer: { runtime: recording.trainer, version: "1", operation: "record-checkpoint" },
      validation: { status: "recorded" },
      labels: ["actual-weights", "character-rnn", "recorded-training"],
      links: parent ? [{ artifactId: parent.id, contentHash: parent.contentHash, kind: parent.kind, relation: "checkpoint" }] : [],
      metrics: {
        steps: checkpoint.steps,
        initialLoss: checkpoint.initialLoss,
        finalLoss: checkpoint.finalLoss,
        parameters: checkpoint.parameters,
        vocabularySize: checkpoint.vocabularySize,
      },
      payload: {
        format: "latent-character-rnn-checkpoint",
        dataset: recording.dataset,
        trainingConfig: recording.config,
        lossTrace: checkpoint.lossTrace,
        sample: checkpoint.sample,
        checkpoint: checkpoint.checkpoint,
      },
      replay: null,
    });
    checkpoints.push(await store.put(artifact));
  }
  const first = checkpoints[0];
  const last = checkpoints.at(-1)!;
  const run = await createArtifact({
    kind: "training-run",
    mode: "recorded",
    title: "Character RNN training replay",
    description: "A replay over four real checkpoint artifacts. Training time is simulated; every loss, sample, and downloadable weight tensor comes from an actual deterministic run.",
    projectId: "browser-chat",
    moduleId: "model-foundations",
    lessonId: "character-rnns",
    createdAt: recordedAt + 1_000,
    producer: { runtime: recording.trainer, version: "1", operation: "assemble-training-replay" },
    validation: { status: "recorded" },
    labels: ["checkpoint-ladder", "recorded-training", "replay"],
    links: checkpoints.map((checkpoint) => ({ artifactId: checkpoint.id, contentHash: checkpoint.contentHash, kind: checkpoint.kind, relation: "checkpoint" as const })),
    metrics: {
      checkpoints: checkpoints.length,
      initialLoss: first.metrics.finalLoss,
      finalLoss: last.metrics.finalLoss,
      maxSteps: last.metrics.steps,
      parameters: last.metrics.parameters,
    },
    payload: { dataset: recording.dataset, trainingConfig: recording.config, checkpointIds: checkpoints.map((checkpoint) => checkpoint.id) },
    replay: {
      clock: "step",
      unit: "optimizer update",
      frames: checkpoints.map((checkpoint, index) => ({
        index,
        at: checkpoint.metrics.steps,
        label: `${checkpoint.metrics.steps} updates`,
        payload: {
          checkpointArtifactId: checkpoint.id,
          sample: (checkpoint.payload as { sample: ArtifactJson }).sample,
        },
        metrics: { loss: checkpoint.metrics.finalLoss, steps: checkpoint.metrics.steps },
      })),
    },
  });
  return { run: await store.put(run), checkpoints };
}
