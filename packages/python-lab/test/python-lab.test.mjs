import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { loadPyodide } from "pyodide";

let outputDirectory;
let pythonLab;
let outputHelpers;
let runtimeSafety;
let workerCapabilities;

test.before(async () => {
  outputDirectory = await mkdtemp(join(fileURLToPath(new URL("../", import.meta.url)), ".test-output-"));
  const entryOutput = join(outputDirectory, "python-lab.mjs");
  const workerOutput = join(outputDirectory, "python.worker.mjs");
  const outputHelpersOutput = join(outputDirectory, "output.mjs");
  const runtimeSafetyOutput = join(outputDirectory, "runtime-safety.mjs");
  const workerCapabilitiesOutput = join(outputDirectory, "worker-capabilities.mjs");
  await Promise.all([
    esbuild.build({
      entryPoints: [fileURLToPath(new URL("../src/index.ts", import.meta.url))],
      outfile: entryOutput,
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node22",
    }),
    esbuild.build({
      entryPoints: [fileURLToPath(new URL("../src/worker/python.worker.ts", import.meta.url))],
      outfile: workerOutput,
      bundle: true,
      platform: "browser",
      format: "esm",
      target: "es2022",
      conditions: ["browser", "import"],
    }),
    esbuild.build({ entryPoints: [fileURLToPath(new URL("../src/output.ts", import.meta.url))], outfile: outputHelpersOutput, bundle: true, platform: "node", format: "esm", target: "node22" }),
    esbuild.build({ entryPoints: [fileURLToPath(new URL("../src/runtime-safety.ts", import.meta.url))], outfile: runtimeSafetyOutput, bundle: true, platform: "node", format: "esm", target: "node22" }),
    esbuild.build({ entryPoints: [fileURLToPath(new URL("../src/worker-capabilities.ts", import.meta.url))], outfile: workerCapabilitiesOutput, bundle: true, platform: "node", format: "esm", target: "node22" }),
  ]);
  [pythonLab, outputHelpers, runtimeSafety, workerCapabilities] = await Promise.all([
    import(`${pathToFileURL(entryOutput).href}?test=${Date.now()}`),
    import(`${pathToFileURL(outputHelpersOutput).href}?test=${Date.now()}`),
    import(`${pathToFileURL(runtimeSafetyOutput).href}?test=${Date.now()}`),
    import(`${pathToFileURL(workerCapabilitiesOutput).href}?test=${Date.now()}`),
  ]);
});

test.after(async () => {
  if (outputDirectory) await rm(outputDirectory, { recursive: true, force: true });
});

class FakeWorker {
  listeners = new Map();
  terminated = false;
  requests = [];

  constructor(handler = () => {}) {
    this.handler = handler;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(message) {
    this.requests.push(message);
    queueMicrotask(() => this.handler(message, (data) => this.emit("message", { data })));
  }

  terminate() {
    this.terminated = true;
  }

  emit(type, event) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function initialized(requestId) {
  return {
    type: "python-lab/initialized",
    requestId,
    result: {
      schemaVersion: 1,
      runtime: "pyodide",
      runtimeVersion: "314.0.2",
      pythonVersion: "3.14.0",
      packages: ["numpy"],
      guardrailsApplied: true,
      capabilityReduced: true,
    },
  };
}

function responsiveWorker() {
  return new FakeWorker((message, respond) => {
    if (message.type === "python-lab/initialize") {
      respond({
        type: "python-lab/event",
        requestId: message.requestId,
        event: { type: "progress", requestId: message.requestId, phase: "ready", message: "Python is ready." },
      });
      respond(initialized(message.requestId));
    } else if (message.type === "python-lab/sync") {
      respond({ type: "python-lab/synced", requestId: message.requestId, result: { schemaVersion: 1, revision: 1, files: message.payload.files.map((file) => file.path) } });
    } else if (message.type === "python-lab/run") {
      respond({ type: "python-lab/event", requestId: message.requestId, event: { type: "stdout", requestId: message.requestId, text: "trained" } });
      respond({
        type: "python-lab/run-completed",
        requestId: message.requestId,
        result: { schemaVersion: 1, requestId: message.requestId, kind: "run", status: "completed", durationMs: 2, result: { loss: 0.4 }, artifacts: [] },
      });
    } else {
      respond({
        type: "python-lab/tests-completed",
        requestId: message.requestId,
        result: { schemaVersion: 1, requestId: message.requestId, kind: "tests", status: "completed", passed: true, durationMs: 1, tests: [{ id: "shape", label: "Shape", passed: true, durationMs: 1 }], artifacts: [] },
      });
    }
  });
}

test("pins the Pyodide release and exposes only the curated NumPy package", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.dependencies.pyodide, "314.0.2");
  assert.deepEqual(pythonLab.CURATED_PYTHON_PACKAGES, ["numpy"]);
  assert.equal(pythonLab.PYODIDE_CDN_URL, "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/");
  assert.throws(() => pythonLab.validateInitializeRequest({ packages: ["micropip"] }), (error) => error.code === "PACKAGE_NOT_ALLOWED");
});

