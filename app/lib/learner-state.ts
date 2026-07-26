"use client";

import { useEffect, useState } from "react";
import { assertRnnCheckpoint, type RnnCheckpoint, type RnnResult } from "@latent/model-lab/character-rnn";
import { getPersistenceContext } from "@/app/platform/persistence/client";
import { lessonProgressId } from "@/app/platform/persistence/pure";
import type { CheckpointRecord, JsonValue, PracticeRepetitionProgress } from "@/app/platform/persistence/types";
import { lessonProgressLocation, progressCourseIds } from "@/examples/learning-platform/llm-learning/content/course-progress";

export const LEARNER_STATE_KEY = "latent-learner-v2";
export const LEARNER_RECOVERY_KEY = "latent-learner-recovery-v3:";
const LEARNER_RECOVERY_SESSION_KEY = "latent-learner-recovery-session-v1";
const CHANGE_EVENT = "latent-learner-state-change";
const LEARNER_PERSISTENCE_EVENT = "latent-learner-persistence";
const LEARNER_RECOVERY_EVENT = "latent-learner-recovery-candidates";

export type LessonLocalState = {
  verifiedCells: string[];
  verifiedSources: Record<string, string>;
  verifiedContractVersion: string | null;
  experimentComplete: boolean;
  hiddenBlocks: string[];
  answers: Record<string, string>;
  practiceRepetitions: PracticeRepetitionProgress;
  knowledgeAnswers: Record<string, string>;
  knowledgeVerified: string[];
  updatedAt: number;
};

export type { PracticeRepetitionProgress } from "@/app/platform/persistence/types";

export type SavedRnnArtifact = {
  checkpoint: RnnCheckpoint;
  finalLoss: number;
  parameters: number;
  vocabularySize: number;
  trainedAt: number;
  origin: "javascript" | "python";
  /** Durable IndexedDB identity. Absent only on checkpoints saved before source binding. */
  checkpointId?: string;
  /** Exact Python project source that earned this checkpoint. */
  sourcePath?: string;
  /** Exact ProjectFileRecord.sourceHash observed by the host trainer. */
  sourceHash?: string;
};

export type CharacterRnnSourceBinding = {
  sourcePath: string;
  sourceHash: string;
};

export type LearnerState = {
  version: 2;
  lessons: Record<string, LessonLocalState>;
  artifacts: {
    characterRnn?: SavedRnnArtifact;
  };
};

export type LearnerRecoveryJournal = {
  version: 1;
  sessionId: string;
  lessons: Record<string, { value: LessonLocalState; base: LessonLocalState | null }>;
  characterRnn?: { value: SavedRnnArtifact; base: SavedRnnArtifact | null };
  updatedAt: number;
};

export type LearnerRecoveryCandidate = {
  sessionId: string;
  lessonId: string;
  value: LessonLocalState;
  updatedAt: number;
  legacy: boolean;
};

type LearnerPersistenceSnapshot = {
  state: LearnerState;
  previous: LearnerState | null;
  recoveryStored: boolean;
};

export function emptyLearnerState(): LearnerState {
  return { version: 2, lessons: {}, artifacts: {} };
}

function validCheckpoint(value: unknown): RnnCheckpoint | null {
  try {
    return assertRnnCheckpoint(value);
  } catch {
    return null;
  }
}

