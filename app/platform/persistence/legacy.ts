import type { BrowserLabDatabase } from "./database";
import {
  finiteInteger,
  isRecord,
  lessonProgressId,
  parseBoundedJson,
  projectFileId,
  stableFingerprint,
} from "./pure";
import {
  PERSISTENCE_SCHEMA_VERSION,
  type BuildRecord,
  type ConversationMessageRecord,
  type JsonValue,
  type MigrationRecord,
  type PersistenceTables,
  type ProjectFileRecord,
  type ProjectRecord,
  type TestReceiptRecord,
  type TestResultRecord,
  type TestRunRecord,
} from "./types";

export const LEGACY_STORAGE_KEYS = ["latent-learner-v2", "latent-project-v1", "latent-capstone-v2"] as const;
export type LegacyStorageKey = (typeof LEGACY_STORAGE_KEYS)[number];
export const LEGACY_PROJECT_ID = "browser-chat";

export type LegacyStorageReader = Pick<Storage, "getItem">;

export type LegacyImportBundle = PersistenceTables;

export type LegacyImportResult = {
  key: LegacyStorageKey;
  status: "imported" | "already-imported" | "missing" | "invalid" | "unavailable";
  detail: string;
};

function emptyBundle(): LegacyImportBundle {
  return {
    projects: [],
    files: [],
    fileRevisions: [],
    testRuns: [],
    testReceipts: [],
    builds: [],
    checkpoints: [],
    lessonProgress: [],
    conversations: [],
    conversationMessages: [],
    settings: [],
    migrations: [],
  };
}

function legacyProject(timestamp: number): ProjectRecord {
  return {
    id: LEGACY_PROJECT_ID,
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    title: "Browser Chat",
    courseId: "llm-systems",
    selectedPath: null,
    activeBuildId: null,
    draftRevision: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    importedFrom: "legacy-local-storage",
  };
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringRecord(value: unknown) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function jsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}

function decodeLearner(raw: unknown, timestamp: number, fingerprint: string) {
  if (!isRecord(raw) || raw.version !== 2) throw new Error("Expected learner state version 2.");
  const bundle = emptyBundle();
  const lessons = isRecord(raw.lessons) ? raw.lessons : {};
  for (const [lessonId, value] of Object.entries(lessons)) {
    if (!isRecord(value)) continue;
    const verifiedCellIds = stringArray(value.verifiedCells);
    const experimentComplete = value.experimentComplete === true;
    const answers = stringRecord(value.answers);
    const hiddenBlockIds = stringArray(value.hiddenBlocks);
    const hasProgress = experimentComplete || verifiedCellIds.length > 0 || hiddenBlockIds.length > 0 || Object.keys(answers).length > 0;
    bundle.lessonProgress.push({
      id: lessonProgressId("llm-systems", lessonId),
      courseId: "llm-systems",
      moduleId: "legacy",
      lessonId,
      status: experimentComplete ? "completed" : hasProgress ? "in-progress" : "not-started",
      verifiedCellIds,
      experimentComplete,
      hiddenBlockIds,
      answers,
      lastProjectPath: null,
      updatedAt: typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt) ? value.updatedAt : timestamp,
    });
  }

  const artifacts = isRecord(raw.artifacts) ? raw.artifacts : {};
  const characterRnn = isRecord(artifacts.characterRnn) ? artifacts.characterRnn : null;
  if (characterRnn && isRecord(characterRnn.checkpoint)) {
    bundle.projects.push(legacyProject(timestamp));
    bundle.checkpoints.push({
      id: `legacy:character-rnn:${fingerprint}`,
      projectId: LEGACY_PROJECT_ID,
      buildId: null,
      kind: "character-rnn",
      formatVersion: finiteInteger(characterRnn.checkpoint.version, 1, 1),
      payload: jsonValue(characterRnn.checkpoint),
      metrics: {
        finalLoss: Number.isFinite(characterRnn.finalLoss) ? Number(characterRnn.finalLoss) : 0,
        parameters: Number.isFinite(characterRnn.parameters) ? Number(characterRnn.parameters) : 0,
        vocabularySize: Number.isFinite(characterRnn.vocabularySize) ? Number(characterRnn.vocabularySize) : 0,
      },
      createdAt: typeof characterRnn.trainedAt === "number" && Number.isFinite(characterRnn.trainedAt) ? characterRnn.trainedAt : timestamp,
      importedFrom: "latent-learner-v2",
    });
  }
  return bundle;
}

