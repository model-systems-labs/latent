import { PythonLabError } from "./errors";
import {
  MAX_ARTIFACT_FILES,
  MAX_WORKSPACE_FILES,
  MAX_WORKSPACE_FILE_BYTES,
  MAX_WORKSPACE_SOURCE_BYTES,
  assertUniqueWorkspacePaths,
  assertWorkspacePath,
} from "./paths";
import { CURATED_PYTHON_PACKAGES } from "./types";
import type {
  CuratedPythonPackage,
  PythonLabEvent,
  PythonLabInitializeRequest,
  PythonLabInitializeResult,
  PythonLabRunRequest,
  PythonLabRunResult,
  PythonLabRunTestsRequest,
  PythonLabSyncRequest,
  PythonLabSyncResult,
  PythonLabTestRunResult,
} from "./types";

export type PythonLabWorkerRequest =
  | { type: "python-lab/initialize"; requestId: string; payload: PythonLabInitializeRequest }
  | { type: "python-lab/sync"; requestId: string; payload: PythonLabSyncRequest }
  | { type: "python-lab/run"; requestId: string; payload: PythonLabRunRequest }
  | { type: "python-lab/run-tests"; requestId: string; payload: PythonLabRunTestsRequest };

export type PythonLabWorkerSuccess =
  | { type: "python-lab/initialized"; requestId: string; result: PythonLabInitializeResult }
  | { type: "python-lab/synced"; requestId: string; result: PythonLabSyncResult }
  | { type: "python-lab/run-completed"; requestId: string; result: PythonLabRunResult }
  | { type: "python-lab/tests-completed"; requestId: string; result: PythonLabTestRunResult };

export type PythonLabSerializedError = { code: string; message: string };
export type PythonLabWorkerResponse =
  | PythonLabWorkerSuccess
  | { type: "python-lab/event"; requestId: string; event: PythonLabEvent }
  | { type: "python-lab/failed"; requestId: string; error: PythonLabSerializedError };

const encoder = new TextEncoder();
const curatedPackages = new Set<string>(CURATED_PYTHON_PACKAGES);
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_TRANSIENT_CODE_BYTES = 512 * 1024;
const MAX_TESTS = 64;
const MAX_TEST_CODE_BYTES = 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validateInitializeRequest(request: PythonLabInitializeRequest): CuratedPythonPackage[] {
  const packages = request.packages ? [...request.packages] : [];
  if (packages.some((name) => typeof name !== "string" || !curatedPackages.has(name))) {
    throw new PythonLabError("PACKAGE_NOT_ALLOWED", `Only curated Python packages may be loaded: ${CURATED_PYTHON_PACKAGES.join(", ")}.`);
  }
  if (new Set(packages).size !== packages.length) throw new PythonLabError("DUPLICATE_PACKAGE", "Python packages must be unique.");
  return packages;
}

export function validateSyncRequest(request: PythonLabSyncRequest): void {
  if (!Array.isArray(request.files) || request.files.length > MAX_WORKSPACE_FILES) {
    throw new PythonLabError("PROJECT_TOO_LARGE", `A Python project may sync at most ${MAX_WORKSPACE_FILES} files at once.`);
  }
  const filePaths = assertUniqueWorkspacePaths(request.files.map((file) => file.path), "files");
  let totalBytes = 0;
  for (const file of request.files) {
    if (typeof file.contents !== "string") throw new PythonLabError("INVALID_FILE", `Python workspace file ${file.path} must contain text.`);
    const bytes = encoder.encode(file.contents).byteLength;
    if (bytes > MAX_WORKSPACE_FILE_BYTES) throw new PythonLabError("FILE_TOO_LARGE", `${file.path} exceeds ${MAX_WORKSPACE_FILE_BYTES} bytes.`);
    totalBytes += bytes;
  }
  if (totalBytes > MAX_WORKSPACE_SOURCE_BYTES) throw new PythonLabError("PROJECT_TOO_LARGE", `Python source exceeds ${MAX_WORKSPACE_SOURCE_BYTES} bytes.`);
  const deletePaths = assertUniqueWorkspacePaths(request.deletePaths ?? [], "deletePaths");
  const written = new Set(filePaths);
  if (deletePaths.some((path) => written.has(path))) throw new PythonLabError("CONFLICTING_PATH", "A file cannot be written and deleted in the same sync.");
}

function validateArtifactPaths(paths: readonly string[] | undefined): void {
  if (!paths) return;
  if (!Array.isArray(paths) || paths.length > MAX_ARTIFACT_FILES) throw new PythonLabError("TOO_MANY_ARTIFACTS", `At most ${MAX_ARTIFACT_FILES} exact artifact paths may be requested.`);
  assertUniqueWorkspacePaths(paths, "artifactPaths");
}

