import { PythonLabAbortError, PythonLabError, PythonLabTimeoutError } from "./errors";
import {
  isPythonLabWorkerResponse,
  validateInitializeRequest,
  validateRunRequest,
  validateRunTestsRequest,
  validateSyncRequest,
} from "./protocol";
import type { PythonLabWorkerRequest, PythonLabWorkerSuccess } from "./protocol";
import type {
  PythonLabInitializeRequest,
  PythonLabInitializeResult,
  PythonLabOperationOptions,
  PythonLabRunRequest,
  PythonLabRunResult,
  PythonLabRunTestsRequest,
  PythonLabSyncRequest,
  PythonLabSyncResult,
  PythonLabTestRunResult,
} from "./types";

type MessageListener = (event: { data: unknown }) => void;
type ErrorListener = (event: { message?: string }) => void;

export interface PythonLabWorkerPort {
  postMessage(message: PythonLabWorkerRequest): void;
  terminate(): void;
  addEventListener(type: "message", listener: MessageListener): void;
  addEventListener(type: "error" | "messageerror", listener: ErrorListener): void;
  removeEventListener(type: "message", listener: MessageListener): void;
  removeEventListener(type: "error" | "messageerror", listener: ErrorListener): void;
}

export type PythonLabWorkerFactory = () => PythonLabWorkerPort;

export function createPythonLabWorker(): PythonLabWorkerPort {
  if (typeof Worker === "undefined") throw new PythonLabError("WORKER_UNAVAILABLE", "Python Lab requires a module Web Worker and never runs Python on the page thread.");
  return new Worker(new URL("./worker/python.worker.ts", import.meta.url), { type: "module", name: "latent-python-lab" });
}

type Pending = {
  requestId: string;
  expectedType: PythonLabWorkerSuccess["type"];
  resolve(result: unknown): void;
  reject(error: unknown): void;
  timer: ReturnType<typeof setTimeout>;
  options: PythonLabOperationOptions;
  onAbort?: () => void;
};

const DEFAULT_TIMEOUTS = {
  initialize: 120_000,
  sync: 10_000,
  run: 15_000,
  tests: 30_000,
} as const;

let fallbackRequestId = 0;
function requestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  fallbackRequestId += 1;
  return `python-lab-${Date.now()}-${fallbackRequestId}`;
}

export class PythonLabClient {
  private worker?: PythonLabWorkerPort;
  private pending?: Pending;
  private initialized = false;
  private disposed = false;
  private readonly onMessage: MessageListener = ({ data }) => this.handleMessage(data);
  private readonly onError: ErrorListener = (event) => this.failWorker(new PythonLabError("WORKER_CRASHED", event.message || "The Python worker crashed."));
  private readonly onMessageError: ErrorListener = () => this.failWorker(new PythonLabError("INVALID_WORKER_MESSAGE", "The Python worker returned an unreadable message."));

  constructor(private readonly createWorker: PythonLabWorkerFactory = createPythonLabWorker) {}

  initialize(request: PythonLabInitializeRequest = {}, options: PythonLabOperationOptions = {}): Promise<PythonLabInitializeResult> {
    validateInitializeRequest(request);
    return this.execute("python-lab/initialize", request, "python-lab/initialized", options, DEFAULT_TIMEOUTS.initialize).then((result) => {
      this.initialized = true;
      return result as PythonLabInitializeResult;
    });
  }

  sync(request: PythonLabSyncRequest, options: PythonLabOperationOptions = {}): Promise<PythonLabSyncResult> {
    validateSyncRequest(request);
    this.assertInitialized();
    return this.execute("python-lab/sync", request, "python-lab/synced", options, DEFAULT_TIMEOUTS.sync) as Promise<PythonLabSyncResult>;
  }

  run(request: PythonLabRunRequest, options: PythonLabOperationOptions = {}): Promise<PythonLabRunResult> {
    validateRunRequest(request);
    this.assertInitialized();
    return this.execute("python-lab/run", request, "python-lab/run-completed", options, DEFAULT_TIMEOUTS.run) as Promise<PythonLabRunResult>;
  }

