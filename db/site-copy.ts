import {
  isSiteCopyKey,
  normalizeSiteCopyValue,
  type SiteCopyKey,
  type SiteCopyValues,
} from "../app/content/site-copy";

type SiteCopyRow = {
  key: string;
  value: string;
  updatedAt: string;
};

const createSiteCopyTableSql = `
CREATE TABLE IF NOT EXISTS site_copy (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

const createSiteCopyUpdatedIndexSql = `
CREATE INDEX IF NOT EXISTS site_copy_updated_at_idx
ON site_copy (updated_at)`;

export async function ensureSiteCopySchema(database: D1Database) {
  await database.batch([
    database.prepare(createSiteCopyTableSql),
    database.prepare(createSiteCopyUpdatedIndexSql),
  ]);
}

export async function readSiteCopy(database: D1Database) {
  await ensureSiteCopySchema(database);
  const result = await database
    .prepare("SELECT key, value, updated_at as updatedAt FROM site_copy")
    .all<SiteCopyRow>();
  const copy: Partial<SiteCopyValues> = {};

  for (const row of result.results ?? []) {
    if (typeof row.key === "string" && isSiteCopyKey(row.key) && typeof row.value === "string") {
      copy[row.key] = row.value;
    }
  }

  return copy;
}

export async function saveSiteCopy(
  database: D1Database,
  edits: Partial<Record<SiteCopyKey, string>>,
) {
  await ensureSiteCopySchema(database);
  const updatedAt = new Date().toISOString();
  const statements = Object.entries(edits).map(([key, value]) =>
    database
      .prepare(`
INSERT INTO site_copy (key, value, updated_at)
VALUES (?1, ?2, ?3)
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at`)
      .bind(key, normalizeSiteCopyValue(key as SiteCopyKey, value), updatedAt),
  );

  if (statements.length) await database.batch(statements);
  return readSiteCopy(database);
}
