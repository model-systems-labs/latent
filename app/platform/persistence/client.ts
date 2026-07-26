"use client";

import { initializePersistence, type PersistenceContext } from "@/app/platform/persistence/index";

let contextPromise: Promise<PersistenceContext> | null = null;

/** One database connection and one legacy-import pass per browser tab. */
export function getPersistenceContext() {
  if (typeof window === "undefined") return Promise.reject(new Error("Saved browser data is only available in the browser."));
  contextPromise ??= initializePersistence();
  return contextPromise;
}

export async function closePersistenceContext() {
  const pending = contextPromise;
  contextPromise = null;
  if (pending) (await pending).close();
}
