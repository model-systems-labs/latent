import {
  DEFAULT_PERSISTENCE_LIMITS,
  PERSISTENCE_SCHEMA_VERSION,
  PORTABLE_SNAPSHOT_VERSION,
  type BuildRecord,
  type PersistenceLimits,
  type PortablePersistenceSnapshot,
  type TestReceiptRecord,
  type TestRunRecord,
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

export const BUILD_CERTIFICATION_EPOCH = "exact-manifest-v2" as const;

export function legacyPromotionKeyV1(projectId: string, sourceTreeHash: string, contractVersion: string) {
  return `${encodeURIComponent(projectId)}:${encodeURIComponent(sourceTreeHash)}:${encodeURIComponent(contractVersion)}`;
}

export function promotionKey(
  projectId: string,
  sourceTreeHash: string,
  contractVersion: string,
  checkpointId: string | null = null,
) {
  const certifiedSourceKey = `${legacyPromotionKeyV1(projectId, sourceTreeHash, contractVersion)}:${BUILD_CERTIFICATION_EPOCH}`;
  return checkpointId
    ? `${certifiedSourceKey}:checkpoint:${encodeURIComponent(checkpointId)}`
    : certifiedSourceKey;
}

declare const validatedPersistedBuildBrand: unique symbol;
export type ValidatedPersistedBuild = BuildRecord & { readonly [validatedPersistedBuildBrand]: true };

const certifiedPersistedBuilds = new WeakSet<object>();

function freezeStructuredValue<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  for (const child of Object.values(value)) freezeStructuredValue(child);
  return Object.isFrozen(value) ? value : Object.freeze(value);
}

function sortedKeys(value: Record<string, unknown>) {
  return Object.keys(value).sort((left, right) => left.localeCompare(right));
}

function exactManifestIssue(
  build: BuildRecord,
  receipt: TestReceiptRecord,
) {
  if (!isRecord(build.bundles) || !isRecord(build.bundleHashes) || !isRecord(receipt.moduleHashes)) {
    return "The build and its test receipt are missing the exact compiler module manifests.";
  }
  const bundlePaths = sortedKeys(build.bundles);
  const buildManifestPaths = sortedKeys(build.bundleHashes);
  const receiptManifestPaths = sortedKeys(receipt.moduleHashes);
  if (!bundlePaths.length) return "The build's compiler module manifest is empty.";
  if (
    bundlePaths.length !== buildManifestPaths.length
    || bundlePaths.some((path, index) => path !== buildManifestPaths[index])
    || bundlePaths.length !== receiptManifestPaths.length
    || bundlePaths.some((path, index) => path !== receiptManifestPaths[index])
  ) {
    return "The build doesn't include the exact compiler module manifest that its receipt tested.";
  }
  for (const path of bundlePaths) {
    const buildHash = build.bundleHashes[path];
    const receiptHash = receipt.moduleHashes[path];
    if (typeof buildHash !== "string" || !buildHash || buildHash !== receiptHash) {
      return `Build module ${path} doesn't match its receipt hash.`;
    }
  }
  return null;
}

/**
 * Returns the first exact-lineage problem for a persisted validated build.
 * Imported data can claim provenance, so callers must check the complete
 * host receipt and run before treating that claim as executable authority.
 */
