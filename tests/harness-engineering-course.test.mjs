import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadPyodide } from "pyodide";
import { createServer } from "vite";

const root = new URL("../", import.meta.url);
const expectedLessonIds = [
  "agent-loop",
  "tool-contracts",
  "context-selection",
  "permissions-and-sandboxes",
  "state-and-recovery",
  "agent-evaluations",
  "task-orchestration",
  "integrated-harness",
];
const allowedSourceUrls = new Set([
  "https://openai.com/index/harness-engineering/",
  "https://www.anthropic.com/engineering/building-effective-agents",
  "https://arxiv.org/abs/2210.03629",
  "https://www.w3.org/TR/hr-time-3/",
  "https://modelcontextprotocol.io/specification/2025-06-18/server/tools",
  "https://learn.chatgpt.com/docs/agent-approvals-security",
  "https://learn.chatgpt.com/docs/sandboxing",
  "https://openai.com/safety/prompt-injections/",
  "https://genai.owasp.org/llmrisk/llm01-prompt-injection/",
  "https://learn.chatgpt.com/docs/agent-configuration/agents-md",
  "https://cwe.mitre.org/data/definitions/22.html",
  "https://cwe.mitre.org/data/definitions/367.html",
  "https://arxiv.org/abs/2310.06770",
  "https://arxiv.org/abs/2107.03374",
  "https://arxiv.org/abs/2406.12045",
  "https://inspect.aisi.org.uk/agents.html",
  "https://inspect.aisi.org.uk/checkpointing.html",
  "https://inspect.aisi.org.uk/metrics.html",
]);