function decodeTestResult(value: unknown, fallbackPath: string): TestResultRecord | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.label !== "string" || typeof value.passed !== "boolean" || typeof value.detail !== "string") return null;
  return {
    contractId: value.id,
    path: typeof value.path === "string" ? value.path : fallbackPath,
    label: value.label,
    passed: value.passed,
    detail: value.detail,
    durationMs: 0,
  };
}

function sourceTreeFingerprint(files: ProjectFileRecord[]) {
  return stableFingerprint([...files].sort((left, right) => left.path.localeCompare(right.path)).map((file) => `${file.path}\0${file.content}`).join("\0"));
}

function decodeProject(raw: unknown, timestamp: number, fingerprint: string) {
  if (!isRecord(raw) || raw.version !== 1) throw new Error("Expected project state version 1.");
  const bundle = emptyBundle();
  const filesObject = isRecord(raw.files) ? raw.files : {};
  for (const [path, value] of Object.entries(filesObject)) {
    if (!isRecord(value) || typeof value.content !== "string" || typeof value.title !== "string") continue;
    const id = projectFileId(LEGACY_PROJECT_ID, path);
    const updatedAt = typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt) ? value.updatedAt : timestamp;
    const sourceHash = stableFingerprint(value.content);
    const file: ProjectFileRecord = {
      id,
      projectId: LEGACY_PROJECT_ID,
      path,
      track: typeof value.courseId === "string" ? value.courseId : "models",
      title: value.title,
      content: value.content,
      referenceContent: typeof value.referenceContent === "string" ? value.referenceContent : null,
      lessonId: typeof value.lessonId === "string" ? value.lessonId : null,
      revision: 1,
      sourceHash,
      createdAt: updatedAt,
      updatedAt,
    };
    bundle.files.push(file);
    bundle.fileRevisions.push({
      id: `${id}@1`,
      projectId: LEGACY_PROJECT_ID,
      fileId: id,
      path,
      revision: 1,
      sourceHash,
      content: value.content,
      reason: "import",
      createdAt: updatedAt,
    });
  }

  const sourceTreeHash = sourceTreeFingerprint(bundle.files);
  const tests = isRecord(raw.tests) ? raw.tests : {};
  const resultObject = isRecord(tests.results) ? tests.results : {};
  const results = Object.entries(resultObject).flatMap(([path, values]) => Array.isArray(values)
    ? values.map((value) => decodeTestResult(value, path)).filter((value): value is TestResultRecord => Boolean(value))
    : []);
  const ranAt = typeof tests.ranAt === "number" && Number.isFinite(tests.ranAt) ? tests.ranAt : timestamp;
  let receipt: TestReceiptRecord | null = null;
  if (results.length) {
    const runId = `legacy:test-run:${fingerprint}`;
    const passedCount = results.filter((result) => result.passed).length;
    const passed = passedCount === results.length;
    const run: TestRunRecord = {
      id: runId,
      projectId: LEGACY_PROJECT_ID,
      projectRevision: bundle.files.length,
      sourceTreeHash,
      contractVersion: "legacy-v1",
      status: passed ? "passed" : "failed",
      results,
      startedAt: ranAt,
      completedAt: ranAt,
      runnerVersion: "legacy-main-thread",
      error: null,
    };
    receipt = {
      id: `receipt:${runId}`,
      runId,
      projectId: LEGACY_PROJECT_ID,
      projectRevision: bundle.files.length,
      sourceTreeHash,
      contractVersion: "legacy-v1",
      passed,
      passedCount,
      totalCount: results.length,
      runnerVersion: "legacy-main-thread",
      origin: "legacy",
      createdAt: ranAt,
    };
    bundle.testRuns.push(run);
    bundle.testReceipts.push(receipt);
  }

  const runtime = isRecord(raw.runtime) ? raw.runtime : null;
  const builtAt = runtime && typeof runtime.builtAt === "number" && Number.isFinite(runtime.builtAt) ? runtime.builtAt : 0;
  let build: BuildRecord | null = null;
  if (runtime && builtAt > 0) {
    const buildNumber = finiteInteger(runtime.buildNumber, 1, 1);
    build = {
      id: `legacy:build:${fingerprint}`,
      promotionKey: `legacy:${LEGACY_PROJECT_ID}:${fingerprint}`,
      projectId: LEGACY_PROJECT_ID,
      projectRevision: bundle.files.length,
      schemaVersion: PERSISTENCE_SCHEMA_VERSION,
      buildNumber,
      sourceTreeHash,
      contractVersion: "legacy-v1",
      fileHashes: Object.fromEntries(bundle.files.map((file) => [file.path, file.sourceHash])),
      bundles: {},
      runtimeConfig: jsonValue(runtime),
      bindings: {},
      testReceiptId: receipt?.passed ? receipt.id : null,
      checkpointId: null,
      provenance: "legacy",
      createdAt: builtAt,
    };
    bundle.builds.push(build);
  }

  const project = legacyProject(timestamp);
  project.selectedPath = typeof raw.selectedPath === "string" && bundle.files.some((file) => file.path === raw.selectedPath) ? raw.selectedPath : bundle.files[0]?.path ?? null;
  project.activeBuildId = build?.id ?? null;
  project.draftRevision = bundle.files.length;
  project.updatedAt = Math.max(timestamp, ...bundle.files.map((file) => file.updatedAt));
  bundle.projects.push(project);
  if (runtime) bundle.settings.push({ key: "legacy.project.runtime", value: jsonValue(runtime), updatedAt: timestamp });
  if (isRecord(raw.output)) bundle.settings.push({ key: "legacy.project.output", value: jsonValue(raw.output), updatedAt: timestamp });
  return bundle;
}

