/// <reference lib="webworker" />

import type { PyodideConfig, PyodideInterface } from "pyodide";
import { PythonLabError } from "../errors";
import {
  MAX_ARTIFACT_BYTES,
  MAX_TOTAL_ARTIFACT_BYTES,
  absoluteWorkspacePath,
  assertWorkspacePath,
} from "../paths";
import { normalizePythonOutput } from "../output";
import { isPythonLabWorkerRequest, validateWorkerRequest } from "../protocol";
import type { PythonLabWorkerRequest, PythonLabWorkerResponse } from "../protocol";
import { CAPABILITY_BOOTSTRAP, CAPABILITY_SELF_CHECK } from "../runtime-safety";
import { reduceWorkerCapabilities, workerCapabilitiesAreReduced } from "../worker-capabilities";
import {
  PYODIDE_CDN_URL,
  PYODIDE_VERSION,
  PYTHON_WORKSPACE_ROOT,
} from "../types";
import type {
  CuratedPythonPackage,
  JsonValue,
  PythonArtifact,
  PythonException,
  PythonLabEvent,
  PythonLabRunResult,
  PythonLabTestRunResult,
  PythonTestResult,
} from "../types";

const scope = self as DedicatedWorkerGlobalScope;
const post = scope.postMessage.bind(scope) as (message: PythonLabWorkerResponse) => void;
const decoder = new TextDecoder("utf-8", { fatal: true });

let pyodide: PyodideInterface | undefined;
let loadedPackages: CuratedPythonPackage[] = [];
let initializationResult: PythonLabWorkerResponse & { type: "python-lab/initialized" } | undefined;
let workspaceRevision = 0;
const workspaceFiles = new Set<string>();
let activeRequestId: string | undefined;
let activeOutputCharacters = 0;
let activeOutputTruncated = false;
let busy = false;

const MAX_STREAM_OUTPUT_CHARACTERS = 60_000;
const MAX_STRUCTURED_RESULT_CHARACTERS = 2_000_000;

/** Python sees only this null-prototype object through `import js`. */
const reducedJsGlobals = Object.freeze(Object.create(null)) as Record<string, never>;

type PyodideLoaderModule = {
  loadPyodide(options?: PyodideConfig): Promise<PyodideInterface>;
};

async function loadPinnedPyodide(options: PyodideConfig): Promise<PyodideInterface> {
  const moduleUrl = `${PYODIDE_CDN_URL}pyodide.mjs`;
  // The explicit, versioned remote import keeps Pyodide's Node-only fallback
  // branches out of the Vite worker bundle. Pyodide then resolves its matching
  // WASM, stdlib, lockfile, and curated wheels against the same index URL.
  const loader = await import(/* @vite-ignore */ moduleUrl) as PyodideLoaderModule;
  if (typeof loader.loadPyodide !== "function") throw new PythonLabError("INVALID_RUNTIME", "The pinned Pyodide loader is unavailable.");
  return loader.loadPyodide(options);
}

const RUNNER_SOURCE = String.raw`
import io as _latent_io
import json as _latent_json
import math as _latent_math
import os as _latent_os
import runpy as _latent_runpy
import sys as _latent_sys
import traceback as _latent_traceback

_latent_request = _latent_json.loads(__latent_request_json)
_latent_old_argv = _latent_sys.argv
_latent_old_stdin = _latent_sys.stdin

def _latent_json_value(value, depth=0, budget=None):
    if budget is None:
        budget = [100000]
    budget[0] -= 1
    if budget[0] < 0 or depth > 24:
        raise ValueError("RESULT exceeds the structured JSON limit")
    if value is None or isinstance(value, (str, bool)):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if not _latent_math.isfinite(value):
            raise ValueError("RESULT contains a non-finite number")
        return value
    if isinstance(value, (list, tuple)):
        return [_latent_json_value(item, depth + 1, budget) for item in value]
    if isinstance(value, dict):
        return {str(key): _latent_json_value(item, depth + 1, budget) for key, item in value.items()}
    if hasattr(value, "tolist"):
        return _latent_json_value(value.tolist(), depth + 1, budget)
    if hasattr(value, "item"):
        return _latent_json_value(value.item(), depth + 1, budget)
    raise TypeError(f"RESULT contains a non-JSON value: {type(value).__name__}")

try:
    _latent_os.chdir("/workspace")
    _latent_sys.argv = [(_latent_request.get("entryPath") or "<python-lab>"), *_latent_request.get("args", [])]
    _latent_sys.stdin = _latent_io.StringIO(_latent_request.get("stdin", ""))
    if _latent_request.get("entryPath"):
        _latent_namespace = _latent_runpy.run_path(
            "/workspace/" + _latent_request["entryPath"],
            run_name="__main__",
        )
    else:
        _latent_namespace = {"__name__": "__main__", "__file__": "<python-lab>"}
        exec(compile(_latent_request["code"], "<python-lab>", "exec"), _latent_namespace)
    _latent_result_name = _latent_request.get("resultVariable", "RESULT")
    _latent_payload = {
        "status": "completed",
        "result": _latent_json_value(_latent_namespace.get(_latent_result_name)),
    }
except BaseException as _latent_error:
    _latent_payload = {
        "status": "failed",
        "result": None,
        "exception": {
            "type": type(_latent_error).__name__,
            "message": str(_latent_error)[:8192],
            "traceback": "".join(_latent_traceback.format_exception(_latent_error))[-32768:],
        },
    }
finally:
    _latent_sys.argv = _latent_old_argv
    _latent_sys.stdin = _latent_old_stdin
    _latent_os.chdir("/workspace")

_latent_json.dumps(_latent_payload, allow_nan=False, separators=(",", ":"))
`;

