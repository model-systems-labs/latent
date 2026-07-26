import Dexie, { type Table } from "dexie";
import type {
  BuildRecord,
  CheckpointRecord,
  ConversationMessageRecord,
  ConversationRecord,
  FileRevisionRecord,
  LessonProgressRecord,
  MigrationRecord,
  ProjectFileRecord,
  ProjectRecord,
  SettingRecord,
  TestReceiptRecord,
  TestRunRecord,
} from "@/app/platform/persistence/types";

export const DEFAULT_DATABASE_NAME = "latent-browser-lab";

export class BrowserLabDatabase extends Dexie {
  projects!: Table<ProjectRecord, string>;
  files!: Table<ProjectFileRecord, string>;
  fileRevisions!: Table<FileRevisionRecord, string>;
  testRuns!: Table<TestRunRecord, string>;
  testReceipts!: Table<TestReceiptRecord, string>;
  builds!: Table<BuildRecord, string>;
  checkpoints!: Table<CheckpointRecord, string>;
  lessonProgress!: Table<LessonProgressRecord, string>;
  conversations!: Table<ConversationRecord, string>;
  conversationMessages!: Table<ConversationMessageRecord, string>;
  settings!: Table<SettingRecord, string>;
  migrations!: Table<MigrationRecord, string>;

  constructor(name = DEFAULT_DATABASE_NAME) {
    super(name);
    this.version(1).stores({
      projects: "&id, courseId, updatedAt, activeBuildId",
      files: "&id, projectId, &[projectId+path], lessonId, updatedAt",
      fileRevisions: "&id, projectId, fileId, &[fileId+revision], sourceHash, createdAt",
      testRuns: "&id, projectId, [projectId+projectRevision], sourceTreeHash, status, startedAt",
      testReceipts: "&id, &runId, projectId, [projectId+projectRevision], sourceTreeHash, passed, createdAt",
      builds: "&id, &promotionKey, projectId, &[projectId+buildNumber], sourceTreeHash, createdAt",
      checkpoints: "&id, projectId, buildId, kind, createdAt",
      lessonProgress: "&id, courseId, moduleId, lessonId, status, updatedAt",
      conversations: "&id, backend, updatedAt",
      conversationMessages: "&id, conversationId, &[conversationId+sequence], status, createdAt",
      settings: "&key, updatedAt",
      migrations: "&id, sourceKey, status, completedAt",
    });
  }
}

export type PersistenceCapability =
  | { supported: true }
  | { supported: false; reason: "server" | "indexeddb-unavailable" | "blocked"; detail: string };

export function persistenceCapability(): PersistenceCapability {
  if (typeof window === "undefined") return { supported: false, reason: "server", detail: "Saved browser data is only available on the client." };
  if (!("indexedDB" in globalThis) || !("IDBKeyRange" in globalThis)) {
    return { supported: false, reason: "indexeddb-unavailable", detail: "This browser doesn't support IndexedDB." };
  }
  try {
    if (!globalThis.indexedDB) throw new Error("IndexedDB is turned off.");
    return { supported: true };
  } catch (error) {
    return { supported: false, reason: "blocked", detail: error instanceof Error ? error.message : "This browser is blocking access to IndexedDB." };
  }
}

export class PersistenceUnavailableError extends Error {
  constructor(capability: Exclude<PersistenceCapability, { supported: true }>) {
    super(capability.detail);
    this.name = "PersistenceUnavailableError";
  }
}

export async function openBrowserLabDatabase(name = DEFAULT_DATABASE_NAME) {
  const capability = persistenceCapability();
  if (!capability.supported) throw new PersistenceUnavailableError(capability);
  const database = new BrowserLabDatabase(name);
  try {
    await database.open();
    return database;
  } catch (error) {
    database.close();
    const detail = error instanceof Error ? error.message : "This browser couldn't open its local database.";
    throw new PersistenceUnavailableError({ supported: false, reason: "blocked", detail });
  }
}
