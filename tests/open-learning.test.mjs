import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { relative } from "node:path";
import { createServer } from "#vite-test-server";

import {
  buildStandaloneLearningSite,
  canonicalLearningPackJson,
  createLearningFeed,
  learningFeedJsonSchema,
  learningPackJsonSchema,
} from "@latent/course-kit";

const root = new URL("../", import.meta.url);
const exampleUrl = new URL("examples/open-learning/reliable-llm-changes/learning-pack.json", root);
const generatedUrl = new URL("public/open-learning/reliable-llm-changes/", root);
const example = JSON.parse(await readFile(exampleUrl, "utf8"));

async function loadOpenLearningModule() {
  const vite = await createServer({
    root: fileURLToPath(root),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  const openLearning = await vite.ssrLoadModule("/app/lib/open-learning.ts");
  return { openLearning, close: () => vite.close() };
}

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

test("hosted feed URL policy permits HTTPS and loopback preview only", async () => {
  const { openLearning, close } = await loadOpenLearningModule();
  try {
    assert.equal(
      openLearning.allowedHostedFeedUrl("/feed.json", "https://publisher.example/open/").toString(),
      "https://publisher.example/feed.json",
    );
    assert.equal(
      openLearning.allowedHostedFeedUrl("http://127.0.0.1:4173/feed.json", "https://latent.example/").hostname,
      "127.0.0.1",
    );
    assert.throws(
      () => openLearning.allowedHostedFeedUrl("http://publisher.example/feed.json", "https://latent.example/"),
      /HTTPS/,
    );
    assert.throws(
      () => openLearning.allowedHostedFeedUrl("file:///tmp/feed.json", "https://latent.example/"),
      /HTTPS/,
    );
    assert.throws(
      () => openLearning.allowedHostedFeedUrl(
        "https://publisher:secret@publisher.example/feed.json",
        "https://latent.example/",
      ),
      /credentials/,
    );
  } finally {
    await close();
  }
});

test("package resolution stays on the verified feed origin", async () => {
  const { openLearning, close } = await loadOpenLearningModule();
  try {
    const feed = new URL("https://publisher.example/learning/feed.json");
    assert.equal(
      openLearning.resolveSameOriginPackageUrl(feed, "./learning-pack.json").toString(),
      "https://publisher.example/learning/learning-pack.json",
    );
    assert.throws(
      () => openLearning.resolveSameOriginPackageUrl(feed, "//attacker.example/pack.json"),
      /origin/,
    );
  } finally {
    await close();
  }
});

test("hosted packages must match feed bytes, digest, identity, and canonical JSON", async () => {
  const { openLearning, close } = await loadOpenLearningModule();
  try {
    const source = canonicalLearningPackJson(example);
    const digest = sha256(source);
    const feed = createLearningFeed(example, digest, { bytes: Buffer.byteLength(source) });
    const entry = feed.packages[0];
    const bytes = new TextEncoder().encode(source);
    assert.equal(openLearning.verifyHostedPackage(bytes, entry, digest).package.id, example.package.id);
    assert.throws(
      () => openLearning.verifyHostedPackage(new TextEncoder().encode(`${source} `), entry, digest),
      /byte count/i,
    );
    assert.throws(() => openLearning.verifyHostedPackage(bytes, entry, "0".repeat(64)), /integrity/i);
    assert.throws(
      () => openLearning.verifyHostedPackage(new TextEncoder().encode(JSON.stringify(example)), entry, digest),
      /byte count|canonical/i,
    );
    const invalidUtf8 = new Uint8Array(bytes);
    invalidUtf8[100] = 0xff;
    const invalidDigest = sha256(invalidUtf8);
    const invalidEntry = { ...entry, bytes: invalidUtf8.byteLength, sha256: invalidDigest };
    assert.throws(
      () => openLearning.verifyHostedPackage(invalidUtf8, invalidEntry, invalidDigest),
      /UTF-8/i,
    );
  } finally {
    await close();
  }
});

test("installation and progress keys isolate publisher, package, and version", async () => {
  const { openLearning, close } = await loadOpenLearningModule();
  try {
    assert.notEqual(
      openLearning.installedLearningPackKey("https://one.example/feed.json", "publisher/topic", "1.0.0"),
      openLearning.installedLearningPackKey("https://two.example/feed.json", "publisher/topic", "1.0.0"),
    );
    assert.notEqual(
      openLearning.learningProgressKey("https://one.example/feed.json", "publisher/topic", "1.0.0", "a".repeat(64)),
      openLearning.learningProgressKey("https://one.example/feed.json", "publisher/topic", "1.0.0", "b".repeat(64)),
    );
  } finally {
    await close();
  }
});

test("the committed standalone example exactly matches a fresh deterministic build", async () => {
  const files = await buildStandaloneLearningSite(example);
  const committed = await readdir(generatedUrl, { recursive: true, withFileTypes: true });
  const generatedPath = fileURLToPath(generatedUrl);
  const committedFiles = committed
    .filter((entry) => entry.isFile())
    .map((entry) => relative(generatedPath, `${entry.parentPath}/${entry.name}`))
    .sort();
  assert.deepEqual(committedFiles, Object.keys(files).sort());
  for (const [path, expected] of Object.entries(files)) {
    assert.equal(await readFile(new URL(path, generatedUrl), "utf8"), expected, path);
  }
});

test("committed public schemas exactly match Course Kit", async () => {
  const expectedPack = `${JSON.stringify(learningPackJsonSchema, null, 2)}\n`;
  const expectedFeed = `${JSON.stringify(learningFeedJsonSchema, null, 2)}\n`;
  for (const [path, expected] of [
    ["docs/learning-pack.schema.json", expectedPack],
    ["docs/learning-feed.schema.json", expectedFeed],
    ["public/open-learning/learning-pack.schema.json", expectedPack],
    ["public/open-learning/learning-feed.schema.json", expectedFeed],
  ]) {
    assert.equal(await readFile(new URL(path, root), "utf8"), expected, path);
  }
});

test("the live LLM entrypoint and public workflow documents are self-contained", async () => {
  for (const [sourcePath, publicPath, transform = (source) => source] of [
    [
      "docs/open-learning.md",
      "public/open-learning/guide.md",
      (source) => source.replace(
        "../examples/open-learning/reliable-llm-changes/learning-pack.json",
        "./reliable-llm-changes/learning-pack.json",
      ),
    ],
    ["docs/learning-pack-quality-rubric.md", "public/open-learning/quality-rubric.md"],
    ["skills/author-learning-pack/SKILL.md", "public/open-learning/skills/author-learning-pack.md"],
    ["skills/review-learning-pack/SKILL.md", "public/open-learning/skills/review-learning-pack.md"],
    ["skills/publish-learning-pack/SKILL.md", "public/open-learning/skills/publish-learning-pack.md"],
    ["skills/author-learning-platform/SKILL.md", "public/skills/author-learning-platform.md"],
    ["skills/author-course/SKILL.md", "public/skills/author-course.md"],
    ["skills/author-flash-card-deck/SKILL.md", "public/skills/author-flash-card-deck.md"],
    ["skills/author-question-group/SKILL.md", "public/skills/author-question-group.md"],
    ["skills/author-ide-exercise/SKILL.md", "public/skills/author-ide-exercise.md"],
    ["skills/review-learning-design/SKILL.md", "public/skills/review-learning-design.md"],
    ["skills/publish-learning-platform/SKILL.md", "public/skills/publish-learning-platform.md"],
  ]) {
    assert.equal(
      await readFile(new URL(publicPath, root), "utf8"),
      transform(await readFile(new URL(sourcePath, root), "utf8")),
      publicPath,
    );
  }
  const llms = await readFile(new URL("public/llms.txt", root), "utf8");
  assert.doesNotMatch(llms, /github\.com\/model-systems-labs\/latent\/(?:blob|tree)\/main/);
  for (const path of [
    "/open-learning/skills/author-learning-pack.md",
    "/open-learning/skills/review-learning-pack.md",
    "/open-learning/skills/publish-learning-pack.md",
    "/skills/author-learning-platform.md",
    "/skills/author-course.md",
    "/skills/author-flash-card-deck.md",
    "/skills/author-question-group.md",
    "/skills/author-ide-exercise.md",
    "/skills/review-learning-design.md",
    "/skills/publish-learning-platform.md",
  ]) {
    assert.ok(llms.includes(path), `public/llms.txt does not discover ${path}`);
  }
  assert.match(llms, /course-kit-v0\.2\.0/);
  assert.match(llms, /Community Learning Pack/);
  assert.match(llms, /Question Groups may contain learner starter source/);
  assert.match(llms, /never publisher-authored executable tests/);
});

test("community rendering stays declarative and outside privileged runtimes", async () => {
  const [reader, publisher, helper] = await Promise.all([
    readFile(new URL("app/open-learning/HostedLearningReader.tsx", root), "utf8"),
    readFile(new URL("app/open-learning/LearningPackPublisher.tsx", root), "utf8"),
    readFile(new URL("app/lib/open-learning.ts", root), "utf8"),
  ]);
  const source = `${reader}\n${publisher}\n${helper}`;
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|\beval\s*\(|new Function|browser-lab|python-lab|Worker\s*\(/);
  assert.match(reader, /credentials: "omit"/);
  assert.match(reader, /referrerPolicy: "no-referrer"/);
  assert.match(reader, /redirect: "error"/);
  assert.match(reader, /response\.body\.getReader\(\)/);
  assert.match(reader, /hostedRequestGeneration/);
  assert.match(reader, /requestGeneration !== hostedRequestGeneration\.current/);
  assert.match(reader, /setFeedInput\(parsed\.feedUrl\)/);
  assert.match(reader, /key=\{`\$\{hostedPreview\.feedUrl\}:\$\{hostedPreview\.sha256\}`\}/);
  assert.match(publisher, /Resolve every quality warning/);
  assert.match(reader, /Save on this device/);
  assert.match(reader, /Not reviewed by Latent/);
  assert.match(reader, /Hosted at \{publisherHost\} · Identity not verified/);
});
