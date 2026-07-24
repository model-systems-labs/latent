import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CHARACTER_RNN_RECORDED_STEPS,
  createCharacterRnnRecording,
} from "../scripts/recordings/character-rnn.mjs";

function assertNumericallyEquivalent(actual, expected, path = "recording") {
  if (typeof actual === "number" && typeof expected === "number") {
    const tolerance = 1e-12 * Math.max(1, Math.abs(actual), Math.abs(expected));
    assert.ok(
      Math.abs(actual - expected) <= tolerance,
      `${path} differs by more than ${tolerance}: ${actual} !== ${expected}`,
    );
    return;
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    assert.equal(actual.length, expected.length, `${path} length`);
    for (let index = 0; index < actual.length; index += 1) {
      assertNumericallyEquivalent(actual[index], expected[index], `${path}[${index}]`);
    }
    return;
  }
  if (
    actual !== null
    && expected !== null
    && typeof actual === "object"
    && typeof expected === "object"
  ) {
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${path} keys`);
    for (const key of Object.keys(actual)) {
      assertNumericallyEquivalent(actual[key], expected[key], `${path}.${key}`);
    }
    return;
  }
  assert.deepEqual(actual, expected, path);
}

test("the checked-in character training replay matches its deterministic producer across supported engines", async () => {
  const checkedIn = JSON.parse(await readFile(new URL("../app/features/artifacts/recorded/character-rnn-training.json", import.meta.url), "utf8"));
  const generated = createCharacterRnnRecording();
  assert.deepEqual(generated, createCharacterRnnRecording());
  assertNumericallyEquivalent(generated, checkedIn);
  assert.deepEqual(generated.checkpoints.map((checkpoint) => checkpoint.step), CHARACTER_RNN_RECORDED_STEPS);
  assert.equal(generated.checkpoints[0].metrics.finalLoss > generated.checkpoints.at(-1).metrics.finalLoss, true);
});
