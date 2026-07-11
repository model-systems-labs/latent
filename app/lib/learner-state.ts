"use client";

import { useEffect, useState } from "react";
import type { RnnCheckpoint, RnnResult } from "./lab-engines";

export const LEARNER_STATE_KEY = "latent-learner-v2";
const CHANGE_EVENT = "latent-learner-state-change";

export type LessonLocalState = {
  verifiedCells: string[];
  experimentComplete: boolean;
  hiddenBlocks: string[];
  answers: Record<string, string>;
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

function validCheckpoint(value: unknown): value is RnnCheckpoint {
  if (!value || typeof value !== "object") return false;
  const checkpoint = value as Partial<RnnCheckpoint>;
  return checkpoint.version === 1 && Array.isArray(checkpoint.vocabulary) && Array.isArray(checkpoint.Wxh)
    && Array.isArray(checkpoint.Whh) && Array.isArray(checkpoint.Why) && Array.isArray(checkpoint.bh)
    && Array.isArray(checkpoint.by) && typeof checkpoint.hiddenSize === "number";
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
        experimentComplete: lesson.experimentComplete === true,
        hiddenBlocks: Array.isArray(lesson.hiddenBlocks) ? lesson.hiddenBlocks.filter((id): id is string => typeof id === "string") : [],
        answers: lesson.answers && typeof lesson.answers === "object"
          ? Object.fromEntries(Object.entries(lesson.answers).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
          : {},
        updatedAt: typeof lesson.updatedAt === "number" ? lesson.updatedAt : 0,
      };
    }
  }
  const rawArtifact = candidate.artifacts?.characterRnn;
  const characterRnn = rawArtifact && validCheckpoint(rawArtifact.checkpoint)
    ? {
        checkpoint: rawArtifact.checkpoint,
        finalLoss: Number(rawArtifact.finalLoss),
        parameters: Number(rawArtifact.parameters),
        vocabularySize: Number(rawArtifact.vocabularySize),
        trainedAt: Number(rawArtifact.trainedAt),
      }
    : undefined;
  return { version: 2, lessons, artifacts: characterRnn ? { characterRnn } : {} };
}

export function loadLearnerState(): LearnerState {
  if (typeof window === "undefined") return emptyLearnerState();
  try {
    const serialized = window.localStorage.getItem(LEARNER_STATE_KEY);
    return serialized ? sanitizeLearnerState(JSON.parse(serialized)) : emptyLearnerState();
  } catch {
    return emptyLearnerState();
  }
}

function storeLearnerState(state: LearnerState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LEARNER_STATE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function updateLearnerState(update: (state: LearnerState) => LearnerState) {
  const next = update(loadLearnerState());
  storeLearnerState(next);
  return next;
}

function lessonState(state: LearnerState, lessonId: string): LessonLocalState {
  return state.lessons[lessonId] ?? { verifiedCells: [], experimentComplete: false, hiddenBlocks: [], answers: {}, updatedAt: 0 };
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

export function recordVerifiedCells(lessonId: string, verifiedCells: string[]) {
  updateLearnerState((state) => ({
    ...state,
    lessons: {
      ...state.lessons,
      [lessonId]: { ...lessonState(state, lessonId), verifiedCells: [...new Set(verifiedCells)], updatedAt: Date.now() },
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
