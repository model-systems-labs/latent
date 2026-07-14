"use client";

import { useEffect, useState } from "react";
import { assertRnnCheckpoint, type RnnCheckpoint, type RnnResult } from "@latent/model-lab/character-rnn";
import { getPersistenceContext } from "../platform/persistence/client";
import { lessonProgressId } from "../platform/persistence/pure";
import type { JsonValue } from "../platform/persistence/types";

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
  knowledgeAnswers: Record<string, string>;
  knowledgeVerified: string[];
  updatedAt: number;
};

export type SavedRnnArtifact = {
  checkpoint: RnnCheckpoint;
  finalLoss: number;
  parameters: number;
  vocabularySize: number;
  trainedAt: number;
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
    knowledgeAnswers: lesson.knowledgeAnswers && typeof lesson.knowledgeAnswers === "object"
      ? Object.fromEntries(Object.entries(lesson.knowledgeAnswers).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
      : {},
    knowledgeVerified: Array.isArray(lesson.knowledgeVerified)
      ? lesson.knowledgeVerified.filter((id): id is string => typeof id === "string")
      : [],
    updatedAt: typeof lesson.updatedAt === "number" && Number.isFinite(lesson.updatedAt) ? lesson.updatedAt : 0,
  };
}

function sanitizeSavedRnnArtifact(value: unknown): SavedRnnArtifact | null {
  if (!value || typeof value !== "object") return null;
  const artifact = value as Partial<SavedRnnArtifact>;
  const checkpoint = validCheckpoint(artifact.checkpoint);
  if (!checkpoint) return null;
  return {
    checkpoint,
    finalLoss: Number(artifact.finalLoss),
    parameters: Number(artifact.parameters),
    vocabularySize: Number(artifact.vocabularySize),
    trainedAt: Number(artifact.trainedAt),
  };
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

function moduleForLesson(lessonId: string) {
  if (["character-rnns", "neural-language-models", "subword-tokenization", "additive-attention", "transformers", "in-context-learning"].includes(lessonId)) return "model-foundations";
  if (["inference-runtime", "scheduling-memory"].includes(lessonId)) return "inference-runtime";
  if (["streaming-transport", "reliability-observability"].includes(lessonId)) return "llm-serving";
  return "chat-integration";
}

function sameLearnerValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function lessonProgressRecord(lessonId: string, lesson: LessonLocalState) {
  return {
    id: lessonProgressId("llm-systems", lessonId),
    courseId: "llm-systems",
    moduleId: moduleForLesson(lessonId),
    lessonId,
    status: lesson.experimentComplete && lesson.verifiedCells.length ? "completed" as const : "in-progress" as const,
    verifiedCellIds: lesson.verifiedCells,
    verifiedSources: lesson.verifiedSources,
    verifiedContractVersion: lesson.verifiedContractVersion ?? undefined,
    experimentComplete: lesson.experimentComplete,
    hiddenBlockIds: lesson.hiddenBlocks,
    answers: lesson.answers,
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
  const durableRecord = await repositories.progress.get(lessonProgressId("llm-systems", lessonId));
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
  if (!(await repositories.projects.get("browser-chat"))) {
    try {
      await repositories.projects.create({ id: "browser-chat", title: "Browser Chat", courseId: "llm-systems" });
    } catch (error) {
      if (!(await repositories.projects.get("browser-chat"))) throw error;
    }
  }
  const changedLessonIds = Object.keys(state.lessons).filter((lessonId) => (
    !previous?.lessons[lessonId] || !sameLearnerValue(previous.lessons[lessonId], state.lessons[lessonId])
  ));
  for (const lessonId of changedLessonIds) {
    const lesson = state.lessons[lessonId];
    const before = previous?.lessons[lessonId];
    await repositories.progress.compareAndPut(
      lessonProgressRecord(lessonId, lesson),
      before ? lessonProgressRecord(lessonId, before) : null,
    );
  }
  const artifact = state.artifacts.characterRnn;
  if (artifact && artifact.trainedAt !== previous?.artifacts.characterRnn?.trainedAt) {
    const id = `character-rnn:${artifact.trainedAt}`;
    if (!(await database.checkpoints.get(id))) {
      await repositories.checkpoints.add({
        id,
        projectId: "browser-chat",
        buildId: null,
        kind: "character-rnn",
        formatVersion: 1,
        payload: artifact.checkpoint as unknown as JsonValue,
        metrics: {
          finalLoss: artifact.finalLoss,
          parameters: artifact.parameters,
          vocabularySize: artifact.vocabularySize,
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
        ? `History sync failed, but a browser recovery copy remains available. ${error instanceof Error ? error.message : "Reload before editing in another tab."}`
        : "This browser could not save lesson progress. Copy your code before leaving this page.");
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
  if (!recoveryStored) setLearnerPersistenceError("Browser recovery storage is unavailable. Keep this tab open until history sync completes.");
  scheduleLearnerPersistence(cachedLearner, previous, recoveryStored);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function initializeLearnerPersistence() {
  if (typeof window === "undefined") return Promise.resolve();
  learnerHydration ??= (async () => {
    const { database, repositories } = await getPersistenceContext();
    const [progress, checkpointRecords] = await Promise.all([
      repositories.progress.forCourse("llm-systems"),
      database.checkpoints.where("projectId").equals("browser-chat").filter((record) => record.kind === "character-rnn").sortBy("createdAt"),
    ]);
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
    setLearnerPersistenceError(`Lesson progress could not open durable storage. ${error instanceof Error ? error.message : "A browser recovery copy will be used."}`);
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

export function saveCharacterRnnArtifact(result: RnnResult) {
  updateLearnerState((state) => ({
    ...state,
    artifacts: {
      ...state.artifacts,
      characterRnn: {
        checkpoint: result.checkpoint,
        finalLoss: result.finalLoss,
        parameters: result.parameters,
        vocabularySize: result.vocabularySize,
        trainedAt: Date.now(),
      },
    },
  }));
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

export function lessonImplementationIsComplete(state: LearnerState, lessonId: string, totalCells: number) {
  const lesson = state.lessons[lessonId];
  return Boolean(lesson?.experimentComplete && lesson.verifiedCells.length >= totalCells);
}

export function lessonIsComplete(state: LearnerState, lessonId: string, totalCells: number, checkId: string) {
  return lessonImplementationIsComplete(state, lessonId, totalCells)
    && lessonKnowledgeIsComplete(state, lessonId, checkId);
}

export function lessonKnowledgeIsComplete(state: LearnerState, lessonId: string, checkId: string) {
  return state.lessons[lessonId]?.knowledgeVerified.includes(checkId) ?? false;
}
