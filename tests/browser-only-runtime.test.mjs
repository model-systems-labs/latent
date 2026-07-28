import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const ignoredDirectories = new Set([".git", ".next", ".wrangler", "dist", "node_modules", "tests"]);
const checkedExtensions = new Set([".css", ".html", ".js", ".jsx", ".json", ".md", ".mjs", ".ts", ".tsx", ".yml", ".yaml"]);
const forbiddenHandoff = /\bcolab\b|\.ipynb\b|download notebook|open notebook|requires native python|native-runtime boundary|native runtime boundary|test:pytorch-native/i;

async function sourceFiles(directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (
      entry.isDirectory()
      && (ignoredDirectories.has(entry.name) || entry.name.startsWith(".pages-site"))
    ) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(absolute));
    else if (entry.isFile() && checkedExtensions.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

test("the course source has no notebook or external Python handoff", async () => {
  const violations = [];
  for (const file of await sourceFiles()) {
    const source = await readFile(file, "utf8");
    if (forbiddenHandoff.test(source)) violations.push(path.relative(root, file));
  }
  assert.deepEqual(violations, []);
});

test("Python lessons use the browser worker and curated package allowlist", async () => {
  const [paperLab, worker, runtimeTypes, portfolio] = await Promise.all([
    readFile(path.join(root, "app/components/PaperLab.tsx"), "utf8"),
    readFile(path.join(root, "packages/python-lab/src/worker/python.worker.ts"), "utf8"),
    readFile(path.join(root, "packages/python-lab/src/types.ts"), "utf8"),
    readFile(path.join(root, "app/lib/portfolio-export.ts"), "utf8"),
  ]);
  assert.match(paperLab, /runPythonLessonContracts/);
  assert.doesNotMatch(paperLab, /PyTorchHandoff|Open Colab|Download notebook/);
  assert.match(worker, /loadPinnedPyodide/);
  assert.match(worker, /packages,/);
  assert.match(runtimeTypes, /CURATED_PYTHON_PACKAGES = \["numpy", "sortedcontainers"\]/);
  assert.doesNotMatch(portfolio, /pytorchFiles|PYTORCH_HANDOFF|\.ipynb|Colab/i);
});

test("Harness scenarios invoke the saved Python project without a server or model API", async () => {
  const [workbench, service, scenarios] = await Promise.all([
    readFile(path.join(root, "app/components/HarnessWorkbench.tsx"), "utf8"),
    readFile(path.join(root, "app/features/ide/python-lesson-service.ts"), "utf8"),
    readFile(path.join(root, "examples/learning-platform/llm-learning/content/harness-engineering/scenarios.ts"), "utf8"),
  ]);
  const scenarioRun = workbench.slice(workbench.indexOf("const runScenario"), workbench.indexOf("const resultPaths"));
  assert.match(scenarioRun, /harnessRunEvidence\(\)[\s\S]*?runPythonProjectFunction/);
  assert.doesNotMatch(scenarioRun, /fetch\(|\/api\/|OPENAI|ANTHROPIC|OPENROUTER/i);
  const invocation = service.slice(service.indexOf("export async function runPythonProjectFunction"), service.indexOf("export async function runPythonProjectFile"));
  assert.match(invocation, /sharedClient\(packages, "harness-project"\)/);
  assert.doesNotMatch(invocation, /fetch\(|\/api\//);
  assert.doesNotMatch(scenarios, /api key|openrouter|fetch\(|https?:\/\//i);
});
