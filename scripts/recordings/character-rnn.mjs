import {
  CHARACTER_RNN_DATASET,
  CHARACTER_RNN_TRAINING_CONFIG,
  trainCharacterRnn,
} from "@latent/model-lab/character-rnn";
import { assertRecordedTrainingDocument } from "@latent/training-replay/validation";

export const CHARACTER_RNN_RECORDED_STEPS = Object.freeze([20, 100, 300, 600]);

export function createCharacterRnnRecording() {
  const checkpoints = CHARACTER_RNN_RECORDED_STEPS.map((steps) => {
    const result = trainCharacterRnn(steps);
    const stride = Math.max(1, Math.ceil(result.losses.length / 48));
    return {
      step: steps,
      metrics: {
        initialLoss: result.initialLoss,
        finalLoss: result.finalLoss,
        parameters: result.parameters,
        vocabularySize: result.vocabularySize,
      },
      traces: {
        loss: result.losses.filter((_, index) => index % stride === 0 || index === result.losses.length - 1),
      },
      outputs: { sample: result.sample },
      state: result.checkpoint,
    };
  });
  return assertRecordedTrainingDocument({
    format: "latent-recorded-training",
    version: 1,
    recordedAt: "2026-07-12T00:00:00.000Z",
    producer: { runtime: "latent-character-rnn", version: "1" },
    dataset: CHARACTER_RNN_DATASET,
    config: CHARACTER_RNN_TRAINING_CONFIG,
    checkpoints,
  });
}
