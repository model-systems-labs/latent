/// <reference lib="webworker" />

import { LOCAL_MODEL_MAX_NEW_TOKENS, type ModelWorkerRequest, type ModelWorkerResponse } from "./protocol";

type TextGenerator = ((input: unknown, options?: Record<string, unknown>) => Promise<unknown>) & {
  tokenizer: unknown;
  dispose?: () => Promise<void> | void;
};

type InterruptHandle = { interrupt: () => void };

const scope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let generator: TextGenerator | null = null;
let device: "webgpu" | "wasm" = "wasm";
const active = new Map<string, InterruptHandle>();

function emit(message: ModelWorkerResponse) {
  scope.postMessage(message);
}

async function createGenerator() {
  const transformers = await import("@huggingface/transformers");
  const progress_callback = (info: unknown) => {
    const update = info as { progress?: number; file?: string; status?: string };
    emit({
      type: "progress",
      progress: typeof update.progress === "number" ? Math.round(update.progress) : 0,
      detail: update.file?.split("/").at(-1) ?? update.status ?? "Preparing local model",
    });
  };
  const common = { dtype: "q4" as const, progress_callback };
  if ("gpu" in navigator) {
    try {
      const result = await transformers.pipeline("text-generation", "onnx-community/SmolLM2-135M-Instruct-ONNX", { ...common, device: "webgpu" });
      device = "webgpu";
      return { generator: result as unknown as TextGenerator, transformers };
    } catch {
      // WebGPU support varies by driver; retry with the portable WASM backend.
    }
  }
  const result = await transformers.pipeline("text-generation", "onnx-community/SmolLM2-135M-Instruct-ONNX", { ...common, device: "wasm" });
  device = "wasm";
  return { generator: result as unknown as TextGenerator, transformers };
}

let transformersModule: Awaited<ReturnType<typeof createGenerator>>["transformers"] | null = null;

async function ensureLoaded() {
  if (generator) return;
  const loaded = await createGenerator();
  generator = loaded.generator;
  transformersModule = loaded.transformers;
  emit({ type: "ready", detail: `SmolLM2-135M-Instruct · q4 · ${device}`, device });
}

async function generate(message: Extract<ModelWorkerRequest, { type: "generate" }>) {
  if (!generator || !transformersModule) throw new Error("Load the local model before you start generating.");
  const criterion = new transformersModule.InterruptableStoppingCriteria();
  active.set(message.requestId, criterion);
  let emittedChunks = 0;
  const streamer = new transformersModule.TextStreamer(generator.tokenizer as never, {
    skip_prompt: true,
    callback_function: (delta: string) => {
      if (delta) {
        emittedChunks += 1;
        emit({ type: "delta", requestId: message.requestId, delta });
      }
    },
  });
  emit({ type: "start", requestId: message.requestId });
  try {
    await generator(message.messages, {
      max_new_tokens: Math.min(message.options.maxTokens, LOCAL_MODEL_MAX_NEW_TOKENS),
      do_sample: true,
      temperature: message.options.temperature,
      top_k: message.options.topK || undefined,
      top_p: 0.9,
      repetition_penalty: 1.08,
      streamer,
      stopping_criteria: [criterion],
      return_full_text: false,
    });
    emit(criterion.interrupted
      ? { type: "cancelled", requestId: message.requestId, generatedUnits: emittedChunks, unit: "stream-chunks" }
      : { type: "done", requestId: message.requestId, generatedUnits: emittedChunks, unit: "stream-chunks" });
  } finally {
    active.delete(message.requestId);
  }
}

scope.onmessage = (event: MessageEvent<ModelWorkerRequest>) => {
  const message = event.data;
  if (message.type === "cancel") {
    active.get(message.requestId)?.interrupt();
    return;
  }
  if (message.type === "dispose") {
    for (const criterion of active.values()) criterion.interrupt();
    active.clear();
    void generator?.dispose?.();
    generator = null;
    scope.close();
    return;
  }
  if (message.type === "load") {
    void ensureLoaded().catch((error) => emit({ type: "error", message: error instanceof Error ? error.message : "Model load failed" }));
    return;
  }
  void generate(message).catch((error) => emit({
    type: "error",
    requestId: message.requestId,
    message: error instanceof Error ? error.message : "Generation failed",
  }));
};
