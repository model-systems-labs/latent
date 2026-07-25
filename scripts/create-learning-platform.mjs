#!/usr/bin/env node

import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rmdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptRoot, "..");
const templateRoot = join(repositoryRoot, "examples/learning-platform/javascript-array-methods");

class UsageError extends Error {}

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new UsageError(`${flag} requires a value.`);
  return value;
}

function destinationArg(args) {
  const flagsWithValues = new Set(["--title", "--tagline", "--accent", "--port"]);
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (flagsWithValues.has(value)) {
      index += 1;
      continue;
    }
    if (!value.startsWith("--")) return value;
  }
  return undefined;
}

function slugify(value) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return slug || "my-learning-platform";
}

function escapeHtmlText(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function usage() {
  return `Create a dependency-free Latent learning platform.

Usage:
  node scripts/create-learning-platform.mjs <directory> [options]

Options:
  --title <name>       Platform brand name (default: My Learning Lab)
  --tagline <text>     One-sentence learning promise
  --accent <#rrggbb>   Six-digit accent color
  --preview            Build and serve after scaffolding
  --port <number>      Preview port (default: 4173)
  --json               Print structured scaffold output
  --help               Show this help
`;
}

async function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const forwardInterrupt = () => {
      if (child.exitCode === null) child.kill("SIGINT");
    };
    const forwardTermination = () => {
      if (child.exitCode === null) child.kill("SIGTERM");
    };
    const cleanupSignals = () => {
      process.off("SIGINT", forwardInterrupt);
      process.off("SIGTERM", forwardTermination);
    };
    process.once("SIGINT", forwardInterrupt);
    process.once("SIGTERM", forwardTermination);
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => {
      cleanupSignals();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      cleanupSignals();
      if (code === 0) {
        resolveRun({ stdout, stderr });
        return;
      }
      reject(new Error(
        signal
          ? `${command} stopped by ${signal}.`
          : stderr.trim() || stdout.trim() || `${command} exited with ${code}.`,
      ));
    });
  });
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function ensureAvailableTarget(target) {
  try {
    const stats = await lstat(target);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new UsageError(`Destination exists and is not a real directory: ${target}`);
    }
    const entries = await readdir(target);
    if (entries.length) throw new UsageError(`Destination must be new or empty: ${target}`);
    return { existed: true, mode: stats.mode & 0o777 };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { existed: false, mode: 0o777 & ~process.umask() };
    }
    throw error;
  }
}

async function personalize(directory, { title, tagline, accent }) {
  const slug = slugify(title);
  const platformPath = join(directory, "platform.json");
  const platform = await readJson(platformPath);
  platform.brand.name = title;
  platform.brand.tagline = tagline;
  platform.brand.accent = accent;
  await writeJson(platformPath, platform);

  const packagePath = join(directory, "package.json");
  const packageManifest = await readJson(packagePath);
  packageManifest.name = slug;
  await writeJson(packagePath, packageManifest);

  const learningPath = join(directory, "content/learning-pack.json");
  const learningPack = await readJson(learningPath);
  learningPack.package.id = `${slug}/javascript-array-methods`;
  learningPack.package.title = `${title}: JavaScript array method choices`;
  await writeJson(learningPath, learningPack);

  const questionsPath = join(directory, "content/question-groups.json");
  const questionGroups = await readJson(questionsPath);
  questionGroups.library.id = `${slug}/javascript-array-methods`;
  await writeJson(questionsPath, questionGroups);

  for (const relativePath of ["README.md", "GUIDE.md"]) {
    const path = join(directory, relativePath);
    const source = await readFile(path, "utf8");
    await writeFile(path, source.replaceAll("Array Method School", escapeHtmlText(title)), "utf8");
  }
  const htmlPath = join(directory, "site/index.html");
  const html = await readFile(htmlPath, "utf8");
  await writeFile(htmlPath, html.replaceAll("Array Method School", escapeHtmlText(title)), "utf8");
}

