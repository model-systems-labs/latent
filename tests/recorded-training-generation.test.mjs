import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CHARACTER_RNN_RECORDED_STEPS,
  createCharacterRnnRecording,
} from "../scripts/recordings/character-rnn.mjs";

test("the checked-in character training replay exactly matches its deterministic producer", async () => {
  const checkedIn = JSON.parse(await readFile(new URL("../app/features/artifacts/recorded/character-rnn-training.json", import.meta.url), "utf8"));
  const generated = createCharacterRnnRecording();
  assert.deepEqual(generated, checkedIn);
  assert.deepEqual(generated.checkpoints.map((checkpoint) => checkpoint.step), CHARACTER_RNN_RECORDED_STEPS);
  assert.equal(generated.checkpoints[0].metrics.finalLoss > generated.checkpoints.at(-1).metrics.finalLoss, true);
});
