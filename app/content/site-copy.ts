export const SITE_COPY_FIELDS = [
  { key: "hero.title", label: "Hero title", maxLength: 140, multiline: false },
  { key: "hero.body", label: "Hero body", maxLength: 1200, multiline: true },
  { key: "hero.primaryAction", label: "Primary action", maxLength: 80, multiline: false },
  { key: "hero.secondaryAction", label: "Secondary action", maxLength: 80, multiline: false },
  { key: "system.title", label: "System section title", maxLength: 140, multiline: false },
  { key: "system.body", label: "System section body", maxLength: 1200, multiline: true },
  { key: "architecture.title", label: "Architecture title", maxLength: 100, multiline: false },
  { key: "architecture.kicker", label: "Architecture kicker", maxLength: 100, multiline: false },
  { key: "architecture.description", label: "Architecture description", maxLength: 500, multiline: true },
  { key: "project.title", label: "Project section title", maxLength: 140, multiline: false },
  { key: "project.body", label: "Project section body", maxLength: 1200, multiline: true },
  { key: "closing.body", label: "Closing body", maxLength: 260, multiline: true },
  { key: "closing.action", label: "Closing action", maxLength: 100, multiline: false },
] as const;

export type SiteCopyField = (typeof SITE_COPY_FIELDS)[number];
export type SiteCopyKey = SiteCopyField["key"];
export type SiteCopyValues = Record<SiteCopyKey, string>;

export const SITE_COPY_KEYS = SITE_COPY_FIELDS.map((field) => field.key) as SiteCopyKey[];

export const SITE_COPY_FIELD_BY_KEY: Record<SiteCopyKey, SiteCopyField> =
  Object.fromEntries(SITE_COPY_FIELDS.map((field) => [field.key, field])) as Record<
    SiteCopyKey,
    SiteCopyField
  >;

export function isSiteCopyKey(value: string): value is SiteCopyKey {
  return value in SITE_COPY_FIELD_BY_KEY;
}

export function normalizeSiteCopyValue(key: SiteCopyKey, value: string) {
  const field = SITE_COPY_FIELD_BY_KEY[key];
  const withoutNulls = value.replace(/\u0000/g, "");
  const normalizedLineBreaks = withoutNulls.replace(/\r\n?/g, "\n");
  const normalized = field.multiline
    ? normalizedLineBreaks
    : normalizedLineBreaks.replace(/\s*\n+\s*/g, " ");

  if (normalized.length > field.maxLength) {
    throw new Error(`${field.label} must be ${field.maxLength} characters or fewer.`);
  }

  return normalized;
}
