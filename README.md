# Latent

Create lessons and flash cards locally, publish them on any static host, and let
learners use them without a required account or model provider.

[![Validate](https://github.com/model-systems-labs/latent/actions/workflows/ci.yml/badge.svg)](https://github.com/model-systems-labs/latent/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/code-Apache--2.0-blue.svg)](./LICENSE)
[![Content: CC BY 4.0](https://img.shields.io/badge/content-CC%20BY%204.0-lightgrey.svg)](./CONTENT_LICENSE.md)

Latent is two things in one repository:

- an open, model-neutral publishing framework for portable lessons, quizzes,
  and flash-card decks; and
- four first-party executable browser courses that exercise the framework and
  the deeper learning runtimes in a real product.

The open framework is the floor. Everything required to author, validate,
export, read, and self-host a Learning Pack is available here. An optional
managed service can later provide project storage, one-click publishing,
domains, analytics, and collaboration, but exported content must keep working
without that service.

## Create and host a Learning Pack

A Learning Pack is declarative JSON containing objectives, sources, lessons,
multiple-choice checks, flash-card decks, or any combination of those.

With the published Course Kit:

```bash
npm exec --yes --package=@latent/course-kit@0.1.0 -- \
  latent-learning init my-learning-pack
```

The starter is intentionally incomplete. Replace its placeholder identity,
sources, objectives, and teaching material, then validate and build it:

```bash
npm exec --yes --package=@latent/course-kit@0.1.0 -- \
  latent-learning validate my-learning-pack/learning-pack.json --strict

npm exec --yes --package=@latent/course-kit@0.1.0 -- \
  latent-learning build my-learning-pack/learning-pack.json \
  --out-dir my-learning-pack/site

npm exec --yes --package=@latent/course-kit@0.1.0 -- \
  latent-learning serve my-learning-pack/site
```

Open `http://127.0.0.1:4173`. The generated directory is a complete static
learning site. Put it on GitHub Pages, S3, Cloudflare Pages, Netlify, another
static host, or your own local server.

The same package can expose `learning-feed.json` to another compatible reader.
The feed binds an immutable package id and semantic version to its exact byte
count and SHA-256 digest.

If you are working from this repository instead of the published package:

```bash
npm ci
npm run build --workspace @latent/course-kit
node packages/course-kit/bin/latent-learning.mjs init my-learning-pack
```

The complete format, hosting, extension, and trust contract is in
[docs/open-learning.md](./docs/open-learning.md). A production-sized example
lives at
[examples/open-learning/reliable-llm-changes](./examples/open-learning/reliable-llm-changes).
The browser application also exposes a local authoring studio at
`/open-learning`.

## Why the format stays open

- **No required center.** A publisher-controlled static URL is enough.
- **No required AI vendor.** People and arbitrary LLMs use the same schema,
  validator, quality rubric, and publishing workflow.
- **No content lock-in.** The source pack and generated site remain
  downloadable and independently hostable.
- **No remote executable plugins.** Community content is rendered as data,
  outside the privileged runtimes used by first-party courses.
- **No implied endorsement.** Byte integrity, publisher identity, editorial
  review, and platform certification are separate claims.

Namespaced declarative extensions let publishers experiment without granting
new runtime permissions. Broadly useful capabilities can graduate into a later
versioned format through the normal public review process.

## Security model

The hosted-feed reader fetches without credentials or a referrer, rejects
redirects and unsafe package paths, enforces a two-megabyte UTF-8 limit, checks
the declared byte count and SHA-256 digest, validates package identity, and
requires canonical JSON before rendering.

Community packs cannot execute JavaScript, HTML, CSS, MDX, React, Python,
workers, iframes, npm packages, or authored tests. Built-in courses may use
privileged Browser Lab and Python Lab runtimes, but those capabilities are not
available to remote content.

See [SECURITY.md](./SECURITY.md) for private vulnerability reporting.

## First-party browser courses

Latent includes 32 executable lessons across four courses:

- **Linear Algebra Basics** — five lessons on arrays, vectors, matrix
  operations, and batching.
- **Machine Learning Basics** — five lessons on data, loss, gradients,
  classification, and small neural networks.
- **Harness Engineering** — eight lessons on agent loops, tools, context,
  permissions, durable state, evaluation, task coordination, and a composed
  harness.
- **Build an LLM System in Your Browser** — fourteen lessons from model
  foundations through a production-style React chat interface.

The two prerequisite courses run CPython and NumPy through WebAssembly. Harness
Engineering uses deterministic model replies and tool results so its exercises
are fast and require no API key. The LLM Systems course carries the same saved
Python project through lessons, a dedicated IDE, model training, checkpoints,
and a production-style React capstone.

Every lesson links its sources and includes implementation work backed by
host-owned behavioral checks. Learner code never executes in the application
realm.

## What runs in the browser

- A CodeMirror project editor with per-file and full-project checks.
- A virtual TypeScript and JavaScript compiler powered by `esbuild-wasm`.
- A QuickJS sandbox with CPU, memory, output, and host-capability limits.
- CPython and NumPy through a dedicated Pyodide worker.
- IndexedDB persistence through Dexie, including migration, autosave,
  checkpoints, conversations, and portable export.
- A learner-trained character RNN and an optional local SmolLM2-135M
  Transformer using Transformers.js with WebGPU and WASM fallback.
- A deterministic SSE serving adapter with latency and failure injection.
- Content-addressed artifacts, replay, comparison, and atomic build promotion.

## Repository map

- `packages/course-kit/` — public Learning Pack schemas, validation, CLI, and
  static-site builder
- `skills/` — model-neutral author, review, and publish workflows for LLMs
- `examples/open-learning/` — complete self-hosted Learning Pack examples
- `app/open-learning/` — browser authoring and verified hosted-feed reader
- `packages/browser-lab/` — virtual compiler, QuickJS sandbox, checks, and
  promotion gate
- `packages/python-lab/` — isolated browser Python execution
- `packages/model-lab/` and `packages/tensor/` — educational model and tensor
  engines
- `packages/artifact-runtime/` and `packages/training-replay/` — immutable
  artifact lineage and model-neutral recordings
- `app/content/` and `app/lessons/` — first-party curricula and exercise
  contracts
- `tests/` — format, CLI, curriculum, runtime, persistence, accessibility, and
  rendered-product contracts

The root `@latent/web` workspace remains private in npm metadata to prevent an
accidental application publish. That does not make the repository proprietary.
Reusable public packages declare their publication boundary independently.

## Local development

Node.js `>=22.13.0` is required.

```bash
npm ci
npm run dev
```

Run the complete release gate:

```bash
npm run validate
```

`npm run validate` checks workspace boundaries, builds and typechecks packages,
lints the repository, creates the production application, enforces payload
budgets, and runs package and integration tests.

When changing Open Learning, also regenerate its committed contracts and
artifacts:

```bash
npm run open-learning:validate
npm run open-learning:schema
npm run open-learning:generate
git diff --exit-code
```

## Privacy and storage

Source edits, checks, checkpoints, builds, installed Learning Packs, and
conversations are stored on the learner's device. Loading the optional local
Transformer downloads model weights into the browser cache; inference then
runs in a worker. No API key is required for the first-party courses or the
self-hosted Learning Pack workflow.

## Community and licensing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. The
[roadmap](./ROADMAP.md) identifies near-term interoperability and hosted-service
work, and [CHANGELOG.md](./CHANGELOG.md) records released behavior.

Software is available under Apache-2.0. Original educational material is also
available under CC BY 4.0 where defined in
[CONTENT_LICENSE.md](./CONTENT_LICENSE.md). Third-party works retain their own
licenses and attribution; see [CONTENT_PROVENANCE.md](./CONTENT_PROVENANCE.md).
