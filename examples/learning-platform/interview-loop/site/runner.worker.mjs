import { assessCase, serializedOutputBytes } from "./checker.mjs";
import { admitRuntimeLimits } from "./runtime-policy.mjs";

const SafeWorker = globalThis.Worker;
const safePostMessage = globalThis.postMessage.bind(globalThis);
const safeAddEventListener = globalThis.addEventListener.bind(globalThis);
const safeRandomUuid = globalThis.crypto.randomUUID.bind(globalThis.crypto);
const safeSetTimeout = globalThis.setTimeout.bind(globalThis);
const safeClearTimeout = globalThis.clearTimeout.bind(globalThis);

function executeCase(source, entrypoint, exerciseCase, limits) {
  return new Promise((resolve, reject) => {
    const worker = new SafeWorker(
      new URL("./executor.worker.mjs", import.meta.url),
      { type: "module" },
    );
    const nonce = safeRandomUuid();
    const timer = safeSetTimeout(() => {
      worker.terminate();
      reject(new Error(`Case "${exerciseCase.id}" exceeded ${limits.timeoutMs}ms.`));
    }, limits.timeoutMs);
    worker.addEventListener("message", (event) => {
      if (event.data?.nonce !== nonce) return;
      safeClearTimeout(timer);
      worker.terminate();
      if (
        event.data.ok
        && typeof event.data.purity?.inputUnchanged === "boolean"
        && typeof event.data.purity?.outputFresh === "boolean"
      ) {
        resolve({
          value: event.data.value,
          purity: event.data.purity,
        });
      }
      else reject(new Error(event.data.error ?? "The exercise could not run."));
    });
    worker.addEventListener("error", () => {
      safeClearTimeout(timer);
      worker.terminate();
      reject(new Error("The isolated execution worker failed."));
    });
    worker.postMessage({
      nonce,
      source,
      entrypoint,
      args: exerciseCase.args ?? [],
    });
  });
}

safeAddEventListener("message", async (event) => {
  const { id, source, entrypoint, cases, limits: requestedLimits } = event.data ?? {};
  try {
    const limits = admitRuntimeLimits(requestedLimits);
    const results = [];
    for (const exerciseCase of cases ?? []) {
      const execution = await executeCase(source, entrypoint, exerciseCase, limits);
      if (serializedOutputBytes(execution.value) > limits.maxOutputBytes) {
        throw new Error("The serialized result exceeded the exercise output limit.");
      }
      results.push(assessCase(exerciseCase, execution.value, execution.purity));
    }
    safePostMessage({ id, ok: true, results });
  } catch (error) {
    safePostMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : "The exercise could not run.",
    });
  }
});
