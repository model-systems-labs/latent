import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = resolve(root, "packages");
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const styleExtensions = new Set([".css"]);
const cssImportPattern = /@import\s+(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^'"\s;)]+))/g;

function moduleSpecifiers(file, source) {
  const extension = file.slice(file.lastIndexOf("."));
  const scriptKind = extension === ".tsx"
    ? ts.ScriptKind.TSX
    : extension === ".ts"
      ? ts.ScriptKind.TS
      : extension === ".jsx"
        ? ts.ScriptKind.JSX
        : ts.ScriptKind.JS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);
  const specifiers = [];

  function addSpecifier(node) {
    if (node && ts.isStringLiteralLike(node)) specifiers.push(node.text);
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addSpecifier(node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      addSpecifier(node.moduleReference.expression);
    } else if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
    ) {
      addSpecifier(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

async function filesBelow(directory, extensions = sourceExtensions) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(path, extensions));
    else if (extensions.has(entry.name.slice(entry.name.lastIndexOf(".")))) output.push(path);
  }
  return output;
}

const failures = [];
const rootManifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const workspaces = [];
for (const entry of await readdir(packageRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = resolve(packageRoot, entry.name);
  const manifest = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8"));
  workspaces.push({ directory, manifest });
}

const workspaceByName = new Map();
for (const workspace of workspaces) {
  if (workspaceByName.has(workspace.manifest.name)) failures.push(`Duplicate workspace name: ${workspace.manifest.name}`);
  workspaceByName.set(workspace.manifest.name, workspace);
}

const dependencyGraph = new Map();
for (const { directory: workspace, manifest } of workspaces) {
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]);
  if (declared.has(rootManifest.name)) failures.push(`${manifest.name} depends on the root application.`);
  const workspaceDependencies = [...declared].filter((dependency) => workspaceByName.has(dependency));
  dependencyGraph.set(manifest.name, workspaceDependencies);
  for (const dependency of workspaceDependencies) {
    const version = manifest.dependencies?.[dependency] ?? manifest.peerDependencies?.[dependency] ?? manifest.devDependencies?.[dependency];
    if (version !== "*") failures.push(`${manifest.name} must use * for private workspace dependency ${dependency}.`);
  }
  for (const dependency of declared) {
    if (dependency.startsWith("@latent/") && !workspaceByName.has(dependency)) {
      failures.push(`${manifest.name} declares unknown private workspace dependency: ${dependency}`);
    }
  }
  for (const file of await filesBelow(resolve(workspace, "src"))) {
    const source = await readFile(file, "utf8");
    for (const specifier of moduleSpecifiers(file, source)) {
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
      if (specifier.startsWith("@latent/")) {
        const dependency = specifier.split("/").slice(0, 2).join("/");
        if (!workspaceByName.has(dependency)) failures.push(`${relative(root, file)} imports unknown private workspace: ${specifier}`);
        else if (dependency !== manifest.name && !declared.has(dependency)) failures.push(`${relative(root, file)} uses undeclared workspace dependency: ${specifier}`);
      }
    }
  }
}

const visiting = new Set();
const visited = new Set();
function visit(packageName, path = []) {
  if (visiting.has(packageName)) {
    const cycleStart = path.indexOf(packageName);
    failures.push(`Workspace dependency cycle: ${[...path.slice(cycleStart), packageName].join(" -> ")}`);
    return;
  }
  if (visited.has(packageName)) return;
  visiting.add(packageName);
  for (const dependency of dependencyGraph.get(packageName) ?? []) visit(dependency, [...path, packageName]);
  visiting.delete(packageName);
  visited.add(packageName);
}
for (const packageName of dependencyGraph.keys()) visit(packageName);

const rootDeclared = new Set([
  ...Object.keys(rootManifest.dependencies ?? {}),
  ...Object.keys(rootManifest.devDependencies ?? {}),
]);
for (const directory of [
  resolve(root, "app"),
  resolve(root, "examples"),
  resolve(root, "products"),
  resolve(root, "scripts"),
  resolve(root, "tests"),
]) {
  for (const file of await filesBelow(directory)) {
    const source = await readFile(file, "utf8");
    for (const specifier of moduleSpecifiers(file, source)) {
      if (/^@latent\/[^/]+\/src(?:\/|$)/.test(specifier) || specifier.includes("packages/")) {
        failures.push(`${relative(root, file)} bypasses a workspace public export: ${specifier}`);
      }
      if (specifier.startsWith("@latent/")) {
        const dependency = specifier.split("/").slice(0, 2).join("/");
        if (!workspaceByName.has(dependency)) failures.push(`${relative(root, file)} imports unknown private workspace: ${specifier}`);
        else if (!rootDeclared.has(dependency)) failures.push(`${relative(root, file)} uses undeclared root workspace dependency: ${specifier}`);
      }
    }
  }
}

const fullLearningExample = resolve(root, "examples/learning-platform/llm-learning");
for (const [directory, alias] of [
  [resolve(root, "app"), "@/"],
  [resolve(root, "products"), "@/"],
  [fullLearningExample, "@/"],
  [resolve(root, "scripts"), "#root/"],
  [resolve(root, "tests"), "#root/"],
]) {
  for (const file of await filesBelow(directory)) {
    const source = await readFile(file, "utf8");
    for (const specifier of moduleSpecifiers(file, source)) {
      if (specifier.startsWith(".")) {
        failures.push(`${relative(root, file)} uses relative module import ${specifier}; use the ${alias} root alias.`);
      }
    }
  }
}

const viteConfig = resolve(root, "vite.config.ts");
const viteConfigSource = await readFile(viteConfig, "utf8");
for (const specifier of moduleSpecifiers(viteConfig, viteConfigSource)) {
  if (specifier.startsWith(".")) {
    failures.push(`${relative(root, viteConfig)} uses relative module import ${specifier}; use the #root/ root alias.`);
  }
}

for (const directory of [
  resolve(root, "app"),
  resolve(root, "products"),
  fullLearningExample,
]) {
  for (const file of await filesBelow(directory, styleExtensions)) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(cssImportPattern)) {
      const specifier = match[1] ?? match[2] ?? match[3] ?? "";
      if (specifier.startsWith(".")) {
        failures.push(`${relative(root, file)} uses relative stylesheet import ${specifier}; use the @/ root alias.`);
      }
    }
  }
}

for (const file of await filesBelow(fullLearningExample)) {
  const source = await readFile(file, "utf8");
  for (const specifier of moduleSpecifiers(file, source)) {
    if (specifier.startsWith(".")) {
      const destination = relative(root, resolve(dirname(file), specifier));
      if (
        destination === "app"
        || destination.startsWith("app/")
        || destination === "products"
        || destination.startsWith("products/")
      ) {
        failures.push(`${relative(root, file)} reverses the example boundary: ${specifier}`);
      }
    } else if (
      specifier === "app"
      || specifier.startsWith("app/")
      || specifier === "products"
      || specifier.startsWith("products/")
      || specifier.startsWith("@/app/")
      || specifier.startsWith("@/products/")
    ) {
      failures.push(`${relative(root, file)} reverses the example boundary: ${specifier}`);
    }
  }
}

if (failures.length) {
  console.error(["Package boundary violations:", ...failures.map((failure) => `- ${failure}`)].join("\n"));
  process.exitCode = 1;
} else {
  console.log("Package boundaries and dependency graph are valid.");
}
