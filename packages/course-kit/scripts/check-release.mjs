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

const pinnedRelease =
  `https://github.com/model-systems-labs/latent/releases/download/${expectedTag}/latent-course-kit-${manifest.version}.tgz`;
const installDocumentation = [
  "README.md",
  "packages/course-kit/README.md",
  "docs/open-learning.md",
  "skills/author-learning-pack/SKILL.md",
  "skills/review-learning-pack/SKILL.md",
  "skills/publish-learning-pack/SKILL.md",
];
const releaseUrlPattern =
  /https:\/\/github\.com\/model-systems-labs\/latent\/releases\/download\/course-kit-v[^/\s)"'`]+\/latent-course-kit-[^/\s)"'`]+\.tgz/g;

for (const relativePath of installDocumentation) {
  const source = await readFile(resolve(repositoryRoot, relativePath), "utf8");
  if (!source.includes(pinnedRelease)) {
    fail(`${relativePath} must include the pinned public release ${pinnedRelease}.`);
  }
  for (const documentedRelease of source.match(releaseUrlPattern) ?? []) {
    if (documentedRelease !== pinnedRelease) {
      fail(`${relativePath} contains stale Course Kit release ${documentedRelease}.`);
    }
  }
}

const releaseStatus = JSON.parse(
  await readFile(resolve(repositoryRoot, "docs/release-status.json"), "utf8"),
);
if (releaseStatus?.schemaVersion !== 1) {
  fail('docs/release-status.json schemaVersion must be 1.');
}
const courseKitStatus = releaseStatus?.courseKit;
for (const [field, actual, expected] of [
  ["sourceVersion", courseKitStatus?.sourceVersion, manifest.version],
  ["state", courseKitStatus?.state, "released"],
  ["latestPublishedVersion", courseKitStatus?.latestPublishedVersion, manifest.version],
  ["latestPublishedTag", courseKitStatus?.latestPublishedTag, expectedTag],
  ["installUrl", courseKitStatus?.installUrl, pinnedRelease],
  ["npmState", courseKitStatus?.npmState, "unpublished"],
  ["questionGroupSchemaState", courseKitStatus?.questionGroupSchemaState, "published"],
]) {
  if (actual !== expected) {
    fail(`docs/release-status.json courseKit.${field} must be "${expected}", received "${actual ?? ""}".`);
  }
}

const launchContract = await readFile(
  resolve(repositoryRoot, "docs/v0.2-launch-contract.md"),
  "utf8",
);
if (!launchContract.includes("Status: **released**")) {
  fail("docs/v0.2-launch-contract.md must declare Status: **released**.");
}
if (/not yet released|implementation incomplete/i.test(launchContract)) {
  fail("docs/v0.2-launch-contract.md still contains a pre-release status marker.");
}
if (
  !launchContract.includes(
    `\`course-kit-v${manifest.version}\` is the latest published Course Kit release.`,
  )
) {
  fail(`docs/v0.2-launch-contract.md must identify ${expectedTag} as the latest published release.`);
}
if (/repository source is preparing/i.test(launchContract)) {
  fail("docs/v0.2-launch-contract.md still describes the source as preparing a release.");
}

for (const relativePath of [
  "README.md",
  "packages/course-kit/README.md",
  "docs/question-groups.md",
  "packages/course-kit/docs/question-groups.md",
  "public/question-groups/guide.md",
  "public/llms.txt",
]) {
  const source = await readFile(resolve(repositoryRoot, relativePath), "utf8");
  if (
    /\bunreleased\b|not yet released|may return `?404`?|source tree is preparing|not release artifacts until/i.test(
      source,
    )
  ) {
    fail(`${relativePath} still contains a pre-release availability marker.`);
  }
}

for (const relativePath of [
  "docs/architecture.md",
  "docs/question-groups.md",
  "packages/course-kit/docs/question-groups.md",
  "public/question-groups/guide.md",
]) {
  const source = await readFile(resolve(repositoryRoot, relativePath), "utf8");
  if (/\bpreview\b/i.test(source)) {
    fail(`${relativePath} still describes the released Question Group contract as preview.`);
  }
}

for (const relativePath of [
  "README.md",
  "AGENTS.md",
  "docs/v0.2-launch-contract.md",
  "packages/course-kit/README.md",
  "public/llms.txt",
]) {
  const source = await readFile(resolve(repositoryRoot, relativePath), "utf8");
  const markdownBlocks = source.split(
    /\n(?=\s*(?:[-*+] |\d+\. |#{1,6} ))|\n\s*\n/,
  );
  if (
    markdownBlocks.some(
      (block) =>
        /question[- ]groups?/i.test(block) && /\bpreview\b/i.test(block),
    )
  ) {
    fail(`${relativePath} still describes the released Question Group contract as preview.`);
  }
}

const changelog = await readFile(resolve(repositoryRoot, "CHANGELOG.md"), "utf8");
const releaseHeading = `## [${manifest.version}] - `;
const releaseComparison = changelog
  .split("\n")
  .find((line) =>
    line.startsWith(
      `[${manifest.version}]: https://github.com/model-systems-labs/latent/compare/`,
    ),
  );

if (!changelog.includes(releaseHeading)) {
  fail(`CHANGELOG.md must contain a dated ${releaseHeading.trim()} section.`);
}
if (!releaseComparison?.endsWith(`...${expectedTag}`)) {
  fail(`CHANGELOG.md must link version ${manifest.version} to ${expectedTag}.`);
}
const releaseStart = changelog.indexOf(releaseHeading);
if (releaseStart >= 0) {
  const afterHeading = changelog.slice(releaseStart + releaseHeading.length);
  const nextHeadingOffset = afterHeading.search(/^## /m);
  const releaseSection =
    nextHeadingOffset >= 0 ? afterHeading.slice(0, nextHeadingOffset) : afterHeading;
  if (/\bcandidate\b|\bunreleased\b|\bpreview\b|not yet released|pre-release/i.test(releaseSection)) {
    fail(`CHANGELOG.md ${manifest.version} release section still contains pre-release wording.`);
  }
}

if (!process.exitCode) {
  process.stdout.write(`Course Kit ${manifest.version} matches ${expectedTag} and its registry-independent documentation.\n`);
}