export function validatedBuildReceiptIssue(
  build: BuildRecord,
  receipt: TestReceiptRecord | undefined,
  run: TestRunRecord | undefined,
) {
  if (build.provenance !== "validated") return "This build isn't validated, so it can't become the active host build.";
  if (typeof build.testReceiptId !== "string" || !build.testReceiptId || !receipt) {
    return "This validated build points to a missing test receipt.";
  }
  if (receipt.id !== build.testReceiptId) return "This validated build isn't tied to the exact test receipt it was given.";
  if (receipt.origin !== "host") return "A validated build needs a host-owned test receipt.";
  if (
    receipt.passed !== true
    || !Number.isSafeInteger(receipt.totalCount)
    || receipt.totalCount < 1
    || !Number.isSafeInteger(receipt.passedCount)
    || receipt.passedCount !== receipt.totalCount
  ) {
    return "A validated build needs a complete passing test receipt.";
  }
  if (receipt.projectId !== build.projectId) return "The build and its receipt point to different projects.";
  if (receipt.projectRevision !== build.projectRevision) return "The build and its receipt point to different project revisions.";
  if (receipt.sourceTreeHash !== build.sourceTreeHash) return "The build and its receipt point to different source trees.";
  if (receipt.contractVersion !== build.contractVersion) return "The build and its receipt point to different contract versions.";
  const acceptedPromotionKeys = new Set([
    promotionKey(build.projectId, build.sourceTreeHash, build.contractVersion, build.checkpointId),
    // Builds promoted before checkpoint identity joined the certification key
    // remain readable, but every new source-bound promotion uses the first key.
    promotionKey(build.projectId, build.sourceTreeHash, build.contractVersion, null),
    legacyPromotionKeyV1(build.projectId, build.sourceTreeHash, build.contractVersion),
  ]);
  if (!acceptedPromotionKeys.has(build.promotionKey)) {
    return "This validated build has an invalid promotion key.";
  }
  const manifestIssue = exactManifestIssue(build, receipt);
  if (manifestIssue) return manifestIssue;
  if (!run || receipt.runId !== run.id) return "This build receipt points to a missing host test run.";
  if (
    run.status !== "passed"
    || run.projectId !== receipt.projectId
    || run.projectRevision !== receipt.projectRevision
    || run.sourceTreeHash !== receipt.sourceTreeHash
    || run.contractVersion !== receipt.contractVersion
    || run.runnerVersion !== receipt.runnerVersion
    || !Number.isFinite(run.completedAt)
    || !Array.isArray(run.results)
    || run.results.length !== receipt.totalCount
    || run.results.some((result) => !isRecord(result) || result.passed !== true)
  ) {
    return "This build receipt doesn't match its complete passing host test run.";
  }
  return null;
}

/** Certifies one in-memory object only after exact receipt/run validation. */
export function certifyValidatedPersistedBuild(
  build: BuildRecord,
  receipt: TestReceiptRecord | undefined,
  run: TestRunRecord | undefined,
): ValidatedPersistedBuild {
  assertStructuredValueWithinLimits(build);
  if (receipt) assertStructuredValueWithinLimits(receipt);
  if (run) assertStructuredValueWithinLimits(run);
  const issue = validatedBuildReceiptIssue(build, receipt, run);
  if (issue) throw new PersistenceDataError(issue);
  const immutableBuild = freezeStructuredValue(build);
  certifiedPersistedBuilds.add(immutableBuild);
  return immutableBuild as ValidatedPersistedBuild;
}

export function isValidatedPersistedBuild(value: unknown): value is ValidatedPersistedBuild {
  return Boolean(value) && typeof value === "object" && certifiedPersistedBuilds.has(value as object);
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
    if (nodes > limits.maxNodes) throw new PersistenceDataError("This data has too many values to process safely.");
    if (item.depth > limits.maxDepth) throw new PersistenceDataError("Part of this data is nested too deeply to process safely.");

    if (typeof item.value === "string") {
      if (item.value.length > limits.maxStringCharacters) throw new PersistenceDataError("A string exceeds the saved-data size limit.");
      estimatedBytes += item.value.length * 3;
    } else if (typeof item.value === "number" || typeof item.value === "boolean" || item.value === null) {
      estimatedBytes += 16;
    } else if (typeof item.value === "object" && item.value) {
      if (visited.has(item.value)) throw new PersistenceDataError("Saved data can't contain circular references.");
      visited.add(item.value);
      const entries = Array.isArray(item.value) ? item.value.entries() : Object.entries(item.value);
      for (const [key, child] of entries) {
        if (typeof key === "string") estimatedBytes += key.length * 3;
        stack.push({ value: child, depth: item.depth + 1 });
      }
    } else if (item.value !== undefined) {
      throw new PersistenceDataError(`This saved value type isn't supported: ${typeof item.value}.`);
    }

    if (estimatedBytes > limits.maxEstimatedBytes) throw new PersistenceDataError("This data is too large for the browser storage memory limit.");
  }

  return { nodes, estimatedBytes };
}

