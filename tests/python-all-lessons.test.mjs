import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadPyodide } from "pyodide";
import { createServer } from "vite";

const root = new URL("../", import.meta.url);

let pyodide;
let vite;
let curriculum;
let contracts;
let implementationSource;
let runPythonLessonContracts;
let exerciseCaseResultsAreComplete;
let pythonLab;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(root),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  const [courseModule, contractModule, sourceModule, serviceModule, projectServiceModule] = await Promise.all([
    vite.ssrLoadModule("/app/lessons/course.ts"),
    vite.ssrLoadModule("/app/content/llm-systems/contracts.ts"),
    vite.ssrLoadModule("/app/lessons/implementation-source.ts"),
    vite.ssrLoadModule("/app/features/ide/python-lesson-service.ts"),
    vite.ssrLoadModule("/app/features/ide/browser-lab-service.ts"),
  ]);
  curriculum = courseModule.llmSystemsCurriculum;
  contracts = contractModule.llmSystemsContractSuite;
  implementationSource = sourceModule.lessonImplementationSource;
  runPythonLessonContracts = serviceModule.runPythonLessonContracts;
  exerciseCaseResultsAreComplete = projectServiceModule.exerciseCaseResultsAreComplete;

  pyodide = await loadPyodide({
    indexURL: fileURLToPath(new URL(".", import.meta.resolve("pyodide/package.json"))),
    packages: ["numpy"],
  });
  pyodide.FS.mkdirTree("/workspace");
  let revision = 0;
  const files = new Set();
  pythonLab = {
    async initialize() {
      return {
        schemaVersion: 1,
        runtime: "pyodide",
        runtimeVersion: "0.29.3",
        pythonVersion: String(pyodide.runPython("import platform; platform.python_version()")),
        packages: ["numpy"],
        guardrailsApplied: true,
        capabilityReduced: true,
      };
    },
    async sync({ files: nextFiles, deletePaths = [] }) {
      for (const path of deletePaths) {
        try { pyodide.FS.unlink(`/workspace/${path}`); } catch {}
        files.delete(path);
      }
      for (const file of nextFiles) {
        const segments = file.path.split("/");
        segments.pop();
        if (segments.length) pyodide.FS.mkdirTree(`/workspace/${segments.join("/")}`);
        pyodide.FS.writeFile(`/workspace/${file.path}`, file.contents, { encoding: "utf8" });
        files.add(file.path);
      }
      revision += 1;
      return { schemaVersion: 1, revision, files: [...files].sort() };
    },
    async run({ code }) {
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
          exception: { type: error?.name ?? "PythonError", message: String(error), traceback: String(error) },
          stdout: "",
          stderr: "",
          artifacts: [],
          durationMs: 0,
        };
      }
    },
  };
});

after(async () => {
  pyodide?.globals.delete("RESULT");
  await vite?.close();
});

function lessonSource(lesson) {
  return implementationSource(lesson, lesson.implementation.codeBlocks.map((block) => block.code));
}

function contractsFor(path) {
  return contracts.contracts.filter((contract) => contract.cases.every((exerciseCase) => exerciseCase.invoke.modulePath === path));
}

test("all fourteen routed lessons are Python and expose every contracted callable", () => {
  assert.equal(curriculum.lessons.length, 14);
  assert.equal(contracts.contracts.length, 34);
  assert.equal(contracts.contracts.reduce((total, contract) => total + contract.cases.length, 0), 153);

  const routedPaths = new Set();
  for (const { lesson, projectPath } of curriculum.lessons) {
    assert.match(projectPath, /\.py$/, lesson.id);
    assert.match(lesson.implementation.filename, /\.py$/, lesson.id);
    assert.equal(projectPath.endsWith(lesson.implementation.filename), true, lesson.id);
    assert.equal(routedPaths.has(projectPath), false, `duplicate routed path ${projectPath}`);
    routedPaths.add(projectPath);
    const source = lessonSource(lesson);
    for (const contract of contractsFor(projectPath)) {
      const exportName = contract.cases[0].invoke.exportName;
      assert.match(source, new RegExp(`(^|\\n)def ${exportName}\\(`), `${contract.id} must expose ${exportName}`);
    }
  }
  assert.equal(routedPaths.size, 14);
});

