/// <reference lib="webworker" />

import * as esbuild from "esbuild-wasm";
import wasmURL from "esbuild-wasm/esbuild.wasm?url";
import { BrowserLabError } from "../errors";
import { isCompilerWorkerRequest } from "./protocol";
import type { CompilerSerializedError, CompilerWorkerResponse } from "./types";
import { compileVirtualProject, compilerVersionForEsbuild } from "./virtual-project";
import { BROWSER_LAB_COMPILER_VERSION } from "./version";

declare const self: DedicatedWorkerGlobalScope;

let initialization: Promise<void> | undefined;
let queue = Promise.resolve();

function initializeCompiler(): Promise<void> {
  initialization ??= (async () => {
    const runtimeVersion = compilerVersionForEsbuild(esbuild.version);
    if (runtimeVersion !== BROWSER_LAB_COMPILER_VERSION) {
      throw new BrowserLabError("INVALID_COMPILER", `Browser Lab expects ${BROWSER_LAB_COMPILER_VERSION}, but the worker loaded ${runtimeVersion}.`);
    }
    await esbuild.initialize({ wasmURL, worker: false });
  })();
  return initialization;
}

function serializeError(error: unknown): CompilerSerializedError {
  if (error instanceof BrowserLabError) return { code: error.code, message: error.message };
  return { code: "COMPILER_FAILURE", message: "The isolated compiler failed closed." };
}

async function handleMessage(data: unknown): Promise<void> {
  if (!isCompilerWorkerRequest(data)) return;
  const { payload } = data;
  try {
    await initializeCompiler();
    const program = await compileVirtualProject(payload, esbuild);
    const response: CompilerWorkerResponse = { type: "browser-lab/compile-completed", jobId: payload.jobId, program };
    self.postMessage(response);
  } catch (error) {
    const response: CompilerWorkerResponse = { type: "browser-lab/compile-failed", jobId: payload.jobId, error: serializeError(error) };
    self.postMessage(response);
  }
}

self.addEventListener("message", ({ data }) => {
  queue = queue.then(() => handleMessage(data), () => handleMessage(data));
});
