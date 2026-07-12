# Browser persistence

This package is the device-local data boundary for the Browser Lab. It uses a
versioned Dexie database and keeps UI, lesson content, the compiler, and the
learner-code sandbox outside the storage layer.

## Integration

Call `initializePersistence()` once from a client-side provider. Initialization
imports the three legacy localStorage records before the application seeds a
project. The import is transactionally paired with a deterministic migration
marker, is safe to call in multiple tabs, and deliberately never removes or
updates the old keys.

Use the typed repositories on the returned context:

- `projects` owns mutable projects, current files, and append-only revisions.
- `assessments` owns test runs and host-created immutable receipts.
- `builds.promotePassing()` is the only supported build creation path. It
  verifies the receipt, project revision, source-tree hash, and contract version
  in the same transaction that changes `activeBuildId`.
- `checkpoints`, `progress`, `conversations`, and `settings` own their respective
  records.

The capstone should read `repositories.builds.active(projectId)`, never draft
files. A failed or stale test cannot replace the active build.

## Export and import

`exportPersistenceSnapshot` reads all tables in one read transaction.
`serializePersistenceSnapshot` and `parsePortableSnapshot` enforce record,
depth, string, node, and estimated-memory limits. Import defaults to a
newer-wins merge and rejects collisions in immutable records. `mode: "replace"`
performs an atomic full restore.

Do not expose the database or repositories to the learner-code worker. The host
test runner creates receipts after evaluating typed contracts; sandbox code must
only communicate through the worker protocol.