function sanitizeLessonLocalState(value: unknown): LessonLocalState | null {
  if (!value || typeof value !== "object") return null;
  const lesson = value as Partial<LessonLocalState>;
  return {
    verifiedCells: Array.isArray(lesson.verifiedCells) ? lesson.verifiedCells.filter((id): id is string => typeof id === "string") : [],
    verifiedSources: lesson.verifiedSources && typeof lesson.verifiedSources === "object"
      ? Object.fromEntries(Object.entries(lesson.verifiedSources).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
      : {},
    verifiedContractVersion: typeof lesson.verifiedContractVersion === "string" ? lesson.verifiedContractVersion : null,
    experimentComplete: lesson.experimentComplete === true,
    hiddenBlocks: Array.isArray(lesson.hiddenBlocks) ? lesson.hiddenBlocks.filter((id): id is string => typeof id === "string") : [],
    answers: lesson.answers && typeof lesson.answers === "object"
      ? Object.fromEntries(Object.entries(lesson.answers).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
      : {},
    practiceRepetitions: sanitizePracticeRepetitions(lesson.practiceRepetitions),
    knowledgeAnswers: lesson.knowledgeAnswers && typeof lesson.knowledgeAnswers === "object"
      ? Object.fromEntries(Object.entries(lesson.knowledgeAnswers).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
      : {},
    knowledgeVerified: Array.isArray(lesson.knowledgeVerified)
      ? lesson.knowledgeVerified.filter((id): id is string => typeof id === "string")
      : [],
    updatedAt: typeof lesson.updatedAt === "number" && Number.isFinite(lesson.updatedAt) ? lesson.updatedAt : 0,
  };
}

export function emptyPracticeRepetitions(): PracticeRepetitionProgress {
  return { answers: {}, verifiedSources: {}, verifiedContractVersion: null };
}

function sanitizePracticeRepetitions(value: unknown): PracticeRepetitionProgress {
  if (!value || typeof value !== "object") return emptyPracticeRepetitions();
  const repetitions = value as Partial<PracticeRepetitionProgress>;
  const stringEntries = (record: unknown) => record && typeof record === "object"
    ? Object.fromEntries(Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
    : {};
  return {
    answers: stringEntries(repetitions.answers),
    verifiedSources: stringEntries(repetitions.verifiedSources),
    verifiedContractVersion: typeof repetitions.verifiedContractVersion === "string"
      ? repetitions.verifiedContractVersion
      : null,
  };
}

function sanitizeSavedRnnArtifact(value: unknown): SavedRnnArtifact | null {
  if (!value || typeof value !== "object") return null;
  const artifact = value as Partial<SavedRnnArtifact>;
  const checkpoint = validCheckpoint(artifact.checkpoint);
  if (!checkpoint) return null;
  const finalLoss = Number(artifact.finalLoss);
  const parameters = Number(artifact.parameters);
  const vocabularySize = Number(artifact.vocabularySize);
  const trainedAt = Number(artifact.trainedAt);
  const checkpointId = typeof artifact.checkpointId === "string" && artifact.checkpointId.trim() && artifact.checkpointId.length <= 512
    ? artifact.checkpointId
    : undefined;
  const sourcePath = typeof artifact.sourcePath === "string" && artifact.sourcePath.trim() && artifact.sourcePath.length <= 512
    ? artifact.sourcePath
    : undefined;
  const sourceHash = typeof artifact.sourceHash === "string" && artifact.sourceHash.trim() && artifact.sourceHash.length <= 512
    ? artifact.sourceHash
    : undefined;
  if (
    !Number.isFinite(finalLoss) || finalLoss < 0
    || !Number.isSafeInteger(parameters) || parameters < 1
    || !Number.isSafeInteger(vocabularySize) || vocabularySize !== checkpoint.vocabulary.length
    || !Number.isFinite(trainedAt) || trainedAt < 0
    || Boolean(sourcePath) !== Boolean(sourceHash)
  ) return null;
  return {
    checkpoint,
    finalLoss,
    parameters,
    vocabularySize,
    trainedAt,
    origin: artifact.origin === "python" ? "python" : "javascript",
    ...(checkpointId ? { checkpointId } : {}),
    ...(sourcePath && sourceHash ? { sourcePath, sourceHash } : {}),
  };
}

/**
 * Converts only a local, host-recorded Python checkpoint trained from the
 * exact durable learner file into a runtime artifact. Portable and legacy
 * checkpoints deliberately restore progress without gaining build authority.
 */
export function sourceBoundPythonRnnArtifactFromCheckpoint(
  record: CheckpointRecord | undefined,
  expectedSourcePath: string,
  expectedSourceHash: string,
): SavedRnnArtifact | null {
  if (
    !record
    || !record.id
    || record.kind !== "character-rnn"
    || record.origin !== "python"
    || record.importedFrom !== undefined
    || record.sourcePath !== expectedSourcePath
    || record.sourceHash !== expectedSourceHash
  ) return null;
  return sanitizeSavedRnnArtifact({
    checkpoint: record.payload,
    finalLoss: record.metrics.finalLoss,
    parameters: record.metrics.parameters,
    vocabularySize: record.metrics.vocabularySize,
    trainedAt: record.createdAt,
    origin: record.origin,
    checkpointId: record.id,
    sourcePath: record.sourcePath,
    sourceHash: record.sourceHash,
  });
}

function sanitizeLearnerState(value: unknown): LearnerState {
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== 2) return emptyLearnerState();
  const candidate = value as Partial<LearnerState>;
  const lessons: Record<string, LessonLocalState> = {};
  if (candidate.lessons && typeof candidate.lessons === "object") {
    for (const [lessonId, raw] of Object.entries(candidate.lessons)) {
      const lesson = sanitizeLessonLocalState(raw);
      if (lesson) lessons[lessonId] = lesson;
    }
  }
  const characterRnn = sanitizeSavedRnnArtifact(candidate.artifacts?.characterRnn);
  return { version: 2, lessons, artifacts: characterRnn ? { characterRnn } : {} };
}

function readLegacyLearnerState(): LearnerState | null {
  if (typeof window === "undefined") return emptyLearnerState();
  try {
    const serialized = window.localStorage.getItem(LEARNER_STATE_KEY);
    return serialized ? sanitizeLearnerState(JSON.parse(serialized)) : null;
  } catch {
    return null;
  }
}

export function mergeLearnerStates(left: LearnerState, right: LearnerState): LearnerState {
  const lessons = { ...left.lessons };
  for (const [lessonId, lesson] of Object.entries(right.lessons)) {
    const current = lessons[lessonId];
    if (!current || lesson.updatedAt >= current.updatedAt) lessons[lessonId] = lesson;
  }
  const leftArtifact = left.artifacts.characterRnn;
  const rightArtifact = right.artifacts.characterRnn;
  const characterRnn = !leftArtifact
    ? rightArtifact
    : !rightArtifact || leftArtifact.trainedAt > rightArtifact.trainedAt
      ? leftArtifact
      : rightArtifact;
  return { version: 2, lessons, artifacts: characterRnn ? { characterRnn } : {} };
}

let inMemoryLearnerRecoverySessionId: string | null = null;

function learnerRecoverySessionId() {
  if (inMemoryLearnerRecoverySessionId) return inMemoryLearnerRecoverySessionId;
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.sessionStorage?.getItem(LEARNER_RECOVERY_SESSION_KEY);
    if (existing) return (inMemoryLearnerRecoverySessionId = existing);
    const created = `tab-${crypto.randomUUID()}`;
    window.sessionStorage?.setItem(LEARNER_RECOVERY_SESSION_KEY, created);
    return (inMemoryLearnerRecoverySessionId = created);
  } catch {
    return (inMemoryLearnerRecoverySessionId = `tab-${crypto.randomUUID()}`);
  }
}

export function learnerRecoveryStorageKey(sessionId = learnerRecoverySessionId()) {
  return `${LEARNER_RECOVERY_KEY}${sessionId}`;
}

function emptyRecoveryJournal(sessionId = learnerRecoverySessionId()): LearnerRecoveryJournal {
  return { version: 1, sessionId, lessons: {}, updatedAt: 0 };
}

function sanitizeRecoveryJournal(value: unknown, fallbackSessionId: string): LearnerRecoveryJournal {
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== 1) return emptyRecoveryJournal(fallbackSessionId);
  const candidate = value as Partial<LearnerRecoveryJournal>;
  const sessionId = typeof candidate.sessionId === "string" && candidate.sessionId ? candidate.sessionId : fallbackSessionId;
  const lessons: LearnerRecoveryJournal["lessons"] = {};
  if (candidate.lessons && typeof candidate.lessons === "object") {
    for (const [lessonId, raw] of Object.entries(candidate.lessons)) {
      if (!raw || typeof raw !== "object") continue;
      const entry = raw as { value?: unknown; base?: unknown };
      const recovered = sanitizeLessonLocalState(entry.value);
      const base = entry.base === null ? null : sanitizeLessonLocalState(entry.base);
      if (recovered && (entry.base === null || base)) lessons[lessonId] = { value: recovered, base };
    }
  }
  const rawArtifact = candidate.characterRnn;
  const artifactValue = sanitizeSavedRnnArtifact(rawArtifact?.value);
  const artifactBase = rawArtifact?.base === null ? null : sanitizeSavedRnnArtifact(rawArtifact?.base);
  return {
    version: 1,
    sessionId,
    lessons,
    ...(artifactValue && (rawArtifact?.base === null || artifactBase)
      ? { characterRnn: { value: artifactValue, base: artifactBase } }
      : {}),
    updatedAt: typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt) ? candidate.updatedAt : 0,
  };
}