function decodeCapstone(raw: unknown, timestamp: number) {
  if (!isRecord(raw) || raw.version !== 2) throw new Error("Expected capstone state version 2.");
  const bundle = emptyBundle();
  const backends = ["student", "local"] as const;
  const messages = Array.isArray(raw.messages) ? raw.messages : [];
  for (const backend of backends) {
    const conversationId = `legacy-capstone:${backend}`;
    const selected = messages.filter((message) => isRecord(message) && message.backend === backend);
    const imported: ConversationMessageRecord[] = [];
    for (const [sequence, value] of selected.entries()) {
      if (!isRecord(value) || (value.role !== "user" && value.role !== "assistant") || typeof value.content !== "string") continue;
      if (value.status !== "complete" && value.status !== "cancelled" && value.status !== "error") continue;
      const sourceId = typeof value.id === "string" ? value.id : String(sequence);
      const metadata: Record<string, JsonValue> = {};
      if (typeof value.attemptId === "string") metadata.attemptId = value.attemptId;
      if (typeof value.parentUserId === "string") metadata.parentUserId = value.parentUserId;
      imported.push({
        id: `${conversationId}:${encodeURIComponent(sourceId)}:${sequence}`,
        conversationId,
        sequence: imported.length,
        role: value.role,
        content: value.content,
        status: value.status,
        createdAt: timestamp + imported.length,
        metadata,
      });
    }
    bundle.conversations.push({ id: conversationId, backend, title: backend === "student" ? "Student model" : "Local model", createdAt: timestamp, updatedAt: timestamp + imported.length });
    bundle.conversationMessages.push(...imported);
  }
  const selectedBackend = raw.selectedBackend === "local" ? "local" : "student";
  bundle.settings.push({ key: "capstone.selectedBackend", value: selectedBackend, updatedAt: timestamp });
  return bundle;
}

export function decodeLegacySource(key: LegacyStorageKey, serialized: string, timestamp = Date.now()) {
  const parsed = parseBoundedJson(serialized);
  const fingerprint = stableFingerprint(serialized);
  if (key === "latent-learner-v2") return { fingerprint, bundle: decodeLearner(parsed, timestamp, fingerprint) };
  if (key === "latent-project-v1") return { fingerprint, bundle: decodeProject(parsed, timestamp, fingerprint) };
  return { fingerprint, bundle: decodeCapstone(parsed, timestamp) };
}

