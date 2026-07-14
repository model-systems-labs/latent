import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const runtimeOutput = resolve("public/capstone-react-runtime.js");
const sandboxWorkerOutput = resolve("public/capstone-sandbox-worker.js");
const sandboxWasmOutput = resolve("public/emscripten-module.wasm");
await mkdir(dirname(runtimeOutput), { recursive: true });

await build({
  stdin: {
    contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      globalThis.__LATENT_REACT__ = Object.freeze({ React, createRoot });
    `,
    loader: "js",
    resolveDir: process.cwd(),
    sourcefile: "capstone-react-runtime-entry.js",
  },
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  outfile: runtimeOutput,
  legalComments: "eof",
  logLevel: "silent",
});

await build({
  entryPoints: [resolve("packages/browser-lab/src/worker/sandbox.worker.ts")],
  bundle: true,
  minify: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  outfile: sandboxWorkerOutput,
  legalComments: "eof",
  logLevel: "silent",
});

await copyFile(
  resolve("node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm"),
  sandboxWasmOutput,
);

console.log(runtimeOutput);
console.log(sandboxWorkerOutput);
console.log(sandboxWasmOutput);
