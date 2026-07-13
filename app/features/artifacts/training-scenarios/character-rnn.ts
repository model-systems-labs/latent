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
    description: "Actual weights captured from the deterministic course trainer; the browser replays the expensive lifecycle without fabricating model output.",
    payloadFormat: "latent-character-rnn-checkpoint",
    labels: ["actual-weights", "character-rnn"],
  },
  run: {
    kind: "training-run",
    title: "Character RNN training replay",
    description: "A replay over four real checkpoint artifacts. Training time is simulated; every loss, sample, and downloadable weight tensor comes from an actual deterministic run.",
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
  checkpointEyebrow: "Actual checkpoint weights",
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
  disclosure: "Training time is replayed. The loss, generated text, and downloadable tensors come from the recorded deterministic run.",
} satisfies TrainingReplayPresentation;
