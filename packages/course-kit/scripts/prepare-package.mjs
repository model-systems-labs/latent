import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  learningFeedJsonSchema,
  learningPackJsonSchema,
} from "../dist/index.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");

await Promise.all([
  rm(resolve(packageRoot, "docs"), { force: true, recursive: true }),
  rm(resolve(packageRoot, "schema"), { force: true, recursive: true }),
]);

const schemaFiles = [
  ["schema/learning-pack.schema.json", learningPackJsonSchema],
  ["schema/learning-feed.schema.json", learningFeedJsonSchema],
];

for (const [relativePath, schema] of schemaFiles) {
  const output = resolve(packageRoot, relativePath);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
}

const openLearning = (await readFile(resolve(repositoryRoot, "docs/open-learning.md"), "utf8"))
  .replace(
    "](./learning-pack.schema.json)",
    "](../schema/learning-pack.schema.json)",
  )
  .replace(
    "](./learning-feed.schema.json)",
    "](../schema/learning-feed.schema.json)",
  )
  .replace(
    "Repository convenience copies live at",
    "Packaged convenience copies live at",
  )
  .replace(
    "[`docs/learning-pack.schema.json`]",
    "[`schema/learning-pack.schema.json`]",
  )
  .replace(
    "[`docs/learning-feed.schema.json`]",
    "[`schema/learning-feed.schema.json`]",
  )
  .replace(
    "](../examples/open-learning/reliable-llm-changes/learning-pack.json)",
    "](https://github.com/model-systems-labs/latent/blob/main/examples/open-learning/reliable-llm-changes/learning-pack.json)",
  );

const docs = [
  ["docs/open-learning.md", openLearning],
  [
    "docs/learning-pack-quality-rubric.md",
    await readFile(resolve(repositoryRoot, "docs/learning-pack-quality-rubric.md"), "utf8"),
  ],
];

for (const [relativePath, source] of docs) {
  const output = resolve(packageRoot, relativePath);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, source, "utf8");
}

process.stdout.write("Prepared Course Kit schemas and documentation.\n");
