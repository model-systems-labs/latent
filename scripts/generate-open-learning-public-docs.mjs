import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  questionGroupLibraryJsonSchema,
  questionGroupProgressJsonSchema,
} from "@latent/course-kit";

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
  ["skills/learn-from-sources/SKILL.md", "public/open-learning/skills/learn-from-sources.md"],
  ["skills/author-learning-pack/SKILL.md", "public/open-learning/skills/author-learning-pack.md"],
  ["skills/review-learning-pack/SKILL.md", "public/open-learning/skills/review-learning-pack.md"],
  ["skills/publish-learning-pack/SKILL.md", "public/open-learning/skills/publish-learning-pack.md"],
  ["skills/author-learning-platform/SKILL.md", "public/skills/author-learning-platform.md"],
  ["skills/author-course/SKILL.md", "public/skills/author-course.md"],
  ["skills/author-flash-card-deck/SKILL.md", "public/skills/author-flash-card-deck.md"],
  ["skills/author-question-group/SKILL.md", "public/skills/author-question-group.md"],
  ["skills/author-ide-exercise/SKILL.md", "public/skills/author-ide-exercise.md"],
  ["skills/review-learning-design/SKILL.md", "public/skills/review-learning-design.md"],
  ["skills/publish-learning-platform/SKILL.md", "public/skills/publish-learning-platform.md"],
  [
    "docs/question-groups.md",
    "public/question-groups/guide.md",
    (source) => source.replace(
      "../packages/course-kit/schema/question-group-library.schema.json",
      "./v1/question-group-library.schema.json",
    ).replace(
      "../packages/course-kit/schema/question-group-progress.schema.json",
      "./v1/question-group-progress.schema.json",
    ),
  ],
];

for (const [sourcePath, outputPath, transform = (source) => source] of copies) {
  const source = transform(await readFile(resolve(root, sourcePath), "utf8"));
  const output = resolve(root, outputPath);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, source, "utf8");
}

const questionSchemaDirectory = resolve(root, "public/question-groups/v1");
await mkdir(questionSchemaDirectory, { recursive: true });
await Promise.all([
  writeFile(
    resolve(questionSchemaDirectory, "question-group-library.schema.json"),
    `${JSON.stringify(questionGroupLibraryJsonSchema, null, 2)}\n`,
    "utf8",
  ),
  writeFile(
    resolve(questionSchemaDirectory, "question-group-progress.schema.json"),
    `${JSON.stringify(questionGroupProgressJsonSchema, null, 2)}\n`,
    "utf8",
  ),
]);

process.stdout.write(`${copies.length} public learning documents and the question-group schemas generated.\n`);
