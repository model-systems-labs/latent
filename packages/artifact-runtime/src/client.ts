"use client";

import { openArtifactRuntime, type ArtifactStore } from "./store.js";

let runtimePromise: ReturnType<typeof openArtifactRuntime> | null = null;

export function getArtifactRuntime(): Promise<{ database: import("./store.js").ArtifactRuntimeDatabase; store: ArtifactStore; close: () => void }> {
  runtimePromise ??= openArtifactRuntime();
  return runtimePromise;
}

export async function closeArtifactRuntime() {
  const runtime = runtimePromise;
  runtimePromise = null;
  if (runtime) (await runtime).close();
}
