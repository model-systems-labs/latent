import assert from "node:assert/strict";
import { test } from "node:test";
import * as modelLab from "../dist/index.js";
import * as characterRnn from "../dist/character-rnn.js";

test("public seams expose one implementation of every educational engine", () => {
  assert.equal(modelLab.trainCharacterRnn, characterRnn.trainCharacterRnn);
  for (const name of ["trainCharacterRnn", "sampleCharacterRnn", "trainNeuralLanguageModel", "trainBpe", "trainAdditiveAttention", "runCausalAttention"]) {
    assert.equal(typeof modelLab[name], "function");
  }
});

test("character training is deterministic, improves loss, and produces reusable state", () => {
  const first = characterRnn.trainCharacterRnn(100);
  const repeated = characterRnn.trainCharacterRnn(100);
  assert.equal(first.finalLoss < first.initialLoss, true);
  assert.equal(first.finalLoss, repeated.finalLoss);
  assert.equal(first.sample, repeated.sample);
  assert.equal(first.parameters, 1267);
  assert.equal(first.checkpoint.Wxh.length, characterRnn.CHARACTER_RNN_TRAINING_CONFIG.hiddenSize);
  const open = characterRnn.sampleCharacterRnn(first.checkpoint, "the signal", 80, 0.8, 5, 0);
  const constrained = characterRnn.sampleCharacterRnn(first.checkpoint, "the signal", 80, 0.8, 5, 3);
  assert.notEqual(open, constrained);
  assert.equal(Object.isFrozen(first.checkpoint.Wxh[0]), true);
  assert.throws(() => characterRnn.trainCharacterRnn(0), /steps/i);
  assert.throws(() => characterRnn.sampleCharacterRnn(first.checkpoint, "test", 10, 0), /temperature/i);
  assert.throws(() => characterRnn.assertRnnCheckpoint({ ...first.checkpoint, Wxh: [] }), /Wxh/i);
});

test("the neural language model learns a normalized prediction distribution", () => {
  const result = modelLab.trainNeuralLanguageModel(1200);
  assert.equal(result.finalValidationLoss < result.initialValidationLoss, true);
  assert.equal(result.predictions.length, 5);
  assert.equal(result.predictions.every((item, index) => index === 0 || result.predictions[index - 1].probability >= item.probability), true);
  assert.equal(result.neighbors.length, 4);
});

test("BPE training reduces token count with an ordered deterministic merge table", () => {
  const result = modelLab.trainBpe(12);
  const initial = modelLab.trainBpe(0);
  assert.equal(result.finalTokenCount < result.initialTokenCount, true);
  assert.equal(result.merges.length > 0, true);
  assert.equal(result.vocabularySize > initial.vocabularySize, true);
  assert.equal(result.vocabularySize, initial.vocabularySize + result.merges.length);
  assert.deepEqual(modelLab.trainBpe(12), result);
  assert.equal(result.encoded.includes("▁"), true);
});

test("additive attention learns the three intended alignments", () => {
  const result = modelLab.trainAdditiveAttention(1000);
  assert.equal(result.losses.at(-1) < result.losses[0], true);
  assert.deepEqual(result.matrix.map((row) => row.indexOf(Math.max(...row))), [2, 1, 0]);
  assert.equal(result.matrix.every((row) => Math.abs(row.reduce((sum, value) => sum + value, 0) - 1) < 1e-9), true);
});

test("causal attention assigns exactly zero probability to every future token", () => {
  const result = modelLab.runCausalAttention();
  result.attention.forEach((row, rowIndex) => {
    assert.equal(Math.abs(row.reduce((sum, value) => sum + value, 0) - 1) < 1e-9, true);
    row.forEach((value, columnIndex) => {
      if (columnIndex > rowIndex) assert.equal(value, 0);
    });
  });
  assert.equal(result.contextNorms.every(Number.isFinite), true);
});
