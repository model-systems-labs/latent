import {
  access,
  lstat,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createLearningSuiteNavigation } from "#root/examples/learning-platform/learning-suite.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clientRoot = join(root, "dist/client");
const basePath = process.argv[2]?.trim() ?? "";

if (!/^\/[a-z0-9][a-z0-9/-]*[a-z0-9]$/.test(basePath)) {
  throw new Error("Pass a lowercase, root-relative Pages base path without a trailing slash.");
}

const lessonIds = [
  "character-rnns",
  "neural-language-models",
  "subword-tokenization",
  "additive-attention",
  "transformers",
  "in-context-learning",
  "inference-runtime",
  "scheduling-memory",
  "streaming-transport",
  "reliability-observability",
  "conversation-state",
  "streaming-react",
  "chat-actions-context",
  "chat-product-quality",
];
const moduleSlugs = ["models", "systems", "backend", "product"];
const requiredRoutes = [
  "index.html",
  "courses/llm-systems/index.html",
  ...moduleSlugs.map((slug) => `courses/llm-systems/${slug}/index.html`),
  ...moduleSlugs.map((slug) => `checkpoints/${slug}/index.html`),
  ...lessonIds.map((id) => `lessons/${id}/index.html`),
  "project/index.html",
  "workspace/index.html",
  "capstone/index.html",
];
const requiredRoutePaths = new Set(
  requiredRoutes.map((route) => join(clientRoot, route)),
);
const requiredAssets = [
  "capstone-react-runtime.js",
  "capstone-sandbox-worker.js",
  "emscripten-module.wasm",
  "og.png",
];
const learningSuiteBasePath = basePath.slice(0, basePath.lastIndexOf("/"));
const learningSuiteRoutes = new Set(createLearningSuiteNavigation({
  rootHref: `${learningSuiteBasePath}/`,
  currentId: "llm-systems",
}).map((destination) => destination.href));

async function collectHtml(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Static exports may not contain symlinks: ${relative(root, path)}`);
    }
    if (entry.isDirectory()) files.push(...await collectHtml(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

async function assertRegularFile(path) {
  await access(path);
  const stats = await lstat(path);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`Expected a regular export file: ${relative(root, path)}`);
  }
}

for (const route of requiredRoutes) {
  await assertRegularFile(join(clientRoot, route));
}
for (const asset of requiredAssets) {
  await assertRegularFile(join(clientRoot, asset));
}

const landingPage = await readFile(join(clientRoot, "index.html"), "utf8");
if (
  !landingPage.includes("Build an LLM System in Your Browser")
  || landingPage.includes("Use Latent Framework to publish")
  || landingPage.includes("Four interactive, browser-native courses")
  || !landingPage.includes('http-equiv="Content-Security-Policy"')
) {
  throw new Error(
    "The Pages root must render the protected LLM Systems course, not the product catalog.",
  );
}

const rawFontPath = "/assets/_vinext_fonts/";
const prefixedFontPath = `${basePath}${rawFontPath}`;
const htmlFiles = await collectHtml(clientRoot);
let renderedRoutes = 0;
let rewrittenRoutes = 0;

for (const path of htmlFiles) {
  const source = await readFile(path, "utf8");
  if (!source.includes("self.__VINEXT_RSC_")) continue;
  renderedRoutes += 1;

  const output = source
    .replaceAll(`href="${rawFontPath}`, `href="${prefixedFontPath}`)
    .replaceAll(`url(${rawFontPath}`, `url(${prefixedFontPath}`);
  if (output !== source) {
    await writeFile(path, output, "utf8");
    rewrittenRoutes += 1;
  }

  if (requiredRoutePaths.has(path)) {
    for (const match of output.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)) {
      const url = match[1];
      if (
        url !== basePath
        && !url.startsWith(`${basePath}/`)
        && !learningSuiteRoutes.has(url)
      ) {
        throw new Error(`Unprefixed static URL ${url} in ${relative(root, path)}`);
      }
    }
    for (const match of output.matchAll(/url\((\/[^)]+)\)/g)) {
      const url = match[1];
      if (url !== basePath && !url.startsWith(`${basePath}/`)) {
        throw new Error(`Unprefixed CSS URL ${url} in ${relative(root, path)}`);
      }
    }
  }
}

if (renderedRoutes < requiredRoutes.length) {
  throw new Error(`Expected at least ${requiredRoutes.length} rendered routes, found ${renderedRoutes}.`);
}

console.log(JSON.stringify({
  ok: true,
  basePath,
  renderedRoutes,
  rewrittenRoutes,
  verifiedCourseRoutes: requiredRoutes.length,
  verifiedAssets: requiredAssets.length,
}, null, 2));
