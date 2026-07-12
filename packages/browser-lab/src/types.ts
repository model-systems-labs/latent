/**
 * Browser Lab core protocols.
 *
 * These types deliberately contain no React, DOM, LMS, model, or persistence
 * concepts. The host application owns compilation, storage, and promotion;
 * the sandbox may only execute an already-compiled program and report raw
 * observations for host-owned assertions.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type SourceHash = `sha256:${string}`;

export type VirtualSourceFile = {
  path: string;
  contents: string;
  loader: "js" | "jsx" | "ts" | "tsx" | "json" | "css";
};

export type ProjectSnapshot = {
  projectId: string;
  revision: number;
  files: readonly VirtualSourceFile[];
};

export type CompileJob = {
  schemaVersion: 1;
  jobId: string;
  projectId: string;
  projectRevision: number;
  sourceHash: SourceHash;
  compilerVersion: string;
  submittedAt: number;
  entryPoints: readonly string[];
  files: readonly VirtualSourceFile[];
};

export type CompileDiagnostic = {
  severity: "error" | "warning";
  message: string;
  path?: string;
  line?: number;
  column?: number;
};

/**
 * Each module is an isolated IIFE bundle produced by the compiler adapter.
 * Its exports must be assigned to `globalThis[globalName]`. QuickJS reads that
 * object through handles; learner source is never evaluated by the page.
 */
export type CompiledModule = {
  modulePath: string;
  globalName: string;
  code: string;
  codeHash: SourceHash;
};

export type CompiledProgram = {
  schemaVersion: 1;
  format: "browser-lab-iife-v1";
  compileJobId: string;
  projectId: string;
  projectRevision: number;
  sourceHash: SourceHash;
  compilerVersion: string;
  modules: readonly CompiledModule[];
  diagnostics: readonly CompileDiagnostic[];
};

export type InvocationPlan = {
  modulePath: string;
  exportName: string;
  args: readonly JsonValue[];
};

export type ValuePath = readonly (string | number)[];

export type HostAssertion =
  | { id: string; label: string; kind: "deep-equal"; expected: JsonValue; path?: ValuePath }
  | { id: string; label: string; kind: "type"; expected: "null" | "array" | "object" | "string" | "number" | "boolean"; path?: ValuePath }
  | { id: string; label: string; kind: "truthy"; path?: ValuePath }
  | { id: string; label: string; kind: "finite"; path?: ValuePath }
  | { id: string; label: string; kind: "range"; minimum: number; maximum: number; path?: ValuePath }
  | { id: string; label: string; kind: "length"; expected: number; path?: ValuePath }
  | { id: string; label: string; kind: "includes"; expected: JsonValue; path?: ValuePath }
  | { id: string; label: string; kind: "matches"; pattern: string; flags?: "" | "i" | "m" | "im"; path?: ValuePath }
  | { id: string; label: string; kind: "throws"; messageIncludes?: string };

export type ExerciseCase = {
  id: string;
  label: string;
  invoke: InvocationPlan;
  assertions: readonly HostAssertion[];
};

/** Assertions are data authored by the course, never source supplied by a learner. */
export type ExerciseContract = {
  id: string;
  label: string;
  cases: readonly ExerciseCase[];
};

export type ContractSuite = {
  contractVersion: string;
  contracts: readonly ExerciseContract[];
};

export type InvocationObservation =
  | { status: "returned"; value: JsonValue }
  | { status: "threw"; errorName: string; message: string }
  | { status: "timed-out"; message: string }
  | { status: "resource-error"; message: string }
  | { status: "harness-error"; message: string };

export type AssertionResult = {
  assertionId: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type ExerciseCaseResult = {
  contractId: string;
  contractLabel: string;
  caseId: string;
  caseLabel: string;
  observationStatus: InvocationObservation["status"];
  passed: boolean;
  detail: string;
  assertions: readonly AssertionResult[];
};

export type SandboxLogLevel = "debug" | "info" | "warn" | "error";

export type SandboxLogEntry = {
  sequence: number;
  level: SandboxLogLevel;
  text: string;
};

export type SandboxResourceLimits = {
  memoryLimitBytes: number;
  stackLimitBytes: number;
  cpuTimeoutMs: number;
  wallTimeoutMs: number;
  maxLogEntries: number;
  maxLogCharacters: number;
  maxSerializedValueBytes: number;
};

export type SandboxRunRequest = {
  schemaVersion: 1;
  jobId: string;
  projectId: string;
  projectRevision: number;
  sourceHash: SourceHash;
  contractVersion: string;
  requestedAt: number;
  deterministicSeed: number;
  deterministicNowMs: number;
  program: CompiledProgram;
  suite: ContractSuite;
  limits: SandboxResourceLimits;
};

export type TestReceiptStatus = "passed" | "failed" | "sandbox-error";

export type TestReceipt = {
  schemaVersion: 1;
  receiptId: string;
  jobId: string;
  projectId: string;
  projectRevision: number;
  sourceHash: SourceHash;
  contractVersion: string;
  status: TestReceiptStatus;
  startedAt: number;
  completedAt: number;
  results: readonly ExerciseCaseResult[];
  logs: readonly SandboxLogEntry[];
  logsTruncated: boolean;
  limits: SandboxResourceLimits;
};

export type SandboxSerializedError = {
  code: string;
  message: string;
};

export type SandboxWorkerRequest = {
  type: "browser-lab/run-suite";
  payload: SandboxRunRequest;
};

export type SandboxWorkerResponse =
  | { type: "browser-lab/log"; jobId: string; entry: SandboxLogEntry }
  | { type: "browser-lab/completed"; jobId: string; receipt: TestReceipt }
  | { type: "browser-lab/failed"; jobId: string; error: SandboxSerializedError };

export type RuntimeBinding = {
  bindingId: string;
  /** A course-defined capability such as `model.sample` or `chat.selectContext`. */
  capability: string;
  modulePath: string;
  exportName: string;
  kind: "function" | "value" | "component";
  required: boolean;
};

export type BindingManifest = {
  schemaVersion: 1;
  bindings: readonly RuntimeBinding[];
};

export type BuildArtifact = {
  schemaVersion: 1;
  artifactId: string;
  projectId: string;
  buildNumber: number;
  projectRevision: number;
  sourceHash: SourceHash;
  contractVersion: string;
  compilerVersion: string;
  createdAt: number;
  testReceiptId: string;
  program: CompiledProgram;
  bindingManifest: BindingManifest;
};