function readRecoveryJournalKey(key: string) {
  const fallbackSessionId = key.startsWith(LEARNER_RECOVERY_KEY) ? key.slice(LEARNER_RECOVERY_KEY.length) : "legacy";
  if (typeof window === "undefined") return emptyRecoveryJournal(fallbackSessionId);
  try {
    const serialized = window.localStorage.getItem(key);
    return serialized ? sanitizeRecoveryJournal(JSON.parse(serialized), fallbackSessionId) : emptyRecoveryJournal(fallbackSessionId);
  } catch {
    return emptyRecoveryJournal(fallbackSessionId);
  }
}

function journalIsEmpty(journal: LearnerRecoveryJournal) {
  return !Object.keys(journal.lessons).length && !journal.characterRnn;
}

function writeRecoveryJournal(key: string, journal: LearnerRecoveryJournal) {
  if (typeof window === "undefined") return false;
  try {
    if (journalIsEmpty(journal)) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(journal));
    return true;
  } catch {
    return false;
  }
}

function legacyRecoveryJournal(legacy: LearnerState): LearnerRecoveryJournal {
  return {
    version: 1,
    sessionId: learnerRecoverySessionId(),
    lessons: Object.fromEntries(Object.entries(legacy.lessons).map(([lessonId, value]) => [lessonId, { value, base: null }])),
    ...(legacy.artifacts.characterRnn ? { characterRnn: { value: legacy.artifacts.characterRnn, base: null } } : {}),
    updatedAt: Math.max(0, ...Object.values(legacy.lessons).map((lesson) => lesson.updatedAt), legacy.artifacts.characterRnn?.trainedAt ?? 0),
  };
}

function readCurrentRecoveryJournal() {
  const key = learnerRecoveryStorageKey();
  const current = readRecoveryJournalKey(key);
  if (!journalIsEmpty(current) || typeof window === "undefined") return current;
  const legacy = readLegacyLearnerState();
  if (!legacy) return current;
  const migrated = legacyRecoveryJournal(legacy);
  if (writeRecoveryJournal(key, migrated)) {
    try {
      window.localStorage.removeItem(LEARNER_STATE_KEY);
    } catch {
      // Keep the legacy source when removing it is unavailable.
    }
  }
  return migrated;
}

let cachedLearner: LearnerState | null = null;
let learnerHydration: Promise<void> | null = null;
let learnerPersistenceQueue: Promise<void> = Promise.resolve();
let pendingLearnerPersistence: LearnerPersistenceSnapshot | null = null;
let learnerPersistenceTimer: ReturnType<typeof setTimeout> | null = null;
let learnerPersistenceError: string | null = null;

export function loadLearnerState(): LearnerState {
  return cachedLearner ?? emptyLearnerState();
}

function sameLearnerValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function lessonProgressRecord(lessonId: string, lesson: LessonLocalState) {
  const location = lessonProgressLocation(lessonId);
  const hasPracticeRepetitions = Object.keys(lesson.practiceRepetitions.answers).length > 0
    || Object.keys(lesson.practiceRepetitions.verifiedSources).length > 0;
  return {
    id: lessonProgressId(location.courseId, lessonId),
    courseId: location.courseId,
    moduleId: location.moduleId,
    lessonId,
    status: lesson.experimentComplete && lesson.verifiedCells.length ? "completed" as const : "in-progress" as const,
    verifiedCellIds: lesson.verifiedCells,
    verifiedSources: lesson.verifiedSources,
    verifiedContractVersion: lesson.verifiedContractVersion ?? undefined,
    experimentComplete: lesson.experimentComplete,
    hiddenBlockIds: lesson.hiddenBlocks,
    answers: lesson.answers,
    ...(hasPracticeRepetitions ? { practiceRepetitions: lesson.practiceRepetitions } : {}),
    knowledgeAnswers: lesson.knowledgeAnswers,
    knowledgeVerifiedIds: lesson.knowledgeVerified,
    lastProjectPath: null,
    updatedAt: lesson.updatedAt,
  };
}

