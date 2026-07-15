"use client";

import type { LocalModelGenerationResult, LocalModelOptions, ModelMessage, ModelWorkerRequest, ModelWorkerResponse } from "./protocol";

type LoadCallbacks = {
  onProgress: (progress: number, detail: string) => void;
};

type GenerationCallbacks = {
  onStart?: () => void;
  onDelta: (delta: string) => void;
};

export const LOCAL_MODEL_LOAD_TIMEOUT_MS = 120_000;

export class LocalModelClient {
  private worker: Worker | null = null;
  private readyWorker: Worker | null = null;
  private unavailableHandler: ((error: Error) => void) | null = null;
  private loadPromise: Promise<{ detail: string; device: "webgpu" | "wasm" }> | null = null;
  private resolveLoad: ((value: { detail: string; device: "webgpu" | "wasm" }) => void) | null = null;
  private rejectLoad: ((reason: Error) => void) | null = null;
  private loadCallbacks: LoadCallbacks | null = null;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  private generations = new Map<string, GenerationCallbacks & { resolve: (result: LocalModelGenerationResult) => void; reject: (error: Error) => void }>();

  constructor(
    private readonly workerFactory: () => Worker = () => new Worker(new URL("./model.worker.ts", import.meta.url), { type: "module", name: "latent-local-model" }),
    private readonly loadTimeoutMs = LOCAL_MODEL_LOAD_TIMEOUT_MS,
  ) {}

  private clearLoadTimer() {
    if (this.loadTimer !== null) globalThis.clearTimeout(this.loadTimer);
    this.loadTimer = null;
  }

  private failWorker(error: Error, expectedWorker: Worker | null = this.worker) {
    if (expectedWorker && this.worker !== expectedWorker) return;
    const worker = this.worker;
    this.worker = null;
    this.readyWorker = null;
    this.clearLoadTimer();
    const rejectLoad = this.rejectLoad;
    this.resolveLoad = null;
    this.rejectLoad = null;
    this.loadCallbacks = null;
    this.loadPromise = null;
    rejectLoad?.(error);
    for (const task of this.generations.values()) task.reject(error);
    this.generations.clear();
    worker?.terminate();
    if (worker) this.unavailableHandler?.(error);
  }

  private ensureWorker() {
    if (this.worker) return this.worker;
    const worker = this.workerFactory();
    worker.onmessage = (event: MessageEvent<ModelWorkerResponse>) => {
      if (this.worker === worker) this.handle(event.data);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      const error = new Error(event.message || "The local model stopped unexpectedly.");
      this.failWorker(error, worker);
    };
    this.worker = worker;
    return worker;
  }

  private handle(message: ModelWorkerResponse) {
    if (message.type === "progress") {
      this.loadCallbacks?.onProgress(message.progress, message.detail);
      return;
    }
    if (message.type === "ready") {
      this.clearLoadTimer();
      this.readyWorker = this.worker;
      this.resolveLoad?.({ detail: message.detail, device: message.device });
      this.resolveLoad = null;
      this.rejectLoad = null;
      this.loadCallbacks = null;
      return;
    }
    if (message.type === "error" && !message.requestId) {
      this.failWorker(new Error(message.message));
      return;
    }
    if (!("requestId" in message)) return;
    const requestId = message.requestId;
    if (!requestId) return;
    const task = this.generations.get(requestId);
    if (!task) return;
    if (message.type === "start") task.onStart?.();
    if (message.type === "delta") task.onDelta(message.delta);
    if (message.type === "done" || message.type === "cancelled") {
      this.generations.delete(requestId);
      task.resolve({ generatedUnits: message.generatedUnits, unit: message.unit });
    }
    if (message.type === "error") {
      this.generations.delete(requestId);
      task.reject(new Error(message.message));
    }
  }

  load(callbacks: LoadCallbacks) {
    this.loadCallbacks = callbacks;
    if (this.loadPromise) return this.loadPromise;
    const worker = this.ensureWorker();
    const promise = new Promise<{ detail: string; device: "webgpu" | "wasm" }>((resolve, reject) => {
      this.resolveLoad = resolve;
      this.rejectLoad = reject;
    });
    this.loadPromise = promise;
    try {
      worker.postMessage({ type: "load" } satisfies ModelWorkerRequest);
      this.loadTimer = globalThis.setTimeout(() => {
        this.failWorker(new Error(`The local model didn't finish loading within ${this.loadTimeoutMs} ms.`), worker);
      }, Math.max(1, this.loadTimeoutMs));
    } catch (error) {
      this.failWorker(error instanceof Error ? error : new Error("The local model couldn't start."), worker);
    }
    return promise;
  }

  isReady() {
    return Boolean(this.worker && this.readyWorker === this.worker);
  }

  setUnavailableHandler(handler: ((error: Error) => void) | null) {
    this.unavailableHandler = handler;
  }

  generate(requestId: string, messages: ModelMessage[], options: LocalModelOptions, callbacks: GenerationCallbacks) {
    if (this.generations.has(requestId)) return Promise.reject(new Error("That generation is already active."));
    const worker = this.worker;
    if (!worker || this.readyWorker !== worker) {
      return Promise.reject(new Error("The local model isn't ready on the current worker. Load it before you start generating."));
    }
    return new Promise<LocalModelGenerationResult>((resolve, reject) => {
      this.generations.set(requestId, { ...callbacks, resolve, reject });
      try {
        worker.postMessage({ type: "generate", requestId, messages, options } satisfies ModelWorkerRequest);
      } catch (error) {
        this.failWorker(error instanceof Error ? error : new Error("The local model couldn't start generating."), worker);
      }
    });
  }

  cancel(requestId: string) {
    const worker = this.worker;
    if (!worker || this.readyWorker !== worker || !this.generations.has(requestId)) return;
    try {
      worker.postMessage({ type: "cancel", requestId } satisfies ModelWorkerRequest);
    } catch (error) {
      this.failWorker(error instanceof Error ? error : new Error("The local model couldn't stop the generation."), worker);
    }
  }

  dispose() {
    if (this.worker) this.worker.postMessage({ type: "dispose" } satisfies ModelWorkerRequest);
    this.failWorker(new Error("The local model was closed."));
  }
}
