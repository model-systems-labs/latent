import { RecordedTrainingRegistry } from "@latent/training-replay/registry";
import {
  characterRnnTrainingPresentation,
  characterRnnTrainingScenario,
} from "./character-rnn";

export const recordedTrainingRegistry = new RecordedTrainingRegistry().register({
  scenario: characterRnnTrainingScenario,
  presentation: characterRnnTrainingPresentation,
  loadRecording: async () => (await import("../recorded/character-rnn-training.json")).default,
});
