import {
  DEFAULT_PERSISTENCE_LIMITS,
  PERSISTENCE_SCHEMA_VERSION,
  PORTABLE_SNAPSHOT_VERSION,
  type PersistenceLimits,
  type PortablePersistenceSnapshot,
} from "./types";

export class PersistenceDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersistenceDataError";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function finiteInteger(value: unknown, fallback = 0, minimum = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(minimum, Math.round(value))
    : fallback;
}

export function stableFingerprint(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function projectFileId(projectId: string, path: string) {
  return `${encodeURIComponent(projectId)}:${encodeURIComponent(path)}`;
}

export function lessonProgressId(courseId: string, lessonId: string) {
  return `${encodeURIComponent(courseId)}:${encodeURIComponent(lessonId)}`;
}

export function promotionKey(projectId: string, sourceTreeHash: string, contractVersion: string) {
  return `${encodeURIComponent(projectId)}:${encodeURIComponent(sourceTreeHash)}:${encodeURIComponent(contractVersion)}`;
}

export function assertStructuredValueWithinLimits(value: unknown, partial: Partial<PersistenceLimits> = {}) {
  const limits = { ...DEFAULT_PERSISTENCE_LIMITS, ...partial };
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  const visited = new WeakSet<object>();
  let nodes = 0;
  let estimatedBytes = 0;

  while (stack.length) {
    const item = stack.pop()!;
    nodes += 1;
    if (nodes > limits.maxNodes) throw new PersistenceDataError("The data contains too many values to process safely.");
    if (item.depth > limits.maxDepth) throw new PersistenceDataError("The data is nested too deeply to process safely.");

    if (typeof item.value === "string") {
      if (item.value.length > limits.maxStringCharacters) throw new PersistenceDataError("A string exceeds the persistence size limit.");
      estimatedBytes += item.value.length * 3;
    } else if (typeof item.value === "number" || typeof item.value === "boolean" || item.value === null) {
      estimatedBytes += 16;
    } else if (typeof item.value === "object" && item.value) {
      if (visited.has(item.value)) throw new PersistenceDataError("Persistence data must not contain circular references.");
      visited.add(item.value);
      const entries = Array.isArray(item.value) ? item.value.entries() : Object.entries(item.value);
      for (const [key, child] of entries) {
        if (typeof key === "string") estimatedBytes += key.length * 3;
        stack.push({ value: child, depth: item.depth + 1 });
      }
    } else if (item.value !== undefined) {
      throw new PersistenceDataError(`Unsupported persistence value: ${typeof item.value}.`);
    }

    if (estimatedBytes > limits.maxEstimatedBytes) throw new PersistenceDataError("The data exceeds the persistence memory budget.");
  }

  return { nodes, estimatedBytes };
}

export function parseBoundedJson(serialized: string, partial: Partial<PersistenceLimits> = {}) {
  const limits = { ...DEFAULT_PERSISTENCE_LIMITS, ...partial };
  if (serialized.length > limits.maxSerializedCharacters) throw new PersistenceDataError("The serialized data exceeds the import limit.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new PersistenceDataError("The persistence payload is not valid JSON.");
  }
  assertStructuredValueWithinLimits(parsed, limits);
  return parsed;
}

const TABLE_NAMES = [
  "projects",
  "files",
  "fileRevisions",
  "testRuns",
  "testReceipts",
  "builds",
  "checkpoints",
  "lessonProgress",
  "conversations",
  "conversationMessages",
  "settings",
  "migrations",
] as const;

export type PersistenceTableName = (typeof TABLE_NAMES)[number];
export const PERSISTENCE_TABLE_NAMES: readonly PersistenceTableName[] = TABLE_NAMES;

export function validatePortableSnapshot(value: unknown, partial: Partial<PersistenceLimits> = {}): PortablePersistenceSnapshot {
  const limits = { ...DEFAULT_PERSISTENCE_LIMITS, ...partial };
  assertStructuredValueWithinLimits(value, limits);
  if (!isRecord(value) || value.format !== "latent-browser-lab" || value.snapshotVersion !== PORTABLE_SNAPSHOT_VERSION || value.schemaVersion !== PERSISTENCE_SCHEMA_VERSION) {
    throw new PersistenceDataError("This is not a supported Latent Browser Lab export.");
  }
  if (typeof value.exportedAt !== "number" || !Number.isFinite(value.exportedAt) || !isRecord(value.tables)) {
    throw new PersistenceDataError("The export metadata is invalid.");
  }
  for (const tableName of TABLE_NAMES) {
    const records = value.tables[tableName];
    if (!Array.isArray(records)) throw new PersistenceDataError(`The ${tableName} table is missing.`);
    if (records.length > limits.maxRecordsPerTable) throw new PersistenceDataError(`The ${tableName} table exceeds the record limit.`);
    for (const record of records) {
      if (!isRecord(record)) throw new PersistenceDataError(`The ${tableName} table contains an invalid record.`);
      const key = tableName === "settings" ? record.key : record.id;
      if (typeof key !== "string" || !key) throw new PersistenceDataError(`The ${tableName} table contains a record without a key.`);
    }
  }

  const projectIds = new Set((value.tables.projects as Array<{ id: string }>).map((record) => record.id));
  const receiptIds = new Set((value.tables.testReceipts as Array<{ id: string }>).map((record) => record.id));
  const conversationIds = new Set((value.tables.conversations as Array<{ id: string }>).map((record) => record.id));
  for (const file of value.tables.files as Array<{ projectId?: unknown }>) {
    if (typeof file.projectId !== "string" || !projectIds.has(file.projectId)) throw new PersistenceDataError("An imported file references a missing project.");
  }
  for (const build of value.tables.builds as Array<{ projectId?: unknown; provenance?: unknown; testReceiptId?: unknown }>) {
    if (typeof build.projectId !== "string" || !projectIds.has(build.projectId)) throw new PersistenceDataError("An imported build references a missing project.");
    if (build.provenance === "validated" && (typeof build.testReceiptId !== "string" || !receiptIds.has(build.testReceiptId))) {
      throw new PersistenceDataError("A validated build references a missing test receipt.");
    }
  }
  for (const message of value.tables.conversationMessages as Array<{ conversationId?: unknown }>) {
    if (typeof message.conversationId !== "string" || !conversationIds.has(message.conversationId)) throw new PersistenceDataError("An imported message references a missing conversation.");
  }
  return value as unknown as PortablePersistenceSnapshot;
}

export function parsePortableSnapshot(serialized: string, partial: Partial<PersistenceLimits> = {}) {
  return validatePortableSnapshot(parseBoundedJson(serialized, partial), partial);
}

export function structurallyEqual(left: unknown, right: unknown) {
  const work: Array<[unknown, unknown]> = [[left, right]];
  const paired = new WeakMap<object, object>();
  while (work.length) {
    const [a, b] = work.pop()!;
    if (Object.is(a, b)) continue;
    if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
    const prior = paired.get(a);
    if (prior && prior !== b) return false;
    paired.set(a, b);
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length || aKeys.some((key) => !Object.prototype.hasOwnProperty.call(b, key))) return false;
    for (const key of aKeys) work.push([(a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]]);
  }
  return true;
}
