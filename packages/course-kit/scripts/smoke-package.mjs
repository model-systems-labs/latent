import { spawn } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const temporaryRoot = await mkdtemp(join(tmpdir(), "latent-course-kit-consumer-"));

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? packageRoot,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", rejectRun);
    child.once("close", (exitCode) => {
      if (exitCode === (options.expectedExitCode ?? 0)) {
        resolveRun({ stdout, stderr });
      } else {
        rejectRun(new Error(
          `${command} ${args.join(" ")} exited ${exitCode}\n${stdout}\n${stderr}`,
        ));
      }
    });
  });
}

try {
  let tarball = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : null;
  if (!tarball) {
    const packDirectory = join(temporaryRoot, "pack");
    await mkdir(packDirectory);
    await run("npm", ["pack", "--pack-destination", packDirectory]);
    const candidates = (await readdir(packDirectory))
      .filter((entry) => entry.endsWith(".tgz"));
    if (candidates.length !== 1) {
      throw new Error(`Expected one Course Kit tarball, found ${candidates.length}.`);
    }
    tarball = join(packDirectory, candidates[0]);
  }
  await access(tarball);
  await run("npm", [
    "exec",
    "--yes",
    "--package",
    tarball,
    "--",
    "latent-learning",
    "--help",
  ], { cwd: temporaryRoot });

  const consumer = join(temporaryRoot, "consumer");
  await run("npm", [
    "install",
    "--prefix",
    consumer,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    tarball,
  ]);

  const installed = join(consumer, "node_modules", "@latent", "course-kit");
  for (const relativePath of [
    "LICENSE",
    "README.md",
    "docs/open-learning.md",
    "docs/learning-pack-quality-rubric.md",
    "schema/learning-pack.schema.json",
    "schema/learning-feed.schema.json",
    "bin/latent-learning.mjs",
    "dist/index.js",
    "dist/index.d.ts",
  ]) {
    await access(join(installed, relativePath));
  }
  await access(join(consumer, "node_modules", ".bin", "latent-learning"));

  await run(process.execPath, [
    "--input-type=module",
    "--eval",
    "import { LEARNING_PACK_FORMAT } from '@latent/course-kit'; if (LEARNING_PACK_FORMAT !== 'latent-learning-pack') process.exit(1);",
  ], { cwd: consumer });

  const cli = join(installed, "bin", "latent-learning.mjs");
  await run(process.execPath, [cli, "--help"], { cwd: consumer });
  await run("npm", ["exec", "--offline", "--", "latent-learning", "--help"], { cwd: consumer });
  const source = join(consumer, "learning-pack.json");
  await copyFile(
    resolve(repositoryRoot, "examples/open-learning/reliable-llm-changes/learning-pack.json"),
    source,
  );
  await run(process.execPath, [cli, "validate", source, "--strict", "--json"], { cwd: consumer });
  await run(process.execPath, [
    cli,
    "build",
    source,
    "--out-dir",
    join(consumer, "site"),
    "--json",
  ], { cwd: consumer });
  await access(join(consumer, "site", "learning-feed.json"));

  process.stdout.write(`Course Kit tarball passed an isolated install and CLI smoke test: ${tarball}\n`);
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}
