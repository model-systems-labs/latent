/// <reference lib="webworker" />

import { trainCharacterRnn } from "../../lib/lab-engines";

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (event: MessageEvent<{ type: "train-character-rnn"; steps: number }>) => {
  if (event.data?.type !== "train-character-rnn") return;
  try {
    const result = trainCharacterRnn(Math.max(100, Math.min(2_000, Math.round(event.data.steps))));
    scope.postMessage({ type: "trained", result });
  } catch (error) {
    scope.postMessage({ type: "error", message: error instanceof Error ? error.message : "Training failed" });
  }
};

