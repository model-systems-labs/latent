"use client";

import { liveQuery } from "dexie";
import { getPersistenceContext } from "../platform/persistence/client";
import type { JsonValue } from "../platform/persistence/types";

export const QUESTION_PROGRESS_STORAGE_PREFIX = "practice.question-progress.v1:";
export const MAX_QUESTION_SOURCE_CHARACTERS = 200_000;

const MAX_IDENTITY_CHARACTERS = 512;
const MAX_CONTRACT_VERSION_CHARACTERS = 256;
const MAX_MUTATION_ID_CHARACTERS = 256;
const MAX_LIBRARY_QUESTIONS = 2_000;

export type QuestionProgressIdentity = {
  libraryId: string;
  questionId: string;
};

export type QuestionAttemptReceipt = {
  source: string;
  contractVersion: string;
  passed: boolean;
  attemptedAt: number;
  mutationId: string;
};

export type QuestionSolvedReceipt = {
  source: string;
  contractVersion: string;
  solvedAt: number;
  mutationId: string;
};

export type QuestionProgress = QuestionProgressIdentity & {
  version: 1;
  epoch: number;
  revision: number;
  draft: string | null;
  attemptedAt: number | null;
  attemptCount: number;
  failureCount: number;
  lastAttempt: QuestionAttemptReceipt | null;
  solvedReceipt: QuestionSolvedReceipt | null;
  lastMutationId: string | null;
  updatedAt: number;
};

export type QuestionProgressStatus = "new" | "attempted" | "solved";

export type QuestionProgressMutationResult = {
  applied: boolean;
  reason: "applied" | "duplicate" | "unchanged" | "stale-epoch" | "stale-revision";
  progress: QuestionProgress;
};

export type QuestionProgressPersistenceOutcome<T> =
  | { saved: true; value: T }
  | { saved: false };

type QuestionMutationGuard = {
  expectedEpoch: number;
  expectedRevision: number;
  mutationId: string;
  updatedAt?: number;
};

export type QuestionDraftMutation = QuestionMutationGuard & {
  source: string;
};

export type QuestionAttemptMutation = QuestionDraftMutation & {
  contractVersion: string;
  passed: boolean;
};

export type QuestionResetMutation = QuestionMutationGuard;

type LibraryEpoch = {
  version: 1;
  epoch: number;
};

let writeTail: Promise<void> = Promise.resolve();

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function boundedString(value: unknown, maximum: number, allowEmpty = false): value is string {
  return typeof value === "string"
    && value.length <= maximum
    && (allowEmpty || value.trim().length > 0);
}

function assertIdentity(identity: QuestionProgressIdentity) {
  for (const [label, value] of [
    ["library", identity.libraryId],
    ["question", identity.questionId],
  ] as const) {
    if (!boundedString(value, MAX_IDENTITY_CHARACTERS) || value.includes("\u0000")) {
      throw new Error(`The ${label} id is invalid.`);
    }
  }
}

function assertSource(source: string) {
  if (!boundedString(source, MAX_QUESTION_SOURCE_CHARACTERS, true)) {
    throw new Error(`Question source may not exceed ${MAX_QUESTION_SOURCE_CHARACTERS.toLocaleString()} characters.`);
  }
}

function assertContractVersion(contractVersion: string) {
  if (!boundedString(contractVersion, MAX_CONTRACT_VERSION_CHARACTERS)) {
    throw new Error("The question contract version is invalid.");
  }
}

function assertMutationId(mutationId: string) {
  if (!boundedString(mutationId, MAX_MUTATION_ID_CHARACTERS)) {
    throw new Error("The question progress mutation id is invalid.");
  }
}

function libraryStorageRoot(libraryId: string) {
  assertIdentity({ libraryId, questionId: "key" });
  return `${QUESTION_PROGRESS_STORAGE_PREFIX}${encodeURIComponent(libraryId)}:`;
}

export function questionProgressKey(identity: QuestionProgressIdentity) {
  assertIdentity(identity);
  return `${libraryStorageRoot(identity.libraryId)}question:${encodeURIComponent(identity.questionId)}`;
}

