import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";
import { loadPyodide } from "pyodide";
import { createServer } from "vite";

const root = new URL("../", import.meta.url);
const expectedPaths = [
  "harness/agent_loop.py",
  "harness/tools.py",
  "harness/context.py",
  "harness/permissions.py",
  "harness/state.py",
  "harness/evaluations.py",
  "harness/orchestration.py",
  "harness/harness.py",
];

let contracts;
let persistence;
let projectTemplate;
let harnessWorkspace;
let scenarios;
let pythonLab;
let pyodide;
let runPythonProjectContracts;
let runPythonProjectFunction;
let vite;
const initializationProfiles = [];

before(async () => {
  vite = await createServer({
    root: fileURLToPath(root),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });

  [contracts, persistence, projectTemplate, harnessWorkspace, scenarios, { runPythonProjectContracts, runPythonProjectFunction }] = await Promise.all([
    vite.ssrLoadModule("/app/content/harness-engineering/contracts.ts"),
    vite.ssrLoadModule("/app/platform/persistence/index.ts"),
    vite.ssrLoadModule("/app/content/harness-engineering/project-template.ts"),
    vite.ssrLoadModule("/app/lib/harness-workspace.ts"),
    vite.ssrLoadModule("/app/content/harness-engineering/scenarios.ts"),
    vite.ssrLoadModule("/app/features/ide/python-lesson-service.ts"),
  ]);

  pyodide = await loadPyodide({
    indexURL: fileURLToPath(new URL(".", import.meta.resolve("pyodide/package.json"))),
  });
  pyodide.FS.mkdirTree("/workspace");

  let revision = 0;
  const files = new Set();
  pythonLab = {
    async initialize(options) {
      initializationProfiles.push([...options.packages]);
      return {
        schemaVersion: 1,
        runtime: "pyodide",
        runtimeVersion: "0.29.3",
        pythonVersion: String(pyodide.runPython("import platform; platform.python_version()")),
        packages: [],
        guardrailsApplied: true,
        capabilityReduced: true,
      };
    },
    async sync({ files: nextFiles, deletePaths = [] }) {
      for (const path of deletePaths) {
        try {
          pyodide.FS.unlink(`/workspace/${path}`);
        } catch {}
        files.delete(path);
      }
      for (const file of nextFiles) {
        const directory = file.path.split("/").slice(0, -1).join("/");
        if (directory) pyodide.FS.mkdirTree(`/workspace/${directory}`);
        pyodide.FS.writeFile(`/workspace/${file.path}`, file.contents, { encoding: "utf8" });
        files.add(file.path);
      }
      revision += 1;
      return { schemaVersion: 1, revision, files: [...files].sort() };
    },
    async run({ code }, options = {}) {
      pyodide.setStdout({
        batched(text) {
          options.onEvent?.({ type: "stdout", requestId: "harness-workspace-regression", text: `${text}\n` });
        },
      });
      pyodide.setStderr({
        batched(text) {
          options.onEvent?.({ type: "stderr", requestId: "harness-workspace-regression", text: `${text}\n` });
        },
      });
      try {
        pyodide.runPython(code);
        return {
          schemaVersion: 1,
          status: "completed",
          result: JSON.parse(String(pyodide.runPython("import json; json.dumps(RESULT, allow_nan=False)"))),
          stdout: "",
          stderr: "",
          artifacts: [],
          durationMs: 0,
        };
      } catch (error) {
        return {
          schemaVersion: 1,
          status: "failed",
          result: null,
          exception: {
            type: error?.name ?? "PythonError",
            message: String(error),
            traceback: String(error),
          },
          stdout: "",
          stderr: "",
          artifacts: [],
          durationMs: 0,
        };
      } finally {
        pyodide.setStdout();
        pyodide.setStderr();
      }
    },
  };
}, { timeout: 60_000 });

after(async () => {
  pyodide?.globals.delete("RESULT");
  await vite?.close();
});

function referenceFiles() {
  return Object.fromEntries(projectTemplate.HARNESS_PROJECT_STARTER_FILES.map((file) => [
    file.path,
    file.referenceContent,
  ]));
}

function starterFiles() {
  return Object.fromEntries(projectTemplate.HARNESS_PROJECT_STARTER_FILES.map((file) => [
    file.path,
    file.content,
  ]));
}

function database() {
  return new persistence.BrowserLabDatabase(`harness-workspace-${crypto.randomUUID()}`);
}

async function dispose(db) {
  db.close();
  await db.delete();
}

