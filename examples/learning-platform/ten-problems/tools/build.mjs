import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  QUESTION_GROUP_BUILD_MARKER,
  buildStandaloneQuestionGroupSite,
} from "@latent/course-kit/question-group-site";
import { build as bundle } from "esbuild";

import {
  renderTenProblemsHeaders,
  tenProblemsMetaContentSecurityPolicy,
} from "../security-config.mjs";
import { tenProblemsSiteUi } from "../site-config.mjs";
import { tenProblemsReferenceSolutions } from "../trusted/reference-solutions.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(projectRoot, "../../..");
const libraryPath = join(projectRoot, "content/question-groups.json");
const output = join(projectRoot, "dist");
const trustedRuntime = join(
  projectRoot,
  "trusted/python-question-runtime.ts",
);
const pythonWorker = join(
  repositoryRoot,
  "packages/python-lab/src/worker/python.worker.ts",
);
const pythonTypes = join(
  repositoryRoot,
  "packages/python-lab/src/types.ts",
);
const pyodidePackage = join(repositoryRoot, "node_modules/pyodide");
const pyodideFiles = [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];
const generatedLintHeader = "/* eslint-disable -- generated third-party runtime */\n";
const remoteJsDelivrUrlPattern =
  /(?:https?:)?\/\/cdn\.jsdelivr\.net(?:[/:?#]|$)/u;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function inspectOutput() {
  try {
    const stats = await lstat(output);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error("The practice build output must be a real directory.");
    }
    const markerPath = join(output, ".latent-build");
    const markerStats = await lstat(markerPath);
    if (markerStats.isSymbolicLink() || !markerStats.isFile()) {
      throw new Error("The practice build marker must be a regular file.");
    }
    const marker = await readFile(markerPath, "utf8");
    if (marker.trim() !== QUESTION_GROUP_BUILD_MARKER) {
      throw new Error("Refusing to replace dist without its Question Group build marker.");
    }
    return true;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return false;
    throw error;
  }
}

async function collectFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => (
    left.name.localeCompare(right.name)
  ))) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Practice output may not contain symlinks: ${path}`);
    }
    if (entry.isDirectory()) files.push(...await collectFiles(path, root));
    else if (entry.isFile()) files.push(relative(root, path));
  }
  return files;
}

function outputPath(root, relativePath) {
  if (
    typeof relativePath !== "string"
    || relativePath.startsWith("/")
    || relativePath.includes("\\")
    || relativePath.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Generated practice path is unsafe: ${relativePath}`);
  }
  const path = resolve(root, relativePath);
  if (!path.startsWith(`${root}${sep}`)) {
    throw new Error(`Generated practice path escaped the output directory: ${relativePath}`);
  }
  return path;
}

async function bundleRuntimeAdapter() {
  const result = await bundle({
    absWorkingDir: repositoryRoot,
    entryPoints: [trustedRuntime],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2022",
    define: {
      "import.meta.url": JSON.stringify("about:blank"),
    },
    legalComments: "inline",
  });
  if (result.outputFiles.length !== 1) {
    throw new Error("The trusted Python adapter build returned an unexpected file set.");
  }
  return result.outputFiles[0].text;
}

async function bundlePythonWorker() {
  const localPyodideRuntime = {
    name: "ten-problems-local-pyodide-runtime",
    setup(build) {
      build.onResolve({ filter: /^\.\.\/types$/ }, (args) => (
        args.importer === pythonWorker
          ? { namespace: "ten-problems-runtime", path: "types" }
          : null
      ));
      build.onLoad(
        { filter: /^types$/, namespace: "ten-problems-runtime" },
        () => ({
          contents: `export * from ${JSON.stringify(pythonTypes)};
export const PYODIDE_CDN_URL = new URL("./pyodide/", import.meta.url).href;
`,
          loader: "ts",
          resolveDir: repositoryRoot,
        }),
      );
    },
  };
  const result = await bundle({
    absWorkingDir: repositoryRoot,
    entryPoints: [pythonWorker],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
    conditions: ["browser", "import"],
    legalComments: "inline",
    plugins: [localPyodideRuntime],
  });
  if (result.outputFiles.length !== 1) {
    throw new Error("The trusted Python worker build returned an unexpected file set.");
  }
  const source = result.outputFiles[0].text;
  if (
    remoteJsDelivrUrlPattern.test(source)
    || !source.includes('new URL("./pyodide/", import.meta.url).href')
  ) {
    throw new Error("The generated Python worker did not bind Pyodide to same-origin assets.");
  }
  return source;
}

