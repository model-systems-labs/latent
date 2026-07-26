"use client";

import { liveQuery } from "dexie";
import { getPersistenceContext } from "@/app/platform/persistence/client";
import type { JsonValue } from "@/app/platform/persistence/types";

export const FLASHCARD_PROGRESS_KEY = "flashcards.study-state.v1";

export type FlashcardResult = "success" | "failure";

export type FlashcardResultRecord = {
  successes: number;
  failures: number;
  lastResult: FlashcardResult;
  updatedAt: number;
  mutationId: string;
};

export type FlashcardProgress = {
  version: 2;
  revision: number;
  epoch: number;
  results: Record<string, FlashcardResultRecord>;
};

export type FlashcardMarkReceipt = {
  cardId: string;
  epoch: number;
  previous: FlashcardResultRecord | null;
  written: FlashcardResultRecord;
};

export type FlashcardMarkResult = {
  applied: boolean;
  progress: FlashcardProgress;
  receipt: FlashcardMarkReceipt | null;
};

export type FlashcardUndoResult = {
  applied: boolean;
  progress: FlashcardProgress;
};

export type FlashcardClearResult = {
  applied: true;
  progress: FlashcardProgress;
};

export type FlashcardPersistenceOutcome<T> =
  | { saved: true; value: T }
  | { saved: false };

export const EMPTY_FLASHCARD_PROGRESS: FlashcardProgress = {
  version: 2,
  revision: 0,
  epoch: 0,
  results: {},
};

export function chooseNewestFlashcardProgress(
  candidate: FlashcardProgress,
  current: FlashcardProgress,
) {
  return candidate.revision < current.revision ? current : candidate;
}

export function flashcardResultRecordMatches(
  current: FlashcardResultRecord | undefined,
  expected: FlashcardResultRecord | null,
) {
  return expected ? current?.mutationId === expected.mutationId : current === undefined;
}

const MAX_TRACKED_CARDS = 1_000;
let writeTail: Promise<void> = Promise.resolve();

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function legacyMutationId(cardId: string, record: Omit<FlashcardResultRecord, "mutationId">) {
  return `legacy:${cardId}:${record.updatedAt}:${record.successes}:${record.failures}:${record.lastResult}`;
}

function sanitizeResultRecord(
  cardId: string,
  value: unknown,
  allowLegacyMutationId: boolean,
): FlashcardResultRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<FlashcardResultRecord>;
  if (!isNonNegativeInteger(record.successes)
    || !isNonNegativeInteger(record.failures)
    || (record.lastResult !== "success" && record.lastResult !== "failure")
    || typeof record.updatedAt !== "number"
    || !Number.isFinite(record.updatedAt)
    || record.updatedAt < 0) return null;

  const base = {
    successes: record.successes,
    failures: record.failures,
    lastResult: record.lastResult,
    updatedAt: record.updatedAt,
  };
  const mutationId = typeof record.mutationId === "string" && record.mutationId.trim()
    ? record.mutationId
    : allowLegacyMutationId
      ? legacyMutationId(cardId, base)
      : null;
  return mutationId ? { ...base, mutationId } : null;
}

export function sanitizeFlashcardProgress(
  value: unknown,
  validCardIds?: ReadonlySet<string>,
): FlashcardProgress {
  if (!value || typeof value !== "object") return { ...EMPTY_FLASHCARD_PROGRESS, results: {} };
  const candidate = value as {
    version?: unknown;
    revision?: unknown;
    epoch?: unknown;
    results?: unknown;
  };
  const isLegacy = candidate.version === 1;
  if ((!isLegacy && candidate.version !== 2)
    || !candidate.results
    || typeof candidate.results !== "object") {
    return { ...EMPTY_FLASHCARD_PROGRESS, results: {} };
  }

  const results: Record<string, FlashcardResultRecord> = {};
  for (const [cardId, valueRecord] of Object.entries(candidate.results)) {
    if (Object.keys(results).length >= MAX_TRACKED_CARDS) break;
    if (!cardId || (validCardIds && !validCardIds.has(cardId))) continue;
    const record = sanitizeResultRecord(cardId, valueRecord, isLegacy);
    if (record) results[cardId] = record;
  }
  return {
    version: 2,
    revision: isLegacy || !isNonNegativeInteger(candidate.revision) ? 0 : candidate.revision,
    epoch: isLegacy || !isNonNegativeInteger(candidate.epoch) ? 0 : candidate.epoch,
    results,
  };
}