export function parseBoundedJson(serialized: string, partial: Partial<PersistenceLimits> = {}) {
  const limits = { ...DEFAULT_PERSISTENCE_LIMITS, ...partial };
  if (serialized.length > limits.maxSerializedCharacters) throw new PersistenceDataError("This file is too large to import.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new PersistenceDataError("The imported text isn't valid JSON.");
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
    throw new PersistenceDataError("This file isn't a supported Latent Browser Lab export.");
  }
  if (typeof value.exportedAt !== "number" || !Number.isFinite(value.exportedAt) || !isRecord(value.tables)) {
    throw new PersistenceDataError("This export is missing valid metadata.");
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

  const projects = value.tables.projects as PortablePersistenceSnapshot["tables"]["projects"];
  const builds = value.tables.builds as PortablePersistenceSnapshot["tables"]["builds"];
  const receipts = value.tables.testReceipts as PortablePersistenceSnapshot["tables"]["testReceipts"];
  const runs = value.tables.testRuns as PortablePersistenceSnapshot["tables"]["testRuns"];
  const checkpoints = value.tables.checkpoints as PortablePersistenceSnapshot["tables"]["checkpoints"];
  const projectIds = new Set(projects.map((record) => record.id));
  const buildById = new Map(builds.map((record) => [record.id, record]));
  const receiptById = new Map(receipts.map((record) => [record.id, record]));
  const runById = new Map(runs.map((record) => [record.id, record]));
  const conversationIds = new Set((value.tables.conversations as Array<{ id: string }>).map((record) => record.id));
  for (const file of value.tables.files as Array<{ projectId?: unknown }>) {
    if (typeof file.projectId !== "string" || !projectIds.has(file.projectId)) throw new PersistenceDataError("An imported file points to a project that isn't here.");
  }
  for (const build of builds) {
    if (typeof build.projectId !== "string" || !projectIds.has(build.projectId)) throw new PersistenceDataError("An imported build points to a project that isn't here.");
    if (build.provenance !== "validated" && build.provenance !== "legacy") {
      throw new PersistenceDataError("An imported build has invalid provenance, so it can't be trusted.");
    }
    if (build.provenance === "validated") {
      const receipt = typeof build.testReceiptId === "string" ? receiptById.get(build.testReceiptId) : undefined;
      const run = receipt ? runById.get(receipt.runId) : undefined;
      const issue = validatedBuildReceiptIssue(build, receipt, run);
      if (issue) throw new PersistenceDataError(issue);
    }
  }
  for (const checkpoint of checkpoints) {
    if (typeof checkpoint.projectId !== "string" || !projectIds.has(checkpoint.projectId)) {
      throw new PersistenceDataError("An imported checkpoint points to a project that isn't here.");
    }
    if (checkpoint.origin !== undefined && checkpoint.origin !== "javascript" && checkpoint.origin !== "python") {
      throw new PersistenceDataError("An imported checkpoint has invalid trainer provenance, so it can't be trusted.");
    }
    const hasSourcePath = typeof checkpoint.sourcePath === "string" && Boolean(checkpoint.sourcePath);
    const hasSourceHash = typeof checkpoint.sourceHash === "string" && Boolean(checkpoint.sourceHash);
    const sourcePathMissing = checkpoint.sourcePath === undefined || checkpoint.sourcePath === null;
    const sourceHashMissing = checkpoint.sourceHash === undefined || checkpoint.sourceHash === null;
    if ((!hasSourcePath && !sourcePathMissing) || (!hasSourceHash && !sourceHashMissing) || hasSourcePath !== hasSourceHash) {
      throw new PersistenceDataError("An imported checkpoint isn't tied to a valid source file and hash.");
    }
    if (checkpoint.importedFrom !== undefined && (typeof checkpoint.importedFrom !== "string" || !checkpoint.importedFrom)) {
      throw new PersistenceDataError("An imported checkpoint has invalid import provenance, so it can't be trusted.");
    }
  }
  for (const project of projects) {
    if (project.activeBuildId === null) continue;
    if (typeof project.activeBuildId !== "string" || !project.activeBuildId) {
      throw new PersistenceDataError("An imported project has an invalid active build id.");
    }
    const activeBuild = buildById.get(project.activeBuildId);
    if (!activeBuild) throw new PersistenceDataError("An imported project points to a missing active build.");
    if (activeBuild.projectId !== project.id) throw new PersistenceDataError("An imported project points to another project's active build.");
  }
  for (const message of value.tables.conversationMessages as Array<{ conversationId?: unknown }>) {
    if (typeof message.conversationId !== "string" || !conversationIds.has(message.conversationId)) throw new PersistenceDataError("An imported message points to a conversation that isn't here.");
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