async function readPyodideAssets() {
  const files = {};
  const report = [];
  for (const filename of pyodideFiles) {
    const sourcePath = join(pyodidePackage, filename);
    const sourceStats = await lstat(sourcePath);
    if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
      throw new Error(`Pinned Pyodide asset must be a regular file: ${sourcePath}`);
    }
    const sourceBytes = await readFile(sourcePath);
    const bytes = filename.endsWith(".mjs")
      ? Buffer.concat([Buffer.from(generatedLintHeader), sourceBytes])
      : sourceBytes;
    const relativePath = `assets/pyodide/${filename}`;
    files[relativePath] = bytes;
    report.push({
      path: relativePath,
      sourceBytes: sourceBytes.byteLength,
      sourceSha256: sha256(sourceBytes),
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    });
  }
  files["assets/pyodide/NOTICE.txt"] = `Pyodide 314.0.3

The runtime payloads in this directory come from the npm package
pyodide@314.0.3 and are licensed under the Mozilla Public License 2.0. The two
JavaScript module copies have one inert generated ESLint directive prepended;
the trusted-runtime report records both their source and published hashes.
Project and corresponding source: https://github.com/pyodide/pyodide
License: https://www.mozilla.org/MPL/2.0/
`;
  return { files, report };
}

function buildReadme() {
  return `This is a self-hosted Ten Problems Python practice site.

Publish this entire directory on a static host. The portable Question Group
library is declarative data. Reviewed example-local host code adapts those
contracts to the repository's guarded Python Lab worker and evaluates the
data-only assertions. Learner code runs in a fresh worker for each submission,
with a hard execution timeout and bounded structured output.

The site ships the npm-locked Pyodide 314.0.3 core at same-origin static paths,
so running a problem does not fetch a compiler or interpreter from a third
party. Python Lab applies capability guardrails, but is not a hostile-code
security sandbox.

Review is available at /${tenProblemsSiteUi.reviewDirectory}/. It queries
exact-library, device-local progress and does not introduce another content
format.
`;
}

async function writeBuild(files) {
  const existed = await inspectOutput();
  const temporary = await mkdtemp(join(projectRoot, ".dist-build-"));
  try {
    for (const [relativePath, source] of Object.entries(files).sort(
      ([left], [right]) => left.localeCompare(right),
    )) {
      const destination = outputPath(temporary, relativePath);
      await mkdir(dirname(destination), { recursive: true });
      if (typeof source === "string") await writeFile(destination, source, "utf8");
      else await writeFile(destination, source);
    }
    const writtenFiles = (await collectFiles(temporary)).sort();
    const expectedFiles = Object.keys(files).sort();
    if (
      writtenFiles.length !== expectedFiles.length
      || writtenFiles.some((path, index) => path !== expectedFiles[index])
    ) {
      throw new Error("The written practice build does not match its declared file set.");
    }
    if (existed) await rm(output, { recursive: true });
    await rename(temporary, output);
  } catch (error) {
    await rm(temporary, { force: true, recursive: true });
    throw error;
  }
}

const library = JSON.parse(await readFile(libraryPath, "utf8"));
const [runtimeAdapterJavaScript, pythonWorkerJavaScript, pyodide] = await Promise.all([
  bundleRuntimeAdapter(),
  bundlePythonWorker(),
  readPyodideAssets(),
]);
const files = await buildStandaloneQuestionGroupSite(library, {
  runtimeAdapterJavaScript,
  bundledBrowserRuntime: false,
  metaContentSecurityPolicy: tenProblemsMetaContentSecurityPolicy,
  referenceSolutions: tenProblemsReferenceSolutions,
  ui: tenProblemsSiteUi,
});

Object.assign(files, pyodide.files, {
  ".nojekyll": "",
  "_headers": renderTenProblemsHeaders(),
  "README.txt": buildReadme(),
  "assets/python-question.worker.js": pythonWorkerJavaScript,
});
files["trusted-runtime-report.json"] = `${JSON.stringify({
  format: "ten-problems-trusted-runtime",
  schemaVersion: 1,
  runtime: {
    language: "python",
    environment: "host-managed",
    engine: "pyodide",
    engineVersion: "314.0.3",
    selfHosted: true,
  },
  worker: {
    path: "assets/python-question.worker.js",
    derivedFrom: "packages/python-lab/src/worker/python.worker.ts",
    remoteRuntimeUrls: 0,
  },
  assets: pyodide.report,
}, null, 2)}\n`;

const buildReport = JSON.parse(files["build-report.json"]);
buildReport.files = Object.keys(files).sort();
files["build-report.json"] = `${JSON.stringify(buildReport, null, 2)}\n`;

await writeBuild(files);

console.log(JSON.stringify({
  ok: true,
  output,
  route: "/practice/",
  reviewRoute: `/practice/${tenProblemsSiteUi.reviewDirectory}/`,
  files: buildReport.files.length,
}, null, 2));
