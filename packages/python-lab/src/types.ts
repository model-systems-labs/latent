export const PYODIDE_VERSION = "314.0.2" as const;
export const PYODIDE_CDN_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/" as const;
export const PYTHON_WORKSPACE_ROOT = "/workspace" as const;
export const CURATED_PYTHON_PACKAGES = ["numpy", "sortedcontainers"] as const;

export type CuratedPythonPackage = (typeof CURATED_PYTHON_PACKAGES)[number];
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type PythonLabProgressPhase =
  | "starting-worker"
  | "loading-python"
  | "loading-packages"
  | "reducing-capabilities"
  | "ready"
  | "syncing-files"
  | "running-code"
  | "running-tests"
  | "collecting-artifacts"
  | "resetting";

export type PythonLabEvent =
  | {
      type: "progress";
      requestId: string;
      phase: PythonLabProgressPhase;
      message: string;
      completed?: number;
      total?: number;
    }
  | { type: "stdout"; requestId: string; text: string }
  | { type: "stderr"; requestId: string; text: string };

export type PythonLabOperationOptions = {
  signal?: AbortSignal;
  /** Outer watchdog. Expiry hard-terminates the interpreter worker. */
  timeoutMs?: number;
  onEvent?: (event: PythonLabEvent) => void;
};

export type PythonLabInitializeRequest = {
  packages?: readonly CuratedPythonPackage[];
};

export type PythonLabInitializeResult = {
  schemaVersion: 1;
  runtime: "pyodide";
  runtimeVersion: typeof PYODIDE_VERSION;
  pythonVersion: string;
  packages: CuratedPythonPackage[];
  /** Runtime guardrails were applied; this is not a hostile-code sandbox. */
  guardrailsApplied: true;
  capabilityReduced: true;
};

export type PythonWorkspaceFile = {
  /** Safe project-relative POSIX path. Files are rooted under /workspace. */
  path: string;
  contents: string;
};

export type PythonLabSyncRequest = {
  files: readonly PythonWorkspaceFile[];
  deletePaths?: readonly string[];
};

export type PythonLabSyncResult = {
  schemaVersion: 1;
  revision: number;
  files: string[];
};

export type PythonLabRunRequest = {
  /** Run a saved file from /workspace. Exactly one of entryPath or code is required. */
  entryPath?: string;
  /** Run transient source without adding it to the saved project. */
  code?: string;
  args?: readonly string[];
  stdin?: string;
  /** JSON-serialize this global after execution. Defaults to RESULT. */
  resultVariable?: string;
  /** Exact project-relative files to return after execution. Globs are not accepted. */
  artifactPaths?: readonly string[];
};

export type PythonArtifact = {
  path: string;
  mediaType: string;
  encoding: "utf8" | "base64";
  data: string;
  size: number;
};

export type PythonException = {
  type: string;
  message: string;
  traceback: string;
};

export type PythonLabRunResult = {
  schemaVersion: 1;
  requestId: string;
  kind: "run";
  status: "completed" | "failed";
  durationMs: number;
  result: JsonValue;
  artifacts: PythonArtifact[];
  exception?: PythonException;
};

export type PythonInlineTest = {
  id: string;
  label: string;
  /** Transient host-authored Python. It runs from /workspace and is never saved. */
  code: string;
};

export type PythonLabRunTestsRequest = {
  tests: readonly PythonInlineTest[];
  artifactPaths?: readonly string[];
};

export type PythonTestResult = {
  id: string;
  label: string;
  passed: boolean;
  durationMs: number;
  exception?: PythonException;
};

export type PythonLabTestRunResult = {
  schemaVersion: 1;
  requestId: string;
  kind: "tests";
  status: "completed";
  passed: boolean;
  durationMs: number;
  tests: PythonTestResult[];
  artifacts: PythonArtifact[];
};

export type PythonLabResult =
  | PythonLabInitializeResult
  | PythonLabSyncResult
  | PythonLabRunResult
  | PythonLabTestRunResult;