let browserChatProject;
let browserLabContracts;
let contractRegistry;
let course;
let exerciseCopy;
let exerciseRegistry;
let experimentRegistry;
let experimentView;
let harnessContracts;
let implementationSource;
let initializationProfiles;
let learning;
let learningRegistry;
let manifestModule;
let harnessProjectTemplate;
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
    browserChatProject,
    browserLabContracts,
    contractRegistry,
    course,
    exerciseCopy,
    exerciseRegistry,
    experimentRegistry,
    experimentView,
    harnessContracts,
    implementationSource,
    learning,
    learningRegistry,
    manifestModule,
    harnessProjectTemplate,
    { runPythonLessonContracts },
  ] = await Promise.all([
    vite.ssrLoadModule("/products/courses/reference-curriculum/content/browser-chat/project-template.ts"),
    vite.ssrLoadModule("/packages/browser-lab/src/contracts.ts"),
    vite.ssrLoadModule("/products/courses/reference-curriculum/lessons/contract-suite.ts"),
    vite.ssrLoadModule("/products/courses/reference-curriculum/lessons/course.ts"),
    vite.ssrLoadModule("/products/courses/reference-curriculum/lessons/harness-engineering/exercise-contracts.ts"),
    vite.ssrLoadModule("/products/courses/reference-curriculum/lessons/exercise-contracts.ts"),
    vite.ssrLoadModule("/products/courses/reference-curriculum/content/harness-engineering/experiments.ts"),
    vite.ssrLoadModule("/app/components/HarnessExperiment.tsx"),
    vite.ssrLoadModule("/products/courses/reference-curriculum/content/harness-engineering/contracts.ts"),
    vite.ssrLoadModule("/products/courses/reference-curriculum/lessons/implementation-source.ts"),
    vite.ssrLoadModule("/products/courses/reference-curriculum/content/harness-engineering/learning.ts"),
    vite.ssrLoadModule("/products/courses/reference-curriculum/lessons/learning.ts"),
    vite.ssrLoadModule("/products/courses/reference-curriculum/content/harness-engineering/manifest.ts"),
    vite.ssrLoadModule("/products/courses/reference-curriculum/content/harness-engineering/project-template.ts"),
    vite.ssrLoadModule("/app/features/ide/python-lesson-service.ts"),
  ]);

  pyodide = await loadPyodide({
    indexURL: fileURLToPath(new URL(".", import.meta.resolve("pyodide/package.json"))),
  });
  pyodide.FS.mkdirTree("/workspace");

  let revision = 0;
  const files = new Set();
  initializationProfiles = [];
  pythonLab = {
    async initialize(options) {
      initializationProfiles.push(options.packages);
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
          options.onEvent?.({ type: "stdout", requestId: "harness-course-test", text: `${text}\n` });
        },
      });
      pyodide.setStderr({
        batched(text) {
          options.onEvent?.({ type: "stderr", requestId: "harness-course-test", text: `${text}\n` });
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

function entries() {
  return course.harnessEngineeringCurriculum.lessons;
}

function contractsFor(path) {
  return harnessContracts.harnessEngineeringContractSuite.contracts.filter((contract) =>
    contract.cases.every((exerciseCase) => exerciseCase.invoke.modulePath === path),
  );
}

function referenceProjectFiles() {
  return Object.fromEntries(entries().map(({ lesson, projectPath }) => [
    projectPath,
    implementationSource.lessonImplementationSource(
      lesson,
      lesson.implementation.codeBlocks.map((block) => block.code),
    ),
  ]));
}

function replaceOnce(source, search, replacement) {
  assert.ok(source.includes(search), `reference source contains ${search}`);
  const changed = source.replace(search, replacement);
  assert.notEqual(changed, source);
  return changed;
}

test("the applied course owns eight lessons in an isolated Harness workspace and no Browser Chat files", () => {
  const manifest = manifestModule.harnessEngineeringManifest;
  const curriculumEntries = entries();
  assert.equal(manifest.id, "harness-engineering");
  assert.equal(manifest.capstone, undefined);
  assert.equal(manifest.modules.length, 1);
  assert.equal(manifest.modules[0].lessons.length, 8);
  assert.equal(curriculumEntries.length, 8);
  assert.deepEqual(curriculumEntries.map(({ lesson }) => lesson.id), expectedLessonIds);
  assert.equal(course.coursePrograms.find(({ id }) => id === manifest.id)?.kind, "applied");

  const manifestPaths = manifest.modules[0].lessons.map(({ projectPath }) => projectPath);
  assert.equal(new Set(manifestPaths).size, 8);
  for (const { lesson, projectPath } of curriculumEntries) {
    assert.equal(lesson.projectScope, "harness-engineering", lesson.id);
    assert.equal(lesson.programId, "harness-engineering", lesson.id);
    assert.equal(lesson.courseId, "harness-engineering", lesson.id);
    assert.equal(course.getLessonCourseHref(lesson), "/courses/harness-engineering", lesson.id);
    assert.match(projectPath, /^harness\/[a-z_]+\.py$/, lesson.id);
    assert.doesNotMatch(projectPath, /-/, `${lesson.id}: Python module paths remain importable`);
    assert.equal(projectPath.endsWith(lesson.implementation.filename), true, lesson.id);
    assert.doesNotMatch(projectPath, /^(models|systems|backend|product|capstone)\//, lesson.id);
  }

  assert.equal(course.courseLessons.length, 14, "Browser Chat keeps its existing fourteen lessons");
  assert.equal(course.courseLessons.some(({ id }) => expectedLessonIds.includes(id)), false);
  const browserChatPaths = browserChatProject.CANONICAL_BROWSER_CHAT_FILES.map(({ path }) => path);
  assert.equal(browserChatPaths.some((path) => path.startsWith("harness/")), false);
  assert.equal(manifestPaths.some((path) => browserChatProject.browserChatProjectFileByPath.has(path)), false);
  assert.deepEqual(harnessProjectTemplate.HARNESS_PROJECT_PATHS, manifestPaths);
});

test("all eight lessons have technical reading, sources, learning checks, diagrams, experiments, and sixteen unique cells", () => {
  const curriculumEntries = entries();
  const learningKeys = Object.keys(learning.harnessEngineeringLearningOutcomes).sort();
  assert.deepEqual(learningKeys, [...expectedLessonIds].sort());

  const cellIds = [];
  const functionNames = [];
  const variants = [];
  for (const { lesson } of curriculumEntries) {
    assert.ok(lesson.thesis.length > 70, lesson.id);
    assert.ok(lesson.summary.length >= 3 && lesson.summary.length <= 4, lesson.id);
    assert.equal(lesson.diagram.nodes.length, 4, lesson.id);
    assert.ok(lesson.diagram.caption.length > 60, lesson.id);
    assert.ok(lesson.sources.length >= 2, lesson.id);
    assert.equal(lesson.paperUrl, lesson.sources[0].url, lesson.id);
    for (const source of lesson.sources) {
      assert.ok(allowedSourceUrls.has(source.url), `${lesson.id}: unexpected source ${source.url}`);
      assert.ok(source.title.trim() && source.authors.trim() && source.relevance.trim(), lesson.id);
    }

    const outcome = learning.harnessEngineeringLearningOutcomes[lesson.id];
    assert.ok(outcome, lesson.id);
    assert.equal(learningRegistry.lessonLearningOutcome(lesson.id), outcome, lesson.id);
    assert.ok(outcome.concept.length > 60 && outcome.before.length > 30 && outcome.after.length > 50, lesson.id);
    assert.equal(outcome.check.choices.length, 3, lesson.id);
    assert.ok(outcome.check.choices.some(({ id }) => id === outcome.check.correctChoiceId), lesson.id);

    assert.equal(lesson.experiment.kind, "harness", lesson.id);
    assert.ok(lesson.experiment.variant, lesson.id);
    variants.push(lesson.experiment.variant);
    assert.equal(lesson.implementation.codeBlocks.length, 2, lesson.id);
    for (const block of lesson.implementation.codeBlocks) {
      const key = `${lesson.id}/${block.id}`;
      cellIds.push(key);
      const functionMatch = block.code.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/m);
      assert.ok(functionMatch, `${key} exposes a top-level Python function`);
      functionNames.push(functionMatch[1]);
      assert.ok(block.purpose.length > 40, key);
      assert.equal(block.concepts?.length, 3, key);
    }
  }

  assert.equal(cellIds.length, 16);
  assert.equal(new Set(cellIds).size, 16);
  assert.equal(new Set(functionNames).size, 16);
  assert.equal(new Set(variants).size, 8);
  assert.deepEqual(variants, [...experimentRegistry.harnessExperimentVariants]);
});

test("permission experiment metrics are derived from the same five decisions shown in the trace", () => {
  const expected = [
    { Allowed: "1", "Needs approval": "2", Denied: "2" },
    { Allowed: "2", "Needs approval": "1", Denied: "2" },
    { Allowed: "3", "Needs approval": "0", Denied: "2" },
  ];
  for (const [level, counts] of expected.entries()) {
    const result = experimentView.harnessExperimentResult("permission-boundaries", level);
    assert.equal(result.trace.length, 5);
    assert.deepEqual(Object.fromEntries(result.metrics.map(({ label, value }) => [label, value])), counts);
    for (const [label, count] of Object.entries(counts)) {
      const decision = label === "Allowed" ? "allow" : label === "Needs approval" ? "confirm" : "deny";
      assert.equal(result.trace.filter(({ detail }) => detail.startsWith(`${decision} ·`)).length, Number(count));
    }
  }
});

test("every harness experiment exposes a valid initial control state", () => {
  for (const variant of experimentRegistry.harnessExperimentVariants) {
    const seed = experimentView.harnessExperimentResult(variant, 0);
    assert.ok(seed.initial >= seed.minimum && seed.initial <= seed.maximum, variant);
    const result = experimentView.harnessExperimentResult(variant, seed.initial);
    assert.ok(result.metrics.length >= 3, variant);
    assert.ok(result.trace.length >= 2, variant);
  }
});

test("every cell has one exact typed contract and one learner-facing contract through the global registries", () => {
  const expected = new Map();
  for (const { lesson, projectPath } of entries()) {
    for (const block of lesson.implementation.codeBlocks) {
      const topLevelFunctions = [...block.code.matchAll(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm)]
        .map((match) => match[1]);
      assert.ok(topLevelFunctions.length > 0);
      expected.set(`${lesson.id}/${block.id}`, {
        block,
        topLevelFunctions,
        lesson,
        projectPath,
      });
    }
  }

  const typed = harnessContracts.harnessEngineeringExerciseContracts;
  const learnerCopy = exerciseCopy.harnessEngineeringExerciseContractCopy;
  assert.equal(expected.size, 16);
  assert.equal(typed.length, 16);
  assert.equal(Object.keys(learnerCopy).length, 16);
  assert.equal(new Set(typed.map(({ id }) => id)).size, 16);
  assert.deepEqual(typed.map(({ id }) => id).sort(), [...expected.keys()].sort());
  assert.deepEqual(Object.keys(learnerCopy).sort(), [...expected.keys()].sort());

  for (const contract of typed) {
    const definition = expected.get(contract.id);
    assert.ok(definition, contract.id);
    assert.equal(contract.label, definition.block.label, contract.id);
    browserLabContracts.validateExerciseContract(contract);
    assert.ok(contract.cases.length >= 3, contract.id);
    for (const exerciseCase of contract.cases) {
      assert.equal(exerciseCase.invoke.modulePath, definition.projectPath, contract.id);
      assert.equal(exerciseCase.invoke.exportName, contract.cases[0].invoke.exportName, contract.id);
      assert.ok(definition.topLevelFunctions.includes(exerciseCase.invoke.exportName), contract.id);
      assert.ok(exerciseCase.assertions.length > 0, `${contract.id}/${exerciseCase.id}`);
    }

    const copy = learnerCopy[contract.id];
    for (const field of ["signature", "inputs", "output", "rule", "example"]) {
      assert.ok(copy[field].trim(), `${contract.id}: learner-facing ${field}`);
    }
    assert.match(copy.signature, new RegExp(`\\b${contract.cases[0].invoke.exportName}\\b`), contract.id);
    assert.deepEqual(
      exerciseRegistry.exerciseContractFor(definition.lesson.id, definition.block.id),
      copy,
      `${contract.id}: global learner-copy registry`,
    );
    assert.equal(
      contractRegistry.contractSuiteForLesson(definition.lesson.id),
      harnessContracts.harnessEngineeringContractSuite,
      `${contract.id}: global typed-contract registry`,
    );
  }
});

test("all sixteen independent reference cells pass every host contract in real Pyodide", { timeout: 60_000 }, async () => {
  let contractCount = 0;
  let caseCount = 0;
  const failures = [];

  for (const { lesson, projectPath } of entries()) {
    const lessonContracts = contractsFor(projectPath);
    assert.equal(lessonContracts.length, 2, lesson.id);
    for (const block of lesson.implementation.codeBlocks) {
      const contract = lessonContracts.find(({ id }) => id === `${lesson.id}/${block.id}`);
      assert.ok(contract, `${lesson.id}/${block.id}`);
      const source = implementationSource.lessonImplementationSource(lesson, [block.code]);
      const run = await runPythonLessonContracts({
        path: projectPath,
        source,
        contracts: [contract],
        supportFiles: referenceProjectFiles(),
        pythonLab,
      });
      contractCount += 1;
      caseCount += run.cases.length;
      failures.push(...run.results
        .filter((result) => !result.passed)
        .map((result) => `${lesson.id}/${block.id}: ${result.detail}`));
    }
  }

  const authoredCaseCount = harnessContracts.harnessEngineeringExerciseContracts
    .reduce((total, contract) => total + contract.cases.length, 0);
  assert.equal(contractCount, 16);
  assert.equal(caseCount, authoredCaseCount);
  assert.ok(caseCount >= 50, "the suite exercises more than happy paths");
  assert.deepEqual(failures, []);
  assert.ok(initializationProfiles.length >= contractCount);
  assert.ok(initializationProfiles.every((packages) => packages.length === 0), "stdlib-only harness cells must not download NumPy");
});

test("plausible harness mistakes fail with specific learner-facing directions", { timeout: 60_000 }, async () => {
  const target = (lessonId, blockId) => {
    const entry = entries().find(({ lesson }) => lesson.id === lessonId);
    assert.ok(entry, lessonId);
    const block = entry.lesson.implementation.codeBlocks.find(({ id }) => id === blockId);
    const contract = harnessContracts.harnessEngineeringExerciseContracts
      .find(({ id }) => id === `${lessonId}/${blockId}`);
    assert.ok(block && contract, `${lessonId}/${blockId}`);
    return { ...entry, block, contract };
  };

  const parser = target("agent-loop", "parse-model-response");
  const pager = target("tool-contracts", "page-tool-results");
  const context = target("context-selection", "select-context");
  const permissions = target("permissions-and-sandboxes", "permission-decision");
  const recovery = target("state-and-recovery", "apply-run-event");
  const metrics = target("agent-evaluations", "trial-metrics");
  const orchestration = target("task-orchestration", "parallel-batches");
  const integrated = target("integrated-harness", "run-harness");
  const attempts = [
    {
      ...parser,
      label: "accepts a response containing final text and a tool call",
      source: replaceOnce(parser.block.code, "if has_final == has_tool_call:", "if not has_final and not has_tool_call:"),
      feedback: /two actions|exactly one final response or tool call/i,
    },
    {
      ...pager,
      label: "always reports another page",
      source: replaceOnce(pager.block.code, '"next_offset": end if end < len(items) else None,', '"next_offset": end,'),
      feedback: /final partial page|without another offset/i,
    },
    {
      ...context,
      label: "admits the lowest-priority context first",
      source: replaceOnce(
        context.block.code,
        'optional.sort(key=lambda pair: (-pair[1]["priority"], pair[0]))',
        'optional.sort(key=lambda pair: (pair[1]["priority"], pair[0]))',
      ),
      feedback: /required context before the best optional evidence|stable priority order/i,
    },
    {
      ...permissions,
      label: "lets allow override deny",
      source: replaceOnce(
        permissions.block.code,
        'precedence = {"allow": 0, "confirm": 1, "deny": 2}',
        'precedence = {"allow": 2, "confirm": 1, "deny": 0}',
      ),
      feedback: /deny rule override|matching deny rule/i,
    },
    {
      ...recovery,
      label: "applies a duplicate durable event twice",
      source: replaceOnce(recovery.block.code, "if event_id in seen:", "if False:"),
      feedback: /already seen|idempotent|repeated event|no-op/i,
    },
    {
      ...metrics,
      label: "confuses repeated consistency with the single-trial rate",
      source: replaceOnce(metrics.block.code, '"pass_k": math.comb(correct, k) \/ combinations if correct >= k else 0,', '"pass_k": correct \/ total,'),
      feedback: /finite-sample pass rate, pass at k, and pass k|repeated consistency/i,
    },
    {
      ...orchestration,
      label: "sorts a ready batch instead of preserving declared task order",
      source: replaceOnce(
        orchestration.block.code,
        "if task_id in remaining and dependencies[task_id] <= completed",
        "if task_id in remaining",
      ),
      feedback: /dependent work|ready tasks together|execution waves/i,
    },
    {
      ...integrated,
      label: "dispatches a confirmation-gated call without pausing",
      source: replaceOnce(integrated.block.code, 'if policy["decision"] == "confirm":', "if False:"),
      feedback: /approval-required|approval|before dispatch/i,
    },
  ];

  assert.equal(attempts.length, 8);
  for (const attempt of attempts) {
    const run = await runPythonLessonContracts({
      path: attempt.projectPath,
      source: attempt.source,
      contracts: [attempt.contract],
      supportFiles: referenceProjectFiles(),
      pythonLab,
    });
    assert.equal(run.results.length, 1, attempt.label);
    assert.equal(run.results[0].passed, false, attempt.label);
    assert.match(run.results[0].detail, attempt.feedback, `${attempt.label}: ${run.results[0].detail}`);
    assert.ok(run.results[0].detail.length > 40, `${attempt.label}: feedback should explain the next correction`);
  }
});
