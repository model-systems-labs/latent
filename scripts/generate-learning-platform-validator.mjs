#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutput = resolve(
  repositoryRoot,
  "examples/learning-platform/javascript-array-methods/tools/vendor/course-kit-validator.mjs",
);
const packageManifest = JSON.parse(await readFile(
  resolve(repositoryRoot, "packages/course-kit/package.json"),
  "utf8",
));

async function generatedSource() {
  const result = await build({
    stdin: {
      contents: `
        export { validateLearningPack, validateQuestionGroupLibrary } from "@latent/course-kit";
        export const COURSE_KIT_VALIDATOR_VERSION = ${JSON.stringify(packageManifest.version)};
      `,
      resolveDir: repositoryRoot,
      sourcefile: "learning-platform-course-kit-validator.ts",
      loader: "ts",
    },
    bundle: true,
    charset: "utf8",
    format: "esm",
    legalComments: "none",
    minify: false,
    platform: "node",
    sourcemap: false,
    target: "node22",
    treeShaking: true,
    write: false,
  });
  const source = result.outputFiles[0]?.text;
  if (!source) throw new Error("esbuild did not produce the Course Kit validator.");
  const normalizedSource = source
    .replace(/^\/\/ .*\/node_modules\//gm, "// node_modules/")
    .replace(/[ \t]+$/gm, "");
  return `/* eslint-disable */\n// Generated from @latent/course-kit ${packageManifest.version}; do not edit.\n${normalizedSource}`;
}

const args = process.argv.slice(2);
const check = args.includes("--check");
const outIndex = args.indexOf("--out");
const output = outIndex >= 0
  ? resolve(args[outIndex + 1] ?? "")
  : defaultOutput;
if (!output) throw new Error("--out requires a path.");
const source = await generatedSource();

if (check) {
  const existing = await readFile(output, "utf8").catch(() => "");
  if (existing !== source) {
    throw new Error(
      `Vendored Course Kit validator is stale. Run node scripts/generate-learning-platform-validator.mjs`,
    );
  }
  console.log(`Vendored Course Kit validator matches @latent/course-kit ${packageManifest.version}.`);
} else {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, source, "utf8");
  console.log(output);
}