test("all 153 authored cases pass against the exact lesson references in real Pyodide and NumPy", async () => {
  let caseCount = 0;
  for (const { lesson, projectPath } of curriculum.lessons) {
    const selected = contractsFor(projectPath);
    const run = await runPythonLessonContracts({
      path: projectPath,
      source: lessonSource(lesson),
      contracts: selected,
      pythonLab,
    });
    caseCount += run.cases.length;
    assert.equal(
      run.cases.length,
      selected.reduce((total, contract) => total + contract.cases.length, 0),
      `${lesson.id}: ${run.results.map((result) => result.detail).join(" | ")}`,
    );
    assert.deepEqual(
      run.results.filter((result) => !result.passed),
      [],
      `${lesson.id}: ${run.results.filter((result) => !result.passed).map((result) => `${result.id}: ${result.detail}`).join("\n")}`,
    );
  }
  assert.equal(caseCount, 153);
});

test("wrong answers, syntax errors, missing callables, thrown exceptions, and worker timeouts fail with useful feedback", async () => {
  const entry = curriculum.lessons.find(({ lesson }) => lesson.id === "neural-language-models");
  assert.ok(entry);
  const contract = contractsFor(entry.projectPath).find((candidate) => candidate.id.endsWith("/stable-softmax"));
  assert.ok(contract);

  const attempts = [
    ["plausible wrong answer", "def stable_softmax(logits, temperature=1):\n    return [1 / len(logits)] * len(logits)", /finite|logits|outside|probability|distribution/i],
    ["syntax error", "def stable_softmax(logits, temperature=1)\n    return logits", /SyntaxError|syntax|expected ':'/i],
    ["missing callable", "def another_function(logits, temperature=1):\n    return logits", /define stable_softmax|NameError/i],
    ["thrown exception", "def stable_softmax(logits, temperature=1):\n    raise ValueError('temperature exploded')", /temperature exploded|ValueError/i],
  ];
  for (const [label, source, expectedFeedback] of attempts) {
    const run = await runPythonLessonContracts({ path: entry.projectPath, source, contracts: [contract], pythonLab });
    assert.equal(run.results[0].passed, false, label);
    assert.match(run.results[0].detail, expectedFeedback, label);
  }

  const timeoutRun = await runPythonLessonContracts({
    path: entry.projectPath,
    source: "def stable_softmax(logits, temperature=1):\n    while True:\n        pass",
    contracts: [contract],
    pythonLab: {
      initialize: pythonLab.initialize,
      sync: pythonLab.sync,
      async run() { throw new Error("CPython exceeded the 30000ms limit and was restarted."); },
    },
  });
  assert.equal(timeoutRun.results[0].passed, false);
  assert.match(timeoutRun.results[0].detail, /exceeded.*limit.*restarted/i);
});

test("a cell can run independently without definitions from adjacent cells", async () => {
  const entry = curriculum.lessons.find(({ lesson }) => lesson.id === "neural-language-models");
  const block = entry.lesson.implementation.codeBlocks.find((candidate) => candidate.id === "stable-softmax");
  const contract = contractsFor(entry.projectPath).find((candidate) => candidate.id.endsWith("/stable-softmax"));
  const run = await runPythonLessonContracts({
    path: entry.projectPath,
    source: implementationSource(entry.lesson, [block.code]),
    contracts: [contract],
    pythonLab,
  });
  assert.equal(run.results[0].passed, true, run.results[0].detail);
});

test("promotable CPython evidence requires the exact contract-case set", () => {
  const selected = [contracts.contracts[0]];
  const complete = selected[0].cases.map((exerciseCase) => ({
    contractId: selected[0].id,
    caseId: exerciseCase.id,
  }));
  assert.equal(exerciseCaseResultsAreComplete(selected, complete), true);
  assert.equal(exerciseCaseResultsAreComplete(selected, complete.slice(1)), false, "missing case");
  assert.equal(exerciseCaseResultsAreComplete(selected, [...complete.slice(1), complete[1]]), false, "duplicate case");
  assert.equal(exerciseCaseResultsAreComplete(selected, [...complete.slice(1), { contractId: selected[0].id, caseId: "invented" }]), false, "unknown case");
});
