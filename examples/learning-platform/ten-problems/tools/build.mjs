import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build as bundle } from "esbuild";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(projectRoot, "../../..");
const cli = join(repositoryRoot, "packages/course-kit/bin/latent-learning.mjs");
const library = join(projectRoot, "content/question-groups.json");
const output = join(projectRoot, "dist");
const assets = join(output, "assets");
const trustedRuntime = join(
  projectRoot,
  "trusted/python-question-runtime.ts",
);
const pythonWorker = join(
  repositoryRoot,
  "packages/python-lab/src/worker/python.worker.ts",
);
const pyodidePackage = join(repositoryRoot, "node_modules/pyodide");
const pyodideOutput = join(assets, "pyodide");
const pyodideFiles = [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];
const remotePyodideIndex = "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/";

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
    });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(
        signal
          ? `Practice build stopped with ${signal}.`
          : `Practice build exited with code ${code}.`,
      ));
    });
  });
}

async function replaceExact(relativePath, replacements) {
  const path = join(output, relativePath);
  let source = await readFile(path, "utf8");
  for (const [before, after] of replacements) {
    if (!source.includes(before)) {
      throw new Error(`Expected generated text was missing from ${relativePath}: ${before}`);
    }
    source = source.replaceAll(before, after);
  }
  await writeFile(path, source, "utf8");
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => (
    left.name.localeCompare(right.name)
  ))) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Practice output may not contain symlinks: ${path}`);
    }
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else if (entry.isFile()) files.push(relative(output, path));
  }
  return files;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

await run(process.execPath, [
  cli,
  "questions",
  "build",
  library,
  "--out-dir",
  output,
  "--json",
]);

const stats = await lstat(output);
if (!stats.isDirectory() || stats.isSymbolicLink()) {
  throw new Error("The practice build output must be a real directory.");
}

await bundle({
  absWorkingDir: repositoryRoot,
  entryPoints: [trustedRuntime],
  outfile: join(assets, "runtime-adapter.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  define: {
    "import.meta.url": JSON.stringify("about:blank"),
  },
  legalComments: "inline",
});
await bundle({
  absWorkingDir: repositoryRoot,
  entryPoints: [pythonWorker],
  outfile: join(assets, "python-question.worker.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  conditions: ["browser", "import"],
  legalComments: "inline",
});
const workerPath = join(assets, "python-question.worker.js");
const remoteWorker = await readFile(workerPath, "utf8");
const remoteLiteral = JSON.stringify(remotePyodideIndex);
const remoteOccurrences = remoteWorker.split(remoteLiteral).length - 1;
if (remoteOccurrences !== 1) {
  throw new Error(
    `Expected one pinned Pyodide index in the reviewed worker, found ${remoteOccurrences}.`,
  );
}
const localWorker = remoteWorker.replace(
  remoteLiteral,
  "new URL(\"./pyodide/\", import.meta.url).href",
);
if (localWorker.includes(remotePyodideIndex)) {
  throw new Error("The generated Python worker retained a remote runtime URL.");
}
await writeFile(workerPath, localWorker, "utf8");

await mkdir(pyodideOutput, { recursive: true });
const pyodideAssets = [];
for (const filename of pyodideFiles) {
  const source = join(pyodidePackage, filename);
  const destination = join(pyodideOutput, filename);
  const sourceStats = await lstat(source);
  if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
    throw new Error(`Pinned Pyodide asset must be a regular file: ${source}`);
  }
  await copyFile(source, destination);
  const sourceBytes = await readFile(destination);
  const bytes = filename.endsWith(".mjs")
    ? Buffer.concat([
      Buffer.from("/* eslint-disable -- generated third-party runtime */\n"),
      sourceBytes,
    ])
    : sourceBytes;
  if (bytes !== sourceBytes) await writeFile(destination, bytes);
  pyodideAssets.push({
    path: `assets/pyodide/${filename}`,
    sourceBytes: sourceBytes.byteLength,
    sourceSha256: sha256(sourceBytes),
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  });
}
await writeFile(
  join(pyodideOutput, "NOTICE.txt"),
  `Pyodide 314.0.2

