"use client";

import { useEffect, useState } from "react";
import { assertRnnCheckpoint, type RnnCheckpoint, type RnnResult } from "@latent/model-lab/character-rnn";
import { getPersistenceContext } from "../platform/persistence/client";
import { lessonProgressId } from "../platform/persistence/pure";
import type { JsonValue } from "../platform/persistence/types";

export const LEARNER_STATE_KEY = "latent-learner-v2";
const CHANGE_EVENT = "latent-learner-state-change";

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

function sanitizeLearnerState(value: unknown): LearnerState {
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== 2) return emptyLearnerState();
  const candidate = value as Partial<LearnerState>;
  const lessons: Record<string, LessonLocalState> = {};
  if (candidate.lessons && typeof candidate.lessons === "object") {
    for (const [lessonId, raw] of Object.entries(candidate.lessons)) {
      if (!raw || typeof raw !== "object") continue;
      const lesson = raw as Partial<LessonLocalState>;
      lessons[lessonId] = {
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
        updatedAt: typeof lesson.updatedAt === "number" ? lesson.updatedAt : 0,
      };
    }
  }
  const rawArtifact = candidate.artifacts?.characterRnn;
  const checkpoint = rawArtifact ? validCheckpoint(rawArtifact.checkpoint) : null;
  const characterRnn = rawArtifact && checkpoint
    ? {
        checkpoint,
        finalLoss: Number(rawArtifact.finalLoss),
        parameters: Number(rawArtifact.parameters),
        vocabularySize: Number(rawArtifact.vocabularySize),
        trainedAt: Number(rawArtifact.trainedAt),
      }
    : undefined;
  return { version: 2, lessons, artifacts: characterRnn ? { characterRnn } : {} };
}

function loadLegacyLearnerState(): LearnerState {
  if (typeof window === "undefined") return emptyLearnerState();
  try {
    const serialized = window.localStorage.getItem(LEARNER_STATE_KEY);
    return serialized ? sanitizeLearnerState(JSON.parse(serialized)) : emptyLearnerState();
  } catch {
    return emptyLearnerState();
  }
}

let cachedLearner: LearnerState | null = null;
let learnerHydration: Promise<void> | null = null;
let learnerPersistenceQueue: Promise<void> = Promise.resolve();

export function loadLearnerState(): LearnerState {
  return cachedLearner ?? loadLegacyLearnerState();
}

function moduleForLesson(lessonId: string) {
  if (["character-rnns", "neural-language-models", "subword-tokenization", "additive-attention", "transformers", "in-context-learning"].includes(lessonId)) return "model-foundations";
  if (["inference-runtime", "scheduling-memory"].includes(lessonId)) return "inference-runtime";
  if (["streaming-transport", "reliability-observability"].includes(lessonId)) return "llm-serving";
  return "chat-integration";
}

async function persistLearnerState(state: LearnerState) {
  const { database, repositories } = await getPersistenceContext();
  if (!(await repositories.projects.get("browser-chat"))) {
    await repositories.projects.create({ id: "browser-chat", title: "Browser Chat", courseId: "llm-systems" });
  }
  await Promise.all(Object.entries(state.lessons).map(([lessonId, lesson]) => repositories.progress.put({
    id: lessonProgressId("llm-systems", lessonId),
    courseId: "llm-systems",
    moduleId: moduleForLesson(lessonId),
    lessonId,
    status: lesson.experimentComplete && lesson.verifiedCells.length ? "completed" : "in-progress",
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
  })));
  const artifact = state.artifacts.characterRnn;
  if (artifact) {
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

function scheduleLearnerPersistence(state: LearnerState) {
  learnerPersistenceQueue = learnerPersistenceQueue
    .then(() => persistLearnerState(state))
    .catch((error) => console.error("Learner progress persistence failed", error));
}

function storeLearnerState(state: LearnerState) {
  cachedLearner = sanitizeLearnerState(state);
  scheduleLearnerPersistence(cachedLearner);
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
    if (!cachedLearner) {
      const legacy = loadLegacyLearnerState();
      const lessons = { ...legacy.lessons };
      for (const record of progress) {
        lessons[record.lessonId] = {
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
        : legacy.artifacts.characterRnn;
      cachedLearner = { version: 2, lessons, artifacts: restored ? { characterRnn: restored } : {} };
    }
    scheduleLearnerPersistence(cachedLearner);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  })().catch((error) => {
    console.error("Learner progress hydration failed", error);
    cachedLearner ??= loadLegacyLearnerState();
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  });
  return learnerHydration;
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
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return state;
}

export function lessonIsComplete(state: LearnerState, lessonId: string, totalCells: number) {
  const lesson = state.lessons[lessonId];
  return Boolean(lesson?.experimentComplete && lesson.verifiedCells.length >= totalCells);
}

export function lessonKnowledgeIsComplete(state: LearnerState, lessonId: string, checkId: string) {
  return state.lessons[lessonId]?.knowledgeVerified.includes(checkId) ?? false;
}