const TEST_RUNNER_SOURCE = String.raw`
import importlib as _latent_importlib
import json as _latent_json
import os as _latent_os
import sys as _latent_sys
import time as _latent_time
import traceback as _latent_traceback

_latent_tests = _latent_json.loads(__latent_tests_json)
_latent_results = []

def _latent_clear_workspace_modules():
    for name, module in list(_latent_sys.modules.items()):
        module_path = getattr(module, "__file__", "") or ""
        if isinstance(module_path, str) and (module_path == "/workspace" or module_path.startswith("/workspace/")):
            _latent_sys.modules.pop(name, None)
    _latent_importlib.invalidate_caches()

for _latent_test in _latent_tests:
    _latent_clear_workspace_modules()
    _latent_os.chdir("/workspace")
    _latent_started = _latent_time.perf_counter()
    try:
        _latent_namespace = {"__name__": "__latent_test__", "__file__": f"<test:{_latent_test['id']}>"}
        exec(compile(_latent_test["code"], _latent_namespace["__file__"], "exec"), _latent_namespace)
        _latent_results.append({
            "id": _latent_test["id"],
            "label": _latent_test["label"],
            "passed": True,
            "durationMs": max(0, round((_latent_time.perf_counter() - _latent_started) * 1000, 3)),
        })
    except BaseException as _latent_error:
        _latent_results.append({
            "id": _latent_test["id"],
            "label": _latent_test["label"],
            "passed": False,
            "durationMs": max(0, round((_latent_time.perf_counter() - _latent_started) * 1000, 3)),
            "exception": {
                "type": type(_latent_error).__name__,
                "message": str(_latent_error)[:8192],
                "traceback": "".join(_latent_traceback.format_exception(_latent_error))[-32768:],
            },
        })

_latent_json.dumps(_latent_results, allow_nan=False, separators=(",", ":"))
`;

function emit(event: PythonLabEvent): void {
  post({ type: "python-lab/event", requestId: event.requestId, event });
}

function emitPythonOutput(type: "stdout" | "stderr", text: string): void {
  if (!activeRequestId || !text || activeOutputTruncated) return;
  const normalized = normalizePythonOutput(text);
  const remaining = MAX_STREAM_OUTPUT_CHARACTERS - activeOutputCharacters;
  if (remaining > 0) {
    const bounded = normalized.slice(0, remaining);
    activeOutputCharacters += bounded.length;
    if (bounded) emit({ type, requestId: activeRequestId, text: bounded });
  }
  if (normalized.length > Math.max(remaining, 0)) {
    activeOutputTruncated = true;
    emit({ type: "stderr", requestId: activeRequestId, text: "[Python output truncated by the worker.]\n" });
  }
}

function progress(requestId: string, phase: Extract<PythonLabEvent, { type: "progress" }>["phase"], message: string, completed?: number, total?: number): void {
  emit({ type: "progress", requestId, phase, message, ...(completed === undefined ? {} : { completed }), ...(total === undefined ? {} : { total }) });
}

function serializeError(error: unknown): { code: string; message: string } {
  if (error instanceof PythonLabError) return { code: error.code, message: error.message };
  if (error instanceof Error) return { code: "PYTHON_WORKER_FAILURE", message: error.message || "The Python worker failed closed." };
  return { code: "PYTHON_WORKER_FAILURE", message: "The Python worker failed closed." };
}

