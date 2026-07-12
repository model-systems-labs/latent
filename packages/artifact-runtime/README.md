# @latent/artifact-runtime

`@latent/artifact-runtime` is the course-independent runtime for immutable,
content-addressed learning artifacts. It records expensive or validated work as
portable values that later lessons can inspect, compare, replay, and assemble
without pretending the work ran again.

The package has no dependency on React, the LMS, lesson manifests, or the
learner-code sandbox. Course-specific artifact blueprints and recorded model
checkpoints belong in the application that consumes this package.

## Entry points

| Import | Purpose | Environment |
| --- | --- | --- |
| `@latent/artifact-runtime` | Existing aggregate API: core, bundles, storage, and types | Browser or a runtime with IndexedDB when storage is used |
| `@latent/artifact-runtime/core` | Hashing, validation, comparison, and replay cursors | Browser, worker, or modern Node.js |
| `@latent/artifact-runtime/portable` | Portable bundle creation, validation, and serialization | Browser, worker, or modern Node.js |
| `@latent/artifact-runtime/storage` | Dexie database and `ArtifactStore` | Browser or an IndexedDB-compatible runtime |
| `@latent/artifact-runtime/client` | Browser singleton for the default local store | Client component only |
| `@latent/artifact-runtime/types` | Schema constants and TypeScript contracts | Any |

The `./store` path remains as an alias of `./storage` for callers that use the
original module name.

## Usage

Create a deterministic artifact with the core entry point:

```ts
import { createArtifact } from "@latent/artifact-runtime/core";

const artifact = await createArtifact({
  kind: "training-checkpoint",
  mode: "recorded",
  title: "Step 100 checkpoint",
  description: "A recorded checkpoint used by the optimization lesson.",
  projectId: "browser-chat",
  moduleId: "model",
  lessonId: "optimization",
  producer: { runtime: "training-replay", version: "1", operation: "checkpoint" },
  validation: { status: "recorded" },
  labels: ["checkpoint"],
  links: [],
  metrics: { loss: 2.14, steps: 100 },
  payload: { weights: [[0.1, -0.2]] },
  replay: null,
});
```

Persist it through the optional IndexedDB seam:

```ts
import { openArtifactRuntime } from "@latent/artifact-runtime/storage";

const runtime = await openArtifactRuntime();
await runtime.store.put(artifact);
runtime.close();
```

Artifact identity excludes `createdAt`, so the same material produces the same
SHA-256 content hash and artifact ID across recordings. Stored artifacts are
immutable: an existing ID cannot be replaced with different content.

## Package contract

- Artifact values must be JSON-compatible, finite, acyclic, and within the
  runtime's structural limits.
- Replay frame indexes are contiguous and replay time is monotonic.
- Lineage bundles are complete and verify every linked artifact's hash and kind.
- Storage is optional. Core and portable imports do not import Dexie.
- The package does not own curriculum order, assessment contracts, or UI.

## Development

From the repository root:

```sh
npm run validate --workspace @latent/artifact-runtime
```

Or before the root workspace is installed:

```sh
npm --prefix packages/artifact-runtime run validate
```

`validate` performs an isolated typecheck, emits the distributable JavaScript
and declarations, and runs the package's core, bundle, and IndexedDB tests.
