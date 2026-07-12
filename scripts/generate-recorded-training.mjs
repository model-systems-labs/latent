import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const vite = await createServer({
  root,
  configFile: false,
  logLevel: "silent",
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const { trainCharacterRnn } = await vite.ssrLoadModule("/app/lib/lab-engines.ts");
  const checkpoints = [20, 100, 300, 600].map((steps) => {
    const result = trainCharacterRnn(steps);
    const stride = Math.max(1, Math.ceil(result.losses.length / 48));
    return {
      steps,
      initialLoss: result.initialLoss,
      finalLoss: result.finalLoss,
      parameters: result.parameters,
      vocabularySize: result.vocabularySize,
      lossTrace: result.losses.filter((_, index) => index % stride === 0 || index === result.losses.length - 1),
      sample: result.sample,
      checkpoint: result.checkpoint,
    };
  });
  const output = {
    format: "latent-recorded-training",
    version: 1,
    recordedAt: "2026-07-12T00:00:00.000Z",
    trainer: "latent-character-rnn-v1",
    dataset: {
      name: "Signal Notes",
      source: "Original synthetic course corpus",
      license: "CC0",
      split: "fixed deterministic sequence",
    },
    config: {
      seed: 19,
      hiddenSize: 18,
      sequenceLength: 28,
      optimizer: "Adagrad",
      learningRate: 0.075,
      gradientClip: 5,
    },
    checkpoints,
  };
  const directory = resolve(root, "app/features/artifacts/recorded");
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "character-rnn-training.json"), `${JSON.stringify(output, null, 2)}\n`);
} finally {
  await vite.close();
}