function py(): PyodideInterface {
  if (!pyodide) throw new PythonLabError("NOT_INITIALIZED", "Initialize Python before syncing or running files.");
  return pyodide;
}

function lstat(path: string): ReturnType<PyodideInterface["FS"]["lstat"]> | undefined {
  try {
    return py().FS.lstat(path);
  } catch {
    return undefined;
  }
}

function assertNoSymlinkPath(path: string, includeTarget = true): void {
  const relative = assertWorkspacePath(path);
  const segments = relative.split("/");
  const maximum = includeTarget ? segments.length : segments.length - 1;
  let current = PYTHON_WORKSPACE_ROOT;
  for (let index = 0; index < maximum; index += 1) {
    current += `/${segments[index]}`;
    const stat = lstat(current);
    if (stat && py().FS.isLink(stat.mode)) throw new PythonLabError("UNSAFE_SYMLINK", `Workspace path traverses a symbolic link: ${path}.`);
  }
}

function ensureParentDirectories(path: string): void {
  const segments = assertWorkspacePath(path).split("/").slice(0, -1);
  let current = PYTHON_WORKSPACE_ROOT;
  for (const segment of segments) {
    current += `/${segment}`;
    const stat = lstat(current);
    if (!stat) py().FS.mkdir(current);
    else if (py().FS.isLink(stat.mode) || !py().FS.isDir(stat.mode)) throw new PythonLabError("INVALID_DIRECTORY", `Workspace parent is not a safe directory: ${path}.`);
  }
}

function removeWorkspaceFile(path: string): void {
  assertNoSymlinkPath(path, false);
  const absolute = absoluteWorkspacePath(path);
  const stat = lstat(absolute);
  if (!stat) return;
  if (py().FS.isDir(stat.mode)) throw new PythonLabError("INVALID_FILE", `Refusing to delete a directory through the file API: ${path}.`);
  py().FS.unlink(absolute);
}

function writeWorkspaceFile(path: string, contents: string): void {
  assertNoSymlinkPath(path, true);
  ensureParentDirectories(path);
  const absolute = absoluteWorkspacePath(path);
  const stat = lstat(absolute);
  if (stat && !py().FS.isFile(stat.mode)) throw new PythonLabError("INVALID_FILE", `Workspace target is not a regular file: ${path}.`);
  py().FS.writeFile(absolute, contents);
}

function artifactMediaType(path: string): string {
  const extension = path.slice(path.lastIndexOf(".")).toLowerCase();
  if (extension === ".json") return "application/json";
  if (extension === ".csv") return "text/csv;charset=utf-8";
  if (extension === ".md") return "text/markdown;charset=utf-8";
  if (extension === ".txt" || extension === ".log" || extension === ".py") return "text/plain;charset=utf-8";
  if (extension === ".npy" || extension === ".npz") return "application/octet-stream";
  return "application/octet-stream";
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 16_384) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 16_384));
  }
  return btoa(binary);
}

function collectArtifacts(paths: readonly string[] | undefined): PythonArtifact[] {
  const artifacts: PythonArtifact[] = [];
  let totalBytes = 0;
  for (const path of paths ?? []) {
    assertNoSymlinkPath(path, true);
    const absolute = absoluteWorkspacePath(path);
    const stat = lstat(absolute);
    if (!stat || !py().FS.isFile(stat.mode)) throw new PythonLabError("ARTIFACT_MISSING", `Python did not write the requested artifact: ${path}.`);
    if (stat.size > MAX_ARTIFACT_BYTES) throw new PythonLabError("ARTIFACT_TOO_LARGE", `${path} exceeds ${MAX_ARTIFACT_BYTES} bytes.`);
    totalBytes += stat.size;
    if (totalBytes > MAX_TOTAL_ARTIFACT_BYTES) throw new PythonLabError("ARTIFACTS_TOO_LARGE", `Requested artifacts exceed ${MAX_TOTAL_ARTIFACT_BYTES} bytes.`);
    const bytes = py().FS.readFile(absolute, { encoding: "binary" }) as Uint8Array;
    if (bytes.byteLength !== stat.size) throw new PythonLabError("ARTIFACT_CHANGED", `${path} changed while it was being collected.`);
    let data: string;
    let encoding: PythonArtifact["encoding"];
    try {
      data = decoder.decode(bytes);
      encoding = "utf8";
    } catch {
      data = base64(bytes);
      encoding = "base64";
    }
    artifacts.push({ path, mediaType: artifactMediaType(path), encoding, data, size: bytes.byteLength });
  }
  return artifacts;
}

