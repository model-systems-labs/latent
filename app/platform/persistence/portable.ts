import type { Table } from "dexie";
import type { BrowserLabDatabase } from "./database";
import { assertBundleIntegrity } from "./hash";
import {
  PERSISTENCE_TABLE_NAMES,
  PersistenceDataError,
  assertStructuredValueWithinLimits,
  parsePortableSnapshot,
  structurallyEqual,
  validatePortableSnapshot,
} from "./pure";
import {
  DEFAULT_PERSISTENCE_LIMITS,
  PERSISTENCE_SCHEMA_VERSION,
  PORTABLE_SNAPSHOT_VERSION,
  type MigrationRecord,
  type PersistenceLimits,
  type PortablePersistenceSnapshot,
} from "./types";

export type PortableImportMode = "merge" | "replace";

const tables = (database: BrowserLabDatabase) => ({
  projects: database.projects,
  files: database.files,
  fileRevisions: database.fileRevisions,
  testRuns: database.testRuns,
  testReceipts: database.testReceipts,
  builds: database.builds,
  checkpoints: database.checkpoints,
  lessonProgress: database.lessonProgress,
  conversations: database.conversations,
  conversationMessages: database.conversationMessages,
  settings: database.settings,
  migrations: database.migrations,
});

const transactionTables = (database: BrowserLabDatabase) => PERSISTENCE_TABLE_NAMES.map((name) => tables(database)[name]);

async function assertSnapshotBundleIntegrity(snapshot: PortablePersistenceSnapshot) {
  for (const build of snapshot.tables.builds) {
    await assertBundleIntegrity(build.bundles, build.bundleHashes);
  }
}

export async function exportPersistenceSnapshot(
  database: BrowserLabDatabase,
  partial: Partial<PersistenceLimits> = {},
): Promise<PortablePersistenceSnapshot> {
  const limits = { ...DEFAULT_PERSISTENCE_LIMITS, ...partial };
  const records = await database.transaction("r", transactionTables(database), async () => {
    const source = tables(database);
    const output = {} as Record<string, unknown[]>;
    for (const name of PERSISTENCE_TABLE_NAMES) {
      const count = await source[name].count();
      if (count > limits.maxRecordsPerTable) throw new PersistenceDataError(`The ${name} table exceeds the export record limit.`);
      output[name] = await source[name].toArray();
    }
    return output;
  });
  const snapshot = {
    format: "latent-browser-lab" as const,
    snapshotVersion: PORTABLE_SNAPSHOT_VERSION,
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    exportedAt: Date.now(),
    tables: records,
  } as unknown as PortablePersistenceSnapshot;
  const validated = validatePortableSnapshot(snapshot, limits);
  await assertSnapshotBundleIntegrity(validated);
  return validated;
}

export function serializePersistenceSnapshot(snapshot: PortablePersistenceSnapshot, partial: Partial<PersistenceLimits> = {}) {
  const limits = { ...DEFAULT_PERSISTENCE_LIMITS, ...partial };
  validatePortableSnapshot(snapshot, limits);
  const serialized = JSON.stringify(snapshot);
  if (serialized.length > limits.maxSerializedCharacters) throw new PersistenceDataError("The export exceeds the serialized size limit.");
  return serialized;
}

export function persistenceSnapshotBlob(snapshot: PortablePersistenceSnapshot, partial: Partial<PersistenceLimits> = {}) {
  return new Blob([serializePersistenceSnapshot(snapshot, partial)], { type: "application/json" });
}

async function assertImmutableRecords<T extends { id: string }>(table: Table<T, string>, incoming: readonly T[]) {
  if (!incoming.length) return;
  const existing = await table.bulkGet(incoming.map((record) => record.id));
  for (let index = 0; index < incoming.length; index += 1) {
    if (existing[index] && !structurallyEqual(existing[index], incoming[index])) {
      throw new PersistenceDataError(`Import conflicts with immutable record ${incoming[index].id}.`);
    }
  }
}

