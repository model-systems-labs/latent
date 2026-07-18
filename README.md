# Latent

Latent contains four executable browser courses:

- Linear Algebra Basics — 5 lessons on arrays, vectors, matrix operations, and
  batching.
- Machine Learning Basics — 5 lessons on data, loss, gradients, classification,
  and small neural networks.
- Harness Engineering — 8 lessons on agent loops, tools, context, permissions,
  durable state, evaluation, task coordination, and a composed harness.
- Build an LLM System in Your Browser — 14 lessons from model foundations
  through a production-style React chat interface.

The first two courses are stand-alone prerequisites. Their NumPy exercises and
saved progress do not add files or requirements to Browser Chat. Harness
Engineering is also stand-alone: it studies deterministic agent execution
around an existing model. The advanced LLM Systems course alone builds Browser
Chat across four modules: Model Foundations, Inference Runtime, LLM Serving,
and Chat Integration. In total, Latent contains 32 lessons.

Every lesson links to its curated sources, explains the technical finding, and
includes implementation cells backed by host-owned tests. In the LLM Systems
course, the same project files open in a dedicated IDE and produce the validated
build used by the capstone.

Numerical lessons run CPython and NumPy through WebAssembly in the browser. In
LLM Systems, learners edit the same Python files in the lesson and project IDE,
run host-owned tests, train the course model, and carry the resulting checkpoint
into the capstone without switching tools or installing a local runtime.

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
- An independent Artifact Runtime with content-addressed lineage, replay,
  comparison, device-local storage, and portable checkpoint downloads.

Learner code never executes in the application realm. The host owns the test
assertions, compiler policy, resource limits, build receipts, and promotion gate.

## Project map

- `packages/tensor/` — typed tensor/autograd runtime plus generated Browser Lab source
- `packages/model-lab/` — deterministic educational model, tokenizer, and attention engines
- `packages/browser-lab/` — VFS compiler, QuickJS sandbox, test receipts, and promotion gate
- `packages/artifact-runtime/` — domain-neutral artifact lineage, replay, comparison, and storage
- `packages/training-replay/` — validated model-neutral recordings, lazy scenarios, and checkpoint view models
- `packages/course-kit/` — lesson types, curriculum schema, and curriculum compiler
- `packages/mock-services/` — MSW handlers, SSE transport, cancellation, and failure scenarios
- `app/content/llm-systems/` — curriculum manifest and typed exercise contracts
- `app/content/foundations/` — manifests, contracts, learning checks, and provenance for the two prerequisite courses
- `app/content/harness-engineering/` — manifest, contracts, learning checks, and provenance for the applied agent-systems course
- `app/lessons/harness-engineering/` — eight standalone lessons on model-agnostic agent execution
- `app/features/ide/` — authoring experience and Browser Lab orchestration
- `app/platform/persistence/` — Dexie schema, repositories, migrations, exports
- `app/runtime/model/` — character training and local Transformer workers
- `app/runtime/bindings/` — validated capstone binding descriptors
- `app/features/artifacts/` — course adapters and recorded training checkpoints
- `app/lessons/model/` and `app/lessons/extended/` — one independently owned lesson per file
- `app/styles/` — learning-flow, course, coding, capstone, and responsive style layers
- `tests/` — curriculum, compiler, sandbox, persistence, binding, and render tests

The root is the private `@latent/web` application and remains the Sites deployment
surface. Reusable systems are npm workspaces under `packages/*`. Packages may
depend on other declared packages but may never import application code.

## Local development

Node.js `>=22.13.0` is required.

```bash
npm install
npm run dev
```

Validation:

```bash
npm run validate
```

`npm run validate` enforces package boundaries, builds and typechecks every
workspace, lints the repository, creates the production site, runs each package
suite independently, and finishes with the application integration suite.

The checked-in character-model checkpoint ladder comes from a reproducible
deterministic run. Regenerate it after intentionally changing the trainer with:

```bash
npm run artifacts:record-training
```

## Privacy and storage

Source edits, test receipts, checkpoints, builds, and conversations are stored
on the learner's device. Loading the optional local Transformer downloads model
weights into the browser cache; inference then runs in a Web Worker. No API key
is required for the executable course or capstone.
