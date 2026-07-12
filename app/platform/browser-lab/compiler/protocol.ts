import { BrowserLabError } from "../errors";
import type { CompiledProgram } from "../types";
import type { CompilerWorkerRequest, CompilerWorkerResponse } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isCompilerWorkerRequest(value: unknown): value is CompilerWorkerRequest {
  if (!isRecord(value) || value.type !== "browser-lab/compile" || !isRecord(value.payload)) return false;
  return typeof value.payload.jobId === "string";
}

export function isCompilerWorkerResponse(value: unknown): value is CompilerWorkerResponse {
  if (!isRecord(value) || typeof value.jobId !== "string") return false;
  if (value.type === "browser-lab/compile-completed") return isRecord(value.program);
  if (value.type !== "browser-lab/compile-failed" || !isRecord(value.error)) return false;
  return typeof value.error.code === "string" && typeof value.error.message === "string";
}

export function assertCompileResponseIdentity(program: CompiledProgram, request: CompilerWorkerRequest): void {
  const job = request.payload;
  if (program.schemaVersion !== 1 || program.format !== "browser-lab-iife-v1") {
    throw new BrowserLabError("UNSUPPORTED_PROGRAM", "The compiler worker returned an unsupported program format.");
  }
  if (program.compileJobId !== job.jobId || program.projectId !== job.projectId
    || program.projectRevision !== job.projectRevision || program.sourceHash !== job.sourceHash
    || program.compilerVersion !== job.compilerVersion) {
    throw new BrowserLabError("STALE_COMPILE", "The compiler worker returned output for a different project revision or source tree.");
  }
}

