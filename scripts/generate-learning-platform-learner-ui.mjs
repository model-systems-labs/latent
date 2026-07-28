#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import {
  createLearnerUiCss,
  learnerUiJavaScript,
  resolveLearnerUiTheme,
} from "@latent/course-kit/learner-ui";
import {
  LEARNER_CODE_EDITOR_CSP_SOURCE,
  LEARNER_CODE_EDITOR_VERSION,
} from "@latent/course-kit/learner-code-editor";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultModuleOutput = resolve(
  repositoryRoot,
  "examples/learning-platform/interview-loop/tools/vendor/learner-ui.mjs",
);
const defaultEditorOutput = resolve(
  repositoryRoot,
  "examples/learning-platform/interview-loop/tools/vendor/learner-code-editor.js",
);
const editorAssetSource = resolve(
  repositoryRoot,
  "packages/course-kit/dist/assets/learner-code-editor.js",
);
const appCssOutput = resolve(repositoryRoot, "public/assets/learner-ui.css");
const appJavaScriptOutput = resolve(repositoryRoot, "public/assets/learner-ui.js");
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
          LEARNER_UI_FAVICON_SVG,
          LEARNER_UI_PALETTE_NAMES,
          LEARNER_UI_PALETTES,
          LEARNER_UI_VERSION,
          createLearnerUiCss,
          learnerUiJavaScript,
          renderLearnerAtmosphere,
          renderLearnerContextNavigation,
          renderLearnerFooter,
          renderLearnerHeader,
          resolveLearnerUiTheme,
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
${normalizedSource}
export const LEARNER_CODE_EDITOR_CSP_SOURCE = ${JSON.stringify(LEARNER_CODE_EDITOR_CSP_SOURCE)};
export const LEARNER_CODE_EDITOR_VERSION = ${JSON.stringify(LEARNER_CODE_EDITOR_VERSION)};
`;
}

const args = process.argv.slice(2);
const check = args.includes("--check");
const appOnly = args.includes("--app-only");
const outIndex = args.indexOf("--out");
const moduleOutput = outIndex >= 0
  ? resolve(args[outIndex + 1] ?? "")
  : defaultModuleOutput;
if (!moduleOutput) throw new Error("--out requires a path.");
const editorOutIndex = args.indexOf("--editor-out");
const editorOutput = editorOutIndex >= 0
  ? resolve(args[editorOutIndex + 1] ?? "")
  : outIndex >= 0
    ? resolve(dirname(moduleOutput), "learner-code-editor.js")
    : defaultEditorOutput;
if (!editorOutput) throw new Error("--editor-out requires a path.");
const customModuleOutput = outIndex >= 0;
const outputs = [];

if (!appOnly) {
  outputs.push([moduleOutput, await generatedSource(), "Vendored learner UI"]);
  outputs.push([
    editorOutput,
    await readFile(editorAssetSource, "utf8"),
    "Vendored learner code editor",
  ]);
}
if (!customModuleOutput) {
  const theme = resolveLearnerUiTheme({ palette: "paper" });
  outputs.push(
    [appCssOutput, `${createLearnerUiCss(theme, { palette: "paper" }).trim()}\n`, "React learner UI stylesheet"],
    [appJavaScriptOutput, `${learnerUiJavaScript.trim()}\n`, "React learner UI behavior"],
  );
}

if (check) {
  const stale = [];
  for (const [output, source, label] of outputs) {
    const existing = await readFile(output, "utf8").catch(() => "");
    if (existing !== source) stale.push(`${label}: ${output}`);
  }
  if (stale.length > 0) {
    throw new Error([
      "Generated learner UI assets are stale. Run node scripts/generate-learning-platform-learner-ui.mjs.",
      ...stale,
    ].join("\n"));
  }
  console.log(`Generated learner UI assets match @latent/course-kit ${packageManifest.version}.`);
} else {
  for (const [output, source] of outputs) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, source, "utf8");
    console.log(output);
  }
}
