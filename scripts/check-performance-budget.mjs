import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const clientRoot = join(process.cwd(), "dist", "client");
const assetRoot = join(clientRoot, "assets");
const manifestPath = join(clientRoot, ".vite", "manifest.json");

if (!existsSync(manifestPath)) {
  throw new Error("Performance budgets require a completed web build (dist/client/.vite/manifest.json is missing). Run npm run build:web first.");
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const assets = readdirSync(assetRoot);
const failures = [];
const measurements = [];

const kib = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
const mib = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;

function findAsset(pattern, label) {
  const matches = assets.filter((asset) => pattern.test(asset));
  if (matches.length !== 1) {
    failures.push(`${label}: expected one matching asset, found ${matches.length}`);
    return null;
  }
  return join(assetRoot, matches[0]);
}

function enforceAsset(label, pattern, maximum, format = kib) {
  const file = findAsset(pattern, label);
  if (!file) return;
  const bytes = statSync(file).size;
  measurements.push(`${label}: ${format(bytes)} / ${format(maximum)}`);
  if (bytes > maximum) failures.push(`${label} exceeds its budget by ${format(bytes - maximum)}`);
}

function enforceLargestCss(maximum) {
  const cssFiles = assets.filter((asset) => asset.endsWith(".css"));
  if (cssFiles.length === 0) {
    failures.push("CSS: no emitted stylesheet found");
    return;
  }
  const bytes = Math.max(...cssFiles.map((asset) => statSync(join(assetRoot, asset)).size));
  measurements.push(`Largest stylesheet: ${kib(bytes)} / ${kib(maximum)}`);
  if (bytes > maximum) failures.push(`Largest stylesheet exceeds its budget by ${kib(bytes - maximum)}`);
}

function manifestEntryForSource(source) {
  if (manifest[source]) return [source, manifest[source]];

  const sourceName = source.split("/").at(-1)?.replace(/\.[^.]+$/, "");
  const matches = Object.entries(manifest).filter(([, entry]) => (
    entry.src === source
    || (!entry.src && entry.name === sourceName)
  ));
  return matches.length === 1 ? matches[0] : null;
}

function isDeferredChunk(key, ancestors = new Set()) {
  const entry = manifest[key];
  if (!entry || entry.isEntry === true) return false;
  if (entry.isDynamicEntry === true) return true;
  if (ancestors.has(key)) return false;

  const nextAncestors = new Set(ancestors).add(key);
  const importers = Object.entries(manifest).filter(([, candidate]) => (
    candidate.imports?.includes(key)
    || candidate.dynamicImports?.includes(key)
  ));
  return importers.length > 0
    && importers.every(([importerKey]) => isDeferredChunk(importerKey, nextAncestors));
}

function requireDeferredModule(source, label) {
  const match = manifestEntryForSource(source);
  if (!match) {
    failures.push(`${label}: no unique build-manifest entry for ${source}`);
    return;
  }
  const [key] = match;
  const deferred = isDeferredChunk(key);
  measurements.push(`${label}: ${deferred ? "deferred" : "eager"}`);
  if (!deferred) failures.push(`${label} must remain deferred from every eager entry`);
}

// These are regression ceilings, not performance targets. They protect the
// reading path from accidentally absorbing the IDE, compiler, or local model.
enforceLargestCss(180 * 1024);
enforceAsset("Lesson runtime", /^PaperLab-.*\.js$/, 150 * 1024);
enforceAsset("Project IDE", /^ProjectWorkbench-.*\.js$/, 560 * 1024);
enforceAsset("Local Transformer runtime", /^local-transformer-runtime-.*\.js$/, 900 * 1024);
enforceAsset("Training worker", /^model\.worker-.*\.js$/, 950 * 1024);
enforceAsset("Browser compiler WASM", /^esbuild-.*\.wasm$/, 14 * 1024 * 1024, mib);
enforceAsset("Transformer WASM", /^ort-wasm-simd-threaded\.jsep-.*\.wasm$/, 22 * 1024 * 1024, mib);
requireDeferredModule("app/components/ProjectWorkbench.tsx", "Project IDE loading boundary");
requireDeferredModule("app/lib/local-transformer-runtime.ts", "Local Transformer loading boundary");
requireDeferredModule("app/features/ide/CodeEditor.tsx", "Lesson editor loading boundary");
requireDeferredModule("app/components/LessonExperiment.tsx", "Lesson experiment loading boundary");

console.log(measurements.join("\n"));

if (failures.length > 0) {
  throw new Error(`Performance budget failed:\n- ${failures.join("\n- ")}`);
}

console.log("Performance budgets passed.");