function lessonStateFromProgress(record: {
  verifiedCellIds: string[];
  verifiedSources?: Record<string, string>;
  verifiedContractVersion?: string;
  experimentComplete: boolean;
  hiddenBlockIds: string[];
  answers: Record<string, string>;
  practiceRepetitions?: PracticeRepetitionProgress;
  knowledgeAnswers?: Record<string, string>;
  knowledgeVerifiedIds?: string[];
  updatedAt: number;
}): LessonLocalState {
  return {
    verifiedCells: record.verifiedCellIds,
    verifiedSources: record.verifiedSources ?? {},
    verifiedContractVersion: record.verifiedContractVersion ?? null,
    experimentComplete: record.experimentComplete,
    hiddenBlocks: record.hiddenBlockIds,
    answers: record.answers,
    practiceRepetitions: sanitizePracticeRepetitions(record.practiceRepetitions),
    knowledgeAnswers: record.knowledgeAnswers ?? {},
    knowledgeVerified: record.knowledgeVerifiedIds ?? [],
    updatedAt: record.updatedAt,
  };
}

export function reconcileLearnerRecoveryJournal(
  persistedState: LearnerState,
  rawJournal: LearnerRecoveryJournal,
) {
  const journal = sanitizeRecoveryJournal(rawJournal, rawJournal.sessionId || "recovery");
  const state: LearnerState = {
    version: 2,
    lessons: { ...persistedState.lessons },
    artifacts: { ...persistedState.artifacts },
  };
  const safe = emptyRecoveryJournal(journal.sessionId);
  const unsafe = emptyRecoveryJournal(journal.sessionId);
  for (const [lessonId, entry] of Object.entries(journal.lessons)) {
    const durable = persistedState.lessons[lessonId] ?? null;
    if (sameLearnerValue(entry.value, durable)) continue;
    if (
      sameLearnerValue(entry.base, durable)
      && entry.value.updatedAt >= (durable?.updatedAt ?? 0)
    ) {
      state.lessons[lessonId] = entry.value;
      safe.lessons[lessonId] = entry;
    } else {
      unsafe.lessons[lessonId] = entry;
    }
  }
  const durableArtifact = persistedState.artifacts.characterRnn ?? null;
  if (journal.characterRnn && !sameLearnerValue(journal.characterRnn.value, durableArtifact)) {
    if (
      sameLearnerValue(journal.characterRnn.base, durableArtifact)
      && journal.characterRnn.value.trainedAt >= (durableArtifact?.trainedAt ?? 0)
    ) {
      state.artifacts.characterRnn = journal.characterRnn.value;
      safe.characterRnn = journal.characterRnn;
    } else {
      unsafe.characterRnn = journal.characterRnn;
    }
  }
  safe.updatedAt = journal.updatedAt;
  unsafe.updatedAt = journal.updatedAt;
  return { state, safe, unsafe };
}

function combinedRecoveryJournal(
  left: LearnerRecoveryJournal,
  right: LearnerRecoveryJournal,
): LearnerRecoveryJournal {
  return {
    version: 1,
    sessionId: left.sessionId,
    lessons: { ...left.lessons, ...right.lessons },
    ...(right.characterRnn || left.characterRnn ? { characterRnn: right.characterRnn ?? left.characterRnn } : {}),
    updatedAt: Math.max(left.updatedAt, right.updatedAt),
  };
}

function archiveRecoveryJournal(journal: LearnerRecoveryJournal) {
  if (journalIsEmpty(journal)) return true;
  const sessionId = `candidate-${crypto.randomUUID()}`;
  return writeRecoveryJournal(learnerRecoveryStorageKey(sessionId), { ...journal, sessionId });
}

function learnerRecoveryKeys() {
  if (typeof window === "undefined") return [];
  const keys = new Set<string>();
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(LEARNER_RECOVERY_KEY)) keys.add(key);
    }
  } catch {
    // Some private/test storage implementations do not expose key iteration.
  }
  keys.add(learnerRecoveryStorageKey());
  return [...keys];
}

function storeLearnerRecovery(state: LearnerState, previous: LearnerState) {
  if (typeof window === "undefined") return false;
  const key = learnerRecoveryStorageKey();
  const journal = readCurrentRecoveryJournal();
  const changedLessonIds = new Set([...Object.keys(previous.lessons), ...Object.keys(state.lessons)]);
  for (const lessonId of changedLessonIds) {
    const before = previous.lessons[lessonId] ?? null;
    const next = state.lessons[lessonId] ?? null;
    if (sameLearnerValue(before, next) || !next) continue;
    const existing = journal.lessons[lessonId];
    if (existing && !sameLearnerValue(existing.value, before)) {
      const displaced = { ...emptyRecoveryJournal(journal.sessionId), lessons: { [lessonId]: existing }, updatedAt: journal.updatedAt };
      if (!archiveRecoveryJournal(displaced)) return false;
      delete journal.lessons[lessonId];
    }
    const base = journal.lessons[lessonId]?.base ?? before;
    if (sameLearnerValue(base, next)) delete journal.lessons[lessonId];
    else journal.lessons[lessonId] = { value: next, base };
  }
  const beforeArtifact = previous.artifacts.characterRnn ?? null;
  const nextArtifact = state.artifacts.characterRnn ?? null;
  if (!sameLearnerValue(beforeArtifact, nextArtifact) && nextArtifact) {
    if (journal.characterRnn && !sameLearnerValue(journal.characterRnn.value, beforeArtifact)) {
      const displaced = { ...emptyRecoveryJournal(journal.sessionId), characterRnn: journal.characterRnn, updatedAt: journal.updatedAt };
      if (!archiveRecoveryJournal(displaced)) return false;
      delete journal.characterRnn;
    }
    const base = journal.characterRnn?.base ?? beforeArtifact;
    if (sameLearnerValue(base, nextArtifact)) delete journal.characterRnn;
    else journal.characterRnn = { value: nextArtifact, base };
  }
  journal.updatedAt = Date.now();
  const stored = writeRecoveryJournal(key, journal);
  window.dispatchEvent(new CustomEvent(LEARNER_RECOVERY_EVENT));
  return stored;
}

