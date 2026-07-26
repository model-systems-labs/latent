# Latent

**Build your own learning platform with agents.**

Latent is an opinionated, open-source framework for courses, browser IDE
lessons, flash cards, and programming practice. The included courses are a
reviewed reference implementation, not the identity of the framework.
Production course sites should live in separate downstream repositories with
their own curriculum, access policy, and deployment history. Portable Learning
Pack sites remain independently hostable on any conforming static server.

[![Validate](https://github.com/model-systems-labs/latent/actions/workflows/ci.yml/badge.svg)](https://github.com/model-systems-labs/latent/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/code-Apache--2.0-blue.svg)](./LICENSE)
[![Content: CC BY 4.0](https://img.shields.io/badge/content-CC%20BY%204.0-lightgrey.svg)](./CONTENT_LICENSE.md)

## Five-minute golden path

Prepare one checkout with Node.js 22.13 or newer:

```bash
git clone --depth 1 --branch course-kit-v0.2.0 \
  https://github.com/model-systems-labs/latent.git
cd latent
npm ci
```

Then create, validate, build, and preview a complete branded platform with one
command:

```bash
npm run create:platform -- ../my-school \
  --title "My School" \
  --tagline "Learn one useful idea, retrieve it, and put it to work." \
  --preview
```

The generated project is dependency-free and includes a lesson, six-card
deck, Question Group, trusted browser JavaScript IDE exercise, device-local
progress, leech-only progress query, deterministic static build, and pinned
GitHub Pages workflow.

Read the [five-minute guide](./docs/getting-started.md), inspect the
[tiny JavaScript example](./examples/learning-platform/javascript-array-methods),
or use the included agent workflows in `skills/` to author and review each
layer.

This public repository contains two layers:

- an open, model-neutral publishing framework for portable lessons, quizzes,
  flash-card decks, and released Question Groups; and
- a released reference implementation with courses, an IDE, flash cards, and
  programming practice that exercises those framework boundaries.

A deployed course library is a third thing: a downstream instance. It belongs
in its own repository and owns its own product name, content choices, access
controls, and hosting metadata. The framework repository intentionally has no
`.openai/hosting.json`, so it cannot overwrite an instance deployment.

See [Framework and course instances](./docs/framework-and-instances.md) for
the code map and the upstream/downstream workflow.

The open framework is the floor. Everything required to author, validate,
export, read, and self-host a Learning Pack is available here. An optional
managed service can later provide project storage, one-click publishing,
domains, analytics, and collaboration, but exported content must keep working
without that service.

## What v0.2 promises

Latent supports two extension modes:

- **Portable content:** people and agents author bounded, declarative data that
  can be validated, inspected, and hosted independently.
- **Trusted platform source:** coding agents or people extend a repository fork
  with IDE exercises, runtime adapters, and host-owned behavioral contracts
  that are reviewed and compiled before deployment.

These modes do not grant arbitrary hosted content executable plugin authority.
Learning Packs for lessons, quizzes, and cards and Question Group v1 are stable
portable contracts. Course Kit validates both and can build self-hosted sites;
its bundled Question Group player supports JavaScript and TypeScript. The
built-in Latent practice site still executes only its reviewed bundled library.
IDE and custom runtime extensions are trusted source changes in v0.2.

Read the exact [v0.2 launch contract](./docs/v0.2-launch-contract.md) and the
[workspace architecture](./docs/architecture.md) before building against those
boundaries.

## Create and host a Learning Pack

A Learning Pack is declarative JSON containing objectives, sources, lessons,
multiple-choice checks, flash-card decks, or any combination of those.

The latest published Course Kit release is v0.2.0. Use its exact GitHub-hosted
tarball. The package itself does not need to be published under the `@latent`
npm scope, although `npm exec` still resolves Course Kit's pinned dependencies
from the configured npm registry:

```bash
COURSE_KIT_RELEASE=https://github.com/model-systems-labs/latent/releases/download/course-kit-v0.2.0/latent-course-kit-0.2.0.tgz

npm exec --yes --package="$COURSE_KIT_RELEASE" -- \
  latent-learning init my-learning-pack
```

The starter is intentionally incomplete. Replace its placeholder identity,
sources, objectives, and teaching material, then validate and build it:

```bash
npm exec --yes --package="$COURSE_KIT_RELEASE" -- \
  latent-learning validate my-learning-pack/learning-pack.json --strict

npm exec --yes --package="$COURSE_KIT_RELEASE" -- \
  latent-learning build my-learning-pack/learning-pack.json \
  --out-dir my-learning-pack/site

npm exec --yes --package="$COURSE_KIT_RELEASE" -- \
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
Run the browser application locally and open `/open-learning/publish` for the
authoring studio or `/open-learning/read` for the separately scoped hosted-feed
reader.

Course Kit is not currently published on npm. The GitHub release is the
official install path and includes a published SHA-256 checksum. The immutable
Question Group v1
[library schema](https://model-systems-labs.github.io/latent/question-groups/v1/question-group-library.schema.json)
and
[progress schema](https://model-systems-labs.github.io/latent/question-groups/v1/question-group-progress.schema.json)
are published separately from npm.

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

Community Learning Packs cannot execute JavaScript, HTML, CSS, MDX, React,
Python, workers, iframes, npm packages, or authored tests. Question Groups may
carry bounded learner starter source and data-only assertions, but they cannot
provide publisher-authored executable tests, imports, adapters, network
access, or runtime authority. Built-in courses may use privileged Browser Lab
and Python Lab runtimes, but those capabilities are not available to remote
content.

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
  static-site builder, plus the released Question Group schemas, validator,
  progress contract, and injectable player
- `skills/` — model-neutral author, review, and publish workflows for LLMs
- `examples/open-learning/` — complete self-hosted Learning Pack examples
- `app/open-learning/` — browser authoring and verified hosted-feed reader
- `app/practice/` — grouped method practice using the shared editor and
  source-bound device progress
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
licenses and attribution; see [CONTENT_PROVENANCE.md](./CONTENT_PROVENANCE.md)
and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