export function recordFlashcardResult(
  progress: FlashcardProgress,
  cardId: string,
  result: FlashcardResult,
  updatedAt = Date.now(),
  mutationId = `local:${updatedAt}:${cardId}:${result}`,
): FlashcardProgress {
  const previous = progress.results[cardId];
  return {
    version: 2,
    revision: progress.revision + 1,
    epoch: progress.epoch,
    results: {
      ...progress.results,
      [cardId]: {
        successes: (previous?.successes ?? 0) + (result === "success" ? 1 : 0),
        failures: (previous?.failures ?? 0) + (result === "failure" ? 1 : 0),
        lastResult: result,
        updatedAt,
        mutationId,
      },
    },
  };
}

export function applyFlashcardResultMutation(
  progress: FlashcardProgress,
  input: {
    cardId: string;
    result: FlashcardResult;
    updatedAt: number;
    mutationId: string;
    expectedEpoch: number;
  },
): FlashcardMarkResult {
  if (progress.epoch !== input.expectedEpoch) {
    return { applied: false, progress, receipt: null };
  }
  const previous = progress.results[input.cardId] ? { ...progress.results[input.cardId] } : null;
  const next = recordFlashcardResult(
    progress,
    input.cardId,
    input.result,
    input.updatedAt,
    input.mutationId,
  );
  return {
    applied: true,
    progress: next,
    receipt: {
      cardId: input.cardId,
      epoch: progress.epoch,
      previous,
      written: { ...next.results[input.cardId] },
    },
  };
}

export function applyFlashcardUndoMutation(
  progress: FlashcardProgress,
  receipt: FlashcardMarkReceipt,
): FlashcardUndoResult {
  const current = progress.results[receipt.cardId];
  if (progress.epoch !== receipt.epoch
    || !current
    || current.mutationId !== receipt.written.mutationId) {
    return { applied: false, progress };
  }

  const results = { ...progress.results };
  if (receipt.previous) results[receipt.cardId] = { ...receipt.previous };
  else delete results[receipt.cardId];
  return {
    applied: true,
    progress: {
      version: 2,
      revision: progress.revision + 1,
      epoch: progress.epoch,
      results,
    },
  };
}

export function applyFlashcardClearMutation(progress: FlashcardProgress): FlashcardClearResult {
  return {
    applied: true,
    progress: {
      version: 2,
      revision: progress.revision + 1,
      epoch: progress.epoch + 1,
      results: {},
    },
  };
}

async function transactFlashcardProgress<T extends { progress: FlashcardProgress }>(
  mutate: (stored: FlashcardProgress) => T,
) {
  const { database, repositories } = await getPersistenceContext();
  return database.transaction("rw", database.settings, async () => {
    const stored = sanitizeFlashcardProgress(
      await repositories.settings.get<JsonValue>(FLASHCARD_PROGRESS_KEY),
    );
    const result = mutate(stored);
    if (result.progress !== stored) {
      await repositories.settings.put(
        FLASHCARD_PROGRESS_KEY,
        result.progress as unknown as JsonValue,
      );
    }
    return result;
  });
}

function queueProgressWrite<T>(write: () => Promise<T>): Promise<FlashcardPersistenceOutcome<T>> {
  const result = writeTail.then(write).then(
    (value) => ({ saved: true, value } as const),
    () => ({ saved: false } as const),
  );
  writeTail = result.then(() => undefined);
  return result;
}

export async function loadFlashcardProgress(validCardIds?: ReadonlySet<string>) {
  await writeTail;
  const { repositories } = await getPersistenceContext();
  const stored = await repositories.settings.get<JsonValue>(FLASHCARD_PROGRESS_KEY);
  return sanitizeFlashcardProgress(stored, validCardIds);
}

export function saveFlashcardResult(input: {
  cardId: string;
  result: FlashcardResult;
  updatedAt: number;
  mutationId: string;
  expectedEpoch: number;
}) {
  return queueProgressWrite(() => transactFlashcardProgress((stored) => (
    applyFlashcardResultMutation(stored, input)
  )));
}

export function undoFlashcardResult(receipt: FlashcardMarkReceipt) {
  return queueProgressWrite(() => transactFlashcardProgress((stored) => (
    applyFlashcardUndoMutation(stored, receipt)
  )));
}

export function clearFlashcardProgress() {
  return queueProgressWrite(() => transactFlashcardProgress(applyFlashcardClearMutation));
}

export async function subscribeFlashcardProgress(
  validCardIds: ReadonlySet<string>,
  listener: (progress: FlashcardProgress) => void,
  onError?: () => void,
) {
  await writeTail;
  const { repositories } = await getPersistenceContext();
  const subscription = liveQuery(async () => sanitizeFlashcardProgress(
    await repositories.settings.get<JsonValue>(FLASHCARD_PROGRESS_KEY),
    validCardIds,
  )).subscribe({
    next: listener,
    error: () => onError?.(),
  });
  return () => subscription.unsubscribe();
}

export function flushFlashcardProgress() {
  return writeTail;
}
