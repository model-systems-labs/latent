"use client";

import type { RnnResult } from "../../lib/lab-engines";

export function trainCharacterRnnInWorker(steps = 600, signal?: AbortSignal) {
  if (typeof Worker === "undefined") return Promise.reject(new Error("This browser cannot run the training worker."));
  const worker = new Worker(new URL("./training.worker.ts", import.meta.url), { type: "module", name: "latent-model-training" });
  return new Promise<RnnResult>((resolve, reject) => {
    const finish = (action: () => void) => {
      window.clearTimeout(watchdog);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      action();
    };
    const abort = () => finish(() => reject(new DOMException("Aborted", "AbortError")));
    const watchdog = window.setTimeout(() => finish(() => reject(new Error("Training exceeded its 15 second browser budget."))), 15_000);
    worker.onmessage = (event: MessageEvent<{ type: "trained"; result: RnnResult } | { type: "error"; message: string }>) => {
      const data = event.data;
      if (data.type === "trained") finish(() => resolve(data.result));
      else finish(() => reject(new Error(data.message)));
    };
    worker.onerror = (event) => finish(() => reject(new Error(event.message || "The training worker stopped.")));
    signal?.addEventListener("abort", abort, { once: true });
    worker.postMessage({ type: "train-character-rnn", steps });
  });
}
