import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const vite = await createServer({
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: false,
  logLevel: "silent",
  server: { middlewareMode: true },
  appType: "custom",
});

const sourceModule = await vite.ssrLoadModule("/packages/tensor/src/browser-source.ts");
const catalogModule = await vite.ssrLoadModule("/packages/tensor/src/catalog.ts");
const lessonSourceModule = await vite.ssrLoadModule("/app/lessons/implementation-source.ts");
const courseModule = await vite.ssrLoadModule("/app/lessons/course.ts");
const runtimeUrl = `data:text/javascript;base64,${Buffer.from(sourceModule.LATENT_TENSOR_SOURCE).toString("base64")}`;
const latent = await import(runtimeUrl);

after(async () => {
  await vite.close();
});

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

test("Latent Tensor handles shapes, broadcasting, and matrix products", () => {
  const matrix = latent.tensor([[1, 2], [3, 4]]);
  assert.deepEqual(matrix.shape, [2, 2]);
  assert.deepEqual(latent.toArray(latent.add(matrix, 2)), [[3, 4], [5, 6]]);
  assert.deepEqual(latent.toArray(latent.matmul(matrix, latent.tensor([2, -1]))), [0, 2]);
  assert.deepEqual(latent.toArray(latent.transpose(matrix)), [[1, 3], [2, 4]]);
  assert.equal(latent.numel([2, 4, 8, 16]), 1024);
});

test("probability and neural-network operations are stable and composable", () => {
  const probabilities = latent.softmax(latent.tensor([1001, 1000, 999]));
  close(probabilities.data.reduce((total, value) => total + value, 0), 1);
  assert.equal(probabilities.data.every(Number.isFinite), true);
  assert.deepEqual(latent.toArray(latent.mean(latent.embedding(latent.tensor([[2, 0], [0, 4]]), [0, 1]), 0)), [1, 2]);
  assert.deepEqual(latent.toArray(latent.weightedSum(latent.tensor([[1, 0], [0, 1]]), latent.tensor([0.75, 0.25]))), [0.75, 0.25]);
  assert.deepEqual(latent.toArray(latent.maskCausal(latent.tensor([[1, 2], [3, 4]]))), [[1, -Infinity], [3, 4]]);
  const normalized = latent.normalizeLayer(latent.tensor([1, 2, 3, 4]));
  close(normalized.data.reduce((total, value) => total + value, 0), 0);
});

test("reverse-mode autodiff propagates through an RNN-style projection", () => {
  const weights = latent.tensor([[1, 0], [0, 1]], { requiresGrad: true });
  const input = latent.tensor([2, -1], { requiresGrad: true });
  const loss = latent.sum(latent.tanh(latent.matmul(weights, input)));
  loss.backward();
  const expectedFirst = 1 - Math.tanh(2) ** 2;
  const expectedSecond = 1 - Math.tanh(-1) ** 2;
  close(input.grad.data[0], expectedFirst);
  close(input.grad.data[1], expectedSecond);
  close(weights.grad.data[0], expectedFirst * 2);
  close(weights.grad.data[1], expectedFirst * -1);
  close(weights.grad.data[2], expectedSecond * 2);
  close(weights.grad.data[3], expectedSecond * -1);
});

test("loss, clipping, sampling controls, and seeded initialization are deterministic", () => {
  close(latent.nllLoss(latent.tensor([0.1, 0.8, 0.1]), 1).item(), -Math.log(0.8));
  assert.deepEqual(latent.toArray(latent.clip(latent.tensor([-12, -2, 8]), -5, 5)), [-5, -2, 5]);
  assert.deepEqual(latent.topK(latent.tensor([0.1, 0.7, 0.2]), 2).indices, [1, 2]);
  assert.deepEqual(latent.randn([2, 2], { seed: 71 }).data, latent.randn([2, 2], { seed: 71 }).data);
});

test("the lesson operation catalog matches the runtime's public exports", () => {
  for (const operation of catalogModule.LATENT_TENSOR_OPERATIONS) {
    assert.equal(typeof latent[operation.name], "function", `${operation.name} must be exported by Latent Tensor`);
  }
  assert.equal(sourceModule.LATENT_TENSOR_PATH, "runtime/latent-tensor.js");
});

test("CPython tensor lessons use NumPy without injecting the JavaScript tensor runtime", () => {
  const lessons = courseModule.courseLessons.filter((lesson) => lesson.implementation.tensorOps?.length);
  assert.ok(lessons.length > 0);
  for (const lesson of lessons) {
    assert.match(lesson.implementation.filename, /\.py$/, lesson.id);
    const body = lessonSourceModule.lessonImplementationSource(lesson, lesson.implementation.codeBlocks.map((block) => block.code));
    assert.doesNotMatch(body, /runtime\/latent-tensor\.js|from\s+["']@latent\/tensor/);
    assert.equal(lessonSourceModule.lessonImplementationPrelude(lesson), "");
    assert.ok(
      lesson.implementation.tensorOps.some((operation) => operation === "numpy" || operation.startsWith("np.")),
      `${lesson.id} must identify its Python/NumPy tensor surface`,
    );
  }
});
