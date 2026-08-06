#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = resolve(root, "plugins/neural-chalk");
const check = process.argv.includes("--check");

const copies = [
  ["skills/learn-from-sources/SKILL.md", "skills/learn-from-sources/SKILL.md"],
  ["skills/learn-from-sources/agents/openai.yaml", "skills/learn-from-sources/agents/openai.yaml"],
  ["skills/author-learning-pack/SKILL.md", "skills/author-learning-pack/SKILL.md"],
  ["skills/author-learning-pack/agents/openai.yaml", "skills/author-learning-pack/agents/openai.yaml"],
  ["skills/author-question-group/SKILL.md", "skills/author-question-group/SKILL.md"],
  ["skills/author-question-group/agents/openai.yaml", "skills/author-question-group/agents/openai.yaml"],
  ["skills/review-learning-pack/SKILL.md", "skills/review-learning-pack/SKILL.md"],
  ["skills/review-learning-pack/agents/openai.yaml", "skills/review-learning-pack/agents/openai.yaml"],
  ["skills/publish-learning-pack/SKILL.md", "skills/publish-learning-pack/SKILL.md"],
  ["skills/publish-learning-pack/agents/openai.yaml", "skills/publish-learning-pack/agents/openai.yaml"],
  ["docs/open-learning.md", "references/open-learning.md"],
  ["docs/learning-pack-quality-rubric.md", "references/learning-pack-quality-rubric.md"],
  ["docs/learning-pack.schema.json", "references/learning-pack.schema.json"],
  ["docs/learning-feed.schema.json", "references/learning-feed.schema.json"],
  ["docs/question-groups.md", "references/question-groups.md"],
  ["docs/release-status.json", "references/release-status.json"],
  ["packages/course-kit/schema/question-group-library.schema.json", "references/question-group-library.schema.json"],
  ["packages/course-kit/schema/question-group-progress.schema.json", "references/question-group-progress.schema.json"],
  ["examples/open-learning/reliable-llm-changes/learning-pack.json", "references/learning-pack.example.json"],
  ["examples/learning-platform/javascript-array-methods/content/question-groups.json", "references/question-group-library.example.json"],
  ["LICENSE", "LICENSE"],
  ["CONTENT_LICENSE.md", "CONTENT_LICENSE.md"],
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function requireExactFile(path, expected) {
  let actual;
  try {
    actual = await readFile(path);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      throw new Error(`Missing generated plugin file: ${path}`);
    }
    throw error;
  }
  if (!actual.equals(expected)) {
    throw new Error(`Stale generated plugin file: ${path}`);
  }
}

const records = [];
for (const [sourcePath, destinationPath] of copies) {
  const source = await readFile(resolve(root, sourcePath));
  const destination = resolve(pluginRoot, destinationPath);
  if (check) {
    await requireExactFile(destination, source);
  } else {
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, source);
  }
  records.push({
    source: sourcePath,
    destination: destinationPath,
    bytes: source.byteLength,
    sha256: sha256(source),
  });
}

const releaseStatus = JSON.parse(await readFile(resolve(root, "docs/release-status.json"), "utf8"));
const bundleManifest = Buffer.from(`${JSON.stringify({
  format: "neural-chalk-plugin-bundle",
  schemaVersion: 1,
  courseKit: {
    version: releaseStatus.courseKit.sourceVersion,
    tag: releaseStatus.courseKit.latestPublishedTag,
    installUrl: releaseStatus.courseKit.installUrl,
    tarballSha256: releaseStatus.courseKit.tarballSha256,
  },
  files: records,
}, null, 2)}\n`);
const bundleManifestPath = resolve(pluginRoot, "references/bundle-manifest.json");

if (check) {
  await requireExactFile(bundleManifestPath, bundleManifest);
} else {
  await mkdir(dirname(bundleManifestPath), { recursive: true });
  await writeFile(bundleManifestPath, bundleManifest);
}

process.stdout.write(`${check ? "Verified" : "Synchronized"} ${records.length} Neural Chalk plugin files.\n`);
