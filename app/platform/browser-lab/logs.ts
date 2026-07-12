import type { SandboxLogEntry, SandboxLogLevel } from "./types";

export type BoundedLogCollector = {
  append: (level: SandboxLogLevel, values: readonly unknown[]) => SandboxLogEntry | null;
  entries: () => readonly SandboxLogEntry[];
  truncated: () => boolean;
};

function printable(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? String(value) : serialized;
  } catch {
    return "[unserializable value]";
  }
}

export function createBoundedLogCollector(maxEntries: number, maxCharacters: number): BoundedLogCollector {
  const logs: SandboxLogEntry[] = [];
  let characterCount = 0;
  let didTruncate = false;
  return {
    append(level, values) {
      if (logs.length >= maxEntries || characterCount >= maxCharacters) {
        didTruncate = true;
        return null;
      }
      const available = maxCharacters - characterCount;
      const original = values.map(printable).join(" ");
      const text = original.slice(0, Math.max(0, available));
      if (text.length < original.length) didTruncate = true;
      const entry = { sequence: logs.length, level, text } satisfies SandboxLogEntry;
      logs.push(entry);
      characterCount += text.length;
      return entry;
    },
    entries: () => logs.map((entry) => ({ ...entry })),
    truncated: () => didTruncate,
  };
}
