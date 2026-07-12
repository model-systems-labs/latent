# Latent

Latent is an executable browser course for building an LLM system from model
foundations through a production-style React chat interface.

The program contains four modules and fourteen lessons:

1. Model Foundations
2. Inference Runtime
3. LLM Serving
4. Chat Integration

Every lesson links to its primary sources, explains the technical finding, and
includes implementation cells backed by host-owned tests. The same project files
open in a dedicated IDE and produce the validated build used by the capstone.

## What runs in the browser

- A CodeMirror project editor with per-file and full-project tests.
- A virtual TypeScript/JavaScript compiler powered by `esbuild-wasm`.
- A QuickJS sandbox with CPU, memory, output, and host-capability limits.
- IndexedDB persistence through Dexie, including legacy-state migration,
  autosave, checkpoints, conversations, and portable import/export.
- A learner-trained character RNN and a real local SmolLM2-135M Transformer
  using Transformers.js with WebGPU and WASM fallback.
- A deterministic SSE serving adapter with latency and failure injection.
- Atomic build promotion: only source-matched, fully passing artifacts may
  replace the active capstone runtime.

Learner code never executes in the application realm. The host owns the test
assertions, compiler policy, resource limits, build receipts, and promotion gate.

## Project map

- `app/content/llm-systems/` — curriculum manifest and typed exercise contracts
- `app/features/ide/` — authoring experience and Browser Lab orchestration
- `app/platform/browser-lab/` — VFS compiler, QuickJS sandbox, test receipts
- `app/platform/persistence/` — Dexie schema, repositories, migrations, exports
- `app/runtime/model/` — character training and local Transformer workers
- `app/runtime/serving/` — SSE transport and deterministic failure scenarios
- `app/runtime/bindings/` — validated capstone binding descriptors
- `tests/` — curriculum, compiler, sandbox, persistence, binding, and render tests

## Local development

Node.js `>=22.13.0` is required.

```bash
npm install
npm run dev
```

Validation:

```bash
npm run typecheck
npm run lint
npm test
```

`npm test` performs the production build and runs all 36 host-side tests.

## Privacy and storage

Source edits, test receipts, checkpoints, builds, and conversations are stored
on the learner's device. Loading the optional local Transformer downloads model
weights into the browser cache; inference then runs in a Web Worker. No API key
is required for the executable course or capstone.