test("keeps the worker lazy and routes progress, output, structured results, and tests", async () => {
  let factoryCalls = 0;
  const worker = responsiveWorker();
  const client = new pythonLab.PythonLabClient(() => {
    factoryCalls += 1;
    return worker;
  });
  assert.equal(factoryCalls, 0);
  const events = [];
  const ready = await client.initialize({ packages: ["numpy"] }, { onEvent: (event) => events.push(event) });
  assert.equal(factoryCalls, 1);
  assert.equal(ready.capabilityReduced, true);
  assert.equal(ready.guardrailsApplied, true);
  await client.sync({ files: [{ path: "models/rnn.py", contents: "RESULT = 42" }] });
  const run = await client.run({ entryPath: "models/rnn.py" }, { onEvent: (event) => events.push(event) });
  assert.deepEqual(run.result, { loss: 0.4 });
  const tests = await client.runTests({ tests: [{ id: "shape", label: "Shape", code: "assert True" }] });
  assert.equal(tests.passed, true);
  assert.deepEqual(events.map((event) => event.type), ["progress", "stdout"]);
  client.dispose();
  assert.equal(worker.terminated, true);
});

test("rejects escaping, ambiguous, duplicate, and oversized workspace input before reaching a worker", () => {
  for (const path of ["../secret.py", "/host.py", "models\\host.py", ".hidden.py", "models//rnn.py"]) {
    assert.throws(() => pythonLab.assertWorkspacePath(path), (error) => error.code === "INVALID_PATH");
  }
  assert.equal(pythonLab.assertWorkspacePath("models/character-rnn.py"), "models/character-rnn.py");
  assert.throws(() => pythonLab.validateSyncRequest({ files: [
    { path: "models/rnn.py", contents: "one" },
    { path: "models/rnn.py", contents: "two" },
  ] }), (error) => error.code === "DUPLICATE_PATH");
  assert.throws(() => pythonLab.validateRunRequest({ code: "pass", entryPath: "models/rnn.py" }), (error) => error.code === "INVALID_RUN");
  assert.throws(() => pythonLab.validateRunRequest({ code: "pass", artifactPaths: ["out.json", "out.json"] }), (error) => error.code === "DUPLICATE_PATH");
});

test("a timeout hard-terminates Python and the next initialize creates a fresh worker", async () => {
  const stalled = new FakeWorker();
  const replacement = responsiveWorker();
  const workers = [stalled, replacement];
  const client = new pythonLab.PythonLabClient(() => workers.shift());
  await assert.rejects(client.initialize({ packages: ["numpy"] }, { timeoutMs: 5 }), (error) => error.code === "WALL_TIMEOUT");
  assert.equal(stalled.terminated, true);
  const ready = await client.initialize({ packages: ["numpy"] }, { timeoutMs: 100 });
  assert.equal(ready.runtimeVersion, "314.0.2");
  client.dispose();
});

test("AbortSignal and stop hard-terminate active work rather than leaving Python running", async () => {
  const worker = new FakeWorker();
  const client = new pythonLab.PythonLabClient(() => worker);
  const controller = new AbortController();
  const pending = client.initialize({}, { signal: controller.signal, timeoutMs: 1_000 });
  controller.abort();
  await assert.rejects(pending, (error) => error.code === "ABORTED");
  assert.equal(worker.terminated, true);
  client.stop();
  client.dispose();
});

