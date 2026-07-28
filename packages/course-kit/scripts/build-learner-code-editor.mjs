import { lstat, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "vite";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const outputDirectoryIndex = args.indexOf("--out-dir");
if (
  !(
    args.length === 0
    || (
      args.length === 2
      && outputDirectoryIndex === 0
      && Boolean(args[1])
    )
  )
) {
  throw new Error(
    "Usage: node scripts/build-learner-code-editor.mjs [--out-dir <directory>]",
  );
}
const outputDirectory = outputDirectoryIndex >= 0
  ? resolve(process.cwd(), args[outputDirectoryIndex + 1])
  : resolve(packageRoot, "dist/assets");
const customOutputDirectory = outputDirectoryIndex >= 0;
if (customOutputDirectory) {
  const stats = await lstat(outputDirectory);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(
      "The custom learner editor output must be an existing real directory.",
    );
  }
  if ((await readdir(outputDirectory)).length !== 0) {
    throw new Error(
      "The custom learner editor output directory must be empty.",
    );
  }
}
const outputFile = resolve(outputDirectory, "learner-code-editor.js");

await build({
  build: {
    copyPublicDir: false,
    emptyOutDir: !customOutputDirectory,
    lib: {
      entry: resolve(
        packageRoot,
        "src/browser/learner-code-editor-runtime.ts",
      ),
      fileName: () => "learner-code-editor.js",
      formats: ["iife"],
      name: "LatentLearnerCodeEditorBundle",
    },
    minify: "esbuild",
    outDir: outputDirectory,
    reportCompressedSize: false,
    sourcemap: false,
    target: "es2022",
  },
  configFile: false,
  logLevel: "warn",
});

const outputs = (await readdir(outputDirectory)).sort();
if (
  outputs.length !== 1
  || outputs[0] !== "learner-code-editor.js"
) {
  throw new Error(
    `Expected one deterministic learner editor asset, received: ${outputs.join(", ")}`,
  );
}
const eslintBanner = "/* eslint-disable */\n";
const bundledSource = await readFile(outputFile, "utf8");
const sourceWithBanner = bundledSource.startsWith(eslintBanner)
  ? bundledSource
  : `${eslintBanner}${bundledSource}`;
// Vite preserves a tab-only line inside CodeMirror's JavaScript snippet
// template. Escaping it retains the evaluated tab while keeping the generated
// source free of trailing whitespace.
const source = sourceWithBanner.replaceAll("\n\t\n", "\n\\t\n");
if (source !== bundledSource) {
  await writeFile(outputFile, source, "utf8");
}
if (
  !source.includes("LatentLearnerCodeEditorRuntime")
  || source.includes("sourceMappingURL=")
) {
  throw new Error("The learner editor asset does not match its runtime contract.");
}

process.stdout.write(
  `Built ${outputFile.slice(packageRoot.length + 1)} with Vite.\n`,
);