export function questionLibraryEpochKey(libraryId: string) {
  return `${libraryStorageRoot(libraryId)}epoch`;
}

function questionLibraryPrefix(libraryId: string) {
  return `${libraryStorageRoot(libraryId)}question:`;
}

export function emptyQuestionProgress(
  identity: QuestionProgressIdentity,
  epoch = 0,
): QuestionProgress {
  assertIdentity(identity);
  if (!isNonNegativeInteger(epoch)) throw new Error("The question progress epoch is invalid.");
  return {
    version: 1,
    ...identity,
    epoch,
    revision: 0,
    draft: null,
    attemptedAt: null,
    attemptCount: 0,
    failureCount: 0,
    lastAttempt: null,
    solvedReceipt: null,
    lastMutationId: null,
    updatedAt: 0,
  };
}

function sanitizeAttemptReceipt(value: unknown): QuestionAttemptReceipt | null {
  if (!value || typeof value !== "object") return null;
  const receipt = value as Partial<QuestionAttemptReceipt>;
  return boundedString(receipt.source, MAX_QUESTION_SOURCE_CHARACTERS, true)
    && boundedString(receipt.contractVersion, MAX_CONTRACT_VERSION_CHARACTERS)
    && typeof receipt.passed === "boolean"
    && isTimestamp(receipt.attemptedAt)
    && boundedString(receipt.mutationId, MAX_MUTATION_ID_CHARACTERS)
    ? {
        source: receipt.source,
        contractVersion: receipt.contractVersion,
        passed: receipt.passed,
        attemptedAt: receipt.attemptedAt,
        mutationId: receipt.mutationId,
      }
    : null;
}

function sanitizeSolvedReceipt(value: unknown): QuestionSolvedReceipt | null {
  if (!value || typeof value !== "object") return null;
  const receipt = value as Partial<QuestionSolvedReceipt>;
  return boundedString(receipt.source, MAX_QUESTION_SOURCE_CHARACTERS, true)
    && boundedString(receipt.contractVersion, MAX_CONTRACT_VERSION_CHARACTERS)
    && isTimestamp(receipt.solvedAt)
    && boundedString(receipt.mutationId, MAX_MUTATION_ID_CHARACTERS)
    ? {
        source: receipt.source,
        contractVersion: receipt.contractVersion,
        solvedAt: receipt.solvedAt,
        mutationId: receipt.mutationId,
      }
    : null;
}

export function sanitizeQuestionProgress(
  value: unknown,
  identity: QuestionProgressIdentity,
  currentEpoch = 0,
): QuestionProgress {
  const empty = emptyQuestionProgress(identity, currentEpoch);
  if (!value || typeof value !== "object") return empty;
  const candidate = value as Partial<QuestionProgress>;
  if (
    candidate.version !== 1
    || candidate.libraryId !== identity.libraryId
    || candidate.questionId !== identity.questionId
    || !isNonNegativeInteger(candidate.epoch)
    || candidate.epoch !== currentEpoch
  ) return empty;

  const draft = candidate.draft === null
    ? null
    : boundedString(candidate.draft, MAX_QUESTION_SOURCE_CHARACTERS, true)
      ? candidate.draft
      : null;
  const attemptedAt = candidate.attemptedAt === null
    ? null
    : isTimestamp(candidate.attemptedAt)
      ? candidate.attemptedAt
      : null;
  const lastAttempt = sanitizeAttemptReceipt(candidate.lastAttempt);
  const solvedReceipt = sanitizeSolvedReceipt(candidate.solvedReceipt);
  const attemptCount = Math.max(
    isNonNegativeInteger(candidate.attemptCount) ? candidate.attemptCount : 0,
    lastAttempt ? 1 : 0,
  );
  const failureCount = Math.min(
    attemptCount,
    Math.max(
      isNonNegativeInteger(candidate.failureCount) ? candidate.failureCount : 0,
      lastAttempt?.passed === false ? 1 : 0,
    ),
  );
  return {
    version: 1,
    ...identity,
    epoch: candidate.epoch,
    revision: isNonNegativeInteger(candidate.revision) ? candidate.revision : 0,
    draft,
    attemptedAt: attemptedAt ?? lastAttempt?.attemptedAt ?? null,
    attemptCount,
    failureCount,
    lastAttempt,
    solvedReceipt,
    lastMutationId: boundedString(candidate.lastMutationId, MAX_MUTATION_ID_CHARACTERS)
      ? candidate.lastMutationId
      : null,
    updatedAt: isTimestamp(candidate.updatedAt) ? candidate.updatedAt : 0,
  };
}

