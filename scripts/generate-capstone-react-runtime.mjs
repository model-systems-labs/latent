import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const output = resolve("public/capstone-react-runtime.js");
await mkdir(dirname(output), { recursive: true });

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
  outfile: output,
  legalComments: "eof",
  logLevel: "silent",
});

console.log(output);