async function addMissingImmutable<T extends { id: string }>(table: Table<T, string>, incoming: readonly T[]) {
  if (!incoming.length) return;
  const existing = await table.bulkGet(incoming.map((record) => record.id));
  const missing = incoming.filter((_, index) => !existing[index]);
  if (missing.length) await table.bulkAdd(missing as T[]);
}

async function putNewer<T extends Record<string, unknown>, Key extends keyof T>(
  table: Table<T, string>,
  incoming: readonly T[],
  primaryKey: Key,
  timestamp: keyof T,
) {
  if (!incoming.length) return;
  const keys = incoming.map((record) => String(record[primaryKey]));
  const existing = await table.bulkGet(keys);
  const selected = incoming.filter((record, index) => {
    const current = existing[index];
    return !current || Number(record[timestamp] ?? 0) >= Number(current[timestamp] ?? 0);
  });
  if (selected.length) await table.bulkPut(selected as T[]);
}

async function mergeMigrations(database: BrowserLabDatabase, incoming: readonly MigrationRecord[]) {
  if (!incoming.length) return;
  const existing = await database.migrations.bulkGet(incoming.map((record) => record.id));
  const selected = incoming.filter((record, index) => existing[index]?.status !== "complete" || record.status === "complete");
  if (selected.length) await database.migrations.bulkPut(selected);
}

async function replaceAll(database: BrowserLabDatabase, snapshot: PortablePersistenceSnapshot) {
  const destination = tables(database);
  for (const name of [...PERSISTENCE_TABLE_NAMES].reverse()) await destination[name].clear();
  for (const name of PERSISTENCE_TABLE_NAMES) {
    const records = snapshot.tables[name] as Array<{ id?: string; key?: string }>;
    if (records.length) await (destination[name] as Table<Record<string, unknown>, string>).bulkAdd(records as Array<Record<string, unknown>>);
  }
}

async function mergeAll(database: BrowserLabDatabase, snapshot: PortablePersistenceSnapshot) {
  const source = snapshot.tables;
  await Promise.all([
    assertImmutableRecords(database.fileRevisions, source.fileRevisions),
    assertImmutableRecords(database.testReceipts, source.testReceipts),
    assertImmutableRecords(database.builds, source.builds),
    assertImmutableRecords(database.checkpoints, source.checkpoints),
  ]);
  await Promise.all([
    addMissingImmutable(database.fileRevisions, source.fileRevisions),
    addMissingImmutable(database.testReceipts, source.testReceipts),
    addMissingImmutable(database.builds, source.builds),
    addMissingImmutable(database.checkpoints, source.checkpoints),
  ]);
  await putNewer(database.projects, source.projects, "id", "updatedAt");
  await putNewer(database.files, source.files, "id", "updatedAt");
  await putNewer(database.testRuns, source.testRuns, "id", "completedAt");
  await putNewer(database.lessonProgress, source.lessonProgress, "id", "updatedAt");
  await putNewer(database.conversations, source.conversations, "id", "updatedAt");
  await putNewer(database.conversationMessages, source.conversationMessages, "id", "createdAt");
  await putNewer(database.settings, source.settings, "key", "updatedAt");
  await mergeMigrations(database, source.migrations);
}

export async function importPersistenceSnapshot(
  database: BrowserLabDatabase,
  source: PortablePersistenceSnapshot | string,
  options: { mode?: PortableImportMode; limits?: Partial<PersistenceLimits> } = {},
) {
  const snapshot = typeof source === "string" ? parsePortableSnapshot(source, options.limits) : validatePortableSnapshot(source, options.limits);
  assertStructuredValueWithinLimits(snapshot, options.limits);
  await assertSnapshotBundleIntegrity(snapshot);
  await database.transaction("rw", transactionTables(database), async () => {
    if (options.mode === "replace") await replaceAll(database, snapshot);
    else await mergeAll(database, snapshot);
  });
  return snapshot;
}
