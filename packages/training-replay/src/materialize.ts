import { createArtifact } from "@latent/artifact-runtime/core";
import type { ArtifactEnvelope, ArtifactJson } from "@latent/artifact-runtime/types";
import type {
  MaterializedRecordedTraining,
  RecordedTrainingScenario,
  TrainingArtifactRepository,
  TrainingReplayPresentation,
} from "./types.js";
import {
  assertRecordedTrainingCompatibility,
  assertRecordedTrainingDocument,
  snapshotRecordedTrainingDescriptors,
} from "./validation.js";

function link(artifact: ArtifactEnvelope) {
  return {
    artifactId: artifact.id,
    contentHash: artifact.contentHash,
    kind: artifact.kind,
    relation: "checkpoint" as const,
  };
}

export async function materializeRecordedTraining(input: {
  recording: unknown;
  scenario: RecordedTrainingScenario;
  presentation: TrainingReplayPresentation;
  repository: TrainingArtifactRepository;
}): Promise<MaterializedRecordedTraining> {
  const recording = assertRecordedTrainingDocument(input.recording);
  const { scenario, presentation } = snapshotRecordedTrainingDescriptors(input.scenario, input.presentation);
  assertRecordedTrainingCompatibility(recording, scenario, presentation);
  const recordedAt = Date.parse(recording.recordedAt);
  const checkpoints: ArtifactEnvelope[] = [];

  for (const checkpoint of recording.checkpoints) {
    const parent = checkpoints.at(-1);
    const artifact = await createArtifact({
      kind: scenario.checkpoint.kind,
      mode: "recorded",
      title: `${scenario.checkpoint.title} · ${checkpoint.step} ${scenario.replay.stepLabel}`,
      description: scenario.checkpoint.description,
      projectId: scenario.projectId,
      moduleId: scenario.moduleId,
      lessonId: scenario.lessonId,
      createdAt: recordedAt + checkpoint.step,
      producer: {
        runtime: recording.producer.runtime,
        version: recording.producer.version,
        operation: "record-checkpoint",
      },
      validation: { status: "recorded" },
      labels: [...scenario.checkpoint.labels, "recorded-training"],
      links: parent ? [link(parent)] : [],
      metrics: { step: checkpoint.step, ...checkpoint.metrics },
      payload: {
        format: scenario.checkpoint.payloadFormat,
        scenarioId: scenario.id,
        dataset: recording.dataset,
        trainingConfig: recording.config,
        traces: checkpoint.traces,
        outputs: checkpoint.outputs,
        state: checkpoint.state,
      },
      replay: null,
    });
    checkpoints.push(await input.repository.put(artifact));
  }

  const first = recording.checkpoints[0];
  const last = recording.checkpoints.at(-1)!;
  const scenarioMetrics = Object.fromEntries(Object.entries(scenario.run.metrics ?? {}).map(([key, source]) => {
    const selected = source.checkpoint === "first" ? first : last;
    return [key, selected.metrics[source.metric]];
  }));
  const run = await createArtifact({
    kind: scenario.run.kind,
    mode: "recorded",
    title: scenario.run.title,
    description: scenario.run.description,
    projectId: scenario.projectId,
    moduleId: scenario.moduleId,
    lessonId: scenario.lessonId,
    createdAt: recordedAt + last.step + 1,
    producer: {
      runtime: recording.producer.runtime,
      version: recording.producer.version,
      operation: "assemble-training-replay",
    },
    validation: { status: "recorded" },
    labels: [...scenario.run.labels, "recorded-training", "replay"],
    links: checkpoints.map(link),
    metrics: {
      checkpoints: checkpoints.length,
      maxStep: last.step,
      initialPrimaryMetric: first.metrics[scenario.primaryMetricKey],
      finalPrimaryMetric: last.metrics[scenario.primaryMetricKey],
      ...scenarioMetrics,
    },
    payload: {
      format: "latent-training-run",
      scenarioId: scenario.id,
      dataset: recording.dataset,
      trainingConfig: recording.config,
      checkpointIds: checkpoints.map((checkpoint) => checkpoint.id),
    },
    replay: {
      clock: "step",
      unit: scenario.replay.unit,
      frames: recording.checkpoints.map((checkpoint, index) => ({
        index,
        at: checkpoint.step,
        label: `${checkpoint.step} ${scenario.replay.stepLabel}`,
        payload: {
          checkpointArtifactId: checkpoints[index].id,
          outputs: checkpoint.outputs,
        } as ArtifactJson,
        metrics: {
          step: checkpoint.step,
          [scenario.primaryMetricKey]: checkpoint.metrics[scenario.primaryMetricKey],
        },
      })),
    },
  });

  return {
    scenario,
    presentation,
    recording,
    run: await input.repository.put(run),
    checkpoints,
  };
}
