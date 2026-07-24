import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { questionGroupLibraryJsonSchema } from "@latent/course-kit";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const copies = [
  [
    "docs/open-learning.md",
    "public/open-learning/guide.md",
    (source) => source.replace(
      "../examples/open-learning/reliable-llm-changes/learning-pack.json",
      "./reliable-llm-changes/learning-pack.json",
    ),
  ],
  ["docs/learning-pack-quality-rubric.md", "public/open-learning/quality-rubric.md"],
  ["skills/author-learning-pack/SKILL.md", "public/open-learning/skills/author-learning-pack.md"],
  ["skills/review-learning-pack/SKILL.md", "public/open-learning/skills/review-learning-pack.md"],
  ["skills/publish-learning-pack/SKILL.md", "public/open-learning/skills/publish-learning-pack.md"],
  ["docs/question-groups.md", "public/question-groups/guide.md"],
];

for (const [sourcePath, outputPath, transform = (source) => source] of copies) {
  const source = transform(await readFile(resolve(root, sourcePath), "utf8"));
  const output = resolve(root, outputPath);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, source, "utf8");
}

const questionSchemaOutput = resolve(
  root,
  "public/question-groups/v1/question-group-library.schema.json",
);
await mkdir(dirname(questionSchemaOutput), { recursive: true });
await writeFile(
  questionSchemaOutput,
  `${JSON.stringify(questionGroupLibraryJsonSchema, null, 2)}\n`,
  "utf8",
);

process.stdout.write(`${copies.length} public learning documents and the question-group schema generated.\n`);
