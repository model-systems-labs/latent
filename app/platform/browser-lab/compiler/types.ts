import type { CompileJob, CompiledProgram } from "../types";

export type CompilerSerializedError = {
  code: string;
  message: string;
};

export type CompilerWorkerRequest = {
  type: "browser-lab/compile";
  payload: CompileJob;
};

export type CompilerWorkerResponse =
  | { type: "browser-lab/compile-completed"; jobId: string; program: CompiledProgram }
  | { type: "browser-lab/compile-failed"; jobId: string; error: CompilerSerializedError };

export type CompileClientOptions = {
  signal?: AbortSignal;
  /** Outer watchdog for compiler startup and bundling. */
  timeoutMs?: number;
};

