export const REDUCED_WORKER_GLOBALS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "WebTransport",
  "indexedDB",
  "caches",
  "Worker",
  "SharedWorker",
  "BroadcastChannel",
  "MessageChannel",
  "importScripts",
  "postMessage",
  "close",
] as const;

/**
 * Shadow host-capability properties only after Pyodide and curated packages
 * finish loading. The worker captures its response channel before this runs.
 */
export function reduceWorkerCapabilities(target: object): void {
  const global = target as Record<string, unknown>;
  for (const name of REDUCED_WORKER_GLOBALS) {
    try {
      Object.defineProperty(global, name, {
        value: undefined,
        writable: false,
        enumerable: false,
        configurable: false,
      });
    } catch {
      try {
        global[name] = undefined;
      } catch {
        // The verification below converts an unshadowable capability into a
        // closed initialization failure.
      }
    }
    if (global[name] !== undefined) throw new Error(`Worker capability could not be reduced: ${name}.`);
  }
}

export function workerCapabilitiesAreReduced(target: object): boolean {
  const global = target as Record<string, unknown>;
  return REDUCED_WORKER_GLOBALS.every((name) => global[name] === undefined);
}