  runTests(request: PythonLabRunTestsRequest, options: PythonLabOperationOptions = {}): Promise<PythonLabTestRunResult> {
    validateRunTestsRequest(request);
    this.assertInitialized();
    return this.execute("python-lab/run-tests", request, "python-lab/tests-completed", options, DEFAULT_TIMEOUTS.tests) as Promise<PythonLabTestRunResult>;
  }

  /** Hard-stop active Python. A subsequent reset/initialize creates a fresh worker. */
  stop(): void {
    this.failWorker(new PythonLabAbortError());
  }

  async reset(request: PythonLabInitializeRequest = {}, options: PythonLabOperationOptions = {}): Promise<PythonLabInitializeResult> {
    if (this.disposed) throw new PythonLabError("CLIENT_DISPOSED", "The Python client has been disposed.");
    options.onEvent?.({ type: "progress", requestId: "reset", phase: "resetting", message: "Restarting the Python interpreter." });
    this.stop();
    return this.initialize(request, options);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.failWorker(new PythonLabError("CLIENT_DISPOSED", "The Python client has been disposed."));
  }

  private assertInitialized(): void {
    if (this.disposed) throw new PythonLabError("CLIENT_DISPOSED", "The Python client has been disposed.");
    if (!this.initialized) throw new PythonLabError("NOT_INITIALIZED", "Initialize Python before syncing or running files.");
  }

  private execute(
    type: PythonLabWorkerRequest["type"],
    payload: PythonLabWorkerRequest["payload"],
    expectedType: PythonLabWorkerSuccess["type"],
    options: PythonLabOperationOptions,
    defaultTimeoutMs: number,
  ): Promise<unknown> {
    if (this.disposed) return Promise.reject(new PythonLabError("CLIENT_DISPOSED", "The Python client has been disposed."));
    if (this.pending) return Promise.reject(new PythonLabError("WORKER_BUSY", "Wait for the current Python operation to finish."));
    if (options.signal?.aborted) return Promise.reject(new PythonLabAbortError());
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) return Promise.reject(new PythonLabError("INVALID_TIMEOUT", "Python timeout must be a positive integer."));
    const id = requestId();
    const request = { type, requestId: id, payload } as PythonLabWorkerRequest;
    const worker = this.ensureWorker();
    return new Promise((resolve, reject) => {
      const onAbort = () => this.failWorker(new PythonLabAbortError());
      this.pending = {
        requestId: id,
        expectedType,
        resolve,
        reject,
        timer: setTimeout(() => this.failWorker(new PythonLabTimeoutError(timeoutMs)), timeoutMs),
        options,
        onAbort,
      };
      options.signal?.addEventListener("abort", onAbort, { once: true });
      worker.postMessage(request);
    });
  }

  private ensureWorker(): PythonLabWorkerPort {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.addEventListener("message", this.onMessage);
    worker.addEventListener("error", this.onError);
    worker.addEventListener("messageerror", this.onMessageError);
    this.worker = worker;
    return worker;
  }

  private handleMessage(data: unknown): void {
    if (!isPythonLabWorkerResponse(data)) return;
    const pending = this.pending;
    if (!pending || data.requestId !== pending.requestId) return;
    if (data.type === "python-lab/event") {
      pending.options.onEvent?.(data.event);
      return;
    }
    if (data.type === "python-lab/failed") {
      this.finish(() => pending.reject(new PythonLabError(data.error.code, data.error.message)));
      return;
    }
    if (data.type !== pending.expectedType) {
      this.failWorker(new PythonLabError("STALE_RESULT", "The Python worker returned a result for a different operation."));
      return;
    }
    this.finish(() => pending.resolve(data.result));
  }

  private finish(action: () => void): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = undefined;
    clearTimeout(pending.timer);
    if (pending.onAbort) pending.options.signal?.removeEventListener("abort", pending.onAbort);
    action();
  }

  private failWorker(error: unknown): void {
    const worker = this.worker;
    this.worker = undefined;
    this.initialized = false;
    if (worker) {
      worker.removeEventListener("message", this.onMessage);
      worker.removeEventListener("error", this.onError);
      worker.removeEventListener("messageerror", this.onMessageError);
      worker.terminate();
    }
    const pending = this.pending;
    if (pending) this.finish(() => pending.reject(error));
  }
}