export function legacyMigrationId(key: LegacyStorageKey) {
  return `legacy-local-storage:${key}:to-schema-1`;
}

export function safeLegacyStorage(): LegacyStorageReader | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function applyBundle(database: BrowserLabDatabase, bundle: LegacyImportBundle) {
  if (bundle.projects.length) await database.projects.bulkPut(bundle.projects);
  if (bundle.files.length) await database.files.bulkPut(bundle.files);
  if (bundle.fileRevisions.length) await database.fileRevisions.bulkPut(bundle.fileRevisions);
  if (bundle.testRuns.length) await database.testRuns.bulkPut(bundle.testRuns);
  if (bundle.testReceipts.length) await database.testReceipts.bulkPut(bundle.testReceipts);
  if (bundle.builds.length) await database.builds.bulkPut(bundle.builds);
  if (bundle.checkpoints.length) await database.checkpoints.bulkPut(bundle.checkpoints);
  if (bundle.lessonProgress.length) await database.lessonProgress.bulkPut(bundle.lessonProgress);
  if (bundle.conversations.length) await database.conversations.bulkPut(bundle.conversations);
  if (bundle.conversationMessages.length) await database.conversationMessages.bulkPut(bundle.conversationMessages);
  if (bundle.settings.length) await database.settings.bulkPut(bundle.settings);
}

const DATA_TABLES = (database: BrowserLabDatabase) => [
  database.projects,
  database.files,
  database.fileRevisions,
  database.testRuns,
  database.testReceipts,
  database.builds,
  database.checkpoints,
  database.lessonProgress,
  database.conversations,
  database.conversationMessages,
  database.settings,
  database.migrations,
] as const;

export async function importLegacyLocalStorage(database: BrowserLabDatabase, storage: LegacyStorageReader | null = safeLegacyStorage(), timestamp = Date.now()) {
  if (!storage) return LEGACY_STORAGE_KEYS.map<LegacyImportResult>((key) => ({ key, status: "unavailable", detail: "localStorage is unavailable; no legacy data was changed." }));
  const report: LegacyImportResult[] = [];

  for (const key of LEGACY_STORAGE_KEYS) {
    const migrationId = legacyMigrationId(key);
    const prior = await database.migrations.get(migrationId);
    if (prior?.status === "complete") {
      report.push({ key, status: "already-imported", detail: "This source was imported previously; the legacy key remains available for rollback." });
      continue;
    }
    let serialized: string | null;
    try {
      serialized = storage.getItem(key);
    } catch {
      report.push({ key, status: "unavailable", detail: "The browser blocked access to this legacy key; no data was changed." });
      continue;
    }
    if (serialized === null) {
      report.push({ key, status: "missing", detail: "No legacy record exists. A later initialization may retry." });
      continue;
    }

    let decoded: ReturnType<typeof decodeLegacySource>;
    try {
      decoded = decodeLegacySource(key, serialized, timestamp);
    } catch (error) {
      const failed: MigrationRecord = {
        id: migrationId,
        sourceKey: key,
        status: "failed",
        sourceFingerprint: stableFingerprint(serialized),
        attempts: (prior?.attempts ?? 0) + 1,
        startedAt: timestamp,
        completedAt: null,
        error: error instanceof Error ? error.message : "The legacy record is invalid.",
      };
      await database.migrations.put(failed);
      report.push({ key, status: "invalid", detail: failed.error! });
      continue;
    }

    const imported = await database.transaction("rw", DATA_TABLES(database), async () => {
      const current = await database.migrations.get(migrationId);
      if (current?.status === "complete") return false;
      await applyBundle(database, decoded.bundle);
      await database.migrations.put({
        id: migrationId,
        sourceKey: key,
        status: "complete",
        sourceFingerprint: decoded.fingerprint,
        attempts: (current?.attempts ?? prior?.attempts ?? 0) + 1,
        startedAt: timestamp,
        completedAt: timestamp,
        error: null,
      });
      return true;
    });
    report.push(imported
      ? { key, status: "imported", detail: "Imported transactionally. The legacy key was intentionally preserved." }
      : { key, status: "already-imported", detail: "Another tab completed this import first; the legacy key remains available." });
  }
  return report;
}
