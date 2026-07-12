import { openBrowserLabDatabase, type BrowserLabDatabase } from "./database";
import { importLegacyLocalStorage, type LegacyStorageReader } from "./legacy";
import { PersistenceRepositories } from "./repositories";

export * from "./database";
export * from "./hash";
export * from "./legacy";
export * from "./portable";
export * from "./pure";
export * from "./repositories";
export * from "./types";

export type InitializePersistenceOptions = {
  databaseName?: string;
  legacyStorage?: LegacyStorageReader | null;
  importLegacy?: boolean;
};

export type PersistenceContext = {
  database: BrowserLabDatabase;
  repositories: PersistenceRepositories;
  legacyImport: Awaited<ReturnType<typeof importLegacyLocalStorage>>;
  close(): void;
};

export async function initializePersistence(options: InitializePersistenceOptions = {}): Promise<PersistenceContext> {
  const database = await openBrowserLabDatabase(options.databaseName);
  try {
    // Legacy import intentionally runs before any application seeding. Each source is
    // committed with its migration marker in one transaction, and no old key is deleted.
    const legacyImport = options.importLegacy === false
      ? []
      : await importLegacyLocalStorage(database, options.legacyStorage);
    return {
      database,
      repositories: new PersistenceRepositories(database),
      legacyImport,
      close: () => database.close(),
    };
  } catch (error) {
    database.close();
    throw error;
  }
}