test("an already-aborted operation never constructs a worker", async () => {
  let factoryCalls = 0;
  const client = new pythonLab.PythonLabClient(() => {
    factoryCalls += 1;
    return responsiveWorker();
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(client.initialize({}, { signal: controller.signal }), (error) => error.code === "ABORTED");
  assert.equal(factoryCalls, 0);
  client.dispose();
});

test("stdout and stderr chunks preserve line boundaries without doubling delimiters", () => {
  assert.equal(outputHelpers.normalizePythonOutput("first"), "first\n");
  assert.equal(outputHelpers.normalizePythonOutput("second\n"), "second\n");
  assert.equal(outputHelpers.normalizePythonOutput(""), "");
});

test("worker host capabilities are shadowed while a previously captured response channel survives", () => {
  const sent = [];
  const prototype = {
    fetch() {},
    postMessage(value) { sent.push(value); },
    indexedDB: {},
    Worker: class {},
  };
  const target = Object.create(prototype);
  const closedOverPost = target.postMessage.bind(target);
  workerCapabilities.reduceWorkerCapabilities(target);
  assert.equal(workerCapabilities.workerCapabilitiesAreReduced(target), true);
  for (const name of workerCapabilities.REDUCED_WORKER_GLOBALS) assert.equal(target[name], undefined);
  closedOverPost("still available");
  assert.deepEqual(sent, ["still available"]);
});

test("the real pinned core removes Python-to-JavaScript escape modules after reduction", { timeout: 20_000 }, async () => {
  const packageManifestUrl = import.meta.resolve("pyodide/package.json");
  const runtime = await loadPyodide({
    indexURL: fileURLToPath(new URL(".", packageManifestUrl)),
    jsglobals: Object.freeze(Object.create(null)),
  });
  runtime.FS.mkdirTree("/workspace");
  await runtime.runPythonAsync(runtimeSafety.CAPABILITY_BOOTSTRAP);
  const report = JSON.parse(await runtime.runPythonAsync(runtimeSafety.CAPABILITY_SELF_CHECK));
  assert.deepEqual(report, { importsBlocked: true, aliasesRemoved: true, bridgesRemoved: true });
  assert.equal(await runtime.runPythonAsync("import json; json.dumps({'stillRuns': True})"), '{"stillRuns": true}');
});

test("the source retains Vite-discoverable worker and matching CDN contracts with explicit reduction", async () => {
  const [client, worker, safety, bundle] = await Promise.all([
    readFile(new URL("../src/client.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/worker/python.worker.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/runtime-safety.ts", import.meta.url), "utf8"),
    readFile(join(outputDirectory, "python.worker.mjs"), "utf8"),
  ]);
  assert.match(client, /new URL\("\.\/worker\/python\.worker\.ts", import\.meta\.url\)/);
  assert.match(client, /worker\.terminate\(\)/);
  assert.match(worker, /loadPinnedPyodide\(\{/);
  assert.match(worker, /indexURL: PYODIDE_CDN_URL/);
  assert.match(worker, /packages,/);
  assert.match(worker, /jsglobals: reducedJsGlobals/);
  assert.match(worker, /await pyodide\.runPythonAsync\(CAPABILITY_BOOTSTRAP\)/);
  assert.match(worker, /CAPABILITY_SELF_CHECK/);
  assert.match(worker, /MAX_STREAM_OUTPUT_CHARACTERS = 60_000/);
  assert.match(worker, /MAX_STRUCTURED_RESULT_CHARACTERS = 2_000_000/);
  assert.match(worker, /stat\.size > MAX_ARTIFACT_BYTES/);
  assert.match(worker, /independent namespaces/);
  assert.match(worker, /reduceWorkerCapabilities\(scope\)/);
  assert.match(worker, /Object\.freeze\(Object\.create\(null\)\)/);
  assert.doesNotMatch(worker, /loadPackagesFromImports/);
  assert.match(safety, /"js", "micropip", "pyodide", "pyodide_js"/);
  assert.match(safety, /pyodide\.code\.run_js\/eval_code/);
  assert.match(safety, /_latent_sys\.modules\.pop/);
  assert.match(bundle, /cdn\.jsdelivr\.net\/pyodide\/v314\.0\.2\/full/);
});