function clearPersistedLearnerRecovery(state: LearnerState) {
  if (typeof window === "undefined") return;
  const key = learnerRecoveryStorageKey();
  const journal = readRecoveryJournalKey(key);
  for (const [lessonId, entry] of Object.entries(journal.lessons)) {
    if (sameLearnerValue(state.lessons[lessonId] ?? null, entry.value)) delete journal.lessons[lessonId];
  }
  if (journal.characterRnn && sameLearnerValue(state.artifacts.characterRnn ?? null, journal.characterRnn.value)) {
    delete journal.characterRnn;
  }
  writeRecoveryJournal(key, journal);
  window.dispatchEvent(new CustomEvent(LEARNER_RECOVERY_EVENT));
}

export function listLearnerRecoveryCandidates(lessonId?: string): LearnerRecoveryCandidate[] {
  if (typeof window === "undefined") return [];
  const currentState = cachedLearner;
  const candidates = learnerRecoveryKeys().flatMap((key) => {
    const journal = readRecoveryJournalKey(key);
    return Object.entries(journal.lessons).flatMap(([candidateLessonId, entry]) => {
      if (lessonId && lessonId !== candidateLessonId) return [];
      if (sameLearnerValue(currentState?.lessons[candidateLessonId] ?? null, entry.value)) return [];
      return [{
        sessionId: journal.sessionId,
        lessonId: candidateLessonId,
        value: entry.value,
        updatedAt: entry.value.updatedAt,
        legacy: false,
      }];
    });
  });
  const legacy = readLegacyLearnerState();
  if (legacy) {
    for (const [candidateLessonId, value] of Object.entries(legacy.lessons)) {
      if ((!lessonId || lessonId === candidateLessonId) && !sameLearnerValue(currentState?.lessons[candidateLessonId] ?? null, value)) {
        candidates.push({ sessionId: "legacy", lessonId: candidateLessonId, value, updatedAt: value.updatedAt, legacy: true });
      }
    }
  }
  return candidates.sort((left, right) => right.updatedAt - left.updatedAt);
}

export function discardLearnerRecoveryCandidate(sessionId: string, lessonId: string) {
  if (typeof window === "undefined") return;
  if (sessionId === "legacy") {
    const legacy = readLegacyLearnerState();
    if (legacy) {
      delete legacy.lessons[lessonId];
      try {
        if (Object.keys(legacy.lessons).length || legacy.artifacts.characterRnn) {
          window.localStorage.setItem(LEARNER_STATE_KEY, JSON.stringify(legacy));
        } else {
          window.localStorage.removeItem(LEARNER_STATE_KEY);
        }
      } catch {
        // Retain the visible candidate when storage cannot be changed.
      }
    }
  } else {
    const key = learnerRecoveryStorageKey(sessionId);
    const journal = readRecoveryJournalKey(key);
    delete journal.lessons[lessonId];
    writeRecoveryJournal(key, journal);
  }
  window.dispatchEvent(new CustomEvent(LEARNER_RECOVERY_EVENT));
}

export async function loadLearnerRecoveryCandidate(sessionId: string, lessonId: string) {
  if (typeof window === "undefined") return false;
  const sourceKey = sessionId === "legacy" ? LEARNER_STATE_KEY : learnerRecoveryStorageKey(sessionId);
  const entry = sessionId === "legacy"
    ? readLegacyLearnerState()?.lessons[lessonId]
    : readRecoveryJournalKey(sourceKey).lessons[lessonId]?.value;
  if (!entry) return false;
  const { repositories } = await getPersistenceContext();
  const location = lessonProgressLocation(lessonId);
  const durableRecord = await repositories.progress.get(lessonProgressId(location.courseId, lessonId));
  const durableLesson = durableRecord ? lessonStateFromProgress(durableRecord) : null;
  const current = loadLearnerState();
  const previousLessons = { ...current.lessons };
  if (durableLesson) previousLessons[lessonId] = durableLesson;
  else delete previousLessons[lessonId];
  const previous: LearnerState = { ...current, lessons: previousLessons };
  const next: LearnerState = { ...previous, lessons: { ...previous.lessons, [lessonId]: entry } };

  const currentKey = learnerRecoveryStorageKey();
  const currentJournal = readRecoveryJournalKey(currentKey);
  currentJournal.lessons[lessonId] = { value: entry, base: durableLesson };
  currentJournal.updatedAt = Date.now();
  if (!writeRecoveryJournal(currentKey, currentJournal)) return false;
  if (sourceKey !== currentKey) discardLearnerRecoveryCandidate(sessionId, lessonId);
  cachedLearner = next;
  scheduleLearnerPersistence(next, previous, true);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  window.dispatchEvent(new CustomEvent(LEARNER_RECOVERY_EVENT));
  return true;
}

function setLearnerPersistenceError(error: string | null) {
  learnerPersistenceError = error;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(LEARNER_PERSISTENCE_EVENT));
}

export function getLearnerPersistenceError() {
  return learnerPersistenceError;
}

