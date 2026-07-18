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

function requireDynamicEntry(source, label) {
  const entry = manifest[source];
  if (!entry) {
    failures.push(`${label}: no build-manifest entry for ${source}`);
    return;
  }
  measurements.push(`${label}: ${entry.isDynamicEntry === true ? "deferred" : "eager"}`);
  if (entry.isDynamicEntry !== true) failures.push(`${label} must remain a deferred build entry`);
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
requireDynamicEntry("app/components/ProjectWorkbench.tsx", "Project IDE loading boundary");
requireDynamicEntry("app/lib/local-transformer-runtime.ts", "Local Transformer loading boundary");
requireDynamicEntry("app/features/ide/CodeEditor.tsx", "Lesson editor loading boundary");
requireDynamicEntry("app/components/LessonExperiment.tsx", "Lesson experiment loading boundary");

console.log(measurements.join("\n"));

if (failures.length > 0) {
  throw new Error(`Performance budget failed:\n- ${failures.join("\n- ")}`);
}

console.log("Performance budgets passed.");
