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
    vite.ssrLoadModule("/examples/learning-platform/llm-learning/lessons/course.ts"),
    vite.ssrLoadModule("/examples/learning-platform/llm-learning/content/llm-systems/contracts.ts"),
    vite.ssrLoadModule("/examples/learning-platform/llm-learning/lessons/implementation-source.ts"),
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
    async run({ code }, options = {}) {
      pyodide.setStdout({ batched(text) { options.onEvent?.({ type: "stdout", requestId: "test-run", text: `${text}\n` }); } });
      pyodide.setStderr({ batched(text) { options.onEvent?.({ type: "stderr", requestId: "test-run", text: `${text}\n` }); } });
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
      } finally {
        pyodide.setStdout();
        pyodide.setStderr();
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

test("lessons 7-10 reject two plausible wrong Python implementations per block with targeted feedback", async () => {
  const systemLessonIds = new Set([
    "inference-runtime",
    "streaming-transport",
    "scheduling-memory",
    "reliability-observability",
  ]);
  const entries = new Map(curriculum.lessons
    .filter(({ lesson }) => systemLessonIds.has(lesson.id))
    .map((entry) => [entry.lesson.id, entry]));
  const exercise = (lessonId, blockId) => {
    const entry = entries.get(lessonId);
    assert.ok(entry, lessonId);
    const block = entry.lesson.implementation.codeBlocks.find((candidate) => candidate.id === blockId);
    const contract = contracts.contracts.find((candidate) => candidate.id === `${lessonId}/${blockId}`);
    assert.ok(block, `${lessonId}/${blockId} block`);
    assert.ok(contract, `${lessonId}/${blockId} contract`);
    return { entry, block, contract };
  };
  const replace = (source, search, replacement) => {
    assert.match(source, new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    return source.replace(search, replacement);
  };

  const phases = exercise("inference-runtime", "inference-phases");
  const cache = exercise("inference-runtime", "kv-bytes");
  const encoder = exercise("streaming-transport", "encode-sse");
  const parser = exercise("streaming-transport", "parse-sse");
  const allocation = exercise("scheduling-memory", "page-allocation");
  const iteration = exercise("scheduling-memory", "batch-step");
  const retry = exercise("reliability-observability", "retry-policy");
  const guard = exercise("reliability-observability", "terminal-guard");

  const attempts = [
    [phases, "counts every generated token as a decode forward", replace(phases.block.code, "decode_forwards = max(0, generated_tokens - 1)", "decode_forwards = generated_tokens"), /31 later decode passes because the prefill logits sample token 1/],
    [phases, "does not clamp the zero-token decode count", replace(phases.block.code, "decode_forwards = max(0, generated_tokens - 1)", "decode_forwards = generated_tokens - 1"), /Clamp maxNewTokens - 1/],
    [cache, "stores only keys", replace(cache.block.code, "return 2 * layers * kv_heads * tokens * head_dimension * bytes_per_value", "return layers * kv_heads * tokens * head_dimension * bytes_per_value"), /Multiply by 2 because every cached position stores both key and value/],
    [cache, "omits the layer factor", replace(cache.block.code, "return 2 * layers * kv_heads * tokens * head_dimension * bytes_per_value", "return 2 * kv_heads * tokens * head_dimension * bytes_per_value"), /all 3 layers/],
    [encoder, "omits the terminating blank line", `import json

def encode_sse(event, data):
    if not isinstance(event, str) or not event or "\\r" in event or "\\n" in event:
        raise ValueError("event name must be non-empty and contain no CR or LF")
    return f"event: {event}\\ndata: {json.dumps(data, separators=(',', ':'), ensure_ascii=False)}\\n"`, /Terminate the frame with a final blank line/],
    [encoder, "hard-codes the token event type", `import json

def encode_sse(event, data):
    if not isinstance(event, str) or not event or "\\r" in event or "\\n" in event:
        raise ValueError("event name must be non-empty and contain no CR or LF")
    return f"event: token\\ndata: {json.dumps(data, separators=(',', ':'), ensure_ascii=False)}\\n\\n"`, /Use the event argument for every event type/],
    [parser, "ignores the previous text remainder", replace(parser.block.code, "combined = buffer + chunk", "combined = chunk"), /Prepend the previous remainder/],
    [parser, "emits only the first complete frame", replace(parser.block.code, 'return {"events": events, "remainder": remainder}', 'return {"events": events[:1], "remainder": remainder}'), /Process all complete frames in order/],
    [allocation, "uses floor division", replace(allocation.block.code, "pages = (tokens + page_size - 1) // page_size", "pages = tokens // page_size"), /Use ceiling division/],
    [allocation, "always allocates one extra page", replace(allocation.block.code, "pages = (tokens + page_size - 1) // page_size", "pages = tokens // page_size + 1"), /do not add a page unconditionally/],
    [iteration, "returns only surviving active work", `def decode_iteration(active_requests):
    return [
        {**request, "remaining": request["remaining"] - 1, "generated": request["generated"] + 1}
        for request in active_requests
        if request["remaining"] > 1
    ]`, /separate active and completed arrays/],
    [iteration, "advances only the first request", replace(iteration.block.code, "for request in active_requests:", "for request in active_requests[:1]:"), /Move every request/],
    [retry, "ignores visible output", replace(retry.block.code, "return transient and tokens_emitted == 0 and attempt + 1 < max_attempts", "return transient and attempt + 1 < max_attempts"), /Return false once tokensEmitted is greater than zero/],
    [retry, "uses an off-by-one attempt budget", replace(retry.block.code, "attempt + 1 < max_attempts", "attempt < max_attempts"), /attempt 1 is already the second and final attempt/],
    [guard, "checks status without attempt identity", `def accept_event(request, event):
    return request["status"] in {"queued", "loading", "prefill", "streaming"}`, /Compare request\.attemptId with event\.attemptId/],
    [guard, "checks identity without terminal status", `def accept_event(request, event):
    return request["attemptId"] == event["attemptId"] and request["requestId"] == event["requestId"]`, /Return false after complete/],
  ];

  assert.equal(attempts.length, 16);
  for (const [target, label, source, expectedFeedback] of attempts) {
    assert.notEqual(source, target.block.code, label);
    const run = await runPythonLessonContracts({
      path: target.entry.projectPath,
      source,
      contracts: [target.contract],
      pythonLab,
    });
    assert.equal(run.results[0].passed, false, label);
    assert.match(run.results[0].detail, expectedFeedback, `${label}: ${run.results[0].detail}`);
  }
});

test("a cell can run independently without definitions from adjacent cells", async () => {
  const entry = curriculum.lessons.find(({ lesson }) => lesson.id === "neural-language-models");
  const block = entry.lesson.implementation.codeBlocks.find((candidate) => candidate.id === "stable-softmax");
  const contract = contractsFor(entry.projectPath).find((candidate) => candidate.id.endsWith("/stable-softmax"));
  const run = await runPythonLessonContracts({
    path: entry.projectPath,
    source: `print("visible cell output")\n${implementationSource(entry.lesson, [block.code])}`,
    contracts: [contract],
    pythonLab,
  });
  assert.equal(run.results[0].passed, true, run.results[0].detail);
  assert.equal(run.stdout.match(/visible cell output/g)?.length, contract.cases.length);
  assert.equal(run.stderr, "");
});

test("the combined lesson file rejects a cross-block export override that isolated cells miss", async () => {
  const entry = curriculum.lessons.find(({ lesson }) => lesson.id === "character-rnns");
  const [transition, loss, clipping] = entry.lesson.implementation.codeBlocks;
  const selected = contractsFor(entry.projectPath);
  const contractFor = (block) => selected.find((contract) => contract.id.endsWith(`/${block.id}`));
  const sabotagedLoss = `${loss.code}\n\ndef rnn_step(input_vector, previous, parameters):\n    return [0]`;
  const isolatedSources = [transition.code, sabotagedLoss, clipping.code];

  for (const [index, block] of [transition, loss, clipping].entries()) {
    const isolated = await runPythonLessonContracts({
      path: entry.projectPath,
      source: implementationSource(entry.lesson, [isolatedSources[index]]),
      contracts: [contractFor(block)],
      pythonLab,
    });
    assert.equal(isolated.results[0].passed, true, `${block.id}: ${isolated.results[0].detail}`);
  }

  const combined = await runPythonLessonContracts({
    path: entry.projectPath,
    source: implementationSource(entry.lesson, isolatedSources),
    contracts: selected,
    pythonLab,
  });
  assert.equal(combined.results.find((result) => result.id.endsWith("/rnn-step")).passed, false);
  assert.equal(combined.results.find((result) => result.id.endsWith("/cross-entropy")).passed, true);
  assert.equal(combined.results.find((result) => result.id.endsWith("/gradient-clipping")).passed, true);
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