async function persistLearnerState(state: LearnerState, previous: LearnerState | null) {
  const { database, repositories } = await getPersistenceContext();
  const changedLessonIds = Object.keys(state.lessons).filter((lessonId) => (
    !previous?.lessons[lessonId] || !sameLearnerValue(previous.lessons[lessonId], state.lessons[lessonId])
  ));
  const artifact = state.artifacts.characterRnn;
  const previousArtifact = previous?.artifacts.characterRnn;
  const browserChatChanged = changedLessonIds.some((lessonId) => lessonProgressLocation(lessonId).courseId === "llm-systems")
    || Boolean(artifact && (
      artifact.trainedAt !== previousArtifact?.trainedAt
      || artifact.checkpointId !== previousArtifact?.checkpointId
      || artifact.sourceHash !== previousArtifact?.sourceHash
    ));
  if (browserChatChanged && !(await repositories.projects.get("browser-chat"))) {
    try {
      await repositories.projects.create({ id: "browser-chat", title: "Browser Chat", courseId: "llm-systems" });
    } catch (error) {
      if (!(await repositories.projects.get("browser-chat"))) throw error;
    }
  }
  for (const lessonId of changedLessonIds) {
    const lesson = state.lessons[lessonId];
    const before = previous?.lessons[lessonId];
    await repositories.progress.compareAndPut(
      lessonProgressRecord(lessonId, lesson),
      before ? lessonProgressRecord(lessonId, before) : null,
    );
  }
  if (artifact && (
    artifact.trainedAt !== previousArtifact?.trainedAt
    || artifact.checkpointId !== previousArtifact?.checkpointId
    || artifact.sourceHash !== previousArtifact?.sourceHash
  )) {
    const id = artifact.checkpointId ?? `character-rnn:${artifact.trainedAt}`;
    if (!(await database.checkpoints.get(id))) {
      await repositories.checkpoints.add({
        id,
        projectId: "browser-chat",
        buildId: null,
        kind: "character-rnn",
        formatVersion: 1,
        payload: artifact.checkpoint as unknown as JsonValue,
        origin: artifact.origin,
        sourcePath: artifact.sourcePath ?? null,
        sourceHash: artifact.sourceHash ?? null,
        metrics: {
          finalLoss: artifact.finalLoss,
          parameters: artifact.parameters,
          vocabularySize: artifact.vocabularySize,
          pythonOrigin: artifact.origin === "python" ? 1 : 0,
        },
        createdAt: artifact.trainedAt,
      });
    }
  }
}

function enqueuePendingLearnerPersistence() {
  if (learnerPersistenceTimer) clearTimeout(learnerPersistenceTimer);
  learnerPersistenceTimer = null;
  const pending = pendingLearnerPersistence;
  pendingLearnerPersistence = null;
  if (!pending) return;
  learnerPersistenceQueue = learnerPersistenceQueue
    .then(async () => {
      await persistLearnerState(pending.state, pending.previous);
      clearPersistedLearnerRecovery(pending.state);
      setLearnerPersistenceError(null);
    })
    .catch((error) => {
      setLearnerPersistenceError(pending.recoveryStored
        ? `We couldn't sync your history, but a recovery copy is still saved in this browser. ${error instanceof Error ? error.message : "Reload before you edit in another tab."}`
        : "This browser couldn't save your lesson progress. Copy your code before you leave this page.");
      console.error("Learner progress persistence failed", error);
    });
}

function scheduleLearnerPersistence(state: LearnerState, previous: LearnerState | null, recoveryStored: boolean) {
  if (pendingLearnerPersistence) {
    pendingLearnerPersistence.state = state;
    pendingLearnerPersistence.recoveryStored = pendingLearnerPersistence.recoveryStored || recoveryStored;
  } else {
    pendingLearnerPersistence = { state, previous, recoveryStored };
  }
  if (learnerPersistenceTimer) clearTimeout(learnerPersistenceTimer);
  learnerPersistenceTimer = setTimeout(enqueuePendingLearnerPersistence, 220);
}