function parseJson<T>(value: unknown, label: string): T {
  if (typeof value !== "string") throw new PythonLabError("INVALID_PYTHON_RESULT", `${label} did not return structured JSON.`);
  if (value.length > MAX_STRUCTURED_RESULT_CHARACTERS) throw new PythonLabError("RESULT_TOO_LARGE", `${label} exceeds the structured-result limit.`);
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new PythonLabError("INVALID_PYTHON_RESULT", `${label} returned invalid JSON.`, { cause: error });
  }
}

async function initialize(request: Extract<PythonLabWorkerRequest, { type: "python-lab/initialize" }>): Promise<void> {
  const packages = [...(request.payload.packages ?? [])];
  if (initializationResult) {
    if (JSON.stringify(packages) !== JSON.stringify(loadedPackages)) throw new PythonLabError("ALREADY_INITIALIZED", "Reset the interpreter before changing curated packages.");
    post({ ...initializationResult, requestId: request.requestId });
    return;
  }
  activeRequestId = request.requestId;
  progress(request.requestId, "loading-python", "Loading CPython and the standard library.", 0, 3);
  pyodide = await loadPinnedPyodide({
    indexURL: PYODIDE_CDN_URL,
    packages,
    jsglobals: reducedJsGlobals,
    stdout: (text) => emitPythonOutput("stdout", text),
    stderr: (text) => emitPythonOutput("stderr", text),
    env: { HOME: PYTHON_WORKSPACE_ROOT, PYTHONDONTWRITEBYTECODE: "1" },
  });
  for (const packageName of packages) {
    pyodide.globals.set("__latent_curated_package", packageName);
    try {
      await pyodide.runPythonAsync("__import__(__latent_curated_package)");
    } finally {
      pyodide.globals.delete("__latent_curated_package");
    }
  }
  progress(request.requestId, "loading-packages", packages.length ? `Loaded curated packages: ${packages.join(", ")}.` : "No optional packages requested.", 1, 3);
  pyodide.FS.mkdirTree(PYTHON_WORKSPACE_ROOT);
  await pyodide.runPythonAsync(CAPABILITY_BOOTSTRAP);
  const safety = parseJson<{ importsBlocked: boolean; aliasesRemoved: boolean; bridgesRemoved: boolean }>(
    await pyodide.runPythonAsync(CAPABILITY_SELF_CHECK),
    "Capability self-check",
  );
  reduceWorkerCapabilities(scope);
  if (!safety.importsBlocked || !safety.aliasesRemoved || !safety.bridgesRemoved
    || !workerCapabilitiesAreReduced(scope)
    || Object.getOwnPropertyNames(reducedJsGlobals).length !== 0
    || Object.getPrototypeOf(reducedJsGlobals) !== null) {
    throw new PythonLabError("CAPABILITY_REDUCTION_FAILED", "Python retained a host bridge and initialization failed closed.");
  }
  progress(request.requestId, "reducing-capabilities", "Applied the curated-package, path, host-object, and hard-stop guardrails.", 2, 3);
  const pythonVersion = String(pyodide.runPython("import platform; platform.python_version()"));
  loadedPackages = packages;
  initializationResult = {
    type: "python-lab/initialized",
    requestId: request.requestId,
    result: {
      schemaVersion: 1,
      runtime: "pyodide",
      runtimeVersion: PYODIDE_VERSION,
      pythonVersion,
      packages,
      guardrailsApplied: true,
      capabilityReduced: true,
    },
  };
  progress(request.requestId, "ready", "Python is ready.", 3, 3);
  post(initializationResult);
}

async function sync(request: Extract<PythonLabWorkerRequest, { type: "python-lab/sync" }>): Promise<void> {
  py();
  progress(request.requestId, "syncing-files", "Synchronizing the saved project into /workspace.");
  for (const path of request.payload.deletePaths ?? []) {
    removeWorkspaceFile(path);
    workspaceFiles.delete(path);
  }
  for (const file of request.payload.files) {
    writeWorkspaceFile(file.path, file.contents);
    workspaceFiles.add(file.path);
  }
  workspaceRevision += 1;
  post({ type: "python-lab/synced", requestId: request.requestId, result: { schemaVersion: 1, revision: workspaceRevision, files: [...workspaceFiles].sort() } });
}

