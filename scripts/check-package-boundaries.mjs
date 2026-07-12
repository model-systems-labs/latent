import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = resolve(root, "packages");
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

async function filesBelow(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(path));
    else if (sourceExtensions.has(entry.name.slice(entry.name.lastIndexOf(".")))) output.push(path);
  }
  return output;
}

const failures = [];
for (const entry of await readdir(packageRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const workspace = resolve(packageRoot, entry.name);
  const manifest = JSON.parse(await readFile(resolve(workspace, "package.json"), "utf8"));
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]);
  for (const file of await filesBelow(resolve(workspace, "src"))) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1] ?? match[2];
      if (!specifier) continue;
      if (specifier.startsWith(".")) {
        const destination = resolve(dirname(file), specifier);
        if (relative(workspace, destination).startsWith("..")) {
          failures.push(`${relative(root, file)} imports outside ${manifest.name}: ${specifier}`);
        }
        continue;
      }
      if (specifier.startsWith("@/") || specifier === "app" || specifier.startsWith("app/")) {
        failures.push(`${relative(root, file)} imports application code: ${specifier}`);
        continue;
      }
      if (specifier.startsWith("@latent/") && !declared.has(specifier.split("/").slice(0, 2).join("/"))) {
        failures.push(`${relative(root, file)} uses undeclared workspace dependency: ${specifier}`);
      }
    }
  }
}

for (const directory of [resolve(root, "app"), resolve(root, "tests")]) {
  for (const file of await filesBelow(directory)) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1] ?? match[2] ?? "";
      if (/^@latent\/[^/]+\/src(?:\/|$)/.test(specifier) || specifier.includes("packages/")) {
        failures.push(`${relative(root, file)} bypasses a workspace public export: ${specifier}`);
      }
    }
  }
}

if (failures.length) {
  console.error(["Package boundary violations:", ...failures.map((failure) => `- ${failure}`)].join("\n"));
  process.exitCode = 1;
} else {
  console.log("Package boundaries are valid.");
}
