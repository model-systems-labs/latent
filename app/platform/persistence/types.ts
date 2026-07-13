export const PERSISTENCE_SCHEMA_VERSION = 1 as const;
export const PORTABLE_SNAPSHOT_VERSION = 1 as const;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ProjectRecord = {
  id: string;
  schemaVersion: typeof PERSISTENCE_SCHEMA_VERSION;
  title: string;
  courseId: string;
  selectedPath: string | null;
  activeBuildId: string | null;
  draftRevision: number;
  createdAt: number;
  updatedAt: number;
  importedFrom?: string;
};

export type ProjectFileRecord = {
  id: string;
  projectId: string;
  path: string;
  track: string;
  title: string;
  content: string;
  referenceContent: string | null;
  lessonId: string | null;
  revision: number;
  sourceHash: string;
  createdAt: number;
  updatedAt: number;
};

export type FileRevisionReason = "seed" | "edit" | "restore" | "import";

export type FileRevisionRecord = {
  readonly id: string;
  readonly projectId: string;
  readonly fileId: string;
  readonly path: string;
  readonly revision: number;
  readonly sourceHash: string;
  readonly content: string;
  readonly reason: FileRevisionReason;
  readonly createdAt: number;
};

export type TestResultRecord = {
  contractId: string;
  path: string;
  label: string;
  passed: boolean;
  detail: string;
  durationMs: number;
};

export type TestRunStatus = "running" | "passed" | "failed" | "cancelled" | "error";

export type TestRunRecord = {
  id: string;
  projectId: string;
  projectRevision: number;
  sourceTreeHash: string;
  contractVersion: string;
  status: TestRunStatus;
  results: TestResultRecord[];
  startedAt: number;
  completedAt: number | null;
  runnerVersion: string;
  error: string | null;
};

export type TestReceiptRecord = {
  readonly id: string;
  readonly runId: string;
  readonly projectId: string;
  readonly projectRevision: number;
  readonly sourceTreeHash: string;
  readonly contractVersion: string;
  readonly passed: boolean;
  readonly passedCount: number;
  readonly totalCount: number;
  readonly runnerVersion: string;
  /** Exact compiler output manifest exercised by this source-bound run. */
  readonly moduleHashes?: Record<string, string>;
  readonly origin: "host" | "legacy";
  readonly createdAt: number;
};

export type BuildBindings = Record<string, { modulePath: string; exportName: string }>;

export type BuildRecord = {
  readonly id: string;
  readonly promotionKey: string;
  readonly projectId: string;
  readonly projectRevision: number;
  readonly schemaVersion: typeof PERSISTENCE_SCHEMA_VERSION;
  readonly buildNumber: number;
  readonly sourceTreeHash: string;
  readonly contractVersion: string;
  readonly fileHashes: Record<string, string>;
  readonly bundles: Record<string, string>;
  /** Absent only on builds created before bundle integrity manifests existed. */
  readonly bundleHashes?: Record<string, string>;
  readonly runtimeConfig: JsonValue;
  readonly bindings: BuildBindings;
  readonly testReceiptId: string | null;
  readonly checkpointId: string | null;
  readonly provenance: "validated" | "legacy";
  readonly createdAt: number;
};

export type CheckpointRecord = {
  readonly id: string;
  readonly projectId: string;
  readonly buildId: string | null;
  readonly kind: string;
  readonly formatVersion: number;
  readonly payload: JsonValue;
  readonly metrics: Record<string, number>;
  readonly createdAt: number;
  readonly importedFrom?: string;
};

export type LessonProgressStatus = "not-started" | "in-progress" | "completed";

export type LessonProgressRecord = {
  id: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  status: LessonProgressStatus;
  verifiedCellIds: string[];
  /** Exact cell source that earned each verification; absent on legacy records. */
  verifiedSources?: Record<string, string>;
  /** Contract suite version that evaluated verifiedCellIds; absent on legacy records. */
  verifiedContractVersion?: string;
  experimentComplete: boolean;
  hiddenBlockIds: string[];
  answers: Record<string, string>;
  lastProjectPath: string | null;
  updatedAt: number;
};

export type ConversationRecord = {
  id: string;
  backend: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type ConversationMessageStatus = "complete" | "streaming" | "cancelled" | "error";

export type ConversationMessageRecord = {
  id: string;
  conversationId: string;
  sequence: number;
  role: "system" | "user" | "assistant";
  content: string;
  status: ConversationMessageStatus;
  createdAt: number;
  metadata: Record<string, JsonValue>;
};

export type SettingRecord = {
  key: string;
  value: JsonValue;
  updatedAt: number;
};

export type MigrationStatus = "complete" | "failed";

export type MigrationRecord = {
  id: string;
  sourceKey: string;
  status: MigrationStatus;
  sourceFingerprint: string | null;
  attempts: number;
  startedAt: number;
  completedAt: number | null;
  error: string | null;
};

export type PersistenceTables = {
  projects: ProjectRecord[];
  files: ProjectFileRecord[];
  fileRevisions: FileRevisionRecord[];
  testRuns: TestRunRecord[];
  testReceipts: TestReceiptRecord[];
  builds: BuildRecord[];
  checkpoints: CheckpointRecord[];
  lessonProgress: LessonProgressRecord[];
  conversations: ConversationRecord[];
  conversationMessages: ConversationMessageRecord[];
  settings: SettingRecord[];
  migrations: MigrationRecord[];
};

export type PortablePersistenceSnapshot = {
  format: "latent-browser-lab";
  snapshotVersion: typeof PORTABLE_SNAPSHOT_VERSION;
  schemaVersion: typeof PERSISTENCE_SCHEMA_VERSION;
  exportedAt: number;
  tables: PersistenceTables;
};

export type PersistenceLimits = {
  maxSerializedCharacters: number;
  maxRecordsPerTable: number;
  maxNodes: number;
  maxDepth: number;
  maxEstimatedBytes: number;
  maxStringCharacters: number;
};

export const DEFAULT_PERSISTENCE_LIMITS: PersistenceLimits = {
  maxSerializedCharacters: 32 * 1024 * 1024,
  maxRecordsPerTable: 50_000,
  maxNodes: 1_000_000,
  maxDepth: 64,
  maxEstimatedBytes: 64 * 1024 * 1024,
  maxStringCharacters: 16 * 1024 * 1024,
};
