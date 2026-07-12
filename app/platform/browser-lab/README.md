# Browser Lab core

Browser Lab is the course-agnostic trust boundary for compiling, testing, and
promoting learner projects. It contains no React, LMS, model, serving, or
persistence imports.

## Integration sequence

1. Convert the persisted virtual file tree into a `ProjectSnapshot`.
2. Call `createCompileJob`. This canonicalizes and SHA-256 hashes the exact
   source tree.
3. The esbuild adapter emits one IIFE per requested module using a unique
   `__browserLab_*` global and returns a `CompiledProgram`. Call
   `assertCompiledProgramMatchesJob` before testing.
4. Author exercise behavior as `ExerciseContract` data. Assertions are host
   operations; never accept a learner-authored assertion string.
5. Submit a `SandboxRunRequest` through `BrowserLabWorkerClient`. Each request
   receives a disposable Web Worker. QuickJS provides the capability boundary;
   worker termination provides the outer wall-clock kill switch.
6. Before promotion, call `createBuildArtifact`. It rejects stale, incomplete,
   failing, or code-hash-mismatched receipts and validates every runtime
   binding against the compiled program.
7. Persist the build artifact and active-build pointer in one IndexedDB
   transaction. The capstone reads only the active artifact, never draft files.

## Security properties

- No `eval` or `Function` runs in the application realm.
- QuickJS has no DOM, network, storage, or worker capability.
- Every invocation has memory, stack, CPU, serialization, and log bounds.
- Every worker has a host wall-clock watchdog and is terminated after one job.
- Randomness and `Date.now()` are deterministic inside learner code.
- Learner return values are observations only. A returned `{ passed: true }`
  cannot mark a test passing; only course-authored host assertions can.
- Test receipts are tied to project id, revision, SHA-256 source hash, and
  contract version. A stale receipt cannot promote a build.

## Compiler contract

For a module whose `globalName` is `__browserLab_sampling`, esbuild should use
IIFE output with that global name. The resulting code must make its module
exports available at `globalThis.__browserLab_sampling`. Imports must resolve
only from the supplied virtual file tree; leave no dynamic or external imports.
