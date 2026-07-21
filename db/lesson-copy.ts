type LessonCopyRow = {
  field: string;
  value: string;
};

const createLessonCopyTableSql = `
CREATE TABLE IF NOT EXISTS lesson_copy (
  lesson_id TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lesson_id, field)
)`;

const createLessonCopyUpdatedIndexSql = `
CREATE INDEX IF NOT EXISTS lesson_copy_updated_at_idx
ON lesson_copy (updated_at)`;

export async function ensureLessonCopySchema(database: D1Database) {
  await database.batch([
    database.prepare(createLessonCopyTableSql),
    database.prepare(createLessonCopyUpdatedIndexSql),
  ]);
}

export async function readLessonCopy(database: D1Database, lessonId: string) {
  await ensureLessonCopySchema(database);
  const result = await database
    .prepare("SELECT field, value FROM lesson_copy WHERE lesson_id = ?1")
    .bind(lessonId)
    .all<LessonCopyRow>();

  return Object.fromEntries(
    (result.results ?? [])
      .filter((row) => typeof row.field === "string" && typeof row.value === "string")
      .map((row) => [row.field, row.value]),
  ) as Record<string, string>;
}

export async function saveLessonCopy(
  database: D1Database,
  lessonId: string,
  edits: Record<string, string>,
) {
  await ensureLessonCopySchema(database);
  const updatedAt = new Date().toISOString();
  const statements = Object.entries(edits).map(([field, value]) =>
    database
      .prepare(`
INSERT INTO lesson_copy (lesson_id, field, value, updated_at)
VALUES (?1, ?2, ?3, ?4)
ON CONFLICT(lesson_id, field) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at`)
      .bind(lessonId, field, value, updatedAt),
  );

  if (statements.length) await database.batch(statements);
  return readLessonCopy(database, lessonId);
}