test("the Harness workbook exposes one complete importable Python scaffold", () => {
  const files = projectTemplate.HARNESS_PROJECT_STARTER_FILES;
  assert.equal(projectTemplate.HARNESS_PROJECT_ID, "harness-engineering");
  assert.notEqual(projectTemplate.HARNESS_PROJECT_ID, "browser-chat");
  assert.deepEqual(projectTemplate.HARNESS_PROJECT_PATHS, expectedPaths);
  assert.deepEqual(files.map(({ path }) => path), expectedPaths);
  assert.equal(new Set(files.map(({ path }) => path)).size, expectedPaths.length);
  assert.equal(files.reduce((total, file) => total + file.totalCells, 0), 16);

  for (const file of files) {
    assert.match(file.path, /^harness\/[a-z_]+\.py$/);
    assert.doesNotMatch(file.path, /-/);
    assert.equal(file.track, "harness");
    assert.equal(file.verifiedCells, 0);
    assert.equal(file.totalCells, 2);
    assert.equal((file.content.match(/raise NotImplementedError\(/g) ?? []).length, file.totalCells, file.path);
    assert.equal((file.content.match(/^# \d{2} · /gm) ?? []).length, file.totalCells, file.path);
    assert.doesNotMatch(file.referenceContent, /NotImplementedError|# TODO:/, file.path);
    assert.notEqual(file.content, file.referenceContent, file.path);
  }

  assert.match(referenceFiles()["harness/harness.py"], /from harness\.agent_loop import/);
  assert.match(referenceFiles()["harness/harness.py"], /from harness\.permissions import/);
  assert.match(referenceFiles()["harness/harness.py"], /from harness\.tools import/);
  const harnessStarter = files.find((file) => file.path === "harness/harness.py")?.content ?? "";
  assert.match(harnessStarter, /def run_harness\(initial_messages, model, tools, rules, max_turns\):/);
  assert.match(harnessStarter, /# TODO: enforce the permission decision, dispatch allowed tools, and record the resulting observation\./);
  assert.match(harnessStarter, /raise NotImplementedError\("Implement Run the harness\."\)/);
  assert.match(harnessStarter, /# Provided browser adapter\.\ndef run_recorded_harness\(initial_messages, model_config, tool_configs, rules, max_turns\):/);
});

test("visible Harness source must exactly match durable run evidence", () => {
  const exact = { "harness/a.py": "one", "harness/b.py": "two" };
  assert.equal(harnessWorkspace.firstHarnessSourceMismatch(exact, { ...exact }), null);
  assert.equal(
    harnessWorkspace.firstHarnessSourceMismatch(exact, { ...exact, "harness/b.py": "changed" }),
    "harness/b.py",
  );
  assert.equal(
    harnessWorkspace.firstHarnessSourceMismatch(exact, { ...exact, "harness/c.py": "extra" }),
    "harness/c.py",
  );
});

test("Harness source and persistence stay outside the Browser Chat project", async () => {
  const workspaceSource = readFileSync(new URL("../app/lib/harness-workspace.ts", import.meta.url), "utf8");
  const workbenchSource = readFileSync(new URL("../app/components/HarnessWorkbench.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(workspaceSource, /from\s+["'][^"']*project-workspace["']/);
  assert.doesNotMatch(workbenchSource, /from\s+["'][^"']*project-workspace["']/);
  assert.doesNotMatch(workbenchSource, /href=["']\/(?:project|workspace)(?:[?"'])/);
  const projectRunSource = workbenchSource.slice(
    workbenchSource.indexOf("const performTests"),
    workbenchSource.indexOf("const runScenario"),
  );
  assert.doesNotMatch(projectRunSource, /setResults\(\[\]\)/);
  assert.match(projectRunSource, /Previous results remain attached to their saved source/);
  assert.match(workbenchSource, /window\.sessionStorage\.setItem/);
  assert.doesNotMatch(workbenchSource, /window\.localStorage/);
  assert.match(workbenchSource, /draftsRef\.current\[selected\.path\] \?\? snapshot/);
  assert.doesNotMatch(workbenchSource, /setDrafts\(\(current\) => \(\{ \.\.\.current, \[selected\.path\]: snapshot \}\)\)/);
  assert.match(workbenchSource, /requireCurrentVisibleSource\(selected\.path, evidence\.files\)/);
  assert.match(workspaceSource, /candidate\.runnerVersion === HARNESS_PROJECT_RUNNER_VERSION/);
  assert.match(workspaceSource, /current\.sourceProvenance !== "seed"/);
  assert.match(workspaceSource, /expected: current \? \{ revision: current\.revision, sourceHash: current\.sourceHash \} : null/);

  const db = database();
  await db.open();
  try {
    let timestamp = 1_000;
    const repositories = new persistence.PersistenceRepositories(db, { now: () => timestamp++ });
    await repositories.projects.create({
      id: "browser-chat",
      title: "Browser Chat",
      courseId: "llm-systems",
      selectedPath: "models/sentinel.js",
    });
    const browserFile = await repositories.projects.saveFile({
      projectId: "browser-chat",
      path: "models/sentinel.js",
      track: "models",
      title: "Browser Chat sentinel",
      content: "export const browserChat = true;",
      sourceProvenance: "ide",
    });
    const browserProjectBefore = await repositories.projects.get("browser-chat");

    await repositories.projects.create({
      id: projectTemplate.HARNESS_PROJECT_ID,
      title: projectTemplate.HARNESS_PROJECT_TITLE,
      courseId: projectTemplate.HARNESS_PROJECT_ID,
      selectedPath: expectedPaths[0],
    });
    for (const seed of projectTemplate.HARNESS_PROJECT_STARTER_FILES) {
      await repositories.projects.saveFile({
        projectId: projectTemplate.HARNESS_PROJECT_ID,
        path: seed.path,
        track: seed.track,
        title: seed.title,
        content: seed.content,
        referenceContent: seed.referenceContent,
        lessonId: seed.lessonId,
        verifiedCells: seed.verifiedCells,
        totalCells: seed.totalCells,
        sourceProvenance: "seed",
      });
    }
    const firstHarnessFile = await repositories.projects.getFile(projectTemplate.HARNESS_PROJECT_ID, expectedPaths[0]);
    await repositories.projects.saveFile({
      projectId: projectTemplate.HARNESS_PROJECT_ID,
      path: firstHarnessFile.path,
      track: firstHarnessFile.track,
      title: firstHarnessFile.title,
      content: `${firstHarnessFile.content}\n# learner edit`,
      referenceContent: firstHarnessFile.referenceContent,
      lessonId: firstHarnessFile.lessonId,
      verifiedCells: 0,
      totalCells: firstHarnessFile.totalCells,
      sourceProvenance: "ide",
      reason: "edit",
      expected: { revision: firstHarnessFile.revision, sourceHash: firstHarnessFile.sourceHash },
    });

    const browserProjectAfter = await repositories.projects.get("browser-chat");
    const browserFileAfter = await repositories.projects.getFile("browser-chat", browserFile.path);
    const harnessFiles = await repositories.projects.listFiles(projectTemplate.HARNESS_PROJECT_ID);
    assert.equal(browserProjectAfter.draftRevision, browserProjectBefore.draftRevision);
    assert.equal(browserProjectAfter.selectedPath, browserProjectBefore.selectedPath);
    assert.equal(browserFileAfter.content, browserFile.content);
    assert.equal(browserFileAfter.sourceHash, browserFile.sourceHash);
    assert.deepEqual(harnessFiles.map(({ path }) => path), [...expectedPaths].sort());
    assert.ok(harnessFiles.every(({ projectId }) => projectId === projectTemplate.HARNESS_PROJECT_ID));
    assert.equal((await repositories.projects.listFiles("browser-chat")).length, 1);
  } finally {
    await dispose(db);
  }
});

test("one project run passes all sixteen contracts against the reference package", { timeout: 60_000 }, async () => {
  const authoredContracts = contracts.harnessEngineeringContractSuite.contracts;
  const authoredCaseCount = authoredContracts.reduce((total, contract) => total + contract.cases.length, 0);
  assert.equal(authoredContracts.length, 16);

  const run = await runPythonProjectContracts({
    files: referenceFiles(),
    contracts: authoredContracts,
    pythonLab,
  });

  assert.equal(run.results.length, 16);
  assert.equal(run.cases.length, authoredCaseCount);
  assert.deepEqual(run.results.filter(({ passed }) => !passed), []);
  assert.ok(run.cases.every(({ passed }) => passed));
  assert.deepEqual(initializationProfiles.at(-1), []);
});

test("every recorded-model scenario runs through the learner project and returns its own trace", { timeout: 60_000 }, async () => {
  for (const scenario of scenarios.HARNESS_SCENARIO_FIXTURES) {
    const invocation = await runPythonProjectFunction({
      files: referenceFiles(),
      path: scenarios.HARNESS_SCENARIO_MODULE_PATH,
      exportName: scenarios.HARNESS_SCENARIO_EXPORT,
      args: scenarios.harnessScenarioArguments(scenario),
      pythonLab,
    });
    assert.equal(invocation.observation.status, "returned", scenario.id);
    const trace = scenarios.harnessScenarioTrace(invocation.observation.value);
    assert.equal(trace.status, scenario.expected.terminalStatus, scenario.id);
    assert.equal(trace.final, scenario.expected.final, scenario.id);
    assert.equal(trace.toolCalls, scenario.expected.toolCallCount, scenario.id);
    assert.equal(scenarios.harnessScenarioMatchesExpected(invocation.observation.value, scenario), true, scenario.id);
    assert.ok(trace.rows.length >= 2, scenario.id);
  }
});

test("a fresh scenario reaches a visible guided learner stub through the provided adapter", { timeout: 60_000 }, async () => {
  const invocation = await runPythonProjectFunction({
    files: starterFiles(),
    path: scenarios.HARNESS_SCENARIO_MODULE_PATH,
    exportName: scenarios.HARNESS_SCENARIO_EXPORT,
    args: scenarios.harnessScenarioArguments(scenarios.HARNESS_SCENARIO_FIXTURES[0]),
    pythonLab,
  });
  assert.equal(invocation.observation.status, "threw");
  assert.equal(invocation.observation.errorName, "NotImplementedError");
  assert.match(invocation.observation.message, /Implement Parse a model response/);
  assert.doesNotMatch(invocation.observation.message, /not defined|missing/i);
});

test("scenario invocation reports learner exceptions without confusing them with worker failures", { timeout: 60_000 }, async () => {
  const files = {
    ...referenceFiles(),
    "harness/harness.py": "def run_recorded_harness(*args):\n    raise RuntimeError('learner bug')\n",
  };
  const invocation = await runPythonProjectFunction({
    files,
    path: scenarios.HARNESS_SCENARIO_MODULE_PATH,
    exportName: scenarios.HARNESS_SCENARIO_EXPORT,
    args: scenarios.harnessScenarioArguments(scenarios.HARNESS_SCENARIO_FIXTURES[0]),
    pythonLab,
  });
  assert.equal(invocation.observation.status, "threw");
  assert.equal(invocation.observation.errorName, "RuntimeError");
  assert.match(invocation.observation.message, /learner bug/);
});

test("scenario invocation rejects unsafe paths, names, and unbounded arguments before Python", async () => {
  const files = referenceFiles();
  const base = {
    files,
    path: scenarios.HARNESS_SCENARIO_MODULE_PATH,
    exportName: scenarios.HARNESS_SCENARIO_EXPORT,
    args: scenarios.harnessScenarioArguments(scenarios.HARNESS_SCENARIO_FIXTURES[0]),
    pythonLab,
  };
  await assert.rejects(
    runPythonProjectFunction({ ...base, files: { ...files, "../escape.py": "pass" }, path: "../escape.py" }),
    /safe relative \.py path/,
  );
  await assert.rejects(runPythonProjectFunction({ ...base, path: "harness/missing.py" }), /missing/);
  await assert.rejects(runPythonProjectFunction({ ...base, exportName: "run-harness" }), /export name is invalid/);
  await assert.rejects(runPythonProjectFunction({ ...base, args: [Number.POSITIVE_INFINITY] }), /bounded, finite JSON/);

  let nested = "leaf";
  for (let depth = 0; depth < 26; depth += 1) nested = [nested];
  await assert.rejects(runPythonProjectFunction({ ...base, args: [nested] }), /bounded, finite JSON/);
  await assert.rejects(runPythonProjectFunction({ ...base, args: ["x".repeat(262_145)] }), /too large/);
});

test("an edited dependency breaks the integrated harness in the same Python worker", { timeout: 60_000 }, async () => {
  const integrated = contracts.harnessEngineeringContractSuite.contracts.find(
    ({ id }) => id === "integrated-harness/run-harness",
  );
  assert.ok(integrated);

  const pristine = referenceFiles();
  const referenceRun = await runPythonProjectContracts({
    files: pristine,
    contracts: [integrated],
    pythonLab,
  });
  assert.equal(referenceRun.results[0].passed, true, referenceRun.results[0].detail);

  const originalPermissionSource = pristine["harness/permissions.py"];
  const changedPermissionSource = originalPermissionSource.replace(
    'precedence = {"allow": 0, "confirm": 1, "deny": 2}',
    'precedence = {"allow": 2, "confirm": 1, "deny": 0}',
  );
  assert.notEqual(changedPermissionSource, originalPermissionSource);
  const mutated = { ...pristine, "harness/permissions.py": changedPermissionSource };

  const mutationRun = await runPythonProjectContracts({
    files: mutated,
    contracts: [integrated],
    pythonLab,
  });
  assert.equal(mutationRun.results.length, 1);
  assert.equal(mutationRun.results[0].passed, false);
  assert.ok(mutationRun.cases.some(({ passed }) => !passed));
  assert.match(
    mutationRun.results[0].detail,
    /deny|denied|normaliz|dispatch|error observation/i,
    mutationRun.results[0].detail,
  );
});