export function solvedQuestionReceiptIsCurrent(
  progress: QuestionProgress,
  contractVersion: string,
  source = progress.draft,
) {
  const receipt = progress.solvedReceipt;
  return source !== null
    && receipt !== null
    && receipt.source === source
    && receipt.contractVersion === contractVersion;
}

export function questionProgressStatus(
  progress: QuestionProgress,
  contractVersion: string,
  source = progress.draft,
): QuestionProgressStatus {
  if (solvedQuestionReceiptIsCurrent(progress, contractVersion, source)) return "solved";
  return progress.attemptedAt !== null
      || progress.attemptCount > 0
      || progress.draft !== null
      || progress.lastAttempt !== null
      || progress.solvedReceipt !== null
    ? "attempted"
    : "new";
}

function guardMutation(
  progress: QuestionProgress,
  mutation: QuestionMutationGuard,
): QuestionProgressMutationResult | null {
  assertMutationId(mutation.mutationId);
  if (!isNonNegativeInteger(mutation.expectedEpoch)) throw new Error("The expected question epoch is invalid.");
  if (!isNonNegativeInteger(mutation.expectedRevision)) throw new Error("The expected question revision is invalid.");
  if (mutation.expectedEpoch !== progress.epoch) {
    return { applied: false, reason: "stale-epoch", progress };
  }
  if (mutation.expectedRevision !== progress.revision) {
    return { applied: false, reason: "stale-revision", progress };
  }
  if (progress.lastMutationId === mutation.mutationId) {
    return { applied: true, reason: "duplicate", progress };
  }
  return null;
}

function mutationTimestamp(value: number | undefined) {
  const timestamp = value ?? Date.now();
  if (!isTimestamp(timestamp)) throw new Error("The question progress timestamp is invalid.");
  return timestamp;
}

export function applyQuestionDraftMutation(
  progress: QuestionProgress,
  mutation: QuestionDraftMutation,
): QuestionProgressMutationResult {
  assertSource(mutation.source);
  const guarded = guardMutation(progress, mutation);
  if (guarded) return guarded;
  if (progress.draft === mutation.source) {
    return { applied: true, reason: "unchanged", progress };
  }
  const updatedAt = mutationTimestamp(mutation.updatedAt);
  return {
    applied: true,
    reason: "applied",
    progress: {
      ...progress,
      revision: progress.revision + 1,
      draft: mutation.source,
      attemptedAt: progress.attemptedAt ?? updatedAt,
      lastMutationId: mutation.mutationId,
      updatedAt,
    },
  };
}

export function applyQuestionAttemptMutation(
  progress: QuestionProgress,
  mutation: QuestionAttemptMutation,
): QuestionProgressMutationResult {
  assertSource(mutation.source);
  assertContractVersion(mutation.contractVersion);
  const guarded = guardMutation(progress, mutation);
  if (guarded) return guarded;
  const updatedAt = mutationTimestamp(mutation.updatedAt);
  const lastAttempt: QuestionAttemptReceipt = {
    source: mutation.source,
    contractVersion: mutation.contractVersion,
    passed: mutation.passed,
    attemptedAt: updatedAt,
    mutationId: mutation.mutationId,
  };
  const priorSolved = progress.solvedReceipt;
  const solvedReceipt = mutation.passed
    ? {
        source: mutation.source,
        contractVersion: mutation.contractVersion,
        solvedAt: updatedAt,
        mutationId: mutation.mutationId,
      }
    : priorSolved?.source === mutation.source
        && priorSolved.contractVersion === mutation.contractVersion
      ? null
      : priorSolved;
  return {
    applied: true,
    reason: "applied",
    progress: {
      ...progress,
      revision: progress.revision + 1,
      draft: mutation.source,
      attemptedAt: progress.attemptedAt ?? updatedAt,
      attemptCount: progress.attemptCount + 1,
      failureCount: progress.failureCount + (mutation.passed ? 0 : 1),
      lastAttempt,
      solvedReceipt,
      lastMutationId: mutation.mutationId,
      updatedAt,
    },
  };
}

