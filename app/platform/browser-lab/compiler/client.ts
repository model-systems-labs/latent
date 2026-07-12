import { BrowserLabAbortError, BrowserLabError, BrowserLabTimeoutError } from "../errors";
import type { CompileJob, CompiledProgram } from "../types";
import { assertCompileResponseIdentity, isCompilerWorkerResponse } from "./protocol";
import type { CompileClientOptions, CompilerWorkerRequest } from "./types";
import { verifyCompiledProgramHashes } from "./virtual-project";

type MessageListener = (event: { data: unknown }) => void;
type ErrorListener = (event: { message?: string }) => void;

export interface CompilerWorkerPort {
  postMessage(message: CompilerWorkerRequest): void;
  terminate(): void;
  addEventListener(type: "message", listener: MessageListener): void;
  addEventListener(type: "error", listener: ErrorListener): void;
  removeEventListener(type: "message", listener: MessageListener): void;
  removeEventListener(type: "error", listener: ErrorListener): void;
}

export type CompilerWorkerFactory = () => CompilerWorkerPort;

export function createCompilerWorker(): CompilerWorkerPort {
  if (typeof Worker === "undefined") throw new BrowserLabError("WORKER_UNAVAILABLE", "Browser Lab requires a compiler worker and refuses to compile learner code on the page thread.");
  return new Worker(new URL("./compiler.worker.ts", import.meta.url), { type: "module", name: "browser-lab-compiler" });
}

type PendingCompile = {
  request: CompilerWorkerRequest;
  resolve(program: CompiledProgram): void;
  reject(error: unknown): void;
  timer: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  onAbort?: () => void;
};

const DEFAULT_COMPILE_TIMEOUT_MS = 15_000;

export class BrowserLabCompilerClient {
  private worker?: CompilerWorkerPort;
  private disposed = false;
  private readonly pending = new Map<string, PendingCompile>();
  private readonly onMessage: MessageListener = ({ data }) => { void this.handleMessage(data); };
  private readonly onError: ErrorListener = (event) => this.failWorker(new BrowserLabError("COMPILER_WORKER_CRASHED", event.message || "The isolated compiler worker crashed."));

  constructor(private readonly createWorker: CompilerWorkerFactory = createCompilerWorker) {}

  compile(job: CompileJob, options: CompileClientOptions = {}): Promise<CompiledProgram> {
    if (this.disposed) return Promise.reject(new BrowserLabError("COMPILER_DISPOSED", "The compiler client has been disposed."));
    if (this.pending.has(job.jobId)) return Promise.reject(new BrowserLabError("DUPLICATE_JOB", `Compiler job is already pending: ${job.jobId}.`));
    if (options.signal?.aborted) return Promise.reject(new BrowserLabAbortError());
    const timeoutMs = options.timeoutMs ?? DEFAULT_COMPILE_TIMEOUT_MS;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) return Promise.reject(new BrowserLabError("INVALID_TIMEOUT", "Compiler timeout must be a positive integer."));
    const request: CompilerWorkerRequest = { type: "browser-lab/compile", payload: job };
    const worker = this.ensureWorker();
    return new Promise<CompiledProgram>((resolve, reject) => {
      const onAbort = () => this.cancel(job.jobId, new BrowserLabAbortError());
      const pending: PendingCompile = {
        request,
        resolve,
        reject,
        timer: setTimeout(() => this.cancel(job.jobId, new BrowserLabTimeoutError(timeoutMs)), timeoutMs),
        signal: options.signal,
        onAbort,
      };
      this.pending.set(job.jobId, pending);
      options.signal?.addEventListener("abort", onAbort, { once: true });
      worker.postMessage(request);
    });
  }

  terminate(): void {
    this.failWorker(new BrowserLabAbortError());
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.terminate();
  }

  private ensureWorker(): CompilerWorkerPort {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.addEventListener("message", this.onMessage);
    worker.addEventListener("error", this.onError);
    this.worker = worker;
    return worker;
  }

  private async handleMessage(data: unknown): Promise<void> {
    if (!isCompilerWorkerResponse(data)) return;
    const pending = this.pending.get(data.jobId);
    if (!pending) return;
    if (data.type === "browser-lab/compile-failed") {
      this.finish(data.jobId, () => pending.reject(new BrowserLabError(data.error.code, data.error.message)));
      return;
    }
    try {
      assertCompileResponseIdentity(data.program, pending.request);
      await verifyCompiledProgramHashes(data.program);
      this.finish(data.jobId, () => pending.resolve(data.program));
    } catch (error) {
      this.finish(data.jobId, () => pending.reject(error));
    }
  }

  private cancel(jobId: string, error: unknown): void {
    const pending = this.pending.get(jobId);
    if (!pending) return;
    this.finish(jobId, () => pending.reject(error));
    // esbuild cannot cancel an individual in-flight browser build. Terminate the
    // worker so timed-out work cannot continue consuming resources.
    this.failWorker(error);
  }

  private finish(jobId: string, action: () => void): void {
    const pending = this.pending.get(jobId);
    if (!pending) return;
    this.pending.delete(jobId);
    clearTimeout(pending.timer);
    if (pending.onAbort) pending.signal?.removeEventListener("abort", pending.onAbort);
    action();
  }

  private failWorker(error: unknown): void {
    const worker = this.worker;
    this.worker = undefined;
    if (worker) {
      worker.removeEventListener("message", this.onMessage);
      worker.removeEventListener("error", this.onError);
      worker.terminate();
    }
    for (const jobId of [...this.pending.keys()]) {
      const pending = this.pending.get(jobId);
      if (pending) this.finish(jobId, () => pending.reject(error));
    }
  }
}

