import type { ArtifactEnvelope, ArtifactJson } from "@latent/artifact-runtime/types";

export const RECORDED_TRAINING_FORMAT = "latent-recorded-training" as const;
export const RECORDED_TRAINING_VERSION = 1 as const;

export type RecordedTrainingCheckpoint = {
  step: number;
  metrics: Record<string, number>;
  traces: Record<string, number[]>;
  outputs: Record<string, ArtifactJson>;
  state: ArtifactJson;
};

export type RecordedTrainingDocument = {
  format: typeof RECORDED_TRAINING_FORMAT;
  version: typeof RECORDED_TRAINING_VERSION;
  recordedAt: string;
  producer: {
    runtime: string;
    version: string;
  };
  dataset: ArtifactJson;
  config: ArtifactJson;
  checkpoints: RecordedTrainingCheckpoint[];
};

export type RecordedTrainingScenario = {
  id: string;
  projectId: string;
  moduleId: string;
  lessonId: string;
  primaryMetricKey: string;
  checkpoint: {
    kind: string;
    title: string;
    description: string;
    payloadFormat: string;
    labels: string[];
  };
  run: {
    kind: string;
    title: string;
    description: string;
    labels: string[];
    metrics?: Record<string, {
      checkpoint: "first" | "last";
      metric: string;
    }>;
  };
  replay: {
    unit: string;
    stepLabel: string;
  };
};

export type TrainingMetricFormat =
  | { kind: "decimal"; digits?: number }
  | { kind: "integer" };

export type TrainingMetricDescriptor = {
  id: string;
  key: string;
  label: string;
  format: TrainingMetricFormat;
  comparison?: boolean;
};

export type TrainingReplayPresentation = {
  checkpointEyebrow: string;
  metrics: TrainingMetricDescriptor[];
  traceKey: string;
  traceLabel: string;
  output?: {
    key: string;
    label: string;
  };
  disclosure: string;
};

export type RecordedTrainingRegistration = {
  scenario: RecordedTrainingScenario;
  presentation: TrainingReplayPresentation;
  loadRecording: () => Promise<unknown>;
};

export type TrainingArtifactRepository = {
  put: (artifact: ArtifactEnvelope) => Promise<ArtifactEnvelope>;
};

export type MaterializedRecordedTraining = {
  scenario: RecordedTrainingScenario;
  presentation: TrainingReplayPresentation;
  recording: RecordedTrainingDocument;
  run: ArtifactEnvelope;
  checkpoints: ArtifactEnvelope[];
};

export type TrainingCheckpointMetricView = {
  id: string;
  label: string;
  value: number | null;
  display: string;
};

export type TrainingCheckpointView = {
  artifact: ArtifactEnvelope;
  index: number;
  step: number;
  stepLabel: string;
  frameLabel: string;
  eyebrow: string;
  metrics: TrainingCheckpointMetricView[];
  trace: {
    key: string;
    label: string;
    values: number[];
  };
  output: {
    key: string;
    label: string;
    text: string;
  } | null;
  disclosure: string;
};
