import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const pluginRoot = path.join(root, "plugins/neural-chalk");
const skillNames = [
  "learn-from-sources",
  "author-learning-pack",
  "author-question-group",
  "review-learning-pack",
  "publish-learning-pack",
];

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function collectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const stats = await lstat(absolute);
    assert.equal(stats.isSymbolicLink(), false, `plugin archive must not contain symlink ${absolute}`);
    if (entry.isDirectory()) files.push(...await collectFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

test("Codex and Claude manifests describe the same skills-only plugin", async () => {
  const codex = await json("plugins/neural-chalk/.codex-plugin/plugin.json");
  const claude = await json("plugins/neural-chalk/.claude-plugin/plugin.json");

  assert.equal(codex.name, "neural-chalk");
  assert.equal(claude.name, codex.name);
  assert.equal(claude.version, codex.version);
  assert.equal(codex.license, "Apache-2.0");
  assert.equal(claude.license, codex.license);
  assert.equal(codex.skills, "./skills/");
  for (const forbidden of ["apps", "mcpServers", "hooks"]) {
    assert.equal(forbidden in codex, false, `${forbidden} must not expand the plugin's authority`);
    assert.equal(forbidden in claude, false, `${forbidden} must not expand the plugin's authority`);
  }
  assert.match(codex.interface.privacyPolicyURL, /^https:\/\//);
  assert.match(codex.interface.termsOfServiceURL, /^https:\/\//);
});

test("repo marketplaces install the same versioned plugin", async () => {
  const codexMarketplace = await json(".agents/plugins/marketplace.json");
  const claudeMarketplace = await json(".claude-plugin/marketplace.json");
  const manifest = await json("plugins/neural-chalk/.codex-plugin/plugin.json");

  assert.equal(codexMarketplace.name, "neural-chalk");
  assert.deepEqual(codexMarketplace.plugins.map(({ name }) => name), ["neural-chalk"]);
  assert.equal(codexMarketplace.plugins[0].source.path, "./plugins/neural-chalk");
  assert.equal(codexMarketplace.plugins[0].policy.installation, "AVAILABLE");
  assert.equal(codexMarketplace.plugins[0].policy.authentication, "ON_INSTALL");

  assert.equal(claudeMarketplace.name, "neural-chalk");
  assert.deepEqual(claudeMarketplace.plugins.map(({ name }) => name), ["neural-chalk"]);
  assert.equal(claudeMarketplace.plugins[0].source, "./plugins/neural-chalk");
  assert.equal(claudeMarketplace.plugins[0].version, manifest.version);
});

test("all bundled skills have portable frontmatter and explicit runtime boundaries", async () => {
  for (const name of skillNames) {
    const source = await readFile(path.join(pluginRoot, "skills", name, "SKILL.md"), "utf8");
    assert.match(source, new RegExp(`^---\\nname: ${name}\\ndescription: .+\\n---\\n`));
    assert.match(source, /Neural Chalk/);
  }

  const author = await readFile(path.join(pluginRoot, "skills/author-learning-pack/SKILL.md"), "utf8");
  assert.match(author, /Never add remote JavaScript, HTML, CSS, React, MDX, Python, iframes, workers, npm packages, executable tests/);
  const questions = await readFile(path.join(pluginRoot, "skills/author-question-group/SKILL.md"), "utf8");
  assert.match(questions, /never grants runtime authority/);
});

test("bundle manifest proves every generated file matches its canonical source", async () => {
  const bundle = await json("plugins/neural-chalk/references/bundle-manifest.json");
  const releaseStatus = await json("docs/release-status.json");

  assert.equal(bundle.format, "neural-chalk-plugin-bundle");
  assert.equal(bundle.schemaVersion, 1);
  assert.equal(bundle.courseKit.version, releaseStatus.courseKit.sourceVersion);
  assert.equal(bundle.courseKit.installUrl, releaseStatus.courseKit.installUrl);

  for (const entry of bundle.files) {
    const [source, destination] = await Promise.all([
      readFile(path.join(root, entry.source)),
      readFile(path.join(pluginRoot, entry.destination)),
    ]);
    assert.deepEqual(destination, source, entry.destination);
    assert.equal(entry.bytes, source.byteLength, entry.destination);
    assert.equal(entry.sha256, sha256(source), entry.destination);
  }
});

test("plugin archive contains regular files only", async () => {
  const files = await collectFiles(pluginRoot);
  assert.ok(files.length >= 20, `expected a self-contained plugin archive, found ${files.length} files`);
});

test("public plugin notices match the manifest and remain passive documents", async () => {
  const manifest = await json("plugins/neural-chalk/.codex-plugin/plugin.json");
  assert.equal(
    manifest.interface.privacyPolicyURL,
    "https://model-systems-labs.github.io/latent/open-learning/plugin/privacy.html",
  );
  assert.equal(
    manifest.interface.termsOfServiceURL,
    "https://model-systems-labs.github.io/latent/open-learning/plugin/terms.html",
  );

  for (const name of ["privacy", "terms"]) {
    const source = await readFile(path.join(root, `public/open-learning/plugin/${name}.html`), "utf8");
    assert.match(source, /Content-Security-Policy/);
    assert.match(source, /default-src 'none'/);
    assert.match(source, /Effective August 5, 2026/);
    assert.match(source, /github\.com\/model-systems-labs\/latent\/issues/);
    assert.doesNotMatch(source, /<script|<form|https?:\/\/[^"<]*\.(?:js|css)/i);
  }
});