The runtime payloads in this directory come from the npm package
pyodide@314.0.2 and are licensed under the Mozilla Public License 2.0. The two
JavaScript module copies have one inert generated ESLint directive prepended;
the trusted-runtime report records both their source and published hashes.
Project and corresponding source: https://github.com/pyodide/pyodide
License: https://www.mozilla.org/MPL/2.0/
`,
  "utf8",
);

for (const obsolete of [
  "assets/esbuild.js",
  "assets/esbuild.wasm",
  "assets/sandbox.worker.js",
]) {
  await rm(join(output, obsolete));
}

const navigationReplacements = [
  ["latent practice", "Ten Problems"],
  ["All questions", "Problems"],
  ["Leech review", "Review misses"],
];
await replaceExact("index.html", navigationReplacements);
await replaceExact("leeches/index.html", navigationReplacements);
await replaceExact("index.html", [[
  "  <script src=\"./assets/esbuild.js\" defer></script>\n",
  "",
]]);
await replaceExact("leeches/index.html", [[
  "  <script src=\"../assets/esbuild.js\" defer></script>\n",
  "",
]]);
await replaceExact("assets/player.js", [
  ["Progress query · leeches", "Repeated misses"],
  ["Question Group library", "Problem set"],
  [
    "No leeches yet. A question appears here after at least three attempts and two misses, and leaves when solved.",
    "No repeated misses yet. A problem appears here after three attempts and two misses, and leaves when solved.",
  ],
  ["This library has no questions.", "This problem set is empty."],
  [
    "Running in an isolated browser worker…",
    "Starting Python in a fresh browser worker…",
  ],
]);

await writeFile(join(output, "assets", "player.css"), `${await readFile(
  join(output, "assets", "player.css"),
  "utf8",
)}

/* Learner-facing example theme. The portable problem library remains unchanged. */
:root {
  --paper: #f3f5f8;
  --panel: #ffffff;
  --ink: #171a21;
  --muted: #626a78;
  --line: rgba(23, 26, 33, .14);
  --violet: #3159d9;
  --green: #16724a;
}
.wordmark {
  font-size: .9rem;
  letter-spacing: -.01em;
  text-transform: none;
}
.library h1,
.question-copy h2 {
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-weight: 720;
}
.question-copy h2 {
  font-size: clamp(2rem, 3.6vw, 3.2rem);
  letter-spacing: -.045em;
}
.question-link[aria-current="true"] {
  background: #e8edff;
}
textarea {
  background: #fbfcfe;
}
`, "utf8");

await writeFile(join(output, "assets", "favicon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#171a21"/>
  <path d="M25 20 14 32l11 12M39 20l11 12-11 12" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="5"/>
</svg>
`, "utf8");
await writeFile(join(output, ".nojekyll"), "", "utf8");
await writeFile(join(output, "_headers"), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()
  Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'

/assets/python-question.worker.js
  Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; connect-src 'self'; object-src 'none'

/question-group-library.json
  Access-Control-Allow-Origin: *
  Cache-Control: no-cache
`, "utf8");
await writeFile(join(output, "README.txt"), `This is a self-hosted Ten Problems Python practice site.

Publish this entire directory on a static host. The portable Question Group
library is declarative data. Reviewed example-local host code adapts those
contracts to the repository's guarded Python Lab worker and evaluates the
data-only assertions. Learner code runs in a fresh worker for each submission,
with a hard execution timeout and bounded structured output.

The site ships the npm-locked Pyodide 314.0.2 core at same-origin static paths,
so running a problem does not fetch a compiler or interpreter from a third
party. Python Lab applies capability guardrails, but is not a hostile-code
security sandbox.

The leech-only view is /leeches/. It queries exact-library, device-local
progress and does not introduce another content format.
`, "utf8");
await writeFile(
  join(output, "trusted-runtime-report.json"),
  `${JSON.stringify({
    format: "ten-problems-trusted-runtime",
    schemaVersion: 1,
    runtime: {
      language: "python",
      environment: "host-managed",
      engine: "pyodide",
      engineVersion: "314.0.2",
      selfHosted: true,
    },
    worker: {
      path: "assets/python-question.worker.js",
      derivedFrom: "packages/python-lab/src/worker/python.worker.ts",
      remoteRuntimeUrls: 0,
    },
    assets: pyodideAssets,
  }, null, 2)}\n`,
  "utf8",
);

const buildReportPath = join(output, "build-report.json");
const buildReport = JSON.parse(await readFile(buildReportPath, "utf8"));
buildReport.files = (await collectFiles(output))
  .filter((path) => path !== "build-report.json")
  .concat("build-report.json")
  .sort();
await writeFile(
  buildReportPath,
  `${JSON.stringify(buildReport, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify({
  ok: true,
  output,
  route: "/practice/",
}, null, 2));