type RunnerPayload = { status: "completed" | "failed"; result: JsonValue; exception?: PythonException };

async function run(request: Extract<PythonLabWorkerRequest, { type: "python-lab/run" }>): Promise<void> {
  const runtime = py();
  if (request.payload.entryPath && !workspaceFiles.has(request.payload.entryPath)) throw new PythonLabError("ENTRY_NOT_SYNCED", `Sync the entry file before running it: ${request.payload.entryPath}.`);
  progress(request.requestId, "running-code", request.payload.entryPath ? `Running ${request.payload.entryPath}.` : "Running transient Python.");
  const started = performance.now();
  runtime.globals.set("__latent_request_json", JSON.stringify({
    entryPath: request.payload.entryPath,
    code: request.payload.code,
    args: request.payload.args ?? [],
    stdin: request.payload.stdin ?? "",
    resultVariable: request.payload.resultVariable ?? "RESULT",
  }));
  let payload: RunnerPayload;
  try {
    payload = parseJson<RunnerPayload>(await runtime.runPythonAsync(RUNNER_SOURCE), "Python execution");
  } finally {
    runtime.globals.delete("__latent_request_json");
  }
  let artifacts: PythonArtifact[] = [];
  if (request.payload.artifactPaths?.length) {
    progress(request.requestId, "collecting-artifacts", "Collecting declared output artifacts.");
    try {
      artifacts = collectArtifacts(request.payload.artifactPaths);
    } catch (error) {
      if (payload.status === "completed") {
        const serialized = serializeError(error);
        payload = { status: "failed", result: null, exception: { type: serialized.code, message: serialized.message, traceback: "" } };
      }
    }
  }
  const result: PythonLabRunResult = {
    schemaVersion: 1,
    requestId: request.requestId,
    kind: "run",
    status: payload.status,
    durationMs: Math.max(0, Math.round((performance.now() - started) * 1000) / 1000),
    result: payload.result,
    artifacts,
    ...(payload.exception ? { exception: payload.exception } : {}),
  };
  post({ type: "python-lab/run-completed", requestId: request.requestId, result });
}

async function runTests(request: Extract<PythonLabWorkerRequest, { type: "python-lab/run-tests" }>): Promise<void> {
  const runtime = py();
  progress(request.requestId, "running-tests", `Running ${request.payload.tests.length} test${request.payload.tests.length === 1 ? "" : "s"} in independent namespaces.`, 0, request.payload.tests.length);
  const started = performance.now();
  runtime.globals.set("__latent_tests_json", JSON.stringify(request.payload.tests));
  let tests: PythonTestResult[];
  try {
    tests = parseJson<PythonTestResult[]>(await runtime.runPythonAsync(TEST_RUNNER_SOURCE), "Python tests");
  } finally {
    runtime.globals.delete("__latent_tests_json");
  }
  progress(request.requestId, "running-tests", "Finished Python tests.", tests.length, request.payload.tests.length);
  const artifacts = request.payload.artifactPaths?.length ? collectArtifacts(request.payload.artifactPaths) : [];
  const result: PythonLabTestRunResult = {
    schemaVersion: 1,
    requestId: request.requestId,
    kind: "tests",
    status: "completed",
    passed: tests.length === request.payload.tests.length && tests.every((test) => test.passed),
    durationMs: Math.max(0, Math.round((performance.now() - started) * 1000) / 1000),
    tests,
    artifacts,
  };
  post({ type: "python-lab/tests-completed", requestId: request.requestId, result });
}

async function handle(request: PythonLabWorkerRequest): Promise<void> {
  if (busy) throw new PythonLabError("WORKER_BUSY", "The Python interpreter is already running an operation.");
  busy = true;
  activeRequestId = request.requestId;
  activeOutputCharacters = 0;
  activeOutputTruncated = false;
  try {
    validateWorkerRequest(request);
    if (request.type === "python-lab/initialize") await initialize(request);
    else if (request.type === "python-lab/sync") await sync(request);
    else if (request.type === "python-lab/run") await run(request);
    else await runTests(request);
  } finally {
    activeRequestId = undefined;
    busy = false;
  }
}

scope.addEventListener("message", ({ data }: MessageEvent<unknown>) => {
  if (!isPythonLabWorkerRequest(data)) return;
  void handle(data).catch((error) => {
    post({ type: "python-lab/failed", requestId: data.requestId, error: serializeError(error) });
  });
});

// Keep these values reviewable and bundler-discoverable in the emitted worker.
void PYODIDE_CDN_URL;