function storeLearnerState(state: LearnerState) {
  const previous = loadLearnerState();
  cachedLearner = sanitizeLearnerState(state);
  const recoveryStored = storeLearnerRecovery(cachedLearner, previous);
  if (!recoveryStored) setLearnerPersistenceError("This browser can't save a recovery copy. Keep this tab open until your history finishes syncing.");
  scheduleLearnerPersistence(cachedLearner, previous, recoveryStored);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function initializeLearnerPersistence() {
  if (typeof window === "undefined") return Promise.resolve();
  learnerHydration ??= (async () => {
    const { database, repositories } = await getPersistenceContext();
    const [progressByCourse, checkpointRecords] = await Promise.all([
      Promise.all(progressCourseIds.map((courseId) => repositories.progress.forCourse(courseId))),
      database.checkpoints.where("projectId").equals("browser-chat").filter((record) => record.kind === "character-rnn").sortBy("createdAt"),
    ]);
    const progress = progressByCourse.flat();
    const persistedLessons: Record<string, LessonLocalState> = {};
    for (const record of progress) {
      persistedLessons[record.lessonId] = lessonStateFromProgress(record);
    }
    const checkpoint = checkpointRecords.at(-1);
    const restoredCheckpoint = checkpoint ? validCheckpoint(checkpoint.payload) : null;
    const restored = checkpoint && restoredCheckpoint
      ? {
            checkpoint: restoredCheckpoint,
            finalLoss: checkpoint.metrics.finalLoss ?? 0,
            parameters: checkpoint.metrics.parameters ?? 0,
            vocabularySize: checkpoint.metrics.vocabularySize ?? 0,
            trainedAt: checkpoint.createdAt,
            origin: checkpoint.origin === "python" || checkpoint.metrics.pythonOrigin === 1 ? "python" as const : "javascript" as const,
            checkpointId: checkpoint.id,
            ...(typeof checkpoint.sourcePath === "string" && typeof checkpoint.sourceHash === "string"
              ? { sourcePath: checkpoint.sourcePath, sourceHash: checkpoint.sourceHash }
              : {}),
          }
      : undefined;
    const persistedState: LearnerState = { version: 2, lessons: persistedLessons, artifacts: restored ? { characterRnn: restored } : {} };
    const resolution = reconcileLearnerRecoveryJournal(persistedState, readCurrentRecoveryJournal());
    const unsafeArchived = archiveRecoveryJournal(resolution.unsafe);
    const retainedCurrent = unsafeArchived
      ? resolution.safe
      : combinedRecoveryJournal(resolution.safe, resolution.unsafe);
    const recoveryStored = writeRecoveryJournal(learnerRecoveryStorageKey(), retainedCurrent);
    cachedLearner = resolution.state;
    if (!journalIsEmpty(resolution.safe)) scheduleLearnerPersistence(cachedLearner, persistedState, recoveryStored);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    window.dispatchEvent(new CustomEvent(LEARNER_RECOVERY_EVENT));
  })().catch((error) => {
    setLearnerPersistenceError(`We couldn't open the lesson progress saved in this browser. ${error instanceof Error ? error.message : "We'll use the browser recovery copy instead."}`);
    console.error("Learner progress hydration failed", error);
    if (!cachedLearner) {
      const journal = readCurrentRecoveryJournal();
      cachedLearner = {
        version: 2,
        lessons: Object.fromEntries(Object.entries(journal.lessons).map(([lessonId, entry]) => [lessonId, entry.value])),
        artifacts: journal.characterRnn ? { characterRnn: journal.characterRnn.value } : {},
      };
    }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    window.dispatchEvent(new CustomEvent(LEARNER_RECOVERY_EVENT));
  });
  return learnerHydration;
}

export async function flushLearnerPersistence() {
  await initializeLearnerPersistence();
  enqueuePendingLearnerPersistence();
  await learnerPersistenceQueue;
  if (learnerPersistenceError) throw new Error(learnerPersistenceError);
}

export function updateLearnerState(update: (state: LearnerState) => LearnerState) {
  const next = update(loadLearnerState());
  storeLearnerState(next);
  return next;
}

function lessonState(state: LearnerState, lessonId: string): LessonLocalState {
  return state.lessons[lessonId] ?? {
    verifiedCells: [],
    verifiedSources: {},
    verifiedContractVersion: null,
    experimentComplete: false,
    hiddenBlocks: [],
    answers: {},
    practiceRepetitions: emptyPracticeRepetitions(),
    knowledgeAnswers: {},
    knowledgeVerified: [],
    updatedAt: 0,
  };
}

export function saveLessonPractice(lessonId: string, hiddenBlocks: string[], answers: Record<string, string>) {
  updateLearnerState((state) => ({
    ...state,
    lessons: {
      ...state.lessons,
      [lessonId]: { ...lessonState(state, lessonId), hiddenBlocks, answers, updatedAt: Date.now() },
    },
  }));
}

export function saveLessonPracticeAndVerification(
  lessonId: string,
  hiddenBlocks: string[],
  answers: Record<string, string>,
  verifiedCells: string[],
  verifiedSources: Record<string, string>,
  verifiedContractVersion: string | null,
) {
  updateLearnerState((state) => ({
    ...state,
    lessons: {
      ...state.lessons,
      [lessonId]: {
        ...lessonState(state, lessonId),
        hiddenBlocks,
        answers,
        verifiedCells: [...new Set(verifiedCells)],
        verifiedSources,
        verifiedContractVersion: verifiedCells.length ? verifiedContractVersion : null,
        updatedAt: Date.now(),
      },
    },
  }));
}

export function saveLessonPracticeRepetitions(
  lessonId: string,
  practiceRepetitions: PracticeRepetitionProgress,
) {
  updateLearnerState((state) => ({
    ...state,
    lessons: {
      ...state.lessons,
      [lessonId]: {
        ...lessonState(state, lessonId),
        practiceRepetitions: sanitizePracticeRepetitions(practiceRepetitions),
        updatedAt: Date.now(),
      },
    },
  }));
}

export function recordVerifiedCells(
  lessonId: string,
  verifiedCells: string[],
  verifiedSources?: Record<string, string>,
  verifiedContractVersion: string | null = null,
) {
  updateLearnerState((state) => ({
    ...state,
    lessons: {
      ...state.lessons,
      [lessonId]: {
        ...lessonState(state, lessonId),
        verifiedCells: [...new Set(verifiedCells)],
        verifiedSources: verifiedSources ?? Object.fromEntries(
          Object.entries(lessonState(state, lessonId).verifiedSources).filter(([id]) => verifiedCells.includes(id)),
        ),
        verifiedContractVersion: verifiedCells.length ? verifiedContractVersion : null,
        updatedAt: Date.now(),
      },
    },
  }));
}

export function markExperimentComplete(lessonId: string) {
  updateLearnerState((state) => ({
    ...state,
    lessons: {
      ...state.lessons,
      [lessonId]: { ...lessonState(state, lessonId), experimentComplete: true, updatedAt: Date.now() },
    },
  }));
}

export function recordKnowledgeCheck(
  lessonId: string,
  checkId: string,
  choiceId: string,
  correct: boolean,
) {
  return updateLearnerState((state) => {
    const current = lessonState(state, lessonId);
    const verified = correct
      ? [...new Set([...current.knowledgeVerified, checkId])]
      : current.knowledgeVerified.filter((id) => id !== checkId);
    return {
      ...state,
      lessons: {
        ...state.lessons,
        [lessonId]: {
          ...current,
          knowledgeAnswers: { ...current.knowledgeAnswers, [checkId]: choiceId },
          knowledgeVerified: verified,
          updatedAt: Date.now(),
        },
      },
    };
  });
}

export function saveCharacterRnnArtifact(
  result: Pick<RnnResult, "checkpoint" | "finalLoss" | "parameters" | "vocabularySize">,
  origin: SavedRnnArtifact["origin"] = "javascript",
  trainedAt = Date.now(),
  binding?: CharacterRnnSourceBinding,
) {
  if (!Number.isFinite(trainedAt) || trainedAt < 0) throw new TypeError("A character-RNN checkpoint needs a valid training time.");
  const sourcePath = typeof binding?.sourcePath === "string" ? binding.sourcePath.trim() : undefined;
  const sourceHash = typeof binding?.sourceHash === "string" ? binding.sourceHash.trim() : undefined;
  if (origin === "python" && (!sourcePath || !sourceHash)) {
    throw new TypeError("A Python character-RNN checkpoint needs the exact source path and hash used for training.");
  }
  if (Boolean(sourcePath) !== Boolean(sourceHash)) {
    throw new TypeError("Save the character-RNN source path and hash together.");
  }
  const checkpointId = `character-rnn:${origin}:${trainedAt}:${encodeURIComponent(sourceHash ?? "unbound")}`;
  updateLearnerState((state) => {
    // The quick JavaScript lesson model is disposable. Once the learner has a
    // source-bound Python checkpoint, rerunning that demo must not hide the
    // checkpoint used by the project and capstone.
    if (origin === "javascript" && state.artifacts.characterRnn?.origin === "python") return state;
    return {
      ...state,
      artifacts: {
        ...state.artifacts,
        characterRnn: {
          checkpoint: result.checkpoint,
          finalLoss: result.finalLoss,
          parameters: result.parameters,
          vocabularySize: result.vocabularySize,
          trainedAt,
          origin,
          checkpointId,
          ...(sourcePath && sourceHash ? { sourcePath, sourceHash } : {}),
        },
      },
    };
  });
}

export function useLearnerState() {
  const [state, setState] = useState<LearnerState>(() => emptyLearnerState());
  useEffect(() => {
    const refresh = () => setState(loadLearnerState());
    refresh();
    void initializeLearnerPersistence();
    window.addEventListener(CHANGE_EVENT, refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
    };
  }, []);
  return state;
}

/** Keeps progress UI neutral until the durable browser record has loaded. */
export function useLearnerStateHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let active = true;
    void initializeLearnerPersistence().finally(() => {
      if (active) setHydrated(true);
    });
    return () => { active = false; };
  }, []);
  return hydrated;
}

