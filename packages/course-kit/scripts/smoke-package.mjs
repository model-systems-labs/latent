import { spawn } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
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
    "docs/question-groups.md",
    "schema/learning-pack.schema.json",
    "schema/learning-feed.schema.json",
    "schema/question-group-library.schema.json",
    "schema/question-group-progress.schema.json",
    "bin/latent-learning.mjs",
    "dist/index.js",
    "dist/index.d.ts",
    "dist/learner-ui.js",
    "dist/learner-ui.d.ts",
    "dist/question-group.js",
    "dist/question-group.d.ts",
    "dist/question-player.js",
    "dist/question-player.d.ts",
    "dist/question-progress.js",
    "dist/question-progress.d.ts",
    "dist/question-group-site.js",
    "dist/question-group-site.d.ts",
  ]) {
    await access(join(installed, relativePath));
  }
  await access(join(consumer, "node_modules", ".bin", "latent-learning"));

  await run(process.execPath, [
    "--input-type=module",
    "--eval",
    "import { LEARNING_PACK_FORMAT, QUESTION_GROUP_LIBRARY_FORMAT, validateQuestionGroupLibrary } from '@latent/course-kit'; if (LEARNING_PACK_FORMAT !== 'latent-learning-pack' || QUESTION_GROUP_LIBRARY_FORMAT !== 'latent-question-group-library' || typeof validateQuestionGroupLibrary !== 'function') process.exit(1);",
  ], { cwd: consumer });
  await run(process.execPath, [
    "--input-type=module",
    "--eval",
    "import { QUESTION_GROUP_LIBRARY_SCHEMA_VERSION, questionGroupLibraryJsonSchema } from '@latent/course-kit/question-group'; if (QUESTION_GROUP_LIBRARY_SCHEMA_VERSION !== 1 || !questionGroupLibraryJsonSchema?.properties?.groups) process.exit(1);",
  ], { cwd: consumer });
  await run(process.execPath, [
    "--input-type=module",
    "--eval",
    "import { LEARNER_UI_VERSION, LEARNER_UI_BREAKPOINTS, createLearnerUiCss, renderLearnerHeader } from '@latent/course-kit/learner-ui'; const css = createLearnerUiCss(); const header = renderLearnerHeader({ productName: 'Practice', homeHref: './', navigationLabel: 'Practice navigation', navigation: [{ label: 'Problems', href: './', current: true }] }); if (LEARNER_UI_VERSION !== 1 || LEARNER_UI_BREAKPOINTS.compact !== 760 || !css.includes('--learner-color-accent:') || !header.includes('aria-current=\"page\"')) process.exit(1);",
  ], { cwd: consumer });
  await run(process.execPath, [
    "--input-type=module",
    "--eval",
    "import { createQuestionGroupPlayer } from '@latent/course-kit/question-group-player'; import { isLeechQuestionProgress } from '@latent/course-kit/question-group-progress'; import { buildStandaloneQuestionGroupSite } from '@latent/course-kit/question-group-site'; if (typeof createQuestionGroupPlayer !== 'function' || typeof isLeechQuestionProgress !== 'function' || typeof buildStandaloneQuestionGroupSite !== 'function') process.exit(1);",
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

  const questionGuide = await readFile(join(installed, "docs", "question-groups.md"), "utf8");
  const questionSource = questionGuide.match(/```json\n([\s\S]*?)\n```/)?.[1];
  if (!questionSource) throw new Error("Packaged Question Group guide has no JSON example.");
  const questionPath = join(consumer, "question-group-library.json");
  await writeFile(questionPath, `${questionSource}\n`);
  await run(process.execPath, [
    cli,
    "questions",
    "validate",
    questionPath,
    "--strict",
    "--json",
  ], { cwd: consumer });
  await run(process.execPath, [
    cli,
    "questions",
    "build",
    questionPath,
    "--out-dir",
    join(consumer, "practice-site"),
    "--json",
  ], { cwd: consumer });
  await access(join(consumer, "practice-site", "leeches", "index.html"));
  await access(join(consumer, "practice-site", "assets", "esbuild.wasm"));

  process.stdout.write(`Course Kit tarball passed an isolated install and CLI smoke test: ${tarball}\n`);
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}