export function validateRunRequest(request: PythonLabRunRequest): void {
  const hasEntry = typeof request.entryPath === "string";
  const hasCode = typeof request.code === "string";
  if (hasEntry === hasCode) throw new PythonLabError("INVALID_RUN", "Exactly one of entryPath or code is required.");
  if (hasEntry) assertWorkspacePath(request.entryPath!);
  if (hasCode && encoder.encode(request.code!).byteLength > MAX_TRANSIENT_CODE_BYTES) throw new PythonLabError("CODE_TOO_LARGE", "Transient Python code is too large.");
  if (request.args && (!Array.isArray(request.args) || request.args.some((arg) => typeof arg !== "string" || arg.length > 8_192))) throw new PythonLabError("INVALID_ARGS", "Python args must be bounded strings.");
  if (request.stdin !== undefined && (typeof request.stdin !== "string" || encoder.encode(request.stdin).byteLength > MAX_TRANSIENT_CODE_BYTES)) throw new PythonLabError("INVALID_STDIN", "Python stdin is too large.");
  if (request.resultVariable !== undefined && !IDENTIFIER.test(request.resultVariable)) throw new PythonLabError("INVALID_RESULT_VARIABLE", "The Python result variable must be an identifier.");
  validateArtifactPaths(request.artifactPaths);
}

export function validateRunTestsRequest(request: PythonLabRunTestsRequest): void {
  if (!Array.isArray(request.tests) || request.tests.length < 1 || request.tests.length > MAX_TESTS) {
    throw new PythonLabError("INVALID_TESTS", `A test run requires between 1 and ${MAX_TESTS} host-authored tests.`);
  }
  const ids = new Set<string>();
  let totalBytes = 0;
  for (const test of request.tests) {
    if (!test || typeof test.id !== "string" || !test.id.trim() || test.id.length > 120 || ids.has(test.id)) throw new PythonLabError("INVALID_TEST", "Test ids must be present, bounded, and unique.");
    if (typeof test.label !== "string" || !test.label.trim() || test.label.length > 240) throw new PythonLabError("INVALID_TEST", `Test ${test.id} needs a bounded label.`);
    if (typeof test.code !== "string") throw new PythonLabError("INVALID_TEST", `Test ${test.id} needs Python source.`);
    totalBytes += encoder.encode(test.code).byteLength;
    ids.add(test.id);
  }
  if (totalBytes > MAX_TEST_CODE_BYTES) throw new PythonLabError("TESTS_TOO_LARGE", "Transient Python tests are too large.");
  validateArtifactPaths(request.artifactPaths);
}

export function validateWorkerRequest(request: PythonLabWorkerRequest): void {
  if (!request.requestId?.trim()) throw new PythonLabError("INVALID_REQUEST", "Python worker requests need an id.");
  if (request.type === "python-lab/initialize") validateInitializeRequest(request.payload);
  else if (request.type === "python-lab/sync") validateSyncRequest(request.payload);
  else if (request.type === "python-lab/run") validateRunRequest(request.payload);
  else validateRunTestsRequest(request.payload);
}

export function isPythonLabWorkerRequest(value: unknown): value is PythonLabWorkerRequest {
  if (!isRecord(value) || typeof value.requestId !== "string" || !isRecord(value.payload)) return false;
  return value.type === "python-lab/initialize" || value.type === "python-lab/sync" || value.type === "python-lab/run" || value.type === "python-lab/run-tests";
}

export function isPythonLabWorkerResponse(value: unknown): value is PythonLabWorkerResponse {
  if (!isRecord(value) || typeof value.requestId !== "string" || typeof value.type !== "string") return false;
  if (value.type === "python-lab/event") return isRecord(value.event) && typeof value.event.type === "string";
  if (value.type === "python-lab/failed") return isRecord(value.error) && typeof value.error.code === "string" && typeof value.error.message === "string";
  if (!isRecord(value.result)) return false;
  if (value.type === "python-lab/initialized") {
    return value.result.schemaVersion === 1 && value.result.runtime === "pyodide" && value.result.runtimeVersion === "314.0.3"
      && typeof value.result.pythonVersion === "string" && Array.isArray(value.result.packages)
      && value.result.guardrailsApplied === true && value.result.capabilityReduced === true;
  }
  if (value.type === "python-lab/synced") return value.result.schemaVersion === 1 && Number.isSafeInteger(value.result.revision) && Array.isArray(value.result.files);
  if (value.type === "python-lab/run-completed") return value.result.schemaVersion === 1 && value.result.requestId === value.requestId && value.result.kind === "run"
    && (value.result.status === "completed" || value.result.status === "failed") && Array.isArray(value.result.artifacts);
  if (value.type === "python-lab/tests-completed") return value.result.schemaVersion === 1 && value.result.requestId === value.requestId && value.result.kind === "tests"
    && value.result.status === "completed" && typeof value.result.passed === "boolean" && Array.isArray(value.result.tests) && Array.isArray(value.result.artifacts);
  return false;
}