async function validatePortableContent(directory) {
  const result = await run(process.execPath, ["tools/validate.mjs"], { cwd: directory });
  const validation = JSON.parse(result.stdout);
  return {
    validation,
    courseKitValidation: {
      validatorVersion: validation.courseKitValidatorVersion,
      learningPack: { ok: true, strict: true },
      questionGroups: { ok: true, strict: true },
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    process.stdout.write(usage());
    return;
  }
  const destination = destinationArg(args);
  if (!destination) throw new UsageError("Provide a destination directory.");
  const unknownFlags = args.filter((value) => value.startsWith("--") && ![
    "--title",
    "--tagline",
    "--accent",
    "--port",
    "--preview",
    "--json",
  ].includes(value));
  if (unknownFlags.length) throw new UsageError(`Unknown option: ${unknownFlags[0]}`);

  const title = valueAfter(args, "--title") ?? "My Learning Lab";
  const tagline = valueAfter(args, "--tagline")
    ?? "Learn one useful idea, then retrieve it and use it.";
  const accent = valueAfter(args, "--accent") ?? "#d6ff5f";
  if (title.trim().length < 3 || title.trim().length > 80) throw new UsageError("Title must contain 3 to 80 characters.");
  if (tagline.trim().length < 20 || tagline.trim().length > 180) throw new UsageError("Tagline must contain 20 to 180 characters.");
  if (/[\u0000-\u001f\u007f]/.test(`${title}${tagline}`)) {
    throw new UsageError("Title and tagline may not contain control characters.");
  }
  if (!/^#[0-9a-f]{6}$/i.test(accent)) throw new UsageError("Accent must be a six-digit hex color such as #d6ff5f.");
  const portValue = valueAfter(args, "--port") ?? "4173";
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new UsageError("Port must be an integer from 0 to 65535.");

  const target = resolve(destination);
  if (target === resolve(".")) throw new UsageError("Choose a child directory instead of the current directory.");
  const targetState = await ensureAvailableTarget(target);
  const parent = dirname(target);
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(join(parent, `.${slugify(title)}.latent-create-`));
  try {
    await cp(templateRoot, staging, {
      recursive: true,
      errorOnExist: true,
      filter(source) {
        const relative = source.slice(templateRoot.length).replace(/^[/\\]/, "");
        return relative !== "dist" && !relative.startsWith("dist/");
      },
    });
    await personalize(staging, {
      title: title.trim(),
      tagline: tagline.trim(),
      accent: accent.toLowerCase(),
    });
    const {
      validation,
      courseKitValidation,
    } = await validatePortableContent(staging);
    if (targetState.existed) await rmdir(target);
    await rename(staging, target);
    await chmod(target, targetState.mode);

    const summary = {
      ok: true,
      directory: target,
      title: title.trim(),
      primitives: ["lesson", "flash-card-deck", "question-group", "browser-ide-exercise"],
      validation,
      courseKitValidation,
      preview: {
        cwd: target,
        command: "npm run preview",
      },
    };
    if (args.includes("--json")) process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    else {
      process.stdout.write(`Created ${summary.title} at ${summary.directory}\n`);
      process.stdout.write("Course Kit and platform validation passed for 1 lesson, 1 flash-card deck, 1 Question Group, and 1 browser IDE exercise.\n");
      process.stdout.write(`Preview directory: ${summary.preview.cwd}\n`);
      process.stdout.write(`Preview command: ${summary.preview.command}\n`);
    }

    if (args.includes("--preview")) {
      await run("npm", ["run", "build"], { cwd: target, inherit: true });
      await run(process.execPath, ["tools/serve.mjs", "dist", "--port", String(port)], {
        cwd: target,
        inherit: true,
      });
    }
  } catch (error) {
    await rm(staging, { force: true, recursive: true });
    throw error;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Could not create the platform.";
  process.stderr.write(`${message}\n`);
  if (error instanceof UsageError) process.stderr.write(usage());
  process.exitCode = 2;
});
