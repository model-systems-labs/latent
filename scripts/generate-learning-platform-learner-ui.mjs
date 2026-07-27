#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutput = resolve(
  repositoryRoot,
  "examples/learning-platform/interview-loop/tools/vendor/learner-ui.mjs",
);
const packageManifest = JSON.parse(await readFile(
  resolve(repositoryRoot, "packages/course-kit/package.json"),
  "utf8",
));

async function generatedSource() {
  const result = await build({
    stdin: {
      contents: `
        export {
          LEARNER_UI_BREAKPOINTS,
          LEARNER_UI_VERSION,
          createLearnerUiCss,
          learnerUiJavaScript,
          renderLearnerFooter,
          renderLearnerHeader,
        } from "@latent/course-kit/learner-ui";
      `,
      resolveDir: repositoryRoot,
      sourcefile: "learning-platform-learner-ui.ts",
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
  if (!source) throw new Error("esbuild did not produce the learner UI bundle.");
  const normalizedSource = source.replace(/[ \t]+$/gm, "");
  return `// Generated from @latent/course-kit ${packageManifest.version}; do not edit.
${normalizedSource}`;
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
      "Vendored learner UI is stale. Run node scripts/generate-learning-platform-learner-ui.mjs.",
    );
  }
  console.log(`Vendored learner UI matches @latent/course-kit ${packageManifest.version}.`);
} else {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, source, "utf8");
  console.log(output);
}
