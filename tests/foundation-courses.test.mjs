import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadPyodide } from "pyodide";
import { createServer } from "vite";

const root = new URL("../", import.meta.url);

let browserLabContracts;
let course;
let exerciseCopy;
let foundationContracts;
let implementationSource;
let manifests;
let pyodide;
let pythonLab;
let runPythonLessonContracts;
let vite;

before(async () => {
  vite = await createServer({
    root: fileURLToPath(root),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });

  [
    browserLabContracts,
    course,
    exerciseCopy,
    foundationContracts,
    implementationSource,
    manifests,
    { runPythonLessonContracts },
  ] = await Promise.all([
    vite.ssrLoadModule("/packages/browser-lab/src/contracts.ts"),
    vite.ssrLoadModule("/app/lessons/course.ts"),
    vite.ssrLoadModule("/app/lessons/foundations/exercise-contracts.ts"),
    vite.ssrLoadModule("/app/content/foundations/contracts.ts"),
    vite.ssrLoadModule("/app/lessons/implementation-source.ts"),
    vite.ssrLoadModule("/app/content/foundations/manifests.ts"),
    vite.ssrLoadModule("/app/features/ide/python-lesson-service.ts"),
  ]);

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
        try {
          pyodide.FS.unlink(`/workspace/${path}`);
        } catch {}
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
    async run({ code }, options = {}) {
      pyodide.setStdout({
        batched(text) {
          options.onEvent?.({ type: "stdout", requestId: "foundation-test", text: `${text}\n` });
        },
      });
      pyodide.setStderr({
        batched(text) {
          options.onEvent?.({ type: "stderr", requestId: "foundation-test", text: `${text}\n` });
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

function foundationEntries() {
  return [
    ...course.linearAlgebraCurriculum.lessons,
    ...course.machineLearningBasicsCurriculum.lessons,
  ];
}

function lessonSource(lesson) {
  return implementationSource.lessonImplementationSource(
    lesson,
    lesson.implementation.codeBlocks.map((block) => block.code),
  );
}

function contractsFor(path) {
  return foundationContracts.foundationContractSuite.contracts.filter((contract) =>
    contract.cases.every((exerciseCase) => exerciseCase.invoke.modulePath === path),
  );
}

test("the catalog keeps foundations, applied study, and the project course distinct", () => {
  assert.deepEqual(
    course.coursePrograms.map(({ id, kind, href }) => ({ id, kind, href })),
    [
      { id: "linear-algebra", kind: "foundation", href: "/courses/linear-algebra" },
      { id: "machine-learning-basics", kind: "foundation", href: "/courses/machine-learning-basics" },
      { id: "harness-engineering", kind: "applied", href: "/courses/harness-engineering" },
      { id: "llm-systems", kind: "project", href: "/courses/llm-systems" },
    ],
  );
  assert.equal(course.linearAlgebraCurriculum.lessons.length, 5);
  assert.equal(course.machineLearningBasicsCurriculum.lessons.length, 5);
  assert.equal(course.courseLessons.length, 14, "the Browser Chat build must retain exactly fourteen lessons");
  assert.equal(course.allRoutedLessons.length, 32);
  assert.equal(new Set(course.allRoutedLessons.map((lesson) => lesson.id)).size, 32);

  for (const lesson of course.foundationLessons) {
    assert.equal(lesson.projectScope, "standalone", lesson.id);
    assert.notEqual(lesson.programId, "llm-systems", lesson.id);
    assert.match(course.getLessonCourseHref(lesson), /^\/courses\/(linear-algebra|machine-learning-basics)$/);
  }
  for (const lesson of course.courseLessons) {
    assert.equal(lesson.projectScope, "browser-chat", lesson.id);
    assert.equal(lesson.programId, "llm-systems", lesson.id);
    assert.equal(course.getLessonCourseHref(lesson), `/courses/llm-systems/${lesson.courseId}`);
  }
});

test("every foundation code block has one aligned typed contract and one learner-facing contract", () => {
  const entries = foundationEntries();
  const expected = new Map();
  for (const { lesson, projectPath } of entries) {
    assert.match(projectPath, new RegExp(`^${lesson.programId}/.+\\.py$`), lesson.id);
    assert.equal(projectPath.endsWith(lesson.implementation.filename), true, lesson.id);
    for (const block of lesson.implementation.codeBlocks) {
      const functionMatch = block.code.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/m);
      assert.ok(functionMatch, `${lesson.id}/${block.id} exposes a top-level Python function`);
      expected.set(`${lesson.id}/${block.id}`, {
        exportName: functionMatch[1],
        projectPath,
      });
    }
  }

  const typed = foundationContracts.foundationExerciseContracts;
  const ui = exerciseCopy.foundationExerciseContractCopy;
  assert.equal(expected.size, 20);
  assert.equal(typed.length, 20);
  assert.equal(Object.keys(ui).length, 20);
  assert.equal(new Set(typed.map((contract) => contract.id)).size, 20);
  assert.deepEqual([...expected.keys()].sort(), typed.map((contract) => contract.id).sort());
  assert.deepEqual([...expected.keys()].sort(), Object.keys(ui).sort());

  for (const contract of typed) {
    const definition = expected.get(contract.id);
    assert.ok(definition, contract.id);
    browserLabContracts.validateExerciseContract(contract);
    assert.ok(contract.cases.length > 0, contract.id);
    for (const exerciseCase of contract.cases) {
      assert.equal(exerciseCase.invoke.modulePath, definition.projectPath, contract.id);
      assert.equal(exerciseCase.invoke.exportName, definition.exportName, contract.id);
      assert.ok(exerciseCase.assertions.length > 0, `${contract.id}/${exerciseCase.id}`);
    }
    for (const field of ["signature", "inputs", "output", "rule", "example"]) {
      assert.ok(ui[contract.id][field].trim(), `${contract.id} learner-facing ${field}`);
    }
  }
});

test("linear algebra teaches the operations with guided plain-Python algorithms", () => {
  for (const { lesson } of course.linearAlgebraCurriculum.lessons) {
    assert.doesNotMatch(lesson.implementation.tensorOps.join(" "), /numpy|np\./i, lesson.id);
    for (const block of lesson.implementation.codeBlocks) {
      assert.ok(block.starterCode, `${lesson.id}/${block.id} has a guided starter`);
      assert.match(block.starterCode, /TODO:/, `${lesson.id}/${block.id} identifies the learner step`);
      assert.match(block.starterCode, /NotImplementedError/, `${lesson.id}/${block.id} starts incomplete`);
      assert.doesNotMatch(block.starterCode, /numpy|np\./i, `${lesson.id}/${block.id} starter`);
      assert.doesNotMatch(block.code, /numpy|np\./i, `${lesson.id}/${block.id} reference`);
      assert.notEqual(block.starterCode, block.code, `${lesson.id}/${block.id} does not reveal the answer`);
    }
  }
});

test("foundation manifests own only prerequisite files and do not declare an advanced capstone", () => {
  const definitions = [manifests.linearAlgebraManifest, manifests.machineLearningBasicsManifest];
  assert.deepEqual(definitions.map((manifest) => manifest.id), ["linear-algebra", "machine-learning-basics"]);
  for (const manifest of definitions) {
    assert.equal(manifest.capstone, undefined);
    assert.equal(manifest.modules.length, 1);
    assert.equal(manifest.modules[0].lessons.length, 5);
    for (const lesson of manifest.modules[0].lessons) {
      assert.match(lesson.projectPath, new RegExp(`^${manifest.id}/.+\\.py$`));
      assert.doesNotMatch(lesson.projectPath, /^(models|systems|backend|product)\//);
    }
  }
});

test("foundation routes stay independent while legacy advanced aliases redirect to nested module URLs", async () => {
  const standaloneRoute = await readFile(new URL("../app/courses/[course]/page.tsx", import.meta.url), "utf8");
  const advancedRoute = await readFile(new URL("../app/courses/llm-systems/[module]/page.tsx", import.meta.url), "utf8");
  assert.match(standaloneRoute, /program\.kind !== "project"/);
  assert.match(standaloneRoute, /redirect\(`\/courses\/llm-systems\/\$\{legacyTrack\.id\}`\)/);
  assert.doesNotMatch(standaloneRoute, /href="\/(?:project|workspace|capstone)"/);
  assert.match(advancedRoute, /href="\/project"/);
  assert.match(advancedRoute, /href="\/workspace"/);
  assert.deepEqual(course.courseTracks.map((track) => track.id), ["models", "systems", "backend", "product"]);
  for (const track of course.courseTracks) {
    assert.equal(`/courses/${track.id}`.startsWith("/courses/llm-systems/"), false);
    assert.equal(`/courses/llm-systems/${track.id}`.split("/").at(-1), track.id);
  }
});

test("all twenty foundation references pass their host contracts in real Pyodide", { timeout: 60_000 }, async () => {
  let contractCount = 0;
  const failures = [];
  for (const { lesson, projectPath } of foundationEntries()) {
    const selected = contractsFor(projectPath);
    const run = await runPythonLessonContracts({
      path: projectPath,
      source: lessonSource(lesson),
      contracts: selected,
      pythonLab,
    });
    contractCount += selected.length;
    failures.push(...run.results
      .filter((result) => !result.passed)
      .map((result) => `${lesson.id}: ${result.id}: ${result.detail}`));
  }
  assert.equal(contractCount, 20);
  assert.deepEqual(failures, []);
});

test("plausible wrong answers fail in both prerequisite courses", { timeout: 60_000 }, async () => {
  const attempts = [
    {
      path: "linear-algebra/arrays-and-shapes.py",
      contractId: "arrays-and-shapes/describe-array",
      source: "def describe_array(values):\n    return {'rank': 1, 'shape': [len(values)], 'size': len(values)}",
    },
    {
      path: "machine-learning-basics/linear-regression.py",
      contractId: "ml-linear-regression/linear-prediction",
      source: "def linear_prediction(features, weights, bias):\n    return bias",
    },
  ];

  for (const attempt of attempts) {
    const contract = foundationContracts.foundationExerciseContracts.find(({ id }) => id === attempt.contractId);
    assert.ok(contract, attempt.contractId);
    const run = await runPythonLessonContracts({
      path: attempt.path,
      source: attempt.source,
      contracts: [contract],
      pythonLab,
    });
    assert.equal(run.results.length, 1, attempt.contractId);
    assert.equal(run.results[0].passed, false, attempt.contractId);
    assert.match(run.results[0].detail, /failed|did not match|outside|invocation threw/i, attempt.contractId);
  }
});
