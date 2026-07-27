import { createHash } from "node:crypto";
import {
  copyFile,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build as bundle } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(root, "../../..");
const target = resolve(root, "dist");
const marker = ".latent-platform-build";
const trustedRuntime = join(root, "trusted/python-exercise-runtime.ts");
const pythonWorker = join(
  repositoryRoot,
  "packages/python-lab/src/worker/python.worker.ts",
);
const pyodidePackage = join(repositoryRoot, "node_modules/pyodide");
const pyodideFiles = Object.freeze([
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
]);
const remotePyodideIndex = "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/";

async function inspectTarget() {
  try {
    const stats = await lstat(target);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error("dist must be a real directory.");
    }
    const value = await readFile(join(target, marker), "utf8").catch(() => "");
    if (value.trim() !== "latent-platform-static-v1") {
      throw new Error("Refusing to replace dist without the Latent platform build marker.");
    }
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Build source may not contain symlinks: ${relative(root, path)}`);
    if (entry.isDirectory()) output.push(...await collectFiles(path));
    else if (entry.isFile()) output.push(path);
  }
  return output;
}

const existed = await inspectTarget();
const temporary = await mkdtemp(join(root, ".dist.latent-build-"));
try {
  await Promise.all([
    cp(join(root, "site"), temporary, { recursive: true }),
    cp(join(root, "content"), join(temporary, "content"), { recursive: true }),
    cp(join(root, "trusted"), join(temporary, "trusted"), { recursive: true }),
    cp(join(root, "platform.json"), join(temporary, "platform.json")),
    ...["README.md", "LICENSE", "NOTICE.md", "CONTENT_LICENSE.md"].map((file) => (
      cp(join(root, file), join(temporary, file))
    )),
  ]);
  const assets = join(temporary, "assets");
  await mkdir(assets, { recursive: true });
  await bundle({
    absWorkingDir: repositoryRoot,
    entryPoints: [trustedRuntime],
    outfile: join(assets, "python-runtime.mjs"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    conditions: ["browser", "import"],
    legalComments: "inline",
  });
  await bundle({
    absWorkingDir: repositoryRoot,
    entryPoints: [pythonWorker],
    outfile: join(assets, "python-exercise.worker.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    conditions: ["browser", "import"],
    legalComments: "inline",
  });
  const workerPath = join(assets, "python-exercise.worker.js");
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

  const pyodideOutput = join(assets, "pyodide");
  await mkdir(pyodideOutput, { recursive: true });
  for (const filename of pyodideFiles) {
    const source = join(pyodidePackage, filename);
    const sourceStats = await lstat(source);
    if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
      throw new Error(`Pinned Pyodide asset must be a regular file: ${source}`);
    }
    await copyFile(source, join(pyodideOutput, filename));
  }
  await writeFile(
    join(pyodideOutput, "NOTICE.txt"),
    `Pyodide 314.0.2

The runtime payloads in this directory come from the npm package
pyodide@314.0.2 and are licensed under the Mozilla Public License 2.0.
Project and corresponding source: https://github.com/pyodide/pyodide
License: https://www.mozilla.org/MPL/2.0/
`,
    "utf8",
  );
  await rm(join(temporary, "trusted/python-exercise-runtime.ts"));
  await cp(join(temporary, "index.html"), join(temporary, "404.html"));
  await writeFile(join(temporary, marker), "latent-platform-static-v1\n", "utf8");
  await writeFile(join(temporary, ".nojekyll"), "", "utf8");

  const sourceFiles = [
    join(root, "platform.json"),
    join(root, "README.md"),
    join(root, "LICENSE"),
    join(root, "NOTICE.md"),
    join(root, "CONTENT_LICENSE.md"),
    ...await collectFiles(join(root, "content")),
    ...await collectFiles(join(root, "trusted")),
    ...await collectFiles(join(root, "site")),
  ].sort();
  const digest = createHash("sha256");
  for (const path of sourceFiles) {
    digest.update(relative(root, path));
    digest.update("\0");
    digest.update(await readFile(path));
    digest.update("\0");
  }
  const runtimeAssets = await Promise.all(
    (await collectFiles(assets)).sort().map(async (path) => {
      const bytes = await readFile(path);
      return {
        path: relative(temporary, path),
        bytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    }),
  );
  await writeFile(join(temporary, "build-report.json"), `${JSON.stringify({
    format: "latent-platform-build",
    schemaVersion: 1,
    sourceSha256: digest.digest("hex"),
    pythonRuntime: {
      engine: "pyodide",
      engineVersion: "314.0.2",
      assets: runtimeAssets,
    },
  }, null, 2)}\n`, "utf8");

  if (existed) await rm(target, { recursive: true });
  await rename(temporary, target);
  console.log(JSON.stringify({ ok: true, output: target }, null, 2));
} catch (error) {
  await rm(temporary, { recursive: true, force: true });
  throw error;
}
