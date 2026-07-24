import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const manifest = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
const expectedTag = `course-kit-v${manifest.version}`;

function fail(message) {
  process.stderr.write(`Course Kit release check failed: ${message}\n`);
  process.exitCode = 1;
}

if (tag !== expectedTag) {
  fail(`tag "${tag ?? ""}" must exactly match "${expectedTag}".`);
}
if (manifest.private === true) fail("package must not be private.");
if (manifest.license !== "Apache-2.0") fail("package license must be Apache-2.0.");
if (manifest.publishConfig?.access !== "public") fail("publishConfig.access must be public.");
if (manifest.bin?.["latent-learning"] !== "bin/latent-learning.mjs") {
  fail("latent-learning must resolve to bin/latent-learning.mjs.");
}

const pinnedCommand = `@latent/course-kit@${manifest.version}`;
for (const relativePath of [
  "packages/course-kit/README.md",
  "docs/open-learning.md",
  "skills/author-learning-pack/SKILL.md",
  "skills/review-learning-pack/SKILL.md",
  "skills/publish-learning-pack/SKILL.md",
]) {
  const source = await readFile(resolve(repositoryRoot, relativePath), "utf8");
  if (!source.includes(pinnedCommand)) {
    fail(`${relativePath} must include the pinned consumer command ${pinnedCommand}.`);
  }
}

if (!process.exitCode) {
  process.stdout.write(`Course Kit ${manifest.version} matches ${expectedTag} and its pinned documentation.\n`);
}
