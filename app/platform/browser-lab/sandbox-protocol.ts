import { BrowserLabError } from "./errors";
import { isSourceHash } from "./hash";
import { validateExerciseContract } from "./contracts";
import type { SandboxResourceLimits, SandboxRunRequest, SandboxWorkerResponse, TestReceipt } from "./types";

export const DEFAULT_SANDBOX_LIMITS: Readonly<SandboxResourceLimits> = Object.freeze({
  memoryLimitBytes: 32 * 1024 * 1024,
  stackLimitBytes: 1024 * 1024,
  cpuTimeoutMs: 750,
  wallTimeoutMs: 2_000,
  maxLogEntries: 100,
  maxLogCharacters: 12_000,
  maxSerializedValueBytes: 64_000,
});

function integerInRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

export function validateSandboxLimits(limits: SandboxResourceLimits): void {
  if (!integerInRange(limits.memoryLimitBytes, 4 * 1024 * 1024, 128 * 1024 * 1024)
    || !integerInRange(limits.stackLimitBytes, 64 * 1024, 8 * 1024 * 1024)
    || !integerInRange(limits.cpuTimeoutMs, 10, 5_000)
    || !integerInRange(limits.wallTimeoutMs, 50, 60_000)
    || !integerInRange(limits.maxLogEntries, 0, 1_000)
    || !integerInRange(limits.maxLogCharacters, 0, 100_000)
    || !integerInRange(limits.maxSerializedValueBytes, 256, 1024 * 1024)) {
    throw new BrowserLabError("INVALID_LIMITS", "The sandbox resource limits are outside Browser Lab's guarded bounds.");
  }
}

export function validateSandboxRunRequest(request: SandboxRunRequest): void {
  if (request.schemaVersion !== 1 || !request.jobId.trim() || !request.projectId.trim() || !request.contractVersion.trim()) {
    throw new BrowserLabError("INVALID_REQUEST", "The sandbox request is missing required versioned identity fields.");
  }
  if (!Number.isSafeInteger(request.projectRevision) || request.projectRevision < 0 || !isSourceHash(request.sourceHash)) {
    throw new BrowserLabError("INVALID_REQUEST", "The sandbox request has an invalid revision or source hash.");
  }
  validateSandboxLimits(request.limits);
  const program = request.program;
  if (program.schemaVersion !== 1 || program.format !== "browser-lab-iife-v1" || program.projectId !== request.projectId
    || program.projectRevision !== request.projectRevision || program.sourceHash !== request.sourceHash
    || program.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new BrowserLabError("STALE_PROGRAM", "The sandbox program does not match the exact requested project source.");
  }
  if (request.suite.contractVersion !== request.contractVersion || !request.suite.contracts.length) {
    throw new BrowserLabError("STALE_CONTRACT", "The sandbox contract suite is empty or does not match its requested version.");
  }
  const modulePaths = new Set(program.modules.map((compiledModule) => compiledModule.modulePath));
  const contractIds = new Set<string>();
  for (const contract of request.suite.contracts) {
    validateExerciseContract(contract);
    if (contractIds.has(contract.id)) throw new BrowserLabError("DUPLICATE_CONTRACT", `Duplicate exercise contract id: ${contract.id}.`);
    contractIds.add(contract.id);
    for (const exerciseCase of contract.cases) {
      if (!modulePaths.has(exerciseCase.invoke.modulePath)) {
        throw new BrowserLabError("MISSING_CONTRACT_MODULE", `Contract ${contract.id} points to an uncompiled module.`);
      }
    }
  }
}

export function receiptMatchesRequest(receipt: TestReceipt, request: SandboxRunRequest): boolean {
  return receipt.schemaVersion === 1 && receipt.jobId === request.jobId && receipt.projectId === request.projectId
    && receipt.projectRevision === request.projectRevision && receipt.sourceHash === request.sourceHash
    && receipt.contractVersion === request.contractVersion;
}

export function isSandboxWorkerResponse(value: unknown): value is SandboxWorkerResponse {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<SandboxWorkerResponse>;
  if (typeof message.type !== "string" || typeof message.jobId !== "string") return false;
  if (message.type === "browser-lab/log") return Boolean(message.entry && typeof message.entry.text === "string");
  if (message.type === "browser-lab/completed") return Boolean(message.receipt && typeof message.receipt.receiptId === "string");
  if (message.type === "browser-lab/failed") return Boolean(message.error && typeof message.error.code === "string" && typeof message.error.message === "string");
  return false;
}