export function useLearnerRecoveryCandidates(lessonId: string) {
  const [candidates, setCandidates] = useState<LearnerRecoveryCandidate[]>([]);
  useEffect(() => {
    const refresh = () => setCandidates(listLearnerRecoveryCandidates(lessonId));
    const refreshFromStorage = (event: StorageEvent) => {
      if (event.key === LEARNER_STATE_KEY || event.key?.startsWith(LEARNER_RECOVERY_KEY)) refresh();
    };
    refresh();
    void initializeLearnerPersistence().then(refresh);
    window.addEventListener(LEARNER_RECOVERY_EVENT, refresh);
    window.addEventListener("storage", refreshFromStorage);
    return () => {
      window.removeEventListener(LEARNER_RECOVERY_EVENT, refresh);
      window.removeEventListener("storage", refreshFromStorage);
    };
  }, [lessonId]);
  return candidates;
}

export function useLearnerPersistenceError() {
  const [error, setError] = useState<string | null>(() => getLearnerPersistenceError());
  useEffect(() => {
    const refresh = () => setError(getLearnerPersistenceError());
    window.addEventListener(LEARNER_PERSISTENCE_EVENT, refresh);
    return () => window.removeEventListener(LEARNER_PERSISTENCE_EVENT, refresh);
  }, []);
  return error;
}

export function lessonCodeIsComplete(
  state: LearnerState,
  lessonId: string,
  expectedBlockIds: readonly string[],
  expectedContractVersion: string,
) {
  const lesson = state.lessons[lessonId];
  return Boolean(
    lesson?.verifiedContractVersion === expectedContractVersion
    && expectedBlockIds.every((id) => (
      lesson.verifiedCells.includes(id)
      && typeof lesson.answers[id] === "string"
      && lesson.verifiedSources[id] === lesson.answers[id]
    )),
  );
}

export function lessonImplementationIsComplete(
  state: LearnerState,
  lessonId: string,
  expectedBlockIds: readonly string[],
  expectedContractVersion: string,
) {
  return lessonCodeIsComplete(state, lessonId, expectedBlockIds, expectedContractVersion)
    && Boolean(state.lessons[lessonId]?.experimentComplete);
}

export function lessonIsComplete(
  state: LearnerState,
  lessonId: string,
  expectedBlockIds: readonly string[],
  expectedContractVersion: string,
  checkId: string,
) {
  return lessonImplementationIsComplete(state, lessonId, expectedBlockIds, expectedContractVersion)
    && lessonKnowledgeIsComplete(state, lessonId, checkId);
}

export function lessonKnowledgeIsComplete(state: LearnerState, lessonId: string, checkId: string) {
  return state.lessons[lessonId]?.knowledgeVerified.includes(checkId) ?? false;
}
