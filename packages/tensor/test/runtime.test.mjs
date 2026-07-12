import assert from "node:assert/strict";
import test from "node:test";

import * as latent from "../dist/index.js";
import { LATENT_TENSOR_SOURCE } from "../dist/browser-source.js";

const close = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not close to ${expected}`);
};

test("shape, broadcasting, and matrix products preserve course semantics", () => {
  const matrix = latent.tensor([[1, 2], [3, 4]]);
  assert.deepEqual(matrix.shape, [2, 2]);
  assert.deepEqual(latent.toArray(latent.add(matrix, 1)), [[2, 3], [4, 5]]);
  assert.deepEqual(latent.toArray(latent.matmul(matrix, [2, -1])), [0, 2]);
  assert.deepEqual(latent.toArray(latent.reshape(matrix, [4])), [1, 2, 3, 4]);
});

test("model operations are stable and deterministic", () => {
  const probabilities = latent.softmax([1001, 1000, 999]);
  close(latent.sum(probabilities).item(), 1);
  assert.deepEqual(
    latent.toArray(latent.mean(latent.embedding([[2, 0], [0, 4]], [0, 1]), 0)),
    [1, 2],
  );
  assert.deepEqual(
    latent.toArray(latent.weightedSum([[1, 0], [0, 1]], [0.75, 0.25])),
    [0.75, 0.25],
  );
  assert.deepEqual(
    latent.toArray(latent.maskCausal([[1, 2], [3, 4]])),
    [[1, -Infinity], [3, 4]],
  );
  close(latent.nllLoss([0.1, 0.8, 0.1], 1).item(), -Math.log(0.8));
  assert.deepEqual(
    latent.randn([2, 2], { seed: 71 }).data,
    latent.randn([2, 2], { seed: 71 }).data,
  );
});

test("reverse-mode gradients flow through matmul and tanh", () => {
  const weights = latent.tensor([[1, 0], [0, 1]], { requiresGrad: true });
  const input = latent.tensor([2, -1], { requiresGrad: true });
  const loss = latent.sum(latent.tanh(latent.matmul(weights, input)));
  loss.backward();

  assert.ok(weights.grad);
  assert.ok(input.grad);
  const expectedInput = [1 - Math.tanh(2) ** 2, 1 - Math.tanh(-1) ** 2];
  const actualInput = input.grad.toArray();
  close(actualInput[0], expectedInput[0]);
  close(actualInput[1], expectedInput[1]);
});

test("generated browser source is the same runtime, not a second implementation", async () => {
  const runtimeUrl = `data:text/javascript;base64,${Buffer.from(LATENT_TENSOR_SOURCE).toString("base64")}`;
  const browserRuntime = await import(runtimeUrl);

  for (const operation of latent.LATENT_TENSOR_OPERATIONS) {
    assert.equal(typeof browserRuntime[operation.name], "function", `${operation.name} is exported`);
  }
  assert.deepEqual(
    browserRuntime.toArray(browserRuntime.matmul([[1, 2], [3, 4]], [2, -1])),
    [0, 2],
  );
});
