import type {
  RecordedTrainingScenario,
  TrainingReplayPresentation,
} from "@latent/training-replay/types";

export const characterRnnTrainingScenario = {
  id: "character-rnn",
  projectId: "browser-chat",
  moduleId: "model-foundations",
  lessonId: "character-rnns",
  primaryMetricKey: "finalLoss",
  checkpoint: {
    kind: "model-checkpoint",
    title: "Character RNN",
    description: "Real weights from the course’s repeatable trainer. The browser replays the slow parts without making up model output.",
    payloadFormat: "latent-character-rnn-checkpoint",
    labels: ["actual-weights", "character-rnn"],
  },
  run: {
    kind: "training-run",
    title: "Recorded character RNN run",
    description: "Four checkpoints saved from one fixed, repeatable course run. This replay does not use learner code.",
    labels: ["checkpoint-ladder", "character-rnn"],
    metrics: {
      initialLoss: { checkpoint: "first", metric: "finalLoss" },
      finalLoss: { checkpoint: "last", metric: "finalLoss" },
      parameters: { checkpoint: "last", metric: "parameters" },
    },
  },
  replay: {
    unit: "optimizer update",
    stepLabel: "updates",
  },
} satisfies RecordedTrainingScenario;

export const characterRnnTrainingPresentation = {
  checkpointEyebrow: "Recorded checkpoint",
  metrics: [
    { id: "loss", key: "finalLoss", label: "Loss", format: { kind: "decimal", digits: 3 } },
    { id: "change", key: "finalLoss", label: "Change", format: { kind: "decimal", digits: 3 }, comparison: true },
    { id: "parameters", key: "parameters", label: "Parameters", format: { kind: "integer" } },
    { id: "vocabulary", key: "vocabularySize", label: "Vocabulary", format: { kind: "integer" } },
  ],
  traceKey: "loss",
  traceLabel: "Recorded loss trace",
  output: {
    key: "sample",
    label: "Sample generated from this checkpoint",
  },
  disclosure: "These losses, samples, and weights were saved from the fixed course run. No training happens while you step through them.",
} satisfies TrainingReplayPresentation;
