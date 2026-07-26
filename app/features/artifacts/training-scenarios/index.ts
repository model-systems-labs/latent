import { RecordedTrainingRegistry } from "@latent/training-replay/registry";
import {
  characterRnnTrainingPresentation,
  characterRnnTrainingScenario,
} from "@/app/features/artifacts/training-scenarios/character-rnn";

export const recordedTrainingRegistry = new RecordedTrainingRegistry().register({
  scenario: characterRnnTrainingScenario,
  presentation: characterRnnTrainingPresentation,
  loadRecording: async () => (await import("@/app/features/artifacts/recorded/character-rnn-training.json")).default,
});
