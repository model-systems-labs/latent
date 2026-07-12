import { BrowserLabAbortError, BrowserLabError, BrowserLabStaleResultError, BrowserLabTimeoutError } from "./errors";
import { isSandboxWorkerResponse, receiptMatchesRequest, validateSandboxRunRequest } from "./sandbox-protocol";
import type { SandboxLogEntry, SandboxRunRequest, SandboxWorkerRequest, TestReceipt } from "./types";

type MessageListener = (event: { data: unknown }) => void;
type ErrorListener = (event: { message?: string }) => void;

export interface BrowserLabWorkerPort {
  postMessage(message: SandboxWorkerRequest): void;
  terminate(): void;
  addEventListener(type: "message", listener: MessageListener): void;
  addEventListener(type: "error", listener: ErrorListener): void;
  removeEventListener(type: "message", listener: MessageListener): void;
  removeEventListener(type: "error", listener: ErrorListener): void;
}

export type BrowserLabWorkerFactory = () => BrowserLabWorkerPort;

export function createBrowserLabWorker(): BrowserLabWorkerPort {
  if (typeof Worker === "undefined") throw new BrowserLabError("WORKER_UNAVAILABLE", "Browser Lab requires a Web Worker and refuses to run learner code on the page thread.");
  return new Worker(new URL("./worker/sandbox.worker.ts", import.meta.url), { type: "module", name: "browser-lab-sandbox" });
}

export class BrowserLabWorkerClient {
  constructor(private readonly createWorker: BrowserLabWorkerFactory = createBrowserLabWorker) {}

  runSuite(request: SandboxRunRequest, options: { signal?: AbortSignal; onLog?: (entry: SandboxLogEntry) => void } = {}): Promise<TestReceipt> {
    validateSandboxRunRequest(request);
    if (options.signal?.aborted) return Promise.reject(new BrowserLabAbortError());
    const worker = this.createWorker();
    return new Promise<TestReceipt>((resolve, reject) => {
      let settled = false;
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
        options.signal?.removeEventListener("abort", onAbort);
        worker.terminate();
        action();
      };
      const onMessage: MessageListener = ({ data }) => {
        if (!isSandboxWorkerResponse(data) || data.jobId !== request.jobId) return;
        if (data.type === "browser-lab/log") {
          options.onLog?.(data.entry);
          return;
        }
        if (data.type === "browser-lab/failed") {
          finish(() => reject(new BrowserLabError(data.error.code, data.error.message)));
          return;
        }
        if (!receiptMatchesRequest(data.receipt, request)) {
          finish(() => reject(new BrowserLabStaleResultError("The worker returned a receipt for different source or contracts.")));
          return;
        }
        finish(() => resolve(data.receipt));
      };
      const onError: ErrorListener = (event) => finish(() => reject(new BrowserLabError("WORKER_CRASHED", event.message || "The isolated worker crashed.")));
      const onAbort = () => finish(() => reject(new BrowserLabAbortError()));
      const watchdog = setTimeout(() => finish(() => reject(new BrowserLabTimeoutError(request.limits.wallTimeoutMs))), request.limits.wallTimeoutMs);
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      options.signal?.addEventListener("abort", onAbort, { once: true });
      worker.postMessage({ type: "browser-lab/run-suite", payload: request });
    });
  }
}
