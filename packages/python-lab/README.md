# `@latent/python-lab`

Python Lab is the browser-only CPython boundary for Latent's saved learner
projects. It runs version-pinned Pyodide `314.0.2` in one lazy module Web Worker, syncs a
bounded virtual project into `/workspace`, and returns typed output, test
results, and declared artifacts. It has no React, LMS, curriculum, or
persistence dependency.

## Public API

```ts
import { PythonLabClient } from "@latent/python-lab";

const python = new PythonLabClient();

await python.initialize(
  { packages: ["numpy", "sortedcontainers"] },
  { onEvent: (event) => renderOutput(event) },
);

await python.sync({
  files: [{
    path: "models/character-rnn.py",
    contents: source,
  }],
});

const run = await python.run({
  entryPath: "models/character-rnn.py",
  resultVariable: "RESULT",
  artifactPaths: ["artifacts/character-rnn.json"],
}, {
  timeoutMs: 15_000,
  signal: abortController.signal,
  onEvent: (event) => renderOutput(event),
});

const tests = await python.runTests({
  tests: [{
    id: "transition-shape",
    label: "Returns one hidden value per unit",
    code: `
import runpy
module = runpy.run_path("models/character-rnn.py")
parameters = {
    "Wxh": [[1, 0], [0, 1]],
    "Whh": [[0, 0], [0, 0]],
    "bias": [0, 0],
}
assert len(module["rnn_step"]([1, 0], [0, 0], parameters)) == 2
`,
  }],
});

python.stop();  // hard-terminate active or idle Python
await python.reset({ packages: ["numpy", "sortedcontainers"] });
python.dispose();
```

`initialize`, `sync`, `run`, `runTests`, and `reset` accept the same operation
options: an `AbortSignal`, a wall timeout, and an `onEvent` callback. Output
events distinguish `stdout`, `stderr`, and initialization/execution progress.
Timeout and cancellation terminate the entire worker; timed-out Python cannot
continue invisibly. Call `reset` or `initialize` to start a fresh interpreter.

`run` executes either one saved `entryPath` or transient `code`. A script can
assign a JSON-compatible value to `RESULT` (or the requested `resultVariable`).
NumPy arrays and scalars are converted through `tolist()`/`item()`. Declared
artifacts are exact, safe project-relative paths; text is returned as UTF-8 and
binary data as base64. Missing or oversized declared artifacts fail closed.

`runTests` accepts transient host-authored assertion snippets. The snippets are
never written into the learner's project and each receives a fresh namespace
and cleared workspace-module cache. The interpreter, installed packages, and
virtual filesystem are shared until `reset` or `stop`; namespace separation is
not process isolation. Tests run with `/workspace` as the current directory, so
a hyphenated file can be loaded with `runpy.run_path(...)`.

## Worker and asset contract

The client retains a source-relative worker URL:

```ts
new URL("./worker/python.worker.ts", import.meta.url)
```

Vite therefore discovers and emits the worker without an application-owned
public path. The worker dynamically imports `pyodide.mjs` from the explicit,
matching versioned CDN directory (with the pinned npm package supplying the
authoritative API types and dependency lock):

```text
https://cdn.jsdelivr.net/pyodide/v314.0.2/full/
```

Pyodide's core WASM, standard library, lockfile, requested curated wheels, and
their declared dependencies are fetched only on `initialize`. Importing the
package or constructing a client downloads nothing. The matching version in
the npm dependency and CDN URL is an intentional release invariant.

The CDN path is immutable by release convention, but the browser import has no
subresource-integrity check. jsDelivr is therefore an explicit availability and
supply-chain dependency. A deployment that needs cryptographic asset provenance
should self-host the exact npm-locked Pyodide assets.

## Capability guardrails

Only the curated `numpy` and `sortedcontainers` package names are accepted.
Python Lab never invokes `loadPackagesFromImports`, never exposes `micropip`,
and has no arbitrary wheel or URL installation API. Package loading completes
before these reductions:

- Python's ordinary `js` import receives a frozen, null-prototype object instead
  of the worker global, withholding `fetch`, storage, sockets, workers, and the
  host message channel from the supported course runtime;
- an import guard removes and rejects `js`, `micropip`, `pyodide.*` (including
  `pyodide.code.run_js` and `pyodide.ffi`), and `pyodide_js` after curated
  packages finish loading;
- an audit hook rejects network/process operations and writes outside
  `/workspace` and `/tmp`;
- host `postMessage` is retained only in the worker module's closure;
- after CPython and curated packages load, the worker shadows its network, storage,
  worker-construction, message-channel, and public `postMessage` globals;
- host sync and artifact paths reject absolute paths, traversal, backslashes,
  unsafe segments, duplicates, oversized payloads, and symlink traversal.

This is a browser learning runtime, not an operating-system container or a
hostile-code security sandbox. Python can introspect and mutate its own process,
so these are layered guardrails rather than a proof against a determined
attacker. The meaningful boundaries are worker-realm isolation, keeping learner
code off the application thread, curated host APIs, and terminating the whole
worker on wall timeout or cancellation. `guardrailsApplied: true` and the
legacy-compatible `capabilityReduced: true` report that this setup completed;
neither field claims hostile-code containment.

Streamed output and structured results are bounded before they cross the worker
boundary, and declared artifact size is checked before its bytes are read. The
browser still provides no strict per-worker memory quota, so the runtime must
never receive credentials or application secrets and the watchdog remains the
recovery boundary for excessive computation or allocation.

## Validation

```sh
npm run validate --workspace @latent/python-lab
```

Package tests compile both browser entry points, guard the worker/CDN contract,
exercise request validation, verify event routing, and prove timeout and abort
recovery with disposable workers.
