# Browser IDE extension host

Trusted course source defines files and host-owned checks with
`defineBrowserIdeExtension` from `@latent/browser-lab/ide`. It does not import
the application editor, worker clients, or IndexedDB repositories.

The application composes that definition through
`BrowserIdeExtensionWorkbench`. The host injects:

- CodeMirror through `createLatentCodeMirrorIdeEditor`;
- the compiler-worker and capability-isolated QuickJS runtime through
  `createBrowserLabIdeRuntime`; and
- IndexedDB-backed state through `createLatentBrowserIdePersistence`.

The IndexedDB adapter serializes state with a monotonic revision/source-hash
compare-and-save guard. Check receipts are immutable, content-addressed
artifacts. A transaction promotes an artifact to the state record's
`currentReceiptArtifactKey` only if that exact durable source is still current;
changing either the revision or source hash clears the pointer. Staged receipt
artifacts are bounded per exercise, successful admission removes superseded
artifacts, and a successful reset removes the exercise's artifacts. Invalid or
definition-incompatible saved state is reset to the reviewed starter through
an exact record-token compare-and-delete, so recovery cannot erase a concurrent
valid repair or prevent the exercise from opening.

Browser IDE v1 accepts `.js`, `.jsx`, `.ts`, `.tsx`, and `.json` virtual files.
Relative imports stay inside the virtual project. External packages, URLs, DOM,
network, browser storage, and nested workers are unavailable to learner code.

Python is intentionally not part of this seam. The existing Pyodide integration
remains trusted application source, not arbitrary remote execution and not a
hosted plugin API.

`reviewed-question-extension.ts` is the narrow bridge for the compiled-in
method-practice library. It revalidates the whole bundled library, pins the
declared browser runtime and resource limits to the shipped Browser Lab
runtime, exports only the reviewed learner entrypoint, and puts invocation glue
in a separate read-only virtual file. `/practice/ide/unique-values` is the
bundled end-to-end route. Its results write the same Question Group progress
identity used by `/practice` and `/practice/leeches`; the IDE route does not
create a parallel content or progress type. The generic bridge is intentionally
not exposed for remote Question Group JSON; declaring a runtime in portable
data grants no execution authority.
