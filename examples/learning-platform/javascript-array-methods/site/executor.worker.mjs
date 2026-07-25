const safePostMessage = globalThis.postMessage.bind(globalThis);
const safeAddEventListener = globalThis.addEventListener.bind(globalThis);

const blockedGlobals = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "importScripts",
];

for (const key of blockedGlobals) {
  try {
    Object.defineProperty(globalThis, key, {
      configurable: false,
      value: undefined,
      writable: false,
    });
  } catch {
    // This worker is a bounded teaching runtime, not a hostile-code sandbox.
  }
}

function loadEntrypoint(source, entrypoint) {
  if (
    entrypoint?.kind !== "function"
    || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(entrypoint.functionName)
  ) {
    throw new Error("The static starter accepts a named function entrypoint.");
  }
  const name = entrypoint.functionName;
  return Function(
    `"use strict";\n${source}\nreturn typeof ${name} === "function" ? ${name} : undefined;`,
  )();
}

safeAddEventListener("message", async (event) => {
  const { nonce, source, entrypoint, args } = event.data ?? {};
  try {
    const callable = loadEntrypoint(String(source ?? ""), entrypoint);
    if (typeof callable !== "function") {
      throw new Error(`Define function ${entrypoint.functionName}.`);
    }
    const value = await callable(...args);
    safePostMessage({ nonce, ok: true, value });
  } catch (error) {
    safePostMessage({
      nonce,
      ok: false,
      error: error instanceof Error ? error.message : "The exercise could not run.",
    });
  }
});
