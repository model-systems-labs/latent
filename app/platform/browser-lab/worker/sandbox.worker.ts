import { BrowserLabError } from "../errors";
import type { SandboxWorkerRequest, SandboxWorkerResponse } from "../types";
import { handleSandboxRunRequest } from "./handler";
import { QuickJSSandboxEngine } from "./quickjs-engine";

type WorkerScope = {
  addEventListener: (type: "message", listener: (event: { data: unknown }) => void) => void;
  postMessage: (message: SandboxWorkerResponse) => void;
};

const scope = globalThis as unknown as WorkerScope;
const engine = new QuickJSSandboxEngine();
let busy = false;

function send(message: SandboxWorkerResponse): void {
  scope.postMessage(message);
}

scope.addEventListener("message", async ({ data }) => {
  const message = data as Partial<SandboxWorkerRequest>;
  if (message.type !== "browser-lab/run-suite" || !message.payload || typeof message.payload !== "object") return;
  const jobId = typeof (message.payload as { jobId?: unknown }).jobId === "string" ? (message.payload as { jobId: string }).jobId : "unknown";
  if (busy) {
    send({ type: "browser-lab/failed", jobId, error: { code: "WORKER_BUSY", message: "A disposable Browser Lab worker accepts exactly one test job." } });
    return;
  }
  busy = true;
  try {
    const receipt = await handleSandboxRunRequest(message.payload as SandboxWorkerRequest["payload"], engine, send);
    send({ type: "browser-lab/completed", jobId, receipt });
  } catch (error) {
    const code = error instanceof BrowserLabError ? error.code : "SANDBOX_FAILED";
    send({ type: "browser-lab/failed", jobId, error: { code, message: error instanceof Error ? error.message : "The isolated sandbox failed closed." } });
  }
});