export function applyQuestionResetMutation(
  progress: QuestionProgress,
  mutation: QuestionResetMutation,
): QuestionProgressMutationResult {
  const guarded = guardMutation(progress, mutation);
  if (guarded) return guarded;
  const updatedAt = mutationTimestamp(mutation.updatedAt);
  return {
    applied: true,
    reason: "applied",
    progress: {
      ...emptyQuestionProgress(progress, progress.epoch),
      revision: progress.revision + 1,
      lastMutationId: mutation.mutationId,
      updatedAt,
    },
  };
}

function sanitizeLibraryEpoch(value: unknown) {
  if (isNonNegativeInteger(value)) return value;
  if (!value || typeof value !== "object") return 0;
  const candidate = value as Partial<LibraryEpoch>;
  return candidate.version === 1 && isNonNegativeInteger(candidate.epoch) ? candidate.epoch : 0;
}

async function readLibraryEpoch(
  libraryId: string,
  repositories: Awaited<ReturnType<typeof getPersistenceContext>>["repositories"],
) {
  return sanitizeLibraryEpoch(
    await repositories.settings.get<JsonValue>(questionLibraryEpochKey(libraryId)),
  );
}

async function transactQuestionProgress(
  identity: QuestionProgressIdentity,
  mutate: (progress: QuestionProgress) => QuestionProgressMutationResult,
) {
  const { database, repositories } = await getPersistenceContext();
  return database.transaction("rw", database.settings, async () => {
    const epoch = await readLibraryEpoch(identity.libraryId, repositories);
    const key = questionProgressKey(identity);
    const progress = sanitizeQuestionProgress(
      await repositories.settings.get<JsonValue>(key),
      identity,
      epoch,
    );
    const result = mutate(progress);
    if (result.progress !== progress) {
      await repositories.settings.put(key, result.progress as unknown as JsonValue);
    }
    return result;
  });
}

function queueQuestionWrite<T>(write: () => Promise<T>): Promise<QuestionProgressPersistenceOutcome<T>> {
  const result = writeTail.then(write).then(
    (value) => ({ saved: true, value } as const),
    () => ({ saved: false } as const),
  );
  writeTail = result.then(() => undefined);
  return result;
}

export async function loadQuestionProgress(identity: QuestionProgressIdentity) {
  assertIdentity(identity);
  await writeTail;
  const { repositories } = await getPersistenceContext();
  const epoch = await readLibraryEpoch(identity.libraryId, repositories);
  return sanitizeQuestionProgress(
    await repositories.settings.get<JsonValue>(questionProgressKey(identity)),
    identity,
    epoch,
  );
}

export async function loadQuestionLibraryProgress(libraryId: string) {
  assertIdentity({ libraryId, questionId: "key" });
  await writeTail;
  const { database, repositories } = await getPersistenceContext();
  const epoch = await readLibraryEpoch(libraryId, repositories);
  const rows = await database.settings
    .where("key")
    .startsWith(questionLibraryPrefix(libraryId))
    .limit(MAX_LIBRARY_QUESTIONS)
    .toArray();
  return rows.flatMap((row) => {
    if (!row.value || typeof row.value !== "object") return [];
    const questionId = (row.value as Partial<QuestionProgress>).questionId;
    if (!boundedString(questionId, MAX_IDENTITY_CHARACTERS)) return [];
    const identity = { libraryId, questionId };
    const progress = sanitizeQuestionProgress(row.value, identity, epoch);
    return progress.revision > 0 || progress.draft !== null || progress.attemptCount > 0
      ? [progress]
      : [];
  });
}

