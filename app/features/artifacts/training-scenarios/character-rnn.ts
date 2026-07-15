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
    title: "Character RNN training replay",
    description: "A replay of four real checkpoints. The timing is simulated, but every loss, sample, and downloadable weight tensor comes from a real repeatable run.",
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
  checkpointEyebrow: "Real checkpoint weights",
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
  disclosure: "The browser replays the training time. The loss, generated text, and downloadable tensors all come from the recorded repeatable run.",
} satisfies TrainingReplayPresentation;
