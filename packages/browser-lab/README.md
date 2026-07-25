# `@latent/browser-lab`

Browser Lab is the course-agnostic trust boundary for compiling, testing, and
promoting learner projects. It contains no React, LMS, persistence, lesson, or
model imports.

The package is source-first inside this monorepo. Its export map points at
TypeScript so the host bundler can discover the compiler and sandbox worker
entry points without changing their `import.meta.url` semantics. A publishable
`dist` build is intentionally deferred until the workers have a dedicated
library bundling pipeline.

## Public API

```ts
import {
  BrowserLabWorkerClient,
  createBuildArtifact,
  createCompileJob,
  type ExerciseContract,
} from "@latent/browser-lab";

import {
  createBrowserIdeSession,
  createBrowserLabIdeRuntime,
  defineBrowserIdeExtension,
} from "@latent/browser-lab/ide";

import {
  BrowserLabCompilerClient,
  compileVirtualProject,
} from "@latent/browser-lab/compiler";

import { validateExerciseContract } from "@latent/browser-lab/contracts";
import type { ProjectSnapshot } from "@latent/browser-lab/types";
import { QuickJSSandboxEngine } from "@latent/browser-lab/worker";
```

Only the package root and the `compiler`, `contracts`, `ide`, `types`, and
`worker` subpaths are public. All other files are implementation details.

## Browser IDE extension seam

Trusted application source can define a JavaScript or TypeScript exercise
without importing an application editor, storage repository, or lesson module:

```ts
const definition = defineBrowserIdeExtension({
  schemaVersion: 1,
  id: "example.double",
  title: "Implement double",
  initialFilePath: "src/double.ts",
  files: [{
    path: "src/double.ts",
    loader: "ts",
    title: "Double",
    editable: true,
    contents: "export const double = (value: number) => value;",
  }],
  entryPoints: ["src/double.ts"],
  checks: {
    contractVersion: "double-v1",
    contracts: [{
      id: "double",
      label: "Double",
      cases: [{
        id: "positive",
        label: "Doubles four",
        invoke: { modulePath: "src/double.ts", exportName: "double", args: [4] },
        assertions: [{
          id: "result",
          label: "Returns eight",
          kind: "deep-equal",
          expected: 8,
        }],
      }],
    }],
  },
});

const session = createBrowserIdeSession(definition, {
  editor: myEditorAdapter,
  runtime: createBrowserLabIdeRuntime(),
  persistence: myPersistenceAdapter,
});
await session.initialize();
```

The framework-neutral session owns source revisions, read-only file admission,
exact contract coverage, stale-result rejection, and adapter orchestration.
The host injects the editor, runtime, and persistence; the trusted definition
injects files and checks.

Definitions returned by `defineBrowserIdeExtension` are deeply frozen. UI hosts
should construct them once and treat the definition reference as the active
session identity. `browserIdeDefinitionIdentity` exposes the logical
schema/id/contract identity; `browserIdeDefinitionFingerprint` additionally
binds persisted state to the reviewed file tree and checks so incompatible
state can be reset safely.

Persistence adapters implement monotonic compare-and-save. `save` receives the
last admitted revision/source hash, receipts are first written as immutable
content-addressed artifacts with `stageReceipt`, and `admitReceipt` may update a
current pointer only while the durable source still matches. The session
serializes all saves—including the pre-check save—and never clears dirty state
for a newer edit when an older write finishes. `load` also returns an opaque
record token; recovery passes that token to compare-and-delete `reset`, so an
invalid record cannot cause a concurrently repaired record to be deleted.

Browser IDE v1 accepts `.js`, `.jsx`, `.ts`, `.tsx`, and `.json` files. It does
not load remote extensions, npm packages, or URLs. It does not expose arbitrary
remote Python execution. Python Lab remains a separate trusted application
integration.

## Worker asset contract

The browser clients deliberately retain source-relative worker URLs:

```ts
new URL("./compiler.worker.ts", import.meta.url)
new URL("./worker/sandbox.worker.ts", import.meta.url)
```

Vite resolves and emits those workers from the package source. Do not rewrite
them to application paths or construct them at runtime. Compiler and sandbox
workers remain lazy: importing the package does not create a worker.

## Runtime dependencies

| Dependency | Why it belongs here |
| --- | --- |
| `esbuild-wasm@0.28.1` | Compiles the bounded virtual file tree in a dedicated worker. Its version is part of the compiler identity. |
| `quickjs-emscripten-core@0.32.0` | Provides the QuickJS runtime/context API used by the disposable sandbox. |
| `@jitl/quickjs-wasmfile-release-sync@0.32.0` | Supplies the matching synchronous QuickJS WASM variant. |

Browser Lab does not depend on React, CodeMirror, IndexedDB, the LMS, course
content, or artifact persistence.

## Trust boundary

1. Canonicalize and hash a `ProjectSnapshot` with `createCompileJob`.
2. Compile only files from the supplied virtual tree through the esbuild worker.
3. Express checks as host-authored `ExerciseContract` data.
4. Run compiled IIFEs in a disposable QuickJS worker with bounded resources.
5. Promote only source-bound, passing receipts with `createBuildArtifact`.

Learner code never runs through `eval` or `Function` in the application realm.
QuickJS receives no DOM, network, storage, or worker capabilities.

## Validation

From the repository root:

```sh
npm run validate --workspace @latent/browser-lab
```

The package typecheck is independent of the site. Its tests bundle the package
entry points exactly as a host would, compile a virtual project, exercise
host-owned assertions, execute a capability-isolated QuickJS function, and
guard the worker URL contract.