export function saveQuestionDraft(
  identity: QuestionProgressIdentity,
  mutation: QuestionDraftMutation,
) {
  assertIdentity(identity);
  return queueQuestionWrite(() => transactQuestionProgress(
    identity,
    (progress) => applyQuestionDraftMutation(progress, mutation),
  ));
}

export function saveQuestionAttempt(
  identity: QuestionProgressIdentity,
  mutation: QuestionAttemptMutation,
) {
  assertIdentity(identity);
  return queueQuestionWrite(() => transactQuestionProgress(
    identity,
    (progress) => applyQuestionAttemptMutation(progress, mutation),
  ));
}

export function resetQuestionProgress(
  identity: QuestionProgressIdentity,
  mutation: QuestionResetMutation,
) {
  assertIdentity(identity);
  return queueQuestionWrite(() => transactQuestionProgress(
    identity,
    (progress) => applyQuestionResetMutation(progress, mutation),
  ));
}

export function resetQuestionLibrary(libraryId: string) {
  assertIdentity({ libraryId, questionId: "key" });
  return queueQuestionWrite(async () => {
    const { database, repositories } = await getPersistenceContext();
    return database.transaction("rw", database.settings, async () => {
      const epoch = await readLibraryEpoch(libraryId, repositories);
      if (epoch === Number.MAX_SAFE_INTEGER) throw new Error("The question library reset counter is exhausted.");
      const nextEpoch = epoch + 1;
      const questionKeys = await database.settings
        .where("key")
        .startsWith(questionLibraryPrefix(libraryId))
        .primaryKeys();
      if (questionKeys.length) await database.settings.bulkDelete(questionKeys);
      await repositories.settings.put(
        questionLibraryEpochKey(libraryId),
        { version: 1, epoch: nextEpoch } as JsonValue,
      );
      return nextEpoch;
    });
  });
}

export async function subscribeQuestionProgress(
  identity: QuestionProgressIdentity,
  listener: (progress: QuestionProgress) => void,
  onError?: () => void,
) {
  assertIdentity(identity);
  await writeTail;
  const { repositories } = await getPersistenceContext();
  const subscription = liveQuery(async () => {
    const epoch = await readLibraryEpoch(identity.libraryId, repositories);
    return sanitizeQuestionProgress(
      await repositories.settings.get<JsonValue>(questionProgressKey(identity)),
      identity,
      epoch,
    );
  }).subscribe({
    next: listener,
    error: () => onError?.(),
  });
  return () => subscription.unsubscribe();
}

export async function subscribeQuestionLibraryProgress(
  libraryId: string,
  listener: (progress: readonly QuestionProgress[]) => void,
  onError?: () => void,
) {
  assertIdentity({ libraryId, questionId: "key" });
  await writeTail;
  const { database, repositories } = await getPersistenceContext();
  const subscription = liveQuery(async () => {
    const epoch = await readLibraryEpoch(libraryId, repositories);
    const rows = await database.settings
      .where("key")
      .startsWith(questionLibraryPrefix(libraryId))
      .limit(MAX_LIBRARY_QUESTIONS)
      .toArray();
    return rows.flatMap((row) => {
      if (!row.value || typeof row.value !== "object") return [];
      const questionId = (row.value as Partial<QuestionProgress>).questionId;
      if (!boundedString(questionId, MAX_IDENTITY_CHARACTERS)) return [];
      const progress = sanitizeQuestionProgress(row.value, { libraryId, questionId }, epoch);
      return progress.revision > 0 || progress.draft !== null || progress.attemptCount > 0
        ? [progress]
        : [];
    });
  }).subscribe({
    next: listener,
    error: () => onError?.(),
  });
  return () => subscription.unsubscribe();
}

export function flushQuestionProgress() {
  return writeTail;
}
