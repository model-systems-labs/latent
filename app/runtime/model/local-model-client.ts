"use client";

import type { LocalModelOptions, ModelMessage, ModelWorkerRequest, ModelWorkerResponse } from "./protocol";

type LoadCallbacks = {
  onProgress: (progress: number, detail: string) => void;
};

type GenerationCallbacks = {
  onStart?: () => void;
  onDelta: (delta: string) => void;
};

export class LocalModelClient {
  private worker: Worker | null = null;
  private loadPromise: Promise<{ detail: string; device: "webgpu" | "wasm" }> | null = null;
  private resolveLoad: ((value: { detail: string; device: "webgpu" | "wasm" }) => void) | null = null;
  private rejectLoad: ((reason: Error) => void) | null = null;
  private loadCallbacks: LoadCallbacks | null = null;
  private generations = new Map<string, GenerationCallbacks & { resolve: () => void; reject: (error: Error) => void }>();

  private ensureWorker() {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./model.worker.ts", import.meta.url), { type: "module", name: "latent-local-model" });
    worker.onmessage = (event: MessageEvent<ModelWorkerResponse>) => this.handle(event.data);
    worker.onerror = (event) => {
      const error = new Error(event.message || "The local-model worker stopped unexpectedly.");
      this.rejectLoad?.(error);
      for (const task of this.generations.values()) task.reject(error);
      this.generations.clear();
    };
    this.worker = worker;
    return worker;
  }

  private post(message: ModelWorkerRequest) {
    this.ensureWorker().postMessage(message);
  }

  private handle(message: ModelWorkerResponse) {
    if (message.type === "progress") {
      this.loadCallbacks?.onProgress(message.progress, message.detail);
      return;
    }
    if (message.type === "ready") {
      this.resolveLoad?.({ detail: message.detail, device: message.device });
      this.resolveLoad = null;
      this.rejectLoad = null;
      return;
    }
    if (message.type === "error" && !message.requestId) {
      this.rejectLoad?.(new Error(message.message));
      this.loadPromise = null;
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
      task.resolve();
    }
    if (message.type === "error") {
      this.generations.delete(requestId);
      task.reject(new Error(message.message));
    }
  }

  load(callbacks: LoadCallbacks) {
    this.loadCallbacks = callbacks;
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = new Promise((resolve, reject) => {
      this.resolveLoad = resolve;
      this.rejectLoad = reject;
      this.post({ type: "load" });
    });
    return this.loadPromise;
  }

  generate(requestId: string, messages: ModelMessage[], options: LocalModelOptions, callbacks: GenerationCallbacks) {
    if (this.generations.has(requestId)) return Promise.reject(new Error("That generation is already active."));
    return new Promise<void>((resolve, reject) => {
      this.generations.set(requestId, { ...callbacks, resolve, reject });
      this.post({ type: "generate", requestId, messages, options });
    });
  }

  cancel(requestId: string) {
    if (this.generations.has(requestId)) this.post({ type: "cancel", requestId });
  }

  dispose() {
    if (this.worker) this.worker.postMessage({ type: "dispose" } satisfies ModelWorkerRequest);
    this.worker?.terminate();
    this.worker = null;
    this.generations.clear();
    this.loadPromise = null;
  }
}
